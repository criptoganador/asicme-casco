import { useState } from 'react';
import { Camera, MapPin, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { VideoTrack, AudioTrack } from '@livekit/components-react';

const AgentCard = ({ participant, isExpanded, location }) => {
  const [isMuted, setIsMuted] = useState(false);

  // Obtener los tracks de video y audio del participante real
  const videoTrackRef = Array.from(participant.videoTrackPublications.values()).find(p => p.source === 'camera');
  const audioTrackRef = Array.from(participant.audioTrackPublications.values()).find(p => p.source === 'microphone');

  return (
    <div className={`relative bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl transition-all group ${
      isExpanded ? 'w-full h-full' : 'aspect-video min-h-[300px]'
    }`}>
      
      {/* Contenedor de Video (Fondo Completo) */}
      <div className="absolute inset-0 bg-black">
        {videoTrackRef ? (
          <VideoTrack
            trackRef={{ participant, source: 'camera', publication: videoTrackRef }}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="absolute inset-0 flex flex-col items-center justify-center text-zinc-700">
            <Camera className="w-16 h-16 mb-4 opacity-30 animate-pulse" />
            <p className="font-mono text-sm tracking-widest uppercase">Esperando Video...</p>
          </div>
        )}

        {/* Reproductor de Audio (Oculto visualmente, pero suena) */}
        {!isMuted && audioTrackRef && (
          <AudioTrack
            trackRef={{ participant, source: 'microphone', publication: audioTrackRef }}
          />
        )}
      </div>

      {/* Sombra (Degradado Oscuro Inferior) para Legibilidad */}
      <div className="absolute inset-x-0 bottom-0 h-1/2 bg-gradient-to-t from-black/90 via-black/40 to-transparent pointer-events-none"></div>

      {/* Controles Superiores Flotantes (Solo visibles en Hover si no está expandido) */}
      {!isExpanded && (
        <div className="absolute top-4 right-4 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <button className="p-2 text-white/70 hover:text-white bg-black/40 hover:bg-black/60 backdrop-blur-md rounded-lg transition-all">
            <Maximize2 className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Información Inferior Flotante (Estilo Google Meet) */}
      <div className="absolute bottom-4 left-4 right-4 flex items-end justify-between z-10">
        
        {/* Izquierda: Nombre y Estado */}
        <div className="flex flex-col gap-1.5">
          {/* Badge de estado en vivo */}
          <div className="flex items-center gap-1.5 bg-red-500/20 text-red-500 backdrop-blur-md px-2 py-1 rounded-md w-max border border-red-500/30">
            <span className="flex h-2 w-2 relative">
              <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75"></span>
              <span className="relative inline-flex rounded-full h-2 w-2 bg-red-500"></span>
            </span>
            <span className="text-[10px] font-bold tracking-widest">EN VIVO</span>
          </div>
          
          {/* Nombre y GPS en Glassmorphism */}
          <div className="flex items-center gap-3 bg-black/40 backdrop-blur-md px-3 py-2 rounded-xl border border-white/10">
            <span className="text-white font-medium text-sm md:text-base">
              {participant.name || participant.identity}
            </span>
            <div className="w-px h-4 bg-white/20"></div>
            <div className="flex items-center gap-1 text-xs font-mono">
              <MapPin className={`w-3.5 h-3.5 ${location ? 'text-emerald-400' : 'text-zinc-500'}`} />
              {location ? (
                <span className="text-emerald-300">
                  {location.lat.toFixed(4)}, {location.lng.toFixed(4)}
                </span>
              ) : (
                <span className="text-zinc-500">Sin GPS</span>
              )}
            </div>
          </div>
        </div>

        {/* Derecha: Controles Principales */}
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`p-3 rounded-full transition-all backdrop-blur-md border ${
              isMuted 
                ? 'bg-red-500/80 text-white border-red-500 hover:bg-red-600' 
                : 'bg-black/40 text-white/80 border-white/10 hover:bg-black/60 hover:text-white'
            }`}
            title={isMuted ? "Activar Audio" : "Silenciar Audio"}
          >
            {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
        </div>

      </div>
    </div>
  );
};

export default AgentCard;
