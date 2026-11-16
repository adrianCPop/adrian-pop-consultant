/** [latitude, longitude] in decimal degrees. */
export type LatLon = [number, number];

const EARTH_RADIUS_NM = 3440.065;

const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Great-circle distance in nautical miles. */
export const distanceNm = (a: LatLon, b: LatLon): number => {
  const dLat = toRad(b[0] - a[0]);
  const dLon = toRad(b[1] - a[1]);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.sin(dLon / 2) ** 2;

  return 2 * EARTH_RADIUS_NM * Math.asin(Math.sqrt(h));
};

/** Initial bearing from a to b, in degrees true (0-360). */
export const bearingDeg = (a: LatLon, b: LatLon): number => {
  const dLon = toRad(b[1] - a[1]);
  const y = Math.sin(dLon) * Math.cos(toRad(b[0]));
  const x =
    Math.cos(toRad(a[0])) * Math.sin(toRad(b[0])) -
    Math.sin(toRad(a[0])) * Math.cos(toRad(b[0])) * Math.cos(dLon);

  return (toDeg(Math.atan2(y, x)) + 360) % 360;
};

export const pathLengthNm = (points: LatLon[]): number =>
  points.reduce(
    (total, point, index) => (index === 0 ? 0 : total + distanceNm(points[index - 1], point)),
    0
  );

const COMPASS_POINTS = [
  "N", "NNE", "NE", "ENE", "E", "ESE", "SE", "SSE",
  "S", "SSW", "SW", "WSW", "W", "WNW", "NW", "NNW",
];

export const compassPoint = (deg: number): string =>
  COMPASS_POINTS[Math.round((((deg % 360) + 360) % 360) / 22.5) % 16];

const formatAxis = (value: number, degreeDigits: number, positive: string, negative: string) => {
  const abs = Math.abs(value);
  let degrees = Math.floor(abs);
  let minutes = Math.round((abs - degrees) * 60);

  if (minutes === 60) {
    degrees += 1;
    minutes = 0;
  }

  return `${String(degrees).padStart(degreeDigits, "0")}°${String(minutes).padStart(2, "0")}′${
    value >= 0 ? positive : negative
  }`;
};

/** Formats a position the way a chart or log would: 18°30′N 037°27′W. */
export const formatCoord = ([lat, lon]: LatLon): string =>
  `${formatAxis(lat, 2, "N", "S")} ${formatAxis(lon, 3, "E", "W")}`;
