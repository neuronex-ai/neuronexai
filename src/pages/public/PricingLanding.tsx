"use client";

import { ArrowRight } from "lucide-react";
import { Link } from "react-router-dom";

import { Footer } from "@/components/landing/Footer";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Navbar } from "@/components/landing/Navbar";
import {
  LandingPlanComparisonSection,
  LandingTrustAndFAQSection,
} from "@/components/landing/StrategicLandingSections";
import { WaitlistSection } from "@/components/landing/WaitlistSection";
import {
  PublicBreadcrumbs,
  PublicPageHero,
} from "@/components/public/PublicPageShell";
import { Button } from "@/components/ui/button";
import { getPublicPage } from "@/content/public-content";

const PricingLanding = () => {
  const page = getPublicPage("/precos");
  if (!page) return null;

  return (
    <div className="min-h-screen overflow-x-hidden bg-background text-foreground">
      <div className="hidden md:block">
        <Navbar />
      </div>
      <LandingMobileNav />
      <main className="pt-24 md:pt-32">
        <PublicBreadcrumbs page={page} />
        <PublicPageHero
          page={page}
          actions={
            <>
              <Button
                asChild
                className="h-14 rounded-2xl bg-foreground px-7 text-[10px] font-black uppercase tracking-[0.18em] text-background"
              >
                <Link to="/create-account?plan=essential">
                  Criar conta grátis <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
              <Button
                asChild
                variant="outline"
                className="h-14 rounded-2xl px-7 text-[10px] font-black uppercase tracking-[0.18em]"
              >
                <Link to="/create-account?plan=professional">
                  Testar Profissional
                </Link>
              </Button>
            </>
          }
        />
        <WaitlistSection />
        <LandingPlanComparisonSection />
        <LandingTrustAndFAQSection />
      </main>
      <Footer />
    </div>
  );
};

export default PricingLanding;
