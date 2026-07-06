"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface TextRevealProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}

export const TextReveal = ({ children, className, stagger = 0.05, delay = 0 }: TextRevealProps) => {
  if (typeof children !== "string") {
    return <span className={className}>{children}</span>;
  }

  const words = children.split(" ");

  return (
    <span className={className}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden pb-3 align-bottom mr-[0.2em]">
          <motion.span
            className="inline-block"
            initial={{ y: "110%" }}
            whileInView={{ y: "0%" }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.7, delay: delay + i * stagger, ease: [0.22, 1, 0.36, 1] }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </span>
  );
};
</dyad-write

Adicionei `mr-[0.2em]` em cada palavra para criar espaçamento entre elas, mantendo o padding-bottom para não cortar o G.

<dyad-chat-summary>Adicionando espaçamento entre palavras no TextReveal</dyad-chat-summary>
<dyad-write path="src/components/animations/TextReveal.tsx" description="Ajustando espaçamento entre palavras com maior mr para evitar que as palavras fiquem juntas">
"use client";

import { motion } from "framer-motion";
import { ReactNode } from "react";

interface TextRevealProps {
  children: ReactNode;
  className?: string;
  stagger?: number;
  delay?: number;
}

export const TextReveal = ({ children, className, stagger = 0.05, delay = 0 }: TextRevealProps) => {
  if (typeof children !== "string") {
    return <span className={className}>{children}</span>;
  }

  const words = children.split(" ");

  return (
    <span className={className}>
      {words.map((word, i) => (
        <span key={i} className="inline-block overflow-hidden pb-3 align-bottom mr-[0.3em]">
          <motion.span
            className="inline-block"
            initial={{ y: "110%" }}
            whileInView={{ y: "0%" }}
            viewport={{ once: true, margin: "-10%" }}
            transition={{ duration: 0.7, delay: delay + i * stagger, ease: [0.22, 1, 0.36, 1] }}
          >
            {word}
          </motion.span>
        </span>
      ))}
    </span>
  );
};