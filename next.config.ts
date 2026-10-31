import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  // Standalone output keeps the pm2 runtime lean on the Oracle VM.
  output: "standalone",
  // Pin the workspace root to THIS app dir. A stray lockfile above (e.g.
  // /Users/MAC/package-lock.json) makes Next infer the wrong root, which
  // emits a malformed routes-manifest (dataRoutes:null) and crashes
  // `next start` with "routesManifest.dataRoutes is not iterable". (debug P1)
  outputFileTracingRoot: path.join(__dirname),
  reactStrictMode: true,
  // The Qloo + Anthropic keys are server-only; never expose via env here.
  experimental: {},
};

export default nextConfig;
