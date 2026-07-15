import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { AGENT_TOOLS } from "./tools.ts";
import { executeAgentTool, executeConfirmedMutation, type PendingAction } from "./executor.ts";
import { formatGroundedResult } from "./formatters.ts";

const CORS={"Access-Control-Allow-Origin":"*","Access-Control-Allow-Headers":"authorization,x-client-info,apikey,content-type","Access-Control-Allow-Methods":"POST,OPTIONS"};
const reply=(body:unknown,status=200)=>new Response(JSON.stringify(body),{status,headers:{...CORS,"Content-Type":"application/json; charset=utf-8"}});
const GROQ_URL="https://api.groq.com/openai/v1/chat/completions";
const CONFIRM=/^\s*(confirmo|sim[,! ]*confirmo|pode executar|pode fazer|autorizo|confirmado|pode prosseguir|prosseguir)\s*[.!]?\s*$/i;
const CANCEL=/^\s*(cancelar|cancele|não confirmo|nao confirmo|desistir|desisto)\s*[.!]?\s*$/i;
const SYSTEM_DATA=/\b(paciente|pacientes|consulta|consultas|agenda|agendamento|horário|horario|prontuário|prontuario|sessão|sessao|financeiro|saldo|receita|despesa|lançamento|lancamento|transação|transacao|nota|notas|documento|arquivo|medicação|medicacao|risco|cobrança|cobranca|fatura)\b/i;

type Row={id:string;role:"user"|"assistant";content:string;attachments?:unknown;created_at:string};
type PendingRef={row:Row;action:PendingAction;attachments:any[]};
const arr=(value:unknown)=>Array.isArray(value)?value:value&&typeof value==="object"?[value]:[];
const clean=(value:unknown)=>String(value||"").replace(/```json\s+synapse_widget[\s\S]*?```/gi,"[componente visual]").slice(0,5000);
const widget=(text:string,data?:any)=>data?`${text}\n\n\`\`\`json synapse_widget\n${JSON.stringify({__actionType:data.type,data:data.data||data.payload||{}},null,2)}\n\`\`\``:text;

function pendingFrom(rows:Row[]):PendingRef|null{
  for(const row of rows){
    if(row.role!=="assistant")continue;
    const attachments=arr(row.attachments);
    const action=attachments.find((item:any)=>item?.kind==="synapse_pending_action"&&item?.status==="pending"&&new Date(item.expiresAt).getTime()>Date.now());
    if(action)return{row,action,attachments};
  }
  return null;
}

async function setPending(admin:any,pending:PendingRef,status:PendingAction["status"],errorMessage?:string){
  const attachments=pending.attachments.map((item:any)=>item?.kind==="synapse_pending_action"&&item?.actionId===pending.action.actionId?{...item,status,updatedAt:new Date().toISOString(),...(errorMessage?{errorMessage}:{})}:item);
  await admin.from("messages").update({attachments}).eq("id",pending.row.id);
}

async function saveUser(admin:any,userId:string,sessionId:string,message:string,rows:Row[],attachments:unknown[]){
  const last=rows.find(row=>row.role==="user");
  if(last?.content===message&&Date.now()-new Date(last.created_at).getTime()<120000)return;
  await admin.from("messages").insert({user_id:userId,session_id:sessionId,role:"user",content:message,attachments:attachments.length?attachments:null});
}

async function saveAssistant(admin:any,userId:string,sessionId:string,content:string,attachments:unknown[]){
  await admin.from("messages").insert({user_id:userId,session_id:sessionId,role:"assistant",content,attachments:attachments.length?attachments:null});
  await admin.from("chat_sessions").update({updated_at:new Date().toISOString()}).eq("id",sessionId).eq("user_id",userId);
}

function groundingRequired(message:string,context:any){
  if(SYSTEM_DATA.test(message))return true;
  const route=String(context?.currentContext||context?.route||"").toLowerCase();
  return /(pacient|agenda|finance|nota|document|prontu)/.test(route)&&/\b(meu|minha|meus|minhas|tenho|quantos|qual|quais|liste|mostre|consulte)\b/i.test(message);
}

function prompt(context:any,pending?:PendingAction|null){
  const now=new Intl.DateTimeFormat("pt-BR",{timeZone:"America/Sao_Paulo",dateStyle:"full",timeStyle:"short"}).format(new Date());
  return[
    "Você é o Synapse, agente operacional de contingência da NeuroNex.",
    "Responda em português brasileiro, com clareza e objetividade.",
    `Referência de Brasília: ${now}. Contexto visual: ${String(context?.currentContext||context?.route||"Synapse")}.`,
    "Histórico de conversa nunca é prova de dados do sistema.",
    "Para pacientes, agenda, prontuário, finanças, notas e documentos, use ferramentas.",
    "Nunca invente nomes, quantidades, datas, valores, diagnósticos ou compromissos.",
    "Use somente registros retornados pelas ferramentas e não complete lacunas.",
    "Nunca exponha IDs, rotas, URLs, JSON, SQL ou detalhes internos.",
    "Busque pacientes pelo nome antes de solicitar qualquer identificador.",
    "Ações de escrita são apenas preparadas e exigem confirmação separada.",
    "Nunca afirme sucesso antes do resultado da ferramenta.",
    pending?`Há confirmação pendente: ${pending.summary}.`:"",
  ].filter(Boolean).join("\n");
}

