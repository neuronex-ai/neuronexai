# NeuroNex — diretriz visual e biblioteca de componentes desktop

**Status:** documento ativo e orientador  
**Versão:** 1.0  
**Última revisão:** 14 de julho de 2026  
**Escopo:** aplicação principal para desktop, nos modos claro e escuro

Este é o documento visual oficial da NeuroNex. Ele registra o sistema que já existe no produto e transforma suas escolhas recorrentes em regras compreensíveis. Seu objetivo é impedir que uma nova tela, um novo agente ou uma correção isolada crie outra linguagem visual paralela.

> **Aviso para agentes:** arquivos dentro de `docs/archive/` são históricos ou reservas para plataformas futuras. Eles não definem a interface atual e não devem ser copiados para o aplicativo sem autorização explícita de produto.

## 1. Como decidir em caso de dúvida

A ordem de referência é:

1. Os componentes ativos em `src/components/ui/`.
2. As variáveis visuais de `src/index.css` e `tailwind.config.ts`.
3. Este documento, que explica como aplicar essas bases.
4. As exceções já existentes em uma área do produto, somente quando forem realmente necessárias naquela área.

Se o código antigo contrariar este guia, não copie a inconsistência. Registre-a como algo a organizar e peça aprovação antes de uma alteração ampla.

As capturas catalogadas em `public/images/prints-sistema/DESKTOP/` são usadas no material de apresentação e estão descritas em `docs/PRINTS_DESKTOP_ROADMAP.md`. Elas ajudam a entender a interface registrada no momento da captura; para comportamento e composição atuais, prevalecem o código validado em execução e os componentes ativos.

## 2. Essência da marca

A interface da NeuroNex deve comunicar:

- **calma clínica:** o profissional precisa sentir controle, não urgência artificial;
- **precisão:** números, horários, pacientes e ações devem ser fáceis de localizar;
- **confiança:** o sistema precisa parecer estável, discreto e seguro;
- **inteligência sem espetáculo:** a IA apoia o trabalho, mas não compete visualmente com o conteúdo clínico;
- **sofisticação contida:** profundidade, transparência e movimento são usados com moderação;
- **continuidade:** Dashboard, Agenda, Pacientes, Notas, Synapse e NeuroFinance devem parecer partes do mesmo produto.

### Personalidade visual

A base é monocromática: branco, preto e cinzas neutros. A profundidade vem de transparências suaves, bordas finas, luz difusa e sombras longas de baixa intensidade. Cores fortes ficam reservadas para significado funcional, como sucesso, atenção ou erro.

O efeito desejado é de “cerâmica e vidro”: superfícies claras e limpas no modo claro; ônix e vidro escuro no modo escuro. Não é uma interface neon, colorida ou futurista por excesso.

## 3. Base técnica atual

Esta é a função de cada parte da biblioteca visual:

| Base | Papel no produto |
| --- | --- |
| React | Monta as telas e controla os estados visuais. |
| Tailwind CSS | Aplica espaçamento, tamanhos e cores por classes reutilizáveis. |
| Variáveis de `src/index.css` | Guardam as cores semânticas e as superfícies claro/escuro. |
| Radix UI | Fornece comportamento acessível para diálogos, menus, abas, seleções e controles. |
| Lucide | Fornece a família atual de ícones da aplicação web. |
| Framer Motion | Anima somente mudanças que precisam explicar estado, direção ou resposta. |
| next-themes | Alterna e preserva os modos claro e escuro. |
| Recharts | Renderiza gráficos de dados. |
| `class-variance-authority` | Mantém variantes previsíveis de componentes, como botões. |

Para novos controles, use primeiro um elemento nativo do navegador ou um componente Radix já envolvido por `src/components/ui/`. “Nativo”, neste projeto web, significa preservar teclado, foco, leitura por tecnologia assistiva e comportamento esperado, em vez de desenhar um botão ou menu complexo do zero.

## 4. Paleta oficial

As cores abaixo são **semânticas**: o nome descreve a função, não uma cor fixa. Por exemplo, `background` é o fundo correto tanto no modo claro quanto no escuro.

