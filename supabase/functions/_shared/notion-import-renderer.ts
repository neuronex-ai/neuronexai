export const NOTION_RENDER_VERSION = "notion-renderer-v2";

export type NotionBlock = {
  id?: string;
  type: string;
  has_children?: boolean;
  children?: NotionBlock[];
  [key: string]: any;
};

export type UnsupportedNotionBlock = {
  id: string | null;
  type: string;
  block_type?: string | null;
  reason: string;
};

export type NotionRenderResult = {
  contentHtml: string;
  unsupportedBlocks: UnsupportedNotionBlock[];
  renderVersion: string;
};

const escapeHtml = (value: unknown) =>
  String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const attr = (value: unknown) => escapeHtml(value);

const notionPageUrl = (pageId: string | undefined) =>
  pageId ? `https://www.notion.so/${pageId.replace(/-/g, "")}` : "";

export const notionRichTextPlain = (richText: any[] = []) =>
  (Array.isArray(richText) ? richText : [{ plain_text: richText }])
    .map((part) => {
      if (part?.type === "equation") return part.equation?.expression || "";
      if (part?.type === "mention") return part.plain_text || "";
      return part?.plain_text || "";
    })
    .join("");

const NOTION_TEXT_COLORS: Record<string, string> = {
  gray: "#6b7280",
  brown: "#92400e",
  orange: "#c2410c",
  yellow: "#a16207",
  green: "#15803d",
  blue: "#2563eb",
  purple: "#7c3aed",
  pink: "#db2777",
  red: "#dc2626",
};

const NOTION_BACKGROUND_COLORS: Record<string, string> = {
  gray_background: "rgba(107, 114, 128, 0.16)",
  brown_background: "rgba(146, 64, 14, 0.16)",
  orange_background: "rgba(194, 65, 12, 0.16)",
  yellow_background: "rgba(161, 98, 7, 0.18)",
  green_background: "rgba(21, 128, 61, 0.16)",
  blue_background: "rgba(37, 99, 235, 0.16)",
  purple_background: "rgba(124, 58, 237, 0.16)",
  pink_background: "rgba(219, 39, 119, 0.16)",
  red_background: "rgba(220, 38, 38, 0.16)",
};

export const notionRichTextHtml = (richText: any[] = []) =>
  (Array.isArray(richText) ? richText : [{ plain_text: richText }])
    .map((part) => {
      let value =
        part?.type === "equation"
          ? `<code class="notion-inline-equation">${escapeHtml(part.equation?.expression || "")}</code>`
          : escapeHtml(part?.plain_text || "");

      const annotations = part?.annotations || {};
      if (annotations.code) value = `<code>${value}</code>`;
      if (annotations.bold) value = `<strong>${value}</strong>`;
      if (annotations.italic) value = `<em>${value}</em>`;
      if (annotations.underline) value = `<u>${value}</u>`;
      if (annotations.strikethrough) value = `<s>${value}</s>`;
      if (annotations.color && annotations.color !== "default") {
        if (annotations.color.endsWith("_background")) {
          const background = NOTION_BACKGROUND_COLORS[annotations.color] || "rgba(120,120,120,0.16)";
          value = `<mark style="background-color: ${attr(background)}; color: inherit;">${value}</mark>`;
        } else {
          const color = NOTION_TEXT_COLORS[annotations.color] || "currentColor";
          value = `<span style="color: ${attr(color)};">${value}</span>`;
        }
      }
      if (part?.href) {
        value = `<a href="${attr(part.href)}" target="_blank" rel="noopener noreferrer">${value}</a>`;
      }
      return value;
    })
    .join("");

const getBlockTextHtml = (data: any = {}) =>
  notionRichTextHtml(data.rich_text || data.title || data.caption || []);

const getBlockTextPlain = (data: any = {}) =>
  notionRichTextPlain(data.rich_text || data.title || data.caption || []);

const getFileUrl = (data: any = {}) =>
  data.file?.url || data.external?.url || data.file_upload?.url || data.url || "";

const captionHtml = (caption: any[] = []) => {
  const captionText = notionRichTextHtml(caption);
  return captionText ? `<figcaption>${captionText}</figcaption>` : "";
};

const childrenHtml = (
  block: NotionBlock,
  unsupportedBlocks: UnsupportedNotionBlock[],
  depth: number,
) => renderBlocks(block.children || [], unsupportedBlocks, depth + 1);

