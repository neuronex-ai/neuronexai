# Roadmap funcional NeuroNex

Atualizado em: 2026-07-16

Este documento consolida as superfícies, abas, sub-abas e funcionalidades da NeuroNex a partir da estrutura atual do produto. Ele serve como mapa de produto e roteiro de evolução, mantendo separadas as quatro superfícies oficiais: Public, Professional desktop, Professional mobile e Patient portal.

## Legenda de status

- **Ativo:** rota, aba ou fluxo presente no produto atual.
- **Transicional:** existe hoje, mas ainda não representa a arquitetura final da superfície.
- **Beta:** funcionalidade planejada ou parcialmente implementada, ainda fora da navegação principal.
- **Em breve:** aparece como intenção, bloqueio ou placeholder de produto.
- **Legado:** rota ou visão preservada por compatibilidade e redirecionada para uma visão ativa.
- **Roadmap:** item recomendado para completar a experiência.

## 1. Fronteiras de superfície

| Superfície | Escopo | Rotas principais | Direção |
| --- | --- | --- | --- |
| Public | Landing, ajuda, contato, legal, autenticação e fluxos abertos por links externos. | `/`, `/auth`, `/create-account`, `/ajuda`, `/contato`, `/documentos-legais`, `/termos-de-uso`, `/politica-de-privacidade`, `/configuracoes-de-cookies`, landings de produto e fluxos externos. | Manter como superfície pública, sem importar interfaces profissionais. |
| Professional desktop/tablet | Produto principal para psicólogos em desktop e tablet. | `/dashboard`, `/agenda`, `/pacientes`, `/pacientes/:id`, `/teleconsulta`, `/notas`, `/financeiro/*`, `/synapse-ai`, `/ajustes`, `/neurozap`. | Consolidar fluxos completos, densos e operacionais. |
| Professional mobile | Produto profissional abaixo de 768px. | Hoje selecionado por adaptadores e código transicional em `src/mobile`; evolução em `src/apps/professional-mobile`. | Reconstruir mobile-first sem copiar telas desktop nem importar páginas desktop. |
| Patient portal | Aplicação do paciente, independente do produto profissional. | `/portal`, `/portal/sessoes`, `/portal/humor`, `/portal/documentos`, `/portal/progresso`, `/portal/financeiro`, `/portal/perfil`, `/portal/convite`, `/portal/ativar`. | Evoluir como experiência própria do paciente. |

## 2. Navegação global

### Professional desktop/tablet

| Aba global | Rota | Funcionalidades globais associadas |
| --- | --- | --- |
| Painel | `/dashboard` | Centro de comando, atalhos rápidos, agenda do dia, visão financeira e fila de atenção. |
| Agenda | `/agenda` | Calendário clínico, eventos, recorrência, confirmação, políticas e integração Google. |
| Teleconsulta | `/teleconsulta` | Lobby, sessões online, workspace clínico e revisão pós-sessão. |
| Pacientes | `/pacientes` | Diretório, cadastro, prontuário, planos, documentos e financeiro por paciente. |
| Notas | `/notas` | Notas, tarefas, NeuroDrive, Notion, NeuroView, NeuroFlow e NeuroPulse. |
| Financeiro | `/financeiro` | Gestão financeira e NeuroFinance bancário. |
| Synapse AI | `/synapse-ai` e shell global | Chat, voz, ações assistidas, navegação e automações com confirmação. |
| Ajustes | `/ajustes` | Conta, segurança, assinatura, preferências, integrações, fiscal e privacidade. |
| NeuroZap | `/neurozap` | Desktop Beta planejado para WhatsApp/atendimento. Fora da navbar principal. |

Funcionalidades transversais da navegação: busca global, notificações, alternância de tema/interface, menu de avatar, suporte e logout.

### Professional mobile atual

| Área | Navegação atual | Status |
| --- | --- | --- |
| Barra inferior | Início, Agenda, Synapse central, Financeiro e Menu. | Transicional |
| Menu principal | Painel, Agenda, Pacientes, Teleconsulta, Notas, Financeiro, Synapse AI, Integrações e Ajustes. | Transicional |
| Menu público móvel | Início, Preços e Contato. | Transicional, precisa reconciliar rota de preços com a superfície Public. |

