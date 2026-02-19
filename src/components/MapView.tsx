import { useEffect, useRef, useCallback } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { LocationData, CustomPoint } from '../types';
import { haversine } from '../hooks/useGPS';

interface MapViewProps {
  trackPath: LocationData[];
  currentLocation: LocationData | null;
  startPoint: LocationData | null;
  endPoint: LocationData | null;
  customPoints: CustomPoint[];
  onMapClick: (lat: number, lng: number) => void;
}

const redIcon = L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;background:#dc2626;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;"><div style="color:white;font-size:12px;font-weight:bold;">F</div></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const startIcon = L.divIcon({
  className: '',
  html: `<div style="width:28px;height:28px;background:#16a34a;border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.5);display:flex;align-items:center;justify-content:center;"><div style="color:white;font-size:12px;font-weight:bold;">D</div></div>`,
  iconSize: [28, 28],
  iconAnchor: [14, 14],
});

const currentIcon = L.divIcon({
  className: '',
  html: `<div style="width:18px;height:18px;background:#2563eb;border:3px solid white;border-radius:50%;box-shadow:0 0 0 6px rgba(37,99,235,0.25);"></div>`,
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

export function MapView({ trackPath, currentLocation, startPoint, endPoint, customPoints, onMapClick }: MapViewProps) {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const straightLineRef = useRef<L.Polyline | null>(null);
  const startMarkerRef = useRef<L.Marker | null>(null);
  const endMarkerRef = useRef<L.Marker | null>(null);
  const currentMarkerRef = useRef<L.Marker | null>(null);
  const customMarkersRef = useRef<Map<string, L.Marker>>(new Map());

  const handleClick = useCallback((e: L.LeafletMouseEvent) => {
    onMapClick(e.latlng.lat, e.latlng.lng);
  }, [onMapClick]);

  useEffect(() => {
    if (mapContainerRef.current && !mapRef.current) {
      const map = L.map(mapContainerRef.current, { zoomControl: true, attributionControl: false })
        .setView([18.9712, -72.3288], 15);
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 20 }).addTo(map);
      map.on('click', handleClick);
      mapRef.current = map;
    }
    return () => {
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    map.off('click');
    map.on('click', handleClick);
  }, [handleClick]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || trackPath.length < 2) return;
    const latLngs: L.LatLngTuple[] = trackPath.map(p => [p.latitude, p.longitude]);
    if (polylineRef.current) {
      polylineRef.current.setLatLngs(latLngs);
    } else {
      polylineRef.current = L.polyline(latLngs, { color: '#9ca3af', weight: 4, opacity: 0.85, lineCap: 'round', lineJoin: 'round' }).addTo(map);
    }
  }, [trackPath]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !currentLocation) return;
    const latlng: L.LatLngTuple = [currentLocation.latitude, currentLocation.longitude];
    if (currentMarkerRef.current) {
      currentMarkerRef.current.setLatLng(latlng);
    } else {
      currentMarkerRef.current = L.marker(latlng, { icon: currentIcon, zIndexOffset: 1000 }).addTo(map);
    }
    if (trackPath.length <= 1) map.setView(latlng, 18);
  }, [currentLocation, trackPath.length]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !startPoint) return;
    const latlng: L.LatLngTuple = [startPoint.latitude, startPoint.longitude];
    if (startMarkerRef.current) {
      startMarkerRef.current.setLatLng(latlng);
    } else {
      startMarkerRef.current = L.marker(latlng, { icon: startIcon, zIndexOffset: 900 })
        .bindTooltip('Départ', { permanent: true, direction: 'top', offset: [0, -15] })
        .addTo(map);
    }
  }, [startPoint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map || !endPoint) return;
    const latlng: L.LatLngTuple = [endPoint.latitude, endPoint.longitude];
    if (endMarkerRef.current) {
      endMarkerRef.current.setLatLng(latlng);
    } else {
      endMarkerRef.current = L.marker(latlng, { icon: redIcon, zIndexOffset: 900 })
        .bindTooltip('Fin', { permanent: true, direction: 'top', offset: [0, -15] })
        .addTo(map);
    }
    if (startPoint) {
      const dist = haversine(startPoint.latitude, startPoint.longitude, endPoint.latitude, endPoint.longitude);
      const lineLatLngs: L.LatLngTuple[] = [
        [startPoint.latitude, startPoint.longitude],
        [endPoint.latitude, endPoint.longitude],
      ];
      if (straightLineRef.current) {
        straightLineRef.current.setLatLngs(lineLatLngs);
      } else {
        straightLineRef.current = L.polyline(lineLatLngs, { color: '#f97316', weight: 3, opacity: 0.9, dashArray: '8 6' }).addTo(map);
      }
      straightLineRef.current.bindTooltip(`📏 ${dist.toFixed(0)} m`, { permanent: true, direction: 'center' }).openTooltip();
      map.fitBounds(L.latLngBounds(lineLatLngs), { padding: [60, 60] });
    }
  }, [endPoint, startPoint]);

  useEffect(() => {
    const map = mapRef.current;
    if (!map) return;
    customMarkersRef.current.forEach((marker, id) => {
      if (!customPoints.find(p => p.id === id)) {
        marker.remove();
        customMarkersRef.current.delete(id);
      }
    });
    customPoints.forEach(point => {
      if (!customMarkersRef.current.has(point.id)) {
        const icon = L.divIcon({
          className: '',
          html: `<div style="width:24px;height:24px;background:${point.color};border:3px solid white;border-radius:50%;box-shadow:0 2px 8px rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;"><div style="color:white;font-size:10px;font-weight:bold;">✦</div></div>`,
          iconSize: [24, 24],
          iconAnchor: [12, 12],
        });
        const marker = L.marker([point.latitude, point.longitude], { icon })
          .bindPopup(`<b>${point.label}</b><br><small>${new Date(point.timestamp).toLocaleTimeString()}</small>`)
          .addTo(map);
        customMarkersRef.current.set(point.id, marker);
      }
    });
  }, [customPoints]);

  return <div ref={mapContainerRef} className="w-full rounded-xl" style={{ height: 340 }} />;
}
