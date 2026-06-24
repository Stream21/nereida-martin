const { Router } = require('express');
const { query } = require('../db/pool');
const calendarSync = require('../services/calendarSync');

const router = Router();

function authorizeCron(req, res) {
  const authHeader = req.headers.authorization;
  const expected = `Bearer ${process.env.CRON_SECRET}`;

  if (!process.env.CRON_SECRET || authHeader !== expected) {
    res.status(401).json({ error: 'No autorizado' });
    return false;
  }
  return true;
}

router.get('/reminders', async (req, res) => {
  if (!authorizeCron(req, res)) return;

  try {
    const now = new Date();
    const sixAndHalfHours = new Date(now.getTime() + 6.5 * 60 * 60 * 1000);

    const result = await query(
      `SELECT b.id, b.start_time, b.end_time,
              c.name AS client_name, c.email AS client_email,
              t.name AS treatment_name, t.tag AS treatment_tag
       FROM bookings b
       JOIN clients c ON b.client_id = c.id
       LEFT JOIN treatments t ON b.treatment_id = t.id
       WHERE b.status = 'confirmed'
         AND b.reminder_sent = false
         AND b.start_time > $1
         AND b.start_time <= $2
         AND c.email != 'imported@studio.local'`,
      [now.toISOString(), sixAndHalfHours.toISOString()]
    );

    let sent = 0;
    const errors = [];

    for (const row of result.rows) {
      try {
        const emailService = require('../services/emailService');
        await emailService.sendReminder({
          to: row.client_email,
          clientName: row.client_name,
          treatment: { name: row.treatment_name, tag: row.treatment_tag },
          startTime: new Date(row.start_time),
          endTime: new Date(row.end_time),
        });

        await query('UPDATE bookings SET reminder_sent = true WHERE id = $1', [row.id]);
        sent++;
      } catch (err) {
        errors.push({ bookingId: row.id, error: err.message });
      }
    }

    res.json({
      processed: result.rows.length,
      sent,
      errors: errors.length > 0 ? errors : undefined,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Cron reminders error:', err);
    res.status(500).json({ error: 'Error procesando recordatorios' });
  }
});

router.get('/calendar-sync', async (req, res) => {
  if (!authorizeCron(req, res)) return;

  try {
    const syncResult = await calendarSync.syncIncremental();
    await calendarSync.reconcilePendingGoogleDeletes();
    await calendarSync.reconcileMissingGoogleEvents();

    let watchRenewed = false;
    try {
      const channel = await calendarSync.ensureWatchChannel();
      watchRenewed = !!channel;
    } catch (err) {
      console.error('Watch renewal failed:', err.message);
    }

    res.json({
      sync: syncResult,
      watchRenewed,
      timestamp: new Date().toISOString(),
    });
  } catch (err) {
    console.error('Cron calendar-sync error:', err);
    res.status(500).json({ error: 'Error en sincronización de calendario' });
  }
});

module.exports = router;
