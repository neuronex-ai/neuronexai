import { useState, useEffect } from "react";
import { Link, useNavigate, useLocation } from "react-router-dom";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import { ThemeToggle } from "@/components/theme/ThemeToggle";
import { Logo } from "@/components/ui/Logo";

export const Navbar = () => {
  const [scrolled, setScrolled] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20);
    window.addEventListener("scroll", handleScroll, { passive: true });
    return () => window.removeEventListener("scroll", handleScroll);
  }, []);

  const handleNavClick = (target: string) => {
    // If it starts with '/', treat as a route link
    if (target.startsWith('/')) {
      navigate(target);
      return;
    }
    // Otherwise treat as anchor section
    if (location.pathname !== '/') {
      navigate(`/#${target}`);
    } else {
      const element = document.getElementById(target);
      if (element) {
        element.scrollIntoView({ behavior: shouldReduceMotion ? 'auto' : 'smooth' });
      }
    }
  };

  const navItems = [
    { id: 'diferenciais', label: 'Diferenciais' },
    { id: 'produto', label: 'Produto' },
    { id: 'waitlist', label: 'Planos' },
  ];

  return (
      <motion.nav
        initial={{ y: -20, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.6, ease: [0.22, 1, 0.36, 1] }}
        className={cn(
          "fixed top-0 left-0 right-0 z-[100] hidden justify-center transition-all duration-700 ease-out-expo pointer-events-none md:flex",
          scrolled ? "py-4" : "py-8"
        )}
      >
        <motion.div
          layout
          transition={{ duration: 0.5, ease: [0.22, 1, 0.36, 1] }}
          className={cn(
            "px-8 py-3 rounded-full flex items-center justify-between gap-12 min-w-[320px] md:min-w-[800px] transition-all duration-700 ease-out-expo relative overflow-hidden pointer-events-auto",
            scrolled
              ? "bg-card/70 backdrop-blur-xl border border-border/50 shadow-glass-lg scale-[0.97]"
              : "bg-transparent border border-transparent scale-100"
          )}
        >
          {/* Shine highlight across top */}
          <AnimatePresence>
            {scrolled && (
              <motion.div
                initial={{ opacity: 0, scaleX: 0 }}
                animate={{ opacity: 0.5, scaleX: 1 }}
                exit={{ opacity: 0, scaleX: 0 }}
                transition={{ duration: 0.4 }}
                className="absolute top-0 left-4 right-4 h-px bg-gradient-to-r from-transparent via-foreground/30 to-transparent"
              />
            )}
          </AnimatePresence>

          {/* Logo */}
          <motion.div
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="group/logo"
          >
            <Link
              to="/"
              aria-label="Ir para a página inicial da NeuroNex"
              className="flex items-center rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-4 focus-visible:ring-offset-background"
            >
              <div className="relative w-7 h-7 flex items-center justify-center">
                <Logo className="w-full h-full" />
                <div className="absolute inset-0 border border-primary/20 rounded-full animate-[spin_8s_linear_infinite] opacity-0 group-hover/logo:opacity-100 transition-opacity motion-reduce:animate-none" />
              </div>
              <span className="ml-2.5 text-[12px] font-black text-foreground tracking-[0.35em] uppercase transition-all whitespace-nowrap">NeuroNex</span>
            </Link>
          </motion.div>

          {/* Nav Links */}
          <div className={cn(
            "hidden md:flex gap-8 text-[10px] font-black uppercase tracking-[0.2em] transition-colors duration-500",
            scrolled ? "text-muted-foreground" : "text-foreground/80"
          )}>
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => handleNavClick(item.id)}
                className="relative py-1 group transition-all duration-300 hover:text-primary"
              >
                <span className="relative z-10">{item.label}</span>
                {/* Underline effect */}
                <span className="absolute bottom-0 left-0 right-0 h-0.5 bg-primary scale-x-0 group-hover:scale-x-100 transition-transform duration-300 ease-out-expo origin-left rounded-full" />
              </button>
            ))}
          </div>

          {/* Actions */}
          <div className="flex items-center gap-4">
            <ThemeToggle />
            <Button
              asChild
              size="sm"
              className={cn(
                "h-10 px-6 rounded-full bg-primary text-primary-foreground hidden md:inline-flex",
                "hover:opacity-95 text-[10px] font-black uppercase tracking-[0.25em]",
                "shadow-[0_16px_32px_-8px_rgba(var(--primary-rgb),0.3)]",
                "transition-all duration-300 ease-apple",
                "hover:scale-105 hover:shadow-[0_20px_40px_-8px_rgba(var(--primary-rgb),0.4)]",
                "active:scale-95"
              )}
            >
              <Link to="/auth">
                Entrar
              </Link>
            </Button>
          </div>
        </motion.div>
      </motion.nav>
  );
};
