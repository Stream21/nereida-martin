const path = require('path');
const fs = require('fs');
const { Router } = require('express');
const multer = require('multer');
const { normalizePhone } = require('../utils/phone');

const router = Router();

const uploadDir = path.join(__dirname, '..', 'uploads', 'micro-requests');
fs.mkdirSync(uploadDir, { recursive: true });

const storage = multer.diskStorage({
  destination: (_req, _file, cb) => cb(null, uploadDir),
  filename: (_req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase() || '.jpg';
    const safeExt = ['.jpg', '.jpeg', '.png', '.webp'].includes(ext) ? ext : '.jpg';
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2)}${safeExt}`);
  },
});

const upload = multer({
  storage,
  limits: { fileSize: 5 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (/^image\/(jpeg|png|webp)$/.test(file.mimetype)) cb(null, true);
    else cb(new Error('Solo imágenes JPEG, PNG o WebP'));
  },
});

const rateBuckets = new Map();
const RATE_WINDOW_MS = 15 * 60 * 1000;
const RATE_MAX = 5;

function checkRateLimit(ip) {
  const now = Date.now();
  let bucket = rateBuckets.get(ip);
  if (!bucket || now - bucket.start > RATE_WINDOW_MS) {
    bucket = { start: now, count: 0 };
    rateBuckets.set(ip, bucket);
  }
  bucket.count += 1;
  return bucket.count <= RATE_MAX;
}

router.post('/micropigmentation', upload.single('photo'), async (req, res) => {
  try {
    const ip = req.ip || req.headers['x-forwarded-for'] || 'unknown';
    if (!checkRateLimit(String(ip))) {
      return res.status(429).json({
        error: 'Demasiadas solicitudes. Inténtalo más tarde.',
        code: 'RATE_LIMIT',
      });
    }

    const name = String(req.body?.name || '').trim();
    const email = String(req.body?.email || '').trim().toLowerCase();
    const phone = String(req.body?.phone || '').trim();
    const notes = String(req.body?.notes || '').trim();

    if (name.length < 2) {
      return res.status(400).json({ error: 'El nombre es obligatorio' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return res.status(400).json({ error: 'Email no válido' });
    }
    const phoneDigits = normalizePhone(phone);
    if (!phoneDigits) {
      return res.status(400).json({ error: 'Teléfono no válido (mínimo 9 dígitos)' });
    }

    const bodyLines = [
      `Nombre: ${name}`,
      `Email: ${email}`,
      `Teléfono: ${phone}`,
      notes ? `Notas: ${notes}` : null,
      req.file ? 'Foto: adjuntada' : 'Sin foto',
      '',
      'La clienta solicita micropigmentación Soft Pixel Brow.',
      'Agenda la cita desde el panel Studio (Agenda) cuando te convenga.',
    ].filter(Boolean);

    const attachments = req.file
      ? [{ filename: req.file.filename, path: req.file.path }]
      : [];

    const emailService = require('../services/emailService');
    await emailService.sendOwnerAlert({
      subject: `Solicitud micropigmentación – ${name} | Nereida Martín Studio`,
      title: 'Nueva solicitud de micropigmentación',
      body: bodyLines.join('\n'),
      attachments,
    });

    res.status(201).json({ ok: true, message: 'Solicitud enviada. Te contactaremos pronto.' });
  } catch (err) {
    console.error('Micropigmentation request error:', err);
    res.status(500).json({ error: 'No se pudo enviar la solicitud' });
  }
});

module.exports = router;
