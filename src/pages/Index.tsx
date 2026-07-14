"use client";

import { Suspense, lazy } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { Loader2 } from "lucide-react";

// Lazy load versions
const DesktopIndex = lazy(() => import("@/pages/desktop/DesktopIndex"));
const MobileIndex = lazy(() => import("@/mobile/pages/MobileIndex").then(m => ({ default: m.MobileIndex })));

const PageLoader = () => (
  <div
    className="flex h-screen w-full items-center justify-center bg-background"
    role="status"
    aria-live="polite"
  >
    <div className="relative">
      <div aria-hidden="true" className="absolute inset-0 animate-pulse rounded-full bg-foreground/10 blur-2xl motion-reduce:animate-none" />
      <Loader2 aria-hidden="true" className="relative z-10 h-8 w-8 animate-spin text-foreground/20 motion-reduce:animate-none" />
    </div>
    <span className="sr-only">Abrindo página</span>
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
