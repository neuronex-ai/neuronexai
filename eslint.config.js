import js from "@eslint/js";
import globals from "globals";
import reactHooks from "eslint-plugin-react-hooks";
import reactRefresh from "eslint-plugin-react-refresh";
import tseslint from "typescript-eslint";

export default tseslint.config(
  {
    ignores: [
      "dist/**",
      "coverage/**",
      "backups/**",
      "src/integrations/supabase/database.types.ts",
    ],
  },
  {
    files: ["**/*.{js,cjs,mjs}"],
    languageOptions: {
      ecmaVersion: "latest",
    },
    rules: {
      ...js.configs.recommended.rules,
      "no-unused-vars": ["error", { ignoreRestSiblings: true }],
    },
  },
  {
    files: [
      "eslint.config.js",
      "postcss.config.js",
      "scripts/**/*.{js,mjs}",
      "server/**/*.js",
    ],
    languageOptions: {
      globals: globals.node,
      sourceType: "module",
    },
  },
  {
    files: ["scripts/**/*.cjs"],
    languageOptions: {
      globals: globals.node,
      sourceType: "commonjs",
    },
  },
  {
    files: ["public/sw.js", "public/firebase-messaging-sw.js"],
    languageOptions: {
      globals: globals.serviceworker,
      sourceType: "script",
    },
  },
  {
    files: [
      "public/worklets/**/*.js",
      "docs/archive/legacy-integrations/gemini-voice/**/*.js",
    ],
    languageOptions: {
      globals: {
        AudioWorkletProcessor: "readonly",
        registerProcessor: "readonly",
        sampleRate: "readonly",
      },
      sourceType: "script",
    },
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: {
      ecmaVersion: 2020,
      globals: globals.browser,
    },
    plugins: {
      "react-hooks": reactHooks,
      "react-refresh": reactRefresh,
    },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "react-refresh/only-export-components": ["warn", { allowConstantExport: true }],
      "@typescript-eslint/no-unused-vars": "off",
      "@typescript-eslint/no-explicit-any": "off",
    },
  },
  {
    files: ["supabase/functions/**/*.ts"],
    rules: {
      "@typescript-eslint/ban-ts-comment": "off",
    },
  },
);
