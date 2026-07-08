import * as React from "react";
import * as TabsPrimitive from "@radix-ui/react-tabs";

import { cn } from "@/lib/utils";

const Tabs = TabsPrimitive.Root;

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
>(({ className, ...props }, ref) => (
  <TabsPrimitive.Trigger
    ref={ref}
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
      className,
    )}
    {...props}
  />
));
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
