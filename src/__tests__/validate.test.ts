// File: src/__tests__/validate.test.ts
import { describe, it, expect } from "vitest";
import { assertInsightsParams, assertAffinityBearing, stripPII } from "@/lib/qloo/validate";
import { TOKENS } from "@/lib/types";

describe("assertInsightsParams", () => {
  it("throws INVALID_PARAM for an unknown param (silent-ignore defense, NN-5)", () => {
    expect(() =>
      assertInsightsParams({ "filter.type": "urn:entity:brand", "not.allowed": "x" }),
    ).toThrow(TOKENS.INVALID_PARAM);
  });

  it("throws when filter.type is missing", () => {
    expect(() => assertInsightsParams({ take: "12" })).toThrow(`${TOKENS.INVALID_PARAM}: filter.type required`);
  });

  it("throws when filter.type is not a known URN", () => {
    expect(() => assertInsightsParams({ "filter.type": "urn:entity:nope" })).toThrow(TOKENS.INVALID_PARAM);
  });

  it("passes for an all-allowed param set", () => {
    expect(() =>
      assertInsightsParams({
        "filter.type": "urn:entity:brand",
        "signal.interests.entities": "abc",
        "feature.explainability": "true",
        take: "12",
      }),
    ).not.toThrow();
  });

  // DEPTH-PASS C: demographic buckets are allow-listed (Qloo silently ignores unknown ones, NN-5).
  it("passes a KNOWN demographic age bucket + gender", () => {
    expect(() =>
      assertInsightsParams({
        "filter.type": "urn:entity:book",
        "signal.demographics.age": "55_and_older",
        "signal.demographics.gender": "female",
      }),
    ).not.toThrow();
  });

  it("throws INVALID_PARAM for an UNKNOWN age bucket (would be silently dropped otherwise)", () => {
    expect(() =>
      assertInsightsParams({ "filter.type": "urn:entity:book", "signal.demographics.age": "25_to_29" }),
    ).toThrow(TOKENS.INVALID_PARAM);
  });

  it("throws INVALID_PARAM for a gender that is not male|female", () => {
    expect(() =>
      assertInsightsParams({ "filter.type": "urn:entity:book", "signal.demographics.gender": "nonbinary" }),
    ).toThrow(TOKENS.INVALID_PARAM);
  });
});

describe("assertAffinityBearing", () => {
  it("throws NO_AFFINITY_RESULTS on an empty array", () => {
    expect(() => assertAffinityBearing([])).toThrow(TOKENS.NO_AFFINITY_RESULTS);
  });

  it("passes when at least one entity is present", () => {
    expect(() => assertAffinityBearing([{ entity_id: "e1" }])).not.toThrow();
  });
});

describe("stripPII", () => {
  it("drops an email (never forwarded to Qloo, NN-2)", () => {
    expect(stripPII("jane@example.com")).toBeNull();
  });

  it("passes a taste name through unchanged", () => {
    expect(stripPII("Succession")).toBe("Succession");
  });
});
