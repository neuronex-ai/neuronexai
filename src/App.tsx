import { Routes, Route, Navigate, HashRouter, BrowserRouter, useLocation, useNavigate } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SessionContextProvider } from "@/components/auth/SessionContextProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PatientProtectedRoute } from "@/components/auth/PatientProtectedRoute";
import { AIProvider } from "@/context/AIContext";
import { SynapseProvider } from "@/context/SynapseProvider";
import { SubscriptionProvider } from "@/context/SubscriptionContext";
import { SubscriptionRouteGuard } from "@/components/subscription/SubscriptionRouteGuard";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { TourProvider } from "@/components/onboarding/TourContext";
import { GlobalTourOverlay } from "@/components/onboarding/GlobalTourOverlay";
import { TrialExpiredUpsell } from "@/components/subscription/TrialExpiredUpsell";
import { CookieConsent } from "@/components/landing/CookieConsent";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { NeuroFinancePostOnboardingGate } from "@/components/financeiro/NeuroFinancePostOnboardingGate";
import { getElectronAPI, isElectron } from "@/lib/electron";
import { ElectronTitleBar } from "@/components/electron/ElectronTitleBar";
import { ElectronUpdateManager } from "@/components/electron/ElectronUpdateManager";
import { useEffect, lazy, Suspense, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import "@/styles/neurofinance-onboarding-overrides.css";
import "@/styles/neurofinance-onboarding-mobile.css";

// [SWARM] Auditado pelo Agente 2 — Todos os imports estão em uso.

// Pages
const Index = lazy(() => import("@/pages/Index"));

import AuthPage from "./pages/auth/AuthPage";
import EmailConfirmedPage from "./pages/auth/EmailConfirmedPage";
import ResetPasswordPage from "./pages/auth/ResetPasswordPage";
import CreateAccount from "./pages/auth/CreateAccount";
import AccountCreated from "./pages/auth/AccountCreated";
import InitialSettings from "./pages/auth/InitialSettings";
import GoogleConnectionSuccess from "./pages/auth/GoogleConnectionSuccess";
import ConfirmAppointment from "./pages/ConfirmAppointment";
import JoinSession from "./pages/JoinSession";
import PaymentCallback from "./pages/PaymentCallback";
import NotFound from "./pages/public/NotFound";

// Lazy Loaded Internal Pages (Optimized)
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Agenda = lazy(() => import("@/pages/Agenda"));
const Pacientes = lazy(() => import("@/pages/patients-view"));
const PatientDetail = lazy(() => import("@/pages/patients-view/PatientDetail"));
const Notes = lazy(() => import("@/pages/Notes"));
const Financeiro = lazy(() => import("@/pages/Financeiro"));

import Ajustes from "./pages/Ajustes";
const AIChat = lazy(() => import("./pages/AIChat"));
const Teleconsulta = lazy(() => import("./pages/Teleconsulta"));
const PatientPortal = lazy(() => import("./pages/PatientPortal"));
const PatientPortalInvite = lazy(() => import("./pages/PatientPortalInvite"));
const PatientPortalActivate = lazy(() => import("./pages/PatientPortalActivate"));
const PwaIntent = lazy(() => import("./pages/PwaIntent"));
const NeuroZap = lazy(() => import("./pages/desktop/NeuroZap"));
const LegacyTeleconsulta = lazy(() => import("./pages/legacy/LegacyTeleconsulta"));
const LegacyMobileNotes = lazy(() => import("./pages/legacy/LegacyMobileNotes"));

// Lazy Loaded Public Pages (web only - excluded from main bundle) - REMOVED FOR LEAN MVP
const HelpCenter = lazy(() => import("@/pages/public/HelpCenter"));

// Desktop Help (Electron only - Lazy loaded)
const DesktopHelpCenter = lazy(() => import("./pages/desktop/DesktopHelpCenter"));
const AnamnesisPublic = lazy(() => import("./pages/public/AnamnesisPublic"));
const SynapseGlobalShell = lazy(() => import("@/components/synapse/SynapseGlobalShell").then(m => ({ default: m.SynapseGlobalShell })));

const queryClient = new QueryClient();

// ─── Loading State ────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="h-screen w-full flex items-center justify-center bg-background">
    <div className="relative">
      <div className="absolute inset-0 bg-foreground/10 blur-2xl animate-pulse rounded-full" />
      <Loader2 className="h-8 w-8 animate-spin text-foreground/20 relative z-10" />
    </div>
  </div>
);

const PaidRoute = ({ children }: { children: ReactNode }) => (
  <ProtectedRoute>
    <SubscriptionRouteGuard>{children}</SubscriptionRouteGuard>
  </ProtectedRoute>
);

const SynapseShellGate = () => {
  const location = useLocation();
  const isPatientSurface = location.pathname.startsWith("/portal") || location.pathname.startsWith("/join/");
  if (isPatientSurface) return null;

  return <SynapseGlobalShell />;
};

// ─── Electron body offset for custom title bar ────────────────────────
const ElectronBodyOffset = () => {
  useEffect(() => {
    if (isElectron()) {
      document.body.style.paddingTop = '32px';
    }
    return () => {
      document.body.style.paddingTop = '';
    };
  }, []);
  return null;
};

