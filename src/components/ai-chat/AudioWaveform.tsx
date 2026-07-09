import { cn } from "@/lib/utils";

export const AudioWaveform = ({
  isListening,
  className,
  barClassName,
}: {
  isListening: boolean;
  className?: string;
  barClassName?: string;
}) => {
  if (!isListening) return null;

  return (
    <div className={cn("flex h-8 items-center justify-center gap-1", className)}>
      {[...Array(5)].map((_, i) => (
        <div
          key={i}
          className={cn(
            "w-1 animate-audio-wave rounded-full bg-primary",
            "bg-gradient-to-t from-primary/50 to-primary",
            barClassName,
          )}
          style={{
            height: "100%",
            animationDelay: `${i * 0.1}s`,
            animationDuration: "0.8s",
          }}
        />
      ))}
    </div>
  );
};
