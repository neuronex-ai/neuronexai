import { defineConfig, loadEnv } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import dyadComponentTagger from '@dyad-sh/react-vite-component-tagger';

function firstEnvValue(...values: Array<string | undefined>) {
  return values.map((value) => value?.trim()).find(Boolean) || "";
}

function normalizeSupabaseUrl(value: string) {
  return value.replace(/\/+$/, "");
}

function parseDefaultPublishableKey(value?: string) {
  if (!value?.trim()) return "";

  try {
    const parsed = JSON.parse(value) as Record<string, unknown>;
    return typeof parsed.default === "string" ? parsed.default.trim() : "";
  } catch {
    return "";
  }
}

function resolvePublicSupabaseEnv(mode: string) {
  const env = loadEnv(mode, process.cwd(), "");
  const supabaseUrl = normalizeSupabaseUrl(firstEnvValue(env.VITE_SUPABASE_URL, env.SUPABASE_URL));
  const supabasePublicKey = firstEnvValue(
    env.VITE_SUPABASE_ANON_KEY,
    env.VITE_SUPABASE_PUBLISHABLE_KEY,
    env.SUPABASE_ANON_KEY,
    env.SUPABASE_PUBLISHABLE_KEY,
    parseDefaultPublishableKey(env.SUPABASE_PUBLISHABLE_KEYS),
  );

  return { supabaseUrl, supabasePublicKey };
}

export default defineConfig(({ mode, command }) => {
  const isProductionBuild = command === 'build';
  const { supabaseUrl, supabasePublicKey } = resolvePublicSupabaseEnv(mode);

  if (isProductionBuild && (!supabaseUrl || !supabasePublicKey)) {
    const missing = [
      !supabaseUrl ? "VITE_SUPABASE_URL" : "",
      !supabasePublicKey ? "VITE_SUPABASE_ANON_KEY" : "",
    ].filter(Boolean);

    throw new Error(
      `[NeuroNex] Missing public Supabase env for production build: ${missing.join(", ")}. ` +
        "Configure VITE_SUPABASE_URL and VITE_SUPABASE_ANON_KEY in Vercel, " +
        "or provide SUPABASE_URL and SUPABASE_ANON_KEY/PUBLISHABLE_KEY as build aliases.",
    );
  }

  return {
    base: "/",
    define: {
      "import.meta.env.VITE_SUPABASE_URL": JSON.stringify(supabaseUrl),
      "import.meta.env.VITE_SUPABASE_ANON_KEY": JSON.stringify(supabasePublicKey),
    },
    server: {
      host: "::",
      port: 8080,
      proxy: {
        "/v1/synapse/voice": {
          target: "ws://localhost:8789",
          ws: true,
          changeOrigin: true,
        },
      },
    },
    plugins: [
      mode === 'development' && dyadComponentTagger(),
      react()
    ].filter(Boolean),
    resolve: {
      alias: [
        {
          find: "@/hooks/use-ai-chat",
          replacement: path.resolve(__dirname, "./src/hooks/use-ai-chat-resilient.ts"),
        },
        {
          find: "@/components/financeiro/CustomOnboardingFlow",
          replacement: path.resolve(__dirname, "./src/components/financeiro/OnboardingRecoveryBoundary.tsx"),
        },
        {
          find: "@",
          replacement: path.resolve(__dirname, "./src"),
        },
      ],
    },
    build: {
      rollupOptions: {
        input: {
          main: path.resolve(__dirname, "index.html"),
        },
        output: {
          manualChunks(id) {
            if (!id.includes("node_modules")) return undefined;
            if (id.includes("@react-pdf") || id.includes("pdfjs-dist") || id.includes("html2canvas")) return "documents";
            if (id.includes("mermaid") || id.includes("cytoscape") || id.includes("dagre")) return "diagrams";
            if (id.includes("@supabase")) return "supabase";
            return undefined;
          },
        },
      },
    },
    optimizeDeps: {
      include: []
    }
  };
});
