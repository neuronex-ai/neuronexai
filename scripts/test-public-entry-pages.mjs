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
  <meta name="robots" content="index, follow" />
  <meta property="og:url" content="https://example.test/" />
  <meta property="og:title" content="Home" />
  <meta property="og:description" content="Home" />
  <meta property="og:image" content="https://example.test/image.png" />
  <meta name="twitter:url" content="https://example.test/" />
  <meta name="twitter:title" content="Home" />
  <meta name="twitter:description" content="Home" />
  <meta name="twitter:image" content="https://example.test/image.png" />
  <link rel="canonical" href="https://example.test/" />
  <script id="neuronex-route-structured-data" type="application/ld+json">[]</script>
</head><body><noscript><main id="static-public-shell">Home</main></noscript><div id="root"></div></body></html>`;

test("each public route generates unique static metadata and visible content", () => {
  const routes = new Set();
  const files = new Set();

  for (const page of publicEntryPages) {
    assert.equal(routes.has(page.route), false, `duplicate route: ${page.route}`);
    assert.equal(files.has(page.file), false, `duplicate file: ${page.file}`);
    routes.add(page.route);
    files.add(page.file);

    const html = buildPublicEntryHtml(template, page);
    assert.match(html, new RegExp(`<title>${page.title.replace(/[.*+?^${}()|[\\]\\]/g, "\\$&")}</title>`));
    assert.ok(html.includes(`href="${PUBLIC_SITE_URL}${page.route}"`));
    assert.ok(html.includes(page.heading));
    assert.ok(html.includes("<noscript>"));
    assert.ok(html.includes('id="neuronex-route-structured-data"'));
    assert.equal(html.includes("neuronex-entry-visibility-script"), false);
    assert.equal(html.includes("neuronex-entry-visibility-style"), false);
  }
});

test("sitemap and Vercel rewrites cover every generated public entry", async () => {
  const sitemap = await readFile(new URL("../public/sitemap.xml", import.meta.url), "utf8");
  const vercel = JSON.parse(
    await readFile(new URL("../vercel.json", import.meta.url), "utf8"),
  );

  for (const page of publicEntryPages) {
    assert.ok(sitemap.includes(`<loc>${PUBLIC_SITE_URL}${page.route}</loc>`), page.route);
    assert.ok(
      vercel.rewrites.some(
        (rewrite) =>
          rewrite.source === page.route &&
          rewrite.destination === `/${PUBLIC_ENTRY_DIRECTORY}/${page.file}`,
      ),
      `missing rewrite for ${page.route}`,
    );
  }

  const sitemapRoutes = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map(
    ([, url]) => new URL(url).pathname.replace(/\/+$/, "") || "/",
  );
  const expectedRoutes = publicPages.map(({ route }) => route);
  assert.deepEqual(new Set(sitemapRoutes), new Set(expectedRoutes));
  assert.equal(sitemap, renderPublicSitemap());

  const generatedRewriteRoutes = vercel.rewrites
    .filter(({ destination }) => destination.startsWith(`/${PUBLIC_ENTRY_DIRECTORY}/`))
    .map(({ source }) => source);
  assert.deepEqual(
    new Set(generatedRewriteRoutes),
    new Set(publicEntryPages.map(({ route }) => route)),
  );
});

test("the home entry uses the same public-page catalog", async () => {
  const template = await readFile(new URL("../index.html", import.meta.url), "utf8");
  const home = publicPages.find(({ route }) => route === "/");

  assert.ok(home);
  assert.ok(template.includes(`<title>${home.title}</title>`));
  assert.ok(template.includes(home.description));
  assert.ok(template.includes(home.heading));
  assert.ok(template.includes(`href="${PUBLIC_SITE_URL}/"`));
});
