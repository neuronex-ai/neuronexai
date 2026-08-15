import { useMemo, useState } from 'react';
import { Lock, Maximize2, Plus, RotateCcw, Unlock, ZoomIn, ZoomOut, Layers, Play, X } from 'lucide-react';

type FlowNode = { id:string; label:string; kind:string; x:number; y:number };
const INITIAL: FlowNode[] = [
 {id:'start',label:'Início da sessão',kind:'start',x:80,y:230},
 {id:'note',label:'Registrar observação',kind:'note',x:300,y:140},
 {id:'patient',label:'Contexto do paciente',kind:'patient',x:300,y:320},
 {id:'condition',label:'Identificar padrão',kind:'condition',x:530,y:230},
 {id:'action',label:'Definir intervenção',kind:'action',x:750,y:230},
];
const EDGES=[['start','note'],['start','patient'],['note','condition'],['patient','condition'],['condition','action']];
export default function NeuroFlow(){
 const [nodes,setNodes]=useState(INITIAL); const [locked,setLocked]=useState(false); const [zoom,setZoom]=useState(1); const [library,setLibrary]=useState(false); const [selected,setSelected]=useState<string|null>(null);
 const map=useMemo(()=>Object.fromEntries(nodes.map(n=>[n.id,n])),[nodes]);
 const addNode=()=>{ if(locked)return; const id=`node-${nodes.length}`; setNodes(n=>[...n,{id,label:'Novo bloco',kind:'item',x:420+(n.length%2)*170,y:400+(n.length%3)*45}]); };
 return <section className="neuroflow-shell"><div className="neuroflow-canvas">
  <header className="neuroflow-header"><div><strong>NeuroFlow Studio</strong><small>Fluxo clínico visual</small></div><div className="neuroflow-tools"><button onClick={()=>setLibrary(v=>!v)}><Layers size={15}/> Biblioteca</button><button onClick={()=>setLocked(v=>!v)}>{locked?<Lock size={15}/>:<Unlock size={15}/>} {locked?'Bloqueado':'Editar'}</button></div></header>
  <div className="neuroflow-toolbar"><button onClick={()=>setZoom(z=>Math.max(.6,z-.15))}><ZoomOut size={15}/></button><span>{Math.round(zoom*100)}%</span><button onClick={()=>setZoom(z=>Math.min(1.5,z+.15))}><ZoomIn size={15}/></button><button onClick={()=>setZoom(1)}><RotateCcw size={14}/></button><button onClick={()=>setZoom(1)}><Maximize2 size={14}/></button></div>
  <div className="neuroflow-viewport"><div className="neuroflow-board" style={{transform:`scale(${zoom})`}}>
   <svg className="neuroflow-links" viewBox="0 0 940 560">{EDGES.map(([a,b])=>{const A=map[a],B=map[b];return A&&B?<line key={a+b} x1={A.x+70} y1={A.y+30} x2={B.x+70} y2={B.y+30}/>:null})}</svg>
   {nodes.map(n=><button key={n.id} className={`flow-node ${n.kind} ${selected===n.id?'selected':''}`} style={{left:n.x,top:n.y}} onClick={()=>setSelected(n.id)}><span>{n.kind}</span><strong>{n.label}</strong></button>)}
  </div></div>
  <footer className="neuroflow-footer"><button onClick={addNode}><Plus size={14}/> Adicionar bloco</button><span><Play size={13}/> Visualização local</span></footer>
  {library&&<aside className="neuroflow-library"><div className="panel-title"><strong>Biblioteca</strong><button onClick={()=>setLibrary(false)}><X size={14}/></button></div><p>Blocos disponíveis para o laboratório visual.</p>{['Anamnese','Nota clínica','Paciente','Condição','Intervenção','Tarefa','Decisão','Documento'].map(x=><button key={x} onClick={addNode} className="library-item">{x}</button>)}</aside>}
  {selected&&<div className="flow-selection">Bloco selecionado: <strong>{map[selected]?.label}</strong></div>}
 </div></section>
}
