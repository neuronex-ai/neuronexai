import { fireEvent, render, screen } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { MagneticSegmentedControl } from "./magnetic-segmented-control";
import { StableTabViewport } from "./stable-tab-viewport";

const SegmentedHarness = () => {
  const [value, setValue] = useState<"first" | "second">("first");

  return (
    <>
      <MagneticSegmentedControl
        id="test-view"
        value={value}
        onValueChange={setValue}
        ariaLabel="Escolher visualização"
        options={[
          { value: "first", label: "Primeiro" },
          { value: "second", label: "Segundo" },
        ]}
      />
      <StableTabViewport id="test-view" value={value} className="h-40">
        <p>{value === "first" ? "Conteúdo inicial" : "Conteúdo seguinte"}</p>
      </StableTabViewport>
    </>
  );
};

describe("MagneticSegmentedControl", () => {
  it("uses roving focus and changes the controlled panel with arrow keys", () => {
    render(<SegmentedHarness />);

    const first = screen.getByRole("tab", { name: "Primeiro" });
    const second = screen.getByRole("tab", { name: "Segundo" });

    expect(first).toHaveAttribute("aria-selected", "true");
    expect(first).toHaveAttribute("aria-controls", "test-view-panel-first");
    expect(first).toHaveClass("min-h-11");
    expect(screen.getByRole("tabpanel")).toHaveAttribute("id", "test-view-panel-first");

    first.focus();
    fireEvent.keyDown(first, { key: "ArrowRight" });

    expect(second).toHaveFocus();
    expect(second).toHaveAttribute("aria-selected", "true");
    expect(screen.getByText("Conteúdo seguinte")).toBeInTheDocument();
  });

  it("supports direct pointer selection without scaling the panel shell", () => {
    const { container } = render(<SegmentedHarness />);

    fireEvent.click(screen.getByRole("tab", { name: "Segundo" }));

    expect(screen.getByRole("tab", { name: "Segundo" })).toHaveAttribute("tabindex", "0");
    expect(container.querySelector("[role='tabpanel']")).toHaveClass("absolute", "inset-0", "h-full");
  });

  it("supports single-selection semantics for view and layout controls", () => {
    const SelectionHarness = () => {
      const [value, setValue] = useState<"list" | "grid">("list");

      return (
        <MagneticSegmentedControl
          value={value}
          onValueChange={setValue}
          ariaLabel="Formato de exibição"
          behavior="single-select"
          options={[
            { value: "list", label: "Lista" },
            { value: "grid", label: "Grade" },
          ]}
        />
      );
    };

    render(<SelectionHarness />);

    const list = screen.getByRole("radio", { name: "Lista" });
    const grid = screen.getByRole("radio", { name: "Grade" });
    expect(list).toHaveAttribute("aria-checked", "true");
    expect(list).not.toHaveAttribute("aria-controls");

    fireEvent.click(grid);
    expect(grid).toHaveAttribute("aria-checked", "true");
  });
});
