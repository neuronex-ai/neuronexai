# Roadmap dos prints do sistema — Desktop

## Resultado do inventário

- 255 arquivos PNG inspecionados visualmente, um a um.
- 33 pastas ou subpastas catalogadas.
- 244 capturas binariamente distintas.
- 11 cópias binárias exatas, todas no segundo conjunto do Portal do Paciente.
- Nenhum arquivo visual foi recortado, recomprimido ou alterado. A intervenção se limita aos nomes.
- O catálogo completo, com o nome anterior, o novo nome, a descrição e a página pública sugerida, está em [`prints-desktop-manifest.csv`](./prints-desktop-manifest.csv).

## Integração pública atual

- O catálogo consumido pela interface é gerado por `scripts/generate-public-product-media.mjs` em `src/content/public-product-media.generated.json`.
- A seleção por módulo, rota, artigo e tema fica centralizada em `src/content/public-product-media.ts`.
- A moldura compartilhada e o carrossel ficam em `src/components/public/PublicProductShowcase.tsx`.
- O catálogo runtime contém 244 capturas únicas; as 11 duplicatas exatas do Portal não são publicadas nos carrosséis.
- O Portal do Paciente possui 11 capturas escuras e nenhuma captura clara real. No tema claro, a moldura é omitida para não apresentar uma imagem de tema incorreto.
- O Synapse possui três capturas escuras dedicadas e ainda não possui a variante clara; enquanto ela não chega, o tema claro usa essas mesmas capturas como fallback.
- Ainda não há captura dedicada para NeuroZap, NeuroScan ou NeuralCast.

Para reconstruir o catálogo depois de alterar o manifesto ou os nomes dos arquivos:

```powershell
node scripts/generate-public-product-media.mjs
```

## Contrato de nomenclatura

```text
<modulo>--<subarea>--<cenario-ou-etapa>--<tema>--<tipo>--<numero>.png
```

Exemplo:

```text
agenda--novo-agendamento--etapa-03-cobranca-neurofinance--claro--modal--015.png
```

Vocabulário usado:

- `claro`, `escuro` e `misto`: tema realmente visível no print, mesmo quando ele diverge do nome da pasta.
- `pagina`: tela ou área principal.
- `modal`: diálogo central que interrompe o fluxo.
- `drawer`: painel lateral sobreposto.
- `popover`: menu ou cartão contextual ancorado.
- `painel`: seção ou cartão autocontido da tela.
- `estado`: variação transitória, como carregamento, cartão virado ou tooltip.
- `duplicata-exata-NNN`: cópia byte a byte de outra captura. O campo `duplicata_de` do manifesto aponta para a fonte descritiva.

Os nomes usam apenas ASCII minúsculo, hífens e números. Eles não incluem nomes de pacientes, valores ou datas do conteúdo da captura.

## Mapa por pasta

