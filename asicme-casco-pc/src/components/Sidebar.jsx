import { Users, Video, WifiOff } from 'lucide-react';
import { useParticipants } from '@livekit/components-react';
import MicrophoneSelector from './MicrophoneSelector';

const Sidebar = ({ selectedAgentId, onSelectAgent, agentLocations }) => {
  // Obtenemos todos los participantes de LiveKit nativamente
  const participants = useParticipants();
  
  // Filtramos para no mostrar al propio "CommandCenter" en la lista de agentes
  const agents = participants.filter(p => p.identity !== 'CommandCenter');

  return (
    <aside className="w-80 bg-gradient-to-b from-zinc-950 via-zinc-950 to-zinc-900 border-r border-emerald-500/10 flex flex-col h-full shadow-2xl shadow-black/40 z-20">
      <div className="p-6 border-b border-emerald-500/10 bg-zinc-950/95 backdrop-blur-sm">
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3 tracking-tight">
          <div className="w-10 h-10 bg-emerald-500/15 rounded-2xl flex items-center justify-center border border-emerald-500/25 shadow-sm shadow-emerald-500/10">
            <Video className="w-5 h-5 text-emerald-400" />
          </div>
          AsicMe Casco
        </h1>
        <p className="text-emerald-300 text-sm mt-2 ml-12 font-mono uppercase tracking-[0.18em]">Centro de Mando PC</p>
      </div>

      <div className="p-4">
        <button
          onClick={() => onSelectAgent(null)}
          className={`w-full flex items-center justify-center gap-2 py-2.5 px-4 rounded-lg font-medium transition-colors ${
            selectedAgentId === null
              ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20'
              : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700 hover:text-white'
          }`}
        >
          <Users className="w-4 h-4" />
          Mostrar Todos
        </button>
      </div>

      <div className="px-4 pb-2">
        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-zinc-800"></div>
          </div>
          <div className="relative flex flex-col items-center gap-2 pt-3">
            <span className="bg-emerald-500/15 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.28em] text-emerald-300 shadow-sm shadow-emerald-500/5">
              AGENTES EN VIVO
            </span>
            <div className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-zinc-950/80 px-3 py-1 text-xs text-emerald-200 font-medium tracking-[0.14em]">
              <span className="h-2 w-2 rounded-full bg-emerald-400 shadow-[0_0_0_8px_rgba(16,185,129,0.08)]"></span>
              {agents.length} conectado{agents.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {agents.length === 0 ? (
          <div className="flex h-52 flex-col items-center justify-center rounded-[2rem] border border-emerald-500/10 bg-zinc-950/85 p-6 text-center shadow-xl shadow-emerald-500/5">
            <WifiOff className="w-12 h-12 mb-3 text-emerald-400/80" />
            <p className="text-lg font-semibold text-zinc-100">Sin transmisiones activas</p>
            <p className="mt-2 text-sm leading-6 text-zinc-400">
              Los agentes aparecerán aquí cuando estén conectados y transmitiendo en vivo.
            </p>
            <p className="mt-4 text-xs uppercase tracking-[0.2em] text-emerald-300">
              Comprueba la conexión de LiveKit
            </p>
          </div>
        ) : (
          agents.map((agent) => (
            <button
              key={agent.identity}
              onClick={() => onSelectAgent(agent.identity)}
              className={`w-full text-left p-4 rounded-xl transition-all border ${
                selectedAgentId === agent.identity
                  ? 'bg-emerald-500/10 border-emerald-500/30 shadow-lg shadow-emerald-900/20'
                  : 'bg-zinc-950/50 border-zinc-800/50 hover:border-zinc-700 hover:bg-zinc-800/50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`font-semibold ${selectedAgentId === agent.identity ? 'text-emerald-300' : 'text-zinc-200'}`}>
                  {agent.name || agent.identity}
                </span>
                <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-emerald-300 font-semibold">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                  </span>
                  activo
                </span>
              </div>
              <div className="text-xs text-zinc-500 flex items-center gap-2 font-mono">
                {agentLocations && agentLocations[agent.identity] ? (
                  <>
                    <span>Lat: {agentLocations[agent.identity].lat.toFixed(4)}</span>
                    <span>Lng: {agentLocations[agent.identity].lng.toFixed(4)}</span>
                  </>
                ) : (
                  <>
                    <span>Lat: --</span>
                    <span>Lng: --</span>
                  </>
                )}
              </div>
            </button>
          ))
        )}
      </div>

      {/* Selector de Micrófono (solo visible en Electron) */}
      <div className="mt-auto border-t border-zinc-800 pb-4 pt-3">
        <MicrophoneSelector />
      </div>
    </aside>
  );
};

export default Sidebar;
