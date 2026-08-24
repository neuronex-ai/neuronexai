import type { NeuroTimeSingularidade } from "../../clinical-evidence/neurotime-types";

export type NeuroTimeRibbonPoint = {
  x: number;
  upperY: number;
  lowerY: number;
};

export type NeuroTimeRibbonGeometry = {
  areaPath: string;
  centerPath: string;
  points: NeuroTimeRibbonPoint[];
};

const WIDTH = 1000;
const CENTER_Y = 34;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

type Point = { x: number; y: number };

const smoothCommands = (points: Point[]) => {
  if (points.length < 2) return "";
  return points.slice(0, -1).map((point, index) => {
    const previous = points[Math.max(0, index - 1)];
    const next = points[index + 1];
    const after = points[Math.min(points.length - 1, index + 2)];
    const minY = Math.min(point.y, next.y);
    const maxY = Math.max(point.y, next.y);
    const control1 = {
      x: point.x + (next.x - previous.x) / 6,
      y: clamp(point.y + (next.y - previous.y) / 6, minY, maxY),
    };
    const control2 = {
      x: next.x - (after.x - point.x) / 6,
      y: clamp(next.y - (after.y - point.y) / 6, minY, maxY),
    };
    return `C ${control1.x.toFixed(2)} ${control1.y.toFixed(2)}, ${control2.x.toFixed(2)} ${control2.y.toFixed(2)}, ${next.x.toFixed(2)} ${next.y.toFixed(2)}`;
  }).join(" ");
};

export const buildNeuroTimeRibbonGeometry = (
  singularities: NeuroTimeSingularidade[],
): NeuroTimeRibbonGeometry => {
  if (!singularities.length) return { areaPath: "", centerPath: "", points: [] };

  const sampled = singularities.map((singularity, index) => {
    const fallbackCenter = singularities.length === 1 ? 0.5 : index / (singularities.length - 1);
    const normalizedCenter = Number.isFinite(singularity.centroNormalizado)
      ? clamp(singularity.centroNormalizado, 0, 1)
      : fallbackCenter;
    const halfHeight = singularity.eventCount
      ? 3.2 + clamp(singularity.density, 0, 1) * 16.8
      : 1.35;
    return {
      x: 8 + normalizedCenter * (WIDTH - 16),
      upperY: CENTER_Y - halfHeight,
      lowerY: CENTER_Y + halfHeight,
    };
  }).sort((left, right) => left.x - right.x);

  const first = sampled[0];
  const last = sampled[sampled.length - 1];
  const points = [
    { x: 0, upperY: first.upperY, lowerY: first.lowerY },
    ...sampled,
    { x: WIDTH, upperY: last.upperY, lowerY: last.lowerY },
  ];
  const upper = points.map((point) => ({ x: point.x, y: point.upperY }));
  const lower = [...points].reverse().map((point) => ({ x: point.x, y: point.lowerY }));
  const center = points.map((point) => ({ x: point.x, y: CENTER_Y }));

  return {
    areaPath: `M ${upper[0].x} ${upper[0].y.toFixed(2)} ${smoothCommands(upper)} L ${lower[0].x} ${lower[0].y.toFixed(2)} ${smoothCommands(lower)} Z`,
    centerPath: `M ${center[0].x} ${center[0].y} ${smoothCommands(center)}`,
    points,
  };
};
