// server/routes/uploads.js
// Subida de imágenes (fondo personalizado, y cualquier otra imagen que el
// proyecto necesite en el futuro). Se guardan en disco en server/uploads/
// y se sirven como archivos estáticos normales desde /uploads/<archivo>
// (montado en server.js). Solo la subida exige sesión; ver un archivo ya
// subido por su URL no la exige, igual que cualquier recurso estático.

const express = require('express');
const multer = require('multer');
const path = require('path');
const crypto = require('crypto');
const fs = require('fs');

const router = express.Router();

const UPLOADS_DIR = path.join(__dirname, '..', 'uploads');
fs.mkdirSync(UPLOADS_DIR, { recursive: true });

const ALLOWED_MIME_TYPES = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
const MAX_SIZE_BYTES = 5 * 1024 * 1024; // 5 MB

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname).toLowerCase();
    const uniqueName = crypto.randomBytes(16).toString('hex') + ext;
    cb(null, uniqueName);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: MAX_SIZE_BYTES },
  fileFilter: (req, file, cb) => {
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return cb(new Error('Tipo de archivo no permitido. Solo imágenes JPG, PNG, WEBP o GIF.'));
    }
    cb(null, true);
  }
});

// POST /api/uploads — campo 'file' en multipart/form-data
router.post('/', (req, res) => {
  upload.single('file')(req, res, (err) => {
    if (err instanceof multer.MulterError) {
      if (err.code === 'LIMIT_FILE_SIZE') {
        return res.status(400).json({ error: `El archivo supera el límite de ${MAX_SIZE_BYTES / 1024 / 1024}MB` });
      }
      return res.status(400).json({ error: err.message });
    }
    if (err) return res.status(400).json({ error: err.message });
    if (!req.file) return res.status(400).json({ error: 'No se recibió ningún archivo' });

    res.json({ url: `/uploads/${req.file.filename}` });
  });
});

module.exports = router;
