import { useCallback, useEffect } from "react";
import { AnimatePresence } from "framer-motion";

import { useSynapse } from "@/context/SynapseProvider";
import "@/styles/synapse-agent.css";
import { SynapseCompactPanel } from "./SynapseCompactPanel";
import { SynapsePill } from "./SynapsePill";
import { SynapseScreenAgentOverlay } from "./SynapseScreenAgentOverlay";

export const SynapseGlobalShell = () => {
    const { isVisible, shellState, setShellState } = useSynapse();

    const handleKeyDown = useCallback(
        (event: KeyboardEvent) => {
            if ((event.ctrlKey || event.metaKey) && event.key === "j") {
                event.preventDefault();
                setShellState(shellState === "compact" ? "pill" : "compact");
            }

            if (event.key === "Escape" && shellState === "compact") {
                setShellState("pill");
            }
        },
        [shellState, setShellState],
    );

    useEffect(() => {
        document.addEventListener("keydown", handleKeyDown);
        return () => document.removeEventListener("keydown", handleKeyDown);
    }, [handleKeyDown]);

    if (!isVisible) return <SynapseScreenAgentOverlay />;

    return (
        <>
            <SynapseScreenAgentOverlay />
            <div className="fixed bottom-6 right-6 flex flex-col items-end gap-3" style={{ zIndex: 9990 }}>
                <AnimatePresence initial={false} mode="wait">
                    {shellState === "compact" ? <SynapseCompactPanel key="compact" /> : <SynapsePill key="pill" />}
                </AnimatePresence>
            </div>
        </>
    );
};
