import type { NeuroVisionSceneProfile } from "./three-scene";

export type NeuroViewHardwareCapability = {
  available: boolean;
  profile: NeuroVisionSceneProfile;
  webgl2: boolean;
  maxTextureSize: number;
};

type NavigatorWithMemory = Navigator & { deviceMemory?: number };

export const detectNeuroViewHardware = (reducedMotion: boolean): NeuroViewHardwareCapability => {
  if (typeof document === "undefined") {
    return { available: false, profile: "light", webgl2: false, maxTextureSize: 0 };
  }

  const canvas = document.createElement("canvas");
  const contextAttributes: WebGLContextAttributes = {
    alpha: false,
    antialias: false,
    depth: false,
    failIfMajorPerformanceCaveat: true,
    powerPreference: "high-performance",
    preserveDrawingBuffer: false,
  };
  const webgl2Context = canvas.getContext("webgl2", contextAttributes);
  const context = webgl2Context || canvas.getContext("webgl", contextAttributes);

  if (!context) {
    return { available: false, profile: "light", webgl2: false, maxTextureSize: 0 };
  }

  const maxTextureSize = Number(context.getParameter(context.MAX_TEXTURE_SIZE)) || 0;
  const memory = (navigator as NavigatorWithMemory).deviceMemory;
  const processors = navigator.hardwareConcurrency;
  const limitedMemory = typeof memory === "number" && memory < 8;
  const limitedProcessors = typeof processors === "number" && processors < 8;
  const full = Boolean(webgl2Context)
    && maxTextureSize >= 8192
    && !limitedMemory
    && !limitedProcessors
    && !reducedMotion;

  context.getExtension("WEBGL_lose_context")?.loseContext();

  return {
    available: true,
    profile: full ? "full" : "light",
    webgl2: Boolean(webgl2Context),
    maxTextureSize,
  };
};

export type NeuroVisionHardwareCapability = NeuroViewHardwareCapability;
export const detectNeuroVisionHardware = detectNeuroViewHardware;
