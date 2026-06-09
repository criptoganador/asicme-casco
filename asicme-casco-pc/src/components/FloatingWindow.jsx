import { useState, useRef, useEffect, useCallback } from 'react';
import { X, Minus, Maximize2, Minimize2, GripVertical } from 'lucide-react';

/**
 * FloatingWindow - Ventana flotante arrastrable y redimensionable.
 * Se renderiza en un portal sobre el resto de la UI (z-index 9999).
 */
const FloatingWindow = ({
  title,
  children,
  onClose,
  initialWidth = 480,
  initialHeight = 320,
  initialX = 80,
  initialY = 80,
  minWidth = 280,
  minHeight = 200,
}) => {
  const [pos, setPos] = useState({ x: initialX, y: initialY });
  const [size, setSize] = useState({ w: initialWidth, h: initialHeight });
  const [isMinimized, setIsMinimized] = useState(false);
  const [isMaximized, setIsMaximized] = useState(false);
  const [prevState, setPrevState] = useState(null);

  const isDragging = useRef(false);
  const isResizing = useRef(false);
  const dragOffset = useRef({ x: 0, y: 0 });
  const resizeStart = useRef({ x: 0, y: 0, w: 0, h: 0 });
  const windowRef = useRef(null);

  // ── Drag ─────────────────────────────────────────────────────────────────
  const onDragMouseDown = useCallback((e) => {
    if (isMaximized) return;
    isDragging.current = true;
    dragOffset.current = {
      x: e.clientX - pos.x,
      y: e.clientY - pos.y,
    };
    e.preventDefault();
  }, [isMaximized, pos]);

  // ── Resize ────────────────────────────────────────────────────────────────
  const onResizeMouseDown = useCallback((e) => {
    if (isMaximized) return;
    isResizing.current = true;
    resizeStart.current = {
      x: e.clientX,
      y: e.clientY,
      w: size.w,
      h: size.h,
    };
    e.preventDefault();
    e.stopPropagation();
  }, [isMaximized, size]);

  useEffect(() => {
    const onMouseMove = (e) => {
      if (isDragging.current) {
        setPos({
          x: Math.max(0, e.clientX - dragOffset.current.x),
          y: Math.max(0, e.clientY - dragOffset.current.y),
        });
      }
      if (isResizing.current) {
        const dx = e.clientX - resizeStart.current.x;
        const dy = e.clientY - resizeStart.current.y;
        setSize({
          w: Math.max(minWidth, resizeStart.current.w + dx),
          h: Math.max(minHeight, resizeStart.current.h + dy),
        });
      }
    };

    const onMouseUp = () => {
      isDragging.current = false;
      isResizing.current = false;
    };

    window.addEventListener('mousemove', onMouseMove);
    window.addEventListener('mouseup', onMouseUp);
    return () => {
      window.removeEventListener('mousemove', onMouseMove);
      window.removeEventListener('mouseup', onMouseUp);
    };
  }, [minWidth, minHeight]);

  // ── Maximizar / Restaurar ─────────────────────────────────────────────────
  const toggleMaximize = () => {
    if (isMaximized) {
      // Restaurar
      setPos(prevState.pos);
      setSize(prevState.size);
      setPrevState(null);
      setIsMaximized(false);
    } else {
      // Guardar estado actual y maximizar
      setPrevState({ pos, size });
      setPos({ x: 0, y: 0 });
      setSize({ w: window.innerWidth, h: window.innerHeight });
      setIsMaximized(true);
    }
  };

  const currentHeight = isMinimized ? 48 : size.h;

  return (
    <div
      ref={windowRef}
      style={{
        position: 'fixed',
        left: pos.x,
        top: pos.y,
        width: size.w,
        height: currentHeight,
        zIndex: 9999,
        borderRadius: isMaximized ? 0 : 16,
        overflow: 'hidden',
        boxShadow: '0 25px 60px rgba(0,0,0,0.45)',
        display: 'flex',
        flexDirection: 'column',
        transition: isMaximized ? 'all 0.2s ease' : 'height 0.15s ease',
        userSelect: 'none',
        border: '1px solid rgba(148,163,184,0.25)',
      }}
    >
      {/* ── Barra de título (drag handle) ── */}
      <div
        onMouseDown={onDragMouseDown}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '0 12px',
          height: 48,
          minHeight: 48,
          background: 'rgba(15,23,42,0.97)',
          backdropFilter: 'blur(12px)',
          cursor: isMaximized ? 'default' : 'grab',
          flexShrink: 0,
          borderBottom: '1px solid rgba(51,65,85,0.8)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <GripVertical size={14} color="#94a3b8" />
          <span style={{
            color: '#f1f5f9',
            fontSize: 13,
            fontWeight: 600,
            fontFamily: 'monospace',
            letterSpacing: '0.05em',
          }}>
            {title}
          </span>
          <span style={{
            background: '#ef4444',
            color: 'white',
            fontSize: 9,
            fontWeight: 700,
            padding: '1px 6px',
            borderRadius: 99,
            letterSpacing: '0.12em',
          }}>
            LIVE
          </span>
        </div>

        <div style={{ display: 'flex', gap: 6 }}>
          {/* Minimizar */}
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={() => setIsMinimized(!isMinimized)}
            style={btnStyle('#334155')}
            title={isMinimized ? 'Restaurar' : 'Minimizar'}
          >
            <Minus size={12} />
          </button>
          {/* Maximizar / Restaurar */}
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={toggleMaximize}
            style={btnStyle('#334155')}
            title={isMaximized ? 'Restaurar' : 'Maximizar'}
          >
            {isMaximized ? <Minimize2 size={12} /> : <Maximize2 size={12} />}
          </button>
          {/* Cerrar */}
          <button
            onMouseDown={(e) => e.stopPropagation()}
            onClick={onClose}
            style={btnStyle('#991b1b', '#dc2626')}
            title="Cerrar ventana flotante"
          >
            <X size={12} />
          </button>
        </div>
      </div>

      {/* ── Contenido ── */}
      {!isMinimized && (
        <div style={{ flex: 1, overflow: 'hidden', position: 'relative', background: '#000' }}>
          {children}
        </div>
      )}

      {/* ── Resize handle (esquina inferior derecha) ── */}
      {!isMinimized && !isMaximized && (
        <div
          onMouseDown={onResizeMouseDown}
          style={{
            position: 'absolute',
            bottom: 0,
            right: 0,
            width: 18,
            height: 18,
            cursor: 'nwse-resize',
            background: 'transparent',
            zIndex: 10,
          }}
        >
          {/* Indicador visual de resize */}
          <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
            <line x1="6" y1="18" x2="18" y2="6" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="10" y1="18" x2="18" y2="10" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
            <line x1="14" y1="18" x2="18" y2="14" stroke="#64748b" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </div>
      )}
    </div>
  );
};

// Estilo para botones de la barra de título
const btnStyle = (bg, hoverBg) => ({
  width: 24,
  height: 24,
  borderRadius: 6,
  border: 'none',
  background: bg,
  color: '#cbd5e1',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  cursor: 'pointer',
  transition: 'background 0.15s',
  padding: 0,
});

export default FloatingWindow;
