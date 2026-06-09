import { useState, useEffect } from 'react';
import { Camera, Volume2, VolumeX, Maximize2, Minimize2, MapPin } from 'lucide-react';
import { useDataChannel, VideoTrack, AudioTrack } from '@livekit/components-react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';

// Fix para los iconos de Leaflet en React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Componente para re-centrar el mapa cuando cambian las coordenadas
function MapUpdater({ center }) {
  const map = useMap();
  useEffect(() => {
    if (center && center.length === 2 && !isNaN(center[0]) && !isNaN(center[1])) {
      map.setView(center, map.getZoom(), {
        animate: true,
      });
    }
  }, [center, map]);
  return null;
}

// Generador de Icono Táctico Animado (Sonar + Cono de Dirección)
const getTacticalMarker = (heading) => {
  const hasHeading = heading !== null && heading !== undefined;
  
  const html = `
    <div style="transform: rotate(${heading || 0}deg);" class="relative flex items-center justify-center w-16 h-16 -ml-8 -mt-8">
      ${hasHeading ? `
        <!-- Cono de Visión -->
        <div class="absolute w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-b-[40px] border-b-emerald-500/40 blur-[1px] -top-3"></div>
      ` : ''}
      
      <!-- Efecto Sonar (Pulso expansivo) -->
      <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-emerald-400 opacity-75"></span>
      
      <!-- Punto central brillante -->
      <span class="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-900 shadow-[0_0_10px_rgba(52,211,153,1)] z-10"></span>
    </div>
  `;

  return L.divIcon({
    className: '', // Limpiar clases por defecto de Leaflet
    html: html,
    iconSize: [0, 0], // El tamaño lo maneja el div interno
    iconAnchor: [0, 0] // Centrado relativo al div
  });
};


const AgentCard = ({ participant, isExpanded }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [localExpanded, setLocalExpanded] = useState(false);
  const [agentCoords, setAgentCoords] = useState(null);

  const expanded = Boolean(isExpanded) || localExpanded;

  useDataChannel('gps', (msg) => {
    try {
      const payload = JSON.parse(new TextDecoder().decode(msg.payload));
      const nombreEnTarjeta = String(participant.identity || participant.name || '').trim().toLowerCase();
      const nombreRemitente = String(msg.from?.identity || msg.participant?.identity || '').trim().toLowerCase();
      const isGpsPayload = payload.type === 'gps' || (
        payload.latitude !== undefined && payload.longitude !== undefined
      );

      // Permissive matching: exact match or substring (both ways)
      const matchesIdentity = (
        nombreRemitente === nombreEnTarjeta ||
        (nombreRemitente && nombreEnTarjeta && nombreRemitente.includes(nombreEnTarjeta)) ||
        (nombreRemitente && nombreEnTarjeta && nombreEnTarjeta.includes(nombreRemitente))
      );

      // Ensure payload contains valid numeric coordinates
      const lat = Number(payload.latitude);
      const lng = Number(payload.longitude);
      const hasValidCoords = !Number.isNaN(lat) && !Number.isNaN(lng);

      if (matchesIdentity && isGpsPayload && hasValidCoords) {
        setAgentCoords({
          latitude: lat,
          longitude: lng,
          heading: payload.heading ?? null,
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

  // Fallback: si no llega agentCoords local, usar el último GPS global si coincide con identidad
  const fallbackGps = typeof window !== 'undefined' ? window.__LAST_GPS__ : null;
  let displayCoords = agentCoords;
  if (!displayCoords && fallbackGps && fallbackGps.payload) {
    const fallbackFrom = String(fallbackGps.from || '').trim().toLowerCase();
    const cardName = String(participant.identity || participant.name || '').trim().toLowerCase();
    if (fallbackFrom && cardName && (fallbackFrom === cardName || fallbackFrom.includes(cardName) || cardName.includes(fallbackFrom))) {
      const p = fallbackGps.payload;
      const lat = Number(p.latitude ?? p.lat);
      const lng = Number(p.longitude ?? p.lng);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        displayCoords = {
          latitude: lat,
          longitude: lng,
          heading: p.heading ?? null,
          timestamp: p.timestamp,
        };
      }
    }
  }

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

      {/* Pie de tarjeta - Mini-Mapa GPS */}
      <div className="p-4 bg-slate-950 border-t border-slate-800">
        <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden relative" style={{ height: expanded ? '200px' : '140px' }}>
          {displayCoords ? (
            <>
              <MapContainer 
                center={[displayCoords.latitude, displayCoords.longitude]} 
                zoom={16} 
                style={{ height: '100%', width: '100%' }}
                zoomControl={false}
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OSM</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
                  url="https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png"
                />
                <Marker 
                  position={[displayCoords.latitude, displayCoords.longitude]}
                  icon={getTacticalMarker(displayCoords.heading)}
                >
                  <Popup className="tactical-popup">
                    <div className="text-center font-mono text-xs">
                      <b>{participant.name || participant.identity}</b><br/>
                      Lat: {displayCoords.latitude.toFixed(5)}<br/>
                      Lng: {displayCoords.longitude.toFixed(5)}<br/>
                      {displayCoords.heading !== null && displayCoords.heading !== undefined ? `Dirección: ${displayCoords.heading}°` : ''}
                    </div>
                  </Popup>
                </Marker>
                <MapUpdater center={[displayCoords.latitude, displayCoords.longitude]} />
              </MapContainer>
              {/* Overlay de telemetría */}
              <div className="absolute top-2 left-2 z-[400] bg-slate-900/80 backdrop-blur-md rounded-lg p-2 border border-slate-700/50 shadow-lg pointer-events-none">
                <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs">
                  <span className="flex h-1.5 w-1.5 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500"></span>
                  </span>
                  GPS ACTIVO
                </div>
                <div className="text-[10px] text-slate-300 mt-1">
                  Actualizado: {new Date(displayCoords.timestamp).toLocaleTimeString()}
                </div>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center h-full text-emerald-400/60 font-mono text-sm bg-slate-900">
              <MapPin className="w-8 h-8 mb-2 opacity-50 animate-bounce" />
              Esperando señal GPS...
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AgentCard;
