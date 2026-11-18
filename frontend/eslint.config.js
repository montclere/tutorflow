import js from "@eslint/js";
import jsxA11y from "eslint-plugin-jsx-a11y";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["dist", "node_modules"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  reactHooks.configs.flat.recommended,
  jsxA11y.flatConfigs.recommended,
  {
    files: ["src/shared/ui/kit/**"],
    rules: { "jsx-a11y/heading-has-content": "off" },
  },
  {
    // Браузерные сценарии и конфиги выполняются в Node.
    files: ["tests/**/*.mjs", "*.config.mjs", "vite/**/*.ts"],
    languageOptions: { globals: globals.node },
  },
  {
    languageOptions: { globals: { ...globals.browser } },
    rules: {
      "no-console": "error",
    },
  },
);
