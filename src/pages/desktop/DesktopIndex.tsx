"use client";

import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { DesktopAppCTA } from "@/components/landing/DesktopAppCTA";
import { Footer } from "@/components/landing/Footer";
import { Hero } from "@/components/landing/Hero";
import { LandingSynapseSDR } from "@/components/landing/LandingSynapseSDR";
import { LandingSectionStage } from "@/components/landing/LandingSectionStage";
import { Navbar } from "@/components/landing/Navbar";
import { PublicFlowComparison } from "@/components/landing/PublicFlowComparison";
import { SynapseVoiceChapter } from "@/components/landing/SynapseVoiceChapter";
import {
    LandingRealFinanceFiscalSection,
    LandingRealProductShowcase,
} from "@/components/landing/LandingProductScreenshots";
import {
    LandingFinalCTASection,
    LandingOperatingSystemSection,
    LandingPlanComparisonSection,
    LandingProblemSection,
    LandingTrustAndFAQSection,
} from "@/components/landing/StrategicLandingSections";
import { WaitlistSection } from "@/components/landing/WaitlistSection";
import { useLandingSynapse } from "@/hooks/use-landing-synapse";

const DesktopIndex = () => {
    const sdr = useLandingSynapse();

    return (
        <div className="min-h-screen bg-transparent selection:bg-primary/30">
            <Navbar />
            <main>
                <Hero />
                <LandingSectionStage index={1}><LandingProblemSection /></LandingSectionStage>
                <PublicFlowComparison />
                <LandingSectionStage index={3}><LandingRealProductShowcase /></LandingSectionStage>
                <LandingSectionStage index={4}>
                    <section className="bg-transparent px-6 pb-12">
                        <div className="mx-auto flex max-w-[1320px] flex-col justify-center gap-3 rounded-[28px] border border-border/40 bg-card/70 p-5 sm:flex-row dark:border-white/10 dark:bg-white/[0.03]">
                            <Link to="/neurofinance" className="inline-flex h-12 items-center justify-center rounded-2xl bg-foreground px-6 text-[9px] font-black uppercase tracking-[0.18em] text-background">Conhecer o NeuroFinance <ArrowRight className="ml-2 h-4 w-4" /></Link>
                            <Link to="/synapse" className="inline-flex h-12 items-center justify-center rounded-2xl border border-border/50 px-6 text-[9px] font-black uppercase tracking-[0.18em]">Conhecer o Synapse <ArrowRight className="ml-2 h-4 w-4" /></Link>
                        </div>
                    </section>
                </LandingSectionStage>
                <LandingSectionStage index={5}><LandingOperatingSystemSection /></LandingSectionStage>
                <SynapseVoiceChapter id="synapse" variant="compact" />
                <LandingSectionStage index={7}><LandingRealFinanceFiscalSection /></LandingSectionStage>
                <LandingSectionStage index={8}><WaitlistSection /></LandingSectionStage>
                <LandingSectionStage index={9}><LandingPlanComparisonSection /></LandingSectionStage>
                <LandingSectionStage index={10}><LandingTrustAndFAQSection /></LandingSectionStage>
                <LandingSectionStage index={11}><DesktopAppCTA /></LandingSectionStage>
                <LandingSectionStage index={12}><LandingFinalCTASection /></LandingSectionStage>
            </main>
            <Footer />
            <LandingSynapseSDR sdr={sdr} />
        </div>
    );
};

export default DesktopIndex;
