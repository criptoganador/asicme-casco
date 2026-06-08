import { useEffect, useState } from 'react';

/**
 * SplashScreen - Presentación profesional animada en dos fases:
 * Fase 1: Logo de empresa (ASICME STUDIO) ~2s
 * Fase 2: Logo de la app (ASICME CASCO) ~2s
 * Fase 3: Fade-out y entrega el control a la app
 */
const SplashScreen = ({ onFinish }) => {
  // step: 'studio-in' | 'studio-visible' | 'studio-out' | 'app-in' | 'app-visible' | 'app-out' | 'done'
  const [step, setStep] = useState('studio-in');

  useEffect(() => {
    const timers = [];

    // FASE 1: Logo Studio
    timers.push(setTimeout(() => setStep('studio-visible'), 50));   // Fuerza repaint para disparar transición
    timers.push(setTimeout(() => setStep('studio-out'),    1800));  // Empezar a desaparecer
    timers.push(setTimeout(() => setStep('app-in'),        2400));  // Cambiar al logo de la app
    timers.push(setTimeout(() => setStep('app-visible'),   2450));  // Disparar fade-in del logo app
    timers.push(setTimeout(() => setStep('app-out'),       4200));  // Empezar a desaparecer logo app
    timers.push(setTimeout(() => {                                   // Entregar control a la app
      setStep('done');
      onFinish();
    }, 4800));

    return () => timers.forEach(clearTimeout);
  }, [onFinish]);

  // Estilos compartidos de contenedor
  const containerStyle = {
    position: 'fixed',
    inset: 0,
    background: '#09090b',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 9999,
    transition: 'opacity 0.6s ease-in-out',
  };

  const isStudio = ['studio-in', 'studio-visible', 'studio-out'].includes(step);
  const studioVisible = step === 'studio-visible';
  const appVisible = step === 'app-visible';

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 9999, background: '#09090b' }}>

      {/* ── FASE 1: ASICME STUDIO ── */}
      <div
        style={{
          ...containerStyle,
          opacity: isStudio ? (studioVisible ? 1 : 0) : 0,
          transform: studioVisible ? 'scale(1)' : 'scale(0.92)',
          transition: 'opacity 0.6s ease-in-out, transform 0.6s ease-out',
          pointerEvents: 'none',
        }}
      >
        {/* Halo de fondo */}
        <div style={{
          position: 'absolute',
          width: '320px',
          height: '320px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.12) 0%, transparent 70%)',
          filter: 'blur(40px)',
        }} />

        {/* Logo empresa */}
        <div style={{
          width: '130px',
          height: '130px',
          borderRadius: '28px',
          overflow: 'hidden',
          boxShadow: '0 0 60px rgba(16,185,129,0.2), 0 20px 60px rgba(0,0,0,0.5)',
          marginBottom: '28px',
          position: 'relative',
        }}>
          <img
            src="/logo-empresa.png"
            alt="Asicme Studio"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        {/* Texto ASICME STUDIO */}
        <div style={{ textAlign: 'center' }}>
          <p style={{
            fontSize: '11px',
            letterSpacing: '6px',
            color: '#10b981',
            fontFamily: 'system-ui, sans-serif',
            fontWeight: '700',
            textTransform: 'uppercase',
            marginBottom: '6px',
            opacity: studioVisible ? 1 : 0,
            transition: 'opacity 0.5s ease-in-out 0.3s',
          }}>
            PRESENTA
          </p>
          <h1 style={{
            fontSize: '28px',
            fontWeight: '800',
            color: '#f4f4f5',
            letterSpacing: '3px',
            fontFamily: 'system-ui, sans-serif',
            textTransform: 'uppercase',
            margin: 0,
          }}>
            ASICME<span style={{ color: '#10b981' }}> STUDIO</span>
          </h1>
          {/* Línea decorativa */}
          <div style={{
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #10b981, transparent)',
            marginTop: '14px',
            width: studioVisible ? '180px' : '0px',
            transition: 'width 0.8s ease-in-out 0.4s',
            margin: '14px auto 0',
          }} />
        </div>
      </div>

      {/* ── FASE 2: ASICME CASCO ── */}
      <div
        style={{
          ...containerStyle,
          opacity: !isStudio ? (appVisible ? 1 : 0) : 0,
          transform: appVisible ? 'scale(1)' : 'scale(0.92)',
          transition: 'opacity 0.6s ease-in-out, transform 0.6s ease-out',
          pointerEvents: 'none',
        }}
      >
        {/* Halo de fondo */}
        <div style={{
          position: 'absolute',
          width: '360px',
          height: '360px',
          borderRadius: '50%',
          background: 'radial-gradient(circle, rgba(16,185,129,0.15) 0%, transparent 70%)',
          filter: 'blur(50px)',
        }} />

        {/* Logo App */}
        <div style={{
          width: '150px',
          height: '150px',
          borderRadius: '32px',
          overflow: 'hidden',
          boxShadow: '0 0 80px rgba(16,185,129,0.25), 0 30px 80px rgba(0,0,0,0.6)',
          marginBottom: '32px',
          border: '1px solid rgba(16,185,129,0.2)',
        }}>
          <img
            src="/logo-app-casco.png"
            alt="Asicme Casco"
            style={{ width: '100%', height: '100%', objectFit: 'cover' }}
          />
        </div>

        {/* Texto ASICME CASCO */}
        <div style={{ textAlign: 'center' }}>
          <h1 style={{
            fontSize: '32px',
            fontWeight: '800',
            color: '#f4f4f5',
            letterSpacing: '2px',
            fontFamily: 'system-ui, sans-serif',
            textTransform: 'uppercase',
            margin: '0 0 8px',
          }}>
            ASICME<span style={{ color: '#10b981' }}> CASCO</span>
          </h1>
          <p style={{
            fontSize: '12px',
            letterSpacing: '4px',
            color: '#52525b',
            fontFamily: 'system-ui, sans-serif',
            fontWeight: '500',
            textTransform: 'uppercase',
            opacity: appVisible ? 1 : 0,
            transition: 'opacity 0.5s ease-in-out 0.3s',
          }}>
            VIGILANCIA EN TIEMPO REAL
          </p>
          {/* Línea decorativa */}
          <div style={{
            height: '2px',
            background: 'linear-gradient(90deg, transparent, #10b981, transparent)',
            width: appVisible ? '200px' : '0px',
            transition: 'width 0.8s ease-in-out 0.4s',
            margin: '16px auto 0',
          }} />
        </div>
      </div>
    </div>
  );
};

export default SplashScreen;
