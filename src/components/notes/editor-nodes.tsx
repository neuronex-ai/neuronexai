import { Node, mergeAttributes } from '@tiptap/core';
import { ReactNodeViewRenderer, NodeViewContent, NodeViewWrapper } from '@tiptap/react';
import { useId, useState } from 'react';
import { cn } from '@/lib/utils';
import { extractMermaidCode, isLikelyMermaid } from '@/lib/mermaid-content';
import {
  XAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area
} from 'recharts';
import {
  Trash2, Link2, Globe, Share2,
  Zap, Brain, Code, Activity,
  FileIcon, Download, Video,
  MoveDiagonal2, ExternalLink, FileText, Lightbulb, ChevronRight, Sigma
} from 'lucide-react';
import { useTheme } from '@/hooks/use-theme';
import { MermaidDiagram } from './MermaidDiagram';

// --- Extension: Clinical Chart ---
export const ClinicalChartNode = Node.create({
  name: 'clinicalChart',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      type: { default: 'area' },
      title: { default: 'Evolução Clínica' },
      data: {
        default: [
          { name: 'S1', value: 40, mood: 30 },
          { name: 'S2', value: 30, mood: 45 },
          { name: 'S3', value: 65, mood: 50 },
          { name: 'S4', value: 45, mood: 70 },
          { name: 'S5', value: 90, mood: 85 },
        ]
      }
    };
  },

  parseHTML() {
    return [{ tag: 'clinical-chart' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['clinical-chart', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(ClinicalChartComponent);
  },
});

const ClinicalChartComponent = ({ node, deleteNode }: any) => {
  const { data, title } = node.attrs;
  const { theme } = useTheme();

  return (
    <NodeViewWrapper className="my-12 group/chart relative">
      <div className="bg-zinc-50 dark:bg-[#0A0A0B]/60 backdrop-blur-3xl border border-zinc-200 dark:border-white/10 rounded-[40px] p-10 shadow-xl dark:shadow-[0_40px_100px_-20px_rgba(0,0,0,0.8)] relative overflow-hidden transition-all duration-700 hover:scale-[1.01] hover:border-primary/40 hover:shadow-primary/10">
        {/* Decorative Background Elements */}
        <div className="absolute -top-24 -right-24 w-64 h-64 bg-primary/10 rounded-full blur-[100px] pointer-events-none" />
        <div className="absolute -bottom-24 -left-24 w-64 h-64 bg-emerald-500/10 rounded-full blur-[100px] pointer-events-none" />

        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-12 relative z-10">
          <div className="space-y-2">
            <div className="flex items-center gap-3">
              <div className="p-2.5 rounded-2xl bg-primary/10 border border-primary/20">
                <Activity className="h-5 w-5 text-primary animate-pulse" />
              </div>
              <h4 className="text-2xl font-black tracking-tighter text-zinc-900 dark:text-white">
                {title}
              </h4>
            </div>
            <p className="text-[10px] text-zinc-400 dark:text-white/40 uppercase font-black tracking-[0.3em] ml-1">Análise de Fluxo Sentimental AI-Processed</p>
          </div>

          <div className="flex gap-3">
            <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-zinc-100 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/5 backdrop-blur-md">
              <div className="h-2 w-2 rounded-full bg-primary shadow-[0_0_10px_rgba(139,92,246,0.6)]" />
              <span className="text-[10px] font-black text-zinc-500 dark:text-white/60 uppercase tracking-widest">Ansiedade</span>
            </div>
            <div className="flex items-center gap-3 px-4 py-2 rounded-2xl bg-zinc-100 dark:bg-white/[0.03] border border-zinc-200 dark:border-white/5 backdrop-blur-md">
              <div className="h-2 w-2 rounded-full bg-emerald-500 shadow-[0_0_10px_rgba(16,185,129,0.6)]" />
              <span className="text-[10px] font-black text-zinc-500 dark:text-white/60 uppercase tracking-widest">Estabilidade</span>
            </div>
          </div>
        </div>

        <div className="h-[300px] w-full relative z-10 transition-all duration-700">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
              <defs>
                <linearGradient id="premiumPrimary" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="premiumEmerald" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#10b981" stopOpacity={0.4} />
                  <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="8 8" vertical={false} stroke={theme === 'dark' ? "rgba(255,255,255,0.03)" : "rgba(0,0,0,0.05)"} />
              <XAxis
                dataKey="name"
                axisLine={false}
                tickLine={false}
                tick={{ fill: theme === 'dark' ? 'rgba(255,255,255,0.2)' : 'rgba(0,0,0,0.3)', fontSize: 10, fontWeight: '900', letterSpacing: '0.1em' }}
                dy={15}
              />
              <Tooltip
                cursor={{ stroke: theme === 'dark' ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.05)', strokeWidth: 1 }}
                contentStyle={{
                  backgroundColor: theme === 'dark' ? 'rgba(10,10,11,0.95)' : 'rgba(255,255,255,0.95)',
                  backdropFilter: 'blur(16px)',
                  border: theme === 'dark' ? '1px solid rgba(255,255,255,0.1)' : '1px solid rgba(0,0,0,0.05)',
                  borderRadius: '24px',
                  padding: '16px',
                  boxShadow: '0 20px 50px rgba(0,0,0,0.2)'
                }}
                itemStyle={{ fontSize: '11px', fontWeight: '900', textTransform: 'uppercase', marginBottom: '4px', color: theme === 'dark' ? 'white' : 'black' }}
                labelStyle={{ color: theme === 'dark' ? 'rgba(255,255,255,0.3)' : 'rgba(0,0,0,0.4)', fontWeight: '900', fontSize: '10px', textTransform: 'uppercase', letterSpacing: '0.1em', marginBottom: '8px' }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#8b5cf6"
                strokeWidth={4}
                fillOpacity={1}
                fill="url(#premiumPrimary)"
                animationDuration={2000}
                animationEasing="ease-in-out"
              />
              <Area
                type="monotone"
                dataKey="mood"
                stroke="#10b981"
                strokeWidth={4}
                fillOpacity={1}
                fill="url(#premiumEmerald)"
                animationDuration={2500}
                animationEasing="ease-in-out"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        {/* Delete Action (Top Right) */}
        <button
          onClick={deleteNode}
          className="absolute top-8 right-8 p-3 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 opacity-0 group-hover/chart:opacity-100 transition-all duration-300 hover:bg-rose-500 hover:text-white"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </div>
    </NodeViewWrapper>
  );
};

// --- Extension: Embedded Document ---
export const EmbeddedDocNode = Node.create({
  name: 'embeddedDoc',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      name: { default: 'Documento Clínico' },
      size: { default: '2.4 MB' },
      type: { default: 'pdf' },
      url: { default: '#' }
    };
  },

  parseHTML() {
    return [{ tag: 'embedded-doc' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['embedded-doc', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(EmbeddedDocComponent);
  },
});

const EmbeddedDocComponent = ({ node, deleteNode }: any) => {
  const { name, size, type } = node.attrs;

  return (
    <NodeViewWrapper className="my-8 group/doc">
      <div className="relative overflow-hidden rounded-[28px] bg-zinc-50 dark:bg-[#0A0A0B]/60 backdrop-blur-3xl border border-zinc-200 dark:border-white/10 p-6 flex items-center justify-between transition-all duration-500 hover:bg-zinc-100 dark:hover:bg-[#0A0A0B]/80 hover:border-primary/40 hover:shadow-xl dark:hover:shadow-[0_25px_50px_-12px_rgba(0,0,0,0.5)]">
        <div className="flex items-center gap-6">
          <div className="relative">
            <div className="h-16 w-16 rounded-2xl bg-gradient-to-br from-primary/20 to-transparent border border-primary/20 flex items-center justify-center shadow-inner group-hover/doc:scale-110 transition-transform duration-700">
              <FileIcon className="h-7 w-7 text-primary" strokeWidth={1.5} />
            </div>
            {/* Pulsing indicator for "document" vibe */}
            <div className="absolute -top-1 -right-1 h-3 w-3 rounded-full bg-primary/40 blur-[2px] animate-pulse" />
          </div>

          <div className="space-y-1.5">
            <h5 className="text-base font-black text-zinc-900 dark:text-white tracking-tight group-hover/doc:text-primary transition-colors duration-300">
              {name}
            </h5>
            <div className="flex items-center gap-4">
              <div className="flex items-center gap-1.5">
                <div className="h-1 w-1 rounded-full bg-primary" />
                <span className="text-[10px] font-black text-zinc-400 dark:text-white/30 uppercase tracking-[0.2em]">{type}</span>
              </div>
              <div className="flex items-center gap-1.5">
                <div className="h-1 w-1 rounded-full bg-zinc-300 dark:bg-white/20" />
                <span className="text-[10px] font-black text-zinc-400 dark:text-white/30 uppercase tracking-[0.2em]">{size}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="flex items-center gap-2">
          <button className="p-3.5 rounded-2xl bg-zinc-100 dark:bg-white/5 border border-zinc-200 dark:border-white/10 hover:bg-primary hover:border-primary text-zinc-400 dark:text-white/40 hover:text-white transition-all duration-500 group-hover/doc:translate-x-0 translate-x-12 opacity-0 group-hover/doc:opacity-100 shadow-xl">
            <Download className="h-4 w-4" />
          </button>
          <button
            onClick={deleteNode}
            className="p-3.5 rounded-2xl bg-rose-500/10 border border-rose-500/20 text-rose-500 opacity-0 group-hover/doc:opacity-100 transition-all duration-500 hover:bg-rose-500 hover:text-white shadow-xl"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>
      </div>
    </NodeViewWrapper>
  );
};

// --- Extension: Video Embed ---
export const VideoEmbedNode = Node.create({
  name: 'videoEmbed',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      src: { default: '' },
      width: { default: '100%' },
      height: { default: '450px' }
    };
  },

  parseHTML() {
    return [{ tag: 'video-embed' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['video-embed', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(VideoEmbedComponent);
  },
});

const VideoEmbedComponent = ({ node, updateAttributes, deleteNode }: any) => {
  const { src, width, height } = node.attrs;
  const [isResizing, setIsResizing] = useState(false);

  // Robust URL transformation
  const getEmbedUrl = (url: string) => {
    try {
      if (!url) return '';
      if (url.includes('<iframe')) {
        const match = url.match(/src="([^"]+)"/);
        return match ? match[1] : '';
      }
      const validUrl = url.startsWith('http') ? url : `https://${url}`;
      const urlObj = new URL(validUrl);
      if (urlObj.hostname.includes('youtube.com') || urlObj.hostname.includes('youtu.be')) {
        let videoId = '';
        if (urlObj.hostname.includes('youtu.be')) {
          videoId = urlObj.pathname.slice(1);
        } else if (urlObj.searchParams.has('v')) {
          videoId = urlObj.searchParams.get('v') || '';
        }
        if (videoId) return `https://www.youtube.com/embed/${videoId}`;
      }
      if (urlObj.hostname.includes('vimeo.com')) {
        const videoId = urlObj.pathname.replace('/', '');
        if (videoId && /^\d+$/.test(videoId)) return `https://player.vimeo.com/video/${videoId}`;
      }
    } catch (e) {
      console.warn("Invalid video URL:", url);
    }
    return url;
  };

  const startResizing = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);

    const rect = (e.currentTarget.closest('.relative') as HTMLElement).getBoundingClientRect();
    const startX = e.clientX;
    const startY = e.clientY;
    const startWidth = rect.width;
    const startHeight = rect.height;

    const onMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX;
      const deltaY = moveEvent.clientY - startY;

      const newWidth = Math.max(320, startWidth + deltaX);
      const newHeight = Math.max(200, Math.min(800, startHeight + deltaY));

      updateAttributes({
        width: `${newWidth}px`,
        height: `${newHeight}px`
      });
    };

    const onMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', onMouseMove);
      document.removeEventListener('mouseup', onMouseUp);
    };

    document.addEventListener('mousemove', onMouseMove);
    document.addEventListener('mouseup', onMouseUp);
  };

  return (
    <NodeViewWrapper className="my-10 group/video flex justify-center">
      <div
        className={cn(
          "relative rounded-[40px] overflow-hidden border border-white/10 bg-black shadow-[0_40px_80px_-20px_rgba(0,0,0,0.8)] transition-all duration-300",
          isResizing ? "ring-2 ring-primary border-primary/50" : "hover:border-primary/50"
        )}
        style={{ width: width, height: height, maxWidth: '100%' }}
      >
        <iframe
          src={getEmbedUrl(src)}
          className={cn("w-full h-full border-0", (isResizing || !src) && "pointer-events-none")}
          allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
          allowFullScreen
        />

        {!src && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-zinc-100/50 dark:bg-white/5 backdrop-blur-3xl space-y-4">
            <div className="p-4 rounded-3xl bg-primary/10 border border-primary/20">
              <Video className="h-8 w-8 text-primary" />
            </div>
            <p className="text-xs font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-white/40">URL de Vídeo Pendente</p>
          </div>
        )}

        {/* Action Overlay */}
        <div className="absolute top-8 right-8 flex gap-3 opacity-0 group-hover/video:opacity-100 transition-all duration-300">
          <button
            onClick={deleteNode}
            className="p-3.5 rounded-2xl bg-rose-500/20 backdrop-blur-xl border border-rose-500/30 text-rose-500 hover:bg-rose-500 hover:text-white transition-all shadow-xl"
          >
            <Trash2 className="h-5 w-5" />
          </button>
        </div>

        {/* Resize Handle Overlay */}
        <div className="absolute bottom-8 right-8 flex items-center gap-3 opacity-0 group-hover/video:opacity-100 transition-all duration-300">
          <button
            onClick={() => updateAttributes({ width: '100%', height: '450px' })}
            className="px-5 py-2.5 rounded-2xl bg-black/60 backdrop-blur-xl border border-white/10 text-[11px] font-black text-white uppercase tracking-widest hover:bg-white hover:text-black transition-all shadow-xl"
          >
            Resetar
          </button>
          <div
            onMouseDown={startResizing}
            className="p-3 rounded-2xl bg-primary backdrop-blur-xl text-white cursor-nwse-resize hover:scale-110 active:scale-95 transition-all shadow-[0_10px_20px_rgba(var(--primary),0.3)]"
          >
            <MoveDiagonal2 className="h-5 w-5" />
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
};

