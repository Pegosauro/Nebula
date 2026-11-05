import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";

const base = process.env.NEBULA_BASE_PATH ?? "/";

export default defineConfig({
  base,
  server: {
    allowedHosts: ["terminal.local"]
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "prompt",
      injectRegister: false,
      includeAssets: ["icons/nebula.svg", "icons/nebula-192.png", "icons/nebula-512.png"],
      manifest: {
        name: "Nebula",
        short_name: "Nebula",
        description: "Workspace local-first per note Markdown, collegamenti e configuratori.",
        start_url: base,
        scope: base,
        display: "standalone",
        background_color: "#0b0d12",
        theme_color: "#11141b",
        categories: ["productivity", "utilities"],
        icons: [
          {
            src: "icons/nebula-192.png",
            sizes: "192x192",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "icons/nebula-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "any"
          },
          {
            src: "icons/nebula-512.png",
            sizes: "512x512",
            type: "image/png",
            purpose: "maskable"
          }
        ]
      },
      workbox: {
        navigateFallback: `${base}index.html`,
        globPatterns: ["**/*.{js,css,html,svg,png,ico,woff2}", "samples/*.zip"],
        cleanupOutdatedCaches: true,
        clientsClaim: false,
        skipWaiting: false
      }
    })
  ],
  define: {
    __APP_VERSION__: JSON.stringify(process.env.npm_package_version ?? "0.1.0")
  },
  build: {
    target: "es2022",
    sourcemap: true
  }
});
