import { describe, expect, it } from "vitest";
import {
  arrowStride,
  heightColor,
  nearestStep,
  paintSea,
  sampleSea,
  seaArrows,
  seaBounds,
  type SeaForecast,
} from "@/lib/seaField";

/** A 3 x 3 grid from 10 N 30 W to 14 N 26 W, two degrees apart, with two time steps. */
const sea = (height: (number | null)[], direction?: (number | null)[]): SeaForecast => ({
  fetched: "2026-11-16T18:10:00Z",
  south: 10,
  west: -30,
  step: 2,
  rows: 3,
  cols: 3,
  interval_h: 6,
  times: ["2026-11-16T18:00:00Z", "2026-11-17T00:00:00Z"],
  height: [height, height.map((value) => (value === null ? null : value + 10))],
  direction: [direction ?? height.map((value) => (value === null ? null : 90)), height.map(() => 270)],
  period: [height.map((value) => (value === null ? null : 8)), height.map(() => 9)],
});

// Row by row from the south-west: the south row first.
const flat = sea([10, 10, 10, 20, 20, 20, 30, 30, 30]);

describe("nearestStep", () => {
  const times = ["2026-11-16T18:00:00Z", "2026-11-17T00:00:00Z", "2026-11-17T06:00:00Z"];

  it("picks the step closest to the moment asked about", () => {
    expect(nearestStep(times, Date.parse("2026-11-16T19:00:00Z"))).toBe(0);
    expect(nearestStep(times, Date.parse("2026-11-16T22:00:00Z"))).toBe(1);
    expect(nearestStep(times, Date.parse("2026-11-17T05:00:00Z"))).toBe(2);
  });

  it("stays inside the forecast", () => {
    expect(nearestStep(times, Date.parse("2026-11-10T00:00:00Z"))).toBe(0);
    expect(nearestStep(times, Date.parse("2026-12-01T00:00:00Z"))).toBe(2);
    expect(nearestStep([], Date.now())).toBe(0);
  });
});

describe("seaBounds", () => {
  it("runs from the first grid point to the last", () => {
    expect(seaBounds(flat)).toEqual({ south: 10, west: -30, north: 14, east: -26 });
  });
});

describe("sampleSea, the sea at one spot", () => {
  it("gives a grid point its own values, in metres", () => {
    expect(sampleSea(flat, 0, 12, -28)).toEqual({ heightM: 2, fromDeg: 90, periodS: 8 });
    expect(sampleSea(flat, 1, 12, -28)).toEqual({ heightM: 3, fromDeg: 270, periodS: 9 });
    // The far corner too, which has no neighbour beyond it.
    expect(sampleSea(flat, 0, 14, -26)?.heightM).toBe(3);
  });

  it("blends between grid points", () => {
    expect(sampleSea(flat, 0, 11, -29)?.heightM).toBeCloseTo(1.5, 5);
    expect(sampleSea(flat, 0, 13.5, -27)?.heightM).toBeCloseTo(2.75, 5);
  });

  it("turns the short way round between two directions either side of north", () => {
    const turning = sea([10, 10, 10, 10, 10, 10, 10, 10, 10], [350, 10, 10, 350, 10, 10, 350, 10, 10]);
    const from = sampleSea(turning, 0, 11, -29)?.fromDeg ?? -1;
    // Half way between 350 and 10 is north, not south.
    expect(Math.min(from, 360 - from)).toBeLessThan(1);
  });

  it("has nothing to say outside the grid", () => {
    expect(sampleSea(flat, 0, 9.9, -28)).toBeNull();
    expect(sampleSea(flat, 0, 12, -25.9)).toBeNull();
    expect(sampleSea(flat, 5, 12, -28)).toBeNull();
  });

  it("goes by the sea points alone next to land, and gives up where land has most of the say", () => {
    // The whole east column is land.
    const coast = sea([10, 10, null, 20, 20, null, 30, 30, null]);
    expect(sampleSea(coast, 0, 12, -27.6)?.heightM).toBeCloseTo(2, 5);
    expect(sampleSea(coast, 0, 12, -26.4)).toBeNull();
    expect(sampleSea(coast, 0, 12, -26)).toBeNull();
  });
});

describe("heightColor", () => {
  it("changes with the height and stops changing past the top of the scale", () => {
    const calm = heightColor(0.2);
    const rough = heightColor(4);
    expect(calm.slice(0, 3)).not.toEqual(rough.slice(0, 3));
    expect(heightColor(12)).toEqual(heightColor(30));
    expect(heightColor(-1)).toEqual(heightColor(0));
  });

  it("is never fully see-through or fully solid, so the map shows through", () => {
    for (const metres of [0, 0.5, 1, 2.5, 4, 8]) {
      const alpha = heightColor(metres)[3];
      expect(alpha).toBeGreaterThan(40);
      expect(alpha).toBeLessThan(255);
    }
  });

  it("blends between two marks on the scale", () => {
    const [lower, upper, between] = [heightColor(1), heightColor(2), heightColor(1.5)];
    for (let channel = 0; channel < 3; channel += 1) {
      const low = Math.min(lower[channel], upper[channel]);
      const high = Math.max(lower[channel], upper[channel]);
      expect(between[channel]).toBeGreaterThanOrEqual(low);
      expect(between[channel]).toBeLessThanOrEqual(high);
    }
  });
});

