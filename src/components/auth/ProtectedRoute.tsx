import { SessionAssuranceOverlay } from '@/components/runtime/SessionAssuranceOverlay';
import { UserPreferencesRuntime } from '@/components/runtime/UserPreferencesRuntime';
import { isPatientAccount } from '@/lib/auth-account-role';
import { ReactNode } from 'react';
import { Navigate } from 'react-router-dom';
import { Layout } from '../layout/Layout';
import { WelcomeTourModal } from '../layout/WelcomeTourModal';
import { useAuth } from './SessionContextProvider';

interface ProtectedRouteProps { children: ReactNode; isFullScreen?: boolean; }

const ProfessionalRouteContent = ({ children, isFullScreen = false }: ProtectedRouteProps) => {
  const content = <><UserPreferencesRuntime /><SessionAssuranceOverlay />{!isFullScreen && <WelcomeTourModal />}{children}</>;
  return isFullScreen ? content : <Layout>{content}</Layout>;
};

export const ProtectedRoute = ({ children, isFullScreen = false }: ProtectedRouteProps) => {
  const { user, isLoading } = useAuth();
  if (isLoading) return null;
  if (!user) return <Navigate to="/auth" replace />;
  if (isPatientAccount(user)) return <Navigate to="/portal" replace />;
  return <ProfessionalRouteContent isFullScreen={isFullScreen}>{children}</ProfessionalRouteContent>;
};
