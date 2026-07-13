"use client";

import { FadeIn } from "@/components/animations/FadeIn";
import { Footer } from "@/components/landing/Footer";
import { LightBeam } from "@/components/landing/LightBeam";
import { Navbar } from "@/components/landing/Navbar";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Button } from "@/components/ui/button";
import { useTheme } from "@/hooks/use-theme";
import { cn } from "@/lib/utils";
import { motion, useInView, useMotionTemplate, useMotionValue, useScroll, useSpring, useTransform } from "framer-motion";
import {
    ArrowDown,
    ArrowRight, Calendar, CheckCircle2, Cloud, CreditCard, FileText,
    Globe,
    Heart,
    Layers,
    LayoutDashboard,
    LayoutGrid, Monitor, PieChart, Search, Shield, Sparkles, Users, Zap, type LucideIcon
} from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { Link } from "react-router-dom";

/* • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • 
   UTILITY COMPONENTS
   • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • •  */

/** Subtle ambient glow orb */
const GlowOrb = ({ className }: { className?: string }) => (
    <div
        className={cn(
            "absolute pointer-events-none select-none",
            className
        )}
        aria-hidden
    >
        <div className="w-[500px] h-[500px] rounded-full bg-gradient-radial from-zinc-300/30 via-zinc-200/10 to-transparent dark:from-white/[0.06] dark:via-white/[0.02] dark:to-transparent blur-[100px] animate-pulse-slow" />
    </div>
);

