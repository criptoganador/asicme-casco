import { useState } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import '@livekit/components-styles';
import LoginView from './components/LoginView';
import LiveView from './components/LiveView';
import SplashScreen from './components/SplashScreen';

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [agentName, setAgentName] = useState('');
  const [token, setToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [cameraConfig, setCameraConfig] = useState(undefined);

  const getBestCamera = async () => {
    try {
      // 1. Pedir permiso para obtener los nombres reales de las cámaras
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      
      // 2. Enumerar todas las cámaras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      // 3. Buscar cámara externa (USB/UVC)
      const externalCam = videoDevices.find(d => 
        d.label.toLowerCase().includes('usb') || 
        d.label.toLowerCase().includes('uvc') ||
        d.label.toLowerCase().includes('external')
      );

      // Apagar la cámara temporal usada para el permiso
      stream.getTracks().forEach(track => track.stop());

      if (externalCam) {
        console.log('Cámara externa detectada:', externalCam.label);
        return { deviceId: externalCam.deviceId };
      }
      
      // 4. Fallback a cámara trasera
      console.log('Usando cámara trasera por defecto');
      return { facingMode: 'environment' };
    } catch (e) {
      console.warn('Error detectando cámaras, usando trasera por defecto:', e);
      return { facingMode: 'environment' };
    }
  };

  const handleConnect = async (name) => {
    setIsConnecting(true);
    setError('');
    
    try {
      const bestCam = await getBestCamera();
      
      // Usamos la misma sala que la app de PC
      const response = await fetch(`${import.meta.env.VITE_API_URL}/api/token?roomName=vigilancia-global&participantName=${encodeURIComponent(name)}`);
      
      if (!response.ok) {
        throw new Error('No se pudo conectar al servidor');
      }
      
      const data = await response.json();
      
      if (data.token) {
        setCameraConfig(bestCam);
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
          video={true} // Empezar a transmitir cámara
          audio={true} // Empezar a transmitir micrófono
          options={{
            videoCaptureDefaults: cameraConfig || { facingMode: 'environment' }
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
