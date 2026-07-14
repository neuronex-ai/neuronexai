import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { useProfile } from "@/hooks/use-profile";
import { cn } from "@/lib/utils";
import { buildPublicProfessionalProfileUrl } from "@/lib/public-app-url";
import type { Profile } from "@/types";
import { motion, useReducedMotion } from "framer-motion";
import {
  BadgeCheck,
  Copy,
  ExternalLink,
  Loader2,
  QrCode,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

interface NeuroNexIDCardProps {
  profile?: Profile | null;
}

const getPlanLabel = (plan?: string | null) => {
  const normalized = plan?.trim().toLowerCase();
  if (normalized === "enterprise") return "Enterprise";
  if (normalized === "professional" || normalized === "profissional")
    return "Profissional";
  return "Essencial";
};

export const NeuroNexIDCard = ({ profile }: NeuroNexIDCardProps) => {
  const reduceMotion = useReducedMotion();
  const { updateProfile, isUpdating } = useProfile();
  const [specialty, setSpecialty] = useState(profile?.specialty || "");
  const plan = getPlanLabel(profile?.subscription_plan);
  const hasCrp = Boolean(profile?.crp?.trim());

  useEffect(() => {
    setSpecialty(profile?.specialty || "");
  }, [profile?.specialty]);

  const profileUrl = useMemo(() => {
    if (!profile?.id) return "";
    return buildPublicProfessionalProfileUrl(profile.public_slug || profile.id);
  }, [profile?.id, profile?.public_slug]);

  const qrUrl = profileUrl
    ? `https://api.qrserver.com/v1/create-qr-code/?data=${encodeURIComponent(profileUrl)}&size=300x300&bgcolor=ffffff&color=0a0a0b&format=svg`
    : "";

  const copyToClipboard = async () => {
    if (!profileUrl) return;
    try {
      await navigator.clipboard.writeText(profileUrl);
      toast.success("Link do perfil copiado.");
    } catch {
      toast.error("Não foi possível copiar o link agora.");
    }
  };

  const saveSpecialty = () => {
    const nextSpecialty = specialty.trim();
    const currentSpecialty = profile?.specialty?.trim() || "";
    if (nextSpecialty === currentSpecialty) return;
    updateProfile({ specialty: nextSpecialty || null });
  };

  const resetSpecialty = () => setSpecialty(profile?.specialty || "");

  return (
    <div className="flex h-full w-full flex-col items-center justify-center gap-8 py-8">
      <div className="z-10 space-y-3 text-center">
        <motion.h3
          animate={reduceMotion ? undefined : { opacity: [0.58, 1, 0.58] }}
          transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          className="text-2xl font-black uppercase tracking-[0.2em] text-zinc-950 drop-shadow-lg dark:text-white"
        >
          NEUROID
        </motion.h3>
        <div className="flex items-center justify-center gap-3">
          <div className="h-px w-8 bg-zinc-300 dark:bg-zinc-800" />
          <p className="text-[9px] font-black uppercase tracking-[0.28em] text-zinc-500">
            Sua credencial de acesso
          </p>
          <div className="h-px w-8 bg-zinc-300 dark:bg-zinc-800" />
        </div>
      </div>

      <div className="group relative">
        <div className="absolute -inset-4 bg-gradient-to-tr from-white/18 via-transparent to-zinc-400/10 opacity-0 blur-[60px] transition-opacity duration-1000 group-hover:opacity-100" />

        <div
          className={cn(
            "relative h-[520px] w-[340px] overflow-hidden rounded-[48px] border p-9 backdrop-blur-3xl transition-all duration-700",
            "border-white/40 bg-white/55 shadow-[0_32px_64px_-16px_rgba(0,0,0,0.12),inset_0_1px_1px_rgba(255,255,255,0.5)]",
            "dark:border-white/[0.075] dark:bg-[linear-gradient(145deg,rgba(28,28,29,0.94),rgba(13,13,14,0.96))] dark:shadow-[0_42px_90px_-34px_rgba(0,0,0,0.9),inset_0_1px_rgba(255,255,255,0.07)]",
            "group-hover:-translate-y-1 group-hover:shadow-[0_42px_80px_-20px_rgba(0,0,0,0.18)] dark:group-hover:shadow-[0_54px_110px_-34px_rgba(0,0,0,0.96),0_14px_44px_-28px_rgba(255,255,255,0.2),inset_0_1px_rgba(255,255,255,0.09)]",
          )}
        >
          <div
            aria-hidden
            className="pointer-events-none absolute inset-0 bg-[radial-gradient(circle_at_24%_12%,rgba(255,255,255,0.12),transparent_32%),linear-gradient(120deg,transparent_38%,rgba(255,255,255,0.035)_52%,transparent_68%)]"
          />

          <div className="relative flex h-full flex-col justify-between">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-700 dark:text-white/75">
                <ShieldCheck className="h-3.5 w-3.5 text-emerald-500" />
                {hasCrp ? "CRP informado" : "Perfil profissional"}
              </div>
              <motion.div
                animate={
                  reduceMotion
                    ? undefined
                    : { opacity: [0.72, 1, 0.72], scale: [1, 1.025, 1] }
                }
                transition={{
                  duration: 3.6,
                  repeat: Infinity,
                  ease: "easeInOut",
                }}
                className="relative flex items-center gap-1.5 overflow-hidden rounded-full border border-zinc-300/70 bg-zinc-950 px-3 py-2 text-[8px] font-black uppercase tracking-[0.16em] text-white shadow-lg dark:border-white/10 dark:bg-white/[0.075]"
                title="Reconhecimento a quem ajudou a construir a NeuroNex desde o início"
              >
                <Sparkles className="h-3 w-3" />
                Founder
              </motion.div>
            </div>

            <div className="flex flex-col items-center gap-5">
              <div className="group/avatar relative">
                <div className="rounded-[45px] bg-gradient-to-br from-black/10 via-transparent to-transparent p-1 shadow-2xl dark:from-white/20 dark:via-white/5">
                  <Avatar className="h-[142px] w-[142px] rounded-[40px] border-[6px] border-white shadow-inner transition-transform duration-700 group-hover/avatar:scale-[1.015] dark:border-zinc-950">
                    <AvatarImage
                      src={profile?.avatar_url || undefined}
                      className="object-cover"
                      alt="Foto do perfil"
                    />
                    <AvatarFallback className="bg-zinc-100 text-5xl font-black tracking-tighter text-zinc-950 dark:bg-zinc-900 dark:text-white">
                      {profile?.first_name?.charAt(0)}
                      {profile?.last_name?.charAt(0)}
                    </AvatarFallback>
                  </Avatar>
                </div>
                {hasCrp ? (
                  <div className="absolute -bottom-2 -right-2 flex h-9 w-9 items-center justify-center overflow-hidden rounded-full border-2 border-white bg-[radial-gradient(circle_at_32%_20%,rgba(255,255,255,0.85),transparent_28%),linear-gradient(145deg,#3f3f46,#09090b)] shadow-2xl transition-transform group-hover/avatar:scale-110 dark:border-black">
                    <BadgeCheck
                      className="h-5 w-5 text-white drop-shadow-md"
                      aria-label="CRP informado no perfil"
                    />
                  </div>
                ) : null}
              </div>

              <div className="w-full space-y-3 text-center">
                <h4 className="truncate text-3xl font-black uppercase leading-none tracking-tighter text-zinc-950 drop-shadow-sm dark:text-white">
                  {profile?.first_name} {profile?.last_name}
                </h4>
                <div className="mx-auto max-w-[250px]">
                  <label htmlFor="neuroid-specialty" className="sr-only">
                    Principal área de atuação
                  </label>
                  <Input
                    id="neuroid-specialty"
                    value={specialty}
                    onChange={(event) =>
                      setSpecialty(event.target.value.slice(0, 42))
                    }
                    onBlur={saveSpecialty}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") event.currentTarget.blur();
                      if (event.key === "Escape") {
                        resetSpecialty();
                        event.currentTarget.blur();
                      }
                    }}
                    disabled={isUpdating}
                    maxLength={42}
                    placeholder="Ex.: Neuropsicólogo"
                    className="h-9 rounded-full border-black/10 bg-black/5 px-4 text-center text-[9px] font-black uppercase tracking-[0.18em] text-zinc-700 placeholder:text-zinc-400 dark:border-white/10 dark:bg-white/[0.035] dark:text-zinc-300 dark:placeholder:text-zinc-600"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-end justify-between gap-5 pt-4">
              <Dialog>
                <DialogTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={!qrUrl}
                    className="h-[66px] w-[66px] rounded-2xl border border-zinc-200 bg-white p-1.5 shadow-xl transition-transform hover:scale-[1.04] hover:bg-white active:scale-[0.98] dark:border-zinc-800"
                    aria-label="Abrir QR Code do perfil compartilhável"
                  >
                    {qrUrl ? (
                      <img
                        src={qrUrl}
                        alt="QR Code do perfil compartilhável"
                        className="h-full w-full rounded-xl object-contain"
                      />
                    ) : (
                      <QrCode className="h-5 w-5" />
                    )}
                  </Button>
                </DialogTrigger>
                <DialogContent className="desktop-retina-modal overflow-hidden rounded-[32px] border-white/[0.08] bg-zinc-950/95 p-0 shadow-[0_40px_100px_-20px_rgba(0,0,0,0.9)] backdrop-blur-[80px] sm:max-w-[420px]">
                  <div className="flex flex-col items-center space-y-6 p-8">
                    <div className="flex items-center gap-3 self-start">
                      <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-white/[0.08] bg-white/[0.05]">
                        <QrCode className="h-5 w-5 text-white/65" />
                      </div>
                      <div>
                        <h4 className="text-xl font-bold text-white">
                          NEUROID
                        </h4>
                        <p className="text-[10px] font-medium uppercase tracking-[0.15em] text-white/45">
                          Perfil para pacientes e redes sociais
                        </p>
                      </div>
                    </div>

                    <div className="relative rounded-[22px] bg-white p-4 shadow-2xl shadow-white/5">
                      <img
                        src={qrUrl}
                        alt="QR Code ampliado do perfil"
                        className="h-56 w-56 object-contain"
                      />
                    </div>

                    <div className="space-y-1 text-center">
                      <p className="text-lg font-bold text-white">
                        {profile?.first_name} {profile?.last_name}
                      </p>
                      <p className="text-[10px] uppercase tracking-[0.18em] text-white/45">
                        {specialty || "Perfil profissional"}
                      </p>
                    </div>

                    <div className="w-full rounded-xl border border-white/[0.06] bg-white/[0.025] p-3">
                      <p className="break-all text-center font-mono text-[11px] text-white/55">
                        {profileUrl}
                      </p>
                    </div>

                    <div className="flex w-full gap-3">
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => void copyToClipboard()}
                        className="h-11 flex-1 rounded-xl border-white/[0.09] text-[10px] font-black uppercase tracking-[0.1em] text-white hover:bg-white/[0.06]"
                      >
                        <Copy className="mr-2 h-4 w-4" /> Copiar link
                      </Button>
                      <Button
                        type="button"
                        onClick={() =>
                          window.open(
                            profileUrl,
                            "_blank",
                            "noopener,noreferrer",
                          )
                        }
                        className="h-11 flex-1 rounded-xl bg-white text-[10px] font-black uppercase tracking-[0.1em] text-black hover:bg-white/90"
                      >
                        <ExternalLink className="mr-2 h-4 w-4" /> Abrir perfil
                      </Button>
                    </div>
                  </div>
                </DialogContent>
              </Dialog>

              <div className="flex flex-col items-end gap-2 text-right">
                <span className="text-[7px] font-black uppercase tracking-[0.18em] text-zinc-500 dark:text-zinc-600">
                  Plano atual
                </span>
                <div className="rounded-2xl border border-black/10 bg-black/5 px-4 py-2 text-[9px] font-black uppercase tracking-[0.22em] text-zinc-800 shadow-sm dark:border-white/10 dark:bg-white/[0.045] dark:text-white">
                  {plan}
                </div>
                {isUpdating ? (
                  <span className="flex items-center gap-1 text-[8px] font-bold text-zinc-500">
                    <Loader2 className="h-3 w-3 animate-spin" /> Salvando
                  </span>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </div>

      <p className="max-w-[310px] text-center text-[9px] font-bold uppercase leading-relaxed tracking-[0.16em] text-zinc-500 dark:text-zinc-600">
        Sua identidade profissional para compartilhar o consultório e facilitar
        o acesso dos seus pacientes.
      </p>
    </div>
  );
};
