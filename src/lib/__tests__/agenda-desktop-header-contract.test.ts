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
    expect(calendar).toContain("agenda-period-rail");
    expect(calendar).toContain("agenda-header-control");
    expect(calendar).not.toContain("<header className=\"agenda-liquid-surface");
    expect(styles).toContain(".agenda-floating-pill");
    expect(styles).toContain("backdrop-filter: blur(40px)");
    expect(styles).toContain("background-color: hsl(var(--agenda-surface) / 0.54) !important");
    expect(styles).toContain("isolation: auto");
    expect(styles).toContain(".agenda-month-cell:active");
  });

  it("keeps a monochrome depth hierarchy from the global canvas to the calendar grid", () => {
    const layout = source("src/components/layout/Layout.tsx");
    const page = source("src/pages/desktop/DesktopAgenda.tsx");
    const calendar = source("src/components/agenda/CalendarView.tsx");
    const styles = source("src/index.css");

    expect(layout).toContain('"desktop-lumen-field--agenda"');
    expect(page).toContain("agenda-calendar-stage");
    expect(calendar).toContain("agenda-command-cluster");
    expect(styles).toContain("--agenda-shell: 0 0% 97%");
    expect(styles).toContain("--agenda-grid: 0 0% 2%");
    expect(styles).toContain(".dark .agenda-grid-surface");
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

  it("renders sticky compact weekday pills inside the same scroller", () => {
    const calendar = source("src/components/agenda/CalendarView.tsx");

    expect(calendar).toContain("agenda-floating-day-header");
    expect(calendar).toContain("sticky z-30");
    expect(calendar).toContain("compactWeekday(day)");
    expect(calendar).toContain("agenda-day-pill");
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
