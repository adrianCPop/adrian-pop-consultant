import { describe, expect, it } from "vitest";
import { bearingDeg, destinationPoint, distanceNm, type LatLon } from "@/lib/geo";
import { compareWithPlan, projectCourse, steadyCourse, turnDeg } from "@/lib/voyageCourse";

describe("destinationPoint", () => {
  it("moves one degree of longitude for 60 nm east along the equator", () => {
    const [lat, lon] = destinationPoint([0, 0], 90, 60);
    expect(lat).toBeCloseTo(0, 3);
    expect(lon).toBeCloseTo(1, 2);
  });

  it("moves one degree of latitude for 60 nm north", () => {
    const [lat, lon] = destinationPoint([0, 0], 0, 60);
    expect(lat).toBeCloseTo(1, 2);
    expect(lon).toBeCloseTo(0, 3);
  });

  it("agrees with the distance and bearing helpers", () => {
    const from: LatLon = [28.47, -16.24];
    const to = destinationPoint(from, 225, 300);
    expect(distanceNm(from, to)).toBeCloseTo(300, 1);
    expect(bearingDeg(from, to)).toBeCloseTo(225, 1);
  });

  it("keeps longitude within -180 to 180 across the date line", () => {
    const [, lon] = destinationPoint([10, 179.5], 90, 120);
    expect(lon).toBeLessThan(-178);
    expect(lon).toBeGreaterThan(-180);
  });
});

describe("turnDeg", () => {
  it("is positive for a turn to the right and negative to the left", () => {
    expect(turnDeg(262, 256)).toBe(-6);
    expect(turnDeg(256, 262)).toBe(6);
  });

  it("takes the short way round through north", () => {
    expect(turnDeg(350, 10)).toBe(20);
    expect(turnDeg(10, 350)).toBe(-20);
  });

  it("gives 180 for opposite directions", () => {
    expect(Math.abs(turnDeg(90, 270))).toBe(180);
  });
});

