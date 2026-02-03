import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";
import { visualizer } from "rollup-plugin-visualizer";


// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  appType: "spa",
  server: {
    host: "::",
    port: 8080,
    proxy: {
      "/auth": {
        target: "http://localhost:8001",
        changeOrigin: true,
      },
      "/api": {
        target: "http://localhost:8001",
        changeOrigin: true,
      },
      "/calculate": {
        target: "http://localhost:8001",
        changeOrigin: true,
      }
    }
  },
  plugins: [react(), 
    mode === "development" && componentTagger(),
    visualizer({
      open: false,  // Mudar de true para false
      gzipSize: true,
      brotliSize: true,
      filename: "dist/stats.html",
    })
  ].filter(Boolean),
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
}));