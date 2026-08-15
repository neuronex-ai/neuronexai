import { useState } from "react";
import { Mic, Moon, Search, Sparkles, Sun, X } from "lucide-react";
import { useTheme } from "next-themes";
import { useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";
import Agenda from "./pages/agenda/Agenda";

const nav = [
  ["/", "Painel"],
  ["/agenda", "Agenda"],
  ["/teleconsulta", "Teleconsulta"],
  ["/pacientes", "Pacientes"],
  ["/notas", "Notas"],
  ["/financeiro", "Financeiro"],
] as const;

function Shell({ children }: { children: React.ReactNode }) {
  const navigate = useNavigate();
  const location = useLocation();
  const { theme, setTheme } = useTheme();
  const [synapseOpen, setSynapseOpen] = useState(false);

  return <div className="app-shell">
    <div className="lumen lumen-a" /><div className="lumen lumen-b" />
    <header className="navbar" id="navbar-container">
      <div className="brand" onClick={() => navigate("/")}><div className="brand-mark">N</div><span>NeuroNex</span></div>
      <nav>{nav.map(([path, label]) => <button key={path} className={location.pathname === path || (path !== "/" && location.pathname.startsWith(path)) ? "active" : ""} onClick={() => navigate(path)}>{label}</button>)}</nav>
      <div className="nav-actions">
        <button className="icon-btn" aria-label="Buscar"><Search size={17} /></button>
        <button className="icon-btn" aria-label="Notificações"><span className="dot" /></button>
        <button className="avatar">JC</button>
        <button className="icon-btn" aria-label="Alternar tema" onClick={() => setTheme(theme === "dark" ? "light" : "dark")}>{theme === "dark" ? <Sun size={17}/> : <Moon size={17}/>}</button>
      </div>
    </header>
    <main className="content-offset">{children}</main>
    <SynapsePill open={synapseOpen} onOpenChange={setSynapseOpen} />
  </div>;
}

function SynapsePill({ open, onOpenChange }: { open: boolean; onOpenChange: (v: boolean) => void }) {
  return <div className="synapse-wrap">
    <AnimatePresence>{open && <motion.div initial={{ opacity: 0, y: 12, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: .97 }} className="synapse-mini">
      <div><Sparkles size={15}/><strong>Synapse</strong><button onClick={() => onOpenChange(false)}><X size={14}/></button></div>
      <p>Converse com sua clínica por texto ou voz.</p>
      <div className="synapse-input"><span>Como posso ajudar?</span><Mic size={16}/></div>
    </motion.div>}</AnimatePresence>
    <button className="synapse-pill" onClick={() => onOpenChange(!open)}><span className="synapse-orb"><Sparkles size={16}/></span><span>Converse com sua clínica</span><Mic size={15}/></button>
  </div>;
}

function PagePlaceholder({ title }: { title: string }) { return <section className="placeholder"><div><Sparkles size={22}/><h1>{title}</h1><p>Superfície reservada para a próxima etapa da importação fiel do Desktop.</p></div></section>; }

export default function App() {
  const path = window.location.pathname;
  let page: React.ReactNode = <PagePlaceholder title="Painel"/>;
  if (path.startsWith("/agenda")) page = <Agenda/>;
  else if (path.startsWith("/teleconsulta")) page = <PagePlaceholder title="Teleconsulta"/>;
  else if (path.startsWith("/pacientes")) page = <PagePlaceholder title="Pacientes"/>;
  else if (path.startsWith("/notas")) page = <PagePlaceholder title="Notas"/>;
  else if (path.startsWith("/financeiro")) page = <PagePlaceholder title="Financeiro"/>;
  return <Shell>{page}</Shell>;
}
