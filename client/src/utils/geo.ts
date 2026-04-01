import type { Coordinates, ProximityStatus } from '../types/index.ts';

const R = 6371000; // Earth radius in metres
const DEG = Math.PI / 180;

/** Haversine distance between two coordinates, returns metres */
export function haversineDistance(a: Coordinates, b: Coordinates): number {
  const dLat = (b.lat - a.lat) * DEG;
  const dLng = (b.lng - a.lng) * DEG;
  const sinDLat = Math.sin(dLat / 2);
  const sinDLng = Math.sin(dLng / 2);
  const h =
    sinDLat * sinDLat +
    Math.cos(a.lat * DEG) * Math.cos(b.lat * DEG) * sinDLng * sinDLng;
  return 2 * R * Math.asin(Math.sqrt(h));
}

/**
 * Initial bearing from point A to point B.
 * Returns degrees 0-360 where 0 = North, 90 = East.
 */
export function bearing(from: Coordinates, to: Coordinates): number {
  const f1 = from.lat * DEG;
  const f2 = to.lat * DEG;
  const dL = (to.lng - from.lng) * DEG;
  const y = Math.sin(dL) * Math.cos(f2);
  const x =
    Math.cos(f1) * Math.sin(f2) -
    Math.sin(f1) * Math.cos(f2) * Math.cos(dL);
  return (Math.atan2(y, x) / DEG + 360) % 360;
}

/** 1 pellet = 10 metres */
export function distanceToPellets(metres: number): number {
  return Math.round(metres / 10);
}

export function getProximityStatus(metres: number): ProximityStatus {
  if (metres <= 25) return 'HOT';
  if (metres <= 75) return 'WARM';
  if (metres <= 200) return 'COLD';
  return 'LOST';
}

/** Stale if no update in 10 seconds */
export function isStaleLocation(coords: Coordinates): boolean {
  return Date.now() - coords.timestamp > 10_000;
}
