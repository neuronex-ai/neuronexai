const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

const assertIncludes = (needle: string, message: string) => {
  if (!source.includes(needle)) throw new Error(`${message}: trecho ausente: ${needle}`);
};

const assertExcludes = (needle: string, message: string) => {
  if (source.includes(needle)) throw new Error(`${message}: trecho proibido: ${needle}`);
};

Deno.test("gateway não auto-confirma mutações operacionais", () => {
  assertExcludes("canExecuteWithoutReview", "bypass de revisão deve ser removido");
  assertExcludes("assisted_execution", "gateway não pode executar confirmação assistida");
  assertExcludes('id: `${id}:assisted-execution`', "não deve existir chamada sintética de confirmação");
});

Deno.test("gateway preserva taxonomia estruturada da tool", () => {
  assertIncludes("error_code: ok ? null", "error_code deve atravessar o gateway");
  assertIncludes("failed_step_index", "índice da etapa inválida deve ser preservado");
  assertIncludes("blocked_steps", "etapas bloqueadas devem ser preservadas");
});

Deno.test("gateway registra somente shape sanitizado do FunctionCallRequest", () => {
  assertIncludes("FunctionCallRequest shape", "instrumentação do request precisa existir");
  assertIncludes("argumentJsonLength", "tamanho do JSON deve ser observável");
  assertIncludes("stepKeys", "chaves de cada step devem ser observáveis");
  assertIncludes("argumentKeys", "chaves de arguments devem ser observáveis");
  assertExcludes('console.info("[synapse-voice-gateway] FunctionCallRequest", fn)', "payload clínico cru não pode ir ao log");
});

Deno.test("falha desconhecida não usa fallback genérico de retorno confiável", () => {
  assertExcludes("não recebi um retorno confiável", "mensagem genérica antiga deve desaparecer");
  assertExcludes("nao recebi um retorno confiavel", "mensagem genérica antiga sem acentos deve desaparecer");
  assertIncludes("Nenhuma ação adicional foi executada", "falha técnica deve garantir ausência de side effect adicional");
});

Deno.test("retry continua limitado a falhas transitórias", () => {
  assertIncludes("payload.retryable", "tool deve controlar retry de erro estruturado");
  assertIncludes("isTransientError(error)", "exceções só podem repetir quando transitórias");
});

Deno.test("gateway encaminha a fala corrente para normalização temporal do planner", () => {
  assertIncludes('private lastUserTranscript = ""', "transcrição corrente deve ficar disponível em memória");
  assertIncludes("utterance: Date.now() - this.lastUserTranscriptAt <= 30_000", "somente fala recente pode acompanhar a tool");
});