async function invokeModel(key:string,model:string,messages:any[],toolChoice:"auto"|"required"){
  const response=await fetch(GROQ_URL,{method:"POST",headers:{Authorization:`Bearer ${key}`,"Content-Type":"application/json"},body:JSON.stringify({model,messages,tools:AGENT_TOOLS,tool_choice:toolChoice,parallel_tool_calls:false,temperature:0.1,max_completion_tokens:1800})});
  const data=await response.json().catch(()=>null);
  if(!response.ok)throw new Error(data?.error?.message||`Falha do modelo ${model}.`);
  return data;
}

async function modelWithFallback(key:string,primary:string,secondary:string,messages:any[],toolChoice:"auto"|"required"){
  try{return{data:await invokeModel(key,primary,messages,toolChoice),model:primary};}
  catch(error){console.warn("[fallback-agent] primary failed",error);if(primary===secondary)throw error;return{data:await invokeModel(key,secondary,messages,toolChoice),model:secondary};}
}

Deno.serve(async(request)=>{
  if(request.method==="OPTIONS")return new Response("ok",{headers:CORS});
  if(request.method!=="POST")return reply({error:"Método não permitido."},405);
  try{
    const authorization=request.headers.get("Authorization")||"";
    if(!authorization.startsWith("Bearer "))return reply({error:"Sessão ausente."},401);
    const body=await request.json();
    const message=String(body.message||"").trim();
    const sessionId=String(body.sessionId||body.session_id||"").trim();
    const context=body.context||{};
    const inputAttachments=Array.isArray(body.attachments)?body.attachments:[];
    if(!message||!sessionId)return reply({error:"Mensagem ou conversa ausente."},400);

    const url=Deno.env.get("SUPABASE_URL")!;
    const anon=Deno.env.get("SUPABASE_ANON_KEY")!;
    const service=Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const userClient=createClient(url,anon,{global:{headers:{Authorization:authorization}},auth:{persistSession:false}});
    const admin=createClient(url,service,{auth:{persistSession:false}});
    const{data:authData,error:authError}=await userClient.auth.getUser();
    const user=authData.user;
    if(authError||!user)return reply({error:"Sessão inválida."},401);

    const{data:historyData,error:historyError}=await admin.from("messages").select("id,role,content,attachments,created_at").eq("user_id",user.id).eq("session_id",sessionId).order("created_at",{ascending:false}).limit(18);
    if(historyError)throw historyError;
    const rows=(historyData||[]) as Row[];
    const pending=pendingFrom(rows);
    await saveUser(admin,user.id,sessionId,message,rows,inputAttachments);

    if(pending&&CANCEL.test(message)){
      await setPending(admin,pending,"cancelled");
      const response="A ação pendente foi cancelada. Nenhuma alteração foi realizada.";
      await saveAssistant(admin,user.id,sessionId,response,[{kind:"synapse_grounding",provider:"system",grounded:true,toolsUsed:[],generatedAt:new Date().toISOString()}]);
      return reply({response,clientAction:null,session_id:sessionId,provider:"system",grounded:true});
    }

    if(pending&&CONFIRM.test(message)){
      await setPending(admin,pending,"executing");
      const result=await executeConfirmedMutation(pending.action,{admin,userId:user.id,sessionId});
      await setPending(admin,pending,result.ok?"executed":"failed",result.error);
      const response=widget(result.ok?(result.message||"Alteração concluída."):`Não consegui executar: ${result.error||"erro desconhecido"}`,result.structuredData);
      await saveAssistant(admin,user.id,sessionId,response,[{kind:"synapse_grounding",provider:"system",grounded:result.grounded,toolsUsed:[pending.action.toolName],recordsFound:result.recordCount||0,generatedAt:new Date().toISOString()}]);
      return reply({response,clientAction:result.clientAction||null,session_id:sessionId,provider:"system",model:"confirmed_action_executor",grounded:result.grounded,toolsUsed:[pending.action.toolName],recordsFound:result.recordCount||0});
    }

    if(!pending&&CONFIRM.test(message)){
      const response="Não há nenhuma ação pendente para confirmar.";
      await saveAssistant(admin,user.id,sessionId,response,[]);
      return reply({response,clientAction:null,session_id:sessionId,provider:"system",grounded:true});
    }

    const key=Deno.env.get("GROQ_API_KEY");
    if(!key)return reply({error:"Provedor alternativo indisponível."},503);
    const primary=Deno.env.get("GROQ_AGENT_MODEL")||"openai/gpt-oss-120b";
    const secondary=Deno.env.get("GROQ_AGENT_FALLBACK_MODEL")||Deno.env.get("GROQ_FALLBACK_MODEL")||"openai/gpt-oss-120b";
    const chronological=[...rows].reverse();
    const messages:any[]=[{role:"system",content:prompt(context,pending?.action||null)},...chronological.slice(-12).map(row=>({role:row.role==="assistant"?"assistant":"user",content:clean(row.content)})),{role:"user",content:message}];
    const mustGround=groundingRequired(message,context);
    const records:Array<{name:string;result:any}>=[];
    let finalText="",structured:any=null,clientAction:any=null,pendingAction:PendingAction|null=null,selectedModel=primary;

    outer:for(let step=0;step<6;step++){
      const choice=step===0&&mustGround?"required":"auto";
      const modelResult=await modelWithFallback(key,primary,secondary,messages,choice);
      selectedModel=modelResult.model;
      const assistant=modelResult.data?.choices?.[0]?.message;
      if(!assistant)throw new Error("Resposta inválida do agente.");
      const calls=Array.isArray(assistant.tool_calls)?assistant.tool_calls:[];
      if(!calls.length){finalText=String(assistant.content||"").trim();break;}
      messages.push({role:"assistant",content:assistant.content||null,tool_calls:calls});
      for(const call of calls){
        const name=String(call?.function?.name||"");
        let args:any={};try{args=JSON.parse(call?.function?.arguments||"{}");}catch{args={};}
        const result=await executeAgentTool(name,args,{admin,userId:user.id,sessionId});
        records.push({name,result});
        if(result.structuredData)structured=result.structuredData;
        if(result.clientAction)clientAction=result.clientAction;
        if(result.pendingAction)pendingAction=result.pendingAction;
        messages.push({role:"tool",tool_call_id:call.id,name,content:JSON.stringify(result.ok?(result.data||{success:true}):{error:result.error})});
        if(pendingAction)break outer;
      }
    }

    if(pendingAction){
      const response=widget(`Antes de executar, preciso da sua confirmação:\n\n**${pendingAction.summary}**\n\nResponda **“Confirmo”** para prosseguir ou **“Cancelar”** para desistir.`,{type:"confirmation_required",data:{actionId:pendingAction.actionId,summary:pendingAction.summary}});
      await saveAssistant(admin,user.id,sessionId,response,[pendingAction,{kind:"synapse_grounding",provider:"groq",model:selectedModel,grounded:false,toolsUsed:records.map(item=>item.name),generatedAt:new Date().toISOString()}]);
      return reply({response,clientAction:null,session_id:sessionId,provider:"groq",model:selectedModel,fallback:true,grounded:false,confirmationRequired:true,toolsUsed:records.map(item=>item.name)});
    }

    const grounded=[...records].reverse().find(item=>item.result.ok&&item.result.grounded);
    const failed=records.find(item=>!item.result.ok&&item.result.grounded);
    let response="";
    if(grounded){response=formatGroundedResult(grounded.name,grounded.result);structured=grounded.result.structuredData||structured;}
    else if(mustGround){response=failed?`Não consegui consultar os dados do sistema agora: ${failed.result.error||"falha temporária"}. Não vou estimar nem inventar uma resposta.`:"Não consegui obter dados confirmados do sistema agora. Não vou estimar nem inventar uma resposta.";}
    else if(clientAction){response=finalText||clientAction.data?.reason||"Ação preparada na interface.";}
    else{response=finalText||"Não consegui concluir a resposta agora.";}
    if(structured&&structured.type!=="confirmation_required")response=widget(response,structured);

    const isGrounded=Boolean(grounded)||Boolean(clientAction);
    const toolsUsed=records.map(item=>item.name);
    const recordsFound=grounded?.result.recordCount||0;
    await saveAssistant(admin,user.id,sessionId,response,[{kind:"synapse_grounding",provider:"groq",model:selectedModel,grounded:isGrounded,toolsUsed,recordsFound,generatedAt:new Date().toISOString()}]);
    return reply({response,clientAction,session_id:sessionId,provider:"groq",model:selectedModel,fallback:true,grounded:isGrounded,toolsUsed,recordsFound});
  }catch(error){
    console.error("[synapse-text-fallback-v2]",error);
    return reply({error:error instanceof Error?error.message:"Falha no agente de contingência."},500);
  }
});
