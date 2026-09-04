import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    hookTimeout: 30000,
    testTimeout: 30000,
    setupFiles: ["./src/__tests__/setup.ts"],
  },
});
