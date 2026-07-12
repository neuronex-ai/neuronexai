import { assertEquals, assertStringIncludes } from "jsr:@std/assert@1";
import { formatSystemHelp, getSystemHelp } from "./system-help.ts";

Deno.test("ajuda do sistema reconhece as três superfícies Neuro", () => {
  for (const product of ["NeuroView", "NeuroFlow", "NeuroPulse"]) {
    const result = getSystemHelp(product);
    assertEquals(result.entries[0]?.title, product);
    assertStringIncludes(formatSystemHelp(result), product);
  }
});
