import { cn } from "@/lib/utils";

interface DesktopLumenBackdropProps {
  className?: string;
}

export const DesktopLumenBackdrop = ({ className }: DesktopLumenBackdropProps) => (
  <div
    aria-hidden="true"
    className={cn("desktop-lumen-field pointer-events-none fixed inset-0 z-0", className)}
  />
);
