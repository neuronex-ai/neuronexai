import { Routes, Route, Navigate, BrowserRouter, useLocation } from "react-router-dom";
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
import { lazy, Suspense, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { RouteRecoveryBoundary } from "@/components/errors/RouteRecoveryBoundary";
import "@/styles/neurofinance-onboarding-overrides.css";
import "@/styles/neurofinance-onboarding-mobile.css";

// [SWARM] Auditado pelo Agente 2 — Todos os imports estão em uso.

// Pages
const Index = lazy(() => import("@/pages/Index"));
const AuthPage = lazy(() => import("./pages/auth/AuthPage"));
const EmailConfirmedPage = lazy(() => import("./pages/auth/EmailConfirmedPage"));
const ResetPasswordPage = lazy(() => import("./pages/auth/ResetPasswordPage"));
const CreateAccount = lazy(() => import("./pages/auth/CreateAccount"));
const AccountCreated = lazy(() => import("./pages/auth/AccountCreated"));
const InitialSettings = lazy(() => import("./pages/auth/InitialSettings"));
const GoogleConnectionSuccess = lazy(() => import("./pages/auth/GoogleConnectionSuccess"));
const ConfirmAppointment = lazy(() => import("./pages/ConfirmAppointment"));
const JoinSession = lazy(() => import("./pages/JoinSession"));
const PaymentCallback = lazy(() => import("./pages/PaymentCallback"));
const NotFound = lazy(() => import("./pages/public/NotFound"));

// Lazy Loaded Internal Pages (Optimized)
const Dashboard = lazy(() => import("@/pages/Dashboard"));
const Agenda = lazy(() => import("@/pages/Agenda"));
const Pacientes = lazy(() => import("@/pages/patients-view"));
const PatientDetail = lazy(() => import("@/pages/patients-view/PatientDetail"));
const Notes = lazy(() => import("@/pages/Notes"));
const Financeiro = lazy(() => import("@/pages/Financeiro"));

const Ajustes = lazy(() => import("./pages/Ajustes"));
const AIChat = lazy(() => import("./pages/AIChat"));
const Teleconsulta = lazy(() => import("./pages/Teleconsulta"));
const PatientPortal = lazy(() => import("./pages/PatientPortal"));
const PatientPortalInvite = lazy(() => import("./pages/PatientPortalInvite"));
const PatientPortalActivate = lazy(() => import("./pages/PatientPortalActivate"));
const PwaIntent = lazy(() => import("./pages/PwaIntent"));
const NeuroZap = lazy(() => import("./pages/desktop/NeuroZap"));

// Lazy Loaded Public Pages (web only - excluded from main bundle) - REMOVED FOR LEAN MVP
const HelpCenter = lazy(() => import("@/pages/public/HelpCenter"));

const AnamnesisPublic = lazy(() => import("./pages/public/AnamnesisPublic"));
const PublicProfessionalProfile = lazy(() => import("./pages/public/PublicProfessionalProfile"));
const SynapseGlobalShell = lazy(() => import("@/components/synapse/SynapseGlobalShell").then(m => ({ default: m.SynapseGlobalShell })));

const queryClient = new QueryClient();

// ─── Loading State ────────────────────────────────────────────────────
const PageLoader = () => (
  <div className="flex min-h-[100dvh] w-full items-center justify-center bg-transparent px-6" role="status" aria-live="polite">
    <div className="flex items-center gap-3 rounded-full border border-border/55 bg-card/75 px-4 py-3 shadow-lg backdrop-blur-xl dark:border-white/[0.07] dark:bg-zinc-950/72">
      <Loader2 className="h-4 w-4 animate-spin text-muted-foreground motion-reduce:animate-none" aria-hidden="true" />
      <span className="text-xs font-medium text-muted-foreground">Abrindo área</span>
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
  const isFocusedPublicSurface =
    location.pathname.startsWith("/portal") ||
    location.pathname.startsWith("/join/") ||
    location.pathname.startsWith("/id/");
  if (isFocusedPublicSurface) return null;

  return <SynapseGlobalShell />;
};

// ─── Application routes ──────────────────────────────────────────────
const SharedRoutes = () => {
  return (
    <RouteRecoveryBoundary>
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
        <Route path="/join/:inviteToken" element={<JoinSession />} />
        <Route path="/payment/callback" element={<PaymentCallback />} />
        <Route path="/anamnese-externa/:id" element={<AnamnesisPublic />} />
        <Route path="/id/:profileId" element={<PublicProfessionalProfile />} />

        {/* ─── Public Pages ───────────────────────────────── */}
        <Route path="/help" element={<HelpCenter />} />

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

        {/* ─── Patient Portal Routes ───────────────────────── */}
        <Route path="/portal/convite" element={<PatientPortalInvite />} />
        <Route path="/portal/convite/:token" element={<PatientPortalInvite />} />
        <Route path="/portal/ativar" element={<PatientPortalActivate />} />
        <Route path="/portal/*" element={<PatientProtectedRoute><PatientPortal /></PatientProtectedRoute>} />

        {/* ─── Fallback ───────────────────────────────────── */}
        <Route path="/404" element={<NotFound />} />
        <Route path="*" element={<Navigate to="/auth" replace />} />
        </Routes>
      </Suspense>
    </RouteRecoveryBoundary>
  );
};

function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
        <SessionContextProvider>
          <BrowserRouter>
            <ScrollToTop />
            <AIProvider>
              <SynapseProvider>
                <SubscriptionProvider>
                  <TourProvider>
                    <TooltipProvider>
                      <NeuroFinancePostOnboardingGate />

                      {/* Synapse Global Shell — gated by SynapseProvider.isVisible */}
                      <Suspense fallback={null}>
                        <SynapseShellGate />
                      </Suspense>

                      <SharedRoutes />
                      <GlobalTourOverlay />
                      <TrialExpiredUpsell />

                      <Toaster position="top-right" />

                      <CookieConsent />
                    </TooltipProvider>
                  </TourProvider>
                </SubscriptionProvider>
              </SynapseProvider>
            </AIProvider>
          </BrowserRouter>
        </SessionContextProvider>
      </ThemeProvider>
    </QueryClientProvider>
  );
}

export default App;
