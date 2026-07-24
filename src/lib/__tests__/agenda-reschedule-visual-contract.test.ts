import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("agenda reschedule visual contract", () => {
  it("puts the canonical reschedule review content above its own backdrop", () => {
    const dialog = source("src/components/appointments/AppointmentPlanReviewDialog.tsx");
    const primitive = source("src/components/ui/dialog.tsx");

    expect(dialog).toContain('contentContainerClassName="z-[240]"');
    expect(dialog).toContain('overlayClassName="z-[239]');
    expect(primitive).toContain("data-dialog-content-container");
    expect(primitive).toContain('contentContainerClassName || "z-[101]"');
  });

  it("uses the intended resolved-theme border for monthly overflow appointments", () => {
    const calendar = source("src/components/agenda/CalendarView.tsx");
    const styles = source("src/index.css");

    expect(calendar).toContain("agenda-month-more-appointment");
    expect(styles).toMatch(/\.agenda-month-more-appointment\s*\{\s*border-color:\s*rgba\(255,\s*255,\s*255,\s*0\.86\)/u);
    expect(styles).toMatch(/\.dark \.agenda-month-more-appointment\s*\{\s*border-color:\s*rgba\(0,\s*0,\s*0,\s*0\.82\)/u);
  });
});
