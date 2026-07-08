import { useMemo, useState } from "react";
import {
    Accordion,
    AccordionContent,
    AccordionItem,
    AccordionTrigger,
} from "@/components/ui/accordion";
import { FadeIn } from "@/components/animations/FadeIn";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    ArrowRight,
    Book,
    ChevronRight,
    CreditCard,
    HelpCircle,
    Keyboard,
    LifeBuoy,
    MessageSquare,
    Monitor,
    RefreshCw,
    Search,
    Settings,
    Shield,
    Zap,
    type LucideIcon,
} from "lucide-react";
import { getElectronAppVersion } from "@/lib/electron";

type HelpCategory = {
    icon: LucideIcon;
    title: string;
    count: number;
};

type HelpArticle = {
    q: string;
    a: string;
};

const HELP_CATEGORIES: HelpCategory[] = [
    { icon: Book, title: "Primeiros Passos", count: 14 },
    { icon: CreditCard, title: "Financeiro & Split", count: 9 },
    { icon: Shield, title: "Privacidade (LGPD)", count: 6 },
    { icon: Settings, title: "Infra & Domínios", count: 12 },
];

const FAQ_ITEMS: HelpArticle[] = [
    {
        q: "Como exportar prontuários do app desktop?",
        a: "Você possui controle absoluto sobre seus dados. A exportação pode ser realizada em massa ou individualmente nos formatos PDF ou JSON, garantindo soberania total sobre suas informações clínicas.",
    },
    {
        q: "O NeuroNex Desktop funciona offline?",
        a: "Os dados essenciais de pacientes e agenda são armazenados localmente permitindo consulta imediata. Recursos de IA, sincronização em nuvem e teleconsulta exigem conexão ativa com a internet.",
    },
    {
        q: "Meus dados estão seguros no app desktop?",
        a: "Sim. A comunicação com nossos servidores usa HTTPS/TLS quando aplicável, e dados sensíveis devem permanecer protegidos por controles server-side e políticas de acesso. O tratamento segue a LGPD e a documentação técnica vigente.",
    },
    {
        q: "Como funciona o Split de Pagamentos?",
        a: "O Split permite automatizar a divisão de honorários entre clínica e profissionais instantaneamente no ato do pagamento, via NeuroFinance (serviços financeiros por Asaas), reduzindo custos tributários e burocracia contábil.",
    },
    {
        q: "Posso usar o app desktop e o web simultaneamente?",
        a: "Sim. Sua conta NeuroNex funciona em qualquer plataforma. Os dados são sincronizados em tempo real entre o app desktop, web e mobile.",
    },
];

const normalizeSearch = (value: string) =>
    value
        .normalize("NFD")
        .replace(/[\u0300-\u036f]/g, "")
        .toLowerCase();

const CategoryCard = ({
    icon: Icon,
    title,
    count,
    delay,
    onSelect,
}: HelpCategory & {
    delay: number;
    onSelect: (query: string) => void;
}) => (
    <FadeIn delay={delay}>
        <button
            type="button"
            onClick={() => onSelect(title)}
            className="desktop-apple-surface desktop-tactile group flex h-full w-full flex-col justify-between rounded-[24px] p-5 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            aria-label={`Pesquisar artigos de ${title}`}
        >
            <div>
                <div className="mb-5 flex h-11 w-11 items-center justify-center rounded-[16px] border border-border/50 bg-muted/42 text-muted-foreground transition-colors group-hover:text-foreground dark:border-white/[0.075] dark:bg-white/[0.045]">
                    <Icon className="h-5 w-5" />
                </div>
                <h3 className="mb-1 text-base font-bold tracking-normal text-foreground">
                    {title}
                </h3>
                <p className="text-[10px] font-semibold uppercase tracking-[0.15em] text-muted-foreground/65">
                    {count} artigos
                </p>
            </div>
            <div className="mt-6 flex items-center justify-between border-t border-border/35 pt-5 text-muted-foreground transition-colors group-hover:text-foreground dark:border-white/[0.06]">
                <span className="text-[10px] font-bold uppercase tracking-[0.18em]">
                    Explorar
                </span>
                <ChevronRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
            </div>
        </button>
    </FadeIn>
);

