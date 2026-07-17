import { Navbar } from "@/components/landing/Navbar";
import { LandingMobileNav } from "@/components/landing/LandingMobileNav";
import { Footer } from "@/components/landing/Footer";
import { PublicRouteBreadcrumbs } from "@/components/public/PublicPageShell";
import { FadeIn } from "@/components/animations/FadeIn";
import { ShieldCheck, Globe, Database, CheckCircle2, Info, Lock, Share2, Trash2, Server, Eye, FileText } from "lucide-react";

const PoliticaDePrivacidade = () => {
    return (
        <div className="public-lumen-page min-h-screen bg-background text-foreground relative overflow-x-hidden font-sans selection:bg-foreground/10">
            <Navbar />
            <LandingMobileNav />
            <PublicRouteBreadcrumbs route="/politica-de-privacidade" />

            {/* --- Hero --- */}
            <section className="relative px-6 pb-16 pt-28 md:pt-36">
                <div className="absolute top-0 left-0 w-full h-full bg-[radial-gradient(circle_at_50%_-20%,rgba(0,0,0,0.03),transparent)] dark:bg-[radial-gradient(circle_at_50%_-20%,rgba(255,255,255,0.03),transparent)] pointer-events-none" />

                <div className="public-neurox-hero max-w-[1180px] mx-auto px-8 py-16 text-center relative z-10 space-y-10 md:px-14 md:py-20">
                    <FadeIn>
                        <ShieldCheck className="mx-auto mb-8 h-10 w-10 text-muted-foreground" strokeWidth={1.5} />
                    </FadeIn>

                    <FadeIn delay={0.1}>
                        <h1 className="public-neurox-title text-[clamp(3.5rem,7vw,7.4rem)] font-black tracking-normal leading-[0.9] select-none">
                            Política de Privacidade
                        </h1>
                    </FadeIn>

                    <FadeIn delay={0.2}>
                        <p className="text-lg md:text-xl text-foreground/50 font-normal max-w-2xl mx-auto leading-relaxed">
                            Este documento detalha como a NeuroNex acessa, usa, armazena e protege seus dados, incluindo informações obtidas através de serviços e APIs do Google.
                            <br />
                            <span className="text-foreground/30 text-sm mt-4 block font-medium">Última atualização: 14 de julho de 2026</span>
                        </p>
                    </FadeIn>
                </div>
            </section>

            <div className="public-legal-content max-w-4xl mx-auto px-6 pb-40 relative z-10 space-y-20">
                <FadeIn>
                    <div className="grid grid-cols-1 gap-16">
                        {/* 1. Introdução */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/30 flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-foreground/30" />
                                01 / Introdução
                            </h3>
                            <div className="space-y-6 text-lg text-foreground/60 leading-relaxed font-normal">
                                <p>
                                    A <strong className="text-foreground font-semibold">NeuroNex AI</strong> ("NeuroNex", "Nós")
                                    está comprometida com a proteção da sua privacidade. Operamos em conformidade com a <strong>LGPD (Lei nº 13.709/2018)</strong>,
                                    a <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="underline text-foreground/70 hover:text-foreground transition-colors">Política de Dados do Usuário dos Serviços de API do Google</a> e
                                    os <a href="https://developers.google.com/terms" target="_blank" rel="noopener noreferrer" className="underline text-foreground/70 hover:text-foreground transition-colors">Termos de Serviço das APIs do Google</a>.
                                </p>
                                <p>
                                    Esta política descreve de forma clara e abrangente como nossa aplicação acessa, usa, armazena, compartilha e protege os dados dos usuários do Google, bem como as práticas de retenção e exclusão desses dados.
                                </p>
                            </div>
                        </div>

                        {/* ===== SEÇÃO 2: DADOS ACESSADOS ===== */}
                        <div className="space-y-8 p-10 rounded-[2.5rem] bg-foreground/[0.02] border border-foreground/[0.05]">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/30 flex items-center gap-2">
                                <Eye className="w-4 h-4" />
                                02 / Dados Acessados
                            </h3>
                            <div className="space-y-6">
                                <p className="text-foreground/60 leading-relaxed">
                                    As categorias abaixo podem ser acessadas conforme a funcionalidade escolhida e os escopos efetivamente autorizados pelo usuário no fluxo de consentimento OAuth. Conectar uma conta Google não concede automaticamente todas as permissões:
                                </p>
                                <ul className="grid sm:grid-cols-2 gap-4">
                                    {[
                                        { label: "Perfil Básico (openid, profile)", detail: "Nome completo e foto de perfil da conta Google, utilizados para personalizar a interface e identificar o profissional dentro da plataforma." },
                                        { label: "Endereço de E-mail (email)", detail: "Endereço de e-mail principal da conta Google, utilizado como identificador único para autenticação, login e envio de notificações relacionadas ao serviço." },
                                        { label: "Google Calendar", detail: "Eventos necessários à sincronização de agenda, quando esse recurso estiver conectado e autorizado." },
                                        { label: "Gmail", detail: "Permissão de envio para comunicações solicitadas pela plataforma, quando esse recurso estiver conectado e autorizado." },
                                        { label: "Google Drive", detail: "Arquivos ou metadados necessários ao fluxo escolhido, somente quando houver integração ativa e permissão correspondente." },
                                        { label: "Identificador Único do Google (sub)", detail: "ID interno do Google utilizado exclusivamente para vincular de forma segura a conta Google ao perfil do profissional na NeuroNex." }
                                    ].map((item, i) => (
                                        <li key={i} className="flex flex-col gap-2 p-5 rounded-2xl bg-white dark:bg-foreground/[0.03] border border-foreground/[0.05]">
                                            <span className="font-semibold text-foreground text-sm">{item.label}</span>
                                            <span className="text-xs text-foreground/40 leading-relaxed">{item.detail}</span>
                                        </li>
                                    ))}
                                </ul>
                                <div className="p-5 rounded-2xl bg-foreground/5 border border-foreground/5">
                                    <div className="flex gap-3 items-start">
                                        <Info className="w-5 h-5 text-foreground/40 mt-0.5 shrink-0" />
                                        <p className="text-xs text-foreground/50 leading-relaxed">
                                            <strong className="text-foreground/70">Importante:</strong> a permissão efetiva é a que aparece na tela de consentimento do Google para o recurso conectado. A NeuroNex somente pode executar operações abrangidas pelos escopos concedidos. O usuário pode revisar e revogar permissões a qualquer momento nas <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="underline text-foreground/70 hover:text-foreground transition-colors">configurações de segurança da conta Google</a>.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ===== SEÇÃO 3: UTILIZAÇÃO DE DADOS ===== */}
                        <div className="space-y-8 p-10 rounded-[2.5rem] bg-foreground/[0.02] border border-foreground/[0.05]">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/30 flex items-center gap-2">
                                <FileText className="w-4 h-4" />
                                03 / Utilização de Dados
                            </h3>
                            <div className="space-y-6">
                                <p className="text-foreground/60 leading-relaxed">
                                    Os dados de usuários do Google acessados pela NeuroNex são utilizados, processados e gerenciados exclusivamente para as seguintes finalidades:
                                </p>
                                <div className="space-y-3">
                                    {[
                                        {
                                            title: "Autenticação e Login",
                                            desc: "Utilizamos o nome, e-mail e identificador do Google para autenticar o usuário via Google Sign-In (OAuth 2.0), criando e mantendo sessões seguras na plataforma. Isso permite que o profissional acesse sua conta sem necessidade de criar uma senha separada."
                                        },
                                        {
                                            title: "Personalização da Experiência",
                                            desc: "O nome e a foto de perfil do Google são exibidos na interface da NeuroNex (barra de navegação, perfil do profissional) para proporcionar uma experiência personalizada e familiar ao usuário."
                                        },
                                        {
                                            title: "Sincronização de Agenda Clínica",
                                            desc: "Eventos do Google Calendar podem ser lidos e criados quando o profissional ativa a sincronização de agenda e autoriza o escopo correspondente."
                                        },
                                        {
                                            title: "Comunicações Relacionadas ao Serviço",
                                            desc: "O endereço de e-mail pode ser utilizado para comunicações relacionadas ao serviço. Quando o usuário autoriza o Gmail, a plataforma pode enviar mensagens solicitadas pelo fluxo conectado."
                                        },
                                        {
                                            title: "Arquivos Conectados",
                                            desc: "Arquivos ou metadados do Google Drive podem ser processados apenas nos fluxos em que o usuário ativa e autoriza essa integração."
                                        }
                                    ].map((item, i) => (
                                        <div key={i} className="flex gap-4 p-5 rounded-2xl bg-foreground/[0.02]">
                                            <CheckCircle2 className="w-5 h-5 text-foreground/40 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-semibold text-foreground mb-1">{item.title}</p>
                                                <p className="text-xs text-foreground/50 leading-relaxed">{item.desc}</p>
                                            </div>
                                        </div>
                                    ))}
                                </div>

                                {/* AI/ML Disclosure dentro da seção de utilização */}
                                <div className="p-8 rounded-3xl bg-zinc-950 text-white relative overflow-hidden">
                                    <div className="absolute top-0 right-0 p-8 opacity-10">
                                        <Database className="w-24 h-24" />
                                    </div>
                                    <h4 className="text-xl font-medium mb-3 relative z-10">Política de IA e Machine Learning</h4>
                                    <p className="text-white/60 leading-relaxed relative z-10 text-sm">
                                        Os dados provenientes das APIs do Google
                                        <strong className="text-white underline decoration-white/30 mx-1">não são destinados ao treinamento, melhoria ou ajuste de modelos de Inteligência Artificial</strong>.
                                        Quando o usuário pede ao Synapse ou a outra automação uma ação conectada ao Google, o conteúdo necessário pode ser processado para cumprir aquela solicitação, dentro das permissões efetivamente concedidas. Esse processamento operacional não transforma os dados em material de treinamento do modelo.
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* ===== SEÇÃO 4: COMPARTILHAMENTO DE DADOS ===== */}
                        <div className="space-y-8 p-10 rounded-[2.5rem] bg-foreground/[0.02] border border-foreground/[0.05]">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/30 flex items-center gap-2">
                                <Share2 className="w-4 h-4" />
                                04 / Compartilhamento de Dados
                            </h3>
                            <div className="space-y-6">
                                <p className="text-foreground/60 leading-relaxed">
                                    A NeuroNex <strong className="text-foreground">não vende, aluga ou comercializa</strong> dados de usuários do Google para terceiros, sob nenhuma circunstcia. O compartilhamento ocorre apenas nos seguintes casos estritamente necessários para o funcionamento do serviço:
                                </p>

                                <div className="space-y-4">
                                    <div className="p-5 rounded-2xl bg-white dark:bg-foreground/[0.03] border border-foreground/[0.05] space-y-2">
                                        <h4 className="font-semibold text-foreground text-sm">Provedores de Infraestrutura</h4>
                                        <p className="text-xs text-foreground/50 leading-relaxed">
                                            <strong className="text-foreground/70">Supabase (hospedado em infraestrutura cloud):</strong> Utilizado como banco de dados e sistema de autenticação. Controles e certificações devem ser verificados na documentação oficial do fornecedor.
                                        </p>
                                    </div>

                                    <div className="p-5 rounded-2xl bg-white dark:bg-foreground/[0.03] border border-foreground/[0.05] space-y-2">
                                        <h4 className="font-semibold text-foreground text-sm">Serviços do Google</h4>
                                        <p className="text-xs text-foreground/50 leading-relaxed">
                                            As operações autorizadas de Calendar, Gmail ou Drive são enviadas às APIs correspondentes do Google somente quando necessárias ao recurso solicitado. Essa comunicação ocorre pelas APIs oficiais do fornecedor.
                                        </p>
                                    </div>

                                    <div className="p-5 rounded-2xl bg-white dark:bg-foreground/[0.03] border border-foreground/[0.05] space-y-2">
                                        <h4 className="font-semibold text-foreground text-sm">Obrigações Legais</h4>
                                        <p className="text-xs text-foreground/50 leading-relaxed">
                                            Podemos divulgar dados quando exigido por lei, ordem judicial ou processo legal válido, sempre notificando o usuário quando permitido por lei.
                                        </p>
                                    </div>
                                </div>

                                <div className="p-5 rounded-2xl bg-foreground/5 border border-foreground/5">
                                    <div className="flex gap-3 items-start">
                                        <Info className="w-5 h-5 text-foreground/40 mt-0.5 shrink-0" />
                                        <p className="text-xs text-foreground/50 leading-relaxed">
                                            <strong className="text-foreground/70">Não compartilhamos dados com:</strong> redes de publicidade, corretores de dados, provedores de informações, revendedores de dados ou quaisquer outras entidades que não sejam estritamente necessárias para a operação do serviço descrito nesta política.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ===== SEÇÃO 5: ARMAZENAMENTO E PROTEÇÃO DE DADOS ===== */}
                        <div className="space-y-8 p-10 rounded-[2.5rem] bg-foreground/[0.02] border border-foreground/[0.05]">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/30 flex items-center gap-2">
                                <Lock className="w-4 h-4" />
                                05 / Armazenamento e Proteção de Dados
                            </h3>
                            <div className="space-y-6">
                                <p className="text-foreground/60 leading-relaxed">
                                    A NeuroNex adota práticas robustas de segurança para armazenar e proteger os dados dos usuários do Google:
                                </p>

                                <div className="grid sm:grid-cols-2 gap-4">
                                    {[
                                        {
                                            title: "Criptografia em Repouso",
                                            desc: "Tokens e segredos são tratados por rotinas server-side e fornecedores gerenciados; algoritmos específicos dependem do controle aplicável."
                                        },
                                        {
                                            title: "Criptografia em Trnsito",
                                            desc: "As comunicações entre o aplicativo NeuroNex, servidores e APIs oficiais usam HTTPS/TLS quando aplicável."
                                        },
                                        {
                                            title: "Infraestrutura Segura",
                                            desc: "A infraestrutura é operada por fornecedores cloud. Certificações e controles devem ser confirmados nos portais oficiais desses fornecedores."
                                        },
                                        {
                                            title: "Controle de Acesso",
                                            desc: "O acesso ao banco de dados é restrito por Row Level Security (RLS) do PostgreSQL, garantindo que cada usuário só possa acessar seus próprios dados. Políticas de acesso baseadas em roles (RBAC) são aplicadas em toda a plataforma."
                                        },
                                        {
                                            title: "Autenticação Segura",
                                            desc: "Utilizamos OAuth 2.0 via Supabase Auth para autenticação com o Google. Tokens de acesso são armazenados de forma segura no servidor e nunca são expostos ao lado do cliente."
                                        },
                                        {
                                            title: "Monitoramento e Auditoria",
                                            desc: "Logs operacionais e procedimentos internos apoiam auditoria, investigação e resposta a incidentes."
                                        }
                                    ].map((item, i) => (
                                        <div key={i} className="p-5 rounded-2xl bg-white dark:bg-foreground/[0.03] border border-foreground/[0.05] space-y-2">
                                            <h4 className="font-semibold text-foreground text-sm flex items-center gap-2">
                                                <Server className="w-3.5 h-3.5 text-foreground/40" />
                                                {item.title}
                                            </h4>
                                            <p className="text-xs text-foreground/40 leading-relaxed">{item.desc}</p>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* ===== SEÇÃO 6: RETENÇÃO E EXCLUSÃO DE DADOS ===== */}
                        <div className="space-y-8 p-10 rounded-[2.5rem] bg-foreground/[0.02] border border-foreground/[0.05]">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/30 flex items-center gap-2">
                                <Trash2 className="w-4 h-4" />
                                06 / Retenção e Exclusão de Dados
                            </h3>
                            <div className="space-y-6">
                                <div className="space-y-4">
                                    <h4 className="text-xl font-medium text-foreground">Período de Retenção</h4>
                                    <div className="space-y-3">
                                        <div className="flex gap-4 p-5 rounded-2xl bg-foreground/[0.02]">
                                            <CheckCircle2 className="w-5 h-5 text-foreground/40 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-semibold text-foreground mb-1">Dados de Perfil (nome, e-mail, foto)</p>
                                                <p className="text-xs text-foreground/50 leading-relaxed">Retidos enquanto a conta do usuário estiver ativa na plataforma NeuroNex. Os dados são utilizados para manter o funcionamento contínuo do serviço.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-4 p-5 rounded-2xl bg-foreground/[0.02]">
                                            <CheckCircle2 className="w-5 h-5 text-foreground/40 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-semibold text-foreground mb-1">Tokens de Acesso ao Google</p>
                                                <p className="text-xs text-foreground/50 leading-relaxed">Mantidos enquanto a integração correspondente estiver ativa e forem necessários para prestar o recurso autorizado. O usuário pode revogar as permissões pela conta Google.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-4 p-5 rounded-2xl bg-foreground/[0.02]">
                                            <CheckCircle2 className="w-5 h-5 text-foreground/40 shrink-0 mt-0.5" />
                                            <div>
                                                <p className="text-sm font-semibold text-foreground mb-1">Dados vinculados às integrações Google</p>
                                                <p className="text-xs text-foreground/50 leading-relaxed">Mantidos conforme a finalidade do registro relacionado e as obrigações técnicas, contratuais ou legais aplicáveis.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="space-y-4">
                                    <h4 className="text-xl font-medium text-foreground">Como Solicitar a Exclusão dos Seus Dados</h4>
                                    <p className="text-foreground/60 leading-relaxed text-sm">
                                        O usuário pode solicitar a eliminação de seus dados pessoais, observadas as hipóteses de conservação permitidas ou exigidas pela legislação aplicável:
                                    </p>
                                    <div className="space-y-3">
                                        <div className="flex gap-4 p-5 rounded-2xl bg-white dark:bg-foreground/[0.03] border border-foreground/[0.05]">
                                            <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold shrink-0">1</div>
                                            <div>
                                                <p className="text-sm font-semibold text-foreground mb-1">Solicitação pelo canal de contato</p>
                                                <p className="text-xs text-foreground/50 leading-relaxed">Abra uma solicitação em <strong className="text-foreground">/contato</strong> e informe que deseja excluir a conta ou dados associados.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-4 p-5 rounded-2xl bg-white dark:bg-foreground/[0.03] border border-foreground/[0.05]">
                                            <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold shrink-0">2</div>
                                            <div>
                                                <p className="text-sm font-semibold text-foreground mb-1">Validação de identidade</p>
                                                <p className="text-xs text-foreground/50 leading-relaxed">Antes de executar a solicitação, a NeuroNex poderá pedir informações adicionais para confirmar a identidade do titular e proteger a conta contra exclusões indevidas.</p>
                                            </div>
                                        </div>
                                        <div className="flex gap-4 p-5 rounded-2xl bg-white dark:bg-foreground/[0.03] border border-foreground/[0.05]">
                                            <div className="w-8 h-8 rounded-full bg-foreground text-background flex items-center justify-center text-xs font-bold shrink-0">3</div>
                                            <div>
                                                <p className="text-sm font-semibold text-foreground mb-1">Revogação de Acesso pelo Google</p>
                                                <p className="text-xs text-foreground/50 leading-relaxed">Você pode revogar o acesso da NeuroNex nas <a href="https://myaccount.google.com/permissions" target="_blank" rel="noopener noreferrer" className="underline text-foreground/70 hover:text-foreground transition-colors">configurações da conta Google</a>. Isso interrompe novos acessos autorizados, mas não substitui o pedido em <strong className="text-foreground">/contato</strong> para avaliar dados já registrados na NeuroNex.</p>
                                            </div>
                                        </div>
                                    </div>
                                </div>

                                <div className="p-5 rounded-2xl bg-foreground/5 border border-foreground/5">
                                    <div className="flex gap-3 items-start">
                                        <Info className="w-5 h-5 text-foreground/40 mt-0.5 shrink-0" />
                                        <p className="text-xs text-foreground/50 leading-relaxed">
                                            <strong className="text-foreground/70">Nota:</strong> dados efetivamente eliminados deixam de ficar disponíveis na conta. Informações anonimizadas ou registros cuja conservação seja necessária para cumprir obrigação legal, exercer direitos ou prevenir fraude podem ser mantidos conforme a base aplicável.
                                        </p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* ===== SEÇÃO 7: CONFORMIDADE COM POLÍTICAS DO GOOGLE ===== */}
                        <div className="space-y-6">
                            <h3 className="text-sm font-semibold uppercase tracking-[0.2em] text-foreground/30 flex items-center gap-2">
                                <Globe className="w-4 h-4" />
                                07 / Conformidade com Políticas do Google
                            </h3>
                            <div className="p-8 rounded-3xl bg-zinc-950 text-white relative overflow-hidden">
                                <div className="absolute top-0 right-0 p-8 opacity-10">
                                    <ShieldCheck className="w-24 h-24" />
                                </div>
                                <h4 className="text-xl font-medium mb-4 relative z-10">Uso Limitado (Limited Use)</h4>
                                <div className="space-y-4 relative z-10">
                                    <p className="text-white/60 leading-relaxed text-sm">
                                        O tratamento de informações recebidas das APIs do Google deve observar a
                                        <a href="https://developers.google.com/terms/api-services-user-data-policy" target="_blank" rel="noopener noreferrer" className="mx-1 underline text-white/80 hover:text-white transition-colors">Política de Dados do Usuário dos Serviços de API do Google</a>,
                                        incluindo os requisitos de Uso Limitado. Especificamente:
                                    </p>
                                    <ul className="space-y-2">
                                        {[
                                            "Usamos os dados do Google apenas para fornecer e melhorar os recursos voltados ao usuário que são proeminentes na interface do aplicativo.",
                                            "Não transferimos dados do Google para terceiros, exceto conforme necessário para fornecer e melhorar os recursos do aplicativo, em conformidade com a lei, ou como parte de uma fusão/aquisição com proteções adequadas.",
                                            "Não usamos dados do Google para veicular anúncios, inclusive retargeting ou publicidade personalizada.",
                                            "Não permitimos que humanos leiam os dados dos usuários, exceto com consentimento explícito, para fins de segurança, para cumprir leis aplicáveis, ou quando os dados são agregados e anonimizados para operações internas."
                                        ].map((item, i) => (
                                            <li key={i} className="flex gap-3 items-start">
                                                <CheckCircle2 className="w-4 h-4 text-white/40 shrink-0 mt-0.5" />
                                                <p className="text-xs text-white/50 leading-relaxed">{item}</p>
                                            </li>
                                        ))}
                                    </ul>
                                </div>
                            </div>
                        </div>

                        {/* 8. Contact */}
                        <div className="rounded-[2.5rem] bg-foreground text-background p-12 text-center">
                            <h3 className="text-2xl font-medium mb-4">Dúvidas sobre Privacidade?</h3>
                            <p className="text-background/60 mb-6 max-w-lg mx-auto">
                                Se você tiver alguma dúvida sobre esta política, sobre como seus dados são tratados, ou quiser exercer seus direitos, entre em contato com nossa equipe de proteção de dados.
                            </p>
                            <p className="text-lg font-medium">suporte@neuronexai.com.br</p>
                            <p className="text-sm text-background/40 mt-4">NeuroNex AI LTDA</p>
                            <p className="text-sm text-background/40">CNPJ: 65.610.762/0001-55</p>
                        </div>
                    </div>
                </FadeIn>
            </div>

            <Footer />
        </div>
    );
};

export default PoliticaDePrivacidade;
