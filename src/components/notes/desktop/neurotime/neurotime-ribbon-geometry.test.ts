import { describe, expect, it } from "vitest";

import type { NeuroTimeSingularidade } from "../../clinical-evidence/neurotime-types";
import { buildNeuroTimeRibbonGeometry } from "./neurotime-ribbon-geometry";

const singularity = (id: string, center: number, density: number, eventCount = 1): NeuroTimeSingularidade => ({
  id,
  startAt: 0,
  endAt: 1,
  inicioNormalizado: Math.max(0, center - 0.1),
  fimNormalizado: Math.min(1, center + 0.1),
  centroNormalizado: center,
  label: id,
  compactLabel: id,
  density,
  attention: 0.5,
  recency: 0.5,
  thermalScore: 0.5,
  massaVisual: density,
  confianca: 1,
  recordedRisk: null,
  eventCount,
  patientCount: 1,
  reviewedCount: 1,
  sourceCounts: [],
  dominantThemes: [],
  summary: id,
  events: [],
});

describe("buildNeuroTimeRibbonGeometry", () => {
  it("gera uma única área contínua sem valores inválidos", () => {
    const geometry = buildNeuroTimeRibbonGeometry([
      singularity("antigo", 0.2, 0.15),
      singularity("intenso", 0.55, 0.9),
      singularity("vazio", 0.86, 0, 0),
    ]);
    expect(geometry.areaPath).toMatch(/^M /);
    expect(geometry.areaPath).toMatch(/ Z$/);
    expect(geometry.areaPath).not.toContain("NaN");
    expect(geometry.points).toHaveLength(5);
  });

  it("faz a faixa inchar quando a densidade aumenta", () => {
    const geometry = buildNeuroTimeRibbonGeometry([
      singularity("leve", 0.25, 0.1),
      singularity("denso", 0.75, 0.95),
    ]);
    const lightThickness = geometry.points[1].lowerY - geometry.points[1].upperY;
    const denseThickness = geometry.points[2].lowerY - geometry.points[2].upperY;
    expect(denseThickness).toBeGreaterThan(lightThickness);
  });

  it("preserva continuidade para um único período", () => {
    const geometry = buildNeuroTimeRibbonGeometry([singularity("único", 0.5, 0.6)]);
    expect(geometry.areaPath).not.toContain("NaN");
    expect(geometry.points[0].x).toBe(0);
    expect(geometry.points.at(-1)?.x).toBe(1000);
  });
});
