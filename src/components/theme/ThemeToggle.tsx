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
        <div className="relative flex items-center justify-center p-1">
            <motion.button
                onClick={handleToggle}
                className={cn(
                    "relative flex h-11 w-11 items-center justify-center overflow-hidden rounded-full border",
                    "backdrop-blur-xl motion-safe:transition-[background-color,border-color,color,box-shadow,filter,scale,translate] motion-safe:duration-200 motion-safe:ease-apple",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background",
                    "motion-safe:hover:-translate-y-px motion-safe:active:translate-y-px motion-safe:active:scale-[0.975]",
                    isLight
                        ? "border-black/[0.07] bg-white/72 text-black/75 shadow-[0_10px_28px_-18px_rgba(0,0,0,0.36),inset_0_1px_0_rgba(255,255,255,0.9)] hover:border-black/10 hover:bg-white/90 hover:text-black"
                        : "border-white/[0.075] bg-black/42 text-white/72 shadow-[0_12px_30px_-20px_rgba(0,0,0,0.94),inset_0_1px_0_rgba(255,255,255,0.055)] hover:border-white/10 hover:bg-black/58 hover:text-white",
                    isTransitioning && "cursor-progress"
                )}
                title={isLight ? "Ativar Modo Escuro" : "Ativar Modo Claro"}
                aria-label={isLight ? "Ativar modo escuro" : "Ativar modo claro"}
                aria-busy={isTransitioning}
            >
                <div className="relative z-10 flex items-center justify-center">
                    <AnimatePresence mode="wait" initial={false}>
                        {isLight ? (
                            <motion.div
                                key="moon"
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.92, opacity: 0 }}
                                transition={{
                                    duration: 0.16,
                                    ease: [0.22, 1, 0.36, 1]
                                }}
                            >
                                <Moon className="w-4 h-4" strokeWidth={1.5} />
                            </motion.div>
                        ) : (
                            <motion.div
                                key="sun"
                                initial={{ scale: 0.9, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                exit={{ scale: 0.92, opacity: 0 }}
                                transition={{
                                    duration: 0.16,
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
