import { app, BrowserWindow, session, systemPreferences, ipcMain } from 'electron';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// ─────────────────────────────────────────────────────────────
// CAPA 1: Auto-aprobación de permisos en la sesión de Chromium
// Se ejecuta antes de que se cree cualquier ventana
// ─────────────────────────────────────────────────────────────
function setupSessionPermissions() {
  // Intercepción de peticiones de permiso (lo que normalmente causa el popup del navegador)
  session.defaultSession.setPermissionRequestHandler((webContents, permission, callback) => {
    const allowed = [
      'media',          // Cámara + Micrófono (WebRTC)
      'microphone',
      'camera',
      'audioCapture',
      'videoCapture',
      'geolocation',
      'notifications',
      'display-capture', // Screen share futuro
    ];

    console.log(`[Permisos] Petición recibida: ${permission} → APROBADA`);
    if (allowed.includes(permission)) {
      callback(true);
    } else {
      callback(false);
    }
  });

  // Verificación de permisos (para fetch/check de APIs web como navigator.permissions.query)
  session.defaultSession.setPermissionCheckHandler((webContents, permission) => {
    const allowed = ['media', 'microphone', 'camera', 'audioCapture', 'videoCapture', 'geolocation'];
    if (allowed.includes(permission)) {
      console.log(`[Permisos] Check de permiso: ${permission} → CONCEDIDO`);
      return true;
    }
    return null; // Comportamiento por defecto para otros permisos
  });
}

// ─────────────────────────────────────────────────────────────
// CAPA 2: Verificación de permisos a nivel del Sistema Operativo
// Crítico en macOS y Windows 11 donde el SO bloquea el hardware
// ─────────────────────────────────────────────────────────────
async function ensureOSMediaPermissions() {
  const platform = process.platform;

  if (platform !== 'win32' && platform !== 'darwin') {
    console.log('[OS Permisos] Linux detectado, no se necesita verificación adicional.');
    return;
  }

  const mediaTypes = ['microphone', 'camera'];

  for (const mediaType of mediaTypes) {
    try {
      const status = systemPreferences.getMediaAccessStatus(mediaType);
      console.log(`[OS Permisos] Estado de ${mediaType}: ${status}`);

      if (status !== 'granted') {
        console.log(`[OS Permisos] Solicitando acceso a ${mediaType} al sistema operativo...`);
        const granted = await systemPreferences.askForMediaAccess(mediaType);
        console.log(`[OS Permisos] ${mediaType} ${granted ? 'CONCEDIDO' : 'DENEGADO'} por el SO.`);
      }
    } catch (e) {
      // En Windows, askForMediaAccess puede no estar disponible en todas las versiones
      // El error es no-fatal; los permisos de Chromium siguen funcionando
      console.warn(`[OS Permisos] No se pudo verificar ${mediaType} a nivel OS: ${e.message}`);
    }
  }
}

// ─────────────────────────────────────────────────────────────
// IPC: Selector de Micrófono
// Expone al frontend la lista de micrófonos disponibles y
// permite que el usuario elija cuál usar, persistiendo la elección
// ─────────────────────────────────────────────────────────────
function setupMicrophoneSelector() {
  // El renderer pide la lista de dispositivos de audio
  ipcMain.handle('get-audio-devices', async (event) => {
    // Pedimos al webContents que enumere los dispositivos disponibles
    const webContents = event.sender;
    const devices = await webContents.executeJavaScript(`
      navigator.mediaDevices.enumerateDevices()
        .then(devices => devices
          .filter(d => d.kind === 'audioinput')
          .map(d => ({ deviceId: d.deviceId, label: d.label || 'Micrófono ' + (i+1) }))
        )
    `).catch(() => []);
    return devices;
  });

  // El renderer notifica cuál micrófono eligió el usuario
  ipcMain.on('select-microphone', (event, deviceId) => {
    console.log(`[Micrófono] El operador seleccionó el dispositivo: ${deviceId}`);
    // Guardamos en una variable global para que el preload pueda inyectarla
    global.selectedMicrophoneId = deviceId;
  });
}

// ─────────────────────────────────────────────────────────────
// VENTANA PRINCIPAL: BrowserWindow del Centro de Mando
// ─────────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 1024,
    minHeight: 700,
    title: 'AsicMe Casco — Centro de Mando',
    backgroundColor: '#ffffff',   // blanco: evita el flash oscuro al arrancar
    webPreferences: {
      nodeIntegration: false,       // Seguridad: NO exponer Node.js al renderer web
      contextIsolation: true,       // Seguridad: aislar el contexto de JS del preload y el renderer
      preload: path.join(__dirname, 'preload.js'), // Puente seguro para IPC
      webSecurity: false,           // Necesario para que LiveKit (WSS) funcione sin CORS desde file://
      allowRunningInsecureContent: false,
    },
  });

  // CAPA 3: Carga del frontend
  if (!app.isPackaged) {
    // En desarrollo con Vite
    win.loadURL('http://localhost:5173');
  } else {
    // En producción / Electron empaquetado
    win.loadURL('https://asicme-casco-frontend.onrender.com');
  }

  // Descomenta la siguiente línea para abrir DevTools en desarrollo:
  // win.webContents.openDevTools();

  // Interceptar peticiones de selección de dispositivo de audio desde Chromium
  win.webContents.on('select-bluetooth-device', (event, devices, callback) => {
    event.preventDefault();
    // Auto-seleccionar el primer dispositivo Bluetooth de audio disponible
    if (devices.length > 0) {
      callback(devices[0].deviceId);
    }
  });
}

// ─────────────────────────────────────────────────────────────
// CICLO DE VIDA DE LA APLICACIÓN
// ─────────────────────────────────────────────────────────────
app.whenReady().then(async () => {
  // Paso 1: Configurar los handlers de sesión ANTES de crear ventanas
  setupSessionPermissions();

  // Paso 2: Verificar permisos del sistema operativo
  await ensureOSMediaPermissions();

  // Paso 3: Configurar el canal IPC para el selector de micrófono
  setupMicrophoneSelector();

  // Paso 4: Crear la ventana principal del Centro de Mando
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
