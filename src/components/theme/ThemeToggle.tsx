import { cn } from "@/lib/utils";
import { AnimatePresence, motion } from "framer-motion";
import { Moon, Sun } from "lucide-react";
import type { MouseEvent } from "react";
import { useThemeTransition } from "@/hooks/useThemeTransition";

export const ThemeToggle = () => {
    const { isLight, toggleTheme, isTransitioning } = useThemeTransition();

    const handleToggle = (event: MouseEvent<HTMLButtonElement>) => {
        if (!isTransitioning) {
            toggleTheme(event);
        }
    };

    return (
        <div className="relative flex items-center justify-center p-1 group/toggle">
            {/* Button Background Glow (Acender effect) */}
            <motion.div
                className="absolute inset-x-0 inset-y-0 rounded-full blur-md opacity-0 group-hover/toggle:opacity-100 transition-opacity duration-700 pointer-events-none"
                animate={{
                    backgroundColor: isLight ? "rgba(0,0,0,0.05)" : "rgba(255,255,255,0.08)",
                    scale: isTransitioning ? [1, 1.4, 1] : 1
                }}
            />

            <motion.button
                onClick={handleToggle}
                disabled={isTransitioning}
                className={cn(
                    "relative p-3 rounded-full flex items-center justify-center border overflow-hidden",
                    "backdrop-blur-xl transition-[background-color,border-color,color,box-shadow,transform] duration-200 haptic-feedback",
                    isLight
                        ? "bg-white/40 border-black/5 text-black/80 shadow-[0_8px_32px_-4px_rgba(0,0,0,0.1)] hover:bg-white/60"
                        : "bg-black/40 border-white/5 text-white/80 shadow-[0_8px_32px_-4px_rgba(255,255,255,0.05)] hover:bg-black/60",
                    isTransitioning && "pointer-events-none scale-95 brightness-110"
                )}
                whileTap={{ scale: 0.985 }}
                title={isLight ? "Ativar Modo Escuro" : "Ativar Modo Claro"}
                aria-label={isLight ? "Ativar modo escuro" : "Ativar modo claro"}
            >
                {/* Liquid Ripple Overlay */}
                <AnimatePresence>
                    {isTransitioning && (
                        <motion.span
                            key="ripple"
                            className="absolute inset-0 rounded-full z-0"
                            initial={{ scale: 0, opacity: 1 }}
                            animate={{ scale: 2.5, opacity: 0 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.8, ease: "circOut" }}
                            style={{
                                background: isLight
                                    ? "radial-gradient(circle, rgba(0,0,0,0.1), transparent 70%)"
                                    : "radial-gradient(circle, rgba(255,255,255,0.15), transparent 70%)"
                            }}
                        />
                    )}
                </AnimatePresence>

                <div className="relative z-10">
                    <AnimatePresence mode="wait" initial={false}>
                        {isLight ? (
                            <motion.div
                                key="moon"
                                initial={{ y: 20, rotate: -20, opacity: 0, filter: "blur(4px)" }}
                                animate={{ y: 0, rotate: 0, opacity: 1, filter: "blur(0px)" }}
                                exit={{ y: -20, rotate: 20, opacity: 0, filter: "blur(4px)" }}
                                transition={{
                                    duration: 0.24,
                                    ease: [0.22, 1, 0.36, 1]
                                }}
                            >
                                <Moon className="w-4 h-4" strokeWidth={1.5} />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="sun"
                                initial={{ y: -20, rotate: 20, opacity: 0, filter: "blur(4px)" }}
                                animate={{ y: 0, rotate: 0, opacity: 1, filter: "blur(0px)" }}
                                exit={{ y: 20, rotate: -20, opacity: 0, filter: "blur(4px)" }}
                                transition={{
                                    duration: 0.24,
                                    ease: [0.22, 1, 0.36, 1]
                                }}
                            >
                                <Sun className="w-4 h-4" strokeWidth={1.5} />
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>
            </motion.button>

        </div>
    );
};
