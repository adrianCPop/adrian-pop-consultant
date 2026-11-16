import { describe, expect, it } from "vitest";
import { bearingDeg, destinationPoint, distanceNm, type LatLon } from "@/lib/geo";
import { compareWithPlan, projectCourse, turnDeg } from "@/lib/voyageCourse";

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
