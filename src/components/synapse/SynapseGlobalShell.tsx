import { useCallback, useEffect } from "react";
import { AnimatePresence, motion } from "framer-motion";

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
            <div
                className="fixed bottom-6 right-6 flex items-end"
                style={{ zIndex: 9990 }}
            >
                <AnimatePresence initial={false} mode="wait">
                    {shellState === "compact" ? (
                        <motion.div
                            key="compact"
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            style={{ transformOrigin: "bottom right" }}
                        >
                            <SynapseCompactPanel />
                        </motion.div>
                    ) : (
                        <motion.div
                            key="pill"
                            initial={{ opacity: 0, scale: 0.9, y: 10 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.9, y: 10 }}
                            transition={{ duration: 0.2, ease: "easeOut" }}
                            style={{ transformOrigin: "bottom right" }}
                        >
                            <SynapsePill />
                        </motion.div>
                    )}
                </AnimatePresence>
            </div>
        </>
    );
};