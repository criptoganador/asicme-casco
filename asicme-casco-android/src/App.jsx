import { useState, useEffect, useRef } from 'react';
import { LiveKitRoom } from '@livekit/components-react';
import '@livekit/components-styles';
import LoginView from './components/LoginView';
import LiveView from './components/LiveView';
import SplashScreen from './components/SplashScreen';
import { registerPlugin } from '@capacitor/core';

const UvcCamera = registerPlugin('UvcCamera');

function App() {
  const [showSplash, setShowSplash] = useState(true);
  const [agentName, setAgentName] = useState('');
  const [token, setToken] = useState('');
  const [isConnecting, setIsConnecting] = useState(false);
  const [error, setError] = useState('');
  const [rtspUrl, setRtspUrl] = useState('');
  const [usbDeviceInfo, setUsbDeviceInfo] = useState(null); // Info del dispositivo USB conectado
  // usbCamPending: URL detectada antes de login, para aplicarla después
  const [sensorStatus, setSensorStatus] = useState({
    status: 'DESCONECTADO',
    fps: 0,
    frames: 0,
    message: ''
  });

  const usbCamPendingRef = useRef(null);

  const handleForzarEncendido = async () => {
    console.log('⚡ [ForzarEncendido] Solicitando forzar encendido del sensor USB...');
    try {
      setSensorStatus(prev => ({ ...prev, status: 'ENCENDIENDO', message: 'Re-activando sensor...' }));
      await UvcCamera.forzarEncendido();
    } catch (e) {
      console.warn('Error al forzar encendido:', e);
    }
  };

  // Efecto para escuchar la desconexión / conexión en caliente de la cámara USB
  useEffect(() => {
    const connectedListener = UvcCamera.addListener('onUsbCameraConnected', (data) => {
      console.log('🔗 [Plug & Play] Cámara UVC detectada por evento en caliente.');
      if (data && data.streamUrl) {
        // Guardar información del dispositivo
        setUsbDeviceInfo({
          type:         data.deviceType     || 'Dispositivo de video USB',
          brand:        data.deviceBrand    || 'Desconocido',
          product:      data.deviceProduct  || '',
          manufacturer: data.manufacturer   || '',
          vidPid:       data.vidPid         || '',
          codec:        data.codec          || 'Detectando...',
          transferType: data.transferType   || '?',
        });
        setSensorStatus({ status: 'ENCENDIENDO', fps: 0, frames: 0, message: 'Sensor detectado, activando...' });
        if (token) {
          // Ya está conectado: aplicar el stream con delay para que el servidor tenga frames
          setTimeout(() => {
            console.log('🔗 [Plug & Play] Activando stream UVC en caliente...');
            setRtspUrl(data.streamUrl);
          }, 2000);
        } else {
          // Aún no conectado: guardar pendiente para aplicar después del login
          usbCamPendingRef.current = data.streamUrl;
          console.log('🔗 [Plug & Play] Stream USB guardado como pendiente, esperando login...');
        }
      }
    });

    const disconnectedListener = UvcCamera.addListener('onUsbCameraDisconnected', () => {
      console.warn('🔌 [Plug & Play] Cámara UVC desconectada, regresando a cámara del teléfono...');
      usbCamPendingRef.current = null;
      setUsbDeviceInfo(null);
      setSensorStatus({ status: 'DESCONECTADO', fps: 0, frames: 0, message: '' });
      setRtspUrl('');
    });

    const infoUpdatedListener = UvcCamera.addListener('onUsbCameraInfoUpdated', (data) => {
      console.log('ℹ️ [DeviceInfo] Códec y formato UVC actualizados en tiempo real:', data);
      if (data) {
        setUsbDeviceInfo(prev => ({
          type:         data.deviceType     || prev?.type || 'Dispositivo de video USB',
          brand:        data.deviceBrand    || prev?.brand || 'Desconocido',
          product:      data.deviceProduct  || prev?.product || '',
          manufacturer: data.manufacturer   || prev?.manufacturer || '',
          vidPid:       data.vidPid         || prev?.vidPid || '',
          codec:        data.codec          || prev?.codec || 'Detectando...',
          transferType: data.transferType   || prev?.transferType || '?',
        }));
      }
    });

    const sensorStatusListener = UvcCamera.addListener('onUsbSensorStatus', (data) => {
      console.log('📡 [SensorStatus] Estado del sensor:', data);
      if (data) {
        setSensorStatus({
          status: data.status || 'DESCONECTADO',
          fps: data.fps || 0,
          frames: data.frames || 0,
          message: data.message || ''
        });
      }
    });

    return () => {
      connectedListener.then(l => l.remove());
      disconnectedListener.then(l => l.remove());
      infoUpdatedListener.then(l => l.remove());
      sensorStatusListener.then(l => l.remove());
    };
  }, [token]);

  const handleConnect = async (name, ipCamUrl = '', deviceInfo = null) => {
    setIsConnecting(true);
    setError('');
    
    // Si viene con info de dispositivo USB desde startCamera(), guardarlo
    if (deviceInfo) {
      setUsbDeviceInfo(deviceInfo);
    }

    // ipCamUrl puede ser:
    //   - URL de cámara IP manual del usuario
    //   - URL del servidor MJPEG local USB (http://127.0.0.1:8080)
    //   - vacío: NO usamos cámara del teléfono, esperamos la USB
    if (ipCamUrl && !ipCamUrl.startsWith('http://127.0.0.1')) {
      // Cámara IP externa — sin delay
      setRtspUrl(ipCamUrl);
    } else if (ipCamUrl && ipCamUrl.startsWith('http://127.0.0.1')) {
      // Cámara USB — pequeño delay para que el servidor MJPEG esté listo
      setTimeout(() => {
        console.log('📷 [USB] Activando stream de cámara USB:', ipCamUrl);
        setRtspUrl(ipCamUrl);
      }, 500);
    } else if (usbCamPendingRef.current) {
      // Si hay una cámara USB detectada antes del login, aplicar ahora
      const pendingUrl = usbCamPendingRef.current;
      usbCamPendingRef.current = null;
      setTimeout(() => {
        console.log('📷 [USB] Activando stream USB pendiente:', pendingUrl);
        setRtspUrl(pendingUrl);
      }, 500);
    }
    // NOTA: Si no hay cámara USB, NO activamos la cámara del teléfono.
    // El agente deberá conectar la cámara USB por OTG.
    
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
          video={false}

          audio={true}
          options={{
            audioCaptureDefaults: {
              noiseSuppression: true,
              echoCancellation: true,
              autoGainControl: true,
            },
            publishDefaults: {
              videoSimulcast: false,
              videoCodec: 'vp8',
              videoBitrate: 800000
            }
          }}
          token={token}
          serverUrl={import.meta.env.VITE_LIVEKIT_URL}
          className="h-full w-full"
          onDisconnected={handleDisconnect}
        >
          <LiveView
            agentName={agentName}
            onDisconnect={handleDisconnect}
            rtspUrl={rtspUrl}
            usbDeviceInfo={usbDeviceInfo}
            sensorStatus={sensorStatus}
            onForzarEncendido={handleForzarEncendido}
          />
        </LiveKitRoom>
      )}
    </div>
  );
}

export default App;
