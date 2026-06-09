import { useEffect, useState } from 'react';
import { Mic, MicOff, Camera, CameraOff, PhoneOff, Navigation } from 'lucide-react';
import { useLocalParticipant, VideoTrack, useRoomContext, RoomAudioRenderer } from '@livekit/components-react';
import { Geolocation } from '@capacitor/geolocation';

const LiveView = ({ agentName, onDisconnect }) => {
  const room = useRoomContext();
  const { localParticipant, isMicrophoneEnabled, isCameraEnabled } = useLocalParticipant();
  const [gpsActive, setGpsActive] = useState(false);
  const [gpsError, setGpsError] = useState(false);

  // Intentar encender cámara y micro al entrar
  useEffect(() => {
    if (localParticipant) {
      localParticipant.setCameraEnabled(true).catch(console.error);
      localParticipant.setMicrophoneEnabled(true).catch(console.error);
    }
  }, [localParticipant]);


  const iniciarTransmisionGPS = async (room) => {
    console.log('📡 Intentando iniciar el GPS...');

    try {
      // 1. Verificar y pedir permisos explícitamente
      const check = await Geolocation.checkPermissions();
      console.log('🛡️ Estado de permisos GPS:', check);
      
      if (check.location !== 'granted') {
        console.log('⚠️ Pidiendo permisos al usuario...');
        const request = await Geolocation.requestPermissions();
        if (request.location !== 'granted') {
          console.error('❌ El usuario denegó el permiso del GPS.');
          setGpsError(true);
          return;
        }
      }

      // 2. Empezar a escuchar la ubicación
      console.log('✅ Permisos listos. Buscando satélites...');
      const watchId = await Geolocation.watchPosition({ enableHighAccuracy: true }, (position, err) => {
        if (err) {
          console.error('❌ Error crudo leyendo el GPS de Capacitor:', err);
          setGpsError(true);
          return;
        }
        
        console.log('📍 GPS crudo capturado:', position);

        // 3. Empaquetar y enviar por LiveKit
        const payload = JSON.stringify({
          type: 'gps',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          heading: position.coords.heading,
          timestamp: position.timestamp
        });
        
        // Enviar por el canal de datos
        const encoder = new TextEncoder();
        room.localParticipant.publishData(encoder.encode(payload), { reliable: true, topic: 'gps' });
        console.log('📤 GPS enviado por LiveKit');
        
      });

      return watchId;

    } catch (error) {
      console.error('💥 Error fatal al intentar usar el plugin de Geolocation:', error);
      setGpsError(true);
    }
  };

  useEffect(() => {
    if (!room) return;

    let activeWatchId;
    const start = async () => {
      activeWatchId = await iniciarTransmisionGPS(room);
      if (activeWatchId) {
        setGpsActive(true);
      }
    };
    start();

    return () => {
      if (activeWatchId) {
        Geolocation.clearWatch({ id: activeWatchId });
      }
    };
  }, [room]);

  const toggleMic = () => {
    if (localParticipant) {
      // TODO (Capacitor): Aquí añadiremos después la lógica nativa para cambiar rutas de audio (Bluetooth, Altavoz)
      localParticipant.setMicrophoneEnabled(!isMicrophoneEnabled);
    }
  };

  const toggleCamera = () => {
    if (localParticipant) {
      localParticipant.setCameraEnabled(!isCameraEnabled);
    }
  };

  const handleHangUp = () => {
    room.disconnect();
    onDisconnect();
  };

  // Obtener el track de cámara para renderizarlo
  const cameraTrack = localParticipant?.videoTrackPublications?.values().next().value?.videoTrack;

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
          <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-bold text-red-500 tracking-wider">EN VIVO</span>
          </div>
        </div>
      </div>

      {/* Main Video Area */}
      <div className="flex-1 relative bg-black flex items-center justify-center overflow-hidden">
        {cameraTrack && isCameraEnabled ? (
          <VideoTrack 
            trackRef={{ participant: localParticipant, source: 'camera', publication: Array.from(localParticipant.videoTrackPublications.values()).find(p => p.source === 'camera') }}
            className="w-full h-full object-cover" 
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-700 m-4 rounded-3xl">
            <CameraOff className="w-16 h-16 mb-4 opacity-50" />
            <p className="font-mono text-center">
              Cámara pausada o no detectada
            </p>
          </div>
        )}
      </div>

      {/* Footer / Controls */}
      <div className="bg-zinc-900 p-6 pb-8 rounded-t-3xl border-t border-zinc-800 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)]">
        <div className="flex justify-around items-center max-w-sm mx-auto">
          {/* Botón Micrófono */}
          <button 
            onClick={toggleMic}
            className={`w-16 h-16 flex items-center justify-center rounded-full transition-all ${
              isMicrophoneEnabled 
                ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700' 
                : 'bg-red-500/20 text-red-500 border border-red-500/30'
            }`}
          >
            {isMicrophoneEnabled ? <Mic className="w-7 h-7" /> : <MicOff className="w-7 h-7" />}
          </button>

          {/* Botón Colgar (Gigante) */}
          <button 
            onClick={handleHangUp}
            className="w-20 h-20 flex items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-900/50 hover:bg-red-500 active:scale-90 transition-all"
          >
            <PhoneOff className="w-8 h-8" />
          </button>

          {/* Botón Cámara */}
          <button 
            onClick={toggleCamera}
            className={`w-16 h-16 flex items-center justify-center rounded-full transition-all ${
              isCameraEnabled 
                ? 'bg-zinc-800 text-zinc-200 hover:bg-zinc-700' 
                : 'bg-red-500/20 text-red-500 border border-red-500/30'
            }`}
          >
            {isCameraEnabled ? <Camera className="w-7 h-7" /> : <CameraOff className="w-7 h-7" />}
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveView;
