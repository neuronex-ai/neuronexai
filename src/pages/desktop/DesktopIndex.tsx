"use client";

import React from "react";
import { Link, useNavigate } from "react-router-dom";
import { 
  Brain, 
  Sparkles, 
  MessageSquare, 
  Calendar, 
  DollarSign, 
  ShieldCheck, 
  ArrowRight, 
  Users, 
  Clock, 
  TrendingUp,
  ChevronRight,
  Menu,
  X
} from "lucide-react";
import { Button } from "@/components/ui/button";

export default function DesktopIndex() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = React.useState(false);

  const features = [
    {
      icon: <Sparkles className="h-6 w-6 text-purple-500" />,
      title: "Prontuário Inteligente",
      description: "Transcreva e resuma suas sessões automaticamente com IA compatível com as normas do CFP. Economize horas de digitação pós-consulta."
    },
    {
      icon: <MessageSquare className="h-6 w-6 text-blue-500" />,
      title: "Synapse WhatsApp",
      description: "Um assistente de IA que atende seus pacientes no WhatsApp, tira dúvidas frequentes e agenda consultas de forma autônoma."
    },
    {
      icon: <DollarSign className="h-6 w-6 text-emerald-500" />,
      title: "NeuroFinance",
      description: "Gestão financeira completa integrada ao Asaas. Emita cobranças Pix/Boleto, notas fiscais e lembretes automáticos de inadimplência."
    },
    {
      icon: <Calendar className="h-6 w-6 text-rose-500" />,
      title: "Agenda Integrada",
      description: "Agenda intuitiva com sincronização com Google Calendar, controle de ausências e confirmação automática de presença."
    },
    {
      icon: <ShieldCheck className="h-6 w-6 text-indigo-500" />,
      title: "Segurança Absoluta",
      description: "Seus dados e de seus pacientes protegidos por criptografia de ponta a ponta e total conformidade com a LGPD."
    },
    {
      icon: <Users className="h-6 w-6 text-amber-500" />,
      title: "Portal do Paciente",
      description: "Área exclusiva para pacientes acompanharem suas metas terapêuticas, faturas e agendamentos com facilidade."
    }
  ];

  const stats = [
    { value: "15h", label: "Economizadas por semana" },
    { value: "+32%", label: "De faturamento médio" },
    { value: "98%", label: "Satisfação dos pacientes" },
    { value: "0%", label: "Inadimplência com régua ativa" }
  ];

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors">
      {/* Navigation Header */}
      <header className="sticky top-0 z-50 w-full border-b border-slate-200/80 dark:border-slate-800/80 bg-slate-50/80 dark:bg-slate-950/80 backdrop-blur-md">
        <div className="container mx-auto px-4 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="h-9 w-9 rounded-lg bg-indigo-600 flex items-center justify-center shadow-md shadow-indigo-500/20">
              <Brain className="h-5 w-5 text-white" />
            </div>
            <span className="font-bold text-xl tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Synapse AI
            </span>
          </div>

          <nav className="hidden md:flex items-center gap-6 text-sm font-medium">
            <a href="#features" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Recursos</a>
            <a href="#benefits" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Benefícios</a>
            <a href="#security" className="hover:text-indigo-600 dark:hover:text-indigo-400 transition-colors">Segurança</a>
          </nav>

          <div className="hidden md:flex items-center gap-3">
            <Button variant="ghost" size="sm" onClick={() => navigate("/login")}>
              Entrar
            </Button>
            <Button size="sm" className="bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => navigate("/register")}>
              Começar Grátis
            </Button>
          </div>

          <button className="md:hidden p-2" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-6 w-6" /> : <Menu className="h-6 w-6" />}
          </button>
        </div>

        {/* Mobile Menu */}
        {mobileMenuOpen && (
          <div className="md:hidden border-b border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-4 py-4 space-y-3">
            <a href="#features" className="block py-2 text-sm font-medium hover:text-indigo-600" onClick={() => setMobileMenuOpen(false)}>Recursos</a>
            <a href="#benefits" className="block py-2 text-sm font-medium hover:text-indigo-600" onClick={() => setMobileMenuOpen(false)}>Benefícios</a>
            <a href="#security" className="block py-2 text-sm font-medium hover:text-indigo-600" onClick={() => setMobileMenuOpen(false)}>Segurança</a>
            <div className="pt-2 border-t border-slate-200 dark:border-slate-800 flex flex-col gap-2">
              <Button variant="outline" size="sm" className="w-full" onClick={() => { setMobileMenuOpen(false); navigate("/login"); }}>
                Entrar
              </Button>
              <Button size="sm" className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => { setMobileMenuOpen(false); navigate("/register"); }}>
                Começar Grátis
              </Button>
            </div>
          </div>
        )}
      </header>

      {/* Hero Section */}
      <section className="relative py-20 lg:py-32 overflow-hidden">
        <div className="absolute inset-0 bg-grid-slate-900/[0.04] dark:bg-grid-white/[0.02] bg-[bottom_center]" />
        <div className="absolute top-1/4 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[500px] h-[500px] bg-indigo-500/10 dark:bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none" />
        
        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto text-center space-y-6">
            <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-indigo-50 dark:bg-indigo-950/50 border border-indigo-100 dark:border-indigo-900/50 text-indigo-600 dark:text-indigo-400 text-xs font-semibold">
              <Sparkles className="h-3.5 w-3.5" />
              Sua rotina clínica automatizada com inteligência
            </div>

            <h1 className="text-4xl md:text-6xl font-extrabold tracking-tight leading-none">
              A evolução do seu consultório de{" "}
              <span className="bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent">
                Psicologia
              </span>
            </h1>

            <p className="text-lg md:text-xl text-slate-600 dark:text-slate-400 max-w-2xl mx-auto font-normal">
              Prontuário com IA, faturamento automático com Asaas, recepção inteligente no WhatsApp e agenda integrada em um único ecossistema seguro e em conformidade com o CFP.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center pt-4">
              <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white h-12 px-6 text-base shadow-lg shadow-indigo-500/15" onClick={() => navigate("/register")}>
                Testar 14 dias grátis
                <ArrowRight className="ml-2 h-4 w-4" />
              </Button>
              <Button size="lg" variant="outline" className="h-12 px-6 text-base border-slate-300 dark:border-slate-800" onClick={() => navigate("/login")}>
                Acessar minha conta
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* Stats Section */}
      <section className="py-12 bg-slate-100/50 dark:bg-slate-900/30 border-y border-slate-200 dark:border-slate-900">
        <div className="container mx-auto px-4">
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-8">
            {stats.map((stat, idx) => (
              <div key={idx} className="text-center space-y-1">
                <div className="text-3xl md:text-5xl font-extrabold bg-gradient-to-b from-slate-900 to-slate-600 dark:from-white dark:to-slate-400 bg-clip-text text-transparent">
                  {stat.value}
                </div>
                <div className="text-xs md:text-sm font-medium text-slate-500 dark:text-slate-400">
                  {stat.label}
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Features Section */}
      <section id="features" className="py-20 lg:py-28">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto space-y-4 mb-16">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
              Tudo o que você precisa para o seu dia a dia clínico
            </h2>
            <p className="text-slate-600 dark:text-slate-400 text-base md:text-lg">
              Deixe que as tarefas administrativas fiquem no piloto automático para que você possa focar no que realmente importa: a clínica.
            </p>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
            {features.map((feature, idx) => (
              <div 
                key={idx} 
                className="p-6 rounded-2xl bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 hover:border-indigo-500/50 dark:hover:border-indigo-500/30 transition-all shadow-sm hover:shadow-md"
              >
                <div className="p-3 bg-slate-50 dark:bg-slate-950 rounded-xl w-fit mb-5 border border-slate-100 dark:border-slate-900">
                  {feature.icon}
                </div>
                <h3 className="font-bold text-lg mb-2">{feature.title}</h3>
                <p className="text-slate-500 dark:text-slate-400 text-sm leading-relaxed">
                  {feature.description}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Trust & Security Section */}
      <section id="security" className="py-20 bg-slate-900 text-white relative overflow-hidden">
        <div className="absolute inset-0 bg-indigo-500/5 blur-[120px] rounded-full pointer-events-none -top-40 -left-40" />
        <div className="container mx-auto px-4 relative">
          <div className="max-w-4xl mx-auto grid lg:grid-cols-12 gap-12 items-center">
            <div className="lg:col-span-7 space-y-6">
              <div className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-semibold">
                <ShieldCheck className="h-3.5 w-3.5" />
                Segurança de nível hospitalar
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight">
                Seus dados e de seus pacientes sob chave de ouro
              </h2>
              <p className="text-slate-300 text-base leading-relaxed">
                Nós levamos a segurança a sério. Todas as anotações clínicas e prontuários passam por fortes camadas de criptografia de dados (AES-256) com isolamento total de banco de dados, atendendo integralmente as resoluções do CFP e a LGPD.
              </p>
              <div className="space-y-3 pt-2">
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full bg-indigo-500/20 flex items-center justify-center">
                    <span className="text-indigo-400 text-xs font-bold">✓</span>
                  </div>
                  <span className="text-sm font-medium text-slate-200">Total conformidade com o CFP</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full bg-indigo-500/20 flex items-center justify-center">
                    <span className="text-indigo-400 text-xs font-bold">✓</span>
                  </div>
                  <span className="text-sm font-medium text-slate-200">Criptografia em repouso e em trânsito</span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-5 w-5 rounded-full bg-indigo-500/20 flex items-center justify-center">
                    <span className="text-indigo-400 text-xs font-bold">✓</span>
                  </div>
                  <span className="text-sm font-medium text-slate-200">Autenticação multifator integrada</span>
                </div>
              </div>
            </div>

            <div className="lg:col-span-5 bg-slate-800/50 border border-slate-700 p-8 rounded-3xl space-y-6">
              <h3 className="font-bold text-xl">Por que escolher o Synapse AI?</h3>
              <div className="space-y-4">
                <div className="flex gap-4">
                  <Clock className="h-8 w-8 text-indigo-400 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-sm">Mais tempo com o paciente</h4>
                    <p className="text-xs text-slate-400 leading-normal">Livre-se da burocracia do consultório e foque no acompanhamento.</p>
                  </div>
                </div>
                <div className="flex gap-4">
                  <TrendingUp className="h-8 w-8 text-indigo-400 flex-shrink-0" />
                  <div>
                    <h4 className="font-semibold text-sm">Crescimento Financeiro</h4>
                    <p className="text-xs text-slate-400 leading-normal">Régua de cobrança automática Asaas que resolve a inadimplência.</p>
                  </div>
                </div>
              </div>
              <Button className="w-full bg-indigo-600 hover:bg-indigo-700 text-white" onClick={() => navigate("/register")}>
                Experimentar Gratuitamente
              </Button>
            </div>
          </div>
        </div>
      </section>

      {/* CTA Section */}
      <section className="py-20 lg:py-28 relative">
        <div className="container mx-auto px-4 text-center max-w-4xl mx-auto space-y-8">
          <h2 className="text-3xl md:text-5xl font-extrabold tracking-tight">
            Pronto para transformar a gestão da sua prática clínica?
          </h2>
          <p className="text-slate-600 dark:text-slate-400 text-base md:text-lg max-w-2xl mx-auto">
            Junte-se a milhares de psicólogos que modernizaram seus consultórios, aumentaram sua produtividade e ofereceram uma experiência premium aos pacientes.
          </p>
          <div className="pt-2">
            <Button size="lg" className="bg-indigo-600 hover:bg-indigo-700 text-white h-14 px-8 text-base shadow-xl shadow-indigo-500/20" onClick={() => navigate("/register")}>
              Começar Teste Grátis de 14 dias
              <ChevronRight className="ml-1 h-5 w-5" />
            </Button>
          </div>
          <div className="text-sm font-medium text-slate-500 dark:text-slate-400">
            Não requer cartão de crédito • Cancele a qualquer momento
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-900 bg-white dark:bg-slate-950 py-12">
        <div className="container mx-auto px-4 flex flex-col md:flex-row items-center justify-between gap-6">
          <div className="flex items-center gap-2">
            <div className="h-8 w-8 rounded-lg bg-indigo-600 flex items-center justify-center">
              <Brain className="h-4.5 w-4.5 text-white" />
            </div>
            <span className="font-bold text-lg tracking-tight bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              Synapse AI
            </span>
          </div>

          <div className="text-xs font-normal text-slate-500 dark:text-slate-400">
            © {new Date().getFullYear()} Synapse AI. Todos os direitos reservados. Em conformidade com as diretrizes do CFP e a LGPD.
          </div>

          <div className="flex items-center gap-6 text-sm font-normal text-slate-500 dark:text-slate-400">
            <Link to="/login" className="hover:text-indigo-600">Entrar</Link>
            <Link to="/register" className="hover:text-indigo-600">Registrar</Link>
          </div>
        </div>
      </footer>
    </div>
  );
}