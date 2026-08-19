import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import {
  appointmentAdminClient,
  appointmentTokenHash,
} from "../_shared/appointment-lifecycle.ts";

const headers = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization,x-client-info,apikey,content-type",
  "Access-Control-Allow-Methods": "GET,POST,OPTIONS",
  "Cache-Control": "private, no-store, max-age=0",
  "Pragma": "no-cache",
  "Referrer-Policy": "no-referrer",
  "X-Content-Type-Options": "nosniff",
};

const json = (payload: Record<string, unknown>, status = 200) =>
  new Response(JSON.stringify(payload), {
    status,
    headers: { ...headers, "Content-Type": "application/json; charset=utf-8" },
  });

const html = (content: string, status = 200) =>
  new Response(content, {
    status,
    headers: {
      ...headers,
      "Content-Type": "text/html; charset=utf-8",
      "Content-Security-Policy": "default-src 'none'; style-src 'unsafe-inline'; script-src 'unsafe-inline'; connect-src 'self'; img-src 'self' data:; base-uri 'none'; frame-ancestors 'none'; form-action 'self'",
    },
  });

const clean = (value: unknown, max = 2000) => String(value ?? "").trim().slice(0, max);

const normalizeToken = (value: unknown) => {
  const token = clean(value, 256);
  if (token.length < 16 || token.length > 256 || !/^[A-Za-z0-9_-]+$/.test(token)) return null;
  return token;
};

const normalizeDecisions = (value: unknown) => {
  if (!Array.isArray(value) || value.length < 1 || value.length > 100) return null;
  const decisions = value.map((raw) => {
    const item = raw && typeof raw === "object" && !Array.isArray(raw)
      ? raw as Record<string, unknown>
      : {};
    const itemId = clean(item.itemId || item.item_id, 120);
    const decision = clean(item.decision, 40);
    const requestedStartTime = clean(item.requestedStartTime || item.requested_start_time, 120) || null;
    if (!/^[0-9a-f-]{36}$/i.test(itemId) || !["accept", "reject", "request_change"].includes(decision)) {
      return null;
    }
    if (decision === "request_change" && !requestedStartTime) return null;
    return {
      itemId,
      decision,
      ...(decision === "request_change" ? { requestedStartTime } : {}),
    };
  });
  return decisions.every(Boolean) ? decisions : null;
};

