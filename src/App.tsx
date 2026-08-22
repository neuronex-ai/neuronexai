import { Routes, Route, Navigate, BrowserRouter, useLocation } from "react-router-dom";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { TooltipProvider } from "@/components/ui/tooltip";
import { Toaster } from "@/components/ui/sonner";
import { SessionContextProvider } from "@/components/auth/SessionProvider";
import { ProtectedRoute } from "@/components/auth/ProtectedRoute";
import { PatientProtectedRoute } from "@/components/auth/PatientProtectedRoute";
import { AIProvider } from "@/context/AIProvider";
import { SynapseProvider } from "@/context/SynapseProvider";
import { SubscriptionProvider } from "@/context/SubscriptionProvider";
import { SubscriptionRouteGuard } from "@/components/subscription/SubscriptionRouteGuard";
import { ThemeProvider } from "@/components/theme/theme-provider";
import { TourProvider } from "@/components/onboarding/TourProvider";
import { GlobalTourOverlay } from "@/components/onboarding/GlobalTourOverlay";
import { TrialExpiredUpsell } from "@/components/subscription/TrialExpiredUpsell";
import { CookieConsent } from "@/components/landing/CookieConsent";
import { ScrollToTop } from "@/components/layout/ScrollToTop";
import { NeuroFinancePostOnboardingGate } from "@/components/financeiro/NeuroFinancePostOnboardingGate";
import { SynapseVoiceActionOverlays } from "@/components/synapse/SynapseVoiceActionOverlays";
import { lazy, Suspense, ReactNode } from "react";
import { Loader2 } from "lucide-react";
import { RouteRecoveryBoundary } from "@/components/errors/RouteRecoveryBoundary";
import { MotionConfig } from "framer-motion";
import { PublicSeoManager } from "@/components/public/PublicSeoManager";
import { routeUsesOperationalProviders } from "@/lib/application-surface";
import "@/styles/neurofinance-onboarding-overrides.css";
import "@/styles/neurofinance-onboarding-mobile.css";

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

// Public pages are loaded only when their route opens.
const HelpCenter = lazy(() => import("@/pages/public/HelpCenter"));
const Contact = lazy(() => import("@/pages/public/Contact"));
const Legal = lazy(() => import("@/pages/legal/Legal"));
const TermosDeUso = lazy(() => import("@/pages/legal/TermosDeUso"));
const PoliticaDePrivacidade = lazy(() => import("@/pages/legal/PoliticaDePrivacidade"));
const ConfiguracoesDeCookies = lazy(() => import("@/pages/legal/ConfiguracoesDeCookies"));
const FinanceLanding = lazy(() => import("@/pages/FinanceLanding"));
const SynapseLanding = lazy(() => import("@/pages/SynapseLanding"));
const NeuroBoxLanding = lazy(() => import("@/pages/public/NeuroBoxLanding"));
const NeuroZapLanding = lazy(() => import("@/pages/public/NeuroZapLanding"));
const PatientOperationsLanding = lazy(() => import("@/pages/public/PatientOperationsLanding"));
const TeleconsultaLanding = lazy(() => import("@/pages/public/TeleconsultaLanding"));
const AgendaLanding = lazy(() => import("@/pages/public/AgendaLanding"));
const PatientPortalLanding = lazy(() => import("@/pages/public/PatientPortalLanding"));
const ProductLanding = lazy(() => import("@/pages/public/ProductLanding"));
const BlogIndex = lazy(() => import("@/pages/public/BlogIndex"));
const BlogArticle = lazy(() => import("@/pages/public/BlogArticle"));
const DownloadLanding = lazy(() => import("@/pages/public/DownloadLanding"));
const UpdatesLanding = lazy(() => import("@/pages/public/UpdatesLanding"));
const ComparisonIndex = lazy(() => import("@/pages/public/ComparisonIndex"));
const ComparisonLanding = lazy(() => import("@/pages/public/ComparisonLanding"));
const NeuralCastLanding = lazy(() => import("@/pages/public/NeuralCastLanding"));
const NeuralCastNewsletter = lazy(() => import("@/pages/public/NeuralCastNewsletter"));

const AnamnesisPublic = lazy(() => import("./pages/public/AnamnesisPublic"));
const PublicProfessionalProfile = lazy(() => import("./pages/public/PublicProfessionalProfile"));
const WaitlistOfferResponse = lazy(() => import("./pages/public/WaitlistOfferResponse"));
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
    location.pathname.startsWith("/confirmar-agendamento/") ||
    location.pathname.startsWith("/join/") ||
    location.pathname.startsWith("/id/");
  if (isFocusedPublicSurface) return null;

  return <SynapseGlobalShell />;
};

