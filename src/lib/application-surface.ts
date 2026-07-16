export const OPERATIONAL_ROUTE_ROOTS = [
  "/auth",
  "/portal",
  "/email-confirmed",
  "/reset-password",
  "/create-account",
  "/account-created",
  "/google-connection-success",
  "/join",
  "/payment",
  "/anamnese-externa",
  "/synapse-ai",
  "/initial-settings",
  "/pwa-intent",
  "/dashboard",
  "/agenda",
  "/pacientes",
  "/notas",
  "/financeiro",
  "/ajustes",
  "/teleconsulta",
  "/neurozap",
] as const;

export const routeUsesOperationalProviders = (pathname: string) =>
  OPERATIONAL_ROUTE_ROOTS.some(
    (routeRoot) => pathname === routeRoot || pathname.startsWith(`${routeRoot}/`),
  );
