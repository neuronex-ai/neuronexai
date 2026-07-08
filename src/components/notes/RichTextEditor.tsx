import { cn } from '@/lib/utils';
import CharacterCount from '@tiptap/extension-character-count';
import Color from '@tiptap/extension-color';
import Highlight from '@tiptap/extension-highlight';
import Image from '@tiptap/extension-image';
import Link from '@tiptap/extension-link';
import Mention from '@tiptap/extension-mention';
import Placeholder from '@tiptap/extension-placeholder';
import Subscript from '@tiptap/extension-subscript';
import Superscript from '@tiptap/extension-superscript';
import { Table } from '@tiptap/extension-table';
import { TableCell } from '@tiptap/extension-table-cell';
import { TableHeader } from '@tiptap/extension-table-header';
import { TableRow } from '@tiptap/extension-table-row';
import TaskItem from '@tiptap/extension-task-item';
import TaskList from '@tiptap/extension-task-list';
import TextAlign from '@tiptap/extension-text-align';
import { TextStyle } from '@tiptap/extension-text-style';
import Typography from '@tiptap/extension-typography';
import Underline from '@tiptap/extension-underline';
import { BubbleMenu, EditorContent, ReactRenderer, useEditor } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import {
    AlignCenter, AlignJustify, AlignLeft, AlignRight, Bold, CheckSquare, Code, Heading1,
    Heading2, Heading3, Highlighter, Italic, Link as LinkIcon,
    List, Quote,
    Strikethrough, Subscript as SubscriptIcon,
    Superscript as SuperscriptIcon, Underline as UnderlineIcon
} from 'lucide-react';
import { useEffect, useRef } from "react";
import { toast } from 'sonner';
import tippy from 'tippy.js';
import { createSlashSuggestion, MentionList, SlashCommands } from './editor-extensions';
import {
  ClinicalChartNode,
  EmbeddedDocNode,
  LinkCardNode,
  MermaidNode,
  NoteLinkNode,
  NotionCalloutNode,
  NotionEquationNode,
  NotionToggleNode,
  SentimentPulseNode,
  SnippetCardNode,
  VideoEmbedNode,
} from './editor-nodes';
import { TableMenu } from './TableMenu';

interface RichTextEditorProps {
  content: string;
  onChange: (html: string) => void;
  placeholder?: string;
  editable?: boolean;
  className?: string;
  onUploadImage?: (file: File) => Promise<string>;
  patients?: { id: string, name: string }[];
  linkableNotes?: { id: string; title?: string | null; content?: string | null }[];
  isFocusMode?: boolean;
}

const MenuButton = ({ onClick, isActive, icon: Icon, title, className }: any) => (
  <button
    onClick={onClick}
    className={cn(
      "p-1.5 rounded-lg transition-all duration-200 flex items-center justify-center relative overflow-hidden group",
      isActive
        ? "bg-zinc-900 text-white dark:bg-white dark:text-black shadow-[0_10px_20px_rgba(0,0,0,0.2)] scale-110"
        : "text-zinc-400 dark:text-zinc-500 hover:text-zinc-900 dark:hover:text-white hover:bg-zinc-100 dark:hover:bg-white/5",
      className
    )}
    title={title}
  >
    <Icon className="h-4 w-4 relative z-10" />
    {isActive && (
      <div className="absolute inset-0 bg-gradient-to-br from-white/20 to-transparent dark:from-black/10 opacity-50 transition-opacity" />
    )}
  </button>
);