## 3. Professional desktop/tablet

### 3.1 Painel

| Subárea | Funcionalidades | Status |
| --- | --- | --- |
| Atalhos de ação | Novo agendamento, novo paciente e Synapse por voz. | Ativo |
| Morning Command Panel | Saudação, data, próxima sessão, volume da semana, pendências e chamada para ação. | Ativo |
| Agenda Panel | Segmentos **Hoje** e **7 dias**, lista de sessões, estado vazio e abertura da Agenda. | Ativo |
| Financial Overview Panel | Segmentos **Gestão** e **NeuroFinance**; resumo do mês, a receber, a pagar, fluxo de caixa, saldo, entradas, saídas e meta financeira. | Ativo |
| Pending Work Panel | Filtros **Todas**, **Sessões**, **Agenda**, **Cadastros**, **NeuroFinance** e **Sistema**; paginação e ações contextuais. | Ativo |
| Reflexões | Carrossel de mensagens e reforços de rotina. | Ativo |

Roadmap do Painel:

- Unificar a fila de atenção com eventos de Agenda, Pacientes, Financeiro, Synapse e Portal.
- Tornar cada card acionável com navegação profunda e contexto preservado.
- Ampliar métricas por período com comparação mensal e metas configuráveis.

### 3.2 Agenda

| Aba/sub-aba | Funcionalidades | Status |
| --- | --- | --- |
| Visualização Dia | Agenda diária, sessões, eventos, horários, ações de abrir detalhe e criar novo. | Ativo |
| Visualização Semana | Grade semanal, navegação por semana e sessões por período. | Ativo |
| Visualização Mês | Grade mensal, seleção de dia e visão consolidada. | Ativo |
| Sidebar | Calendário lateral, métricas de presença e não pontuados, busca por paciente, filtros **Online**, **Presencial** e **Primeira Vez**. | Ativo |
| Integração Google | Badge/conexão com Google Calendar e acesso a integrações. | Ativo |
| Arrastar e soltar | Suporte visual para movimentar compromissos. | Ativo |

Fluxo **Novo agendamento**:

| Etapa | Funcionalidades | Status |
| --- | --- | --- |
| Tipo | Escolha entre **Sessão clínica** e **Evento geral**. | Ativo |
| Categorias de evento | Reunião, Supervisão, Particular, Bloqueio de Agenda, Formação/Curso, Administrativo e Outro. | Ativo |
| Dados da sessão | Paciente, data, horário, duração, tipo de sessão, modalidade, local e observações. | Ativo |
| Recorrência | Semanal, quinzenal ou mensal, contagem de ocorrências e prévia de conflitos. | Ativo |
| Financeiro | Detecção de pacote ativo, reserva ou débito de sessão, criação de lançamento manual, valor, parcelas e métodos Pix, Dinheiro e Cartão. | Ativo |
| Resultado | Criação de série, compromissos e reservas de pacote na mesma operação. Cobranças, e-mails e NFS-e não são gerados automaticamente neste fluxo. | Ativo |

Fluxo **Detalhe do agendamento**:

| Sub-aba | Funcionalidades | Status |
| --- | --- | --- |
| Detalhes | Paciente ou compromisso, data, horário, status, modalidade, local, pacote, cobrança, notas e metadados de recorrência. | Ativo |
| Histórico | Eventos de ciclo de vida, alterações, confirmações, cancelamentos e ações do paciente/profissional. | Ativo |
| Ações | Lembrete WhatsApp, convite por e-mail, salvar, descartar, cancelar, arquivar/remover da agenda e abrir prontuário. | Ativo |

Configurações da Agenda:

- Horários de trabalho por dia da semana.
- Política versionada de cancelamento, remarcação, reação do paciente, SLA do profissional, consequências, crédito de pacote, cobrança, fiscal e fuso horário.
- Preservação da política em convites já emitidos.

Roadmap da Agenda:

- Completar experiência de conflitos recorrentes com resolução assistida.
- Integrar confirmação de paciente, política, pacote e financeiro em uma linha do tempo única.
- Padronizar comunicação multicanal com auditoria e reenvio.

### 3.3 Pacientes

