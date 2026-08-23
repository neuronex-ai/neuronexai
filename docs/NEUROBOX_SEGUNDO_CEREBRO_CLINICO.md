# NeuroBox — o segundo cérebro clínico vivo da NeuroNex

> Documento de visão do produto, funcionamento, cálculos, segurança e regras que futuras implementações precisam respeitar.
>
> **Versão:** 1.0  
> **Data:** 23 de agosto de 2026  
> **Escopo visual desta fase:** painel profissional para desktop e tablet, em modo claro e escuro.  
> **Ferramentas abrangidas:** NeuroVision 2D, NeuroVision 3d, NeuroPulse, NeuroFlow e a futura condução dessas ferramentas pelo Synapse.

---

## 1. Para que este documento existe

Este documento explica, em linguagem simples, o que a NeuroBox deverá se tornar depois que o plano for implementado por completo. Ele também registra o raciocínio por trás das decisões, para impedir que uma mudança isolada no futuro destrua o significado clínico do conjunto.

Ele deve ser lido **antes** de qualquer alteração em:

- cálculos de atenção, densidade, tensão, recorrência ou confiança;
- filtros, cores, tamanhos, distâncias, halos ou conexões do NeuroVision;
- tags e padrões encontrados automaticamente;
- alertas proativos;
- integração entre Vision, Pulse, Flow e Synapse;
- dados clínicos usados para alimentar essas ferramentas;
- regras de privacidade, revisão humana ou isolamento entre profissionais.

Este não é um documento médico, uma escala psicológica validada nem um parecer jurídico. É um contrato de produto e governança. As regras legais e profissionais deverão continuar sendo revisadas com assessoria especializada à medida que a solução evoluir.

---

## 2. A explicação mais curta possível

A NeuroBox transforma informações espalhadas sobre cada paciente em um mapa vivo, explicável e interativo:

- o **NeuroVision** mostra o que existe, o que está se repetindo, o que mudou e como as informações importam e se conectam;
- o **NeuroPulse** ajuda o psicólogo a compreender e organizar uma hipótese de trabalho em diagramas de causa e efeito;
- o **NeuroFlow** transforma aquilo que foi revisado pelo psicólogo em acompanhamento, perguntas, objetivos e próximos passos;
- o **Synapse** conduz o profissional por esse conjunto, explica os motivos, funcionamento e leva a interface até as evidências certas.

Em uma frase para a interface:

> **“Atenção 82/100 — quanto mais recente, recorrente, sustentado por fontes diferentes, pendente ou priorizado por você, mais perto e destacado este item aparece no mapa.”**

Essa frase é deliberadamente simples: Quando o profissional quiser saber mais, o botão **“Por que está aqui?”** deverá abrir a explicação completa num modal expandido com título, subtítulo, data e corpo da nota destrinchando: fontes, datas, repetições, vínculos, pendências, prioridade manual/automática e grau de confiança.

---

## 3. O que significa chamar a NeuroBox de “segundo cérebro”

