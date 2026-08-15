import { useMemo, useState } from "react";
import { addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Filter, ListPlus, MapPin, Plus, Video, X } from "lucide-react";
import { motion } from "framer-motion";
import { mockAppointments, type Appointment } from "../../mock/appointments";
import { AppointmentDetailModal } from "../../components/agenda/AppointmentDetailModal";
import { NewAppointmentModal } from "../../components/agenda/NewAppointmentModal";

export default function Agenda() {
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
      <div className="calendar-head"><button className="icon-btn" onClick={() => setDate(new Date())}>Hoje</button><div className="calendar-nav"><button className="icon-btn" onClick={() => move(-1)}><ChevronLeft size={17}/></button><button className="icon-btn" onClick={() => move(1)}><ChevronRight size={17}/></button></div></div>
      <div className={"calendar " + view}>
        {days.map(day => <div className="day-column" key={day.toISOString()}>
          <div className={"day-label " + (isSameDay(day, new Date()) ? "today" : "")}><span>{format(day, "EEE", {locale: ptBR}).slice(0,3).toUpperCase()}</span><strong>{format(day, "dd")}</strong></div>
          <div className="day-body">{filtered.filter(a => isSameDay(a.start, day)).map(a => <button key={a.id} className={"appointment " + a.status} onClick={() => setSelected(a)}><span>{format(a.start, "HH:mm")}</span><strong>{a.patientName}</strong><small>{a.type === "online" ? <><Video size={11}/> Online</> : <><MapPin size={11}/> Presencial</>}</small></button>)}{[9,10,11,12,13,14,15,16,17].map(hour => <div className="slot" key={hour}><span>{hour}:00</span></div>)}</div>
        </div>)}
      </div>
      {waitlist && <motion.aside initial={{x:20, opacity:0}} animate={{x:0, opacity:1}} className="waitlist"><div><strong>Lista de espera</strong><button className="icon-btn" onClick={() => setWaitlist(false)}><X size={15}/></button></div><p>2 pessoas aguardando encaixe.</p><div className="wait-person"><span>LR</span><div><strong>Larissa Ribeiro</strong><small>Preferência: manhã</small></div></div><div className="wait-person"><span>PS</span><div><strong>Pedro Souza</strong><small>Preferência: tarde</small></div></div></motion.aside>}
    </div>
    {selected && <AppointmentDetailModal appointment={selected} onClose={() => setSelected(null)} onUpdate={a => {setAppointments(prev => prev.map(x => x.id === a.id ? a : x)); setSelected(a)}} />}
    {newModal && <NewAppointmentModal onClose={() => setNewModal(false)} onCreate={a => {setAppointments(prev => [...prev, a]); setNewModal(false);}} date={date} />}
  </section>;
}
