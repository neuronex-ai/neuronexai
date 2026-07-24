import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { useState } from "react";
import { describe, expect, it } from "vitest";

import { Dialog, DialogContent, DialogTitle } from "./dialog";

function LayeredDialogHarness() {
  const [open, setOpen] = useState(true);

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogContent contentContainerClassName="z-[240]" overlayClassName="z-[239]" showCloseButton={false}>
        <DialogTitle>Revisar reagendamento</DialogTitle>
        <button type="button">Confirmar</button>
      </DialogContent>
    </Dialog>
  );
}

describe("Dialog layered content", () => {
  it("keeps the interactive layer above its backdrop and supports Escape", async () => {
    render(<LayeredDialogHarness />);

    const dialog = screen.getByRole("dialog");
    const container = dialog.parentElement;
    expect(container).toHaveAttribute("data-dialog-content-container");
    expect(container).toHaveClass("z-[240]");
    expect(document.querySelector("[data-state='open'].z-\\[239\\]")).toBeTruthy();

    await waitFor(() => expect(dialog.contains(document.activeElement)).toBe(true));
    fireEvent.keyDown(document, { key: "Escape" });

    await waitFor(() => expect(screen.queryByRole("dialog")).not.toBeInTheDocument());
  });
});
