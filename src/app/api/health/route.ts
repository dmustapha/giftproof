// File: src/app/api/health/route.ts
// GET /api/health — liveness for the deploy health check + keep-warm cron. Never throws.
// qlooReachable reports whether the backend Qloo credential + base URL are configured (a cheap,
// quota-free readiness signal). ?deep=1 performs ONE real lightweight Qloo call to confirm the
// tenant answers (used sparingly — e.g. at deploy smoke, not on every keep-warm ping, to protect
// the 10k/mo quota).
export const runtime = "nodejs";

function qlooConfigured(): boolean {
  return Boolean(process.env.QLOO_API_KEY);
}

async function qlooDeepReachable(): Promise<boolean> {
  if (!qlooConfigured()) return false;
  const base = process.env.QLOO_BASE_URL ?? "https://hackathon.api.qloo.com";
  try {
    const res = await fetch(`${base}/search?query=A24`, {
      headers: { "X-Api-Key": process.env.QLOO_API_KEY as string },
      signal: AbortSignal.timeout(4000),
    });
    return res.ok;
  } catch {
    return false;
  }
}

export async function GET(req: Request): Promise<Response> {
  const deep = new URL(req.url).searchParams.get("deep") === "1";
  const qlooReachable = deep ? await qlooDeepReachable() : qlooConfigured();
  return Response.json({
    ok: true,
    sha: process.env.GIT_SHA ?? "dev",
    llmConfigured: Boolean(process.env.ZEROG_COMPUTE_API_KEY),
    qlooReachable,
  });
}