/** Feature bullet card with blur-in animation */
const FeatureBullet = ({
    title,
    description,
    index = 0,
}: {
    title: string;
    description: string;
    index?: number;
}) => {
    const ref = useRef(null);
    const inView = useInView(ref, { once: true, amount: 0.4 });

    return (
        <motion.div
            ref={ref}
            initial={{ opacity: 0, y: 24, filter: "blur(8px)" }}
            animate={inView ? { opacity: 1, y: 0, filter: "blur(0px)" } : {}}
            transition={{
                duration: 0.7,
                delay: index * 0.08,
                ease: [0.25, 1, 0.5, 1],
            }}
            className="group relative"
        >
            <div className="absolute -inset-px rounded-2xl bg-gradient-to-br from-zinc-200/60 to-transparent dark:from-white/[0.06] dark:to-transparent opacity-0 group-hover:opacity-100 blur-xl transition-opacity duration-700 pointer-events-none" />

            <div className="relative p-5 lg:p-6 rounded-2xl bg-white/80 dark:bg-white/[0.015] border border-zinc-100 dark:border-white/[0.04] backdrop-blur-2xl transition-all duration-700 group-hover:bg-zinc-50/50 dark:group-hover:bg-white/[0.04] group-hover:border-zinc-300 dark:group-hover:border-white/[0.1] group-hover:-translate-y-1 group-hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.05)] dark:group-hover:shadow-[0_20px_40px_-12px_rgba(0,0,0,0.3)]">
                <div className="absolute inset-x-0 top-0 h-24 bg-gradient-to-b from-white dark:from-white/[0.05] to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-700 rounded-t-2xl pointer-events-none" />
                <div className="absolute inset-x-4 top-0 h-[1.5px] bg-gradient-to-r from-transparent via-zinc-400 dark:via-white/20 to-transparent scale-x-0 group-hover:scale-x-100 transition-transform duration-1000 ease-out" />

                <div className="flex gap-3.5 items-start">
                    <div className="mt-0.5 w-6 h-6 rounded-lg bg-zinc-900 dark:bg-white flex items-center justify-center shrink-0 shadow-sm group-hover:scale-110 transition-transform duration-500">
                        <CheckCircle2 className="w-3.5 h-3.5 text-white dark:text-black" strokeWidth={3} />
                    </div>
                    <div className="space-y-1.5 min-w-0">
                        <h4 className="text-[15px] font-bold text-foreground tracking-tight leading-snug group-hover:text-primary transition-colors duration-500">
                            {title}
                        </h4>
                        <p className="text-[13px] text-muted-foreground leading-relaxed font-medium">
                            {description}
                        </p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
};

/** Section counter pill */
const SectionNumber = ({ num }: { num: number }) => (
    <div className="flex items-center gap-4 mb-8 group/num">
        <div className="relative">
            <div className="absolute inset-0 rounded-full bg-foreground/[0.03] scale-150 blur-xl opacity-0 group-hover/num:opacity-100 transition-opacity duration-700" />
            <div className="w-10 h-10 rounded-full border border-border/60 flex items-center justify-center text-[10px] font-black text-muted-foreground tabular-nums relative z-10 bg-background/50 backdrop-blur-sm group-hover/num:border-primary group-hover/num:text-primary transition-all duration-500">
                {String(num).padStart(2, "0")}
            </div>
        </div>
        <div className="h-[1px] w-12 bg-gradient-to-r from-border/60 to-transparent group-hover/num:from-primary/60 transition-all duration-700" />
    </div>
);

/* • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • 
   SECTIONS DATA
   • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • •  */

const ICON_MAP: Record<string, LucideIcon> = {
    dashboard: LayoutDashboard,
    agenda: Calendar,
    pacientes: Users,
    neurodrive: FileText,
    neurofinance: PieChart,
    teleconsulta: Monitor,
    "synapse-ai": Sparkles,
    portal: Heart,
};

const sections = [
    {
        id: "dashboard",
        num: 1,
        title: "Dashboard",
        subtitle: "Sua Torre de Controle",
        description:
            "O Dashboard é a primeira coisa que você vê ao entrar no sistema. Pense nele como um assistente pessoal que te conta tudo que importa antes de você começar a atender: quem vem hoje, o que ficou pendente, o que precisa da sua atenção.",
        features: [
            { title: "Briefing Matinal", description: "O que importa no seu dia, organizado. Quantos pacientes, pendências, alertas — tudo resumido." },
            { title: "Próximo Atendimento", description: "Card em destaque com o paciente que vem agora: nome, horário e botão direto pra iniciar." },
            { title: "Mini Agenda Diária", description: "Todos os seus compromissos do dia numa lista visual — rápida de ler." },
            { title: "Ações Rápidas", description: "Precisa agendar rápido? Cadastrar paciente? Atalhos de um clique, sempre ao alcance." },
            { title: "Google Calendar Sync", description: "Seus agendamentos sincronizados com o Google Calendar — automaticamente." },
            { title: "Alertas de Pendências", description: "Sabe aquele paciente que ficou sem confirmação? O sistema te avisa." },
        ],
    },
    {
        id: "agenda",
        num: 2,
        title: "Agenda Clínica",
        subtitle: "Sua Vida Organizada",
        description:
            "A Agenda do NeuroNex não é um calendário qualquer. É o coração da sua operação clínica. Ela mostra dia, semana e mês com transições suaves, se conecta ao Google Calendar e atualiza em tempo real.",
        features: [
            { title: "Calendário Multi-Visão", description: "Três modos: Dia, Semana e Mês. Transições cinematográficas entre cada visão." },
            { title: "Agendamento Recorrente", description: "Crie a série de sessões de uma vez e pare de agendar manualmente toda semana." },
            { title: "Arrastar e Soltar", description: "Precisa mudar um agendamento de horário? Arraste-o na grade da semana." },
            { title: "Tempo Real", description: "Agendou de outro dispositivo? Aparece instantaneamente na sua tela." },
            { title: "Filtros Inteligentes", description: "Filtre por tipo (Online, Presencial), busque por nome e navegue pelo mini-calendário." },
            { title: "Pagamento Vinculado", description: "Ao criar um agendamento, registre o pagamento ali mesmo." },
        ],
    },
    {
        id: "pacientes",
        num: 3,
        title: "Prontuário Digital",
        subtitle: "Tudo Sobre Cada Paciente",
        description:
            "Cada paciente no NeuroNex tem uma ficha viva. Não é uma ficha estática parada numa gaveta digital — é um prontuário que respira e acompanha a evolução.",
        features: [
            { title: "Resumo Clínico com IA", description: "Card inteligente que resume sessões e evolução — gerado pela IA." },
            { title: "Score de Risco", description: "Classificação automática: Baixo, Atenção ou Alto Risco baseada nos dados clínicos." },
            { title: "Gestão de Medicações", description: "Registre e acompanhe as medicações de cada paciente de forma visível." },
            { title: "Geração de Documentos", description: "Gere relatórios, atestados e encaminhamentos com templates prontos." },
            { title: "Anamneses Digitais", description: "Envie para o paciente preencher remotamente e veja as respostas integradas." },
            { title: "Rastreamento de Humor", description: "Gráficos que mostram a evolução do humor do paciente ao longo do tempo." },
        ],
    },
    {
        id: "neurodrive",
        num: 4,
        title: "NeuroDrive",
        subtitle: "Seu Segundo Cérebro",
        description:
            "O NeuroDrive é onde o pensamento do psicólogo vira registro. Um ecossistema completo de gestão de conhecimento com editor profissional e mapas mentais.",
        features: [
            { title: "Editor de Notas Avançado", description: "Editor rich-text profissional com formatação completa: títulos, listas e tabelas." },
            { title: "NeuroView — Mapa Mental", description: "Visualize as conexões entre suas notas e pacientes em um grafo interativo." },
            { title: "Board de Tarefas", description: "Quadro de tarefas com arrastar e soltar. Organize por categorias e das." },
            { title: "Modo Foco", description: "Um clique e tudo desaparece, menos o editor. Foco absoluto na escrita." },
            { title: "Integração com Notion", description: "Conecte seu Notion e visualize suas páginas diretamente dentro do NeuroNex." },
            { title: "Menu Mágico de IA", description: "Selecione qualquer texto e a IA resume, expande ou reformula." },
        ],
    },
    {
        id: "neurofinance",
        num: 5,
        title: "NeuroFinance",
        subtitle: "Gestão Financeira Completa",
        description:
            "O NeuroFinance transforma a parte mais chata da prática clínica — cobrar e declarar — em algo visual, automatizado e profissional.",
        features: [
            { title: "Visão Geral Bancária", description: "Saldo, faturamento, lucro e despesas operacionais em um dashboard visual." },
            { title: "Cobranças (Invoices)", description: "Lista completa de todas as cobranças enviadas com status em tempo real." },
            { title: "Links de Pagamento", description: "Gere um link e envie por WhatsApp. O paciente paga pelo celular sem fricção." },
            { title: "Painel Fiscal", description: "Emissão automática de NFS-e e dashboard fiscal com impostos estimados." },
            { title: "Assinaturas e Recorrência", description: "Configure cobranças automáticas para pacientes com sessões fixas." },
            { title: "Recibos Profissionais", description: "Gere recibos formatados para cada transação com layout impecável." },
        ],
    },
    {
        id: "teleconsulta",
        num: 6,
        title: "Teleconsulta",
        subtitle: "Atendimento Online Profissional",
        description:
            "Uma sala de atendimento digital completa, construída para a prática clínica, com vídeo HD e prontuário integrado na mesma tela.",
        features: [
            { title: "Videochamada HD", description: "Motor profissional integrado direto no navegador. Sem download ou instalação." },
            { title: "Recap do Paciente", description: "Sidebar com resumo clínico visível durante o atendimento." },
            { title: "Chat em Tempo Real", description: "Chat ao lado do vídeo para enviar links e informações complementares." },
            { title: "Alertas de Risco", description: "Indicadores visuais de risco clínico visíveis durante a sessão." },
            { title: "Workspace com Abas", description: "Navegue entre chat, notas e prontuário sem sair da teleconsulta." },
            { title: "Link de Convite", description: "Gere e envie o link da sessão para o paciente por WhatsApp ou e-mail." },
        ],
    },
    {
        id: "synapse-ai",
        num: 7,
        title: "Synapse AI",
        subtitle: "Seu Assistente de IA",
        description:
            "O Synapse AI tem contexto. Ela sabe quem são seus pacientes e o que foi discutido, ajudando na redação e análise clínica.",
        features: [
            { title: "Chat Contextual", description: "Pergunte qualquer coisa com base nos dados reais do sistema." },
            { title: "Comandos de Voz", description: "Fale com a IA. Ela transcreve em tempo real com animação elegante." },
            { title: "Artefatos Interativos", description: "Geração de painéis visuais: gráficos, tabelas e cards de paciente." },
            { title: "Gerador de Documentos", description: "A IA gera documentos profissionais e mostra a pré-visualização na hora." },
            { title: "Ações Sugeridas", description: "Sugestões de ações concretas como agendar follow-up ou enviar cobrança." },
            { title: "Gráficos sob Demanda", description: "Peça gráficos financeiros ou clínicos e a IA gera instantaneamente." },
        ],
    },
    {
        id: "portal",
        num: 8,
        title: "Portal do Paciente",
        subtitle: "O Espaço do Seu Paciente",
        description:
            "O lado do paciente na história. Acesso fácil para agendamentos, registros de humor e documentos compartilhados.",
        features: [
            { title: "Agenda de Sessões", description: "O paciente vê suas próximas sessões e histórico de atendimentos." },
            { title: "Rastreador de Humor", description: "Escala de humor diária que gera gráficos para o psicólogo." },
            { title: "Entrar na Teleconsulta", description: "Botão direto para entrar na videochamada agendada." },
            { title: "Metas Terapêuticas", description: "Acompanhamento das metas definidas em conjunto." },
            { title: "Documentos Compartilhados", description: "Acesso a laudos e relatórios compartilhados pelo profissional." },
            { title: "Financeiro do Paciente", description: "Visualizar cobranças, histórico e status de pagamentos." },
        ],
    },
];

const crossFeatures = [
    { icon: Search, title: "Busca Universal ⌘K", description: "Pressione ⌘K e encontre qualquer coisa instantaneamente." },
    { icon: Monitor, title: "Na Microsoft Store", description: "Instale a NeuroNex AI no Windows pela Microsoft Store e acesse seus dados sincronizados." },
    { icon: Cloud, title: "Dark & Light Mode", description: "Temas Liquid Glass e Ceramic com transição suave." },
    { icon: Shield, title: "Criptografia & Segurança", description: "Dados criptografados e proteção de nível bancário." },
    { icon: Zap, title: "Tempo Real", description: "Atualizações instantâneas em todo o sistema sem recarregar." },
    { icon: Globe, title: "Responsividade Total", description: "Páginas mobile redesenhadas para toque e busca rápida." },
];

/* • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • 
   SECTION COMPONENT
   • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • •  */

const FeatureSection = ({
    section,
    index,
}: {
    section: (typeof sections)[0];
    index: number;
}) => {
    const isEven = index % 2 === 0;
    const ref = useRef(null);
    const { scrollYProgress } = useScroll({
        target: ref,
        offset: ["start end", "end start"],
    });

    const yRaw = useTransform(scrollYProgress, [0, 0.4, 0.6, 1], [80, 0, 0, -80]);
    const y = useSpring(yRaw, { stiffness: 60, damping: 25 });
    const opacity = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0, 1, 1, 0]);
    const blur = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [10, 0, 0, 10]);
    const brightness = useTransform(scrollYProgress, [0, 0.2, 0.8, 1], [0.9, 1.05, 1.05, 0.9]);
    const scale = useTransform(scrollYProgress, [0, 0.4, 0.6, 1], [0.99, 1.01, 1.01, 0.99]);

    const Icon = ICON_MAP[section.id] || LayoutGrid;

    return (
        <motion.section
            ref={ref}
            id={section.id}
            style={{
                opacity,
                filter: `blur(${blur}px) brightness(${brightness})`,
                scale,
                willChange: "transform, opacity"
            }}
            className="relative"
        >
            <div className="px-6 md:px-12 lg:px-20 xl:pl-48 xl:pr-24 2xl:pl-56 2xl:pr-32">
                <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-200 dark:via-white/[0.08] to-transparent" />
            </div>

            <div className="py-14 md:py-24 lg:py-48 px-6 md:px-12 lg:px-20 xl:pl-48 xl:pr-24 2xl:pl-56 2xl:pr-32">
                <div
                    className={cn(
                        "grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-20 items-start",
                        !isEven && "lg:[direction:rtl] lg:[&>*]:[direction:ltr]"
                    )}
                >
                    <div className="lg:col-span-7 space-y-10">
                        <SectionNumber num={section.num} />
                        <div className="space-y-6">
                            <div className="flex items-center gap-5">
                                <motion.div
                                    whileHover={{ scale: 1.1, rotate: 5 }}
                                    className="w-14 h-14 rounded-2xl bg-zinc-900 dark:bg-white flex items-center justify-center shadow-2xl relative group/icon overflow-hidden"
                                >
                                    <div className="absolute inset-0 bg-gradient-to-tr from-white/20 to-transparent opacity-0 group-hover/icon:opacity-100 transition-opacity duration-500" />
                                    <Icon className="w-7 h-7 text-white dark:text-black relative z-10" strokeWidth={1.5} />
                                </motion.div>
                                <div>
                                    <h2 className="text-2xl md:text-3xl lg:text-6xl xl:text-7xl font-bold text-foreground tracking-[-0.04em] leading-tight">
                                        {section.title}
                                    </h2>
                                </div>
                            </div>
                            <p className="text-lg lg:text-2xl font-medium text-muted-foreground/60 tracking-tight leading-snug max-w-lg italic">
                                {section.subtitle}
                            </p>
                        </div>
                        <p className="text-[15px] lg:text-base text-zinc-500 dark:text-zinc-400 leading-[1.8] max-w-xl font-medium">
                            {section.description}
                        </p>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                            {section.features.map((feat, i) => (
                                <FeatureBullet key={i} {...feat} index={i} />
                            ))}
                        </div>
                    </div>

                    <div className="lg:col-span-5 relative hidden lg:block h-full min-h-[80vh]">
                        <motion.div
                            style={{ y }}
                            className="sticky top-[15vh] flex items-center justify-center h-full"
                        >
                            <div className="relative w-full max-w-[440px] aspect-[4/5] lg:aspect-square group/container">
                                <GlowOrb className="-top-10 -right-10 opacity-15 blur-[100px]" />
                                <motion.div
                                    whileHover={{ scale: 1.01 }}
                                    transition={{ type: "spring", stiffness: 400, damping: 30 }}
                                    className="absolute inset-0 rounded-[48px] bg-white/40 dark:bg-zinc-950/40 border-[0.5px] border-zinc-200/50 dark:border-white/[0.08] overflow-hidden shadow-2xl backdrop-blur-3xl group/visual cursor-none"
                                >
                                    <div className="brand-neutral-gradient opacity-10" />
                                    <motion.div
                                        animate={{ left: ["-150%", "150%"] }}
                                        transition={{ duration: 8, repeat: Infinity, ease: "linear" }}
                                        className="absolute inset-y-0 w-[50%] bg-gradient-to-r from-transparent via-white/10 dark:via-white/[0.04] to-transparent skew-x-[35deg] pointer-events-none z-20"
                                    />
                                    <SpotlightOverlay />
                                    <div className="p-8 lg:p-10 space-y-8 relative z-10 h-full flex flex-col overflow-hidden">
                                        <VisualExperienceContent id={section.id} Icon={Icon} />
                                    </div>
                                </motion.div>
                            </div>
                        </motion.div>
                    </div>
                </div>
            </div>
        </motion.section>
    );
};

