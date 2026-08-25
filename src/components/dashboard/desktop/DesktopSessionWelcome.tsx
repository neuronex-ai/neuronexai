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
  getDailyDesktopWelcomeIndex,
  getDailyDesktopWelcomeMessage,
} from "@/lib/desktop-session-welcome";

import { DESKTOP_WELCOME_ARTWORK } from "./desktop-session-welcome-artwork";

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
  const resolvedArtwork = useMemo(
    () => user
      ? DESKTOP_WELCOME_ARTWORK[getDailyDesktopWelcomeIndex({ userId: user.id })]
      : DESKTOP_WELCOME_ARTWORK[0],
    [user],
  );
  const [visibleArtwork, setVisibleArtwork] = useState(resolvedArtwork);

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
    setVisibleArtwork(resolvedArtwork);
    setVisible(true);
  }, [isMobile, resolvedArtwork, resolvedMessage, user]);

  useEffect(() => {
    if (isMobile) dismiss();
  }, [dismiss, isMobile]);

  useEffect(() => {
    if (!visible) return;
    setVisibleMessage(resolvedMessage);
    setVisibleArtwork(resolvedArtwork);
  }, [resolvedArtwork, resolvedMessage, visible]);

  useEffect(() => {
    if (!visible) return;

    dismissTimer.current = window.setTimeout(
      dismiss,
      shouldReduceMotion ? 1_100 : 4_300,
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
          aria-live="polite"
          tabIndex={-1}
          data-neuronex-desktop-login-welcome
          initial={shouldReduceMotion ? false : { opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={shouldReduceMotion ? { opacity: 0 } : { opacity: 0, scale: 1.008 }}
          transition={{ duration: shouldReduceMotion ? 0.12 : 0.38, ease: [0.22, 1, 0.36, 1] }}
          className="fixed inset-0 z-[2147483500] flex min-h-dvh items-center justify-center overflow-hidden bg-background/88 px-6 text-foreground backdrop-blur-[44px] outline-none"
        >
          <div className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_at_50%_42%,hsl(var(--foreground)/0.075),transparent_46%),radial-gradient(ellipse_at_50%_100%,hsl(var(--foreground)/0.03),transparent_64%)]" />
          <motion.div
            initial={shouldReduceMotion ? false : { opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: shouldReduceMotion ? 0 : 0.48, ease: [0.22, 1, 0.36, 1] }}
            className="relative flex w-full max-w-5xl flex-col items-center text-center"
          >
            <span id="desktop-welcome-message" className="sr-only">
              {visibleMessage}
            </span>
            <motion.div
              aria-hidden="true"
              initial={shouldReduceMotion
                ? false
                : { opacity: 0, clipPath: "inset(0 100% 0 0)", scale: 0.992 }}
              animate={{ opacity: 1, clipPath: "inset(0 0% 0 0)", scale: 1 }}
              transition={shouldReduceMotion
                ? { duration: 0 }
                : { duration: 1.9, ease: [0.65, 0, 0.35, 1] }}
              className="w-full max-w-[47.75rem] overflow-hidden"
            >
              <img
                src={visibleArtwork}
                alt=""
                draggable={false}
                className="block h-auto w-full select-none object-contain brightness-0 drop-shadow-[0_12px_34px_rgba(0,0,0,0.16)] dark:brightness-100 dark:drop-shadow-[0_12px_34px_rgba(255,255,255,0.08)]"
              />
            </motion.div>

            <Button
              type="button"
              variant="ghost"
              onClick={dismiss}
              className="mt-9 h-11 rounded-full border border-foreground/[0.08] bg-background/28 px-5 text-xs font-semibold text-muted-foreground backdrop-blur-xl hover:bg-foreground/[0.055] hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring"
            >
              Continuar
            </Button>
          </motion.div>
        </motion.section>
      ) : null}
    </AnimatePresence>,
    document.body,
  );
};
