"use client";

import { useMemo, useRef, useState, useCallback, useEffect, type MouseEvent, type WheelEvent } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import { usePersonalNotes } from "@/hooks/use-personal-notes";
import { usePatients } from "@/hooks/use-patients";
import { cn } from "@/lib/utils";
import { PersonalNote, Patient } from "@/types";

interface UniverseNode {
  id: string;
  label: string;
  type: "patient" | "note" | "tag";
  color: string;
  size: number;
  data?: PersonalNote | Patient;
}

interface UniverseLink {
  source: string;
  target: string;
}

interface NeuroViewUniverseProps {
  onBack: () => void;
  onSelectNote?: (note: PersonalNote) => void;
  onSelectPatient?: (patient: Patient) => void;
  searchQuery?: string;
}

const NODE_COLORS = {
  patient: "#d9d9df",
  note: "#a9a9b2",
  tag: "#73737f",
};

const normalize = (value?: string | null) =>
  (value || "")
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");

const hashString = (value: string) => {
  let hash = 2166136261;
  for (let index = 0; index < value.length; index += 1) {
    hash ^= value.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return Math.abs(hash);
};

const hexToRgb = (hex: string) => {
  const raw = hex.replace("#", "");
  const full = raw.length === 3 ? raw.split("").map((c) => c + c).join("") : raw;
  const value = Number.parseInt(full, 16);
  return {
    r: (value >> 16) & 255,
    g: (value >> 8) & 255,
    b: value & 255,
  };
};

const rgba = (hex: string, alpha: number) => {
  const { r, g, b } = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

export const NeuroViewUniverse = ({
  onBack,
  onSelectNote,
  onSelectPatient,
  searchQuery = "",
}: NeuroViewUniverseProps) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const animationRef = useRef<number>(0);
  const projectedNodesRef = useRef<Array<{ id: string; x: number; y: number; radius: number; node: UniverseNode }>>([]);
  const nodeAlphaRef = useRef<Record<string, number>>({});
  const isDragging = useRef(false);
  const didDrag = useRef(false);
  const lastMouse = useRef({ x: 0, y: 0 });
  const zoomRef = useRef(1);
  const rotationRef = useRef({ x: 0.32, y: 0.04 });
  const [autoRotate, setAutoRotate] = useState(true);
  const [hoverNodeId, setHoverNodeId] = useState<string | null>(null);

  const { notes } = usePersonalNotes();
  const { data: patients } = usePatients();
  const normalizedSearch = normalize(searchQuery);

  const { nodes, links } = useMemo(() => {
    const patientList = patients || [];
    const noteList = notes || [];
    const nodeMap = new Map<string, UniverseNode>();
    const linkList: UniverseLink[] = [];
    const matchedPatientIds = new Set<string>(
      patientList
        .filter((patient) => normalizedSearch && normalize(patient.name).includes(normalizedSearch))
        .map((patient) => String(patient.id))
    );

    const visibleNotes = normalizedSearch
      ? noteList.filter((note) => {
          const patient = patientList.find((item) => item.id === note.patient_id);
          const text = [
            note.title,
            note.content,
            note.patient_name,
            patient?.name,
            ...(note.tags || []),
          ].map(normalize).join(" ");

          return text.includes(normalizedSearch) || (note.patient_id ? matchedPatientIds.has(note.patient_id) : false);
        })
      : noteList;

    const visiblePatientIds = new Set<string>();
    visibleNotes.forEach((note) => {
      if (note.patient_id) visiblePatientIds.add(note.patient_id);
    });
    matchedPatientIds.forEach((id) => visiblePatientIds.add(id));

    patientList.forEach((patient) => {
      if (normalizedSearch && !visiblePatientIds.has(patient.id)) return;

      nodeMap.set(`pat-${patient.id}`, {
        id: `pat-${patient.id}`,
        label: patient.name,
        type: "patient",
        color: NODE_COLORS.patient,
        size: 12,
        data: patient,
      });
    });

    visibleNotes.forEach((note) => {
      const noteId = `note-${note.id}`;
      nodeMap.set(noteId, {
        id: noteId,
        label: note.title || "Sem título",
        type: "note",
        color: NODE_COLORS.note,
        size: 8,
        data: note,
      });

      if (note.patient_id && nodeMap.has(`pat-${note.patient_id}`)) {
        linkList.push({ source: noteId, target: `pat-${note.patient_id}` });
      }

      note.tags?.forEach((tag) => {
        const tagId = `tag-${tag}`;
        if (!nodeMap.has(tagId)) {
          nodeMap.set(tagId, {
            id: tagId,
            label: `#${tag}`,
            type: "tag",
            color: NODE_COLORS.tag,
            size: 5.5,
          });
        }
        linkList.push({ source: noteId, target: tagId });
      });
    });

    return { nodes: Array.from(nodeMap.values()), links: linkList };
  }, [notes, patients, normalizedSearch]);

  const nodePositions = useMemo(() => {
    const positions = new Map<string, { x: number; y: number; z: number }>();
    const goldenRatio = (1 + Math.sqrt(5)) / 2;
    const safeLength = Math.max(nodes.length, 1);

    nodes.forEach((node, index) => {
      const seed = hashString(node.id);
      const theta = (2 * Math.PI * index) / goldenRatio + (seed % 1000) / 1000;
      const phi = Math.acos(1 - 2 * (index + 0.5) / safeLength);
      const radius = 225 + (seed % 95);

      positions.set(node.id, {
        x: radius * Math.sin(phi) * Math.cos(theta),
        y: radius * Math.sin(phi) * Math.sin(theta),
        z: radius * Math.cos(phi),
      });
    });

    return positions;
  }, [nodes]);

  const stars = useMemo(() => {
    return Array.from({ length: 220 }, (_, index) => {
      const seed = hashString(`star-${index}`);
      const x = ((seed % 2000) / 1000) - 1;
      const y = (((seed / 11) % 2000) / 1000) - 1;
      const z = (((seed / 29) % 2000) / 1000) - 1;

      return {
        x,
        y,
        z,
        brightness: 0.15 + ((seed % 100) / 100) * 0.48,
        size: 0.45 + ((seed % 80) / 100),
      };
    });
  }, []);

  const connectedNodeIds = useMemo(() => {
    if (!hoverNodeId) return new Set<string>();
    const connected = new Set<string>([hoverNodeId]);
    links.forEach((link) => {
      if (link.source === hoverNodeId) connected.add(link.target);
      if (link.target === hoverNodeId) connected.add(link.source);
    });
    return connected;
  }, [hoverNodeId, links]);

  const project = useCallback((pos: { x: number; y: number; z: number }, w: number, h: number) => {
    const rotation = rotationRef.current;
    const zoom = zoomRef.current;
    const cosX = Math.cos(rotation.x), sinX = Math.sin(rotation.x);
    const cosY = Math.cos(rotation.y), sinY = Math.sin(rotation.y);

    const x = pos.x * cosY + pos.z * sinY;
    let z = -pos.x * sinY + pos.z * cosY;
    const y = pos.y * cosX - z * sinX;
    z = pos.y * sinX + z * cosX;

    const perspective = 820;
    const scale = (perspective / (perspective + z)) * zoom;

    return {
      x: w / 2 + x * scale,
      y: h / 2 + y * scale,
      scale,
      z,
    };
  }, []);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const render = () => {
      const dpr = window.devicePixelRatio || 1;
      const sw = canvas.offsetWidth;
      const sh = canvas.offsetHeight;
      canvas.width = Math.max(1, Math.floor(sw * dpr));
      canvas.height = Math.max(1, Math.floor(sh * dpr));
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      projectedNodesRef.current = [];

      const background = ctx.createRadialGradient(sw * 0.5, sh * 0.45, 0, sw * 0.5, sh * 0.45, Math.max(sw, sh) * 0.75);
      background.addColorStop(0, "#151518");
      background.addColorStop(0.42, "#08080a");
      background.addColorStop(1, "#010102");
      ctx.fillStyle = background;
      ctx.fillRect(0, 0, sw, sh);

      stars.forEach((star) => {
        const proj = project({ x: star.x * 640, y: star.y * 640, z: star.z * 640 }, sw, sh);
        if (proj.z <= -760) return;

        const time = performance.now() / 3400;
        const twinkle = 0.45 + 0.55 * Math.sin(time + star.x * 6 + star.y * 3);
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, Math.max(0.16, star.size * proj.scale * 0.28), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(225, 225, 232, ${star.brightness * twinkle * 0.28})`;
        ctx.fill();
      });

      links.forEach((link) => {
        const srcPos = nodePositions.get(link.source);
        const tgtPos = nodePositions.get(link.target);
        if (!srcPos || !tgtPos) return;

        const src = project(srcPos, sw, sh);
        const tgt = project(tgtPos, sw, sh);
        const sourceAlpha = nodeAlphaRef.current[link.source] ?? 0;
        const targetAlpha = nodeAlphaRef.current[link.target] ?? 0;
        const isConnected = connectedNodeIds.size === 0 || (connectedNodeIds.has(link.source) && connectedNodeIds.has(link.target));
        const alpha = Math.min(sourceAlpha, targetAlpha) * (isConnected ? 0.18 : 0.035) * Math.min(src.scale, tgt.scale);

        const midX = (src.x + tgt.x) / 2;
        const midY = (src.y + tgt.y) / 2;
        const curveSeed = hashString(`${link.source}-${link.target}`);
        const curve = (((curveSeed % 200) / 100) - 1) * 18;
        const dx = tgt.x - src.x;
        const dy = tgt.y - src.y;
        const length = Math.max(1, Math.hypot(dx, dy));
        const controlX = midX + (-dy / length) * curve;
        const controlY = midY + (dx / length) * curve;

        ctx.beginPath();
        ctx.moveTo(src.x, src.y);
        ctx.quadraticCurveTo(controlX, controlY, tgt.x, tgt.y);
        ctx.strokeStyle = `rgba(232, 232, 236, ${alpha})`;
        ctx.lineWidth = isConnected ? 0.72 : 0.42;
        ctx.stroke();
      });

      const sortedNodes = nodes
        .map((node) => ({ node, pos: nodePositions.get(node.id) }))
        .filter((item): item is { node: UniverseNode; pos: { x: number; y: number; z: number } } => Boolean(item.pos))
        .sort((a, b) => project(a.pos, sw, sh).z - project(b.pos, sw, sh).z);

      sortedNodes.forEach(({ node, pos }) => {
        const previousAlpha = nodeAlphaRef.current[node.id] ?? 0;
        const targetAlpha = 1;
        const alpha = previousAlpha + (targetAlpha - previousAlpha) * 0.075;
        nodeAlphaRef.current[node.id] = alpha;

        const proj = project(pos, sw, sh);
        if (proj.z <= -760) return;

        const isHovered = hoverNodeId === node.id;
        const isConnected = connectedNodeIds.size === 0 || connectedNodeIds.has(node.id);
        const focusAlpha = isConnected ? 1 : 0.24;
        const radius = node.size * proj.scale * (isHovered ? 0.68 : 0.52);
        const visibleAlpha = alpha * focusAlpha * Math.min(1, Math.max(0.22, proj.scale));
        const pulse = 0.82 + Math.sin(performance.now() / 920 + hashString(node.id) * 0.01) * 0.12;

        const glow = ctx.createRadialGradient(proj.x, proj.y, 0, proj.x, proj.y, radius * 5.3);
        glow.addColorStop(0, rgba(node.color, 0.18 * visibleAlpha * pulse));
        glow.addColorStop(0.36, rgba(node.color, 0.065 * visibleAlpha));
        glow.addColorStop(1, "rgba(255,255,255,0)");
        ctx.beginPath();
        ctx.arc(proj.x, proj.y, radius * 5.3, 0, Math.PI * 2);
        ctx.fillStyle = glow;
        ctx.fill();

        ctx.beginPath();
        ctx.arc(proj.x, proj.y, Math.max(1.4, radius), 0, Math.PI * 2);
        ctx.fillStyle = rgba(node.color, 0.46 * visibleAlpha);
        ctx.fill();

        ctx.beginPath();
        ctx.arc(proj.x - radius * 0.22, proj.y - radius * 0.26, Math.max(0.55, radius * 0.32), 0, Math.PI * 2);
        ctx.fillStyle = `rgba(255, 255, 255, ${0.22 * visibleAlpha})`;
        ctx.fill();

        if (isHovered || node.type === "patient" || radius > 3.2) {
          ctx.font = `${isHovered ? 12 : 10}px Inter, system-ui, sans-serif`;
          ctx.textAlign = "center";
          ctx.fillStyle = `rgba(244, 244, 246, ${Math.min(0.86, visibleAlpha * (isHovered ? 1 : 0.5))})`;
          ctx.fillText(node.label, proj.x, proj.y + radius + 14);
        }

        projectedNodesRef.current.push({
          id: node.id,
          x: proj.x,
          y: proj.y,
          radius: Math.max(16, radius + 9),
          node,
        });
      });

      if (autoRotate && !isDragging.current) {
        rotationRef.current = { ...rotationRef.current, y: rotationRef.current.y + 0.00145 };
      }

      animationRef.current = requestAnimationFrame(render);
    };

    animationRef.current = requestAnimationFrame(render);
    return () => cancelAnimationFrame(animationRef.current);
  }, [nodes, links, nodePositions, stars, autoRotate, project, hoverNodeId, connectedNodeIds]);

  useEffect(() => {
    const activeIds = new Set(nodes.map((node) => node.id));
    Object.keys(nodeAlphaRef.current).forEach((id) => {
      if (!activeIds.has(id)) delete nodeAlphaRef.current[id];
    });
  }, [nodes]);

  const updateHoveredNode = (clientX: number, clientY: number) => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const rect = canvas.getBoundingClientRect();
    const x = clientX - rect.left;
    const y = clientY - rect.top;

    const hovered = projectedNodesRef.current
      .slice()
      .reverse()
      .find((item) => Math.hypot(item.x - x, item.y - y) <= item.radius);

    setHoverNodeId(hovered?.id || null);
  };

  const handleMouseDown = (e: MouseEvent) => {
    isDragging.current = true;
    didDrag.current = false;
    lastMouse.current = { x: e.clientX, y: e.clientY };
    setAutoRotate(false);
  };

  const handleMouseMove = (e: MouseEvent) => {
    if (!isDragging.current) {
      updateHoveredNode(e.clientX, e.clientY);
      return;
    }

    const dx = e.clientX - lastMouse.current.x;
    const dy = e.clientY - lastMouse.current.y;
    if (Math.hypot(dx, dy) > 3) didDrag.current = true;

    rotationRef.current = {
      x: Math.max(-1.05, Math.min(1.05, rotationRef.current.x + dy * 0.0034)),
      y: rotationRef.current.y + dx * 0.0034,
    };
    lastMouse.current = { x: e.clientX, y: e.clientY };
  };

  const handleMouseUp = (e: MouseEvent) => {
    isDragging.current = false;
    if (!didDrag.current) updateHoveredNode(e.clientX, e.clientY);
    window.setTimeout(() => setAutoRotate(true), 3200);
  };

  const handleMouseLeave = () => {
    isDragging.current = false;
    setHoverNodeId(null);
    window.setTimeout(() => setAutoRotate(true), 3200);
  };

  const handleClick = () => {
    if (didDrag.current || !hoverNodeId) return;
    const node = projectedNodesRef.current.find((item) => item.id === hoverNodeId)?.node;
    if (!node) return;

    if (node.type === "note" && node.data) {
      onSelectNote?.(node.data as PersonalNote);
    }

    if (node.type === "patient" && node.data) {
      onSelectPatient?.(node.data as Patient);
    }
  };

  const handleWheel = (e: WheelEvent) => {
    e.preventDefault();
    zoomRef.current = Math.max(0.45, Math.min(2.4, zoomRef.current - e.deltaY * 0.00085));
  };

  return (
    <div className="relative isolate h-full min-h-0 w-full min-w-0 overflow-hidden bg-transparent [contain:layout_paint_size]">
      <canvas
        ref={canvasRef}
        className={cn("block h-full w-full", hoverNodeId ? "cursor-pointer" : "cursor-grab active:cursor-grabbing")}
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseLeave}
        onClick={handleClick}
        onWheel={handleWheel}
      />

      <div className="pointer-events-none absolute inset-0 z-50 flex items-start justify-between p-5">
        <motion.button
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          onClick={onBack}
          className="pointer-events-auto flex items-center gap-2.5 rounded-[18px] border border-white/[0.09] bg-white/[0.075] px-4 py-2.5 text-[9px] font-black uppercase tracking-[0.2em] text-white/70 shadow-[0_24px_70px_-40px_rgba(0,0,0,0.9),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-3xl transition-all duration-500 hover:-translate-y-0.5 hover:bg-white/[0.12] hover:text-white"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar ao 2D
        </motion.button>

        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.28 }}
          className="pointer-events-auto rounded-[22px] border border-white/[0.09] bg-white/[0.065] p-4 shadow-[0_24px_70px_-44px_rgba(0,0,0,0.92),inset_0_1px_0_rgba(255,255,255,0.08)] backdrop-blur-3xl"
        >
          <p className="mb-3 text-[8px] font-black uppercase tracking-[0.34em] text-white/38">Legenda</p>
          <div className="space-y-2">
            {[
              { label: "Pacientes", color: NODE_COLORS.patient },
              { label: "Notas", color: NODE_COLORS.note },
              { label: "Tags", color: NODE_COLORS.tag },
            ].map((item) => (
              <div key={item.label} className="flex items-center gap-2.5">
                <span className="h-2.5 w-2.5 rounded-full shadow-[0_0_18px_rgba(255,255,255,0.16)]" style={{ backgroundColor: item.color }} />
                <span className="text-[9px] font-bold tracking-[0.12em] text-white/54">{item.label}</span>
              </div>
            ))}
          </div>
          <p className="mt-3 text-[8px] font-semibold uppercase tracking-[0.18em] text-white/25">
            {nodes.length} nós · {links.length} conexões
          </p>
        </motion.div>
      </div>
    </div>
  );
};
