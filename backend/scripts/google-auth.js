/**
 * One-time script to obtain a Google OAuth2 refresh token.
 *
 * Steps:
 * 1. Go to https://console.cloud.google.com
 * 2. Create a project (or use existing)
 * 3. Enable Google Calendar API
 * 4. Create OAuth2 credentials (type: Web application)
 *    - Add http://localhost:3000/oauth2callback as authorized redirect URI
 * 5. Copy Client ID and Client Secret to .env
 * 6. Run: node scripts/google-auth.js
 * 7. Open the URL in browser, authorize with Nere's Google account
 * 8. Copy the refresh_token to .env as GOOGLE_REFRESH_TOKEN
 */

require('dotenv').config();
const { google } = require('googleapis');
const http = require('http');
const url = require('url');

const SCOPES = ['https://www.googleapis.com/auth/calendar'];
const REDIRECT_URI = 'http://localhost:3000/oauth2callback';

async function main() {
  const { GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET } = process.env;

  if (!GOOGLE_CLIENT_ID || !GOOGLE_CLIENT_SECRET) {
    console.error('Set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env first');
    process.exit(1);
  }

  const oauth2Client = new google.auth.OAuth2(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    REDIRECT_URI
  );

  const authUrl = oauth2Client.generateAuthUrl({
    access_type: 'offline',
    prompt: 'consent',
    scope: SCOPES,
  });

  console.log('\n=== Google Calendar Authorization ===\n');
  console.log('Open this URL in your browser:\n');
  console.log(authUrl);
  console.log('\nWaiting for callback...\n');

  const server = http.createServer(async (req, res) => {
    const parsed = url.parse(req.url, true);

    if (parsed.pathname === '/oauth2callback') {
      const code = parsed.query.code;

      if (!code) {
        res.end('Error: no code received');
        return;
      }

      try {
        const { tokens } = await oauth2Client.getToken(code);

        res.writeHead(200, { 'Content-Type': 'text/html' });
        res.end('<h1>Authorization successful!</h1><p>You can close this tab.</p>');

        console.log('=== SUCCESS ===\n');
        console.log('Add this to your .env file:\n');
        console.log(`GOOGLE_REFRESH_TOKEN=${tokens.refresh_token}`);
        console.log(`\nGOOGLE_CALENDAR_ID=primary`);
        console.log('\n===============\n');

        server.close();
        process.exit(0);
      } catch (err) {
        res.end(`Error: ${err.message}`);
        console.error('Token exchange failed:', err);
      }
    }
  });

  server.listen(3000);
}

main();
