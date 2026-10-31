import { defineConfig } from "vitest/config";
import path from "node:path";

// LIVE tier — real Qloo/network. Run ONLY via `npm run test:live` with credentials.
// Deliberately quarantined out of the default gate (contract rule 24).
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["src/**/*.live.ts"],
    exclude: ["**/node_modules/**"],
    environment: "node",
  },
});
