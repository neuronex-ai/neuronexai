"use client";

import { Suspense, lazy } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2 } from "lucide-react";

// Lazy load versions
const DesktopIndex = lazy(() => import("@/pages/desktop/DesktopIndex"));
const MobileIndex = lazy(() => import("@/mobile/pages/MobileIndex").then(m => ({ default: m.MobileIndex })));

const PageLoader = () => (
  <div className="h-screen w-full flex items-center justify-center bg-background">
    <div className="relative">
      <div className="absolute inset-0 bg-foreground/10 blur-2xl animate-pulse rounded-full" />
      <Loader2 className="h-8 w-8 animate-spin text-foreground/20 relative z-10" />
    </div>
  </div>
);

const Index = () => {
    const isMobile = useIsMobile();

    return (
        <Suspense fallback={<PageLoader />}>
            {isMobile ? <MobileIndex /> : <DesktopIndex />}
        </Suspense>
    );
};

export default Index;
