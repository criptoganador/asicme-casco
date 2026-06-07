import React, { useState } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import '@livekit/components-styles';
import LoginView from './components/LoginView';
import LiveView from './components/LiveView';

function App() {
  const [agentName, setAgentName] = useState('');
  const [token, setToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async (name) => {
    setIsConnecting(true);
    setError('');
    
    try {
      // Usamos la misma sala que la app de PC
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/token?roomName=vigilancia-global&participantName=${encodeURIComponent(name)}`);
      
      if (!response.ok) {
        throw new Error('No se pudo conectar al servidor');
      }
      
      const data = await response.json();
      
      if (data.token) {
        setToken(data.token);
        setAgentName(name);
      } else {
        throw new Error('Token no recibido');
      }
    } catch (err) {
      console.error(err);
      setError(err.message || 'Error de conexión');
    } finally {
      setIsConnecting(false);
    }
  };

  const handleDisconnect = () => {
    setToken('');
    setAgentName('');
  };

  return (
    <div className="w-screen h-screen overflow-hidden bg-zinc-950 font-sans">
      {!token ? (
        <div className="relative h-full">
          {isConnecting && (
            <div className="absolute inset-0 bg-zinc-950/80 z-50 flex flex-col items-center justify-center">
              <div className="w-12 h-12 border-4 border-emerald-500/30 border-t-emerald-500 rounded-full animate-spin mb-4"></div>
              <p className="text-zinc-100 font-medium">Conectando al servidor central...</p>
            </div>
          )}
          
          {error && (
            <div className="absolute top-4 left-4 right-4 bg-red-500/20 border border-red-500/50 text-red-200 px-4 py-3 rounded-xl z-40 text-center text-sm">
              {error}
            </div>
          )}
          
          <LoginView onConnect={handleConnect} />
        </div>
      ) : (
        <LiveKitRoom
          video={true} // Empezar a transmitir cámara
          audio={true} // Empezar a transmitir micrófono
          token={token}
          serverUrl={import.meta.env.VITE_LIVEKIT_URL}
          className="h-full w-full"
          onDisconnected={handleDisconnect}
        >
          <LiveView agentName={agentName} onDisconnect={handleDisconnect} />
        </LiveKitRoom>
      )}
    </div>
  );
}

export default App;
