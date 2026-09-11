// Patch de seguridad para evitar crashes por 'removeChild' o 'insertBefore'
// causados por extensiones del navegador (como Google Translate) o librerías de mapas (Leaflet/Mapbox)
if (typeof Node === 'function' && Node.prototype) {
  const originalRemoveChild = Node.prototype.removeChild;
  Node.prototype.removeChild = function (child) {
    if (child && child.parentNode !== this) {
      return child;
    }
    return originalRemoveChild.apply(this, arguments);
  };

  const originalInsertBefore = Node.prototype.insertBefore;
  Node.prototype.insertBefore = function (newNode, referenceNode) {
    if (referenceNode && referenceNode.parentNode !== this) {
      return newNode;
    }
    return originalInsertBefore.apply(this, arguments);
  };
}

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import 'leaflet/dist/leaflet.css'
import 'mapbox-gl/dist/mapbox-gl.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <App />
)

