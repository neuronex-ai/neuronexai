import { act, fireEvent, render, screen } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { Hero, HERO_HEADLINE_LINES } from "@/components/landing/Hero";
import { HeroVisual } from "@/components/landing/HeroVisual";

function mockMotionPreference(reducedMotion = false) {
  Object.defineProperty(window, "matchMedia", {
    writable: true,
    value: vi.fn().mockImplementation((query: string) => ({
      matches: query.includes("prefers-reduced-motion") ? reducedMotion : false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  });
}

function keepDocumentVisible() {
  Object.defineProperty(document, "hidden", {
    configurable: true,
    value: false,
  });
}

describe("hero público desktop", () => {
  beforeEach(() => {
    mockMotionPreference(false);
    keepDocumentVisible();
  });

  it("mantém um único h1 com exatamente duas linhas sem quebra interna", () => {
    render(
      <MemoryRouter>
        <Hero />
      </MemoryRouter>,
    );

    const heading = screen.getByRole("heading", { level: 1 });
    const lines = Array.from(heading.querySelectorAll("span"));

    expect(lines).toHaveLength(2);
    expect(lines.map((line) => line.textContent)).toEqual([...HERO_HEADLINE_LINES]);
    expect(lines[0]).toHaveClass("whitespace-nowrap");
    expect(lines[1]).toHaveClass("whitespace-nowrap");
  });
});

describe("demonstração real do produto", () => {
  beforeEach(() => {
    vi.useFakeTimers();
    mockMotionPreference(false);
    keepDocumentVisible();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  it("avança automaticamente e expõe navegação manual por abas", () => {
    render(<HeroVisual />);

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Central da Clínica");

    act(() => {
      vi.advanceTimersByTime(6200);
    });

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Agenda");

    fireEvent.click(screen.getByRole("tab", { name: /Pacientes/i }));
    expect(screen.getByRole("tabpanel")).toHaveTextContent("Pacientes e prontuário");
  });

  it("pausa o autoplay depois de interação manual", () => {
    render(<HeroVisual />);

    fireEvent.click(screen.getByRole("tab", { name: /Pacientes/i }));
    act(() => {
      vi.advanceTimersByTime(12_400);
    });

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Pacientes e prontuário");
  });

  it("não inicia autoplay com redução de movimento ativa", () => {
    mockMotionPreference(true);
    render(<HeroVisual />);

    act(() => {
      vi.advanceTimersByTime(12_400);
    });

    expect(screen.getByRole("tabpanel")).toHaveTextContent("Central da Clínica");
  });
});
