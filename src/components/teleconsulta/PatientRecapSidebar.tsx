import { Skeleton } from '@/components/ui/skeleton';
import { supabase } from '@/integrations/supabase/client';
import { cn } from '@/lib/utils';
import type { AISummary } from '@/types';
import { useQuery } from '@tanstack/react-query';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { BrainCircuit, CalendarClock, CircleDot, Sparkles } from 'lucide-react';

interface PatientRecapSidebarProps {
  patientId?: string | null;
  patientName?: string;
  className?: string;
}

interface RecapNote {
  id: string;
  created_at: string;
  ai_summary: AISummary | null;
}

export const PatientRecapSidebar = ({
  patientId,
  patientName,
  className,
}: PatientRecapSidebarProps) => {
  const { data: lastNote, isLoading } = useQuery({
    queryKey: ['teleconsultation-patient-recap', patientId],
    enabled: Boolean(patientId),
    staleTime: 5 * 60 * 1000,
    gcTime: 30 * 60 * 1000,
    refetchOnWindowFocus: false,
    queryFn: async () => {
      if (!patientId) return null;
      const { data, error } = await supabase
        .from('session_notes')
        .select('id, created_at, ai_summary')
        .eq('patient_id', patientId)
        .not('ai_summary', 'is', null)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (error) throw error;
      return data as RecapNote | null;
    },
  });

  if (!patientId) return null;

  const summary = lastNote?.ai_summary;
  const topics = summary?.topics?.filter(Boolean).slice(0, 4) || [];
  const firstName = patientName?.trim().split(/\s+/)[0] || 'paciente';

  return (
    <section className={cn('teleconsultation-surface flex h-full min-h-0 flex-col overflow-hidden rounded-[32px]', className)}>
      <header className="shrink-0 border-b border-border/40 px-6 py-6 dark:border-white/[0.045] sm:px-7 sm:py-7">
        <div className="flex items-center gap-2.5 text-muted-foreground">
          <div className="flex h-8 w-8 items-center justify-center rounded-[12px] border border-border/45 bg-foreground/[0.035] dark:border-white/[0.05]">
            <BrainCircuit className="h-4 w-4" aria-hidden="true" />
          </div>
          <span className="text-[9px] font-black uppercase tracking-[0.22em]">Synapse · contexto</span>
        </div>
        <h2 className="mt-6 text-2xl font-black leading-tight tracking-[-0.045em] text-foreground">
          Última sessão com <span className="text-muted-foreground">{firstName}</span>
        </h2>
        {lastNote ? (
          <div className="mt-5 flex flex-wrap gap-2.5">
            <span className="teleconsultation-inset inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.11em] text-muted-foreground">
              <CalendarClock className="h-3.5 w-3.5" aria-hidden="true" />
              {format(new Date(lastNote.created_at), "dd 'de' MMMM", { locale: ptBR })}
            </span>
            <span className="teleconsultation-inset rounded-full px-3 py-1.5 text-[9px] font-bold uppercase tracking-[0.11em] text-muted-foreground">
              {summary?.sentiment || 'Neutro'}
            </span>
          </div>
        ) : null}
      </header>

      <div className="teleconsultation-scroll min-h-0 flex-1 overflow-y-auto p-6 sm:p-7" aria-live="polite">
        {isLoading ? (
          <div className="space-y-4" role="status" aria-label="Carregando contexto clínico">
            <Skeleton className="h-36 rounded-[22px]" />
            <Skeleton className="h-16 rounded-[18px]" />
            <Skeleton className="h-16 rounded-[18px]" />
          </div>
        ) : !lastNote ? (
          <div className="flex min-h-64 flex-col items-center justify-center rounded-[24px] border border-dashed border-border/55 px-6 text-center dark:border-white/[0.06]">
            <Sparkles className="h-6 w-6 text-muted-foreground/40" aria-hidden="true" />
            <h3 className="mt-4 text-sm font-bold text-foreground">Contexto ainda indisponível</h3>
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">
              O resumo aparecerá aqui depois da primeira sessão revisada.
            </p>
          </div>
        ) : (
          <div className="space-y-6">
            <section aria-labelledby="recap-summary-title">
              <p id="recap-summary-title" className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                Síntese profissional
              </p>
              <div className="teleconsultation-inset mt-4 rounded-[22px] p-5">
                <p className="text-sm font-medium leading-7 text-foreground/82">
                  {summary?.summary || 'Ainda não há uma síntese clínica disponível.'}
                </p>
              </div>
            </section>

            <section aria-labelledby="recap-topics-title">
              <p id="recap-topics-title" className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground">
                Pontos de atenção
              </p>
              <div className="mt-4 space-y-3">
                {topics.length ? topics.map((topic, index) => (
                  <div key={`${topic}-${index}`} className="teleconsultation-inset flex items-start gap-3.5 rounded-[19px] px-[18px] py-4">
                    <span className="mt-0.5 text-[9px] font-black text-muted-foreground">0{index + 1}</span>
                    <p className="text-xs font-semibold leading-relaxed text-foreground/80">{topic}</p>
                  </div>
                )) : (
                  <p className="rounded-[18px] border border-dashed border-border/50 px-4 py-6 text-center text-xs text-muted-foreground">
                    Nenhum ponto destacado no resumo.
                  </p>
                )}
              </div>
            </section>

            <div className="flex items-start gap-3 rounded-[18px] border border-border/40 px-4 py-3.5 text-xs leading-relaxed text-muted-foreground dark:border-white/[0.045]">
              <CircleDot className="mt-0.5 h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              Confirme se os pontos da sessão anterior continuam relevantes antes de utilizá-los no atendimento atual.
            </div>
          </div>
        )}
      </div>
    </section>
  );
};
