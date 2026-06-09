import { useEffect, useRef, useState } from 'react';

const loadGoogleMaps = (apiKey) => {
  return new Promise((resolve, reject) => {
    if (window.google && window.google.maps) return resolve(window.google.maps);
    
    // Asignamos el callback global que Google llamará cuando termine de inicializar
    window.__initGoogleMaps = () => {
      resolve(window.google.maps);
      delete window.__initGoogleMaps;
    };

    const script = document.createElement('script');
    script.src = `https://maps.googleapis.com/maps/api/js?key=${apiKey}&loading=async&callback=__initGoogleMaps`;
    script.async = true;
    script.defer = true;
    script.onerror = reject;
    document.head.appendChild(script);
  });
};

const GoogleMap = ({ agentLocations = {}, selectedAgentId }) => {
  const mapRef = useRef(null);
  const mapInstance = useRef(null);
  const markersRef = useRef({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
    if (!apiKey) return;
    let mounted = true;
    loadGoogleMaps(apiKey)
      .then((maps) => {
        if (!mounted) return;
        mapInstance.current = new maps.Map(mapRef.current, {
          center: { lat: 19.4326, lng: -99.1332 },
          zoom: 5,
        });
        setLoaded(true);
      })
      .catch((e) => {
        console.error('Error cargando Google Maps:', e);
      });

    return () => { mounted = false; };
  }, []);

  useEffect(() => {
    if (!loaded || !mapInstance.current) return;
    const maps = window.google.maps;

    // Remove markers that are no longer present
    Object.keys(markersRef.current).forEach(key => {
      if (!agentLocations[key]) {
        markersRef.current[key].setMap(null);
        delete markersRef.current[key];
      }
    });

    const bounds = new maps.LatLngBounds();
    let any = false;

    Object.entries(agentLocations).forEach(([id, loc]) => {
      const lat = Number(loc.lat ?? loc.latitude);
      const lng = Number(loc.lng ?? loc.longitude);
      if (Number.isNaN(lat) || Number.isNaN(lng)) return;
      any = true;
      const position = { lat, lng };
      if (!markersRef.current[id]) {
        markersRef.current[id] = new maps.Marker({
          position,
          map: mapInstance.current,
          title: id,
        });
      } else {
        markersRef.current[id].setPosition(position);
      }
      bounds.extend(position);
    });

    if (selectedAgentId && agentLocations[selectedAgentId]) {
      const loc = agentLocations[selectedAgentId];
      const lat = Number(loc.lat ?? loc.latitude);
      const lng = Number(loc.lng ?? loc.longitude);
      if (!Number.isNaN(lat) && !Number.isNaN(lng)) {
        mapInstance.current.setCenter({ lat, lng });
        mapInstance.current.setZoom(15);
        return;
      }
    }

    if (any) {
      mapInstance.current.fitBounds(bounds, 80);
    }
  }, [loaded, agentLocations, selectedAgentId]);

  if (!import.meta.env.VITE_GOOGLE_MAPS_API_KEY) {
    return (
      <div className="p-6">
        <div className="rounded-[1rem] border border-slate-200 bg-white p-6 text-sm text-slate-600">
          Google Maps API key missing. Set `VITE_GOOGLE_MAPS_API_KEY` in your environment.
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-white rounded-lg overflow-hidden">
      <div ref={mapRef} style={{ width: '100%', height: '100%' }} />
    </div>
  );
};

export default GoogleMap;