const DesktopHelpCenter = () => {
    const [searchQuery, setSearchQuery] = useState("");
    const appVersion = getElectronAppVersion() || "1.0.0";
    const normalizedQuery = normalizeSearch(searchQuery.trim());

    const filteredFaqItems = useMemo(() => {
        if (!normalizedQuery) return FAQ_ITEMS;

        return FAQ_ITEMS.filter((item) => {
            const haystack = normalizeSearch(`${item.q} ${item.a}`);
            return haystack.includes(normalizedQuery);
        });
    }, [normalizedQuery]);

    return (
        <div className="min-h-full font-sans text-foreground">
            <section className="relative z-10 px-4 pb-10 pt-10 sm:px-6">
                <div className="mx-auto max-w-5xl space-y-8">
                    <FadeIn>
                        <div className="inline-flex items-center gap-2 rounded-full border border-border/45 bg-background/72 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.22em] text-muted-foreground shadow-sm backdrop-blur-xl dark:border-white/[0.075] dark:bg-white/[0.045]">
                            <LifeBuoy className="h-3.5 w-3.5" />
                            Central de Ajuda
                        </div>
                    </FadeIn>

                    <FadeIn delay={0.08}>
                        <div className="max-w-3xl space-y-4">
                            <h1 className="text-4xl font-bold leading-none tracking-normal text-foreground md:text-5xl">
                                Como podemos ajudar?
                            </h1>
                            <p className="max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground sm:text-base">
                                Pesquise por rotina clínica, finanças, segurança, desktop ou integrações.
                            </p>
                        </div>
                    </FadeIn>

                    <FadeIn delay={0.16}>
                        <div className="desktop-apple-surface group relative max-w-3xl rounded-[24px] p-2">
                            <Search className="pointer-events-none absolute left-6 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground/55 transition-colors group-focus-within:text-foreground" />
                            <Input
                                placeholder="Pesquisar artigos, guias e respostas..."
                                className="h-12 border-none bg-transparent pl-12 pr-4 text-base font-medium text-foreground placeholder:text-muted-foreground/45 focus-visible:ring-0"
                                value={searchQuery}
                                onChange={(event) => setSearchQuery(event.target.value)}
                                aria-label="Pesquisar na Central de Ajuda"
                            />
                        </div>
                    </FadeIn>
                </div>
            </section>

            <section className="relative z-10 px-4 pb-12 sm:px-6">
                <div className="mx-auto max-w-6xl">
                    <div className="mb-14 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-4">
                        {HELP_CATEGORIES.map((category, index) => (
                            <CategoryCard
                                key={category.title}
                                {...category}
                                delay={0.2 + index * 0.06}
                                onSelect={setSearchQuery}
                            />
                        ))}
                    </div>

                    <div className="mb-14 grid grid-cols-1 gap-4 md:grid-cols-3">
                        <FadeIn delay={0.22}>
                            <div className="desktop-apple-surface h-full rounded-[24px] p-5">
                                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[16px] border border-border/50 bg-muted/42 text-muted-foreground dark:border-white/[0.075] dark:bg-white/[0.045]">
                                    <Monitor className="h-5 w-5" />
                                </div>
                                <h3 className="mb-2 text-base font-bold tracking-normal text-foreground">
                                    Requisitos do Sistema
                                </h3>
                                <ul className="space-y-2 text-sm text-muted-foreground">
                                    <li>Windows 10/11 (64-bit)</li>
                                    <li>4GB RAM mínimo (8GB recomendado)</li>
                                    <li>200MB de espaço em disco</li>
                                    <li>Conexão com a internet ativa</li>
                                </ul>
                            </div>
                        </FadeIn>

                        <FadeIn delay={0.28}>
                            <div className="desktop-apple-surface h-full rounded-[24px] p-5">
                                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[16px] border border-border/50 bg-muted/42 text-muted-foreground dark:border-white/[0.075] dark:bg-white/[0.045]">
                                    <Keyboard className="h-5 w-5" />
                                </div>
                                <h3 className="mb-2 text-base font-bold tracking-normal text-foreground">
                                    Atalhos de Teclado
                                </h3>
                                <div className="space-y-2.5 text-sm">
                                    {[
                                        { keys: "Ctrl + R", desc: "Recarregar app" },
                                        { keys: "Ctrl + +", desc: "Aumentar zoom" },
                                        { keys: "Ctrl + -", desc: "Diminuir zoom" },
                                        { keys: "Ctrl + 0", desc: "Zoom padrão" },
                                        { keys: "F11", desc: "Tela cheia" },
                                        { keys: "Alt + F4", desc: "Fechar app" },
                                    ].map((shortcut) => (
                                        <div key={shortcut.keys} className="flex items-center justify-between gap-3">
                                            <span className="min-w-0 text-muted-foreground">{shortcut.desc}</span>
                                            <kbd className="shrink-0 rounded-md border border-border/45 bg-muted/45 px-2 py-0.5 font-mono text-[11px] text-foreground/70 dark:border-white/[0.075]">
                                                {shortcut.keys}
                                            </kbd>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </FadeIn>

                        <FadeIn delay={0.34}>
                            <div className="desktop-apple-surface h-full rounded-[24px] p-5">
                                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-[16px] border border-border/50 bg-muted/42 text-muted-foreground dark:border-white/[0.075] dark:bg-white/[0.045]">
                                    <RefreshCw className="h-5 w-5" />
                                </div>
                                <h3 className="mb-2 text-base font-bold tracking-normal text-foreground">
                                    Atualizações
                                </h3>
                                <p className="mb-4 text-sm leading-relaxed text-muted-foreground">
                                    O NeuroNex Desktop é atualizado automaticamente quando uma nova versão está disponível.
                                </p>
                                <div className="flex items-center justify-between gap-3 border-t border-border/35 pt-4 dark:border-white/[0.06]">
                                    <span className="text-[10px] font-bold uppercase tracking-[0.15em] text-muted-foreground/65">
                                        Versão Atual
                                    </span>
                                    <span className="font-mono text-sm text-foreground/75">
                                        v{appVersion}
                                    </span>
                                </div>
                            </div>
                        </FadeIn>
                    </div>

                    <div className="grid grid-cols-1 gap-8 border-t border-border/30 py-10 lg:grid-cols-3 dark:border-white/[0.06]">
                        <div className="space-y-4 lg:col-span-1">
                            <FadeIn delay={0.16}>
                                <h2 className="text-3xl font-bold leading-none tracking-normal text-foreground">
                                    Dúvidas frequentes
                                </h2>
                                <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground">
                                    {normalizedQuery
                                        ? `${filteredFaqItems.length} resultado${filteredFaqItems.length === 1 ? "" : "s"} para sua busca.`
                                        : "Respostas rápidas para operações comuns no desktop."}
                                </p>
                            </FadeIn>
                        </div>

                        <div className="lg:col-span-2">
                            <FadeIn delay={0.22}>
                                {filteredFaqItems.length > 0 ? (
                                    <Accordion type="single" collapsible className="space-y-3">
                                        {filteredFaqItems.map((item) => (
                                            <AccordionItem
                                                key={item.q}
                                                value={item.q}
                                                className="desktop-apple-surface rounded-[22px] px-5"
                                            >
                                                <AccordionTrigger className="py-5 text-left text-base font-bold text-foreground transition-colors hover:text-foreground/80 hover:no-underline">
                                                    {item.q}
                                                </AccordionTrigger>
                                                <AccordionContent className="max-w-2xl pb-6 text-sm font-medium leading-relaxed text-muted-foreground">
                                                    {item.a}
                                                </AccordionContent>
                                            </AccordionItem>
                                        ))}
                                    </Accordion>
                                ) : (
                                    <div className="desktop-apple-surface rounded-[24px] p-6 text-sm font-medium text-muted-foreground">
                                        Nenhum artigo encontrado. Tente buscar por agenda, financeiro, segurança ou integrações.
                                    </div>
                                )}
                            </FadeIn>
                        </div>
                    </div>

                    <div className="grid grid-cols-1 gap-4 border-t border-border/30 py-10 md:grid-cols-3 dark:border-white/[0.06]">
                        <FadeIn delay={0.24}>
                            <div className="desktop-apple-surface flex h-full flex-col items-center rounded-[24px] p-6 text-center">
                                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-border/50 bg-muted/42 text-muted-foreground dark:border-white/[0.075] dark:bg-white/[0.045]">
                                    <Zap className="h-5 w-5" />
                                </div>
                                <h3 className="mb-2 text-base font-bold text-foreground">
                                    Status do Sistema
                                </h3>
                                <p className="mb-4 text-sm text-muted-foreground">
                                    Infraestrutura global em operação.
                                </p>
                                <div className="flex items-center gap-2 rounded-full border border-border/45 bg-muted/35 px-4 py-1.5 text-[10px] font-bold uppercase tracking-[0.15em] text-foreground dark:border-white/[0.075]">
                                    <span className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_8px_rgba(16,185,129,0.65)] animate-pulse motion-reduce:animate-none" />
                                    Operacional
                                </div>
                            </div>
                        </FadeIn>

                        <FadeIn delay={0.3}>
                            <div className="desktop-apple-surface flex h-full flex-col items-center rounded-[24px] p-6 text-center">
                                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-border/50 bg-muted/42 text-muted-foreground dark:border-white/[0.075] dark:bg-white/[0.045]">
                                    <HelpCircle className="h-5 w-5" />
                                </div>
                                <h3 className="mb-2 text-base font-bold text-foreground">
                                    Documentação
                                </h3>
                                <p className="mb-4 text-sm text-muted-foreground">
                                    Guias técnicos e tutoriais completos.
                                </p>
                                <Button
                                    type="button"
                                    variant="link"
                                    className="h-auto p-0 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground hover:opacity-75"
                                    onClick={() => window.open("https://neuronex.site/help", "_blank")}
                                >
                                    Acessar Docs <ArrowRight className="ml-1.5 h-3 w-3" />
                                </Button>
                            </div>
                        </FadeIn>

                        <FadeIn delay={0.36}>
                            <div className="desktop-apple-surface flex h-full flex-col items-center rounded-[24px] p-6 text-center">
                                <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-full border border-border/50 bg-muted/42 text-muted-foreground dark:border-white/[0.075] dark:bg-white/[0.045]">
                                    <MessageSquare className="h-5 w-5" />
                                </div>
                                <h3 className="mb-2 text-base font-bold text-foreground">
                                    Suporte Direto
                                </h3>
                                <p className="mb-4 text-sm text-muted-foreground">
                                    Especialistas prontos para ajudar.
                                </p>
                                <Button
                                    type="button"
                                    variant="link"
                                    className="h-auto p-0 text-[10px] font-bold uppercase tracking-[0.18em] text-foreground hover:opacity-75"
                                    onClick={() => window.open("https://neuronex.site/contact", "_blank")}
                                >
                                    Falar com Suporte <ArrowRight className="ml-1.5 h-3 w-3" />
                                </Button>
                            </div>
                        </FadeIn>
                    </div>
                </div>
            </section>
        </div>
    );
};

export default DesktopHelpCenter;
