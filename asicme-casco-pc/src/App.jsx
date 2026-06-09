import { useState, useEffect } from 'react';
import { LiveKitRoom, useDataChannel, useLocalParticipant } from '@livekit/components-react';
import { LayoutGrid, Map as MapIcon } from 'lucide-react';
import '@livekit/components-styles';
import Sidebar from './components/Sidebar';
import TopHeader from './components/TopHeader';
import AgentGrid from './components/AgentGrid';
import GlobalMap from './components/GlobalMap';

function MicrophoneController() {
  const { localParticipant } = useLocalParticipant();

  useEffect(() => {
    // Encender micrófono al entrar
    if (localParticipant) {
      localParticipant.setMicrophoneEnabled(true).catch(e => console.warn('Error auto-activando mic:', e));
    }

    // Escuchar cambios desde MicrophoneSelector
    const handleMicChange = (e) => {
      const deviceId = e.detail?.deviceId;
      if (localParticipant && deviceId) {
        // Cambiar el dispositivo y asegurar que esté encendido
        localParticipant.setMicrophoneEnabled(true, { deviceId }).catch(console.error);
      }
    };

    window.addEventListener('microphone-changed', handleMicChange);
    return () => window.removeEventListener('microphone-changed', handleMicChange);
  }, [localParticipant]);

  return null;
}

function MainLayout({ selectedAgentId, onSelectAgent, activeTab, setActiveTab }) {
  const [agentLocations, setAgentLocations] = useState({});

  // Escuchar el DataChannel para las coordenadas GPS
  useDataChannel('gps', (msg) => {
    try {
      const payload = JSON.parse(new TextDecoder().decode(msg.payload));
      // store last GPS globally for quick UI fallback
      if (payload && (payload.latitude !== undefined || payload.lat !== undefined)) {
        window.__LAST_GPS__ = {
          from: msg.from?.identity || msg.participant?.identity || null,
          payload
        };
      }

      if (payload.type === 'gps' && msg.from) {
        setAgentLocations(prev => ({
          ...prev,
          [msg.from.identity]: { lat: payload.lat || payload.latitude, lng: payload.lng || payload.longitude }
        }));
      }
    } catch (e) {
      console.error('Error parseando mensaje de DataChannel', e);
    }
  });

  return (
    <div className="flex min-h-screen w-full flex-col bg-white text-slate-900 overflow-hidden font-sans">
      <TopHeader />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar 
          selectedAgentId={selectedAgentId} 
          onSelectAgent={onSelectAgent}
          agentLocations={agentLocations}
        />
        <main className="flex-1 flex flex-col relative h-full">
        {/* Pestañas (Tabs) Nav */}
        <div className="bg-white/90 border-b border-slate-200 px-6 py-3 flex gap-4 z-30">
          <button 
            onClick={() => setActiveTab('grid')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'grid' 
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-500/20' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <LayoutGrid className="w-4 h-4" />
            Cámaras en Vivo
          </button>
          <button 
            onClick={() => setActiveTab('map')}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg font-medium transition-colors ${
              activeTab === 'map' 
                ? 'bg-sky-600 text-white shadow-lg shadow-sky-500/20' 
                : 'bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900'
            }`}
          >
            <MapIcon className="w-4 h-4" />
            Mapa Global
          </button>
        </div>

        {/* Contenido Principal */}
        <div className="flex-1 flex flex-col w-full h-full relative overflow-hidden">
          {activeTab === 'grid' ? (
            <AgentGrid selectedAgentId={selectedAgentId} />
          ) : (
            <GlobalMap selectedAgentId={selectedAgentId} agentLocations={agentLocations} />
          )}
        </div>
      </main>
      </div>
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
    <div className="min-h-screen w-full bg-white">
      {token === '' ? (
        <div className="flex h-screen items-center justify-center text-slate-500 gap-4">
           <div className="w-12 h-12 border-4 border-sky-500/30 border-t-sky-500 rounded-full animate-spin"></div>
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
          <MicrophoneController />
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
