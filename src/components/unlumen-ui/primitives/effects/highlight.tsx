"use client";

import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { motion } from "framer-motion";

import { cn } from "@/lib/utils";

type HighlightProps = React.ComponentPropsWithoutRef<"div"> & {
  mode?: "parent" | "children";
  controlledItems?: boolean;
  hover?: boolean;
  containerClassName?: string;
};

type HighlightRect = {
  left: number;
  top: number;
  width: number;
  height: number;
};

const HighlightContext = React.createContext(true);

export function Highlight({
  children,
  className,
  containerClassName,
  style,
  hover = true,
  ...props
}: HighlightProps) {
  const containerRef = React.useRef<HTMLDivElement | null>(null);
  const [rect, setRect] = React.useState<HighlightRect | null>(null);

  const updateHighlight = React.useCallback((target: EventTarget | null) => {
    const container = containerRef.current;
    if (!container || !(target instanceof Element)) return;

    const item = target.closest<HTMLElement>("[data-highlight-item]");
    if (!item || !container.contains(item)) return;

    const containerRect = container.getBoundingClientRect();
    const itemRect = item.getBoundingClientRect();
    setRect({
      left: itemRect.left - containerRect.left,
      top: itemRect.top - containerRect.top,
      width: itemRect.width,
      height: itemRect.height,
    });
  }, []);

  return (
    <HighlightContext.Provider value>
      <div
        ref={containerRef}
        className={cn("relative isolate", containerClassName)}
        onPointerMove={(event) => {
          props.onPointerMove?.(event);
          if (hover) updateHighlight(event.target);
        }}
        onPointerLeave={(event) => {
          props.onPointerLeave?.(event);
          setRect(null);
        }}
        onFocusCapture={(event) => {
          props.onFocusCapture?.(event);
          updateHighlight(event.target);
        }}
        onBlurCapture={(event) => {
          props.onBlurCapture?.(event);
          if (!event.currentTarget.contains(event.relatedTarget as Node | null)) {
            setRect(null);
          }
        }}
      >
        <motion.div
          aria-hidden="true"
          initial={false}
          animate={
            rect
              ? { ...rect, opacity: 1, scale: 1 }
              : { opacity: 0, scale: 0.98 }
          }
          transition={{ type: "spring", stiffness: 420, damping: 34, mass: 0.7 }}
          className={cn("pointer-events-none absolute", className)}
          style={style}
        />
        {children}
      </div>
    </HighlightContext.Provider>
  );
}

type HighlightItemProps = React.ComponentPropsWithoutRef<"span"> & {
  asChild?: boolean;
};

export function HighlightItem({ asChild, className, ...props }: HighlightItemProps) {
  React.useContext(HighlightContext);
  const Comp = asChild ? Slot : "span";

  return (
    <Comp
      data-highlight-item=""
      className={cn("relative", className)}
      {...props}
    />
  );
}

export default Highlight;