| Aba/sub-aba | Funcionalidades | Status |
| --- | --- | --- |
| Lista de pacientes | Busca por nome/e-mail, contagem, cards de paciente, status ativo/pendente, diagnóstico, próxima sessão e exclusão. | Ativo |
| Limite Essential | Bloqueio/upsell ao atingir limite de pacientes do plano. | Ativo |
| Exclusão | Diálogo de confirmação e opção de exportar dados antes de excluir. | Ativo |
| Novo paciente - informações pessoais | Dados pessoais, telefone, CPF, data de nascimento, faixa etária, gênero e formatações. | Ativo |
| Novo paciente - financeiro | Plano por sessão, por mês, convênio ou isento; valores, convênio, carteirinha e vencimento. | Ativo |
| Novo paciente - endereço | CEP, endereço e campos complementares. | Ativo |
| Novo paciente - dados adicionais | Diagnóstico, observações e dados clínicos complementares. | Ativo |
| Novo paciente - responsável | Dados de responsável para crianças, adolescentes ou casos que exigem contato auxiliar. | Ativo |

Prontuário do paciente:

| Aba | Sub-abas/funcionalidades | Status |
| --- | --- | --- |
| Resumo | Indicador de risco, sessões concluídas, próxima sessão, revisões pendentes, arquivos clínicos, metas ativas, plano terapêutico, valores a receber, humor recente e histórico operacional completo. | Ativo |
| Sessões | **Histórico** com resumo clínico, linha do tempo e eventos; **Pendentes** com revisão de resumos gerados por IA. | Ativo |
| Anamneses | Importar, criar por modelo, visualizar, enviar link externo, acompanhar preenchimento em tempo real e anexar documentos do prontuário. | Ativo |
| Humor | Gráfico de tendência, registros paginados e escala de humor. | Ativo |
| Metas | Criar meta, prazo opcional, concluir/reabrir e excluir. | Ativo |
| Planos | Pacotes, sessões usadas/reservadas/disponíveis, alerta de saldo baixo, relatório mensal, novo plano e ciclo de vida do pacote. | Ativo |
| Financeiro | Métricas Balanço/Receitas/Despesas; subvisões **Movimentações**, **Cobranças** e **NFS-e**; edição de lançamentos e emissão de nota. | Ativo |
| Arquivos | Upload, prévia, download, renomear/excluir e links seguros via NeuroDrive/R2. | Ativo |

Funcionalidades laterais do prontuário:

- Status do paciente: ativo, inativo ou arquivado.
- Convite para portal do paciente.
- Botão de documentos oficiais.
- Edição do cadastro.
- Dados de contato, endereço e nascimento.
- Medicamentos e atualização de medicação.

Documentos oficiais:

- Geração de documentos clínicos, atestados, laudos ou pareceres.
- Prévia em template padrão, impressão, download em PDF e envio por e-mail.

Roadmap de Pacientes:

- Consolidar prontuário como fonte única para Agenda, Teleconsulta, Portal e Synapse.
- Padronizar auditoria de edições clínicas e versões de documentos.
- Expandir modelos de anamnese e documentos por especialidade.

### 3.4 Teleconsulta

| Aba/sub-aba | Funcionalidades | Status |
| --- | --- | --- |
| Lobby | Lista de próximas sessões, seleção de sessão ativa e estado de carregamento. | Ativo |
| Pré-entrada | Checagem de mídia, convite do paciente e preparação antes da sala. | Ativo |
| Sessão ativa | Jitsi/JaaS, controles de sessão, encerramento e retorno ao lobby. | Ativo |
| Workspace - Transcrição | Captura/transcrição incremental, consentimento e revisão. | Ativo |
| Workspace - Notas | Rascunho protegido, notas da sessão e geração de prontuário. | Ativo |
| Workspace - Paciente | Recap do paciente, contexto clínico e ações relacionadas. | Ativo |
| Chat e anexos | Chat de sessão, anexos e materiais vinculados. | Ativo |
| Alertas de risco | Sinais clínicos destacados durante o workspace. | Ativo |
| Revisão pós-sessão | Diálogo de revisão e conclusão da sessão. | Ativo |
| Convite externo | `/join/:inviteToken` para entrada segura do paciente. | Ativo |

Roadmap de Teleconsulta:

