import { useMemo, useState } from "react";
import { CalendarDays, ChevronLeft, ChevronRight, Clock3, Filter, ListPlus, MapPin, Mic, Moon, Plus, Search, Settings2, Sparkles, Sun, Users, Video, X } from "lucide-react";
import { addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, startOfMonth, startOfWeek, subMonths, subWeeks } from "date-fns";
import { ptBR } from "date-fns/locale";
import { useTheme } from "next-themes";
import { useLocation, useNavigate } from "react-router-dom";
import { motion, AnimatePresence } from "framer-motion";
import { mockAppointments, type Appointment } from "./mock/appointments";

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
    <AnimatePresence>
      {open && <motion.div initial={{ opacity: 0, y: 12, scale: .97 }} animate={{ opacity: 1, y: 0, scale: 1 }} exit={{ opacity: 0, y: 12, scale: .97 }} className="synapse-mini">
        <div><Sparkles size={15}/><strong>Synapse</strong><button onClick={() => onOpenChange(false)}><X size={14}/></button></div>
        <p>Converse com sua clínica por texto ou voz.</p>
        <div className="synapse-input"><span>Como posso ajudar?</span><Mic size={16}/></div>
      </motion.div>}
    </AnimatePresence>
    <button className="synapse-pill" onClick={() => onOpenChange(!open)}><span className="synapse-orb"><Sparkles size={16}/></span><span>Converse com sua clínica</span><Mic size={15}/></button>
  </div>;
}

function PagePlaceholder({ title }: { title: string }) { return <section className="placeholder"><div><Sparkles size={22}/><h1>{title}</h1><p>Superfície reservada para a próxima etapa da importação fiel do Desktop.</p></div></section>; }

function Agenda() {
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<"daily"|"weekly"|"monthly">("weekly");
  const [appointments, setAppointments] = useState(mockAppointments);
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [waitlist, setWaitlist] = useState(false);
  const [newModal, setNewModal] = useState(false);
  const [filter, setFilter] = useState<"all"|"online"|"presencial">("all");

  const filtered = useMemo(() => appointments.filter(a => filter === "all" || a.type === filter), [appointments, filter]);
  const days = view === "daily" ? [date] : view === "weekly" ? eachDayOfInterval({ start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) }) : eachDayOfInterval({ start: startOfWeek(startOfMonth(date), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(date), { weekStartsOn: 1 }) });

  const move = (dir: number) => setDate(view === "daily" ? addDays(date, dir) : view === "weekly" ? addWeeks(date, dir) : addMonths(date, dir));
  const title = view === "daily" ? format(date, "EEEE, dd 'de' MMMM", { locale: ptBR }) : view === "weekly" ? `${format(days[0], "dd MMM", {locale: ptBR})} — ${format(days[6], "dd MMM yyyy", {locale: ptBR})}` : format(date, "MMMM yyyy", {locale: ptBR});

  return <section className="agenda-page">
    <div className="agenda-frame">
      <div className="agenda-toolbar">
        <div className="toolbar-title"><h1>Agenda</h1><span>{title}</span></div>
        <div className="toolbar-actions">
          <div className="segmented">{(["daily","weekly","monthly"] as const).map(v => <button className={view === v ? "selected" : ""} key={v} onClick={() => setView(v)}>{v === "daily" ? "Dia" : v === "weekly" ? "Semana" : "Mês"}</button>)}</div>
          <button className="soft-btn" onClick={() => setFilter(filter === "all" ? "online" : filter === "online" ? "presencial" : "all")}><Filter size={15}/> Filtros</button>
          <button className="soft-btn" onClick={() => setWaitlist(!waitlist)}><ListPlus size={15}/> Lista de espera</button>
          <button className="primary-btn" onClick={() => setNewModal(true)}><Plus size={16}/> Agendar</button>
        </div>
      </div>
      <div className="calendar-head">
        <button className="icon-btn" onClick={() => setDate(new Date())}>Hoje</button><div className="calendar-nav"><button className="icon-btn" onClick={() => move(-1)}><ChevronLeft size={17}/></button><button className="icon-btn" onClick={() => move(1)}><ChevronRight size={17}/></button></div>
      </div>
      <div className={"calendar " + view}>
        {days.map(day => <div className="day-column" key={day.toISOString()}>
          <div className={"day-label " + (isSameDay(day, new Date()) ? "today" : "")}><span>{format(day, "EEE", {locale: ptBR}).slice(0,3).toUpperCase()}</span><strong>{format(day, "dd")}</strong></div>
          <div className="day-body">{filtered.filter(a => isSameDay(a.start, day)).map(a => <button key={a.id} className={"appointment " + a.status} onClick={() => setSelected(a)}><span>{format(a.start, "HH:mm")}</span><strong>{a.patientName}</strong><small>{a.type === "online" ? <><Video size={11}/> Online</> : <><MapPin size={11}/> Presencial</>}</small></button>)}{[9,10,11,12,13,14,15,16,17].map(hour => <div className="slot" key={hour}><span>{hour}:00</span></div>)}</div>
        </div>)}
      </div>
      {waitlist && <motion.aside initial={{x:20, opacity:0}} animate={{x:0, opacity:1}} className="waitlist"><div><strong>Lista de espera</strong><button onClick={() => setWaitlist(false)}><X size={15}/></button></div><p>2 pessoas aguardando encaixe.</p><div className="wait-person"><span>LR</span><div><strong>Larissa Ribeiro</strong><small>Preferência: manhã</small></div></div><div className="wait-person"><span>PS</span><div><strong>Pedro Souza</strong><small>Preferência: tarde</small></div></div></motion.aside>}
    </div>
    {selected && <AppointmentModal appointment={selected} onClose={() => setSelected(null)} onUpdate={a => {setAppointments(prev => prev.map(x => x.id === a.id ? a : x)); setSelected(a)}} />}
    {newModal && <NewAppointmentModal onClose={() => setNewModal(false)} onCreate={a => {setAppointments(prev => [...prev, a]); setNewModal(false);}} date={date} />}
  </section>;
}

