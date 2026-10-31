import { defineConfig } from "vitest/config";
import path from "node:path";

// Three-tier test quarantine (hackathon-build contract rule 24):
//  *.test.ts        = offline unit (deterministic, zero-credential)   -> default gate
//  *.integration.ts = real-dependency (local services, fixtures)      -> default gate
//  *.live.ts        = live-network (real Qloo/API, credentials)       -> SEPARATE command only
// The default `npm test` MUST NOT run the live tier.
export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname, "src") } },
  test: {
    include: ["src/**/*.test.ts", "src/**/*.integration.ts"],
    exclude: ["**/node_modules/**", "**/*.live.ts"],
    environment: "node",
  },
});
