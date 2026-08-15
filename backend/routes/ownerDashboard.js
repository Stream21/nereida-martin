const { Router } = require('express');
const ExcelJS = require('exceljs');
const multer = require('multer');
const requireOwnerAuth = require('../middleware/requireOwnerAuth');
const dashboard = require('../services/ownerDashboardService');
const clientAuth = require('../services/clientAuthService');
const clientImport = require('../services/clientImportService');
const { TIMEZONE, formatStudioDate, formatStudioTime } = require('../utils/studioTimezone');

const router = Router();

router.use(requireOwnerAuth);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    const ok =
      /sheet|excel|spreadsheet|csv|octet-stream/i.test(file.mimetype) ||
      /\.(xlsx|xls|csv)$/i.test(file.originalname || '');
    if (ok) cb(null, true);
    else cb(new Error('Sube un archivo Excel (.xlsx)'));
  },
});

function parsePagination(query) {
  const page = Math.max(1, parseInt(query.page, 10) || 1);
  const limit = Math.min(100, Math.max(1, parseInt(query.limit, 10) || 20));
  return { page, limit };
}

function currentPeriod() {
  const now = new Date();
  const year = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, year: 'numeric' }).format(now)
  );
  const month = Number(
    new Intl.DateTimeFormat('en-US', { timeZone: TIMEZONE, month: 'numeric' }).format(now)
  );
  return { year, month };
}

