import { useEffect, useState } from 'react';
import { Mic, ChevronDown } from 'lucide-react';

/**
 * MicrophoneSelector
 * Muestra un dropdown con los micrófonos disponibles en el sistema.
 * Solo se renderiza cuando la app corre dentro de Electron.
 */
const MicrophoneSelector = () => {
  const [devices, setDevices] = useState([]);
  const [selected, setSelected] = useState('');
  const [isOpen, setIsOpen] = useState(false);

  // Detectamos si estamos en Electron verificando la API expuesta por el preload
  const isElectron = typeof window !== 'undefined' && window.electronAPI?.isElectron;

  useEffect(() => {
    if (!isElectron) return;

    // Pedimos al proceso principal (main.js) la lista de micrófonos
    const loadDevices = async () => {
      try {
        const audioDevices = await window.electronAPI.getAudioDevices();
        setDevices(audioDevices);
        if (audioDevices.length > 0) {
          setSelected(audioDevices[0].deviceId);
        }
      } catch {
        // Fallback: usar la API nativa del navegador
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
          stream.getTracks().forEach(t => t.stop());
          const allDevices = await navigator.mediaDevices.enumerateDevices();
          const mics = allDevices
            .filter(d => d.kind === 'audioinput')
            .map((d, i) => ({ deviceId: d.deviceId, label: d.label || `Micrófono ${i + 1}` }));
          setDevices(mics);
          if (mics.length > 0) setSelected(mics[0].deviceId);
        } catch (err) {
          console.warn('[MicSelector] No se pudieron obtener los dispositivos de audio:', err);
        }
      }
    };

    loadDevices();
  }, [isElectron]);

  // No renderizar si no hay dispositivos o si no estamos en Electron
  if (!isElectron || devices.length <= 1) return null;

  const handleSelect = (deviceId) => {
    setSelected(deviceId);
    setIsOpen(false);
    // Notificamos al proceso principal del Electron
    window.electronAPI.selectMicrophone(deviceId);
    // También disparamos un evento personalizado para que LiveKit pueda reaccionar
    window.dispatchEvent(new CustomEvent('microphone-changed', { detail: { deviceId } }));
  };

  const selectedDevice = devices.find(d => d.deviceId === selected);

  return (
    <div className="relative px-4 py-2">
      <p className="text-[10px] font-mono text-slate-500 uppercase tracking-widest mb-1.5">Micrófono activo</p>
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between gap-2 bg-slate-100 hover:bg-slate-200 border border-slate-200 rounded-lg px-3 py-2 text-sm text-slate-700 transition-colors"
      >
        <div className="flex items-center gap-2 truncate">
          <Mic className="w-3.5 h-3.5 text-emerald-500 flex-shrink-0" />
          <span className="truncate text-xs">
            {selectedDevice?.label || 'Seleccionar micrófono'}
          </span>
        </div>
        <ChevronDown className={`w-3.5 h-3.5 text-slate-400 flex-shrink-0 transition-transform ${isOpen ? 'rotate-180' : ''}`} />
      </button>

      {isOpen && (
        <div className="absolute bottom-full left-4 right-4 mb-1 bg-white border border-slate-200 rounded-xl shadow-2xl z-50 overflow-hidden">
          {devices.map(device => (
            <button
              key={device.deviceId}
              onClick={() => handleSelect(device.deviceId)}
              className={`w-full flex items-center gap-2 px-3 py-2.5 text-left text-xs transition-colors hover:bg-slate-100 ${
                selected === device.deviceId ? 'bg-emerald-50 text-emerald-600' : 'text-slate-700'
              }`}
            >
              <Mic className={`w-3.5 h-3.5 flex-shrink-0 ${selected === device.deviceId ? 'text-emerald-500' : 'text-slate-500'}`} />
              <span className="truncate">{device.label}</span>
              {selected === device.deviceId && (
                <span className="ml-auto text-[10px] font-bold text-emerald-500">ACTIVO</span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MicrophoneSelector;