const fallbackCard = (
  block: NotionBlock,
  label: string,
  description: string,
  unsupportedBlocks: UnsupportedNotionBlock[],
  reason = "Rendered as fallback card",
) => {
  unsupportedBlocks.push({
    id: block.id || null,
    type: block.type,
    block_type: block.unsupported?.block_type || block.block_type || null,
    reason,
  });

  return `<notion-callout icon="!" color="amber_background" label="${attr(label)}"><p>${escapeHtml(description)}</p></notion-callout>`;
};

const mediaCard = (block: NotionBlock, kind: string, data: any = {}) => {
  const url = getFileUrl(data);
  const caption = captionHtml(data.caption || []);
  const label = data.name || notionRichTextPlain(data.caption || []) || `${kind} do Notion`;

  if (kind === "image" && url) {
    return `<figure data-notion-block-id="${attr(block.id)}"><img src="${attr(url)}" alt="${attr(label)}" />${caption}</figure>`;
  }

  if (kind === "video" && url) {
    return `<video-embed src="${attr(url)}" width="100%" height="420px"></video-embed>${caption}`;
  }

  if (url) {
    return `<embedded-doc name="${attr(label)}" type="${attr(kind)}" url="${attr(url)}" size="Notion"></embedded-doc>${caption}`;
  }

  return `<embedded-doc name="${attr(label)}" type="${attr(kind)}" url="#" size="Notion"></embedded-doc>${caption}`;
};

const linkCard = (url: string, title: string, description = "Conteudo importado do Notion") => {
  if (!url) return "";
  let siteName = "Notion";
  try {
    siteName = new URL(url).hostname;
  } catch {
    siteName = "Link";
  }
  return `<link-card url="${attr(url)}" title="${attr(title || url)}" description="${attr(description)}" siteName="${attr(siteName)}"></link-card>`;
};

const renderTable = (
  block: NotionBlock,
  unsupportedBlocks: UnsupportedNotionBlock[],
  depth: number,
) => {
  const rows = block.children || [];
  if (!rows.length) {
    return fallbackCard(block, "Tabela do Notion", "Tabela sem linhas retornadas pela API.", unsupportedBlocks);
  }

  const tableData = block.table || {};
  const hasHeader = Boolean(tableData.has_column_header);
  const body = rows
    .map((row, rowIndex) => {
      const cells = row.table_row?.cells || [];
      const cellTag = hasHeader && rowIndex === 0 ? "th" : "td";
      return `<tr>${cells
        .map((cell: any[]) => `<${cellTag}>${notionRichTextHtml(cell)}</${cellTag}>`)
        .join("")}</tr>`;
    })
    .join("");

  return `<table data-notion-block-id="${attr(block.id)}"><tbody>${body}</tbody></table>${childrenHtml(block, unsupportedBlocks, depth)}`;
};

const renderListRun = (
  blocks: NotionBlock[],
  start: number,
  type: "bulleted_list_item" | "numbered_list_item",
  unsupportedBlocks: UnsupportedNotionBlock[],
  depth: number,
) => {
  const tag = type === "bulleted_list_item" ? "ul" : "ol";
  let index = start;
  const items: string[] = [];

  while (index < blocks.length && blocks[index].type === type) {
    const block = blocks[index];
    const data = block[type] || {};
    items.push(`<li>${getBlockTextHtml(data)}${childrenHtml(block, unsupportedBlocks, depth)}</li>`);
    index += 1;
  }

  return { html: `<${tag}>${items.join("")}</${tag}>`, nextIndex: index };
};

const renderTaskRun = (
  blocks: NotionBlock[],
  start: number,
  unsupportedBlocks: UnsupportedNotionBlock[],
  depth: number,
) => {
  let index = start;
  const items: string[] = [];

  while (index < blocks.length && blocks[index].type === "to_do") {
    const block = blocks[index];
    const data = block.to_do || {};
    const checked = Boolean(data.checked);
    items.push(
      `<li data-type="taskItem" data-checked="${checked ? "true" : "false"}"><label><input type="checkbox"${checked ? " checked=\"checked\"" : ""} /><span></span></label><div><p>${getBlockTextHtml(data)}</p>${childrenHtml(block, unsupportedBlocks, depth)}</div></li>`,
    );
    index += 1;
  }

  return { html: `<ul data-type="taskList">${items.join("")}</ul>`, nextIndex: index };
};