### 4.1 Modo escuro — padrão atual

| Token | Valor atual | Aparência e uso |
| --- | --- | --- |
| `background` | `hsl(240 10% 4%)` | Ônix quase preto; canvas principal. |
| `foreground` | `hsl(0 0% 98%)` | Branco suave; texto principal. |
| `card` | `hsl(240 10% 6%)` | Superfície um nível acima do fundo. |
| `popover` | `hsl(240 10% 5%)` | Menus e conteúdos flutuantes. |
| `primary` | `hsl(0 0% 98%)` | Ação principal clara sobre fundo escuro. |
| `primary-foreground` | `hsl(240 10% 4%)` | Texto escuro dentro da ação principal. |
| `secondary`, `muted`, `accent` | `hsl(240 5% 15%)` | Controles e áreas de apoio. |
| `muted-foreground` | `hsl(240 5% 65%)` | Texto secundário, nunca informação essencial em contraste fraco. |
| `border` | `hsl(0 0% 15%)` | Divisórias e contornos discretos. |
| `input` | `hsl(240 5% 10%)` | Fundo de campos. |
| `ring` | `hsl(0 0% 100%)` | Indicação de foco pelo teclado. |
| `destructive` | `hsl(0 84% 60%)` | Erro ou ação destrutiva. |

### 4.2 Modo claro — cerâmica neutra

| Token | Valor atual | Aparência e uso |
| --- | --- | --- |
| `background` | `hsl(0 0% 100%)` | Branco puro; canvas principal. |
| `foreground` | `hsl(240 10% 3.9%)` | Preto suave; texto principal. |
| `card` | `hsl(0 0% 98.5%)` | Cerâmica levemente destacada. |
| `popover` | `hsl(0 0% 100%)` | Menus e conteúdos flutuantes. |
| `primary` | `hsl(240 10% 3.9%)` | Ação principal escura sobre fundo claro. |
| `primary-foreground` | `hsl(0 0% 100%)` | Texto claro dentro da ação principal. |
| `secondary` | `hsl(240 5% 96%)` | Controles secundários. |
| `muted` | `hsl(240 5% 94%)` | Áreas de apoio. |
| `muted-foreground` | `hsl(240 5% 45%)` | Texto secundário. |
| `accent` | `hsl(240 5% 92%)` | Realce neutro de interação. |
| `border` | `hsl(240 5% 88%)` | Divisórias e contornos. |
| `input` | `hsl(240 5% 90%)` | Fundo/borda de campos. |
| `ring` | `hsl(240 10% 3.9%)` | Indicação de foco pelo teclado. |

Os valores HSL acima são a fonte exata. Amostras em hexadecimal seriam apenas aproximações e não devem substituir os tokens.

### 4.3 Cores funcionais

| Significado | Família atual | Regra |
| --- | --- | --- |
| Sucesso ou conectado | esmeralda | Usar ícone ou texto junto da cor. |
| Atenção ou pendência | âmbar | Reservar para algo que requer observação. |
| Erro, atraso crítico ou exclusão | vermelho/rosa | Não usar como decoração. |
| Informação comum | neutra | Preferir preto, branco e cinza; azul não é o padrão de marca. |

Nunca comunicar um estado somente pela cor. Um indicador verde de “Conectado”, por exemplo, também precisa do texto “Conectado” ou de um símbolo reconhecível.

### 4.4 Uso correto no código

Prefira classes como:

```tsx
<section className="bg-background text-foreground border-border" />
```

Evite criar novos valores como `bg-[#0a0a0a]` em cada tela. Valores diretos ainda existem em implementações antigas; eles são exceções a consolidar, não um modelo para novos componentes.

## 5. Tipografia

### Famílias

- **Inter:** fonte principal de títulos, textos, botões e navegação.
- **JetBrains Mono:** somente para códigos, identificadores, números técnicos ou dados que se beneficiem de largura fixa.
- **Manrope:** está configurada, mas não é uma família visual ativa consolidada. Não criar uma segunda linguagem tipográfica com ela sem decisão de produto.

### Hierarquia recomendada

