"use client";

import type { CSSProperties } from "react";
import { useEffect, useMemo, useState } from "react";

import { getDailyRotationIndex } from "@/components/ui/reflection-carousel-rotation";
import { cn } from "@/lib/utils";

import fontChunk1 from "./font-chunks/hello-script-1";
import fontChunk2 from "./font-chunks/hello-script-2";
import fontChunk3 from "./font-chunks/hello-script-3";
import fontChunk4 from "./font-chunks/hello-script-4";
import fontChunk5 from "./font-chunks/hello-script-5";
import fontChunk6 from "./font-chunks/hello-script-6";
import fontChunk7 from "./font-chunks/hello-script-7";

const HELLO_SCRIPT_FAMILY = "NeuroNex Hello Script";
const HELLO_SCRIPT_SOURCE = `url(data:font/woff2;base64,${[
  fontChunk1,
  fontChunk2,
  fontChunk3,
  fontChunk4,
  fontChunk5,
  fontChunk6,
  fontChunk7,
].join("")}) format("woff2")`;

const SHORT_GREETING_TEMPLATES = [
  "bom te ver, {nome}",
  "tudo certo, {nome}",
  "vamos começar, {nome}",
  "estou aqui, {nome}",
  "conte comigo, {nome}",
  "ao que importa, {nome}",
] as const;

const normalizeFirstName = (firstName: string) => {
  const firstToken = firstName.trim().split(/\s+/u)[0] || "você";
  return firstToken.toLocaleLowerCase("pt-BR");
};

const resolveGreeting = (today: Date, firstName: string) => {
  const index = getDailyRotationIndex(today, SHORT_GREETING_TEMPLATES.length);
  const template = SHORT_GREETING_TEMPLATES[index] ?? SHORT_GREETING_TEMPLATES[0];
  return template.replace("{nome}", normalizeFirstName(firstName));
};

type ShortHandwritingGreetingProps = {
  firstName?: string;
  today?: Date;
  text?: string;
  className?: string;
};

export const ShortHandwritingGreeting = ({
  firstName = "você",
  today = new Date(),
  text,
  className,
}: ShortHandwritingGreetingProps) => {
  const [fontReady, setFontReady] = useState(false);
  const phrase = useMemo(
    () => text?.trim() || resolveGreeting(today, firstName),
    [firstName, text, today],
  );

  useEffect(() => {
    let cancelled = false;

    const ensureFont = async () => {
      if (typeof document === "undefined" || typeof FontFace === "undefined") {
        if (!cancelled) setFontReady(true);
        return;
      }

      try {
        const fontAlreadyAvailable = document.fonts.check(
          `1em "${HELLO_SCRIPT_FAMILY}"`,
        );

        if (!fontAlreadyAvailable) {
          const font = new FontFace(HELLO_SCRIPT_FAMILY, HELLO_SCRIPT_SOURCE, {
            style: "normal",
            weight: "400",
            display: "block",
          });
          const loadedFont = await font.load();
          document.fonts.add(loadedFont);
        }

        await document.fonts.load(`1em "${HELLO_SCRIPT_FAMILY}"`);
      } catch {
        // Keep a cursive fallback available if the embedded face cannot load.
      }

      if (!cancelled) setFontReady(true);
    };

    void ensureFont();
    return () => {
      cancelled = true;
    };
  }, []);

  const durationMs = Math.min(1900, Math.max(1100, 720 + phrase.length * 42));
  const fontSize =
    phrase.length > 28
      ? "clamp(2.6rem, 4.25vw, 4.65rem)"
      : "clamp(2.9rem, 4.8vw, 5.15rem)";

  const handwritingStyle = {
    fontFamily: `"${HELLO_SCRIPT_FAMILY}", cursive`,
    fontSize,
    fontWeight: 400,
    fontSynthesis: "none",
    lineHeight: 1.02,
    letterSpacing: "0.005em",
  } satisfies CSSProperties;

  return (
    <h1
      className={cn("mt-1 w-full overflow-visible", className)}
      data-neuronex-handwriting-message
    >
      <style>{`
        @keyframes neuronex-short-handwriting-write {
          0% {
            clip-path: inset(0 100% 0 0);
            filter: blur(0.35px);
            opacity: 0.92;
          }
          12% { opacity: 1; }
          100% {
            clip-path: inset(0 0 0 0);
            filter: blur(0);
            opacity: 1;
          }
        }
      `}</style>

      <span className="sr-only">{phrase}</span>
      <span
        aria-hidden="true"
        className="relative inline-block max-w-full align-top text-current"
        style={handwritingStyle}
      >
        <span className="invisible block whitespace-nowrap px-[0.035em]">
          {phrase}
        </span>
        <span
          className="absolute inset-0 block whitespace-nowrap px-[0.035em]"
          style={
            fontReady
              ? {
                  clipPath: "inset(0 100% 0 0)",
                  animation: `neuronex-short-handwriting-write ${durationMs}ms cubic-bezier(0.22, 0.62, 0.2, 1) 120ms forwards`,
                  willChange: "clip-path",
                }
              : {
                  clipPath: "inset(0 100% 0 0)",
                }
          }
        >
          {phrase}
        </span>
      </span>
    </h1>
  );
};

export default ShortHandwritingGreeting;
