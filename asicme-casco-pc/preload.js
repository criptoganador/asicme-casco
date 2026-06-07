const { contextBridge, ipcRenderer } = require('electron');

// Exponemos de forma segura las funciones de Electron al frontend (React)
// Solo lo que explícitamente listemos aquí será accesible desde window.electronAPI
contextBridge.exposeInMainWorld('electronAPI', {
  // Obtiene la lista de micrófonos disponibles en el sistema
  getAudioDevices: () => ipcRenderer.invoke('get-audio-devices'),

  // Notifica al proceso principal cuál micrófono eligió el operador
  selectMicrophone: (deviceId) => ipcRenderer.send('select-microphone', deviceId),

  // Informa al frontend si está corriendo dentro de Electron
  isElectron: true,
});
