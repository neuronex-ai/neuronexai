"use client";

import React from "react";
import { Navbar } from "./Navbar";
import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { useLocation } from "react-router-dom";
import { DesktopLumenBackdrop } from "@/components/ui/DesktopLumenBackdrop";

interface LayoutProps {
  children: React.ReactNode;
}

export const Layout = ({ children }: LayoutProps) => {
  const isMobile = useIsMobile();
  const location = useLocation();
  const hasFullBleedDesktopShell =
    !isMobile &&
    (location.pathname === "/dashboard" ||
      location.pathname === "/neurozap" ||
      location.pathname.startsWith("/financeiro") ||
      location.pathname.startsWith("/pacientes") ||
      location.pathname.startsWith("/teleconsulta") ||
      location.pathname.startsWith("/ajustes") ||
      location.pathname.startsWith("/notas"));

  return (
    <div className={cn(
      "min-h-screen flex flex-col relative bg-background text-foreground"
    )}>
      {/* Camada global de canvas: todas as telas desktop devem revelar a mesma base. */}
      {!isMobile ? <DesktopLumenBackdrop /> : null}

      {!isMobile && <Navbar />}
      <main className={cn(
        "flex-1 transition-all duration-300 relative z-10",
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
