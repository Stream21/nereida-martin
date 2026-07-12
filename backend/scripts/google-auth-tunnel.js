#!/usr/bin/env node
/**
 * Starts cloudflared quick tunnel + OAuth server so the client can authorize from their phone.
 *
 * Prerequisites:
 *   - cloudflared installed: winget install Cloudflare.cloudflared
 *   - GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET in .env
 *   - Client's Gmail added as test user in Google Cloud → Público
 *
 * Usage: npm run google:auth:tunnel
 */

require('dotenv').config();
const { spawn } = require('child_process');
const readline = require('readline');
const { startGoogleAuth, DEFAULT_PORT } = require('./google-auth');

const TUNNEL_TARGET = `http://localhost:${process.env.GOOGLE_OAUTH_PORT || DEFAULT_PORT}`;

function waitForTunnelUrl(child) {
  return new Promise((resolve, reject) => {
    const timeout = setTimeout(() => {
      reject(new Error('Timeout esperando URL de cloudflared (60s)'));
    }, 60000);

    const tryMatch = (chunk) => {
      const text = chunk.toString();
      const match = text.match(/https:\/\/[a-z0-9-]+\.trycloudflare\.com/i);
      if (match) {
        clearTimeout(timeout);
        resolve(match[0].replace(/\/$/, ''));
      }
    };

    child.stdout.on('data', tryMatch);
    child.stderr.on('data', tryMatch);
    child.on('error', (err) => {
      clearTimeout(timeout);
      reject(err);
    });
    child.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        clearTimeout(timeout);
        reject(new Error(`cloudflared exited with code ${code}`));
      }
    });
  });
}

async function main() {
  console.log('\n=== Google Auth + Cloudflare Tunnel ===\n');
  console.log(`Starting cloudflared → ${TUNNEL_TARGET}\n`);

  const cloudflared = spawn(
    'cloudflared',
    ['tunnel', '--url', TUNNEL_TARGET],
    { stdio: ['ignore', 'pipe', 'pipe'], shell: process.platform === 'win32' }
  );

  let tunnelUrl;
  try {
    tunnelUrl = await waitForTunnelUrl(cloudflared);
  } catch (err) {
    cloudflared.kill();
    console.error('\nCould not start cloudflared.\n');
    console.error('Install it: winget install Cloudflare.cloudflared');
    console.error('Or download: https://developers.cloudflare.com/cloudflare-one/connections/connect-apps/install-and-setup/installation/\n');
    console.error(err.message);
    process.exit(1);
  }

  const redirectUri = `${tunnelUrl}/oauth2callback`;

  console.log('Tunnel ready!\n');
  console.log('── STEP 1: Add this redirect URI in Google Cloud ──');
  console.log('   Clientes → your OAuth client → Authorized redirect URIs\n');
  console.log(`   ${redirectUri}\n`);
  console.log('(Each tunnel run generates a new URL — add it every time, or keep the tunnel open.)\n');

  await new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
    rl.question('Press Enter after adding the redirect URI in Google Cloud... ', () => {
      rl.close();
      resolve();
    });
  });

  console.log('\n── STEP 2: Send the auth URL below to Nereida (WhatsApp, one line) ──\n');

  try {
    const result = await startGoogleAuth({ redirectUri });

    console.log('=== SUCCESS ===\n');
    console.log('Add this to your .env file:\n');
    console.log(`GOOGLE_REFRESH_TOKEN=${result.refreshToken}`);
    console.log('\nGOOGLE_CALENDAR_ID=primary');
    console.log('\n===============\n');
  } catch (err) {
    console.error('Authorization failed:', err.message);
    process.exitCode = 1;
  } finally {
    cloudflared.kill();
    process.exit(process.exitCode || 0);
  }
}

main();
