import { Navbar } from "@/components/landing/Navbar";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Footer } from "@/components/landing/Footer";
import { PublicRouteBreadcrumbs } from "@/components/public/PublicPageShell";
import { FadeIn } from "@/components/animations/FadeIn";
import { Cookie, CheckCircle2, XCircle } from "lucide-react";

const ConfiguracoesDeCookies = () => {
    return (
        <div className="public-lumen-page min-h-screen bg-background text-foreground relative overflow-x-hidden font-sans selection:bg-foreground/10">
            <Navbar />
            <LandingMobileNav />
            <PublicRouteBreadcrumbs route="/configuracoes-de-cookies" />

            {/* --- Hero --- */}
            <section className="relative px-6 pb-16 pt-28 md:pt-36">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,rgba(0,0,0,0.03),transparent)] dark:bg-[radial-gradient(circle_at_50%_-20%,rgba(255,255,255,0.03),transparent)] pointer-events-none" />

                <div className="public-neurox-hero max-w-[1180px] mx-auto px-8 py-16 text-center relative z-10 space-y-10 md:px-14 md:py-20">
                    <FadeIn>
                        <Cookie className="mx-auto mb-8 h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
                    </FadeIn>

                    <FadeIn delay={0.1}>
                        <h1 className="public-neurox-title text-[clamp(3.5rem,7vw,7.4rem)] font-black tracking-normal leading-[0.9] select-none">
                            Política de Cookies
                        </h1>
                    </FadeIn>

                    <FadeIn delay={0.2}>
                        <p className="text-lg md:text-xl text-foreground/50 font-normal max-w-2xl mx-auto leading-relaxed">
                            Saiba como a NeuroNex utiliza cookies, armazenamento local e dados temporários do navegador.
                            <br />
                            <span className="text-foreground/30 text-sm mt-4 block font-medium">Última atualização: 14 de julho de 2026</span>
                        </p>
                    </FadeIn>
                </div>
            </section>

            <div className="public-legal-content max-w-4xl mx-auto px-6 pb-40 relative z-10 space-y-20">
                <FadeIn>
                    <div className="space-y-16">
                        {/* What are Cookies */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/30 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-foreground/30" />
                                Cookies e armazenamento no navegador
                            </h3>
                            <div className="p-8 rounded-3xl bg-foreground/[0.02] border border-foreground/[0.05]">
                                <p className="text-foreground/60 leading-relaxed text-lg">
                                    Cookies são pequenos registros enviados pelo site e armazenados pelo navegador. A NeuroNex também utiliza <strong className="text-foreground">localStorage</strong> para preferências que permanecem no dispositivo e <strong className="text-foreground">sessionStorage</strong> para informações temporárias de um fluxo ou aba. São mecanismos diferentes, embora todos fiquem no navegador.
                                </p>
                            </div>
                        </div>

                        {/* Types of Cookies */}
                        <div className="space-y-8">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/30 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-foreground/30" />
                                Categorias utilizadas
                            </h3>
                            <div className="grid sm:grid-cols-3 gap-6">
                                {[
                                    {
                                        title: "Operacionais",
                                        desc: "Mantêm sessão, segurança e continuidade de fluxos. Parte dessas informações pode estar no armazenamento local ou temporário, e não necessariamente em cookies.",
                                        required: false
                                    },
                                    {
                                        title: "Preferências",
                                        desc: "Guardam escolhas como tema, opção de lembrar e-mail e configurações locais de determinadas telas.",
                                        required: true
                                    },
                                    {
                                        title: "Medição e marketing",
                                        desc: "Podem envolver tecnologias de fornecedores, como o Google Ads, conforme a configuração técnica e o consentimento aplicável.",
                                        required: false
                                    }
                                ].map((item, i) => (
                                    <div key={i} className="p-8 rounded-[2rem] bg-white dark:bg-foreground/[0.02] border border-foreground/[0.05] hover:border-foreground/20 transition-all duration-500">
                                        <div className="flex items-center gap-2 mb-3">
                                            <h4 className="font-semibold text-foreground">{item.title}</h4>
                                            {item.required ? (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-foreground/10 text-foreground/60">Necessário ao recurso</span>
                                            ) : (
                                                <span className="text-[10px] px-2 py-0.5 rounded-full bg-foreground/5 text-foreground/40">Opcional</span>
                                            )}
                                        </div>
                                        <p className="text-xs text-foreground/40 leading-relaxed">{item.desc}</p>
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Cookie Details Table */}
                        <div className="space-y-8">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/30 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-foreground/30" />
                                Registros identificados na aplicação
                            </h3>
                            <div className="overflow-hidden rounded-[2rem] border border-foreground/[0.05]">
                                <table className="w-full">
                                    <thead className="bg-foreground/[0.02]">
                                        <tr>
                                            <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-foreground/40">Nome</th>
                                            <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-foreground/40">Finalidade</th>
                                            <th className="text-left p-4 text-xs font-semibold uppercase tracking-wider text-foreground/40">Tipo e permanência</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-foreground/[0.05]">
                                        {[
                                            { name: "neuronex-cookie-consent", purpose: "Registra se a pessoa aceitou ou recusou os recursos opcionais apresentados no aviso.", duration: "Cookie — 365 dias" },
                                            { name: "neuronex-cookie-preferences", purpose: "Guarda o conjunto de preferências associado à escolha feita no aviso.", duration: "Cookie — 365 dias" },
                                            { name: "theme", purpose: "Guarda a preferência de tema claro, escuro ou do sistema.", duration: "Armazenamento local — até alteração ou limpeza" },
                                            { name: "sb-…-auth-token", purpose: "Chave dinâmica criada pelo serviço de autenticação para manter a sessão do usuário.", duration: "Armazenamento do navegador — conforme a sessão" },
                                            { name: "neuronex_remember_me / neuronex_remembered_email", purpose: "Guarda a opção de lembrar o e-mail na tela de acesso, quando escolhida.", duration: "Armazenamento local — até desmarcar ou limpar" }
                                        ].map((cookie, i) => (
                                            <tr key={i} className="bg-white dark:bg-transparent">
                                                <td className="p-4 text-sm font-mono text-foreground">{cookie.name}</td>
                                                <td className="p-4 text-sm text-foreground/60">{cookie.purpose}</td>
                                                <td className="p-4 text-sm text-foreground/40">{cookie.duration}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <p className="text-xs text-foreground/40 leading-relaxed">
                                A aplicação também possui uma configuração de tag do Google Ads. Os nomes e a permanência de identificadores criados pelo Google podem variar conforme a configuração do fornecedor, o navegador e o consentimento aplicável. A lista acima descreve as chaves controladas diretamente pela NeuroNex e não deve ser interpretada como uma relação fixa de todos os identificadores de terceiros.
                            </p>
                        </div>

                        {/* How to Manage */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/30 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-foreground/30" />
                                Como Gerenciar seus Cookies
                            </h3>
                            <div className="grid sm:grid-cols-2 gap-6">
                                <div className="p-8 rounded-[2rem] bg-foreground/[0.02] border border-foreground/[0.05]">
                                    <div className="flex items-center gap-3 mb-4">
                                        <CheckCircle2 className="w-5 h-5 text-green-500" />
                                        <h4 className="font-semibold text-foreground">Escolha no aviso</h4>
                                    </div>
                                    <p className="text-sm text-foreground/40 leading-relaxed">
                                        A simples navegação não é tratada como aceite. O aviso atual permite aceitar todos os recursos apresentados ou recusar os opcionais; ele não oferece seleção individual por categoria ou fornecedor.
                                    </p>
                                </div>
                                <div className="p-8 rounded-[2rem] bg-foreground/[0.02] border border-foreground/[0.05]">
                                    <div className="flex items-center gap-3 mb-4">
                                        <XCircle className="w-5 h-5 text-foreground/40" />
                                        <h4 className="font-semibold text-foreground">Revisar ou limpar</h4>
                                    </div>
                                    <p className="text-sm text-foreground/40 leading-relaxed">
                                        Para mudar uma escolha já salva, limpe os dados do site nas configurações do navegador e recarregue a página. Também é possível bloquear armazenamento, mas isso pode interromper login, preferências e recuperação de fluxos em andamento.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Contact */}
                        <div className="rounded-[2.5rem] bg-foreground text-background p-12 text-center">
                            <h3 className="text-2xl font-medium mb-4">Dúvidas sobre Cookies?</h3>
                            <p className="text-background/60 mb-6">Entre em contato com nossa equipe.</p>
                            <p className="text-lg font-medium">suporte@neuronexai.com.br</p>
                            <p className="text-sm text-background/40 mt-4">CNPJ: 65.610.762/0001-55</p>
                        </div>
                    </div>
                </FadeIn>
            </div>

            <Footer />
        </div>
    );
};

export default ConfiguracoesDeCookies;
