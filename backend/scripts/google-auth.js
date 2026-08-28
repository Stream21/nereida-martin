/**
 * One-time OAuth2 flow to obtain GOOGLE_REFRESH_TOKEN.
 *
 * Local (same machine):
 *   npm run google:auth
 *
 * Remote client (phone at home) — use tunnel:
 *   npm run google:auth:tunnel
 *
 * Manual tunnel:
 *   1. cloudflared tunnel --url http://localhost:3333
 *   2. Add https://YOUR-TUNNEL.trycloudflare.com/oauth2callback to Google Cloud → Clientes
 *   3. GOOGLE_OAUTH_REDIRECT_URI=https://YOUR-TUNNEL.trycloudflare.com/oauth2callback npm run google:auth
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const DEFAULT_PORT = 3333;
const DEFAULT_REDIRECT = `http://localhost:${DEFAULT_PORT}/oauth2callback`;

function getConfig(overrides = {}) {
  const redirectUri =
    overrides.redirectUri ||
    process.env.GOOGLE_OAUTH_REDIRECT_URI ||
    DEFAULT_REDIRECT;

  const parsed = new URL(redirectUri);
  const listenPort =
    overrides.listenPort ||
    parseInt(process.env.GOOGLE_OAUTH_PORT || String(DEFAULT_PORT), 10);

  const callbackPath = parsed.pathname || '/oauth2callback';

  return { redirectUri, listenPort, callbackPath };
}

function startGoogleAuth(overrides = {}) {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    throw new Error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first');
  }

  const { redirectUri, listenPort, callbackPath } = getConfig(overrides);

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    redirectUri
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  return new Promise((resolve, reject) => {
    const server = http.createServer(async (req, res) => {
      const parsed = url.parse(req.url, true);

      if (parsed.pathname !== callbackPath) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }

      const code = parsed.query.code;
      const error = parsed.query.error;

      if (error) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>Error</h1><p>${error}</p>`);
        reject(new Error(`OAuth error: ${error}`));
        server.close();
        return;
      }

      if (!code) {
        res.writeHead(400, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end('<h1>Error</h1><p>No authorization code received.</p>');
        return;
      }

      try {
        const { tokens } = await oauth2Client.getToken(code);

        if (!tokens.refresh_token) {
          throw new Error(
            'Google no devolvió refresh_token. Revoca el acceso en https://myaccount.google.com/permissions y vuelve a autorizar.'
          );
        }

        const lifetime = describeTokenLifetime(tokens.refresh_token_expires_in);
        res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(
          `<h1>¡Autorización correcta!</h1>
           <p>Vida del refresh token: <strong>${lifetime.label}</strong></p>
           <p>Ya puedes cerrar esta pestaña.</p>`
        );

        server.close();
        resolve({
          refreshToken: tokens.refresh_token,
          refreshTokenExpiresIn: tokens.refresh_token_expires_in,
          lifetime,
          redirectUri,
          authUrl,
        });
      } catch (err) {
        res.writeHead(500, { 'Content-Type': 'text/html; charset=utf-8' });
        res.end(`<h1>Error</h1><p>${err.message}</p>`);
        reject(err);
      }
    });

    server.on('error', (err) => {
      if (err.code === 'EADDRINUSE') {
        reject(
          new Error(
            `Puerto ${listenPort} ocupado. Para el dev server o usa GOOGLE_OAUTH_PORT=3334`
          )
        );
      } else {
        reject(err);
      }
    });

    server.listen(listenPort, () => {
      console.log('\n=== Google Calendar Authorization ===\n');
      console.log(`Redirect URI: ${redirectUri}`);
      console.log(`Listening on: http://localhost:${listenPort}${callbackPath}\n`);
      console.log('Send this URL (single line) to the calendar owner:\n');
      console.log(authUrl);
      console.log('\nWaiting for callback...\n');
    });
  });
}

function describeTokenLifetime(expiresIn) {
  if (expiresIn == null || expiresIn === 0) {
    return { days: null, label: 'sin caducidad (app en Producción)' };
  }
  const days = Math.round(Number(expiresIn) / 86400);
  return {
    days,
    label: `${days} día${days === 1 ? '' : 's'} — la app OAuth sigue en modo Prueba`,
  };
}

function persistRefreshTokenToEnv(refreshToken) {
  const envPath = path.join(__dirname, '..', '.env');
  if (!fs.existsSync(envPath)) return false;

  const env = fs.readFileSync(envPath, 'utf8');
  const next = /^GOOGLE_REFRESH_TOKEN=/m.test(env)
    ? env.replace(/^GOOGLE_REFRESH_TOKEN=.*$/m, `GOOGLE_REFRESH_TOKEN=${refreshToken}`)
    : `${env.replace(/\s*$/, '')}\nGOOGLE_REFRESH_TOKEN=${refreshToken}\n`;

  fs.writeFileSync(envPath, next);
  return true;
}

async function persistRefreshToken(refreshToken) {
  const savedToEnv = persistRefreshTokenToEnv(refreshToken);
  let savedToDb = false;

  try {
    const studioSettings = require('../services/studioSettings');
    await studioSettings.updateGoogleRefreshToken(refreshToken);
    savedToDb = true;
  } catch (err) {
    console.warn('Could not save refresh token to database:', err.message);
  }

  return { savedToEnv, savedToDb };
}

async function main() {
  try {
    const result = await startGoogleAuth();
    const saved = await persistRefreshToken(result.refreshToken);

    console.log('=== SUCCESS ===\n');
    console.log(`Token lifetime: ${result.lifetime.label}\n`);
    if (result.lifetime.days) {
      console.log('WARNING: This token will expire. Publish the OAuth app (not just verify),');
      console.log('then run this script AGAIN so Google issues a non-expiring token.\n');
    }
    if (saved.savedToEnv) console.log('Saved to backend/.env');
    if (saved.savedToDb) console.log('Saved to studio_settings (database)');
    console.log('\nAlso copy GOOGLE_REFRESH_TOKEN to Render → nere-studio → Environment');
    console.log('\n===============\n');

    process.exit(result.lifetime.days ? 2 : 0);
  } catch (err) {
    console.error('Authorization failed:', err.message);
    process.exit(1);
  }
}

if (require.main === module) {
  main();
}

module.exports = {
  startGoogleAuth,
  persistRefreshToken,
  describeTokenLifetime,
  getConfig,
  SCOPES,
  DEFAULT_PORT,
};
