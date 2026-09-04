import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";

export default defineConfig({
  resolve: {
    // Safety net for any future `@/…` runtime import pulled in by a test.
    alias: { "@": fileURLToPath(new URL(".", import.meta.url)) },
  },
  test: {
    include: ["evals/**/*.test.ts"],
    environment: "node",
  },
});
