import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    hookTimeout: 30000,
    testTimeout: 30000,
    setupFiles: ["./src/__tests__/setup.ts"],
    // Multiple test files share one Postgres test database and each
    // truncates it in beforeAll — running files in parallel would race.
    fileParallelism: false,
  },
});
