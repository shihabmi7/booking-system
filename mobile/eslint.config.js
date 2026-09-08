// Flat config (ESLint 9's format). eslint-config-expo brings the React, React Hooks and React
// Native rules already tuned for an Expo app; eslint-config-prettier is last so formatting rules
// that would fight Prettier get switched off rather than argued with.
const { defineConfig } = require("eslint/config");
const expoConfig = require("eslint-config-expo/flat");
const prettierConfig = require("eslint-config-prettier/flat");

module.exports = defineConfig([
  expoConfig,
  prettierConfig,
  {
    ignores: ["dist/*", ".expo/*"],
  },
]);
