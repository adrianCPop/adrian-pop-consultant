import { describe, expect, it } from "vitest";
import {
  arrowStride,
  isSeaForecast,
  nearestStep,
  paintSea,
  sampleSea,
  scaleTop,
  seaArrows,
  seaBounds,
  seaColor,
  seaMax,
  seaRefreshDue,
  seaTooOld,
  SEA_SCALES,
  type SeaForecast,
} from "@/lib/seaField";

/**
 * A wave forecast on a grid from 10 N 30 W, two degrees apart, with two time
 * steps. `height` is in tenths of a metre, row by row from the south-west.
 */
const waves = (
  height: (number | null)[],
  { cols = 3, direction }: { cols?: number; direction?: (number | null)[] } = {}
): SeaForecast => ({
  layer: "waves",
  fetched: "2026-11-16T18:10:00Z",
  south: 10,
  west: -30,
  step: 2,
  rows: height.length / cols,
  cols,
  interval_h: 6,
  scale: 10,
  times: ["2026-11-16T18:00:00Z", "2026-11-17T00:00:00Z"],
  value: [height, height.map((value) => (value === null ? null : value + 10))],
  direction: [direction ?? height.map((value) => (value === null ? null : 90)), height.map(() => 270)],
  extra: [height.map((value) => (value === null ? null : 8)), height.map(() => 9)],
});

// 1 m along the south row, 2 m in the middle, 3 m in the north.
const flat = waves([10, 10, 10, 20, 20, 20, 30, 30, 30]);

const pixel = (pixels: Uint8ClampedArray, width: number, x: number, y: number) =>
  Array.from(pixels.slice((y * width + x) * 4, (y * width + x) * 4 + 4));
const distance = (rgba: number[], metres: number) =>
  seaColor("waves", metres)
    .slice(0, 3)
    .reduce((sum, value, channel) => sum + Math.abs(value - rgba[channel]), 0);

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

describe("sampleSea, the forecast at one spot", () => {
  it("gives a grid point its own figures, in metres", () => {
    expect(sampleSea(flat, 0, 12, -28)).toEqual({ value: 2, fromDeg: 90, extra: 8 });
    expect(sampleSea(flat, 1, 12, -28)).toEqual({ value: 3, fromDeg: 270, extra: 9 });
    // The far corner too, which has no neighbour beyond it.
    expect(sampleSea(flat, 0, 14, -26)?.value).toBe(3);
  });

  it("gives wind as it is sent, in knots", () => {
    const wind: SeaForecast = { ...flat, layer: "wind", scale: 1 };
    expect(sampleSea(wind, 0, 12, -28)?.value).toBe(20);
  });

  it("blends between grid points", () => {
    expect(sampleSea(flat, 0, 11, -29)?.value).toBeCloseTo(1.5, 5);
    expect(sampleSea(flat, 0, 13.5, -27)?.value).toBeCloseTo(2.75, 5);
  });

  it("turns the short way round between two directions either side of north", () => {
    const turning = waves([10, 10, 10, 10, 10, 10, 10, 10, 10], {
      direction: [350, 10, 10, 350, 10, 10, 350, 10, 10],
    });
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
    const coast = waves([10, 10, null, 20, 20, null, 30, 30, null]);
    expect(sampleSea(coast, 0, 12, -27.6)?.value).toBeCloseTo(2, 5);
    expect(sampleSea(coast, 0, 12, -26.4)).toBeNull();
    expect(sampleSea(coast, 0, 12, -26)).toBeNull();
  });
});

