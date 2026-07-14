import { lazy, Suspense, useCallback, useEffect, useState } from "react";
import { RouteSelection } from "./RouteSelection";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { useParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Loader2 } from "lucide-react";

const ImportAnamnesis = lazy(() =>
    import("./ImportAnamnesis").then((module) => ({ default: module.ImportAnamnesis }))
);
const TemplateAnamnesis = lazy(() =>
    import("./TemplateAnamnesis").then((module) => ({ default: module.TemplateAnamnesis }))
);
const ViewAnamnesis = lazy(() =>
    import("./ViewAnamnesis").then((module) => ({ default: module.ViewAnamnesis }))
);
const DocumentUploadPanel = lazy(() =>
    import("@/components/documents/DocumentUploadPanel").then((module) => ({ default: module.DocumentUploadPanel }))
);

const AnamnesisLoadingState = () => (
    <div className="w-full min-h-[400px] flex items-center justify-center">
        <Loader2 className="w-8 h-8 text-zinc-300 dark:text-zinc-600 animate-spin" />
    </div>
);

const hasValidAnamnesisContent = (content: unknown) => {
    if (Array.isArray(content)) return content.length > 0;
    if (!content || typeof content !== "object") return false;

    const fields = (content as { fields?: Record<string, unknown> }).fields;
    return Boolean(fields && Object.keys(fields).length > 0);
};

export function AnamnesisTab() {
    const { id: patientId } = useParams<{ id: string }>();
    const [currentStep, setCurrentStep] = useState<'loading' | 'selection' | 'import' | 'template' | 'view'>('loading');
    const [viewKey, setViewKey] = useState(0);
    const shouldReduceMotion = useReducedMotion();

    const checkExistingAnamnesis = useCallback(async () => {
        if (!patientId) return;
        try {
            const { data: records, error } = await supabase
                .from('patient_anamneses')
                .select('id, content')
                .eq('patient_id', patientId);

            if (error) throw error;

            const validRecord = records?.find((record) => hasValidAnamnesisContent(record.content));

            if (validRecord) {
                const emptyRecords = records?.filter(
                    r => r.id !== validRecord.id && !hasValidAnamnesisContent(r.content)
                );
                if (emptyRecords && emptyRecords.length > 0) {
                    await supabase.from('patient_anamneses').delete().in('id', emptyRecords.map((record) => record.id));
                }
                setCurrentStep('view');
            } else {
                if (records && records.length > 0) {
                    await supabase.from('patient_anamneses').delete().in('id', records.map((record) => record.id));
                }
                setCurrentStep('selection');
            }
        } catch (error) {
            console.error(error);
            setCurrentStep('selection');
        }
    }, [patientId]);

    useEffect(() => {
        void checkExistingAnamnesis();
    }, [checkExistingAnamnesis]);

    const handleBack = () => {
        void checkExistingAnamnesis();
    };

    const handleSuccess = () => {
        setViewKey(k => k + 1);
        setCurrentStep('view');
    };

    if (currentStep === 'loading') {
        return <AnamnesisLoadingState />;
    }

    return (
        <div className="relative min-h-[600px] min-w-0 w-full pb-10">
            <Suspense fallback={<AnamnesisLoadingState />}>
                <AnimatePresence mode="wait">

                {currentStep === 'selection' && (
                    <motion.div
                        key="selection"
                        initial={shouldReduceMotion ? false : { opacity: 0, y: 6 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
                    >
                        <RouteSelection onSelectRoute={setCurrentStep} />
                    </motion.div>
                )}

                {currentStep === 'import' && (
                    <motion.div
                        key="import"
                        initial={shouldReduceMotion ? false : { opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
                    >
                        <ImportAnamnesis onBack={handleBack} onSuccess={handleSuccess} />
                    </motion.div>
                )}

                {currentStep === 'template' && (
                    <motion.div
                        key="template"
                        initial={shouldReduceMotion ? false : { opacity: 0, x: 10 }}
                        animate={{ opacity: 1, x: 0 }}
                        exit={{ opacity: 0, x: -8 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.24, ease: [0.32, 0.72, 0, 1] }}
                    >
                        <TemplateAnamnesis onBack={handleBack} onSuccess={handleSuccess} />
                    </motion.div>
                )}

                {currentStep === 'view' && (
                    <motion.div
                        key={`view-${viewKey}`}
                        initial={shouldReduceMotion ? false : { opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={shouldReduceMotion ? { duration: 0 } : { duration: 0.2 }}
                        className="h-full space-y-6"
                    >
                        <ViewAnamnesis
                            onChangeTemplate={() => setCurrentStep('template')}
                            onResetToSelection={() => setCurrentStep('selection')}
                        />
                        <DocumentUploadPanel
                            patientId={patientId}
                            category="patient_attachment"
                            title="Documentos do prontuário"
                            description="Armazene documentos privados deste paciente no cofre de arquivos da NeuroNex."
                        />
                    </motion.div>
                )}

                </AnimatePresence>
            </Suspense>
        </div>
    );
}