| Nível | Uso | Diretriz |
| --- | --- | --- |
| Hero | Mensagem principal do Dashboard ou resumo de área | 52–72 px em telas largas, peso 800/900, entrelinha compacta. |
| Título de página | Nome da área ou principal resultado | 32–48 px, peso 700/900. |
| Título de seção | Painel, grupo ou modal | 22–30 px, peso 700/900. |
| Corpo | Instruções e informações correntes | 14–16 px, peso 400/600, entrelinha confortável. |
| Metadado | Data, categoria, estado curto | 9–11 px, peso forte e espaçamento entre letras moderado. |

Textos longos não devem ficar em caixa alta. A caixa alta, já presente na identidade, fica restrita a pequenas etiquetas, categorias e metadados. Títulos e instruções usam escrita normal para reduzir esforço de leitura.

Valores financeiros e contagens devem usar números tabulares quando o alinhamento facilitar comparação. Códigos Pix, identificadores e hashes podem usar `font-mono`.

## 6. Espaçamento, dimensões e cantos

A base de espaçamento segue múltiplos de 4 px, conforme a escala do Tailwind.

| Elemento | Padrão atual |
| --- | --- |
| Conteúdo central comum | até 1400 px. |
| Prontuário e workspaces muito densos | podem chegar a 1800 px quando comprovadamente necessário. |
| Reserva superior da barra global | `7.75rem`, por meio de `--desktop-navbar-clearance`. |
| Botão ou campo padrão | 44 px de altura (`h-11`). |
| Botão grande | 48 px (`h-12`). |
| Botão de destaque | 56 px (`h-14`). |
| Shell externo | raio aproximado de 36–40 px. |
| Painel principal | raio aproximado de 28–34 px. |
| Cartão/inset | raio aproximado de 16–24 px. |
| Controle interno | raio aproximado de 12–18 px. |

Não arredonde todos os objetos com o maior raio. A mudança gradual de raio ajuda a pessoa a perceber o que contém o quê.

## 7. Materiais, profundidade e superfícies

A hierarquia oficial possui cinco camadas:

| Camada | Classe/componente atual | Papel visual |
| --- | --- | --- |
| Canvas | `desktop-lumen-page` + `DesktopLumenBackdrop` | Campo contínuo de fundo para todo o produto. |
| Frame | `desktop-retina-frame` ou `DesktopWorkspaceShell` | Contêiner externo de uma área completa. |
| Painel | `desktop-retina-panel` ou `DesktopWorkspacePanel` | Bloco principal de conteúdo. |
| Inset | `desktop-retina-inset` | Conteúdo interno, filtro, grupo ou apoio. |
| Modal | `desktop-retina-modal`, `app-dialog-surface` ou `AppModalShell` | Tarefa temporária que exige foco. |

Uma tela não deve empilhar vidro sobre vidro indefinidamente. Em geral, canvas + frame + painel/inset já fornecem profundidade suficiente.

`DesktopWorkspace*` e as classes `desktop-retina-*` hoje descrevem superfícies parecidas por caminhos diferentes. Ambos continuam ativos, mas a duplicação deve ser consolidada progressivamente em uma etapa aprovada; não crie um terceiro sistema.

### Vidro

No modo escuro, a base de vidro atual usa aproximadamente `rgba(20, 20, 25, 0.6)`, borda branca a 8% e brilho interno a 3%. No modo claro, usa branco a 75%, borda preta a 8% e brilho escuro a 2%.

O desfoque de fundo deve ajudar a separar camadas. Não deve reduzir legibilidade nem ser aplicado a grandes superfícies em movimento contínuo. A Teleconsulta já adota superfícies mais estáticas para evitar processamento visual desnecessário durante a sessão.

### Sombras

- Use sombra longa e suave no frame e no modal.
- Use sombra curta ou apenas borda no inset.
- Use realce interno de 1 px para sugerir material.
- Não use brilho colorido como decoração comum.
- No modo escuro, a separação depende de pequenas diferenças de luminosidade e bordas de baixa opacidade, não de cinzas azulados.

## 8. Gradientes e texturas

Os gradientes oficiais são neutros e de baixo contraste:

