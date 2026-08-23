import { describe, expect, it } from "vitest";
import {
  resolveNeuroViewSceneWorkPolicy,
  shouldUseFullAmbientOcclusion,
} from "./scene-performance";

describe("política de desempenho do NeuroView 3d", () => {
  it("mantém a política completa em grafos menores", () => {
    expect(resolveNeuroViewSceneWorkPolicy(240, 420)).toEqual({
      denseGraph: false,
      collisionPasses: 3,
    });
  });

  it("limita colisões por quadro em um Drive com cerca de mil notas", () => {
    expect(resolveNeuroViewSceneWorkPolicy(1_080, 1_850)).toEqual({
      denseGraph: true,
      collisionPasses: 1,
    });
  });

  it("preserva o acabamento completo quando a câmera e a física repousam", () => {
    expect(shouldUseFullAmbientOcclusion({
      cameraMotion: false,
      denseGraph: true,
      physicsMoving: false,
      layoutTransitionActive: false,
    })).toBe(true);
    expect(shouldUseFullAmbientOcclusion({
      cameraMotion: true,
      denseGraph: true,
      physicsMoving: false,
      layoutTransitionActive: false,
    })).toBe(false);
  });
});
