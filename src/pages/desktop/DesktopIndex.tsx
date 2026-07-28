"use client";

import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { LandingSynapseSDR } from "@/components/landing/LandingSynapseSDR";
import { LandingHorizontalProductStory } from "@/components/landing/LandingHorizontalProductStory";
import { Navbar } from "@/components/landing/Navbar";
import {
    LandingRealProductShowcase,
} from "@/components/landing/LandingProductScreenshots";
import {
    LandingDifferentiatorTable,
    LandingFinalCTASection,
    LandingOperatingSystemSection,
    LandingPlanComparisonSection,
    LandingPublicPagesCarouselSection,
    LandingProblemSection,
    LandingTrustAndFAQSection,
} from "@/components/landing/StrategicLandingSections";
import { WaitlistSection } from "@/components/landing/WaitlistSection";
import {
    PublicOperatingModelBridge,
    PublicSynapseCommandSection,
} from "@/components/public/PublicPositioningSections";
import { useLandingSynapse } from "@/hooks/use-landing-synapse";
import {
    LandingContinuityAuthoritySection,
    LandingEcosystemAuthoritySection,
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
                <LandingDifferentiatorTable />
                <LandingRealProductShowcase />
                <LandingEcosystemAuthoritySection />
                <LandingContinuityAuthoritySection />
                <LandingOperatingSystemSection />
                <PublicSynapseCommandSection variant="full" />
                <PublicOperatingModelBridge />
                <LandingHorizontalProductStory />
                <WaitlistSection />
                <LandingPlanComparisonSection />
                <LandingTrustAndFAQSection />
                <LandingPublicPagesCarouselSection />
                <LandingFinalCTASection />
                <LandingKnowledgeAuthoritySection />
            </main>
            <Footer />
            <LandingSynapseSDR sdr={sdr} />
        </div>
    );
};

export default DesktopIndex;
