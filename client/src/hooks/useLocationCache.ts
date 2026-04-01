import { useCallback } from 'react';
import type { Coordinates, GhostColor } from '../types/index.ts';

const CACHE_KEY = 'pac-finder-locations';

// Limit cache age: discard entries older than 2 hours (stale across events)
const MAX_AGE_MS = 2 * 60 * 60 * 1000;

type PartyCache = Record<string, Coordinates>; // memberId -> last known coords
type CacheStore = Record<string, PartyCache>;  // partyCode -> PartyCache

function load(): CacheStore {
  try {
    return JSON.parse(localStorage.getItem(CACHE_KEY) ?? '{}') as CacheStore;
  } catch {
    return {};
  }
}

function save(store: CacheStore): void {
  try {
    localStorage.setItem(CACHE_KEY, JSON.stringify(store));
  } catch {
    // Storage quota exceeded — silently skip
  }
}

export function useLocationCache(partyCode: string | null) {
  const update = useCallback(
    (memberId: string, _name: string, _color: GhostColor, location: Coordinates) => {
      if (!partyCode) return;
      const store = load();
      store[partyCode] ??= {};
      store[partyCode][memberId] = location;
      save(store);
    },
    [partyCode]
  );

  const getCached = useCallback((): Map<string, Coordinates> => {
    if (!partyCode) return new Map();
    const store = load();
    const partyCache = store[partyCode] ?? {};
    const now = Date.now();
    const result = new Map<string, Coordinates>();
    for (const [memberId, coords] of Object.entries(partyCache)) {
      // Only return entries that aren't too old
      if (now - coords.timestamp < MAX_AGE_MS) {
        result.set(memberId, coords);
      }
    }
    return result;
  }, [partyCode]);

  const clear = useCallback(() => {
    if (!partyCode) return;
    const store = load();
    delete store[partyCode];
    save(store);
  }, [partyCode]);

  return { update, getCached, clear };
}
