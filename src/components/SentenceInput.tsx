// File: src/components/SentenceInput.tsx
"use client";
import { useState } from "react";

const EXAMPLES = [
  "My sister is obsessed with Succession, Aesop skincare, and A24 films.",
  "My dad loves jazz records, woodworking, and single malt scotch.",
  "My coworker is into bouldering and specialty coffee.",
];

export function SentenceInput({ onSubmit, loading }: { onSubmit: (sentence: string) => void; loading?: boolean }) {
  const [value, setValue] = useState("");
  const trimmed = value.trim();
  const canSubmit = trimmed.length >= 2 && trimmed.length <= 500 && !loading;

  function submit() {
    if (!canSubmit) return;
    onSubmit(trimmed);
  }

  return (
    <section className="mx-auto flex w-full max-w-2xl flex-col gap-3">
      <label htmlFor="taste-sentence" className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-ink">
        Describe their public taste in one sentence
      </label>
      <textarea
        id="taste-sentence"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        onKeyDown={(e) => {
          if ((e.metaKey || e.ctrlKey) && e.key === "Enter") submit();
        }}
        rows={3}
        maxLength={500}
        placeholder="My sister loves Succession, Aesop, and A24."
        className="w-full resize-none rounded-[9px] border border-[var(--ink-12)] bg-paper-2 px-4 py-3 font-display text-[18px] leading-snug text-ink outline-none transition-colors placeholder:text-ink-3 focus-visible:border-accent focus-visible:ring-2 focus-visible:ring-[var(--accent-20)]"
      />
      <div className="flex flex-wrap items-center gap-2">
        {EXAMPLES.map((ex) => (
          <button
            key={ex}
            type="button"
            onClick={() => setValue(ex)}
            className="rounded-[6px] border border-[var(--ink-10)] bg-paper px-2.5 py-1 font-mono text-[10px] uppercase tracking-[0.08em] text-ink-2 transition-colors hover:border-accent hover:text-ink"
          >
            {ex.split(",")[0].replace(/^My /, "")}
          </button>
        ))}
      </div>
      <button
        type="button"
        onClick={submit}
        disabled={!canSubmit}
        className="self-start rounded-[6px] bg-accent px-5 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-[filter,transform] hover:brightness-105 active:translate-y-px disabled:cursor-not-allowed disabled:opacity-40 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-35)]"
      >
        {loading ? "Finding gifts…" : "Find gifts"}
      </button>
    </section>
  );
}
