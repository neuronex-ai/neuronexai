"use client";

import { Suspense, lazy } from "react";
import { useIsMobile } from "@/hooks/use-mobile";
import { NeuroNexLoadingLoop } from "@/components/ui/neuronex-loading-loop";

// Lazy load versions
const DesktopIndex = lazy(() => import("@/pages/desktop/DesktopIndex"));
const MobileIndex = lazy(() => import("@/mobile/pages/MobileIndex").then(m => ({ default: m.MobileIndex })));

const PageLoader = () => <NeuroNexLoadingLoop surface="page" label="Abrindo página" />;

const Index = () => {
    const isMobile = useIsMobile();

    return (
        <Suspense fallback={<PageLoader />}>
            {isMobile ? <MobileIndex /> : <DesktopIndex />}
        </Suspense>
    );
};

export default Index;