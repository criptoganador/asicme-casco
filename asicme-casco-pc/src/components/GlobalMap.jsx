import { useParticipants } from '@livekit/components-react';
import { MapContainer, TileLayer, Marker, Popup } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';

// Función para crear un marcador HTML personalizado parecido al estilo anterior
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
    className: 'bg-transparent border-none', // Elimina los estilos por defecto de Leaflet
    iconSize: [40, 40],
    iconAnchor: [20, 40], // El punto de anclaje (la punta del pin)
    popupAnchor: [0, -40] // Dónde aparece el popup relativo al pin
  });
};

const GlobalMap = ({ agentLocations, selectedAgentId }) => {
  const participants = useParticipants();
  
  // Filtramos al Operador (CommandCenter)
  const agents = participants.filter(p => p.identity !== 'CommandCenter');
  const displayedAgents = selectedAgentId ? agents.filter(agent => agent.identity === selectedAgentId) : agents;

  // Centro por defecto (ej: Centro de México o 0,0 si prefieres todo el mundo)
  const defaultCenter = [19.4326, -99.1332]; 
  const defaultZoom = selectedAgentId ? 12 : 3;

  // Buscar la ubicación del agente o de los agentes mostrados
  const validLocations = displayedAgents
    .map(a => agentLocations?.[a.identity])
    .filter(loc => loc && loc.lat !== undefined && loc.lng !== undefined);
  
  const mapCenter = validLocations.length > 0 
    ? [validLocations[0].lat, validLocations[0].lng] 
    : defaultCenter;
  
  const mapZoom = validLocations.length > 0 ? (selectedAgentId ? 14 : 3) : defaultZoom;
  const title = selectedAgentId ? 'RADAR DEL AGENTE' : 'RADAR TÁCTICO GLOBAL';
  const subtitle = selectedAgentId
    ? `Ubicación de ${displayedAgents[0]?.name || displayedAgents[0]?.identity || 'este agente'}`
    : `SISTEMA ACTIVO • ${agents.length} AGENTES MONITOREADOS`;
  const hasLocation = validLocations.length > 0;

  return (
    <div className="flex-1 relative w-full h-full bg-white">
      
      {/* HUD Superior (Z-Index alto para estar sobre el mapa) */}
      <div className="absolute top-6 left-6 z-[1000] flex flex-col gap-2 pointer-events-none">
        <h2 className="text-2xl font-bold text-slate-900 tracking-wider drop-shadow-sm">
          {title}
        </h2>
        <div className="text-sm font-mono text-emerald-600 animate-pulse drop-shadow-sm bg-white/70 backdrop-blur-md px-3 py-1.5 rounded-lg w-fit border border-emerald-200">
          {subtitle}
        </div>
      </div>

      {selectedAgentId && !hasLocation && (
        <div className="absolute inset-0 z-[1001] flex items-center justify-center bg-white/80 p-6">
          <div className="rounded-[2rem] border border-slate-200 bg-white p-8 text-center shadow-xl shadow-slate-200/30">
            <p className="text-lg font-semibold text-slate-900">Esperando ubicación del agente</p>
            <p className="mt-2 text-sm text-slate-500">Aún no hemos recibido datos GPS de este agente. El video está activo pero la localización llega después.</p>
          </div>
        </div>
      )}

      {/* Contenedor de Leaflet */}
      <MapContainer 
        center={mapCenter} 
        zoom={mapZoom} 
        style={{ height: '100%', width: '100%', position: 'absolute', top: 0, left: 0, zIndex: 0 }}
        zoomControl={true}
      >
        {/* Usamos el mapa estándar de OpenStreetMap para asegurar visibilidad */}
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />

        {displayedAgents.map((agent) => {
          const location = agentLocations?.[agent.identity];
          
          // Si no tiene ubicación aún, no lo dibujamos en el mapa real
          if (!location) return null;

          const isLive = true;
          const icon = createCustomIcon(isLive, true);

          return (
            <Marker 
              key={agent.identity} 
              position={[location.lat, location.lng]}
              icon={icon}
            >
              <Popup className="custom-popup">
                <div className="font-bold text-slate-900 text-sm flex items-center gap-2 mb-1">
                  {agent.name || agent.identity}
                  {isLive && <span className="w-2 h-2 rounded-full animate-pulse bg-emerald-500"></span>}
                </div>
                <div className="text-xs font-bold text-emerald-600 mb-2 border-b border-slate-200 pb-1">
                  SEGUIMIENTO GPS ACTIVO
                </div>
                <div className="text-[10px] text-slate-600 font-mono leading-tight">
                  Lat: {location.lat.toFixed(6)}<br/>
                  Lng: {location.lng.toFixed(6)}
                </div>
              </Popup>
            </Marker>
          );
        })}
      </MapContainer>

    </div>
  );
};

export default GlobalMap;
