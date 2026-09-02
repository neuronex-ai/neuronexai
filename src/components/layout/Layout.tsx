"use client";

import React from "react";
import { Navbar } from "./Navbar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";
import { DesktopLumenBackdrop } from "@/components/ui/DesktopLumenBackdrop";
import { useGoogleCalendarSync } from "@/hooks/use-google-calendar-sync";

interface LayoutProps {
  children: React.ReactNode;
}

const DesktopGoogleCalendarSync = () => {
  useGoogleCalendarSync();
  return null;
};

export const Layout = ({ children }: LayoutProps) => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const hasFullBleedDesktopShell =
    !isMobile &&
    (location.pathname === "/dashboard" ||
      location.pathname === "/neurozap" ||
      location.pathname.startsWith("/financeiro") ||
      location.pathname.startsWith("/pacientes") ||
      location.pathname.startsWith("/agenda") ||
      location.pathname.startsWith("/teleconsulta") ||
      location.pathname.startsWith("/ajustes") ||
      location.pathname.startsWith("/notas"));
  const shouldSyncGoogleCalendar =
    !isMobile &&
    (location.pathname === "/dashboard" || location.pathname.startsWith("/agenda"));

  return (
    <div className={cn(
      "min-h-screen flex flex-col relative bg-background text-foreground"
    )}
      data-neuronex-surface={!isMobile ? "professional-desktop" : undefined}
    >
      {/* Camada global de canvas: todas as telas desktop devem revelar a mesma base. */}
      {!isMobile ? (
        <DesktopLumenBackdrop
          className={cn(
            location.pathname.startsWith("/agenda") && "desktop-lumen-field--agenda",
            location.pathname.startsWith("/pacientes") && "desktop-lumen-field--patients",
            location.pathname.startsWith("/teleconsulta") && "desktop-lumen-field--teleconsultation",
          )}
        />
      ) : null}
      {shouldSyncGoogleCalendar ? <DesktopGoogleCalendarSync /> : null}

      {!isMobile && <Navbar />}
      <main className={cn(
        "relative z-10 flex-1",
        !isMobile && !hasFullBleedDesktopShell && "pt-20 pb-12",
        !isMobile && hasFullBleedDesktopShell && "pb-0",
        isMobile && "pt-0",
      )}>
        {children}
      </main>
    </div>
  );
};

export default Layout;
