const source = await Deno.readTextFile(new URL("./index.ts", import.meta.url));

const assertIncludes = (needle: string, message: string) => {
  if (!source.includes(needle)) throw new Error(`${message}: trecho ausente: ${needle}`);
};

const assertExcludes = (needle: string, message: string) => {
  if (source.includes(needle)) throw new Error(`${message}: trecho proibido: ${needle}`);
};

Deno.test("reconexão envia mensagens no contrato History da Deepgram", () => {
  assertIncludes('type: "History"', "mensagens históricas precisam declarar type=History");
  assertIncludes('messages.push({ type: "History", role, content })', "cada fala deve usar o shape oficial");
  assertIncludes('contextMessages: DeepgramHistoryMessage[]', "settings aceitam somente o shape History tipado");
});

Deno.test("tool turns não são mascarados como fala artificial do assistente", () => {
  assertExcludes('[Resultado seguro da função', "tool rows não podem ser serializados como assistant text");
  assertExcludes('toolPairs', "não deve existir contador do workaround antigo");
  assertIncludes('row.role === "assistant"', "fala real do assistente continua no histórico");
  assertIncludes('row.role === "user"', "fala real do usuário continua no histórico");
});
