import { useState } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import '@livekit/components-styles';
import LoginView from './components/LoginView';
import LiveView from './components/LiveView';
import SplashScreen from './components/SplashScreen';
import ConsoleLogger from './components/ConsoleLogger';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [agentName, setAgentName] = useState('');
  const [token, setToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');

  const handleConnect = async (name) => {
    setIsConnecting(true);
    setError('');
    
    try {
      // Validar que la URL del servidor esté configurada
      const apiUrl = import.meta.env.VITE_API_URL;
      if (!apiUrl) {
        throw new Error('Servidor no configurado. Contacta al administrador.');
      }

      // Usamos la misma sala que la app de PC
      const response = await fetch(
        `${apiUrl}/api/token?roomName=vigilancia-global&participantName=${encodeURIComponent(name)}`
      );
      
      // Verificar que la respuesta sea JSON y no una página HTML de error
      const contentType = response.headers.get('content-type') || '';
      if (!response.ok || !contentType.includes('application/json')) {
        throw new Error(`Error del servidor (${response.status}). Verifica que el servidor esté activo.`);
      }
      
      const data = await response.json();
      
      if (data.token) {
        setToken(data.token);
        setAgentName(name);

        // El keep-alive de segundo plano se maneja via AudioContext en LiveView

      } else {
        throw new Error('El servidor no devolvió un token válido.');
      }
    } catch (err) {
      console.error(err);
      // Diferenciar errores de red vs errores de lógica
      if (err instanceof TypeError && err.message.includes('fetch')) {
        setError('No se pudo contactar al servidor. Verifica tu conexión a internet.');
      } else {
        setError(err.message || 'Error de conexión desconocido.');
      }
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
      <ConsoleLogger />
      {showSplash && <SplashScreen onFinish={() => setShowSplash(false)} />}
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
          video={true}
          audio={true}
          options={{
            videoCaptureDefaults: {
              facingMode: 'environment',
              resolution: { width: 1280, height: 720 }, // Forzar 720p máximo
              frameRate: { max: 20 } // Limitar a 20 FPS para reducir calentamiento
            },
            audioCaptureDefaults: {
              noiseSuppression: true,
              echoCancellation: true,
              autoGainControl: true,
            },
            publishDefaults: {
              videoSimulcast: false, // ¡Vital para móviles! Desactiva las 3 capas de codificación
              videoCodec: 'vp8', // Usa codec con soporte de hardware común
              videoBitrate: 800000 // Límite de 800 kbps
            }
          }}
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
