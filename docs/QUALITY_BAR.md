# Barra de qualidade NeuroNex

**Status:** documento ativo e obrigatório
**Última revisão:** 14 de julho de 2026

Este documento define quando uma área da NeuroNex pode ser considerada realmente concluída. Funcionar no caminho principal não basta: a área também precisa estar estável, compreensível, rápida e polida nos pequenos detalhes.

O pente-fino acontece por área funcional. Ele não autoriza uma reescrita geral, remoções sem auditoria ou mudanças de produto não aprovadas.

## 1. Comportamento

- O caminho principal e os caminhos de retorno funcionam.
- A tela possui estados coerentes de carregamento, vazio, sucesso, erro e indisponibilidade quando forem aplicáveis.
- Uma ação não pode parecer concluída antes de o sistema confirmá-la.
- Cliques repetidos não podem criar registros, cobranças, mensagens ou convites duplicados.
- Falhas de rede preservam o trabalho do usuário sempre que tecnicamente possível e oferecem uma próxima ação clara.
- Não existem erros ou avisos inesperados no console durante o fluxo validado.

## 2. Acabamento visual

- Modos claro e escuro preservam contraste, profundidade e hierarquia.
- Não existem cortes, sobreposições, rolagem lateral acidental ou saltos de layout.
- Texturas, ícones, fontes e imagens essenciais carregam de forma estável. Um efeito decorativo não deve depender de um serviço externo para a tela parecer correta.
- Bordas, raios, sombras, transparências e espaçamentos seguem o Brandbook ativo.
- Estados `hover`, foco, pressionado, selecionado, desabilitado e carregando são visualmente distinguíveis.
- O conteúdo continua utilizável com zoom e nas larguras oficialmente atendidas pela superfície.

## 3. Interação e acessibilidade

- Toda ação alcançável pelo mouse também é alcançável por teclado quando aplicável.
- O foco permanece visível e percorre a tela em ordem lógica.
- Botões somente com ícone possuem nome acessível.
- Campos possuem rótulo real; texto de exemplo dentro do campo não substitui o rótulo.
- Informações importantes não dependem somente de cor, som ou movimento.
- Alvos interativos têm área confortável, com referência mínima de 44 × 44 pontos para ações comuns.
- Modais, menus e folhas controlam foco, Escape, abertura e encerramento de modo previsível.

## 4. Movimento e feedback

- Animação explica estado, direção, continuidade ou resposta; não existe apenas para ornamentar.
- Toda animação nova respeita `prefers-reduced-motion`, preferência usada por pessoas que precisam reduzir movimento na tela.
- Animações infinitas são permitidas apenas quando comunicam atividade real ou um estado persistente necessário.
- O sistema responde imediatamente ao início de uma interação, mesmo quando o resultado depende de rede.
- Alertas interrompem o usuário somente quando a informação exige decisão ou evita dano.

## 5. Carregamento e fluidez

- A estrutura útil aparece o mais cedo possível; nenhuma rota fica em branco enquanto baixa código ou dados.
- Conteúdo que chega depois reserva seu espaço para evitar que botões e textos mudem de posição.
- Rotas públicas não carregam antecipadamente módulos internos pesados sem necessidade.
- Recursos grandes são carregados somente quando a área que os utiliza é aberta.
- Requisições, assinaturas em tempo real, observadores e temporizadores são encerrados quando deixam de ser necessários.
- Nenhuma textura ou imagem meramente decorativa pode bloquear a interação.
- A mudança não pode aumentar o JavaScript inicial, o número de requisições ou o tempo de interação sem justificativa registrada.

Para páginas públicas, as metas de experiência real são avaliadas separadamente em mobile e desktop, considerando pelo menos 75% das visitas:

- **LCP até 2,5 s:** o conteúdo principal aparece rapidamente.
- **INP até 200 ms:** cliques e digitação recebem resposta rápida.
- **CLS até 0,1:** a página permanece visualmente estável durante o carregamento.

Medições locais servem como diagnóstico e comparação. A confirmação final depende também de medições reais do ambiente publicado.

## 6. Qualidade do código

- `npm run lint` termina sem erros nem avisos.
- O lint cobre TypeScript e também scripts JavaScript, CommonJS, Service Workers e processadores de áudio; arquivos fora do aplicativo visual não ficam sem verificação.
- `npm run typecheck` termina sem erros de tipagem.
- `npm run check:frontend-boundaries` confirma que as interfaces pública, desktop e mobile continuam separadas.
- Testes existentes relacionados à área continuam aprovados.
- `npm run test:deno` mantém aprovados os testes automatizados das funções do Supabase.
- `npm run build` termina sem erros e sem novos avisos ignorados.
- `npm run quality` reúne essas verificações em uma única barreira local antes do envio ao GitHub.
- Não ficam imports, variáveis, parâmetros, estilos, eventos ou arquivos órfãos após uma alteração.
- Uma exceção de lint ou tipagem precisa explicar o motivo e ter escopo mínimo; silenciar uma regra não é correção automática.
- O ambiente de testes não pode ocultar globalmente avisos do React ou mensagens de erro para produzir um resultado aparentemente limpo.
- Dependências novas ou atualizadas precisam ter finalidade clara, versão compatível e impacto de carregamento conhecido.

## 7. Páginas públicas e descoberta

- Cada página indexável possui título, descrição, endereço canônico e conteúdo coerentes com aquela página.
- O conteúdo principal pode ser compreendido sem depender de uma longa execução de JavaScript.
- Sitemap e `robots.txt` usam o domínio oficial e listam somente endereços públicos, canônicos e realmente existentes.
- Mudanças de endereço preservam sinais anteriores com redirecionamento permanente e canonicalização correta.
- Links possuem texto descritivo; títulos seguem uma hierarquia compreensível.
- Dados estruturados descrevem somente funcionalidades e entidades reais.
- Conteúdo é escrito para pessoas e apresenta com clareza a visão integrada de Synapse, voz, modo agêntico, WhatsApp e NeuroBox, sem transformar a página pública em um relatório de desenvolvimento. Promessas transacionais só entram em compra, contrato ou onboarding depois de o fluxo completo e suas proteções estarem validados.

## 8. Evidência obrigatória ao finalizar uma área

O relatório da área precisa registrar:

1. telas e fluxos verificados;
2. larguras e temas verificados;
3. estados de interface verificados;
4. comandos executados e seus resultados;
5. problemas corrigidos;
6. problemas ainda incertos;
7. efeitos sobre velocidade e tamanho de carregamento;
8. qualquer risco ou comportamento inesperado;
9. ponto de restauração e forma de reversão, quando houve alteração relevante.

Uma ausência de erro em lint ou build não prova, sozinha, que a interface funciona. Da mesma forma, uma tela visualmente correta não prova que seus dados, permissões ou integrações estão corretos. A conclusão exige as duas camadas.

## 9. Referências de interface

As Human Interface Guidelines são usadas como referência de ergonomia e comportamento, sem transformar a aplicação web em uma imitação de macOS ou iOS:

- [Accessibility](https://developer.apple.com/design/human-interface-guidelines/accessibility)
- [Buttons](https://developer.apple.com/design/human-interface-guidelines/buttons)
- [Feedback](https://developer.apple.com/design/human-interface-guidelines/feedback)
- [Keyboards](https://developer.apple.com/design/human-interface-guidelines/keyboards)
- [Loading](https://developer.apple.com/design/human-interface-guidelines/loading)
- [Materials](https://developer.apple.com/design/human-interface-guidelines/materials)
- [Motion](https://developer.apple.com/design/human-interface-guidelines/motion)
