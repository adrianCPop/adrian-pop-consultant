import { describe, expect, it } from "vitest";
import { isVoyagePath } from "@/lib/voyagePaths";

describe("isVoyagePath, where the consulting site's own bar and chat are left off", () => {
  it("is true for the three voyage pages", () => {
    expect(isVoyagePath("/voyage")).toBe(true);
    expect(isVoyagePath("/voyage/log")).toBe(true);
    expect(isVoyagePath("/voyage/admin")).toBe(true);
  });

  it("goes by the address as the router does: any letter case, with or without a closing slash", () => {
    expect(isVoyagePath("/Voyage")).toBe(true);
    expect(isVoyagePath("/voyage/")).toBe(true);
    expect(isVoyagePath("/VOYAGE/Log//")).toBe(true);
  });

  it("is false for the rest of the site", () => {
    expect(isVoyagePath("/")).toBe(false);
    expect(isVoyagePath("")).toBe(false);
    expect(isVoyagePath("/about")).toBe(false);
    expect(isVoyagePath("/voyages")).toBe(false);
    expect(isVoyagePath("/about/voyage")).toBe(false);
  });

  it("is false for an address under /voyage/ that is no page, which gets the site's own 'not found'", () => {
    expect(isVoyagePath("/voyage/nothing-here")).toBe(false);
    expect(isVoyagePath("/voyage/log/extra")).toBe(false);
  });
});
