import { describe, expect, it } from "vitest";
import { extractMermaidCode, extractStandaloneMermaidCode, isLikelyMermaid } from "./mermaid-content";

describe("conteúdo Mermaid em notas", () => {
  it("reconhece flowcharts que antes eram tratados como código comum", () => {
    const source = 'flowchart TD\n  A["Paciente"] --> B["Contexto"]';

    expect(isLikelyMermaid(source)).toBe(true);
    expect(extractMermaidCode(source)).toBe(source);
  });

  it("extrai blocos Markdown Mermaid sem persistir as cercas", () => {
    expect(extractMermaidCode([
      "```mermaid",
      "sequenceDiagram",
      "  Paciente->>Psicólogo: Relato",
      "```",
    ].join("\n"))).toBe([
      "sequenceDiagram",
      "  Paciente->>Psicólogo: Relato",
    ].join("\n"));
  });

  it("recupera a fonte serializada pelo editor em pre e code", () => {
    const html = '<pre class="mermaid" data-mermaid-diagram="true"><code class="language-mermaid">flowchart LR\nA--&gt;B</code></pre>';

    expect(extractMermaidCode(html)).toBe("flowchart LR\nA-->B");
  });

  it("não converte código genérico em diagrama", () => {
    expect(extractMermaidCode("const patient = { active: true };" )).toBeNull();
  });

  it("não descarta o restante de um documento Markdown com Mermaid", () => {
    const document = [
      "# Resumo clínico",
      "",
      "```mermaid",
      "flowchart TD",
      "A-->B",
      "```",
      "",
      "Conclusão.",
    ].join("\n");

    expect(extractStandaloneMermaidCode(document)).toBeNull();
    expect(extractMermaidCode(document)).toBe("flowchart TD\nA-->B");
  });
});
