function describeGoogleAuthError(err) {
  const data = err?.response?.data || {};
  const code = data.error || err?.code || '';
  const desc = data.error_description || err?.message || '';
  const combined = `${code} ${desc} ${err?.message || ''}`.toLowerCase();

  if (combined.includes('invalid_grant')) {
    return {
      code: 'invalid_grant',
      message:
        'El refresh token de Google caducó o fue revocado. Regenera GOOGLE_REFRESH_TOKEN con `npm run google:auth` (la app OAuth debe estar En producción ANTES de autorizar) y pégalo en Render → nere-studio → Environment.',
    };
  }

  return { code: String(code || 'google_error'), message: err?.message || 'Google Calendar error' };
}

module.exports = { describeGoogleAuthError };
