import { BrainCircuit } from 'lucide-react';
import { forwardRef, useEffect, useImperativeHandle, useState } from 'react';

import { cn } from '@/lib/utils';

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
