const base = (process.env.BACKEND_URL || '').replace(/\/$/, '');
const url = `${base}/api/cron/joint-expiry`;
const secret = process.env.CRON_SECRET;

if (!base || !secret) {
  console.error('Faltan BACKEND_URL o CRON_SECRET');
  process.exit(1);
}

fetch(url, {
  headers: { Authorization: `Bearer ${secret}` },
})
  .then(async (res) => {
    const data = await res.json().catch(() => ({}));
    console.log(JSON.stringify({ status: res.status, ...data }, null, 2));
    process.exit(res.ok ? 0 : 1);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