const reviewPage = (token: string) => `<!doctype html>
<html lang="pt-BR">
<head>
<meta charset="utf-8" />
<meta name="viewport" content="width=device-width,initial-scale=1" />
<meta name="color-scheme" content="light dark" />
<title>Revisar alterações de agenda · NeuroNex</title>
<style>
:root{font-family:Inter,ui-sans-serif,system-ui,-apple-system,BlinkMacSystemFont,"Segoe UI",sans-serif;color:#171717;background:#f6f7f8}*{box-sizing:border-box}body{margin:0;min-height:100vh;background:radial-gradient(circle at 50% 0,#fff 0,#f3f5f6 46%,#edf0f2 100%);color:#171717}.wrap{width:min(760px,calc(100% - 28px));margin:0 auto;padding:48px 0 64px}.shell{border:1px solid rgba(15,23,42,.09);background:rgba(255,255,255,.84);backdrop-filter:blur(22px);border-radius:30px;box-shadow:0 26px 80px rgba(15,23,42,.11);padding:26px}.eyebrow{font-size:11px;letter-spacing:.14em;text-transform:uppercase;font-weight:800;color:#68717d}.title{font-size:clamp(28px,5vw,42px);line-height:1.02;letter-spacing:-.04em;margin:8px 0 10px}.muted{color:#68717d;line-height:1.55}.cards{display:grid;gap:14px;margin-top:24px}.card{border:1px solid rgba(15,23,42,.09);border-radius:22px;padding:18px;background:rgba(255,255,255,.72)}.times{display:grid;grid-template-columns:1fr auto 1fr;gap:10px;align-items:center}.time{font-weight:800;line-height:1.35}.arrow{color:#8a949f}.choice{margin-top:16px;display:grid;gap:8px}.choice label{display:flex;gap:10px;align-items:flex-start;padding:11px 12px;border:1px solid rgba(15,23,42,.08);border-radius:14px;cursor:pointer}.alternative{margin:8px 0 0 30px;width:calc(100% - 30px);padding:10px;border-radius:12px;border:1px solid rgba(15,23,42,.14);background:#fff;color:#171717}.footer{margin-top:22px;display:flex;gap:10px;align-items:center;justify-content:space-between}.button{border:0;border-radius:999px;padding:13px 20px;font-weight:800;cursor:pointer;background:#111;color:#fff}.button:disabled{opacity:.5;cursor:not-allowed}.status{font-size:13px;font-weight:700;color:#68717d}.error{margin-top:16px;padding:12px 14px;border-radius:14px;background:#fff1f2;color:#9f1239;border:1px solid #fecdd3}.success{padding:28px 0;text-align:center}.shield{margin-top:18px;font-size:11px;color:#7d8791;text-align:center}.comment{width:100%;margin-top:18px;padding:12px 14px;border-radius:14px;border:1px solid rgba(15,23,42,.12);min-height:80px;resize:vertical;background:#fff;color:#171717}@media(max-width:560px){.wrap{padding-top:22px}.shell{padding:18px;border-radius:24px}.times{grid-template-columns:1fr}.arrow{transform:rotate(90deg);justify-self:center}.footer{align-items:stretch;flex-direction:column}.button{width:100%}}@media(prefers-color-scheme:dark){:root{background:#090b0e;color:#f5f5f5}body{background:radial-gradient(circle at 50% 0,#171a20 0,#0e1115 52%,#090b0e 100%);color:#f5f5f5}.shell,.card{background:rgba(19,22,27,.82);border-color:rgba(255,255,255,.08)}.muted,.status,.eyebrow,.shield{color:#a7afb8}.alternative,.comment{background:#101318;color:#f5f5f5;border-color:rgba(255,255,255,.12)}.choice label{border-color:rgba(255,255,255,.09)}.button{background:#f5f5f5;color:#111}}
</style>
</head>
<body>
<main class="wrap"><section class="shell"><div id="app"><div class="eyebrow">Agenda segura</div><h1 class="title">Carregando sua revisão…</h1><p class="muted">Consultando as alterações propostas.</p></div></section></main>
<script>
const TOKEN=${JSON.stringify(token)};
const app=document.getElementById('app');
const endpoint=location.origin+location.pathname;
const fmt=(value)=>{const d=new Date(value);return Number.isFinite(d.getTime())?new Intl.DateTimeFormat('pt-BR',{dateStyle:'medium',timeStyle:'short',timeZone:'America/Sao_Paulo'}).format(d):'Horário a confirmar'};
const escapeText=(value)=>String(value??'');
async function call(body){const response=await fetch(endpoint,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(body)});const data=await response.json().catch(()=>({}));if(!response.ok||data.ok===false)throw new Error(data.error||'Não foi possível concluir agora.');return data;}
function renderError(message){app.innerHTML='';const e=document.createElement('div');e.className='error';e.textContent=message;app.appendChild(e);}
function optionLabel(value){return fmt(value.startTime)+' – '+fmt(value.endTime).split(' ')[3]||fmt(value.endTime)}
function render(batch){app.innerHTML='';const eyebrow=document.createElement('div');eyebrow.className='eyebrow';eyebrow.textContent='Agenda segura';app.appendChild(eyebrow);const h=document.createElement('h1');h.className='title';h.textContent='Revise as alterações';app.appendChild(h);const p=document.createElement('p');p.className='muted';p.textContent=(batch.professional?.name||'Seu profissional')+' propôs novos horários. Nenhuma alteração adicional acontece ao abrir esta página.';app.appendChild(p);const cards=document.createElement('div');cards.className='cards';const items=Array.isArray(batch.items)?batch.items:[];items.forEach((item,index)=>{const card=document.createElement('article');card.className='card';const times=document.createElement('div');times.className='times';const oldTime=document.createElement('div');oldTime.className='time';oldTime.textContent=fmt(item.originalStartTime);const arrow=document.createElement('div');arrow.className='arrow';arrow.textContent='→';const newTime=document.createElement('div');newTime.className='time';newTime.textContent=fmt(item.proposedStartTime);times.append(oldTime,arrow,newTime);card.appendChild(times);if(item.status==='pending'){const choices=document.createElement('div');choices.className='choice';[['accept','Aceitar novo horário'],['reject','Manter horário anterior'],['request_change','Pedir outro horário']].forEach(([value,labelText])=>{const label=document.createElement('label');const radio=document.createElement('input');radio.type='radio';radio.name='decision-'+item.id;radio.value=value;radio.checked=value==='accept';const span=document.createElement('span');span.textContent=labelText;label.append(radio,span);choices.appendChild(label)});card.appendChild(choices);const select=document.createElement('select');select.className='alternative';select.dataset.itemId=item.id;const opts=Array.isArray(item.availableOptions)?item.availableOptions:[];const placeholder=document.createElement('option');placeholder.value='';placeholder.textContent='Escolha um horário alternativo';select.appendChild(placeholder);opts.forEach((option)=>{const opt=document.createElement('option');opt.value=option.startTime;opt.textContent=fmt(option.startTime);select.appendChild(opt)});select.hidden=true;card.appendChild(select);choices.addEventListener('change',(ev)=>{const target=ev.target;if(target&&target.value==='request_change')select.hidden=false;else select.hidden=true})}else{const status=document.createElement('p');status.className='status';status.textContent='Resposta já registrada: '+escapeText(item.status);card.appendChild(status)}cards.appendChild(card)});app.appendChild(cards);if(batch.status==='completed'){const done=document.createElement('div');done.className='success';done.textContent='Esta revisão já foi concluída.';app.appendChild(done);return}const comment=document.createElement('textarea');comment.className='comment';comment.maxLength=1000;comment.placeholder='Comentário opcional para o profissional';app.appendChild(comment);const footer=document.createElement('div');footer.className='footer';const status=document.createElement('div');status.className='status';status.textContent='Revise antes de confirmar.';const button=document.createElement('button');button.className='button';button.type='button';button.textContent='Confirmar respostas';button.onclick=async()=>{const decisions=[];for(const item of items.filter(i=>i.status==='pending')){const selected=document.querySelector('input[name="decision-'+item.id+'"]:checked');if(!selected){renderError('Escolha uma resposta para cada horário.');return}const decision=selected.value;const payload={itemId:item.id,decision};if(decision==='request_change'){const select=document.querySelector('select[data-item-id="'+item.id+'"]');if(!select||!select.value){renderError('Escolha um horário alternativo para cada pedido de mudança.');return}payload.requestedStartTime=select.value}decisions.push(payload)}if(!decisions.length){renderError('Não há itens pendentes para responder.');return}button.disabled=true;status.textContent='Registrando…';try{await call({action:'respond',token:TOKEN,decisions,comment:comment.value});app.innerHTML='<div class="success"><div class="eyebrow">Resposta registrada</div><h1 class="title">Tudo certo</h1><p class="muted">Seu profissional recebeu sua resposta. Você pode fechar esta página.</p></div>'}catch(error){button.disabled=false;status.textContent='Tente novamente.';const e=document.createElement('div');e.className='error';e.textContent=error.message||'Não foi possível registrar agora.';app.insertBefore(e,footer)}};footer.append(status,button);app.appendChild(footer);const shield=document.createElement('div');shield.className='shield';shield.textContent='Link individual, temporário e protegido';app.appendChild(shield)}
(async()=>{try{const data=await call({action:'get',token:TOKEN});if(!data.found){renderError('Este link não está mais disponível.');return}render(data.batch)}catch(error){renderError(error.message||'Não foi possível carregar esta revisão.')}})();
</script>
</body></html>`;

