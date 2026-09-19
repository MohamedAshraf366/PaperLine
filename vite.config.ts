import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import path from "node:path";

export default defineConfig({
  plugins: [
    tanstackStart(),
    react(),
    tailwindcss(),
  ],

  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },

  server: {
    port: 5173,
  },

  optimizeDeps: {
    exclude: [
      "@tanstack/react-start",
      "@napi-rs/canvas",
      "@napi-rs/canvas-win32-x64-msvc",
    ],
  },
});
