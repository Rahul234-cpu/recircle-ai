// Helpers that keep personal information out of places it should not be.

const PHONE_RE = /(\+?\d[\d\s-]{8,}\d)/g;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/gi;

/** Mask phone numbers and emails in free text (used in chat before an order is accepted). */
function maskContactInfo(text = '') {
  return String(text)
    .replace(EMAIL_RE, '[email hidden until order is accepted]')
    .replace(PHONE_RE, '[phone hidden until order is accepted]');
}

/** Escape characters that could be rendered as HTML if a client forgot to escape. */
function sanitizeText(text = '') {
  return String(text).replace(/[<>]/g, (c) => (c === '<' ? '&lt;' : '&gt;')).trim();
}

/** Round a distance so collectors cannot triangulate an exact address before acceptance. */
function fuzzDistanceKm(km) {
  return Math.max(0.5, Math.round(km * 2) / 2);
}

/** Public-safe view of a pickup address before the booking is accepted. */
function publicAddress(address = {}) {
  return {
    locality: address.locality || address.city || 'Nearby',
    city: address.city,
    pincode: address.pincode ? `${String(address.pincode).slice(0, 3)}***` : undefined,
  };
}

/** Recursively strip keys starting with $ or containing '.' (basic NoSQL injection guard). */
function stripMongoOperators(obj) {
  if (Array.isArray(obj)) return obj.map(stripMongoOperators);
  if (obj && typeof obj === 'object') {
    const out = {};
    for (const [k, v] of Object.entries(obj)) {
      if (k.startsWith('$') || k.includes('.')) continue;
      out[k] = stripMongoOperators(v);
    }
    return out;
  }
  return obj;
}

module.exports = { maskContactInfo, sanitizeText, fuzzDistanceKm, publicAddress, stripMongoOperators };
