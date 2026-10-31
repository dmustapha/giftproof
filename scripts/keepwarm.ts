// File: scripts/keepwarm.ts
// One-shot keep-warm ping. pm2 runs this every 5 minutes (cron_restart) so the VM stays hot (R4).
// S-5: when a Qloo key is present, hit the deep health check so a revoked/wrong-tenant/quota-
// exhausted key is detected (keyless /api/health alone cannot see an auth failure).
const base = process.env.HEALTH_URL ?? "http://localhost:3000/api/health";
const url = process.env.QLOO_API_KEY ? `${base}?deep=1` : base;

async function main(): Promise<void> {
  try {
    const r = await fetch(url);
    const ok = r.ok;
    console.log(`[keepwarm] ${new Date().toISOString()} ${url} -> ${r.status} ok=${ok}`);
    process.exit(ok ? 0 : 1);
  } catch (e) {
    console.error(
      `[keepwarm] ${new Date().toISOString()} ${url} -> ERROR ${(e as Error).message}`,
    );
    process.exit(1);
  }
}

void main();
