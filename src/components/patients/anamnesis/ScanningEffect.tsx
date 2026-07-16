import { motion, useReducedMotion } from "framer-motion";

export const ScanningEffect = ({ isActive }: { isActive: boolean }) => {
    const shouldReduceMotion = useReducedMotion();
    if (!isActive) return null;

    return (
        <div className="absolute inset-0 pointer-events-none overflow-hidden rounded-[40px] z-10">
            {/* Subtle neutral overlay that follows the record surface. */}
            <div className="absolute inset-0 bg-zinc-950/24 backdrop-blur-[1px] dark:bg-black/38" />

            {/* Clean scan beam — single horizontal line */}
            {shouldReduceMotion ? (
                <div className="absolute inset-x-0 top-1/2 h-px bg-zinc-500/45 dark:bg-zinc-700/70" />
            ) : (
                <motion.div
                    initial={{ top: "-5%" }}
                    animate={{ top: ["-5%", "105%"] }}
                    transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
                    className="absolute left-0 right-0"
                >
                    <div className="h-px w-full bg-zinc-500/65 shadow-[0_0_20px_rgba(82,82,91,0.32)] dark:bg-zinc-700/85 dark:shadow-[0_0_20px_rgba(39,39,42,0.72)]" />
                    <div className="h-16 w-full bg-gradient-to-b from-zinc-400/8 to-transparent dark:from-zinc-800/16" />
                </motion.div>
            )}

            {/* Single subtle pulse ring */}
            {!shouldReduceMotion ? (
                <motion.div
                    initial={{ scale: 0.6, opacity: 0.4 }}
                    animate={{ scale: [0.6, 1.3], opacity: [0.3, 0] }}
                    transition={{ duration: 2.5, repeat: Infinity, ease: "easeOut" }}
                    className="absolute inset-0 m-auto h-48 w-48 rounded-full border border-zinc-400/15 dark:border-zinc-800/80"
                />
            ) : null}
        </div>
    );
};
