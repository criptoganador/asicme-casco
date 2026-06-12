import { useState, useEffect, useRef } from 'react';
import { Terminal, X, Minimize2, Trash2 } from 'lucide-react';

const ConsoleLogger = () => {
  const [logs, setLogs] = useState([]);
  const [isMinimized, setIsMinimized] = useState(false);
  const [isVisible, setIsVisible] = useState(true);
  const logsEndRef = useRef(null);

  useEffect(() => {
    // Referencias a las funciones originales
    const originalLog = console.log;
    const originalWarn = console.warn;
    const originalError = console.error;
    const originalInfo = console.info;

    // Interceptor genérico
    const interceptor = (type, originalFn) => (...args) => {
      // Llamar al original para que siga funcionando DevTools si se conectara
      originalFn(...args);
      
      // Parsear los argumentos a texto
      const parsedArgs = args.map(arg => {
        if (typeof arg === 'object') {
          try {
            // Intentar evitar errores circulares o en objetos de tipo DOM
            return JSON.stringify(arg, null, 2);
          } catch {
            return `[Object ${arg?.constructor?.name || 'Unknown'}]`;
          }
        }
        return String(arg);
      });

      const message = parsedArgs.join(' ');
      const timestamp = new Date().toLocaleTimeString('en-US', { hour12: false });

      setLogs(prevLogs => {
        // Mantener solo los últimos 150 mensajes para no saturar la memoria
        const newLogs = [...prevLogs, { type, message, timestamp }];
        if (newLogs.length > 150) {
          return newLogs.slice(newLogs.length - 150);
        }
        return newLogs;
      });
    };

    console.log = interceptor('log', originalLog);
    console.warn = interceptor('warn', originalWarn);
    console.error = interceptor('error', originalError);
    console.info = interceptor('info', originalInfo);

    return () => {
      // Restaurar las funciones originales al desmontar
      console.log = originalLog;
      console.warn = originalWarn;
      console.error = originalError;
      console.info = originalInfo;
    };
  }, []);

  useEffect(() => {
    // Auto-scroll al último mensaje si no está minimizado
    if (!isMinimized && logsEndRef.current) {
      logsEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [logs, isMinimized]);

  if (!isVisible) return null;

  const getColorClass = (type) => {
    switch (type) {
      case 'error': return 'text-red-400';
      case 'warn': return 'text-yellow-400';
      case 'info': return 'text-sky-400';
      default: return 'text-zinc-300';
    }
  };

  if (isMinimized) {
    return (
      <button
        onClick={() => setIsMinimized(false)}
        className="fixed bottom-4 right-4 z-[9999] bg-zinc-900/90 text-zinc-300 border border-zinc-700/50 p-3 rounded-full shadow-lg backdrop-blur-md hover:bg-zinc-800 transition-all flex items-center gap-2"
      >
        <Terminal className="w-5 h-5" />
        {logs.length > 0 && (
          <span className="bg-emerald-500 text-white text-[10px] font-bold px-2 py-0.5 rounded-full animate-pulse">
            {logs.length}
          </span>
        )}
      </button>
    );
  }

  return (
    <div className="fixed top-4 left-4 right-4 z-[9999] bg-zinc-950/90 backdrop-blur-md border border-zinc-800 rounded-xl shadow-2xl flex flex-col transition-all overflow-hidden" style={{ maxHeight: '40vh' }}>
      
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 bg-zinc-900/50 border-b border-zinc-800">
        <div className="flex items-center gap-2">
          <Terminal className="w-4 h-4 text-emerald-500" />
          <span className="text-xs font-bold text-zinc-300 font-mono tracking-widest uppercase">Console</span>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={() => setLogs([])} className="text-zinc-500 hover:text-red-400 transition-colors" title="Limpiar Logs">
            <Trash2 className="w-4 h-4" />
          </button>
          <div className="w-[1px] h-4 bg-zinc-700"></div>
          <button onClick={() => setIsMinimized(true)} className="text-zinc-500 hover:text-zinc-300 transition-colors" title="Minimizar">
            <Minimize2 className="w-4 h-4" />
          </button>
          <button onClick={() => setIsVisible(false)} className="text-zinc-500 hover:text-red-400 transition-colors" title="Cerrar permanentemente">
            <X className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Log Body */}
      <div className="flex-1 overflow-y-auto p-3 font-mono text-[10px] sm:text-xs leading-relaxed custom-scrollbar">
        {logs.length === 0 ? (
          <div className="text-zinc-600 text-center py-4">No hay logs registrados aún.</div>
        ) : (
          logs.map((log, index) => (
            <div key={index} className={`mb-1 pb-1 border-b border-zinc-800/50 last:border-0 break-words ${getColorClass(log.type)}`}>
              <span className="text-zinc-600 mr-2 shrink-0">[{log.timestamp}]</span>
              <span>{log.message}</span>
            </div>
          ))
        )}
        <div ref={logsEndRef} />
      </div>

      <style>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(0, 0, 0, 0.2);
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(82, 82, 91, 0.5);
          border-radius: 4px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(82, 82, 91, 0.8);
        }
      `}</style>
    </div>
  );
};

export default ConsoleLogger;
