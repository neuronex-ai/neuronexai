import { act, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it } from "vitest";

import { useReducedMotionPreference } from "./use-reduced-motion-preference";

const Harness = () => (
  <output>{useReducedMotionPreference() ? "reduced" : "full"}</output>
);

describe("useReducedMotionPreference", () => {
  afterEach(async () => {
    await act(async () => {
      document.documentElement.classList.remove("reduce-motion");
      await Promise.resolve();
    });
  });

  it("reacts to the user's internal reduced-motion preference", async () => {
    render(<Harness />);
    expect(screen.getByText("full")).toBeInTheDocument();

    await act(async () => {
      document.documentElement.classList.add("reduce-motion");
      await Promise.resolve();
    });

    expect(screen.getByText("reduced")).toBeInTheDocument();
  });
});