describe("seaMax", () => {
  it("finds the largest figure of a time step, away from the edge where the picture fades", () => {
    // Five by five: 9.9 m on the outermost ring, 2.4 m the most inside it.
    const ringed = waves(
      Array.from({ length: 25 }, (_, index) => {
        const row = Math.floor(index / 5);
        const col = index % 5;
        return row === 0 || row === 4 || col === 0 || col === 4 ? 99 : 10 + index;
      }),
      { cols: 5 }
    );
    expect(seaMax(ringed, 0)).toBe(2.8);
    expect(seaMax(ringed, 1)).toBe(3.8);
  });

  it("goes by every point of a grid too small to have an inside", () => {
    expect(seaMax(waves([null, 7, 12, null], { cols: 2 }), 0)).toBe(1.2);
  });

  it("has none where there is nothing", () => {
    expect(seaMax(waves([null, null, null, null], { cols: 2 }), 0)).toBeNull();
    expect(seaMax(flat, 9)).toBeNull();
  });
});

describe("how old a forecast may be", () => {
  const fetched = Date.parse(flat.fetched);
  const HOUR = 3_600_000;
  const MINUTE = 60_000;

  it("is not shown at all once it is a day old, or when its date cannot be read", () => {
    expect(seaTooOld(flat, fetched + 23 * HOUR)).toBe(false);
    expect(seaTooOld(flat, fetched + 25 * HOUR)).toBe(true);
    expect(seaTooOld({ ...flat, fetched: "some time ago" }, fetched)).toBe(true);
  });

  it("is asked for again half an hour after the page got it", () => {
    const got = { gotAt: 1_000_000, askedAt: 1_000_000, serverNow: fetched + HOUR };
    expect(seaRefreshDue(flat, { ...got, now: 1_000_000 + 29 * MINUTE })).toBe(false);
    expect(seaRefreshDue(flat, { ...got, now: 1_000_000 + 31 * MINUTE })).toBe(true);
  });

  it("is asked for again within minutes when the server sent one it was about to replace", () => {
    // Fetched seven hours before: the server keeps one for six, so a newer one is on its way.
    const got = { gotAt: 1_000_000, askedAt: 1_000_000, serverNow: fetched + 7 * HOUR };
    expect(seaRefreshDue(flat, { ...got, now: 1_000_000 + 1.5 * MINUTE })).toBe(false);
    expect(seaRefreshDue(flat, { ...got, now: 1_000_000 + 3 * MINUTE })).toBe(true);
  });

  it("is asked for again at once when it has become too old to show", () => {
    const got = { gotAt: 1_000_000, askedAt: 1_000_000 - 5 * MINUTE, serverNow: fetched + 25 * HOUR };
    expect(seaRefreshDue(flat, { ...got, now: 1_000_000 + MINUTE })).toBe(true);
  });

  it("is never asked for twice within a minute", () => {
    const now = 1_000_000 + 40 * MINUTE;
    const asked = { gotAt: 1_000_000, askedAt: now - 30_000 };
    expect(seaRefreshDue(flat, { ...asked, now, serverNow: fetched + HOUR })).toBe(false);
    expect(seaRefreshDue(flat, { ...asked, now, serverNow: fetched + 25 * HOUR })).toBe(false);
  });
});

describe("isSeaForecast, what the page will try to draw", () => {
  it("takes a forecast as the server sends it", () => {
    expect(isSeaForecast(flat)).toBe(true);
    expect(isSeaForecast({ ...flat, layer: "wind", scale: 1 })).toBe(true);
  });

  it("refuses anything else that arrives with a 200", () => {
    expect(isSeaForecast(null)).toBe(false);
    expect(isSeaForecast("<html>Sign in to the harbour Wi-Fi</html>")).toBe(false);
    expect(isSeaForecast({ detail: "nope" })).toBe(false);
    expect(isSeaForecast({ ...flat, layer: "tides" })).toBe(false);
    expect(isSeaForecast({ ...flat, times: [] , value: [], direction: [], extra: [] })).toBe(false);
    expect(isSeaForecast({ ...flat, rows: 4 })).toBe(false);
    expect(isSeaForecast({ ...flat, value: [flat.value[0]] })).toBe(false);
    expect(isSeaForecast({ ...flat, scale: 0 })).toBe(false);
    expect(isSeaForecast({ ...flat, direction: undefined })).toBe(false);
  });
});

