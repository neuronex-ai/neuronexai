# Ciclo de Vida do Portal do Paciente

Este documento define a arquitetura-alvo do Portal do Paciente da NeuroNex. A rodada atual implementa apenas correções P0 de autenticação, ativação e recuperação de senha; as regras estruturais abaixo orientam evolução do produto, suporte e compliance.

## Princípio Central

O paciente deve ter uma conta global própria, independente do cadastro administrativo mantido por cada profissional. O vínculo paciente-profissional libera a experiência compartilhada com um consultório específico, mas não deve ser tratado como a identidade principal do paciente.

Modelo recomendado:

- Conta global do paciente: pertence ao paciente e guarda autenticação, dados pessoais mínimos, preferências e consentimentos.
- Vínculo paciente-profissional: representa a autorização de acesso entre uma conta global de paciente e um consultório/profissional.
- Registro clínico profissional: pertence ao profissional ou clínica dentro da relação terapêutica e segue regras clínicas, éticas, contratuais e legais próprias.
- Dados compartilhados: ficam disponíveis ao paciente quando foram explicitamente compartilhados pelo profissional ou criados pelo próprio paciente no portal.

## Fluxo P0 Implementado

Fluxo lógico esperado:

1. Profissional envia convite.
2. Paciente acessa `/portal/convite/:token`.
3. O token é capturado em `sessionStorage` e removido da URL.
4. Paciente escolhe entre criar acesso ou entrar em conta existente.
5. Paciente informa o código de ativação.
6. A Edge Function valida sessão, token, código, e-mail, expiração, tentativas e titularidade do vínculo.
7. Paciente entra em `/portal`.

O frontend não deve enviar paciente não autenticado para o dashboard profissional nem depender apenas de `/auth?role=patient`.

## Conta Global do Paciente

A conta global é criada no Supabase Auth com `app_metadata.account_role = "patient"`. Ela não deve criar perfil profissional em `profiles`, não deve receber permissões de psicólogo e não deve acessar rotas profissionais.

Dados mínimos da conta global:

- e-mail autenticado;
- telefone, quando necessário;
- nome exibido ao próprio paciente;
- preferências de comunicação;
- consentimentos e aceites;
- vínculos ativos, suspensos, encerrados ou revogados.

## Vínculo Paciente-Profissional

O vínculo deve ser uma entidade de permissão, não uma duplicação da identidade do paciente.

Estados recomendados:

- `pending`: convite emitido e ainda não ativado.
- `active`: vínculo ativo e portal liberado.
- `grace`: acesso temporário preservado durante atraso curto do profissional.
- `continuity`: modo de continuidade assistencial com acesso reduzido.
- `suspended`: vínculo suspenso por regra comercial, segurança ou decisão administrativa.
- `revoked`: acesso revogado pelo profissional ou pela plataforma.
- `transferred`: vínculo transferido para outro profissional, quando aplicável.
- `closed`: relação encerrada sem exclusão automática da conta global.

## Dados Pessoais

Dados pessoais do paciente não devem ser apagados automaticamente quando o profissional exclui o cadastro administrativo do paciente. A exclusão no módulo profissional deve ser tratada como remoção ou arquivamento do registro daquele consultório, preservando a conta global enquanto houver obrigação legal, consentimento válido, vínculo ativo com outro profissional ou solicitação LGPD em processamento.

## Dados Compartilhados

Dados compartilhados são aqueles que o profissional decidiu expor ao paciente ou que o próprio paciente registrou no portal, por exemplo:

- agenda visível;
- cobranças e comprovantes;
- documentos compartilhados;
- tarefas e metas;
- diário ou notas pessoais do paciente;
- progresso calculado para visualização do paciente.

Notas clínicas internas, rascunhos, hipóteses clínicas, transcrições não revisadas e materiais não compartilhados não devem aparecer no portal.

## Registro Clínico Profissional

O prontuário profissional permanece sob responsabilidade do profissional ou clínica. A conta do paciente não deve ter acesso direto ao prontuário inteiro. O portal deve acessar apenas projeções seguras e compartilhadas.

Regra de produto:

- Excluir paciente no painel profissional não deve excluir a conta global do paciente.
- Encerrar vínculo deve bloquear novas interações compartilhadas, mas preservar trilha de auditoria.
- Documentos e registros clínicos devem seguir retenção legal e regras LGPD.

## Downgrade de Plano

O portal não deve funcionar como um interruptor binário que apaga vínculos quando o profissional muda de plano. A regra recomendada é preservar continuidade e limitar novas ações comerciais.

Para downgrade voluntário:

- manter contas de pacientes já ativadas em modo continuidade por período definido;
- bloquear novos convites acima do limite do plano;
- permitir acesso do paciente a histórico essencial e dados próprios;
- restringir recursos premium, como novos documentos compartilhados, automações e recursos avançados;
- exibir aviso claro ao profissional antes do downgrade.

Regra sugerida para plano Essencial:

- permitir Portal do Paciente como produto base;
- limitar quantidade de vínculos ativos ou convites novos;
- não remover automaticamente vínculos existentes sem política explícita e aviso prévio.

## Inadimplência

Inadimplência deve ter fases, não corte imediato:

