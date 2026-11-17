import { useEffect, useState } from 'react';
import { Circle, MapContainer, Marker, Popup, TileLayer, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import markerIcon2x from 'leaflet/dist/images/marker-icon-2x.png';
import markerIcon from 'leaflet/dist/images/marker-icon.png';
import markerShadow from 'leaflet/dist/images/marker-shadow.png';
import { Crosshair } from 'lucide-react';
import { DEFAULT_CENTER } from '../utils/constants';

// Vite does not resolve Leaflet's default icon paths automatically.
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({ iconRetinaUrl: markerIcon2x, iconUrl: markerIcon, shadowUrl: markerShadow });

const TILE = 'https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png';
const ATTR = '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors';

const greenIcon = new L.DivIcon({
  className: '',
  html: '<div style="width:18px;height:18px;border-radius:9999px;background:#15803D;border:3px solid #fff;box-shadow:0 1px 4px rgba(0,0,0,.35)"></div>',
  iconSize: [18, 18],
  iconAnchor: [9, 9],
});

function ClickHandler({ onPick }) {
  useMapEvents({ click: (e) => onPick([e.latlng.lng, e.latlng.lat]) });
  return null;
}

function Recenter({ center }) {
  const map = useMap();
  useEffect(() => { if (center) map.setView(center, map.getZoom()); }, [center, map]);
  return null;
}

/**
 * Pick a location by clicking or "use my location".
 * value / onChange use [lng, lat] (GeoJSON order) to match the backend.
 */
export function MapPicker({ value, onChange, radiusKm, height = 'h-72' }) {
  const [locating, setLocating] = useState(false);
  const [geoError, setGeoError] = useState('');
  const center = value ? [value[1], value[0]] : DEFAULT_CENTER;

  const locate = () => {
    if (!navigator.geolocation) { setGeoError('Geolocation is not supported by this browser.'); return; }
    setLocating(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (pos) => { onChange([pos.coords.longitude, pos.coords.latitude]); setLocating(false); },
      () => { setGeoError('Could not get your location — click on the map instead.'); setLocating(false); },
      { enableHighAccuracy: true, timeout: 10000 },
    );
  };

  return (
    <div>
      <div className={`relative ${height} overflow-hidden rounded-xl border border-gray-200`}>
        <MapContainer center={center} zoom={13} scrollWheelZoom className="h-full w-full">
          <TileLayer url={TILE} attribution={ATTR} />
          <ClickHandler onPick={onChange} />
          <Recenter center={value ? center : null} />
          {value && <Marker position={center} draggable eventHandlers={{ dragend: (e) => { const p = e.target.getLatLng(); onChange([p.lng, p.lat]); } }} />}
          {value && radiusKm && <Circle center={center} radius={radiusKm * 1000} pathOptions={{ color: '#15803D', fillOpacity: 0.08 }} />}
        </MapContainer>
        <button type="button" onClick={locate} className="absolute right-3 top-3 z-[400] flex items-center gap-1.5 rounded-lg bg-white px-3 py-1.5 text-xs font-semibold shadow hover:bg-gray-50">
          <Crosshair className="h-3.5 w-3.5" /> {locating ? 'Locating…' : 'Use my location'}
        </button>
      </div>
      <p className="mt-1.5 text-xs text-gray-500">{value ? `Selected: ${value[1].toFixed(5)}, ${value[0].toFixed(5)} — drag the pin to adjust.` : 'Click on the map to drop a pin.'}</p>
      {geoError && <p className="field-error">{geoError}</p>}
    </div>
  );
}

/** Read-only map with markers: [{ id, position:[lng,lat], label, popup, highlight }] */
export function MarkersMap({ markers = [], center, zoom = 12, height = 'h-80', circle }) {
  const c = center ? [center[1], center[0]] : markers[0] ? [markers[0].position[1], markers[0].position[0]] : DEFAULT_CENTER;
  return (
    <div className={`${height} overflow-hidden rounded-xl border border-gray-200`}>
      <MapContainer center={c} zoom={zoom} scrollWheelZoom={false} className="h-full w-full">
        <TileLayer url={TILE} attribution={ATTR} />
        {circle && <Circle center={[circle.center[1], circle.center[0]]} radius={circle.radiusKm * 1000} pathOptions={{ color: '#15803D', fillOpacity: 0.06 }} />}
        {markers.map((m) => (
          <Marker key={m.id} position={[m.position[1], m.position[0]]} icon={m.highlight ? greenIcon : new L.Icon.Default()}>
            {m.popup && <Popup>{m.popup}</Popup>}
          </Marker>
        ))}
      </MapContainer>
    </div>
  );
}
