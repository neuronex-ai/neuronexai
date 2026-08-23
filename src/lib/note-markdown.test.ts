import { describe, expect, it } from "vitest";
import { isLikelyMarkdown, renderNoteMarkdownToHtml } from "./note-markdown";

describe("Markdown colado no editor de notas", () => {
  it("reconhece estrutura Markdown, mas não texto comum", () => {
    expect(isLikelyMarkdown("# Título\n\n## Subtítulo")).toBe(true);
    expect(isLikelyMarkdown("- primeiro item\n- segundo item")).toBe(true);
    expect(isLikelyMarkdown("Texto clínico sem marcação.")).toBe(false);
  });

  it("renderiza títulos, ênfase, listas e links como HTML estrutural", () => {
    const html = renderNoteMarkdownToHtml([
      "# Título",
      "",
      "## Subtítulo",
      "",
      "Texto com **destaque** e [referência](https://example.com).",
      "",
      "- Item um",
      "- Item dois",
    ].join("\n"));

    expect(html).toContain("<h1>Título</h1>");
    expect(html).toContain("<h2>Subtítulo</h2>");
    expect(html).toContain("<strong>destaque</strong>");
    expect(html).toContain('<a href="https://example.com">referência</a>');
    expect(html).toContain("<ul>");
  });

  it("não permite que HTML bruto colado seja interpretado", () => {
    const html = renderNoteMarkdownToHtml("# Seguro\n\n<script>alert('x')</script>");

    expect(html).not.toContain("<script>");
    expect(html).toContain("&lt;script&gt;");
  });
});
