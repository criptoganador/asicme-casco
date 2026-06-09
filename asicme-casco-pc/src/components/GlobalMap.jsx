import { useState } from 'react';
import { useParticipants } from '@livekit/components-react';
import { MapContainer, TileLayer, Marker as LeafletMarker, Popup as LeafletPopup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import mapboxgl from 'mapbox-gl';
import Map, { Marker as MapboxMarker, NavigationControl, FullscreenControl } from 'react-map-gl/mapbox';
import { Layers, ChevronDown, LocateFixed, Users, Crosshair } from 'lucide-react';

// Fix para el error "import.meta outside a module" de Vite con Mapbox GL v3
import MapboxWorker from 'mapbox-gl/dist/mapbox-gl-csp-worker?worker';
mapboxgl.workerClass = MapboxWorker;

// Componente helper para recentrar en Leaflet sin usar ref en MapContainer
function LeafletFlyToHelper({ flyTarget }) {
  const map = useMap();
  
  if (flyTarget && flyTarget.triggerTime) {
    // Usamos el triggerTime para asegurarnos de que vuela incluso si hace clic en el mismo agente de nuevo
    setTimeout(() => {
      map.flyTo([flyTarget.lat, flyTarget.lng], 17, {
        animate: true,
        duration: 1.5
      });
    }, 50);
  }
  return null;
}

// Función para crear un marcador HTML personalizado 2D
const createCustomIcon = (isLive, hasLocation) => {
  const colorClass = hasLocation ? 'text-emerald-500 drop-shadow-[0_0_10px_rgba(16,185,129,0.8)]' : 'text-yellow-500 opacity-60';
  const bounceClass = isLive ? 'animate-bounce' : '';
  
  const iconHtml = `
    <div class="relative flex flex-col items-center ${bounceClass}">
      <svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 24 24" fill="currentColor" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" class="${colorClass}">
        <path d="M20 10c0 4.993-5.539 10.193-7.399 11.799a1 1 0 0 1-1.202 0C9.539 20.193 4 14.993 4 10a8 8 0 0 1 16 0"/>
        <circle cx="12" cy="10" r="3" fill="#18181b"/>
      </svg>
      <div class="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-black/80 rounded-full blur-[2px]"></div>
    </div>
  `;

  return L.divIcon({
    html: iconHtml,
    className: 'bg-transparent border-none',
    iconSize: [40, 40],
    iconAnchor: [20, 40],
    popupAnchor: [0, -40]
  });
};

let flyTriggerCount = 0;

const GlobalMap = ({ agentLocations, selectedAgentId }) => {
  const [is3DMode, setIs3DMode] = useState(false);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [flyTarget, setFlyTarget] = useState(null); // { lat, lng, triggerTime }
  
  const participants = useParticipants();
  
  // Filtramos al Operador (CommandCenter)
  const agents = participants.filter(p => p.identity !== 'CommandCenter');
  const displayedAgents = selectedAgentId ? agents.filter(agent => agent.identity === selectedAgentId) : agents;

  // Centro por defecto
  const defaultCenter = [19.4326, -99.1332]; 
  const defaultZoom = selectedAgentId ? 12 : 3;

  // Buscar ubicaciones válidas
  const validLocations = displayedAgents
    .map(a => ({ agent: a, loc: agentLocations?.[a.identity] }))
    .filter(data => data.loc && data.loc.lat !== undefined && data.loc.lng !== undefined);
  
  const mapCenter = validLocations.length > 0 
    ? [validLocations[0].loc.lat, validLocations[0].loc.lng] 
    : defaultCenter;
  
  const mapZoom = validLocations.length > 0 ? (selectedAgentId ? 16.5 : 12) : defaultZoom;
  const title = selectedAgentId ? 'RADAR DEL AGENTE' : 'RADAR TÁCTICO GLOBAL';
  const subtitle = selectedAgentId
    ? `Ubicación de ${displayedAgents[0]?.name || displayedAgents[0]?.identity || 'este agente'}`
    : `SISTEMA ACTIVO • ${agents.length} AGENTES MONITOREADOS`;
  const hasLocation = validLocations.length > 0;

  // Función para manejar el "Volver a centrar" en un agente específico
  const handleFlyToAgent = (lat, lng) => {
    setDropdownOpen(false);
    
    // Para Leaflet, disparamos el state (lo captura el Helper)
    if (!is3DMode) {
      flyTriggerCount++;
      setFlyTarget({ lat, lng, triggerTime: flyTriggerCount });
    } else {
      // Para Mapbox, usamos la referencia directa vía DOM hack (muy robusto para este caso)
      const map = document.getElementById('mapbox-global-map')?.__mapInstance;
      if (map) {
        map.flyTo({ center: [lng, lat], zoom: 17, duration: 2000, essential: true });
      }
    }
  };

  return (
    <div className="flex-1 relative w-full h-full bg-white overflow-hidden group/globalmap">
      
      {/* HUD Superior */}
      <div className="absolute top-6 left-6 z-[1000] flex flex-col gap-2 pointer-events-none">
        <h2 className="text-2xl font-bold text-slate-900 tracking-wider drop-shadow-sm flex items-center gap-3">
          <Crosshair className="w-6 h-6 text-emerald-600" />
          {title}
        </h2>
        <div className="text-sm font-mono text-emerald-600 animate-pulse drop-shadow-sm bg-white/70 backdrop-blur-md px-3 py-1.5 rounded-lg w-fit border border-emerald-200">
          {subtitle}
        </div>

        {/* Panel lateral: Selector de Agentes */}
        {!selectedAgentId && hasLocation && (
          <div className="mt-2 pointer-events-auto relative">
            <button
              onClick={() => setDropdownOpen(!dropdownOpen)}
              className="flex items-center gap-2 bg-slate-900/90 text-white px-4 py-2 rounded-xl text-sm font-semibold shadow-lg hover:bg-slate-800 transition-colors border border-slate-700/50 backdrop-blur-md"
            >
              <Users className="w-4 h-4 text-emerald-400" />
              <span>Centrar cámara en...</span>
              <ChevronDown className={`w-4 h-4 transition-transform ${dropdownOpen ? 'rotate-180' : ''}`} />
            </button>
            
            {dropdownOpen && (
              <div className="absolute top-full left-0 mt-2 w-64 bg-slate-900/95 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl overflow-hidden py-2 animate-in slide-in-from-top-2">
                <div className="px-3 pb-2 mb-2 border-b border-slate-800 text-[10px] font-mono text-slate-400 uppercase tracking-widest">
                  Escuadrón Activo
                </div>
                <div className="max-h-64 overflow-y-auto">
                  {validLocations.map(({ agent, loc }) => (
                    <button
                      key={agent.identity}
                      onClick={() => handleFlyToAgent(loc.lat, loc.lng)}
                      className="w-full text-left px-4 py-2.5 hover:bg-slate-800 transition-colors flex items-center justify-between group/btn"
                    >
                      <div className="flex items-center gap-2">
                        <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                        <span className="text-sm text-slate-200 font-semibold">{agent.name || agent.identity}</span>
                      </div>
                      <LocateFixed className="w-4 h-4 text-slate-500 group-hover/btn:text-emerald-400 transition-colors" />
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Botón de alternancia 2D / 3D */}
      <button
        onClick={() => setIs3DMode(!is3DMode)}
        className="absolute top-6 right-6 z-[1000] bg-slate-900/80 backdrop-blur-md border border-slate-700 px-4 py-2 rounded-xl text-sm font-bold text-white shadow-lg hover:bg-slate-800 transition-colors flex items-center gap-2 cursor-pointer"
      >
        <Layers className="w-5 h-5" />
        {is3DMode ? 'CAMBIAR A 2D' : 'CAMBIAR A 3D'}
      </button>

      {selectedAgentId && !hasLocation && (
        <div className="absolute inset-0 z-[1001] flex items-center justify-center bg-white/80 p-6">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/30">
            <p className="text-lg font-semibold text-slate-900">Esperando ubicación del agente</p>
            <p className="mt-2 text-sm text-slate-500">Aún no hemos recibido datos GPS de este agente.</p>
          </div>
        </div>
      )}

      {/* Renderizado Condicional del Mapa */}
      {!is3DMode ? (
        <MapContainer 
          center={mapCenter} 
          zoom={mapZoom} 
          style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }}
          zoomControl={true}
        >
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />

          <LeafletFlyToHelper flyTarget={flyTarget} />

          {validLocations.map(({ agent, loc }) => {
            const isLive = true;
            const icon = createCustomIcon(isLive, true);

            return (
              <LeafletMarker 
                key={agent.identity} 
                position={[loc.lat, loc.lng]}
                icon={icon}
              >
                <LeafletPopup className="custom-popup">
                  <div className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-1">
                    {agent.name || agent.identity}
                    {isLive && <span className="w-2 h-2 rounded-full animate-pulse bg-emerald-500"></span>}
                  </div>
                  <div className="text-xs font-bold text-emerald-600 mb-2 border-b border-slate-200 pb-1">
                    SEGUIMIENTO GPS ACTIVO
                  </div>
                  <div className="text-[10px] text-slate-600 font-mono leading-tight">
                    Lat: {loc.lat.toFixed(6)}<br/>
                    Lng: {loc.lng.toFixed(6)}<br/>
                    {loc.heading !== undefined && loc.heading !== null && `Dir: ${loc.heading}°`}
                  </div>
                </LeafletPopup>
              </LeafletMarker>
            );
          })}
        </MapContainer>
      ) : (
        <Map
          id="mapbox-global-map"
          mapboxAccessToken={import.meta.env.VITE_MAPBOX_TOKEN}
          maxZoom={24}
          scrollZoom={true}
          dragPan={true}
          initialViewState={{
            longitude: Number(mapCenter[1]) || 0,
            latitude: Number(mapCenter[0]) || 0,
            zoom: mapZoom,
            pitch: 60,
            bearing: 0
          }}
          mapStyle="mapbox://styles/mapbox/satellite-streets-v12"
          style={{ width: '100%', height: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }}
          terrain={{ source: 'mapbox-dem', exaggeration: 1.5 }}
          onLoad={(e) => {
            const map = e.target;
            // Guardamos referencia al mapa en el elemento DOM para acceder desde fuera
            document.getElementById('mapbox-global-map').__mapInstance = map;
            
            // Añadir capa de elevación 3D
            if (!map.getSource('mapbox-dem')) {
              map.addSource('mapbox-dem', {
                'type': 'raster-dem',
                'url': 'mapbox://mapbox.mapbox-terrain-dem-v1',
                'tileSize': 512,
                'maxzoom': 14
              });
              map.setTerrain({ 'source': 'mapbox-dem', 'exaggeration': 1.5 });
            }

            // Añadir capa de edificios 3D
            if (!map.getLayer('3d-buildings')) {
              const layers = map.getStyle().layers;
              const labelLayerId = layers.find(
                (layer) => layer.type === 'symbol' && layer.layout['text-field']
              )?.id;

              map.addLayer(
                {
                  'id': '3d-buildings',
                  'source': 'composite',
                  'source-layer': 'building',
                  'filter': ['==', 'extrude', 'true'],
                  'type': 'fill-extrusion',
                  'minzoom': 15,
                  'paint': {
                    'fill-extrusion-color': '#ffffff',
                    'fill-extrusion-height': [
                      'interpolate',
                      ['linear'],
                      ['zoom'],
                      15,
                      0,
                      15.05,
                      ['get', 'height']
                    ],
                    'fill-extrusion-base': [
                      'interpolate',
                      ['linear'],
                      ['zoom'],
                      15,
                      0,
                      15.05,
                      ['get', 'min_height']
                    ],
                    'fill-extrusion-opacity': 0.45
                  }
                },
                labelLayerId
              );
            }
          }}
        >
          <FullscreenControl position="top-left" />
          <NavigationControl position="bottom-right" />
          
          {validLocations.map(({ agent, loc }) => (
            <MapboxMarker 
              key={agent.identity}
              longitude={Number(loc.lng) || 0} 
              latitude={Number(loc.lat) || 0}
              anchor="center"
            >
              <div className="relative flex flex-col items-center">
                 {/* Nombre del Agente en 3D */}
                 <div className="absolute -top-8 whitespace-nowrap bg-slate-900/80 backdrop-blur-sm border border-slate-700 text-white px-2 py-0.5 rounded text-xs font-mono font-bold shadow-lg">
                   {agent.name || agent.identity}
                 </div>

                 {/* Punto y Cono */}
                 <div style={{ transform: `rotate(${Number(loc.heading) || 0}deg)` }} className="relative flex items-center justify-center w-16 h-16">
                    {loc.heading !== null && loc.heading !== undefined && (
                      <div className="absolute w-0 h-0 border-l-[16px] border-l-transparent border-r-[16px] border-r-transparent border-b-[40px] border-b-emerald-500/40 blur-[1px] -top-3"></div>
                    )}
                    <div className="w-4 h-4 bg-emerald-400 rounded-full border-2 border-slate-900 shadow-[0_0_15px_rgba(52,211,153,0.8)] z-10 relative">
                      <div className="absolute inset-0 bg-emerald-400 rounded-full animate-ping opacity-75"></div>
                    </div>
                 </div>
              </div>
            </MapboxMarker>
          ))}
        </Map>
      )}

    </div>
  );
};

export default GlobalMap;
