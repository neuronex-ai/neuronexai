import { Archive, DatabaseBackup, FileArchive, ShieldAlert, Trash2 } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";

const exportOptions = [
  {
    icon: DatabaseBackup,
    title: "Backup completo",
    description: "Dados clínicos, agenda, documentos, preferências e informações financeiras.",
  },
  {
    icon: FileArchive,
    title: "Somente NeuroFinance",
    description: "Movimentações, cobranças, comprovantes e configurações da conta financeira.",
  },
];

const deleteOptions = [
  {
    icon: Archive,
    title: "Excluir dados do NeuroFinance",
    description: "Preserva a conta NeuroNex e os dados clínicos. Exigirá revisão de saldos, documentos e obrigações legais.",
  },
  {
    icon: Trash2,
    title: "Excluir todos os dados",
    description: "Inclui a conta NeuroNex e solicita o encerramento coordenado do NeuroFinance.",
  },
];

export function DataManagementFoundation() {
  return (
    <div className="mx-auto max-w-4xl space-y-7">
      <header className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-[9px] font-black uppercase tracking-[0.2em] text-muted-foreground/65">
            Privacidade e portabilidade
          </p>
          <h2 className="mt-2 text-2xl font-black tracking-[-0.035em] text-foreground">
            Exportação e exclusão de dados
          </h2>
          <p className="mt-2 max-w-2xl text-sm font-medium leading-relaxed text-muted-foreground">
            Esta é a estrutura inicial da central de dados. Nenhuma exportação ou exclusão será executada nesta etapa.
          </p>
        </div>
        <span className="rounded-full border border-border/50 bg-muted/45 px-3 py-1.5 text-[9px] font-black uppercase tracking-[0.16em] text-muted-foreground">
          Em preparação
        </span>
      </header>

      <div className="rounded-[24px] border border-amber-500/20 bg-amber-500/[0.065] p-5">
        <div className="flex gap-4">
          <ShieldAlert className="mt-0.5 h-5 w-5 shrink-0 text-amber-700 dark:text-amber-300" />
          <div>
            <p className="text-sm font-black text-foreground">Operações deliberadamente desativadas.</p>
            <p className="mt-1 text-xs font-medium leading-relaxed text-muted-foreground">
              Antes da liberação, serão definidos prazos, confirmação de identidade, formato dos arquivos, retenções legais e tratamento de saldos ou notas fiscais.
            </p>
          </div>
        </div>
      </div>

      <section className="desktop-retina-panel overflow-hidden rounded-[30px] border border-border/45">
        <div className="border-b border-border/40 px-6 py-5">
          <h3 className="text-base font-black text-foreground">O que deseja exportar?</h3>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            A seleção ficará disponível quando o processo seguro de backup estiver concluído.
          </p>
        </div>
        <div className="divide-y divide-border/35">
          {exportOptions.map((option) => (
            <div key={option.title} className="flex items-center gap-4 px-6 py-5">
              <div className="desktop-retina-inset flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-border/45">
                <option.icon className="h-4 w-4 text-muted-foreground" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-foreground">{option.title}</p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-muted-foreground">{option.description}</p>
              </div>
              <Switch disabled aria-label={`${option.title} indisponível`} />
            </div>
          ))}
        </div>
        <div className="border-t border-border/40 p-5">
          <Button disabled className="h-11 w-full rounded-2xl font-bold">
            Preparar backup
          </Button>
        </div>
      </section>

      <section className="overflow-hidden rounded-[30px] border border-destructive/15 bg-destructive/[0.025]">
        <div className="border-b border-destructive/10 px-6 py-5">
          <h3 className="text-base font-black text-foreground">Exclusão de dados</h3>
          <p className="mt-1 text-xs font-medium text-muted-foreground">
            A futura confirmação permitirá escolher um backup antes de qualquer exclusão.
          </p>
        </div>
        <div className="divide-y divide-destructive/10">
          {deleteOptions.map((option) => (
            <div key={option.title} className="flex items-center gap-4 px-6 py-5 opacity-70">
              <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl border border-destructive/15 bg-destructive/[0.04]">
                <option.icon className="h-4 w-4 text-destructive" />
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-black text-foreground">{option.title}</p>
                <p className="mt-1 text-xs font-medium leading-relaxed text-muted-foreground">{option.description}</p>
              </div>
              <Switch disabled aria-label={`${option.title} indisponível`} />
            </div>
          ))}
        </div>
      </section>
    </div>
  );
}
