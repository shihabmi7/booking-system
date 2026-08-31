import { defineConfig } from "vitest/config";
import react from "@vitejs/plugin-react";

// Separate from vite.config.ts (not merged into it) — that file's `server.proxy` block is
// dev-server-only config with nothing to do with running tests, and keeping them apart means
// neither file has to reason about "am I being loaded for `vite dev` or for `vitest`".
export default defineConfig({
  plugins: [react()],
  test: {
    environment: "jsdom",
    setupFiles: ["./src/setupTests.ts"],
    globals: true,
    css: false,
  },
});
