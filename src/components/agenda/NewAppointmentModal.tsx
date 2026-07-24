"use client";

import React, { useEffect, useState } from "react";
import { X, Calendar, Clock, User, MapPin, DollarSign, FileText, Sparkles } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { toast } from "react-hot-toast";

// Definindo a constante EVENT_CATEGORIES que estava ausente e causando o erro
export const EVENT_CATEGORIES = [
  { id: "presencial", label: "Sessão Presencial", color: "bg-indigo-500", textColor: "text-indigo-500" },
  { id: "online", label: "Sessão Online", color: "bg-emerald-500", textColor: "text-emerald-500" },
  { id: "block", label: "Bloqueio de Agenda", color: "bg-slate-500", textColor: "text-slate-500" }
];

interface NewAppointmentModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  selectedDate?: Date | null;
}

interface Patient {
  id: string;
  name: string;
}

export default function NewAppointmentModal({
  isOpen,
  onClose,
  onSuccess,
  selectedDate
}: NewAppointmentModalProps) {
  const [patients, setPatients] = useState<Patient[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetchingPatients, setFetchingPatients] = useState(false);

  // Form states
  const [patientId, setPatientId] = useState<string>("");
  const [type, setType] = useState<string>("online");
  const [date, setDate] = useState<string>("");
  const [startTime, setStartTime] = useState<string>("09:00");
  const [endTime, setEndTime] = useState<string>("10:00");
  const [notes, setNotes] = useState<string>("");
  const [location, setLocation] = useState<string>("");
  const [price, setPrice] = useState<string>("");

  // Fetch patients on mount/open
  useEffect(() => {
    if (isOpen) {
      fetchPatients();
      if (selectedDate) {
        const formattedDate = selectedDate.toISOString().split("T")[0];
        setDate(formattedDate);
      } else {
        setDate(new Date().toISOString().split("T")[0]);
      }
    }
  }, [isOpen, selectedDate]);

  const fetchPatients = async () => {
    try {
      setFetchingPatients(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("patients")
        .select("id, name")
        .eq("user_id", user.id)
        .order("name", { ascending: true });

      if (error) throw error;
      setPatients(data || []);
    } catch (error: any) {
      console.error("Erro ao buscar pacientes:", error.message);
    } finally {
      setFetchingPatients(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!date || !startTime || !endTime) {
      toast.error("Por favor, preencha a data e os horários.");
      return;
    }

    if (type !== "block" && !patientId) {
      toast.error("Por favor, selecione um paciente para a sessão.");
      return;
    }

    try {
      setLoading(true);
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Usuário não autenticado.");
        return;
      }

      // Combinar data e hora para criar Timestamptz
      const startDateTime = new Date(`${date}T${startTime}:00`).toISOString();
      const endDateTime = new Date(`${date}T${endTime}:00`).toISOString();

      const appointmentData = {
        user_id: user.id,
        patient_id: type === "block" ? null : patientId,
        start_time: startDateTime,
        end_time: endDateTime,
        type: type,
        status: "unscored",
        notes: notes || null,
        location: type === "presencial" ? location : null,
        price: price ? parseFloat(price) : null,
        lifecycle_status: "created",
        action_origin: "professional_app",
        last_actor_type: "psychologist"
      };

      const { error } = await supabase
        .from("appointments")
        .insert([appointmentData]);

      if (error) throw error;

      toast.success("Agendamento criado com sucesso!");
      if (onSuccess) onSuccess();
      onClose();
      resetForm();
    } catch (error: any) {
      toast.error(`Erro ao criar agendamento: ${error.message}`);
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setPatientId("");
    setType("online");
    setNotes("");
    setLocation("");
    setPrice("");
    setStartTime("09:00");
    setEndTime("10:00");
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
      <div className="bg-white dark:bg-slate-900 rounded-2xl border border-slate-200 dark:border-slate-800 w-full max-w-lg shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-2">
            <div className="p-2 bg-indigo-50 dark:bg-indigo-950/50 rounded-lg text-indigo-600 dark:text-indigo-400">
              <Sparkles className="h-5 w-5" />
            </div>
            <h2 className="text-lg font-bold text-slate-900 dark:text-slate-100">
              Novo Compromisso
            </h2>
          </div>
          <button
            onClick={onClose}
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* Tipo de Compromisso */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">
              Tipo de Compromisso
            </label>
            <div className="grid grid-cols-3 gap-2">
              {EVENT_CATEGORIES.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => setType(cat.id)}
                  className={`py-2.5 px-3 rounded-xl border text-xs font-medium transition-all flex flex-col items-center gap-1 ${
                    type === cat.id
                      ? "border-indigo-600 bg-indigo-50/50 dark:bg-indigo-950/30 text-indigo-600 dark:text-indigo-400"
                      : "border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-600 dark:text-slate-400"
                  }`}
                >
                  <span className={`h-2 w-2 rounded-full ${cat.color}`} />
                  {cat.label}
                </button>
              ))}
            </div>
          </div>

          {/* Paciente (Oculto se for bloqueio) */}
          {type !== "block" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <User className="h-3.5 w-3.5" /> Paciente
              </label>
              <select
                value={patientId}
                onChange={(e) => setPatientId(e.target.value)}
                disabled={fetchingPatients}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              >
                <option value="">Selecione um paciente...</option>
                {patients.map((p) => (
                  <option key={p.id} value={p.id}>
                    {p.name}
                  </option>
                ))}
              </select>
            </div>
          )}

          {/* Data e Horários */}
          <div className="grid grid-cols-3 gap-3">
            <div className="space-y-1.5 col-span-1">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Data
              </label>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Início
              </label>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <Clock className="h-3.5 w-3.5" /> Fim
              </label>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          </div>

          {/* Localização (Apenas se for presencial) */}
          {type === "presencial" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <MapPin className="h-3.5 w-3.5" /> Consultório / Sala
              </label>
              <input
                type="text"
                placeholder="Ex: Sala 402, Bloco B"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          )}

          {/* Valor da Sessão (Oculto se for bloqueio) */}
          {type !== "block" && (
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
                <DollarSign className="h-3.5 w-3.5" /> Valor da Sessão (R$)
              </label>
              <input
                type="number"
                placeholder="Ex: 150.00"
                value={price}
                onChange={(e) => setPrice(e.target.value)}
                className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500"
              />
            </div>
          )}

          {/* Observações */}
          <div className="space-y-1.5">
            <label className="text-xs font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1">
              <FileText className="h-3.5 w-3.5" /> Observações / Notas
            </label>
            <textarea
              placeholder="Adicione detalhes importantes sobre este compromisso..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              className="w-full rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50 dark:bg-slate-950 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500/20 focus:border-indigo-500 resize-none"
            />
          </div>

          {/* Actions */}
          <div className="flex items-center justify-end gap-3 pt-4 border-t border-slate-100 dark:border-slate-800">
            <Button
              type="button"
              variant="ghost"
              onClick={onClose}
              disabled={loading}
              className="rounded-xl"
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={loading}
              className="bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl px-5"
            >
              {loading ? "Salvando..." : "Confirmar Agendamento"}
            </Button>
          </div>
        </form>
      </div>
    </div>
  );
}