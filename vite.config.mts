import tailwindcss from "@tailwindcss/vite";
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react(), tailwindcss()],
  build: {
    // keep CRA's output directory so the Cloudflare Pages config still works
    outDir: "build",
  },
});
