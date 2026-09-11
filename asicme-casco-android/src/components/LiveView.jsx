import { useState, useEffect, useRef } from 'react';
import { Camera, PhoneOff, Navigation, Wifi, Cpu, ChevronDown, ChevronUp, Usb, Zap, AlertTriangle, Power, Sliders, Sun, Contrast, RotateCcw, X } from 'lucide-react';
import { useRoomContext, RoomAudioRenderer, useLocalParticipant } from '@livekit/components-react';
import { Geolocation } from '@capacitor/geolocation';
import { LocalVideoTrack } from 'livekit-client';
import { registerPlugin } from '@capacitor/core';

const UvcCamera = registerPlugin('UvcCamera');

const LiveView = ({
  agentName,
  onDisconnect,
  rtspUrl = '',
  usbDeviceInfo = null,
  sensorStatus = { status: 'DESCONECTADO', fps: 0, frames: 0, message: '' },
  onForzarEncendido = () => {}
}) => {
  const room = useRoomContext();
  const { localParticipant } = useLocalParticipant();

  const [gpsActive, setGpsActive] = useState(false);
  const [gpsError, setGpsError] = useState(false);
  const [ipCamError, setIpCamError] = useState(false);
  const [ipCamActive, setIpCamActive] = useState(false);
  const [showPreview, setShowPreview] = useState(true);
  const [showDeviceInfo, setShowDeviceInfo] = useState(false); // Panel desplegable con info del dispositivo
  const [showControls, setShowControls] = useState(false);     // Panel de ajustes UVC hardware

  // Estados de controles de hardware UVC
  const [brightness, setBrightness] = useState(50);
  const [contrast, setContrast] = useState(50);
  const [saturation, setSaturation] = useState(50);
  const [sharpness, setSharpness] = useState(50);
  const [awb, setAwb] = useState(true);
  const [selectedRes, setSelectedRes] = useState('640x480');

  // Refs para el modo cámara IP / MJPEG
  const ipMediaRef = useRef(null);
  const canvasRef = useRef(null);
  const ipTrackRef = useRef(null);
  const rafRef = useRef(null);

  const cargarAjustesUvc = async () => {
    try {
      const res = await UvcCamera.getControls();
      if (res) {
        if (typeof res.brightness === 'number' && res.brightness >= 0) setBrightness(res.brightness);
        if (typeof res.contrast === 'number' && res.contrast >= 0) setContrast(res.contrast);
        if (typeof res.saturation === 'number' && res.saturation >= 0) setSaturation(res.saturation);
        if (typeof res.sharpness === 'number' && res.sharpness >= 0) setSharpness(res.sharpness);
        if (typeof res.autoWhiteBalance === 'boolean') setAwb(res.autoWhiteBalance);
      }
    } catch (e) {
      console.warn('No se pudieron leer los controles UVC:', e);
    }
  };

  const handleBrightnessChange = async (val) => {
    setBrightness(val);
    try { await UvcCamera.setBrightness({ value: val }); } catch (e) {}
  };

  const handleContrastChange = async (val) => {
    setContrast(val);
    try { await UvcCamera.setContrast({ value: val }); } catch (e) {}
  };

  const handleSaturationChange = async (val) => {
    setSaturation(val);
    try { await UvcCamera.setSaturation({ value: val }); } catch (e) {}
  };

  const handleSharpnessChange = async (val) => {
    setSharpness(val);
    try { await UvcCamera.setSharpness({ value: val }); } catch (e) {}
  };

  const handleAwbToggle = async () => {
    const nextVal = !awb;
    setAwb(nextVal);
    try { await UvcCamera.setAutoWhiteBalance({ enabled: nextVal }); } catch (e) {}
  };

  const handleResetControls = async () => {
    try {
      await UvcCamera.resetControls();
      setBrightness(50);
      setContrast(50);
      setSaturation(50);
      setSharpness(50);
      setAwb(true);
    } catch (e) {}
  };

  const handleResolutionChange = async (res) => {
    setSelectedRes(res);
    const [w, h] = res.split('x').map(Number);
    if (w && h) {
      try {
        await UvcCamera.setResolution({ width: w, height: h });
      } catch (e) {
        console.warn('Error cambiando resolución:', e);
      }
    }
  };

  const resolutionsList = usbDeviceInfo?.supportedResolutions
    ? usbDeviceInfo.supportedResolutions.split(',').map(s => s.trim()).filter(Boolean)
    : [];

  // ─── Keep-alive en segundo plano ─────────────────────────────────────────────
  useEffect(() => {
    let audioCtx = null;
    let oscillator = null;
    try {
      audioCtx = new AudioContext();
      const gainNode = audioCtx.createGain();
      gainNode.gain.value = 0.00001;
      oscillator = audioCtx.createOscillator();
      oscillator.connect(gainNode);
      gainNode.connect(audioCtx.destination);
      oscillator.start();
      console.log('✅ Keep-alive de audio activo');
    } catch (e) {
      console.warn('Keep-alive de audio no disponible:', e);
    }
    return () => {
      try { oscillator?.stop(); } catch { /* ignorar */ }
      try { audioCtx?.close(); } catch { /* ignorar */ }
    };
  }, []);

  // ─── GPS ────────────────────────────────────────────────────────────────────
  const iniciarTransmisionGPS = async (room) => {
    try {
      const check = await Geolocation.checkPermissions();
      if (check.location !== 'granted') {
        const request = await Geolocation.requestPermissions();
        if (request.location !== 'granted') { setGpsError(true); return; }
      }
      const watchId = await Geolocation.watchPosition({ enableHighAccuracy: true }, (position, err) => {
        if (err) { setGpsError(true); return; }
        const payload = JSON.stringify({
          type: 'gps',
          latitude: position.coords.latitude,
          longitude: position.coords.longitude,
          heading: position.coords.heading,
          timestamp: position.timestamp
        });
        const encoder = new TextEncoder();
        room.localParticipant.publishData(encoder.encode(payload), { reliable: true, topic: 'gps' });
      });
      return watchId;
    } catch (error) {
      console.error('💥 Error fatal GPS:', error);
      setGpsError(true);
    }
  };

  useEffect(() => {
    if (!room) return;
    let activeWatchId;
    const start = async () => {
      activeWatchId = await iniciarTransmisionGPS(room);
      if (activeWatchId) setGpsActive(true);
    };
    start();
    return () => {
      if (activeWatchId) Geolocation.clearWatch({ id: activeWatchId });
    };
  }, [room]);

  // ─── BLOQUEAR CÁMARA DEL TELÉFONO — solo usar cámara USB OTG ────────────────
  useEffect(() => {
    if (!localParticipant) return;
    // Siempre apagar la cámara del teléfono.
    // El video se publica ÚNICAMENTE vía canvas relay (cámara USB).
    const disablePhoneCamera = async () => {
      try {
        await localParticipant.setCameraEnabled(false);
        console.log('📷 [USB-ONLY] Cámara del teléfono desactivada. Solo USB activa.');
      } catch (e) {
        console.warn('No se pudo desactivar cámara del teléfono:', e);
      }
    };
    const t = setTimeout(disablePhoneCamera, 200);
    return () => clearTimeout(t);
  }, [localParticipant]);

  // ─── CÁMARA USB / MJPEG (canvas relay hacia LiveKit) ─────────────────────────
  useEffect(() => {
    if (!rtspUrl || !localParticipant) return;

    const media = ipMediaRef.current;
    const canvas = canvasRef.current;
    if (!media || !canvas) return;

    const isMjpeg = rtspUrl.includes('127.0.0.1') || rtspUrl.endsWith('.mjpg');
    const ctx = canvas.getContext('2d');

    let lastDrawTime = 0;
    const fpsInterval = 1000 / 25;
    let frameCount = 0;
    let hasStarted = false;
    let retryCount = 0;
    const MAX_RETRIES = 5;

    const drawFrame = (timestamp) => {
      rafRef.current = requestAnimationFrame(drawFrame);
      const elapsed = timestamp - lastDrawTime;
      if (elapsed > fpsInterval) {
        lastDrawTime = timestamp - (elapsed % fpsInterval);
        const w = (isMjpeg ? media.naturalWidth : media.videoWidth) || 0;
        const h = (isMjpeg ? media.naturalHeight : media.videoHeight) || 0;
        if (w > 0 && h > 0) {
          if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
          try {
            ctx.drawImage(media, 0, 0, w, h);
            frameCount++;
            if (frameCount % 60 === 0) console.info(`✅ [Relay] UVC: ${w}x${h}`);
          } catch { /* frame en proceso */ }
        }
      }
    };

    const startCanvasRelay = async () => {
      if (hasStarted) return;
      hasStarted = true;
      try {
        canvas.width = 1280; canvas.height = 720;
        ctx.fillStyle = '#000'; ctx.fillRect(0, 0, 1280, 720);
        const canvasStream = canvas.captureStream(25);
        const videoTrack = canvasStream.getVideoTracks()[0];
        const livekitTrack = new LocalVideoTrack(videoTrack, { name: 'ip-camera' });
        await localParticipant.publishTrack(livekitTrack);
        ipTrackRef.current = livekitTrack;
        setIpCamActive(true);
        rafRef.current = requestAnimationFrame(drawFrame);
        console.log('🚀 [Relay] Pista de video UVC publicada en LiveKit');
      } catch (e) {
        console.error('Error publicando stream canvas:', e);
        setIpCamError(true);
      }
    };

    const waitForMjpegAndStart = () => {
      const checkDimensions = () => {
        const w = media.naturalWidth;
        const h = media.naturalHeight;
        if (w > 0 && h > 0) {
          console.log(`✅ [MJPEG] Primer frame: ${w}x${h} — iniciando relay...`);
          startCanvasRelay();
        } else if (retryCount < 60) {
          retryCount++;
          setTimeout(checkDimensions, 500);
        } else {
          console.warn('⚠️ [MJPEG] Timeout, publicando de todas formas...');
          startCanvasRelay();
        }
      };
      setTimeout(checkDimensions, 500);
    };

    media.crossOrigin = 'anonymous';
    if (isMjpeg) {
      console.log('🔗 [Relay] Conectando MJPEG:', rtspUrl);
      media.onerror = () => {
        if (retryCount < MAX_RETRIES) {
          retryCount++;
          setTimeout(() => { media.src = ''; setTimeout(() => { media.src = rtspUrl + '?r=' + Date.now(); }, 300); }, 1000 * retryCount);
        } else { setIpCamError(true); }
      };
      media.onload = () => { if (!hasStarted) startCanvasRelay(); };
      media.src = rtspUrl;
      waitForMjpegAndStart();
    } else {
      media.autoplay = true; media.playsInline = true; media.muted = true;
      media.oncanplay = () => startCanvasRelay();
      media.onerror = () => setIpCamError(true);
      media.src = rtspUrl;
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
      if (ipTrackRef.current) { localParticipant.unpublishTrack(ipTrackRef.current).catch(() => {}); ipTrackRef.current = null; }
      media.src = '';
      setIpCamActive(false);
      setIpCamError(false);
    };
  }, [rtspUrl, localParticipant]);

  // Limpieza total del hardware de la cámara al desmontar la vista
  useEffect(() => {
    return () => {
      try { UvcCamera.stopCamera(); } catch (e) {}
    };
  }, []);

  // Si el sensor se reactiva a ACTIVO tras haber estado en reposo, refrescar img tag
  useEffect(() => {
    if (sensorStatus?.status === 'ACTIVO' && ipMediaRef.current && rtspUrl) {
      const media = ipMediaRef.current;
      if (media.tagName === 'IMG') {
        const timeout = setTimeout(() => {
          if (media.naturalWidth === 0) {
            console.log('🔄 [Relay] Refrescando stream MJPEG reactivado...');
            media.src = rtspUrl + '?t=' + Date.now();
          }
        }, 300);
        return () => clearTimeout(timeout);
      }
    }
  }, [sensorStatus?.status, rtspUrl]);

  const handleHangUp = () => {
    try { UvcCamera.stopCamera(); } catch (e) {}
    room.disconnect();
    onDisconnect();
  };

  return (
    <div className="flex flex-col h-full bg-zinc-950">
      <RoomAudioRenderer />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 bg-zinc-900 border-b border-zinc-800 z-10">
        <div className="flex flex-col">
          <span className="text-xs font-mono text-zinc-500">OPERADOR</span>
          <span className="font-bold text-base text-zinc-100">{agentName}</span>
        </div>
        <div className="flex items-center gap-2">
          {/* Badge GPS */}
          {gpsActive && !gpsError && (
            <div className="flex items-center gap-1 bg-emerald-500/10 px-2 py-1.5 rounded-full border border-emerald-500/20">
              <Navigation className="w-3 h-3 text-emerald-500 animate-pulse" />
              <span className="text-[10px] font-bold text-emerald-500 tracking-wider">GPS</span>
            </div>
          )}
          {gpsError && (
            <div className="flex items-center gap-1 bg-amber-500/10 px-2 py-1.5 rounded-full border border-amber-500/20">
              <Navigation className="w-3 h-3 text-amber-500 opacity-50" />
              <span className="text-[10px] font-bold text-amber-500 tracking-wider">GPS ERROR</span>
            </div>
          )}

          {/* Badge Cámara UVC — toca para ver info del dispositivo */}
          {rtspUrl && !ipCamError && (
            <button
              onClick={() => setShowDeviceInfo(!showDeviceInfo)}
              className="flex items-center gap-1 bg-sky-500/10 px-2 py-1.5 rounded-full border border-sky-500/20 active:scale-95 transition-all"
            >
              <Usb className="w-3 h-3 text-sky-400 animate-pulse" />
              <span className="text-[10px] font-bold text-sky-400 tracking-wider">USB</span>
              {showDeviceInfo
                ? <ChevronUp className="w-3 h-3 text-sky-400" />
                : <ChevronDown className="w-3 h-3 text-sky-400" />}
            </button>
          )}

          {/* Badge de Estado del Sensor UVC */}
          {rtspUrl && sensorStatus?.status === 'ACTIVO' && (
            <div className="flex items-center gap-1.5 bg-emerald-500/10 px-2.5 py-1.5 rounded-full border border-emerald-500/30">
              <span className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse"></span>
              <span className="text-[10px] font-mono font-bold text-emerald-400">
                {sensorStatus.fps > 0 ? `${sensorStatus.fps} FPS` : 'ACTIVO'}
              </span>
            </div>
          )}

          {rtspUrl && sensorStatus?.status === 'ENCENDIENDO' && (
            <div className="flex items-center gap-1.5 bg-amber-500/10 px-2.5 py-1.5 rounded-full border border-amber-500/30">
              <span className="w-2 h-2 rounded-full bg-amber-400 animate-ping"></span>
              <span className="text-[10px] font-bold text-amber-400">ENCENDIENDO...</span>
            </div>
          )}

          {rtspUrl && sensorStatus?.status === 'SIN_RESPUESTA' && (
            <div className="flex items-center gap-1.5 bg-rose-500/10 px-2.5 py-1.5 rounded-full border border-rose-500/30">
              <AlertTriangle className="w-3 h-3 text-rose-400" />
              <span className="text-[10px] font-bold text-rose-400">SIN SEÑAL</span>
            </div>
          )}

          {rtspUrl && ipCamError && (
            <div className="flex items-center gap-1 bg-red-500/10 px-2 py-1.5 rounded-full border border-red-500/20">
              <Wifi className="w-3 h-3 text-red-400 opacity-60" />
              <span className="text-[10px] font-bold text-red-400 tracking-wider">UVC ERROR</span>
            </div>
          )}

          {/* Badge LIVE */}
          <div className="flex items-center gap-2 bg-red-500/10 px-3 py-1.5 rounded-full border border-red-500/20">
            <div className="w-2.5 h-2.5 bg-red-500 rounded-full animate-pulse"></div>
            <span className="text-xs font-bold text-red-500 tracking-wider">EN VIVO</span>
          </div>
        </div>
      </div>

      {/* Panel de información del dispositivo USB (desplegable) */}
      {showDeviceInfo && usbDeviceInfo && (
        <div className="bg-zinc-900/95 border-b border-sky-500/20 px-4 py-3 z-10 animate-in slide-in-from-top-2 duration-200">
          <div className="flex items-center gap-2 mb-2">
            <Cpu className="w-4 h-4 text-sky-400" />
            <span className="text-xs font-bold text-sky-400 tracking-wider uppercase">Dispositivo Detectado</span>
          </div>
          <div className="grid grid-cols-2 gap-x-4 gap-y-1.5">
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Tipo</span>
              <span className="text-xs font-semibold text-zinc-200">{usbDeviceInfo.type}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Marca</span>
              <span className="text-xs font-semibold text-zinc-200">{usbDeviceInfo.brand}</span>
            </div>
            {usbDeviceInfo.product && usbDeviceInfo.product !== usbDeviceInfo.type && (
              <div className="col-span-2">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Producto</span>
                <span className="text-xs font-semibold text-zinc-200">{usbDeviceInfo.product}</span>
              </div>
            )}
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Códec / Formato</span>
              <span className="text-xs font-semibold text-emerald-400">{usbDeviceInfo.codec}</span>
            </div>
            <div>
              <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Transferencia</span>
              <span className={`text-xs font-semibold ${usbDeviceInfo.transferType === 'BULK' ? 'text-violet-400' : 'text-amber-400'}`}>
                {usbDeviceInfo.transferType}
              </span>
            </div>
            {usbDeviceInfo.vidPid && (
              <div className="col-span-2">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Identificador</span>
                <span className="text-[11px] font-mono text-zinc-400">{usbDeviceInfo.vidPid}</span>
              </div>
            )}
            {usbDeviceInfo.supportedResolutions && (
              <div className="col-span-2">
                <span className="text-[10px] text-zinc-500 uppercase tracking-wider block">Resoluciones Hardware</span>
                <span className="text-[11px] font-mono text-emerald-300">{usbDeviceInfo.supportedResolutions}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Área Principal de Video */}
      <div className="flex-1 relative bg-black flex flex-col items-center justify-center overflow-hidden">
        {rtspUrl ? (
          <>
            {/* Si es MJPEG (Cámara USB / Servidor Local) */}
            {rtspUrl.includes('127.0.0.1') || rtspUrl.endsWith('.mjpg') ? (
              <img
                ref={ipMediaRef}
                alt="Vista en vivo USB"
                className={showPreview ? "w-full h-full object-contain z-0" : "opacity-0 absolute pointer-events-none w-1 h-1"}
              />
            ) : (
              <video
                ref={ipMediaRef}
                playsInline autoPlay muted
                className={showPreview ? "w-full h-full object-contain z-0" : "opacity-0 absolute pointer-events-none w-1 h-1"}
              />
            )}

            {/* Canvas auxiliar para capturar stream hacia LiveKit */}
            <canvas
              ref={canvasRef}
              style={{ position: 'absolute', opacity: 0, pointerEvents: 'none', width: 1, height: 1 }}
            />

            {/* Indicador de carga o diagnóstico del sensor USB */}
            {!ipCamActive && !ipCamError && (
              <div className="absolute inset-0 flex flex-col items-center justify-center z-20 bg-black/85 p-6 text-center">
                {sensorStatus?.status === 'SIN_RESPUESTA' ? (
                  <div className="max-w-xs flex flex-col items-center animate-in fade-in zoom-in-95 duration-200">
                    <div className="w-16 h-16 rounded-2xl bg-amber-500/10 border border-amber-500/30 flex items-center justify-center mb-4 text-amber-400 shadow-[0_0_25px_rgba(245,158,11,0.15)]">
                      <AlertTriangle className="w-8 h-8" />
                    </div>
                    <h3 className="text-base font-bold text-zinc-100 mb-1">Cámara USB en Reposo</h3>
                    <p className="text-xs text-zinc-400 mb-2 leading-relaxed">
                      El puerto USB reconoció la cámara ({usbDeviceInfo?.brand || 'BisonCam'}), pero el sensor óptico no está emitiendo video. Puede estar en modo ahorro de energía.
                    </p>
                    <button
                      onClick={onForzarEncendido}
                      className="mt-3 px-5 py-2.5 bg-gradient-to-r from-amber-500 to-amber-600 hover:from-amber-400 hover:to-amber-500 active:scale-95 text-zinc-950 font-bold text-xs rounded-xl shadow-lg shadow-amber-500/20 flex items-center gap-2 transition-all cursor-pointer"
                    >
                      <Zap className="w-4 h-4 fill-current" />
                      <span>Forzar Encendido del Sensor</span>
                    </button>
                    <span className="text-[10px] text-zinc-500 mt-3 font-mono">Envía señal UVC Power Mode (0x01)</span>
                  </div>
                ) : (
                  <>
                    <div className="w-12 h-12 border-4 border-sky-500/30 border-t-sky-500 rounded-full animate-spin mb-4"></div>
                    <p className="text-zinc-200 text-sm font-semibold">
                      {sensorStatus?.status === 'ENCENDIENDO' ? 'Activando sensor de cámara...' : 'Conectando cámara USB...'}
                    </p>
                    {usbDeviceInfo && (
                      <p className="text-sky-400 text-xs mt-1 font-mono">{usbDeviceInfo.type} · {usbDeviceInfo.brand}</p>
                    )}
                    <p className="text-zinc-500 text-xs mt-1">
                      {sensorStatus?.status === 'ENCENDIENDO' ? 'Enviando directivas UVC Power...' : 'Esperando primer fotograma'}
                    </p>
                  </>
                )}
              </div>
            )}

            {/* Modo Headless */}
            {!showPreview && (
              <div className="flex flex-col items-center justify-center text-center p-8 z-10">
                <div className="relative flex items-center justify-center w-40 h-40 mb-6">
                  <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full animate-[ping_3s_ease-in-out_infinite]"></div>
                  <div className="absolute inset-4 border-2 border-emerald-500/30 rounded-full animate-[ping_2s_ease-in-out_infinite_0.5s]"></div>
                  <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                    <Camera className="w-8 h-8 text-emerald-500" />
                  </div>
                </div>
                <h2 className="text-xl font-bold text-zinc-200 mb-2">Transmisión USB en Segundo Plano</h2>
                {usbDeviceInfo && (
                  <p className="text-sky-400 text-sm mb-1 font-medium">{usbDeviceInfo.brand} · {usbDeviceInfo.codec}</p>
                )}
                <p className="text-zinc-500 text-sm">El video se está enviando al Centro de Mando.</p>
              </div>
            )}
          </>
        ) : (
          /* Modo teléfono (Cámara nativa integrada) */
          <div className="relative flex flex-col items-center justify-center text-center p-8">
            <div className="relative flex items-center justify-center w-40 h-40 mb-6">
              <div className="absolute inset-0 border-4 border-emerald-500/20 rounded-full animate-[ping_3s_ease-in-out_infinite]"></div>
              <div className="absolute inset-4 border-2 border-emerald-500/30 rounded-full animate-[ping_2s_ease-in-out_infinite_0.5s]"></div>
              <div className="w-20 h-20 bg-emerald-500/10 rounded-full flex items-center justify-center border border-emerald-500/40 shadow-[0_0_30px_rgba(16,185,129,0.3)]">
                <Camera className="w-8 h-8 text-emerald-500" />
              </div>
            </div>
            <h2 className="text-xl font-bold text-zinc-200 mb-2">Cámara del Teléfono Activa</h2>
            <p className="text-zinc-500 text-sm">Transmitiendo feed de campo en tiempo real.</p>
          </div>
        )}

        {/* Panel Flotante de Ajustes UVC Hardware (BisonCam / saki4510t) */}
        {showControls && (
          <div className="absolute inset-x-0 bottom-4 mx-4 bg-zinc-900/95 backdrop-blur-md border border-zinc-700/70 rounded-3xl p-5 shadow-2xl z-30 animate-in slide-in-from-bottom-5 duration-200">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-zinc-800">
              <div className="flex items-center gap-2">
                <Sliders className="w-4 h-4 text-sky-400" />
                <h3 className="text-sm font-bold text-zinc-100">Ajustes UVC Hardware (BisonCam)</h3>
              </div>
              <button
                onClick={() => setShowControls(false)}
                className="p-1 rounded-full hover:bg-zinc-800 text-zinc-400 hover:text-zinc-200 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-4 max-h-[45vh] overflow-y-auto pr-1">
              {/* Brillo */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400 flex items-center gap-1.5"><Sun className="w-3.5 h-3.5 text-amber-400" /> Brillo</span>
                  <span className="text-zinc-200 font-mono font-semibold">{brightness}</span>
                </div>
                <input
                  type="range" min="0" max="100" value={brightness}
                  onChange={(e) => handleBrightnessChange(Number(e.target.value))}
                  className="w-full accent-sky-500 bg-zinc-800 rounded-lg h-1.5 cursor-pointer"
                />
              </div>

              {/* Contraste */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400 flex items-center gap-1.5"><Contrast className="w-3.5 h-3.5 text-sky-400" /> Contraste</span>
                  <span className="text-zinc-200 font-mono font-semibold">{contrast}</span>
                </div>
                <input
                  type="range" min="0" max="100" value={contrast}
                  onChange={(e) => handleContrastChange(Number(e.target.value))}
                  className="w-full accent-sky-500 bg-zinc-800 rounded-lg h-1.5 cursor-pointer"
                />
              </div>

              {/* Saturación */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">Saturación de Color</span>
                  <span className="text-zinc-200 font-mono font-semibold">{saturation}</span>
                </div>
                <input
                  type="range" min="0" max="100" value={saturation}
                  onChange={(e) => handleSaturationChange(Number(e.target.value))}
                  className="w-full accent-sky-500 bg-zinc-800 rounded-lg h-1.5 cursor-pointer"
                />
              </div>

              {/* Nitidez */}
              <div>
                <div className="flex justify-between text-xs mb-1">
                  <span className="text-zinc-400">Nitidez</span>
                  <span className="text-zinc-200 font-mono font-semibold">{sharpness}</span>
                </div>
                <input
                  type="range" min="0" max="100" value={sharpness}
                  onChange={(e) => handleSharpnessChange(Number(e.target.value))}
                  className="w-full accent-sky-500 bg-zinc-800 rounded-lg h-1.5 cursor-pointer"
                />
              </div>

              {/* Balance de Blancos Automático (AWB) */}
              <div className="flex items-center justify-between pt-1">
                <div>
                  <span className="text-xs font-medium text-zinc-200 block">Balance de Blancos Auto (AWB)</span>
                  <span className="text-[10px] text-zinc-500">Compensación automática de iluminación</span>
                </div>
                <button
                  onClick={handleAwbToggle}
                  className={`w-11 h-6 rounded-full transition-colors relative p-0.5 ${awb ? 'bg-sky-500' : 'bg-zinc-700'}`}
                >
                  <div className={`w-5 h-5 rounded-full bg-white transition-transform ${awb ? 'translate-x-5' : 'translate-x-0'}`} />
                </button>
              </div>

              {/* Selector de Resolución si la cámara reporta múltiples */}
              {resolutionsList.length > 1 && (
                <div>
                  <span className="text-[10px] text-zinc-500 uppercase tracking-wider block mb-1.5">Resolución UVC</span>
                  <div className="flex gap-2 flex-wrap">
                    {resolutionsList.map(res => (
                      <button
                        key={res}
                        onClick={() => handleResolutionChange(res)}
                        className={`px-3 py-1 text-xs rounded-lg font-mono transition-all ${selectedRes === res ? 'bg-sky-500 text-zinc-950 font-bold' : 'bg-zinc-800 text-zinc-300 hover:bg-zinc-700'}`}
                      >
                        {res}
                      </button>
                    ))}
                  </div>
                </div>
              )}

              {/* Acciones de recuperación y reset */}
              <div className="flex gap-2 pt-2 border-t border-zinc-800">
                <button
                  onClick={handleResetControls}
                  className="flex-1 py-2 px-3 bg-zinc-800 hover:bg-zinc-700 active:scale-95 text-zinc-300 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <RotateCcw className="w-3.5 h-3.5" />
                  <span>Restablecer</span>
                </button>
                <button
                  onClick={onForzarEncendido}
                  className="flex-1 py-2 px-3 bg-amber-500/20 hover:bg-amber-500/30 active:scale-95 text-amber-400 border border-amber-500/30 rounded-xl text-xs font-semibold flex items-center justify-center gap-1.5 transition-all"
                >
                  <Zap className="w-3.5 h-3.5 fill-current" />
                  <span>Despertar Sensor</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Footer / Controls */}
      <div className="bg-zinc-900 p-6 pb-8 rounded-t-3xl border-t border-zinc-800 z-10 shadow-[0_-10px_40px_rgba(0,0,0,0.5)] relative">
        <div className="flex justify-center items-center gap-6 max-w-sm mx-auto">
          {/* Botón Preview (toggle) */}
          {rtspUrl && (
            <button
              onClick={() => setShowPreview(!showPreview)}
              className={`w-14 h-14 flex items-center justify-center rounded-full transition-all ${showPreview ? 'bg-emerald-600 text-white shadow-lg shadow-emerald-900/50' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              title="Mostrar/Ocultar preview"
            >
              <Camera className="w-6 h-6" />
            </button>
          )}

          {/* Botón Controles UVC */}
          {rtspUrl && (
            <button
              onClick={() => {
                setShowControls(!showControls);
                if (!showControls) cargarAjustesUvc();
              }}
              className={`w-14 h-14 flex items-center justify-center rounded-full transition-all ${showControls ? 'bg-sky-500 text-zinc-950 shadow-lg shadow-sky-500/30' : 'bg-zinc-800 text-zinc-400 hover:bg-zinc-700'}`}
              title="Ajustes de imagen UVC"
            >
              <Sliders className="w-6 h-6" />
            </button>
          )}

          {/* Botón Colgar */}
          <button
            onClick={handleHangUp}
            className="w-16 h-16 flex items-center justify-center rounded-full bg-red-600 text-white shadow-lg shadow-red-900/50 hover:bg-red-500 active:scale-90 transition-all"
          >
            <PhoneOff className="w-7 h-7" />
          </button>
        </div>
      </div>
    </div>
  );
};

export default LiveView;