- campo de luz radial grande no topo;
- iluminação lateral muito discreta;
- brilho interno vertical ou diagonal nas superfícies;
- sombra difusa na base;
- canais RGB equivalentes para evitar desvios azulados ou amarelados.

### Permitido

- Lumen neutro no canvas;
- um realce suave por superfície principal;
- textura discreta em Notas/Synapse para diferenciar o espaço de pensamento;
- gradiente funcional em visualizações de dados, quando houver legenda e contraste.

### Evitar

- auroras coloridas sem significado;
- ruído forte por trás de texto;
- gradientes diferentes em cada cartão;
- brilho neon em ações comuns;
- animação decorativa infinita em vários pontos simultaneamente;
- textura que prejudique contraste no modo claro.

## 9. Shell desktop oficial

O **shell** é a moldura persistente que organiza navegação e conteúdo.

### Anatomia

1. `Layout.tsx` cria o canvas e o plano de conteúdo.
2. `DesktopLumenBackdrop` mantém o mesmo campo de luz entre as áreas.
3. `Navbar.tsx` oferece a navegação global flutuante.
4. A página aplica `desktop-content-offset` para não ficar escondida sob a barra.
5. Um frame ou workspace agrupa o conteúdo da área.
6. Painéis e insets organizam tarefas e dados.

### Barra superior global

A barra atual contém:

- marca NeuroNex e status de assinatura;
- Painel;
- Agenda;
- Teleconsulta;
- Pacientes;
- Notas;
- Financeiro;
- busca;
- notificações;
- perfil, tema, suporte e saída.

Regras:

- manter as áreas principais em ordem estável;
- usar ícone familiar e tooltip com o nome;
- indicar a área ativa por contraste, forma e ponto — não apenas pela cor;
- manter busca, notificações e perfil como utilidades separadas da navegação;
- não sobrecarregar a barra com ações locais da página;
- preservar foco visível e nome acessível em botões somente com ícone.

### Barra lateral local

NeuroFinance e algumas áreas densas usam uma barra lateral própria. Ela deve navegar somente dentro daquela área. Não deve repetir todas as funções da barra global nem esconder uma ação crítica no rodapé.

## 10. Componentes oficiais

Antes de criar um componente, procure a finalidade equivalente em `src/components/ui/`.

### Botões

Fonte: `button.tsx` e `button-variants.ts`.

Variantes atuais:

- `default`: ação principal;
- `secondary`: ação de apoio;
- `outline`: ação neutra com contorno;
- `ghost`: ação leve em barra ou painel;
- `link`: navegação textual;
- `destructive`: ação perigosa;
- `premium` e `glass`: exceções de superfícies escuras; não usar como padrão universal.

Tamanhos atuais: 44 px padrão/pequeno/ícone, 48 px grande e 56 px extra grande. Todo botão precisa ter rótulo visível ou `aria-label` quando mostrar apenas um ícone.

### Campos

Fonte: `input.tsx`, `textarea.tsx`, `select.tsx`, `checkbox.tsx`, `radio-group.tsx`, `switch.tsx`, `slider.tsx` e `form.tsx`.

- altura comum de 44 px;
- rótulo persistente para informação importante;
- placeholder é exemplo, não substitui o rótulo;
- erro precisa de mensagem textual e estado `aria-invalid`;
- não alterar formato enquanto a pessoa digita sem preservar o cursor;
- seleção e preenchimento devem funcionar por teclado.

### Cartões e painéis

Use `DesktopWorkspacePanel`, `desktop-retina-panel` ou `desktop-retina-inset` conforme a profundidade. `Card` e `GlassCard` continuam ativos, mas possuem decisões antigas mais específicas. Em especial, `CardTitle` força texto claro e `GlassCard` repete cores diretas; não os copie para uma nova base sem revisar o modo claro.

Um cartão clicável precisa parecer clicável, receber foco e responder a Enter/Espaço. Um cartão apenas informativo não deve levantar ou mudar o cursor como se fosse um botão.