- Elevar consentimento, transcrição e revisão a um fluxo auditável ponta a ponta.
- Melhorar continuidade entre Teleconsulta, Sessões pendentes e Resumo do paciente.
- Criar modo degradado claro para falhas de mídia, token ou conexão.

### 3.5 Notas, NeuroDrive e NeuroInteligência

| Aba principal | Sub-abas/funcionalidades | Status |
| --- | --- | --- |
| Notas | Lista de notas, busca, criação, exclusão, editor rico, autosave, salvar manual, modo foco, vínculo com paciente, tags e compartilhamentos. | Ativo |
| Tarefas | Visualizações **Kanban**, **Lista** e **Grade**; filtros **Todas**, **Pendentes** e **Concluídas**; criar ação, prazo, contexto, arrastar cards e colunas. | Ativo |
| Notion | Listagem de páginas conectadas e importação para nota. | Ativo |
| Drive/NeuroDrive | Sub-abas **Meus Arquivos** e **Arquivos de Pacientes**; lista/grid, busca, upload, vínculo com paciente, prévia, download, exclusão e renomeação. | Ativo |
| NeuroView | Grafo 2D, NeuroView 3d, escopos all/patient/subgraph, busca, foco em nó, detalhes e análise de conexões. | Ativo |
| NeuroFlow | Cofre de fluxos, canvas/editor, prévia, edição, fluxos gerados ou importados e navegação a partir do Synapse. | Ativo |
| NeuroPulse | Lentes clínicas, texto clínico para diagrama Mermaid, normalização, geração por IA e salvamento como nota. | Ativo |

Editor de notas:

- Negrito, itálico, sublinhado, riscado, alinhamentos, títulos H1/H2/H3, listas, lista de tarefas, destaque, link, citação, bloco de código, subscrito e sobrescrito.
- Comandos de barra para tabela, callout, toggle, vincular nota, equação, data atual, títulos, listas, código, divisor e citação.
- Detecção e prévia de Mermaid.
- Ações para Google Docs, WhatsApp, e-mail e cópia.

NeuroPulse - lentes atuais:

- Psicanálise.
- TCC.
- Sistêmica.
- Humanista.
- Gestalt-Terapia.
- Junguiana.
- Neuropsicologia.

Roadmap de Notas:

- Separar com clareza notas clínicas privadas, notas operacionais e notas compartilháveis.
- Expandir NeuroView/NeuroFlow/NeuroPulse com versionamento, exportação e permissões.
- Resolver integração Google Drive marcada como indisponível e alinhar com NeuroDrive/R2.

### 3.6 Financeiro

O Financeiro possui duas grandes áreas: **Gestão Financeira** e **NeuroFinance**.

#### Gestão Financeira

| Aba | Funcionalidades | Status |
| --- | --- | --- |
| Visão Geral | KPIs de resultado, recebido, despesas pagas e a receber; mês selecionado; regime Caixa/Competência; movimentações recentes; pendências; banner NeuroFinance. | Ativo |
| Lançamentos | Busca, exportação CSV, receitas/despesas, categorias, paciente opcional, situação, método, paginação e baixa manual. | Ativo |
| Cobranças Manuais | Workspace de cobranças gerenciais, filtros por status e tipo, seleção em lote e ações. | Ativo |
| Recebimentos | Valores em aberto, vencidos, calendário, recebíveis e baixa. | Ativo |
| Repasses e Convênio | Visão especializada para cobranças vinculadas a convênio. | Ativo |
| Recorrência | Entradas e saídas periódicas da clínica e pessoais, pausar, reativar ou encerrar. | Ativo |
| Planejamento | Meta de receita, limite de despesas, lucro desejado, notas e salvamento por período. | Ativo |

Rotas legadas da Gestão Financeira:

- **Fluxo de Caixa** redireciona para **Visão Geral**.
- **Receitas**, **Despesas** e **Relatórios** redirecionam para **Lançamentos**.
- **Cobranças vencidas** redireciona para **Recebimentos**.

#### NeuroFinance

