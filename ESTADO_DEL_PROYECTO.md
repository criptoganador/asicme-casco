# 📌 AsicMe Casco - Estado del Proyecto, Infraestructura y Configuración

**Última actualización:** 2026-09-09  
**Repositorio:** `https://github.com/criptoganador/asicme-casco.git`

---

## 1. 🌐 Despliegue en Producción (Render)

Ambos servicios están **activos y operativos (HTTP 200 OK)** en Render:

| Componente | Tipo de Servicio | URL Pública | Estado |
|---|---|---|---|
| **Centro de Mando (PC)** | Static Site | [https://asicme-casco-frontend.onrender.com](https://asicme-casco-frontend.onrender.com) | 🟢 Activo |
| **Backend de Tokens (Node.js)** | Web Service | [https://asicme-casco-backend.onrender.com](https://asicme-casco-backend.onrender.com) | 🟢 Activo (genera tokens) |

* Endpoint verificado: `GET https://asicme-casco-backend.onrender.com/api/token?roomName=vigilancia-global&participantName=Test`

---

## 2. 🔑 Credenciales LiveKit Cloud

* **LIVEKIT_URL:** `wss://asicme-casco-xlxbe39o.livekit.cloud`
* **LIVEKIT_API_KEY:** `APIutSnBDwPrHSM`
* **LIVEKIT_API_SECRET:** `DYIeeEd4f2ljsCgOQN2wb7ypHErawhAmeEBm0gVq5TmD`

---

## 3. ⚙️ Configuración de Archivos de Entorno (.env)

Los archivos `.env` fueron creados y sincronizados en los 3 módulos:

### A. Backend (`server/.env`)
```env
PORT=3000
LIVEKIT_API_KEY=APIutSnBDwPrHSM
LIVEKIT_API_SECRET=DYIeeEd4f2ljsCgOQN2wb7ypHErawhAmeEBm0gVq5TmD
LIVEKIT_URL=wss://asicme-casco-xlxbe39o.livekit.cloud
```

### B. Centro de Mando PC (`asicme-casco-pc/.env`)
```env
VITE_API_URL=http://localhost:3000
VITE_LIVEKIT_URL=wss://asicme-casco-xlxbe39o.livekit.cloud
```
*(Para apuntar a Render en vez de local: `VITE_API_URL=https://asicme-casco-backend.onrender.com`)*

### C. Aplicación Casco Android (`asicme-casco-android/.env`)
```env
# IP Wi-Fi local de la PC para pruebas en la misma red
VITE_API_URL=http://192.168.101.5:3000
VITE_LIVEKIT_URL=wss://asicme-casco-xlxbe39o.livekit.cloud
```
*(Para pruebas directas con el backend en la nube: `VITE_API_URL=https://asicme-casco-backend.onrender.com`)*

---

## 4. 🔀 Situación de las Ramas Git

> [!IMPORTANT]
> **Discrepancia entre `main` y `develop`**:
> * **Rama local actual (`main`):** Se encuentra en el commit base inicial `470cf61` ("Respaldando configuracion base").
> * **Rama remota `develop` (`origin/develop`):** Contiene **más de 80 commits de avance** y es la base del código que está actualmente desplegado en Render.

### Características desarrolladas en `develop`:
1. **Configuración de Render:** Archivo `render.yaml` (Blueprint automatizado).
2. **Telemetría GPS en vivo:** Transmisión de coordenadas en tiempo real mediante LiveKit DataChannel desde el móvil hacia la PC.
3. **Mapas Interactivos:** Integración de Leaflet 2D, Mapbox 3D con vista satelital/edificios holográficos y Google Maps.
4. **Cámaras Externas (Casco):** Soporte y detección de cámaras USB OTG con selector de dispositivo.
5. **Segundo Plano (Android):** Foreground Service / Background Mode para evitar cortes al bloquear pantalla.
6. **Audio Bidireccional:** Cancelación de eco y renderizado con `RoomAudioRenderer`.
7. **Empaquetado Electron:** Soporte de ejecución como app nativa de escritorio para PC.

---

## 5. 🚀 Comandos Rápidos

```bash
# Iniciar servidor backend local
npm run dev:server

# Iniciar aplicación de PC local
npm run dev:pc

# Iniciar aplicación Android en modo web
npm run dev:android

# Ver diferencias con la rama de desarrollo
git log main..origin/develop --oneline

# Cambiar a la rama de desarrollo con todo el código avanzado
git checkout develop
```
