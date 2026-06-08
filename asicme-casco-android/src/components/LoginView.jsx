import { useState } from 'react';
import { Shield } from 'lucide-react';

const LoginView = ({ onConnect }) => {
  const [agentName, setAgentName] = useState('');

  const handleSubmit = (e) => {
    e.preventDefault();
    if (agentName.trim().length > 0) {
      onConnect(agentName.trim());
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
