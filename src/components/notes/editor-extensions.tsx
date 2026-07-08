import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import {
  BrainCircuit,
  Calendar,
  CheckSquare,
  ChevronRightSquare,
  Code2,
  Heading1,
  Heading2,
  Heading3,
  Info,
  Link2,
  List,
  ListOrdered,
  Minus,
  Quote,
  Sigma,
  Table,
} from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';
import { cn } from '@/lib/utils';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

type LinkableNote = {
  id: string;
  title?: string | null;
  content?: string | null;
};

const stripHtml = (value: string) =>
  value
    .replace(/<[^>]*>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

const escapeAttribute = (value: unknown) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/"/g, '&quot;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');

const renderSuggestionPopup = () => {
  let component: ReactRenderer;
  let popup: any;

  return {
    onStart: (props: any) => {
      component = new ReactRenderer(CommandList, {
        props,
        editor: props.editor,
      });

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
      popup[0].setProps({
        getReferenceClientRect: props.clientRect,
      });
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
};

// --- Visual Component: Command List ---
export const CommandList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) props.command(item);
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="notes-liquid-surface min-w-[340px] overflow-hidden rounded-[22px] border p-2 text-foreground shadow-[0_24px_70px_-54px_hsl(var(--foreground)/0.78)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
      <div className="mb-2 flex items-center justify-between border-b border-border/50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
        <span>Acoes rapidas</span>
        <span className="rounded border border-border/60 bg-muted/60 px-1.5 py-0.5 text-[9px]">ESC</span>
      </div>
      <div className="max-h-[350px] space-y-1 overflow-y-auto pr-1 custom-scrollbar">
        {props.items.length ? (
          props.items.map((item: any, index: number) => (
            <button
              key={item.title}
              className={cn(
                'group relative flex w-full items-center gap-3 rounded-xl px-3 py-3 text-left transition-colors',
                index === selectedIndex ? 'bg-muted/75 text-foreground' : 'text-muted-foreground hover:bg-muted/45 hover:text-foreground'
              )}
              onClick={() => selectItem(index)}
            >
              {index === selectedIndex && <div className="absolute inset-y-2 left-0 w-[3px] rounded-r-full bg-primary" />}
              <div
                className={cn(
                  'rounded-xl border p-2.5 transition-colors',
                  index === selectedIndex ? 'border-primary/25 bg-primary/10 text-primary' : 'border-border/60 bg-background/50'
                )}
              >
                <item.icon className="h-4 w-4" />
              </div>
              <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                <span className="text-sm font-bold tracking-tight">{item.title}</span>
                {item.description && <span className="line-clamp-1 text-[10px] font-medium text-muted-foreground">{item.description}</span>}
              </div>
            </button>
          ))
        ) : (
          <div className="flex flex-col items-center gap-2 px-4 py-8 text-center text-xs font-medium italic text-muted-foreground">
            <BrainCircuit className="h-8 w-8 opacity-20" />
            <span>Nenhum comando encontrado...</span>
          </div>
        )}
      </div>
    </div>
  );
});

// --- Visual Component: Mention List ---
export const MentionList = forwardRef((props: any, ref) => {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const selectItem = (index: number) => {
    const item = props.items[index];
    if (item) props.command({ id: item.id, label: item.name });
  };

  useEffect(() => setSelectedIndex(0), [props.items]);

  useImperativeHandle(ref, () => ({
    onKeyDown: ({ event }: { event: KeyboardEvent }) => {
      if (event.key === 'ArrowUp') {
        setSelectedIndex((selectedIndex + props.items.length - 1) % props.items.length);
        return true;
      }
      if (event.key === 'ArrowDown') {
        setSelectedIndex((selectedIndex + 1) % props.items.length);
        return true;
      }
      if (event.key === 'Enter') {
        selectItem(selectedIndex);
        return true;
      }
      return false;
    },
  }));

  return (
    <div className="notes-liquid-surface min-w-[280px] overflow-hidden rounded-[22px] border p-2 text-foreground shadow-[0_24px_70px_-54px_hsl(var(--foreground)/0.78)] backdrop-blur-xl animate-in fade-in zoom-in-95 duration-150">
      <div className="mb-2 flex items-center gap-2 border-b border-border/50 px-3 py-2 text-[10px] font-black uppercase tracking-[0.2em] text-muted-foreground">
        <span>Vincular paciente</span>
      </div>
      <div className="max-h-[250px] space-y-1 overflow-y-auto custom-scrollbar">
        {props.items.length ? (
          props.items.map((item: any, index: number) => (
            <button
              key={item.id}
              className={cn(
                'flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-colors',
                index === selectedIndex ? 'bg-muted/75 text-foreground' : 'text-muted-foreground hover:bg-muted/45 hover:text-foreground'
              )}
              onClick={() => selectItem(index)}
            >
              <div
                className={cn(
                  'flex h-8 w-8 items-center justify-center rounded-full border text-[10px] font-bold',
                  index === selectedIndex ? 'border-primary/30 bg-primary/10 text-primary' : 'border-border/70 bg-background/50 text-muted-foreground'
                )}
              >
                {item.name.charAt(0)}
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold tracking-tight text-foreground">{item.name}</span>
                <span className="text-[9px] uppercase tracking-widest text-muted-foreground">Paciente</span>
              </div>
            </button>
          ))
        ) : (
          <div className="px-4 py-4 text-center text-xs italic text-muted-foreground">Nenhum paciente encontrado...</div>
        )}
      </div>
    </div>
  );
});

