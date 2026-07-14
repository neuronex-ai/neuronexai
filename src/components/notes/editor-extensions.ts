import { Extension } from '@tiptap/core';
import Suggestion from '@tiptap/suggestion';
import { ReactRenderer } from '@tiptap/react';
import tippy from 'tippy.js';
import {
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
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import { CommandList } from './editor-suggestion-lists';

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
