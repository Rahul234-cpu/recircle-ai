const EARTH_RADIUS_KM = 6371;

function toRad(deg) { return (deg * Math.PI) / 180; }

/** Haversine distance between two [lng, lat] pairs in km. */
function distanceKm([lng1, lat1], [lng2, lat2]) {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_KM * Math.asin(Math.sqrt(a));
}

function point(lng, lat) {
  return { type: 'Point', coordinates: [Number(lng), Number(lat)] };
}

function isValidCoords(coords) {
  return Array.isArray(coords) && coords.length === 2
    && Number.isFinite(coords[0]) && Number.isFinite(coords[1])
    && Math.abs(coords[0]) <= 180 && Math.abs(coords[1]) <= 90;
}

module.exports = { distanceKm, point, isValidCoords };
