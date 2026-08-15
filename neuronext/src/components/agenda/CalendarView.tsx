import { addDays, addMonths, addWeeks, eachDayOfInterval, endOfMonth, endOfWeek, format, isSameDay, startOfMonth, startOfWeek } from "date-fns";
import { ptBR } from "date-fns/locale";
import { ChevronLeft, ChevronRight, Clock3, Filter, ListPlus, MapPin, Plus, Settings, Video, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import type { Appointment } from "../../mock/appointments";
import { AppointmentDetailModal } from "./AppointmentDetailModal";
import { AgendaSettingsModal } from "./AgendaSettingsModal";

export type AgendaView = "daily" | "weekly" | "monthly";

type Props = {
  date: Date;
  onDateChange: (date: Date) => void;
  appointments: Appointment[];
  allAppointments?: Appointment[];
  view: AgendaView;
  onViewChange: (view: AgendaView) => void;
  onAppointmentsChange: (appointments: Appointment[]) => void;
};

const hours = Array.from({ length: 12 }, (_, i) => i + 8);

export function CalendarView({ date, onDateChange, appointments, allAppointments = appointments, view, onViewChange, onAppointmentsChange }: Props) {
  const [selected, setSelected] = useState<Appointment | null>(null);
  const [waitlistOpen, setWaitlistOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [filter, setFilter] = useState<"all" | "online" | "presencial">("all");
  const [newOpen, setNewOpen] = useState(false);

  const days = view === "daily"
    ? [date]
    : view === "weekly"
      ? eachDayOfInterval({ start: startOfWeek(date, { weekStartsOn: 1 }), end: endOfWeek(date, { weekStartsOn: 1 }) })
      : eachDayOfInterval({ start: startOfWeek(startOfMonth(date), { weekStartsOn: 1 }), end: endOfWeek(endOfMonth(date), { weekStartsOn: 1 }) });

  const visibleAppointments = appointments.filter((a) => filter === "all" || a.type === filter);
  const move = (direction: number) => onDateChange(view === "daily" ? addDays(date, direction) : view === "weekly" ? addWeeks(date, direction) : addMonths(date, direction));
  const title = view === "daily"
    ? format(date, "EEEE, dd 'de' MMMM", { locale: ptBR })
    : view === "weekly"
      ? `${format(days[0], "dd MMM", { locale: ptBR })} — ${format(days[days.length - 1], "dd MMM yyyy", { locale: ptBR })}`
      : format(date, "MMMM yyyy", { locale: ptBR });

  const createAppointment = (appointment: Appointment) => {
    onAppointmentsChange([...allAppointments, appointment]);
    setNewOpen(false);
  };

  return (
    <div className="calendar-view">
      <header className="agenda-toolbar">
        <div className="toolbar-title">
          <h1>Agenda</h1>
          <span>{title}</span>
        </div>
        <div className="toolbar-actions">
          <div className="segmented" role="tablist" aria-label="Visualização da agenda">
            {(["daily", "weekly", "monthly"] as AgendaView[]).map((item) => (
              <button key={item} className={view === item ? "selected" : ""} onClick={() => onViewChange(item)}>
                {item === "daily" ? "Dia" : item === "weekly" ? "Semana" : "Mês"}
              </button>
            ))}
          </div>
          <button className="soft-btn" onClick={() => setFilter(filter === "all" ? "online" : filter === "online" ? "presencial" : "all")}><Filter size={15} /> Filtros</button>
          <button className="soft-btn" onClick={() => setWaitlistOpen((v) => !v)}><ListPlus size={15} /> Lista de espera</button>
          <button className="icon-btn" aria-label="Configurações da agenda" onClick={() => setSettingsOpen(true)}><Settings size={16} /></button>
          <button className="primary-btn" onClick={() => setNewOpen(true)}><Plus size={16} /> Agendar</button>
        </div>
      </header>

      <div className="calendar-head">
        <button className="icon-btn today-button" onClick={() => onDateChange(new Date())}>Hoje</button>
        <div className="calendar-nav">
          <button className="icon-btn" onClick={() => move(-1)} aria-label="Anterior"><ChevronLeft size={17} /></button>
          <button className="icon-btn" onClick={() => move(1)} aria-label="Próximo"><ChevronRight size={17} /></button>
        </div>
      </div>

      <div className={`calendar ${view}`}>
        {days.map((day) => {
          const dayAppointments = visibleAppointments.filter((a) => isSameDay(a.start, day));
          return (
            <div className="day-column" key={day.toISOString()}>
              <div className={`day-label ${isSameDay(day, new Date()) ? "today" : ""}`}>
                <span>{format(day, "EEE", { locale: ptBR }).replace(".", "").slice(0, 3).toUpperCase()}</span>
                <strong>{format(day, "dd")}</strong>
              </div>
              <div className="day-body">
                {hours.map((hour) => <div className="slot" key={hour}><span>{String(hour).padStart(2, "0")}:00</span></div>)}
                {dayAppointments.map((appointment) => {
                  const top = Math.max(4, ((appointment.start.getHours() + appointment.start.getMinutes() / 60) - 8) * 64 + 2);
                  const height = Math.max(58, ((appointment.end.getTime() - appointment.start.getTime()) / 3600000) * 64 - 4);
                  return (
                    <button key={appointment.id} className={`appointment ${appointment.status}`} style={{ top, minHeight: height }} onClick={() => setSelected(appointment)}>
                      <span>{format(appointment.start, "HH:mm")} — {format(appointment.end, "HH:mm")}</span>
                      <strong>{appointment.patientName}</strong>
                      <small>{appointment.type === "online" ? <><Video size={11} /> Online</> : <><MapPin size={11} /> Presencial</>}</small>
                    </button>
                  );
                })}
              </div>
            </div>
          );
        })}
      </div>

      <AnimatePresence>
        {waitlistOpen && (
          <>
            <motion.button className="waitlist-dismiss" aria-label="Fechar lista de espera" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setWaitlistOpen(false)} />
            <motion.aside className="waitlist" initial={{ opacity: 0, x: 20, scale: .985 }} animate={{ opacity: 1, x: 0, scale: 1 }} exit={{ opacity: 0, x: 20 }}>
              <div><strong>Lista de espera</strong><button className="icon-btn" onClick={() => setWaitlistOpen(false)}><X size={15} /></button></div>
              <p>2 pessoas aguardando encaixe.</p>
              <div className="wait-person"><span>LR</span><div><strong>Larissa Ribeiro</strong><small>Preferência: manhã</small></div></div>
              <div className="wait-person"><span>PS</span><div><strong>Pedro Souza</strong><small>Preferência: tarde</small></div></div>
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {selected && <AppointmentDetailModal appointment={selected} onClose={() => setSelected(null)} onUpdate={(updated) => { onAppointmentsChange(allAppointments.map((item) => item.id === updated.id ? updated : item)); setSelected(updated); }} />}
      {newOpen && <NewAppointmentModal date={date} onClose={() => setNewOpen(false)} onCreate={createAppointment} />}
      {settingsOpen && <AgendaSettingsModal onClose={() => setSettingsOpen(false)} />}
    </div>
  );
}

import { useState } from "react";