export const RichTextEditor = ({
  content,
  onChange,
  placeholder,
  editable = true,
  className,
  onUploadImage,
  patients = [],
  linkableNotes = [],
  isFocusMode = false
}: RichTextEditorProps) => {
  const onChangeRef = useRef(onChange);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        heading: {
          levels: [1, 2, 3, 4],
        },
      }),
      Underline,
      Subscript,
      Superscript,
      Highlight.configure({ multicolor: true }),
      Typography,
      TextStyle,
      Color,
      CharacterCount,
      TaskList,
      TaskItem.configure({ nested: true }),
      TextAlign.configure({
        types: ['heading', 'paragraph'],
      }),
      ClinicalChartNode,
      EmbeddedDocNode,
      VideoEmbedNode,
      LinkCardNode,
      NoteLinkNode,
      NotionCalloutNode,
      NotionToggleNode,
      NotionEquationNode,
      MermaidNode,
      SentimentPulseNode,
      SnippetCardNode,
      Placeholder.configure({
        placeholder: placeholder || 'Comece a escrever... Digite "/" para comandos.',
      }),
      Table.configure({
        resizable: true,
      }),
      TableRow,
      TableHeader,
      TableCell,
      Image.configure({
        allowBase64: true,
        HTMLAttributes: {
          class: 'rounded-[32px] shadow-[0_30px_60px_-15px_rgba(0,0,0,0.5)] border border-white/10 max-w-full my-12 transition-all duration-500 hover:scale-[1.02] hover:shadow-primary/20',
        }
      }),
      Link.configure({
        openOnClick: false,
        HTMLAttributes: {
          class: 'text-primary underline underline-offset-8 cursor-pointer font-black hover:text-primary/80 transition-all decoration-2',
        }
      }),
      SlashCommands.configure({
        suggestion: createSlashSuggestion(linkableNotes),
      }),
      Mention.configure({
        HTMLAttributes: {
          class: 'bg-primary/10 text-primary px-3 py-1 rounded-full font-black border border-primary/20 text-[0.85em] whitespace-nowrap inline-flex items-center gap-1.5 shadow-[0_5px_15px_hsl(var(--primary)/0.1)] transition-transform hover:scale-105',
        },
        suggestion: {
          items: ({ query }) => {
            return patients
              .filter(p => p.name.toLowerCase().startsWith(query.toLowerCase()))
              .slice(0, 5);
          },
          render: () => {
            let component: ReactRenderer;
            let popup: any;
            return {
              onStart: (props: any) => {
                component = new ReactRenderer(MentionList, { props, editor: props.editor });
                if (!props.clientRect) return;
                popup = tippy('body', {
                  getReferenceClientRect: props.clientRect,
                  appendTo: () => document.body,
                  content: component.element,
                  showOnCreate: true,
                  interactive: true,
                  trigger: 'manual',
                  placement: 'bottom-start',
                  theme: 'dark',
                });
              },
              onUpdate(props: any) {
                component.updateProps(props);
                if (!props.clientRect) return;
                popup[0].setProps({ getReferenceClientRect: props.clientRect });
              },
              onKeyDown(props: any) {
                if (props.event.key === 'Escape') {
                  popup[0].hide();
                  return true;
                }
                // @ts-expect-error Tiptap suggestion refs expose onKeyDown at runtime.
                return component.ref?.onKeyDown(props);
              },
              onExit() {
                if (popup && popup[0]) popup[0].destroy();
                if (component) component.destroy();
              },
            };
          },
        },
      }),
    ],
    content: content,
    editable: editable,
    onUpdate: ({ editor }) => {
      onChangeRef.current(editor.getHTML());
    },
    editorProps: {
      attributes: {
        class: cn(
          "prose max-w-none focus:outline-none text-foreground font-sans min-h-[54vh] pb-48 selection:bg-primary/25 selection:text-foreground dark:selection:bg-primary/35",
          isFocusMode
            ? "prose-p:leading-[1.9] prose-p:my-8 prose-p:text-xl prose-p:text-foreground/90 prose-p:tracking-tight font-light"
            : "prose-p:leading-[1.75] prose-p:my-4 prose-p:font-normal prose-p:text-[17px] prose-p:text-foreground/82",
          "prose-headings:font-black prose-headings:tracking-tighter prose-headings:text-foreground",
          "prose-h1:text-4xl prose-h1:mt-16 prose-h1:mb-7 prose-h1:leading-none",
          "prose-h2:text-3xl prose-h2:mt-12 prose-h2:mb-5 prose-h2:leading-tight",
          "prose-h3:text-2xl prose-h3:mt-10 prose-h3:mb-4",
          "prose-h4:text-base prose-h4:mt-8 prose-h4:mb-3 prose-h4:uppercase prose-h4:tracking-[0.16em] prose-h4:text-muted-foreground",
          "prose-blockquote:border-l-4 prose-blockquote:border-primary/45 prose-blockquote:bg-muted/45 prose-blockquote:py-6 prose-blockquote:px-7 prose-blockquote:rounded-2xl prose-blockquote:not-italic prose-blockquote:my-10 prose-blockquote:text-xl prose-blockquote:font-semibold prose-blockquote:shadow-sm prose-blockquote:text-foreground",
          "prose-li:marker:text-primary prose-li:my-2 prose-li:text-[17px] prose-li:text-foreground/85",
          "prose-hr:border-border prose-hr:my-14",
          "prose-table:border-collapse prose-table:w-full prose-table:my-12 prose-table:rounded-2xl prose-table:overflow-hidden prose-table:border-border",
          className
        ),
      },
      handlePaste: (view, event, _slice) => {
        const items = Array.from(event.clipboardData?.items || []);
        const imageItem = items.find(item => item.type.indexOf('image') === 0);

        if (imageItem && onUploadImage) {
          event.preventDefault();
          const file = imageItem.getAsFile();
          if (file) {
            onUploadImage(file).then(url => {
              const { schema } = view.state;
              const node = schema.nodes.image.create({ src: url });
              const transaction = view.state.tr.replaceSelectionWith(node);
              view.dispatch(transaction);
            });
            return true;
          }
        }

        // Smart Content Detection
        const text = event.clipboardData?.getData('text/plain');
        if (text) {
          // Detect Mermaid
          if (text.includes('graph ') || text.includes('sequenceDiagram') || text.includes('classDiagram')) {
            event.preventDefault();
            const { schema } = view.state;
            const node = schema.nodes.mermaid.create({ code: text });
            const transaction = view.state.tr.replaceSelectionWith(node);
            view.dispatch(transaction);
            toast.success("Diagrama detectado e incorporado!");
            return true;
          }

          // Detect URLs for Link Cards
          if (text.startsWith('http') && !event.clipboardData?.types.includes('text/html')) {
            const confirmCard = window.confirm("Deseja criar um Card de Visualização para este link?");
            if (confirmCard) {
              const { schema } = view.state;
              const node = schema.nodes.linkCard.create({
                url: text,
                title: 'Carregando preview...',
                description: text,
                siteName: new URL(text).hostname
              });
              const transaction = view.state.tr.replaceSelectionWith(node);
              view.dispatch(transaction);
              return true;
            }
          }

          // Detect large blocks of Markdown or HTML for Snippet Card
          const isLargeSnippet = text.length > 100 && (text.includes('<div') || text.includes('---') || text.includes('# ') || text.includes('```'));
          if (isLargeSnippet) {
            const confirmSnippet = window.confirm("Detectamos um bloco de código/formatação largo. Deseja incorporá-lo como um Snippet Card?");
            if (confirmSnippet) {
              const { schema } = view.state;
              const isHtml = text.trim().startsWith('<');
              const node = schema.nodes.snippetCard.create({
                content: text,
                language: isHtml ? 'html' : 'markdown',
                title: isHtml ? 'Template HTML Detectado' : 'Documento Markdown Detectado'
              });
              const transaction = view.state.tr.replaceSelectionWith(node);
              view.dispatch(transaction);
              toast.success("Snippet Card incorporado!");
              return true;
            }
          }
        }
        return false;
      }
    },
  });

  useEffect(() => {
    if (editor && content !== editor.getHTML()) {
      if (!editor.isFocused) {
        editor.commands.setContent(content, false);
      }
    }
  }, [content, editor]);

  const addLink = () => {
    const previousUrl = editor?.getAttributes('link').href;
    const url = window.prompt('URL:', previousUrl);
    if (url === null) return;
    if (url === '') {
      editor?.chain().focus().extendMarkRange('link').unsetLink().run();
      return;
    }
    editor?.chain().focus().extendMarkRange('link').setLink({ href: url }).run();
  };

  if (!editor) return null;

  return (
    <div className="relative group/editor flex-1 flex flex-col cursor-text w-full" onClick={() => editor.chain().focus().run()}>

      {/* Table Context Menu */}
      {editable && <TableMenu editor={editor} />}

      {/* Formatting Menu (Bubble) - Ultra Premium Immersive Liquid Glass */}
      {editable && (
        <BubbleMenu
          editor={editor}
          pluginKey="notesFormattingBubbleMenu"
          tippyOptions={{
            duration: 200,
            animation: 'shift-away',
            placement: 'top',
            maxWidth: 'none',
            offset: [0, 15]
          }}
          className="flex items-center gap-1 p-1.5 rounded-[20px] bg-white/95 dark:bg-zinc-900/95 backdrop-blur-3xl border border-zinc-200 dark:border-white/10 shadow-[0_20px_50px_rgba(0,0,0,0.2)] dark:shadow-[0_20px_50px_rgba(0,0,0,0.4)] overflow-hidden max-w-[95vw] flex-nowrap z-[1000] animate-in zoom-in-95 slide-in-from-bottom-2 ring-1 ring-black/5 dark:ring-white/5"
          shouldShow={({ editor, from, to }) => {
            return editor.view.hasFocus() && from !== to && !editor.isActive('image') && !editor.isActive('table') && !editor.isActive('clinicalChart') && !editor.isActive('sentimentPulse') && !editor.isActive('embeddedDoc') && !editor.isActive('noteLink');
          }}
        >
          <div className="flex items-center gap-0.5 px-0.5">
            <MenuButton onClick={() => editor.chain().focus().toggleBold().run()} isActive={editor.isActive('bold')} icon={Bold} title="Negrito" />
            <MenuButton onClick={() => editor.chain().focus().toggleItalic().run()} isActive={editor.isActive('italic')} icon={Italic} title="Itálico" />
            <MenuButton onClick={() => editor.chain().focus().toggleUnderline().run()} isActive={editor.isActive('underline')} icon={UnderlineIcon} title="Sublinhado" />
            <MenuButton onClick={() => editor.chain().focus().toggleStrike().run()} isActive={editor.isActive('strike')} icon={Strikethrough} title="Tachado" />
          </div>

          <div className="w-px h-6 bg-zinc-200 dark:bg-white/10 mx-1.5" />

          <div className="flex items-center gap-0.5 px-0.5">
            <MenuButton onClick={() => editor.chain().focus().setTextAlign('left').run()} isActive={editor.isActive({ textAlign: 'left' })} icon={AlignLeft} title="Alinhar à Esquerda" />
            <MenuButton onClick={() => editor.chain().focus().setTextAlign('center').run()} isActive={editor.isActive({ textAlign: 'center' })} icon={AlignCenter} title="Centralizar" />
            <MenuButton onClick={() => editor.chain().focus().setTextAlign('right').run()} isActive={editor.isActive({ textAlign: 'right' })} icon={AlignRight} title="Alinhar à Direita" />
            <MenuButton onClick={() => editor.chain().focus().setTextAlign('justify').run()} isActive={editor.isActive({ textAlign: 'justify' })} icon={AlignJustify} title="Justificar" />
          </div>

          <div className="w-px h-6 bg-zinc-200 dark:bg-white/10 mx-1.5" />

          <div className="flex items-center gap-0.5 px-0.5">
            <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} isActive={editor.isActive('heading', { level: 1 })} icon={Heading1} title="Título 1" />
            <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} isActive={editor.isActive('heading', { level: 2 })} icon={Heading2} title="Título 2" />
            <MenuButton onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} isActive={editor.isActive('heading', { level: 3 })} icon={Heading3} title="Título 3" />
          </div>

          <div className="w-px h-6 bg-zinc-200 dark:bg-white/10 mx-1.5" />

          <div className="flex items-center gap-0.5 px-0.5">
            <MenuButton onClick={() => editor.chain().focus().toggleBulletList().run()} isActive={editor.isActive('bulletList')} icon={List} title="Lista" />
            <MenuButton onClick={() => editor.chain().focus().toggleTaskList().run()} isActive={editor.isActive('taskList')} icon={CheckSquare} title="Tarefas" />
          </div>

          <div className="w-px h-6 bg-zinc-200 dark:bg-white/10 mx-1.5" />

          <div className="flex items-center gap-0.5 px-0.5">
            <MenuButton onClick={() => editor.chain().focus().toggleHighlight().run()} isActive={editor.isActive('highlight')} icon={Highlighter} title="Destaque" />
            <MenuButton onClick={addLink} isActive={editor.isActive('link')} icon={LinkIcon} title="Link" />
            <MenuButton onClick={() => editor.chain().focus().toggleBlockquote().run()} isActive={editor.isActive('blockquote')} icon={Quote} title="Citação" />
            <MenuButton onClick={() => editor.chain().focus().toggleCodeBlock().run()} isActive={editor.isActive('codeBlock')} icon={Code} title="Código" />
          </div>

          <div className="w-px h-6 bg-zinc-200 dark:bg-white/10 mx-1.5" />

          <div className="flex items-center gap-0.5 px-0.5">
            <MenuButton onClick={() => editor.chain().focus().toggleSubscript().run()} isActive={editor.isActive('subscript')} icon={SubscriptIcon} title="Subscrito" />
            <MenuButton onClick={() => editor.chain().focus().toggleSuperscript().run()} isActive={editor.isActive('superscript')} icon={SuperscriptIcon} title="Sobrescrito" />
          </div>
        </BubbleMenu>
      )}

      <EditorContent editor={editor} className="w-full font-sans" />

    </div>
  );
};
