import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      "react-hooks/set-state-in-effect": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",

    // Engine terukur punya aturan gayanya sendiri dan diuji dengan node --test,
    // bukan dengan eslint milik Next. Melintasinya di sini mencegah ribuan
    // peringatan yang tidak ada hubungannya dengan aplikasi web.
    "engine/**",

    // Hasil audit adalah data, bukan kode.
    "public/data/**",
  ]),
]);

export default eslintConfig;
