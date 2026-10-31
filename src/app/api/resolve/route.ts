// File: src/app/api/resolve/route.ts
// Lightweight resolver for a MANUALLY added taste chip. A client must NOT fabricate a tag value
// from label.toLowerCase() — it has no idea whether Qloo knows the taste. This endpoint runs the
// SAME resolveSignals path /api/gift uses, so an added chip carries a REAL entity/tag Seed (or
// resolves to nothing, in which case the client shows "couldn't resolve that taste" and adds no chip).
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { resolveSignals } from "@/lib/qloo/resolve";
import type { Seed } from "@/lib/types";
export const runtime = "nodejs";
const Body = z.object({ name: z.string().min(2).max(120) });
export async function POST(req: NextRequest) {
  const parsed = Body.safeParse(await req.json().catch(() => null));
  if (!parsed.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  try {
    const { signals } = await resolveSignals([{ name: parsed.data.name, raw: parsed.data.name, domainGuess: "unknown" }]);
    const sig = signals[0];
    if (!sig) return NextResponse.json({ seed: null }); // resolved to nothing — client shows "couldn't resolve"
    const seed: Seed = { id: `u${Date.now()}`, label: sig.label, signal: sig };
    return NextResponse.json({ seed });
  } catch (e) {
    return NextResponse.json({ error: String((e as Error).message) }, { status: 502 });
  }
}
