import { NodeObject, LinkObject } from "react-force-graph-2d";

export interface GraphNode extends NodeObject {
  id: string;
  label: string;
  type: 'patient' | 'note' | 'tag' | 'flow' | 'evidence';
  val: number;
  color: string;
  imgUrl?: string | null;
  imgObj?: HTMLImageElement;
  data?: any;
  neighbors?: GraphNode[];
  links?: GraphLink[];

  // Animation state
  currentRadius: number;
  targetRadius: number;
  currentGlow: number;
  targetGlow: number;
  currentOpacity?: number;
  currentScale?: number;
  revealProgress?: number;
  revealTarget?: number;
  bloomIntensity?: number;
  dragPulse?: number;
  pulseSeed?: number;

  // Physics state (from d3)
  x?: number;
  y?: number;
  fx?: number;
  fy?: number;
}

export interface GraphLink extends LinkObject {
  source: GraphNode | string;
  target: GraphNode | string;
  value: number;
  currentOpacity?: number;
  currentWidth?: number;
  revealProgress?: number;
  revealTarget?: number;
  pulseSeed?: number;
}

export const GRAPH_COLORS = {
  patient: "#FFFFFF",
  note: "#A8A29E", // stone-400
  flow: "#7DD3FC", // sky-300
  evidence: "#C4B5FD", // violet-300
  tag: "#78716C", // stone-500
  highlight: "#FFFFFF",
  background: "#020204",
  backgroundGradient: "#100f1c", // Dark purple
  linkDefault: "rgba(255, 255, 255, 0.05)",
  linkActive: "rgba(200, 200, 255, 0.5)"
};
