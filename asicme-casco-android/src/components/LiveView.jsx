import { useState, useEffect } from 'react';
import { Camera, PhoneOff, Navigation } from 'lucide-react';
import { useRoomContext, RoomAudioRenderer } from '@livekit/components-react';
import { Geolocation } from '@capacitor/geolocation';

const LiveView = ({ agentName, onDisconnect }) => {
  const room = useRoomContext();
  // El micrófono y la cámara son publicados automáticamente por <LiveKitRoom audio={true} video={true}>

  const [gpsActive, setGpsActive] = useState(false);
  const [gpsError, setGpsError] = useState(false);


  // ─── Keep-alive en segundo plano ─────────────────────────────────────────────
  // Un AudioContext silencioso indica al sistema Android que la app está activa
  // y evita que congele el WebView. Truco usado por Spotify, Meet y WhatsApp.
  useEffect(() => {
    let audioCtx = null;
    let oscillator = null;

    try {
      audioCtx = new AudioContext();
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 0.00001; // Casi silencioso (0 exacto permite optimizaciones que lo apagan)
      oscillator = audioCtx.createOscillator();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      console.log('✅ Keep-alive de audio activo');
    } catch (e) {
      console.warn('Keep-alive de audio no disponible:', e);
    }

    return () => {
      try { oscillator?.stop(); } catch { /* ignorar */ }
      try { audioCtx?.close(); } catch { /* ignorar */ }
    };
  }, []);


  // La cámara y el micro se inicializan automáticamente por <LiveKitRoom video={true} audio={true}>

  // ─── GPS ────────────────────────────────────────────────────────────────────
  const iniciarTransmisionGPS = async (room) => {
    try {
      const check = await Geolocation.checkPermissions();
      if (check.location !== 'granted') {
        const request = await Geolocation.requestPermissions();
        if (request.location !== 'granted') {
          setGpsError(true);
          return;
        }
      }

      const watchId = await Geolocation.watchPosition({ enableHighAccuracy: true }, (position, err) => {
        if (err) { setGpsError(true); return; }
        const payload = JSON.stringify({
          type: 'gps',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          heading: position.coords.heading,
          timestamp: position.timestamp
        });
        const encoder = new TextEncoder();
        room.localParticipant.publishData(encoder.encode(payload), { reliable: true, topic: 'gps' });
      });

      return watchId;
    } catch (error) {
      console.error('💥 Error fatal GPS:', error);
      setGpsError(true);
    }
  };

  useEffect(() => {
    if (!room) return;
    let activeWatchId;
    const start = async () => {
      activeWatchId = await iniciarTransmisionGPS(room);
      if (activeWatchId) setGpsActive(true);
    };
    start();
    return () => {
      if (activeWatchId) Geolocation.clearWatch({ id: activeWatchId });
    };
  }, [room]);

  // ─── Controles ───────────────────────────────────────────────────────────────
  // toggleMic y toggleCamera ahora son manejados automáticamente por useTrackToggle

  const handleHangUp = () => {
    room.disconnect();
    onDisconnect();
  };

  // Track de cámara local manejado en segundo plano por LiveKitRoom

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <RoomAudioRenderer />



      {/* Header */}
      <div className="flex items-center justify-between px-6 py-4 bg-zinc-900 border-b border-zinc-800 z-10">
        <div className="flex flex-col">
          <span className="text-xs font-mono text-zinc-500">OPERADOR</span>
          <span className="font-bold text-lg text-zinc-100">{agentName}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Badge GPS */}
          {gpsActive && !gpsError && (
            <div className="flex items-center gap-1 bg-emerald-500/10 px-2 py-1.5 rounded-full border border-emerald-500/20">
              <Navigation className="w-3 h-3 text-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-500 tracking-wider">GPS</span>
            </div>
          )}
          {gpsError && (
            <div className="flex items-center gap-1 bg-amber-500/10 px-2 py-1.5 rounded-full border border-amber-500/20">
              <Navigation className="w-3 h-3 text-amber-500 opacity-50" />
              <span className="text-[10px] font-bold text-amber-500 tracking-wider">GPS ERROR</span>
            </div>
          )}

          {/* Badge LIVE */}
          <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-bold text-red-500 tracking-wider">EN VIVO</span>
          </div>
        </div>
      </div>

      {/* Main Video Area (Headless Mode) */}
      <div className="flex-1 relative bg-zinc-950 flex flex-col items-center justify-center overflow-hidden">
        
        {/* Radar/Indicador de Transmisión */}
        <div className="relative flex items-center justify-center w-40 h-40">
          <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full animate-[ping_3s_ease-in-out_infinite]"></div>
          <div className="absolute inset-4 border-2 border-emerald-500/30 rounded-full animate-[ping_2s_ease-in-out_infinite_0.5s]"></div>
          <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
            <Camera className="w-8 h-8 text-emerald-500" />
          </div>
        </div>

        <div className="mt-8 text-center px-8">
          <h2 className="text-xl font-bold text-zinc-200 mb-2">Transmisión Activa</h2>
          <p className="text-zinc-500 text-sm">
            La cámara está enviando datos al Centro de Mando en segundo plano para ahorrar batería.
          </p>
        </div>


      </div>

      {/* Footer / Controls */}
      <div className="bg-zinc-900 p-6 pb-8 rounded-t-3xl border-t border-zinc-800 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className="flex justify-center items-center max-w-sm mx-auto">
          {/* Botón Colgar */}
          <button
            onClick={handleHangUp}
            className="w-20 h-20 flex items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-900/50 hover:bg-red-500 active:scale-90 transition-all"
          >
            <PhoneOff className="w-8 h-8" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveView;
