import { useQuery } from "@tanstack/react-query";
import { motion, useReducedMotion } from "framer-motion";
import {
  BadgeCheck,
  Building2,
  Check,
  Copy,
  Loader2,
  MapPin,
  Share2,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { toast } from "sonner";

import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/ui/Logo";
import { supabase } from "@/integrations/supabase/client";

type PublicProfessionalProfile = {
  id: string;
  display_name: string;
  first_name: string | null;
  last_name: string | null;
  avatar_url: string | null;
  clinic_name: string | null;
  crp: string | null;
  specialty: string | null;
  bio: string | null;
  address_city: string | null;
  address_state: string | null;
  founder: boolean;
  // The current database projection means only that a CRP was provided.
  // It is not evidence of an official registry verification.
  verified: boolean;
};

const isUuid = (value?: string) =>
  Boolean(value && /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value));

const isValidProfileKey = (value?: string) =>
  Boolean(value && (isUuid(value) || /^[a-z0-9][a-z0-9-]{2,100}$/i.test(value)));

const initials = (profile: PublicProfessionalProfile) => {
  const source = `${profile.first_name || ""} ${profile.last_name || ""}`.trim() || profile.display_name;
  return source
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part.charAt(0))
    .join("")
    .toUpperCase();
};

export default function PublicProfessionalProfile() {
  const { profileId } = useParams<{ profileId: string }>();
  const reduceMotion = useReducedMotion();
  const [copied, setCopied] = useState(false);

  const profileQuery = useQuery({
    queryKey: ["public-professional-profile", profileId],
    enabled: isValidProfileKey(profileId),
    retry: 1,
    queryFn: async () => {
      const { data, error } = await supabase
        .rpc("get_public_professional_profile", { profile_key: profileId! });

      if (!error) return ((data as PublicProfessionalProfile[] | null)?.[0] || null);

      // Compatibility while the read-only projection migration is being deployed.
      // The existing RLS policy still decides whether this safe field subset is visible.
      if (!isUuid(profileId)) throw error;

      const fallback = await supabase
        .from("profiles")
        .select("id, full_name, name, first_name, last_name, avatar_url, clinic_name, crp, specialty, bio, address_city, address_state")
        .eq("id", profileId!)
        .maybeSingle();

      if (fallback.error) throw fallback.error;
      if (!fallback.data) return null;

      const displayName =
        fallback.data.full_name?.trim() ||
        [fallback.data.first_name, fallback.data.last_name].filter(Boolean).join(" ").trim() ||
        fallback.data.name?.trim() ||
        "Profissional NeuroNex";

      return {
        ...fallback.data,
        display_name: displayName,
        founder: true,
        verified: Boolean(fallback.data.crp?.trim()),
      } as PublicProfessionalProfile;
    },
    staleTime: 5 * 60_000,
  });

  const profile = profileQuery.data;
  const location = [profile?.address_city, profile?.address_state].filter(Boolean).join(" · ");

  useEffect(() => {
    const previousTitle = document.title;
    document.title = profile ? `${profile.display_name} · NEUROID` : "NEUROID · NeuroNex";
    return () => {
      document.title = previousTitle;
    };
  }, [profile]);

  const copyProfile = async () => {
    try {
      await navigator.clipboard.writeText(window.location.href);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 1800);
    } catch {
      toast.error("Não foi possível copiar o link neste navegador.");
    }
  };

  const shareProfile = async () => {
    try {
      if (navigator.share && profile) {
        await navigator.share({
          title: `${profile.display_name} · NEUROID`,
          text: profile.specialty || "Perfil profissional NeuroNex",
          url: window.location.href,
        });
        return;
      }
      await copyProfile();
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
      await copyProfile();
    }
  };

  if (!isValidProfileKey(profileId)) {
    return <ProfileUnavailable />;
  }

  if (profileQuery.isLoading) {
    return (
      <main className="public-lumen-page flex min-h-screen items-center justify-center bg-background text-foreground">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" aria-label="Carregando perfil" />
      </main>
    );
  }

  if (profileQuery.isError || !profile) {
    return <ProfileUnavailable />;
  }

  return (
    <main className="public-lumen-page relative min-h-screen overflow-hidden bg-background px-5 py-8 text-foreground sm:px-8 sm:py-12">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[42rem] bg-[radial-gradient(ellipse_at_top,rgba(255,255,255,0.09),transparent_58%)] dark:opacity-80" />
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[linear-gradient(115deg,transparent_20%,rgba(127,127,127,0.035)_48%,transparent_72%)]" />

      <div className="relative mx-auto flex w-full max-w-5xl flex-col">
        <header className="flex items-center justify-between">
          <Link to="/" className="inline-flex items-center gap-3 rounded-2xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex h-11 w-11 items-center justify-center rounded-2xl border border-border/50 bg-card/70 shadow-sm backdrop-blur-xl">
              <Logo className="h-7 w-7" />
            </span>
            <span>
              <span className="block text-[10px] font-black uppercase tracking-[0.24em]">NeuroNex</span>
              <span className="mt-0.5 block text-[8px] font-bold uppercase tracking-[0.18em] text-muted-foreground">Identidade profissional</span>
            </span>
          </Link>
          <Button variant="outline" onClick={() => void shareProfile()} className="public-tactile h-11 rounded-full px-4 sm:px-5">
            <Share2 className="mr-2 h-4 w-4" /> Compartilhar
          </Button>
        </header>

        <motion.section
          initial={reduceMotion ? false : { opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: reduceMotion ? 0 : 0.35, ease: [0.22, 1, 0.36, 1] }}
          className="public-neurox-card mt-10 grid overflow-hidden rounded-[38px] backdrop-blur-[44px] lg:grid-cols-[0.92fr_1.08fr]"
        >
          <div className="relative flex min-h-[34rem] flex-col items-center justify-center overflow-hidden border-b border-border/40 p-8 text-center lg:border-b-0 lg:border-r lg:p-12">
            <div aria-hidden className="absolute inset-0 bg-[radial-gradient(circle_at_50%_34%,rgba(255,255,255,0.105),transparent_38%)]" />
            <div className="relative">
              <div className="relative mx-auto w-fit">
                <div className="rounded-[44px] border border-border/45 bg-muted/25 p-2 shadow-2xl">
                  <Avatar className="h-40 w-40 rounded-[36px] sm:h-48 sm:w-48 sm:rounded-[40px]">
                    <AvatarImage src={profile.avatar_url || undefined} alt={`Foto profissional de ${profile.display_name}`} className="object-cover" />
                    <AvatarFallback className="rounded-[36px] bg-muted text-4xl font-black tracking-[-0.05em] sm:text-5xl">
                      {initials(profile)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                {profile.verified ? (
                  <span className="absolute -bottom-2 -right-2 flex h-11 w-11 items-center justify-center rounded-full border-2 border-background bg-gradient-to-br from-zinc-500 via-zinc-800 to-black text-white shadow-xl" title="CRP informado no perfil">
                    <BadgeCheck className="h-6 w-6" aria-label="CRP informado no perfil" />
                  </span>
                ) : null}
              </div>

              <p className="mt-8 text-[9px] font-black uppercase tracking-[0.24em] text-muted-foreground">NEUROID</p>
              <h1 className="mt-3 text-4xl font-black leading-[0.94] tracking-normal sm:text-5xl">{profile.display_name}</h1>
              <p className="mt-4 text-sm font-bold text-muted-foreground">{profile.specialty || "Profissional de saúde mental"}</p>
              {profile.crp ? <p className="mt-2 text-[10px] font-black uppercase tracking-[0.17em] text-muted-foreground/75">CRP {profile.crp}</p> : null}
            </div>
          </div>

          <div className="flex flex-col justify-center p-7 sm:p-10 lg:p-12">
            <div className="flex flex-wrap items-center gap-2.5">
              <span className="public-glass-capsule inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-foreground/72">
                <ShieldCheck className="h-3.5 w-3.5" /> Perfil profissional
              </span>
              {profile.founder ? (
                <motion.span
                  animate={reduceMotion ? undefined : { opacity: [0.72, 1, 0.72] }}
                  transition={{ duration: 3.8, repeat: Infinity, ease: "easeInOut" }}
                  className="inline-flex items-center gap-2 rounded-full border border-border/55 bg-foreground px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.14em] text-background"
                  title="Reconhecimento a quem ajudou a construir a NeuroNex"
                >
                  <Sparkles className="h-3.5 w-3.5" /> Founder
                </motion.span>
              ) : null}
            </div>

            <div className="mt-8 space-y-4">
              {profile.clinic_name ? (
                <InfoRow icon={Building2} label="Clínica ou consultório" value={profile.clinic_name} />
              ) : null}
              {location ? <InfoRow icon={MapPin} label="Localização profissional" value={location} /> : null}
            </div>

            <div className="mt-8 rounded-[26px] border border-border/45 bg-muted/20 p-6 dark:bg-white/[0.018]">
              <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground">Apresentação</p>
              <p className="mt-3 text-sm font-medium leading-7 text-foreground/80">
                {profile.bio || "Perfil profissional compartilhado com segurança pela NeuroNex."}
              </p>
            </div>

            <div className="mt-8 flex flex-col gap-3 sm:flex-row">
              <Button onClick={() => void copyProfile()} className="public-tactile h-12 flex-1 rounded-full font-bold">
                {copied ? <Check className="mr-2 h-4 w-4" /> : <Copy className="mr-2 h-4 w-4" />}
                {copied ? "Link copiado" : "Copiar link"}
              </Button>
              <Button asChild variant="outline" className="public-tactile h-12 flex-1 rounded-full font-bold">
                <Link to="/">Conhecer a NeuroNex</Link>
              </Button>
            </div>

            <p className="mt-7 text-center text-[9px] font-bold uppercase leading-relaxed tracking-[0.16em] text-muted-foreground/60">
              Este perfil não exibe dados privados, financeiros ou clínicos.
            </p>
          </div>
        </motion.section>
      </div>
    </main>
  );
}

