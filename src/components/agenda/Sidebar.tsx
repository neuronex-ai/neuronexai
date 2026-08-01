"use client";

import { useMemo } from "react";
import { Appointment } from "@/types";
import { isSameDay, setMonth, setYear, format } from "date-fns";
import { ptBR } from "date-fns/locale";
import { Search, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Filter, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { Calendar } from "@/components/ui/calendar";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useNavigation } from "react-day-picker";
import { normalizeAppointmentStatus } from "@/lib/appointment-status";

interface SidebarProps {
  selectedDate: Date;
  onDateChange: (date: Date) => void;
  appointments: Appointment[];
  searchQuery: string;
  onSearchChange: (query: string) => void;
  selectedTag: string | null;
  onTagChange: (tag: string | null) => void;
  onClose?: () => void;
}

const TAGS = ['Online', 'Presencial', 'Primeira Vez'];

const CustomCaption = () => {
  const { goToMonth, nextMonth, previousMonth, displayMonths } = useNavigation();
  const displayMonth = displayMonths[0];

  const years = Array.from({ length: 11 }, (_, i) => new Date().getFullYear() - 5 + i);
  const months = [
    "Janeiro", "Fevereiro", "Março", "Abril", "Maio", "Junho",
    "Julho", "Agosto", "Setembro", "Outubro", "Novembro", "Dezembro"
  ];

  return (
    <div className="mb-6 flex items-center justify-between px-1">
      <button
        type="button"
        aria-label="Mês anterior"
        onClick={() => previousMonth && goToMonth(previousMonth)}
        disabled={!previousMonth}
        className="agenda-tactile notification-liquid-control flex h-11 w-11 items-center justify-center rounded-[15px] disabled:opacity-35"
      >
        <ChevronLeft className="h-4 w-4" />
      </button>

      <Popover>
        <PopoverTrigger asChild>
          <button
            type="button"
            className="agenda-tactile flex min-h-11 items-center gap-2 rounded-full px-3 text-[10px] font-black uppercase tracking-[0.2em] text-foreground hover:bg-accent/55"
            aria-label="Escolher mês e ano"
          >
            {format(displayMonth, "MMMM yyyy", { locale: ptBR })}
          </button>
        </PopoverTrigger>
        <PopoverContent className="agenda-menu-surface notification-liquid-menu w-[320px] overflow-hidden rounded-[28px] p-0" align="center" sideOffset={12}>
          <div className="flex flex-row h-[280px]">
            <ScrollArea className="w-[108px] border-r border-border/55 bg-muted/25">
              <div className="flex flex-col p-3 gap-1.5">
                {years.map(year => (
                  <button
                    type="button"
                    key={year}
                    onClick={() => goToMonth(setYear(displayMonth, year))}
                    aria-pressed={displayMonth.getFullYear() === year}
                    className={cn(
                      "agenda-tactile min-h-11 rounded-[14px] px-3 text-left text-[9px] font-black uppercase text-muted-foreground",
                      displayMonth.getFullYear() === year
                        ? "synapse-liquid-tab-active text-foreground"
                        : "hover:bg-accent/55 hover:text-foreground",
                    )}
                  >
                    {year}
                  </button>
                ))}
              </div>
            </ScrollArea>
            <div className="flex-1 p-5 grid grid-cols-2 gap-2 content-start">
              {months.map((month, index) => (
                <button
                  type="button"
                  key={month}
                  onClick={() => goToMonth(setMonth(displayMonth, index))}
                  aria-pressed={displayMonth.getMonth() === index}
                  className={cn(
                    "agenda-choice-card agenda-tactile min-h-11 rounded-[14px] border px-2 text-[8px] font-black uppercase tracking-wider text-muted-foreground",
                    displayMonth.getMonth() === index
                      ? "synapse-liquid-tab-active text-foreground"
                      : "hover:text-foreground",
                  )}
                >
                  {month.substring(0, 3)}
                </button>
              ))}
            </div>
          </div>
        </PopoverContent>
      </Popover>

      <button
        type="button"
        aria-label="Próximo mês"
        onClick={() => nextMonth && goToMonth(nextMonth)}
        disabled={!nextMonth}
        className="agenda-tactile notification-liquid-control flex h-11 w-11 items-center justify-center rounded-[15px] disabled:opacity-35"
      >
        <ChevronRight className="h-4 w-4" />
      </button>
    </div>
  );
};

