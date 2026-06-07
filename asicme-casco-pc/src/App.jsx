import React, { useState, useEffect } from 'react';
import { LiveKitRoom, useDataChannel } from '@livekit/components-react';
import { LayoutGrid, Map as MapIcon } from 'lucide-react';
import '@livekit/components-styles';
import Sidebar from './components/Sidebar';
import AgentGrid from './components/AgentGrid';
import GlobalMap from './components/GlobalMap';

function MainLayout({ selectedAgentId, onSelectAgent, activeTab, setActiveTab }) {
  const [agentLocations, setAgentLocations] = useState({});

  // Escuchar el DataChannel para las coordenadas GPS
  useDataChannel((msg) => {
    try {
      const payload = JSON.parse(new TextDecoder().decode(msg.payload));
      if (payload.type === 'gps' && msg.from) {
        setAgentLocations(prev => ({
          ...prev,
          [msg.from.identity]: { lat: payload.lat, lng: payload.lng }
        }));
      }
    } catch (e) {
      console.error('Error parseando mensaje de DataChannel', e);
    }
  });

  return (
    <div className="flex h-screen w-full bg-zinc-950 text-zinc-100 overflow-hidden font-sans">
      <Sidebar 
        selectedAgentId={selectedAgentId} 
        onSelectAgent={onSelectAgent}
        agentLocations={agentLocations}
      />
      <main className="flex-1 flex flex-col relative h-full">
        {/* Pestañas (Tabs) Nav */}
        <div className="bg-zinc-900 border-b border-zinc-800 px-6 py-3 flex gap-4 z-30">
          <button 
            onClick={() => setActiveTab('grid')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'grid' 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Cámaras en Vivo
          </button>
          <button 
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'map' 
                ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/20' 
                : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700 hover:text-zinc-200'
            }`}
          >
            <MapIcon className="w-4 h-4" />
            Mapa Global
          </button>
        </div>

        {/* Contenido Principal */}
        <div className="flex-1 flex flex-col w-full h-full relative overflow-hidden">
          {activeTab === 'grid' ? (
            <AgentGrid selectedAgentId={selectedAgentId} agentLocations={agentLocations} />
          ) : (
            <GlobalMap agentLocations={agentLocations} />
          )}
        </div>
      </main>
    </div>
  );
}

function App() {
  const [selectedAgentId, setSelectedAgentId] = useState(null);
  const [token, setToken] = useState('');
  const [activeTab, setActiveTab] = useState('grid'); // 'grid' | 'map'

  useEffect(() => {
    const fetchToken = async () => {
      try {
        const response = await fetch(`${import.meta.env.VITE_API_URL}/api/token?roomName=vigilancia-global&participantName=CommandCenter`);
        const data = await response.json();
        if (data.token) {
          setToken(data.token);
        }
      } catch (e) {
        console.error('Error obteniendo token de LiveKit:', e);
      }
    };
    fetchToken();
  }, []);

  const handleSelectAgent = (id) => {
    setSelectedAgentId(id);
    if (id !== null) {
      setActiveTab('grid'); // Al seleccionar un agente, forzamos la vista de video
    }
  };

  return (
    <div className="w-full h-full bg-zinc-950">
      {token === '' ? (
        <div className="flex h-screen items-center justify-center text-zinc-500 gap-4">
           <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin"></div>
           <p>Conectando al servidor central...</p>
        </div>
      ) : (
        <LiveKitRoom
          video={false} // PC no transmite video
          audio={true}  // PC transmite audio bidireccional
          token={token}
          serverUrl={import.meta.env.VITE_LIVEKIT_URL}
          style={{ '--lk-bg': 'transparent' }}
        >
          <MainLayout 
            selectedAgentId={selectedAgentId}
            onSelectAgent={handleSelectAgent}
            activeTab={activeTab}
            setActiveTab={setActiveTab}
          />
        </LiveKitRoom>
      )}
    </div>
  );
}

export default App;
