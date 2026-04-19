import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import path from "path";
import runtimeErrorOverlay from "@replit/vite-plugin-runtime-error-modal";
import { metaImagesPlugin } from "./vite-plugin-meta-images";

export default defineConfig({
  plugins: [
    react(),
    runtimeErrorOverlay(),
    tailwindcss(),
    metaImagesPlugin(),
    ...(process.env.NODE_ENV !== "production" &&
    process.env.REPL_ID !== undefined
      ? [
          await import("@replit/vite-plugin-cartographer").then((m) =>
            m.cartographer(),
          ),
          await import("@replit/vite-plugin-dev-banner").then((m) =>
            m.devBanner(),
          ),
        ]
      : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "client", "src"),
      "@shared": path.resolve(import.meta.dirname, "shared"),
      "@assets": path.resolve(import.meta.dirname, "attached_assets"),
    },
  },
  css: {
    postcss: {
      plugins: [],
    },
  },
  root: path.resolve(import.meta.dirname, "client"),
  optimizeDeps: {
    // Force Vite to pre-bundle the unified/remark/rehype ESM ecosystem.
    // These pure-ESM packages have internal circular references that cause
    // "Cannot access before initialization" TDZ crashes when Rollup bundles
    // them statically. Pre-bundling converts them to a single CJS-compatible
    // module that initialises in a safe, deterministic order.
    include: [
      "react-markdown",
      "remark-parse",
      "remark-rehype",
      "rehype-stringify",
      "unified",
      "vfile",
      "unist-util-visit",
    ],
  },
  build: {
    outDir: path.resolve(import.meta.dirname, "dist/public"),
    emptyOutDir: true,
    rollupOptions: {
      output: {
        // Isolate the unified/markdown ecosystem into its own vendor chunk so
        // its internal circular references are resolved within that chunk alone
        // and never pollute the main application bundle's initialisation order.
        manualChunks(id) {
          if (
            id.includes("node_modules/react-markdown") ||
            id.includes("node_modules/unified") ||
            id.includes("node_modules/remark") ||
            id.includes("node_modules/rehype") ||
            id.includes("node_modules/vfile") ||
            id.includes("node_modules/unist") ||
            id.includes("node_modules/micromark") ||
            id.includes("node_modules/mdast") ||
            id.includes("node_modules/hast")
          ) {
            return "markdown-vendor";
          }
        },
      },
    },
  },
  server: {
    host: "0.0.0.0",
    allowedHosts: true,
    fs: {
      strict: true,
      deny: ["**/.*"],
    },
  },
});
