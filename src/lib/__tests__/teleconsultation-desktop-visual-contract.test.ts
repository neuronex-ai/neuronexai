import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('teleconsultation desktop visual contract', () => {
  it('keeps a dedicated monochrome Lumen hierarchy without changing the mobile surface', () => {
    const layout = source('src/components/layout/Layout.tsx');
    const page = source('src/pages/Teleconsulta.tsx');
    const styles = source('src/index.css');
    const mobileLobby = source('src/mobile/components/MobileTeleconsultationLobby.tsx');
    const legacyWorkspace = source('src/components/teleconsulta/WorkspaceTabs.tsx');

    expect(layout).toContain('desktop-lumen-field--teleconsultation');
    expect(page).toContain('teleconsultation-desktop');
    expect(styles).toContain('--teleconsultation-surface: 0 0% 100%');
    expect(styles).toContain('--teleconsultation-inset: 0 0% 2%');
    expect(styles).toContain('.desktop-lumen-field.desktop-lumen-field--teleconsultation');
    expect(mobileLobby).toContain('variant="mobile"');
    expect(mobileLobby).not.toContain('teleconsultation-desktop');
    expect(legacyWorkspace).not.toContain("/noise.png");
  });

  it('preserves breathing room around the pre-join layers and primary action', () => {
    const lobby = source('src/components/teleconsulta/DesktopTeleconsultationLobby.tsx');
    const media = source('src/components/teleconsulta/MediaReadinessPanel.tsx');

    expect(lobby).toContain('space-y-5 pb-4');
    expect(lobby).toContain('xl:gap-6');
    expect(lobby).toContain('space-y-3 px-1.5');
    expect(lobby).toContain('variant="desktop"');
    expect(media).toContain('compact ? "space-y-4" : "space-y-5"');
    expect(media).toContain('aria-pressed={readiness.audioEnabled}');
    expect(media).toContain('role="progressbar"');
  });

  it('insets the room workspace, floating controls, and review decisions from their layers', () => {
    const session = source('src/components/teleconsulta/DesktopClinicalSession.tsx');
    const stage = source('src/components/teleconsulta/DesktopSessionStage.tsx');
    const controls = source('src/components/teleconsulta/SessionControls.tsx');
    const review = source('src/components/teleconsulta/DesktopSessionReviewDialog.tsx');

    expect(session).toContain('xl:gap-5 xl:px-6 xl:pb-6');
    expect(stage).toContain('sm:left-6 sm:top-6');
    expect(stage).toContain('sm:right-6 sm:top-6');
    expect(stage).toContain('sm:bottom-6');
    expect(controls).toContain('px-5 sm:px-6');
    expect(controls).toContain('gap-2 rounded-[28px] p-2.5');
    expect(review).toContain('sm:px-8 sm:py-6');
    expect(review).toContain('gap-4 border-t');
  });

  it('keeps scroll layers paint-stable without layout containment', () => {
    const styles = source('src/index.css');
    const shellRule = styles.match(/\.teleconsultation-shell\s*\{([^}]*)\}/)?.[1] || '';
    const deferredRule = styles.match(/\.teleconsultation-deferred-section\s*\{([^}]*)\}/)?.[1] || '';

    expect(shellRule).not.toContain('contain:');
    expect(deferredRule).not.toContain('contain:');
    expect(styles).toContain('.teleconsultation-scroll');
    expect(styles).toContain('overscroll-behavior: contain');
  });
});