function AppointmentModal({ appointment, onClose, onUpdate }: { appointment: Appointment; onClose: () => void; onUpdate: (a: Appointment) => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><motion.div initial={{opacity:0,y:10,scale:.98}} animate={{opacity:1,y:0,scale:1}} className="modal" onMouseDown={e => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">Detalhes do atendimento</span><h2>{appointment.patientName}</h2></div><button className="icon-btn" onClick={onClose}><X size={17}/></button></div><div className="detail-grid"><div><Clock3 size={15}/><span>{format(appointment.start, "dd/MM/yyyy · HH:mm")} — {format(appointment.end, "HH:mm")}</span></div><div>{appointment.type === "online" ? <Video size={15}/> : <MapPin size={15}/>}<span>{appointment.type === "online" ? "Teleconsulta" : "Presencial"}</span></div></div><div className="modal-note">{appointment.notes || "Nenhuma observação adicionada."}</div><div className="modal-actions"><button className="soft-btn" onClick={onClose}>Fechar</button><button className="primary-btn" onClick={() => onUpdate({...appointment,status: appointment.status === "confirmed" ? "completed" : "confirmed"})}>{appointment.status === "confirmed" ? "Marcar como concluído" : "Confirmar atendimento"}</button></div></motion.div></div>;
}

function NewAppointmentModal({ onClose, onCreate, date }: { onClose: () => void; onCreate: (a: Appointment) => void; date: Date }) {
  const [name, setName] = useState(""); const [time, setTime] = useState("18:00"); const [type, setType] = useState<Appointment["type"]>("online");
  return <div className="modal-backdrop" onMouseDown={onClose}><motion.div initial={{opacity:0,y:10,scale:.98}} animate={{opacity:1,y:0,scale:1}} className="modal" onMouseDown={e => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">Novo agendamento</span><h2>Agendar atendimento</h2></div><button className="icon-btn" onClick={onClose}><X size={17}/></button></div><label>Paciente<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Nome do paciente" /></label><div className="form-row"><label>Data<input type="date" value={format(date,"yyyy-MM-dd")} readOnly /></label><label>Horário<input type="time" value={time} onChange={e => setTime(e.target.value)} /></label></div><label>Modalidade<select value={type} onChange={e => setType(e.target.value as Appointment["type"])}><option value="online">Online</option><option value="presencial">Presencial</option></select></label><div className="modal-actions"><button className="soft-btn" onClick={onClose}>Cancelar</button><button className="primary-btn" disabled={!name.trim()} onClick={() => {const [h,m]=time.split(":").map(Number); const start=new Date(date); start.setHours(h,m,0,0); const end=new Date(start.getTime()+50*60000); onCreate({id:`lab-${Date.now()}`,patientName:name,type,start,end,status:"confirmed"});}}><Plus size={15}/> Criar agendamento</button></div></motion.div></div>;
}

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
