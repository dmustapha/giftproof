// File: src/__tests__/cache.test.ts
// PLAN P1.2: cacheKey must be stable across key order AND string case, and across array order,
// so a swap/retry with the same NORMALIZED signal set hits cache instead of burning Qloo quota.
import { describe, it, expect } from "vitest";
import { cacheKey } from "@/lib/infra/cache";

describe("cacheKey", () => {
  it("is case-insensitive for string values (lowercase normalization)", () => {
    expect(cacheKey({ path: "/v2/insights", params: { "signal.interests.entities": "A,B" } })).toBe(
      cacheKey({ path: "/v2/insights", params: { "signal.interests.entities": "a,b" } }),
    );
  });

  it("is order-insensitive for array values (sorted normalization)", () => {
    expect(cacheKey({ x: ["b", "a"] })).toBe(cacheKey({ x: ["a", "b"] }));
  });
});
