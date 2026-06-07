import React from 'react';
import { Users, Video, WifiOff } from 'lucide-react';
import { useParticipants } from '@livekit/components-react';

const Sidebar = ({ selectedAgentId, onSelectAgent, agentLocations }) => {
  // Obtenemos todos los participantes de LiveKit nativamente
  const participants = useParticipants();
  
  // Filtramos para no mostrar al propio "CommandCenter" en la lista de agentes
  const agents = participants.filter(p => p.identity !== 'CommandCenter');

  return (
    <aside className="w-80 bg-zinc-900 border-r border-zinc-800 flex flex-col h-full shadow-2xl z-20">
      <div className="p-6 border-b border-zinc-800 bg-zinc-950/50">
        <h1 className="text-2xl font-bold text-zinc-100 flex items-center gap-3 tracking-tight">
          <div className="w-8 h-8 bg-emerald-500/20 rounded-lg flex items-center justify-center border border-emerald-500/30">
            <Video className="w-5 h-5 text-emerald-500" />
          </div>
          AsicMe Casco
        </h1>
        <p className="text-zinc-500 text-sm mt-2 ml-11 font-mono">Centro de Mando PC</p>
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
          <div className="relative flex justify-center">
            <span className="bg-zinc-900 px-3 text-xs font-medium text-zinc-500 tracking-wider">
              AGENTES EN VIVO ({agents.length})
            </span>
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-2 custom-scrollbar">
        {agents.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-32 text-zinc-600">
            <WifiOff className="w-8 h-8 mb-2 opacity-50" />
            <p className="text-sm font-medium">No hay transmisiones activas</p>
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
                <span className={`font-semibold ${selectedAgentId === agent.identity ? 'text-emerald-400' : 'text-zinc-200'}`}>
                  {agent.name || agent.identity}
                </span>
                <span className="flex h-3 w-3 relative">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-emerald-500"></span>
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
    </aside>
  );
};

export default Sidebar;
