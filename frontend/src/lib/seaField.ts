/**
 * The forecasts drawn over the voyage map (waves, wind): reading the grid the
 * server sends (`/api/voyage/sea`), blending between its points, and turning one
 * time step into a picture and a set of arrows. No map library and no canvas in
 * here, so all of it can be tested.
 */
import type { LatLon } from "@/lib/geo";

export type SeaLayerName = "waves" | "wind";

export const SEA_LAYERS: SeaLayerName[] = ["waves", "wind"];

export interface SeaForecast {
  layer: SeaLayerName;
  fetched: string;
  /** The grid: `rows` x `cols` points `step` degrees apart, from the south-west corner. */
  south: number;
  west: number;
  step: number;
  rows: number;
  cols: number;
  interval_h: number;
  /** `value` is sent multiplied by this, to be a whole number. */
  scale: number;
  /** One per time step, UTC. */
  times: string[];
  /**
   * For each time step, one figure per grid point, row by row from the south-west;
   * null where there is none (for waves, on land).
   * `value`: wave height in metres, or wind speed in knots (times `scale`).
   * `direction`: where the waves or the wind come from, in degrees.
   * `extra`: seconds between waves, or gusts in knots.
   */
  value: (number | null)[][];
  direction: (number | null)[][];
  extra: (number | null)[][];
}

