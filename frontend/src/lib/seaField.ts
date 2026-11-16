/**
 * The wave forecast drawn over the voyage map: reading the grid the server sends
 * (`/api/voyage/sea`), blending between its points, and turning one time step
 * into a picture and a set of arrows. No map library and no canvas in here, so
 * all of it can be tested.
 */
import type { LatLon } from "@/lib/geo";

export interface SeaForecast {
  fetched: string;
  /** The grid: `rows` x `cols` points `step` degrees apart, from the south-west corner. */
  south: number;
  west: number;
  step: number;
  rows: number;
  cols: number;
  interval_h: number;
  /** One per time step, UTC. */
  times: string[];
  /**
   * For each time step, one value per grid point, row by row from the south-west.
   * Null on land. Height in tenths of a metre; the direction the waves come
   * from, in degrees; the period in seconds.
   */
  height: (number | null)[][];
  direction: (number | null)[][];
  period: (number | null)[][];
}

export interface SeaSample {
  heightM: number;
  /** Where the waves come from, degrees true. */
  fromDeg: number | null;
  periodS: number | null;
}

/** The time step closest to a moment (ms since 1970). */
export const nearestStep = (times: string[], moment: number): number => {
  let best = 0;
  let gap = Number.POSITIVE_INFINITY;
  times.forEach((time, index) => {
    const distance = Math.abs(Date.parse(time) - moment);
    if (distance < gap) {
      gap = distance;
      best = index;
    }
  });
  return best;
};

export const seaBounds = (sea: SeaForecast) => ({
  south: sea.south,
  west: sea.west,
  north: sea.south + (sea.rows - 1) * sea.step,
  east: sea.west + (sea.cols - 1) * sea.step,
});

const toRad = (deg: number) => (deg * Math.PI) / 180;

/**
 * The sea at one spot, blended from the four grid points around it. Next to land
 * only the sea points count; where they have less than half the say, there is
 * no answer, and none outside the grid.
 */
export const sampleSea = (
  sea: SeaForecast,
  step: number,
  lat: number,
  lon: number
): SeaSample | null => {
  const heights = sea.height[step];
  if (!heights) {
    return null;
  }
  const y = (lat - sea.south) / sea.step;
  const x = (lon - sea.west) / sea.step;
  // A hair of slack, so that a point given as 14.000000001 still counts as on the edge.
  if (y < -1e-9 || x < -1e-9 || y > sea.rows - 1 + 1e-9 || x > sea.cols - 1 + 1e-9) {
    return null;
  }
  const row = Math.min(sea.rows - 1, Math.max(0, Math.floor(y)));
  const col = Math.min(sea.cols - 1, Math.max(0, Math.floor(x)));
  const nextRow = Math.min(sea.rows - 1, row + 1);
  const nextCol = Math.min(sea.cols - 1, col + 1);
  const fy = Math.min(1, Math.max(0, y - row));
  const fx = Math.min(1, Math.max(0, x - col));

  const corners: [number, number][] = [
    [row * sea.cols + col, (1 - fy) * (1 - fx)],
    [row * sea.cols + nextCol, (1 - fy) * fx],
    [nextRow * sea.cols + col, fy * (1 - fx)],
    [nextRow * sea.cols + nextCol, fy * fx],
  ];

  let weight = 0;
  let height = 0;
  let east = 0;
  let north = 0;
  let turnWeight = 0;
  let period = 0;
  let periodWeight = 0;
  for (const [index, share] of corners) {
    const value = heights[index];
    if (share <= 0 || value === null || value === undefined) {
      continue;
    }
    weight += share;
    height += share * value;
    const from = sea.direction[step]?.[index];
    if (from !== null && from !== undefined) {
      // Directions are averaged as arrows, so 350 and 10 meet at north, not south.
      east += share * Math.sin(toRad(from));
      north += share * Math.cos(toRad(from));
      turnWeight += share;
    }
    const seconds = sea.period[step]?.[index];
    if (seconds !== null && seconds !== undefined) {
      period += share * seconds;
      periodWeight += share;
    }
  }
  if (weight < 0.5) {
    return null;
  }
  return {
    heightM: height / weight / 10,
    fromDeg:
      turnWeight > 0 ? ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360 : null,
    periodS: periodWeight > 0 ? period / periodWeight : null,
  };
};

