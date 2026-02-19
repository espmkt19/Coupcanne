import { useState, useEffect, useRef } from 'react';
import { Play, Square, RotateCcw, AlertCircle, CheckCircle2, MapPin, Navigation } from 'lucide-react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Corrigir ícones padrão do Leaflet
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/images/marker-shadow.png',
});

interface AccelerationData {
  x: number;
  y: number;
  z: number;
}

interface StepData {
  timestamp: number;
  magnitude: number;
}

interface LocationData {
  latitude: number;
  longitude: number;
  timestamp: number;
  accuracy: number;
}

export function App() {
  const [isTracking, setIsTracking] = useState(false);
  const [distance, setDistance] = useState(0);
  const [steps, setSteps] = useState(0);
  const [speed, setSpeed] = useState(0);
  const [hasPermission, setHasPermission] = useState<boolean | null>(null);
  const [hasLocationPermission, setHasLocationPermission] = useState<boolean | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [currentLocation, setCurrentLocation] = useState<LocationData | null>(null);
  const [trackPath, setTrackPath] = useState<LocationData[]>([]);

  const accelerationRef = useRef<AccelerationData>({ x: 0, y: 0, z: 0 });
  const stepsRef = useRef<StepData[]>([]);
  const distanceRef = useRef(0);
  const lastUpdateRef = useRef(Date.now());
  const velocityRef = useRef<AccelerationData>({ x: 0, y: 0, z: 0 });
  const mapRef = useRef<L.Map | null>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const markerRef = useRef<L.Marker | null>(null);

  // Constantes calibradas para máxima precisão
  const STEP_THRESHOLD = 15; // Aceleração mínima para detectar um passo
  const STEP_LOCKOUT_TIME = 250; // Tempo mínimo entre passos (ms)
  const AVERAGE_STEP_LENGTH = 0.75; // metros (pode ser ajustado)
  const FILTER_COEFFICIENT = 0.7; // Coeficiente de filtro de movimento (0.8 = 80% do novo valor)

  const requestPermissions = async () => {
    try {
      // Solicitar permissão para acelerômetro
      if (typeof DeviceMotionEvent !== 'undefined') {
        if (typeof (DeviceMotionEvent as any).requestPermission === 'function') {
          // iOS 13+
          const permission = await (DeviceMotionEvent as any).requestPermission();
          if (permission === 'granted') {
            setHasPermission(true);
          } else {
            setHasPermission(false);
            setError('Permissão de acesso ao acelerômetro negada.');
            return;
          }
        } else {
          // Android e browsers que suportam DeviceMotionEvent sem permissão
          setHasPermission(true);
        }
      } else {
        setHasPermission(false);
        setError('Seu dispositivo não suporta acelerômetro.');
        return;
      }

      // Solicitar permissão para localização
      if (navigator.permissions && navigator.permissions.query) {
        const locationPermission = await navigator.permissions.query({ name: 'geolocation' as PermissionName });
        setHasLocationPermission(locationPermission.state === 'granted');
        
        locationPermission.addEventListener('change', () => {
          setHasLocationPermission(locationPermission.state === 'granted');
        });
      }
    } catch (err) {
      setHasPermission(false);
      setError('Erro ao solicitar permissões.');
      console.error(err);
    }
  };

  const handleDeviceMotion = (event: DeviceMotionEvent) => {
    if (!isTracking || !event.acceleration) return;

    const now = Date.now();
    const timeDelta = (now - lastUpdateRef.current) / 1000; // em segundos
    lastUpdateRef.current = now;

    // Aplicar filtro exponencial móvel para reduzir ruído
    const rawAccel = {
      x: event.acceleration.x || 0,
      y: event.acceleration.y || 0,
      z: event.acceleration.z || 0,
    };

    // Filtro de baixa passagem
    accelerationRef.current = {
      x: FILTER_COEFFICIENT * rawAccel.x + (1 - FILTER_COEFFICIENT) * accelerationRef.current.x,
      y: FILTER_COEFFICIENT * rawAccel.y + (1 - FILTER_COEFFICIENT) * accelerationRef.current.y,
      z: FILTER_COEFFICIENT * rawAccel.z + (1 - FILTER_COEFFICIENT) * accelerationRef.current.z,
    };

    // Calcular magnitude da aceleração (norma L2)
    const magnitude = Math.sqrt(
      Math.pow(accelerationRef.current.x, 2) +
      Math.pow(accelerationRef.current.y, 2) +
      Math.pow(accelerationRef.current.z, 2)
    );

    // Integração numérica: v = v0 + a*dt
    if (timeDelta > 0 && timeDelta < 1) {
      velocityRef.current.x += accelerationRef.current.x * timeDelta;
      velocityRef.current.y += accelerationRef.current.y * timeDelta;
      velocityRef.current.z += accelerationRef.current.z * timeDelta;

      // Aplicar amortecimento para evitar deriva
      const damping = 0.95;
      velocityRef.current.x *= damping;
      velocityRef.current.y *= damping;
      velocityRef.current.z *= damping;
    }

    // Detectar passo por aceleração vertical
    detectStep(magnitude, now);
  };

  const detectStep = (magnitude: number, timestamp: number) => {
    const recentSteps = stepsRef.current.filter(
      step => timestamp - step.timestamp < STEP_LOCKOUT_TIME
    );

    // Verificar se há pico de aceleração recente
    const hasRecentPeak = recentSteps.some(step => step.magnitude > STEP_THRESHOLD * 0.8);

    if (magnitude > STEP_THRESHOLD && !hasRecentPeak) {
      // Registrar novo passo
      stepsRef.current.push({ timestamp, magnitude });

      // Limpar passos antigos
      stepsRef.current = stepsRef.current.filter(
        step => timestamp - step.timestamp < STEP_LOCKOUT_TIME * 3
      );

      // Incrementar contador de passos
      const newSteps = steps + 1;
      setSteps(newSteps);

      // Calcular distância
      const newDistance = newSteps * AVERAGE_STEP_LENGTH;
      distanceRef.current = newDistance;
      setDistance(newDistance);

      // Calcular velocidade (metros por segundo)
      if (stepsRef.current.length > 1) {
        const lastTwo = stepsRef.current.slice(-2);
        const timeBetweenSteps = (lastTwo[1].timestamp - lastTwo[0].timestamp) / 1000;
        const currentSpeed = timeBetweenSteps > 0 ? AVERAGE_STEP_LENGTH / timeBetweenSteps : 0;
        setSpeed(currentSpeed);
      }
    }
  };

  const startTracking = async () => {
    if (hasPermission === null || hasLocationPermission === null) {
      await requestPermissions();
      return;
    }

    if (!hasPermission) {
      setError('Permissão necessária para acessar o acelerômetro.');
      return;
    }

    setIsTracking(true);
    setError(null);
    stepsRef.current = [];
    distanceRef.current = 0;
    setSteps(0);
    setDistance(0);
    setSpeed(0);
    lastUpdateRef.current = Date.now();

    window.addEventListener('devicemotion', handleDeviceMotion);

    // Iniciar rastreamento de localização
    const watchId = navigator.geolocation.watchPosition(
      (position) => {
        const location: LocationData = {
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          timestamp: position.timestamp,
          accuracy: position.coords.accuracy
        };
        setCurrentLocation(location);
        
        if (isTracking) {
          setTrackPath(prev => {
            // Calcular distância entre pontos consecutivos
            if (prev.length > 0) {
              const lastPoint = prev[prev.length - 1];
              const distanceDelta = calculateDistance(
                lastPoint.latitude, lastPoint.longitude,
                location.latitude, location.longitude
              );
              distanceRef.current += distanceDelta;
              setDistance(distanceRef.current);
            }
            return [...prev, location];
          });
        }
      },
      (error) => {
        setError('Erro ao obter localização: ' + error.message);
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 5000
      }
    );

    return () => {
      navigator.geolocation.clearWatch(watchId);
    };
  };

  const stopTracking = () => {
    setIsTracking(false);
    window.removeEventListener('devicemotion', handleDeviceMotion);
    navigator.geolocation.clearWatch(0);
  };

  const resetData = () => {
    stopTracking();
    setDistance(0);
    setSteps(0);
    setSpeed(0);
    setTrackPath([]);
    stepsRef.current = [];
    distanceRef.current = 0;
    
    if (polylineRef.current) {
      polylineRef.current.remove();
      polylineRef.current = null;
    }
  };

  const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
    const R = 6371e3; // Raio da Terra em metros
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lon2 - lon1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
              Math.cos(φ1) * Math.cos(φ2) *
              Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c; // Distância em metros
  };

  useEffect(() => {
    // Inicializar mapa
    if (!mapRef.current) {
      const map = L.map('map').setView([-15.7801, -47.9292], 15); // Brasília como padrão
      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors'
      }).addTo(map);
      mapRef.current = map;
    }

    // Atualizar mapa com nova localização
    if (mapRef.current && currentLocation) {
      const { latitude, longitude } = currentLocation;

      // Atualizar marcador de posição atual
      if (markerRef.current) {
        markerRef.current.setLatLng([latitude, longitude]);
      } else {
        markerRef.current = L.marker([latitude, longitude], {
          icon: L.divIcon({
            className: 'custom-marker',
            html: '<div class="w-6 h-6 bg-green-600 rounded-full border-2 border-white shadow-lg flex items-center justify-center"><div class="w-2 h-2 bg-white rounded-full"></div></div>',
            iconSize: [30, 30],
            iconAnchor: [15, 15]
          })
        }).addTo(mapRef.current);
      }

      // Atualizar linha de trajetória
      if (trackPath.length > 1) {
        const latLngs = trackPath.map(point => [point.latitude, point.longitude] as L.LatLngTuple);
        
        if (polylineRef.current) {
          polylineRef.current.setLatLngs(latLngs);
        } else {
          polylineRef.current = L.polyline(latLngs, {
            color: '#10b981',
            weight: 4,
            opacity: 0.7,
            dashArray: '10, 10',
            lineCap: 'round'
          }).addTo(mapRef.current);
        }

        // Ajustar mapa para mostrar toda a trajetória
        mapRef.current.fitBounds(L.latLngBounds(latLngs), { padding: [50, 50] });
      } else {
        mapRef.current.setView([latitude, longitude], 18);
      }
    }
  }, [currentLocation, trackPath]);

  useEffect(() => {
    return () => {
      if (isTracking) {
        window.removeEventListener('devicemotion', handleDeviceMotion);
      }
    };
  }, [isTracking]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-green-50 via-white to-emerald-100 p-4 flex items-center justify-center">
      <div className="w-full max-w-4xl">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="inline-flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-green-500 to-emerald-600 shadow-lg mb-4">
            <Navigation className="h-8 w-8 text-white" />
          </div>
          <h1 className="text-3xl font-bold text-gray-900">Rastreamento de Colheita</h1>
          <p className="text-gray-500 mt-2">Rastreie sua distância com GPS e acelerômetro</p>
        </div>

        {/* Status da Permissão */}
        {hasPermission === false || hasLocationPermission === false && (
          <div className="mb-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-yellow-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-yellow-800">Permissão Necessária</p>
              <p className="text-sm text-yellow-700 mt-1">
                Clique no botão abaixo para permitir acesso ao acelerômetro e localização.
              </p>
            </div>
          </div>
        )}

        {/* Erro */}
        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg flex items-start gap-3">
            <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-red-800">Erro</p>
              <p className="text-sm text-red-700 mt-1">{error}</p>
            </div>
          </div>
        )}

        {/* Success Status */}
        {hasPermission === true && hasLocationPermission === true && (
          <div className="mb-6 p-4 bg-green-50 border border-green-200 rounded-lg flex items-center gap-3">
            <CheckCircle2 className="h-5 w-5 text-green-600 flex-shrink-0" />
            <p className="text-sm font-medium text-green-800">
              Acelerômetro e GPS conectados e prontos
            </p>
          </div>
        )}

        {/* Métricas */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          {/* Distância */}
          <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100">
            <div className="text-sm font-medium text-gray-600 mb-2">Distância</div>
            <div className="text-3xl font-bold text-green-600">
              {distance.toFixed(2)}
            </div>
            <div className="text-xs text-gray-500 mt-1">metros</div>
          </div>

          {/* Passos */}
          <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100">
            <div className="text-sm font-medium text-gray-600 mb-2">Passos</div>
            <div className="text-3xl font-bold text-emerald-600">{steps}</div>
            <div className="text-xs text-gray-500 mt-1">passos</div>
          </div>

          {/* Velocidade */}
          <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100">
            <div className="text-sm font-medium text-gray-600 mb-2">Velocidade</div>
            <div className="text-3xl font-bold text-blue-600">
              {(speed * 3.6).toFixed(1)}
            </div>
            <div className="text-xs text-gray-500 mt-1">km/h</div>
          </div>
        </div>

        {/* Mapa */}
        <div className="bg-white rounded-lg p-6 shadow-md border border-gray-100 mb-8">
          <div className="flex items-center gap-2 mb-4">
            <MapPin className="h-5 w-5 text-green-600" />
            <div className="text-sm font-medium text-gray-600">Mapa de Rastreamento</div>
          </div>
          <div id="map" className="w-full h-64 rounded-lg border border-gray-200" />
        </div>

        {/* Botões de Controle */}
        <div className="flex gap-3">
          {!isTracking ? (
            <button
              onClick={startTracking}
              disabled={hasPermission === false || hasLocationPermission === false}
              className="flex-1 bg-gradient-to-r from-green-500 to-emerald-600 hover:from-green-600 hover:to-emerald-700 disabled:from-gray-300 disabled:to-gray-400 disabled:cursor-not-allowed text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg"
            >
              <Play className="h-5 w-5" />
              Iniciar Rastreamento
            </button>
          ) : (
            <button
              onClick={stopTracking}
              className="flex-1 bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700 text-white font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all shadow-lg"
            >
              <Square className="h-5 w-5" />
              Parar
            </button>
          )}

          <button
            onClick={resetData}
            className="flex-1 bg-white border-2 border-gray-300 hover:border-gray-400 text-gray-700 font-semibold py-3 px-6 rounded-lg flex items-center justify-center gap-2 transition-all"
          >
            <RotateCcw className="h-5 w-5" />
            Resetar
          </button>
        </div>

        {/* Informações */}
        <div className="mt-8 p-4 bg-gray-50 rounded-lg">
          <p className="text-xs text-gray-600 leading-relaxed">
            <strong>Como usar:</strong> Coloque seu celular no bolso e comece a trabalhar. O aplicativo usa o acelerômetro e o GPS para detectar passos e calcular a distância andada com alta precisão, ideal para movimento de ida e volta no campo.
          </p>
          <p className="text-xs text-gray-500 mt-3">
            <strong>Dica:</strong> Para melhor precisão, mantenha o celular com sinal GPS forte e permita acesso à localização com precisão máxima.
          </p>
        </div>
      </div>
    </div>
  );
}
