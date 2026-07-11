import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Button } from "@/components/ui/button";
import { Scale, CheckCircle2, Globe, ShieldCheck, Lock, Info, Trash2 } from "lucide-react";

interface TermsOfUseModalProps {
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
}

export const TermsOfUseModal = ({ isOpen, onOpenChange }: TermsOfUseModalProps) => {
  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="finance-modal-surface max-w-4xl max-h-[90vh] p-0 overflow-hidden bg-white dark:bg-zinc-950 rounded-[32px] border-zinc-200 dark:border-white/10 shadow-2xl">
        <DialogHeader className="finance-separator p-8 border-b border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/50">
          <div className="flex items-center gap-4">
            <div className="w-12 h-12 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 flex items-center justify-center">
              <Scale className="w-6 h-6" />
            </div>
            <div>
              <DialogTitle className="text-xl font-black uppercase tracking-tight">Termos de Uso</DialogTitle>
              <DialogDescription className="text-xs text-zinc-500 font-medium">
                Última atualização: 13 de Fevereiro de 2026
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <ScrollArea className="flex-1 p-8 h-[60vh]">
          <div className="space-y-12 pb-8">
            {/* Intro */}
            <div className="space-y-4">
              <p className="text-sm text-zinc-600 dark:text-zinc-400 leading-relaxed">
                Ao utilizar o NeuroNex, você declara ser um profissional devidamente habilitado por seu respectivo conselho de classe. 
                O uso indevido da plataforma por não-profissionais poderá resultar em cancelamento imediato sem aviso prévio.
              </p>
            </div>

            {/* General Sections */}
            <div className="space-y-8">
              {[
                { 
                  icon: CheckCircle2, 
                  title: "Aceitação dos Termos", 
                  content: "Ao acessar e utilizar a plataforma NeuroNex, você concorda com estes Termos de Uso, nossa Política de Privacidade e a Política de Cookies. Caso não concorde com alguma disposição, você deve cessar o uso da plataforma imediatamente." 
                },
                { 
                  icon: ShieldCheck, 
                  title: "NeuroFinance & Asaas", 
                  content: "NeuroFinance é a interface de produto da NeuroNex para fluxos financeiros. Os serviços financeiros, contas, recursos, Pix, boletos, cartões e repasses contratados são prestados pela Asaas Instituição de Pagamento S.A. A NeuroNex atua como plataforma tecnológica e não é banco nem instituição de pagamento." 
                },
                { 
                  icon: Info, 
                  title: "Soberania Clínica", 
                  content: "A NeuroNex fornece ferramentas de gestão e suporte por IA. A responsabilidade por qualquer diagnóstico, prescrição ou conduta clínica é exclusivamente sua, o profissional habilitado." 
                }
              ].map((item, i) => (
                <div key={i} className="flex gap-4 group">
                  <div className="p-2 bg-zinc-100 dark:bg-zinc-900 rounded-lg h-fit group-hover:bg-zinc-900 dark:group-hover:bg-white group-hover:text-white dark:group-hover:text-zinc-900 transition-colors">
                    <item.icon className="w-4 h-4" />
                  </div>
                  <div className="space-y-2">
                    <h4 className="text-sm font-bold text-zinc-900 dark:text-white uppercase tracking-tight">{item.title}</h4>
                    <p className="text-xs text-zinc-500 dark:text-zinc-400 leading-relaxed">{item.content}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* Google Integration */}
            <div className="p-6 rounded-2xl bg-zinc-50 dark:bg-zinc-900/50 border border-zinc-100 dark:border-white/5 space-y-4">
              <div className="flex items-center gap-2 mb-2">
                <Globe className="w-4 h-4 text-zinc-400" />
                <span className="text-[10px] uppercase font-bold tracking-widest text-zinc-500">Uso de Dados do Google</span>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                A NeuroNex integra com serviços do Google para fornecer funcionalidades essenciais. Os dados são acessados exclusivamente para autenticação e sincronização de agenda, seguindo rigorosamente a política de Uso Limitado da API do Google.
              </p>
            </div>

            {/* Verification & KYC */}
            <div className="space-y-6">
              <div className="flex items-center gap-2">
                <Lock className="w-4 h-4 text-zinc-400" />
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white">Verificação e Compliance (KYC)</h3>
              </div>
              <div className="space-y-4">
                <p className="text-xs text-zinc-500 leading-relaxed">
                  Para utilizar o NeuroFinance, você concorda em fornecer informações verídicas e atualizadas para fins de verificação de identidade, conforme exigido por regulamentações financeiras nacionais e internacionais.
                </p>
                <div className="grid gap-3">
                  {[
                    "Identificação Pessoal (CPF, Documentos com foto)",
                    "Endereço Residencial e Comercial",
                    "Dados Bancários de Mesma Titularidade",
                    "Declaração de Pessoa Politicamente Exposta (PEP)"
                  ].map((item, i) => (
                    <div key={i} className="flex items-center gap-2 px-3 py-2 bg-zinc-50 dark:bg-zinc-900/30 rounded-lg border border-zinc-100 dark:border-white/5 text-[10px] text-zinc-600 dark:text-zinc-400">
                      <div className="w-1 h-1 rounded-full bg-zinc-400" />
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            {/* Retention */}
            <div className="space-y-4">
              <div className="flex items-center gap-2">
                <Trash2 className="w-4 h-4 text-zinc-400" />
                <h3 className="text-xs font-black uppercase tracking-widest text-zinc-900 dark:text-white">Exclusão de Dados</h3>
              </div>
              <p className="text-xs text-zinc-500 leading-relaxed">
                Você pode solicitar a exclusão de seus dados a qualquer momento. Dados transacionais financeiros podem permanecer retidos quando houver obrigação legal, regulatória, fiscal, antifraude ou contratual aplicável ao serviço financeiro prestado pela Asaas.
              </p>
            </div>
          </div>
        </ScrollArea>

        <div className="finance-separator p-6 border-t border-zinc-100 dark:border-white/5 bg-zinc-50/50 dark:bg-zinc-900/50 flex justify-end">
          <Button 
            onClick={() => onOpenChange(false)}
            className="h-12 px-8 rounded-xl bg-zinc-900 dark:bg-white text-white dark:text-zinc-900 font-bold uppercase tracking-widest text-[10px]"
          >
            Entendi e Concordo
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
};