// --- Command Definitions ---
const getSuggestionItems = ({ query, linkableNotes = [] }: { query: string; linkableNotes?: LinkableNote[] }) => {
  return [
    {
      title: 'Tabela',
      description: 'Estrutura editavel com linhas e colunas',
      icon: Table,
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).insertTable({ rows: 3, cols: 3, withHeaderRow: true }).run();
      },
    },
    {
      title: 'Callout',
      description: 'Caixa de observacao ou insight',
      icon: Info,
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).insertContent('<notion-callout icon="!" label="Insight"><p><strong>Insight:</strong>&nbsp;Digite aqui...</p></notion-callout><p></p>').run();
      },
    },
    {
      title: 'Toggle',
      description: 'Bloco recolhivel com conteudo filho',
      icon: ChevronRightSquare,
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).insertContent('<notion-toggle title="Detalhes" open="true"><p>Digite aqui...</p></notion-toggle><p></p>').run();
      },
    },
    {
      title: 'Vincular Nota',
      description: 'Crie um card para outra nota',
      icon: Link2,
      command: ({ editor, range }: any) => {
        const search = window.prompt('Digite parte do titulo da nota para vincular:');
        if (!search) return;
        const match = linkableNotes.find((note) =>
          `${note.title || 'Nota sem titulo'} ${stripHtml(note.content || '')}`.toLowerCase().includes(search.toLowerCase())
        );
        if (!match) {
          window.alert('Nenhuma nota encontrada com esse termo.');
          return;
        }
        const title = match.title || 'Nota sem titulo';
        const description = stripHtml(match.content || '').slice(0, 160) || 'Nota vinculada no NeuroDrive.';
        editor
          .chain()
          .focus()
          .deleteRange(range)
          .insertContent(`<note-link noteId="${escapeAttribute(match.id)}" title="${escapeAttribute(title)}" description="${escapeAttribute(description)}" source="NeuroDrive"></note-link><p></p>`)
          .run();
      },
    },
    {
      title: 'Equacao',
      description: 'Expressao matematica preservada',
      icon: Sigma,
      command: ({ editor, range }: any) => {
        const expression = window.prompt('Expressao:', 'x^2 + y^2 = z^2');
        if (!expression) return;
        editor.chain().focus().deleteRange(range).insertContent(`<notion-equation expression="${escapeAttribute(expression)}"></notion-equation><p></p>`).run();
      },
    },
    {
      title: 'Data Atual',
      description: 'Data de hoje formatada',
      icon: Calendar,
      command: ({ editor, range }: any) => {
        const date = format(new Date(), "dd 'de' MMMM 'de' yyyy", { locale: ptBR });
        editor.chain().focus().deleteRange(range).insertContent(date).run();
      },
    },
    {
      title: 'Titulo 1',
      icon: Heading1,
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 1 }).run();
      },
    },
    {
      title: 'Titulo 2',
      icon: Heading2,
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 2 }).run();
      },
    },
    {
      title: 'Titulo 3',
      icon: Heading3,
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 3 }).run();
      },
    },
    {
      title: 'Titulo 4',
      icon: Heading3,
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).setNode('heading', { level: 4 }).run();
      },
    },
    {
      title: 'Lista de Tarefas',
      icon: CheckSquare,
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).toggleTaskList().run();
      },
    },
    {
      title: 'Lista com Marcadores',
      icon: List,
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).toggleBulletList().run();
      },
    },
    {
      title: 'Lista Numerada',
      icon: ListOrdered,
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).toggleOrderedList().run();
      },
    },
    {
      title: 'Bloco de Codigo',
      icon: Code2,
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).toggleCodeBlock().run();
      },
    },
    {
      title: 'Divisor',
      icon: Minus,
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).setHorizontalRule().run();
      },
    },
    {
      title: 'Citacao',
      icon: Quote,
      command: ({ editor, range }: any) => {
        editor.chain().focus().deleteRange(range).toggleBlockquote().run();
      },
    },
  ].filter((item) => item.title.toLowerCase().includes(query.toLowerCase()));
};

export const SlashCommands = Extension.create({
  name: 'slash-commands',
  addOptions() {
    return {
      suggestion: {
        char: '/',
        command: ({ editor, range, props }: any) => {
          props.command({ editor, range });
        },
      },
    };
  },
  addProseMirrorPlugins() {
    return [
      Suggestion({
        editor: this.editor,
        ...this.options.suggestion,
      }),
    ];
  },
});

export const slashSuggestion = {
  items: ({ query }: { query: string }) => getSuggestionItems({ query }),
  render: renderSuggestionPopup,
};

export const createSlashSuggestion = (linkableNotes: LinkableNote[] = []) => ({
  ...slashSuggestion,
  items: ({ query }: { query: string }) => getSuggestionItems({ query, linkableNotes }),
});
