// File: src/app/app/[journeyId]/page.tsx
import { notFound } from "next/navigation";
import Link from "next/link";
import type { GiftResponse } from "@/lib/types";
import { SampleJourney } from "@/components/SampleJourney";
import journeys from "../../../../data/seed-journeys.json";

// "/app/[journeyId]" — one specific pre-seeded journey at FULL density (deep-linkable demo state).
interface SeedJourneyFile {
  journeys: Array<{ id: string; title: string; sentence: string; fixture?: boolean; response: GiftResponse }>;
}

export function generateStaticParams() {
  const data = journeys as unknown as SeedJourneyFile;
  return data.journeys.map((j) => ({ journeyId: j.id }));
}

export default async function JourneyPage({ params }: { params: Promise<{ journeyId: string }> }) {
  const { journeyId } = await params;
  const data = journeys as unknown as SeedJourneyFile;
  const j = data.journeys.find((x) => x.id === journeyId);
  if (!j) notFound();

  return (
    <main className="mx-auto flex max-w-5xl flex-col gap-8 px-6 py-14">
      <header className="flex flex-col gap-3">
        <p className="font-mono text-[11px] uppercase tracking-[0.2em] text-accent-ink">A journey</p>
        <h1 className="font-display text-[clamp(1.9rem,4vw,2.6rem)] font-medium tracking-tight text-ink">
          {j.title}
        </h1>
        <p className="max-w-2xl font-display text-[17px] leading-snug text-ink-2">“{j.sentence}”</p>
        <Link
          href="/app"
          className="group inline-flex w-fit items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.12em] text-ink-2 transition-colors hover:text-ink"
        >
          Start your own <span className="transition-transform group-hover:translate-x-0.5">→</span>
        </Link>
      </header>
      <div className="perf" />
      <SampleJourney title="Ranked gifts" journey={j.response} fixture={j.fixture} limit={99} />
    </main>
  );
}
