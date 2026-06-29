import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  build: {
    rolldownOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes("node_modules")) return;
          if (id.includes("react") || id.includes("react-dom")) return "vendor-react";
          if (id.includes("lucide-react")) return "vendor-icons";
          if (id.includes("firebase")) return "vendor-firebase";
          if (id.includes("pdfjs-dist")) return "vendor-pdf";
          return "vendor";
        },
      },
    },
  },
});
