import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) =>
  readFileSync(resolve(process.cwd(), path), "utf8");

describe("agenda desktop compact header contract", () => {
  it("uses only floating controls and keeps the calendar behind the header", () => {
    const calendar = source("src/components/agenda/CalendarView.tsx");
    const styles = source("src/index.css");

    expect(calendar).toContain("agenda-floating-header");
    expect(calendar).toContain("pointer-events-none absolute left-5 right-5 top-5");
    expect(calendar).toContain("agenda-floating-pill");
    expect(calendar).toContain("p-5");
    expect(calendar).toContain("h-12");
    expect(calendar).toContain("h-11");
    expect(calendar).not.toContain("<header className=\"agenda-liquid-surface");
    expect(styles).toContain(".agenda-floating-pill");
    expect(styles).toContain("backdrop-filter: blur(22px)");
    expect(styles).toContain(".agenda-scroll-edge.is-visible");
  });

  it("keeps date selection and period-aware navigation compact", () => {
    const calendar = source("src/components/agenda/CalendarView.tsx");

    expect(calendar).toContain('format(date, "dd MMM yyyy"');
    expect(calendar).toContain("<Calendar");
    expect(calendar).toContain("subMonths(date, 1)");
    expect(calendar).toContain("addMonths(date, 1)");
    expect(calendar).not.toMatch(/>\s*Hoje\s*</u);
    expect(calendar).toContain('{ value: "daily", label: "Dia" }');
    expect(calendar).toContain('{ value: "weekly", label: "Sem" }');
    expect(calendar).toContain('{ value: "monthly", label: "Mês" }');
  });

  it("matches the dashboard magnetic-control sizing and keeps filters progressive", () => {
    const calendar = source("src/components/agenda/CalendarView.tsx");
    const filters = source("src/components/agenda/AgendaFiltersPopover.tsx");
    const desktop = source("src/pages/desktop/DesktopAgenda.tsx");

    expect(calendar).toContain('agenda-toolbar-segmented h-12 min-h-12');
    expect(calendar).toContain('triggerClassName="h-11 min-h-11');
    expect(filters).toContain('indicatorId="agenda-filter-date-mode-indicator"');
    expect(filters).toContain('dateMode === "date"');
    expect(filters).toContain('className="agenda-field h-11');
    expect(desktop).not.toContain("agenda-desktop-shell agenda-liquid-surface");
    expect(desktop).toContain("agenda-desktop-calendar-frame");
    expect(filters).not.toContain("agenda-filter-label");
    expect(filters).not.toContain(">Filtros<");
  });

  it("renders sticky compact weekday pills inside the same scroller", () => {
    const calendar = source("src/components/agenda/CalendarView.tsx");

    expect(calendar).toContain("agenda-floating-day-header");
    expect(calendar).toContain("sticky z-30");
    expect(calendar).toContain("compactWeekday(day)");
    expect(calendar).toContain("agenda-day-trigger");
    expect(calendar).toContain('layoutId="agenda-selected-day-indicator"');
    expect(calendar).toContain("overflow-y-auto overscroll-contain");
  });

  it("keeps pointer and keyboard drag with precise collision fallback", () => {
    const calendar = source("src/components/agenda/CalendarView.tsx");

    expect(calendar).toContain("useSensor(PointerSensor");
    expect(calendar).toContain("useSensor(TouchSensor");
    expect(calendar).toContain("useSensor(KeyboardSensor)");
    expect(calendar).toContain("collisionDetection={agendaCollisionDetection}");
    expect(calendar).toContain("pointerWithin(args)");
    expect(calendar).toContain("rectIntersection(args)");
    expect(calendar).toContain("allAppointments.find");
  });
});
