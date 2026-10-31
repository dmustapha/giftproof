// File: src/app/app/error.tsx
"use client";
import Link from "next/link";

export default function Error({ reset }: { error: Error; reset: () => void }) {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-start gap-4 px-6 py-24">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-[var(--color-band-fault)]">Fault</p>
      <h1 className="font-display text-[26px] font-medium tracking-tight text-ink">Something broke on this page</h1>
      <p className="text-[14px] text-ink-2">The gift flow hit an unexpected error. You can retry or head home.</p>
      <div className="flex gap-3 pt-1">
        <button
          type="button"
          onClick={reset}
          className="rounded-[6px] bg-accent px-4 py-2 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-white transition-[filter,transform] hover:brightness-105 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-35)]"
        >
          Try again
        </button>
        <Link href="/" className="rounded-[6px] border border-[var(--ink-12)] px-4 py-2 font-mono text-[11px] uppercase tracking-[0.1em] text-ink-2 transition-colors hover:border-accent hover:text-ink">
          Home
        </Link>
      </div>
    </main>
  );
}
