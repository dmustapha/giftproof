// File: src/app/page.tsx
import Link from "next/link";
import type { GiftResponse, QlooEntityType } from "@/lib/types";
import { SampleJourney } from "@/components/SampleJourney";
import { Receipt } from "@/components/Receipt";
import journeys from "../../data/seed-journeys.json";

// Landing "/" — restrained editorial (SELECTION §5 / AUDIENCE-CONTRACT): a value line, ONE live hero
// receipt printing a real pick, one CTA, then a calm rail of real sample journeys. Server component:
// reads only the committed earned JSON, no client state (PRD §7.5).
interface SeedJourneyFile {
  journeys: Array<{ id: string; title: string; sentence: string; fixture?: boolean; response: GiftResponse }>;
}
const dLabel = (d: QlooEntityType) => d.replace("urn:entity:", "").replace(/_/g, " ");

export default function LandingPage() {
  const data = journeys as unknown as SeedJourneyFile;
  const hero = data.journeys[0];
  const heroCard = hero.response.picks[0];
  const chosen = hero.response.agent?.chosenDomains ?? [hero.response.domain];
  const topContrib = heroCard.provenance.qlooSays.topContributors[0] ?? "their taste";
  const affinity = heroCard.pick.affinity; // real Qloo number, or null

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-16 px-6 py-14">
      {/* HERO — two-tone editorial headline + the MONUMENT (a statistic as the hero object, chit law) */}
      <section className="grid grid-cols-1 items-center gap-12 lg:grid-cols-[0.92fr_1.08fr]">
        <header className="flex flex-col gap-5">
          <p className="reveal-up font-mono text-[11px] uppercase tracking-[0.22em] text-accent-ink">
            A gift, with its receipt
          </p>
          <h1 className="reveal-up font-display text-[clamp(2.3rem,5vw,3.6rem)] font-medium leading-[1.04] tracking-tight text-ink" style={{ ["--d" as string]: "0.05s" }}>
            Gift someone whose taste
            <br />
            <span className="text-ink-3">you don’t share.</span>
          </h1>
          <p className="reveal-up max-w-xl text-[16px] leading-relaxed text-ink-2" style={{ ["--d" as string]: "0.12s" }}>
            Type one sentence about them. A 0G agent reads it, consults Qloo’s taste graph across
            books, places, brands and screens, and prints a gift you’d never have guessed —
            each one stamped with the real correlation that earned it.
          </p>
          <div className="reveal-up flex flex-wrap items-center gap-4 pt-1" style={{ ["--d" as string]: "0.19s" }}>
            <Link
              href="/app"
              className="rounded-[6px] bg-accent px-5 py-2.5 font-mono text-[11px] font-semibold uppercase tracking-[0.12em] text-white transition-[filter,transform] hover:brightness-105 active:translate-y-px focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-35)]"
            >
              Try your own sentence
            </Link>
            <Link
              href="/proof"
              className="group inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-2 transition-colors hover:text-ink"
            >
              See the proof <span className="transition-transform group-hover:translate-x-0.5">→</span>
            </Link>
          </div>
        </header>

        {/* THE MONUMENT — the correlation made huge, crowning the live hero receipt (glow pool behind) */}
        <div className="reveal-up relative flex flex-col gap-3" style={{ ["--d" as string]: "0.18s" }}>
          {/* ghosted slips behind — the receipt sits on a roll, not alone (world, not one card) */}
          <div aria-hidden className="pointer-events-none absolute -right-2.5 -top-2.5 h-full w-full rounded-[14px] border border-[var(--ink-08)] bg-paper-2/70 [transform:rotate(1.4deg)]" />
          <div aria-hidden className="pointer-events-none absolute -right-1 -top-1 h-full w-full rounded-[14px] border border-[var(--ink-06)] bg-paper-2/80 [transform:rotate(0.6deg)]" />
          <div className="glow-raise relative overflow-hidden rounded-[14px] border border-[var(--hair)] bg-paper-2">
            {/* the statistic as hero object */}
            <div className="flex items-stretch gap-4 px-6 pb-4 pt-6">
              <div className="flex flex-col justify-center">
                <p className="font-mono text-[10px] uppercase leading-relaxed tracking-[0.18em] text-accent-ink">
                  Qloo correlation
                </p>
                <p className="font-mono text-[10px] uppercase tracking-[0.14em] text-ink-3">
                  #{heroCard.pick.rankPosition} of {dLabel(heroCard.pick.type)}s
                </p>
              </div>
              <div className="ml-auto flex items-baseline">
                {affinity !== null ? (
                  <span className="font-display text-[clamp(3.4rem,9vw,5.5rem)] font-semibold leading-[0.85] tracking-tight text-ink tabular-nums">
                    0<span className="text-ink-3">.</span>{affinity.toFixed(2).slice(2)}
                  </span>
                ) : (
                  <span className="font-display text-[clamp(2.2rem,6vw,3.4rem)] font-medium uppercase leading-none tracking-tight text-ink">
                    {heroCard.pick.rankBand}
                  </span>
                )}
              </div>
            </div>
            <p className="px-6 pb-4 font-display text-[18px] leading-snug text-ink-2">
              <span className="text-ink">{heroCard.pick.name}</span>, because fans of{" "}
              <span className="text-accent-ink">{topContrib}</span> over-index on it.
            </p>
            <Receipt pick={heroCard.pick} provenance={heroCard.provenance} animate bare />
          </div>
          <p className="font-mono text-[9.5px] uppercase tracking-[0.12em] text-ink-3">
            from “{hero.sentence}” · agent spanned{" "}
            <span className="text-accent-ink">{chosen.map(dLabel).join(" · ")}</span> ·{" "}
            {hero.response.agent?.qlooCallCount ?? "—"} Qloo calls
          </p>
        </div>
      </section>

      <div className="perf" />

      {/* sample rail — real journeys, calm */}
      <section className="flex flex-col gap-8">
        <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-ink-3">
          Real Qloo journeys · click one to open it
        </h2>
        <div className="flex flex-col gap-12">
          {data.journeys.map((j, i) => (
            <div key={j.id} className="reveal-up" style={{ ["--d" as string]: `${0.08 + i * 0.08}s` }}>
              <SampleJourney id={j.id} title={j.title} fixture={j.fixture} journey={j.response} />
            </div>
          ))}
        </div>
      </section>

      <footer className="flex flex-wrap items-center gap-4 border-t border-[var(--hair)] pt-6 font-mono text-[10px] uppercase tracking-[0.12em] text-ink-3">
        <Link href="/proof" className="hover:text-ink">See the proof</Link>
        <span className="normal-case tracking-normal">Aggregate taste correlation, not individual certainty.</span>
      </footer>
    </main>
  );
}
