"use client";

import { motion, useReducedMotion, useScroll, useTransform } from "framer-motion";
import { useRef } from "react";

import {
  LandingRealFinanceFiscalSection,
  LandingRealSynapseSection,
} from "@/components/landing/LandingProductScreenshots";
import { LandingNeuroZapSection } from "@/components/landing/StrategicLandingSections";

const VerticalStory = () => (
  <>
    <LandingRealSynapseSection />
    <LandingNeuroZapSection inverted />
    <LandingRealFinanceFiscalSection />
  </>
);

export const LandingHorizontalProductStory = () => {
  const storyRef = useRef<HTMLElement>(null);
  const shouldReduceMotion = useReducedMotion();
  const { scrollYProgress } = useScroll({
    target: storyRef,
    offset: ["start start", "end end"],
  });
  const x = useTransform(
    scrollYProgress,
    [0, 0.12, 0.43, 0.57, 0.88, 1],
    ["0%", "0%", "-33.3333%", "-33.3333%", "-66.6667%", "-66.6667%"],
  );
  const progress = useTransform(scrollYProgress, [0.08, 0.92], [0, 1]);

  if (shouldReduceMotion) return <VerticalStory />;

  return (
    <section
      ref={storyRef}
      aria-label="Synapse, NeuroZap e operação financeira"
      className="public-horizontal-story relative h-[360svh]"
    >
      <div className="sticky top-0 h-svh overflow-hidden bg-background">
        <motion.div
          style={{ x }}
          className="flex h-full w-[300vw] will-change-transform"
        >
          <div className="public-horizontal-story__panel h-full w-screen shrink-0">
            <LandingRealSynapseSection />
          </div>
          <div className="public-horizontal-story__panel h-full w-screen shrink-0">
            <LandingNeuroZapSection inverted />
          </div>
          <div className="public-horizontal-story__panel h-full w-screen shrink-0">
            <LandingRealFinanceFiscalSection />
          </div>
        </motion.div>

        <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-5 z-20 mx-auto h-px w-36 overflow-hidden bg-white/20 mix-blend-difference">
          <motion.span
            style={{ scaleX: progress, transformOrigin: "0% 50%" }}
            className="block h-full w-full bg-white"
          />
        </div>
      </div>
    </section>
  );
};