| Grupo | Sub-abas | Funcionalidades | Status |
| --- | --- | --- | --- |
| Ativação | Onboarding, verificação, pendência e conta Asaas. | Coleta de dados, KYC, destino de repasse, documentos e bloqueio por plano/teste. | Ativo |
| Conta e Saldo | Conta e Saldo | Saldo, dados da conta, linha do tempo de movimentações, pagamentos agendados e rodapé regulatório. | Ativo |
| Extrato da conta | Realizado, Futuro e pendente, Assinaturas | Filtros por método, origem, Pix recebido e transferências. | Ativo |
| Área Pix | Pagar Pix, Transferir via Pix, Gerar QR Code, Pix recebidos, Minhas chaves, Pagar salários, Limites | Pix copia e cola, consulta de recebedor, chaves, QR Code estático/dinâmico, limites diurno/noturno e lote salarial. | Ativo |
| Transferências/Saques | Sacar fundos, Contas e Chaves, Repasses | Saque para conta bancária ou Pix cadastrado, consulta de destino, confirmação com PIN e histórico. | Ativo |
| Pagamentos | Pagar boletos, Agendados, Agendar pagamento, Grupos de pagamento | Linha digitável, imagem/PDF, agendamento, calendário, status e lotes. | Ativo |
| Cobranças bancárias | Todas as cobranças, Regras automáticas, Simulador de vendas, Contestações | Cobranças Asaas, filtros, simulação, chargebacks e regras. | Ativo |
| Antecipação | Minhas antecipações, Solicitar, Automática, Simulador, Histórico | Solicitação, simulação e histórico de antecipações. | Parcial/Em breve em pontos específicos |
| NFS-e | Dados fiscais, Emitir nota fiscal, Minhas notas fiscais | Configuração fiscal, emissão RPS/NFS-e e histórico fiscal. | Ativo, com pontos Em breve |
| Tarifas | Custos e prazos | Custos operacionais, prazos e comunicação regulatória. | Ativo |
| Saúde da conta | Saúde da conta | Requisitos, alertas, resolução de pendências e status da conta. | Ativo |

Funcionalidades seguras:

- PIN financeiro para operações sensíveis.
- Idempotência em operações de cobrança, Pix, pagamento e saque.
- Confirmação antes de enviar valores.
- Separação entre gestão gerencial e saldo bancário real.

Roadmap do Financeiro:

- Completar paridade mobile dos fluxos NeuroFinance críticos.
- Tornar cobranças manuais, bancárias e lançamentos uma linha única com origem clara.
- Fortalecer estados de erro, conciliação, chargeback, estorno e auditoria fiscal.

### 3.7 Synapse AI

| Área | Ferramentas/funções | Status |
| --- | --- | --- |
| Interface | Chat, histórico de sessões, sidebar, anexos, input, indicador de pensamento, rascunhos de e-mail, rascunhos de cobrança, mini-card de paciente, prévia de PDF e overlay de voz. | Ativo |
| Pacientes | Listar, buscar, obter detalhes, cadastrar, atualizar e gerar relatório da base. | Ativo |
| Clínico | Buscar histórico clínico via RAG, criar nota de sessão, gerar insights, detectar risco, analisar no NeuroView, criar NeuroFlow e criar NeuroPulse. | Ativo |
| Agenda | Ver agenda, buscar horários, criar agendamento, remarcar e cancelar consulta. | Ativo |
| Financeiro | Consultar métricas, listar transações, rascunhar cobrança e registrar transação. | Ativo |
| Documentos | Rascunhar e-mail, gerar documento oficial e gerar PDF clínico. | Ativo |
| Conhecimento | Buscar CID-10, informações sobre medicamentos e normas CFP. | Ativo |
| Comunicação | Enviar e-mail via conta conectada. | Ativo |
| Navegação | Navegar por páginas, abrir paciente, abrir teleconsulta, trocar visão de notas, abrir NeuroView/NeuroFlow/NeuroPulse e destacar elementos. | Ativo |
| Voz | Disponibilidade direta, com confirmação ou bloqueada conforme risco. | Ativo |

Política de risco:

- Ações de leitura e navegação são de menor risco.
- Mutations e operações financeiras exigem confirmação.
- Exclusões, Pix, reembolso e ações sensíveis são bloqueadas ou exigem confirmação rígida por voz.

Roadmap do Synapse:

- Tornar planos de ação imutáveis e auditáveis em todos os fluxos de agenda e financeiro.
- Ampliar memória contextual com escopo por paciente, sessão e módulo.
- Expor claramente quando uma resposta é leitura, rascunho, ação pendente ou ação executada.

