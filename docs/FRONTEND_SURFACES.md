# Superfícies da interface NeuroNex

Atualizado em: 14 de julho de 2026

Este documento impede que agentes misturem quatro superfícies diferentes: páginas públicas, produto profissional desktop/tablet, futuro produto profissional mobile e portal do paciente. Ele descreve o estado atual e a direção de organização, sem autorizar uma mudança grande de pastas.

## Visão simples

| Superfície | O que o usuário encontra | Local principal atual | Direção |
| --- | --- | --- | --- |
| Pública | Landing page, preços, contato, páginas legais e fluxos acessíveis sem entrar na conta | `src/pages/public`, `src/components/landing`, `src/pages/desktop/DesktopIndex.tsx` e `src/mobile/pages/MobileIndex.tsx` | Ter entradas visuais próprias para desktop/tablet e mobile |
| Desktop/tablet | Aplicativo profissional: painel, agenda, pacientes, notas, teleconsulta, NeuroFinance, Synapse, ajustes e futuro NeuroZap | `src/pages/desktop`, adaptadores em `src/pages` e componentes de cada área | Preservar como produto atual e organizar uma área por vez |
| Mobile profissional | Aplicativo profissional futuro, desenhado primeiro para telas pequenas | `src/mobile` ainda executa código transitório; `src/apps/professional-mobile` é o destino da reconstrução | Construir sem importar a interface desktop |
| Portal do paciente | Agenda, documentos, pagamentos e dados destinados ao paciente | rotas `/portal/*` e componentes do portal | Permanecer independente do aplicativo profissional mobile |

Um **adaptador de rota** é um arquivo pequeno que recebe o endereço aberto pelo usuário e escolhe qual tela carregar. Por exemplo, a rota inicial usa `src/pages/Index.tsx`: telas menores que 768 pixels recebem `MobileIndex`; desktop e tablet recebem `DesktopIndex`. O adaptador pode conhecer as duas versões, mas cada versão visual deve permanecer separada.

## Estado atual

- A página inicial pública já escolhe entre uma implementação mobile e uma implementação desktop/tablet.
- Dashboard, Agenda, Synapse e NeuroFinance também possuem separação por adaptadores.
- Notas, Ajustes, Teleconsulta e detalhes do paciente ainda misturam parte da escolha de plataforma com a implementação desktop. Isso deve ser organizado gradualmente, não em uma movimentação em massa.
- Pacientes ainda possui uma implementação responsiva compartilhada em parte do fluxo.
- `src/mobile` contém tanto páginas públicas quanto páginas do aplicativo profissional.
- `src/apps/professional-mobile` contém o início da estrutura mobile nova, hoje concentrada no financeiro. Ela ainda depende de partes de `src/mobile` e também é reexportada por essa árvore. Consolidar isso será uma etapa própria.
- Algumas telas mobile atuais importam componentes visuais complexos criados para áreas compartilhadas. Cada caso precisa ser revisado durante a reconstrução mobile; sua existência atual não transforma o desktop em modelo obrigatório.

## Regras obrigatórias

1. Mobile não deve importar páginas, shell, layout ou espaços de trabalho visuais do desktop.
2. Desktop não deve importar telas visuais mobile.
3. Público não deve importar a interface interna do profissional, e o portal do paciente não deve importar a interface operacional do psicólogo.
4. É permitido compartilhar a camada invisível: leitura e gravação de dados, regras de validação, tipos, serviços, autenticação e acesso ao Supabase.
5. Componentes visuais só podem ser compartilhados quando forem deliberadamente neutros, como botões básicos, campos e diálogos de `src/components/ui`.
6. Estar em `src/components` não transforma automaticamente um componente em compartilhável.
7. A versão mobile existente não é referência visual obrigatória. A reconstrução futura será mobile-first em `src/apps/professional-mobile`.
8. NeuroZap está planejado para o Beta Desktop e é composto por sua rota `/neurozap`, página, hooks, funções, dados e ligações com o Synapse.
9. A reorganização ocorre por área funcional, mantendo cada superfície ativa durante a transição.

## Estrutura futura conceitual

```text
src/
  app/                 entrada, rotas e provedores globais
  apps/
    public/            experiências públicas, separadas por plataforma quando necessário
    professional-desktop/  interface profissional desktop/tablet por área
    professional-mobile/   interface profissional mobile-first por área
    patient-portal/        experiência exclusiva do paciente
  shared/
    data/              acesso a dados e serviços
    domain/            regras e tipos do produto
    ui/                somente controles visuais realmente neutros
  integrations/        Supabase e serviços externos
```

Essa árvore é uma direção, não uma tarefa imediata. Primeiro será feito o inventário de cada área; depois, pequenos grupos aprovados poderão ser movidos com verificação de lint, tipos, testes e build.

## Decisões atuais

- **NeuroZap:** funcionalidade planejada para o Beta Desktop.
- **Portal do paciente:** superfície própria, separada do aplicativo profissional mobile.
- **Em avaliação:** rotas de avaliação de teleconsulta e notas mobile, além das importações visuais compartilhadas pelo mobile atual.
