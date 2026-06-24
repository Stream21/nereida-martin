const url = `${process.env.BACKEND_URL}/api/cron/reminders`;
const secret = process.env.CRON_SECRET;

if (!process.env.BACKEND_URL || !secret) {
  console.error('Faltan BACKEND_URL o CRON_SECRET');
  process.exit(1);
}

fetch(url, {
  headers: { Authorization: `Bearer ${secret}` },
})
  .then((res) => res.json())
  .then((data) => {
    console.log(JSON.stringify(data, null, 2));
    process.exit(0);
  })
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
