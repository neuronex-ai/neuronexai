import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import path from "path";
import dyadComponentTagger from '@dyad-sh/react-vite-component-tagger';

export default defineConfig(({ mode, command }) => {
  const isProduction = command === 'build';

  return {
    base: "/",
    server: {
      host: "::",
      port: 8080,
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
      },
    },
    optimizeDeps: {
      include: []
    }
  };
});
