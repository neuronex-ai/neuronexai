import { useState } from "react";
import { mockAppointments, type Appointment } from "../../mock/appointments";
import { CalendarView, type AgendaView } from "../../components/agenda/CalendarView";

export default function Agenda() {
  const [date, setDate] = useState(new Date());
  const [view, setView] = useState<AgendaView>("weekly");
  const [appointments, setAppointments] = useState<Appointment[]>(mockAppointments);

  return (
    <section className="agenda-page">
      <div className="agenda-frame">
        <CalendarView
          date={date}
          onDateChange={setDate}
          appointments={appointments}
          allAppointments={appointments}
          view={view}
          onViewChange={setView}
          onAppointmentsChange={setAppointments}
        />
      </div>
    </section>
  );
}
