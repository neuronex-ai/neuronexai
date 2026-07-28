export function triggerNeuralCastTactileFeedback(strength = 8) {
  if (typeof window === "undefined" || typeof navigator === "undefined") return;
  if (!window.matchMedia("(pointer: coarse)").matches) return;

  const tactileNavigator = navigator as Navigator & { vibrate?: (pattern: number | number[]) => boolean };
  tactileNavigator.vibrate?.(strength);
}
