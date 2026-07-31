import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("agenda modal layout contract", () => {
  it("centers dialogs through a viewport flex container", () => {
    const dialog = source("src/components/ui/dialog.tsx");
    const alertDialog = source("src/components/ui/alert-dialog.tsx");

    expect(dialog).toContain("pointer-events-none fixed inset-0 flex items-center justify-center");
    expect(dialog).toContain('contentContainerClassName || "z-[101]"');
    expect(alertDialog).toContain("pointer-events-none fixed inset-0 z-[51] flex items-center justify-center");
    expect(dialog).toContain("app-dialog-surface pointer-events-auto relative");
    expect(alertDialog).toContain("pointer-events-auto relative");
    expect(dialog).not.toContain("app-dialog-position");
    expect(alertDialog).not.toContain("app-dialog-position");
    expect(dialog).not.toContain("-translate-x-1/2");
    expect(dialog).not.toContain("-translate-y-1/2");
    expect(alertDialog).not.toContain("translate-x-[-50%]");
    expect(alertDialog).not.toContain("translate-y-[-50%]");
    expect(dialog).not.toContain("zoom-in");
    expect(alertDialog).not.toContain("zoom-in");
  });

  it("bounds both appointment dialogs to the dynamic viewport", () => {
    const creationModal = source("src/components/agenda/NewAppointmentModal.tsx");
    const detailModal = source("src/components/agenda/AppointmentDetailModal.tsx");
    const styles = source("src/index.css");

    expect(creationModal).toContain("agenda-viewport-modal");
    expect(detailModal).toContain("agenda-viewport-modal");
    expect(styles).toContain("height: min(760px, calc(100dvh - 1rem))");
  });

  it("styles portaled agenda menus with an explicit theme surface", () => {
    const creationModal = source("src/components/agenda/NewAppointmentModal.tsx");
    const detailModal = source("src/components/agenda/AppointmentDetailModal.tsx");
    const settingsModal = source("src/components/agenda/AgendaSettingsModal.tsx");
    const waitlist = source("src/components/agenda/ProfessionalWaitlistPanel.tsx");
    const styles = source("src/index.css");

    expect(creationModal).toContain("agenda-menu-surface");
    expect(detailModal).toContain("agenda-menu-surface");
    expect(settingsModal).toContain("agenda-menu-surface");
    expect(waitlist).toContain("agenda-menu-surface");
    expect(styles).toContain(".dark .agenda-menu-surface");
    expect(styles).toContain("background-image: none !important");
  });

  it("keeps the page background global and gives the waitlist its own dark material", () => {
    const page = source("src/pages/desktop/DesktopAgenda.tsx");
    const waitlist = source("src/components/agenda/ProfessionalWaitlistPanel.tsx");
    const styles = source("src/index.css");

    expect(page).toContain("overflow-hidden bg-transparent");
    expect(page).not.toContain("dark:bg-[#050506]");
    expect(waitlist).toContain("agenda-waitlist-surface");
    expect(styles).toContain(".dark .agenda-waitlist-surface");
  });
});
