import { marked } from "marked";

const MARKDOWN_BLOCK = /(?:^|\n)\s{0,3}(?:#{1,6}\s+\S|>\s+\S|(?:[-+*]|\d+[.)])\s+\S|```|~~~|(?:-{3,}|\*{3,}|_{3,})\s*$)/m;
const MARKDOWN_SETEXT_HEADING = /(?:^|\n)[^\n]+\n\s*(?:={3,}|-{3,})\s*(?:\n|$)/m;
const MARKDOWN_INLINE = /(?:\*\*[^*\n]+\*\*|__[^_\n]+__|~~[^~\n]+~~|`[^`\n]+`|\[[^\]\n]+\]\([^\s)]+(?:\s+"[^"]*")?\))/;

const escapeHtml = (value: string) => value
  .replace(/&/g, "&amp;")
  .replace(/</g, "&lt;")
  .replace(/>/g, "&gt;")
  .replace(/"/g, "&quot;")
  .replace(/'/g, "&#039;");

const markdownRenderer = new marked.Renderer();

// Raw HTML is displayed as text. Only HTML produced from Markdown tokens is
// handed to the editor's schema parser.
markdownRenderer.html = ({ text }) => escapeHtml(text);

export const isLikelyMarkdown = (value?: string | null) => {
  if (!value?.trim()) return false;
  return MARKDOWN_BLOCK.test(value)
    || MARKDOWN_SETEXT_HEADING.test(value)
    || MARKDOWN_INLINE.test(value);
};

export const renderNoteMarkdownToHtml = (value: string) => marked.parse(value, {
  async: false,
  breaks: false,
  gfm: true,
  renderer: markdownRenderer,
}) as string;