const renderBlock = (
  block: NotionBlock,
  unsupportedBlocks: UnsupportedNotionBlock[],
  depth: number,
): string => {
  const type = block.type;
  const data = block[type] || {};
  const text = getBlockTextHtml(data);
  const childHtml = childrenHtml(block, unsupportedBlocks, depth);

  switch (type) {
    case "paragraph":
      return text || childHtml ? `<p>${text || "<br />"}</p>${childHtml}` : "";
    case "heading_1":
      return `<h1>${text}</h1>${childHtml}`;
    case "heading_2":
      return `<h2>${text}</h2>${childHtml}`;
    case "heading_3":
      return `<h3>${text}</h3>${childHtml}`;
    case "heading_4":
      return `<h4>${text}</h4>${childHtml}`;
    case "quote":
      return `<blockquote>${text}${childHtml}</blockquote>`;
    case "callout": {
      const icon = data.icon?.emoji ? `${escapeHtml(data.icon.emoji)} ` : "";
      return `<notion-callout icon="${attr(icon || "!")}" color="${attr(data.color || "default")}" label="Callout"><p>${text || "<br />"}</p>${childHtml}</notion-callout>`;
    }
    case "code":
      return `<pre><code>${escapeHtml(getBlockTextPlain(data))}</code></pre>`;
    case "divider":
      return "<hr />";
    case "toggle":
      return `<notion-toggle title="${attr(getBlockTextPlain(data) || "Detalhes")}" open="true">${childHtml || "<p></p>"}</notion-toggle>`;
    case "column_list":
      return childHtml;
    case "column":
      return childHtml;
    case "table":
      return renderTable(block, unsupportedBlocks, depth);
    case "table_row":
      return "";
    case "image":
      return mediaCard(block, "image", data);
    case "video":
      return mediaCard(block, "video", data);
    case "audio":
    case "file":
    case "pdf":
      return mediaCard(block, type, data);
    case "embed":
    case "bookmark":
    case "link_preview":
      return linkCard(data.url, type === "bookmark" ? "Bookmark do Notion" : "Embed do Notion");
    case "child_page": {
      const href = block.url || data.url || notionPageUrl(block.id);
      return `<note-link notionPageId="${attr(block.id || "")}" href="${attr(href)}" title="${attr(data.title || "Subpagina do Notion")}" description="Subpagina referenciada no Notion. Importe-a para transformar em nota editavel." source="Notion"></note-link>`;
    }
    case "child_database":
      return fallbackCard(block, "Banco de dados do Notion", data.title || "Banco referenciado pela pagina.", unsupportedBlocks);
    case "synced_block":
      return childHtml || fallbackCard(block, "Bloco sincronizado", "Conteudo sincronizado sem filhos retornados.", unsupportedBlocks);
    case "template":
      return `<notion-callout icon="T" label="Template"><p>${text}</p>${childHtml}</notion-callout>`;
    case "table_of_contents":
      return fallbackCard(block, "Indice do Notion", "Indice preservado como referencia; edite os titulos da nota para reorganizar.", unsupportedBlocks);
    case "breadcrumb":
      return "";
    case "equation":
      return `<notion-equation expression="${attr(data.expression || "")}"></notion-equation>`;
    case "transcription":
    case "meeting_notes":
      return `<notion-callout icon="M" label="Notas de reuniao do Notion">${childHtml || `<p>${text}</p>`}</notion-callout>`;
    case "unsupported":
      return fallbackCard(block, "Bloco nao suportado pelo Notion", data.block_type || "Tipo nao informado.", unsupportedBlocks, "Notion returned unsupported block");
    default:
      return childHtml || fallbackCard(block, `Bloco Notion: ${type}`, "Formato preservado no payload bruto para reprocessamento futuro.", unsupportedBlocks, "Unknown Notion block type");
  }
};

export const renderBlocks = (
  blocks: NotionBlock[],
  unsupportedBlocks: UnsupportedNotionBlock[] = [],
  depth = 0,
) => {
  const html: string[] = [];
  let index = 0;

  while (index < blocks.length) {
    const block = blocks[index];

    if (block.type === "bulleted_list_item" || block.type === "numbered_list_item") {
      const run = renderListRun(blocks, index, block.type, unsupportedBlocks, depth);
      html.push(run.html);
      index = run.nextIndex;
      continue;
    }

    if (block.type === "to_do") {
      const run = renderTaskRun(blocks, index, unsupportedBlocks, depth);
      html.push(run.html);
      index = run.nextIndex;
      continue;
    }

    const rendered = renderBlock(block, unsupportedBlocks, depth);
    if (rendered) html.push(rendered);
    index += 1;
  }

  return html.join("\n");
};

export const renderNotionBlocksForImport = (blocks: NotionBlock[]): NotionRenderResult => {
  const unsupportedBlocks: UnsupportedNotionBlock[] = [];
  const contentHtml = renderBlocks(blocks, unsupportedBlocks);

  return {
    contentHtml,
    unsupportedBlocks,
    renderVersion: NOTION_RENDER_VERSION,
  };
};
