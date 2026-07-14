import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  notionRichTextPlain,
  renderNotionBlocksForImport,
} from "../_shared/notion-import-renderer.ts";

const NOTION_VERSION = "2022-06-28";
const MAX_BLOCK_DEPTH = 12;
const MAX_BLOCKS_PER_PAGE = 1500;

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface NotionBlock {
  id: string;
  type: string;
  has_children?: boolean;
  children?: NotionBlock[];
  [key: string]: any;
}

interface NotionPage {
  id: string;
  url: string;
  last_edited_time: string;
  created_time?: string;
  properties: Record<string, any>;
  icon: { type: string; emoji?: string; file?: { url: string }; external?: { url: string } } | null;
  cover: { file?: { url: string }; external?: { url: string } } | null;
  parent?: { type: string; [key: string]: any };
  archived?: boolean;
  in_trash?: boolean;
}

interface NotionImport {
  notion_page_id: string;
  note_id: string | null;
  imported_at: string;
  last_edited_time: string | null;
}

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

const escapeHtml = (value: string) =>
  value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");

const notionRequest = async (token: string, path: string, init: RequestInit = {}) => {
  const response = await fetch(`https://api.notion.com/v1${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      "Notion-Version": NOTION_VERSION,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const data = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(data?.message || `Notion API error: ${response.status}`);
  }

  return data;
};

const getPageTitle = (page: NotionPage) => {
  const titleProperty = Object.values(page.properties || {}).find((property: any) => property?.type === "title") as any;
  return notionRichTextPlain(titleProperty?.title).trim() || "Pagina do Notion";
};

const getPageIcon = (page: NotionPage) =>
  page.icon
    ? {
        type: page.icon.type,
        value: page.icon.type === "emoji" ? page.icon.emoji : page.icon.file?.url || page.icon.external?.url,
      }
    : null;

const buildImportLookup = (imports: NotionImport[] = []) => {
  const lookup = new Map<string, NotionImport>();
  for (const item of imports) {
    lookup.set(item.notion_page_id, item);
  }
  return lookup;
};

const getImportState = (page: NotionPage, importLookup: Map<string, NotionImport>) => {
  const imported = importLookup.get(page.id);
  if (!imported) {
    return {
      is_imported: false,
      imported_note_id: null,
      imported_at: null,
      import_is_stale: false,
    };
  }

  const sourceEditedAt = page.last_edited_time ? new Date(page.last_edited_time).getTime() : 0;
  const importedEditedAt = imported.last_edited_time ? new Date(imported.last_edited_time).getTime() : 0;

  return {
    is_imported: true,
    imported_note_id: imported.note_id,
    imported_at: imported.imported_at,
    import_is_stale: sourceEditedAt > importedEditedAt,
  };
};

const fetchBlockChildren = async (
  token: string,
  blockId: string,
  depth = 0,
  state = { count: 0 },
): Promise<NotionBlock[]> => {
  const blocks: NotionBlock[] = [];
  let cursor: string | null = null;

  if (depth > MAX_BLOCK_DEPTH || state.count >= MAX_BLOCKS_PER_PAGE) {
    return blocks;
  }

  do {
    const query = new URLSearchParams({ page_size: "100" });
    if (cursor) query.set("start_cursor", cursor);

    const data = await notionRequest(token, `/blocks/${blockId}/children?${query.toString()}`);
    const results = (data.results || []) as NotionBlock[];

    for (const block of results) {
      state.count += 1;
      if (block.has_children && depth < MAX_BLOCK_DEPTH && state.count < MAX_BLOCKS_PER_PAGE) {
        block.children = await fetchBlockChildren(token, block.id, depth + 1, state);
      }
      blocks.push(block);

      if (state.count >= MAX_BLOCKS_PER_PAGE) break;
    }

    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor && state.count < MAX_BLOCKS_PER_PAGE);

  return blocks;
};

const searchNotionPages = async (token: string): Promise<NotionPage[]> => {
  const pages: NotionPage[] = [];
  let cursor: string | null = null;

  do {
    const data = await notionRequest(token, "/search", {
      method: "POST",
      body: JSON.stringify({
        filter: { property: "object", value: "page" },
        sort: { direction: "descending", timestamp: "last_edited_time" },
        page_size: 100,
        ...(cursor ? { start_cursor: cursor } : {}),
      }),
    });

    pages.push(...((data.results || []) as NotionPage[]));
    cursor = data.has_more ? data.next_cursor : null;
  } while (cursor);

  return pages;
};

const buildSourceMeta = (page: NotionPage, workspaceId: string | null, importedAt: string) => ({
  page_id: page.id,
  workspace_id: workspaceId,
  url: page.url || null,
  title: getPageTitle(page),
  parent: page.parent || null,
  icon: page.icon || null,
  cover: page.cover || null,
  created_time: page.created_time || null,
  last_edited_time: page.last_edited_time || null,
  imported_at: importedAt,
  api_version: NOTION_VERSION,
});

const shouldIgnoreMissingTable = (error: any) =>
  error?.code === "42P01" || String(error?.message || "").toLowerCase().includes("does not exist");

serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const supabaseService = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    const authHeader = req.headers.get("Authorization");
    if (!authHeader) throw new Error("Missing Authorization header");

    const {
      data: { user },
      error: authError,
    } = await supabaseService.auth.getUser(authHeader.replace("Bearer ", ""));

    if (authError || !user) throw new Error("Unauthorized");

    const { data: tokenData, error: tokenError } = await supabaseService
      .from("user_notion_tokens")
      .select("access_token, workspace_id")
      .eq("user_id", user.id)
      .single();

    if (tokenError || !tokenData?.access_token) throw new Error("Notion not connected");

    const notionToken = tokenData.access_token;
    const workspaceId = tokenData.workspace_id || null;
    const url = new URL(req.url);
    const action = url.searchParams.get("action");

    if (action === "content") {
      const pageId = url.searchParams.get("page_id");
      if (!pageId) throw new Error("Missing page_id");

      const blocks = await fetchBlockChildren(notionToken, pageId, 0);
      const rendered = renderNotionBlocksForImport(blocks);
      return json({ blocks, rendered });
    }

    if (action === "update-block") {
      const blockId = url.searchParams.get("block_id");
      if (!blockId) throw new Error("Missing block_id");

      const payload = await req.json();
      const data = await notionRequest(notionToken, `/blocks/${blockId}`, {
        method: "PATCH",
        body: JSON.stringify(payload),
      });

      return json(data);
    }

    if (action === "import-page") {
      const body = await req.json().catch(() => ({}));
      const pageId = body.page_id || body.pageId || url.searchParams.get("page_id");
      if (!pageId) throw new Error("Missing page_id");

      const page = (await notionRequest(notionToken, `/pages/${pageId}`)) as NotionPage;
      const blocks = await fetchBlockChildren(notionToken, pageId, 0);
      const rendered = renderNotionBlocksForImport(blocks);
      const title = getPageTitle(page);
      const sourceUrl = page.url || null;
      const importedAt = new Date().toISOString();
      const sourceMeta = buildSourceMeta(page, workspaceId, importedAt);
      const content = [
        `<p><strong>Origem:</strong> ${sourceUrl ? `<a href="${escapeHtml(sourceUrl)}" target="_blank" rel="noopener noreferrer">Notion</a>` : "Notion"}</p>`,
        rendered.contentHtml || "<p>Esta pagina nao possui conteudo visivel no Notion.</p>",
      ].join("\n");

      const { data: existingImport, error: existingImportError } = await supabaseService
        .from("notion_imports")
        .select("id, note_id")
        .eq("user_id", user.id)
        .eq("notion_page_id", pageId)
        .maybeSingle();

      if (existingImportError && !shouldIgnoreMissingTable(existingImportError)) {
        throw existingImportError;
      }

      const notePayload = {
        user_id: user.id,
        patient_id: null,
        module_id: null,
        title,
        content,
        tags: ["Notion", "importado"],
        reference_date: page.last_edited_time || importedAt,
        updated_at: importedAt,
      };

      const noteQuery = existingImport?.note_id
        ? supabaseService
            .from("personal_notes")
            .update(notePayload)
            .eq("id", existingImport.note_id)
            .eq("user_id", user.id)
        : supabaseService.from("personal_notes").insert(notePayload);

      const { data: note, error: noteError } = await noteQuery
        .select("id, user_id, module_id, patient_id, title, content, tags, reference_date, updated_at, created_at")
        .single();

      if (noteError) throw noteError;

      const { error: importError } = await supabaseService
        .from("notion_imports")
        .upsert(
          {
            user_id: user.id,
            workspace_id: workspaceId,
            notion_page_id: pageId,
            note_id: note.id,
            title,
            source_url: sourceUrl,
            last_edited_time: page.last_edited_time || null,
            imported_at: importedAt,
            updated_at: importedAt,
            raw_page: page,
            raw_blocks: blocks,
            unsupported_blocks: rendered.unsupportedBlocks,
            api_version: NOTION_VERSION,
            render_version: rendered.renderVersion,
            source_meta: sourceMeta,
          },
          { onConflict: "user_id,notion_page_id" },
        );

      if (importError && !shouldIgnoreMissingTable(importError)) {
        throw importError;
      }

      return json({
        note,
        created: !existingImport?.note_id,
        unsupported_blocks: rendered.unsupportedBlocks,
        render_version: rendered.renderVersion,
        source: {
          page_id: pageId,
          title,
          url: sourceUrl,
          last_edited_time: page.last_edited_time || null,
        },
      });
    }

    const searchResults = await searchNotionPages(notionToken);

    const { data: imports, error: importsError } = await supabaseService
      .from("notion_imports")
      .select("notion_page_id, note_id, imported_at, last_edited_time")
      .eq("user_id", user.id);

    if (importsError && !shouldIgnoreMissingTable(importsError)) {
      throw importsError;
    }

    const importLookup = buildImportLookup((imports || []) as NotionImport[]);

    const pages = searchResults.map((page: NotionPage) => ({
      id: page.id,
      title: getPageTitle(page),
      icon: getPageIcon(page),
      cover: page.cover?.external?.url || page.cover?.file?.url || null,
      url: page.url,
      last_edited_time: page.last_edited_time,
      parent_type: page.parent?.type || "workspace",
      import: getImportState(page, importLookup),
    }));

    return json({ pages });
  } catch (error) {
    return json({ error: (error as Error).message }, 400);
  }
});
