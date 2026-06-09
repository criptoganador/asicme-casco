import { useState } from 'react';
import { Camera, MapPin, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { VideoTrack, AudioTrack } from '@livekit/components-react';

const AgentCard = ({ participant, isExpanded, location }) => {
  const [isMuted, setIsMuted] = useState(false);

  // Obtener los tracks de video y audio del participante real
  const videoTrackRef = Array.from(participant.videoTrackPublications.values()).find(p => p.source === 'camera');
  const audioTrackRef = Array.from(participant.audioTrackPublications.values()).find(p => p.source === 'microphone');

  return (
    <div className={`flex flex-col bg-slate-100 border border-slate-200 rounded-2xl overflow-hidden shadow-xl transition-all ${
      isExpanded ? 'w-full max-w-4xl aspect-video mx-auto' : 'h-[400px]'
    }`}>
      
      {/* Encabezado de la tarjeta */}
      <div className="flex items-center justify-between p-3 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-slate-200 rounded-full flex items-center justify-center border border-slate-300">
            <Camera className="w-4 h-4 text-slate-600" />
          </div>
          <div>
            <h3 className="text-slate-900 font-semibold leading-tight flex items-center gap-2">
              {participant.name || participant.identity}
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
              </span>
            </h3>
            <p className="text-sky-600 text-xs font-mono">TRANSMITIENDO</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Botón Mute Local */}
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`p-2 rounded-lg transition-colors ${
              isMuted ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-300'
            }`}
            title={isMuted ? "Activar Audio" : "Silenciar Audio"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          {!isExpanded && (
            <button className="p-2 text-slate-700 hover:text-slate-900 bg-slate-200 hover:bg-slate-300 rounded-lg transition-colors">
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Contenedor de Video Real */}
      <div className="relative flex-1 bg-slate-100 overflow-hidden group">
        {videoTrackRef ? (
          <VideoTrack
            trackRef={{ participant, source: 'camera', publication: videoTrackRef }}
            className="w-full h-full object-contain"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-700">
            <Camera className="w-12 h-12 mb-2 opacity-30" />
            <p className="font-mono text-sm">Esperando Feed de Video...</p>
          </div>
        )}

        {/* Reproductor de Audio (Oculto visualmente, pero suena) */}
        {!isMuted && audioTrackRef && (
          <AudioTrack
            trackRef={{ participant, source: 'microphone', publication: audioTrackRef }}
          />
        )}
      </div>

      {/* Pie de tarjeta - GPS */}
      <div className="p-3 bg-slate-50 flex items-center justify-between text-xs font-mono border-t border-slate-200">
        <div className="flex items-center gap-2 text-slate-500">
          <MapPin className={`w-4 h-4 ${location ? 'text-sky-500' : 'text-slate-400'}`} />
          {location ? (
            <span className="text-slate-900 font-bold">
              GPS: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </span>
          ) : (
            <span>[GPS: Pendiente de datos]</span>
          )}
        </div>
        <div className="text-slate-500">
          {location ? 'Ubicación Activa' : 'Ubicación Offline'}
        </div>
      </div>
    </div>
  );
};

export default AgentCard;
