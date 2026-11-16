/** The boat's course set against the planned route: where it is heading, and how that differs from the plan. */
import { bearingDeg, compassPoint, destinationPoint, distanceNm, type LatLon } from "@/lib/geo";

/**
 * How far `to` is turned from `from`, in whole degrees: positive to the right
 * (clockwise), negative to the left, the short way round.
 */
export const turnDeg = (from: number, to: number): number => {
  const turn = Math.round(((((to - from) % 360) + 540) % 360) - 180);
  return turn === -180 ? 180 : turn;
};

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
 * The nearest point is looked for on a flat sheet centred on the boat (nautical
 * miles east and north of it). Close to the boat that sheet is accurate, and close
 * to the boat is where the nearest point is; the distances reported are then
 * measured properly, on the globe.
 */
export const compareWithPlan = (
  position: LatLon,
  courseDeg: number | null,
  route: LatLon[]
): PlanComparison | null => {
  const eastScale = Math.cos((position[0] * Math.PI) / 180) * 60;
  const flat = ([lat, lon]: LatLon): [number, number] => [
    (((((lon - position[1] + 180) % 360) + 360) % 360) - 180) * eastScale,
    (lat - position[0]) * 60,
  ];

  let best: { leg: number; along: number; distance: number } | null = null;
  for (let leg = 0; leg + 1 < route.length; leg += 1) {
    const [ax, ay] = flat(route[leg]);
    const [bx, by] = flat(route[leg + 1]);
    const length2 = (bx - ax) ** 2 + (by - ay) ** 2;
    if (length2 === 0) {
      // The same point twice in a row is not a leg.
      continue;
    }
    // The boat is at the origin of the sheet.
    const along = Math.min(1, Math.max(0, -(ax * (bx - ax) + ay * (by - ay)) / length2));
    const distance = Math.hypot(ax + along * (bx - ax), ay + along * (by - ay));
    if (best === null || distance < best.distance) {
      best = { leg, along, distance };
    }
  }
  if (best === null) {
    return null;
  }

  const from = route[best.leg];
  const to = route[best.leg + 1];
  const nearest: LatLon = [
    from[0] + best.along * (to[0] - from[0]),
    from[1] + best.along * (to[1] - from[1]),
  ];
  // At the very end of a leg there is nothing ahead to take a bearing on: use the leg itself.
  const plannedDeg = best.along < 1 ? bearingDeg(nearest, to) : bearingDeg(from, to);
  const offRouteNm = distanceNm(nearest, position);

  return {
    nearest,
    plannedDeg,
    offRouteNm,
    side: compassPoint(bearingDeg(nearest, position)),
    // From the two bearings as they are shown, in whole degrees, so that the three
    // figures on the page always add up.
    turnDeg: courseDeg === null ? null : turnDeg(Math.round(plannedDeg), Math.round(courseDeg)),
  };
};

export interface ProjectedPoint {
  pos: LatLon;
  /** Hours after the position it is projected from. */
  hours: number;
}

/** Below this the boat is drifting or at anchor, and a "course" means nothing. */
const MIN_SPEED_KN = 0.5;

/**
 * Where the boat would be after each of `hoursAhead` if it kept its present course
 * and speed. Empty when either is unknown, or when it is hardly moving.
 */
export const projectCourse = (
  position: LatLon,
  courseDeg: number | null,
  speedKn: number | null,
  hoursAhead: number[]
): ProjectedPoint[] => {
  if (courseDeg === null || speedKn === null || speedKn < MIN_SPEED_KN) {
    return [];
  }
  return hoursAhead.map((hours) => ({
    pos: destinationPoint(position, courseDeg, speedKn * hours),
    hours,
  }));
};