O arquivo `src/styles/design-tokens.css` ainda mantém uma definição antiga de `.glass-panel` e tokens violetas de uma direção anterior. Como ele é carregado depois de `src/index.css`, pode modificar o `Card` no modo claro. Não use esse arquivo como fonte para novas telas antes de sua auditoria e consolidação.

### Modais, folhas e menus

- `AppModalShell`: padrão para novas tarefas modais, com cabeçalho, descrição, corpo rolável e rodapé.
- `ResponsiveModal`: diálogo no desktop e folha inferior no mobile; mobile será revisto em uma etapa própria.
- `Dialog`: base Radix para foco, Escape e leitura assistiva.
- `AlertDialog`: confirmação de ação destrutiva ou difícil de desfazer.
- `Popover`: conteúdo curto ligado a um controle.
- `DropdownMenu`: lista de comandos.
- `Tooltip`: explica ícone; não deve conter uma ação indispensável.

Tamanhos do `AppModalShell`: pequeno 26 rem, médio 32 rem, grande 44 rem e extra grande 56 rem.

### Abas e controle segmentado

- `Tabs`: seções distintas dentro do mesmo contexto.
- `MagneticSegmentedControl`: escolha curta entre visualizações equivalentes.

Ambos já incluem navegação por setas, estado selecionado e redução de movimento. Não use uma fileira de botões comuns para imitar abas.

### Estados, badges e notificações

- `Badge`: estado curto, não frase completa.
- `Skeleton`: carregamento estrutural quando o formato já é conhecido.
- `sonner`: confirmação ou erro temporário após uma ação.
- estado vazio: explicar o que falta e oferecer a próxima ação relevante;
- erro persistente: permanecer perto do conteúdo afetado, não depender apenas de um toast.

### Tabelas e gráficos

- alinhar números à direita e usar números tabulares quando útil;
- cabeçalhos devem explicar o dado, não o nome da coluna do banco;
- oferecer texto, tooltip ou legenda para séries de gráficos;
- não usar cor como único diferenciador;
- evitar gráficos quando uma frase ou número responde melhor à pergunta;
- manter ações da linha previsíveis e acessíveis pelo teclado.

### Ícones

Lucide é a família oficial atual da aplicação web. Escolha o símbolo mais familiar para a ação, mantenha peso e tamanho coerentes e evite misturar famílias no mesmo shell. SF Symbols serve como referência conceitual das diretrizes Apple, mas não é uma dependência web atual da NeuroNex.

## 11. Movimento e resposta

Movimento deve explicar uma mudança, não decorar a espera.

| Situação | Duração de referência |
| --- | --- |
| Pressão ou resposta imediata | 100–150 ms. |
| Mudança de cor/estado | 150–300 ms. |
| Entrada de painel ou conteúdo | 300–420 ms. |
| Mudança global de tema | até 800 ms, sem bloquear interação. |

Usos adequados:

- botão reduz levemente ao ser pressionado;
- indicador de aba acompanha a seleção;
- modal surge e mantém continuidade espacial;
- carregamento mostra atividade enquanto ela realmente existe;
- sucesso ou erro recebe uma resposta curta e única.

Usos inadequados:

- cartões informativos flutuando continuamente;
- várias auroras, brilhos e pulsos ao mesmo tempo;
- animação que atrasa uma ação;
- deslocamento grande apenas ao passar o mouse;
- efeito que persiste depois de o estado terminar.

Todo movimento novo deve respeitar `prefers-reduced-motion`. O projeto já possui uma regra global de redução e componentes que consultam essa preferência; nenhuma implementação local pode anulá-la.

## 12. Acessibilidade

Acessibilidade faz parte da aparência oficial, não é uma etapa opcional.

- controles comuns devem ter pelo menos 44 px de altura ou área clicável equivalente;
- foco por teclado precisa permanecer visível;
- ícone sem texto precisa de nome acessível;
- campos precisam de rótulo, mensagem de erro e ordem de tabulação lógica;
- ações destrutivas ou difíceis de reverter pedem confirmação;
- contraste deve ser conferido no claro, no escuro e sobre superfícies translúcidas;
- texto e layout devem suportar zoom do navegador sem cortar ações essenciais;
- informação não pode depender somente de cor, som, gesto ou animação;
- efeitos devem respeitar redução de movimento;
- áreas PWA devem respeitar regiões seguras e os controles da janela.

