import { useEffect } from "react";
import { useLocation } from "react-router-dom";

export const ScrollToTop = () => {
    const { pathname, hash } = useLocation();

    useEffect(() => {
        const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

        if (!hash) {
            window.scrollTo({ top: 0, left: 0, behavior: "auto" });
            return;
        }

        const targetId = decodeURIComponent(hash.slice(1));
        const behavior: ScrollBehavior = reducedMotion ? "auto" : "smooth";
        const maxAttempts = 60;
        let attempts = 0;
        let frameId = 0;

        // A rota inicial pode estar sendo carregada sob demanda. Mantemos a busca
        // por alguns quadros para que o destino exista antes de tentar alcançá-lo.
        window.scrollTo({ top: 0, left: 0, behavior: "auto" });

        const scrollWhenReady = () => {
            const element = document.getElementById(targetId);
            if (element) {
                element.scrollIntoView({ behavior, block: "start" });
                return;
            }

            attempts += 1;
            if (attempts < maxAttempts) {
                frameId = window.requestAnimationFrame(scrollWhenReady);
            }
        };

        frameId = window.requestAnimationFrame(scrollWhenReady);

        return () => window.cancelAnimationFrame(frameId);
    }, [pathname, hash]);

    return null;
};
