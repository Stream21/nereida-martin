/**
 * Normalize Spanish mobile/landline to digits-only (no country code).
 * @param {string|null|undefined} phone
 * @returns {string|null}
 */
function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  let digits = phone.replace(/\D/g, '');
  if (!digits) return null;

  if (digits.startsWith('0034')) digits = digits.slice(4);
  else if (digits.startsWith('34') && digits.length >= 11) digits = digits.slice(2);

  return digits.length >= 9 ? digits : null;
}

function isValidPhone(phone) {
  return Boolean(normalizePhone(phone));
}

function formatPhoneDisplay(normalized) {
  if (!normalized) return '';
  const d = String(normalized);
  if (d.length === 9) return `${d.slice(0, 3)} ${d.slice(3, 5)} ${d.slice(5, 7)} ${d.slice(7)}`;
  return d;
}

module.exports = { normalizePhone, isValidPhone, formatPhoneDisplay };
