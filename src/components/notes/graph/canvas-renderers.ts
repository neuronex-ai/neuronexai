import { GraphNode, GraphLink } from "./graph-types";

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
  const breathing = Math.sin(time * 1.65 + pulseSeed) * 0.06;

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
  const normalOpacity = isDarkMode ? 0.72 : 0.86;
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
    const haloRadius = Math.max(radius + glowRadius * (0.5 + bloom * 0.45 + dragPulse * 0.36), radius * 2.9);
    const halo = ctx.createRadialGradient(x, y, radius * 0.25, x, y, haloRadius);
    halo.addColorStop(0, colorWithAlpha(nodeColor, isConnectedChain ? 0.27 : 0.11));
    halo.addColorStop(0.45, colorWithAlpha(nodeColor, isConnectedChain ? 0.1 : 0.04));
    halo.addColorStop(1, colorWithAlpha(nodeColor, 0));
    ctx.fillStyle = halo;
    ctx.beginPath();
    ctx.arc(x, y, haloRadius, 0, Math.PI * 2);
    ctx.fill();

    if (bloom > 0.02 || dragPulse > 0.02 || isHovered) {
      const ringAlpha = clamp(0.22 * (bloom + dragPulse) + (isHovered ? 0.2 : 0), 0, 0.48);
      ctx.globalAlpha = node.currentOpacity * ringAlpha;
      ctx.strokeStyle = colorWithAlpha(nodeColor, 0.62);
      ctx.lineWidth = (0.9 + bloom * 1.05 + dragPulse * 0.7) / globalScale;
      ctx.beginPath();
      ctx.arc(x, y, radius + (9 + Math.sin(time * 2.8 + pulseSeed) * 2.8) / globalScale, 0, Math.PI * 2);
      ctx.stroke();
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

    coreGradient.addColorStop(0, isDarkMode ? "rgba(255,255,255,0.42)" : "rgba(255,255,255,0.46)");
    coreGradient.addColorStop(0.24, colorWithAlpha(nodeColor, node.type === "tag" ? 0.72 : 0.84));
    coreGradient.addColorStop(1, colorWithAlpha(nodeColor, node.type === "tag" ? 0.36 : 0.58));

    ctx.shadowBlur = isConnectedChain ? glowRadius * 0.56 : (isDarkMode ? glowRadius * 0.15 : glowRadius * 0.08);
    ctx.shadowColor = colorWithAlpha(nodeColor, isConnectedChain ? 0.44 : 0.2);
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

    if ((node.type === "note" || node.type === "flow") && (isConnectedChain || globalScale > 1.8)) {
      ctx.fillStyle = isDarkMode ? "rgba(255,255,255,0.58)" : "rgba(255,255,255,0.72)";
      ctx.beginPath();
      if (node.type === "flow") {
        ctx.roundRect(
          x - radius * 0.42,
          y - radius * 0.42,
          radius * 0.84,
          radius * 0.84,
          radius * 0.18
        );
      } else {
        ctx.arc(x - radius * 0.18, y - radius * 0.2, Math.max(0.7 / globalScale, radius * 0.22), 0, Math.PI * 2);
      }
      ctx.fill();
    }
  }

  const showLabel = isConnectedChain || node.type === "patient" || globalScale > 2.3;

  if (showLabel) {
    const fontSize = (isHovered ? 14 : 10.5) / globalScale;
    ctx.font = `${isHovered ? "700" : "600"} ${fontSize}px "Inter", sans-serif`;

    const label = node.label;
    const textWidth = ctx.measureText(label).width;
    const paddingX = 8 / globalScale;
    const paddingY = 4 / globalScale;
    const textY = y + radius + 8 / globalScale;
    const labelAlpha = (isConnectedChain ? 1 : (isDarkMode ? 0.42 : 0.6)) * reveal;

    ctx.globalAlpha = (node.currentOpacity || 1) * labelAlpha;

    if (isConnectedChain) {
      const rw = textWidth + paddingX * 2;
      const rh = fontSize + paddingY * 2;
      const rx = x - rw / 2;
      const ry = textY;

      ctx.fillStyle = isDarkMode ? "rgba(5,5,6,0.82)" : "rgba(255,255,255,0.92)";
      ctx.beginPath();
      ctx.roundRect(rx, ry, rw, rh, 6 / globalScale);
      ctx.fill();

      ctx.strokeStyle = isDarkMode ? "rgba(255,255,255,0.16)" : "rgba(24,24,27,0.12)";
      ctx.lineWidth = 1 / globalScale;
      ctx.stroke();
    }

    ctx.textAlign = "center";
    ctx.textBaseline = "top";
    ctx.fillStyle = isConnectedChain
      ? (isDarkMode ? "#fff" : "#09090b")
      : (isDarkMode ? "rgba(255,255,255,0.62)" : "rgba(24,24,27,0.62)");
    ctx.fillText(label, x, textY + paddingY);
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

  const sx = source.x;
  const sy = source.y;
  const tx = target.x;
  const ty = target.y;

  if (!Number.isFinite(sx) || !Number.isFinite(sy) || !Number.isFinite(tx) || !Number.isFinite(ty)) return;

  const reveal = clamp(link.revealProgress ?? 1, 0, 1);
  const isConnectedToHover = Boolean(hoverNode && (source.id === hoverNode.id || target.id === hoverNode.id));
  const isEmphasized = Boolean(emphasizedNodeIds?.has(source.id) && emphasizedNodeIds?.has(target.id));
  const hasEmphasis = Boolean(emphasizedNodeIds?.size);
  const isActive = isConnectedToHover || isEmphasized;
  const dimmed = Boolean((hoverNode || hasEmphasis) && !isActive);
  const baseOpacity = isDarkMode ? 0.12 : 0.18;
  const targetOpacity = (dimmed ? 0.025 : (isActive ? 0.82 : baseOpacity)) * reveal;
  const targetWidth = ((isActive ? 1.5 : 0.46) + (link.value || 1) * 0.065) / globalScale;

  link.currentOpacity = link.currentOpacity ?? targetOpacity;
  link.currentWidth = link.currentWidth ?? targetWidth;
  link.currentOpacity = lerp(link.currentOpacity, targetOpacity, 0.12);
  link.currentWidth = lerp(link.currentWidth, targetWidth, 0.12);

  if ((link.currentOpacity || 0) < 0.01 || reveal < 0.01) return;

  const dx = tx! - sx!;
  const dy = ty! - sy!;
  const distance = Math.max(1, Math.hypot(dx, dy));
  const nx = -dy / distance;
  const ny = dx / distance;
  const seed = (link.pulseSeed ?? 0) / 997;
  const organicDrift =
    Math.sin(time * 0.42 + seed * Math.PI * 2) * Math.min(9, distance * 0.035)
    + Math.cos(time * 0.23 + sx! * 0.004 - ty! * 0.003) * Math.min(5, distance * 0.02);
  const curve = (seed - 0.5) * Math.min(26, distance * 0.09) + organicDrift;
  const cx = (sx! + tx!) / 2 + nx * curve;
  const cy = (sy! + ty!) / 2 + ny * curve;

  ctx.save();
  ctx.globalAlpha = link.currentOpacity;
  ctx.lineCap = "round";
  ctx.lineJoin = "round";
  ctx.beginPath();
  ctx.moveTo(sx!, sy!);
  ctx.quadraticCurveTo(cx, cy, tx!, ty!);

  if (isActive) {
    const grad = ctx.createLinearGradient(sx!, sy!, tx!, ty!);
    grad.addColorStop(0, colorWithAlpha(source.color || "#ffffff", 0.92));
    grad.addColorStop(0.52, isDarkMode ? "rgba(255,255,255,0.72)" : "rgba(24,24,27,0.36)");
    grad.addColorStop(1, colorWithAlpha(target.color || "#ffffff", 0.92));
    ctx.strokeStyle = grad;
    ctx.shadowBlur = performanceMode ? 0 : 7 / Math.max(globalScale, 0.5);
    ctx.shadowColor = colorWithAlpha(target.color || "#ffffff", 0.42);
  } else {
    ctx.strokeStyle = isDarkMode ? "rgba(255,255,255,0.72)" : "rgba(24,24,27,0.58)";
    ctx.shadowBlur = 0;
  }

  ctx.lineWidth = link.currentWidth;
  ctx.stroke();

  if (!performanceMode && !dimmed && reveal > 0.45) {
    const pulseT = (time * 0.17 + seed) % 1;
    const pulse = quadraticPoint(sx!, sy!, cx, cy, tx!, ty!, pulseT);
    const pulseAlpha = (isActive ? 0.58 : 0.1) * (link.currentOpacity || 1);
    const pulseRadius = (isActive ? 3.1 : 1.8) / Math.max(globalScale, 0.6);

    ctx.globalAlpha = pulseAlpha;
    ctx.shadowBlur = isActive ? 14 / Math.max(globalScale, 0.7) : 6 / Math.max(globalScale, 0.7);
    ctx.shadowColor = isDarkMode ? "rgba(255,255,255,0.48)" : "rgba(24,24,27,0.2)";
    const pulseGradient = ctx.createRadialGradient(pulse.x, pulse.y, 0, pulse.x, pulse.y, pulseRadius * 2.4);
    pulseGradient.addColorStop(0, isDarkMode ? "rgba(255,255,255,0.72)" : "rgba(24,24,27,0.36)");
    pulseGradient.addColorStop(0.42, isDarkMode ? "rgba(255,255,255,0.22)" : "rgba(24,24,27,0.12)");
    pulseGradient.addColorStop(1, "rgba(255,255,255,0)");
    ctx.fillStyle = pulseGradient;
    ctx.beginPath();
    ctx.arc(pulse.x, pulse.y, pulseRadius * 2.4, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
  ctx.globalAlpha = 1;
};
