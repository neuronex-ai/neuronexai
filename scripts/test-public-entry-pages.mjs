import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

import {
  buildPublicEntryHtml,
  PUBLIC_ENTRY_DIRECTORY,
  PUBLIC_SITE_URL,
  renderPublicSitemap,
  publicEntryPages,
  publicPages,
} from "./generate-public-entry-pages.mjs";

const template = `<!doctype html><html><head>
  <title>Home</title>
  <meta name="title" content="Home" />
  <meta name="description" content="Home" />
  <meta name="keywords" content="" />
  <meta name="robots" content="index, follow" />
  <meta property="og:type" content="website" />
  <meta property="og:url" content="https://example.test/" />
  <meta property="og:title" content="Home" />
  <meta property="og:description" content="Home" />
  <meta property="og:image" content="https://example.test/image.png" />
  <meta property="og:image:alt" content="Home" />
  <meta name="twitter:url" content="https://example.test/" />
  <meta name="twitter:title" content="Home" />
  <meta name="twitter:description" content="Home" />
  <meta name="twitter:image" content="https://example.test/image.png" />
  <meta name="twitter:image:alt" content="Home" />
  <link rel="canonical" href="https://example.test/" />
  <script id="neuronex-route-structured-data" type="application/ld+json">[]</script>
</head><body><div id="root"></div></body></html>`;

test("each public route generates unique metadata and a complete initial HTML", async () => {
  const routes = new Set();
  const files = new Set();

  for (const page of publicEntryPages) {
    assert.equal(routes.has(page.route), false, `duplicate route: ${page.route}`);
    assert.equal(files.has(page.file), false, `duplicate file: ${page.file}`);
    routes.add(page.route);
    files.add(page.file);

    const html = await buildPublicEntryHtml(template, page);
    const expectedTitle =
      page.kind === "article"
        ? page.seoTitle || `${page.title} | NeuroNex`
        : page.title;

    assert.ok(html.includes(`<title>${expectedTitle}</title>`), page.route);
    assert.ok(html.includes(`href="${PUBLIC_SITE_URL}${page.route}"`));
    assert.ok(html.includes(`<h1`));
    assert.ok(html.includes(page.heading));
    assert.ok(html.includes("<h2"));
    assert.ok(html.includes('id="static-public-shell"'));
    assert.ok(html.includes('href="/download"'));
    assert.ok(html.includes('id="neuronex-route-structured-data"'));
    assert.equal(html.includes("<noscript>"), false);
    assert.equal(html.includes('id="root"></div>'), false);
  }
});

test("sitemap and Vercel routes cover every public entry", async () => {
  const sitemap = renderPublicSitemap();
  const vercel = JSON.parse(
    await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  );

  for (const page of publicPages) {
    assert.ok(
      sitemap.includes(`<loc>${PUBLIC_SITE_URL}${page.route}</loc>`),
      page.route,
    );
  }

  for (const page of publicEntryPages.filter(
    ({ kind }) => kind !== "article",
  )) {
    assert.ok(
      vercel.rewrites.some(
        (rewrite) =>
          rewrite.source === page.route &&
          rewrite.destination === `/${PUBLIC_ENTRY_DIRECTORY}/${page.file}`,
      ),
      `missing rewrite for ${page.route}`,
    );
  }

  assert.ok(
    vercel.rewrites.some(
      (rewrite) =>
        rewrite.source === "/blog/:slug" &&
        rewrite.destination ===
          `/${PUBLIC_ENTRY_DIRECTORY}/blog/:slug.html`,
    ),
  );
  assert.ok(
    vercel.redirects.some(
      (redirect) =>
        redirect.source === "/pricing" &&
        redirect.destination === "/download" &&
        redirect.permanent === true,
    ),
  );

  const sitemapRoutes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    ([, url]) => new URL(url).pathname.replace(/\/+$/, "") || "/",
  );
  assert.deepEqual(
    new Set(sitemapRoutes),
    new Set(publicPages.map(({ route }) => route)),
  );
});

test("comparison entries include source disclosure and useful static content", async () => {
  const index = publicEntryPages.find(({ route }) => route === "/comparar");
  const detail = publicEntryPages.find(
    ({ route }) => route === "/comparar/neuronex-vs-psicomanager",
  );

  assert.ok(index);
  assert.ok(detail);

  const indexHtml = await buildPublicEntryHtml(template, index);
  const detailHtml = await buildPublicEntryHtml(template, detail);

  assert.ok(indexHtml.includes("Comparações disponíveis"));
  assert.ok(indexHtml.includes("PsicoManager"));
  assert.ok(detailHtml.includes("Comparação por casos de uso"));
  assert.ok(detailHtml.includes("dados públicos verificados"));
  assert.ok(detailHtml.includes("julho de 2026"));
  assert.ok(detailHtml.includes("FAQPage"));
});

test("the home entry is generated from the same public catalog", async () => {
  const home = publicPages.find(({ route }) => route === "/");

  assert.ok(home);
  const html = await buildPublicEntryHtml(template, home);
  assert.ok(html.includes(`<title>${home.title}</title>`));
  assert.ok(html.includes(home.description));
  assert.ok(html.includes(home.heading));
  assert.ok(html.includes(`href="${PUBLIC_SITE_URL}/"`));
});
