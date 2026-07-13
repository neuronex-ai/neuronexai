import type { Appointment } from '@/types';
import { DesktopClinicalSession } from './DesktopClinicalSession';

interface ActiveSessionPanelProps {
  activeAppointment: Appointment;
  patientName: string;
  onSessionEnd: () => void;
  openInviteOnMount?: boolean;
  initialWorkspaceTab?: 'transcript' | 'notes' | 'patient';
}

export const ActiveSessionPanel = (props: ActiveSessionPanelProps) => (
  <DesktopClinicalSession {...props} />
);