router.get('/clients', async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const data = await dashboard.listClients({
      search: req.query.search || '',
      page,
      limit,
      status: req.query.status || '',
      treatmentId: req.query.treatmentId || '',
      lastFrom: req.query.lastFrom || '',
      lastTo: req.query.lastTo || '',
      minBookings: req.query.minBookings ?? '',
      maxBookings: req.query.maxBookings ?? '',
    });
    res.json(data);
  } catch (err) {
    console.error('Owner clients error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/clients', async (req, res) => {
  try {
    const { name, phone, email } = req.body || {};
    const result = await clientImport.createManualClient({ name, phone, email });
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error, code: result.code });
    }
    res.status(201).json(result);
  } catch (err) {
    console.error('Owner create client error:', err);
    if (err.code === '23505') {
      return res.status(409).json({ error: 'Cliente duplicado', code: 'DUPLICATE' });
    }
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/clients/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'ID no válido' });
    }
    const client = await dashboard.getClientDetail(id);
    if (!client) {
      return res.status(404).json({ error: 'Cliente no encontrado' });
    }
    res.json({ client });
  } catch (err) {
    console.error('Owner get client error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.patch('/clients/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'ID no válido' });
    }
    const result = await dashboard.updateClient(id, req.body || {});
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error, code: result.code });
    }
    res.json(result);
  } catch (err) {
    console.error('Owner update client error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/calendar', async (req, res) => {
  try {
    const from = req.query.from;
    const to = req.query.to;
    if (!from || !to || isNaN(Date.parse(from)) || isNaN(Date.parse(to))) {
      return res.status(400).json({ error: 'from y to deben ser fechas ISO válidas' });
    }
    const events = await dashboard.listCalendarEvents({ from, to });
    res.json({ events });
  } catch (err) {
    console.error('Owner calendar error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/treatments', async (req, res) => {
  try {
    const treatments = await dashboard.listOwnerTreatments();
    res.json({ treatments });
  } catch (err) {
    console.error('Owner treatments error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/bookings/:id', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'ID no válido' });
    }
    const booking = await dashboard.getBookingDetail(id);
    if (!booking) {
      return res.status(404).json({ error: 'Cita no encontrada' });
    }
    res.json({ booking });
  } catch (err) {
    console.error('Owner get booking error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/bookings', async (req, res) => {
  try {
    const { clientId, treatmentId, startTime, date, time } = req.body || {};
    if (!clientId || !treatmentId || (!startTime && !(date && time))) {
      return res.status(400).json({
        error: 'clientId, treatmentId y startTime (o date+time) son obligatorios',
      });
    }
    const ownerBooking = require('../services/ownerBookingService');
    const result = await ownerBooking.createOwnerBooking({
      clientId: Number(clientId),
      treatmentId,
      startTime,
      date,
      time,
    });
    if (result.error) {
      return res.status(result.status || 400).json({
        error: result.error,
        message: result.message,
        code: result.code,
      });
    }
    res.status(201).json(result);
  } catch (err) {
    console.error('Owner create booking error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/availability', async (req, res) => {
  try {
    const { date, treatmentId } = req.query;
    if (!date || !treatmentId) {
      return res.status(400).json({ error: 'date y treatmentId son obligatorios' });
    }
    const availabilityService = require('../services/availabilityService');
    const data = await availabilityService.getAvailabilityForDate(date, treatmentId, {
      allowInactiveIds: ['micropigmentacion-soft-pixel'],
    });
    if (data.error === 'not_found') {
      return res.status(404).json({ error: 'Tratamiento no encontrado' });
    }
    res.json(data);
  } catch (err) {
    console.error('Owner availability error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/clients/import', upload.single('file'), async (req, res) => {
  try {
    if (!req.file?.buffer) {
      return res.status(400).json({ error: 'Archivo requerido', code: 'MISSING_FILE' });
    }
    const dryRun = String(req.query.dryRun || req.body?.dryRun || '') === 'true';
    const rows = await clientImport.parseXlsxBuffer(req.file.buffer);
    const summary = await clientImport.upsertClientRows(rows, { dryRun });
    res.json({ dryRun, ...summary });
  } catch (err) {
    console.error('Owner import clients error:', err);
    res.status(500).json({ error: err.message || 'Error al importar' });
  }
});

router.post('/clients/:id/invite', async (req, res) => {
  try {
    const id = Number(req.params.id);
    if (!Number.isFinite(id)) {
      return res.status(400).json({ error: 'ID no válido' });
    }
    const result = await clientAuth.createInviteForClient(id);
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error, code: result.code });
    }
    res.json(result);
  } catch (err) {
    console.error('Owner invite client error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/clients/:id/disable', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await clientImport.setAccountStatus(id, 'disabled');
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error, code: result.code });
    }
    res.json(result);
  } catch (err) {
    console.error('Owner disable client error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/clients/:id/enable', async (req, res) => {
  try {
    const id = Number(req.params.id);
    const result = await clientImport.setAccountStatus(id, 'active');
    if (result.error) {
      return res.status(result.status || 400).json({ error: result.error, code: result.code });
    }
    res.json(result);
  } catch (err) {
    console.error('Owner enable client error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/services', async (req, res) => {
  try {
    const { page, limit } = parsePagination(req.query);
    const year = req.query.year != null && req.query.year !== ''
      ? Number(req.query.year)
      : undefined;
    const month = req.query.month != null && req.query.month !== ''
      ? Number(req.query.month)
      : undefined;

    if (year != null && Number.isNaN(year)) {
      return res.status(400).json({ error: 'Año no válido', code: 'INVALID_YEAR' });
    }
    if (month != null && (Number.isNaN(month) || month < 1 || month > 12)) {
      return res.status(400).json({ error: 'Mes no válido', code: 'INVALID_MONTH' });
    }

    const priceMin = req.query.priceMin != null && req.query.priceMin !== ''
      ? Number(req.query.priceMin)
      : undefined;
    const priceMax = req.query.priceMax != null && req.query.priceMax !== ''
      ? Number(req.query.priceMax)
      : undefined;
    if (priceMin != null && Number.isNaN(priceMin)) {
      return res.status(400).json({ error: 'Importe mínimo no válido', code: 'INVALID_PRICE' });
    }
    if (priceMax != null && Number.isNaN(priceMax)) {
      return res.status(400).json({ error: 'Importe máximo no válido', code: 'INVALID_PRICE' });
    }

    const source = ['web', 'google', 'owner'].includes(req.query.source)
      ? req.query.source
      : undefined;

    const data = await dashboard.listServices({
      year,
      month,
      from: req.query.from || undefined,
      to: req.query.to || undefined,
      treatmentId: req.query.treatmentId || undefined,
      client: req.query.client || undefined,
      priceMin,
      priceMax,
      source,
      page,
      limit: Math.min(100, limit),
    });
    res.json(data);
  } catch (err) {
    console.error('Owner services error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/metrics/overview', async (req, res) => {
  try {
    const data = await dashboard.getOverview();
    res.json(data);
  } catch (err) {
    console.error('Owner metrics overview error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/metrics/monthly', async (req, res) => {
  try {
    const months = Math.min(24, Math.max(1, parseInt(req.query.months, 10) || 12));
    const data = await dashboard.getMonthlySeries(months);
    res.json({ months: data });
  } catch (err) {
    console.error('Owner metrics monthly error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/metrics/top-clients', async (req, res) => {
  try {
    const limit = Math.min(20, Math.max(1, parseInt(req.query.limit, 10) || 5));
    const data = await dashboard.getTopClients(limit);
    res.json({ clients: data });
  } catch (err) {
    console.error('Owner top clients error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/metrics/by-treatment', async (req, res) => {
  try {
    const data = await dashboard.getByTreatment();
    res.json({ treatments: data });
  } catch (err) {
    console.error('Owner by-treatment error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/metrics/by-source', async (req, res) => {
  try {
    const data = await dashboard.getBySource();
    res.json({ sources: data });
  } catch (err) {
    console.error('Owner by-source error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/goals', async (req, res) => {
  try {
    const period = currentPeriod();
    const year = parseInt(req.query.year, 10) || period.year;
    const month = parseInt(req.query.month, 10) || period.month;
    const goals = await dashboard.getGoals({ year, month });
    res.json({ year, month, goals });
  } catch (err) {
    console.error('Owner goals error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.post('/goals', async (req, res) => {
  try {
    const { metricKey, periodYear, periodMonth, targetValue } = req.body || {};
    const allowed = ['monthly_revenue', 'yearly_revenue', 'monthly_bookings', 'new_clients'];

    if (!metricKey || !allowed.includes(metricKey)) {
      return res.status(400).json({ error: 'Métrica no válida', code: 'INVALID_METRIC' });
    }
    if (!periodYear || targetValue == null || Number.isNaN(Number(targetValue))) {
      return res.status(400).json({ error: 'Datos incompletos', code: 'INVALID_GOAL' });
    }

    const goal = await dashboard.upsertGoal({
      metricKey,
      periodYear: Number(periodYear),
      periodMonth: periodMonth != null ? Number(periodMonth) : null,
      targetValue: Number(targetValue),
    });

    res.json({ goal });
  } catch (err) {
    console.error('Owner upsert goal error:', err);
    res.status(500).json({ error: 'Error interno del servidor' });
  }
});

router.get('/export/services', async (req, res) => {
  try {
    const priceMin = req.query.priceMin != null && req.query.priceMin !== ''
      ? Number(req.query.priceMin)
      : undefined;
    const priceMax = req.query.priceMax != null && req.query.priceMax !== ''
      ? Number(req.query.priceMax)
      : undefined;
    const source = ['web', 'google', 'owner'].includes(req.query.source)
      ? req.query.source
      : undefined;

    const rows = await dashboard.listServicesForExport({
      year: req.query.year,
      month: req.query.month,
      from: req.query.from,
      to: req.query.to,
      treatmentId: req.query.treatmentId || undefined,
      client: req.query.client || undefined,
      priceMin,
      priceMax,
      source,
    });

    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nere Studio';
    const sheet = workbook.addWorksheet('Servicios');

    sheet.columns = [
      { header: 'Fecha', key: 'date', width: 14 },
      { header: 'Hora', key: 'time', width: 10 },
      { header: 'Cliente', key: 'client', width: 24 },
      { header: 'Email', key: 'email', width: 28 },
      { header: 'Teléfono', key: 'phone', width: 16 },
      { header: 'Tratamiento', key: 'treatment', width: 28 },
      { header: 'Categoría', key: 'category', width: 16 },
      { header: 'Importe (€)', key: 'price', width: 12 },
      { header: 'Origen', key: 'source', width: 10 },
      { header: 'ID reserva', key: 'id', width: 10 },
    ];

    sheet.getRow(1).font = { bold: true };

    const sourceLabel = (s) => {
      if (s === 'google') return 'Google';
      if (s === 'owner') return 'Agenda';
      return 'Web';
    };

    for (const row of rows) {
      const start = new Date(row.start_time);
      sheet.addRow({
        date: formatStudioDate(start),
        time: formatStudioTime(start),
        client: row.client_name,
        email: row.client_email,
        phone: row.client_phone || '',
        treatment: row.treatment_name,
        category: row.treatment_category,
        price: row.price != null ? Number(row.price) : '',
        source: sourceLabel(row.source),
        id: row.id,
      });
    }

    const period = currentPeriod();
    const year = req.query.year || period.year;
    const month = String(req.query.month || period.month).padStart(2, '0');
    const filename = `servicios-nere-studio-${year}-${month}.xlsx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);

    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    console.error('Owner export error:', err);
    if (!res.headersSent) {
      res.status(500).json({ error: 'Error interno del servidor' });
    }
  }
});

module.exports = router;
