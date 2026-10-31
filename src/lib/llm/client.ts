// File: src/lib/llm/client.ts
// Thin OpenAI-compatible chat helper pointed at the 0G Compute Router (the RATIFIED primary
// agent brain — supersedes ARCHITECTURE §10's OpenRouter wiring; see DEV-008). Env-gated: with
// no key the LLM-boundary callers fall back to deterministic paths, so the app still works fully.
// GOTCHA: gemini/deepseek/0gm/gpt models work on /v1/chat/completions; do NOT use claude-* models.

const BASE = process.env.ZEROG_COMPUTE_BASE_URL ?? "https://router-api.0g.ai/v1";
const MODEL = process.env.LLM_MODEL ?? "gemini-2.5-flash";

export function llmConfigured(): boolean {
  return Boolean(process.env.ZEROG_COMPUTE_API_KEY);
}

async function chatOnce(system: string, user: string, maxTokens: number): Promise<string> {
  const res = await fetch(`${BASE}/chat/completions`, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${process.env.ZEROG_COMPUTE_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: maxTokens,
      // No response_format: 0G/gemini may not support it — JSON is instructed in the prompt instead.
      messages: [
        { role: "system", content: system },
        { role: "user", content: user },
      ],
    }),
  });
  if (!res.ok) throw new Error(`0G router ${res.status}`);
  const data = await res.json();
  // The 0G ROUTER itself can return 200 with a transient gateway error body (observed live
  // 2026-10-30: {"_0g":{...},"error":{"type":"gateway_error"}}) instead of a completion. Treat that
  // as a transient failure (retryable), NOT a valid empty completion — surfacing it as success would
  // feed the agent garbage. This is still the 0G path (no template/alias substitution, NN no-fallback).
  if (data?.error) throw new Error(`0G gateway: ${data.error.type ?? "error"}`);
  return data.choices?.[0]?.message?.content ?? "";
}

// One bounded retry on a TRANSIENT 0G failure (router 5xx or a gateway-error body). This is NOT a
// fallback to another provider/template — it is the SAME 0G request re-sent once, the standard cure
// for the 0G router's intermittent gateway blips. On a second failure we throw and the caller surfaces
// an HONEST degraded/unavailable state (no fabricated substitute).
async function chat(system: string, user: string, maxTokens: number): Promise<string> {
  try {
    return await chatOnce(system, user, maxTokens);
  } catch (e) {
    const msg = String((e as Error).message);
    const transient = /0G (router 5|gateway)/.test(msg);
    if (!transient) throw e;
    return await chatOnce(system, user, maxTokens); // single retry; a second failure propagates honestly
  }
}

// Structured extraction (JSON asked for in the prompt). 300 tokens is ample for a short taste
// array and keeps the 0G round-trip fast (E-2 latency gate — extraction is the cold-path's
// single largest cost).
export async function chatJSON(system: string, user: string): Promise<string> {
  return chat(system, user, 300);
}

// DEPTH-PASS A+C — the richer agent PLAN (tastes + 2–4 domain selection + reasoning + recipient) is a
// bigger completion. gemini-2.5-flash is a REASONING model: at 300 tokens the reasoning budget can
// swallow the whole response and return EMPTY content (observed live 2026-10-30 — the plan came back
// unparseable). 900 tokens leaves ample room for reasoning + the JSON object. Still one round-trip.
export async function chatJSONLong(system: string, user: string): Promise<string> {
  return chat(system, user, 900);
}

// Plain one-sentence reply. gemini-2.5-flash is a REASONING model: at a low token budget the
// reasoning pass consumes the whole allowance and the completion returns TRUNCATED (finish_reason
// "length" at 120/400 tokens — "This digital gift is Q…" / empty — observed live 2026-10-30, wire
// Phase-4). 900 tokens is the budget at which the narration consistently reaches finish_reason
// "stop" with a complete sentence. Still ONE 0G round-trip, no template/alias substitution (NN
// no-fallback). (wire P4 narration-truncation fix)
export async function chatText(system: string, user: string): Promise<string> {
  return chat(system, user, 900);
}
