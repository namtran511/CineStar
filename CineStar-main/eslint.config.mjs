import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";

const eslintConfig = defineConfig([
  ...nextVitals,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "dist/**",
    ".sites-runtime/**",
    ".wrangler/**",
    ".vinext/**",
    "outputs/**",
  ]),
  {
    files: ["components/ui/**/*.jsx", "hooks/use-mobile.js"],
    rules: {
      // These components originate from shadcn and are converted to JavaScript.
      "react-hooks/purity": "off",
      "react-hooks/set-state-in-effect": "off",
    },
  },
]);

export default eslintConfig;
