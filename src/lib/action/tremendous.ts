// File: src/lib/action/tremendous.ts
// WARNING: UNVERIFIED PATTERN — Option-B optional. Only used if TREMENDOUS_SANDBOX_KEY confirmed day-one.
// Issues a REAL sandbox e-gift; returns the REAL provider order id (never a mocked toast — INVARIANTS NN-4).
import { TOKENS } from "@/lib/types";
const KEY = process.env.TREMENDOUS_SANDBOX_KEY ?? "";
const BASE = "https://testflight.tremendous.com/api/v2"; // sandbox base — confirm at wire
export async function issueSandboxGift(sku: string, amountCents: number): Promise<{ mode: "sandbox"; orderId: string; confirmation: unknown }> {
  if (!KEY) throw new Error(`${TOKENS.ACTION_UNAVAILABLE}: Option-B not configured`);
  const r = await fetch(`${BASE}/orders`, {
    method: "POST",
    headers: { Authorization: `Bearer ${KEY}`, "Content-Type": "application/json" },
    body: JSON.stringify({ payment: { funding_source_id: process.env.TREMENDOUS_FUNDING_ID }, reward: { value: { denomination: amountCents / 100, currency_code: "USD" }, products: [sku] } }),
  });
  if (!r.ok) throw new Error(`${TOKENS.ACTION_UNAVAILABLE}: sandbox HTTP ${r.status}`);
  const j = (await r.json()) as { order?: { id?: string } };
  const orderId = j.order?.id;
  if (!orderId) throw new Error(`${TOKENS.ACTION_UNAVAILABLE}: no order id`);
  return { mode: "sandbox", orderId, confirmation: j };
}
