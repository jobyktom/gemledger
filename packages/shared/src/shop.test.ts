import { describe, expect, it } from "vitest";
import { IndianMobile, ShopInput } from "./index";

describe("IndianMobile", () => {
  it.each(["9876543210", "+91 98765 43210", "09876543210", "91-9876543210"])("normalises %s", (raw) => {
    expect(IndianMobile.parse(raw)).toBe("+919876543210");
  });
  it.each(["12345", "5876543210", "+44 7700 900123"])("rejects %s", (raw) => {
    expect(IndianMobile.safeParse(raw).success).toBe(false);
  });
});

describe("ShopInput", () => {
  const base = { name: "Asha Jewellers", city: "Kochi", state: "Kerala" };
  it("accepts the minimum fields and drops blanks", () => {
    const r = ShopInput.parse({ ...base, legalName: "", gstin: "", phone: "" });
    expect(r).toEqual(base);
  });
  it("normalises GSTIN and phone", () => {
    const r = ShopInput.parse({ ...base, gstin: "32aaacr5055k1zk", phone: "98765 43210" });
    expect(r.gstin).toBe("32AAACR5055K1ZK");
    expect(r.phone).toBe("+919876543210");
  });
  it("rejects an unknown state and a bad GSTIN", () => {
    expect(ShopInput.safeParse({ ...base, state: "Atlantis" }).success).toBe(false);
    expect(ShopInput.safeParse({ ...base, gstin: "123" }).success).toBe(false);
  });
});
