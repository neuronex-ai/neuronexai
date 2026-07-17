import { ArrowRight, ExternalLink } from "lucide-react";
import { Link } from "react-router-dom";

import {
  PublicPageShell,
  PublicProductHero,
} from "@/components/public/PublicPageShell";
import { Button } from "@/components/ui/button";
import { getPublicPage } from "@/content/public-content";

const MICROSOFT_STORE_URL =
  "https://apps.microsoft.com/detail/9PKGGSPS44CD?hl=pt-BR&gl=BR";

const DownloadLanding = () => {
  const page = getPublicPage("/download");
  if (!page) return null;

  return (
    <PublicPageShell
      page={page}
      hero={
        <PublicProductHero
          page={page}
          actions={
            <>
              <Button
                asChild
                className="public-tactile h-14 rounded-full bg-foreground px-7 font-mono text-[10px] font-black uppercase text-background"
              >
                <a
                  href={MICROSOFT_STORE_URL}
                  target="_blank"
                  rel="noreferrer"
                >
                  Abrir Microsoft Store
                  <ExternalLink className="ml-2 h-4 w-4" />
                </a>
              </Button>
              <Button
                asChild
                variant="outline"
                className="public-tactile h-14 rounded-full border-border/70 bg-background/38 px-7 font-mono text-[10px] font-black uppercase backdrop-blur-xl"
              >
                <Link to="/produto">
                  Conhecer o produto <ArrowRight className="ml-2 h-4 w-4" />
                </Link>
              </Button>
            </>
          }
        />
      }
    />
  );
};

export default DownloadLanding;
