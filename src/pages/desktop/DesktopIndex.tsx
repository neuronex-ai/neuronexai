"use client";

import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { LandingSynapseSDR } from "@/components/landing/LandingSynapseSDR";
import { LandingHorizontalProductStory } from "@/components/landing/LandingHorizontalProductStory";
import {
    LandingHumanControlSection,
    LandingWorkflowDiagramSection,
} from "@/components/landing/LandingNarrativeSections";
import { Navbar } from "@/components/landing/Navbar";
import {
    LandingRealProductShowcase,
} from "@/components/landing/LandingProductScreenshots";
import {
    LandingFinalCTASection,
    LandingOperatingSystemSection,
    LandingPublicPagesCarouselSection,
    LandingProblemSection,
    LandingTrustAndFAQSection,
} from "@/components/landing/StrategicLandingSections";
import { WaitlistSection } from "@/components/landing/WaitlistSection";
import { PublicSynapseCommandSection } from "@/components/public/PublicPositioningSections";
import { useLandingSynapse } from "@/hooks/use-landing-synapse";
import {
    LandingContinuityAuthoritySection,
    LandingKnowledgeAuthoritySection,
} from "@/components/landing/LandingAuthoritySections";

const DesktopIndex = () => {
    const sdr = useLandingSynapse();

    return (
        <div className="public-lumen-page public-home-page min-h-screen bg-background selection:bg-foreground/10">
            <Navbar />
            <main>
                <Hero />
                <LandingProblemSection />
                <LandingOperatingSystemSection />
                <LandingWorkflowDiagramSection />
                <LandingHumanControlSection />
                <PublicSynapseCommandSection variant="compact" />
                <LandingRealProductShowcase />
                <LandingContinuityAuthoritySection />
                <LandingHorizontalProductStory />
                <LandingTrustAndFAQSection />
                <LandingPublicPagesCarouselSection />
                <WaitlistSection />
                <LandingFinalCTASection />
                <LandingKnowledgeAuthoritySection />
            </main>
            <Footer />
            <LandingSynapseSDR sdr={sdr} />
        </div>
    );
};

export default DesktopIndex;