## 13. Escrita da interface

A voz da NeuroNex é direta, humana e calma.

### Padrões

- usar português brasileiro;
- preferir verbos claros: “Abrir agenda”, “Salvar alteração”, “Enviar convite”;
- usar caixa de frase em títulos e ações;
- dizer o resultado da ação, não o processo técnico;
- explicar erro com causa compreensível e próxima ação;
- evitar jargões de banco, API ou infraestrutura diante do psicólogo;
- não chamar uma integração de “conectada” se apenas a configuração foi salva.

### Marca e distribuição

Use **NeuroNex** ou **NeuroNex AI** conforme o espaço. A comunicação pode afirmar que o sistema está disponível na Microsoft Store. Não descreva o produto como “Electron” ou “multiplataforma nativa”, pois essas expressões não representam a direção atual.

## 14. Aplicação por área

| Área | Rota e base atual | Diretriz específica |
| --- | --- | --- |
| Dashboard | `/dashboard`; `DesktopDashboardCommandCenter` | Grande resumo editorial, próxima ação e cartões de pulso. Priorizar leitura imediata. |
| Agenda | `/agenda`; `DesktopAgenda` e `CalendarView` | Calendário é o protagonista; controles de data ficam juntos e previsíveis. |
| Pacientes | `/pacientes`; lista e `PatientDetail` | Separar busca/lista de prontuário; densidade nunca pode esconder identidade ou ação clínica. |
| Teleconsulta | `/teleconsulta`; shell clínico estático | Vídeo, segurança e controle de sessão acima de efeitos; reduzir processamento visual. |
| Notas | `/notas`; canvas Lumen próprio | Espaço de concentração; textura discreta e ferramentas próximas ao texto. |
| Synapse | `/synapse-ai`; `DesktopAIChat` e voz | Conversa e estado da IA devem ser claros; voz atual é Synapse + Deepgram. |
| Financeiro | `/financeiro`; `DesktopFinanceiro` | Separar gestão do consultório e conta NeuroFinance; números com hierarquia e contexto. |
| Ajustes | `/ajustes`; shell com barra lateral | Categorias estáveis à esquerda e detalhe à direita; mudanças sensíveis explicam impacto. |
| Portal do paciente | `/portal/*`; workspace próprio | Mantém a marca, mas será auditado separadamente conforme o fluxo do paciente. |

As variações `finance-*`, `notes-*`, `patient-*` e `teleconsultation-*` são especializações atuais. Elas não autorizam a criação de um novo sistema de superfícies para cada tela.

## 15. Modelo para uma nova tela desktop

```tsx
<div className="desktop-lumen-page desktop-content-offset min-h-screen text-foreground">
  <DesktopWorkspaceShell>
    <DesktopWorkspacePanel>
      {/* cabeçalho, conteúdo e ações */}
    </DesktopWorkspacePanel>
  </DesktopWorkspaceShell>
</div>
```

Adapte o modelo à tarefa; não adicione camadas apenas para deixá-lo mais “premium”.

## 16. Regras obrigatórias para agentes

Antes de implementar ou alterar uma interface:

1. Localize o componente equivalente em `src/components/ui/`.
2. Use tokens semânticos em vez de novas cores diretas.
3. Verifique a tela nos modos claro e escuro.
4. Teste foco, teclado, zoom e redução de movimento.
5. Preserve a barra global e a reserva superior do desktop.
6. Use cor funcional somente quando houver significado.
7. Não crie arquivos com nomes `old`, `copy`, `v2`, `final` ou semelhantes dentro do código ativo.
8. Não copie componentes ou integrações de `docs/archive/`.
9. Não reative a voz Gemini arquivada; a voz atual usa Synapse + Deepgram.
10. Registre uma nova exceção neste guia ou proponha sua consolidação.

### Checklist de revisão visual