/** The scale: wave height in metres, its colour, and how solid it is drawn (0-255). */
export const HEIGHT_SCALE: { metres: number; rgb: [number, number, number]; alpha: number }[] = [
  { metres: 0, rgb: [38, 70, 140], alpha: 70 },
  { metres: 0.5, rgb: [45, 105, 185], alpha: 105 },
  { metres: 1, rgb: [50, 145, 205], alpha: 130 },
  { metres: 2, rgb: [80, 200, 150], alpha: 150 },
  { metres: 3, rgb: [225, 210, 75], alpha: 165 },
  { metres: 4, rgb: [240, 150, 55], alpha: 175 },
  { metres: 5, rgb: [228, 80, 60], alpha: 185 },
  { metres: 6.5, rgb: [200, 60, 150], alpha: 195 },
  { metres: 9, rgb: [170, 90, 220], alpha: 200 },
];

/** Colour for a wave height: red, green, blue and how solid, each 0-255. */
export const heightColor = (metres: number): [number, number, number, number] => {
  const top = HEIGHT_SCALE[HEIGHT_SCALE.length - 1];
  const height = Math.min(top.metres, Math.max(0, metres));
  let upper = 1;
  while (upper < HEIGHT_SCALE.length - 1 && HEIGHT_SCALE[upper].metres < height) {
    upper += 1;
  }
  const from = HEIGHT_SCALE[upper - 1];
  const to = HEIGHT_SCALE[upper];
  const share = (height - from.metres) / (to.metres - from.metres);
  const blend = (a: number, b: number) => a + (b - a) * share;
  return [
    blend(from.rgb[0], to.rgb[0]),
    blend(from.rgb[1], to.rgb[1]),
    blend(from.rgb[2], to.rgb[2]),
    blend(from.alpha, to.alpha),
  ];
};

const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + toRad(lat) / 2));
const latitudeAt = (y: number) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;

/**
 * One time step as a picture of the grid's box: `width` x `height` pixels, four
 * numbers each (red, green, blue, how solid). Columns are even in longitude and
 * rows even in Mercator's stretched latitude, which is how a web map lays an
 * image out between two corners. Land is left clear.
 */
export const paintSea = (
  sea: SeaForecast,
  step: number,
  width: number,
  height: number
): Uint8ClampedArray => {
  const pixels = new Uint8ClampedArray(width * height * 4);
  const { south, west, north, east } = seaBounds(sea);
  const top = mercatorY(north);
  const bottom = mercatorY(south);

  for (let y = 0; y < height; y += 1) {
    const lat = latitudeAt(top + ((y + 0.5) / height) * (bottom - top));
    for (let x = 0; x < width; x += 1) {
      const lon = west + ((x + 0.5) / width) * (east - west);
      const here = sampleSea(sea, step, lat, lon);
      if (here) {
        pixels.set(heightColor(here.heightM), (y * width + x) * 4);
      }
    }
  }
  return pixels;
};

export interface SeaArrow {
  pos: LatLon;
  /** Where the waves are heading, degrees true: the opposite of where they come from. */
  towardDeg: number;
  heightM: number;
}

/** An arrow for every `stride`-th grid point that is at sea and has a direction. */
export const seaArrows = (sea: SeaForecast, step: number, stride: number): SeaArrow[] => {
  const heights = sea.height[step];
  const directions = sea.direction[step];
  if (!heights || !directions) {
    return [];
  }
  const every = Math.max(1, Math.round(stride));
  const arrows: SeaArrow[] = [];
  for (let row = 0; row < sea.rows; row += every) {
    for (let col = 0; col < sea.cols; col += every) {
      const index = row * sea.cols + col;
      const height = heights[index];
      const from = directions[index];
      if (height === null || height === undefined || from === null || from === undefined) {
        continue;
      }
      arrows.push({
        pos: [sea.south + row * sea.step, sea.west + col * sea.step],
        towardDeg: (from + 180) % 360,
        heightM: height / 10,
      });
    }
  }
  return arrows;
};

/** Arrows closer together than this on screen run into each other. */
const MIN_ARROW_GAP_PX = 30;

/** How many grid points apart to draw the arrows at a zoom level of a web map. */
export const arrowStride = (stepDeg: number, zoom: number): number => {
  const pixelsPerDegree = (256 * 2 ** zoom) / 360;
  return Math.max(1, Math.ceil(MIN_ARROW_GAP_PX / (stepDeg * pixelsPerDegree)));
};
