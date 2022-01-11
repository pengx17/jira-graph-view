import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vitejs.dev/config/
export default defineConfig({
  server: {
    proxy: {
      "/api": {
        target: "http://localhost:12306",
      },
    },
  },
  build: {
    target: "esnext",
  },
  plugins: [react({})],
});
