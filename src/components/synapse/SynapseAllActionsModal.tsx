import { Activity, ChevronRight, Sparkles, X } from 'lucide-react';

import {
    Dialog,
    DialogClose,
    DialogContent,
    DialogDescription,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';

type SynapseTool = {
    name: string;
};

interface SynapseAllActionsModalProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    availableTools: SynapseTool[];
    handleActionClick: (toolName: string) => void;
    ctxInfo: { label: string };
}

export function SynapseAllActionsModal({
    open,
    onOpenChange,
    availableTools,
    handleActionClick,
    ctxInfo,
}: SynapseAllActionsModalProps) {
    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent showCloseButton={false} className="synapse-actions-modal max-h-[min(680px,calc(100dvh-24px))] max-w-[min(520px,calc(100vw-24px))] gap-0 overflow-hidden p-0">
                <DialogHeader className="synapse-actions-modal-header p-5 pr-16">
                    <div className="flex items-center gap-3">
                        <span className="synapse-actions-modal-mark flex h-10 w-10 shrink-0 items-center justify-center" aria-hidden="true">
                            <Sparkles className="h-4 w-4" />
                        </span>
                        <div>
                            <DialogTitle className="text-[16px] font-semibold tracking-normal">Ações do Synapse</DialogTitle>
                            <DialogDescription className="mt-1 text-[11px] font-medium leading-4">Disponíveis em {ctxInfo.label}</DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <DialogClose className="synapse-actions-modal-close absolute right-3 top-3 flex h-11 w-11 items-center justify-center text-muted-foreground focus:outline-none focus:ring-2 focus:ring-ring" aria-label="Fechar ações">
                    <X className="h-4 w-4" />
                </DialogClose>

                <div className="min-h-0 flex-1 overflow-y-auto px-4 py-3">
                    {availableTools.length === 0 ? (
                        <div className="synapse-empty-state py-16 text-center text-[12px]">Nenhuma ação disponível neste contexto.</div>
                    ) : (
                        <div className="synapse-actions-list divide-y" role="list">
                            {availableTools.map((tool) => (
                                <button
                                    key={tool.name}
                                    type="button"
                                    role="listitem"
                                    onClick={() => handleActionClick(tool.name)}
                                    className="synapse-actions-row group flex min-h-[64px] w-full items-center gap-3 px-2 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring"
                                >
                                    <span className="synapse-command-icon flex h-9 w-9 shrink-0 items-center justify-center">
                                        <Activity className="h-4 w-4" />
                                    </span>
                                    <span className="min-w-0 flex-1 truncate text-[12px] font-semibold text-foreground">
                                        {tool.name.replace(/_/g, ' ')}
                                    </span>
                                    <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover:translate-x-0.5 motion-reduce:transform-none" />
                                </button>
                            ))}
                        </div>
                    )}
                </div>

                <footer className="synapse-actions-modal-footer px-5 py-3">
                    <p className="text-[10px] font-medium text-muted-foreground">{availableTools.length} ações disponíveis</p>
                </footer>
            </DialogContent>
        </Dialog>
    );
}
