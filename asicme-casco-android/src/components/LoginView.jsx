import { useState } from 'react';
import { Shield, Wifi, ChevronDown, ChevronUp } from 'lucide-react';

const LoginView = ({ onConnect }) => {
  const [agentName, setAgentName] = useState('');
  const [showIpOptions, setShowIpOptions] = useState(false);
  const [ipCamUrl, setIpCamUrl] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (agentName.trim().length > 0) {
      onConnect(agentName.trim(), ipCamUrl.trim());
    }
  };

  return (
    <div className="flex flex-col h-full items-center justify-center p-6 relative">
      {/* Fondo Decorativo */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-zinc-800/40 via-zinc-950 to-zinc-950 pointer-events-none"></div>
      
      <div className="w-full max-w-sm z-10 flex flex-col items-center">
        <div className="w-20 h-20 bg-emerald-500/10 rounded-3xl flex items-center justify-center mb-6 shadow-lg shadow-emerald-500/10 border border-emerald-500/20">
          <Shield className="w-10 h-10 text-emerald-500" />
        </div>
        
        <h1 className="text-3xl font-bold text-zinc-100 mb-2 tracking-tight">AsicMe Casco</h1>
        <p className="text-zinc-500 mb-10 text-center">Transmisión de campo en tiempo real</p>

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
