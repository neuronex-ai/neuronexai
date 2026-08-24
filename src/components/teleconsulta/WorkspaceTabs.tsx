import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { NotebookPen, Sparkles, Paperclip } from "lucide-react";
import { WorkspaceNotePanel } from "./panels/WorkspaceNotePanel";
import { SummaryPanel } from "./panels/SummaryPanel";
import { AttachmentsPanel } from "./panels/AttachmentsPanel";
import { motion, AnimatePresence } from "framer-motion";

interface WorkspaceTabsProps {
  patientId: string;
  patientName: string;
}

const AnimatedWrapper = ({ children }: { children: React.ReactNode }) => (
  <motion.div
    initial={{ opacity: 0, scale: 0.95, y: 10 }}
    animate={{ opacity: 1, scale: 1, y: 0 }}
    exit={{ opacity: 0, scale: 0.95, y: -10 }}
    transition={{ duration: 0.4, ease: [0.32, 0.72, 0, 1] }}
    className="h-full w-full"
  >
    {children}
  </motion.div>
);

export const WorkspaceTabs = ({ patientId, patientName }: WorkspaceTabsProps) => {
  return (
    <div className="flex-1 bg-white/40 dark:bg-[#050505]/40 backdrop-blur-[40px] border border-white/20 dark:border-white/5 shadow-[0_8px_32px_0_rgba(31,38,135,0.07)] dark:shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] rounded-[40px] flex flex-col overflow-hidden relative group">
      <Tabs magnetic defaultValue="workspace" className="flex flex-col h-full relative z-10">
        <div className="px-8 pt-8 pb-4">
          <TabsList className="grid w-full grid-cols-3 bg-black/5 dark:bg-white/5 p-1.5 rounded-full border border-black/5 dark:border-white/5">
            <TabsTrigger
              value="workspace"
              className="rounded-full text-[10px] uppercase font-bold tracking-wider data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-300 ease-apple"
            >
              <div className="flex items-center gap-2">
                <NotebookPen className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Notas de Sessão</span>
              </div>
            </TabsTrigger>
            <TabsTrigger
              value="summary"
              className="rounded-full text-[10px] uppercase font-bold tracking-wider data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-300 ease-apple"
            >
              <div className="flex items-center gap-2">
                <Sparkles className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Synapse AI</span>
              </div>
            </TabsTrigger>
            <TabsTrigger
              value="attachments"
              className="rounded-full text-[10px] uppercase font-bold tracking-wider data-[state=active]:bg-white dark:data-[state=active]:bg-zinc-800 data-[state=active]:text-zinc-900 dark:data-[state=active]:text-white data-[state=active]:shadow-sm transition-all duration-300 ease-apple"
            >
              <div className="flex items-center gap-2">
                <Paperclip className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Anexos</span>
              </div>
            </TabsTrigger>
          </TabsList>
        </div>

        <div className="flex-1 mt-0 p-8 pt-4 h-full overflow-hidden relative">
          <AnimatePresence mode="wait">
            <TabsContent value="workspace" className="h-full mt-0 m-0 p-0 outline-none">
              <AnimatedWrapper key="workspace">
                <WorkspaceNotePanel patientId={patientId} patientName={patientName} />
              </AnimatedWrapper>
            </TabsContent>
            <TabsContent value="summary" className="h-full mt-0 m-0 p-0 outline-none">
              <AnimatedWrapper key="summary">
                <SummaryPanel patientId={patientId} />
              </AnimatedWrapper>
            </TabsContent>
            <TabsContent value="attachments" className="h-full mt-0 m-0 p-0 outline-none">
              <AnimatedWrapper key="attachments">
                <AttachmentsPanel patientId={patientId} />
              </AnimatedWrapper>
            </TabsContent>
          </AnimatePresence>
        </div>
      </Tabs>
    </div>
  );
};
