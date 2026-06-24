const { Router } = require('express');
const calendarSync = require('../services/calendarSync');

const router = Router();

router.post('/google-calendar', async (req, res) => {
  const channelToken = req.headers['x-goog-channel-token'];
  const expected = process.env.GOOGLE_WEBHOOK_SECRET;

  if (expected && channelToken !== expected) {
    return res.status(401).json({ error: 'Token inválido' });
  }

  const resourceState = req.headers['x-goog-resource-state'];

  if (resourceState === 'sync') {
    return res.status(200).end();
  }

  res.status(200).end();

  setImmediate(async () => {
    try {
      await calendarSync.syncIncremental();
    } catch (err) {
      console.error('Webhook calendar sync error:', err.message);
    }
  });
});

module.exports = router;