export const Sidebar = ({
  selectedDate,
  onDateChange,
  appointments,
  searchQuery,
  onSearchChange,
  selectedTag,
  onTagChange,
  onClose
}: SidebarProps) => {
  const { attended, unscored } = useMemo(() => {
    let attendedCount = 0;
    let unscoredCount = 0;

    for (const appointment of appointments) {
      if (!isSameDay(new Date(appointment.start_time), selectedDate)) continue;
      const status = normalizeAppointmentStatus(appointment.status, appointment.notes);
      if (status === "attended") attendedCount += 1;
      if (status === "unscored") unscoredCount += 1;
    }

    return { attended: attendedCount, unscored: unscoredCount };
  }, [appointments, selectedDate]);

  return (
    <div
      className="agenda-sidebar-scroll custom-scrollbar flex h-full min-h-0 flex-col gap-3 overflow-y-auto overscroll-contain px-0.5 pb-2 pr-1 [scrollbar-gutter:stable]"
      style={{ touchAction: "pan-y" }}
    >
      
      <section className="agenda-liquid-surface relative shrink-0 overflow-hidden rounded-[28px] border p-5 text-foreground" aria-label="Calendário compacto">
        <div className="relative z-10 mb-8 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="synapse-chat-glass flex h-11 w-11 items-center justify-center rounded-[15px] border">
              <CalendarIcon className="h-4 w-4 text-muted-foreground" />
            </div>
            <div className="flex flex-col">
              <span className="text-[9px] font-black uppercase tracking-[0.2em] text-foreground">Calendário</span>
              <span className="text-[8px] font-bold uppercase tracking-widest text-muted-foreground">Agenda</span>
            </div>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => onDateChange(new Date())}
              className="agenda-tactile notification-liquid-control min-h-11 rounded-full px-3 text-[8px] font-black uppercase tracking-widest text-muted-foreground hover:text-foreground"
            >
              Hoje
            </button>
            {onClose ? (
              <button
                type="button"
                aria-label="Fechar painel da agenda"
                onClick={onClose}
                className="agenda-primary-action agenda-tactile flex h-11 w-11 items-center justify-center rounded-full"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            ) : null}
          </div>
        </div>

        <Calendar
          mode="single"
          selected={selectedDate}
          onSelect={(date) => date && onDateChange(date)}
          locale={ptBR}
          className="relative z-10 w-full p-0"
          components={{
            Caption: CustomCaption
          }}
          classNames={{
            month: "space-y-4 w-full",
            caption: "hidden",
            nav: "hidden",
            table: "w-full border-collapse",
            head_row: "flex w-full justify-between mb-4",
            head_cell: "w-11 text-center text-[8px] font-black uppercase text-muted-foreground",
            row: "flex w-full mt-1.5 justify-between px-0.5",
            cell: "relative flex h-11 w-11 items-center justify-center p-0 text-center text-[10px]",
            day: "agenda-tactile flex h-11 w-11 items-center justify-center rounded-[14px] p-0 font-bold text-muted-foreground hover:bg-accent/60 hover:text-foreground",
            day_selected: "!bg-foreground !text-background font-black shadow-sm",
            day_today: "font-black text-foreground ring-1 ring-border",
            day_outside: "text-muted-foreground/30 opacity-50",
            day_disabled: "opacity-10",
          }}
        />
      </section>

      <div className="grid shrink-0 grid-cols-2 gap-2.5 px-0.5">
        <MetricCard label="Presenças" value={attended} />
        <MetricCard label="Não pontuados" value={unscored} />
      </div>

      <section className="agenda-liquid-surface relative flex min-h-[250px] shrink-0 flex-col gap-7 overflow-hidden rounded-[28px] border p-5" aria-label="Busca e filtros">
        <div className="relative z-10 space-y-3">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Search className="h-3 w-3" />
            <label htmlFor="agenda-patient-search" className="text-[8px] font-black uppercase tracking-[0.24em]">Buscar paciente</label>
          </div>
          <div className="relative">
            <Input
              id="agenda-patient-search"
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              placeholder="Digite o nome..."
              className="agenda-field h-11 rounded-2xl px-5 text-[10px] font-bold"
            />
          </div>
        </div>

        <div className="relative z-10 space-y-4">
          <div className="flex items-center gap-2 text-muted-foreground">
            <Filter className="h-3 w-3" />
            <span className="text-[8px] font-black uppercase tracking-[0.3em]">Filtros</span>
          </div>
          <div className="flex flex-wrap gap-2">
            {TAGS.map((tag) => (
              <button
                type="button"
                key={tag}
                onClick={() => onTagChange(selectedTag === tag ? null : tag)}
                aria-pressed={selectedTag === tag}
                className={cn(
                  "agenda-choice-card agenda-tactile min-h-11 rounded-[14px] border px-4 text-[8px] font-black uppercase tracking-wider",
                  selectedTag === tag
                    ? "synapse-liquid-tab-active text-foreground"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                {tag}
              </button>
            ))}
          </div>
        </div>

        <div className="relative z-10 mt-auto border-t border-border/45 pt-5">
          <span className="text-[7px] font-black uppercase tracking-[0.26em] text-muted-foreground">Agenda NeuroNex</span>
        </div>
      </section>
    </div>
  );
};

const MetricCard = ({ label, value }: { label: string, value: number }) => (
  <div className="agenda-liquid-card group rounded-[22px] border p-4">
    <div className="flex flex-col gap-4">
      <div className="flex flex-col gap-1">
        <span className="text-[8px] font-black uppercase tracking-[0.2em] text-muted-foreground">{label}</span>
        <div className="h-0.5 w-5 bg-border" />
      </div>
      <span className="text-3xl font-black leading-none tracking-tighter text-foreground">
        {value.toString().padStart(2, '0')}
      </span>
    </div>
  </div>
);
