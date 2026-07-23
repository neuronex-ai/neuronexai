import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { ReflectionCarousel } from "./reflection-carousel";
import { getDailyRotationIndex } from "./reflection-carousel-rotation";

const slides = [
  { eyebrow: "Primeira", title: "Reflexão um", description: "Descrição um" },
  { eyebrow: "Segunda", title: "Reflexão dois", description: "Descrição dois" },
] as const;

describe("ReflectionCarousel", () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it("selects a deterministic daily item without daylight-saving drift", () => {
    expect(getDailyRotationIndex(new Date(2026, 0, 1), 10)).toBe(1);
    expect(getDailyRotationIndex(new Date(2026, 11, 31), 10)).toBe(5);
    expect(getDailyRotationIndex(new Date(2026, 0, 1), 0)).toBe(-1);
  });

  it("exposes manual slide selection and an explicit autoplay control", () => {
    render(<ReflectionCarousel slides={slides} />);

    expect(screen.getByRole("region", { name: "Reflexões" })).toHaveAttribute(
      "aria-roledescription",
      "carrossel",
    );
    const secondControl = screen.getByRole("button", { name: "Ir para Segunda" });
    expect(secondControl).toHaveAttribute("aria-pressed", "false");

    fireEvent.click(secondControl);
    expect(secondControl).toHaveAttribute("aria-pressed", "true");

    const pause = screen.getByRole("button", { name: "Pausar rotação automática" });
    fireEvent.click(pause);
    expect(screen.getByRole("button", { name: "Retomar rotação automática" })).toHaveAttribute(
      "aria-pressed",
      "true",
    );
  });

  it("pauses autoplay while the user is interacting with the carousel", () => {
    vi.useFakeTimers();
    render(<ReflectionCarousel slides={slides} intervalMs={1_000} />);

    const carousel = screen.getByRole("region", { name: "Reflexões" });
    const secondControl = screen.getByRole("button", { name: "Ir para Segunda" });

    fireEvent.mouseEnter(carousel);
    act(() => vi.advanceTimersByTime(1_200));
    expect(secondControl).toHaveAttribute("aria-pressed", "false");

    fireEvent.mouseLeave(carousel);
    act(() => vi.advanceTimersByTime(1_000));
    expect(secondControl).toHaveAttribute("aria-pressed", "true");
  });

  it("replaces the generic icon tile with a supplied brand visual", () => {
    const { container } = render(
      <ReflectionCarousel
        slides={slides}
        leadingVisual={<img src="/favicon-light.png" alt="" data-testid="brand-mark" />}
      />,
    );

    expect(screen.getAllByTestId("brand-mark")).toHaveLength(slides.length);
    expect(container.querySelector('[data-lucide="brain-circuit"]')).not.toBeInTheDocument();
  });
});
