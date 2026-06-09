import { Users, WifiOff } from 'lucide-react';
import { useParticipants } from '@livekit/components-react';
import MicrophoneSelector from './MicrophoneSelector';

const Sidebar = ({ selectedAgentId, onSelectAgent, agentLocations }) => {
  // Obtenemos todos los participantes de LiveKit nativamente
  const participants = useParticipants();
  
  // Filtramos para no mostrar al propio "CommandCenter" en la lista de agentes
  const agents = participants.filter(p => p.identity !== 'CommandCenter');

  return (
    <aside className="w-80 flex flex-col h-full bg-gradient-to-br from-sky-600 via-blue-600 to-indigo-700 shadow-2xl shadow-sky-900/25 z-20">
      <div className="flex h-full flex-col rounded-r-[2rem] bg-white shadow-sm overflow-hidden">
          <div className="p-4">
        <button
          onClick={() => onSelectAgent(null)}
          className={`w-full inline-flex items-center justify-center gap-2 py-2 px-4 rounded-full border text-sm transition-all duration-200 font-semibold ${
            selectedAgentId === null
              ? 'bg-sky-700 text-white border-sky-700 shadow-lg shadow-sky-700/20 hover:bg-sky-800'
              : 'bg-white text-sky-900 border-sky-200 hover:border-sky-300 hover:bg-sky-50'
          }`}
        >
          <Users className="w-4 h-4" />
          Mostrar Todos
        </button>
      </div>

      <div className="px-4 pb-2">
        <div className="relative">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-sky-200/70"></div>
          </div>
          <div className="relative flex flex-col items-center gap-2 pt-3">
            <span className="bg-sky-100 px-3 py-1 rounded-full text-[11px] font-semibold uppercase tracking-[0.28em] text-sky-700 shadow-sm shadow-sky-200/20">
              AGENTES EN VIVO
            </span>
            <div className="inline-flex items-center gap-2 rounded-full border border-sky-200 bg-sky-50 px-3 py-1 text-xs text-sky-700 font-medium tracking-[0.14em]">
              <span className="h-2 w-2 rounded-full bg-sky-500 shadow-[0_0_0_8px_rgba(56,189,248,0.15)]"></span>
              {agents.length} conectado{agents.length === 1 ? '' : 's'}
            </div>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar">
        {agents.length === 0 ? (
          <div className="flex h-52 flex-col items-center justify-center rounded-[2.5rem] border border-sky-200/50 bg-white/90 p-6 text-center shadow-xl shadow-sky-900/10">
            <WifiOff className="w-12 h-12 mb-3 text-sky-700/90" />
            <p className="text-lg font-semibold text-slate-900">Sin transmisiones activas</p>
          </div>
        ) : (
          agents.map((agent) => (
            <button
              key={agent.identity}
              onClick={() => onSelectAgent(agent.identity)}
              className={`w-full text-left p-4 rounded-xl transition-all border ${
                selectedAgentId === agent.identity
                  ? 'bg-sky-50 border-sky-500 shadow-lg shadow-sky-500/20'
                  : 'bg-white border-slate-200 hover:border-sky-300 hover:bg-sky-50'
              }`}
            >
              <div className="flex items-center justify-between mb-2">
                <span className={`font-semibold ${selectedAgentId === agent.identity ? 'text-sky-800' : 'text-slate-900'}`}>
                  {agent.name || agent.identity}
                </span>
                <span className="inline-flex items-center gap-2 text-[11px] uppercase tracking-[0.2em] text-sky-700 font-semibold">
                  <span className="flex h-2 w-2 relative">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-sky-300 opacity-75"></span>
                    <span className="relative inline-flex rounded-full h-2 w-2 bg-sky-600"></span>
                  </span>
                  activo
                </span>
              </div>
              <div className="text-xs text-slate-500 flex items-center gap-2 font-mono">
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
      <div className="mt-auto border-t border-slate-200 bg-white/90 pb-4 pt-3">
        <MicrophoneSelector />
      </div>
    </div>
</aside>
  );
};

export default Sidebar;
