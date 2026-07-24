import React, { useState, useEffect, useRef } from "react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/components/auth/SessionContextProvider";
import {
  Plus,
  Video,
  Phone,
  Mic,
  ChevronLeft,
  Battery,
  Wifi,
  Signal,
  Send,
  User,
  ArrowRight,
  Command,
  CornerDownLeft,
  Type,
  Smartphone,
  Mail,
  MessageSquare,
} from "lucide-react";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  motion,
  AnimatePresence,
  useMotionValue,
  useReducedMotion,
  useTransform,
} from "framer-motion";

// --- CONFIG ---

const VARIABLE_MAP = {
  "{{patientName}}": "[Nome]",
  "{{date}}": "[Data]",
  "{{time}}": "[Hora]",
  "{{confirmationLink}}": "[Link]",
  "{{amount}}": "[Valor]",
  "{{therapistName}}": "[Profissional]",
};

const REVERSE_VARIABLE_MAP = Object.fromEntries(
  Object.entries(VARIABLE_MAP).map(([k, v]) => [v, k]),
);

const toEditorTemplate = (body: string) => {
  let editorBody = body;
  Object.entries(VARIABLE_MAP).forEach(([code, short]) => {
    editorBody = editorBody.split(code).join(short);
  });
  return editorBody;
};

const TEMPLATE_TYPES = [
  { id: "appointment_reminder", label: "Lembrete de consulta" },
  { id: "payment_reminder", label: "Lembrete de pagamento" },
  { id: "new_patient_welcome", label: "Boas-vindas" },
  { id: "appointment_invite", label: "Convite de sessão" },
];

const PRESETS: Record<string, Record<string, string>> = {
  whatsapp: {
    appointment_reminder:
      "Olá [Nome]! 👋\n\nLembrete da sua consulta:\n📅 [Data] às [Hora]\n\nConfirme aqui: [Link]\n\nAté breve!",
    payment_reminder:
      "Olá [Nome]! 💳\n\nIdentificamos uma sessão pendente de pagamento.\n\nValor: R$ [Valor]\nData da sessão: [Data]\n\nQualquer dúvida, estou à disposição!",
    new_patient_welcome:
      "Olá [Nome]! 🎉\n\nSeja muito bem-vindo(a) ao nosso espaço de cuidado!\n\nSou [Profissional] e estou muito feliz em iniciar essa jornada com você.\n\nNossa primeira sessão será em:\n📅 [Data] às [Hora]",
    appointment_invite:
      "Olá [Nome]! 📅\n\nVocê tem uma nova sessão agendada:\n\n📍 [Data] às [Hora]\n🔗 Link da sala: [Link]\n\nNos vemos em breve!",
  },
  email: {
    appointment_reminder:
      "Prezado(a) [Nome],\n\nEste é um lembrete automático do seu agendamento.\n\nData: [Data]\nHorário: [Hora]\nLink da sala: [Link]\n\nPor favor, confirme sua presença clicando no link acima.\n\nAtenciosamente,\n[Profissional]",
    payment_reminder:
      "Prezado(a) [Nome],\n\nIdentificamos uma sessão com pagamento pendente em sua conta.\n\nData da sessão: [Data]\nValor: R$ [Valor]\n\nPor favor, regularize o pagamento para manter seu acompanhamento em dia.\n\nAtenciosamente,\n[Profissional]",
    new_patient_welcome:
      "Prezado(a) [Nome],\n\nÉ com grande satisfação que dou as boas-vindas ao nosso espaço terapêutico!\n\nSou [Profissional] e estarei acompanhando você nessa jornada de autoconhecimento e cuidado.\n\nNossa primeira sessão está agendada para:\nData: [Data]\nHorário: [Hora]\n\nEstou à disposição para qualquer dúvida.\n\nAbraços,\n[Profissional]",
    appointment_invite:
      "Prezado(a) [Nome],\n\nVocê tem uma nova sessão agendada!\n\nData: [Data]\nHorário: [Hora]\nLink de acesso: [Link]\n\nGuarde este e-mail para acessar a sala virtual no horário marcado.\n\nAtenciosamente,\n[Profissional]",
  },
  marketing: {
    appointment_reminder:
      "Ei [Nome]! 🧠\n\nNão esqueça: sua consulta é amanhã!\n📅 [Data] às [Hora]\n\nTe vejo lá!",
    payment_reminder:
      "Olá [Nome]!\n\nVimos que há um pagamento pendente. Regularize para continuar seu acompanhamento!\n\nValor: R$ [Valor]",
    new_patient_welcome:
      "[Nome], bem-vindo(a)! 🎉\n\nQue bom ter você aqui. Sua primeira sessão será em [Data] às [Hora].\n\nEstou animado(a) para começarmos!",
    appointment_invite:
      "[Nome], você foi convidado(a) para uma sessão! 📅\n\n[Data] às [Hora]\nAcesse: [Link]",
  },
};

