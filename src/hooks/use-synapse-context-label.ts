import { useMemo } from 'react';

import { useAI } from '@/context/AIContext';
import { usePatientById } from '@/hooks/use-patient-by-id';

const FALLBACK_LABELS: Record<string, string> = {
  dashboard: 'Hoje',
  'patient-profile': 'Paciente',
  patients: 'Pacientes',
  calendar: 'Agenda · Hoje',
  finance: 'Financeiro',
  session: 'Teleconsulta',
  notes: 'Notas',
  synapse: 'Synapse',
};

export const useSynapseContextLabel = () => {
  const { currentContext, activePatientId } = useAI();
  const { data: patient } = usePatientById(activePatientId || '');

  return useMemo(() => {
    if (currentContext === 'patient-profile' && patient?.name) {
      return patient.name.trim().split(/\s+/)[0] || 'Paciente';
    }

    return FALLBACK_LABELS[currentContext] || 'Contexto atual';
  }, [currentContext, patient?.name]);
};