describe("paintSea, the picture laid over the map", () => {
  const pixel = (pixels: Uint8ClampedArray, width: number, x: number, y: number) =>
    Array.from(pixels.slice((y * width + x) * 4, (y * width + x) * 4 + 4));

  const distance = (rgba: number[], metres: number) =>
    heightColor(metres)
      .slice(0, 3)
      .reduce((sum, value, channel) => sum + Math.abs(value - rgba[channel]), 0);

  it("fills the box, north at the top", () => {
    const pixels = paintSea(flat, 0, 6, 40);
    expect(pixels.length).toBe(6 * 40 * 4);
    // 3 m along the north edge, 1 m along the south.
    const top = pixel(pixels, 6, 2, 0);
    const bottom = pixel(pixels, 6, 2, 39);
    expect(distance(top, 3)).toBeLessThan(distance(top, 1));
    expect(distance(bottom, 1)).toBeLessThan(distance(bottom, 3));
    expect(distance(top, 3)).toBeLessThan(12);
    expect(top[3]).toBeGreaterThan(0);
    expect(bottom[3]).toBeGreaterThan(0);
  });

  it("thins out towards its edges, so the box has no hard border on the map", () => {
    const even = sea([20, 20, 20, 20, 20, 20, 20, 20, 20]);
    const pixels = paintSea(even, 0, 100, 100);
    const middle = pixel(pixels, 100, 50, 50)[3];
    expect(middle).toBe(Math.round(heightColor(2)[3]));
    expect(pixel(pixels, 100, 0, 50)[3]).toBeLessThan(middle / 4);
    expect(pixel(pixels, 100, 50, 99)[3]).toBeLessThan(middle / 4);
    expect(pixel(pixels, 100, 3, 50)[3]).toBeLessThan(middle);
    // Well inside, nothing is taken away.
    expect(pixel(pixels, 100, 20, 20)[3]).toBe(middle);
  });

  it("leaves land clear", () => {
    const coast = sea([10, 10, null, 20, 20, null, 30, 30, null]);
    const pixels = paintSea(coast, 0, 8, 4);
    expect(pixel(pixels, 8, 7, 2)[3]).toBe(0);
    expect(pixel(pixels, 8, 0, 2)[3]).toBeGreaterThan(0);
  });

  it("spaces its rows as a Mercator map does, not evenly in latitude", () => {
    // From the equator to 60 N the middle of a Mercator map is near 36 N, not 30 N.
    const tall: SeaForecast = {
      ...flat,
      south: 0,
      west: 0,
      step: 30,
      rows: 3,
      cols: 2,
      height: [[0, 0, 30, 30, 60, 60]],
      direction: [[0, 0, 0, 0, 0, 0]],
      period: [[8, 8, 8, 8, 8, 8]],
      times: ["2026-11-16T18:00:00Z"],
    };
    const pixels = paintSea(tall, 0, 2, 101);
    const middle = pixel(pixels, 2, 0, 50);
    // Heights were set equal to a tenth of the latitude: 3.6 m at 36 N, 3.0 m at 30 N.
    expect(distance(middle, 3.6)).toBeLessThan(distance(middle, 3.0));
  });
});

describe("seaArrows", () => {
  it("points each arrow the way the waves are going, which is away from where they come from", () => {
    const arrows = seaArrows(flat, 0, 1);
    expect(arrows).toHaveLength(9);
    expect(arrows[0]).toEqual({ pos: [10, -30], towardDeg: 270, heightM: 1 });
    expect(seaArrows(flat, 1, 1)[8]).toEqual({ pos: [14, -26], towardDeg: 90, heightM: 4 });
  });

  it("leaves out land and thins out when asked to", () => {
    const coast = sea([10, 10, null, 20, 20, null, 30, 30, null]);
    expect(seaArrows(coast, 0, 1)).toHaveLength(6);
    expect(seaArrows(flat, 0, 2).map((arrow) => arrow.pos)).toEqual([
      [10, -30],
      [10, -26],
      [14, -30],
      [14, -26],
    ]);
  });

  it("draws nothing for a time step that does not exist", () => {
    expect(seaArrows(flat, 7, 1)).toEqual([]);
  });
});

describe("arrowStride, how many grid points apart the arrows are drawn", () => {
  it("draws every point when the map is zoomed in and fewer when it is zoomed out", () => {
    expect(arrowStride(2, 6)).toBe(1);
    expect(arrowStride(2, 4)).toBe(2);
    expect(arrowStride(2, 2)).toBeGreaterThan(2);
    expect(arrowStride(5, 4)).toBe(1);
  });
});
