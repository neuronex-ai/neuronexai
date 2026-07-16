import { supabase } from '@/integrations/supabase/client';
import { isCancelledAppointmentStatus } from '@/lib/appointment-status';
import { addDays, addMinutes, endOfDay, isBefore, isSameDay, setHours, setMinutes, startOfDay } from 'date-fns';
import { useCallback, useState } from 'react';

interface WorkHours {
  start: number;
  end: number;
}

interface SearchParams {
  startDate: Date;
  daysToScan: number;
  durationMinutes: number;
  period: 'morning' | 'afternoon' | 'all';
  userId: string;
  workDays?: number[]; // 0 = Sunday, 1 = Monday, etc. Default: [1, 2, 3, 4, 5] (Mon-Fri)
  workHours?: WorkHours; // Default: 8-19
}

export interface AvailableSlot {
  start: Date;
  end: Date;
}

export const useSmartAvailability = () => {
  const [isSearching, setIsSearching] = useState(false);
  const [slots, setSlots] = useState<AvailableSlot[]>([]);

  const findSlots = useCallback(async ({
    startDate,
    daysToScan,
    durationMinutes,
    period,
    userId,
    workDays = [1, 2, 3, 4, 5], // Default to Mon-Fri
    workHours = { start: 8, end: 19 } // Default to 8am-7pm
  }: SearchParams) => {
    setIsSearching(true);
    setSlots([]);

    try {
      const endDate = addDays(startDate, daysToScan);

      // 1. Buscar todos os agendamentos no intervalo
      const { data: appointments, error } = await supabase
        .from('appointments')
        .select('start_time, end_time, status, notes')
        .eq('user_id', userId)
        .eq('visibility_status', 'visible')
        .is('archived_at', null)
        .gte('start_time', startOfDay(startDate).toISOString())
        .lte('end_time', endOfDay(endDate).toISOString());

      if (error) throw error;

      const visibleAppointments = (appointments || []).filter((appointment) =>
        !isCancelledAppointmentStatus(appointment.status, appointment.notes)
      );
      const foundSlots: AvailableSlot[] = [];

      // 2. Iterar pelos dias
      for (let i = 0; i < daysToScan; i++) {
        const currentDay = addDays(startDate, i);

        // Pular dias fora da configuração de trabalho
        const dayOfWeek = currentDay.getDay();
        if (!workDays.includes(dayOfWeek)) continue;

        // Definir limites do dia baseado no período e configuração
        let startHour = workHours.start;
        let endHour = workHours.end;

        if (period === 'morning') endHour = 12;
        if (period === 'afternoon') startHour = 13;

        let scanTime = setMinutes(setHours(currentDay, startHour), 0);
        const dayLimit = setMinutes(setHours(currentDay, endHour), 0);

        // 3. Escanear o dia em incrementos de 30 min
        while (isBefore(addMinutes(scanTime, durationMinutes), dayLimit) || isSameDay(scanTime, dayLimit)) {
          const potentialEnd = addMinutes(scanTime, durationMinutes);

          // Verificar conflito
          const hasConflict = visibleAppointments.some(apt => {
            const aptStart = new Date(apt.start_time);
            const aptEnd = new Date(apt.end_time);

            // Lógica de sobreposição: (StartA < EndB) and (EndA > StartB)
            return (scanTime < aptEnd && potentialEnd > aptStart);
          });

          if (!hasConflict) {
            foundSlots.push({ start: new Date(scanTime), end: potentialEnd });
            // Se achou um slot, pula a duração dele para não sugerir horários sobrepostos (ex: 14:00 e 14:30 para uma consulta de 1h)
            // scanTime = potentialEnd;
            // Ou, avançamos apenas 30min para dar mais opções de início? Vamos avançar 30min.
            scanTime = addMinutes(scanTime, 30);
          } else {
            // Se tem conflito, avança 30 min
            scanTime = addMinutes(scanTime, 30);
          }

          if (foundSlots.length >= 15) break; // Limite de sugestões
        }
      }

      setSlots(foundSlots);
    } catch (error) {
      console.error("Erro ao buscar disponibilidade:", error);
    } finally {
      setIsSearching(false);
    }
  }, []);

  return { findSlots, slots, isSearching };
};
