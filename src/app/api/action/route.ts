// File: src/app/api/action/route.ts
import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { handoff } from "@/lib/action/handoff";
import { issueSandboxGift } from "@/lib/action/tremendous";
export const runtime = "nodejs";
const Body = z.object({ sku: z.string(), mode: z.enum(["handoff", "sandbox"]), amountCents: z.number().optional() });
export async function POST(req: NextRequest) {
  const p = Body.safeParse(await req.json().catch(() => null));
  if (!p.success) return NextResponse.json({ error: "INVALID_INPUT" }, { status: 400 });
  try {
    if (p.data.mode === "sandbox") return NextResponse.json(await issueSandboxGift(p.data.sku, p.data.amountCents ?? 2500));
    return NextResponse.json(await handoff(p.data.sku));
  } catch (e) { return NextResponse.json({ error: String((e as Error).message) }, { status: 502 }); }
}