- [ ] A tela parece NeuroNex sem depender do logotipo?
- [ ] A hierarquia principal é compreendida em poucos segundos?
- [ ] Claro e escuro preservam contraste e profundidade?
- [ ] Existe apenas uma ação principal evidente por contexto?
- [ ] Componentes interativos parecem e se comportam como interativos?
- [ ] O estado atual está indicado também por texto ou forma?
- [ ] O teclado alcança tudo em ordem lógica?
- [ ] O layout continua útil com zoom?
- [ ] A redução de movimento elimina efeitos desnecessários?
- [ ] Nenhum dado clínico ou financeiro foi usado como decoração?

## 17. Relação com as Human Interface Guidelines da Apple

As Human Interface Guidelines são uma referência de ergonomia e comportamento, não um pedido para a aplicação web imitar macOS ou iOS.

| Elemento NeuroNex | Referência HIG aplicada |
| --- | --- |
| Canvas e shells | Layout e materiais: hierarquia, adaptação e separação de planos. |
| Barra global e laterais | Toolbars, sidebars e navegação: posição previsível e agrupamento de ações. |
| Diálogos, folhas e menus | Presentation e menus: foco, saída clara e comportamento esperado. |
| Botões, campos, abas e seleções | System-defined controls e input: controles familiares antes de soluções próprias. |
| Animações | Motion: causa, direção, estado e respeito à redução de movimento. |
| Cores, textos e ícones | Color, typography, accessibility, SF Symbols e writing. |

Referências oficiais:

- [Human Interface Guidelines](https://developer.apple.com/design/human-interface-guidelines/)
- [Layout](https://developer.apple.com/design/human-interface-guidelines/layout)
- [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
- [Sidebars](https://developer.apple.com/design/human-interface-guidelines/sidebars)
- [Toolbars](https://developer.apple.com/design/human-interface-guidelines/toolbars)

## 18. Riscos visuais atuais já conhecidos

Estes itens não foram alterados ao criar este guia; são pontos para futuras etapas aprovadas:

1. `src/index.css` concentra milhares de linhas e diversas exceções por área. A direção é consolidar progressivamente, nunca reescrever tudo de uma vez.
2. Existem muitos efeitos de animação configurados, inclusive decorativos e infinitos. Cada uso real precisa ser auditado e reduzido ao que comunica estado.
3. `Card`, `GlassCard` e alguns modais repetem cores e superfícies fora dos tokens semânticos.
4. Algumas telas possuem valores diretos de preto, branco e raio; isso pode gerar diferenças pequenas entre áreas.
5. Superfícies translúcidas precisam de verificação de contraste sobre conteúdo real.
6. As capturas de tela atuais cobrem muito mais o modo escuro do que o claro.
7. Não existe ainda uma verificação visual automática completa entre versões.
8. A experiência mobile será reconstruída depois e não deve limitar a organização do desktop atual. Ela deve ser mobile-first e não deve reutilizar páginas, shell ou espaços de trabalho visuais do desktop; apenas comportamento e primitivas realmente neutras podem ser compartilhados.
9. NeuroZap é uma superfície planejada para o Beta Desktop e deve ser preservada mesmo enquanto não estiver disponível na navegação principal.
9. `src/styles/design-tokens.css` mantém tokens “Deep Space” violetas e outra definição de `.glass-panel`, divergentes da direção monocromática atual.
10. O `AlertDialog` usa uma camada abaixo da barra global; uma confirmação importante pode aparecer atrás da navegação.
11. Existem rótulos operacionais de 8–10 px e controles de 40 px na barra global, abaixo do padrão de 44 px adotado pelos componentes compartilhados.
12. Alguns controles segmentados do Dashboard usam semântica de abas embora se comportem como filtros; isso precisa de correção acessível por área.
13. As capturas de marketing incluem fluxos antigos e precisam ser recapturadas depois que cada área for estabilizada.

## 19. Manutenção deste guia

Atualize este documento quando houver decisão aprovada que altere:

- paleta ou token semântico;
- tipografia;
- componente reutilizável;
- shell de navegação;
- regra de movimento;
- comportamento acessível;
- linguagem de marca;
- padrão comum a mais de uma área.

Uma exceção local não deve virar regra global sem evidência de que melhora outras áreas do produto.
