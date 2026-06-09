
import AgentCard from './AgentCard';
import { useParticipants } from '@livekit/components-react';

const AgentGrid = ({ selectedAgentId }) => {
  // Obtenemos todos los participantes de LiveKit nativamente
  const participants = useParticipants();
  
  // Filtramos al Operador (CommandCenter) para solo ver a los Agentes
  const agents = participants.filter(p => p.identity !== 'CommandCenter');

  // Si hay un agente seleccionado, solo mostramos ese a pantalla completa (o grande)
  const displayedAgents = selectedAgentId 
    ? agents.filter(agent => agent.identity === selectedAgentId)
    : agents;

  if (displayedAgents.length === 0) {
    return (
      <div className="flex-1 flex flex-col items-center justify-center h-full px-6">
        <div className="max-w-xl w-full rounded-[2rem] border border-sky-200/40 bg-white/95 p-10 text-center shadow-2xl shadow-sky-900/10">
          <div className="mx-auto flex h-20 w-20 items-center justify-center rounded-full bg-sky-100 border border-sky-200 mb-5">
            <span className="text-3xl font-bold text-sky-700">•</span>
          </div>
          <h2 className="text-2xl font-semibold text-slate-900">Sin transmisiones activas</h2>
          <p className="mt-3 text-sm leading-6 text-slate-500">
            Verifica que los agentes estén conectados al canal de LiveKit. Cuando haya transmisiones, aparecerán aquí en tiempo real.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex-1 p-6 overflow-y-auto custom-scrollbar bg-slate-50/10 ${
      displayedAgents.length === 1
        ? 'flex items-center justify-center'
        : 'grid gap-6 grid-cols-1 xl:grid-cols-2 2xl:grid-cols-3 auto-rows-max'
    }`}>
      {displayedAgents.map(agent => (
        <AgentCard 
          key={agent.identity} 
          participant={agent} 
          isExpanded={displayedAgents.length === 1}
        />
      ))}
    </div>
  );
};

export default AgentGrid;
