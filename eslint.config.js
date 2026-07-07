import globals from "globals";
import js from "@eslint/js";

export default [
  { ignores: ["dist/**", ".astro/**"] },
  {
    files: ["src/**/*.{js,ts,astro}"],
    languageOptions: {
      globals: { ...globals.browser, ...globals.node },
    },
    ...js.configs.recommended,
    rules: {
      "no-unused-vars": ["warn", { argsIgnorePattern: "^_" }],
    },
  },
];
