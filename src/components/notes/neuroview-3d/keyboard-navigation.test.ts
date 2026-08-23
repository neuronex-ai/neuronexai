import { describe, expect, it } from "vitest";

import { getNeuroViewCameraAction } from "./keyboard-navigation";

describe("getNeuroViewCameraAction", () => {
  it.each([
    ["ArrowLeft", "orbit-left"],
    ["ArrowRight", "orbit-right"],
    ["ArrowUp", "orbit-up"],
    ["ArrowDown", "orbit-down"],
    ["w", "dolly-in"],
    ["S", "dolly-out"],
    ["a", "strafe-left"],
    ["D", "strafe-right"],
  ])("mapeia %s para %s", (key, action) => {
    expect(getNeuroViewCameraAction({ key })).toBe(action);
  });

  it("usa Shift com W e S para alterar a altura da câmera", () => {
    expect(getNeuroViewCameraAction({ key: "w", shiftKey: true })).toBe("elevate-up");
    expect(getNeuroViewCameraAction({ key: "s", shiftKey: true })).toBe("elevate-down");
  });

  it("preserva atalhos do sistema e ignora teclas não mapeadas", () => {
    expect(getNeuroViewCameraAction({ key: "w", ctrlKey: true })).toBeNull();
    expect(getNeuroViewCameraAction({ key: "a", metaKey: true })).toBeNull();
    expect(getNeuroViewCameraAction({ key: "ArrowLeft", altKey: true })).toBeNull();
    expect(getNeuroViewCameraAction({ key: "Enter" })).toBeNull();
  });
});