export interface SeaSample {
  /** Metres of wave height, or knots of wind. */
  value: number;
  /** Where it comes from, degrees true. */
  fromDeg: number | null;
  /** Seconds between waves, or knots in the gusts. */
  extra: number | null;
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
 * Next to land only the points at sea count, and where they have less than this
 * share of the say there is no answer.
 */
const MIN_SHARE = 0.5;

/**
 * The forecast at one spot, blended from the four grid points around it. There
 * is no answer outside the grid.
 */
export const sampleSea = (
  sea: SeaForecast,
  step: number,
  lat: number,
  lon: number
): SeaSample | null => {
  const values = sea.value[step];
  if (!values) {
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
  let total = 0;
  let east = 0;
  let north = 0;
  let turnWeight = 0;
  let extra = 0;
  let extraWeight = 0;
  for (const [index, share] of corners) {
    const value = values[index];
    if (share <= 0 || value === null || value === undefined) {
      continue;
    }
    weight += share;
    total += share * value;
    const from = sea.direction[step]?.[index];
    if (from !== null && from !== undefined) {
      // Directions are averaged as arrows, so 350 and 10 meet at north, not south.
      east += share * Math.sin(toRad(from));
      north += share * Math.cos(toRad(from));
      turnWeight += share;
    }
    const more = sea.extra[step]?.[index];
    if (more !== null && more !== undefined) {
      extra += share * more;
      extraWeight += share;
    }
  }
  if (weight < MIN_SHARE) {
    return null;
  }
  return {
    value: total / weight / sea.scale,
    fromDeg: turnWeight > 0 ? ((Math.atan2(east, north) * 180) / Math.PI + 360) % 360 : null,
    extra: extraWeight > 0 ? extra / extraWeight : null,
  };
};

/**
 * The largest figure on the grid at a time step: metres or knots. Null when
 * there is none. The outermost points are left out, as they are for the arrows:
 * the picture has faded away there, and "the most in this area" should be
 * somewhere the map shows it.
 */
export const seaMax = (sea: SeaForecast, step: number): number | null => {
  const values = sea.value[step];
  if (!values) {
    return null;
  }
  const inset = sea.rows > 2 && sea.cols > 2 ? 1 : 0;
  let most: number | null = null;
  for (let row = inset; row < sea.rows - inset; row += 1) {
    for (let col = inset; col < sea.cols - inset; col += 1) {
      const value = values[row * sea.cols + col];
      if (value !== null && value !== undefined && (most === null || value > most)) {
        most = value;
      }
    }
  }
  return most === null ? null : most / sea.scale;
};

/** A forecast fetched longer ago than this is not drawn as the days ahead. The server sends none that old either. */
export const SEA_MAX_AGE_MS = 24 * 3_600_000;
/** How long the server keeps a forecast before it fetches a newer one. */
const SERVER_KEEPS_MS = 6 * 3_600_000;
/** How often a page asks again for a forecast it is showing. */
export const SEA_REFRESH_MS = 30 * 60_000;
/** The same, when the one it got was already due to be replaced: a newer one is on its way. */
const SEA_REFRESH_SOON_MS = 2 * 60_000;
/** Never more often than this, whatever the reason. */
const SEA_ASK_GAP_MS = 60_000;

/** Whether a forecast was fetched too long ago to be shown at all. `now`: the server's clock, in ms. */
export const seaTooOld = (sea: SeaForecast, now: number): boolean => {
  const fetched = Date.parse(sea.fetched);
  return Number.isNaN(fetched) || now - fetched > SEA_MAX_AGE_MS;
};

/**
 * Whether a page showing a forecast should ask the server for it again.
 * `gotAt` and `askedAt`: when the page last received it and last asked for it,
 * by its own clock, as `now` is; `serverNow`: the server's clock, to judge the
 * forecast's own age by.
 */
export const seaRefreshDue = (
  sea: SeaForecast,
  { gotAt, askedAt, now, serverNow }: { gotAt: number; askedAt: number; now: number; serverNow: number }
): boolean => {
  if (now - askedAt < SEA_ASK_GAP_MS) {
    return false;
  }
  if (seaTooOld(sea, serverNow)) {
    return true;
  }
  const dueAtTheServer = serverNow - Date.parse(sea.fetched) > SERVER_KEEPS_MS;
  return now - gotAt > (dueAtTheServer ? SEA_REFRESH_SOON_MS : SEA_REFRESH_MS);
};

/** Whether what the server sent is a forecast the page can draw. */
export const isSeaForecast = (data: unknown): data is SeaForecast => {
  const sea = data as Partial<SeaForecast> | null;
  if (!sea || typeof sea !== "object") {
    return false;
  }
  const numbers = [sea.south, sea.west, sea.step, sea.rows, sea.cols, sea.scale];
  if (!numbers.every((value) => typeof value === "number" && Number.isFinite(value))) {
    return false;
  }
  const cells = (sea.rows as number) * (sea.cols as number);
  const steps = Array.isArray(sea.times) ? sea.times.length : 0;
  const whole = (figures: unknown) =>
    Array.isArray(figures) &&
    figures.length === steps &&
    figures.every((row) => Array.isArray(row) && row.length === cells);
  return (
    (sea.layer === "waves" || sea.layer === "wind") &&
    typeof sea.fetched === "string" &&
    (sea.rows as number) >= 2 &&
    (sea.cols as number) >= 2 &&
    (sea.scale as number) > 0 &&
    steps > 0 &&
    whole(sea.value) &&
    whole(sea.direction) &&
    whole(sea.extra)
  );
};

interface ScaleMark {
  /** Metres of wave height, or knots of wind. */
  at: number;
  rgb: [number, number, number];
  /** How solid it is drawn, 0-255. */
  alpha: number;
}

/** The colour scales. Anything past the last mark is drawn like the last mark. */
export const SEA_SCALES: Record<SeaLayerName, ScaleMark[]> = {
  waves: [
    { at: 0, rgb: [38, 70, 140], alpha: 70 },
    { at: 0.5, rgb: [45, 105, 185], alpha: 105 },
    { at: 1, rgb: [50, 145, 205], alpha: 130 },
    { at: 2, rgb: [80, 200, 150], alpha: 150 },
    { at: 3, rgb: [225, 210, 75], alpha: 165 },
    { at: 4, rgb: [240, 150, 55], alpha: 175 },
    { at: 5, rgb: [228, 80, 60], alpha: 185 },
    { at: 6.5, rgb: [200, 60, 150], alpha: 195 },
    { at: 9, rgb: [170, 90, 220], alpha: 200 },
  ],
  wind: [
    { at: 0, rgb: [38, 70, 140], alpha: 70 },
    { at: 5, rgb: [45, 105, 185], alpha: 100 },
    { at: 10, rgb: [50, 145, 205], alpha: 125 },
    { at: 15, rgb: [70, 195, 160], alpha: 145 },
    { at: 20, rgb: [165, 215, 95], alpha: 158 },
    { at: 25, rgb: [230, 205, 75], alpha: 168 },
    { at: 30, rgb: [240, 150, 55], alpha: 178 },
    { at: 40, rgb: [228, 80, 60], alpha: 188 },
    { at: 50, rgb: [200, 60, 150], alpha: 196 },
    { at: 64, rgb: [170, 90, 220], alpha: 202 },
  ],
};

export const scaleTop = (layer: SeaLayerName) =>
  SEA_SCALES[layer][SEA_SCALES[layer].length - 1].at;

/** Colour for a figure of a layer: red, green, blue and how solid, each 0-255. */
export const seaColor = (layer: SeaLayerName, figure: number): [number, number, number, number] => {
  const marks = SEA_SCALES[layer];
  const clamped = Math.min(scaleTop(layer), Math.max(0, figure));
  let upper = 1;
  while (upper < marks.length - 1 && marks[upper].at < clamped) {
    upper += 1;
  }
  const from = marks[upper - 1];
  const to = marks[upper];
  const share = (clamped - from.at) / (to.at - from.at);
  const blend = (a: number, b: number) => a + (b - a) * share;
  return [
    blend(from.rgb[0], to.rgb[0]),
    blend(from.rgb[1], to.rgb[1]),
    blend(from.rgb[2], to.rgb[2]),
    blend(from.alpha, to.alpha),
  ];
};

/** A layer's whole scale in 256 steps, so that painting a picture looks colours up instead of working them out. */
const TABLE_STEPS = 255;
const colourTables = new Map<SeaLayerName, Uint8ClampedArray>();
const colourTable = (layer: SeaLayerName) => {
  let table = colourTables.get(layer);
  if (!table) {
    table = new Uint8ClampedArray((TABLE_STEPS + 1) * 4);
    for (let index = 0; index <= TABLE_STEPS; index += 1) {
      table.set(seaColor(layer, (index / TABLE_STEPS) * scaleTop(layer)), index * 4);
    }
    colourTables.set(layer, table);
  }
  return table;
};

const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + toRad(lat) / 2));
const latitudeAt = (y: number) => ((2 * Math.atan(Math.exp(y)) - Math.PI / 2) * 180) / Math.PI;

