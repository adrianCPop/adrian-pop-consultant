import { describe, expect, it } from "vitest";
import { distanceNm, pathLengthNm, rhumbDistanceNm, rhumbPathLengthNm, type LatLon } from "@/lib/geo";

describe("rhumbDistanceNm, the length of a leg as a Mercator map draws it", () => {
  it("is 60 nm for a degree of latitude along a meridian", () => {
    expect(rhumbDistanceNm([10, -30], [11, -30])).toBeCloseTo(60.04, 1);
  });

  it("is 60 nm for a degree of longitude on the equator, and half that at 60 north", () => {
    expect(rhumbDistanceNm([0, 0], [0, 1])).toBeCloseTo(60.04, 1);
    expect(rhumbDistanceNm([60, 0], [60, 1])).toBeCloseTo(30.02, 1);
  });

  it("is longer than the great circle on a long east-west leg, as it should be", () => {
    const from: LatLon = [28.47, -16.24];
    const to: LatLon = [14.08, -60.95];
    const rhumb = rhumbDistanceNm(from, to);
    const great = distanceNm(from, to);
    expect(rhumb).toBeGreaterThan(great);
    expect(rhumb - great).toBeLessThan(25);
  });

  it("matches the great circle on a short leg", () => {
    const from: LatLon = [20, -30];
    const to: LatLon = [20.3, -30.4];
    expect(rhumbDistanceNm(from, to)).toBeCloseTo(distanceNm(from, to), 1);
  });

  it("goes the short way across the date line", () => {
    expect(rhumbDistanceNm([0, 179.5], [0, -179.5])).toBeCloseTo(60.04, 1);
  });

  it("is zero between a point and itself", () => {
    expect(rhumbDistanceNm([14.08, -60.95], [14.08, -60.95])).toBe(0);
  });
});

describe("rhumbPathLengthNm", () => {
  it("adds the legs up", () => {
    const route: LatLon[] = [
      [0, 0],
      [0, 1],
      [1, 1],
    ];
    expect(rhumbPathLengthNm(route)).toBeCloseTo(120.08, 1);
  });

  it("is zero for a route that goes nowhere, and for fewer than two points", () => {
    expect(rhumbPathLengthNm([[10, 10], [10, 10]])).toBe(0);
    expect(rhumbPathLengthNm([[10, 10]])).toBe(0);
    expect(rhumbPathLengthNm([])).toBe(0);
  });

  it("stays close to the great-circle sum on a route of short legs", () => {
    const route: LatLon[] = [
      [28.47, -16.24],
      [28.68, -17.76],
      [27.78, -17.9],
      [16.89, -24.99],
    ];
    expect(Math.abs(rhumbPathLengthNm(route) - pathLengthNm(route))).toBeLessThan(2);
  });
});
