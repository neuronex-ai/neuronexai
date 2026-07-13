import { Component, type ErrorInfo, type ReactNode } from "react";
import { AlertTriangle, ArrowLeft, RotateCcw } from "lucide-react";
import { useLocation, useNavigate } from "react-router-dom";

import { Button } from "@/components/ui/button";

type BoundaryProps = {
  children: ReactNode;
  resetKey: string;
  onBackToDashboard: () => void;
};

type BoundaryState = {
  error: Error | null;
};

class RouteRecoveryBoundaryInner extends Component<BoundaryProps, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[RouteRecoveryBoundary] Falha ao renderizar a área atual", error, info);
  }

  componentDidUpdate(previousProps: BoundaryProps) {
    if (previousProps.resetKey !== this.props.resetKey && this.state.error) {
      this.setState({ error: null });
    }
  }

  private retry = () => {
    this.setState({ error: null });
  };

  render() {
    if (!this.state.error) return this.props.children;

    return (
      <main className="flex min-h-[100dvh] w-full items-center justify-center bg-transparent px-5 py-24">
        <section
          className="w-full max-w-[520px] rounded-[28px] border border-border/60 bg-card/95 p-6 text-center shadow-2xl backdrop-blur-xl dark:border-white/[0.08] dark:bg-[linear-gradient(145deg,rgba(24,24,25,0.98),rgba(9,9,10,0.98))]"
          role="alert"
          aria-labelledby="route-recovery-title"
        >
          <span className="mx-auto flex h-12 w-12 items-center justify-center rounded-[16px] border border-border/60 bg-muted/60 text-muted-foreground dark:border-white/[0.08] dark:bg-white/[0.045]">
            <AlertTriangle className="h-5 w-5" aria-hidden="true" />
          </span>
          <h1 id="route-recovery-title" className="mt-5 text-xl font-semibold tracking-[-0.025em] text-foreground">
            Esta área encontrou um imprevisto
          </h1>
          <p className="mx-auto mt-2 max-w-[420px] text-sm leading-6 text-muted-foreground">
            Seu trabalho continua preservado. Tente abrir a área novamente ou volte ao Dashboard.
          </p>
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-center">
            <Button variant="outline" className="min-h-11 rounded-[14px]" onClick={this.props.onBackToDashboard}>
              <ArrowLeft className="mr-2 h-4 w-4" aria-hidden="true" />
              Voltar ao Dashboard
            </Button>
            <Button className="min-h-11 rounded-[14px]" onClick={this.retry}>
              <RotateCcw className="mr-2 h-4 w-4" aria-hidden="true" />
              Tentar novamente
            </Button>
          </div>
        </section>
      </main>
    );
  }
}

export const RouteRecoveryBoundary = ({ children }: { children: ReactNode }) => {
  const location = useLocation();
  const navigate = useNavigate();
  const resetKey = `${location.pathname}${location.search}${location.hash}`;

  return (
    <RouteRecoveryBoundaryInner resetKey={resetKey} onBackToDashboard={() => navigate("/dashboard", { replace: true })}>
      {children}
    </RouteRecoveryBoundaryInner>
  );
};