const legacyHelpDestinations: Record<string, string> = {
  neurofinance: "/neurofinance",
  synapse: "/synapse",
  contact: "/contato",
  legal: "/documentos-legais",
  terms: "/termos-de-uso",
  privacy: "/politica-de-privacidade",
  cookies: "/configuracoes-de-cookies",
};

const LegacyHelpRedirect = () => {
  const location = useLocation();
  const view = new URLSearchParams(location.search).get("view") || "";
  return <Navigate to={legacyHelpDestinations[view] || "/ajuda"} replace />;
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
        <Route path="/lista-de-espera/oferta" element={<WaitlistOfferResponse />} />

        {/* ─── Public Pages ───────────────────────────────── */}
        <Route path="/ajuda" element={<HelpCenter />} />
        <Route path="/contato" element={<Contact />} />
        <Route path="/documentos-legais" element={<Legal />} />
        <Route path="/termos-de-uso" element={<TermosDeUso />} />
        <Route path="/politica-de-privacidade" element={<PoliticaDePrivacidade />} />
        <Route path="/configuracoes-de-cookies" element={<ConfiguracoesDeCookies />} />
        <Route path="/neurofinance" element={<FinanceLanding />} />
        <Route path="/synapse" element={<SynapseLanding />} />
        <Route path="/neuralcast" element={<NeuralCastLanding />} />
        <Route path="/neuralcast/newsletter" element={<NeuralCastNewsletter />} />
        <Route path="/neuralcast/newsletter/:slug" element={<NeuralCastNewsletter />} />
        <Route path="/neurobox" element={<NeuroBoxLanding />} />
        <Route path="/neurozap-para-psicologos" element={<NeuroZapLanding />} />
        <Route path="/pacientes-para-psicologos" element={<PatientOperationsLanding />} />
        <Route path="/produto" element={<ProductLanding route="/produto" />} />
        <Route path="/download" element={<DownloadLanding />} />
        <Route path="/gestao-financeira-para-psicologos" element={<ProductLanding route="/gestao-financeira-para-psicologos" />} />
        <Route path="/seguranca-e-etica" element={<ProductLanding route="/seguranca-e-etica" />} />
        <Route path="/blog" element={<BlogIndex />} />
        <Route path="/blog/:slug" element={<BlogArticle />} />
        <Route path="/novidades" element={<UpdatesLanding />} />
        <Route path="/comparar" element={<ComparisonIndex />} />
        <Route path="/comparar/:slug" element={<ComparisonLanding />} />
        <Route path="/portal-do-paciente" element={<PatientPortalLanding />} />
        <Route path="/teleconsulta-para-psicologos" element={<TeleconsultaLanding />} />
        <Route path="/prontuario-para-psicologos" element={<ProductLanding route="/prontuario-para-psicologos" />} />
        <Route path="/agenda-para-psicologos" element={<AgendaLanding />} />

        {/* Compatibilidade: URLs antigas migram para páginas públicas canônicas. */}
        <Route path="/help" element={<LegacyHelpRedirect />} />
        <Route path="/contact" element={<Navigate to="/contato" replace />} />
        <Route path="/legal" element={<Navigate to="/documentos-legais" replace />} />
        <Route path="/neurobank" element={<Navigate to="/neurofinance" replace />} />
        <Route path="/funcionalidades" element={<Navigate to="/produto" replace />} />
        <Route path="/precos" element={<Navigate to="/download" replace />} />
        <Route path="/pricing" element={<Navigate to="/download" replace />} />

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
        <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </RouteRecoveryBoundary>
  );
};

const OperationalApplication = () => (
  <AIProvider>
    <SynapseProvider>
      <SynapseVoiceActionOverlays />
      <SubscriptionProvider>
        <TourProvider>
          <NeuroFinancePostOnboardingGate />
          <Suspense fallback={null}>
            <SynapseShellGate />
          </Suspense>
          <SharedRoutes />
          <GlobalTourOverlay />
          <TrialExpiredUpsell />
        </TourProvider>
      </SubscriptionProvider>
    </SynapseProvider>
  </AIProvider>
);

const ApplicationSurfaceGate = () => {
  const { pathname } = useLocation();

  return routeUsesOperationalProviders(pathname) ? <OperationalApplication /> : <SharedRoutes />;
};

function App() {
  return (
    <MotionConfig reducedMotion="user">
      <QueryClientProvider client={queryClient}>
        <ThemeProvider attribute="class" defaultTheme="dark" enableSystem>
          <BrowserRouter>
            <SessionContextProvider>
              <PublicSeoManager />
              <ScrollToTop />
              <TooltipProvider>
                <ApplicationSurfaceGate />
                <Toaster position="top-right" />
                <CookieConsent />
              </TooltipProvider>
            </SessionContextProvider>
          </BrowserRouter>
        </ThemeProvider>
      </QueryClientProvider>
    </MotionConfig>
  );
}

export default App;
