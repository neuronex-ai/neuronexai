import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";

import type { NeuroTimeCampoTemporal, NeuroTimeSingularidade } from "../../clinical-evidence/neurotime-types";
import { NeuroTimeTimeline } from "./NeuroTimeTimeline";

vi.mock("framer-motion", async (importOriginal) => ({
  ...await importOriginal<typeof import("framer-motion")>(),
  useReducedMotion: () => true,
}));

const singularity = (overrides: Partial<NeuroTimeSingularidade>): NeuroTimeSingularidade => ({
  id: "period-1",
  startAt: Date.UTC(2026, 0, 1),
  endAt: Date.UTC(2026, 1, 1),
  inicioNormalizado: 0,
  fimNormalizado: 0.5,
  centroNormalizado: 0.25,
  label: "janeiro de 2026",
  compactLabel: "jan/26",
  density: 0.6,
  attention: 0.5,
  recency: 0.4,
  thermalScore: 0.6,
  massaVisual: 0.6,
  confianca: 0.8,
  recordedRisk: null,
  eventCount: 3,
  patientCount: 1,
  reviewedCount: 3,
  sourceCounts: [{ fonte: "prontuario", quantidade: 3 }],
  dominantThemes: ["Ansiedade"],
  summary: "Período com maior presença de ansiedade.",
  events: [],
  ...overrides,
});

const field: NeuroTimeCampoTemporal = {
  versaoDoCampo: "neurotime-campo-v1",
  startAt: Date.UTC(2026, 0, 1),
  endAt: Date.UTC(2026, 2, 1),
  resolution: "mes",
  singularities: [
    singularity({}),
    singularity({
      id: "period-2",
      startAt: Date.UTC(2026, 1, 1),
      endAt: Date.UTC(2026, 2, 1),
      label: "fevereiro de 2026",
      compactLabel: "fev/26",
      density: 0.8,
      attention: 0.75,
    }),
  ],
  eventCount: 6,
  patientCount: 1,
  sourceCount: 1,
  latestActivityAt: Date.UTC(2026, 1, 10),
  hasRecordedRisk: false,
};

describe("NeuroTimeTimeline", () => {
  it("permite percorrer os períodos por setas e fixa o toolcard com Enter", () => {
    render(<NeuroTimeTimeline field={field} darkMode />);

    const january = screen.getByRole("button", { name: /janeiro de 2026, densidade 60%/i });
    const february = screen.getByRole("button", { name: /fevereiro de 2026, densidade 80%/i });

    expect(january).toHaveAttribute("tabindex", "0");
    january.focus();
    fireEvent.keyDown(january, { key: "ArrowRight" });

    expect(february).toHaveFocus();
    expect(february).toHaveAttribute("tabindex", "0");

    fireEvent.keyDown(february, { key: "Enter" });
    expect(screen.getByRole("dialog", { name: /detalhes de fevereiro de 2026/i })).toBeInTheDocument();
    expect(screen.getByText("Período fixado")).toBeInTheDocument();
  });

  it("expõe densidade, atenção e ausência de risco também no nome acessível", () => {
    render(<NeuroTimeTimeline field={field} darkMode={false} />);
    expect(screen.getByRole("button", {
      name: /janeiro de 2026, densidade 60%, atenção 50%, 3 registros, risco não informado neste período/i,
    })).toBeInTheDocument();
  });

  it("reajusta o ponto de Tab quando um filtro reduz a quantidade de períodos", () => {
    const { rerender } = render(<NeuroTimeTimeline field={field} darkMode />);
    const january = screen.getByRole("button", { name: /janeiro de 2026, densidade 60%/i });
    january.focus();
    fireEvent.keyDown(january, { key: "ArrowRight" });

    rerender(<NeuroTimeTimeline field={{ ...field, singularities: field.singularities.slice(0, 1) }} darkMode />);

    expect(screen.getByRole("button", { name: /janeiro de 2026, densidade 60%/i })).toHaveAttribute("tabindex", "0");
  });
});
