import { useRef, useState } from "react";
import { Baby, User, UserCheck, ArrowLeft, Info, Loader2, ChevronRight, Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogTitle } from "@/components/ui/dialog";
import { motion, useReducedMotion } from "framer-motion";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";

interface TemplateAnamnesisProps {
    onBack: () => void;
    onSuccess?: () => void;
}

const TEMPLATES = [
    {
        id: 'infantil',
        label: 'Anamnese Infantil',
        icon: Baby,
        description: 'Focada no desenvolvimento, gestação, parto, histórico escolar e dinâmica familiar.',
        color: 'from-zinc-500/10 to-zinc-700/10',
        borderColor: 'border-zinc-500/20',
        iconColor: 'text-zinc-700 dark:text-zinc-300',
        contentProfile: { type: 'infantil' },
        sections: [
            {
                title: 'Identificação',
                fields: ['Nome', 'Apelido', 'Data de Nascimento', 'Idade', 'Sexo', 'Naturalidade', 'Religião', 'Escolaridade', 'Endereço', 'Telefones']
            },
            {
                title: 'Filiação',
                fields: ['Pai (Nome, Profissão, Idade)', 'Mãe (Nome, Profissão, Idade)', 'Cuidador (Nome, Vínculo)', 'Telefones de contato']
            },
            {
                title: 'Motivo da Consulta',
                fields: ['Queixa principal', 'Histórico da queixa', 'Acompanhamento de saúde atual?', 'Fármacos em uso', 'Alergias']
            },
            {
                title: 'Concepção, Gestação e Parto',
                fields: ['Informações da concepção (planejada, reações)', 'Histórico da gestação (pré-natal, intercorrências)', 'Parto (tipo, complicações)', 'Intercorrências neonatais (incubadora, choro)']
            },
            {
                title: 'Desenvolvimento',
                fields: ['Controle cervical (pescoço)', 'Sentar', 'Andar', 'Fala', 'Controle de esfíncteres (anal/vesical)', 'Histórico de doenças/internações']
            },
            {
                title: 'Dinâmica familiar',
                fields: ['Com quem mora', 'Relacionamento dos pais', 'Relacionamento com a criança', 'Relacionamento com irmãos', 'Histórico familiar de transtornos']
            },
            {
                title: 'Vida Acadêmica',
                fields: ['Escola/Série', 'Repetência', 'Relacionamento com colegas', 'Relacionamento com professores', 'Habilidades/Déficits acadêmicos']
            },
            {
                title: 'Rotina e Hábitos',
                fields: ['Sono (horários, qualidade)', 'Alimentação (hábitos, histórico)', 'Lazer e Brincadeiras', 'Habilidades sociais']
            }
        ]
    },
    {
        id: 'adolescente',
        label: 'Anamnese Adolescente',
        icon: User,
        description: 'Abrange desenvolvimento, sexualidade, saúde, contexto escolar e vida social.',
        color: 'from-zinc-500/10 to-zinc-700/10',
        borderColor: 'border-zinc-500/20',
        iconColor: 'text-zinc-700 dark:text-zinc-300',
        sections: [
            {
                title: 'Identificação',
                fields: ['Nome', 'Idade', 'Data de Nascimento', 'Escolaridade', 'Mora com quem', 'Filiação (Pai/Mãe)']
            },
            {
                title: 'Motivo da Consulta',
                fields: ['Queixa principal', 'Histórico da queixa', 'Sintomas atuais']
            },
            {
                title: 'Histórico de Desenvolvimento',
                fields: ['Gestação (intercorrências)', 'Parto', 'Desenvolvimento motor/fala', 'Sono (qualidade, distúrbios)', 'Controle de esfíncteres']
            },
            {
                title: 'Sexualidade',
                fields: ['Curiosidade sexual', 'Orientação/Educação sexual', 'Menarca/Poluções noturnas', 'Sintomas associados']
            },
            {
                title: 'Histórico Médico',
                fields: ['Doenças da infância', 'Infecções/Alergias', 'Traumatismos/Convulsões', 'Dores de cabeça/Enxaquecas', 'Medicações em uso']
            },
            {
                title: 'Sistemas e Saúde Geral',
                fields: ['Sistema Uro-genital', 'Sistema Endócrino', 'Acompanhamentos (Neuro, Psi)', 'Histórico familiar de doenças']
            },
            {
                title: 'Ambiente Familiar e Social',
                fields: ['Relacionamento paterno/materno', 'Relacionamento com irmãos/outros', 'Vida social/Amigos', 'Lazer/Interesses']
            },
            {
                title: 'Escolaridade',
                fields: ['Desempenho atual', 'Dificuldades específicas', 'Relacionamento escolar', 'Comportamento']
            }
        ]
    },
    {
        id: 'adulto_idoso',
        label: 'Adulto e Idoso',
        icon: UserCheck,
        description: 'Foco em histórico clínico, profissional, relacionamentos, autonomia e saúde mental.',
        color: 'from-zinc-500/10 to-zinc-700/10',
        borderColor: 'border-zinc-500/20',
        iconColor: 'text-zinc-700 dark:text-zinc-300',
        sections: [
            {
                title: 'Identificação',
                fields: ['Nome', 'Idade', 'Estado Civil', 'Profissão', 'Escolaridade', 'Contatos']
            },
            {
                title: 'Queixa Principal',
                fields: ['Motivo da busca', 'Tempo de queixa', 'Histórico do problema atual', 'Tratamentos anteriores']
            },
            {
                title: 'Histórico Clínico',
                fields: ['Histórico Psiquiátrico/Psicológico', 'Medicações em uso', 'Doenças prévias/atuais', 'Histórico familiar (físico/mental)']
            },
            {
                title: 'Histórico Social e Familiar',
                fields: ['Composição familiar', 'Relacionamento familiar', 'Rede de apoio', 'Vida social/afetiva']
            },
            {
                title: 'Histórico Profissional',
                fields: ['Satisfação profissional', 'Relacionamentos no trabalho', 'Carreira/Aposentadoria']
            },
            {
                title: 'Hábitos e Estilo de Vida',
                fields: ['Qualidade do sono', 'Alimentação', 'Atividade física', 'Uso de substâncias']
            },
            {
                title: 'Avaliação Mental (Obs.)',
                fields: ['Aparência geral', 'Humor e afeto', 'Pensamento/Linguagem', 'Cognição/Memória', 'Insight']
            },
            {
                title: 'Conclusão',
                fields: ['Hipóteses diagnósticas', 'Plano terapêutico', 'Observações finais']
            }
        ]
    },
] as const;