describe("seaColor", () => {
  it("changes with the figure and stops changing past the top of the scale", () => {
    expect(seaColor("waves", 0.2).slice(0, 3)).not.toEqual(seaColor("waves", 4).slice(0, 3));
    expect(seaColor("waves", 12)).toEqual(seaColor("waves", 30));
    expect(seaColor("waves", -1)).toEqual(seaColor("waves", 0));
    expect(seaColor("wind", 70)).toEqual(seaColor("wind", 200));
  });

  it("reads wind in knots and waves in metres", () => {
    // 20 knots is a fresh breeze; 20 metres is off the top of the wave scale.
    expect(seaColor("wind", 20)).not.toEqual(seaColor("waves", 20));
    expect(seaColor("waves", 20)).toEqual(seaColor("waves", scaleTop("waves")));
    expect(scaleTop("wind")).toBe(64);
  });

  it("is never fully see-through or fully solid, so the map shows through", () => {
    for (const layer of ["waves", "wind"] as const) {
      for (const mark of SEA_SCALES[layer]) {
        expect(mark.alpha).toBeGreaterThan(40);
        expect(mark.alpha).toBeLessThan(255);
      }
    }
  });

  it("has its marks in rising order", () => {
    for (const layer of ["waves", "wind"] as const) {
      const marks = SEA_SCALES[layer].map((mark) => mark.at);
      expect(marks).toEqual([...marks].sort((a, b) => a - b));
      expect(new Set(marks).size).toBe(marks.length);
    }
  });

  it("blends between two marks on the scale", () => {
    const [lower, upper, between] = [seaColor("waves", 1), seaColor("waves", 2), seaColor("waves", 1.5)];
    for (let channel = 0; channel < 3; channel += 1) {
      const low = Math.min(lower[channel], upper[channel]);
      const high = Math.max(lower[channel], upper[channel]);
      expect(between[channel]).toBeGreaterThanOrEqual(low);
      expect(between[channel]).toBeLessThanOrEqual(high);
    }
  });
});

