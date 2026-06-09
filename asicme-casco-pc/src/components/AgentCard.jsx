import { useState } from 'react';
import { Camera, Volume2, VolumeX, Maximize2, Minimize2 } from 'lucide-react';
import { useDataChannel, VideoTrack, AudioTrack } from '@livekit/components-react';

const AgentCard = ({ participant, isExpanded }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [localExpanded, setLocalExpanded] = useState(false);
  const [agentCoords, setAgentCoords] = useState(null);

  const expanded = Boolean(isExpanded) || localExpanded;

  useDataChannel((msg) => {
    try {
      const payload = JSON.parse(new TextDecoder().decode(msg.payload));
      const nombreEnTarjeta = String(participant.identity || '').toLowerCase();
      const nombreRemitente = String(msg.from?.identity || '').toLowerCase();

      console.log(`[LiveKit] DataChannel recibido de: ${msg.from?.identity}`, payload);

      if (nombreRemitente === nombreEnTarjeta && payload.type === 'gps') {
        setAgentCoords({
          latitude: payload.latitude,
          longitude: payload.longitude,
          heading: payload.heading,
          timestamp: payload.timestamp || Date.now(),
        });
      }
    } catch (e) {
      console.error('AgentCard DataChannel parse error', e);
    }
  });

  // Obtener los tracks de video y audio del participante real
  const videoTrackRef = Array.from(participant.videoTrackPublications.values()).find(p => p.source === 'camera');
  const audioTrackRef = Array.from(participant.audioTrackPublications.values()).find(p => p.source === 'microphone');

  return (
    <div className={`flex flex-col bg-slate-100 border border-slate-200 rounded-2xl overflow-hidden shadow-xl transition-all w-full max-w-4xl mx-auto ${
      expanded ? '' : 'h-[460px]'
    }`}>
      
      {/* Encabezado y metadata */}
      <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-200">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center border border-slate-300">
            <Camera className="w-4 h-4 text-slate-600" />
          </div>
          <div>
            <h3 className="text-slate-900 text-lg font-semibold leading-tight flex items-center gap-2">
              {participant.name || participant.identity}
              <span className="flex h-2 w-2 relative">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-300 opacity-75"></span>
                <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500"></span>
              </span>
            </h3>
            <p className="text-sky-600 text-xs font-mono uppercase tracking-[0.18em]">Transmisión en vivo</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setIsMuted(!isMuted)}
            className={`p-2 rounded-lg transition-colors ${
              isMuted ? 'bg-red-500/20 text-red-500 hover:bg-red-500/30' : 'bg-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-300'
            }`}
            title={isMuted ? 'Activar audio' : 'Silenciar audio'}
          >
            {isMuted ? <VolumeX className="w-4 h-4" /> : <Volume2 className="w-4 h-4" />}
          </button>
          {!expanded && (
            <button onClick={() => setLocalExpanded(true)} className="p-2 rounded-lg bg-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-300 transition-colors" title="Expandir">
              <Maximize2 className="w-4 h-4" />
            </button>
          )}
          {expanded && localExpanded && (
            <button onClick={() => setLocalExpanded(false)} className="p-2 rounded-lg bg-slate-200 text-slate-700 hover:text-slate-900 hover:bg-slate-300 transition-colors" title="Restaurar">
              <Minimize2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Reproductor de video estilo YouTube */}
      <div className="relative bg-slate-950/95">
        <div className="relative aspect-video bg-black overflow-hidden">
          {videoTrackRef ? (
            <VideoTrack
              trackRef={{ participant, source: 'camera', publication: videoTrackRef }}
              className="absolute inset-0 w-full h-full object-cover"
            />
          ) : (
            <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-200">
              <Camera className="w-14 h-14 mb-3 opacity-70" />
              <p className="font-mono text-sm">Esperando feed de video...</p>
            </div>
          )}

          <div className="absolute inset-x-0 top-0 flex items-center justify-between px-4 py-3 bg-gradient-to-b from-slate-950/80 to-transparent">
            <span className="inline-flex items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-[0.28em] text-white shadow-lg shadow-red-500/20">
              <span className="h-2 w-2 rounded-full bg-white animate-pulse"></span>
              LIVE
            </span>
            <span className="rounded-full bg-slate-900/80 px-3 py-1 text-[11px] text-slate-200">{participant.name || participant.identity}</span>
          </div>

          <div className="absolute inset-x-0 bottom-0 px-4 pb-3 pt-3">
            <div className="h-1.5 rounded-full bg-slate-700/70 overflow-hidden">
              <div className="h-full w-3/4 bg-sky-500/80"></div>
            </div>
          </div>
        </div>
      </div>

      {/* Reproductor de audio (oculto, pero activo mientras no esté silenciado) */}
      {!isMuted && audioTrackRef && (
        <AudioTrack
          trackRef={{ participant, source: 'microphone', publication: audioTrackRef }}
        />
      )}

      {/* Pie de tarjeta - Telemetría GPS en texto */}
      <div className="p-4 bg-slate-950 border-t border-slate-800">
        <div className="rounded-3xl border border-slate-800 bg-slate-900 p-4 font-mono text-sm text-emerald-300">
          {agentCoords ? (
            <div className="space-y-2">
              <div>📍 Latitud: {agentCoords.latitude.toFixed(6)}</div>
              <div>📍 Longitud: {agentCoords.longitude.toFixed(6)}</div>
              <div>🧭 Dirección: {agentCoords.heading !== null && agentCoords.heading !== undefined ? `${agentCoords.heading}°` : 'N/A'}</div>
              <div className="text-xs text-slate-400">⏱️ Última actualización: {new Date(agentCoords.timestamp).toLocaleTimeString()}</div>
            </div>
          ) : (
            <div className="animate-pulse text-emerald-400">Esperando señal GPS...</div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentCard;
