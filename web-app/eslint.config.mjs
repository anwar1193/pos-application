import { FlatCompat } from "@eslint/eslintrc";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({ baseDirectory: __dirname });

const config = [
  {
    ignores: [
      ".next/**",
      ".next-e2e/**",
      "node_modules/**",
      "next-env.d.ts",
      "src/db/migrations/**",
      "playwright-report/**",
      "test-results/**",
    ],
  },
  ...compat.extends("next/core-web-vitals", "next/typescript"),
  {
    // The App Router loads these from the root layout, so the pages-router
    // assumption behind this rule (single-page font loading) does not apply.
    files: ["src/app/layout.tsx"],
    rules: { "@next/next/no-page-custom-font": "off" },
  },
];

export default config;
