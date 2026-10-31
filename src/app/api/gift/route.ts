// File: src/app/api/gift/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { runGift } from "@/lib/orchestrate";
import { TOKENS, GIFT_DOMAINS, type GiftResponse } from "@/lib/types";
export const runtime = "nodejs";
const Body = z.object({ sentence: z.string().min(2).max(500) });
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  try { return NextResponse.json(await runGift(parsed.data.sentence)); }
  catch {
    // The orchestrator degrades honestly for the known failure classes (0G down → EXTRACTION_UNAVAILABLE,
    // Qloo down → QLOO_UNREACHABLE). Any OTHER throw after extraction (e.g. a malformed Qloo payload that
    // breaks merge/provenance parsing) must NOT surface as a red HTTP 502 on stage — that loses a live
    // demo. Degrade to the same honest empty QLOO_UNREACHABLE shape the UI already renders as a labelled
    // fault slip (never a fake card, NN-1/NN-3). (debug P6 M1)
    const safe: GiftResponse = {
      picks: [], coverage: { resolved: 0, total: 0, misses: [] }, seeds: [],
      domain: GIFT_DOMAINS[0], degraded: TOKENS.QLOO_UNREACHABLE, raw: null,
    };
    return NextResponse.json(safe, { status: 200 });
  }
}
