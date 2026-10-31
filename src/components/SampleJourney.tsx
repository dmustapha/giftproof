// File: src/components/SampleJourney.tsx
import Link from "next/link";
import type { GiftResponse, QlooEntityType } from "@/lib/types";
import { BandChip } from "./BandChip";
import { Receipt } from "./Receipt";
import { completeNarration } from "@/lib/narration-guard";

// A pre-seeded REAL Qloo journey. Read-only earned state (scripts/seed-demo.ts, PRD §7.5). Carries a
// data-sample-journey marker so the landing is cold-load verifiable. `limit` caps cards (landing rail
// shows 2; /app/[id] shows all). Each card carries the signature receipt — the one metaphor everywhere.
const dLabel = (d: QlooEntityType) => d.replace("urn:entity:", "").replace(/_/g, " ");

export function SampleJourney({
  journey,
  title,
  id,
  fixture,
  limit = 2,
}: {
  journey: GiftResponse;
  title: string;
  id?: string;
  fixture?: boolean;
  limit?: number;
}) {
  const cards = journey.picks.slice(0, limit);
  return (
    <section data-sample-journey={id ?? title} className="flex flex-col gap-3">
      <div className="flex items-baseline justify-between gap-3">
        {id ? (
          <Link
            href={`/app/${id}`}
            className="font-display text-[17px] font-medium tracking-tight text-ink underline-offset-4 hover:underline"
          >
            {title}
          </Link>
        ) : (
          <h2 className="font-display text-[17px] font-medium tracking-tight text-ink">{title}</h2>
        )}
        <span className="font-mono text-[9.5px] uppercase tracking-[0.14em] text-ink-3">
          {fixture ? "cached Qloo response (sample)" : "cached live Qloo response"}
        </span>
      </div>

      {journey.agent?.chosenDomains && journey.agent.chosenDomains.length > 0 && (
        <p className="font-mono text-[10px] text-ink-3">
          agent spanned{" "}
          <span className="text-accent-ink">
            {journey.agent.chosenDomains.map(dLabel).join(" · ")}
          </span>{" "}
          · {journey.agent.qlooCallCount} Qloo calls
        </p>
      )}

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {cards.map((card) => (
          <article
            key={card.pick.entityId}
            className="flex flex-col gap-2.5 rounded-[11px] border border-[var(--hair)] bg-paper-2 p-4"
          >
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0 flex-1">
                <h3 className="font-display text-[16px] font-medium leading-tight tracking-tight text-ink">
                  {card.pick.name}
                </h3>
                {card.gift && (
                  <span className="mt-1 inline-flex items-center rounded-[4px] border border-[var(--ink-10)] bg-paper px-1.5 py-0.5 font-mono text-[9px] uppercase tracking-[0.1em] text-ink-3">
                    gift · {card.gift.title}
                  </span>
                )}
              </div>
              <BandChip pick={card.pick} size="sm" />
            </div>
            {completeNarration(card.narration) && (
              <p className="text-[12.5px] leading-relaxed text-ink-2">{completeNarration(card.narration)}</p>
            )}
            <Receipt pick={card.pick} provenance={card.provenance} animate={false} />
          </article>
        ))}
      </div>
    </section>
  );
}
