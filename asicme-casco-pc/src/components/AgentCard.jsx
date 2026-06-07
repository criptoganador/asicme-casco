import React, { useState } from 'react';
import { Camera, MapPin, Volume2, VolumeX, Maximize2 } from 'lucide-react';
import { VideoTrack, AudioTrack } from '@livekit/components-react';

const AgentCard = ({ participant, isExpanded, location }) => {
  const [isMuted, setIsMuted] = useState(false);

  // Obtener los tracks de video y audio del participante real
  const videoTrackRef = Array.from(participant.videoTrackPublications.values()).find(p => p.source === 'camera');
  const audioTrackRef = Array.from(participant.audioTrackPublications.values()).find(p => p.source === 'microphone');

  return (
    <div className={`flex flex-col bg-zinc-900 border border-zinc-800 rounded-2xl overflow-hidden shadow-xl transition-all ${
      isExpanded ? 'w-full max-w-5xl aspect-video' : 'h-[400px]'
    }`}>
      
      {/* Encabezado de la tarjeta */}
      <div className="flex items-center justify-between p-3 bg-zinc-950/50 border-b border-zinc-800/50">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 bg-zinc-800 rounded-full flex items-center justify-center border border-zinc-700">
            <Camera className="w-4 h-4 text-zinc-400" />
          </div>
          <div>
            <h3 className="text-zinc-100 font-semibold leading-tight flex items-center gap-2">
              {participant.name || participant.identity}
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
              </span>
            </h3>
            <p className="text-emerald-500 text-xs font-mono">TRANSMITIENDO</p>
          </div>
        </div>
        
        <div className="flex items-center gap-2">
          {/* Botón Mute Local */}
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`p-2 rounded-lg transition-colors ${
              isMuted ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-zinc-800 text-zinc-400 hover:text-zinc-200 hover:bg-zinc-700'
            }`}
            title={isMuted ? "Activar Audio" : "Silenciar Audio"}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          {!isExpanded && (
            <button className="p-2 text-zinc-400 hover:text-zinc-200 bg-zinc-800 hover:bg-zinc-700 rounded-lg transition-colors">
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Contenedor de Video Real */}
      <div className="relative flex-1 bg-black overflow-hidden group">
        {videoTrackRef ? (
          <VideoTrack
            trackRef={{ participant, source: 'camera', publication: videoTrackRef }}
            className="w-full h-full object-cover"
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
      <div className="p-3 bg-zinc-950 flex items-center justify-between text-xs font-mono border-t border-zinc-800/50">
        <div className="flex items-center gap-2 text-zinc-400">
          <MapPin className={`w-4 h-4 ${location ? 'text-emerald-500' : 'text-zinc-500'}`} />
          {location ? (
            <span className="text-emerald-400 font-bold">
              GPS: {location.lat.toFixed(5)}, {location.lng.toFixed(5)}
            </span>
          ) : (
            <span>[GPS: Pendiente de datos]</span>
          )}
        </div>
        <div className="text-zinc-500">
          {location ? 'Ubicación Activa' : 'Ubicación Offline'}
        </div>
      </div>
    </div>
  );
};

export default AgentCard;
