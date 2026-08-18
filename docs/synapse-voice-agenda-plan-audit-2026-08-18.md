# Synapse Voice + Agenda — reauditoria do plano (2026-08-18)

Este documento compara o plano de entrega do Synapse de Voz/Agenda com o estado observado no repositório `main`, no branch de correção do microfone e no Sandbox Supabase `krewdaklcyzqfxkkgvqr`.

## Convenção

- **OK** — implementado e conectado ao runtime testado.
- **PARCIAL** — existe código/schema, mas falta integração, política ou teste.
- **AUSENTE** — não foi encontrado no caminho de execução atual.
- **DRIFT** — existe no Sandbox, mas não está representado no `main` do Git.

## Achados prioritários

| Área | Estado | Evidência / impacto |
|---|---|---|
| Gateway canônico Supabase Edge | OK | O Desktop local usa proxy para `synapse-voice-gateway` Edge; sessões chegam a `SettingsApplied`. |
| ElevenLabs multilingual | OK | Runtime usa ElevenLabs + `eleven_turbo_v2_5` + `provider.language = "multi"`; normalização legacy permanece no gateway. |
| Seleção de voz | PARCIAL | Resolver valida a voz contra `/v2/voices`, porém o ranking atual cai em `Roger - Laid-Back, Casual, Resonant`, inadequado à persona do Synapse. |
| Captura de microfone | OK/diagnóstico | `AudioContext` é retomado, PCM de 80 ms é enviado e o proxy mede RMS/peak. O silêncio observado em 18/08 foi reproduzido com o microfone do dispositivo mutado. |
| `review_action` no Edge | PARCIAL | O Edge já emite `review_action` para algumas ações, mas `use-deepgram-agent-voice` não consome esse evento; a UI nunca recebe os mini-cards. |
| Desafio numérico opaco | PARCIAL/QUEBRADO | O Edge pede `synapse_confirmation_challenge`, mas o Desktop não possui handler/UI específica. Por isso o modelo diz “Repita o número...” sem número aparecer. |
| Segurança do número | AUSENTE | Não há hoje geração/validação browser-only implementada no fluxo ativo. Deve ser adicionada sem enviar o número ao gateway/modelo/logs/callback. |
| Capability negotiation | AUSENTE | Não há handshake `review_action:v1` / `opaque_confirmation:v1` / `screen_context:v1` no fluxo ativo. |
| Timeline/grupo persistido | PARCIAL/DRIFT | `public.synapse_composite_action_plans` existe no Sandbox, mas está vazio e nenhuma função pública referencia a tabela. O `main` não contém a migração `20260817205901_synapse_composite_action_plans`. |
| Planner real de 5+ etapas | AUSENTE | Não há executor que prepare/versione/confirme/execute `SynapseActionGroupPlan`; pedidos compostos ainda dependem de chamadas isoladas. |
| Agenda action plans canônicos | OK no schema/RPC | Sandbox possui `appointment_action_plans`, eventos e RPCs `prepare/execute/cancel/get_*_appointment_action_plan`, além de RPCs Agenda v2. O executor de voz ainda precisa ser auditado para garantir uso exclusivo desses contratos. |
| Outbox de comunicação | OK no schema | `appointment_communication_outbox` e outboxes de waitlist/financeiro existem. Falta confirmar que todo efeito externo do fluxo de voz usa esses caminhos e retorna warnings sem reverter sucesso principal. |
| Teleconsulta | DRIFT corrigido no Sandbox | `teleconsultation_invites`, `teleconsultation_sessions` e `teleconsultation_participants` existem atualmente. A migração de reparo `20260817203848_repair_teleconsultation_invite_prerequisites` está aplicada no Sandbox, mas não está no `main`. |
| Resultado `completed_with_warnings` | PARCIAL | Agenda possui infraestrutura de plano/outbox, mas o contrato composto e a resposta falada por etapa ainda não estão consolidados. |
| Idempotência | PARCIAL | `appointment_action_plans` e outboxes têm `idempotency_key`; o plano composto ainda não está integrado ao runtime e precisa de chave por conversa/comando/plano. |
| Contexto completo da Agenda | PARCIAL | Existem muitos RPCs de Agenda v2, waitlist e planos; falta um `AgendaActionContext` único e auditável no preflight de voz. |
| Entitlement por e-mail | A AUDITAR/CORRIGIR | O plano proíbe bypass por e-mail. A próxima etapa deve remover qualquer exceção de `jotahub@gmail.com` e testar a matriz gratuito/teste/Professional/vitalício. |
| Normalizador pt-BR consolidado | AUSENTE/PARCIAL | Há normalização dispersa; o contrato único `normalizePtBrSpeech(text,{now,timezone})` ainda não está consolidado no TTS de produção. |
| `InjectUserMessage` de diagnóstico | CORREÇÃO PENDENTE | O gateway usa o campo legado `message`; deve usar o campo atual `content` para permitir probe LLM+TTS sem depender do STT. |
| Mini-cards horizontais | AUSENTE no runtime ativo | Não existe overlay genérico conectado ao `review_action`. `AppointmentPlanReviewDialog` é específico de Agenda e não substitui o action-group review. |
| Edição por voz + hash/version | AUSENTE | A revisão atual do Edge não possui protocolo de edição/versionamento do plano composto. |

