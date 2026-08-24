import { GraphNode, GraphLink } from "./graph-types";
import {
  getNeuroVisionDisplayLabel,
  shouldUseNeuroVisionLabelSurface,
} from "./neurovision-labels";

// Linear interpolation for smooth animations.
export const lerp = (current: number, target: number, factor: number): number => {
  return current + (target - current) * factor;
};

const clamp = (value: number, min: number, max: number) => Math.max(min, Math.min(max, value));

const colorWithAlpha = (color: string, alpha: number) => {
  const safeAlpha = clamp(alpha, 0, 1);

  if (color.startsWith("#")) {
    const hex = color.replace("#", "");
    const normalized = hex.length === 3
      ? hex.split("").map((char) => char + char).join("")
      : hex.padEnd(6, "0").slice(0, 6);

    const r = parseInt(normalized.slice(0, 2), 16);
    const g = parseInt(normalized.slice(2, 4), 16);
    const b = parseInt(normalized.slice(4, 6), 16);

    return `rgba(${r}, ${g}, ${b}, ${safeAlpha})`;
  }

  if (color.startsWith("rgb(")) {
    return color.replace("rgb(", "rgba(").replace(")", `, ${safeAlpha})`);
  }

  return color;
};

const quadraticPoint = (
  sx: number,
  sy: number,
  cx: number,
  cy: number,
  tx: number,
  ty: number,
  t: number
) => {
  const mt = 1 - t;
  return {
    x: mt * mt * sx + 2 * mt * t * cx + t * t * tx,
    y: mt * mt * sy + 2 * mt * t * cy + t * t * ty,
  };
};

const drawQuadraticFilamentPulse = (
  ctx: CanvasRenderingContext2D,
  points: { sx: number; sy: number; cx: number; cy: number; tx: number; ty: number },
  globalScale: number,
  time: number,
  seed: number,
  isDarkMode: boolean,
  reveal: number,
  baseWidth: number,
) => {
  const sampleCount = 24;
  const spread = 0.12;
  const cycle = (time * 0.13 + seed) % 1;
  const travel = -spread + cycle * (1 + spread * 2);
  const widthBoost = 0.78 / Math.max(globalScale, 0.6);
  const baseOpacity = 0.34 * reveal;

  ctx.save();
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.strokeStyle = isDarkMode ? "rgba(255,255,255,0.88)" : "rgba(30,30,34,0.76)";
  ctx.shadowColor = isDarkMode ? "rgba(255,255,255,0.2)" : "rgba(24,24,27,0.1)";
  ctx.shadowBlur = 3.5 / Math.max(globalScale, 0.75);

  for (let index = 0; index < sampleCount; index += 1) {
    const t0 = index / sampleCount;
    const t1 = (index + 1) / sampleCount;
    const midpoint = (t0 + t1) * 0.5;
    const distance = Math.abs(midpoint - travel);
    const envelope = Math.exp(-0.5 * (distance / spread) ** 2);
    if (envelope < 0.035) continue;

    const start = quadraticPoint(points.sx, points.sy, points.cx, points.cy, points.tx, points.ty, t0);
    const end = quadraticPoint(points.sx, points.sy, points.cx, points.cy, points.tx, points.ty, t1);
    ctx.globalAlpha = baseOpacity * envelope;
    ctx.lineWidth = baseWidth + widthBoost * envelope;
    ctx.beginPath();
    ctx.moveTo(start.x, start.y);
    ctx.lineTo(end.x, end.y);
    ctx.stroke();
  }

  ctx.restore();
};

const getNodeBase = (node: GraphNode) => {
  if (node.type === "patient") return { radius: 6, glow: 26 };
  if (node.type === "flow") return { radius: 5.2, glow: 22 };
  if (node.type === "note") return { radius: 4.2, glow: 18 };
  if (node.type === "evidence") return { radius: 3.5, glow: 15 };
  return { radius: 2.8, glow: 12 };
};

