import { Link, useNavigate } from "react-router-dom";
import { motion } from "framer-motion";
import { Mail, MapPin, Phone, ArrowUpRight } from "lucide-react";
import { Logo } from "@/components/ui/Logo";

export const Footer = () => {
  const navigate = useNavigate();
  const currentYear = new Date().getFullYear();

  const footerLinks = {
    produto: [
      { label: "Plataforma", path: "/#produto" },
      { label: "NeuroFinance", path: "/neurofinance" },
      { label: "NeuroBox", path: "/neurobox" },
      { label: "NeuroZap", path: "/neurozap-para-psicologos" },
      { label: "Synapse AI", path: "/synapse" },
    ],
    operacao: [
      { label: "Teleconsulta", path: "/teleconsulta-para-psicologos" },
      { label: "Pacientes", path: "/pacientes-para-psicologos" },
      { label: "Portal do Paciente", path: "/portal-do-paciente" },
      { label: "Prontuario", path: "/prontuario-para-psicologos" },
      { label: "Agenda", path: "/agenda-para-psicologos" },
    ],
    recursos: [
      { label: "Central de Ajuda", path: "/ajuda" },
      { label: "Contato", path: "/contato" },
    ],
    legal: [
      { label: "Termos de Uso", path: "/termos-de-uso" },
      { label: "Privacidade", path: "/politica-de-privacidade" },
      { label: "Cookies", path: "/configuracoes-de-cookies" },
    ],
  };

  return (
    <footer className="relative overflow-hidden bg-background pb-16 pt-32 font-sans">
      <div className="absolute left-1/2 top-0 h-px w-full max-w-7xl -translate-x-1/2 bg-gradient-to-r from-transparent via-border/50 to-transparent" />
      <div className="container relative z-10">
        <div className="mb-24 grid grid-cols-1 gap-12 md:grid-cols-2 lg:grid-cols-7 lg:gap-8">
          <div className="space-y-8 lg:col-span-2">
            <motion.button type="button" whileHover={{ scale: 1.02 }} whileTap={{ scale: 0.98 }} className="flex items-center" onClick={() => navigate("/")}>
              <Logo className="h-8 w-8" />
              <span className="ml-3 text-sm font-black uppercase tracking-[0.4em]">NeuroNex</span>
            </motion.button>
            <p className="max-w-xs text-sm leading-relaxed text-muted-foreground/70">Sistema operacional para psicólogos: gestão clínica, inteligência contextual e financeiro conectado.</p>
          </div>

          {[{ title: "Produto", links: footerLinks.produto }, { title: "Operacao", links: footerLinks.operacao }, { title: "Recursos", links: footerLinks.recursos }, { title: "Jurídico", links: footerLinks.legal }].map((section) => (
            <div key={section.title} className="space-y-6 lg:col-span-1">
              <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/40">{section.title}</h4>
              <ul className="space-y-4">
                {section.links.map((link) => (
                  <li key={link.path}><Link to={link.path} className="group inline-flex items-center text-sm text-muted-foreground transition-colors hover:text-foreground">{link.label}<ArrowUpRight className="ml-1 h-3 w-3 opacity-0 transition group-hover:opacity-100" /></Link></li>
                ))}
              </ul>
            </div>
          ))}

          <div className="space-y-6 lg:col-span-1">
            <h4 className="text-[10px] font-black uppercase tracking-[0.3em] text-foreground/40">Contato</h4>
            <div className="space-y-4 text-sm text-muted-foreground">
              <a href="mailto:contato@neuronexai.com.br" className="flex items-center gap-3 hover:text-foreground"><Mail size={14} /> contato@neuronexai.com.br</a>
              <a href="tel:+5547988730611" className="flex items-center gap-3 hover:text-foreground"><Phone size={14} /> +55 (47) 98873-0611</a>
              <div className="flex items-start gap-3 leading-relaxed"><MapPin size={14} className="mt-1 shrink-0" /><span>Thera Faria Lima, 215 - Pinheiros, São Paulo - SP</span></div>
            </div>
          </div>
        </div>

        <div className="flex flex-col items-center justify-between gap-6 border-t border-border/50 pt-12 md:flex-row">
          <p className="text-[11px] font-medium tracking-wider text-muted-foreground/50">{currentYear} © NEURONEX AI LTDA. TODOS OS DIREITOS RESERVADOS.</p>
          <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/45">Brasil</span>
        </div>
      </div>
    </footer>
  );
};