describe("compareWithPlan", () => {
  const westward: LatLon[] = [
    [20, -30],
    [20, -40],
  ];

  it("returns null without a route to compare with", () => {
    expect(compareWithPlan([20, -35], 270, [])).toBeNull();
    expect(compareWithPlan([20, -35], 270, [[20, -30]])).toBeNull();
  });

  it("measures how far the boat is from the planned line, and on which side", () => {
    const south = compareWithPlan([19.5, -35], 270, westward);
    expect(south?.offRouteNm).toBeGreaterThan(28);
    expect(south?.offRouteNm).toBeLessThan(33);
    expect(south?.side).toBe("S");

    const north = compareWithPlan([20.5, -35], 270, westward);
    expect(north?.side).toBe("N");
  });

  it("gives the direction of the planned line where the boat is", () => {
    const result = compareWithPlan([19.5, -35], 270, westward);
    expect(result?.plannedDeg).toBeGreaterThan(267);
    expect(result?.plannedDeg).toBeLessThan(273);
  });

  it("says how far the course is turned from the plan, left negative, right positive", () => {
    expect(compareWithPlan([19.5, -35], 250, westward)?.turnDeg).toBeLessThan(-17);
    expect(compareWithPlan([19.5, -35], 250, westward)?.turnDeg).toBeGreaterThan(-23);
    expect(compareWithPlan([19.5, -35], 290, westward)?.turnDeg).toBeGreaterThan(17);
    expect(compareWithPlan([19.5, -35], 290, westward)?.turnDeg).toBeLessThan(23);
  });

  it("agrees with the two bearings as shown in whole degrees", () => {
    for (const course of [255.6, 260.4, 265.5, 274.49]) {
      const result = compareWithPlan([19.5, -35], course, westward);
      expect(result?.turnDeg).toBe(turnDeg(Math.round(result!.plannedDeg), Math.round(course)));
    }
  });

  it("has no turn when the course is not known yet", () => {
    const result = compareWithPlan([19.5, -35], null, westward);
    expect(result?.turnDeg).toBeNull();
    expect(result?.plannedDeg).toBeGreaterThan(267);
  });

  it("picks the leg the boat is on when the route bends", () => {
    const bent: LatLon[] = [
      [28, -16],
      [17, -25],
      [14, -61],
    ];
    // Well along the second leg, which runs a little south of west.
    const second = compareWithPlan([15.5, -40], 260, bent);
    expect(second?.plannedDeg).toBeGreaterThan(255);
    expect(second?.plannedDeg).toBeLessThan(275);
    // Early on the first leg, which runs south-west.
    const first = compareWithPlan([26, -17.6], 220, bent);
    expect(first?.plannedDeg).toBeGreaterThan(205);
    expect(first?.plannedDeg).toBeLessThan(235);
  });

  it("uses the last leg's direction once the boat is past the end of the route", () => {
    const result = compareWithPlan([20, -45], 270, westward);
    expect(result?.plannedDeg).toBeGreaterThan(265);
    expect(result?.plannedDeg).toBeLessThan(275);
    expect(result?.offRouteNm).toBeGreaterThan(270);
    expect(result?.offRouteNm).toBeLessThan(295);
  });

  it("uses the first leg's direction before the start of the route", () => {
    const result = compareWithPlan([20, -28], 270, westward);
    expect(result?.plannedDeg).toBeGreaterThan(265);
    expect(result?.plannedDeg).toBeLessThan(275);
  });

  it("ignores a route point repeated twice in a row", () => {
    const repeated: LatLon[] = [
      [20, -30],
      [20, -30],
      [20, -40],
    ];
    const result = compareWithPlan([19.5, -35], 270, repeated);
    expect(result?.plannedDeg).toBeGreaterThan(267);
    expect(result?.plannedDeg).toBeLessThan(273);
    expect(Number.isFinite(result?.offRouteNm)).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// The planned route is drawn as straight lines on a Mercator map, so that is the
// line the figures have to describe. These helpers work it out independently of
// the code under test, by brute force.

const mercatorY = (lat: number) => Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
const latOf = (y: number) => (2 * Math.atan(Math.exp(y)) - Math.PI / 2) * (180 / Math.PI);

/** Points along the leg as the map draws it. */
const alongDrawnLeg = (from: LatLon, to: LatLon, steps: number): LatLon[] =>
  Array.from({ length: steps + 1 }, (_, index) => {
    const part = index / steps;
    return [
      latOf(mercatorY(from[0]) + part * (mercatorY(to[0]) - mercatorY(from[0]))),
      from[1] + part * (to[1] - from[1]),
    ] as LatLon;
  });

const nearestByBruteForce = (position: LatLon, from: LatLon, to: LatLon) =>
  alongDrawnLeg(from, to, 20000).reduce(
    (best, point) => {
      const distance = distanceNm(position, point);
      return distance < best.distance ? { point, distance } : best;
    },
    { point: from, distance: Infinity }
  );

/** The constant compass bearing of a leg as the map draws it. */
const drawnBearing = (from: LatLon, to: LatLon) =>
  ((Math.atan2(((to[1] - from[1]) * Math.PI) / 180, mercatorY(to[0]) - mercatorY(from[0])) * 180) /
    Math.PI +
    360) %
  360;

describe("compareWithPlan, against the line as the map draws it", () => {
  const diagonal: LatLon[] = [
    [10, -20],
    [20, -30],
  ];

  it("finds the nearest point of a diagonal leg, on either side of it", () => {
    for (const position of [
      [14.2, -25.9],
      [15.9, -24.3],
      [18.5, -27.4],
    ] as LatLon[]) {
      const expected = nearestByBruteForce(position, diagonal[0], diagonal[1]);
      const result = compareWithPlan(position, 315, diagonal);
      expect(distanceNm(result!.nearest, expected.point)).toBeLessThan(0.5);
      expect(Math.abs(result!.offRouteNm - expected.distance)).toBeLessThan(0.3);
    }
  });

  it("reports the leg's bearing as drawn, the same all along it", () => {
    const expected = drawnBearing(diagonal[0], diagonal[1]);
    for (const position of [
      [11, -21.2],
      [15.9, -24.3],
      [19, -29.1],
    ] as LatLon[]) {
      expect(compareWithPlan(position, 315, diagonal)!.plannedDeg).toBeCloseTo(expected, 1);
    }
  });

  it("reads 'on the route, on course' for a boat on a long two-point route and steering along it", () => {
    // What the server falls back to when no route is given: one leg, port to port.
    const direct: LatLon[] = [
      [28.47, -16.24],
      [14.08, -60.95],
    ];
    const bearing = drawnBearing(direct[0], direct[1]);
    for (const position of alongDrawnLeg(direct[0], direct[1], 8).slice(1, -1)) {
      const result = compareWithPlan(position, bearing, direct);
      expect(result!.offRouteNm).toBeLessThan(0.5);
      expect(Math.abs(result!.turnDeg!)).toBeLessThanOrEqual(1);
    }
  });

  const bend: LatLon[] = [
    [28, -16],
    [22, -23],
    [16, -25],
  ];
  const legBehind = drawnBearing(bend[0], bend[1]);
  const legAhead = drawnBearing(bend[1], bend[2]);

  it("takes the leg ahead when the boat is exactly at a waypoint", () => {
    expect(compareWithPlan(bend[1], 200, bend)!.plannedDeg).toBeCloseTo(legAhead, 1);
  });

  it("does not flicker between two legs when the boat is outside a bend", () => {
    // West of the waypoint, on the outside of the turn: the waypoint itself is the
    // nearest point of both legs. Positions half a mile apart must agree.
    const readings = [0, 0.008, 0.016, 0.024, 0.032].map(
      (step) => compareWithPlan([22 - step, -23.3], 220, bend)!.plannedDeg
    );
    for (const reading of readings) {
      expect(reading).toBeCloseTo(legAhead, 1);
    }
    expect(legAhead).not.toBeCloseTo(legBehind, 0);
  });

  it("follows a leg across the date line", () => {
    const result = compareWithPlan([9.5, 180], 90, [
      [10, 179],
      [10, -179],
    ]);
    expect(result!.plannedDeg).toBeCloseTo(90, 0);
    expect(result!.offRouteNm).toBeGreaterThan(28);
    expect(result!.offRouteNm).toBeLessThan(32);
    expect(Math.abs(Math.abs(result!.nearest[1]) - 180)).toBeLessThan(0.1);
  });
});

describe("steadyCourse", () => {
  it("is the course when the boat is making way", () => {
    expect(steadyCourse(256, 6.4)).toBe(256);
  });

  it("is nothing when the boat is drifting, or the course or speed is unknown", () => {
    expect(steadyCourse(40, 0.3)).toBeNull();
    expect(steadyCourse(null, 6)).toBeNull();
    expect(steadyCourse(256, null)).toBeNull();
  });
});

describe("projectCourse", () => {
  it("gives one point per time ahead, at the current speed and course", () => {
    const from: LatLon = [20, -30];
    const points = projectCourse(from, 270, 5, [24, 48]);
    expect(points).toHaveLength(2);
    expect(distanceNm(from, points[0].pos)).toBeCloseTo(120, 0);
    expect(distanceNm(from, points[1].pos)).toBeCloseTo(240, 0);
    expect(bearingDeg(from, points[0].pos)).toBeCloseTo(270, 0);
    expect(points.map((point) => point.hours)).toEqual([24, 48]);
  });

  it("projects nothing when the boat is not really moving or the course is unknown", () => {
    expect(projectCourse([20, -30], 270, 0.2, [24])).toEqual([]);
    expect(projectCourse([20, -30], null, 5, [24])).toEqual([]);
    expect(projectCourse([20, -30], 270, null, [24])).toEqual([]);
  });
});
