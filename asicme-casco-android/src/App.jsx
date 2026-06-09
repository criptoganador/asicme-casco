import { useState } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import '@livekit/components-styles';
import { BackgroundMode } from '@anuradev/capacitor-background-mode';
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
  const [rtspUrl, setRtspUrl] = useState('');

  const getBestCamera = async () => {
    try {
      // 1. Pedir permiso para obtener los nombres reales de las cámaras
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      
      // 2. Enumerar todas las cámaras
      const devices = await navigator.mediaDevices.enumerateDevices();
      const videoDevices = devices.filter(device => device.kind === 'videoinput');
      
      // 3. Buscar cámara externa (USB/UVC/HDMI capturador)
      const EXTERNAL_KEYWORDS = [
        'usb', 'uvc', 'external',
        'capture', 'hdmi', 'elgato', 'magewell', 'avermedia',
        'cam link', 'camlink', 'video capture', 'capture card',
        'obs virtual', 'manycam', 'droidcam'
      ];
      const externalCam = videoDevices.find(d =>
        EXTERNAL_KEYWORDS.some(kw => d.label.toLowerCase().includes(kw))
      );

      // Apagar la cámara temporal usada para el permiso
      stream.getTracks().forEach(track => track.stop());

      if (externalCam) {
        const useUSB = window.confirm('Se ha detectado una cámara externa USB/OTG conectada.\n\n¿Deseas usar esta cámara para la transmisión?');
        if (useUSB) {
          console.log('Usando cámara externa:', externalCam.label);
          return { deviceId: externalCam.deviceId };
        } else {
          console.log('Usuario rechazó cámara externa, usando trasera');
          return { facingMode: 'environment' };
        }
      } else {
        const usePhone = window.confirm('No se detectó ninguna cámara USB/OTG conectada.\n\n¿Deseas usar la cámara trasera del teléfono?');
        if (usePhone) {
          console.log('Usando cámara trasera por defecto');
          return { facingMode: 'environment' };
        } else {
          throw new Error('USER_CANCELLED');
        }
      }
    } catch (e) {
      if (e.message === 'USER_CANCELLED') {
        throw new Error('Conexión cancelada. No se seleccionó ninguna cámara.', { cause: e });
      }
      console.warn('Error detectando cámaras, usando trasera por defecto:', e);
      return { facingMode: 'environment' };
    }
  };

  const handleConnect = async (name, ipCamUrl = '') => {
    setIsConnecting(true);
    setError('');
    
    try {
      // Si el usuario ingresó una URL de cámara IP, la usamos directamente
      let bestCam;
      if (ipCamUrl) {
        setRtspUrl(ipCamUrl);
        bestCam = null; // LiveView manejará el stream por canvas
      } else {
        setRtspUrl('');
        bestCam = await getBestCamera();
      }

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
        setCameraConfig(bestCam);
        setToken(data.token);
        setAgentName(name);

        // Activar modo segundo plano con delay: esperar que LiveKit termine de iniciar
        // antes de arrancar el Foreground Service para evitar el ANR de Android
        setTimeout(async () => {
          try {
            await BackgroundMode.enable({
              title: 'Asicme Casco',
              text: 'Transmitiendo al Centro de Mando',
              hidden: false,
              silent: true,
              disableWebViewOptimization: false
            });
          } catch (e) {
            console.error("No se pudo iniciar el modo segundo plano", e);
          }
        }, 3000); // Esperar 3 segundos a que LiveKit y la cámara estén estables

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

  const handleDisconnect = async () => {
    setToken('');
    setAgentName('');
    try {
      await BackgroundMode.disable();
    } catch (e) {
      console.error("Error al desactivar el modo segundo plano", e);
    }
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
          video={!rtspUrl} // Si es cámara IP, desactivamos la captura estándar
          audio={true}
          options={{
            videoCaptureDefaults: {
              ...(cameraConfig || { facingMode: 'environment' }),
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
          <LiveView agentName={agentName} onDisconnect={handleDisconnect} rtspUrl={rtspUrl} />
        </LiveKitRoom>
      )}
    </div>
  );
}

export default App;