serve(async (request) => {
  if (request.method === "OPTIONS") return new Response(null, { headers });

  if (request.method === "GET") {
    const token = normalizeToken(new URL(request.url).searchParams.get("token"));
    if (!token) return html("<!doctype html><html lang=\"pt-BR\"><meta charset=\"utf-8\"><title>Link inválido</title><body>Este link é inválido ou expirou.</body></html>", 400);
    return html(reviewPage(token));
  }

  if (request.method !== "POST") return json({ error: "Method not allowed" }, 405);

  try {
    const body = await request.json().catch(() => ({}));
    const action = clean(body.action, 40) || "get";
    const token = normalizeToken(body.token);
    if (!token) return json({ ok: false, error_code: "invalid_token", error: "Este link é inválido ou expirou." }, 400);
    const tokenHash = await appointmentTokenHash(token);
    const db = appointmentAdminClient();

    if (action === "get") {
      const result = await db.rpc("get_appointment_change_batch_by_token", {
        p_token_hash: tokenHash,
      });
      if (result.error) throw result.error;
      if (!result.data) return json({ ok: true, found: false });
      return json({ ok: true, found: true, batch: result.data });
    }

    if (action === "respond") {
      const decisions = normalizeDecisions(body.decisions);
      if (!decisions) {
        return json({ ok: false, error_code: "invalid_decisions", error: "Revise as respostas antes de confirmar." }, 400);
      }
      const comment = clean(body.comment, 1000) || null;
      const result = await db.rpc("process_appointment_change_batch_response", {
        p_token_hash: tokenHash,
        p_decisions: decisions,
        p_comment: comment,
      });
      if (result.error) {
        const message = clean(result.error.message, 1200).toLowerCase();
        if (/expired|invalid|no longer|window/.test(message)) {
          return json({ ok: false, error_code: "response_expired", error: "Este link não está mais disponível para resposta." }, 409);
        }
        if (/requested time|no longer available/.test(message)) {
          return json({ ok: false, error_code: "slot_unavailable", error: "O horário escolhido não está mais disponível. Reabra a revisão para escolher outro." }, 409);
        }
        throw result.error;
      }
      return json({ ok: true, result: result.data });
    }

    return json({ ok: false, error_code: "invalid_action", error: "Ação inválida." }, 400);
  } catch (error) {
    console.error("[agenda-change-response]", clean(error instanceof Error ? error.message : error, 1200));
    return json({ ok: false, error_code: "agenda_response_failed", error: "Não foi possível processar esta revisão agora." }, 500);
  }
});
