import { useState, useEffect } from 'react';
import { Shield, Wifi, ChevronDown, ChevronUp, Usb } from 'lucide-react';
import { registerPlugin } from '@capacitor/core';

const UsbBridge = registerPlugin('UsbBridge');

const LoginView = ({ onConnect }) => {
  const [agentName, setAgentName] = useState('');
  const [showIpOptions, setShowIpOptions] = useState(false);
  const [ipCamUrl, setIpCamUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (agentName.trim().length > 0) {
      onConnect(agentName.trim(), ipCamUrl.trim(), isCameraConnected);
    }
  };

  const [isCameraConnected, setIsCameraConnected] = useState(false);
  const [deviceDetails, setDeviceDetails] = useState(null);

  useEffect(() => {
    // 1. Escuchar el evento en tiempo real enviado desde Java
    const usbListener = UsbBridge.addListener('onUsbStateChange', (info) => {
      console.log("Cambio de estado USB detectado:", info);
      
      if (info.status === 'connected') {
        setIsCameraConnected(true);
        setDeviceDetails(info);
      } else {
        setIsCameraConnected(false);
        setDeviceDetails(null);
      }
    });

    // 2. Verificación opcional al montar el componente por primera vez
    UsbBridge.checkDevice().then((res) => {
      if (res.hasDevices) {
        console.log("Ya hay un dispositivo conectado al iniciar la app.");
        // Podríamos intentar recuperar detalles si el plugin nativo los enviara en checkDevice, 
        // pero por ahora solo marcamos que hay un dispositivo.
        setIsCameraConnected(true);
      }
    }).catch(e => console.log("Error consultando plugin:", e));

    return () => {
      usbListener.remove();
    };
  }, []);

  return (
    <div className="flex flex-col h-full items-center justify-center p-6 relative">
      {/* Fondo Decorativo */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/40 via-zinc-950 to-zinc-950 pointer-events-none"></div>
      
      <div className="w-full max-w-sm z-10 flex flex-col items-center">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/10 border border-emerald-500/20">
          <Shield className="w-10 h-10 text-emerald-500" />
        </div>
        
        <h1 className="text-3xl font-bold text-zinc-100 mb-2 tracking-tight">AsicMe Casco</h1>
        <p className="text-zinc-500 mb-6 text-center">Transmisión de campo en tiempo real</p>

        {/* USB Camera Status Banner */}
        <div className={`w-full p-4 rounded-2xl border mb-8 flex items-center justify-between transition-colors duration-300 ${
          isCameraConnected 
            ? 'bg-emerald-500/10 border-emerald-500/30' 
            : 'bg-zinc-900 border-zinc-800'
        }`}>
          <div className="flex items-center gap-3">
            <div className={`p-2 rounded-xl ${isCameraConnected ? 'bg-emerald-500/20 text-emerald-500' : 'bg-zinc-800 text-zinc-500'}`}>
              <Usb className="w-5 h-5" />
            </div>
            <div className="flex flex-col">
              <span className={`text-sm font-bold ${isCameraConnected ? 'text-emerald-500' : 'text-zinc-400'}`}>
                {isCameraConnected ? 'CÁMARA CONECTADA' : 'Cámara Externa Desconectada'}
              </span>
              {isCameraConnected && deviceDetails && (
                <span className="text-[10px] text-emerald-500/70">
                  {deviceDetails.deviceName || `ID: ${deviceDetails.productId}`}
                </span>
              )}
              {!isCameraConnected && (
                <span className="text-[10px] text-zinc-600">
                  Conecte el cable OTG
                </span>
              )}
            </div>
          </div>
          {isCameraConnected && (
            <div className="w-2.5 h-2.5 bg-emerald-500 rounded-full animate-pulse shadow-[0_0_10px_rgba(16,185,129,0.8)]"></div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="w-full flex flex-col gap-4">
          {/* Campo: Nombre del agente */}
          <div className="flex flex-col gap-2">
            <label htmlFor="agentName" className="text-sm font-medium text-zinc-400 ml-1">
              Nombre del Agente
            </label>
            <input
              id="agentName"
              type="text"
              value={agentName}
              onChange={(e) => setAgentName(e.target.value)}
              placeholder="Ej. Jhoan, Alexis..."
              className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl px-5 py-4 text-lg text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-emerald-500 transition-colors shadow-inner"
              required
            />
          </div>

          {/* Sección: Cámara IP (expandible) */}
          <button
            type="button"
            onClick={() => setShowIpOptions(!showIpOptions)}
            className="flex items-center justify-between w-full text-sm text-zinc-500 hover:text-zinc-300 transition-colors py-1 px-1"
          >
            <span className="flex items-center gap-2">
              <Wifi className="w-4 h-4" />
              Usar cámara IP / Wi-Fi (opcional)
            </span>
            {showIpOptions ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>

          {showIpOptions && (
            <div className="flex flex-col gap-2 animate-in slide-in-from-top-2 duration-200">
              <label htmlFor="ipCamUrl" className="text-xs font-medium text-zinc-400 ml-1">
                URL de la cámara <span className="text-zinc-600">(HLS, RTSP vía proxy, o HTTP)</span>
              </label>
              <input
                id="ipCamUrl"
                type="url"
                value={ipCamUrl}
                onChange={(e) => setIpCamUrl(e.target.value)}
                placeholder="http://192.168.1.100/stream.m3u8"
                className="w-full bg-zinc-900 border-2 border-zinc-800 rounded-2xl px-5 py-3 text-sm text-zinc-100 placeholder:text-zinc-600 focus:outline-none focus:border-sky-500 transition-colors shadow-inner"
              />
              <p className="text-[11px] text-zinc-600 ml-1">
                💡 Para RTSP usa un proxy HLS (ej. Mediamtx). Soporta: HLS (.m3u8), HTTP streams, WebRTC relays.
              </p>
            </div>
          )}

          <button
            type="submit"
            disabled={!agentName.trim()}
            className="w-full bg-emerald-600 text-white font-bold text-lg py-4 rounded-2xl shadow-lg shadow-emerald-900/40 hover:bg-emerald-500 active:scale-95 transition-all disabled:opacity-50 disabled:active:scale-100 mt-4"
          >
            Conectar al Centro de Mando
          </button>
        </form>
      </div>
    </div>
  );
};

export default LoginView;
