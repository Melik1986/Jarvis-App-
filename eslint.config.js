const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const eslintPluginPrettierRecommended = require("eslint-plugin-prettier/recommended");
const securityPlugin = require("eslint-plugin-security");
const deMorganPlugin = require("eslint-plugin-de-morgan");
const tseslint = require("typescript-eslint");

module.exports = defineConfig([
  // Base configurations
  expoConfig,
  eslintPluginPrettierRecommended,
  securityPlugin.configs.recommended,
  ...tseslint.configs.recommended,

  // De Morgan Plugin (Security)
  {
    plugins: {
      "de-morgan": deMorganPlugin,
    },
    rules: {
      ...deMorganPlugin.configs.recommended.rules,
    },
  },

  // Custom Rules & Overrides
  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    rules: {
      // --- Security Rules ---
      "security/detect-object-injection": "off",
      "security/detect-new-buffer": "error",
      "security/detect-eval-with-expression": "error",
      "security/detect-unsafe-regex": "warn",
      "security/detect-non-literal-regexp": "warn",
      "security/detect-pseudoRandomBytes": "warn",
      "security/detect-possible-timing-attacks": "warn",
      "security/detect-child-process": "warn",
      "security/detect-non-literal-fs-filename": "warn",
      "security/detect-no-csrf-before-method-override": "warn",

      // --- Code Quality ---
      "no-console": "warn",
      "prefer-const": "error",
      "no-var": "error",

      // --- TypeScript ---
      "@typescript-eslint/no-unused-vars": "warn",
      "@typescript-eslint/no-explicit-any": "error",
      "@typescript-eslint/explicit-function-return-type": "off",
      "@typescript-eslint/ban-ts-comment": "off",
      "@typescript-eslint/naming-convention": [
        "error",
        {
          selector: "variable",
          format: ["camelCase", "UPPER_CASE", "PascalCase"],
          leadingUnderscore: "allow",
        },
        {
          selector: "function",
          format: ["camelCase", "PascalCase"],
        },
        {
          selector: "interface",
          format: ["PascalCase"],
          custom: {
            regex: "^I[A-Z]",
            match: false,
          },
        },
        {
          selector: "typeLike",
          format: ["PascalCase"],
        },
      ],
    },
  },

  // Config files overrides
  {
    files: ["*.config.js", "scripts/**/*.js", "eslint.config.js"],
    rules: {
      "@typescript-eslint/no-require-imports": "off",
    },
  },

  // Ignores
  {
    ignores: [
      "dist/*",
      "server_dist/*",
      "server/dist/*",
      "server-nest/dist/*",
      "**/*.d.ts",
    ],
  },
]);
