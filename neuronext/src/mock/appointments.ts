export type Appointment = {
  id: string;
  patientName: string;
  type: "presencial" | "online";
  start: Date;
  end: Date;
  status: "confirmed" | "pending" | "completed" | "cancelled";
  notes?: string;
};

const today = new Date();
const at = (dayOffset: number, hour: number, minute = 0) => {
  const value = new Date(today);
  value.setDate(today.getDate() + dayOffset);
  value.setHours(hour, minute, 0, 0);
  return value;
};

export const mockAppointments: Appointment[] = [
  { id: "apt-001", patientName: "Mariana Costa", type: "online", start: at(0, 9), end: at(0, 9, 50), status: "confirmed", notes: "Sessão de acompanhamento" },
  { id: "apt-002", patientName: "João Henrique", type: "presencial", start: at(0, 10, 30), end: at(0, 11, 20), status: "confirmed" },
  { id: "apt-003", patientName: "Ana Beatriz", type: "online", start: at(0, 14), end: at(0, 14, 50), status: "pending" },
  { id: "apt-004", patientName: "Carlos Eduardo", type: "presencial", start: at(0, 16), end: at(0, 16, 50), status: "confirmed" },
  { id: "apt-005", patientName: "Fernanda Alves", type: "online", start: at(1, 8, 30), end: at(1, 9, 20), status: "confirmed" },
  { id: "apt-006", patientName: "Lucas Martins", type: "presencial", start: at(1, 11), end: at(1, 11, 50), status: "completed" },
  { id: "apt-007", patientName: "Beatriz Rocha", type: "online", start: at(2, 15), end: at(2, 15, 50), status: "confirmed" },
  { id: "apt-008", patientName: "Rafael Lima", type: "presencial", start: at(-1, 17), end: at(-1, 17, 50), status: "completed" },
];
