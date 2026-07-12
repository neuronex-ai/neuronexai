const FALLBACK_PUBLIC_ORIGIN = "https://neuronex.ai";

const normalizeOrigin = (value?: string | null) => {
  const candidate = String(value || "").trim().replace(/\/+$/, "");
  if (!candidate) return null;
  try {
    const url = new URL(candidate);
    return url.protocol === "https:" || url.hostname === "localhost" ? url.origin : null;
  } catch {
    return null;
  }
};

export const getPublicAppOrigin = () => {
  const configured = normalizeOrigin(import.meta.env.VITE_PUBLIC_APP_URL);
  if (configured) return configured;

  if (typeof window !== "undefined") {
    const current = normalizeOrigin(window.location.origin);
    if (current && (import.meta.env.DEV || !/^(localhost|127\.0\.0\.1)$/i.test(window.location.hostname))) {
      return current;
    }
  }

  return FALLBACK_PUBLIC_ORIGIN;
};

export const buildPublicProfessionalProfileUrl = (profileId: string) =>
  `${getPublicAppOrigin()}/id/${encodeURIComponent(profileId)}`;
