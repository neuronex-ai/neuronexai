import type { Config } from "tailwindcss";
import tailwindcssAnimate from "tailwindcss-animate";
import typography from "@tailwindcss/typography";

export default {
  darkMode: ["class"],
  content: ["./pages/**/*.{ts,tsx}", "./components/**/*.{ts,tsx}", "./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  prefix: "",
  theme: {
    container: {
      center: true,
      padding: "2rem",
      screens: {
        "2xl": "1400px",
      },
    },
    extend: {
      fontFamily: {
        sans: ["Inter", "sans-serif"],
        manrope: ["Manrope", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      colors: {
        border: "hsl(var(--border))",
        input: "hsl(var(--input))",
        ring: "hsl(var(--ring))",
        background: "hsl(var(--background))",
        foreground: "hsl(var(--foreground))",
        primary: {
          DEFAULT: "hsl(var(--primary))",
          foreground: "hsl(var(--primary-foreground))",
        },
        secondary: {
          DEFAULT: "hsl(var(--secondary))",
          foreground: "hsl(var(--secondary-foreground))",
        },
        destructive: {
          DEFAULT: "hsl(var(--destructive))",
          foreground: "hsl(var(--destructive-foreground))",
        },
        muted: {
          DEFAULT: "hsl(var(--muted))",
          foreground: "hsl(var(--muted-foreground))",
        },
        accent: {
          DEFAULT: "hsl(var(--accent))",
          foreground: "hsl(var(--accent-foreground))",
        },
        popover: {
          DEFAULT: "hsl(var(--popover))",
          foreground: "hsl(var(--popover-foreground))",
        },
        card: {
          DEFAULT: "hsl(var(--card))",
          foreground: "hsl(var(--card-foreground))",
        },
      },
      opacity: {
        48: "0.48",
        58: "0.58",
        62: "0.62",
        64: "0.64",
        66: "0.66",
        68: "0.68",
        72: "0.72",
        78: "0.78",
      },
      borderRadius: {
        lg: "var(--radius)",
        md: "calc(var(--radius) - 2px)",
        sm: "calc(var(--radius) - 4px)",
        '3xl': '1.5rem',
        '4xl': '2rem',
      },
      keyframes: {
        "accordion-down": {
          from: { height: "0" },
          to: { height: "var(--radix-accordion-content-height)" },
        },
        "accordion-up": {
          from: { height: "var(--radix-accordion-content-height)" },
          to: { height: "0" },
        },
        "fade-in": {
          from: { opacity: "0", transform: "translateY(8px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-up": {
          from: { opacity: "0", transform: "translateY(20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "fade-down": {
          from: { opacity: "0", transform: "translateY(-20px)" },
          to: { opacity: "1", transform: "translateY(0)" },
        },
        "scale-in": {
          from: { opacity: "0", transform: "scale(0.95)" },
          to: { opacity: "1", transform: "scale(1)" },
        },
        "scale-in-bounce": {
          "0%": { opacity: "0", transform: "scale(0.9)" },
          "60%": { opacity: "1", transform: "scale(1.02)" },
          "100%": { transform: "scale(1)" },
        },
        "aurora": {
          "0%, 100%": { transform: "translate(0, 0) scale(1)", opacity: "0.3" },
          "50%": { transform: "translate(15px, -15px) scale(1.05)", opacity: "0.5" },
        },
        "float": {
          "0%, 100%": { transform: "translateY(0)" },
          "50%": { transform: "translateY(-10px)" },
        },
        "float-gentle": {
          "0%, 100%": { transform: "translateY(0px)" },
          "50%": { transform: "translateY(-6px)" },
        },
        "pulse-slow": {
          "0%, 100%": { opacity: "1" },
          "50%": { opacity: "0.7" },
        },
        "shimmer": {
          "100%": { transform: "translateX(100%)" },
        },
        "scroll": {
          to: { transform: "translate(calc(-50% - 0.5rem))" },
        },
        "pulse-glow": {
          '0%, 100%': {
            transform: 'scale(1)',
            boxShadow: '0 0 10px hsl(var(--primary)), 0 0 20px hsl(var(--primary))',
            opacity: '0.8'
          },
          '50%': {
            transform: 'scale(1.2)',
            boxShadow: '0 0 20px hsl(var(--primary)), 0 0 40px hsl(var(--primary))',
            opacity: '1'
          }
        },
        "liquid-morph": {
          "0%, 100%": { borderRadius: "60% 40% 30% 70% / 60% 30% 70% 40%" },
          "25%": { borderRadius: "30% 60% 70% 40% / 50% 60% 30% 60%" },
          "50%": { borderRadius: "50% 60% 30% 60% / 30% 50% 70% 50%" },
          "75%": { borderRadius: "60% 40% 60% 30% / 70% 30% 50% 60%" },
        },
        "glass-shimmer": {
          "0%": { transform: "translateX(-100%)", opacity: "0" },
          "50%": { opacity: "1" },
          "100%": { transform: "translateX(100%)", opacity: "0" },
        },
        "micro-bounce": {
          "0%, 100%": { transform: "scale(1)" },
          "50%": { transform: "scale(0.97)" },
        },
        "slide-up-fade": {
          "0%": { opacity: "0", transform: "translateY(10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-down-fade": {
          "0%": { opacity: "0", transform: "translateY(-10px)" },
          "100%": { opacity: "1", transform: "translateY(0)" },
        },
        "slide-left-fade": {
          "0%": { opacity: "0", transform: "translateX(10px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "slide-right-fade": {
          "0%": { opacity: "0", transform: "translateX(-10px)" },
          "100%": { opacity: "1", transform: "translateX(0)" },
        },
        "blur-in": {
          "0%": { opacity: "0", filter: "blur(8px)" },
          "100%": { opacity: "1", filter: "blur(0)" },
        },
        "card-lift": {
          "0%": { transform: "translateY(0)", boxShadow: "0 4px 12px rgba(0,0,0,0.1)" },
          "100%": { transform: "translateY(-4px)", boxShadow: "0 20px 40px rgba(0,0,0,0.15)" },
        },
      },
      animation: {
        "accordion-down": "accordion-down 0.2s ease-out",
        "accordion-up": "accordion-up 0.2s ease-out",
        "fade-in": "fade-in 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "fade-up": "fade-up 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "fade-down": "fade-down 0.6s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "scale-in": "scale-in 0.3s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "scale-in-bounce": "scale-in-bounce 0.5s cubic-bezier(0.34, 1.56, 0.64, 1) forwards",
        "aurora": "aurora 12s ease-in-out infinite alternate",
        "float": "float 6s ease-in-out infinite",
        "float-gentle": "float-gentle 4s ease-in-out infinite",
        "pulse-slow": "pulse-slow 4s cubic-bezier(0.4, 0, 0.6, 1) infinite",
        "shimmer": "shimmer 2s infinite",
        "scroll": "scroll 40s linear infinite",
        "pulse-glow": "pulse-glow 3s ease-in-out infinite",
        "liquid-morph": "liquid-morph 8s ease-in-out infinite",
        "glass-shimmer": "glass-shimmer 3s ease-in-out infinite",
        "micro-bounce": "micro-bounce 0.15s ease-out",
        "slide-up-fade": "slide-up-fade 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "slide-down-fade": "slide-down-fade 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "slide-left-fade": "slide-left-fade 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "slide-right-fade": "slide-right-fade 0.4s cubic-bezier(0.22, 1, 0.36, 1) forwards",
        "blur-in": "blur-in 0.5s cubic-bezier(0.22, 1, 0.36, 1) forwards",
      },
      boxShadow: {
        'glass': '0 8px 32px 0 rgba(0, 0, 0, 0.3)',
        'glass-sm': '0 4px 16px 0 rgba(0, 0, 0, 0.2)',
        'glass-lg': '0 16px 48px 0 rgba(0, 0, 0, 0.35)',
        'glow': '0 0 20px -5px rgba(139, 92, 246, 0.3)',
        'glow-lg': '0 0 40px -10px rgba(139, 92, 246, 0.4)',
        'premium': '0 20px 40px -20px rgba(0,0,0,0.6)',
        'premium-lg': '0 30px 60px -20px rgba(0,0,0,0.7)',
        'inner-light': 'inset 0 1px 0 0 rgba(255, 255, 255, 0.05)',
        'inner-light-strong': 'inset 0 2px 0 0 rgba(255, 255, 255, 0.1)',
        'liquid': '0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.1)',
        'card-hover': '0 20px 40px -15px rgba(0,0,0,0.2), 0 0 0 1px rgba(255,255,255,0.05)',
      },
      backgroundImage: {
        'glass-gradient': 'linear-gradient(to bottom, rgba(255, 255, 255, 0.05), rgba(255, 255, 255, 0.0))',
        'glass-gradient-hover': 'linear-gradient(to bottom, rgba(255, 255, 255, 0.08), rgba(255, 255, 255, 0.02))',
        'glass-radial': 'radial-gradient(circle at 50% 0%, rgba(255,255,255,0.08), transparent 50%)',
        'glass-shine': 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, transparent 50%, rgba(255,255,255,0.05) 100%)',
      },
      transitionTimingFunction: {
        DEFAULT: 'cubic-bezier(0.23, 1, 0.32, 1)',
        'apple': 'cubic-bezier(0.22, 1, 0.36, 1)',
        'spring': 'cubic-bezier(0.175, 0.885, 0.32, 1.275)',
        'bounce': 'cubic-bezier(0.34, 1.56, 0.64, 1)',
        'glass': 'cubic-bezier(0.4, 0, 0.2, 1)',
        'out-expo': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
      transitionDuration: {
        'fast': '150ms',
        'normal': '300ms',
        'slow': '500ms',
        'theme': '800ms',
      },
    },
  },
  plugins: [tailwindcssAnimate, typography],
} satisfies Config;
