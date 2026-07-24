import { render, screen } from "@testing-library/react";
import { describe, expect, it } from "vitest";

import { DesktopRouteTransition } from "./DesktopRouteTransition";

describe("DesktopRouteTransition", () => {
  it("keys the full professional workspace stage by route", () => {
    const { rerender } = render(
      <DesktopRouteTransition pathname="/dashboard">
        <h1>Painel</h1>
      </DesktopRouteTransition>,
    );

    expect(screen.getByText("Painel").closest("[data-desktop-route-stage]")).toHaveAttribute(
      "data-desktop-route-stage",
      "/dashboard",
    );

    rerender(
      <DesktopRouteTransition pathname="/agenda">
        <h1>Agenda</h1>
      </DesktopRouteTransition>,
    );

    expect(screen.getByText("Agenda").closest("[data-desktop-route-stage]")).toHaveAttribute(
      "data-desktop-route-stage",
      "/agenda",
    );
    expect(document.querySelector("[data-desktop-route-viewport='true']")).toBeInTheDocument();
  });
});
