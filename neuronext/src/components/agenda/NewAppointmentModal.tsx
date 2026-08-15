import { useState } from "react";
import { Plus, X } from "lucide-react";
import { motion } from "framer-motion";
import { format } from "date-fns";
import type { Appointment } from "../../mock/appointments";

export function NewAppointmentModal({ onClose, onCreate, date }: { onClose: () => void; onCreate: (a: Appointment) => void; date: Date }) {
  const [name, setName] = useState(""); const [time, setTime] = useState("18:00"); const [type, setType] = useState<Appointment["type"]>("online");
  return <div className="modal-backdrop" onMouseDown={onClose}><motion.div initial={{opacity:0,y:10,scale:.98}} animate={{opacity:1,y:0,scale:1}} className="modal" onMouseDown={e => e.stopPropagation()}><div className="modal-head"><div><span className="eyebrow">Novo agendamento</span><h2>Agendar atendimento</h2></div><button className="icon-btn" onClick={onClose}><X size={17}/></button></div><label>Paciente<input autoFocus value={name} onChange={e => setName(e.target.value)} placeholder="Nome do paciente" /></label><div className="form-row"><label>Data<input type="date" value={format(date,"yyyy-MM-dd")} readOnly /></label><label>Horário<input type="time" value={time} onChange={e => setTime(e.target.value)} /></label></div><label>Modalidade<select value={type} onChange={e => setType(e.target.value as Appointment["type"])}><option value="online">Online</option><option value="presencial">Presencial</option></select></label><div className="modal-actions"><button className="soft-btn" onClick={onClose}>Cancelar</button><button className="primary-btn" disabled={!name.trim()} onClick={() => {const [h,m]=time.split(":").map(Number); const start=new Date(date); start.setHours(h,m,0,0); const end=new Date(start.getTime()+50*60000); onCreate({id:`lab-${Date.now()}`,patientName:name,type,start,end,status:"confirmed"});}}><Plus size={15}/> Criar agendamento</button></div></motion.div></div>;
}