function InfoRow({ icon: Icon, label, value }: { icon: typeof Building2; label: string; value: string }) {
  return (
    <div className="flex items-center gap-4 rounded-[22px] border border-border/40 bg-muted/20 p-4 dark:bg-white/[0.015]">
      <Icon className="h-4 w-4 shrink-0 text-muted-foreground" />
      <span className="min-w-0">
        <span className="block text-[8px] font-black uppercase tracking-[0.17em] text-muted-foreground">{label}</span>
        <span className="mt-1 block truncate text-sm font-black text-foreground">{value}</span>
      </span>
    </div>
  );
}

function ProfileUnavailable() {
  return (
    <main className="public-lumen-page flex min-h-screen items-center justify-center bg-background px-5 text-foreground">
      <section className="public-neurox-card w-full max-w-md rounded-[32px] p-8 text-center backdrop-blur-xl">
        <ShieldCheck className="mx-auto h-7 w-7 text-muted-foreground" />
        <h1 className="mt-5 text-2xl font-black tracking-normal">Perfil indisponível</h1>
        <p className="mt-3 text-sm font-medium leading-relaxed text-muted-foreground">
          Este NEUROID não existe ou ainda não está disponível para compartilhamento.
        </p>
        <Button asChild variant="outline" className="public-tactile mt-7 h-11 rounded-full px-6">
          <Link to="/">Voltar para a NeuroNex</Link>
        </Button>
      </section>
    </main>
  );
}
