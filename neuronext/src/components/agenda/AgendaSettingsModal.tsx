import { useState } from "react";
import { CalendarRange, Clock, RotateCcw, Save, Settings, X } from "lucide-react";
import { motion } from "framer-motion";

export function AgendaSettingsModal({ onClose }: { onClose: () => void }) {
  const [slot, setSlot] = useState("50");
  const [weekStarts, setWeekStarts] = useState("monday");
  const [buffer, setBuffer] = useState("10");

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <motion.div initial={{ opacity: 0, y: 10, scale: .98 }} animate={{ opacity: 1, y: 0, scale: 1 }} className="modal settings-modal" onMouseDown={(event) => event.stopPropagation()}>
        <div className="modal-head">
          <div><span className="eyebrow">Preferências da agenda</span><h2>Configurações</h2></div>
          <button className="icon-btn" onClick={onClose} aria-label="Fechar"><X size={17} /></button>
        </div>
        <div className="settings-section">
          <div className="settings-title"><CalendarRange size={15} /><div><strong>Visualização</strong><small>Preferências usadas pelo calendário Desktop.</small></div></div>
          <label>Início da semana<select value={weekStarts} onChange={(e) => setWeekStarts(e.target.value)}><option value="monday">Segunda-feira</option><option value="sunday">Domingo</option></select></label>
          <div className="form-row"><label><Clock size={12} /> Duração padrão<input value={slot} onChange={(e) => setSlot(e.target.value)} inputMode="numeric" /></label><label>Intervalo<input value={buffer} onChange={(e) => setBuffer(e.target.value)} inputMode="numeric" /></label></div>
        </div>
        <div className="settings-note"><RotateCcw size={14} /><span>Esta configuração é local no laboratório. Nenhuma preferência é enviada ao NeuroNex real.</span></div>
        <div className="modal-actions"><button className="soft-btn" onClick={onClose}>Cancelar</button><button className="primary-btn" onClick={onClose}><Save size={15} /> Salvar</button></div>
      </motion.div>
    </div>
  );
}