describe("paintSea, the picture laid over the map", () => {
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

  it("runs west to east from left to right", () => {
    // 1 m in the west column, 4 m in the east.
    const pixels = paintSea(waves([10, 25, 40, 10, 25, 40, 10, 25, 40]), 0, 60, 10);
    const left = pixel(pixels, 60, 8, 5);
    const right = pixel(pixels, 60, 51, 5);
    expect(distance(left, 1.2)).toBeLessThan(distance(left, 3.8));
    expect(distance(right, 3.8)).toBeLessThan(distance(right, 1.2));
  });

  it("paints what a tap on the same spot would read", () => {
    // Uneven figures, land in one corner: every pixel against the slower, plainer sampling.
    const sea = waves([5, 30, 12, 44, null, 18, 9, 61, 27, 3, 15, 38], { cols: 4 });
    const [width, height] = [45, 30];
    const pixels = paintSea(sea, 0, width, height);
    const { south, west, north, east } = seaBounds(sea);
    const mercator = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
    let checked = 0;
    for (let y = 4; y < height - 4; y += 1) {
      const stretched = mercator(north) + ((y + 0.5) / height) * (mercator(south) - mercator(north));
      const lat = ((2 * Math.atan(Math.exp(stretched)) - Math.PI / 2) * 180) / Math.PI;
      for (let x = 4; x < width - 4; x += 1) {
        const lon = west + ((x + 0.5) / width) * (east - west);
        const here = sampleSea(sea, 0, lat, lon);
        const painted = pixel(pixels, width, x, y);
        if (!here) {
          expect(painted[3]).toBe(0);
          continue;
        }
        // The picture looks colours up in 256 steps, so allow it the width of a step.
        expect(distance(painted, here.value)).toBeLessThan(6);
        checked += 1;
      }
    }
    expect(checked).toBeGreaterThan(500);
  });

  it("thins out towards its edges, so the box has no hard border on the map", () => {
    const even = waves([20, 20, 20, 20, 20, 20, 20, 20, 20]);
    const pixels = paintSea(even, 0, 100, 100);
    const middle = pixel(pixels, 100, 50, 50)[3];
    expect(Math.abs(middle - seaColor("waves", 2)[3])).toBeLessThanOrEqual(1);
    expect(pixel(pixels, 100, 0, 50)[3]).toBeLessThan(middle / 4);
    expect(pixel(pixels, 100, 50, 99)[3]).toBeLessThan(middle / 4);
    expect(pixel(pixels, 100, 3, 50)[3]).toBeLessThan(middle);
    // Well inside, nothing is taken away.
    expect(pixel(pixels, 100, 20, 20)[3]).toBe(middle);
  });

  it("leaves land clear", () => {
    const coast = waves([10, 10, null, 20, 20, null, 30, 30, null]);
    const pixels = paintSea(coast, 0, 8, 4);
    expect(pixel(pixels, 8, 7, 2)[3]).toBe(0);
    expect(pixel(pixels, 8, 2, 2)[3]).toBeGreaterThan(0);
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
      value: [[0, 0, 30, 30, 60, 60]],
      direction: [[0, 0, 0, 0, 0, 0]],
      extra: [[8, 8, 8, 8, 8, 8]],
      times: ["2026-11-16T18:00:00Z"],
    };
    const pixels = paintSea(tall, 0, 40, 101);
    const middle = pixel(pixels, 40, 20, 50);
    // Heights were set equal to a tenth of the latitude: 3.6 m at 36 N, 3.0 m at 30 N.
    expect(distance(middle, 3.6)).toBeLessThan(distance(middle, 3.0));
  });

  it("paints wind by the wind's own scale, in knots as they are sent", () => {
    // 20 knots everywhere. Read as waves it would be off the top of that scale.
    const wind: SeaForecast = {
      ...waves([20, 20, 20, 20, 20, 20, 20, 20, 20]),
      layer: "wind",
      scale: 1,
    };
    const painted = pixel(paintSea(wind, 0, 40, 40), 40, 20, 20);
    const near = (rgba: number[], colour: number[]) =>
      colour.slice(0, 3).reduce((sum, value, channel) => sum + Math.abs(value - rgba[channel]), 0);
    expect(near(painted, seaColor("wind", 20))).toBeLessThan(6);
    expect(near(painted, seaColor("waves", 20))).toBeGreaterThan(60);
    expect(near(painted, seaColor("wind", 2))).toBeGreaterThan(60);
  });

  it("paints nothing for a time step that does not exist", () => {
    expect(paintSea(flat, 7, 4, 4).every((value) => value === 0)).toBe(true);
  });
});

describe("seaArrows", () => {
  // Five by five, so there is an inside to draw arrows in.
  const wide = waves(
    Array.from({ length: 25 }, (_, index) => 10 + index),
    { cols: 5 }
  );

  it("points each arrow the way the waves are going, which is away from where they come from", () => {
    const arrows = seaArrows(wide, 0, 1);
    // The nine points inside; the outermost ring is where the picture fades away.
    expect(arrows).toHaveLength(9);
    expect(arrows[0]).toEqual({ pos: [12, -28], towardDeg: 270, value: 1.6 });
    expect(seaArrows(wide, 1, 1)[8]).toEqual({ pos: [16, -24], towardDeg: 90, value: 3.8 });
  });

  it("leaves out land and thins out when asked to", () => {
    const land = wide.value[0].map((value, index) => (index === 12 ? null : value));
    expect(seaArrows({ ...wide, value: [land, land] }, 0, 1)).toHaveLength(8);
    expect(seaArrows(wide, 0, 2).map((arrow) => arrow.pos)).toEqual([
      [12, -28],
      [12, -24],
      [16, -28],
      [16, -24],
    ]);
  });

  it("draws nothing for a time step that does not exist", () => {
    expect(seaArrows(wide, 7, 1)).toEqual([]);
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
