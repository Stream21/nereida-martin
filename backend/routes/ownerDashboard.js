const { Router } = require('express');
const ExcelJS = require('exceljs');
const requireOwnerAuth = require('../middleware/requireOwnerAuth');
const dashboard = require('../services/ownerDashboardService');
const { TIMEZONE, formatStudioDate, formatStudioTime } = require('../utils/studioTimezone');

const router = Router();

router.use(requireOwnerAuth);

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
    });
    res.json(data);
  } catch (err) {
    console.error('Owner clients error:', err);
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

    const data = await dashboard.listServices({
      year,
      month,
      from: req.query.from,
      to: req.query.to,
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
    const rows = await dashboard.listServicesForExport({
      year: req.query.year,
      month: req.query.month,
      from: req.query.from,
      to: req.query.to,
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
        source: row.source === 'google' ? 'Google' : 'Web',
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
