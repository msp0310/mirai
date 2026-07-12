import { URL, fileURLToPath } from "node:url";

import { vanillaExtractPlugin } from "@vanilla-extract/vite-plugin";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  build: {
    // Brabio取込時だけ遅延ロードするXLSXチャンクは約500KBのため、初期バンドルと分けて監視します。
    chunkSizeWarningLimit: 550,
    rolldownOptions: {
      output: {
        // 画面コードの更新時にRouterとReactのキャッシュを再利用できるよう分離します。
        manualChunks(id) {
          if (id.includes("node_modules/@tanstack")) {
            return "router";
          }
          if (id.includes("node_modules/react") || id.includes("node_modules/scheduler")) {
            return "react-vendor";
          }
        },
      },
    },
  },
  optimizeDeps: {
    include: ["react", "react-dom/client"],
  },
  server: {
    proxy: {
      "/api": "http://127.0.0.1:5080",
    },
    warmup: {
      clientFiles: ["./src/main.tsx"],
    },
  },
  plugins: [react(), vanillaExtractPlugin()],
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("src", import.meta.url)),
    },
  },
});
