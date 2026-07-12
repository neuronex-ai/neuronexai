import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const source = (path: string) => readFileSync(resolve(process.cwd(), path), "utf8");

describe("desktop notes polish contract", () => {
  it("keeps NeuroFlow and NeuroPulse headers compact", () => {
    const flow = source("src/components/notes/NeuroFlowVault.tsx");
    const pulse = source("src/components/notes/NeuroPulse.tsx");

    expect(flow).toContain("min-h-[226px]");
    expect(flow).toContain("rounded-[24px] border p-3.5");
    expect(pulse).toContain("rounded-[24px] border p-3.5");
    expect(pulse).toContain("min-h-[300px]");
  });

  it("gives Mermaid a full-size stage and re-centers between panel modes", () => {
    const mermaid = source("src/components/notes/MermaidDiagram.tsx");
    const pulse = source("src/components/notes/NeuroPulse.tsx");

    expect(mermaid).toContain('wrapperStyle={{ width: "100%", height: "100%" }}');
    expect(mermaid).toContain("[&_svg]:max-w-full");
    expect(mermaid).toContain("layoutKey");
    expect(pulse).toContain('layoutKey={isFullscreen ? "fullscreen" : "panel"}');
  });

  it("restores the notes toolbar without retaining the focus-mode offset", () => {
    const editor = source("src/components/notes/NoteEditor.tsx");

    expect(editor).toContain('animate={isFocusMode ? { opacity: 1, y: 0, x: "-50%" } : { opacity: 1, y: 0, x: 0 }}');
    expect(editor).toContain("notes-focus-surface");
    expect(editor).toContain("[isFocusMode, onToggleFocus]");
  });
});
