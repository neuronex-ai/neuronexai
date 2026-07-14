import { createContext, useContext } from 'react';

import type { SynapseActionLifecycleEvent } from '@/lib/synapse-interface-actions';
import type { PcmAudioSignal } from '@/lib/pcm-audio-player';
import type { SynapseTool } from '@/lib/synapse-tool-catalog';

export type SynapseShellState = 'closed' | 'pill' | 'compact';

export type SynapseExecState =
  | 'idle'
  | 'listening'
  | 'thinking'
  | 'executing'
  | 'success'
  | 'error';

export type SynapseActiveTab = 'chat' | 'voice' | 'history' | 'timeline';

export interface SynapseTimelineEntry {
  id: string;
  timestamp: Date;
  label: string;
  state: SynapseExecState;
  toolId?: string;
  detail?: string;
  actionPath?: string;
}

export interface SynapseContextType {
  shellState: SynapseShellState;
  setShellState: (state: SynapseShellState) => void;
  toggleCompact: () => void;
  activeTab: SynapseActiveTab;
  setActiveTab: (tab: SynapseActiveTab) => void;
  execState: SynapseExecState;
  setExecState: (state: SynapseExecState) => void;
  availableTools: SynapseTool[];
  quickActions: SynapseTool[];
  timeline: SynapseTimelineEntry[];
  addTimelineEntry: (entry: Omit<SynapseTimelineEntry, 'id' | 'timestamp'>) => void;
  clearTimeline: () => void;
  actionExperience: SynapseActionLifecycleEvent | null;
  setActionExperience: (event: SynapseActionLifecycleEvent | null) => void;
  cancelActionExperience: () => void;
  activeSessionId: string | null;
  setActiveSessionId: (id: string | null) => void;
  inputDraft: string;
  setInputDraft: (text: string) => void;
  isVisible: boolean;
  voiceStatus: 'disconnected' | 'connecting' | 'connected' | 'disconnecting' | 'error';
  isVoiceSpeaking: boolean;
  voicePhase: string;
  isVoiceToolActive: boolean;
  voiceActivityToolName: string;
  voiceActivityLabel: string;
  voiceActivityMessage: string;
  voiceActivityElapsedMs: number;
  getVoiceInputVolume: () => number;
  getVoiceInputSignal: () => PcmAudioSignal;
  getVoiceOutputSignal: () => PcmAudioSignal;
  toggleVoiceMode: () => Promise<void>;
  isVoiceExpanded: boolean;
  setIsVoiceExpanded: (expanded: boolean) => void;
}

export const SynapseContext = createContext<SynapseContextType | undefined>(undefined);

export const useSynapse = () => {
  const context = useContext(SynapseContext);
  if (!context) throw new Error('useSynapse must be used within SynapseProvider');
  return context;
};
