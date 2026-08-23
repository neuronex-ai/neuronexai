import type { NeuroVisionCameraAction } from "./three-scene";

type KeyboardCameraInput = {
  key: string;
  shiftKey?: boolean;
  altKey?: boolean;
  ctrlKey?: boolean;
  metaKey?: boolean;
};

export const getNeuroViewCameraAction = ({
  key,
  shiftKey = false,
  altKey = false,
  ctrlKey = false,
  metaKey = false,
}: KeyboardCameraInput): NeuroVisionCameraAction | null => {
  if (altKey || ctrlKey || metaKey) return null;
  if (key === "ArrowLeft") return "orbit-left";
  if (key === "ArrowRight") return "orbit-right";
  if (key === "ArrowUp") return "orbit-up";
  if (key === "ArrowDown") return "orbit-down";
  const normalizedKey = key.toLowerCase();
  if (shiftKey && normalizedKey === "w") return "elevate-up";
  if (shiftKey && normalizedKey === "s") return "elevate-down";
  if (normalizedKey === "w") return "dolly-in";
  if (normalizedKey === "s") return "dolly-out";
  if (normalizedKey === "a") return "strafe-left";
  if (normalizedKey === "d") return "strafe-right";
  return null;
};

export const getNeuroVisionCameraAction = getNeuroViewCameraAction;
