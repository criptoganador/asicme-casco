import { useState, useEffect } from 'react';
import { Camera, Volume2, VolumeX, Maximize2, Minimize2, MapPin, Layers, PictureInPicture2, Map as MapIcon, LocateFixed } from 'lucide-react';
import { useDataChannel, VideoTrack, AudioTrack } from '@livekit/components-react';
import { MapContainer, TileLayer, Marker as LeafletMarker, Popup as LeafletPopup, useMap } from 'react-leaflet';
import mapboxgl from 'mapbox-gl';
import Map, { Marker as MapboxMarker, NavigationControl, FullscreenControl } from 'react-map-gl/mapbox';
import L from 'leaflet';
import FloatingWindow from './FloatingWindow';

// Fix para el error "import.meta outside a module" de Vite con Mapbox GL v3
import MapboxWorker from 'mapbox-gl/dist/mapbox-gl-csp-worker?worker';
mapboxgl.workerClass = MapboxWorker;

// Fix para los iconos de Leaflet en React
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
  iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
  shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// Ya no usamos MapUpdater forzado para permitir al usuario explorar el mapa libremente.
// La cámara se centrará con el botón "Recenter" o en la carga inicial.

// Generador de Icono Táctico Animado (Sonar + Cono de Dirección)
const getTacticalMarker = (heading) => {
  const hasHeading = heading !== null && heading !== undefined;
  const html = `
    <div style="transform: rotate(${heading || 0}deg);" class="relative flex items-center justify-center w-16 h-16 -ml-8 -mt-8">
      ${hasHeading ? `<div class="absolute w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-b-[40px] border-b-emerald-500/40 blur-[1px] -top-3"></div>` : ''}
      <span class="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-emerald-400 opacity-75"></span>
      <span class="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-900 shadow-[0_0_10px_rgba(52,211,153,1)] z-10"></span>
    </div>
  `;
  return L.divIcon({ className: '', html, iconSize: [0, 0], iconAnchor: [0, 0] });
};

