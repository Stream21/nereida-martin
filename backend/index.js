const express = require('express');
const cors = require('cors');
const path = require('path');
require('dotenv').config();

const treatmentsRouter = require('./routes/treatments');
const availabilityRouter = require('./routes/availability');
const bookingsRouter = require('./routes/bookings');
const cronRouter = require('./routes/cron');
const settingsRouter = require('./routes/settings');
const webhooksRouter = require('./routes/webhooks');
const studioSettings = require('./services/studioSettings');
const calendarSync = require('./services/calendarSync');

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/treatments', treatmentsRouter);
app.use('/api/availability', availabilityRouter);
app.use('/api/bookings', bookingsRouter);
app.use('/api/cron', cronRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/webhooks', webhooksRouter);

const distPath = path.join(__dirname, '..', 'frontend', 'dist');
app.use(express.static(distPath));
app.get(/^\/(?!api).*/, (req, res) => {
  res.sendFile(path.join(distPath, 'index.html'));
});

app.use((err, req, res, _next) => {
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Error interno del servidor' });
});

async function bootstrap() {
  try {
    await studioSettings.ensureBookingStartDateFromEnv();
  } catch (err) {
    console.warn('Could not sync booking start date:', err.message);
  }

  if (process.env.BACKEND_URL || process.env.GOOGLE_WEBHOOK_URL) {
    calendarSync.ensureWatchChannel().catch((err) => {
      console.warn('Calendar watch channel setup failed:', err.message);
    });
  }

  app.listen(PORT, () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

bootstrap();