// --- Extension: Link Card ---
export const LinkCardNode = Node.create({
  name: 'linkCard',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      url: { default: '' },
      title: { default: '' },
      description: { default: '' },
      image: { default: '' },
      siteName: { default: '' }
    };
  },

  parseHTML() {
    return [{ tag: 'link-card' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['link-card', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(LinkCardComponent);
  },
});

// --- Extension: Linked Note / Sub-page Card ---
export const NoteLinkNode = Node.create({
  name: 'noteLink',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      noteId: { default: '' },
      notionPageId: { default: '' },
      title: { default: 'Nota vinculada' },
      description: { default: 'Abra a nota vinculada para continuar a leitura.' },
      href: { default: '' },
      source: { default: 'NeuroDrive' },
    };
  },

  parseHTML() {
    return [{ tag: 'note-link' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['note-link', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NoteLinkComponent);
  },
});

const NoteLinkComponent = ({ node, deleteNode }: any) => {
  const { noteId, title, description, href, source } = node.attrs;

  const handleOpen = (event: React.MouseEvent) => {
    event.preventDefault();
    if (noteId) {
      window.history.pushState({}, '', `/notes?noteId=${noteId}`);
      window.dispatchEvent(new PopStateEvent('popstate'));
      return;
    }
    if (href) window.open(href, '_blank', 'noopener,noreferrer');
  };

  return (
    <NodeViewWrapper className="my-7 group/note-link">
      <button
        type="button"
        onClick={handleOpen}
        className="flex w-full items-center gap-4 rounded-2xl border border-border/65 bg-card/82 p-4 text-left shadow-[0_18px_55px_-42px_hsl(var(--foreground)/0.8)] transition-all duration-200 hover:border-primary/35 hover:bg-primary/[0.035] dark:bg-white/[0.035]"
      >
        <div className="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-primary">
          <FileText className="h-5 w-5" />
        </div>
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="truncate text-sm font-black tracking-tight text-foreground">{title || 'Nota vinculada'}</span>
            <span className="shrink-0 rounded-full border border-border/60 px-2 py-0.5 text-[8px] font-black uppercase tracking-[0.16em] text-muted-foreground">
              {source || 'NeuroDrive'}
            </span>
          </div>
          <p className="mt-1 line-clamp-2 text-xs leading-relaxed text-muted-foreground">{description}</p>
        </div>
        <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground transition-transform group-hover/note-link:translate-x-0.5" />
        <span
          role="button"
          tabIndex={0}
          onClick={(event) => {
            event.preventDefault();
            event.stopPropagation();
            deleteNode();
          }}
          onKeyDown={(event) => {
            if (event.key === 'Enter' || event.key === ' ') {
              event.preventDefault();
              event.stopPropagation();
              deleteNode();
            }
          }}
          className="ml-1 hidden rounded-lg p-2 text-muted-foreground hover:bg-destructive/10 hover:text-destructive group-hover/note-link:inline-flex"
          aria-label="Remover link de nota"
        >
          <Trash2 className="h-4 w-4" />
        </span>
      </button>
    </NodeViewWrapper>
  );
};

// --- Extension: Notion-style Callout ---
export const NotionCalloutNode = Node.create({
  name: 'notionCallout',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      icon: { default: '!' },
      color: { default: 'default' },
      label: { default: 'Observacao' },
    };
  },

  parseHTML() {
    return [{ tag: 'notion-callout' }, { tag: 'div[data-type="notion-callout"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['notion-callout', mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NotionCalloutComponent);
  },
});

const NotionCalloutComponent = ({ node, deleteNode }: any) => {
  const { icon, color, label } = node.attrs;

  return (
    <NodeViewWrapper
      data-notion-color={color}
      className="my-6 group/callout rounded-2xl border border-primary/18 bg-primary/[0.055] p-4 shadow-[0_18px_55px_-48px_hsl(var(--foreground)/0.8)]"
    >
      <div className="flex items-start gap-3">
        <div className="mt-1 flex h-8 w-8 shrink-0 items-center justify-center rounded-xl border border-primary/20 bg-primary/10 text-sm font-black text-primary">
          {icon || <Lightbulb className="h-4 w-4" />}
        </div>
        <div className="min-w-0 flex-1">
          <div className="mb-2 flex items-center justify-between gap-3">
            <span className="text-[9px] font-black uppercase tracking-[0.18em] text-primary/80">{label || 'Observacao'}</span>
            <button
              type="button"
              onClick={deleteNode}
              className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/callout:opacity-100"
              aria-label="Remover callout"
            >
              <Trash2 className="h-3.5 w-3.5" />
            </button>
          </div>
          <NodeViewContent className="notion-callout-content space-y-2 text-foreground" />
        </div>
      </div>
    </NodeViewWrapper>
  );
};

// --- Extension: Notion-style Toggle ---
export const NotionToggleNode = Node.create({
  name: 'notionToggle',
  group: 'block',
  content: 'block+',
  defining: true,

  addAttributes() {
    return {
      title: { default: 'Detalhes' },
      open: {
        default: true,
        parseHTML: (element) => element.getAttribute('open') !== 'false',
      },
    };
  },

  parseHTML() {
    return [{ tag: 'notion-toggle' }, { tag: 'details[data-type="notion-toggle"]' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['notion-toggle', mergeAttributes(HTMLAttributes), 0];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NotionToggleComponent);
  },
});

const NotionToggleComponent = ({ node, updateAttributes, deleteNode }: any) => {
  const { title, open } = node.attrs;
  const [isOpen, setIsOpen] = useState(Boolean(open));

  const toggle = () => {
    const next = !isOpen;
    setIsOpen(next);
    updateAttributes({ open: next });
  };

  return (
    <NodeViewWrapper className="my-5 group/toggle rounded-2xl border border-border/60 bg-card/70 dark:bg-white/[0.025]">
      <div className="flex items-center gap-2 border-b border-border/40 px-4 py-3">
        <button
          type="button"
          onClick={toggle}
          className="flex min-w-0 flex-1 items-center gap-2 text-left"
        >
          <ChevronRight className={cn("h-4 w-4 shrink-0 text-muted-foreground transition-transform", isOpen && "rotate-90")} />
          <span className="truncate text-sm font-bold text-foreground">{title || 'Detalhes'}</span>
        </button>
        <button
          type="button"
          onClick={deleteNode}
          className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/toggle:opacity-100"
          aria-label="Remover toggle"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <NodeViewContent
        className={cn("space-y-2 px-5 py-4 text-foreground", !isOpen && "hidden")}
      />
    </NodeViewWrapper>
  );
};

// --- Extension: Equation Card ---
export const NotionEquationNode = Node.create({
  name: 'notionEquation',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      expression: { default: '' },
    };
  },

  parseHTML() {
    return [{ tag: 'notion-equation' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['notion-equation', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(NotionEquationComponent);
  },
});

const NotionEquationComponent = ({ node, updateAttributes, deleteNode }: any) => {
  const { expression } = node.attrs;

  return (
    <NodeViewWrapper className="my-6 group/equation rounded-2xl border border-border/60 bg-muted/35 p-4">
      <div className="mb-3 flex items-center justify-between">
        <div className="flex items-center gap-2 text-[10px] font-black uppercase tracking-[0.18em] text-muted-foreground">
          <Sigma className="h-4 w-4 text-primary" />
          Equacao
        </div>
        <button
          type="button"
          onClick={deleteNode}
          className="rounded-lg p-1.5 text-muted-foreground opacity-0 transition-opacity hover:bg-destructive/10 hover:text-destructive group-hover/equation:opacity-100"
          aria-label="Remover equacao"
        >
          <Trash2 className="h-3.5 w-3.5" />
        </button>
      </div>
      <input
        value={expression}
        onChange={(event) => updateAttributes({ expression: event.target.value })}
        className="w-full rounded-xl border border-border/50 bg-background/80 px-3 py-2 font-mono text-sm text-foreground outline-none selection:bg-primary/25 selection:text-foreground focus:border-primary/40"
        placeholder="x^2 + y^2 = z^2"
      />
    </NodeViewWrapper>
  );
};

const LinkCardComponent = ({ node, deleteNode }: any) => {
  const { url, title, description, image, siteName } = node.attrs;

  return (
    <NodeViewWrapper className="my-8 group/link">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="block relative overflow-hidden rounded-[32px] bg-zinc-50 dark:bg-[#0A0A0B]/60 backdrop-blur-2xl border border-zinc-200 dark:border-white/10 transition-all duration-500 hover:bg-zinc-100 dark:hover:bg-[#0A0A0B]/80 hover:border-primary/40 hover:scale-[1.01] hover:shadow-xl dark:hover:shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)]"
      >
        <div className="flex flex-col md:flex-row min-h-[160px]">
          <div className="flex-1 p-8 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-primary/10 border border-primary/20">
                <Globe className="h-4 w-4 text-primary" />
              </div>
              <span className="text-[10px] font-black uppercase tracking-[0.2em] text-zinc-400 dark:text-white/30 truncate max-w-[200px]">
                {siteName || new URL(url).hostname}
              </span>
            </div>

            <div className="space-y-2">
              <h4 className="text-xl font-black tracking-tighter text-zinc-900 dark:text-white line-clamp-1">{title || url}</h4>
              <p className="text-sm font-medium text-zinc-500 dark:text-white/50 leading-relaxed line-clamp-2">
                {description || 'Nenhuma descrição disponível para este link.'}
              </p>
            </div>

            <div className="flex items-center gap-2 text-[10px] font-bold text-primary uppercase tracking-widest pt-2">
              Visualizar conteúdo <ExternalLink className="h-3 w-3" />
            </div>
          </div>

          {image ? (
            <div className="md:w-72 relative overflow-hidden bg-zinc-100 dark:bg-white/5">
              <img src={image} alt="" className="w-full h-full object-cover transition-transform duration-700 group-hover/link:scale-110" />
            </div>
          ) : (
            <div className="md:w-72 bg-gradient-to-br from-zinc-900/[0.02] dark:from-white/[0.02] to-transparent flex items-center justify-center border-l border-zinc-200 dark:border-white/5">
              <Link2 className="h-12 w-12 text-zinc-200 dark:text-white/5" />
            </div>
          )}
        </div>

        {/* Delete Button */}
        <button
          onClick={(e) => { e.preventDefault(); deleteNode(); }}
          className="absolute top-4 right-4 p-2 rounded-xl bg-black/50 backdrop-blur-xl border border-white/10 text-white/20 hover:text-rose-500 hover:border-rose-500/30 opacity-0 group-hover/link:opacity-100 transition-all"
        >
          <Trash2 className="h-4 w-4" />
        </button>
      </a>
    </NodeViewWrapper>
  );
};

// --- Extension: Mermaid Diagram ---
export const MermaidNode = Node.create({
  name: 'mermaid',
  group: 'block',
  atom: true,
  priority: 1000,

  addAttributes() {
    return {
      code: {
        default: 'graph TD\nA[Início] --> B{Decisão}\nB -- Sim --> C[Resultado 1]\nB -- Não --> D[Resultado 2]',
        rendered: false,
      }
    };
  },

  parseHTML() {
    return [{
      tag: 'pre',
      priority: 1000,
      getAttrs: node => {
        const element = node as HTMLElement;
        const codeElement = element.querySelector('code');
        const rawCode = codeElement?.textContent || element.textContent || '';
        const hasMermaidMarker = element.classList.contains('mermaid')
          || element.dataset.mermaidDiagram === 'true'
          || codeElement?.classList.contains('language-mermaid');
        const code = extractMermaidCode(rawCode) || rawCode.replace(/[\u200B-\u200D\uFEFF]/g, '').trim();

        if (!hasMermaidMarker && !isLikelyMermaid(code)) return false;
        return { code };
      },
    }];
  },

  renderHTML({ node, HTMLAttributes }) {
    return [
      'pre',
      mergeAttributes(HTMLAttributes, {
        class: 'mermaid',
        'data-mermaid-diagram': 'true',
      }),
      ['code', { class: 'language-mermaid' }, node.attrs.code],
    ];
  },

  addNodeView() {
    return ReactNodeViewRenderer(MermaidComponent);
  },
});

const MermaidComponent = ({ node, updateAttributes, deleteNode }: any) => {
  const { code } = node.attrs;
  const [isSourceVisible, setIsSourceVisible] = useState(false);
  const sourceId = useId();

  return (
    <NodeViewWrapper className="my-8 group/mermaid">
      <section className="relative overflow-hidden rounded-[28px] border border-zinc-200 bg-zinc-50/80 shadow-sm dark:border-white/10 dark:bg-[#0A0A0B]/70">
        <div className="flex min-h-14 items-center justify-between gap-4 border-b border-zinc-200 px-5 py-3 dark:border-white/10">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Share2 className="h-4 w-4" />
            </div>
            <div>
              <h4 className="text-sm font-semibold text-zinc-900 dark:text-white">Diagrama Mermaid</h4>
              <p className="text-xs text-zinc-500 dark:text-zinc-400">Visualização da estrutura da nota</p>
            </div>
          </div>

          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-expanded={isSourceVisible}
              onClick={() => setIsSourceVisible((visible) => !visible)}
              className="inline-flex min-h-9 items-center gap-2 rounded-xl px-3 text-xs font-medium text-zinc-600 outline-none transition-colors hover:bg-zinc-200/70 focus-visible:ring-2 focus-visible:ring-primary/50 dark:text-zinc-300 dark:hover:bg-white/10"
            >
              <Code className="h-4 w-4" aria-hidden="true" />
              {isSourceVisible ? 'Ocultar código' : 'Editar código'}
            </button>
            <button
              type="button"
              aria-label="Remover diagrama"
              onClick={deleteNode}
              className="inline-flex h-9 w-9 items-center justify-center rounded-xl text-zinc-500 outline-none transition-colors hover:bg-rose-500/10 hover:text-rose-600 focus-visible:ring-2 focus-visible:ring-primary/50 dark:text-zinc-400 dark:hover:text-rose-400"
            >
              <Trash2 className="h-4 w-4" aria-hidden="true" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-5">
          <div className="h-[360px] min-h-[240px] overflow-hidden rounded-2xl border border-zinc-200 bg-white dark:border-white/5 dark:bg-[#060606]">
            <MermaidDiagram chart={code} compact layoutKey={code.length} />
          </div>

          {isSourceVisible && (
            <div className="mt-4">
              <label className="mb-2 block text-xs font-medium text-zinc-600 dark:text-zinc-300" htmlFor={sourceId}>
                Código Mermaid
              </label>
            <textarea
              id={sourceId}
              value={code}
              onChange={(e) => updateAttributes({ code: e.target.value })}
              placeholder="Insira o código Mermaid aqui..."
              spellCheck={false}
              className="min-h-[160px] w-full resize-y rounded-2xl border border-zinc-200 bg-white p-4 font-mono text-xs leading-6 text-zinc-800 outline-none transition-colors focus:border-primary/50 focus:ring-2 focus:ring-primary/20 dark:border-white/10 dark:bg-black/40 dark:text-zinc-200"
            />
            </div>
          )}
        </div>
      </section>
    </NodeViewWrapper>
  );
};

// --- Extension: Sentiment Pulse ---
export const SentimentPulseNode = Node.create({
  name: 'sentimentPulse',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      title: { default: 'Análise de Pulso Emocional' },
      data: {
        default: Array.from({ length: 20 }, (_, i) => ({
          name: i.toString(),
          value: Math.floor(Math.random() * 40) + 30,
          intensity: Math.floor(Math.random() * 50) + 20
        }))
      }
    };
  },

  parseHTML() {
    return [{ tag: 'sentiment-pulse' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['sentiment-pulse', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SentimentPulseComponent);
  },
});

const SentimentPulseComponent = ({ node, deleteNode }: any) => {
  const { data, title } = node.attrs;
  // const { theme } = useTheme();

  return (
    <NodeViewWrapper className="my-10 group/pulse">
      <div className="relative overflow-hidden rounded-[40px] bg-zinc-50 dark:bg-[#0A0A0B]/80 backdrop-blur-3xl border border-zinc-200 dark:border-white/10 p-10 shadow-xl dark:shadow-[0_45px_100px_-20px_rgba(0,0,0,0.8)]">
        <div className="absolute top-0 right-0 w-1/2 h-full bg-gradient-to-l from-primary/5 to-transparent pointer-events-none" />

        <div className="flex items-center justify-between mb-10 relative z-10">
          <div className="flex items-center gap-4">
            <div className="h-14 w-14 rounded-2xl bg-primary/10 border border-primary/20 flex items-center justify-center shadow-lg">
              <Brain className="h-7 w-7 text-primary" />
            </div>
            <div>
              <h4 className="text-xl font-black text-zinc-900 dark:text-white tracking-tighter">{title}</h4>
              <p className="text-[10px] font-black text-primary uppercase tracking-[0.3em]">Synapse Neural Monitoring</p>
            </div>
          </div>

          <div className="flex items-center gap-6">
            <div className="text-right">
              <p className="text-[9px] font-black text-zinc-400 dark:text-white/30 uppercase tracking-widest mb-1">Status Médio</p>
              <p className="text-lg font-black text-emerald-500">ESTÁVEL</p>
            </div>
            <button
              onClick={deleteNode}
              className="p-3 rounded-2xl bg-white/5 border border-white/10 text-white/20 hover:text-rose-500 hover:border-rose-500/30 transition-all opacity-0 group-hover/pulse:opacity-100"
            >
              <Trash2 className="h-4 w-4" />
            </button>
          </div>
        </div>

        <div className="h-[180px] w-full relative z-10">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={data}>
              <defs>
                <linearGradient id="pulseGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                  <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                </linearGradient>
                <linearGradient id="intensityGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.2} />
                  <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
                </linearGradient>
              </defs>
              <Tooltip
                content={({ active, payload }: any) => {
                  if (active && payload && payload.length) {
                    return (
                      <div className="bg-black/90 backdrop-blur-3xl border border-white/10 p-4 rounded-2xl shadow-[0_20px_40px_rgba(0,0,0,0.5)]">
                        <div className="flex flex-col gap-2">
                          <div>
                            <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-0.5">Frequência</p>
                            <p className="text-sm font-black text-white">{payload[0].value} Hz</p>
                          </div>
                          {payload[1] && (
                            <div>
                              <p className="text-[9px] font-black text-white/30 uppercase tracking-[0.2em] mb-0.5">Intensidade</p>
                              <p className="text-sm font-black text-blue-400">{payload[1].value}%</p>
                            </div>
                          )}
                        </div>
                      </div>
                    );
                  }
                  return null;
                }}
              />
              <Area
                type="monotone"
                dataKey="value"
                stroke="#8b5cf6"
                strokeWidth={4}
                fill="url(#pulseGradient)"
                strokeDasharray="10 5"
              />
              <Area
                type="monotone"
                dataKey="intensity"
                stroke="#3b82f6"
                strokeWidth={2}
                fill="url(#intensityGradient)"
              />
            </AreaChart>
          </ResponsiveContainer>
        </div>

        <div className="mt-8 flex items-center justify-between border-t border-zinc-200 dark:border-white/5 pt-6 relative z-10">
          <div className="flex gap-8">
            <div className="flex items-center gap-3">
              <div className="h-2 w-2 rounded-full bg-primary animate-pulse" />
              <span className="text-[10px] font-black text-zinc-400 dark:text-white/40 uppercase tracking-widest">Atividade Real-time</span>
            </div>
            <div className="flex items-center gap-3">
              <Zap className="h-3 w-3 text-amber-500" />
              <span className="text-[10px] font-black text-zinc-400 dark:text-white/40 uppercase tracking-widest">Processamento AI Ativo</span>
            </div>
          </div>
          <p className="text-[9px] font-black text-zinc-400 dark:text-white/20 uppercase tracking-[0.2em]">NeuroNex V1.0.4</p>
        </div>
      </div>
    </NodeViewWrapper>
  );
};

// --- Extension: Snippet Card ---
export const SnippetCardNode = Node.create({
  name: 'snippetCard',
  group: 'block',
  atom: true,

  addAttributes() {
    return {
      content: { default: '' },
      language: { default: 'markdown' },
      title: { default: 'Snippet de Conteúdo' }
    };
  },

  parseHTML() {
    return [{ tag: 'snippet-card' }];
  },

  renderHTML({ HTMLAttributes }) {
    return ['snippet-card', mergeAttributes(HTMLAttributes)];
  },

  addNodeView() {
    return ReactNodeViewRenderer(SnippetCardComponent);
  },
});

const SnippetCardComponent = ({ node, deleteNode }: any) => {
  const { content, language, title } = node.attrs;
  // const { theme } = useTheme();

  return (
    <NodeViewWrapper className="my-10 group/snippet">
      <div className="relative rounded-[32px] bg-zinc-50 dark:bg-[#0A0A0B]/90 backdrop-blur-3xl border border-zinc-200 dark:border-white/10 overflow-hidden shadow-xl dark:shadow-[0_40px_80px_-20px_rgba(0,0,0,0.6)]">
        <div className="flex items-center justify-between p-6 border-b border-zinc-100 dark:border-white/5 bg-zinc-900/[0.02] dark:bg-white/[0.02]">
          <div className="flex items-center gap-4">
            <div className="p-3 rounded-2xl bg-primary/10 border border-primary/20 text-primary">
              <Code className="h-5 w-5" />
            </div>
            <div>
              <h4 className="text-sm font-black text-zinc-900 dark:text-white uppercase tracking-[0.2em]">{title}</h4>
              <p className="text-[10px] font-bold text-zinc-400 dark:text-white/20 uppercase tracking-widest">{language.toUpperCase()}</p>
            </div>
          </div>
          <button
            onClick={deleteNode}
            className="p-3 rounded-2xl bg-white/5 border border-white/5 text-white/20 hover:text-rose-500 hover:bg-rose-500/10 transition-all font-sans"
          >
            <Trash2 className="h-4 w-4" />
          </button>
        </div>

        <div className="p-8 relative">
          <pre className="text-xs font-mono text-zinc-600 dark:text-white/60 leading-relaxed overflow-x-auto custom-scrollbar">
            <code>{content}</code>
          </pre>
          <div className="absolute top-4 right-4 px-3 py-1.5 rounded-lg bg-zinc-200/50 dark:bg-white/5 border border-zinc-200 dark:border-white/5 text-[9px] font-black uppercase tracking-widest text-zinc-400 dark:text-white/30">
            Renderizado por NeuroNex
          </div>
        </div>
      </div>
    </NodeViewWrapper>
  );
};
