import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Dev server proxies /api requests to the backend on :4000 so the frontend
// can call fetch("/api/health") without dealing with CORS URLs directly.
export default defineConfig({
  plugins: [react()],
  server: {
    port: 5173,
    proxy: {
      "/api": {
        target: "http://localhost:4000",
        changeOrigin: true,
      },
    },
  },
});
