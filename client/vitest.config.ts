import { fileURLToPath } from "node:url";
import { defineConfig, loadEnv } from "vite";

export default defineConfig(({ mode }) => ({
  resolve: {
    alias: {
      "@": fileURLToPath(new URL("./src", import.meta.url)),
    },
  },
  test: {
    environment: "node",
    env: loadEnv(mode, process.cwd(), ""),
    hookTimeout: 30_000,
    testTimeout: 30_000,
    restoreMocks: true,
  },
}));
