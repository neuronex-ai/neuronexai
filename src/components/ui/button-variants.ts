import { cva } from "class-variance-authority";

export const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-xl text-sm font-medium ring-offset-background motion-safe:transition-colors motion-safe:duration-150 motion-safe:ease-apple focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 motion-safe:active:scale-[0.98]",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md active:shadow-sm",
        destructive:
          "bg-destructive text-destructive-foreground hover:bg-destructive/90 hover:shadow-md active:shadow-sm",
        outline:
          "border border-input bg-background hover:bg-accent hover:text-accent-foreground hover:border-accent-foreground/20",
        secondary:
          "bg-secondary text-secondary-foreground hover:bg-secondary/80 hover:shadow-sm",
        ghost: "hover:bg-accent hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
        premium: "bg-white/10 backdrop-blur-xl border border-white/10 text-white shadow-premium hover:bg-white/15 hover:border-white/20 hover:shadow-premium-lg",
        glass: "bg-black/40 backdrop-blur-xl border border-white/10 text-white hover:bg-black/50 hover:border-white/15 shadow-liquid",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-11 rounded-lg px-3 text-xs",
        lg: "h-12 rounded-xl px-8 text-base",
        xl: "h-14 rounded-2xl px-10 text-lg",
        icon: "h-11 w-11",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  },
);
