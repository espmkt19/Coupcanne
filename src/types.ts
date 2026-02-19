export interface LocationData {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number;
}

export interface CustomPoint {
  id: string;
  latitude: number;
  longitude: number;
  label: string;
  timestamp: number;
  color: string;
}

export interface AudioRecording {
  id: string;
  blob: Blob;
  url: string;
  duration: number;
  timestamp: number;
  label: string;
}

export interface SavedRoute {
  id: string;
  name: string;
  date: string;
  path: LocationData[];
  startPoint: LocationData | null;
  endPoint: LocationData | null;
  customPoints: CustomPoint[];
  totalDistance: number;
  linearDistance: number;
  steps: number;
  duration: number;
}