## Drift de schema observado

O Sandbox possui migrações mais novas do que o `main`, entre elas:

- `20260817203848_repair_teleconsultation_invite_prerequisites`
- `20260817205901_synapse_composite_action_plans`

Antes de qualquer nova alteração de schema, essas migrações precisam ser recuperadas para o Git ou substituídas por migração aditiva equivalente, sem `db push` indiscriminado.

## Sequência de implementação

### PR A — fechar o circuito de revisão/confirmação e voz

1. Consumir `review_action` no cliente e renderizar mini-cards horizontais.
2. Implementar desafio opaco gerado/validado somente no navegador, com voz local e fallback por clique.
3. Negociar capabilities e bloquear ação crítica quando frontend/gateway não tiverem paridade.
4. Corrigir `InjectUserMessage` para probe textual independente de STT.
5. Melhorar ranking da voz ElevenLabs acessível, mantendo Turbo 2.5 + multilingual.
6. Telemetria sem número do desafio e testes do protocolo.

### PR B — planner persistido de grupos

1. Recuperar/normalizar a migração `synapse_composite_action_plans` no Git.
2. Criar contratos públicos `SynapseActionGroupPlan`, `ExecuteActionGroupResult` e eventos de telemetria.
3. Implementar prepare/edit/confirm/execute com versão/hash/idempotência.
4. Política 4 vs 5 etapas e critical/NeuroFinance.
5. Ligar revisão genérica ao plano persistido; edição por clique/voz atualiza versão/hash.

### PR C — AgendaActionContext e confiabilidade de execução

1. Auditar voz/tool executor contra os RPCs canônicos de Agenda.
2. Remover bypass por e-mail.
3. Consolidar entitlement, Google/Gmail, NeuroFinance, CPF, pacotes, defaults, políticas e disponibilidade no preflight.
4. Garantir `completed_with_warnings` para efeitos externos e reconciliação após falha ambígua.
5. Corrigir navegação final usando IDs efetivamente confirmados.

### PR D — acabamento de voz/UI e matriz de testes

1. Consolidar normalização pt-BR no TTS.
2. Testar datas relativas, horários, moedas, unidades e conteúdo sensível.
3. E2E dos fluxos compostos, Agenda, confirmação, waitlist, recorrência, Google, financeiro e acessibilidade.
4. Rollout Sandbox por capability flag; produção apenas após aceite explícito.

## Critério para não mascarar falhas

Uma interface visual nunca deve anunciar suporte que o executor não possui. Enquanto edição/versionamento do action-group não estiver conectado, cards serão apresentados como revisão segura e qualquer execução crítica será bloqueada se a capability opaca não estiver disponível. Campos editáveis só serão habilitados quando sua alteração puder atualizar a versão/hash do plano executável.