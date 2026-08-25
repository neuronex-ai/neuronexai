"use client";

import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { createPortal } from "react-dom";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { Button } from "@/components/ui/button";
import { useIsMobile } from "@/hooks/use-mobile";
import { useProfile } from "@/hooks/use-profile";
import { isPatientAccount } from "@/lib/auth-account-role";
import {
  claimDesktopWelcomeForEntry,
  getDailyDesktopWelcomeMessage,
} from "@/lib/desktop-session-welcome";

const profileFirstName = (profile?: {
  first_name?: string | null;
  full_name?: string | null;
  name?: string | null;
} | null) =>
  profile?.first_name?.trim()
  || profile?.full_name?.trim().split(/\s+/)[0]
  || profile?.name?.trim().split(/\s+/)[0];

const userFirstName = (user?: { user_metadata?: Record<string, unknown> } | null) => {
  const metadata = user?.user_metadata || {};
  const candidate = [
    metadata.first_name,
    metadata.given_name,
    metadata.name,
    metadata.full_name,
  ].find((value) => typeof value === "string" && value.trim());
  return typeof candidate === "string" ? candidate.trim().split(/\s+/)[0] : "";
};

export const DesktopSessionWelcome = () => {
  const { user } = useAuth();
  const { data: profile } = useProfile();
  const isMobile = useIsMobile();
  const shouldReduceMotion = useReducedMotion();
  const [visible, setVisible] = useState(false);
  const [visibleMessage, setVisibleMessage] = useState("");
  const dismissTimer = useRef<number | null>(null);
  const dialogRef = useRef<HTMLElement | null>(null);
  const presentedEntryRef = useRef<string | null>(null);
  const firstName = profileFirstName(profile)
    || userFirstName(user)
    || user?.email?.split("@")[0]
    || "Profissional";
  const resolvedMessage = useMemo(
    () => user
      ? getDailyDesktopWelcomeMessage({ userId: user.id, firstName })
      : "Bem-vindo de volta.",
    [firstName, user],
  );

  const dismiss = useCallback(() => {
    if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
    dismissTimer.current = null;
    setVisible(false);
  }, []);

  useEffect(() => {
    if (!user || isMobile || isPatientAccount(user)) return;

    let entryId: string | null = null;
    try {
      entryId = claimDesktopWelcomeForEntry(user.id);
    } catch {
      // Session storage can be unavailable in locked-down browser contexts.
      // Still present the welcome once while this component is mounted.
      entryId = `runtime:${user.id}`;
    }

    if (!entryId || presentedEntryRef.current === entryId) return;

    presentedEntryRef.current = entryId;
    setVisibleMessage(resolvedMessage);
    setVisible(true);
  }, [isMobile, resolvedMessage, user]);

  useEffect(() => {
    if (isMobile) dismiss();
  }, [dismiss, isMobile]);

  useEffect(() => {
    if (visible) setVisibleMessage(resolvedMessage);
  }, [resolvedMessage, visible]);

  useEffect(() => {
    if (!visible) return;

    dismissTimer.current = window.setTimeout(
      dismiss,
      shouldReduceMotion ? 1_100 : 3_850,
    );

    return () => {
      if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
      dismissTimer.current = null;
    };
  }, [dismiss, shouldReduceMotion, visible]);

  useEffect(() => {
    if (!visible) return;

    const previousOverflow = document.body.style.overflow;
    const focusTimer = window.setTimeout(() => {
      dialogRef.current?.focus({ preventScroll: true });
    }, 0);
    document.body.style.overflow = "hidden";

    return () => {
      window.clearTimeout(focusTimer);
      document.body.style.overflow = previousOverflow;
    };
  }, [visible]);

  useEffect(() => {
    if (!visible) return;
    const handleKeyDown = (event: KeyboardEvent) => {
      if (["Escape", "Enter", " "].includes(event.key)) {
        event.preventDefault();
        dismiss();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [dismiss, visible]);

  useEffect(() => () => {
    if (dismissTimer.current) window.clearTimeout(dismissTimer.current);
  }, []);

  if (typeof document === "undefined") return null;

  return createPortal(
    <AnimatePresence>
      {visible ? (
        <motion.section
          ref={dialogRef}
          role="dialog"
          aria-modal="true"
          aria-labelledby="desktop-welcome-message"
          tabIndex={-1}
          data-neuronex-desktop-login-welcome
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.008 }}
          transition={{ duration: shouldReduceMotion ? 0.12 : 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[2147483500] flex min-h-dvh items-center justify-center overflow-hidden bg-background px-6 text-foreground outline-none"
        >
          <div className="flex w-full max-w-6xl flex-col items-center text-center">
            <p className="mb-8 text-[10px] font-bold uppercase tracking-[0.24em] text-muted-foreground">
              NeuroNex · seu espaço clínico está pronto
            </p>

            <svg
              viewBox="0 0 1200 250"
              className="h-auto w-full max-w-6xl overflow-visible"
              role="img"
              aria-labelledby="desktop-welcome-message"
            >
              <title id="desktop-welcome-message">{visibleMessage}</title>
              <motion.text
                x="600"
                y="158"
                textAnchor="middle"
                fill="currentColor"
                stroke="currentColor"
                strokeWidth="0.8"
                style={{
                  fontFamily: '"Snell Roundhand", "Apple Chancery", "Segoe Print", "Bradley Hand", cursive',
                  fontSize: visibleMessage.length > 48 ? 62 : visibleMessage.length > 38 ? 70 : 78,
                  fontWeight: 500,
                  letterSpacing: "-0.035em",
                  paintOrder: "stroke fill",
                  strokeDasharray: 1800,
                  strokeLinecap: "round",
                  strokeLinejoin: "round",
                }}
                initial={shouldReduceMotion ? false : { opacity: 0, fillOpacity: 0, strokeDashoffset: 1800 }}
                animate={shouldReduceMotion
                  ? { opacity: 1, fillOpacity: 1, strokeDashoffset: 0 }
                  : { opacity: 1, fillOpacity: [0, 0.08, 1], strokeDashoffset: 0 }}
                transition={shouldReduceMotion
                  ? { duration: 0 }
                  : {
                      duration: 1.65,
                      ease: [0.65, 0, 0.35, 1],
                      fillOpacity: { times: [0, 0.72, 1], duration: 1.65 },
                    }}
              >
                {visibleMessage}
              </motion.text>
            </svg>

            <Button
              type="button"
              variant="ghost"
              onClick={dismiss}
              className="mt-8 h-11 rounded-full px-5 text-xs font-semibold text-muted-foreground hover:bg-foreground/[0.055] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Continuar
            </Button>
          </div>
        </motion.section>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
};
