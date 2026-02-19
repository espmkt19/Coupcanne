import { useState, useEffect, useRef, useCallback } from 'react';
import {
  Play, Square, RotateCcw, Mic, MicOff, Trash2,
  MapPin, Navigation, Volume2, ChevronDown, ChevronUp,
  Download, Save, Clock, Footprints, Ruler, Zap
} from 'lucide-react';
import { MapView } from './components/MapView';
import { useStepCounter } from './hooks/useStepCounter';
import { useGPS, haversine } from './hooks/useGPS';
import { useAudioRecorder } from './hooks/useAudioRecorder';
import { translations, Language } from './i18n';
import { CustomPoint, LocationData, SavedRoute } from './types';

const POINT_COLORS = ['#7c3aed', '#0891b2', '#db2777', '#ea580c', '#ca8a04'];

function formatDuration(seconds: number) {
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}m ${s.toString().padStart(2, '0')}s`;
}

function formatTime(ts: number) {
  return new Date(ts).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function App() {
  const [lang, setLang] = useState<Language>('fr');
  const t = translations[lang];

  const [isTracking, setIsTracking] = useState(false);
  const [hasStarted, setHasStarted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [startPoint, setStartPoint] = useState<LocationData | null>(null);
  const [endPoint, setEndPoint] = useState<LocationData | null>(null);
  const [customPoints, setCustomPoints] = useState<CustomPoint[]>([]);
  const [savedRoutes, setSavedRoutes] = useState<SavedRoute[]>([]);

  const [duration, setDuration] = useState(0);
  const [linearDistance, setLinearDistance] = useState(0);

  const [showAudio, setShowAudio] = useState(false);
  const [showHistory, setShowHistory] = useState(false);
  const [recordingLabel, setRecordingLabel] = useState('');
  const [colorIdx, setColorIdx] = useState(0);
  const [pointCounter, setPointCounter] = useState(1);
  const [activeTab, setActiveTab] = useState<'map' | 'stats' | 'audio'>('map');

  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const startTimeRef = useRef<number>(0);
  const motionListenerRef = useRef(false);

  const { steps, speed, stepDistance, processMotion, reset: resetSteps } = useStepCounter();
  const { currentLocation, trackPath, gpsDistance, accuracy, start: startGPS, stop: stopGPS, reset: resetGPS } = useGPS();
  const { recordings, isRecording, recordingTime, startRecording, stopRecording, deleteRecording } = useAudioRecorder();

  // Combined distance: prefer GPS if available, fallback to step counter
  const totalDistance = gpsDistance > 0 ? gpsDistance : stepDistance;

  // Update linear distance when endPoint changes
  useEffect(() => {
    if (startPoint && endPoint) {
      const d = haversine(startPoint.latitude, startPoint.longitude, endPoint.latitude, endPoint.longitude);
      setLinearDistance(d);
    }
  }, [startPoint, endPoint]);

  // Timer
  useEffect(() => {
    if (isTracking) {
      timerRef.current = setInterval(() => {
        setDuration(Math.floor((Date.now() - startTimeRef.current) / 1000));
      }, 1000);
    } else {
      if (timerRef.current) clearInterval(timerRef.current);
    }
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, [isTracking]);

  const handleMotion = useCallback((e: Event) => {
    processMotion(e as DeviceMotionEvent);
  }, [processMotion]);

  const requestMotionPermission = async (): Promise<boolean> => {
    if (typeof DeviceMotionEvent === 'undefined') return false;
    if (typeof (DeviceMotionEvent as unknown as { requestPermission?: () => Promise<string> }).requestPermission === 'function') {
      const perm = await (DeviceMotionEvent as unknown as { requestPermission: () => Promise<string> }).requestPermission();
      return perm === 'granted';
    }
    return true;
  };

  const handleStart = async () => {
    setError(null);
    const motionOk = await requestMotionPermission();
    if (!motionOk) setError('Accès au capteur de mouvement refusé');

    if (!motionListenerRef.current) {
      window.addEventListener('devicemotion', handleMotion);
      motionListenerRef.current = true;
    }

    startGPS((msg) => setError(msg));
    startTimeRef.current = Date.now();
    setIsTracking(true);
    setHasStarted(true);
  };

  const handleStop = () => {
    setIsTracking(false);
    stopGPS();
    window.removeEventListener('devicemotion', handleMotion);
    motionListenerRef.current = false;

    // Mark end point
    if (currentLocation) setEndPoint(currentLocation);
  };

  const handleReset = () => {
    setIsTracking(false);
    setHasStarted(false);
    stopGPS();
    window.removeEventListener('devicemotion', handleMotion);
    motionListenerRef.current = false;
    resetSteps();
    resetGPS();
    setStartPoint(null);
    setEndPoint(null);
    setCustomPoints([]);
    setDuration(0);
    setLinearDistance(0);
    setPointCounter(1);
    setError(null);
  };

  // Set start point when GPS first arrives
  useEffect(() => {
    if (isTracking && currentLocation && !startPoint) {
      setStartPoint(currentLocation);
    }
  }, [isTracking, currentLocation, startPoint]);

  const handleMapClick = useCallback((lat: number, lng: number) => {
    const newPoint: CustomPoint = {
      id: Date.now().toString(),
      latitude: lat,
      longitude: lng,
      label: `${t.pointLabel} ${pointCounter}`,
      timestamp: Date.now(),
      color: POINT_COLORS[colorIdx % POINT_COLORS.length],
    };
    setCustomPoints(prev => [...prev, newPoint]);
    setPointCounter(prev => prev + 1);
    setColorIdx(prev => prev + 1);
  }, [colorIdx, pointCounter, t.pointLabel]);

  const handleDeletePoint = (id: string) => {
    setCustomPoints(prev => prev.filter(p => p.id !== id));
  };

  const handleSaveRoute = () => {
    if (trackPath.length < 2) return;
    const route: SavedRoute = {
      id: Date.now().toString(),
      name: `Trajet ${new Date().toLocaleDateString()} ${new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`,
      date: new Date().toISOString(),
      path: trackPath,
      startPoint,
      endPoint,
      customPoints,
      totalDistance,
      linearDistance,
      steps,
      duration,
    };
    setSavedRoutes(prev => [route, ...prev]);
  };

  const handleExportCSV = () => {
    const headers = ['Date', 'Distance Totale (m)', 'Distance Lineaire (m)', 'Pas', 'Duree (s)', 'Vitesse Moy (km/h)'];
    const row = [
      new Date().toLocaleString(),
      totalDistance.toFixed(2),
      linearDistance.toFixed(2),
      steps,
      duration,
      speed > 0 ? (speed * 3.6).toFixed(1) : '0',
    ];
    const csv = [headers.join(','), row.join(',')].join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `trajet_${Date.now()}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const handleToggleRecording = async () => {
    if (isRecording) {
      stopRecording();
    } else {
      const ok = await startRecording(recordingLabel || `Message ${recordings.length + 1}`);
      if (!ok) setError('Accès au microphone refusé');
      setRecordingLabel('');
    }
  };

  return (
    <div className="min-h-screen bg-gray-950 text-white flex flex-col" style={{ fontFamily: "'Inter', sans-serif" }}>

      {/* TOP BAR */}
      <header className="flex items-center justify-between px-4 py-3 bg-gray-900 border-b border-gray-800 shadow-lg">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-green-600 flex items-center justify-center">
            <Footprints className="w-5 h-5 text-white" />
          </div>
          <div>
            <h1 className="text-sm font-bold text-white leading-tight">{t.appTitle}</h1>
            <p className="text-xs text-gray-400">{t.appSubtitle}</p>
          </div>
        </div>

        {/* Language switcher */}
        <div className="flex items-center gap-2">
          <button
            onClick={() => setLang('fr')}
            className={`flex flex-col items-center transition-all ${lang === 'fr' ? 'scale-110 opacity-100' : 'opacity-40 hover:opacity-70'}`}
            title="Français"
          >
            <span className="text-2xl">🇫🇷</span>
            {lang === 'fr' && <div className="w-1 h-1 rounded-full bg-green-400 mt-0.5" />}
          </button>
          <button
            onClick={() => setLang('ht')}
            className={`flex flex-col items-center transition-all ${lang === 'ht' ? 'scale-110 opacity-100' : 'opacity-40 hover:opacity-70'}`}
            title="Kreyòl Ayisyen"
          >
            <span className="text-2xl">🇭🇹</span>
            {lang === 'ht' && <div className="w-1 h-1 rounded-full bg-green-400 mt-0.5" />}
          </button>
        </div>
      </header>

      {/* STATUS BAR */}
      <div className={`flex items-center justify-between px-4 py-2 text-xs font-medium ${isTracking ? 'bg-green-900/60 border-b border-green-700' : 'bg-gray-900/80 border-b border-gray-800'}`}>
        <div className="flex items-center gap-2">
          <div className={`w-2 h-2 rounded-full ${isTracking ? 'bg-green-400 animate-pulse' : 'bg-gray-500'}`} />
          <span className={isTracking ? 'text-green-300' : 'text-gray-400'}>
            {isTracking ? t.tracking : t.stopped}
          </span>
        </div>
        <div className="flex items-center gap-3 text-gray-400">
          {accuracy !== null && (
            <span className={`flex items-center gap-1 ${accuracy < 10 ? 'text-green-400' : accuracy < 30 ? 'text-yellow-400' : 'text-red-400'}`}>
              <Navigation className="w-3 h-3" />
              GPS ±{accuracy.toFixed(0)}m
            </span>
          )}
          {isTracking && <span className="text-green-300 flex items-center gap-1"><Clock className="w-3 h-3" />{formatDuration(duration)}</span>}
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="mx-3 mt-2 px-3 py-2 bg-red-900/60 border border-red-700 rounded-lg text-xs text-red-300">
          ⚠️ {error}
        </div>
      )}

      {/* METRICS CARDS */}
      <div className="grid grid-cols-4 gap-2 px-3 py-3">
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-col items-center">
          <Ruler className="w-4 h-4 text-green-400 mb-1" />
          <span className="text-lg font-bold text-white">{totalDistance >= 1000 ? `${(totalDistance / 1000).toFixed(2)}km` : `${totalDistance.toFixed(0)}m`}</span>
          <span className="text-xs text-gray-500 text-center leading-tight">{t.totalWalked}</span>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-col items-center">
          <Navigation className="w-4 h-4 text-orange-400 mb-1" />
          <span className="text-lg font-bold text-white">{linearDistance >= 1000 ? `${(linearDistance / 1000).toFixed(2)}km` : `${linearDistance.toFixed(0)}m`}</span>
          <span className="text-xs text-gray-500 text-center leading-tight">{t.straightLine}</span>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-col items-center">
          <Footprints className="w-4 h-4 text-blue-400 mb-1" />
          <span className="text-lg font-bold text-white">{steps}</span>
          <span className="text-xs text-gray-500 text-center leading-tight">{t.steps}</span>
        </div>
        <div className="bg-gray-900 border border-gray-800 rounded-xl p-3 flex flex-col items-center">
          <Zap className="w-4 h-4 text-yellow-400 mb-1" />
          <span className="text-lg font-bold text-white">{(speed * 3.6).toFixed(1)}</span>
          <span className="text-xs text-gray-500 text-center leading-tight">{t.kmh}</span>
        </div>
      </div>

      {/* MAIN CONTROL BUTTONS */}
      <div className="flex gap-2 px-3 pb-2">
        {!hasStarted ? (
          <button
            onClick={handleStart}
            className="flex-1 bg-green-600 hover:bg-green-500 active:bg-green-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-green-900/40"
          >
            <Play className="w-5 h-5" /> {t.start}
          </button>
        ) : isTracking ? (
          <button
            onClick={handleStop}
            className="flex-1 bg-red-600 hover:bg-red-500 active:bg-red-700 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all shadow-lg shadow-red-900/40"
          >
            <Square className="w-5 h-5" /> {t.stop}
          </button>
        ) : (
          <button
            onClick={handleStart}
            className="flex-1 bg-green-700 hover:bg-green-600 text-white font-bold py-3 rounded-xl flex items-center justify-center gap-2 transition-all"
          >
            <Play className="w-5 h-5" /> Reprendre
          </button>
        )}
        <button
          onClick={handleReset}
          className="bg-gray-800 hover:bg-gray-700 border border-gray-700 text-gray-300 font-bold py-3 px-4 rounded-xl flex items-center gap-2 transition-all"
        >
          <RotateCcw className="w-5 h-5" />
        </button>
      </div>

      {/* TABS */}
      <div className="flex px-3 gap-1 pb-2">
        {(['map', 'stats', 'audio'] as const).map(tab => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab)}
            className={`flex-1 py-2 rounded-lg text-xs font-semibold transition-all ${activeTab === tab ? 'bg-green-600 text-white' : 'bg-gray-800 text-gray-400 hover:bg-gray-700'}`}
          >
            {tab === 'map' ? '🗺️ Carte' : tab === 'stats' ? '📊 Stats' : `🎤 Audio${recordings.length > 0 ? ` (${recordings.length})` : ''}`}
          </button>
        ))}
      </div>

      {/* TAB CONTENT */}
      <div className="flex-1 px-3 pb-4">

        {/* MAP TAB */}
        {activeTab === 'map' && (
          <div className="flex flex-col gap-3">
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <MapView
                trackPath={trackPath}
                currentLocation={currentLocation}
                startPoint={startPoint}
                endPoint={endPoint}
                customPoints={customPoints}
                onMapClick={handleMapClick}
              />
            </div>

            {/* Legend */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
              <div className="flex flex-wrap gap-3 text-xs text-gray-400">
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-green-600 inline-block" /> Départ</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-red-600 inline-block" /> Fin</span>
                <span className="flex items-center gap-1"><span className="w-3 h-3 rounded-full bg-blue-500 inline-block" /> Position</span>
                <span className="flex items-center gap-1"><div className="w-6 border-t-2 border-gray-400 border-dashed" /> Trajet</span>
                <span className="flex items-center gap-1"><div className="w-6 border-t-2 border-orange-400 border-dashed" /> Ligne droite</span>
              </div>
              <p className="text-xs text-gray-600 mt-2">{t.tapMapToAdd}</p>
            </div>

            {/* Custom Points List */}
            {customPoints.length > 0 && (
              <div className="bg-gray-900 border border-gray-800 rounded-xl p-3">
                <h3 className="text-sm font-semibold text-gray-300 mb-2 flex items-center gap-2">
                  <MapPin className="w-4 h-4 text-purple-400" />{t.customPoints} ({customPoints.length})
                </h3>
                <div className="flex flex-col gap-1 max-h-36 overflow-y-auto">
                  {customPoints.map(pt => (
                    <div key={pt.id} className="flex items-center justify-between bg-gray-800 rounded-lg px-3 py-2">
                      <div className="flex items-center gap-2">
                        <div className="w-3 h-3 rounded-full flex-shrink-0" style={{ background: pt.color }} />
                        <span className="text-xs text-gray-300">{pt.label}</span>
                        <span className="text-xs text-gray-600">{formatTime(pt.timestamp)}</span>
                      </div>
                      <button onClick={() => handleDeletePoint(pt.id)} className="text-red-500 hover:text-red-400 transition-colors">
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}

        {/* STATS TAB */}
        {activeTab === 'stats' && (
          <div className="flex flex-col gap-3">
            {/* Summary */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-bold text-gray-200 mb-3 flex items-center gap-2">
                <Ruler className="w-4 h-4 text-green-400" /> Résumé du Trajet
              </h3>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { label: t.totalWalked, value: `${totalDistance.toFixed(1)} m`, color: 'text-green-400' },
                  { label: t.straightLine, value: `${linearDistance.toFixed(1)} m`, color: 'text-orange-400' },
                  { label: t.steps, value: steps.toString(), color: 'text-blue-400' },
                  { label: t.duration, value: formatDuration(duration), color: 'text-purple-400' },
                  { label: t.speed, value: `${(speed * 3.6).toFixed(1)} km/h`, color: 'text-yellow-400' },
                  { label: t.gpsAccuracy, value: accuracy ? `±${accuracy.toFixed(0)}m` : 'N/A', color: accuracy && accuracy < 10 ? 'text-green-400' : 'text-red-400' },
                ].map(item => (
                  <div key={item.label} className="bg-gray-800 rounded-lg p-3">
                    <div className="text-xs text-gray-500 mb-1">{item.label}</div>
                    <div className={`text-lg font-bold ${item.color}`}>{item.value}</div>
                  </div>
                ))}
              </div>
            </div>

            {/* Points summary */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-bold text-gray-200 mb-3 flex items-center gap-2">
                <MapPin className="w-4 h-4 text-purple-400" /> Points Marqués
              </h3>
              <div className="grid grid-cols-3 gap-2">
                <div className="bg-gray-800 rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-500">Départ</div>
                  <div className="text-sm font-bold text-green-400">{startPoint ? '✓' : '—'}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-500">Fin</div>
                  <div className="text-sm font-bold text-red-400">{endPoint ? '✓' : '—'}</div>
                </div>
                <div className="bg-gray-800 rounded-lg p-2 text-center">
                  <div className="text-xs text-gray-500">Perso.</div>
                  <div className="text-sm font-bold text-purple-400">{customPoints.length}</div>
                </div>
              </div>
            </div>

            {/* Actions */}
            <div className="flex gap-2">
              <button
                onClick={handleSaveRoute}
                disabled={trackPath.length < 2}
                className="flex-1 bg-blue-700 hover:bg-blue-600 disabled:bg-gray-800 disabled:text-gray-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-all"
              >
                <Save className="w-4 h-4" /> {t.saveRoute}
              </button>
              <button
                onClick={handleExportCSV}
                className="flex-1 bg-gray-700 hover:bg-gray-600 text-white font-semibold py-3 rounded-xl flex items-center justify-center gap-2 text-sm transition-all"
              >
                <Download className="w-4 h-4" /> {t.exportCSV}
              </button>
            </div>

            {/* Saved Routes */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <button
                onClick={() => setShowHistory(!showHistory)}
                className="w-full flex items-center justify-between px-4 py-3 text-sm font-semibold text-gray-200 hover:bg-gray-800 transition-colors"
              >
                <span className="flex items-center gap-2"><Clock className="w-4 h-4 text-gray-400" />{t.history} ({savedRoutes.length})</span>
                {showHistory ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
              </button>
              {showHistory && (
                <div className="border-t border-gray-800 max-h-52 overflow-y-auto">
                  {savedRoutes.length === 0 ? (
                    <p className="text-xs text-gray-600 p-4 text-center">{t.noHistory}</p>
                  ) : savedRoutes.map(route => (
                    <div key={route.id} className="flex items-center justify-between px-4 py-3 border-b border-gray-800 hover:bg-gray-800 transition-colors">
                      <div>
                        <div className="text-xs font-semibold text-gray-200">{route.name}</div>
                        <div className="text-xs text-gray-500">{route.totalDistance.toFixed(0)}m · {route.steps} pas · {formatDuration(route.duration)}</div>
                      </div>
                      <button
                        onClick={() => setSavedRoutes(prev => prev.filter(r => r.id !== route.id))}
                        className="text-red-500 hover:text-red-400 ml-3"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* AUDIO TAB */}
        {activeTab === 'audio' && (
          <div className="flex flex-col gap-3">
            <div className="bg-gray-900 border border-gray-800 rounded-xl p-4">
              <h3 className="text-sm font-bold text-gray-200 mb-3 flex items-center gap-2">
                <Mic className="w-4 h-4 text-green-400" /> {t.managerMessage}
              </h3>

              <input
                type="text"
                value={recordingLabel}
                onChange={e => setRecordingLabel(e.target.value)}
                placeholder={`Ex: Problème zone A...`}
                className="w-full bg-gray-800 border border-gray-700 text-white placeholder-gray-600 rounded-lg px-3 py-2 text-sm mb-3 focus:outline-none focus:border-green-600"
              />

              <button
                onClick={handleToggleRecording}
                className={`w-full py-3 rounded-xl font-bold text-sm flex items-center justify-center gap-2 transition-all ${isRecording
                  ? 'bg-red-600 hover:bg-red-500 text-white animate-pulse'
                  : 'bg-green-700 hover:bg-green-600 text-white'}`}
              >
                {isRecording ? (
                  <><MicOff className="w-5 h-5" /> {t.stopRecording} ({recordingTime}s)</>
                ) : (
                  <><Mic className="w-5 h-5" /> {t.recordAudio}</>
                )}
              </button>

              {isRecording && (
                <div className="mt-3 flex items-center gap-2 justify-center">
                  <div className="w-2 h-2 rounded-full bg-red-500 animate-ping" />
                  <span className="text-xs text-red-400 font-medium">{t.recording}</span>
                </div>
              )}
            </div>

            {/* Recordings List */}
            <div className="bg-gray-900 border border-gray-800 rounded-xl overflow-hidden">
              <div
                className="flex items-center justify-between px-4 py-3 border-b border-gray-800 cursor-pointer hover:bg-gray-800"
                onClick={() => setShowAudio(!showAudio)}
              >
                <span className="text-sm font-semibold text-gray-200 flex items-center gap-2">
                  <Volume2 className="w-4 h-4 text-gray-400" />{t.audioMessages} ({recordings.length})
                </span>
                {showAudio ? <ChevronUp className="w-4 h-4 text-gray-400" /> : <ChevronDown className="w-4 h-4 text-gray-400" />}
              </div>
              {showAudio && (
                <div className="max-h-64 overflow-y-auto">
                  {recordings.length === 0 ? (
                    <p className="text-xs text-gray-600 p-4 text-center">{t.noRecordings}</p>
                  ) : recordings.map(rec => (
                    <div key={rec.id} className="flex flex-col gap-2 px-4 py-3 border-b border-gray-800">
                      <div className="flex items-center justify-between">
                        <div>
                          <div className="text-xs font-semibold text-gray-200">{rec.label}</div>
                          <div className="text-xs text-gray-500">{formatTime(rec.timestamp)} · {rec.duration.toFixed(0)}s</div>
                        </div>
                        <button onClick={() => deleteRecording(rec.id)} className="text-red-500 hover:text-red-400">
                          <Trash2 className="w-4 h-4" />
                        </button>
                      </div>
                      <audio src={rec.url} controls className="w-full h-8" style={{ filter: 'invert(1) hue-rotate(180deg)' }} />
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* BOTTOM SAFE AREA */}
      <div className="h-4" />
    </div>
  );
}
