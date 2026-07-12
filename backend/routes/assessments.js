const path = require('path');
const fs = require('fs');
const { Router } = require('express');
const multer = require('multer');
const { query } = require('../db/pool');

const router = Router();

const uploadDir = path.join(__dirname, '..', 'uploads', 'henna');
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

router.post('/henna', upload.single('photo'), async (req, res) => {
  try {
    const { clientEmail, clientName, clientPhone } = req.body;

    if (!req.file) {
      return res.status(400).json({ error: 'La foto es obligatoria' });
    }
    if (!clientEmail || !clientName || !clientPhone) {
      return res.status(400).json({ error: 'clientEmail, clientName y clientPhone son obligatorios' });
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clientEmail.trim())) {
      return res.status(400).json({ error: 'clientEmail debe ser un email válido' });
    }
    const phoneDigits = String(clientPhone).replace(/\D/g, '');
    if (phoneDigits.length < 9) {
      return res.status(400).json({ error: 'clientPhone debe tener al menos 9 dígitos' });
    }

    const email = clientEmail.trim().toLowerCase();
    const clientResult = await query(
      `INSERT INTO clients (name, email, phone)
       VALUES ($1, $2, $3)
       ON CONFLICT (email) DO UPDATE SET name = $1, phone = COALESCE($3, clients.phone)
       RETURNING id`,
      [clientName.trim(), email, clientPhone.trim()]
    );
    const clientId = clientResult.rows[0].id;

    const relativePath = path.join('henna', req.file.filename).replace(/\\/g, '/');
    const assessmentResult = await query(
      `INSERT INTO henna_assessments (client_id, photo_path, status)
       VALUES ($1, $2, 'pending')
       RETURNING id, photo_path, status, created_at`,
      [clientId, relativePath]
    );

    res.status(201).json({
      assessmentId: assessmentResult.rows[0].id,
      photoPath: assessmentResult.rows[0].photo_path,
      status: assessmentResult.rows[0].status,
    });
  } catch (err) {
    console.error('Henna assessment upload error:', err);
    res.status(500).json({ error: err.message || 'Error al subir la foto' });
  }
});

module.exports = router;
