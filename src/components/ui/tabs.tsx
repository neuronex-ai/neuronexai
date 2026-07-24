import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";
import { motion } from "framer-motion";

import { useReducedMotionPreference } from "@/hooks/use-reduced-motion-preference";
import { cn } from "@/lib/utils";

type MagneticTabsContextValue = {
  activeValue: string | undefined;
  indicatorId: string;
  magnetic: boolean;
  reducedMotion: boolean;
};

const MagneticTabsContext = React.createContext<MagneticTabsContextValue | null>(null);

type TabsProps = React.ComponentPropsWithoutRef<typeof TabsPrimitive.Root> & {
  magnetic?: boolean;
  magneticIndicatorId?: string;
};

const Tabs = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Root>,
  TabsProps
>(({
  magnetic = false,
  magneticIndicatorId,
  value,
  defaultValue,
  onValueChange,
  ...props
}, ref) => {
  const generatedId = React.useId().replace(/:/g, "");
  const [uncontrolledValue, setUncontrolledValue] = React.useState(defaultValue);
  const reducedMotion = useReducedMotionPreference();
  const activeValue = value ?? uncontrolledValue;
  const indicatorId = magneticIndicatorId || `desktop-magnetic-tabs-${generatedId}`;

  const handleValueChange = React.useCallback((nextValue: string) => {
    setUncontrolledValue(nextValue);
    onValueChange?.(nextValue);
  }, [onValueChange]);

  const contextValue = React.useMemo<MagneticTabsContextValue>(() => ({
    activeValue,
    indicatorId,
    magnetic,
    reducedMotion,
  }), [activeValue, indicatorId, magnetic, reducedMotion]);

  return (
    <MagneticTabsContext.Provider value={contextValue}>
      <TabsPrimitive.Root
        ref={ref}
        value={value}
        defaultValue={defaultValue}
        onValueChange={handleValueChange}
        data-magnetic-tabs={magnetic ? "true" : undefined}
        {...props}
      />
    </MagneticTabsContext.Provider>
  );
});
Tabs.displayName = TabsPrimitive.Root.displayName;

const TabsList = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.List>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.List>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.List
    ref={ref}
    className={cn(
      "inline-flex min-h-11 items-center justify-center gap-1 rounded-[16px] border border-border/55 bg-muted/55 p-1 text-muted-foreground shadow-[inset_0_1px_0_hsl(var(--background)/0.7),0_12px_28px_-24px_hsl(var(--foreground)/0.45)] backdrop-blur-xl dark:border-white/[0.075] dark:bg-white/[0.045] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.035),0_12px_28px_-24px_rgba(0,0,0,0.9)]",
      className,
    )}
    {...props}
  />
));
TabsList.displayName = TabsPrimitive.List.displayName;

const TabsTrigger = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Trigger>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Trigger>
>(({ className, children, value, ...props }, ref) => {
  const magneticTabs = React.useContext(MagneticTabsContext);
  const hasMagneticIndicator = Boolean(
    magneticTabs?.magnetic && magneticTabs.activeValue === value,
  );

  return (
    <TabsPrimitive.Trigger
      ref={ref}
      value={value}
      data-magnetic-tab-trigger={magneticTabs?.magnetic ? "true" : undefined}
      className={cn(
        "inline-flex min-h-9 items-center justify-center whitespace-nowrap rounded-[12px] border border-transparent px-4 py-2",
        "text-sm font-semibold transition-[transform,background-color,border-color,box-shadow,color] duration-300 ease-apple",
        "ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        "disabled:pointer-events-none disabled:opacity-50",
        "data-[state=active]:border-border/65 data-[state=active]:bg-background/92 data-[state=active]:text-foreground",
        "data-[state=active]:shadow-[0_10px_22px_-18px_hsl(var(--foreground)/0.46),inset_0_1px_0_hsl(var(--background))]",
        "dark:data-[state=active]:border-white/[0.095] dark:data-[state=active]:bg-white/[0.082] dark:data-[state=active]:shadow-[0_10px_22px_-18px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.052)]",
        "hover:bg-background/70 hover:text-foreground active:translate-y-px active:scale-[0.985]",
        "motion-reduce:transition-none motion-reduce:active:translate-y-0 motion-reduce:active:scale-100",
        magneticTabs?.magnetic && "relative isolate",
        className,
      )}
      {...props}
    >
      {hasMagneticIndicator ? (
        <motion.span
          layoutId={magneticTabs?.indicatorId}
          aria-hidden="true"
          data-desktop-magnetic-tab-indicator="true"
          data-reduced-motion={magneticTabs?.reducedMotion ? "true" : "false"}
          className="desktop-magnetic-tab-indicator pointer-events-none absolute inset-0 z-0 rounded-[inherit]"
          transition={
            magneticTabs?.reducedMotion
              ? { duration: 0 }
              : { type: "spring", stiffness: 410, damping: 35, mass: 0.78 }
          }
        />
      ) : null}
      <span className={cn(magneticTabs?.magnetic && "relative z-10")}>{children}</span>
    </TabsPrimitive.Trigger>
  );
});
TabsTrigger.displayName = TabsPrimitive.Trigger.displayName;

const TabsContent = React.forwardRef<
  React.ElementRef<typeof TabsPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TabsPrimitive.Content>
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Content
    ref={ref}
    className={cn(
      "mt-3 ring-offset-background focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
      "data-[state=inactive]:animate-out data-[state=inactive]:fade-out-0",
      "data-[state=active]:animate-in data-[state=active]:fade-in-0 data-[state=active]:slide-in-from-bottom-1",
      "transition-all duration-300 motion-reduce:animate-none motion-reduce:transition-none",
      className,
    )}
    {...props}
  />
));
TabsContent.displayName = TabsPrimitive.Content.displayName;

export { Tabs, TabsList, TabsTrigger, TabsContent };