// Sub-componente del mapa táctico para reutilizarlo en la tarjeta y en PiP
const TacticalMap = ({ displayCoords, is3DMode, setIs3DMode }) => {
  return (
  <div className="w-full h-full relative group/map">
    {!is3DMode ? (
      <MapContainer
        center={[displayCoords.latitude, displayCoords.longitude]}
        zoom={16}
        style={{ height: '100%', width: '100%', zIndex: 1 }}
        zoomControl={true}
      >
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <LeafletMarker
          position={[displayCoords.latitude, displayCoords.longitude]}
          icon={getTacticalMarker(displayCoords.heading)}
        >
          <LeafletPopup>
            <div className="text-center font-mono text-xs">
              <p className="font-bold">GPS Agente</p>
              <p>Lat: {displayCoords.latitude.toFixed(5)}</p>
              <p>Lng: {displayCoords.longitude.toFixed(5)}</p>
              {displayCoords.heading != null && <p>Dir: {displayCoords.heading}°</p>}
            </div>
          </LeafletPopup>
        </LeafletMarker>
        {/* Helper interno para poder volar al centro usando el hook */}
        <RecenterHelper center={[displayCoords.latitude, displayCoords.longitude]} />
      </MapContainer>
    ) : (
      <Map
        id="mapbox-agent-map"
        mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
        maxZoom={24}
        scrollZoom={true}
        dragPan={true}
        initialViewState={{
          longitude: Number(displayCoords.longitude) || 0,
          latitude: Number(displayCoords.latitude) || 0,
          zoom: 16.5,
          pitch: 60,
          bearing: Number(displayCoords.heading) || 0,
        }}
        mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
        style={{ width: '100%', height: '100%' }}
        terrain={{ source: 'mapbox-dem', exaggeration: 1.5 }}
        onLoad={(e) => {
          const map = e.target;
          // Guardamos referencia al mapa en el elemento DOM para acceder desde fuera
          document.getElementById('mapbox-agent-map').__mapInstance = map;
          
          if (!map.getSource('mapbox-dem')) {
            map.addSource('mapbox-dem', { type: 'raster-dem', url: 'mapbox://mapbox.mapbox-terrain-dem-v1', tileSize: 512, maxzoom: 14 });
            map.setTerrain({ source: 'mapbox-dem', exaggeration: 1.5 });
          }
          if (!map.getLayer('3d-buildings')) {
            const layers = map.getStyle().layers;
            const labelLayerId = layers.find(l => l.type === 'symbol' && l.layout['text-field'])?.id;
            map.addLayer({
              id: '3d-buildings', source: 'composite', 'source-layer': 'building',
              filter: ['==', 'extrude', 'true'], type: 'fill-extrusion', minzoom: 15,
              paint: {
                'fill-extrusion-color': '#ffffff',
                'fill-extrusion-height': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'height']],
                'fill-extrusion-base': ['interpolate', ['linear'], ['zoom'], 15, 0, 15.05, ['get', 'min_height']],
                'fill-extrusion-opacity': 0.45,
              },
            }, labelLayerId);
          }
        }}
      >
        <FullscreenControl position="top-left" />
        <NavigationControl position="bottom-right" />
        <MapboxMarker longitude={Number(displayCoords.longitude) || 0} latitude={Number(displayCoords.latitude) || 0} anchor="center">
          <div style={{ transform: `rotate(${displayCoords.heading || 0}deg)` }} className="relative flex items-center justify-center w-16 h-16">
            {displayCoords.heading != null && <div className="absolute w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-b-[40px] border-b-emerald-500/40 blur-[1px] -top-3" />}
            <span className="animate-ping absolute inline-flex h-8 w-8 rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-4 w-4 bg-emerald-500 border-2 border-slate-900 shadow-[0_0_10px_rgba(52,211,153,1)] z-10" />
          </div>
        </MapboxMarker>
      </Map>
    )}

    {/* Telemetría overlay */}
    <div className="absolute top-2 left-2 z-[400] pointer-events-none">
      <div className="bg-slate-900/80 backdrop-blur-md rounded-lg p-2 border border-slate-700/50 shadow-lg">
        <div className="flex items-center gap-2 text-emerald-400 font-mono text-xs">
          <span className="flex h-1.5 w-1.5 relative">
            <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75" />
            <span className="relative inline-flex rounded-full h-1.5 w-1.5 bg-emerald-500" />
          </span>
          GPS ACTIVO
        </div>
        <div className="text-[10px] text-slate-300 mt-0.5">
          {new Date(displayCoords.timestamp).toLocaleTimeString()}
        </div>
      </div>
    </div>

    {/* Botones Flotantes (Derecha) */}
    <div className="absolute top-2 right-2 z-[400] flex flex-col gap-2">
      {/* Botón 3D/2D toggle */}
      <button
        onClick={() => setIs3DMode(!is3DMode)}
        className={`p-1.5 rounded-lg backdrop-blur-md border shadow-lg transition-colors flex items-center gap-1.5 ${
          is3DMode ? 'bg-sky-500 text-white border-sky-400' : 'bg-slate-900/80 text-slate-300 border-slate-700/50 hover:bg-slate-800'
        }`}
        title="Cambiar vista 2D/3D"
      >
        <Layers className="w-3.5 h-3.5" />
        <span className="text-[10px] font-bold font-mono">{is3DMode ? '3D' : '2D'}</span>
      </button>

      {/* Botón Centrar Agente (Solo Mapbox usa el hack, Leaflet lo hace interno) */}
      {is3DMode && (
        <button
          onClick={() => {
            const map = document.getElementById('mapbox-agent-map')?.__mapInstance;
            if (map) {
              map.flyTo({ center: [displayCoords.longitude, displayCoords.latitude], zoom: 16.5, duration: 1500 });
            }
          }}
          className="p-1.5 rounded-lg bg-slate-900/80 text-white border border-slate-700/50 hover:bg-sky-500 hover:border-sky-400 shadow-lg transition-colors flex items-center justify-center opacity-0 group-hover/map:opacity-100"
          title="Centrar en el Agente"
        >
          <LocateFixed className="w-4 h-4" />
        </button>
      )}
    </div>
  </div>
)};

