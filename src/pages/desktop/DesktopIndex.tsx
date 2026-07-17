"use client";

import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

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
import { useLandingSynapse } from "@/hooks/use-landing-synapse";
import {
    LandingContinuityAuthoritySection,
    LandingEcosystemAuthoritySection,
    LandingKnowledgeAuthoritySection,
} from "@/components/landing/LandingAuthoritySections";

const DesktopIndex = () => {
    const sdr = useLandingSynapse();

    return (
        <div className="public-lumen-page min-h-screen bg-background selection:bg-foreground/10">
            <Navbar />
            <main>
                <Hero />
                <LandingProblemSection />
                <LandingDifferentiatorTable />
                <LandingRealProductShowcase />
                <LandingEcosystemAuthoritySection />
                <LandingContinuityAuthoritySection />
                <section className="public-home-bridge public-section-stage bg-white px-6 py-10 text-zinc-950">
                    <div className="mx-auto flex max-w-[760px] flex-col justify-center gap-3 rounded-full border border-zinc-200 bg-white/92 p-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.92),0_20px_54px_-44px_rgba(0,0,0,0.34)] sm:flex-row">
                        <Link to="/neurofinance" className="public-tactile inline-flex h-12 items-center justify-center rounded-full bg-zinc-950 px-6 font-mono text-[9px] font-black uppercase text-white">Conhecer o NeuroFinance <ArrowRight className="ml-2 h-4 w-4" /></Link>
                        <Link to="/synapse" className="public-tactile inline-flex h-12 items-center justify-center rounded-full border border-zinc-300 bg-white px-6 font-mono text-[9px] font-black uppercase text-zinc-950">Conhecer o Synapse <ArrowRight className="ml-2 h-4 w-4" /></Link>
                    </div>
                </section>
                <LandingOperatingSystemSection />
                <LandingHorizontalProductStory />
                <WaitlistSection />
                <LandingPlanComparisonSection />
                <LandingTrustAndFAQSection />
                <LandingKnowledgeAuthoritySection />
                <LandingPublicPagesCarouselSection />
                <LandingFinalCTASection />
            </main>
            <Footer />
            <LandingSynapseSDR sdr={sdr} />
        </div>
    );
};

export default DesktopIndex;
