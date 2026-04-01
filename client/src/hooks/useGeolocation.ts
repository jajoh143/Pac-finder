import { useState, useEffect, useRef } from 'react';
import type { Coordinates } from '../types/index.ts';

interface GeolocationState {
  coords: Coordinates | null;
  error: string | null;
  isWatching: boolean;
}

export function useGeolocation(active: boolean) {
  const [state, setState] = useState<GeolocationState>({
    coords: null,
    error: null,
    isWatching: false,
  });
  const watchIdRef = useRef<number | null>(null);

  useEffect(() => {
    if (!active) return;

    if (!navigator.geolocation) {
      setState((s) => ({ ...s, error: 'Geolocation not supported on this device.' }));
      return;
    }

    setState((s) => ({ ...s, isWatching: true }));

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        setState({
          isWatching: true,
          error: null,
          coords: {
            lat: pos.coords.latitude,
            lng: pos.coords.longitude,
            accuracy: pos.coords.accuracy,
            heading: pos.coords.heading,
            timestamp: pos.timestamp,
          },
        });
      },
      (err) => {
        setState((s) => ({
          ...s,
          error:
            err.code === 1
              ? 'Location permission denied. Enable it in your browser settings.'
              : `Location error: ${err.message}`,
        }));
      },
      {
        enableHighAccuracy: true,
        maximumAge: 5000,
        timeout: 10000,
      }
    );

    return () => {
      if (watchIdRef.current !== null) {
        navigator.geolocation.clearWatch(watchIdRef.current);
        watchIdRef.current = null;
      }
      setState((s) => ({ ...s, isWatching: false }));
    };
  }, [active]);

  return state;
}