const SpotlightOverlay = () => {
    const mouseX = useMotionValue(0);
    const mouseY = useMotionValue(0);

    function onMouseMove({ currentTarget, clientX, clientY }: React.MouseEvent) {
        const { left, top } = currentTarget.getBoundingClientRect();
        mouseX.set(clientX - left);
        mouseY.set(clientY - top);
    }

    return (
        <div
            onMouseMove={onMouseMove}
            className="absolute inset-0 z-[5] opacity-0 group-hover/visual:opacity-100 transition-opacity duration-1000"
        >
            <motion.div
                className="absolute -inset-px rounded-[48px] pointer-events-none"
                style={{
                    background: useMotionTemplate`
                        radial-gradient(
                            500px circle at ${mouseX}px ${mouseY}px,
                            rgba(255, 255, 255, 0.08),
                            transparent 80%
                        )
                    `,
                }}
            />
        </div>
    );
};

const FuncionalidadesFavicon = () => {
    const { theme } = useTheme();
    const faviconSrc = theme === "dark" ? "/favicon-light.png" : "/favicon-dark.png";
    return (
        <div className="w-16 h-16 rounded-[28%] bg-white dark:bg-white/[0.05] border border-zinc-200 dark:border-white/10 flex items-center justify-center mx-auto shadow-2xl relative overflow-hidden group/favicon">
            <img src={faviconSrc} className="w-8 h-8 object-contain relative z-10 transition-transform duration-700 group-hover/favicon:scale-110" alt="NeuroNex" />
            <div className="absolute inset-0 bg-gradient-to-tr from-primary/10 to-transparent opacity-0 group-hover/favicon:opacity-100 transition-opacity duration-700" />
        </div>
    );
};

