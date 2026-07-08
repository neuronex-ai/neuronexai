import { useState, useEffect, useCallback, useRef } from 'react';
import { getElectronAPI, isElectron, UpdateStatus, UpdateStatusData } from '@/lib/electron';

interface UseAppUpdateReturn {
    status: UpdateStatus;
    updateVersion: string | null;
    downloadPercent: number;
    releaseNotes: string | null;
    error: string | null;
    currentVersion: string | null;
    isUpdateAvailable: boolean;
    isDownloading: boolean;
    isDownloaded: boolean;
    showModal: boolean;
    checkForUpdates: () => void;
    downloadUpdate: () => void;
    installUpdate: () => void;
    dismissModal: () => void;
}

const DISMISSED_VERSION_KEY = 'neuronex_dismissed_update_version';

export function useAppUpdate(): UseAppUpdateReturn {
    const [status, setStatus] = useState<UpdateStatus>('idle');
    const [updateVersion, setUpdateVersion] = useState<string | null>(null);
    const [downloadPercent, setDownloadPercent] = useState(0);
    const [releaseNotes, setReleaseNotes] = useState<string | null>(null);
    const [error, setError] = useState<string | null>(null);
    const [currentVersion, setCurrentVersion] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const listenerAttached = useRef(false);

    // Get version on mount
    useEffect(() => {
        if (!isElectron()) return;
        const api = getElectronAPI();
        api?.updater.getVersion().then((v) => setCurrentVersion(v));
    }, []);

    // Listen for updater status events from main process
    useEffect(() => {
        if (!isElectron() || listenerAttached.current) return;
        const api = getElectronAPI();
        if (!api) return;

        listenerAttached.current = true;

        api.updater.onStatus((data: UpdateStatusData) => {
            setStatus(data.status);

            switch (data.status) {
                case 'available': {
                    setUpdateVersion(data.version || null);
                    if (data.releaseNotes) {
                        if (typeof data.releaseNotes === 'string') {
                            setReleaseNotes(data.releaseNotes);
                        } else if (Array.isArray(data.releaseNotes)) {
                            setReleaseNotes(data.releaseNotes.map(n => n.note).join('\n'));
                        }
                    }

                    // Show modal only if user hasn't dismissed this version
                    const dismissed = localStorage.getItem(DISMISSED_VERSION_KEY);
                    if (dismissed !== data.version) {
                        setShowModal(true);
                    }
                    break;
                }

                case 'downloading':
                    setDownloadPercent(data.percent || 0);
                    break;

                case 'downloaded':
                    setUpdateVersion(data.version || null);
                    setShowModal(true);
                    break;

                case 'error':
                    setError(data.error || 'Erro desconhecido');
                    break;

                case 'not-available':
                    setError(null);
                    break;
            }
        });

        return () => {
            api.removeAllListeners('updater:status');
            listenerAttached.current = false;
        };
    }, []);

    const checkForUpdates = useCallback(() => {
        if (!isElectron()) return;
        const api = getElectronAPI();
        setStatus('checking');
        setError(null);
        api?.updater.checkForUpdates();
    }, []);

    const downloadUpdate = useCallback(() => {
        if (!isElectron()) return;
        const api = getElectronAPI();
        setStatus('downloading');
        setDownloadPercent(0);
        api?.updater.downloadUpdate();
    }, []);

    const installUpdate = useCallback(() => {
        if (!isElectron()) return;
        const api = getElectronAPI();
        api?.updater.installUpdate();
    }, []);

    const dismissModal = useCallback(() => {
        setShowModal(false);
        // Remember dismissed version so we don't pester user
        if (updateVersion) {
            localStorage.setItem(DISMISSED_VERSION_KEY, updateVersion);
        }
    }, [updateVersion]);

    return {
        status,
        updateVersion,
        downloadPercent,
        releaseNotes,
        error,
        currentVersion,
        isUpdateAvailable: status === 'available',
        isDownloading: status === 'downloading',
        isDownloaded: status === 'downloaded',
        showModal,
        checkForUpdates,
        downloadUpdate,
        installUpdate,
        dismissModal,
    };
}
