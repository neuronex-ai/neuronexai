import { motion } from "framer-motion";
import { Clock3, MapPin, Video, X } from "lucide-react";
import { format } from "date-fns";
import type { Appointment } from "../../mock/appointments";

export function AppointmentDetailModal({ appointment, onClose, onUpdate }: { appointment: Appointment; onClose: () => void; onUpdate: (a: Appointment) => void }) {
  return <div className="modal-backdrop" onMouseDown={onClose}><motion.div initial={{opacity:0,y:10,scale:.98}} animate={{opacity:1,y:0,scale:1}} className="modal" onMouseDown={e => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">Detalhes do atendimento</span><h2>{appointment.patientName}</h2></div><button className="icon-btn" onClick={onClose}><X size={17}/></button></div><div className="detail-grid"><div><Clock3 size={15}/><span>{format(appointment.start, "dd/MM/yyyy · HH:mm")} — {format(appointment.end, "HH:mm")}</span></div><div>{appointment.type === "online" ? <Video size={15}/> : <MapPin size={15}/>}<span>{appointment.type === "online" ? "Teleconsulta" : "Presencial"}</span></div></div><div className="modal-note">{appointment.notes || "Nenhuma observação adicionada."}</div><div className="modal-actions"><button className="soft-btn" onClick={onClose}>Fechar</button><button className="primary-btn" onClick={() => onUpdate({...appointment,status: appointment.status === "confirmed" ? "completed" : "confirmed"})}>{appointment.status === "confirmed" ? "Marcar como concluído" : "Confirmar atendimento"}</button></div></motion.div></div>;
}
