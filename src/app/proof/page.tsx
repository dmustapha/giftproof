// File: src/app/proof/page.tsx
import Link from "next/link";
import type { GiftResponse, QlooEntityType } from "@/lib/types";
import { Bridge } from "@/components/Bridge";
import { BandChip } from "@/components/BandChip";
import journeys from "../../../data/seed-journeys.json";

// "/proof" — the skeptic's receipt ROLL (AUDIENCE-CONTRACT): the redacted request, the full drawn
// bridge diagram (every pick's real explainability), the raw Qloo response, resolved IDs, the honest
// limitation. Reads the first seeded journey's REAL response (PRD §7.6); the Qloo key is redacted.
interface SeedJourneyFile {
  journeys: Array<{ id: string; title: string; sentence: string; fixture?: boolean; response: GiftResponse }>;
}
const dLabel = (d: QlooEntityType) => d.replace("urn:entity:", "").replace(/_/g, " ");

export default function ProofPage() {
  const data = journeys as unknown as SeedJourneyFile;
  const j = data.journeys[0];
  const entityIds = j.response.picks.map((p) => p.pick.entityId).filter(Boolean);
  const agent = j.response.agent;
  const chosen = agent?.chosenDomains ?? [j.response.domain];
  const demoLines: string[] = [];
  if (agent?.recipient?.age) demoLines.push(`  signal.demographics.age=${agent.recipient.age}`);
  if (agent?.recipient?.gender) demoLines.push(`  signal.demographics.gender=${agent.recipient.gender}`);
  const redactedRequest = [
    `AGENT chose ${chosen.length} gift domains: ${chosen.map((d) => d.replace("urn:entity:", "")).join(", ")}`,
    agent?.reasoning ? `  reasoning: ${agent.reasoning}` : "",
    "",
    `${chosen.length}× parallel GET https://hackathon.api.qloo.com/v2/insights (one per domain, Semaphore(2)):`,
    "  header: X-Api-Key: [REDACTED]",
    `  filter.type=<each of: ${chosen.join(", ")}>`,
    `  signal.interests.entities=${j.response.seeds.map((s) => s.signal.value).join(",")}`,
    ...demoLines,
    "  feature.explainability=true",
    "  filter.popularity.min=0.3",
    "  bias.content_based=0.35",
    "  diversify.by=subtype",
    "  take=12",
    "",
    `Total Qloo calls this journey: ${agent?.qlooCallCount ?? "—"} (/search resolution + the ${chosen.length}-domain fan-out)`,
    agent?.refine ? `Refine loop: ${agent.refine.fired ? `FIRED — ${agent.refine.reason}` : "skipped (first ranking was sharp)"}` : "",
  ].filter(Boolean).join("\n");

  const SectionLabel = ({ children }: { children: React.ReactNode }) => (
    <h2 className="font-mono text-[11px] uppercase tracking-[0.18em] text-accent-ink">{children}</h2>
  );

  return (
    <main className="mx-auto flex max-w-3xl flex-col gap-10 px-6 py-14">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-ink">The proof</p>
        <h1 className="font-display text-[clamp(2rem,4.5vw,3rem)] font-medium tracking-tight text-ink">
          Nothing here is invented.
        </h1>
        <p className="max-w-2xl text-[15px] leading-relaxed text-ink-2">
          The exact request and the real Qloo response behind one journey. The API key is redacted;
          everything else is recomputable from the committed seed data.
        </p>
      </header>

      <section className="flex flex-col gap-2">
        <SectionLabel>Journey</SectionLabel>
        <p className="font-display text-[16px] text-ink">“{j.sentence}”</p>
      </section>

      {/* the full bridge diagram — the agent's cross-domain reasoning, drawn */}
      <section className="flex flex-col gap-3">
        <SectionLabel>The cross-domain bridges Qloo drew</SectionLabel>
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {j.response.picks.slice(0, 4).map((p) => (
            <div key={p.pick.entityId} className="flex flex-col gap-1.5 rounded-[9px] border border-[var(--hair)] bg-paper-2 p-3">
              <div className="flex items-center justify-between gap-2">
                <span className="font-mono text-[10px] uppercase tracking-[0.1em] text-ink-3">{dLabel(p.pick.type)}</span>
                <BandChip pick={p.pick} size="sm" />
              </div>
              <div className="rounded-[5px] border border-[var(--ink-06)] bg-paper px-1.5 py-1.5">
                <Bridge explain={p.pick.explain} target={p.pick.name} domain={p.pick.type} id={p.pick.entityId} animate={false} />
              </div>
            </div>
          ))}
        </div>
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>Request (redacted)</SectionLabel>
        <pre tabIndex={0} role="region" aria-label="Redacted Qloo request" className="overflow-auto rounded-[7px] bg-paper-sink p-4 font-mono text-[11px] leading-relaxed text-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-20)]">{redactedRequest}</pre>
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>Resolved entity IDs</SectionLabel>
        <ul className="flex flex-col gap-1">
          {entityIds.map((id) => (
            <li key={id} className="font-mono text-[11px] tabular-nums text-ink-2">· {id}</li>
          ))}
        </ul>
      </section>

      <section className="flex flex-col gap-2">
        <SectionLabel>Raw Qloo response</SectionLabel>
        <pre tabIndex={0} role="region" aria-label="Raw Qloo response" className="max-h-96 overflow-auto rounded-[7px] bg-paper-sink p-4 font-mono text-[11px] leading-relaxed text-ink-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--accent-20)]">
          {JSON.stringify(j.response.raw, null, 2)}
        </pre>
      </section>

      <section className="overflow-hidden rounded-[8px] border border-[var(--color-band-fault)] bg-paper-2">
        <div className="perf mx-3" />
        <div className="px-4 pb-3 pt-2.5">
          <span className="font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--color-band-fault)]">Limitation</span>
          <p className="mt-1.5 text-[13px] leading-relaxed text-ink-2">
            Qloo gives aggregate taste correlation across audiences, not certainty about one person.
            We show the raw response and never claim an individual match percentage.
          </p>
        </div>
      </section>

      <footer className="border-t border-[var(--hair)] pt-6">
        <Link
          href="/app"
          className="group inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-2 transition-colors hover:text-ink"
        >
          Try your own sentence <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      </footer>
    </main>
  );
}
