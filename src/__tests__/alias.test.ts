// File: src/__tests__/alias.test.ts
import { describe, it, expect } from "vitest";
import { aliasTableExtract } from "@/lib/qloo/alias";

describe("aliasTableExtract (deterministic PII floor, NN-2)", () => {
  it("extracts public tastes and drops the recipient lead", () => {
    // NOTE: extraction is a comma/and/& split, so the FIRST fragment is the whole recipient-lead
    // clause "my sister loves Succession" — which matches stripPII's RecipientLeadRe and is dropped
    // wholesale (Succession rides along inside it). The clean tastes "Aesop" and "A24" survive.
    // This is the real, VERIFIED NN-2 floor behavior — the recipient descriptor never reaches Qloo.
    const tastes = aliasTableExtract("my sister loves Succession, Aesop and A24");
    const names = tastes.map((t) => t.name);
    expect(names).toContain("Aesop");
    expect(names).toContain("A24");
    // No recipient descriptor survives (the "my sister loves ..." lead is dropped, not forwarded).
    expect(names.some((n) => /sister/i.test(n))).toBe(false);
    for (const t of tastes) expect(t.domainGuess).toBe("unknown");

    // A clean, taste-only sentence yields every public taste including Succession.
    const clean = aliasTableExtract("Succession, Aesop and A24").map((t) => t.name);
    expect(clean).toEqual(["Succession", "Aesop", "A24"]);
  });

  it("drops an email fragment entirely (zero PII to Qloo)", () => {
    expect(aliasTableExtract("jane@x.com")).toEqual([]);
  });
});
