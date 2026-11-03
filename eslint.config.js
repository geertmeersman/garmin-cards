import js from "@eslint/js";
import globals from "globals";

export default [
  js.configs.recommended,
  {
    rules: {
      "no-unused-vars": "warn",
      "no-console": "off",
      "no-empty": ["error", { "allowEmptyCatch": true }],
    },
    languageOptions: {
      globals: {
        ...globals.browser,
        L: "readonly",
      },
    },
  },
];