/** The picture fades out over this share of its shorter side, so the box has no hard edge on the map. */
const EDGE_FADE = 0.07;

/**
 * One time step as a picture of the grid's box: `width` x `height` pixels, four
 * numbers each (red, green, blue, how solid). Columns are even in longitude and
 * rows even in Mercator's stretched latitude, which is how a web map lays an
 * image out between two corners. Where there is no figure (land, for waves) it
 * is left clear, and the picture thins out towards its edges.
 *
 * Written to be quick: a phone repaints this while a slider is dragged. It
 * blends the same way as `sampleSea`, but only the figure that gives the colour.
 */
export const paintSea = (
  sea: SeaForecast,
  step: number,
  width: number,
  height: number
): Uint8ClampedArray => {
  const pixels = new Uint8ClampedArray(width * height * 4);
  const values = sea.value[step];
  if (!values || sea.rows < 2 || sea.cols < 2) {
    return pixels;
  }
  const { south, north } = seaBounds(sea);
  const top = mercatorY(north);
  const bottom = mercatorY(south);
  const fade = Math.max(1, Math.min(width, height) * EDGE_FADE);
  const table = colourTable(sea.layer);
  const perFigure = TABLE_STEPS / (scaleTop(sea.layer) * sea.scale);
  const { rows, cols } = sea;

  // Which two grid columns each pixel column lies between, and how far along.
  const leftCol = new Int32Array(width);
  const alongCol = new Float64Array(width);
  for (let x = 0; x < width; x += 1) {
    const at = ((x + 0.5) / width) * (cols - 1);
    leftCol[x] = Math.min(cols - 2, Math.floor(at));
    alongCol[x] = at - leftCol[x];
  }

  for (let y = 0; y < height; y += 1) {
    const lat = latitudeAt(top + ((y + 0.5) / height) * (bottom - top));
    const at = Math.min(rows - 1, Math.max(0, (lat - south) / sea.step));
    const lowRow = Math.min(rows - 2, Math.floor(at));
    const up = at - lowRow;
    const low = lowRow * cols;
    const high = low + cols;
    const fromRowEdge = Math.min(y + 0.5, height - y - 0.5);

    for (let x = 0; x < width; x += 1) {
      const col = leftCol[x];
      const right = alongCol[x];
      let weight = 0;
      let total = 0;
      let value = values[low + col];
      if (value !== null && value !== undefined) {
        const share = (1 - up) * (1 - right);
        weight += share;
        total += share * value;
      }
      value = values[low + col + 1];
      if (value !== null && value !== undefined) {
        const share = (1 - up) * right;
        weight += share;
        total += share * value;
      }
      value = values[high + col];
      if (value !== null && value !== undefined) {
        const share = up * (1 - right);
        weight += share;
        total += share * value;
      }
      value = values[high + col + 1];
      if (value !== null && value !== undefined) {
        const share = up * right;
        weight += share;
        total += share * value;
      }
      if (weight < MIN_SHARE) {
        continue;
      }
      const entry =
        Math.min(TABLE_STEPS, Math.max(0, Math.round((total / weight) * perFigure))) * 4;
      const fromEdge = Math.min(x + 0.5, width - x - 0.5, fromRowEdge);
      const pixel = (y * width + x) * 4;
      pixels[pixel] = table[entry];
      pixels[pixel + 1] = table[entry + 1];
      pixels[pixel + 2] = table[entry + 2];
      pixels[pixel + 3] = table[entry + 3] * Math.min(1, fromEdge / fade);
    }
  }
  return pixels;
};

export interface SeaArrow {
  pos: LatLon;
  /** Where the waves or the wind are heading, degrees true: the opposite of where they come from. */
  towardDeg: number;
  /** Metres or knots. */
  value: number;
}

/**
 * An arrow for every `stride`-th grid point that has a figure and a direction.
 * Not for the outermost points, where the picture has faded away.
 */
export const seaArrows = (sea: SeaForecast, step: number, stride: number): SeaArrow[] => {
  const values = sea.value[step];
  const directions = sea.direction[step];
  if (!values || !directions) {
    return [];
  }
  const every = Math.max(1, Math.round(stride));
  const arrows: SeaArrow[] = [];
  for (let row = 1; row < sea.rows - 1; row += every) {
    for (let col = 1; col < sea.cols - 1; col += every) {
      const index = row * sea.cols + col;
      const value = values[index];
      const from = directions[index];
      if (value === null || value === undefined || from === null || from === undefined) {
        continue;
      }
      arrows.push({
        pos: [sea.south + row * sea.step, sea.west + col * sea.step],
        towardDeg: (from + 180) % 360,
        value: value / sea.scale,
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