const VARIABLES = [
  { label: "Nome", code: "[Nome]", icon: User },
  { label: "Data", code: "[Data]", icon: null },
  { label: "Hora", code: "[Hora]", icon: null },
  { label: "Link", code: "[Link]", icon: ArrowRight },
  { label: "Valor", code: "[Valor]", icon: null },
  { label: "Profissional", code: "[Profissional]", icon: null },
];

export const CommunicationSettings = () => {
  const { user } = useAuth();
  const [template, setTemplate] = useState("");
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [isDirty, setIsDirty] = useState(false);
  const [activeChannel, setActiveChannel] = useState("whatsapp");
  const [activeTemplateType, setActiveTemplateType] = useState(
    "appointment_reminder",
  );
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const highlightRef = useRef<HTMLDivElement>(null);
  const reduceMotion = useReducedMotion();

  // 3D Physics
  const x = useMotionValue(0);
  const y = useMotionValue(0);
  const rotateX = useTransform(y, [-0.5, 0.5], [7, -7]);
  const rotateY = useTransform(x, [-0.5, 0.5], [-7, 7]);

  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    const loadTemplate = async () => {
      setLoading(true);
      const channelPresets = PRESETS[activeChannel as keyof typeof PRESETS];
      const fallback =
        channelPresets?.[activeTemplateType] ||
        channelPresets?.appointment_reminder ||
        "";

      const { data, error } = await supabase
        .from("communication_templates")
        .select("body_html")
        .eq("user_id", user.id)
        .eq("template_key", `${activeChannel}_${activeTemplateType}`)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.error(
          "[CommunicationSettings] Failed to load template:",
          error,
        );
        setTemplate(fallback);
      } else {
        setTemplate(
          data?.body_html ? toEditorTemplate(data.body_html) : fallback,
        );
      }
      setIsDirty(false);
      setLoading(false);
    };

    void loadTemplate();

    return () => {
      cancelled = true;
    };
  }, [user, activeChannel, activeTemplateType]);

  const saveTemplate = async (showConfirmation = true) => {
    if (!user) {
      toast.error("Entre na sua conta para salvar as preferências.");
      return false;
    }
    setSaving(true);

    let dbBody = template;
    Object.entries(REVERSE_VARIABLE_MAP).forEach(([short, code]) => {
      dbBody = dbBody.split(short).join(code);
    });

    try {
      const { data, error } = await supabase
        .from("communication_templates")
        .upsert(
          {
            user_id: user.id,
            template_key: `${activeChannel}_${activeTemplateType}`,
            subject:
              activeChannel === "email"
                ? TEMPLATE_TYPES.find((t) => t.id === activeTemplateType)
                    ?.label || "Mensagem"
                : "Mensagem",
            body_html: dbBody,
          },
          { onConflict: "user_id, template_key" },
        )
        .select("body_html")
        .single();

      if (error) throw error;

      setTemplate(toEditorTemplate(data.body_html));
      setIsDirty(false);
      if (showConfirmation)
        toast.success("Preferências de comunicação salvas.");
      return true;
    } catch (error) {
      console.error("[CommunicationSettings] Falha ao salvar o modelo:", error);
      toast.error("Não foi possível salvar as preferências agora.");
      return false;
    } finally {
      setSaving(false);
    }
  };

  const changeChannel = async (nextChannel: string) => {
    if (nextChannel === activeChannel || loading || saving) return;
    if (isDirty && !(await saveTemplate(false))) return;
    setActiveChannel(nextChannel);
  };

  const changeTemplateType = async (nextType: string) => {
    if (nextType === activeTemplateType || loading || saving) return;
    if (isDirty && !(await saveTemplate(false))) return;
    setActiveTemplateType(nextType);
  };

  const insertVariable = (variableCode: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;

    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    const newText =
      template.substring(0, start) + variableCode + template.substring(end);

    setTemplate(newText);

    setTimeout(() => {
      textarea.focus();
      textarea.setSelectionRange(
        start + variableCode.length,
        start + variableCode.length,
      );
    }, 0);
  };

  const handleScroll = () => {
    if (textareaRef.current && highlightRef.current) {
      highlightRef.current.scrollTop = textareaRef.current.scrollTop;
    }
  };

  const handleMouseMove = (e: React.MouseEvent<HTMLDivElement>) => {
    if (reduceMotion) return;
    const rect = e.currentTarget.getBoundingClientRect();
    x.set((e.clientX - rect.left) / rect.width - 0.5);
    y.set((e.clientY - rect.top) / rect.height - 0.5);
  };

  const renderHighlights = (text: string) => {
    let html = text
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    VARIABLES.forEach((v) => {
      const regex = new RegExp(v.code.replace(/[[\]]/g, "\\$&"), "g");
      html = html.replace(
        regex,
        `<span class="inline-block bg-primary text-primary-foreground font-bold rounded-[4px] px-[3px] mx-[-3px] shadow-[0_4px_12px_rgba(var(--primary),0.2)] text-[0.95em] translate-y-[-1px] select-none">${v.code}</span>`,
      );
    });

    return html.replace(/\n/g, "<br/>") + "<br/>";
  };

  const renderPhonePreview = (text: string) => {
    let rendered = text;
    rendered = rendered.replace(/\[Nome\]/g, "Ana");
    rendered = rendered.replace(/\[Data\]/g, "25/10");
    rendered = rendered.replace(/\[Hora\]/g, "14:30");
    rendered = rendered.replace(/\[Link\]/g, "neuronex.ai/c/829");
    rendered = rendered.replace(/\[Valor\]/g, "180,00");
    rendered = rendered.replace(/\[Profissional\]/g, "Dra. Maria");

    const parts = rendered.split(/(\*.*?\*)/g);
    return parts.map((part, i) => {
      if (part.startsWith("*") && part.endsWith("*")) {
        return (
          <strong key={i} className="font-bold text-white">
            {part.slice(1, -1)}
          </strong>
        );
      }
      return part;
    });
  };

  return (
    <motion.div
      initial={reduceMotion ? false : { opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.22 }}
      className="flex flex-col xl:flex-row gap-8 h-full pb-10"
    >
      <div className="flex-1 flex flex-col gap-6 min-w-0">
        <div className="flex flex-col items-center justify-between gap-6 text-center md:flex-row md:text-left">
          <div className="flex flex-col items-center gap-3 md:flex-row">
            <div className="h-10 w-10 rounded-full bg-secondary/10 border border-border/10 flex items-center justify-center shadow-inner shrink-0">
              <Command className="h-5 w-5 text-muted-foreground" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-foreground tracking-tight">
                Comunicação
              </h2>
              <p className="text-[11px] font-bold uppercase tracking-widest text-muted-foreground">
                Modelos de mensagens
              </p>
            </div>
          </div>
          <Button
            onClick={() => void saveTemplate(true)}
            disabled={loading || saving || !isDirty}
            className="bg-primary text-primary-foreground hover:bg-primary/90 h-10 px-8 rounded-full font-bold text-[10px] uppercase tracking-widest shadow-lg shadow-primary/20 transition-all active:scale-95 active:shadow-none hover:-translate-y-0.5 whitespace-nowrap w-full md:w-auto"
          >
            {saving
              ? "Salvando..."
              : isDirty
                ? "Salvar alterações"
                : "Alterações salvas"}
          </Button>
        </div>

        <div className="p-1.5 bg-card/60 dark:bg-card border border-border/10 rounded-[20px] shadow-xl">
          <Tabs
            magnetic
            value={activeChannel}
            onValueChange={(value) => void changeChannel(value)}
            className="w-full"
          >
            <TabsList className="bg-transparent h-10 p-0 w-full grid grid-cols-3 gap-1">
              {[
                { id: "whatsapp", label: "WhatsApp", icon: MessageSquare },
                { id: "email", label: "E-mail", icon: Mail },
                { id: "marketing", label: "SMS", icon: Smartphone },
              ].map((tab) => (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="h-10 rounded-xl text-[10px] font-bold uppercase tracking-widest data-[state=active]:bg-secondary data-[state=active]:text-foreground data-[state=active]:shadow-sm text-muted-foreground transition-all duration-300 gap-2 flex items-center justify-center hover:bg-secondary/50"
                >
                  <tab.icon className="w-3.5 h-3.5" />
                  {tab.label}
                </TabsTrigger>
              ))}
            </TabsList>
          </Tabs>
        </div>

        <div className="flex items-center gap-3 overflow-x-auto no-scrollbar py-1">
          <span className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest shrink-0">
            Tipo:
          </span>
          <div className="flex gap-2">
            {TEMPLATE_TYPES.map((type) => (
              <button
                key={type.id}
                onClick={() => void changeTemplateType(type.id)}
                className={`px-4 py-1.5 rounded-full text-[10px] font-bold uppercase tracking-widest transition-all whitespace-nowrap ${
                  activeTemplateType === type.id
                    ? "bg-primary text-primary-foreground shadow-lg shadow-primary/10"
                    : "bg-secondary/40 dark:bg-secondary/20 text-muted-foreground hover:bg-secondary/60 dark:hover:bg-secondary/40 border border-border/5"
                }`}
              >
                {type.label}
              </button>
            ))}
          </div>
        </div>

        <div className="flex-1 flex flex-col bg-card/40 dark:bg-card border border-border/10 rounded-[32px] shadow-2xl relative overflow-hidden group/editor transition-all duration-500 hover:border-border/30">
          <div className="px-5 py-4 border-b border-border/10 bg-secondary/10 dark:bg-secondary/5 flex items-center gap-2 overflow-x-auto no-scrollbar">
            <span className="text-[9px] font-bold text-muted-foreground uppercase tracking-widest shrink-0 mr-2">
              Variáveis:
            </span>
            {VARIABLES.map((v) => (
              <button
                key={v.code}
                onClick={() => insertVariable(v.code)}
                className="flex items-center gap-1.5 px-3.5 py-2 rounded-full bg-secondary/60 dark:bg-secondary/20 hover:bg-secondary/80 dark:hover:bg-secondary/40 border border-border/10 transition-all active:scale-95 hover:-translate-y-0.5 group/btn"
              >
                <span className="text-muted-foreground group-hover/btn:text-foreground transition-colors">
                  {v.icon ? (
                    <v.icon className="h-3 w-3" />
                  ) : (
                    <Type className="h-3 w-3" />
                  )}
                </span>
                <span className="text-[10px] font-bold text-muted-foreground/80 group-hover/btn:text-foreground transition-colors">
                  {v.label}
                </span>
              </button>
            ))}
          </div>

          <div className="flex-1 relative min-h-[400px]">
            <div
              ref={highlightRef}
              className="absolute inset-0 p-8 pointer-events-none whitespace-pre-wrap text-sm leading-8 font-mono z-0 overflow-hidden text-transparent transition-opacity duration-200"
              dangerouslySetInnerHTML={{ __html: renderHighlights(template) }}
              style={{ paddingBottom: "80px" }}
            />

            <textarea
              ref={textareaRef}
              value={template}
              onChange={(event) => {
                setTemplate(event.target.value);
                setIsDirty(true);
              }}
              onScroll={handleScroll}
              className="absolute inset-0 w-full h-full bg-transparent text-sm leading-8 font-mono p-8 resize-none focus:outline-none z-10 text-foreground/70 dark:text-foreground/50 caret-primary selection:bg-primary/20 placeholder:text-muted-foreground/30"
              spellCheck={false}
              placeholder="Escreva sua mensagem aqui..."
            />
          </div>

          <div className="absolute bottom-6 right-8 flex items-center gap-3">
            <div className="text-[9px] font-bold text-muted-foreground bg-secondary/80 dark:bg-secondary/50 px-3 py-1.5 rounded-lg border border-border/10 backdrop-blur-md shadow-sm">
              {template.length} caracteres
            </div>
          </div>
        </div>

        <div className="px-6 opacity-60">
          <p className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground">
            Os campos entre colchetes são preenchidos automaticamente.
          </p>
        </div>
      </div>

      {/* Mobile Preview (Simple Card) */}
      <div className="block xl:hidden bg-card border border-border/10 rounded-3xl p-6 shadow-xl relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 rounded-full blur-3xl" />
        <h3 className="text-sm font-bold text-muted-foreground uppercase tracking-widest mb-4 relative z-10">
          Pré-visualização
        </h3>
        <div className="bg-secondary/30 rounded-2xl p-4 text-sm leading-relaxed whitespace-pre-wrap relative z-10 font-sans border border-border/5">
          {activeChannel === "whatsapp" && (
            <div className="bg-[#005c4b] text-[#e9edef] p-3 rounded-xl rounded-tr-none shadow-sm inline-block max-w-full">
              {renderPhonePreview(template || "...")}
              <div className="flex justify-end gap-1 mt-1 opacity-60">
                <span className="text-[10px]">14:30</span>
                <div className="text-[#53bdeb] text-[10px]">✓✓</div>
              </div>
            </div>
          )}
          {activeChannel === "email" && (
            <div className="text-foreground">
              <p className="font-bold mb-2">
                Assunto:{" "}
                {TEMPLATE_TYPES.find((t) => t.id === activeTemplateType)
                  ?.label || "Mensagem"}
              </p>
              <div className="w-full h-px bg-border/10 mb-2" />
              {renderPhonePreview(template || "...")}
            </div>
          )}
          {activeChannel === "marketing" && (
            <div className="bg-zinc-800 text-white p-3 rounded-2xl rounded-tl-sm inline-block max-w-full">
              {renderPhonePreview(template || "...")}
            </div>
          )}
        </div>
      </div>

      {/* Desktop Preview (3D Phone) */}
      <div className="hidden xl:flex w-full xl:w-[440px] shrink-0 items-center justify-center overflow-hidden py-8 xl:py-0 perspective-[3000px]">
        <motion.div
          style={
            reduceMotion
              ? { clipPath: "inset(0 round 64px)" }
              : {
                  rotateX,
                  rotateY,
                  transformStyle: "preserve-3d",
                  clipPath: "inset(0 round 64px)",
                }
          }
          onMouseMove={handleMouseMove}
          onMouseLeave={() => {
            x.set(0);
            y.set(0);
          }}
          className="relative isolate h-[680px] w-[340px] overflow-hidden rounded-[64px] border-[8px] border-[#1a1a1a] bg-[#020202] shadow-[0_60px_120px_-30px_rgba(0,0,0,0.8)] ring-1 ring-white/10 [backface-visibility:hidden] [contain:paint]"
        >
          <div className="pointer-events-none absolute inset-0 z-[60] rounded-[55px] bg-gradient-to-tr from-white/5 via-transparent to-transparent opacity-10" />

          <div className="absolute top-0 left-0 right-0 h-14 z-[60] flex justify-center pt-3 pointer-events-none">
            <div className="w-28 h-8 bg-black rounded-full flex items-center justify-center gap-3 px-3 shadow-lg border border-white/[0.05]">
              <div className="w-2 h-2 rounded-full bg-[#333] shadow-inner" />
              <div className="w-16 h-2 rounded-full bg-[#111]" />
            </div>
          </div>

          <div className="absolute top-4 left-9 right-9 z-[55] flex justify-between items-center text-white/40 text-[10px] font-bold tracking-tight">
            <span>9:41</span>
            <div className="flex gap-2">
              <Signal className="w-3 h-3" />
              <Wifi className="w-3 h-3" />
              <Battery className="w-4 h-4" />
            </div>
          </div>

          <div className="relative h-full w-full overflow-hidden rounded-[55px] bg-black font-sans [clip-path:inset(0_round_55px)]">
            <AnimatePresence mode="wait">
              {activeChannel === "whatsapp" && (
                <motion.div
                  key="wa"
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -30, opacity: 0 }}
                  className="flex h-full w-full flex-col overflow-hidden rounded-[55px] bg-[#0b141a]"
                >
                  <div className="h-32 bg-[#1f2c34] flex items-end pb-4 px-5 shadow-2xl z-20 shrink-0 border-b border-white/5">
                    <div className="flex items-center gap-3 w-full">
                      <ChevronLeft className="w-7 h-7 text-[#00a884]" />
                      <div className="w-11 h-11 rounded-full bg-zinc-800 flex items-center justify-center text-white text-xs font-bold border border-white/10 shadow-inner">
                        NN
                      </div>
                      <div className="flex-1">
                        <p className="text-sm font-bold text-white leading-none">
                          NeuroNex
                        </p>
                        <p className="text-[9px] text-gray-500 mt-1.5 font-medium">
                          conta comercial
                        </p>
                      </div>
                      <Video className="w-5 h-5 text-[#00a884]" />
                      <Phone className="w-5 h-5 text-[#00a884] ml-3" />
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto bg-[radial-gradient(circle_at_18%_24%,rgba(255,255,255,0.035),transparent_30%),radial-gradient(circle_at_78%_72%,rgba(255,255,255,0.025),transparent_34%),#0b141a] p-5">
                    <div className="flex justify-center my-6">
                      <span className="bg-[#1f2c34]/80 backdrop-blur-md text-[#8696a0] text-[9px] px-4 py-1.5 rounded-xl font-bold uppercase tracking-wider border border-white/5 shadow-sm">
                        Hoje
                      </span>
                    </div>
                    <div className="bg-[#005c4b] p-4 rounded-3xl rounded-tr-none max-w-[85%] ml-auto shadow-2xl relative text-[13px] text-[#e9edef] leading-relaxed break-words border border-white/10">
                      <div className="whitespace-pre-wrap">
                        {renderPhonePreview(template || "...")}
                      </div>
                      <div className="flex justify-end items-center gap-1.5 mt-2 opacity-50">
                        <span className="text-[8px] font-bold">14:30</span>
                        <div className="text-[#53bdeb] text-[10px]">✓✓</div>
                      </div>
                    </div>
                  </div>

                  <div className="h-24 bg-[#1f2c34] flex items-center px-4 gap-3 shrink-0 pb-8 border-t border-white/5">
                    <Plus className="w-7 h-7 text-[#8696a0]" />
                    <div className="flex-1 h-11 bg-[#2a3942] rounded-2xl px-5 flex items-center text-[#8696a0] text-sm shadow-inner">
                      Mensagem
                    </div>
                    <div className="w-11 h-11 rounded-full bg-[#00a884] flex items-center justify-center shadow-xl shadow-emerald-900/40 transform active:scale-90 transition-transform">
                      <Mic className="w-5 h-5 text-white fill-white" />
                    </div>
                  </div>
                </motion.div>
              )}

              {activeChannel === "email" && (
                <motion.div
                  key="email"
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -30, opacity: 0 }}
                  className="flex h-full w-full flex-col overflow-hidden rounded-[55px] bg-black"
                >
                  <div className="h-32 pt-14 px-6 flex items-center justify-between bg-[#1c1c1e] border-b border-white/10 shrink-0">
                    <div className="flex items-center gap-1 text-blue-500 group cursor-pointer transition-colors hover:text-blue-400">
                      <ChevronLeft className="w-7 h-7" />
                      <span className="text-base font-medium">Entrada</span>
                    </div>
                  </div>

                  <div className="flex-1 overflow-y-auto p-8 bg-black">
                    <div className="flex justify-between items-start mb-8">
                      <div>
                        <h3 className="text-2xl font-bold text-white tracking-tight leading-tight">
                          Lembrete
                        </h3>
                        <div className="flex items-center gap-4 mt-4">
                          <div className="w-11 h-11 rounded-full bg-gradient-to-br from-zinc-800 to-zinc-900 flex items-center justify-center text-xs font-bold text-white border border-white/10 shadow-2xl">
                            NN
                          </div>
                          <div>
                            <p className="text-sm font-bold text-white">
                              NeuroNex{" "}
                              <span className="font-normal text-zinc-600">
                                &lt;contato@neuronex&gt;
                              </span>
                            </p>
                            <p className="text-[11px] text-zinc-500 mt-0.5 font-medium">
                              Para: Ana Clara
                            </p>
                          </div>
                        </div>
                      </div>
                      <span className="text-[11px] text-zinc-600 font-bold mt-2 uppercase tracking-wider">
                        Agora
                      </span>
                    </div>

                    <div className="w-full h-px bg-white/10 mb-8" />

                    <div className="text-[15px] text-zinc-400 leading-relaxed whitespace-pre-wrap font-sans">
                      {renderPhonePreview(template || "...")}
                    </div>

                    <div className="mt-10 p-4 bg-[#1c1c1e] rounded-2xl border border-white/10 w-fit flex gap-4 pr-10 shadow-xl transition-transform hover:scale-[1.02] cursor-pointer">
                      <div className="w-12 h-14 bg-zinc-800 rounded-lg flex items-center justify-center shadow-inner">
                        <CornerDownLeft className="w-5 h-5 text-zinc-600" />
                      </div>
                      <div className="flex-1 flex flex-col justify-center">
                        <p className="text-xs text-white font-bold tracking-tight">
                          Convite.ics
                        </p>
                        <p className="text-[10px] text-zinc-600 mt-1 font-bold uppercase">
                          Calendário • 2 KB
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="h-24 bg-[#1c1c1e] border-t border-white/10 flex items-center justify-center pb-8 shrink-0">
                    <p className="text-[10px] text-zinc-600 font-bold uppercase tracking-widest">
                      Atualizado agora
                    </p>
                  </div>
                </motion.div>
              )}

              {activeChannel === "marketing" && (
                <motion.div
                  key="marketing"
                  initial={{ x: 30, opacity: 0 }}
                  animate={{ x: 0, opacity: 1 }}
                  exit={{ x: -30, opacity: 0 }}
                  className="flex h-full w-full flex-col overflow-hidden rounded-[55px] bg-black"
                >
                  <div className="h-32 pt-14 px-5 flex flex-col items-center justify-center bg-[#1c1c1e]/90 backdrop-blur-2xl border-b border-white/10 shrink-0 z-20">
                    <div className="w-14 h-14 rounded-full bg-gradient-to-b from-zinc-600 to-zinc-800 flex items-center justify-center text-white text-xs font-bold mb-1.5 shadow-2xl scale-90 border border-white/5">
                      <User className="w-7 h-7 fill-current opacity-60" />
                    </div>
                    <span className="text-[10px] text-white/50 font-bold uppercase tracking-widest leading-none mt-1">
                      NeuroNex &gt;
                    </span>
                  </div>

                  <div className="flex-1 p-5 space-y-3 overflow-y-auto flex flex-col">
                    <div className="text-center py-6">
                      <span className="text-[10px] font-bold text-zinc-700 uppercase tracking-widest">
                        iMessage • Hoje 14:30
                      </span>
                    </div>

                    <div className="bg-[#262628] text-white p-4 px-5 rounded-3xl rounded-tl-sm max-w-[80%] self-start text-[14px] leading-snug shadow-xl">
                      <p>Olá! Tudo bem?</p>
                    </div>

                    <div className="bg-[#262628] text-white p-4 px-5 rounded-3xl rounded-tl-sm max-w-[80%] self-start text-[14px] leading-snug relative group shadow-2xl border border-white/10">
                      <div className="whitespace-pre-wrap">
                        {renderPhonePreview(template || "...")}
                      </div>
                    </div>

                    <div className="text-[10px] text-zinc-700 font-bold ml-3 uppercase tracking-tighter">
                      Entregue
                    </div>
                  </div>

                  <div className="h-24 bg-[#1c1c1e] flex items-center px-5 gap-3 shrink-0 pb-8 border-t border-white/10">
                    <div className="p-2 bg-zinc-800 rounded-full hover:bg-zinc-700 transition-colors shadow-inner">
                      <Plus className="w-5 h-5 text-zinc-500" />
                    </div>
                    <div className="flex-1 h-10 rounded-full border border-zinc-800 px-5 flex items-center text-xs text-zinc-600 bg-black shadow-inner font-medium">
                      iMessage
                    </div>
                    <div className="p-2 transform active:scale-95 transition-transform">
                      <Send className="w-6 h-6 text-blue-500 fill-current" />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <div className="absolute bottom-2.5 left-1/2 -translate-x-1/2 w-36 h-1.5 bg-white/15 rounded-full z-50 pointer-events-none" />
          </div>
        </motion.div>
      </div>
    </motion.div>
  );
};
