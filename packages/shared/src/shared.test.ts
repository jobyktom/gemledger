import { describe, expect, it } from "vitest";
import { Huid, JewelleryItemInput, newPublicPassportId, PublicPassportId } from "./index";

describe("Huid", () => {
  it("accepts and upper-cases a 6-character HUID", () => {
    expect(Huid.parse(" ab12cd ")).toBe("AB12CD");
  });
  it("rejects wrong lengths and symbols", () => {
    expect(Huid.safeParse("AB12C").success).toBe(false);
    expect(Huid.safeParse("AB-2CD").success).toBe(false);
  });
});

describe("JewelleryItemInput", () => {
  const base = { title: "Temple necklace", metal: "gold", karat: 22, grossWeightGrams: 32.5 } as const;
  it("accepts a valid gold item", () => {
    expect(JewelleryItemInput.safeParse({ ...base, huids: ["ab12cd"] }).success).toBe(true);
  });
  it("requires a karat for gold", () => {
    const { karat: _k, ...noKarat } = base;
    expect(JewelleryItemInput.safeParse(noKarat).success).toBe(false);
  });
  it("rejects net weight above gross weight", () => {
    expect(JewelleryItemInput.safeParse({ ...base, netWeightGrams: 40 }).success).toBe(false);
  });
});

describe("newPublicPassportId", () => {
  it("produces valid, distinct IDs", () => {
    const ids = new Set(Array.from({ length: 1000 }, () => newPublicPassportId()));
    expect(ids.size).toBe(1000);
    for (const id of ids) expect(PublicPassportId.safeParse(id).success).toBe(true);
  });
});
