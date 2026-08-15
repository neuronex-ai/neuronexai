import { useMemo, useState } from 'react';
import { Search, ZoomIn, ZoomOut, Maximize2, Target, Play, Settings2, Users, X } from 'lucide-react';

export type NeuroNode = { id: string; label: string; type: 'patient' | 'note' | 'tag' };

const MOCK_NODES: NeuroNode[] = [
  { id: 'p1', label: 'Marina Costa', type: 'patient' },
  { id: 'p2', label: 'Lucas Almeida', type: 'patient' },
  { id: 'p3', label: 'Ana Ribeiro', type: 'patient' },
  { id: 'n1', label: 'Sessão 12/08', type: 'note' },
  { id: 'n2', label: 'Anamnese', type: 'note' },
  { id: 'n3', label: 'Plano terapêutico', type: 'note' },
  { id: 't1', label: 'Ansiedade', type: 'tag' },
  { id: 't2', label: 'Sono', type: 'tag' },
  { id: 't3', label: 'Trabalho', type: 'tag' },
];

const LINKS: [string, string][] = [['p1','n1'],['p1','n2'],['p2','n3'],['p3','n1'],['n1','t1'],['n1','t2'],['n2','t1'],['n3','t3']];

export default function NeuroView() {
  const [query, setQuery] = useState('');
  const [zoom, setZoom] = useState(1);
  const [sidebar, setSidebar] = useState(true);
  const [selected, setSelected] = useState<NeuroNode | null>(null);
  const [settings, setSettings] = useState(false);
  const nodes = useMemo(() => MOCK_NODES.filter(n => !query || n.label.toLowerCase().includes(query.toLowerCase())), [query]);
  const visible = new Set(nodes.map(n => n.id));

  return (
    <section className="neuroview-shell">
      <div className="neuroview-canvas">
        <div className="neuroview-toolbar">
          <div className="neuroview-search"><Search size={15}/><input value={query} onChange={e => setQuery(e.target.value)} placeholder="Buscar na rede..."/></div>
          <div className="neuroview-actions">
            <button onClick={() => setZoom(z => Math.max(.65, z-.15))}><ZoomOut size={15}/></button>
            <button onClick={() => setZoom(z => Math.min(1.6, z+.15))}><ZoomIn size={15}/></button>
            <button onClick={() => setZoom(1)}><Target size={15}/></button>
            <button onClick={() => setSettings(s => !s)}><Settings2 size={15}/></button>
          </div>
        </div>

        <div className="neuroview-network" style={{ transform: `scale(${zoom})` }}>
          <svg viewBox="0 0 900 560" preserveAspectRatio="xMidYMid meet">
            <defs><filter id="nv-glow"><feGaussianBlur stdDeviation="4" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge></filter></defs>
            {LINKS.filter(([a,b]) => visible.has(a) && visible.has(b)).map(([a,b]) => {
              const pa = MOCK_NODES.find(n=>n.id===a)!; const pb = MOCK_NODES.find(n=>n.id===b)!;
              const pos: Record<string,[number,number]> = {p1:[180,210],p2:[700,190],p3:[450,410],n1:[360,190],n2:[250,330],n3:[610,300],t1:[440,110],t2:[520,180],t3:[760,360]};
              return <line key={`${a}-${b}`} x1={pos[pa.id][0]} y1={pos[pa.id][1]} x2={pos[pb.id][0]} y2={pos[pb.id][1]} className="neuro-link"/>;
            })}
            {nodes.map(node => { const pos: Record<string,[number,number]> = {p1:[180,210],p2:[700,190],p3:[450,410],n1:[360,190],n2:[250,330],n3:[610,300],t1:[440,110],t2:[520,180],t3:[760,360]}; const [x,y]=pos[node.id]; return <g key={node.id} className="neuro-node" onClick={()=>setSelected(node)} filter={selected?.id===node.id?'url(#nv-glow)':undefined}><circle cx={x} cy={y} r={node.type==='patient'?24:node.type==='note'?19:13}/><text x={x} y={y+42} textAnchor="middle">{node.label}</text></g> })}
          </svg>
        </div>

        {sidebar && <aside className="neuroview-patients"><div className="panel-title"><span><Users size={14}/> Pacientes</span><button onClick={()=>setSidebar(false)}><X size={14}/></button></div><small>{MOCK_NODES.filter(n=>n.type==='patient').length} nós ativos</small>{MOCK_NODES.filter(n=>n.type==='patient').map(p=><button key={p.id} onClick={()=>setSelected(p)} className="patient-item"><span>{p.label.split(' ').map(x=>x[0]).join('').slice(0,2)}</span>{p.label}</button>)}</aside>}
        {!sidebar && <button className="neuroview-open" onClick={()=>setSidebar(true)}><Users size={15}/></button>}

        {selected && <aside className="neuroview-details"><div className="panel-title"><strong>{selected.label}</strong><button onClick={()=>setSelected(null)}><X size={14}/></button></div><small>{selected.type === 'patient' ? 'Paciente' : selected.type === 'note' ? 'Registro clínico' : 'Tag clínica'}</small><p>Elemento selecionado da rede clínica. Esta versão usa dados locais para preservar a experiência visual sem tocar no backend.</p></aside>}

        {settings && <div className="neuroview-settings"><strong><Settings2 size={14}/> Física do NeuroView</strong><label>Otimização dinâmica <input type="checkbox" defaultChecked/></label><label>Mostrar pacientes <input type="checkbox" defaultChecked/></label><label>Mostrar notas <input type="checkbox" defaultChecked/></label><label>Mostrar tags <input type="checkbox" defaultChecked/></label></div>}

        <div className="neuroview-controls"><button onClick={()=>setZoom(1)}><Play size={14}/></button><span>NeuroView</span><button onClick={()=>setZoom(z=>Math.min(1.6,z+.1))}><Maximize2 size={14}/></button></div>
      </div>
    </section>
  );
}
