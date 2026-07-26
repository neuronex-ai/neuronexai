# Portal do paciente para psicólogos: o que oferecer sem abrir o prontuário

Um **portal do paciente para psicólogos** não deve ser uma cópia simplificada do sistema profissional. Ele precisa oferecer autonomia em tarefas apropriadas — agenda, documentos liberados, pagamentos, formulários e acompanhamento — sem expor registros internos, outros pacientes ou controles administrativos.

A separação entre experiências é um requisito de produto e de segurança.

> **Nota editorial:** A configuração de acesso deve considerar o caso concreto, inclusive responsáveis, menores e determinações aplicáveis.

## O que o paciente pode fazer

Conforme o serviço e as permissões:
- consultar próximas sessões;
- confirmar ou solicitar reagendamento;
- entrar na teleconsulta;
- preencher anamnese ou formulários;
- responder diário de humor ou tarefas;
- visualizar documentos liberados;
- acompanhar pacotes e cobranças;
- pagar;
- atualizar cadastro;
- solicitar suporte.

Cada ação deve informar estado e consequência.

## O que não deve aparecer por padrão

Não exponha:
- notas privadas;
- rascunhos;
- hipóteses;
- registros de outros profissionais sem base;
- dados financeiros internos;
- logs técnicos;
- documentos não liberados;
- informações de terceiros;
- ferramentas administrativas.

O fato de os dados estarem no mesmo banco não significa que devem compartilhar a mesma interface ou autorização.

## Convite e autenticação

Convites devem expirar, ser vinculados à pessoa correta e permitir revogação. Evite links permanentes sem proteção para acesso a conteúdo sensível.

A autenticação precisa equilibrar segurança e acessibilidade. Considere verificação de e-mail ou telefone, recuperação segura e bloqueio de tentativas. A clínica deve conseguir ver convites pendentes e acessos relevantes.

## Agendamento e políticas

O portal pode permitir confirmação, cancelamento e proposta de novo horário. A alteração só deve ocorrer quando as regras forem satisfeitas e o sistema confirmar o resultado.

Solicitação não é alteração. Essa distinção evita que o paciente acredite ter reagendado quando apenas enviou uma proposta.

## Documentos e compartilhamento

Um documento deve ser explicitamente liberado para o paciente, com versão, data e finalidade. O portal pode reduzir envio por e-mail, mas precisa preservar download, acesso e eventual revogação.

Formulários enviados pelo paciente devem indicar status: não iniciado, em andamento, enviado e revisado. Alterações posteriores precisam ser controladas.

## Pagamentos e cobranças

O portal pode centralizar faturas, links, recibos e pacotes. Mostre valor, referência, vencimento e status. Pagamento confirmado deve atualizar a operação sem duplicidade.

Evite apresentar movimentos bancários internos ou informações que não sejam necessárias ao paciente.

## Acompanhamento entre sessões

Diário, tarefas e metas podem aumentar continuidade, mas não devem virar vigilância. Defina finalidade, frequência, expectativa de resposta e limites de monitoramento.

O paciente precisa saber se o profissional acompanha em tempo real ou apenas durante a sessão. Alertas automáticos não substituem um protocolo de risco.

## Portal na NeuroNex

A NeuroNex apresenta um Portal separado do Professional, com sessões, humor, documentos, anamneses, tarefas, progresso, pacotes e cobranças autorizadas. Jornadas públicas usam links específicos para confirmação, teleconsulta e formulários.

Ao implementar, teste cada permissão com contas fictícias e diferentes vínculos de responsável/pagador.

## Roteiro de teste de segurança

- Abra um link expirado.
- Tente acessar outro paciente alterando a URL.
- Revogue um convite.
- Troque e recupere senha.
- Libere e remova um documento.
- Solicite reagendamento.
- Pague uma cobrança de teste.
- Teste responsável diferente do beneficiário.
- Verifique o que a secretária consegue ver.
- Exporte o histórico de acessos.

## Continue pela NeuroNex

- [Portal do Paciente](/portal-do-paciente)
- [Pacientes](/pacientes-para-psicologos)
- [Teleconsulta](/teleconsulta-para-psicologos)

## Perguntas frequentes

### Portal do paciente é obrigatório?

Não como ferramenta específica, mas pode organizar comunicação e acesso. A adoção deve respeitar segurança, finalidade e direitos.

### O paciente vê o prontuário completo?

Não por padrão. O portal deve mostrar apenas informações e documentos apropriados e autorizados, com análise das obrigações profissionais.

### Posso enviar anamnese pelo portal?

Sim, quando o fluxo protege dados, identifica a pessoa, permite revisão e informa a finalidade.

### Portal substitui WhatsApp?

Pode centralizar ações sensíveis, mas a comunicação pode continuar em outros canais. Defina qual canal serve para cada finalidade.

## Fontes e referências

- [NeuroNex — Portal do Paciente](https://www.neuronexai.com.br/portal-do-paciente)
- [NeuroNex — pacientes](https://www.neuronexai.com.br/pacientes-para-psicologos)
- [ANPD — dados sensíveis](https://www.gov.br/anpd/pt-br/documentos-e-publicacoes/glossario-anpd)
- [ANPD — segurança](https://www.gov.br/anpd/pt-br/assuntos/noticias/anpd-publica-guia-de-seguranca-para-agentes-de-tratamento-de-pequeno-porte)
