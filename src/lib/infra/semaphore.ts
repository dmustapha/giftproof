// File: src/lib/infra/semaphore.ts
// 2-in-flight limiter for ALL Qloo calls (quota footgun: parallel bursts 429 — research-brief §Quota).
export class Semaphore {
  private active = 0;
  private queue: Array<() => void> = [];
  constructor(private readonly max: number) {}
  async run<T>(fn: () => Promise<T>): Promise<T> {
    if (this.active >= this.max) await new Promise<void>((res) => this.queue.push(res));
    this.active++;
    try { return await fn(); }
    finally { this.active--; const next = this.queue.shift(); if (next) next(); }
  }
}
export const qlooSemaphore = new Semaphore(2); // 2-in-flight (INVARIANTS NN-5; research-brief organizer-feedback drip-ai #1)
// Note: no LLM semaphore is needed. Narration is templated (no network), and entity extraction is a
// SINGLE OpenRouter call per request (one sentence → one extraction), never a per-pick fan-out.
