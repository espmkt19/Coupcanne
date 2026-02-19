import { useRef, useState, useCallback } from 'react';
import { LocationData } from '../types';

function haversine(lat1: number, lon1: number, lat2: number, lon2: number): number {
  const R = 6371000;
  const φ1 = (lat1 * Math.PI) / 180;
  const φ2 = (lat2 * Math.PI) / 180;
  const Δφ = ((lat2 - lat1) * Math.PI) / 180;
  const Δλ = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(Δφ / 2) ** 2 +
    Math.cos(φ1) * Math.cos(φ2) * Math.sin(Δλ / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

export function useGPS() {
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [trackPath, setTrackPath] = useState<LocationData[]>([]);
  const [gpsDistance, setGpsDistance] = useState(0);
  const [accuracy, setAccuracy] = useState<number | null>(null);

  const watchIdRef = useRef<number | null>(null);
  const gpsDistRef = useRef(0);
  const lastLocationRef = useRef<LocationData | null>(null);

  const reset = useCallback(() => {
    setTrackPath([]);
    setGpsDistance(0);
    setAccuracy(null);
    gpsDistRef.current = 0;
    lastLocationRef.current = null;
  }, []);

  const start = useCallback((onError: (msg: string) => void) => {
    if (!navigator.geolocation) {
      onError('GPS non disponible');
      return;
    }

    watchIdRef.current = navigator.geolocation.watchPosition(
      (pos) => {
        const loc: LocationData = {
          latitude: pos.coords.latitude,
          longitude: pos.coords.longitude,
          timestamp: pos.timestamp,
          accuracy: pos.coords.accuracy,
        };
        setCurrentLocation(loc);
        setAccuracy(pos.coords.accuracy);

        // Only add point if moved more than accuracy threshold
        const MIN_DISTANCE = Math.max(2, pos.coords.accuracy * 0.5);
        if (lastLocationRef.current) {
          const d = haversine(
            lastLocationRef.current.latitude,
            lastLocationRef.current.longitude,
            loc.latitude,
            loc.longitude
          );
          if (d > MIN_DISTANCE) {
            gpsDistRef.current += d;
            setGpsDistance(gpsDistRef.current);
            setTrackPath(prev => [...prev, loc]);
            lastLocationRef.current = loc;
          }
        } else {
          lastLocationRef.current = loc;
          setTrackPath([loc]);
        }
      },
      (err) => onError(err.message),
      { enableHighAccuracy: true, maximumAge: 0, timeout: 10000 }
    );
  }, []);

  const stop = useCallback(() => {
    if (watchIdRef.current !== null) {
      navigator.geolocation.clearWatch(watchIdRef.current);
      watchIdRef.current = null;
    }
  }, []);

  return { currentLocation, trackPath, gpsDistance, accuracy, start, stop, reset };
}

export { haversine };