export const drawNode = (
  node: GraphNode,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  hoverNode: GraphNode | null,
  isDarkMode: boolean = true,
  time: number = 0,
  performanceMode: boolean = false,
  emphasizedNodeIds?: ReadonlySet<string>,
) => {
  const x = node.x;
  const y = node.y;

  if (x === undefined || y === undefined || !Number.isFinite(x) || !Number.isFinite(y)) return;

  const isHovered = hoverNode?.id === node.id;
  const isNeighbor = hoverNode && hoverNode.neighbors?.some((neighbor) => neighbor.id === node.id);
  const isEmphasized = Boolean(emphasizedNodeIds?.has(node.id));
  const hasEmphasis = Boolean(emphasizedNodeIds?.size);
  const isConnectedChain = Boolean(isHovered || isNeighbor || isEmphasized);
  const dimmed = Boolean((hoverNode || hasEmphasis) && !isConnectedChain);

  const { radius: baseRadius, glow: baseGlow } = getNodeBase(node);
  const reveal = clamp(node.revealProgress ?? 1, 0, 1);
  const bloom = clamp(node.bloomIntensity ?? 0, 0, 1);
  const dragPulse = clamp(node.dragPulse ?? 0, 0, 1);
  const pulseSeed = (node.pulseSeed ?? 0) * 0.013;
  const evidenceTension = clamp(Number(node.data?.evidence?.gravity?.tension) || 0, 0, 1);
  const breathingAmplitude = node.type === "patient" ? 0.024 : 0.014 + evidenceTension * 0.052;
  const breathing = Math.sin(time * 1.65 + pulseSeed) * breathingAmplitude;

  const radius = Math.max(
    0.1,
    (Number.isFinite(node.currentRadius) && node.currentRadius > 0 ? node.currentRadius : baseRadius)
      * (1 + breathing + bloom * 0.45 + dragPulse * 0.22)
  );
  const glowRadius = Math.max(
    1,
    Number.isFinite(node.currentGlow) ? node.currentGlow : baseGlow
  );

  const dimOpacity = isDarkMode ? 0.08 : 0.06;
  const normalOpacity = isDarkMode ? 0.74 : 0.82;
  const activeOpacity = 1;
  const targetOpacity = (dimmed ? dimOpacity : (isConnectedChain ? activeOpacity : normalOpacity)) * reveal;

  node.currentOpacity = node.currentOpacity ?? targetOpacity;
  node.currentOpacity = lerp(node.currentOpacity, targetOpacity, 0.14);

  if ((node.currentOpacity || 0) < 0.01 || reveal < 0.01) return;

  ctx.save();
  ctx.globalAlpha = node.currentOpacity;

  const nodeColor = node.type === "patient"
    ? (isDarkMode ? "#d9d9df" : "#242428")
    : node.color;

  if (!performanceMode) {
    const haloRadius = Math.max(radius + glowRadius * (0.42 + bloom * 0.32 + dragPulse * 0.26), radius * 2.75);
    const halo = ctx.createRadialGradient(x, y, radius * 0.5, x, y, haloRadius);
    halo.addColorStop(0, colorWithAlpha(nodeColor, isConnectedChain ? (isDarkMode ? 0.16 : 0.1) : (isDarkMode ? 0.052 : 0.032)));
    halo.addColorStop(0.38, colorWithAlpha(nodeColor, isConnectedChain ? (isDarkMode ? 0.075 : 0.045) : (isDarkMode ? 0.022 : 0.014)));
    halo.addColorStop(0.72, colorWithAlpha(nodeColor, isConnectedChain ? (isDarkMode ? 0.018 : 0.012) : 0.006));
    halo.addColorStop(1, colorWithAlpha(nodeColor, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, haloRadius, 0, Math.PI * 2);
    ctx.fill();

    const plasmaEnergy = clamp(Math.max(isHovered ? 0.74 : 0, bloom * 0.58, dragPulse * 0.5), 0, 1);
    if (plasmaEnergy > 0.025) {
      const plasmaBreath = 1 + Math.sin(time * 1.7 + pulseSeed) * 0.045;
      const plasmaRadius = (radius + glowRadius * 0.72) * plasmaBreath;
      for (let lobe = 0; lobe < 2; lobe += 1) {
        ctx.save();
        ctx.translate(x, y);
        ctx.rotate(pulseSeed * 0.37 + lobe * Math.PI * 0.57 + Math.sin(time * 0.31 + lobe) * 0.08);
        ctx.scale(lobe === 0 ? 1.08 : 0.82, lobe === 0 ? 0.78 : 1.12);
        const plasma = ctx.createRadialGradient(0, 0, radius * 0.72, 0, 0, plasmaRadius);
        plasma.addColorStop(0, colorWithAlpha(nodeColor, 0));
        plasma.addColorStop(0.24, colorWithAlpha(nodeColor, plasmaEnergy * (isDarkMode ? 0.09 : 0.055)));
        plasma.addColorStop(0.52, colorWithAlpha(nodeColor, plasmaEnergy * (isDarkMode ? 0.048 : 0.03)));
        plasma.addColorStop(0.82, colorWithAlpha(nodeColor, plasmaEnergy * 0.012));
        plasma.addColorStop(1, colorWithAlpha(nodeColor, 0));
        ctx.globalAlpha = (node.currentOpacity || 1) * (lobe === 0 ? 1 : 0.72);
        ctx.fillStyle = plasma;
        ctx.beginPath();
        ctx.arc(0, 0, plasmaRadius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }
      ctx.globalAlpha = node.currentOpacity;
    }
  }

  if (node.type === "patient" && node.imgObj && node.imgObj.complete && node.imgObj.naturalWidth > 0) {
    ctx.save();
    ctx.shadowBlur = isHovered ? 14 / Math.max(globalScale * 0.6, 0.8) : 0;
    ctx.shadowColor = isDarkMode ? "rgba(255,255,255,0.28)" : "rgba(0,0,0,0.12)";

    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.clip();

    try {
      ctx.drawImage(node.imgObj, x - radius, y - radius, radius * 2, radius * 2);
    } catch {
      ctx.fillStyle = isDarkMode ? "#fff" : "#18181b";
      ctx.fill();
    }
    ctx.restore();

    const rim = ctx.createRadialGradient(x - radius * 0.4, y - radius * 0.45, radius * 0.2, x, y, radius * 1.15);
    rim.addColorStop(0, isDarkMode ? "rgba(255,255,255,0.58)" : "rgba(255,255,255,0.28)");
    rim.addColorStop(1, isDarkMode ? "rgba(255,255,255,0.13)" : "rgba(0,0,0,0.16)");
    ctx.strokeStyle = isHovered ? rim : (isDarkMode ? "rgba(255,255,255,0.24)" : "rgba(24,24,27,0.15)");
    ctx.lineWidth = (isHovered ? 2 : 1) / globalScale;
    ctx.beginPath();
    ctx.arc(x, y, radius + 0.5 / globalScale, 0, Math.PI * 2);
    ctx.stroke();
  } else {
    const coreGradient = ctx.createRadialGradient(
      x - radius * 0.42,
      y - radius * 0.42,
      Math.max(0.1, radius * 0.08),
      x,
      y,
      radius * 1.25
    );

    coreGradient.addColorStop(0, isDarkMode ? "rgba(255,255,255,0.44)" : "rgba(255,255,255,0.62)");
    coreGradient.addColorStop(0.22, colorWithAlpha(nodeColor, node.type === "tag" ? (isDarkMode ? 0.7 : 0.62) : (isDarkMode ? 0.82 : 0.76)));
    coreGradient.addColorStop(0.74, colorWithAlpha(nodeColor, node.type === "tag" ? 0.44 : 0.64));
    coreGradient.addColorStop(1, isDarkMode ? colorWithAlpha(nodeColor, node.type === "tag" ? 0.3 : 0.48) : "rgba(24,24,27,0.68)");

    ctx.shadowBlur = isConnectedChain
      ? Math.min(glowRadius * 0.24, 6 / Math.max(globalScale, 0.75))
      : Math.min(glowRadius * (isDarkMode ? 0.09 : 0.055), 2.6 / Math.max(globalScale, 0.75));
    ctx.shadowColor = colorWithAlpha(nodeColor, isConnectedChain ? 0.28 : 0.12);
    ctx.fillStyle = coreGradient;
    ctx.beginPath();
    ctx.arc(x, y, radius, 0, Math.PI * 2);
    ctx.fill();

    if (!performanceMode) {
      const microHighlight = ctx.createRadialGradient(
        x - radius * 0.38,
        y - radius * 0.42,
        0,
        x - radius * 0.3,
        y - radius * 0.34,
        radius * 0.68,
      );
      microHighlight.addColorStop(0, isDarkMode ? "rgba(255,255,255,0.34)" : "rgba(255,255,255,0.48)");
      microHighlight.addColorStop(0.38, isDarkMode ? "rgba(255,255,255,0.08)" : "rgba(255,255,255,0.14)");
      microHighlight.addColorStop(1, "rgba(255,255,255,0)");
      ctx.globalAlpha = (node.currentOpacity || 1) * (isConnectedChain ? 0.72 : 0.46);
      ctx.fillStyle = microHighlight;
      ctx.beginPath();
      ctx.arc(x, y, radius * 0.94, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = node.currentOpacity || 1;
    }

    ctx.shadowBlur = 0;
    ctx.strokeStyle = isDarkMode ? "rgba(255,255,255,0.2)" : "rgba(24,24,27,0.13)";
    ctx.lineWidth = 0.65 / globalScale;
    ctx.beginPath();
    ctx.arc(x, y, radius + 0.35 / globalScale, 0, Math.PI * 2);
    ctx.stroke();

  }

  const showLabel = isConnectedChain || node.type === "patient" || globalScale > 2.3;

  if (showLabel) {
    const hasLabelSurface = shouldUseNeuroVisionLabelSurface(node);
    const fontSize = (hasLabelSurface ? (isHovered ? 13 : 10.5) : (isHovered ? 10.5 : 9.25)) / globalScale;
    ctx.font = `${isHovered ? "700" : "600"} ${fontSize}px "Inter", sans-serif`;

    const label = getNeuroVisionDisplayLabel(node);
    const textWidth = ctx.measureText(label).width;
    const paddingX = 8 / globalScale;
    const paddingY = 4 / globalScale;
    const textY = y + radius + 8 / globalScale;
    const labelAlpha = (
      isConnectedChain
        ? hasLabelSurface ? 0.96 : isHovered ? 0.82 : 0.66
        : (isDarkMode ? 0.38 : 0.52)
    ) * reveal;

    ctx.globalAlpha = (node.currentOpacity || 1) * labelAlpha;

    if (isConnectedChain && hasLabelSurface) {
      const rw = textWidth + paddingX * 2;
      const rh = fontSize + paddingY * 2;
      const rx = x - rw / 2;
      const ry = textY;

      const labelSurface = ctx.createLinearGradient(rx, ry, rx, ry + rh);
      if (isDarkMode) {
        labelSurface.addColorStop(0, "rgba(23,23,26,0.9)");
        labelSurface.addColorStop(1, "rgba(5,5,6,0.86)");
      } else {
        labelSurface.addColorStop(0, "rgba(255,255,255,0.98)");
        labelSurface.addColorStop(1, "rgba(250,250,250,0.9)");
      }
      ctx.shadowBlur = (isHovered ? 14 : 8) / Math.max(globalScale, 0.7);
      ctx.shadowColor = isDarkMode ? "rgba(0,0,0,0.48)" : "rgba(24,24,27,0.12)";
      ctx.fillStyle = labelSurface;
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, 6 / globalScale);
      ctx.fill();
      ctx.shadowBlur = 0;

      ctx.strokeStyle = isDarkMode ? "rgba(255,255,255,0.16)" : "rgba(24,24,27,0.12)";
      ctx.lineWidth = 1 / globalScale;
      ctx.stroke();
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = isConnectedChain
      ? (isDarkMode ? "#fff" : "#09090b")
      : (isDarkMode ? "rgba(255,255,255,0.62)" : "rgba(24,24,27,0.62)");
    if (!hasLabelSurface) {
      ctx.shadowBlur = 3 / Math.max(globalScale, 0.75);
      ctx.shadowColor = isDarkMode ? "rgba(0,0,0,0.72)" : "rgba(255,255,255,0.9)";
    }
    ctx.fillText(label, x, textY + (hasLabelSurface ? paddingY : 1 / globalScale));
    ctx.shadowBlur = 0;
  }

  ctx.restore();
  ctx.globalAlpha = 1;
};

export const drawLink = (
  link: GraphLink,
  ctx: CanvasRenderingContext2D,
  globalScale: number,
  hoverNode: GraphNode | null,
  isDarkMode: boolean = true,
  time: number = 0,
  performanceMode: boolean = false,
  emphasizedNodeIds?: ReadonlySet<string>,
) => {
  const source = link.source as GraphNode;
  const target = link.target as GraphNode;

  if (!source || !target || typeof source === "string" || typeof target === "string") return;

  const rawSx = source.x;
  const rawSy = source.y;
  const rawTx = target.x;
  const rawTy = target.y;

  if (!Number.isFinite(rawSx) || !Number.isFinite(rawSy) || !Number.isFinite(rawTx) || !Number.isFinite(rawTy)) return;

  const reveal = clamp(link.revealProgress ?? 1, 0, 1);
  const isConnectedToHover = Boolean(hoverNode && (source.id === hoverNode.id || target.id === hoverNode.id));
  const isEmphasized = Boolean(emphasizedNodeIds?.has(source.id) && emphasizedNodeIds?.has(target.id));
  const hasEmphasis = Boolean(emphasizedNodeIds?.size);
  const isActive = isConnectedToHover || isEmphasized;
  const dimmed = Boolean((hoverNode || hasEmphasis) && !isActive);
  const baseOpacity = isDarkMode ? 0.068 : 0.052;
  const targetOpacity = (dimmed ? (isDarkMode ? 0.025 : 0.014) : (isActive ? (isDarkMode ? 0.82 : 0.76) : baseOpacity)) * reveal;
  const targetWidth = ((isActive ? 1.5 : (isDarkMode ? 0.38 : 0.27)) + (link.value || 1) * (isActive ? 0.065 : (isDarkMode ? 0.035 : 0.022))) / globalScale;

  link.currentOpacity = link.currentOpacity ?? targetOpacity;
  link.currentWidth = link.currentWidth ?? targetWidth;
  link.currentOpacity = lerp(link.currentOpacity, targetOpacity, 0.12);
  link.currentWidth = lerp(link.currentWidth, targetWidth, 0.12);

  if ((link.currentOpacity || 0) < 0.01 || reveal < 0.01) return;

  const rawDx = rawTx! - rawSx!;
  const rawDy = rawTy! - rawSy!;
  const rawDistance = Math.max(1, Math.hypot(rawDx, rawDy));
  const ux = rawDx / rawDistance;
  const uy = rawDy / rawDistance;
  const sourceRadius = Math.max(0, source.currentRadius || getNodeBase(source).radius);
  const targetRadius = Math.max(0, target.currentRadius || getNodeBase(target).radius);
  const sourceClip = Math.min(sourceRadius + 0.65 / Math.max(globalScale, 0.7), rawDistance * 0.22);
  const targetClip = Math.min(targetRadius + 0.65 / Math.max(globalScale, 0.7), rawDistance * 0.22);
  const sx = rawSx! + ux * sourceClip;
  const sy = rawSy! + uy * sourceClip;
  const tx = rawTx! - ux * targetClip;
  const ty = rawTy! - uy * targetClip;
  const dx = tx - sx;
  const dy = ty - sy;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / distance;
  const ny = dx / distance;
  const seed = (link.pulseSeed ?? 0) / 997;
  const organicDrift = performanceMode ? 0 : (
    Math.sin(time * 0.42 + seed * Math.PI * 2) * Math.min(9, distance * 0.035)
    + Math.cos(time * 0.23 + sx * 0.004 - ty * 0.003) * Math.min(5, distance * 0.02)
  );
  const curve = (seed - 0.5) * Math.min(26, distance * 0.09) + organicDrift;
  const cx = (sx + tx) / 2 + nx * curve;
  const cy = (sy + ty) / 2 + ny * curve;

  ctx.save();
  ctx.globalAlpha = link.currentOpacity;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(sx, sy);
  ctx.quadraticCurveTo(cx, cy, tx, ty);

  if (isActive) {
    const grad = ctx.createLinearGradient(sx, sy, tx, ty);
    grad.addColorStop(0, isDarkMode ? colorWithAlpha(source.color || "#ffffff", 0.92) : "rgba(39,39,42,0.68)");
    grad.addColorStop(0.52, isDarkMode ? "rgba(255,255,255,0.72)" : "rgba(24,24,27,0.9)");
    grad.addColorStop(1, isDarkMode ? colorWithAlpha(target.color || "#ffffff", 0.92) : "rgba(63,63,70,0.68)");
    ctx.strokeStyle = grad;
    ctx.shadowBlur = performanceMode ? 0 : 7 / Math.max(globalScale, 0.5);
    ctx.shadowColor = isDarkMode ? colorWithAlpha(target.color || "#ffffff", 0.42) : "rgba(24,24,27,0.2)";
  } else {
    ctx.strokeStyle = isDarkMode ? "rgba(255,255,255,0.68)" : "rgba(39,39,42,0.36)";
    ctx.shadowBlur = 0;
  }

  ctx.lineWidth = link.currentWidth;
  ctx.stroke();

  if (!performanceMode && isActive && !dimmed && reveal > 0.45) {
    drawQuadraticFilamentPulse(
      ctx,
      { sx, sy, cx, cy, tx, ty },
      globalScale,
      time,
      seed,
      isDarkMode,
      reveal,
      link.currentWidth || targetWidth,
    );
  }

  ctx.restore();
  ctx.globalAlpha = 1;
};
