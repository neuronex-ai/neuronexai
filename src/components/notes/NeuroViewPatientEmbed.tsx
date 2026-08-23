"use client";

import { useAuth } from "@/components/auth/SessionContextProvider";
import { supabase } from "@/integrations/supabase/client";
import { noteExcerpt } from "@/lib/note-content";
import { cn } from "@/lib/utils";
import { Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

type EmbedNote = {
  id: string;
  title: string | null;
  content: string | null;
  tags: string[] | null;
  updated_at: string;
};

type EmbedState = {
  isLoading: boolean;
  patientName: string;
  notes: EmbedNote[];
  error?: string;
};

const tagKey = (tag: string) => tag.toLowerCase().trim();

export const NeuroViewPatientEmbed = ({
  patientId,
  patientName,
}: {
  patientId?: string | null;
  patientName?: string | null;
}) => {
  const { user } = useAuth();
  const [state, setState] = useState<EmbedState>({
    isLoading: false,
    patientName: patientName || "",
    notes: [],
  });

  useEffect(() => {
    if (!patientId || !user?.id) {
      setState({
        isLoading: false,
        patientName: patientName || "",
        notes: [],
      });
      return;
    }

    let isMounted = true;
    setState((current) => ({ ...current, isLoading: true, error: undefined }));

    const load = async () => {
      const [notesResult, patientResult] = await Promise.all([
        supabase
          .from("personal_notes")
          .select("id,title,content,tags,updated_at")
          .eq("user_id", user.id)
          .eq("patient_id", patientId)
          .order("updated_at", { ascending: false })
          .limit(8),
        supabase
          .from("patients")
          .select("name")
          .eq("id", patientId)
          .maybeSingle(),
      ]);

      if (!isMounted) return;

      if (notesResult.error) {
        setState({
          isLoading: false,
          patientName: patientName || patientResult.data?.name || "",
          notes: [],
          error: "Nao foi possivel carregar o NeuroVision do paciente.",
        });
        return;
      }

      setState({
        isLoading: false,
        patientName: patientResult.data?.name || patientName || "Paciente",
        notes: notesResult.data || [],
      });
    };

    void load();

    return () => {
      isMounted = false;
    };
  }, [patientId, patientName, user?.id]);

  const graph = useMemo(() => {
    const notes = state.notes.slice(0, 6);
    const tags = Array.from(
      new Set(notes.flatMap((note) => (note.tags || []).slice(0, 2).map(tagKey)).filter(Boolean)),
    ).slice(0, 5);

    const noteNodes = notes.map((note, index) => {
      const row = index % 3;
      const col = Math.floor(index / 3);
      return {
        id: note.id,
        label: note.title || "Nota sem titulo",
        excerpt: noteExcerpt(note.content || "", 70),
        x: 178 + col * 104,
        y: 58 + row * 58,
      };
    });

    const tagNodes = tags.map((tag, index) => ({
      id: tag,
      label: `#${tag}`,
      x: 374,
      y: 42 + index * 38,
    }));

    return { noteNodes, tagNodes };
  }, [state.notes]);

  if (!patientId) {
    return (
      <div className="nodrag nowheel mt-4 rounded-[24px] border border-zinc-200 bg-zinc-50 p-5 text-[11px] font-bold uppercase tracking-[0.14em] text-zinc-500 dark:border-white/5 dark:bg-white/[0.025] dark:text-zinc-600">
        Vincule este fluxo a um paciente para renderizar o NeuroVision filtrado.
      </div>
    );
  }

  if (state.isLoading) {
    return (
      <div className="nodrag nowheel mt-4 flex h-[240px] items-center justify-center rounded-[26px] border border-zinc-200 bg-zinc-50 dark:border-white/5 dark:bg-white/[0.025]">
        <Loader2 className="h-5 w-5 animate-spin text-zinc-400 dark:text-zinc-600" />
      </div>
    );
  }

  return (
    <div className="nodrag nowheel mt-4 overflow-hidden rounded-[26px] border border-zinc-200 bg-zinc-50/90 text-zinc-900 shadow-inner dark:border-white/5 dark:bg-black/35 dark:text-white">
      <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3 dark:border-white/5">
        <div className="min-w-0">
          <p className="truncate text-[11px] font-black uppercase tracking-[0.22em] text-zinc-500 dark:text-zinc-600">
            NeuroVision filtrado
          </p>
          <p className="truncate text-sm font-black">{state.patientName || "Paciente"}</p>
        </div>
        <div className="rounded-full border border-zinc-200 px-2.5 py-1 text-[9px] font-black uppercase tracking-[0.16em] text-zinc-500 dark:border-white/10 dark:text-zinc-500">
          {state.notes.length} notas
        </div>
      </div>

      <div className="relative h-[230px] overflow-hidden">
        <div className="absolute inset-0 bg-[radial-gradient(circle_at_28%_38%,rgba(255,255,255,0.76),transparent_28%),linear-gradient(135deg,rgba(24,24,27,0.035),transparent_55%)] dark:bg-[radial-gradient(circle_at_28%_38%,rgba(255,255,255,0.075),transparent_30%),linear-gradient(135deg,rgba(255,255,255,0.025),transparent_58%)]" />

        {state.error ? (
          <div className="relative z-10 flex h-full items-center justify-center px-8 text-center text-[11px] font-bold leading-relaxed text-zinc-500 dark:text-zinc-500">
            {state.error}
          </div>
        ) : state.notes.length === 0 ? (
          <div className="relative z-10 flex h-full items-center justify-center px-8 text-center text-[11px] font-bold leading-relaxed text-zinc-500 dark:text-zinc-500">
            Nenhuma nota vinculada a este paciente ainda.
          </div>
        ) : (
          <svg className="relative z-10 h-full w-full" viewBox="0 0 430 230" role="img" aria-label="Mini NeuroVision do paciente">
            <defs>
              <filter id="neuroview-embed-glow" x="-50%" y="-50%" width="200%" height="200%">
                <feGaussianBlur stdDeviation="3.5" result="blur" />
                <feMerge>
                  <feMergeNode in="blur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {graph.noteNodes.map((note) => (
              <path
                key={`patient-${note.id}`}
                d={`M 70 115 C 112 115, 124 ${note.y}, ${note.x - 18} ${note.y}`}
                fill="none"
                stroke="currentColor"
                strokeOpacity="0.2"
                strokeWidth="1.6"
                strokeDasharray="5 7"
              />
            ))}

            {graph.noteNodes.flatMap((note) =>
              (state.notes.find((item) => item.id === note.id)?.tags || [])
                .slice(0, 2)
                .map(tagKey)
                .filter((tag) => graph.tagNodes.some((node) => node.id === tag))
                .map((tag) => {
                  const target = graph.tagNodes.find((node) => node.id === tag)!;
                  return (
                    <path
                      key={`${note.id}-${tag}`}
                      d={`M ${note.x + 24} ${note.y} C ${note.x + 58} ${note.y}, ${target.x - 42} ${target.y}, ${target.x - 12} ${target.y}`}
                      fill="none"
                      stroke="currentColor"
                      strokeOpacity="0.13"
                      strokeWidth="1"
                    />
                  );
                }),
            )}

            <g filter="url(#neuroview-embed-glow)">
              <circle cx="70" cy="115" r="28" className="fill-zinc-950 dark:fill-white" />
              <circle cx="70" cy="115" r="36" fill="none" stroke="currentColor" strokeOpacity="0.14" />
              <text x="70" y="119" textAnchor="middle" className="fill-white text-[10px] font-black uppercase dark:fill-zinc-950">
                Pac
              </text>
            </g>

            {graph.noteNodes.map((note) => (
              <g key={note.id}>
                <circle cx={note.x} cy={note.y} r="18" className="fill-zinc-900 dark:fill-zinc-100" />
                <circle cx={note.x} cy={note.y} r="24" fill="none" stroke="currentColor" strokeOpacity="0.12" />
                <text x={note.x + 30} y={note.y - 3} className="fill-zinc-950 text-[11px] font-black dark:fill-white">
                  {note.label.slice(0, 22)}
                </text>
                <text x={note.x + 30} y={note.y + 12} className="fill-zinc-500 text-[8px] font-semibold dark:fill-zinc-600">
                  {note.excerpt.slice(0, 34)}
                </text>
              </g>
            ))}

            {graph.tagNodes.map((tag) => (
              <g key={tag.id}>
                <circle cx={tag.x} cy={tag.y} r="8" className="fill-zinc-400 dark:fill-zinc-700" />
                <text x={tag.x + 14} y={tag.y + 3} className="fill-zinc-500 text-[8px] font-black uppercase dark:fill-zinc-600">
                  {tag.label.slice(0, 14)}
                </text>
              </g>
            ))}
          </svg>
        )}
      </div>

      <div className={cn(
        "grid border-t border-zinc-200 dark:border-white/5",
        state.notes.length > 1 ? "grid-cols-2" : "grid-cols-1",
      )}>
        {state.notes.slice(0, 2).map((note) => (
          <div key={note.id} className="min-w-0 border-r border-zinc-200 px-4 py-3 last:border-r-0 dark:border-white/5">
            <p className="truncate text-[11px] font-black">{note.title || "Nota sem titulo"}</p>
            <p className="mt-1 line-clamp-2 text-[9px] font-semibold leading-relaxed text-zinc-500 dark:text-zinc-600">
              {noteExcerpt(note.content || "", 82) || "Sem conteudo textual."}
            </p>
          </div>
        ))}
      </div>
    </div>
  );
};

export const NeuroVisionPatientEmbed = NeuroViewPatientEmbed;
