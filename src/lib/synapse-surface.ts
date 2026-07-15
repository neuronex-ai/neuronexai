const PROFESSIONAL_DESKTOP_SHELL_ROUTE_ROOTS = [
  "/dashboard",
  "/agenda",
  "/pacientes",
  "/notas",
  "/financeiro",
  "/ajustes",
  "/teleconsulta",
  "/neurozap",
] as const;

export const routeSupportsDesktopSynapseShell = (pathname: string) =>
  PROFESSIONAL_DESKTOP_SHELL_ROUTE_ROOTS.some(
    (routeRoot) => pathname === routeRoot || pathname.startsWith(`${routeRoot}/`),
  );