### 3.8 Ajustes

| Grupo | Aba | Funcionalidades | Status |
| --- | --- | --- | --- |
| Conta | Meu Perfil | Perfil profissional, dados pessoais, avatar e cartão NeuroNex ID. | Ativo |
| Conta | Login e Segurança | Segurança da conta, MFA/TOTP, autenticador, PIN financeiro e controles de sessão. | Ativo |
| Conta | Assinatura | Plano, cobrança de assinatura, limites e gerenciamento. | Ativo |
| Experiência | Interface e tour | Preferências de interface, tema, tour e experiência do usuário. | Ativo |
| Experiência | Notificações | Preferências persistentes de notificação e canais. | Ativo |
| Experiência | Comunicação | Configurações de comunicação com pacientes e mensagens. | Ativo |
| Operação | NeuroFinance | Wizard NeuroNex Pay/NeuroFinance, status e configuração de pagamentos. | Ativo |
| Operação | Integrações | Google, Notion e integrações operacionais; retorno OAuth e callback status. | Ativo |
| Operação | Dados Fiscais | FiscalConfigPanel, dados fiscais para emissão de NFS-e. | Ativo |
| Operação | Dados e privacidade | Fundação de gestão de dados, privacidade, arquivo e controles. | Ativo |

Roadmap de Ajustes:

- Agrupar integrações por categoria: calendário, documentos, e-mail, pagamentos e automação.
- Ampliar exportação, retenção, exclusão e trilhas de auditoria por LGPD.
- Padronizar copy de estados conectando, conectado, erro, reconectar e revogar acesso.

### 3.9 NeuroZap

| Área | Funcionalidades | Status |
| --- | --- | --- |
| Rota desktop beta | `/neurozap`, fora da navegação principal. | Beta |
| Conexão WhatsApp | Fluxo de conexão segura e sincronização após autorização. | Beta |
| Evolution API | Edge Function para instância, webhooks, contatos, chats, mensagens, labels e normalização de identidade. | Beta |
| Tempo real | Hooks e referências de realtime para conversas e estados. | Beta |
| Synapse | Futuro vínculo com ações assistidas e contexto de paciente. | Roadmap |

Roadmap do NeuroZap:

- Definir escopo do Desktop Beta sem misturar com Professional mobile.
- Mapear mensagens para pacientes com resolução segura de identidade.
- Criar inbox operacional com etiquetas, histórico, consentimento, auditoria e limites por plano.

## 4. Professional mobile

Status geral: transicional. O produto atual usa componentes em `src/mobile`, enquanto a direção futura de mobile-first fica em `src/apps/professional-mobile`.

| Área | Funcionalidades atuais | Roadmap mobile-first |
| --- | --- | --- |
| Painel | Saudação, próxima sessão, métricas, ações rápidas, novo agendamento, novo paciente, notas e Synapse texto/voz. | Criar painel compacto por prioridade: próxima ação, agenda, pendências e financeiro. |
| Agenda | Semana/mês, busca, bottom sheet de dia, detalhe, novo agendamento e navegação para teleconsulta ou prontuário. | Completar criação/edição com gestos, estados offline/degradados e políticas visíveis. |
| Pacientes | Acesso pelo menu, lista e prontuário adaptado. | Recriar prontuário mobile-first sem importar desktop, priorizando resumo, contato, próxima sessão e ações rápidas. |
| Teleconsulta | Lobby mobile, sessão ativa, transcrição, notas, revisão e controles. | Polir pré-entrada, mídia, consentimento e resumo pós-sessão para telas pequenas. |
| Notas | Lista, editor, pastas, tarefas e NeuroView mobile. | Definir quais módulos de inteligência cabem no mobile e quais devem abrir em desktop. |
| Financeiro | Gestão financeira mobile, NeuroFinance home, extrato, Pix, cobrança, boleto, transferência, onboarding, PIN e scanner. | Garantir paridade dos fluxos críticos: consultar saldo, receber, cobrar, pagar e sacar. |
| Synapse | Entrada central na barra inferior e página `/synapse-ai`. | Criar Synapse como comando contextual de tela, com ações seguras por voz. |
| Ajustes | Acesso via menu e integrações. | Adaptar segurança, assinatura e integrações para fluxos de poucas etapas. |

