import { useEffect, useRef, useState, useCallback } from "react";
import ForceGraph2D, { ForceGraphMethods } from "react-force-graph-2d";
import { forceCollide, forceX, forceY } from "d3-force";
import { usePersonalNotes } from "@/hooks/use-personal-notes";
import { usePatients } from "@/hooks/use-patients";
import {
  Loader2, ZoomIn, ZoomOut, Target, Play, Search, X,
  Settings2, ChevronDown, ChevronLeft, Plus, Save,
  Share2, CalendarDays, UserCircle2, Trash2, Check,
} from "lucide-react";
import { NeuroConfig } from "@/components/notes/NeuroViewControls";
import { GraphNode, GraphLink } from "@/components/notes/graph/graph-types";
import { useGraphData } from "@/components/notes/graph/use-graph-data";
import { lerp, drawNode, drawLink } from "@/components/notes/graph/canvas-renderers";
import { PersonalNote } from "@/types";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { motion, AnimatePresence, PanInfo, useMotionValue, animate as motionAnimate } from "framer-motion";
import { format } from "date-fns";

import { toast } from "sonner";

// Mobile-optimized default config
const DEFAULT_CONFIG: NeuroConfig = {
  repulsion: -150,
  linkDistance: 45,
  centerForce: 0.15,
  performanceMode: false,
  showPatients: true,
  showNotes: true,
  showTags: true,
};

const SHEET_HALF = 0.50;
const SHEET_FULL = 0.92;

interface MobileNeuroViewProps {
  onBack?: () => void;
}

