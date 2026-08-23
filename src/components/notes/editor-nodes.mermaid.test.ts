import { generateHTML, generateJSON } from "@tiptap/core";
import StarterKit from "@tiptap/starter-kit";
import { describe, expect, it } from "vitest";
import { MermaidNode } from "./editor-nodes";
import { renderNoteMarkdownToHtml } from "@/lib/note-markdown";

const extensions = [StarterKit, MermaidNode];

describe("bloco Mermaid do editor de notas", () => {
  it("promove um flowchart antigo salvo como code block para diagrama", () => {
    const document = generateJSON(
      '<pre><code>flowchart TD\nA["Paciente"] --&gt; B["Sessão"]</code></pre>',
      extensions,
    );

    expect(document.content?.[0]).toMatchObject({
      type: "mermaid",
      attrs: {
        code: 'flowchart TD\nA["Paciente"] --> B["Sessão"]',
      },
    });
  });

  it("mantém código comum como codeBlock", () => {
    const document = generateJSON(
      '<pre><code>const session = { completed: true };</code></pre>',
      extensions,
    );

    expect(document.content?.[0]?.type).toBe("codeBlock");
  });

  it("serializa a fonte Mermaid para a nota sem perder conteúdo", () => {
    const source = 'flowchart LR\nA["Início"] --> B["Fim"]';
    const html = generateHTML({
      type: "doc",
      content: [{ type: "mermaid", attrs: { code: source } }],
    }, extensions);

    expect(html).toContain('class="mermaid"');
    expect(html).toContain('class="language-mermaid"');
    expect(html).toContain('A["Início"] --&gt; B["Fim"]');
  });

  it("preserva títulos e converte Mermaid dentro de um documento Markdown", () => {
    const html = renderNoteMarkdownToHtml([
      "# Preparação da sessão",
      "",
      "## Relações observadas",
      "",
      "```mermaid",
      "flowchart TD",
      "A[Paciente] --> B[Contexto]",
      "```",
    ].join("\n"));
    const document = generateJSON(html, extensions);

    expect(document.content?.map((node: { type: string }) => node.type)).toEqual([
      "heading",
      "heading",
      "mermaid",
    ]);
    expect(document.content?.[0]?.attrs?.level).toBe(1);
    expect(document.content?.[1]?.attrs?.level).toBe(2);
  });
});