export function TemplateAnamnesis({ onBack, onSuccess }: TemplateAnamnesisProps) {
    const { id: patientId } = useParams<{ id: string }>();
    const [selectedTemplate, setSelectedTemplate] = useState<typeof TEMPLATES[number] | null>(null);
    const [isSaving, setIsSaving] = useState(false);
    const lastTriggerRef = useRef<HTMLButtonElement | null>(null);
    const shouldReduceMotion = useReducedMotion();


    const handleConfirmTemplate = async () => {
        if (!selectedTemplate || !patientId) return;

        setIsSaving(true);
        try {
            const structuredContent: Array<{ question: string; answer: string; isSection?: boolean }> = [];

            selectedTemplate.sections.forEach(section => {
                structuredContent.push({
                    question: section.title,
                    answer: "",
                    isSection: true
                });

                section.fields.forEach(field => {
                    structuredContent.push({
                        question: field,
                        answer: ""
                    });
                });
            });

            // Strategy: Try to update existing record first, then insert if none exists.
            // This avoids UNIQUE constraint violations that occur when DELETE is silently
            // blocked by RLS policies.
            const { data: existingRecords } = await supabase
                .from('patient_anamneses')
                .select('id')
                .eq('patient_id', patientId);

            if (existingRecords && existingRecords.length > 0) {
                // Update the first existing record with new content
                const primaryRecord = existingRecords[0];
                const { error: updateError } = await supabase
                    .from('patient_anamneses')
                    .update({
                        type: 'template',
                        content: structuredContent
                    })
                    .eq('id', primaryRecord.id);

                if (updateError) throw updateError;

                // Clean up any duplicate records (best-effort, ignore errors)
                if (existingRecords.length > 1) {
                    await supabase
                        .from('patient_anamneses')
                        .delete()
                        .in('id', existingRecords.slice(1).map((record) => record.id));
                }
            } else {
                // No existing record — insert a new one
                const { error: insertError } = await supabase
                    .from('patient_anamneses')
                    .insert({
                        patient_id: patientId,
                        type: 'template',
                        content: structuredContent
                    });
                if (insertError) throw insertError;
            }

            toast.success("Modelo aplicado com sucesso.");
            if (onSuccess) onSuccess();

        } catch (error) {
            console.error(error);
            toast.error("Erro ao aplicar modelo.");
        } finally {
            setIsSaving(false);
        }
    };

    return (
        <div className="w-full h-full relative selection:bg-zinc-900/10 dark:selection:bg-white/10">
            <motion.div
                        key="selection-grid"
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 8 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.26, ease: [0.32, 0.72, 0, 1] }}
                        className="mx-auto max-w-6xl px-1 py-4 md:py-6"
                    >
                        <div className="mb-8 flex items-center gap-4">
                            <Button
                                onClick={onBack}
                                variant="ghost"
                                size="icon"
                                aria-label="Voltar à escolha de anamnese"
                                className="desktop-retina-inset desktop-retina-interactive h-11 w-11 rounded-2xl border border-border/45"
                            >
                                <ArrowLeft className="w-5 h-5 text-zinc-500" />
                            </Button>
                            <div>
                                <h2 className="text-3xl font-black text-zinc-900 dark:text-white tracking-tight leading-none mb-2">Modelos NeuroNex</h2>
                                <p className="text-sm text-zinc-500 font-bold uppercase tracking-widest leading-none">Selecione uma estrutura para iniciar</p>
                            </div>
                        </div>

                        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
                            {TEMPLATES.map((template) => (
                                <button
                                    type="button"
                                    key={template.id}
                                    className="desktop-retina-inset desktop-retina-interactive group relative h-full cursor-pointer overflow-hidden rounded-[28px] border border-border/45 bg-background/58 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/45"
                                    onClick={(event) => {
                                        lastTriggerRef.current = event.currentTarget;
                                        setSelectedTemplate(template);
                                    }}
                                >
                                    <div className="relative z-10 flex h-full flex-col space-y-6 p-6">
                                        <div className="flex h-12 w-12 items-center justify-center rounded-[18px] bg-foreground text-background shadow-sm">
                                            <template.icon className="h-5 w-5" />
                                        </div>

                                        <div className="space-y-4">
                                            <h3 className="text-xl font-black leading-tight tracking-tight text-foreground">
                                                {template.label}
                                            </h3>
                                            <p className="text-sm text-zinc-500 dark:text-zinc-400 font-medium leading-relaxed">
                                                {template.description}
                                            </p>
                                        </div>

                                        <div className="mt-auto flex items-center justify-between border-t border-border/45 pt-5">
                                            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-muted-foreground transition-colors group-hover:text-foreground">Ver estrutura</span>
                                            <div className="desktop-retina-inset flex h-9 w-9 items-center justify-center rounded-xl border border-border/45">
                                                <ChevronRight className="w-5 h-5" />
                                            </div>
                                        </div>
                                    </div>
                                </button>
                            ))}
                        </div>
            </motion.div>
            <Dialog open={Boolean(selectedTemplate)} onOpenChange={(open) => { if (!open) setSelectedTemplate(null); }}>
                {selectedTemplate ? (
                        <DialogContent
                            onCloseAutoFocus={(event) => {
                                event.preventDefault();
                                lastTriggerRef.current?.focus();
                            }}
                            className="desktop-retina-modal desktop-retina-form z-[210] flex h-[min(860px,calc(100dvh-2rem))] w-[calc(100%-2rem)] max-w-6xl flex-col gap-0 overflow-hidden rounded-[34px] border border-border/60 bg-background/96 p-0 shadow-2xl"
                        >

                            {/* Modal Header - Reduced height and added Confirm button */}
                            <div className="relative z-10 flex shrink-0 items-center justify-between border-b border-border/50 bg-muted/18 p-5 md:p-6">
                                <div className="flex items-center gap-6">
                                    <div className="w-16 h-16 rounded-2xl bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-zinc-900 shadow-xl">
                                        <selectedTemplate.icon className="w-8 h-8" />
                                    </div>
                                    <div>
                                        <DialogTitle className="mb-2 text-2xl font-black leading-none tracking-tighter text-zinc-900 dark:text-white">
                                            {selectedTemplate.label}
                                        </DialogTitle>
                                        <DialogDescription className="sr-only">
                                            Visualização dos campos do modelo antes de aplicá-lo ao prontuário.
                                        </DialogDescription>
                                        <div className="flex items-center gap-3">
                                            <span className="rounded-lg border border-zinc-200/50 bg-zinc-100 px-3 py-1 text-[9px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:border-zinc-800 dark:bg-zinc-900/75">
                                                Visualização
                                            </span>
                                            <p className="text-[11px] text-zinc-500 font-bold uppercase tracking-widest">
                                                {selectedTemplate.sections.length} Seções
                                            </p>
                                        </div>
                                    </div>
                                </div>

                            </div>

                            {/* Modal Content - Preview */}
                            <div className="custom-scrollbar relative z-10 min-h-0 flex-1 overflow-y-auto overscroll-contain p-6 [contain:layout_paint_style] [scrollbar-gutter:stable] md:p-8">
                                <div className="mx-auto max-w-5xl space-y-10">
                                    <div className="desktop-retina-inset relative flex gap-5 overflow-hidden rounded-[26px] border border-border/45 bg-muted/24 p-6">
                                        <div className="w-14 h-14 shrink-0 rounded-2xl bg-zinc-900 dark:bg-white flex items-center justify-center text-white dark:text-zinc-900 relative z-10">
                                            <Info className="w-7 h-7" />
                                        </div>
                                        <div className="relative z-10">
                                            <p className="text-lg font-black text-zinc-900 dark:text-white tracking-tight mb-2">
                                                Guia do modelo
                                            </p>
                                            <p className="text-base text-zinc-500 dark:text-zinc-400 leading-relaxed font-medium">
                                                {selectedTemplate.description} Esta estrutura foi validada por especialistas e contém todos os campos necessários para uma avaliação completa.
                                            </p>
                                        </div>
                                    </div>

                                    <div className="space-y-12">
                                        {selectedTemplate.sections.map((section, idx) => (
                                            <div key={idx} className="space-y-6" style={{ contentVisibility: "auto", containIntrinsicSize: "420px" }}>
                                                <div className="flex items-center gap-6">
                                                    <span className="text-5xl font-black text-zinc-100 dark:text-white/5 tracking-tighter tabular-nums">
                                                        {(idx + 1).toString().padStart(2, '0')}
                                                    </span>
                                                    <h4 className="text-2xl font-black text-zinc-900 dark:text-white tracking-tight">
                                                        {section.title}
                                                    </h4>
                                                    <div className="h-px flex-1 bg-gradient-to-r from-zinc-200/70 to-transparent dark:from-zinc-800/75" />
                                                </div>
                                                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                                                    {section.fields.map((field, fIdx) => (
                                                        <div key={fIdx} className="desktop-retina-inset group relative rounded-[20px] border border-border/40 bg-background/58 p-5 transition-colors hover:border-border/75 hover:bg-background/78">
                                                            <div className="flex items-center gap-4">
                                                                <div className="w-2 h-2 rounded-full bg-zinc-200 dark:bg-zinc-700 group-hover:bg-zinc-900 dark:group-hover:bg-white transition-colors" />
                                                                <span className="text-sm font-bold text-zinc-600 dark:text-zinc-300">
                                                                    {field}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    ))}
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                    <div className="h-20" />
                                </div>
                            </div>

                            {/* Modal Footer */}
                            <div className="relative z-10 flex shrink-0 justify-end gap-3 border-t border-border/50 bg-muted/18 p-4 md:p-5">
                                <Button
                                    variant="outline"
                                    onClick={() => setSelectedTemplate(null)}
                                    className="desktop-retina-interactive h-11 rounded-xl px-6 text-[10px] font-black uppercase tracking-widest"
                                >
                                    Voltar
                                </Button>
                                <Button
                                    onClick={handleConfirmTemplate}
                                    disabled={isSaving}
                                    className="desktop-retina-interactive h-11 rounded-xl bg-foreground px-7 text-[10px] font-black uppercase tracking-widest text-background shadow-sm"
                                >
                                    {isSaving ? <Loader2 className="w-6 h-6 animate-spin" /> : <Check className="w-6 h-6" />}
                                    Aplicar modelo
                                </Button>
                            </div>
                        </DialogContent>
                ) : null}
            </Dialog>
        </div>
    );
}
