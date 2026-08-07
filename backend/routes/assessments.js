const path = require('path');
const fs = require('fs');
const { Router } = require('express');
const multer = require('multer');
const { query } = require('../db/pool');
const requireClientAuth = require('../middleware/requireClientAuth');
const { normalizePhone } = require('../utils/phone');

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

router.post('/henna', requireClientAuth, upload.single('photo'), async (req, res) => {
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
    const phoneDigits = normalizePhone(clientPhone);
    if (!phoneDigits) {
      return res.status(400).json({ error: 'clientPhone debe tener al menos 9 dígitos' });
    }

    const authRes = await query(
      `SELECT id, email, account_status FROM clients WHERE id = $1`,
      [req.clientAuth.clientId]
    );
    const authClient = authRes.rows[0];
    if (!authClient || authClient.account_status !== 'active') {
      return res.status(403).json({ error: 'Cuenta no autorizada', code: 'ACCOUNT_INACTIVE' });
    }

    const email = clientEmail.trim().toLowerCase();
    if (authClient.email && email !== String(authClient.email).toLowerCase()) {
      return res.status(403).json({ error: 'El email no coincide con tu cuenta', code: 'EMAIL_MISMATCH' });
    }

    await query(
      `UPDATE clients
       SET name = $1,
           email = COALESCE(email, $2),
           phone = $3,
           phone_normalized = COALESCE($4, phone_normalized)
       WHERE id = $5`,
      [clientName.trim(), email, clientPhone.trim(), phoneDigits, authClient.id]
    );
    const clientId = authClient.id;

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
