import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

const source = (path: string) => readFileSync(resolve(process.cwd(), path), 'utf8');

describe('patients desktop visual contract', () => {
  it('uses the Agenda-derived monochrome Lumen field only on the professional desktop route', () => {
    const layout = source('src/components/layout/Layout.tsx');
    const page = source('src/pages/patients-view/index.tsx');
    const styles = source('src/index.css');
    const patientDocuments = [
      source('src/components/patients/DocumentGeneratorModal.tsx'),
      source('src/components/patients/DocumentPreviewModal.tsx'),
    ].join('\n');

    expect(layout).toContain('desktop-lumen-field--patients');
    expect(page).toContain('!isMobile && "patients-desktop-shell"');
    expect(styles).toContain('--patients-surface: 0 0% 100%');
    expect(styles).toContain('--patients-inset: 0 0% 2%');
    expect(page).not.toContain('/noise.png');
    expect(patientDocuments).not.toContain('/noise.png');
  });

  it('offers persisted cards and list modes while keeping the mobile directory on cards', () => {
    const page = source('src/pages/patients-view/index.tsx');

    expect(page).toContain("type PatientsViewMode = 'cards' | 'list'");
    expect(page).toContain("const activeView = isMobile ? 'cards' : viewMode");
    expect(page).toContain('MagneticSegmentedControl');
    expect(page).toContain('DesktopPatientsList');
    expect(page).toContain('PATIENTS_VIEW_STORAGE_KEY');
  });

  it('uses semantic table and native controls with comfortable action targets', () => {
    const list = source('src/components/patients/DesktopPatientsList.tsx');
    const page = source('src/pages/patients-view/index.tsx');

    expect(list).toContain('<Table');
    expect(list).toContain('<TableHeader');
    expect(list).toContain('<Link');
    expect(list).toContain('h-11 w-11');
    expect(page).toContain('<Checkbox');
    expect(page).toContain('aria-label="Limpar busca de pacientes"');
  });
});
