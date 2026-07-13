"use client";

import * as React from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import {
  Dialog,
  DialogContent,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerTrigger,
} from "@/components/ui/drawer";
import { cn } from "@/lib/utils";

interface ResponsiveModalProps {
  children: React.ReactNode;
  trigger?: React.ReactNode;
  open?: boolean;
  onOpenChange?: (open: boolean) => void;
  className?: string;
  drawerClassName?: string;
  contentStyle?: React.CSSProperties;
  showCloseButton?: boolean;
  dataSynapseTarget?: string;
}

export const ResponsiveModal = ({
  children,
  trigger,
  open,
  onOpenChange,
  className,
  drawerClassName,
  contentStyle,
  showCloseButton = true,
  dataSynapseTarget,
}: ResponsiveModalProps) => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {trigger && <DrawerTrigger asChild>{trigger}</DrawerTrigger>}
        <DrawerContent
          data-synapse-target={dataSynapseTarget}
          style={contentStyle}
          className={cn(
          "max-h-[96vh] flex flex-col bg-white dark:bg-[#080809] border-t border-zinc-200 dark:border-white/10 rounded-t-[42px] outline-none shadow-[0_-30px_60px_-15px_rgba(0,0,0,0.5)] dark:shadow-[0_-30px_80px_-15px_rgba(0,0,0,0.8)]",
          drawerClassName
        )}>
          {/* Handle absoluto para não criar quebra de cor no layout */}
          <div className="absolute top-4 left-1/2 -translate-x-1/2 h-1.5 w-10 rounded-full bg-zinc-400/20 dark:bg-white/10 z-50 pointer-events-none" />
          <div className="overflow-y-auto custom-scrollbar flex-1 flex flex-col pt-8">
            {children}
          </div>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {trigger && <DialogTrigger asChild>{trigger}</DialogTrigger>}
      <DialogContent data-synapse-target={dataSynapseTarget} style={contentStyle} className={className} showCloseButton={showCloseButton}>
        {children}
      </DialogContent>
    </Dialog>
  );
};