// Componente helper para recentrar en Leaflet
function RecenterHelper({ center }) {
  const map = useMap();
  return (
    <button
      onClick={(e) => {
        e.preventDefault();
        map.flyTo(center, 16, { animate: true, duration: 1.5 });
      }}
      className="absolute top-12 right-2 z-[400] p-1.5 rounded-lg bg-slate-900/80 text-white border border-slate-700/50 hover:bg-sky-500 hover:border-sky-400 shadow-lg transition-colors flex items-center justify-center opacity-0 group-hover/map:opacity-100"
      title="Centrar en el Agente"
      style={{ pointerEvents: 'auto' }}
    >
      <LocateFixed className="w-4 h-4" />
    </button>
  );
}


// Sub-componente del panel de video con identidad fija (evita desmonte innecesario en cada re-render)
function VideoPanel({ participant, videoTrackRef }) {
  return (
    <div className="relative w-full h-full bg-black">
      {videoTrackRef ? (
        <VideoTrack
          trackRef={{ participant, source: videoTrackRef.source || 'camera', publication: videoTrackRef }}
          className="absolute inset-0 w-full h-full object-cover"
        />
      ) : (
        <div className="absolute inset-0 flex flex-col items-center justify-center text-slate-400">
          <Camera className="w-14 h-14 mb-3 opacity-50" />
          <p className="font-mono text-sm">Esperando feed de video...</p>
        </div>
      )}
      {/* Badge LIVE */}
      <span className="absolute top-3 left-3 inline-flex items-center gap-2 rounded-full bg-red-500 px-3 py-1 text-[11px] font-semibold uppercase tracking-widest text-white shadow-lg shadow-red-500/30">
        <span className="h-2 w-2 rounded-full bg-white animate-pulse" />
        LIVE
      </span>
    </div>
  );
}

