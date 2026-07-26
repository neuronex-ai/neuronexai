import type { PublicArticle } from "./public-content";

const articleBodies = import.meta.glob<string>("./articles/*.md", {
  query: "?raw",
  import: "default",
  eager: true,
});

export function getPublicArticleBody(article: PublicArticle) {
  return articleBodies[`./articles/${article.bodyFile}`] ?? "";
}