Regras de evolução mobile:

- Abaixo de 768px seleciona mobile; 768px ou mais seleciona desktop/tablet.
- Mobile não deve importar páginas, shells, layouts, formulários, modais ou componentes operacionais desktop.
- Compartilhar apenas comportamento não visual: tipos, validação, serviços, hooks de domínio, Supabase e primitivas neutras.

## 5. Patient portal

### Rotas e abas principais

| Aba | Rota | Sub-abas/funcionalidades | Status |
| --- | --- | --- | --- |
| Início | `/portal` | Resumo do momento, próxima sessão, atalhos para sessões, documentos, financeiro, humor e progresso. | Ativo |
| Sessões | `/portal/sessoes` | Próximos agendamentos, histórico, resumo de sessão, ações de confirmar, remarcar e cancelar, link online e rota presencial. | Ativo |
| Humor | `/portal/humor` | Registro diário com escala 1-5, notas, gráfico e registros recentes. | Ativo |
| NeuroDrive | `/portal/documentos` | Sub-abas **Documentos**, **Anamneses**, **Notas** e **Tarefas**. | Ativo |
| Progresso | `/portal/progresso` | Sub-abas **Visão geral** e **Missões**; sessões, metas, documentos, pacotes, humor recente e tarefas terapêuticas compartilhadas. | Ativo |
| NeuroFinance | `/portal/financeiro` | Sub-abas **Pacotes e sessões** e **Cobranças**; pagamento, Pix, boleto, documentos financeiros e recibos. | Ativo |
| Perfil | `/portal/perfil` | Nome, sobrenome, gênero, e-mail, profissional responsável e logout. | Ativo |

Fluxos de acesso:

| Fluxo | Funcionalidades | Status |
| --- | --- | --- |
| Convite | `/portal/convite` e `/portal/convite/:token`, validação de token e ativação do vínculo paciente-profissional. | Ativo |
| Ativação | `/portal/ativar`, criação/entrada do paciente e vínculo ativo. | Ativo |
| Sessão online | Entrada por link seguro e modal de confirmação antes de abrir a sala. | Ativo |
| Direitos do paciente | Confirmação, remarcação e cancelamento respeitando política versionada do profissional. | Ativo |

Sub-abas do NeuroDrive do paciente:

- **Documentos:** arquivos liberados explicitamente pelo profissional, download por link assinado.
- **Anamneses:** formulários compartilhados, edição e salvamento pelo paciente.
- **Notas:** notas pessoais do paciente, separadas das notas clínicas privadas.
- **Tarefas:** tarefas pessoais do paciente, com prazo, concluir, reabrir e excluir.

Roadmap do Portal:

- Tornar permissões de compartilhamento mais explícitas para documentos, resumos e financeiro.
- Melhorar comunicação de políticas de reagendamento/cancelamento antes da ação.
- Expandir experiência de progresso com marcos, plano terapêutico compartilhado e consentimentos.

## 6. Public

| Área | Rotas | Funcionalidades | Status |
| --- | --- | --- | --- |
| Landing principal | `/` | Apresentação pública da NeuroNex e entrada para autenticação/cadastro. | Ativo |
| Autenticação | `/auth`, `/create-account`, `/account-created`, `/email-confirmed`, `/reset-password`, `/initial-settings` | Login, cadastro, confirmação, recuperação e primeira configuração. | Ativo |
| Ajuda e contato | `/ajuda`, `/contato` | Suporte público e canais de contato. | Ativo |
| Legal | `/documentos-legais`, `/termos-de-uso`, `/politica-de-privacidade`, `/configuracoes-de-cookies` | Documentos legais e privacidade. | Ativo |
| Landings de produto | `/neurofinance`, `/synapse`, `/neurobox`, `/portal-do-paciente`, `/teleconsulta-para-psicologos`, `/prontuario-para-psicologos`, `/agenda-para-psicologos` | Páginas públicas por oferta/funcionalidade. | Ativo |
| Perfil público | `/id/:profileId` | Perfil profissional público. | Ativo |
| Confirmação de agenda | `/confirmar-agendamento/:token` | Fluxo aberto para confirmação/ação do paciente. | Ativo |
| Anamnese externa | `/anamnese-externa/:id` | Preenchimento externo de ficha. | Ativo |
| Callback de pagamento | `/payment/callback` | Retorno de pagamento. | Ativo |
| Callback Google | `/google-connection-success` | Retorno de integração Google. | Ativo |