const AgentCard = ({ participant, isExpanded }) => {
  const [isMuted, setIsMuted] = useState(false);
  const [localExpanded, setLocalExpanded] = useState(false);
  const [agentCoords, setAgentCoords] = useState(null);
  const [is3DMode, setIs3DMode] = useState(false);

  // Estados de ventana flotante
  const [videoFloat, setVideoFloat] = useState(false);
  const [mapFloat, setMapFloat] = useState(false);

  const expanded = Boolean(isExpanded) || localExpanded;
  const agentName = participant.name || participant.identity;

  useDataChannel('gps', (msg) => {
    try {
      const payload = JSON.parse(new TextDecoder().decode(msg.payload));
      const nombreEnTarjeta = String(participant.identity || participant.name || '').trim().toLowerCase();
      const nombreRemitente = String(msg.from?.identity || msg.participant?.identity || '').trim().toLowerCase();
      const isGpsPayload = payload.type === 'gps' || (payload.latitude !== undefined && payload.longitude !== undefined);
      const matchesIdentity = (
        nombreRemitente === nombreEnTarjeta ||
        (nombreRemitente && nombreEnTarjeta && nombreRemitente.includes(nombreEnTarjeta)) ||
        (nombreRemitente && nombreEnTarjeta && nombreEnTarjeta.includes(nombreRemitente))
      );
      const lat = Number(payload.latitude);
      const lng = Number(payload.longitude);
      const hasValidCoords = !Number.isNaN(lat) && !Number.isNaN(lng);
      if (matchesIdentity && isGpsPayload && hasValidCoords) {
        setAgentCoords({ latitude: lat, longitude: lng, heading: payload.heading ?? null, timestamp: payload.timestamp || Date.now() });
      }
    } catch (e) {
      console.error('AgentCard DataChannel parse error', e);
    }
  });

  // ─── Escuchar eventos de tracks del participante para re-renderizar reactivamente ───
  const [, setTrackUpdate] = useState(0);
  useEffect(() => {
    const handleUpdate = () => setTrackUpdate(c => c + 1);
    participant.on('trackPublished', handleUpdate);
    participant.on('trackSubscribed', handleUpdate);
    participant.on('trackUnpublished', handleUpdate);
    participant.on('trackUnsubscribed', handleUpdate);
    participant.on('trackMuted', handleUpdate);
    participant.on('trackUnmuted', handleUpdate);
    return () => {
      participant.off('trackPublished', handleUpdate);
      participant.off('trackSubscribed', handleUpdate);
      participant.off('trackUnpublished', handleUpdate);
      participant.off('trackUnsubscribed', handleUpdate);
      participant.off('trackMuted', handleUpdate);
      participant.off('trackUnmuted', handleUpdate);
    };
  }, [participant]);

  // Buscar publicación de video activa: primero cámara, o cualquier track de video disponible
  const videoTrackRef = Array.from(participant.videoTrackPublications.values()).find(p => p.source === 'camera' && p.track)
    || Array.from(participant.videoTrackPublications.values()).find(p => p.track)
    || Array.from(participant.videoTrackPublications.values())[0];

  const audioTrackRef = Array.from(participant.audioTrackPublications.values()).find(p => p.source === 'microphone' && p.track)
    || Array.from(participant.audioTrackPublications.values()).find(p => p.track)
    || Array.from(participant.audioTrackPublications.values())[0];

  // Fallback GPS global
  const fallbackGps = typeof window !== 'undefined' ? window.__LAST_GPS__ : null;
  let displayCoords = agentCoords;
  if (!displayCoords && fallbackGps?.payload) {
    const fallbackFrom = String(fallbackGps.from || '').trim().toLowerCase();
    const cardName = String(participant.identity || participant.name || '').trim().toLowerCase();
    if (fallbackFrom && cardName && (fallbackFrom === cardName || fallbackFrom.includes(cardName) || cardName.includes(fallbackFrom))) {
      const p = fallbackGps.payload;
      const lat = Number(p.latitude ?? p.lat);
      const lng = Number(p.longitude ?? p.lng);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        displayCoords = { latitude: lat, longitude: lng, heading: p.heading ?? null, timestamp: p.timestamp };
      }
    }
  }

  return (
    <>
      {/* ── Ventana flotante VIDEO ── */}
      {videoFloat && (
        <FloatingWindow
          title={`📹 ${agentName}`}
          onClose={() => setVideoFloat(false)}
          initialWidth={560}
          initialHeight={360}
          initialX={120}
          initialY={100}
        >
          <VideoPanel participant={participant} videoTrackRef={videoTrackRef} />
        </FloatingWindow>
      )}

      {/* ── Ventana flotante MAPA ── */}
      {mapFloat && displayCoords && (
        <FloatingWindow
          title={`🗺️ Mapa — ${agentName}`}
          onClose={() => setMapFloat(false)}
          initialWidth={480}
          initialHeight={400}
          initialX={200}
          initialY={160}
          minWidth={300}
          minHeight={260}
        >
          <TacticalMap displayCoords={displayCoords} is3DMode={is3DMode} setIs3DMode={setIs3DMode} />
        </FloatingWindow>
      )}

      {/* ─────────────────── TARJETA PRINCIPAL ─────────────────── */}
      <div className={`flex flex-col bg-slate-100 border border-slate-200 rounded-2xl overflow-hidden shadow-xl transition-all w-full max-w-4xl mx-auto ${expanded ? '' : 'h-[460px]'}`}>

        {/* Encabezado */}
        <div className="flex items-center justify-between p-4 bg-slate-50 border-b border-slate-200">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-slate-200 rounded-full flex items-center justify-center border border-slate-300">
              <Camera className="w-4 h-4 text-slate-600" />
            </div>
            <div>
              <h3 className="text-slate-900 text-lg font-semibold leading-tight flex items-center gap-2">
                {agentName}
                <span className="flex h-2 w-2 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-300 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-500" />
                </span>
              </h3>
              <p className="text-sky-600 text-xs font-mono uppercase tracking-[0.18em]">Transmisión en vivo</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
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

        {/* ── Reproductor de video ── */}
        <div className="relative bg-slate-950">
          <div className="relative aspect-video bg-black overflow-hidden group">

            {/* VIDEO (placeholder si está en flotante) */}
            {videoFloat ? (
              <div className="absolute inset-0 flex flex-col items-center justify-center bg-slate-900 text-slate-500">
                <PictureInPicture2 className="w-14 h-14 mb-3 opacity-40" />
                <p className="font-mono text-sm">Video en ventana flotante</p>
                <button onClick={() => setVideoFloat(false)} className="mt-3 px-4 py-1.5 text-xs bg-sky-600 text-white rounded-lg hover:bg-sky-500 transition-colors">
                  Cerrar flotante
                </button>
              </div>
            ) : <VideoPanel participant={participant} videoTrackRef={videoTrackRef} />}

            {/* ── Barra de controles inferior estilo YouTube ── */}
            <div className="absolute inset-x-0 bottom-0 px-4 pb-3 pt-8 bg-gradient-to-t from-black/80 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-200">
              {/* Barra de progreso decorativa (stream en vivo) */}
              <div className="h-1 rounded-full bg-slate-600/70 overflow-hidden mb-3">
                <div className="h-full bg-red-500 animate-pulse" style={{ width: '100%' }} />
              </div>

              {/* Botones de control */}
              <div className="flex items-center gap-3">
                {/* Volumen */}
                <button
                  onClick={() => setIsMuted(!isMuted)}
                  className={`p-1.5 rounded-lg transition-colors ${isMuted ? 'text-red-400 hover:text-red-300' : 'text-white hover:text-slate-300'}`}
                  title={isMuted ? 'Activar audio' : 'Silenciar audio'}
                >
                  {isMuted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
                </button>

                <span className="text-white font-mono text-xs ml-1 font-semibold">{agentName}</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-red-500/90 px-2.5 py-0.5 text-[10px] font-semibold uppercase tracking-widest text-white">
                  <span className="h-1.5 w-1.5 rounded-full bg-white animate-pulse" />
                  EN VIVO
                </span>

                <div className="flex-1" />

                {/* PiP Video */}
                <button
                  onClick={() => setVideoFloat(!videoFloat)}
                  className={`p-1.5 rounded-lg transition-colors ${videoFloat ? 'text-sky-400' : 'text-white hover:text-slate-300'}`}
                  title="Ventana flotante (arrastrable)"
                >
                  <PictureInPicture2 className="w-5 h-5" />
                </button>

                {/* Expandir tarjeta */}
                {!expanded ? (
                  <button onClick={() => setLocalExpanded(true)} className="p-1.5 rounded-lg text-white hover:text-slate-300 transition-colors" title="Expandir">
                    <Maximize2 className="w-5 h-5" />
                  </button>
                ) : (
                  <button onClick={() => setLocalExpanded(false)} className="p-1.5 rounded-lg text-white hover:text-slate-300 transition-colors" title="Restaurar">
                    <Minimize2 className="w-5 h-5" />
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>

        {/* Audio (oculto) */}
        {!isMuted && audioTrackRef && (
          <AudioTrack trackRef={{ participant, source: 'microphone', publication: audioTrackRef }} />
        )}

        {/* ── Pie: Mini-Mapa GPS ── */}
        <div className="p-4 bg-slate-950 border-t border-slate-800">
          <div className="rounded-2xl border border-slate-300 bg-white overflow-hidden relative" style={{ height: expanded ? '200px' : '140px' }}>
            {displayCoords ? (
              mapFloat ? (
                /* Placeholder cuando el mapa está flotando */
                <div className="flex flex-col items-center justify-center h-full bg-slate-900 text-slate-500 font-mono text-xs gap-2">
                  <MapIcon className="w-8 h-8 opacity-40" />
                  <span>Mapa en ventana flotante</span>
                  <button onClick={() => setMapFloat(false)} className="mt-1 px-3 py-1 text-xs bg-sky-600 text-white rounded-lg hover:bg-sky-500 transition-colors">
                    Cerrar flotante
                  </button>
                </div>
              ) : (
                <TacticalMap displayCoords={displayCoords} is3DMode={is3DMode} setIs3DMode={setIs3DMode} />
              )
            ) : (
              <div className="flex flex-col items-center justify-center h-full text-slate-400 font-mono text-sm bg-slate-100">
                <MapPin className="w-8 h-8 mb-2 opacity-50 animate-bounce" />
                Esperando señal GPS...
              </div>
            )}

            {/* Botón PiP del Mapa */}
            {displayCoords && !mapFloat && (
              <button
                onClick={() => setMapFloat(true)}
                className="absolute bottom-2 right-2 z-[500] p-1.5 rounded-lg bg-slate-900/80 text-slate-300 border border-slate-700/50 hover:bg-slate-800 backdrop-blur-md shadow-lg transition-colors"
                title="Mapa en ventana flotante"
              >
                <PictureInPicture2 className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      </div>
    </>
  );
};

export default AgentCard;
