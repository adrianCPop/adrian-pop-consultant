/** The boat's course set against the planned route: where it is heading, and how that differs from the plan. */
import { bearingDeg, compassPoint, destinationPoint, distanceNm, type LatLon } from "@/lib/geo";

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** From one longitude to another the short way round, in degrees (-180 to 180). */
const lonDiff = (from: number, to: number) => ((((to - from) % 360) + 540) % 360) - 180;

/**
 * The map is a Mercator chart: a straight line on it runs between points whose
 * longitude and "stretched latitude" (this) change in step. Kept clear of the
 * poles, where it runs off to infinity.
 */
const mercatorY = (lat: number) =>
  Math.log(Math.tan(Math.PI / 4 + toRad(Math.max(-89, Math.min(89, lat))) / 2));
const latOfMercatorY = (y: number) => toDeg(2 * Math.atan(Math.exp(y)) - Math.PI / 2);

/**
 * How far `to` is turned from `from`, in whole degrees: positive to the right
 * (clockwise), negative to the left, the short way round.
 */
export const turnDeg = (from: number, to: number): number => {
  const turn = Math.round(((((to - from) % 360) + 540) % 360) - 180);
  return turn === -180 ? 180 : turn;
};

/** Below this the boat is drifting or at anchor, and a "course" means nothing. */
export const MIN_SPEED_KN = 0.5;

/** The course, or null when there is none to speak of: unknown, or the boat is hardly moving. */
export const steadyCourse = (courseDeg: number | null, speedKn: number | null): number | null =>
  courseDeg !== null && speedKn !== null && speedKn >= MIN_SPEED_KN ? courseDeg : null;

export interface PlanComparison {
  /** The point of the planned route nearest to the boat. */
  nearest: LatLon;
  /** Direction of the planned route at that point, degrees true. */
  plannedDeg: number;
  /** Distance between the boat and the planned route. */
  offRouteNm: number;
  /** Which side of the planned route the boat is on, as a compass point ("S", "NNW"...). */
  side: string;
  /** The boat's course relative to the plan (see `turnDeg`), or null while the course is unknown. */
  turnDeg: number | null;
}

/**
 * Finds the planned route's nearest point to the boat and the route's direction there.
 *
 * "The planned route" is the line the visitor sees: straight legs on a Mercator
 * map, each with one compass bearing from end to end. So the nearest point of
 * each leg is found on that map (where a right angle is a right angle), its real
 * distance from the boat is then measured on the globe, and the nearest leg wins.
 *
 * Where the route bends away from the boat, the waypoint is the nearest point of
 * both legs that meet there; the leg ahead is taken, always, so the answer does
 * not flip from one position to the next. A route that goes out and comes back
 * along the same line is beyond this: it cannot tell which way the boat is bound.
 */
export const compareWithPlan = (
  position: LatLon,
  courseDeg: number | null,
  route: LatLon[]
): PlanComparison | null => {
  const boatY = mercatorY(position[0]);

  let best: { nearest: LatLon; distance: number; bearing: number } | null = null;
  for (let leg = 0; leg + 1 < route.length; leg += 1) {
    const from = route[leg];
    const to = route[leg + 1];
    // East-west in radians measured from the boat; the leg runs the short way
    // round from its start, so one that crosses the date line stays in one piece.
    const fromX = toRad(lonDiff(position[1], from[1]));
    const legX = toRad(lonDiff(from[1], to[1]));
    const fromY = mercatorY(from[0]);
    const legY = mercatorY(to[0]) - fromY;
    const length2 = legX ** 2 + legY ** 2;
    if (length2 === 0) {
      // The same point twice in a row is not a leg.
      continue;
    }

    const along = Math.min(1, Math.max(0, (-fromX * legX + (boatY - fromY) * legY) / length2));
    // At either end, the waypoint itself, exactly: two legs that share it then
    // measure the very same distance, and the tie below is a true tie.
    const nearest: LatLon =
      along === 0
        ? from
        : along === 1
          ? to
          : [
              latOfMercatorY(fromY + along * legY),
              position[1] + toDeg(fromX + along * legX),
            ];
    const distance = distanceNm(nearest, position);
    if (best === null || distance <= best.distance) {
      best = { nearest, distance, bearing: (toDeg(Math.atan2(legX, legY)) + 360) % 360 };
    }
  }
  if (best === null) {
    return null;
  }

  // Longitude back into -180..180, for a boat or a leg near the date line.
  const nearest: LatLon = [best.nearest[0], lonDiff(0, best.nearest[1])];
  return {
    nearest,
    plannedDeg: best.bearing,
    offRouteNm: best.distance,
    side: compassPoint(bearingDeg(nearest, position)),
    // From the two bearings as they are shown, in whole degrees, so that the three
    // figures on the page always add up.
    turnDeg:
      courseDeg === null ? null : turnDeg(Math.round(best.bearing), Math.round(courseDeg)),
  };
};

export interface ProjectedPoint {
  pos: LatLon;
  /** Hours after the position it is projected from. */
  hours: number;
}

/**
 * Where the boat would be after each of `hoursAhead` if it kept its present course
 * and speed. Empty when there is no steady course (see `steadyCourse`).
 */
export const projectCourse = (
  position: LatLon,
  courseDeg: number | null,
  speedKn: number | null,
  hoursAhead: number[]
): ProjectedPoint[] => {
  const course = steadyCourse(courseDeg, speedKn);
  if (course === null || speedKn === null) {
    return [];
  }
  return hoursAhead.map((hours) => ({
    pos: destinationPoint(position, course, speedKn * hours),
    hours,
  }));
};
