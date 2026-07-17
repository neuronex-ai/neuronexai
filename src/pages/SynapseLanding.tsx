import { PublicPageShell } from "@/components/public/PublicPageShell";
import { getPublicPage } from "@/content/public-content";

const SynapseLanding = () => {
  const page = getPublicPage("/synapse");
  if (!page) return null;

  return <PublicPageShell page={page} />;
};

export default SynapseLanding;
