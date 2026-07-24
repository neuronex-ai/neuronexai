import { fireEvent, render, screen } from "@testing-library/react";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

import { Tabs, TabsList, TabsTrigger } from "./tabs";

const TabSet = ({ magnetic = false }: { magnetic?: boolean }) => (
  <Tabs magnetic={magnetic} defaultValue="first">
    <TabsList>
      <TabsTrigger value="first">Primeira</TabsTrigger>
      <TabsTrigger value="second">Segunda</TabsTrigger>
    </TabsList>
  </Tabs>
);

describe("desktop magnetic Tabs", () => {
  afterEach(() => {
    document.documentElement.classList.remove("reduce-motion");
  });

  it("is opt-in so patient and public surfaces keep the native tab treatment", () => {
    render(
      <div data-neuronex-surface="patient-portal">
        <TabSet />
      </div>,
    );

    expect(document.querySelector("[data-magnetic-tabs='true']")).not.toBeInTheDocument();
    expect(document.querySelector("[data-desktop-magnetic-tab-indicator='true']")).not.toBeInTheDocument();
  });

  it("moves one shared indicator when a professional desktop tab changes", () => {
    render(
      <div data-neuronex-surface="professional-desktop">
        <TabSet magnetic />
      </div>,
    );

    expect(document.querySelector("[data-magnetic-tabs='true']")).toBeInTheDocument();
    expect(document.querySelectorAll("[data-desktop-magnetic-tab-indicator='true']")).toHaveLength(1);
    expect(screen.getByRole("tab", { name: "Primeira" })).toHaveAttribute("data-state", "active");

    fireEvent.mouseDown(screen.getByRole("tab", { name: "Segunda" }), {
      button: 0,
      ctrlKey: false,
    });

    expect(screen.getByRole("tab", { name: "Segunda" })).toHaveAttribute("data-state", "active");
    expect(document.querySelectorAll("[data-desktop-magnetic-tab-indicator='true']")).toHaveLength(1);
  });

  it("removes spring motion under the reduced-motion preference", () => {
    document.documentElement.classList.add("reduce-motion");

    render(
      <div data-neuronex-surface="professional-desktop">
        <TabSet magnetic />
      </div>,
    );

    expect(document.querySelector("[data-desktop-magnetic-tab-indicator='true']")).toHaveAttribute(
      "data-reduced-motion",
      "true",
    );
  });

  it("scopes the magnetic material selector to the professional desktop shell", () => {
    const css = readFileSync(join(process.cwd(), "src/index.css"), "utf8");

    expect(css).toContain(
      '[data-neuronex-surface="professional-desktop"] [data-magnetic-tabs="true"] .desktop-magnetic-tab-indicator',
    );
    expect(css).not.toContain(
      '[data-neuronex-surface="patient-portal"] [data-magnetic-tabs="true"] .desktop-magnetic-tab-indicator',
    );
  });
});