1. `active`: assinatura regular.
2. `grace`: atraso curto; paciente e profissional continuam acessando recursos essenciais.
3. `restricted`: bloqueio de novos convites e recursos premium; pacientes mantêm acesso ao histórico essencial.
4. `continuity`: acesso mínimo de continuidade assistencial e exportação.
5. `suspended`: suspensão operacional após prazo e comunicações adequadas.

O atraso do profissional não deve causar perda silenciosa de dados do paciente.

## Grace Period

O período de carência deve ser documentado por plano e comunicado ao profissional. Durante o grace period:

- vínculos ativos continuam carregando;
- novos convites podem ser bloqueados;
- criação de cobranças ou recursos premium pode ser limitada;
- pacientes não devem receber erro genérico.

## Modo Continuidade

Modo continuidade é o estado mínimo para evitar prejuízo assistencial e reputacional.

Disponível ao paciente:

- perfil;
- agenda passada e próxima quando já compartilhada;
- documentos já compartilhados;
- cobranças e comprovantes existentes;
- exportação dos próprios dados, quando implementada;
- mensagens de estado claras.

Bloqueado ou limitado:

- novos convites;
- novas automações;
- novos compartilhamentos;
- recursos premium do profissional.

## Encerramento de Vínculo

Encerramento deve ser diferente de exclusão.

Quando profissional encerra o vínculo:

- paciente mantém a conta global;
- paciente perde acesso a novas informações daquele consultório;
- histórico compartilhado pode permanecer acessível conforme política e consentimento;
- trilha de auditoria deve registrar quem encerrou, quando e motivo operacional;
- exclusão definitiva deve seguir fluxo LGPD separado.

## Troca de Psicólogo

O paciente deve poder ter novo vínculo com outro profissional sem perder a conta global. A troca não deve transferir automaticamente prontuário clínico do profissional anterior.

Fluxo recomendado:

1. Novo profissional emite convite.
2. Paciente entra com a mesma conta global.
3. Paciente ativa novo vínculo com código próprio.
4. O portal passa a exibir seletor de consultório quando houver múltiplos vínculos.
5. Dados clínicos do profissional anterior permanecem sob governança do profissional anterior.
6. Dados pessoais e dados criados pelo paciente continuam na conta global.

Transferência de prontuário entre profissionais deve exigir autorização explícita, base legal e trilha de auditoria.

## Múltiplos Psicólogos

O modelo deve permitir múltiplos vínculos simultâneos quando houver justificativa prática:

- psicólogo individual;
- clínica;
- supervisão;
- atendimento multidisciplinar;
- troca gradual de profissional.

O portal deve separar contexto por profissional ou clínica, evitando mistura de agenda, documentos, cobranças e tarefas.

## Exclusão LGPD

Pedidos LGPD devem ser tratados por tipo de dado:

- conta global do paciente;
- dados pessoais cadastrais;
- dados gerados pelo paciente;
- vínculo com profissional;
- documentos compartilhados;
- registros financeiros;
- registros clínicos profissionais;
- logs e auditoria.

Nem todo dado pode ser apagado imediatamente. Retenções legais, defesa de direitos, obrigações fiscais e registros clínicos podem justificar preservação controlada.

O fluxo de exclusão deve:

- registrar solicitação;
- validar identidade;
- classificar dados;
- executar anonimização/exclusão quando aplicável;
- registrar evidência sem expor conteúdo clínico;
- comunicar conclusão ou justificativa de retenção.

## Menores e Responsáveis

Para menores de idade, o portal deve prever responsável legal.

Regras recomendadas:

- identificar paciente menor;
- registrar responsável;
- registrar base de consentimento;
- limitar alteração de dados sensíveis;
- permitir auditoria de quem acessou;
- separar conta do responsável da conta do paciente quando necessário;
- revisar acesso quando o paciente atingir maioridade.

## Modelo de Negócio Recomendado

O Portal do Paciente deve ser tratado como camada de relacionamento e continuidade, não apenas como benefício premium frágil.

Recomendação:

- Plano Essencial: portal base com limite de vínculos ativos ou convites novos.
- Plano Profissional: limite ampliado, automações, documentos, jornada completa e recursos avançados.
- Plano Enterprise: limites customizados, múltiplos profissionais, governança de clínica e relatórios.

Ao reduzir plano:

- não remover vínculos existentes automaticamente;
- bloquear expansão acima do limite;
- manter continuidade assistencial;
- oferecer ajuste comercial claro ao profissional.

Essa abordagem reduz risco jurídico, suporte traumático, perda de confiança do paciente e incentiva upgrade por capacidade, não por ameaça de perda de dados.

## Próximas Evoluções

Prioridade alta:

- separar identidade global do paciente de `patients` do consultório;
- adicionar estado `grace` e `continuity` em vínculos;
- criar seletor de consultório para múltiplos vínculos;
- formalizar política LGPD de exclusão e exportação;
- criar auditoria de troca de profissional;
- documentar limites por plano e comunicações de downgrade.

Prioridade média:

- criar tela de gestão de vínculos para o paciente;
- permitir exportação de dados próprios;
- criar fluxo de responsável legal;
- parametrizar grace period por plano.

Fora de escopo desta rodada:

- migração estrutural de banco;
- reescrita completa do prontuário;
- transferência automática de prontuário entre profissionais;
- novo produto comunitário separado.
