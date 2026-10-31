// File: src/app/app/[journeyId]/not-found.tsx
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="mx-auto flex max-w-xl flex-col items-start gap-4 px-6 py-24">
      <p className="font-mono text-[11px] uppercase tracking-[0.16em] text-ink-3">404</p>
      <h1 className="font-display text-[26px] font-medium tracking-tight text-ink">Journey not found</h1>
      <p className="text-[14px] text-ink-2">That sample journey does not exist. Start your own instead.</p>
      <Link
        href="/app"
        className="rounded-[6px] bg-accent px-5 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.1em] text-white transition-[filter,transform] hover:brightness-105 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-35)]"
      >
        Find a gift
      </Link>
    </main>
  );
}
