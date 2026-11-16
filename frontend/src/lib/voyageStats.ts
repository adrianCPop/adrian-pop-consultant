/** Figures for the voyage page, worked out from the track the API returns. */
import { bearingDeg, distanceNm, type LatLon } from "@/lib/geo";

export interface TrackFix {
  pos: LatLon;
  /** Milliseconds since the epoch. */
  t: number;
}

export interface DailyRun {
  /** 1 for the first 24 hours after departure. */
  day: number;
  nm: number;
  /** False for the 24 hours still in progress. */
  complete: boolean;
}

export interface VoyageStats {
  position: LatLon;
  positionTime: number;
  courseDeg: number | null;
  speedKn: number | null;
  sailedNm: number;
  toGoNm: number;
  progress: number;
  elapsedHours: number;
  averageKn: number | null;
  dailyRuns: DailyRun[];
  bestRun: DailyRun | null;
  eta: number | null;
}

const HOUR_MS = 3_600_000;
const DAY_MS = 24 * HOUR_MS;

/** Course and speed are measured over at least this long, to smooth out GPS jitter. */
const MIN_SPAN_MS = 30 * 60_000;
const MAX_SPAN_MS = 6 * HOUR_MS;

export const toFixes = (track: [number, number, number][]): TrackFix[] =>
  track.map(([lat, lon, seconds]) => ({ pos: [lat, lon], t: seconds * 1000 }));

/**
 * `until` is "now" while under way and the arrival time afterwards.
 * Returns null until the first position has arrived.
 */
export const computeStats = (
  fixes: TrackFix[],
  departure: number,
  destination: LatLon,
  until: number
): VoyageStats | null => {
  if (fixes.length === 0) {
    return null;
  }

  const first = fixes[0];
  const last = fixes[fixes.length - 1];
  const dayCount = Math.max(1, Math.ceil((until - departure) / DAY_MS));
  const runNm = new Array<number>(dayCount).fill(0);
  const dayOf = (time: number) =>
    Math.min(dayCount - 1, Math.max(0, Math.floor((time - departure) / DAY_MS)));
  let sailedNm = 0;

  for (let index = 1; index < fixes.length; index += 1) {
    const from = fixes[index - 1];
    const to = fixes[index];
    const leg = distanceNm(from.pos, to.pos);
    sailedNm += leg;

    // A leg that crosses into another day (a long gap in the track can span several)
    // is shared between those days by time, as if sailed at a steady speed.
    const span = to.t - from.t;
    if (span <= 0) {
      runNm[dayOf(from.t)] += leg;
      continue;
    }
    let cursor = from.t;
    while (cursor < to.t) {
      const dayEnd = departure + (Math.floor((cursor - departure) / DAY_MS) + 1) * DAY_MS;
      const stop = Math.min(to.t, dayEnd);
      runNm[dayOf(cursor)] += leg * ((stop - cursor) / span);
      cursor = stop;
    }
  }

  // Course and speed come from the nearest fix that is far enough behind the last
  // one to be steady, and not so far that it describes a different part of the day.
  let reference: TrackFix | null = null;
  for (let index = fixes.length - 2; index >= 0; index -= 1) {
    const span = last.t - fixes[index].t;
    if (span > MAX_SPAN_MS) {
      break;
    }
    if (span >= MIN_SPAN_MS) {
      reference = fixes[index];
      break;
    }
  }
  const span = reference ? last.t - reference.t : 0;
  const moved = reference ? distanceNm(reference.pos, last.pos) : 0;

  const dailyRuns: DailyRun[] = runNm.map((nm, index) => ({
    day: index + 1,
    nm,
    complete: departure + (index + 1) * DAY_MS <= until,
  }));
  const completeRuns = dailyRuns.filter((run) => run.complete && run.nm > 0);
  const bestRun = completeRuns.reduce<DailyRun | null>(
    (best, run) => (best === null || run.nm > best.nm ? run : best),
    null
  );

  const toGoNm = distanceNm(last.pos, destination);
  // Measured between the first and last positions, so a tracker that starts late
  // (or a departure time entered early) does not drag the average down.
  const sailingHours = (last.t - first.t) / HOUR_MS;
  const averageKn = sailingHours >= 1 && sailedNm > 1 ? sailedNm / sailingHours : null;

  return {
    position: last.pos,
    positionTime: last.t,
    courseDeg: reference && moved > 0.05 ? bearingDeg(reference.pos, last.pos) : null,
    speedKn: reference && span > 0 ? moved / (span / HOUR_MS) : null,
    sailedNm,
    toGoNm,
    progress: sailedNm + toGoNm > 0 ? sailedNm / (sailedNm + toGoNm) : 0,
    elapsedHours: Math.max(0, (until - departure) / HOUR_MS),
    averageKn,
    dailyRuns,
    bestRun,
    eta: averageKn ? last.t + (toGoNm / averageKn) * HOUR_MS : null,
  };
};
