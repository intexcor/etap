import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";
import { VitePWA } from "vite-plugin-pwa";

const api = "http://localhost:8787";

export default defineConfig({
  root: "web",
  plugins: [
    react(),
    tailwindcss(),
    VitePWA({
      registerType: "autoUpdate",
      manifest: {
        name: "ETAP",
        short_name: "ETAP",
        description: "Короткие обучающие ролики из любого материала",
        theme_color: "#0a0b14",
        background_color: "#0a0b14",
        display: "standalone",
        lang: "ru",
        icons: [
          { src: "icon.svg", sizes: "any", type: "image/svg+xml", purpose: "any" },
          { src: "icon-maskable.svg", sizes: "any", type: "image/svg+xml", purpose: "maskable" },
        ],
      },
      workbox: {
        // API и медиа всегда с сервера; кэшируем только оболочку приложения.
        navigateFallbackDenylist: [/^\/api\//, /^\/media\//],
        globPatterns: ["**/*.{js,css,html,svg,woff2}"],
        maximumFileSizeToCacheInBytes: 6 * 1024 * 1024,
      },
    }),
  ],
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
