
import { MapPin } from 'lucide-react';
import { useParticipants } from '@livekit/components-react';

const GlobalMap = ({ agentLocations }) => {
  const participants = useParticipants();
  
  // Filtramos al Operador (CommandCenter)
  const agents = participants.filter(p => p.identity !== 'CommandCenter');

  // Constantes para escalar la Lat/Lng al contenedor
  // Esto es una simplificación matemática para el "Radar" de demostración
  // En un entorno de producción, se usaría WebGL/Mapbox/Leaflet
  const calculatePosition = (location, index, total) => {
    if (location) {
      // Simplemente mapeamos la Lat (-90 a 90) y Lng (-180 a 180) a porcentajes
      // Y las acercamos un poco al centro para evitar que se salgan
      const top = 50 - (location.lat / 90) * 40;
      const left = 50 + (location.lng / 180) * 40;
      return { top: `${top}%`, left: `${left}%` };
    }
    // Si no tiene GPS aún, le asignamos una posición circular decorativa
    const angle = (index * (360 / Math.max(total, 1))) * (Math.PI / 180);
    const radius = 40; 
    return {
      top: `calc(50% + ${Math.sin(angle) * radius}%)`,
      left: `calc(50% + ${Math.cos(angle) * radius}%)`
    };
  };

  return (
    <div className="flex-1 bg-zinc-950 relative overflow-hidden flex items-center justify-center h-full w-full">
      {/* HUD Superior */}
      <div className="absolute top-6 left-6 z-20 flex flex-col gap-2 pointer-events-none">
        <h2 className="text-2xl font-bold text-zinc-100 tracking-wider">RADAR TÁCTICO GLOBAL</h2>
        <div className="text-sm font-mono text-emerald-500 animate-pulse">
          SISTEMA ACTIVO • {agents.length} AGENTES MONITOREADOS
        </div>
      </div>

      {/* Grid 3D de fondo */}
      <div className="absolute inset-0 bg-zinc-950 grid-perspective flex items-center justify-center">
        <div className="relative w-[150%] h-[150%] map-surface bg-[linear-gradient(to_right,#80808012_2px,transparent_2px),linear-gradient(to_bottom,#80808012_2px,transparent_2px)] bg-[size:64px_64px] border border-zinc-800/50 rounded-full shadow-[inset_0_0_150px_rgba(0,0,0,1)]">
          
          {/* Radar Sweep Effect */}
          <div className="absolute top-1/2 left-1/2 w-1/2 h-2 bg-gradient-to-r from-transparent via-emerald-500/30 to-transparent origin-left animate-[spin_4s_linear_infinite] opacity-30"></div>
          
          {/* Círculos concéntricos del radar */}
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[30%] h-[30%] border border-emerald-500/10 rounded-full"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[60%] h-[60%] border border-emerald-500/10 rounded-full"></div>
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[90%] h-[90%] border border-emerald-500/20 rounded-full"></div>

          {agents.map((agent, index) => {
            const isLive = true;
            const location = agentLocations?.[agent.identity];
            const { top, left } = calculatePosition(location, index, agents.length);

            return (
              <div 
                key={agent.identity}
                className="absolute transition-all duration-1000 ease-in-out"
                style={{ top, left, transform: 'translate(-50%, -100%)' }}
              >
                <div className="relative flex flex-col items-center group">
                  {/* Etiqueta flotante permanente con el nombre */}
                  <div className="absolute bottom-full mb-1 bg-zinc-900/80 backdrop-blur-md px-2 py-0.5 rounded border border-zinc-800 text-[10px] font-bold text-zinc-300 z-10">
                    {agent.name || agent.identity}
                  </div>

                  {/* Marcador en el mapa */}
                  <div className={`relative ${isLive ? 'animate-bounce' : ''} z-20`}>
                    <MapPin 
                      className={`w-10 h-10 ${location ? 'text-emerald-500 drop-shadow-[0_0_15px_rgba(16,185,129,0.8)]' : 'text-yellow-500 opacity-60'}`} 
                      fill="currentColor" 
                    />
                    <div className="absolute -bottom-1 left-1/2 -translate-x-1/2 w-4 h-1 bg-black/80 rounded-full blur-[2px]"></div>
                  </div>
                  
                  {/* Tooltip Detallado Hover */}
                  <div className="absolute top-full mt-2 bg-zinc-900/95 backdrop-blur-md px-4 py-2 rounded-xl border border-zinc-700 shadow-2xl opacity-0 group-hover:opacity-100 transition-opacity whitespace-nowrap z-30 pointer-events-none">
                    <div className="font-bold text-zinc-100 text-sm flex items-center gap-2">
                      {agent.name || agent.identity}
                      {isLive && <span className={`w-2 h-2 rounded-full animate-pulse ${location ? 'bg-emerald-500' : 'bg-yellow-500'}`}></span>}
                    </div>
                    <div className={`text-xs font-medium mb-1 ${location ? 'text-emerald-500' : 'text-yellow-500'}`}>
                      {location ? 'SEGUIMIENTO GPS ACTIVO' : 'SIN SEÑAL GPS'}
                    </div>
                    <div className="text-xs text-zinc-400 font-mono">
                      {location ? (
                        <>
                          Lat: {location.lat.toFixed(6)}<br/>
                          Lng: {location.lng.toFixed(6)}
                        </>
                      ) : (
                        <>
                          Lat: Pendiente...<br/>
                          Lng: Pendiente...
                        </>
                      )}
                    </div>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default GlobalMap;
