// File: src/app/app/page.tsx
"use client";
import { useState, useRef } from "react";
import type { GiftResponse, Seed } from "@/lib/types";
import { SentenceInput } from "@/components/SentenceInput";
import { SeedChips } from "@/components/SeedChips";
import { GiftCard } from "@/components/GiftCard";
import { PressRunStepper } from "@/components/PressRunStepper";

const DEGRADED_COPY: Record<NonNullable<GiftResponse["degraded"]>, string> = {
  NO_QLOO_RESULT: "Qloo returned no results for this taste set. Try another sentence.",
  NO_AFFINITY_RESULTS: "No Qloo-affinity results for this taste set. Try another taste.",
  QLOO_UNREACHABLE: "Qloo is unreachable right now. Please try again in a moment.",
  EXTRACTION_UNAVAILABLE: "The 0G taste reader is unavailable right now. Please try again in a moment.",
};

export default function AppPage() {
  const [data, setData] = useState<GiftResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  // swapGen bumps every time a recompute lands → re-keys the cards so each receipt RE-PRINTS (signature).
  const [swapGen, setSwapGen] = useState(0);
  // tearing drives the SIGNATURE choreography: the old slips clip-collapse away (slip-tear) BEFORE the
  // new data mounts and prints (slip-reprint) — a receipt tears off, a new one prints (SIGNATURE-SPEC §2).
  const [tearing, setTearing] = useState(false);
  const swapTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const tearTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const hasData = useRef(false);
  // Monotonic request id shared by submit + swap. Rapid swaps (or a submit landing after a swap) can
  // resolve OUT OF ORDER over a slow Qloo; without this guard an older response would overwrite a newer
  // one and the grid would show picks that no longer match the on-screen chips — the exact hero
  // interaction judges hammer. Only the latest-issued request is allowed to commit state. (debug P6 MF-1)
  const reqId = useRef(0);
  const TEAR_MS = 190;

  // Commit a landed result: if slips are already on screen, TEAR them off first, then print the new
  // ones; on the very first result there is nothing to tear, so it just prints.
  function commit(json: GiftResponse, myReq: number) {
    const printNew = () => {
      if (myReq !== reqId.current) { setTearing(false); return; }
      setData(json);
      setSwapGen((g) => g + 1);
      setTearing(false);
      hasData.current = true;
    };
    if (hasData.current) {
      setTearing(true);
      if (tearTimer.current) clearTimeout(tearTimer.current);
      tearTimer.current = setTimeout(printNew, TEAR_MS);
    } else {
      printNew();
    }
  }

  async function submit(sentence: string) {
    const myReq = ++reqId.current;
    setLoading(true);
    setError(null);
    try {
      const r = await fetch("/api/gift", { method: "POST", body: JSON.stringify({ sentence }) });
      if (!r.ok) throw new Error(`gift ${r.status}`);
      const json = (await r.json()) as GiftResponse;
      if (myReq !== reqId.current) return; // a newer request superseded this one — drop the stale result
      commit(json, myReq);
    } catch {
      if (myReq !== reqId.current) return;
      setError("Something went wrong finding gifts. Please try again.");
    } finally {
      if (myReq === reqId.current) setLoading(false);
    }
  }

  // Debounced swap (350ms), the live-recompute hero (SIGNATURE-SPEC D3).
  function swap(seeds: Seed[]) {
    if (swapTimer.current) clearTimeout(swapTimer.current);
    // Optimistic chip update so removal feels instant; the grid recomputes after the debounce.
    setData((prev) => (prev ? { ...prev, seeds } : prev));
    swapTimer.current = setTimeout(async () => {
      const myReq = ++reqId.current;
      setLoading(true);
      setError(null);
      try {
        const r = await fetch("/api/swap", { method: "POST", body: JSON.stringify({ seeds }) });
        if (!r.ok) throw new Error(`swap ${r.status}`);
        const json = (await r.json()) as GiftResponse;
        if (myReq !== reqId.current) return; // a newer swap/submit superseded this — drop the stale result
        commit(json, myReq);
      } catch {
        if (myReq !== reqId.current) return;
        setError("Could not recompute for that taste set. Please try again.");
      } finally {
        if (myReq === reqId.current) setLoading(false);
      }
    }, 350);
  }

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-12">
      <header className="flex flex-col gap-2">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-ink">The tool</p>
        <h1 className="font-display text-[clamp(1.8rem,3.5vw,2.4rem)] font-medium tracking-tight text-ink">
          Find a gift
        </h1>
      </header>

      <SentenceInput onSubmit={submit} loading={loading} />

      {error && (
        <p role="alert" className="mx-auto w-full max-w-2xl rounded-[8px] border border-[var(--color-band-fault)] bg-paper-2 px-4 py-3 font-mono text-[11px] text-[var(--color-band-fault)]">
          {error}
        </p>
      )}

      {/* polite announcer so a screen-reader user hears the swap recompute (critic a11y nit) */}
      <p className="sr-only" role="status" aria-live="polite">
        {loading ? "Recomputing gifts…" : data && !data.degraded ? `Updated — ${data.picks.length} gifts ranked` : ""}
      </p>

      {data && <SeedChips seeds={data.seeds} onChange={swap} />}

      {/* the agentic press run */}
      {data && !data.degraded && data.picks.length > 0 && <PressRunStepper agent={data.agent} />}

      {/* loading skeleton, never a blank screen (NN-5) */}
      {loading && !data && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-72 animate-pulse rounded-[11px] border border-[var(--hair)] bg-[var(--ink-04)]" />
          ))}
        </div>
      )}

      {/* degraded tokens render a LABELED fault receipt, never cards (NN-5) */}
      {data?.degraded && (
        <div
          data-degraded={data.degraded}
          role="status"
          className="mx-auto w-full max-w-2xl overflow-hidden rounded-[8px] border border-[var(--color-band-fault)] bg-paper-2"
        >
          <div className="perf mx-3" />
          <div className="flex items-center gap-2 px-4 pb-3 pt-2.5">
            <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-band-fault)]">
              fault · {data.degraded}
            </span>
          </div>
          <p className="px-4 pb-3 text-[13px] text-ink-2">{DEGRADED_COPY[data.degraded]}</p>
        </div>
      )}

      {/* empty (resolved but no picks) defended */}
      {data && !data.degraded && data.picks.length === 0 && !loading && (
        <p role="status" className="rounded-[8px] border border-dashed border-[var(--ink-12)] bg-paper-2 px-4 py-3 font-mono text-[11px] text-ink-3">
          No gift matched this taste set yet. Try swapping a seed above.
        </p>
      )}

      {data && !data.degraded && data.picks.length > 0 && (
        <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
          {data.picks.map((c, i) => (
            <GiftCard key={`${c.pick.entityId}-${swapGen}`} card={c} loading={loading} tearing={tearing} index={i} />
          ))}
        </div>
      )}
    </main>
  );
}
