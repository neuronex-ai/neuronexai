import { act, render, screen, waitFor } from "@testing-library/react";
import { useEffect } from "react";
import { HashRouter, useLocation, useNavigate } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";

import { clearSynapseNotesNavigationState } from "@/lib/synapse-navigation";

const HashStateConsumer = () => {
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!location.state) return;
    clearSynapseNotesNavigationState(navigate, location.pathname, location.search);
  }, [location.pathname, location.search, location.state, navigate]);

  return (
    <output data-testid="router-state">
      {location.state === null ? "clean" : "pending"}
    </output>
  );
};

describe("Notes Synapse navigation cleanup", () => {
  it("replaces through React Router instead of mutating browser history directly", () => {
    const navigate = vi.fn();

    clearSynapseNotesNavigationState(navigate, "/notas", "?noteId=note-1");

    expect(navigate).toHaveBeenCalledWith("/notas?noteId=note-1", {
      replace: true,
      state: null,
    });
  });

  it("preserves a HashRouter route while consuming its transient state", async () => {
    const previousUrl = window.location.href;
    act(() => {
      window.history.replaceState(
        { usr: { synapseAction: "open_neuroflow_generation" }, key: "notes-test", idx: 0 },
        "",
        "/#/notas?noteId=note-1",
      );
    });

    try {
      render(
        <HashRouter>
          <HashStateConsumer />
        </HashRouter>,
      );

      await waitFor(() => expect(screen.getByTestId("router-state")).toHaveTextContent("clean"));
      expect(window.location.hash).toBe("#/notas?noteId=note-1");
    } finally {
      act(() => {
        window.history.replaceState({}, "", previousUrl);
      });
    }
  });
});
