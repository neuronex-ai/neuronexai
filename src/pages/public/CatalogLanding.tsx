import { PublicPageShell } from "@/components/public/PublicPageShell";
import { getPublicPage } from "@/content/public-content";

export const CatalogLanding = ({ route }: { route: string }) => {
  const page = getPublicPage(route);
  if (!page) return null;
  return <PublicPageShell page={page} />;
};

export default CatalogLanding;
