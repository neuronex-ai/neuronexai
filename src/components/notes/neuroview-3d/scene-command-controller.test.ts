import { describe, expect, it, vi } from "vitest";

import { NeuroViewSceneCommandController } from "./scene-command-controller";

describe("NeuroView scene command controller", () => {
  it("queues directives until the Three.js scene is ready", async () => {
    const controller = new NeuroViewSceneCommandController();
    const pending = controller.dispatch({ type: "set-lens", lens: "patterns" });
    controller.attach({
      execute: async (command) => ({
        ok: true,
        command: command.type,
        message: "executed",
      }),
    });

    await expect(pending).resolves.toMatchObject({ ok: true, command: "set-lens" });
  });

  it("dispatches immediately after an adapter is attached", async () => {
    const controller = new NeuroViewSceneCommandController();
    const detach = controller.attach({
      execute: async (command) => ({
        ok: true,
        command: command.type,
        message: "ready",
      }),
    });

    await expect(controller.dispatch({ type: "restore-panorama" })).resolves.toMatchObject({
      command: "restore-panorama",
      message: "ready",
    });
    detach();
  });

  it("preserves grouped note and tag highlights until the scene is ready", async () => {
    const controller = new NeuroViewSceneCommandController();
    const pending = controller.dispatch({
      type: "highlight-nodes",
      nodeIds: ["note-a", "note-b", "tag-anxiety"],
      focusNodeId: "note-a",
    });
    const execute = vi.fn(async (command) => ({
      ok: true as const,
      command: command.type,
      message: "group highlighted",
    }));

    controller.attach({ execute });

    await expect(pending).resolves.toMatchObject({ command: "highlight-nodes" });
    expect(execute).toHaveBeenCalledWith({
      type: "highlight-nodes",
      nodeIds: ["note-a", "note-b", "tag-anxiety"],
      focusNodeId: "note-a",
    });
  });
});
