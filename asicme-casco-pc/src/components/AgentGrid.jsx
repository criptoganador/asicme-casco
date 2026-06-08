
import AgentCard from './AgentCard';
import { useParticipants } from '@livekit/components-react';

const AgentGrid = ({ selectedAgentId, agentLocations }) => {
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
      <div className="flex-1 flex flex-col items-center justify-center text-zinc-500 h-full">
        <div className="w-16 h-16 border-4 border-dashed border-zinc-700 rounded-full mb-4 animate-[spin_10s_linear_infinite]"></div>
        <p className="text-lg">Esperando transmisiones en vivo...</p>
        <p className="text-sm mt-2 opacity-50">Los agentes aparecerán aquí automáticamente</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-6 overflow-y-auto custom-scrollbar bg-zinc-100 grid gap-6 grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 content-start items-start">
      {displayedAgents.map(agent => (
        <AgentCard 
          key={agent.identity} 
          participant={agent} 
          isExpanded={displayedAgents.length === 1}
          location={agentLocations && agentLocations[agent.identity] ? agentLocations[agent.identity] : null}
        />
      ))}
    </div>
  );
};

export default AgentGrid;
