import { lazy, Suspense, useEffect, useMemo, useState } from 'react';
import { useAppointments } from '@/hooks/use-appointments';
import { UpcomingSessionsPanel } from '@/components/teleconsulta/UpcomingSessionsPanel';
import { ActiveSessionPanel } from '@/components/teleconsulta/ActiveSessionPanel';
import { addMonths, endOfWeek, startOfWeek } from 'date-fns';
import { useQueryClient } from '@tanstack/react-query';
import { useLocation } from 'react-router-dom';
import { useIsMobile } from '@/hooks/use-mobile';
import { FeatureGate, LockedFeatureScreen } from '@/components/subscription';
import { getAppointmentKind } from '@/lib/appointment-metadata';
import { isCancelledAppointmentStatus } from '@/lib/appointment-status';
import { SYNAPSE_PAGE_ACTION_EVENT, type SynapseInterfaceAction } from '@/lib/synapse-interface-actions';

const MobileTeleconsulta = lazy(() =>
  import('@/mobile/pages/MobileTeleconsulta').then((module) => ({
    default: module.MobileTeleconsulta,
  })),
);

const DesktopTeleconsulta = () => {
  const queryClient = useQueryClient();
  const location = useLocation();
  const [activeAppointmentId, setActiveAppointmentId] = useState<string | undefined>(undefined);
  const [inviteRequestedAppointmentId, setInviteRequestedAppointmentId] = useState<string | undefined>(undefined);
  const [workspaceTab, setWorkspaceTab] = useState<'transcript' | 'notes' | 'patient'>('transcript');

  const [dateRange] = useState(() => {
    const start = startOfWeek(new Date(), { weekStartsOn: 1 });
    const end = addMonths(endOfWeek(new Date(), { weekStartsOn: 1 }), 3);
    return { start, end };
  });

  const { data: appointments, isLoading } = useAppointments({
    startDate: dateRange.start,
    endDate: dateRange.end,
  });

  useEffect(() => {
    if (location.state?.activeAppointmentId && appointments) {
      const targetAppointment = appointments.find((appointment) => appointment.id === location.state.activeAppointmentId);
      if (targetAppointment) {
        setActiveAppointmentId(targetAppointment.id);
        if (['transcript', 'notes', 'patient'].includes(location.state?.synapseWorkspaceTab)) {
          setWorkspaceTab(location.state.synapseWorkspaceTab);
        }
        if (location.state?.openInvite) setInviteRequestedAppointmentId(targetAppointment.id);
        window.history.replaceState({}, document.title, location.pathname);
      }
    }
  }, [location.pathname, location.state, appointments]);

  useEffect(() => {
    const handleSynapseAction = (event: Event) => {
      const action = (event as CustomEvent<SynapseInterfaceAction>).detail;
      if (!action?.appointmentId) return;
      if (!['open_teleconsultation_lobby', 'open_patient_invite_modal'].includes(action.action)) return;
      setActiveAppointmentId(action.appointmentId);
      if (action.workspaceTab) setWorkspaceTab(action.workspaceTab);
      if (action.action === 'open_patient_invite_modal') setInviteRequestedAppointmentId(action.appointmentId);
    };
    window.addEventListener(SYNAPSE_PAGE_ACTION_EVENT, handleSynapseAction);
    return () => window.removeEventListener(SYNAPSE_PAGE_ACTION_EVENT, handleSynapseAction);
  }, []);

  const clinicalSessions = useMemo(
    () =>
      (appointments || []).filter((appointment) => {
        if (isCancelledAppointmentStatus(appointment.status, appointment.notes)) return false;
        return getAppointmentKind(appointment) === 'session';
      }),
    [appointments],
  );

  const activeAppointment = clinicalSessions.find((appointment) => appointment.id === activeAppointmentId);
  const upcomingSessions = clinicalSessions.filter((appointment) => appointment.id !== activeAppointmentId);

  const startSession = (appointmentId: string) => {
    setActiveAppointmentId(appointmentId);
  };

  const endSession = () => {
    setActiveAppointmentId(undefined);
    setInviteRequestedAppointmentId(undefined);
    void queryClient.invalidateQueries({ queryKey: ['appointments'] });
  };

  if (activeAppointment) {
    return (
      <div className='desktop-lumen-page teleconsultation-shell teleconsultation-desktop relative h-dvh overflow-hidden bg-transparent'>
        <ActiveSessionPanel
          key={activeAppointment.id}
          activeAppointment={activeAppointment}
          patientName={activeAppointment.patient_name || 'Paciente'}
          onSessionEnd={endSession}
          openInviteOnMount={inviteRequestedAppointmentId === activeAppointment.id}
          initialWorkspaceTab={workspaceTab}
        />
      </div>
    );
  }

  return (
    <div className='desktop-lumen-page desktop-content-offset teleconsultation-shell teleconsultation-desktop relative h-dvh overflow-hidden bg-transparent'>
      <UpcomingSessionsPanel upcomingSessions={upcomingSessions} activeAppointment={activeAppointment} isLoading={isLoading} startSession={startSession} />
    </div>
  );
};

const TeleconsultaCore = () => {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Suspense fallback={<div className='min-h-dvh bg-transparent' aria-busy='true' aria-label='Carregando teleconsulta' />}>
        <MobileTeleconsulta />
      </Suspense>
    );
  }

  return <DesktopTeleconsulta />;
};

const Teleconsulta = () => (
  <FeatureGate
    feature='telemedicine'
    fallback={
      <LockedFeatureScreen
        feature='telemedicine'
        title='Sessões clínicas'
        description='Conduza sessões online ou presenciais com captura consentida, transcrição persistente e integração revisável com o prontuário. Disponível a partir do plano Professional.'
      />
    }
  >
    <TeleconsultaCore />
  </FeatureGate>
);

export default Teleconsulta;