const ElectronNavigationBridge = () => {
  const navigate = useNavigate();

  useEffect(() => {
    if (!isElectron()) return;
    const api = getElectronAPI();
    if (!api) return;
    api.onNavigate((path) => navigate(path || "/dashboard"));
    return () => api.removeAllListeners("app:navigate");
  }, [navigate]);

  return null;
};

// ─── Shared Routes (available in both web and Electron) ───────────────
const SharedRoutes = () => {
  const electronMode = isElectron();

  return (
    <Suspense fallback={<PageLoader />}>
      <Routes>
        {/* ─── Root Route ─────────────────────────────────── */}
        <Route path="/" element={<Index />} />

        {/* ─── Auth Routes ────────────────────────────────── */}
        <Route path="/auth" element={<AuthPage />} />
        <Route path="/portal/acesso" element={<Navigate to="/portal/ativar" replace />} />
        <Route path="/portal/login" element={<Navigate to="/portal/ativar" replace />} />
        <Route path="/email-confirmed" element={<EmailConfirmedPage />} />
        <Route path="/reset-password" element={<ResetPasswordPage />} />
        <Route path="/create-account" element={<CreateAccount />} />
        <Route path="/account-created" element={<AccountCreated />} />
        <Route path="/google-connection-success" element={<GoogleConnectionSuccess />} />

        {/* ─── Semi-Public Routes ─────────────────────────── */}
        <Route path="/confirmar-agendamento/:token" element={<ConfirmAppointment />} />
        <Route path="/join/:appointmentId" element={<JoinSession />} />
        <Route path="/payment/callback" element={<PaymentCallback />} />
        <Route path="/anamnese-externa/:id" element={<AnamnesisPublic />} />

        {/* ─── Public Pages (web only) ────────────────────── */}
        {!electronMode && (
          <>
            <Route path="/help" element={<HelpCenter />} />
          </>
        )}

        {/* ─── Desktop Help (Electron only) ───────────────── */}
        {electronMode && (
          <Route path="/help" element={<ProtectedRoute><DesktopHelpCenter /></ProtectedRoute>} />
        )}

        {/* ─── Protected Professional Routes ──────────────── */}
        <Route path="/synapse-ai" element={<PaidRoute><AIChat /></PaidRoute>} />
        <Route path="/initial-settings" element={<ProtectedRoute isFullScreen><InitialSettings /></ProtectedRoute>} />
        <Route path="/pwa-intent" element={<ProtectedRoute isFullScreen><PwaIntent /></ProtectedRoute>} />

        <Route path="/dashboard" element={<PaidRoute><Dashboard /></PaidRoute>} />
        <Route path="/agenda" element={<PaidRoute><Agenda /></PaidRoute>} />
        <Route path="/pacientes" element={<PaidRoute><Pacientes /></PaidRoute>} />
        <Route path="/pacientes/:id" element={<PaidRoute><PatientDetail /></PaidRoute>} />
        <Route path="/notas" element={<PaidRoute><Notes /></PaidRoute>} />
        <Route path="/financeiro/*" element={<PaidRoute><Financeiro /></PaidRoute>} />

        <Route path="/ajustes" element={<ProtectedRoute><Ajustes /></ProtectedRoute>} />
        <Route path="/teleconsulta" element={<PaidRoute><Teleconsulta /></PaidRoute>} />
        <Route path="/neurozap" element={<PaidRoute><NeuroZap /></PaidRoute>} />
        <Route path="/teleconsulta-antiga" element={<PaidRoute><LegacyTeleconsulta /></PaidRoute>} />
        <Route path="/notas-mobile-antiga" element={<PaidRoute><LegacyMobileNotes /></PaidRoute>} />

        {/* ─── Patient Portal Routes (Web Only) ──────────────────────── */}
        {!electronMode && (
          <>
            <Route path="/portal/convite" element={<PatientPortalInvite />} />
            <Route path="/portal/convite/:token" element={<PatientPortalInvite />} />
            <Route path="/portal/ativar" element={<PatientPortalActivate />} />
            <Route path="/portal/*" element={<PatientProtectedRoute><PatientPortal /></PatientProtectedRoute>} />
          </>
        )}

        {/* ─── Fallback ───────────────────────────────────── */}
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
      </Routes>
    </Suspense>
  );
};

function App() {
  const electronMode = isElectron();
  const Router = electronMode ? HashRouter : BrowserRouter;

  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <SessionContextProvider>
          <Router>
            <ScrollToTop />
            <AIProvider>
              <SynapseProvider>
                <SubscriptionProvider>
                  <TourProvider>
                    <TooltipProvider>
                      {/* Electron-only components */}
                      {electronMode && <ElectronTitleBar />}
                      {electronMode && <ElectronBodyOffset />}
                      {electronMode && <ElectronUpdateManager />}
                      {electronMode && <ElectronNavigationBridge />}

                      <NeuroFinancePostOnboardingGate />

                      {/* Synapse Global Shell — Desktop only (browser + Electron), gated by SynapseProvider.isVisible */}
                      <Suspense fallback={null}>
                        <SynapseShellGate />
                      </Suspense>

                      <SharedRoutes />
                      <GlobalTourOverlay />
                      <TrialExpiredUpsell />

                      <Toaster position="top-right" />

                      {/* CookieConsent only on web */}
                      {!electronMode && <CookieConsent />}
                    </TooltipProvider>
                  </TourProvider>
                </SubscriptionProvider>
              </SynapseProvider>
            </AIProvider>
          </Router>
        </SessionContextProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