| Pasta | Qtde. | O que os prints cobrem | Destino público principal |
|---|---:|---|---|
| `CLARO/1. DASHBOARD` | 9 | Visão geral, fluxo financeiro, atalhos de agenda/paciente, Synapse, mensagens e notificações | `/` e `/produto` |
| `ESCURO/1. DASHBOARD` | 9 | Visão geral, Synapse, histórico do WhatsApp Business, mensagens e notificações | `/` e `/produto` |
| `CLARO/2. AGENDA` | 33 | Dia, semana, mês, lista de espera, novo agendamento, recorrência, cobrança, histórico, disponibilidade e políticas | `/agenda-para-psicologos` |
| `ESCURO/2. AGENDA` | 20 | Dia, semana, mês, novo agendamento, recorrência, sessão, remarcação, disponibilidade e políticas | `/agenda-para-psicologos` |
| `CLARO/3.TELECONSULTA - ABA PRINCIPAL` | 1 | Visão geral da teleconsulta, próxima sessão e contexto | `/teleconsulta-para-psicologos` |
| `CLARO/3. TELECONSULTA - PRÉ E PÓS-JOIN` | 9 | Pré-entrada, dispositivos, consentimento, sessão, processamento e revisão pós-sessão | `/teleconsulta-para-psicologos` e artigo de transcrição |
| `ESCURO/3. TELECONSULTA - ABA PRINCIPAL` | 1 | Visão geral da teleconsulta, próxima sessão e contexto | `/teleconsulta-para-psicologos` |
| `ESCURO/3. TELECONSULTA - PRÉ E PÓS-JOIN` | 7 | Pré-entrada, dispositivos, consentimento, sessão transcrita e revisão gerada | `/teleconsulta-para-psicologos` e artigo de transcrição |
| `CLARO/4. PACIENTES + NOVO PACIENTE` | 5 | Lista de pacientes, exclusão/exportação e cadastro rápido/completo | `/pacientes-para-psicologos` |
| `ESCURO/4. PACIENTES + NOVO PACIENTE` | 3 | Lista de pacientes e cadastro rápido/completo | `/pacientes-para-psicologos` |
| `CLARO/5. PRONTUÁRIO` | 19 | Resumo, histórico, Synapse, portal, anamnese, sessão, humor, fiscal, financeiro, arquivos e documentos | `/prontuario-para-psicologos` e páginas temáticas |
| `ESCURO/5. PRONTUÁRIO` | 15 | Resumo, histórico, anamnese, humor, objetivos, pacotes, fiscal, financeiro, arquivos, portal e documentos | `/prontuario-para-psicologos` e páginas temáticas |
| `CLARO/6. NEURODRIVE/1. NOTAS` | 5 | Estado inicial, lista/editor, modo foco e Synapse | `/neurobox` |
| `CLARO/6. NEURODRIVE/2. TAREFAS` | 3 | Kanban, navegação compacta, lista e filtros | `/neurobox` |
| `CLARO/6. NEURODRIVE/3. DOCUMENTOS` | 1 | Arquivos vinculados a pacientes | `/neurobox` |
| `CLARO/6. NEURODRIVE/4. INTEGRAÇÕES` | 1 | Google Drive e Notion | `/neurobox` |
| `CLARO/6. NEURODRIVE/5. NEUROVIEW` | 2 | Grafos clínicos 2D e 3D | `/neurobox` |
| `CLARO/6. NEURODRIVE/6. NEUROFLOW` | 1 | Mapa visual de raciocínio clínico | `/neurobox` |
| `CLARO/6. NEURODRIVE/7. NEUROPULSE` | 3 | Processamento, seleção de abordagem e diagrama pronto | `/neurobox` |
| `ESCURO/6. NEURODRIVE` | 23 | Notas, tarefas, NeuroView 2D/3D, biblioteca e canvas NeuroFlow, fluxo completo NeuroPulse | `/neurobox` |
| `CLARO/7. GESTÃO FINANCEIRA` | 8 | Visão geral, receitas/despesas, cobrança, recorrência e planejamento | `/gestao-financeira-para-psicologos` |
| `ESCURO/7. GESTÃO FINANCEIRA` | 6 | Visão geral, receita, cobrança, lançamentos e planejamento | `/gestao-financeira-para-psicologos` |
| `CLARO/8. NEUROFINANCE` | 17 | Conta, Pix, boleto, extrato, cobranças, NFS-e, tarifas, segurança e saúde da conta | `/neurofinance` e páginas financeiras/fiscais |
| `ESCURO/8. NEUROFINANCE` | 8 | Conta/cartão, Pix, chaves, cobranças, agendamentos e saúde da conta | `/neurofinance` |
| `CLARO/9. NEUROID` | 3 | Editor da identidade, compartilhamento e perfil público | `/produto` |
| `ESCURO/9. NEUROID` | 3 | Identidade com Synapse, editor/credencial e perfil público | `/produto` |
| `CLARO/10. AJUSTES - SEGURANÇA` | 5 | Segurança financeira, comunicação, 2FA, integrações e perfil | `/seguranca-e-etica` e `/produto` |
| `ESCURO/10. AJUSTES - SEGURANÇA` | 6 | Authenticator, 2FA, comunicação, segurança financeira, integrações e privacidade | `/seguranca-e-etica` e `/produto` |
| `CLARO/11. ABA DE BUSCA GLOBAL` | 2 | Estado inicial e resultados por paciente/agendamento | `/produto` |
| `ESCURO/11. ABA DE BUSCA GLOBAL` | 2 | Estado inicial e resultados com seleção | `/produto` |
| `CLARO/12. PORTAL PACIENTES - MODO CLARO E MODO ESCURO` | 11 | Início, sessões, humor, anamnese, notas, progresso e pacote financeiro | `/portal-do-paciente` |
| `ESCURO/12. PORTAL PACIENTES - MODO CLARO E MODO ESCURO` | 11 | Duplicatas exatas do conjunto anterior, marcadas para não serem selecionadas | Não usar |
| `ESCURO/13. SYNAPSE AI` | 3 | Início com sugestões, resposta em processamento e modo de voz ouvindo | `/synapse` e landing principal |

## Roteamento recomendado para a próxima rodada de landing pages

1. Filtre o manifesto pela coluna `pagina_publica_sugerida`.
2. Ignore toda linha cujo `tipo` seja `duplicata`.
3. Para hero ou showcase amplo, priorize `pagina` com visão completa e sem sobreposição.
4. Para explicar automação ou sequência operacional, combine os arquivos que contêm `etapa-01`, `etapa-02`, `etapa-03`, `etapa-04`, `carregando`, `construindo` ou `pronto`.
5. Use `modal`, `drawer` e `popover` apenas quando a copy estiver explicando exatamente aquela ação.
6. Escolha o sufixo `claro` ou `escuro` conforme o contraste da seção pública. Use `misto` somente em composições em que ambos os materiais sejam compatíveis.

## Sequências prontas para contar uma história

- **Agenda e cobrança:** selecionar paciente → tipo de sessão → NeuroFinance → resumo → série criada → histórico Pix.
- **Teleconsulta com IA:** pré-entrada → consentimento → sessão/transcrição → carregamento → revisão gerada.
- **Prontuário:** resumo → anamnese → evolução/resumo clínico → humor → documento oficial → histórico.
- **NeuroFinance:** consultar Pix/boleto → revisar → gerar cobrança/QR Code → compartilhar → acompanhar extrato.
- **NeuroFlow:** canvas clínico → biblioteca de blocos → notas existentes → mapa com hipótese diagnóstica.
- **NeuroPulse:** relato preenchido → abordagem terapêutica → construção da síntese → diagrama pronto.
- **Portal do Paciente:** início → sessões → humor → NeuroDrive → progresso → pacote financeiro.
- **Synapse AI:** sugestões iniciais → solicitação em processamento → interação por voz.

## Atenção antes da publicação externa

As capturas exibem nomes, textos clínicos, datas e valores dentro da interface. A nomenclatura foi deliberadamente anonimizada, mas os pixels originais não foram editados. Antes de publicar qualquer imagem em landing page ou artigo, faça uma revisão de privacidade e confirme que todos os dados visíveis são fictícios, autorizados ou devidamente ocultados.
