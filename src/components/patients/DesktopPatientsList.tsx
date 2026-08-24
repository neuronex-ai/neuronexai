import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { cn } from '@/lib/utils';
import type { Patient } from '@/types';
import { format } from 'date-fns';
import { ArrowUpRight, CalendarClock, Trash2 } from 'lucide-react';
import { Link } from 'react-router-dom';

interface DesktopPatientsListProps {
  patients: Patient[];
  onDelete: (patient: Pick<Patient, 'id' | 'name'>) => void;
}

const statusLabel = (status: Patient['status']) => status === 'active' ? 'Ativo' : 'Pendente';

const nextSessionLabel = (nextSession: Patient['next_session']) => nextSession
  ? format(new Date(nextSession), "dd/MM/yyyy 'às' HH:mm")
  : 'Sem agendamento';

export const DesktopPatientsListSkeleton = () => (
  <div className="patients-directory-list overflow-hidden rounded-[28px]" role="status" aria-label="Carregando pacientes">
    <div className="border-b border-border/45 px-6 py-4">
      <Skeleton className="h-3 w-40" />
    </div>
    <div className="divide-y divide-border/40">
      {Array.from({ length: 7 }).map((_, index) => (
        <div key={index} className="grid min-h-[76px] grid-cols-[minmax(240px,1.2fr)_minmax(130px,0.55fr)_minmax(190px,0.8fr)_96px] items-center gap-5 px-6">
          <div className="flex items-center gap-3.5">
            <Skeleton className="h-11 w-11 rounded-[15px]" />
            <div className="space-y-2">
              <Skeleton className="h-3.5 w-36" />
              <Skeleton className="h-3 w-44" />
            </div>
          </div>
          <Skeleton className="h-7 w-20 rounded-full" />
          <Skeleton className="h-3.5 w-36" />
          <Skeleton className="ml-auto h-11 w-20 rounded-[14px]" />
        </div>
      ))}
    </div>
  </div>
);

export const DesktopPatientsList = ({ patients, onDelete }: DesktopPatientsListProps) => (
  <div className="patients-directory-list overflow-hidden rounded-[28px]">
    <Table className="min-w-[760px]">
      <caption className="sr-only">Pacientes encontrados e seus próximos atendimentos</caption>
      <TableHeader className="patients-directory-table-head">
        <TableRow className="border-border/45 hover:bg-transparent">
          <TableHead className="h-12 px-6 text-[9px] font-black uppercase tracking-[0.16em]">Paciente</TableHead>
          <TableHead className="hidden h-12 text-[9px] font-black uppercase tracking-[0.16em] xl:table-cell">Contato</TableHead>
          <TableHead className="h-12 text-[9px] font-black uppercase tracking-[0.16em]">Status</TableHead>
          <TableHead className="hidden h-12 text-[9px] font-black uppercase tracking-[0.16em] lg:table-cell">Contexto clínico</TableHead>
          <TableHead className="h-12 text-[9px] font-black uppercase tracking-[0.16em]">Próxima sessão</TableHead>
          <TableHead className="h-12 px-6 text-right text-[9px] font-black uppercase tracking-[0.16em]">Ações</TableHead>
        </TableRow>
      </TableHeader>
      <TableBody>
        {patients.map((patient) => (
          <TableRow
            key={patient.id}
            data-synapse-patient-id={patient.id}
            className="patients-directory-row h-[78px] border-border/40 hover:bg-muted/25"
          >
            <TableCell className="px-6 py-3">
              <Link
                to={`/pacientes/${patient.id}`}
                className="group/patient inline-flex min-h-11 min-w-0 items-center gap-3.5 rounded-[14px] pr-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                aria-label={`Abrir prontuário de ${patient.name}`}
              >
                <Avatar className="h-11 w-11 shrink-0 rounded-[15px] border border-border/55 bg-background shadow-sm">
                  <AvatarImage src={patient.avatar_url || undefined} alt="" />
                  <AvatarFallback className="rounded-[15px] bg-foreground text-[11px] font-black uppercase tracking-[0.12em] text-background">
                    {patient.name.substring(0, 2).toUpperCase()}
                  </AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                  <p className="max-w-[260px] truncate text-sm font-black tracking-[-0.02em] text-foreground group-hover/patient:underline group-hover/patient:underline-offset-4">
                    {patient.name}
                  </p>
                  <p className="mt-1 max-w-[260px] truncate text-[11px] font-medium text-muted-foreground">
                    {patient.profession || 'Prontuário clínico'}
                  </p>
                </div>
              </Link>
            </TableCell>
            <TableCell className="hidden max-w-[260px] py-3 xl:table-cell">
              <p className="truncate text-xs font-semibold text-foreground/82">{patient.email || 'E-mail não informado'}</p>
              <p className="mt-1 truncate text-[11px] text-muted-foreground">{patient.mobile_phone || patient.phone || 'Telefone não informado'}</p>
            </TableCell>
            <TableCell className="py-3">
              <span className="patients-status-pill inline-flex min-h-8 items-center gap-2 rounded-full px-3 text-[9px] font-black uppercase tracking-[0.13em] text-foreground">
                <span className={cn('patients-status-dot h-1.5 w-1.5 rounded-full', patient.status === 'active' ? 'is-active' : 'is-pending')} aria-hidden="true" />
                {statusLabel(patient.status)}
              </span>
            </TableCell>
            <TableCell className="hidden max-w-[280px] py-3 lg:table-cell">
              <p className="truncate text-xs font-semibold text-foreground/82">{patient.diagnosis || 'Sem diagnóstico definido'}</p>
            </TableCell>
            <TableCell className="py-3">
              <div className="flex items-center gap-2.5 text-xs font-semibold text-foreground/82">
                <CalendarClock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                <span className="whitespace-nowrap">{nextSessionLabel(patient.next_session)}</span>
              </div>
            </TableCell>
            <TableCell className="px-6 py-3">
              <div className="flex items-center justify-end gap-1.5">
                <Button
                  asChild
                  variant="ghost"
                  size="icon"
                  className="h-11 w-11 rounded-[14px] text-muted-foreground hover:bg-foreground hover:text-background"
                >
                  <Link to={`/pacientes/${patient.id}`} aria-label={`Abrir prontuário de ${patient.name}`}>
                    <ArrowUpRight className="h-4 w-4" />
                  </Link>
                </Button>
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  onClick={() => onDelete(patient)}
                  className="h-11 w-11 rounded-[14px] text-muted-foreground hover:bg-destructive hover:text-destructive-foreground"
                  aria-label={`Excluir ${patient.name}`}
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            </TableCell>
          </TableRow>
        ))}
      </TableBody>
    </Table>
  </div>
);
