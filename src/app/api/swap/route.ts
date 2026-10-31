// File: src/app/api/swap/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runSwap } from "@/lib/orchestrate";
import { TOKENS, GIFT_DOMAINS, type GiftResponse } from "@/lib/types";
export const runtime = "nodejs";
// NOTE: a Seed's signal.value is SERVER-RESOLVED (a real Qloo entity ID or tag URN from
// /api/gift or /api/resolve), never a client-arbitrary string. The schema accepts the shape, but
// the only legitimate producers are the resolver paths — the UI must not fabricate values here.
const Seed = z.object({ id: z.string(), label: z.string(), signal: z.object({ kind: z.enum(["entity", "tag"]), value: z.string(), label: z.string(), source: z.enum(["search", "tags"]) }) });
const Body = z.object({ seeds: z.array(Seed).min(1).max(8) });
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  try { return NextResponse.json(await runSwap(parsed.data.seeds)); }
  catch {
    // Same honest-degrade contract as /api/gift: an unexpected throw on the live-recompute HERO path
    // must NOT surface a red 502 on stage. Degrade to the labelled QLOO_UNREACHABLE empty shape the UI
    // already renders — never a 502, never a fake card (NN-1/NN-3). (debug P6 M1)
    const safe: GiftResponse = {
      picks: [], coverage: { resolved: 0, total: 0, misses: [] }, seeds: parsed.data.seeds as unknown as GiftResponse["seeds"],
      domain: GIFT_DOMAINS[0], degraded: TOKENS.QLOO_UNREACHABLE, raw: null,
    };
    return NextResponse.json(safe, { status: 200 });
  }
}
