import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

const api = "http://localhost:8787";

export default defineConfig({
  root: "web",
  plugins: [react()],
  build: { outDir: "../dist", emptyOutDir: true },
  server: {
    host: true,
    // 5173 часто занят другими Vite-проектами
    port: 5180,
    strictPort: true,
    // со слэшем на конце, иначе прокси перехватит модуль /api.ts
    proxy: { "/api/": api, "/media/": api },
  },
});
