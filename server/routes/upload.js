const express = require('express');
const multer = require('multer');
const { uploadLimiter } = require('../middleware/rateLimiters');
const { uploadAttachment, MAX_BYTES } = require('../controllers/uploadController');

const router = express.Router();

// Файл держится в памяти и сразу уходит в Supabase Storage: предел небольшой,
// а временные файлы на карте памяти Raspberry Pi пришлось бы убирать вручную.
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: MAX_BYTES } });

router.post(
  '/',
  uploadLimiter,
  (req, res, next) => {
    upload.single('file')(req, res, (err) => {
      // Multer отвечает по-английски и статусом 500 — переводим на язык
      // интерфейса и в понятный код ответа.
      if (err?.code === 'LIMIT_FILE_SIZE') {
        return res.status(413).json({
          message: `Файл больше ${Math.round(MAX_BYTES / 1048576)} МБ`,
        });
      }
      if (err) return res.status(400).json({ message: 'Не удалось принять файл' });
      next();
    });
  },
  uploadAttachment
);

module.exports = router;