export const MobileNeuroView = ({ onBack }: MobileNeuroViewProps) => {
  // Refs
  const graphRef = useRef<ForceGraphMethods>();
  const containerRef = useRef<HTMLDivElement>(null);
  const animationFrameRef = useRef<number>();
  const timeRef = useRef<number>(0);

  // Theme
  const [isDarkMode, setIsDarkMode] = useState(true);
  useEffect(() => {
    const checkTheme = () => setIsDarkMode(document.documentElement.classList.contains("dark"));
    checkTheme();
    const observer = new MutationObserver(checkTheme);
    observer.observe(document.documentElement, { attributes: true, attributeFilter: ["class"] });
    return () => observer.disconnect();
  }, []);

  // Data
  const { notes, createNote, updateNote, deleteNote } = usePersonalNotes();
  const { data: patients } = usePatients();

  // Config with Persistence
  const [config, setConfig] = useState<NeuroConfig>(() => {
    // Try to load from localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('neuroview-mobile-config');
      if (saved) {
        try {
          return { ...DEFAULT_CONFIG, ...JSON.parse(saved) };
        } catch (e) {
          console.error("Failed to parse saved config", e);
        }
      }
    }
    return DEFAULT_CONFIG;
  });

  // Save config on change
  useEffect(() => {
    localStorage.setItem('neuroview-mobile-config', JSON.stringify(config));
  }, [config]);

  const [searchQuery, setSearchQuery] = useState("");
  const { graphData, isLoading } = useGraphData({ config, searchQuery });

  // UI State
  const [hoverNode, setHoverNode] = useState<GraphNode | null>(null);
  const [showSearch, setShowSearch] = useState(false);
  const [showFilters, setShowFilters] = useState(false);

  // Sheet State
  const [sheetOpen, setSheetOpen] = useState(false);
  const [sheetSnapFraction, setSheetSnapFraction] = useState(SHEET_HALF);
  const sheetY = useMotionValue(0);

  // Editing state
  const [editMode, setEditMode] = useState<"view" | "edit" | "create">("view");
  const [editingNote, setEditingNote] = useState<PersonalNote | null>(null);
  const [editTitle, setEditTitle] = useState("");
  const [editContent, setEditContent] = useState("");
  const [editPatientId, setEditPatientId] = useState<string | null>(null);
  const [editDate, setEditDate] = useState("");
  const [showPatientPicker, setShowPatientPicker] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // Container size
  const [containerSize, setContainerSize] = useState({ width: 0, height: 0 });
  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current) {
        const rect = containerRef.current.getBoundingClientRect();
        setContainerSize({ width: rect.width, height: rect.height });
      }
    };
    updateSize();
    const ro = new ResizeObserver(updateSize);
    if (containerRef.current) ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  // Animation Loop
  useEffect(() => {
    const animateFn = () => {
      timeRef.current += 0.016;
      const lerpFactor = 0.15;
      graphData.nodes.forEach((n) => {
        const baseRadius = n.type === "patient" ? 5 : n.type === "note" ? 3 : 2;
        const baseGlow = n.type === "patient" ? 20 : n.type === "note" ? 15 : 10;
        let targetRadius = baseRadius;
        let targetGlow = baseGlow;
        if (hoverNode && n.id === hoverNode.id) {
          targetRadius = baseRadius * 1.8;
          targetGlow = baseGlow * 2.5;
        } else if (hoverNode && hoverNode.neighbors?.includes(n)) {
          targetRadius = baseRadius * 1.3;
          targetGlow = baseGlow * 1.5;
        }
        const breathe = Math.sin(timeRef.current * 2 + n.id.charCodeAt(0) * 0.1) * 0.1;
        n.currentRadius = lerp(n.currentRadius || baseRadius, targetRadius * (1 + breathe * 0.1), lerpFactor);
        n.currentGlow = lerp(n.currentGlow || baseGlow, targetGlow * (1 + breathe * 0.2), lerpFactor);
      });
      animationFrameRef.current = requestAnimationFrame(animateFn);
    };
    animateFn();
    return () => { if (animationFrameRef.current) cancelAnimationFrame(animationFrameRef.current); };
  }, [graphData.nodes, hoverNode]);

  // Node click — open note in sheet
  // Open note editor
  const openNoteEditor = useCallback((note: PersonalNote) => {
    setEditingNote(note);
    setEditTitle(note.title || "");
    setEditContent(note.content?.replace(/<[^>]*>/g, "") || "");
    setEditPatientId(note.patient_id || null);
    setEditDate(note.reference_date || format(new Date(), "yyyy-MM-dd"));
    setEditMode("edit");
    setSheetSnapFraction(SHEET_HALF);
    setSheetOpen(true);
    sheetY.set(0);
    setShowPatientPicker(false);
  }, [sheetY]);

  // Open create note
  const openCreateNote = useCallback((preselectedPatientId?: string) => {
    setEditingNote(null);
    setEditTitle("");
    setEditContent("");
    setEditPatientId(preselectedPatientId || null);
    setEditDate(format(new Date(), "yyyy-MM-dd"));
    setEditMode("create");
    setSheetSnapFraction(SHEET_HALF);
    setSheetOpen(true);
    sheetY.set(0);
    setShowPatientPicker(false);
  }, [sheetY]);

  const handleNodeClick = useCallback((node: GraphNode) => {
    if (!Number.isFinite(node.x) || !Number.isFinite(node.y)) return;
    graphRef.current?.centerAt(node.x!, node.y!, 600);
    graphRef.current?.zoom(3, 800);

    if (node.type === "note" && node.data) {
      openNoteEditor(node.data);
    } else if (node.type === "patient" && node.data) {
      const patientNotes = notes?.filter(n => n.patient_id === node.data.id) || [];
      if (patientNotes.length > 0) {
        openNoteEditor(patientNotes[0]);
      } else {
        openCreateNote(node.data.id);
      }
    }
  }, [notes, openCreateNote, openNoteEditor]);

  // Save note
  const handleSave = async () => {
    setIsSaving(true);
    try {
      if (editMode === "create") {
        await createNote({
          title: editTitle || "Nova Nota",
          content: editContent,
          patient_id: editPatientId,
          reference_date: editDate,
          tags: [],
        });
        toast.success("Nota criada com sucesso!");
      } else if (editMode === "edit" && editingNote) {
        updateNote({
          id: editingNote.id,
          updates: {
            title: editTitle,
            content: editContent,
            patient_id: editPatientId,
            reference_date: editDate,
          },
        });
        toast.success("Nota atualizada!");
      }
      dismissSheet();
    } catch (err) {
      toast.error("Erro ao salvar nota.");
    } finally {
      setIsSaving(false);
    }
  };

  // Delete note
  const handleDelete = () => {
    if (editingNote) {
      deleteNote(editingNote.id);
      dismissSheet();
      toast.success("Nota excluída.");
    }
  };

  // Share note
  const handleShare = async () => {
    const shareText = `${editTitle}\n\n${editContent}`;
    if (navigator.share) {
      try {
        await navigator.share({ title: editTitle || "Nota", text: shareText });
      } catch {
        // User cancelled
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(shareText);
        toast.success("Conteúdo copiado para a área de transferência!");
      } catch {
        toast.error("Não foi possível compartilhar.");
      }
    }
  };

  // Dismiss sheet
  const dismissSheet = () => {
    setSheetOpen(false);
    setSheetSnapFraction(SHEET_HALF);
    setEditMode("view");
    setEditingNote(null);
    setShowPatientPicker(false);
  };

  // Sheet drag
  const handleSheetDragEnd = (_: any, info: PanInfo) => {
    const { velocity, offset } = info;
    if (offset.y > 100 || velocity.y > 500) {
      dismissSheet();
      return;
    }
    if (offset.y < -60 || velocity.y < -400) {
      setSheetSnapFraction(SHEET_FULL);
      motionAnimate(sheetY, 0, { type: "spring", stiffness: 300, damping: 32 });
      return;
    }
    motionAnimate(sheetY, 0, { type: "spring", stiffness: 400, damping: 35 });
  };

  // Bloom animation
  const handleAnimate = useCallback(() => {
    if (!graphRef.current) return;
    const fg = graphRef.current;
    const totalNodes = graphData.nodes.length;
    graphData.nodes.forEach((n) => { n.currentRadius = 0; n.currentGlow = 0; n.currentOpacity = 0; });
    graphData.links.forEach((l) => { l.currentOpacity = 0; l.currentWidth = 0; });
    const shuffledNodes = [...graphData.nodes].sort(() => Math.random() - 0.5);
    shuffledNodes.forEach((n, index) => {
      const delay = 50 + index * 40;
      const baseRadius = n.type === "patient" ? 5 : n.type === "note" ? 3 : 2;
      const baseGlow = n.type === "patient" ? 20 : n.type === "note" ? 15 : 10;
      setTimeout(() => {
        n.currentRadius = baseRadius * 1.5; n.currentGlow = baseGlow * 2; n.currentOpacity = 0.4;
        setTimeout(() => { n.currentRadius = baseRadius; n.currentGlow = baseGlow; n.currentOpacity = 1; }, 200);
      }, delay);
    });
    const linkDelay = totalNodes * 40 + 200;
    graphData.links.forEach((l, index) => {
      setTimeout(() => { l.currentOpacity = 0.5; l.currentWidth = 1; }, linkDelay + index * 20);
    });
    setTimeout(() => { fg.d3ReheatSimulation(); fg.zoomToFit(800, 60); }, linkDelay + 200);
  }, [graphData]);

  // Physics config
  useEffect(() => {
    if (graphRef.current) {
      const fg = graphRef.current;
      const charge = fg.d3Force("charge");
      if (charge) (charge as any).strength(config.repulsion).distanceMax(350);
      const link = fg.d3Force("link");
      if (link) (link as any).distance(config.linkDistance);
      fg.d3Force("x", forceX(0).strength(config.centerForce));
      fg.d3Force("y", forceY(0).strength(config.centerForce));
      fg.d3Force("collide", forceCollide((node: any) => (node.type === "patient" ? 8 : 4) + 2));
      fg.d3ReheatSimulation();
    }
  }, [config, graphData]);

  // Canvas renderers
  const handleNodeCanvasObject = useCallback(
    (node: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      drawNode(node as GraphNode, ctx, globalScale, hoverNode, isDarkMode);
    }, [hoverNode, isDarkMode]
  );
  const handleLinkCanvasObject = useCallback(
    (link: any, ctx: CanvasRenderingContext2D, globalScale: number) => {
      drawLink(link as GraphLink, ctx, globalScale, hoverNode, isDarkMode);
    }, [hoverNode, isDarkMode]
  );

  // Get patient name by ID
  const getPatientName = (patientId: string | null) => {
    if (!patientId || !patients) return null;
    return patients.find(p => p.id === patientId)?.name || null;
  };

  const sheetHeightVh = `${sheetSnapFraction * 100}vh`;

  return (
    <div ref={containerRef} className="fixed inset-0 z-[100] bg-[#F5F5F7] dark:bg-[#020204] overflow-hidden">

      {/* Cinematic Background */}
      <div className="absolute inset-0 z-0 pointer-events-none">
        <div className="absolute inset-0 notes-neuroview-backdrop" />
        <div className="absolute inset-0 notes-retina-texture opacity-[0.18] dark:opacity-[0.26]" />
      </div>

      {/* ── Top Bar ── */}
      <div className="absolute top-0 left-0 right-0 z-50 pointer-events-none">
        <div className="pointer-events-auto flex flex-col gap-2 p-3 pt-[env(safe-area-inset-top,12px)]">

          {/* Back button + Title + Create */}
          <div className="flex items-center justify-between">
            <Button
              size="icon"
              variant="ghost"
              onClick={onBack}
              className="h-10 w-10 rounded-xl bg-background/80 dark:bg-black/60 backdrop-blur-xl border border-border/10 dark:border-white/10 hover:bg-secondary dark:hover:bg-white/10 text-foreground dark:text-white/80 shadow-md"
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <span className="text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground/60 dark:text-white/40">
              NeuroView
            </span>

            <Button
              size="icon"
              variant="ghost"
              onClick={() => openCreateNote()}
              className="h-10 w-10 rounded-xl bg-primary text-primary-foreground hover:bg-primary/90 shadow-lg active:scale-95 transition-all"
            >
              <Plus className="h-5 w-5 stroke-[2.5]" />
            </Button>
          </div>

          {/* Search Bar (collapsible) */}
          <AnimatePresence>
            {showSearch && (
              <motion.div
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="relative"
              >
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground/40" />
                <Input
                  autoFocus
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Buscar notas..."
                  className="pl-9 pr-10 h-9 bg-background/80 dark:bg-black/60 backdrop-blur-xl border-border/10 dark:border-white/10 text-foreground dark:text-white placeholder:text-muted-foreground/40 rounded-xl text-xs shadow-lg"
                />
                <Button
                  size="icon" variant="ghost"
                  onClick={() => { setShowSearch(false); setSearchQuery(""); }}
                  className="absolute right-1 top-1/2 -translate-y-1/2 h-7 w-7 rounded-lg hover:bg-secondary dark:hover:bg-white/10 text-muted-foreground"
                >
                  <X className="h-3 w-3" />
                </Button>
              </motion.div>
            )}
          </AnimatePresence>

          {/* Quick Actions */}
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Button size="icon" variant="ghost" onClick={handleAnimate}
                className="h-9 w-9 rounded-xl bg-background/80 dark:bg-black/60 backdrop-blur-xl border border-border/10 dark:border-white/10 hover:bg-secondary dark:hover:bg-white/10 text-muted-foreground dark:text-white/70 shadow-md"
              >
                <Play className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setShowSearch(!showSearch)}
                className={cn("h-9 w-9 rounded-xl backdrop-blur-xl border border-border/10 dark:border-white/10 shadow-md",
                  showSearch ? "bg-secondary dark:bg-white/10" : "bg-background/80 dark:bg-black/60",
                  "text-muted-foreground dark:text-white/70"
                )}
              >
                <Search className="h-3.5 w-3.5" />
              </Button>
            </div>
            <div className="flex items-center gap-1.5">
              <Button size="icon" variant="ghost" onClick={() => graphRef.current?.zoom((graphRef.current.zoom() || 1) / 1.4, 400)}
                className="h-9 w-9 rounded-xl bg-background/80 dark:bg-black/60 backdrop-blur-xl border border-border/10 dark:border-white/10 text-muted-foreground dark:text-white/70 shadow-md"
              >
                <ZoomOut className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => graphRef.current?.zoom((graphRef.current.zoom() || 1) * 1.4, 400)}
                className="h-9 w-9 rounded-xl bg-background/80 dark:bg-black/60 backdrop-blur-xl border border-border/10 dark:border-white/10 text-muted-foreground dark:text-white/70 shadow-md"
              >
                <ZoomIn className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => graphRef.current?.zoomToFit(400)}
                className="h-9 w-9 rounded-xl bg-background/80 dark:bg-black/60 backdrop-blur-xl border border-border/10 dark:border-white/10 text-muted-foreground dark:text-white/70 shadow-md"
              >
                <Target className="h-3.5 w-3.5" />
              </Button>
              <Button size="icon" variant="ghost" onClick={() => setShowFilters(!showFilters)}
                className={cn("h-9 w-9 rounded-xl backdrop-blur-xl border border-border/10 dark:border-white/10 shadow-md",
                  showFilters ? "bg-secondary dark:bg-white/10" : "bg-background/80 dark:bg-black/60",
                  "text-muted-foreground dark:text-white/70"
                )}
              >
                <Settings2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Settings / Filters Panel */}
          <AnimatePresence>
            {showFilters && (
              <motion.div
                initial={{ opacity: 0, y: -8, scale: 0.96 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                exit={{ opacity: 0, y: -8, scale: 0.96 }}
                transition={{ type: "spring", damping: 26, stiffness: 400 }}
                className="p-4 bg-background/90 dark:bg-black/70 backdrop-blur-2xl border border-border/10 dark:border-white/10 rounded-2xl shadow-2xl max-h-[60vh] overflow-y-auto"
              >
                <div className="flex items-center justify-between mb-4 sticky top-0 bg-transparent z-10">
                  <span className="text-[10px] font-bold text-muted-foreground/60 dark:text-white/50 uppercase tracking-widest flex items-center gap-1.5">
                    <Settings2 className="h-3 w-3" /> Configurações
                  </span>
                  <Button size="icon" variant="ghost" onClick={() => setShowFilters(false)}
                    className="h-6 w-6 rounded-md hover:bg-secondary dark:hover:bg-white/10 text-muted-foreground dark:text-white/50"
                  >
                    <ChevronDown className="h-3 w-3" />
                  </Button>
                </div>

                <div className="space-y-5">
                  {/* Physics Controls */}
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] text-muted-foreground dark:text-white/50">
                        <span>Repulsão</span>
                        <span className="tabular-nums">{Math.abs(config.repulsion)}</span>
                      </div>
                      <Slider
                        value={[Math.abs(config.repulsion)]}
                        min={50}
                        max={400}
                        step={10}
                        onValueChange={([v]) => setConfig({ ...config, repulsion: -v })}
                        className="[&>span:first-child]:bg-secondary dark:[&>span:first-child]:bg-white/10 [&_[role=slider]]:bg-primary dark:[&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] text-muted-foreground dark:text-white/50">
                        <span>Distncia Links</span>
                        <span className="tabular-nums">{config.linkDistance}</span>
                      </div>
                      <Slider
                        value={[config.linkDistance]}
                        min={20}
                        max={150}
                        step={5}
                        onValueChange={([v]) => setConfig({ ...config, linkDistance: v })}
                        className="[&>span:first-child]:bg-secondary dark:[&>span:first-child]:bg-white/10 [&_[role=slider]]:bg-primary dark:[&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
                      />
                    </div>

                    <div className="space-y-2">
                      <div className="flex justify-between text-[10px] text-muted-foreground dark:text-white/50">
                        <span>Gravidade Central</span>
                        <span className="tabular-nums">{config.centerForce.toFixed(2)}</span>
                      </div>
                      <Slider
                        value={[config.centerForce * 100]}
                        min={1}
                        max={30}
                        step={1}
                        onValueChange={([v]) => setConfig({ ...config, centerForce: v / 100 })}
                        className="[&>span:first-child]:bg-secondary dark:[&>span:first-child]:bg-white/10 [&_[role=slider]]:bg-primary dark:[&_[role=slider]]:bg-white [&_[role=slider]]:border-0 [&_[role=slider]]:h-3 [&_[role=slider]]:w-3"
                      />
                    </div>
                  </div>

                  <div className="h-px bg-border/10 dark:bg-white/10" />

                  {/* Filters */}
                  <div className="space-y-3">
                    {[
                      { label: "Pacientes", key: "showPatients" as const },
                      { label: "Notas", key: "showNotes" as const },
                      { label: "Tags", key: "showTags" as const },
                    ].map(({ label, key }) => (
                      <div key={key} className="flex items-center justify-between">
                        <Label className="text-xs text-foreground/70 dark:text-white/70">{label}</Label>
                        <Switch
                          checked={config[key]}
                          onCheckedChange={(v) => setConfig({ ...config, [key]: v })}
                          className="scale-75 data-[state=checked]:bg-primary dark:data-[state=checked]:bg-white/80"
                        />
                      </div>
                    ))}
                  </div>
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="absolute inset-0 z-50 flex items-center justify-center bg-background/80 dark:bg-black/80 backdrop-blur-sm">
          <div className="flex flex-col items-center gap-3">
            <Loader2 className="w-7 h-7 animate-spin text-primary dark:text-white" />
            <p className="text-[10px] font-bold uppercase tracking-widest text-primary/60 dark:text-white/60 animate-pulse">
              Sincronizando Sinapses...
            </p>
          </div>
        </div>
      )}

      {/* Force Graph */}
      {containerSize.width > 0 && containerSize.height > 0 && (
        <ForceGraph2D
          ref={graphRef}
          graphData={graphData}
          width={containerSize.width}
          height={containerSize.height}
          nodeLabel={() => ""}
          nodeColor={() => "transparent"}
          nodeCanvasObject={handleNodeCanvasObject}
          nodeRelSize={4}
          linkColor={() => "transparent"}
          linkCanvasObject={handleLinkCanvasObject}
          linkDirectionalParticles={hoverNode ? 2 : 0}
          linkDirectionalParticleWidth={1}
          linkDirectionalParticleSpeed={0.003}
          linkDirectionalParticleColor={() => "rgba(255, 255, 255, 0.48)"}
          backgroundColor="transparent"
          onNodeClick={(node) => handleNodeClick(node as GraphNode)}
          onNodeHover={(node) => setHoverNode((node as GraphNode) || null)}
          d3AlphaDecay={0.02}
          d3VelocityDecay={0.4}
          cooldownTicks={120}
          warmupTicks={40}
          onEngineStop={() => graphRef.current?.zoomToFit(600, 60)}
          enableZoomInteraction={true}
          enablePanInteraction={true}
          enablePointerInteraction={true}
        />
      )}

      {/* ── Note Editor Bottom Sheet ── */}
      <AnimatePresence>
        {sheetOpen && (
          <>
            {/* Backdrop */}
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.2 }}
              onClick={dismissSheet}
              className="fixed inset-0 bg-black/60 z-[110]"
            />

            {/* Sheet */}
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: "0%" }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", stiffness: 280, damping: 30, mass: 0.8 }}
              drag="y"
              dragConstraints={{ top: 0, bottom: 0 }}
              dragElastic={{ top: 0.04, bottom: 0.25 }}
              dragMomentum={true}
              dragTransition={{ bounceStiffness: 300, bounceDamping: 30 }}
              onDragEnd={handleSheetDragEnd}
              style={{ y: sheetY, height: sheetHeightVh }}
              className="fixed bottom-0 left-0 right-0 z-[120] bg-background rounded-t-[28px] shadow-[0_-8px_40px_rgba(0,0,0,0.3)] flex flex-col will-change-transform overflow-hidden transition-[height] duration-300 [transition-timing-function:cubic-bezier(0.32,0.72,0,1)]"
            >
              {/* Handle */}
              <div className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none select-none">
                <div className="w-9 h-[5px] rounded-full bg-muted-foreground/20" />
              </div>

              {/* Header */}
              <div className="px-5 pt-1 pb-3 flex items-center justify-between border-b border-border/10 shrink-0">
                <div className="flex-1 min-w-0">
                  <p className="text-[10px] font-black text-muted-foreground uppercase tracking-[0.15em]">
                    {editMode === "create" ? "Nova Nota" : "Editar Nota"}
                  </p>
                </div>
                <div className="flex items-center gap-1.5">
                  {/* Share */}
                  <Button size="icon" variant="ghost" onClick={handleShare}
                    className="h-8 w-8 rounded-lg bg-secondary/30 border border-border/10 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-90"
                  >
                    <Share2 className="w-3.5 h-3.5" />
                  </Button>
                  {/* Delete (only in edit mode) */}
                  {editMode === "edit" && editingNote && (
                    <Button size="icon" variant="ghost" onClick={handleDelete}
                      className="h-8 w-8 rounded-lg bg-red-500/10 border border-red-500/10 text-red-500 hover:bg-red-500/20 transition-all active:scale-90"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </Button>
                  )}
                  {/* Save */}
                  <Button size="icon" onClick={handleSave} disabled={isSaving}
                    className="h-8 w-8 rounded-lg bg-primary text-primary-foreground hover:bg-primary/90 shadow-md active:scale-90 transition-all"
                  >
                    {isSaving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                  </Button>
                  {/* Close */}
                  <Button size="icon" variant="ghost" onClick={dismissSheet}
                    className="h-8 w-8 rounded-lg bg-secondary/30 border border-border/10 text-muted-foreground hover:text-foreground hover:bg-secondary transition-all active:scale-90"
                  >
                    <X className="w-3.5 h-3.5" />
                  </Button>
                </div>
              </div>

              {/* Scrollable Content */}
              <div className="flex-1 overflow-y-auto overscroll-contain px-5 pt-4 pb-10 space-y-4">

                {/* Title */}
                <div>
                  <Input
                    value={editTitle}
                    onChange={(e) => setEditTitle(e.target.value)}
                    placeholder="Título da nota..."
                    className="h-11 bg-secondary/30 border-border/10 rounded-xl text-base font-bold text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-0 focus-visible:border-primary/20"
                  />
                </div>

                {/* Content */}
                <div>
                  <Textarea
                    value={editContent}
                    onChange={(e) => setEditContent(e.target.value)}
                    placeholder="Escreva o conteúdo da nota..."
                    rows={6}
                    className="bg-secondary/30 border-border/10 rounded-xl text-sm text-foreground placeholder:text-muted-foreground/40 focus-visible:ring-0 focus-visible:border-primary/20 resize-none leading-relaxed"
                  />
                </div>

                {/* Patient Selector */}
                <div>
                  <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest mb-2">
                    Paciente Vinculado
                  </p>
                  <button
                    onClick={() => setShowPatientPicker(!showPatientPicker)}
                    className="w-full flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/10 hover:bg-secondary/50 transition-colors active:scale-[0.98]"
                  >
                    <UserCircle2 className="w-5 h-5 text-muted-foreground/50 shrink-0" />
                    <span className={cn("text-sm flex-1 text-left truncate",
                      editPatientId ? "text-foreground font-medium" : "text-muted-foreground/50"
                    )}>
                      {editPatientId ? (getPatientName(editPatientId) || "Paciente selecionado") : "Nenhum paciente selecionado"}
                    </span>
                    {editPatientId && (
                      <button
                        onClick={(e) => { e.stopPropagation(); setEditPatientId(null); }}
                        className="w-6 h-6 rounded-md bg-secondary/50 flex items-center justify-center text-muted-foreground hover:text-foreground"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    )}
                    <ChevronDown className={cn("w-4 h-4 text-muted-foreground/40 transition-transform", showPatientPicker && "rotate-180")} />
                  </button>

                  {/* Patient List */}
                  <AnimatePresence>
                    {showPatientPicker && (
                      <motion.div
                        initial={{ opacity: 0, height: 0 }}
                        animate={{ opacity: 1, height: "auto" }}
                        exit={{ opacity: 0, height: 0 }}
                        transition={{ duration: 0.2 }}
                        className="overflow-hidden"
                      >
                        <div className="mt-2 max-h-40 overflow-y-auto rounded-xl bg-secondary/20 border border-border/10 divide-y divide-border/5">
                          {patients && patients.length > 0 ? (
                            patients.map((p) => (
                              <button
                                key={p.id}
                                onClick={() => { setEditPatientId(p.id); setShowPatientPicker(false); }}
                                className={cn(
                                  "w-full flex items-center gap-3 px-3 py-2.5 text-left hover:bg-secondary/40 transition-colors active:scale-[0.98]",
                                  editPatientId === p.id && "bg-primary/10"
                                )}
                              >
                                <div className="w-7 h-7 rounded-full bg-secondary/50 border border-border/20 flex items-center justify-center text-[9px] font-bold text-muted-foreground shrink-0">
                                  {p.name.substring(0, 2).toUpperCase()}
                                </div>
                                <span className="text-sm text-foreground truncate flex-1">{p.name}</span>
                                {editPatientId === p.id && (
                                  <Check className="w-4 h-4 text-primary shrink-0" />
                                )}
                              </button>
                            ))
                          ) : (
                            <div className="px-3 py-4 text-center text-xs text-muted-foreground/50">
                              Nenhum paciente cadastrado.
                            </div>
                          )}
                        </div>
                      </motion.div>
                    )}
                  </AnimatePresence>
                </div>

                {/* Date Selector */}
                <div>
                  <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest mb-2">
                    Data de Referência
                  </p>
                  <div className="flex items-center gap-3 p-3 rounded-xl bg-secondary/30 border border-border/10">
                    <CalendarDays className="w-5 h-5 text-muted-foreground/50 shrink-0" />
                    <input
                      type="date"
                      value={editDate}
                      onChange={(e) => setEditDate(e.target.value)}
                      className="flex-1 bg-transparent text-sm text-foreground outline-none appearance-none"
                    />
                  </div>
                </div>

                {/* Tags display (read only for existing notes) */}
                {editingNote?.tags && editingNote.tags.length > 0 && (
                  <div>
                    <p className="text-[10px] font-black text-muted-foreground/50 uppercase tracking-widest mb-2">
                      Tags
                    </p>
                    <div className="flex flex-wrap gap-1.5">
                      {editingNote.tags.map((tag) => (
                        <span key={tag} className="px-2.5 py-1 rounded-lg bg-secondary/50 border border-border/10 text-[10px] font-bold text-muted-foreground uppercase tracking-wider">
                          #{tag}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </div>

              {/* Expand hint */}
              {sheetSnapFraction < SHEET_FULL && (
                <motion.div
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  className="absolute bottom-0 left-0 right-0 h-12 bg-gradient-to-t from-background via-background/80 to-transparent pointer-events-none flex items-end justify-center pb-2.5"
                >
                  <span className="text-[9px] font-bold text-muted-foreground/30 uppercase tracking-widest">
                    ↑ Arraste para expandir
                  </span>
                </motion.div>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
};
