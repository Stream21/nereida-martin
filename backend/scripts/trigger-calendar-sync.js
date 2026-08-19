const base = (process.env.BACKEND_URL || '').replace(/\/$/, '');
const url = `${base}/api/cron/calendar-sync`;
const secret = process.env.CRON_SECRET;

if (!base || !secret) {
  console.error('Faltan BACKEND_URL o CRON_SECRET');
  process.exit(1);
}

async function runOnce() {
  const res = await fetch(url, {
    headers: { Authorization: `Bearer ${secret}` },
  });
  const data = await res.json().catch(() => ({}));
  return { res, data };
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  let last;
  for (let attempt = 1; attempt <= 3; attempt++) {
    last = await runOnce();
    if (last.res.ok) {
      console.log(JSON.stringify({ status: last.res.status, ...last.data }, null, 2));
      process.exit(0);
    }

    const retryable = last.res.status === 502 || last.res.status === 503;
    if (!retryable || attempt === 3) break;
    console.error(`Intento ${attempt}: HTTP ${last.res.status}, reintento...`);
    await sleep(15000);
  }

  console.log(JSON.stringify({ status: last.res.status, ...last.data }, null, 2));
  process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