/** Section-specific demonstrative content */
const VisualExperienceContent = ({ id, Icon }: { id: string; Icon: LucideIcon }) => {
    const { theme } = useTheme();
    const faviconSrc = theme === "dark" ? "/favicon-light.png" : "/favicon-dark.png";

    switch (id) {
        case "dashboard":
            return (
                <div className="space-y-8 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-2">
                        <div className="flex items-center gap-4">
                            <div className="w-12 h-12 rounded-2xl bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-black shadow-lg relative">
                                <Icon className="w-6 h-6" />
                            </div>
                            <div className="space-y-1.5">
                                <div className="h-4 w-32 rounded-full bg-foreground/10" />
                                <div className="h-2 w-16 rounded-full bg-foreground/5" />
                            </div>
                        </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                        {[1, 2].map(i => (
                            <div key={i} className="h-32 rounded-[28px] bg-white/[0.03] dark:bg-white/[0.015] border-[0.5px] border-zinc-200/40 dark:border-white/5 p-6 flex flex-col justify-between hover:bg-white/[0.08] dark:hover:bg-white/[0.04] transition-colors duration-500 group/card">
                                <div className="h-2.5 w-16 rounded-full bg-primary/20" />
                                <div className="space-y-2.5">
                                    <div className="h-6 w-12 rounded-lg bg-foreground/10 group-hover/card:bg-primary/20 transition-colors" />
                                    <div className="h-1.5 w-full rounded-full bg-foreground/5" />
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            );
        case "agenda":
            return (
                <div className="space-y-6 flex flex-col h-full">
                    <div className="flex items-center justify-between mb-1">
                        <div className="h-5 w-24 rounded-full bg-foreground/10" />
                    </div>
                    <div className="flex-1 grid grid-cols-3 gap-3">
                        {[1, 2, 3, 4, 5, 6].map(i => (
                            <div key={i} className="rounded-2xl border-[0.5px] border-foreground/[0.06] bg-foreground/[0.02] p-3 space-y-3 flex flex-col relative overflow-hidden group/slot">
                                <div className="h-1.5 w-6 rounded-full bg-foreground/10" />
                                {i % 2 === 0 && (
                                    <div className="flex-1 rounded-xl bg-primary/10 border-l-2 border-primary p-2 space-y-1.5" />
                                )}
                            </div>
                        ))}
                    </div>
                </div>
            );
        case "neurofinance":
            return (
                <div className="space-y-6 flex flex-col h-full">
                    <div className="h-44 rounded-[40px] bg-zinc-950 dark:bg-white text-white dark:text-black border-[0.5px] border-white/10 dark:border-black/10 p-8 flex flex-col justify-between overflow-hidden relative group/card shadow-2xl">
                        <div className="space-y-2 relative z-10">
                            <div className="flex items-center gap-2">
                                <CreditCard className="w-4 h-4 text-primary/60" />
                                <div className="text-[9px] font-black tracking-[0.2em] opacity-40 uppercase">NeuroFinance</div>
                            </div>
                            <div className="text-3xl font-bold tracking-tighter pt-1">R$ 52.480,00</div>
                        </div>
                    </div>
                </div>
            );
        case "synapse-ai":
            return (
                <div className="flex flex-col h-full gap-6">
                    <div className="flex-1 rounded-[40px] bg-foreground/[0.015] border-[0.5px] border-foreground/[0.04] p-8 flex flex-col gap-6 relative overflow-hidden group/ai">
                        <div className="flex items-start gap-4 relative z-10">
                            <div className="w-12 h-12 rounded-2xl bg-zinc-950 dark:bg-white flex items-center justify-center shadow-xl shrink-0">
                                <img src={faviconSrc} className="w-6 h-6 object-contain" alt="NeuroNex" />
                            </div>
                            <div className="flex-1 p-5 rounded-[28px] rounded-tl-none bg-zinc-950 dark:bg-white text-white dark:text-black shadow-lg">
                                <p className="text-[13px] font-medium leading-relaxed opacity-90 italic">
                                    "Analizando evolução clínica do paciente..."
                                </p>
                            </div>
                        </div>
                    </div>
                </div>
            );
        default:
            return <div className="flex items-center justify-center h-full opacity-20"><Icon className="w-20 h-20" /></div>;
    }
};

/* • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • 
   MAIN PAGE
   • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • • •  */

const Funcionalidades = () => {
    const { scrollYProgress } = useScroll();
    const scaleX = useSpring(scrollYProgress, {
        stiffness: 100,
        damping: 30,
        restDelta: 0.001,
    });

    const [activeSection, setActiveSection] = useState("");
    useEffect(() => {
        const ids = [...sections.map((s) => s.id), "transversais"];
        const observer = new IntersectionObserver(
            (entries) => {
                const visible = entries
                    .filter((e) => e.isIntersecting)
                    .sort((a, b) => b.intersectionRatio - a.intersectionRatio);
                if (visible.length > 0) setActiveSection(visible[0].target.id);
            },
            { rootMargin: "-20% 0px -20% 0px", threshold: [0, 0.25, 0.5] }
        );

        ids.forEach((id) => {
            const el = document.getElementById(id);
            if (el) observer.observe(el);
        });
        return () => observer.disconnect();
    }, []);

    return (
        <div className="neuronex-bg min-h-screen selection:bg-zinc-900 selection:text-white dark:selection:bg-white dark:selection:text-black overflow-x-hidden">
            <div className="hidden md:block">
                <Navbar />
            </div>
            <LandingMobileNav />

            {/* Progress bar */}
            <motion.div
                className="fixed top-0 left-0 right-0 h-[2px] bg-zinc-900 dark:bg-white z-[60] origin-left hidden md:block"
                style={{ scaleX }}
            />

            {/* HERO */}
            <section className="relative pt-32 pb-12 md:pt-32 md:pb-24 px-6 w-full flex flex-col items-center justify-center text-center overflow-hidden z-10 min-h-[90vh]">
                <div className="brand-neutral-gradient" />
                <div className="brand-high-contrast-gradient opacity-50" />

                <div className="absolute inset-x-0 top-0 h-full pointer-events-none overflow-hidden z-0 opacity-10 dark:opacity-20 translate-y-[-10%]">
                    <LightBeam className="left-[15%]" delay="0s" />
                    <LightBeam className="left-[50%]" delay="3s" />
                    <LightBeam className="left-[85%]" delay="6s" />
                </div>

                <div className="relative z-10 max-w-6xl mx-auto px-6 space-y-8 md:space-y-12">
                    <FadeIn delay={0.25}>
                        <h1 className="text-[3rem] md:text-9xl lg:text-[8.5rem] font-bold tracking-[-0.05em] text-foreground leading-[0.9] select-none relative filter drop-shadow-sm">
                            Tudo que o NeuroNex <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-b from-foreground via-foreground/90 to-foreground/40 italic pr-4 relative z-10">
                                faz por você.
                            </span>
                        </h1>
                    </FadeIn>

                    <FadeIn delay={0.4}>
                        <p className="text-base md:text-xl text-muted-foreground/80 font-medium max-w-2xl mx-auto leading-tight tracking-tight px-2">
                            Performance impecável, estética refinada e inteligência em perfeita simbiose para a rotina do psicólogo.
                        </p>
                    </FadeIn>

                    <FadeIn delay={0.55}>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-4 pt-4">
                            <Link to="/auth">
                                <Button className="h-14 px-10 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black text-[10px] font-black uppercase tracking-[0.3em] shadow-xl hover:scale-[1.03] active:scale-[0.97] transition-all duration-500 group">
                                    Começar Agora
                                    <ArrowRight className="w-4 h-4 ml-3 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </Link>
                            <button
                                onClick={() =>
                                    document
                                        .getElementById("dashboard")
                                        ?.scrollIntoView({ behavior: "smooth" })
                                }
                                className="flex items-center gap-3 text-zinc-400 dark:text-zinc-500 text-[10px] font-black uppercase tracking-[0.3em] transition-colors group"
                            >
                                Explorar Abaixo
                            </button>
                        </div>

                        {/* Scroll Indicator */}
                        <motion.div
                            animate={{ y: [0, 10, 0] }}
                            transition={{ duration: 2, repeat: Infinity, ease: "easeInOut" }}
                            className="flex flex-col items-center gap-3 mt-16 opacity-30 select-none pointer-events-none"
                        >
                            <span className="text-[10px] font-black uppercase tracking-[0.4em]">Deslizar</span>
                            <div className="w-[1px] h-12 bg-gradient-to-b from-foreground to-transparent" />
                            <ArrowDown className="w-4 h-4 -mt-1" />
                        </motion.div>
                    </FadeIn>
                </div>
            </section>

            {/* SIDE NAV (Desktop only) */}
            <nav className="fixed left-5 top-1/2 -translate-y-1/2 z-[100] hidden xl:flex flex-col">
                <div className="p-2.5 bg-white/70 dark:bg-black/50 backdrop-blur-2xl border border-zinc-200/80 dark:border-white/[0.08] rounded-2xl shadow-2xl flex flex-col gap-1.5">
                    {sections.map((s) => {
                        const Icon = ICON_MAP[s.id] || Layers;
                        return (
                            <button
                                key={s.id}
                                onClick={() =>
                                    document
                                        .getElementById(s.id)
                                        ?.scrollIntoView({ behavior: "smooth" })
                                }
                                className={cn(
                                    "w-10 h-10 rounded-xl flex items-center justify-center relative transition-all duration-500 group",
                                    activeSection === s.id
                                        ? "bg-zinc-900 dark:bg-white text-white dark:text-black shadow-lg scale-105"
                                        : "text-zinc-400 dark:text-zinc-600 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/[0.06]"
                                )}
                            >
                                <div className="absolute left-[calc(100%+14px)] px-3 py-1.5 rounded-lg bg-zinc-900 dark:bg-white text-white dark:text-black text-[9px] font-black uppercase tracking-[0.15em] opacity-0 group-hover:opacity-100 -translate-x-2 group-hover:translate-x-0 transition-all duration-300 pointer-events-none whitespace-nowrap shadow-xl">
                                    {s.title}
                                </div>
                                <Icon className="w-[18px] h-[18px]" strokeWidth={1.8} />
                            </button>
                        );
                    })}
                </div>
            </nav>

            <main className="relative z-20">
                {sections.map((section, i) => (
                    <FeatureSection key={section.id} section={section} index={i} />
                ))}

                <section id="transversais" className="py-14 md:py-24 lg:py-48 px-6 md:px-12 lg:px-20 xl:pl-48 xl:pr-24 2xl:pl-56 2xl:pr-32">
                    <div className="h-px w-full bg-gradient-to-r from-transparent via-zinc-200 dark:via-white/[0.08] to-transparent mb-24" />
                    <div className="text-center space-y-6 mb-24">
                        <FadeIn>
                            <h2 className="text-[2rem] md:text-3xl lg:text-7xl font-bold text-foreground tracking-[-0.04em] leading-tight px-4 text-center">
                                Funcionalidades em todo lugar.
                            </h2>
                        </FadeIn>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {crossFeatures.map((item, i) => (
                            <FadeIn key={i} delay={i * 0.08}>
                                <div className="group p-8 rounded-[40px] border border-zinc-100 dark:border-white/[0.04] bg-white/80 dark:bg-white/[0.015] hover:bg-zinc-50 dark:hover:bg-white/[0.035] transition-all duration-700 backdrop-blur-2xl relative overflow-hidden">
                                    <div className="relative z-10">
                                        <div className="w-14 h-14 rounded-2xl bg-zinc-100 dark:bg-zinc-800/50 flex items-center justify-center mb-10 border border-zinc-200/50 dark:border-white/5 group-hover:bg-zinc-900 dark:group-hover:bg-white shadow-sm group-hover:scale-110 transition-all duration-700">
                                            <item.icon className="w-6 h-6 text-zinc-400 group-hover:text-white dark:group-hover:text-black transition-colors" />
                                        </div>
                                        <h4 className="text-xl font-bold text-foreground mb-4 tracking-tight group-hover:text-primary transition-colors">
                                            {item.title}
                                        </h4>
                                        <p className="text-[14px] text-muted-foreground leading-relaxed font-medium">
                                            {item.description}
                                        </p>
                                    </div>
                                </div>
                            </FadeIn>
                        ))}
                    </div>
                </section>
            </main>

            <section className="relative py-14 md:py-32 lg:py-56 overflow-hidden">
                <div className="relative z-10 text-center max-w-3xl mx-auto px-6 space-y-10">
                    <FadeIn>
                        <FuncionalidadesFavicon />
                    </FadeIn>
                    <FadeIn delay={0.15}>
                        <h2 className="text-[2.2rem] md:text-8xl font-bold text-foreground leading-[0.9] tracking-[-0.05em]">
                            Seu consultório <br />
                            <span className="text-transparent bg-clip-text bg-gradient-to-b from-foreground via-foreground/90 to-foreground/40 italic pr-4">elevado ao máximo.</span>
                        </h2>
                    </FadeIn>
                    <FadeIn delay={0.45}>
                        <div className="flex flex-col sm:flex-row items-center justify-center gap-6 pt-4">
                            <Link to="/auth">
                                <Button className="h-16 px-14 rounded-full bg-zinc-900 dark:bg-white text-white dark:text-black text-[10px] font-black uppercase tracking-[0.35em] shadow-2xl hover:scale-[1.03] active:scale-[0.97] transition-all duration-700 group">
                                    Criar Conta Grátis
                                    <ArrowRight className="w-4 h-4 ml-3 group-hover:translate-x-1 transition-transform" />
                                </Button>
                            </Link>
                        </div>
                    </FadeIn>
                </div>
            </section>

            <Footer />
        </div>
    );
};

export default Funcionalidades;