“Segundo cérebro” é uma metáfora de produto. Não quer dizer que o sistema tenha consciência, intuição humana ou compreensão clínica própria. O próprio Conselho Federal de Psicologia explica que sistemas de IA reconhecem padrões e simulam comportamentos inteligentes, mas não possuem consciência, compreensão ou julgamento ético. Por isso, o nosso agente de IA - o Synapse AI - pode apoiar a organização e a tomada de decisão, mas não substitui em nenhum momento o juízo da psicóloga ou do psicólogo ([posicionamento do CFP sobre IA e Psicologia](https://site.cfp.org.br/cfp-divulga-posicionamento-sobre-inteligencia-artificial-no-contexto-da-pratica-psicologica/); [guia do CFP para uma prática ética e responsável](https://site.cfp.org.br/wp-content/uploads/2025/12/Cartilha_IA_A5-1.pdf)).

Na prática, “segundo cérebro” significa que o sistema fará bem cinco trabalhos cansativos:

1. **Lembrar:** reunir o que está espalhado em notas, sessões, metas, humor, lembretes e fluxos visuais, inteligentes, interativos e proativos.
2. **Organizar:** juntar informações que falam do mesmo tema, mesmo quando usam palavras diferentes.
3. **Comparar no tempo:** mostrar o que surgiu, voltou, aumentou, diminuiu ou desapareceu.
4. **Chamar atenção:** destacar situações sustentadas por evidências objetivas e explicar por que merecem ser vistas agora.
5. **Ajudar a agir:** levar uma descoberta revisada para uma hipótese no Pulse e, depois, para um acompanhamento no Flow.

O sistema não “pensa pelo psicólogo”. Ele reduz o esforço de procurar, ordenar e comparar informações para que o psicólogo tenha mais tempo e clareza para pensar e analisar dados com qualidade e relevância.

---

## 4. Como tudo funcionará no dia a dia

Imagine que um psicólogo vá atender Carlos daqui a vinte minutos.

1. Ele abre o **NeuroTrack** (um radar vivo que mapeia tudo) e vê todos os pacientes de forma discreta, sem expor detalhes clínicos no panorama geral.
2. Carlos aparece com um halo de atenção. O halo não diz “há um diagnóstico” nem “uma crise acontecerá”. Ele diz, por exemplo: “há uma tarefa vencida e um tema que ganhou força nas últimas duas semanas”.
3. Ao selecionar Carlos, a câmera centraliza o paciente e afasta os demais. Só o subgrafo clínico de Carlos permanece legível.
4. A lente **Preparar sessão** reúne o que mudou desde o último encontro, temas recorrentes, metas abertas, próximos passos, humor registrado, lembretes e risco que já tenha sido documentado - ainda com visualização filtrada à Carlos nos subgrafos.
5. O psicólogo escolhe um tema, como “trabalho”. As conexões até as evidências de origem se acendem. Em **“Por que está aqui?”**, ele vê quais registros sustentam aquela posição e qual parte veio de revisão humana ou de sugestão automática.
6. Se quiser compreender melhor a sequência, ele abre o **NeuroPulse**. O Pulse organiza fatos, padrões, hipóteses, evidências favoráveis, evidências contrárias, fatores de proteção e perguntas possíveis.
7. O psicólogo corrige ou confirma a hipótese. Só depois dessa revisão ela pode alimentar a camada clínica principal.
8. No **NeuroFlow**, ele converte a hipótese revisada em perguntas para a próxima sessão, uma meta, um acompanhamento de humor, uma ação ou um ponto a observar.
9. Depois da sessão, os novos registros retornam ao índice. O NeuroVision mede novamente o cenário e mostra se o tema ganhou ou perdeu sustentação.

Esse ciclo é o coração do produto:

**Vision detecta → Pulse ajuda a explicar visualmente sob sua lente clínica (ex.: TCC, Junguiana, Psicanálise, etc)→ psicólogo revisa → Flow ajuda a acompanhar → Vision mostra o que mudou depois da sessão.**

O Synapse atravessa todo esse ciclo como uma interface conversacional. Ele pode dizer “mostre as evidências ligadas ao tema 'trabalho' de Carlos”, aguardar a cena 3D ficar pronta, o synapse de voz ou texto leva a câmera até Carlos e acende os mesmos nós e conexões que seriam acesos pelo mouse. Porém, ele não ganha autoridade para confirmar hipóteses, alterar risco **sozinho** ou decidir uma conduta sozinho.

---

## 5. A função prática de cada ferramenta

### 5.1 NeuroVision 2D: o mapa operacional preciso

O 2D é o lugar mais direto para ver e editar a estrutura do conhecimento.

Ele é melhor quando o psicólogo quer:

- localizar rapidamente uma nota, paciente, tag ou fluxo;
- conferir conexões exatas sem a sensação de profundidade do 3D;
- editar vínculos, corrigir temas ou revisar sugestões;
- usar uma visão estável e compacta durante tarefas operacionais;
- navegar com teclado, leitor de tela ou movimento reduzido;
- entender a origem de cada relação com o mínimo de distração.

Em termos simples: **o 2D é a mesa de trabalho organizada**. Ele dá precisão.

### 5.2 NeuroVision 3d: o "espaço-tempo"ral e exploratório

O 3D não existe apenas para deixar o mesmo grafo mais bonito. Ele deverá tornar perceptíveis relações que são difíceis de notar em uma lista ou em um plano bidimensional. É, de certa forma, análogo à física do espaço tempo; usando densidade, gravidade, e espaço como palcos para refletir visualmente em 3D densidade, relevância e urgência do contexto completo de um paciente:

- o que está mais “pesado” de evidências e, por isso, mais perto do paciente -> nos referimos à isso como tendo "maior densidade";
- o que é recente e o que está distante no tempo;
- quais temas estão se aproximando ou se afastando;
- quais grupos de informações funcionam como pontes entre assuntos;
- onde várias fontes diferentes começam a convergir;
- quais padrões reaparecem depois de um período de silêncio;
- quais temas têm muitas evidências, mas ainda não possuem meta, pergunta ou acompanhamento;
- o que mudou após uma ação registrada no Flow.

Em termos simples: **o 3D é uma sala de situação viva**. Ele dá perspectiva, tempo e capacidade panorâmica e longitudinal de descoberta.

O 3D terá três lentes principais:

#### 1. Preparar sessão

Responde: “O que eu preciso lembrar e observar antes de encontrar este paciente?”

Mostra mudanças desde a última sessão, recorrências, metas, pendências, humor registrado, lembretes e risco já documentado.

#### 2. Padrões longitudinais

Responde: “Como esse tema se comportou ao longo do tempo?”

Permite percorrer a trajetória do próprio paciente e observar surgimento, fortalecimento, recorrência, convergência, enfraquecimento e reaparecimento.

#### 3. NeuroTrack

Responde: “Quem possui algum motivo objetivo para eu olhar agora?”

Mostra todos os pacientes com detalhes clínicos ocultos até a seleção. Os motivos do halo podem ser risco registrado, ação vencida, registro pendente de revisão, mudança observada em humor ou aumento sustentado de um tema. O sistema sempre mostra o motivo; nunca exibe apenas uma cor alarmante sem explicação.

### 5.3 NeuroPulse: a mesa de raciocínio e hipóteses

Hoje, o NeuroPulse já consegue transformar um relato em um diagrama e salvá-lo como uma nota visual. Depois do plano completo, ele passará a ser uma mesa de raciocínio versionada.

O Pulse deverá separar claramente:

- **fatos registrados:** o que efetivamente consta nas fontes;
- **padrões observados:** repetições ou mudanças calculadas sobre esses registros;
- **hipóteses de trabalho:** explicações possíveis, ainda sujeitas à revisão;
- **evidências favoráveis:** o que sustenta a hipótese;
- **evidências contrárias:** o que enfraquece ou contradiz a hipótese;
- **fatores de proteção:** recursos, vínculos ou condições favoráveis registrados;
- **perguntas clínicas:** caminhos de investigação, não ordens de intervenção;
- **pontos de acompanhamento:** o que observar no futuro para confirmar, corrigir ou abandonar a hipótese.

Em termos simples: **o Pulse ajuda a transformar um emaranhado em uma pergunta organizada**.

Tudo que o Pulse gerar automaticamente entra primeiro como hipótese separada. Não muda a gravidade clínica, não altera risco e não vira fato até que o psicólogo revise.

### 5.4 NeuroFlow: da compreensão para o acompanhamento

O Flow é o espaço em que uma hipótese revisada pode virar um processo observável.

Ele poderá receber do Pulse:

- uma pergunta para a próxima sessão;
- uma meta combinada;
- um lembrete;
- um ponto de observação;
- uma pequena ação ou experimento acordado;
- o resultado esperado que ajudaria a confirmar ou enfraquecer uma hipótese;
- um prazo ou momento de revisão.

Depois, o Flow devolve ao Vision o que ocorreu: concluído, pendente, alterado, abandonado, sem efeito registrado ou com mudança observada.

Em termos simples: **o Flow impede que uma boa percepção desapareça depois da sessão**. Ele transforma compreensão em continuidade, sem automatizar a conduta clínica.

### 5.5 Synapse: o guia conversacional do conjunto

O Synapse não é uma quarta fonte de verdade. Ele é a forma conversacional de consultar e conduzir as outras ferramentas.

Quando a integração for realizada, ele poderá:

- preparar a visão de um paciente;
- focar uma evidência específica;
- destacar uma nota, várias notas ou tudo ligado a uma tag;
- percorrer um período;
- trocar a lente;
- explicar a pontuação;
- abrir o Pulse já com o contexto selecionado;
- abrir o Flow com a hipótese revisada;
- restaurar o panorama.

Os comandos aguardarão o 3D ficar pronto e devolverão confirmação ou erro. A voz terá o mesmo efeito visual de hover, foco e seleção que o usuário já entende com mouse e teclado.

O que o Synapse **não** poderá fazer sozinho:

- transformar uma sugestão em fato clínico;
- mudar risco registrado;
- confirmar diagnóstico;
- tomar uma decisão terapêutica;
- criar alertas críticos a partir de uma única inferência não revisada;
- ocultar do psicólogo a origem de uma conclusão.

---

## 6. Quais dados alimentam o sistema

O mapa não deve carregar todo o conteúdo bruto o tempo inteiro. Ele trabalha com um índice clínico resumido: uma espécie de catálogo protegido que sabe **o que é o item, de quem é, quando ocorreu, a que tema pertence, se foi revisado e onde está a fonte original**.

### Fontes permitidas na primeira etapa

- notas pessoais vinculadas ao paciente;
- resumos de sessão confirmados;
- NeuroFlows;
- registros de humor;
- metas;
- anamnese;
- compromissos e desfechos de agenda;
- lembretes;
- conteúdo fornecido pelo paciente quando houver finalidade e base legal adequadas.

### O que não entra como conteúdo bruto no grafo

- transcrições completas de sessão;
- áudio de sessão;
- análise do tom de voz ou de características da fala na primeira versão;
- conversa inteira do Synapse;
- texto clínico integral no panorama geral;
- dados de outro profissional;
- hipótese automática apresentada como fato.

O detalhe original só é buscado quando o psicólogo pede. Isso reduz exposição desnecessária, melhora desempenho e segue o princípio da necessidade da LGPD: tratar apenas o mínimo de dados necessário para a finalidade declarada ([LGPD, art. 6º](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)).

### A trilha de origem que cada item precisa guardar

Todo item calculado deverá responder:

- Qual registro o originou?
- Qual profissional é dono desse registro?
- A qual paciente ele pertence?
- Qual foi a data do acontecimento e a data da atualização?
- Foi escrito pelo psicólogo, fornecido pelo paciente ou sugerido pelo sistema?
- Foi revisado, corrigido, confirmado, rejeitado ou ainda está pendente?
- Qual versão da regra ou do modelo produziu a sugestão?
- O psicólogo fixou, ocultou, corrigiu o tema ou ajustou a prioridade?

Sem essa trilha, o item não pode aparecer como evidência clínica confirmada.

---

## 7. Como funcionarão as tags automáticas

O sistema precisa ir além de procurar palavras exatas. “Não consigo desligar quando chego em casa”, “minha cabeça continua no escritório” e “tenho acordado pensando em prazo” podem falar de uma região de significado parecida, mesmo sem repetir a palavra “trabalho”.

Para isso, existirão duas famílias de tags:

### Tags canônicas

São categorias estáveis, usadas para manter organização ao longo do tempo. Exemplos: trabalho, família, sono, ansiedade, autocuidado, relacionamento, luto, metas e fatores de proteção.

Elas evitam que o sistema crie dez nomes para o mesmo assunto.

### Tags emergentes

São temas mais específicos que aparecem na história daquele paciente. Exemplos: “conflito com a liderança”, “medo de decepcionar a mãe” ou “sobrecarga no fim do trimestre”.

Elas preservam a singularidade do caso e impedem que tudo seja reduzido a categorias genéricas.

### Regra de autoridade

O sistema pode sugerir tags sozinho, mas a escolha do psicólogo tem prioridade.

Cada tag precisa ter:

- origem: manual, automática ou criada pelo próprio sistema;
- estado: sugerida, confirmada, corrigida ou rejeitada;
- confiança da sugestão;
- registros que motivaram a sugestão;
- versão do mecanismo que a criou.

Se o psicólogo corrigir “ansiedade” para “sobrecarga profissional”, a correção deve prevalecer nas próximas visualizações. O registro original não é reescrito; cria-se uma preferência auditável sobre ele.

Uma tag automática não revisada pode aparecer numa camada de descoberta, visualmente diferente. Ela não altera a gravidade padrão, não vira risco e não aciona sozinha um alerta crítico.

---

## 8. Os cinco conceitos que não podem ser confundidos

### 8.1 Atenção

É a resposta para: **“vale a pena eu olhar para isto agora?”**

Vai de 0 a 100. É uma ordem de prioridade para a interface, não uma nota sobre o paciente.

### 8.2 Densidade de evidências

É a resposta para: **“quanto material revisado sustenta este tema?”**

Um tema fica mais denso quando reaparece em registros diferentes, em datas diferentes e com vínculos confirmados. Densidade não significa gravidade clínica nem diagnóstico.

### 8.3 Tensão observada

É a resposta para: **“algo está mudando ou ganhando força?”**

Tensão representa aceleração, mudança ou aproximação entre temas. Ela pode ser positiva, negativa ou ambígua. Um aumento em “autocuidado”, por exemplo, também pode gerar movimento visual sem representar perigo.

### 8.4 Confiança dos dados

É a resposta para: **“temos base suficiente para dar importância a esse cálculo?”**

Uma pontuação alta com confiança baixa deve ser apresentada como algo a conferir, não como certeza.

### 8.5 Risco registrado

É a resposta para: **“o profissional já registrou risco médio ou alto?”**

Risco é uma dimensão independente. O sistema não converte densidade, tensão, emoção de texto, quantidade de notas ou aparência do grafo em risco clínico.

---

## 9. O cálculo que já existe como fundação

A base atual do NeuroVision usa cinco partes. Cada parte é transformada em um valor entre 0 e 100 e depois recebe uma importância diferente:

| Parte | Peso atual | Em linguagem comum |
|---|---:|---|
| Recência | 30% | Isso aconteceu há pouco tempo? |
| Recorrência | 25% | Esse tema apareceu várias vezes nos últimos 90 dias? |
| Diversidade de fontes | 20% | Ele aparece em tipos diferentes de registro? |
| Ação pendente | 15% | Existe algo aberto que pede acompanhamento? |
| Prioridade do psicólogo | 10% | O profissional marcou isto como importante? |

Em forma curta:

> **Atenção base = 30% recência + 25% recorrência + 20% diversidade de fontes + 15% ação pendente + 10% prioridade do psicólogo.**

Essa fórmula é uma **regra explicável de priorização do produto**. Ela não é uma escala psicológica validada, não foi criada para diagnosticar e não representa a probabilidade de um evento clínico acontecer.

### Por que preservar essa fundação

- Ela usa informações que o sistema já conhece.
- É simples de explicar e auditar.
- Dá destaque ao que é recente sem apagar padrões antigos que continuam se repetindo.
- Evita depender de uma única fonte.
- Mantém um espaço explícito para a decisão humana.
- Permite evoluir o produto sem reconstruir toda a base.

Os pesos exatos não foram retirados de um estudo que diga “recência deve valer 30%”. Não existe validação científica específica para essa combinação no contexto da NeuroNex. Eles são uma hipótese de produto que deverá ser versionada, observada e validada em uso real. A ciência e as normas sustentam **os princípios** — transparência, supervisão humana, múltiplas evidências, avaliação contínua —, não esses números particulares.

---

## 10. O cálculo completo planejado

Para tornar a ferramenta mais inteligente sem misturar conceitos, a evolução final terá três cálculos visíveis: **densidade**, **tensão** e **atenção**. A confiança acompanhará os três.

Todos os pesos, janelas e cortes desta seção são a **versão proposta da regra de negócio**, criada para ser clara, conservadora e testável. Eles ainda não são uma escala psicológica validada nem limites clínicos universais. Antes de qualquer uso como previsão clínica, precisarão de avaliação com profissionais, análise de vieses e validação no contexto real. Até lá, servem para organizar a interface e priorizar revisão humana.

### 10.1 Recência: o quanto isso ainda está perto do presente

A recência começa próxima de 100 quando o registro é novo e cai pela metade a cada 30 dias:

| Idade aproximada | Recência |
|---:|---:|
| Hoje | 100 |
| 30 dias | 50 |
| 60 dias | 25 |
| 90 dias | 13 |

Em linguagem comum: o sistema não considera que algo “vence” de repente. A influência vai diminuindo aos poucos.

**Por que 30 dias?** É uma janela de produto adequada à preparação de sessões e ao filtro de recentes. Não é um limite clínico universal. Ela deverá ser configurável por versão e validada com profissionais, mas não poderá ser alterada silenciosamente.

### 10.2 Recorrência: quantas vezes o tema voltou

O sistema conta até cinco ocorrências em uma janela de 90 dias:

| Ocorrências válidas | Recorrência |
|---:|---:|
| 0 | 0 |
| 1 | 20 |
| 2 | 40 |
| 3 | 60 |
| 4 | 80 |
| 5 ou mais | 100 |

Uma ocorrência válida precisa vir de um registro distinto. Repetir a mesma palavra dez vezes dentro da mesma nota não vale como dez ocorrências. Sempre que possível, ocorrências em datas diferentes devem ser mostradas separadamente.

**Por que limitar em cinco?** Para evitar que um tema com muitas notas antigas domine para sempre o mapa. Depois de cinco ocorrências, o sistema já entendeu que existe repetição; a recência e a tensão passam a dizer se aquilo continua ativo ou está mudando.

### 10.3 Diversidade de fontes: quantos ângulos sustentam o tema

O sistema conta até quatro tipos diferentes de fonte:

| Tipos de fonte | Diversidade |
|---:|---:|
| 0 | 0 |
| 1 | 25 |
| 2 | 50 |
| 3 | 75 |
| 4 ou mais | 100 |

Três notas pessoais ainda representam um único tipo de fonte. Uma nota, uma meta e três registros de humor representam três tipos.

**Por que isso entra no cálculo?** Porque um tema sustentado apenas por um tipo de registro é diferente de um tema que aparece em vários pontos da rotina. Isso aumenta sustentação, não “verdade clínica”. Fontes podem repetir o mesmo erro; por isso a confiança e a revisão continuam necessárias.

### 10.4 Sustentação das relações: quão bem explicado está o vínculo

Uma conexão entre dois nós recebe sustentação apenas quando existe uma origem visível:

- vínculo criado diretamente pelo psicólogo: sustentação 100;
- tema ou relação automática confirmada pelo psicólogo: sustentação 80;
- relação baseada apenas em sugestão automática não revisada: não entra na camada clínica principal;
- relação rejeitada: sustentação 0 e não volta a ser sugerida sem nova evidência relevante.

Quando houver várias relações válidas, será usada a média das três mais fortes. O limite de três evita que dezenas de vínculos fracos pareçam mais importantes que poucos vínculos claros.

**Importante:** conexão visual não prova causa. Ela pode representar associação, sequência, tema compartilhado ou vínculo criado pelo psicólogo. O tipo de conexão precisa estar escrito.

### 10.5 Densidade de evidências

A densidade planejada será:

> **Densidade = 45% recorrência + 35% diversidade de fontes + 20% sustentação das relações.**

Em linguagem comum:

- repetição pesa mais porque mostra que o assunto não apareceu uma única vez;
- diversidade vem logo depois porque reduz a dependência de um único tipo de registro;
- sustentação garante que as conexões mostradas tenham uma explicação rastreável.

A densidade controla principalmente **o tamanho do nó** e participa da proximidade do núcleo. Ela não controla a cor de risco.

### 10.6 Aceleração recente

Para saber se um tema está ganhando força, o sistema compara os últimos 14 dias com os 14 dias anteriores:

| Aumento no número de ocorrências | Aceleração |
|---:|---:|
| Não aumentou | 0 |
| 1 ocorrência a mais | 25 |
| 2 a mais | 50 |
| 3 a mais | 75 |
| 4 ou mais | 100 |

Essa medida captura movimento, não volume. Um tema muito frequente e estável pode ter densidade alta e aceleração baixa. Um tema pequeno que acabou de surgir várias vezes pode ter densidade moderada e aceleração alta.

### 10.7 Mudança em registros objetivos

Quando existir uma escala comparável — por exemplo, humor registrado sempre na mesma escala — o sistema compara a mediana dos sete dias recentes com a mediana dos sete dias anteriores. A mudança é calculada como a parte da escala total que foi percorrida.

Exemplo: numa escala de 1 a 5, uma mudança de 1 ponto percorre um quarto do intervalo total. Isso equivale a 25 de mudança.

O sistema mostra também a direção: subiu, desceu ou oscilou. A palavra “piorou” só pode ser usada se a própria escala tiver esse significado declarado. Uma mudança numérica, sozinha, não recebe interpretação clínica automática.

Sem pelo menos três registros comparáveis, esse componente fica indisponível; ele não recebe zero.

### 10.8 Fortalecimento de conexões

O sistema compara a sustentação de uma ligação nos últimos 30 dias com os 30 dias anteriores:

- sem crescimento: 0;
- crescimento pequeno: 25;
- crescimento moderado: 50;
- crescimento forte: 75;
- ligação nova e repetidamente sustentada: 100.

O detalhe “Por que está aqui?” deve mostrar quais registros criaram essa mudança. Uma semelhança encontrada automaticamente e ainda não revisada pode ser exibida como descoberta, mas não conta como relação clínica confirmada.

### 10.9 Tensão observada

A tensão planejada será:

> **Tensão = 40% aceleração recente + 30% mudança em registros objetivos + 30% fortalecimento de conexões.**

Em linguagem comum: o sistema olha primeiro para a velocidade com que o tema reaparece e depois para mudanças objetivas e novas convergências.

Se uma parte não estiver disponível, os pesos das partes disponíveis são redistribuídos entre elas e a confiança cai. Dado ausente nunca será tratado como “tudo bem” nem como “problema”. Ele significa apenas “não sabemos”.

### 10.10 Ação pendente

Para a versão completa, o componente de ação terá quatro níveis:

| Situação | Ação pendente |
|---|---:|
| Nenhuma ação ou ação concluída | 0 |
| Aberta, sem prazo próximo | 50 |
| Vence em até 7 dias | 70 |
| Vencida, revisão pendente ou marcada como urgente | 100 |

Em linguagem comum: uma tarefa aberta merece atenção, mas uma tarefa vencida merece mais.

### 10.11 Prioridade definida pelo psicólogo

É um valor manual de 0 a 100. O padrão é zero. Ele existe porque o contexto profissional não cabe inteiro numa fórmula.

O psicólogo pode:

- aumentar ou reduzir a prioridade;
- fixar um item;
- ocultar um item sem apagar a fonte;
- corrigir o tema;
- substituir a atenção final por um valor manual, desde que informe um motivo.

O valor automático original deve ser preservado para auditoria. A interface precisa deixar evidente quando o número mostrado foi alterado manualmente.

### 10.12 Atenção final de um tema ou evidência

A versão completa será:

> **Atenção = 30% densidade + 25% tensão + 20% recência + 15% ação pendente + 10% prioridade do psicólogo.**

Essa pontuação controla **ordem, proximidade e destaque**. Ela não representa risco, severidade, diagnóstico ou chance de crise.

### 10.13 Atenção geral do paciente

Para ordenar o Radar vivo sem somar tudo indiscriminadamente:

> **Atenção do paciente = 55% do tema com maior atenção + 30% da média dos três temas principais + 15% das pendências críticas.**

Isso evita dois erros:

- um único ponto forte desaparecer numa média de centenas de notas;
- dezenas de pontos pequenos fazerem o paciente parecer artificialmente urgente.

Se o paciente tiver risco médio ou alto **já registrado**, ele sobe imediatamente para a faixa de atenção do Radar com o motivo “Risco registrado”. O valor de risco continua separado e não reescreve a pontuação de atenção.

### 10.14 Confiança do cálculo

A confiança não será exibida como grande número no panorama, mas estará na explicação:

> **Confiança = 35% proporção revisada + 25% diversidade de fontes + 25% distribuição em datas diferentes + 15% completude dos dados necessários.**

Tradução de cada parte:

- **proporção revisada:** quanto do material foi conferido pelo psicólogo;
- **diversidade:** quantos tipos de registro apoiam o cálculo;
- **datas diferentes:** se o padrão se repetiu ao longo do tempo, e não apenas num único momento;
- **completude:** se existiam os dados necessários para calcular todos os componentes.

Uma atenção 88 com confiança 42 deve aparecer como “forte sinal para conferir”. Uma atenção 88 com confiança 86 pode aparecer como “prioridade bem sustentada”. Nenhuma das duas vira diagnóstico.

### 10.15 Risco registrado

O filtro **Em risco** usa exclusivamente um valor já registrado:

- escalas de 0 a 10: entra a partir de **4**;
- escalas de 0 a 100: entra a partir de **40**.

Se a escala não estiver declarada, valores acima de 10 são tratados como escala 0–100; os demais, como 0–10. O ideal é que a escala seja sempre armazenada explicitamente.

Nenhuma tag, sentimento de texto, densidade, tensão, semelhança ou padrão automático poderá criar ou alterar risco.

---

## 11. Exemplo completo, sem “matematiquês”

Suponha que o tema “trabalho” de Carlos tenha:

- aparecido quatro vezes em 90 dias: recorrência 80;
- surgido em nota, sessão e meta: diversidade 75;
- relações confirmadas com sustentação média 70;
- ganhado três ocorrências em relação às duas semanas anteriores: aceleração 75;
- apresentado mudança objetiva 50 nos registros disponíveis;
- fortalecido a ligação com “sono” em 80;
- recebido recência 88;
- uma ação vencida: ação pendente 100;
- prioridade manual 80.

Primeiro, a densidade:

> 45% de 80 + 35% de 75 + 20% de 70 = aproximadamente **76**.

Depois, a tensão:

> 40% de 75 + 30% de 50 + 30% de 80 = **69**.

Por fim, a atenção:

> 30% de 76 + 25% de 69 + 20% de 88 + 15% de 100 + 10% de 80 = aproximadamente **81**.

A interface poderia dizer:

> **“Atenção 81/100. O tema trabalho aparece em quatro registros recentes, em três tipos de fonte, ganhou força nas últimas duas semanas e possui uma ação vencida. Você também o marcou como prioridade 80.”**

No 3D, “trabalho” aparece mais perto do núcleo, com tamanho proporcional à densidade e um pulso sutil que representa movimento recente. As linhas até “sono” ficam visíveis quando o psicólogo passa o mouse, usa o teclado, seleciona o tema ou pede ao Synapse para mostrá-las.

O sistema **não** deve concluir: “Carlos está entrando em burnout”. Uma redação segura seria:

> “O tema trabalho ganhou frequência e aparece ligado a sono em registros revisados. Vale conferir se essa relação continua relevante para a sessão de hoje.”

---

## 12. Quando o sistema poderá avisar proativamente

Alertas demais viram ruído e ensinam o profissional a ignorar o produto. Por isso, o alerta proativo terá regras mais exigentes que o simples destaque visual.

Um alerta automático poderá ser criado quando ocorrer pelo menos uma das situações abaixo:

1. atenção igual ou superior a 85, confiança igual ou superior a 70 e sustentação por pelo menos dois tipos de fonte **ou** três registros em datas diferentes;
2. atenção igual ou superior a 70 e aumento de pelo menos 20 pontos nos últimos 14 dias;
3. risco médio ou alto já registrado;
4. prioridade urgente marcada diretamente pelo psicólogo.

Depois de um alerta, o mesmo assunto entra numa pausa de sete dias. Ele só volta antes disso se houver:

- novo registro de risco;
- novo tipo de fonte;
- aumento adicional de pelo menos 10 pontos;
- solicitação direta do psicólogo.

Uma inferência automática não revisada nunca dispara sozinha um alerta crítico.

Todo alerta precisa conter:

- o que mudou;
- o período observado;
- os registros de origem;
- o grau de confiança;
- o que é fato, padrão ou hipótese;
- um CTA como “ver no NeuroVision” ou “conversar com o Synapse”.

Exemplo seguro:

> **“O tema ‘mãe’ passou a compartilhar mais evidências revisadas com ‘crise de pânico’ nos últimos 30 dias. Esta é uma associação documental, não uma relação causal. Ver as fontes?”**

---

## 13. O que “preditivo” deve significar aqui

O sistema poderá ser preditivo no sentido de **mostrar trajetórias prováveis se um padrão observado continuar**, sempre com linguagem condicional e confiança visível.

Exemplos aceitáveis:

- “Se o ritmo atual continuar, esta pendência tende a chegar à próxima sessão ainda aberta.”
- “Este tema reapareceu em três ciclos semelhantes; há chance de recorrência que merece acompanhamento.”
- “A ligação ganhou força nas últimas duas semanas, mas ainda possui pouca diversidade de fontes.”

Exemplos proibidos sem modelo clínico validado para essa finalidade:

- “Há 82% de chance de crise.”
- “O paciente desenvolverá burnout.”
- “A causa inconsciente é a relação com a mãe.”
- “O sistema detectou um diagnóstico que o psicólogo não viu.”

Uma pontuação de 82/100 na NeuroBox é uma prioridade interna de atenção, não 82% de probabilidade. Estudos sobre modelos preditivos em saúde mostram que números de risco podem ser enganosos quando não foram devidamente calibrados e validados ([Van Calster et al., *Calibration: the Achilles heel of predictive analytics*](https://link.springer.com/article/10.1186/s12916-019-1466-7)).

Qualquer futura probabilidade clínica exigirá, antes de chegar ao produto:

- desfecho claramente definido;
- população e contexto de uso definidos;
- amostra adequada e representativa;
- validação externa;
- teste de calibração;
- avaliação de vieses;
- avaliação em ambiente clínico real;
- revisão ética, jurídica e profissional;
- comunicação que permita contestação e supervisão humana.

Até isso existir, o sistema deve falar em **sinal, padrão, mudança, associação, prioridade e hipótese**, nunca em certeza clínica.

---

## 14. Como os cálculos viram espaço no NeuroVision 3d

Cada dimensão visual tem um único significado principal:

| Elemento visual | O que representa |
|---|---|
| Distância do paciente | Atenção: itens mais prioritários ficam mais próximos |
| Tamanho da esfera | Densidade de evidências |
| Pulso ou halo | Tensão ou mudança recente |
| Profundidade | Tempo |
| Direção ao redor do núcleo | Tema clínico revisado |
| Espessura do filamento em destaque | Sustentação da relação |
| Cor de risco | Apenas risco registrado |
| Opacidade | Nível de detalhe ou confiança, nunca ocultação de risco |

### Regras para não enganar visualmente

- Gravidade, elasticidade, distância e repulsão controladas pelo usuário são ajustes de navegação. Elas não podem alterar a pontuação clínica.
- Uma esfera nunca pode atravessar ou ocupar o mesmo espaço físico que outra, mas a prevenção de colisão não pode ser interpretada como repulsão clínica.
- Tamanho mínimo visual não altera o tamanho invisível de clique e foco.
- Cor nunca será o único sinal; texto, ícone, padrão e explicação precisam acompanhar estados importantes.
- Movimento pode reforçar uma mudança, mas não pode criar urgência artificial.
- `prefers-reduced-motion` deve reduzir ou remover rotação, pulsação e transições não essenciais.
- A lista acessível de nós deve oferecer a mesma seleção, foco, explicação e retorno por teclado.
- Os rótulos precisam permanecer estáveis durante a rotação; eles não podem piscar a cada quadro.

Esses cuidados seguem as áreas de acessibilidade, cor, movimento e feedback das [Human Interface Guidelines da Apple](https://developer.apple.com/design/human-interface-guidelines/). O objetivo é uma experiência premium que continue compreensível, previsível e utilizável.

### Zoom semântico

O 3D não deve tentar mostrar mil notas ao mesmo tempo.

- **Distante:** pacientes, halos de atenção e grandes troncos temáticos.
- **Intermediário:** temas, fluxos e evidências principais.
- **Próximo:** notas, sessões, metas, humor e detalhes.

As conexões individuais aparecem com zoom, hover, foco ou seleção. No panorama, elas são agrupadas em troncos orgânicos por paciente e tema. Isso preserva desempenho e reduz a “paçoca” visual.

---

## 15. Descobertas práticas que justificam o NeuroVision

O valor não está em “ter um grafo”. Está em responder rapidamente perguntas que hoje exigiriam abrir e comparar vários registros.

### Em segundos, o psicólogo poderá perguntar

- O que mudou desde a última sessão?
- Qual assunto está se repetindo mais?
- Essa repetição aparece em uma única nota ou em fontes diferentes?
- Qual tema reapareceu depois de meses?
- Que assuntos começaram a se aproximar no tempo?
- Existe alguma ponte recorrente entre dois grupos de contexto?
- Há alguma pendência importante sem acompanhamento?
- O que ganhou força depois de uma intervenção registrada?
- Quais hipóteses possuem evidência contrária?
- O que o sistema sugeriu, o que foi confirmado e o que foi corrigido por mim?
- Por que este paciente está no Radar?

### Descobertas automáticas úteis

- aceleração ou desaceleração de um tema;
- reaparecimento depois de um período sem registros;
- convergência entre fontes diferentes;
- sequência recorrente de acontecimentos;
- tema denso sem meta, pergunta ou ação associada;
- mudança observada depois de um ponto do Flow;
- relação forte baseada em pouca evidência, marcada como frágil;
- hipótese com muito apoio, mas também com evidência contrária relevante;
- fator de proteção que costuma aparecer antes de uma melhora registrada.

Essas descobertas não precisam esperar uma pergunta. Elas podem surgir no Radar, desde que respeitem as regras de confiança e alerta.

---

## 16. Por que essa organização faz sentido

### Visualização ajuda quando reduz a carga de juntar informações

Uma revisão sistemática de 112 estudos sobre visualização de registros de saúde encontrou dois grupos especialmente úteis: visões de linha do tempo para acompanhar tendências longitudinais e visões de resumo para avaliação rápida ([Fan, Hardi e Yen, 2025](https://pubmed.ncbi.nlm.nih.gov/40581801/)). Isso embasa a divisão entre o 3D temporal/exploratório e o 2D preciso/operacional.

### Redes são uma lente possível, não uma prova causal

A abordagem de redes em psicopatologia estuda sintomas e problemas como elementos que podem se relacionar e formar ciclos ([Borsboom, 2017](https://pmc.ncbi.nlm.nih.gov/articles/PMC5269502/)). Isso inspira a visualização de conexões, mas não autoriza a NeuroNex a afirmar causalidade a partir de proximidade ou correlação. O grafo é uma forma de organizar evidências e hipóteses, não uma demonstração de causa.

### Explicabilidade é essencial em apoio à decisão clínica

Uma revisão sistemática sobre interpretabilidade em sistemas clínicos destaca a importância de mostrar uma relação clara entre entrada e saída e de adaptar a explicação às necessidades de profissionais e pacientes ([Lyu et al., 2023](https://pubmed.ncbi.nlm.nih.gov/36776958/)). Isso fundamenta “Por que está aqui?”, a trilha de origem e a separação entre fato, padrão e hipótese.

### Benefício real precisa ser avaliado no uso, não apenas numa demonstração bonita

A diretriz DECIDE-AI observa que poucos sistemas de apoio por IA demonstraram benefício real ao cuidado e recomenda avaliação clínica inicial, segurança e fatores humanos em situações reais ([Vasey et al., 2022](https://www.nature.com/articles/s41591-022-01772-9)). Por isso, a NeuroNex não deve prometer melhora de desfecho clínico antes de validar a ferramenta com profissionais e uso real.

### A pessoa e o profissional permanecem no controle

A Organização Mundial da Saúde recomenda autonomia humana, segurança, transparência, explicabilidade, responsabilização, inclusão e avaliação contínua para IA em saúde ([OMS, 2021](https://www.who.int/news/item/28-06-2021-who-issues-first-global-report-on-ai-in-health-and-six-guiding-principles-for-its-design-and-use)). A OMS também alerta que modelos de linguagem podem produzir respostas plausíveis e erradas e pede evidência de benefício antes de adoção ampla na rotina de saúde ([OMS, 2023](https://www.who.int/news/item/16-05-2023-who-calls-for-safe-and-ethical-ai-for-health)).

### A Psicologia não pode terceirizar julgamento para a IA

O CFP orienta que ferramentas de IA podem apoiar gestão e sistematização, mas não substituir julgamento ético e técnico. Também enfatiza supervisão, transparência, consentimento informado, proteção de dados e cuidado com vieses e superconfiança ([Guia do CFP, 2025](https://site.cfp.org.br/wp-content/uploads/2025/12/Cartilha_IA_A5-1.pdf)).

### Dados de saúde exigem proteção reforçada

A LGPD classifica dados de saúde como dados pessoais sensíveis, exige finalidade, necessidade, transparência, segurança, prevenção, não discriminação e prestação de contas, e garante informação sobre critérios de decisões automatizadas ([texto oficial da LGPD](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)). A ANPD também apresenta como direitos do titular conhecer critérios, pedir explicação e contestar decisões automatizadas que afetem seus interesses ([Direitos dos titulares — ANPD](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares)).

### Transparência não é um detalhe de interface

A ANPD identifica falta de transparência, uso de dados para novas finalidades e vieses como riscos relevantes em IA e coloca a transparência algorítmica no centro de sua iniciativa regulatória ([ANPD — Por que Inteligência Artificial?](https://www.gov.br/anpd/pt-br/assuntos/projetos-acoes-iniciativas/sandbox/por-que-inteligencia-artificial)). Por isso, origem, critérios, versão e possibilidade de correção são requisitos de negócio, não recursos opcionais.

---

## 17. Privacidade e segurança em linguagem simples

### Cada profissional só vê o que é seu

O índice e as preferências precisam ser separados por profissional. Não basta exigir que alguém esteja conectado; cada leitura e alteração precisa conferir se aquele registro pertence àquela pessoa. Na base atual, essa proteção deve ser aplicada dentro do próprio banco, por registro, combinando apenas as permissões necessárias com políticas de propriedade ([documentação oficial do Supabase sobre Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)).

### A interface recebe apenas o necessário

No panorama, a aplicação recebe resumos e metadados. O conteúdo detalhado da fonte é buscado apenas quando solicitado e autorizado.

### Sugestão não apaga o original

Fixar, ocultar, mudar prioridade ou corrigir tema cria uma preferência separada. O registro clínico original permanece intacto e auditável.

### Toda automação importante deixa rastro

O sistema registra:

- regra e versão utilizadas;
- momento do cálculo;
- fontes consideradas;
- resultado automático;
- mudança manual;
- motivo da mudança;
- quem realizou a revisão.

### Consentimento não pode ser genérico

A base legal aplicável precisa ser definida e documentada por finalidade. Quando o consentimento for a base adequada ou exigida, ele deve ser específico, informado, destacado e revogável. “Aceitar tudo para usar o sistema” não serve como autorização genérica para qualquer nova análise.

### Áudio e transcrição exigem cuidado separado

Na primeira versão da inteligência clínica, não haverá análise de prosódia, emoção da voz ou características acústicas. O CFP chama atenção para riscos de erro, sigilo, armazenamento e ausência de consentimento em transcrição de sessões; portanto, qualquer etapa futura envolvendo áudio exigirá decisão específica de produto, avaliação jurídica e consentimento adequado ([Guia do CFP, exemplo sobre transcrição automática](https://site.cfp.org.br/wp-content/uploads/2025/12/Cartilha_IA_A5-1.pdf)).

---

## 18. Situação da base já existente no projeto

O projeto já possui partes importantes desta fundação:

- fórmula base de recência, recorrência, diversidade de fontes, ação e prioridade;
- meia-vida de 30 dias e recorrência em 90 dias;
- separação entre risco registrado e gravidade de evidências;
- fontes tipadas para nota, fluxo, sessão, humor, meta, anamnese, agenda e lembrete;
- preferências para prioridade, fixação, ocultação e correção de tema;
- posicionamento 3D em que distância representa gravidade, profundidade representa tempo e direção representa tema;
- filtros Todos, Pacientes, Recentes e Em risco;
- busca de caminho mais curto entre evidência e paciente;
- controlador assíncrono de cena preparado para comandos futuros do Synapse;
- estrutura do NeuroPulse com diagramas Mermaid;
- NeuroFlow editável e vinculável a pacientes, notas, arquivos, Pulse e diagramas;
- uma migração local para o índice de evidências e isolamento por profissional.

Ainda não se deve afirmar que toda a inteligência descrita neste documento está pronta. Permanecem como trabalho planejado:

- tags semânticas automáticas com revisão e versionamento;
- densidade, tensão e confiança completas;
- comparação longitudinal robusta;
- alertas proativos com limiar e pausa;
- Pulse com fatos, hipóteses, apoio e contrapontos separados;
- retorno estruturado do Flow como evidência de acompanhamento;
- integração completa da voz com os comandos tipados;
- avaliação real de utilidade, segurança, carga cognitiva e vieses.

A existência de uma migração no repositório não prova que ela esteja aplicada em todos os ambientes. Cada implantação deverá confirmar schema, permissões, políticas de isolamento, atualização do índice e funcionamento da assinatura em tempo real.

---

## 19. Como validar se a promessa está sendo cumprida

Não basta medir quadros por segundo ou quantidade de cliques. A validação deve responder:

- O psicólogo encontra a origem de um destaque sem ajuda?
- Ele diferencia atenção de risco?
- Ele entende o que foi calculado e o que foi sugerido?
- Consegue corrigir uma tag ou prioridade?
- O produto reduz o tempo de preparação sem aumentar superconfiança?
- Alertas importantes são vistos? Alertas irrelevantes são poucos?
- O profissional encontra evidência contrária, ou o sistema só confirma sua primeira impressão?
- A visão 3D revela algo útil além do 2D?
- O 2D continua eficiente para edição e conferência?
- O Pulse melhora a organização de hipóteses sem fazê-las parecer fatos?
- O Flow aumenta a continuidade do acompanhamento?
- O sistema funciona com teclado, movimento reduzido e contraste adequado?
- Os resultados permanecem consistentes entre profissionais, sem favorecer ou prejudicar grupos?

Antes de prometer “melhora de resultado clínico”, será necessário estudo apropriado. A primeira promessa honesta do produto é: **reduzir o esforço de recuperar, comparar, explicar e acompanhar informações clínicas registradas**.

---

## 20. Regras de negócio obrigatórias

As regras abaixo são permanentes até que uma decisão explícita, documentada e revisada as substitua.

### RB-01 — Atenção não é risco

O valor 0–100 mostrado pelo NeuroVision chama-se **Atenção**. Ele não pode ser apresentado como risco, probabilidade, severidade, diagnóstico ou prognóstico.

### RB-02 — Risco só vem de registro existente

O filtro Em risco utiliza apenas risco registrado. Corte 4 em escala 0–10 e 40 em escala 0–100. Nenhuma inferência cria ou altera risco.

### RB-03 — Fato, padrão e hipótese são camadas diferentes

O sistema nunca pode misturar essas três categorias visualmente ou nos dados.

### RB-04 — O psicólogo tem precedência

Correções, tags, prioridades e decisões do profissional prevalecem sobre sugestões automáticas. Toda alteração manual deve ser auditável e o valor automático original deve permanecer disponível.

### RB-05 — “Por que está aqui?” é obrigatório

Todo destaque, alerta, pontuação, tag automática ou conexão sugerida precisa mostrar origem, datas, critérios, estado de revisão e versão da regra.

### RB-06 — Uma sugestão não revisada não pesa na camada clínica padrão

Ela pode aparecer como descoberta separada, mas não altera gravidade confirmada, risco ou alerta crítico sozinha.

### RB-07 — Conexão não significa causa

Toda aresta precisa declarar seu tipo: vínculo manual, tema compartilhado, sequência temporal, associação documental ou hipótese.

### RB-08 — Sem ação clínica autônoma

Pulse, Flow e Synapse não confirmam diagnóstico, não escolhem conduta e não enviam ação clínica ao paciente sem confirmação do psicólogo.

### RB-09 — Sem comparação clínica entre pacientes

O Radar pode ordenar motivos de atenção para o próprio profissional, mas não cria ranking de “melhor”, “pior”, “mais grave” ou diagnóstico comparativo entre pacientes.

### RB-10 — Somente dados necessários

O grafo usa índice resumido. Transcrições completas e conteúdo bruto não são carregados no panorama. Detalhes são buscados sob demanda.

### RB-11 — Isolamento por profissional

Todas as tabelas expostas contendo esses dados precisam de controle por linha e verificação de propriedade. Estar autenticado, sozinho, não autoriza acesso a todos os registros.

### RB-12 — Física visual não altera significado clínico

Gravidade, elasticidade, distância, repulsão, rotação e colisão da cena podem mudar a apresentação, mas nunca os cálculos ou o conteúdo clínico. O controle do 3D não pode afetar o 2D.

### RB-13 — A fórmula é versionada

Pesos, janelas, limites e nomes não podem ser alterados silenciosamente. Uma mudança exige nova versão, justificativa, testes, registro de migração e explicação de impacto.

### RB-14 — Dados ausentes não valem zero

Quando um componente não pode ser calculado, os componentes disponíveis são redistribuídos e a confiança diminui. Ausência de registro não equivale a ausência de problema.

### RB-15 — Alertas precisam de sustentação e pausa

Os limiares, a exigência de fontes/datas e o intervalo de sete dias devem ser respeitados. Uma única inferência automática não revisada não gera alerta crítico.

### RB-16 — Sem análise de voz na primeira versão

Prosódia, emoção acústica e inferências a partir do tom de voz estão fora do escopo da primeira versão. Uma futura inclusão exige consentimento, governança e validação próprios.

### RB-17 — O 2D e o 3D compartilham o mesmo significado

Eles consomem os mesmos dados, pontuações e explicações. O 3D não pode inventar uma conclusão que não exista no 2D; muda a forma de explorar, não a verdade de base.

### RB-18 — A interface visual desta fase é profissional desktop/tablet

Componentes visuais do painel profissional não devem ser importados para o portal do paciente, páginas públicas ou futura aplicação profissional mobile. Regras de domínio, tipos e serviços neutros podem ser compartilhados.

### RB-19 — Escala e linguagem precisam ser acessíveis

O tamanho visual dos nós não pode reduzir a área de interação. Cor e animação não podem ser o único meio de comunicação. Teclado, foco visível, Escape, lista de nós e redução de movimento são obrigatórios.

### RB-20 — Desempenho não pode apagar significado

Para conjuntos grandes, o sistema agrega por paciente e tema e abre detalhes com zoom. Não se pode remover silenciosamente evidências relevantes apenas para aumentar desempenho; qualquer amostragem precisa ser indicada.

---

## 21. Overrides — pontos que nenhum agente pode mudar isoladamente

Esta seção é o bloqueio de segurança para futuras alterações automáticas.

### OVERRIDE-01 — autoridade humana

Nenhum agente, modelo, função de banco ou componente de interface pode promover hipótese automática a fato confirmado sem ação explícita do psicólogo.

### OVERRIDE-02 — risco independente

É proibido derivar risco clínico de atenção, densidade, tensão, sentimento, tags, embeddings, palavras, frequência, aparência visual ou comportamento de navegação.

### OVERRIDE-03 — significado visual estável

Distância = atenção; tamanho = densidade; pulso/halo = tensão; profundidade = tempo; direção = tema; cor de risco = risco registrado. Uma alteração dessa legenda exige decisão de produto e atualização deste documento, tipos, testes, textos e explicações.

### OVERRIDE-04 — fórmula pública e auditável

O resultado exibido precisa ser reproduzível a partir de parâmetros guardados. Não substituir a fórmula principal por uma “caixa-preta” sem explicação equivalente.

### OVERRIDE-05 — origem obrigatória

Nenhuma pontuação ou conexão clínica pode existir sem IDs de fonte, datas, proprietário, estado de revisão e versão.

### OVERRIDE-06 — preferência do psicólogo preservada

Uma nova análise automática não pode sobrescrever silenciosamente tag, tema, prioridade, fixação, ocultação ou correção realizada pelo profissional.

### OVERRIDE-07 — sem conteúdo bruto no panorama

Não carregar transcrições completas, áudio ou textos clínicos integrais no grafo geral. Buscar detalhes apenas sob demanda e com autorização.

### OVERRIDE-08 — proteção entre contas

Não remover controle por linha, não autorizar apenas por papel “autenticado”, não usar metadado editável do usuário como decisão de acesso e não expor chave privilegiada no cliente.

### OVERRIDE-09 — Synapse conduz, não governa

O Synapse pode navegar, selecionar, explicar e preparar contexto. Ele não modifica os limites clínicos nem ganha autoridade superior à interface ou ao profissional.

### OVERRIDE-10 — Pulse e Flow devolvem camadas identificadas

Saídas do Pulse retornam como hipóteses até revisão. Saídas do Flow retornam como plano, ação ou resultado observado. Nenhuma delas pode voltar ao Vision com o rótulo errado.

### OVERRIDE-11 — sem promessa clínica antes da validação

Não escrever no produto ou marketing que a NeuroBox diagnostica, prevê crises, descobre o inconsciente, melhora desfechos ou supera julgamento profissional sem evidência e autorização adequadas.

### OVERRIDE-12 — mudança exige avaliação em conjunto

Uma mudança em cálculo, dados, textos, cores, alertas ou integração deve ser avaliada nas quatro partes: Vision, Pulse, Flow e Synapse. Alterar apenas uma tela pode quebrar o ciclo inteiro.

---

## 22. Checklist para qualquer agente de IA antes de alterar o código

1. Ler este documento inteiro.
2. Identificar se a mudança toca alguma RB ou OVERRIDE.
3. Separar claramente estado atual, proposta e comportamento validado.
4. Conferir tipos compartilhados e a origem dos dados.
5. Confirmar isolamento por profissional e mínimo de dados.
6. Preservar a separação entre fato, padrão, hipótese, atenção e risco.
7. Se alterar fórmula, criar versão nova e explicar a migração.
8. Se alterar uma representação visual, confirmar que o significado permanece igual no 2D e 3D.
9. Se alterar Pulse ou Flow, confirmar como o resultado retorna ao Vision.
10. Se alterar comandos do Synapse, manter espera pela cena, confirmação, erro e equivalência com mouse/teclado.
11. Cobrir origem, revisão, correção, rejeição e auditoria.
12. Verificar acessibilidade, modo claro/escuro, movimento reduzido e navegação por teclado.
13. Verificar conjuntos grandes sem ocultar informação de modo enganoso.
14. Nunca declarar valor clínico que ainda não foi medido.

---

## 23. Referências principais

### Psicologia, ética e exercício profissional

- [Conselho Federal de Psicologia — Posicionamento sobre Inteligência Artificial e Psicologia (2025)](https://site.cfp.org.br/cfp-divulga-posicionamento-sobre-inteligencia-artificial-no-contexto-da-pratica-psicologica/)
- [Conselho Federal de Psicologia — Inteligência Artificial na Psicologia: guia para uma prática ética e responsável (2025)](https://site.cfp.org.br/wp-content/uploads/2025/12/Cartilha_IA_A5-1.pdf)
- [Conselho Federal de Psicologia — página oficial do guia](https://site.cfp.org.br/publicacao/inteligencia-artificial-na-psicologia-guia-para-uma-pratica-etica-e-responsavel/)

### Proteção de dados e decisões automatizadas

- [Brasil — Lei Geral de Proteção de Dados Pessoais, Lei nº 13.709/2018](https://www.planalto.gov.br/ccivil_03/_ato2015-2018/2018/lei/l13709.htm)
- [ANPD — Direitos dos titulares de dados](https://www.gov.br/anpd/pt-br/assuntos/titular-de-dados-1/direito-dos-titulares)
- [ANPD — Transparência e desafios da inteligência artificial](https://www.gov.br/anpd/pt-br/assuntos/projetos-acoes-iniciativas/sandbox/por-que-inteligencia-artificial)

### IA responsável em saúde

- [Organização Mundial da Saúde — Ethics and governance of artificial intelligence for health (2021)](https://www.who.int/publications/i/item/9789240029200)
- [Organização Mundial da Saúde — seis princípios para IA em saúde (2021)](https://www.who.int/news/item/28-06-2021-who-issues-first-global-report-on-ai-in-health-and-six-guiding-principles-for-its-design-and-use)
- [Organização Mundial da Saúde — cautela e evidência para modelos de linguagem em saúde (2023)](https://www.who.int/news/item/16-05-2023-who-calls-for-safe-and-ethical-ai-for-health)
- [Vasey et al. — DECIDE-AI, avaliação inicial de sistemas de apoio à decisão por IA (Nature Medicine, 2022)](https://www.nature.com/articles/s41591-022-01772-9)
- [Van Calster et al. — Calibration: the Achilles heel of predictive analytics (BMC Medicine, 2019)](https://link.springer.com/article/10.1186/s12916-019-1466-7)

### Visualização, raciocínio e redes

- [Fan, Hardi e Yen — visualização e resumo de dados para apoiar raciocínio clínico, revisão sistemática (2025)](https://pubmed.ncbi.nlm.nih.gov/40581801/)
- [Lyu et al. — interpretabilidade em sistemas de apoio à decisão clínica, revisão sistemática (2023)](https://pubmed.ncbi.nlm.nih.gov/36776958/)
- [Borsboom — A network theory of mental disorders (2017)](https://pmc.ncbi.nlm.nih.gov/articles/PMC5269502/)

### Interface, acessibilidade e comportamento

- [Apple Human Interface Guidelines — fundamentos e comportamentos](https://developer.apple.com/design/human-interface-guidelines/)
- [Apple Human Interface Guidelines — acessibilidade](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Apple Human Interface Guidelines — movimento](https://developer.apple.com/design/human-interface-guidelines/motion)
- [Apple Human Interface Guidelines — cor](https://developer.apple.com/design/human-interface-guidelines/color)
- [Apple Human Interface Guidelines — feedback](https://developer.apple.com/design/human-interface-guidelines/feedback)

### Proteção técnica da base

- [Supabase — Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [Supabase — proteção da Data API](https://supabase.com/docs/guides/api/securing-your-api)

---

## 24. Encerramento

O “wow effect” da NeuroBox não virá apenas de luz, textura, física ou profundidade. Ele virá do momento em que o psicólogo perceber que uma informação importante não ficou perdida em uma nota antiga, que uma conexão pode ser conferida em segundos, que uma hipótese mostra seus apoios e contrapontos e que aquilo que foi decidido continua sendo acompanhado.

O visual premium é a linguagem. A inteligência explicável é o produto. A decisão humana continua sendo o centro.
