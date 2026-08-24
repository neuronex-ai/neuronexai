"use client";

import { Link } from "react-router-dom";
import { ArrowRight, CheckCircle2, Star, Zap } from "lucide-react";
import { FadeIn } from "@/components/animations/FadeIn";
import { Button } from "@/components/ui/button";
import {
    PUBLIC_PLAN_CARDS,
    type PublicPlanName,
} from "@/content/public-plan-catalog";
import { cn } from "@/lib/utils";

const planIcons: Record<PublicPlanName, typeof Star> = {
    Essential: Star,
    Profissional: Zap,
};

export const WaitlistSection = () => {
    return (
        <section id="pricing" className="public-section-stage public-solid-subtle relative overflow-hidden px-6 py-20 md:py-28">
            <div className="relative z-10 mx-auto max-w-[1240px]">
                <div className="mx-auto mb-12 max-w-5xl text-center md:mb-16">
                    <FadeIn delay={0.1}>
                        <p className="mb-8 font-mono text-[9px] font-black uppercase tracking-[0.22em] text-muted-foreground">
                            Planos NeuroNex
                        </p>
                    </FadeIn>

                    <FadeIn delay={0.2}>
                        <h2 className="mx-auto max-w-5xl text-5xl font-bold leading-[1.02] tracking-tight md:text-6xl">
                            Escolha o plano <br />
                            <span className="text-muted-foreground">
                                ideal para a sua prática.
                            </span>
                        </h2>
                    </FadeIn>

                    <FadeIn delay={0.3}>
                        <p className="mx-auto mt-8 max-w-3xl text-base font-medium leading-relaxed text-muted-foreground md:text-xl">
                            Comece gratuitamente ou avance para uma operação mais ampla com Synapse, NeuroBox, NeuroFinance e NeuroZap.
                        </p>
                    </FadeIn>
                </div>

                <div className="mx-auto grid max-w-5xl grid-cols-1 gap-5 lg:grid-cols-2 lg:gap-6">
                    {PUBLIC_PLAN_CARDS.map((plan, index) => {
                        const Icon = planIcons[plan.name];
                        return (
                            <FadeIn key={plan.name} delay={0.18 + index * 0.08}>
                                <article
                                    className={cn(
                                        "group relative flex h-full min-h-[560px] flex-col overflow-hidden rounded-[34px] border p-6 shadow-premium transition-colors duration-200 md:rounded-[42px] md:p-8",
                                        plan.featured
                                            ? "border-foreground/20 bg-foreground text-background shadow-[0_38px_120px_-72px_rgba(0,0,0,0.85)] dark:border-white/20 dark:bg-white dark:text-zinc-950"
                                            : "border-border/15 bg-card/70 backdrop-blur-xl hover:border-border/30 hover:bg-card dark:border-white/10 dark:bg-white/[0.03]"
                                    )}
                                >
                                    <div className="relative z-10 flex items-start justify-between gap-5">
                                        <Icon className={cn("h-7 w-7 transition-transform duration-500 group-hover:scale-105", plan.featured ? "text-background/76 dark:text-zinc-950/76" : "text-muted-foreground")} strokeWidth={1.7} />
                                        <span className={cn(
                                            "rounded-full border px-3 py-1.5 text-[8px] font-black uppercase tracking-[0.22em]",
                                            plan.featured
                                                ? "border-background/15 bg-background/10 text-background/70 dark:border-zinc-950/15 dark:bg-zinc-950/10 dark:text-zinc-950/70"
                                                : "border-border/15 bg-foreground/[0.035] text-muted-foreground dark:border-white/10 dark:bg-white/[0.045]"
                                        )}>
                                            {plan.eyebrow}
                                        </span>
                                    </div>

                                    <div className="relative z-10 mt-9 flex-1">
                                        <h3 className={cn("text-3xl font-black tracking-[-0.045em]", plan.featured ? "text-background dark:text-zinc-950" : "text-foreground")}>{plan.name}</h3>
                                        <div className="mt-5 flex items-end gap-2">
                                            <span className={cn("text-4xl font-black tracking-[-0.06em] md:text-5xl", plan.featured ? "text-background dark:text-zinc-950" : "text-foreground")}>{plan.price}</span>
                                            {plan.period ? <span className={cn("pb-1 text-sm font-bold", plan.featured ? "text-background/45 dark:text-zinc-950/45" : "text-muted-foreground/50")}>{plan.period}</span> : null}
                                        </div>
                                        <p className={cn("mt-5 text-sm font-medium leading-relaxed", plan.featured ? "text-background/58 dark:text-zinc-950/58" : "text-muted-foreground/58")}>{plan.description}</p>

                                        <div className="mt-8 space-y-3">
                                            {plan.features.map((item) => (
                                                <div key={item} className={cn("flex items-start gap-3 text-sm font-bold leading-relaxed", plan.featured ? "text-background/70 dark:text-zinc-950/70" : "text-muted-foreground/70")}>
                                                    <CheckCircle2 className={cn("mt-0.5 h-4 w-4 shrink-0", plan.featured ? "text-background dark:text-zinc-950" : "text-foreground/45")} />
                                                    <span>{item}</span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>

                                    <Button asChild className={cn(
                                        "public-tactile relative z-10 mt-9 h-14 rounded-full font-mono text-[10px] font-black uppercase tracking-[0.18em] transition-all duration-500 active:scale-[0.98]",
                                        plan.featured
                                            ? "bg-background text-foreground hover:bg-background/90 dark:bg-zinc-950 dark:text-white dark:hover:bg-zinc-950/90"
                                            : "bg-foreground text-background hover:bg-foreground/90 dark:bg-white dark:text-zinc-950 dark:hover:bg-white/90"
                                    )}>
                                        <Link to={plan.href} className="flex items-center justify-center gap-3">
                                            {plan.cta}
                                            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
                                        </Link>
                                    </Button>
                                </article>
                            </FadeIn>
                        );
                    })}
                </div>
            </div>
        </section>
    );
};