Roadmap Public:

- Reconciliar rota/menu de preços.
- Garantir SEO técnico para landings, legais e perfil público.
- Manter fluxos externos acessíveis, seguros e visualmente separados do produto profissional.

## 7. Integrações e infraestrutura funcional

| Domínio | Funcionalidades | Status |
| --- | --- | --- |
| Supabase Auth | Profissional, paciente, convites, sessão e RLS. | Ativo |
| Supabase Database | Pacientes, agenda, prontuário, financeiro, portal, políticas, pacotes, notas e auditoria. | Ativo |
| Supabase Edge Functions | Pagamentos, Pix, NFS-e, onboarding, Synapse, portal, Google, NeuroZap e teleconsulta. | Ativo |
| Cloudflare R2/NeuroDrive | Upload, download, prévia e links assinados de curta duração. | Ativo |
| Asaas/NeuroFinance | Conta, cobranças, Pix, boletos, saldo, saque, NFS-e e sincronização financeira. | Ativo |
| Google | Calendar, OAuth e integrações futuras de Drive/Docs. | Ativo/parcial |
| Notion | Páginas conectadas e importação para notas. | Ativo |
| E-mail/Gmail | Rascunhos e envio assistido. | Ativo/parcial |
| Jitsi/JaaS | Sala de teleconsulta e tokens. | Ativo |
| Deepgram/voz | Transcrição, voz do Synapse e sessão de voz. | Ativo |
| Evolution/WhatsApp | Base para NeuroZap. | Beta |
| N8N/agent gateway | Ferramentas operacionais e automações assistidas. | Ativo/parcial |

## 8. Roadmap por fase

### Fase 0 - Inventário e estabilidade

- Manter este documento atualizado a cada reorganização de área funcional.
- Preservar as quatro superfícies e impedir importações cruzadas indevidas.
- Fechar rotas legadas com redirecionamento claro e telemetria.

### Fase 1 - Desktop operacional completo

- Agenda: conflito, recorrência, política e histórico em fluxo único.
- Pacientes: prontuário como fonte central para sessões, documentos, portal e financeiro.
- Financeiro: conciliação, chargebacks, estornos e NFS-e com estados completos.
- Synapse: confirmação, idempotência e auditoria para todas as ações mutáveis.

### Fase 2 - Mobile profissional

- Recriar a experiência mobile em `src/apps/professional-mobile`.
- Priorizar rotinas de campo: próxima sessão, reagendamento, cobrança, nota rápida, Teleconsulta e Synapse.
- Reduzir dependência de componentes transicionais em `src/mobile`.

### Fase 3 - Portal do paciente

- Expandir permissões de compartilhamento.
- Melhorar jornada de confirmação, remarcação e cancelamento.
- Fortalecer progresso, missões, diário de humor e documentos compartilhados.

### Fase 4 - NeuroZap Desktop Beta

- Fechar conexão WhatsApp, sincronização, inbox e mapeamento paciente-conversa.
- Adicionar consentimento, etiquetas, auditoria e limites por plano.
- Integrar com Synapse para resumos, sugestões e ações com confirmação.

### Fase 5 - Inteligência e automação

- Ampliar NeuroView, NeuroFlow e NeuroPulse como sistema de raciocínio clínico auditável.
- Conectar alertas, pendências e automações ao Painel.
- Criar relatórios operacionais por período, paciente, convênio e receita.

## 9. Critérios de pronto por área

Cada área só deve ser considerada concluída quando cumprir:

- Caminho principal, estados vazios, carregando, erro, sucesso e bloqueios por plano.
- Revisão visual em light/dark.
- Teclado, foco visível, VoiceOver/aria e alvos de toque.
- Redução de movimento quando aplicável.
- Textos sem sobreposição em mobile e desktop.
- Lint, typecheck, testes relevantes e build.
- SEO nas páginas públicas relevantes.
- Auditoria e idempotência em ações sensíveis.
- Separação correta entre Public, Professional desktop, Professional mobile e Patient portal.
