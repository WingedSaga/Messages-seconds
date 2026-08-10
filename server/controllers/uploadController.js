const crypto = require('crypto');
const { supabase, STORAGE_BUCKET, ensureStorageBucket } = require('../db/supabase');

// Предел одного файла в хранилище: на бесплатном тарифе Supabase это 50 МБ.
const MAX_BYTES = Number(process.env.SUPABASE_CHAT_MAX_BYTES) || 25 * 1024 * 1024;

const IMAGE_EXTENSIONS = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
};

// Что можно приложить файлом. Список закрытый: исполняемое и архивы в чат
// не кладут, а разбирать их содержимое на Raspberry Pi нечем.
const FILE_EXTENSIONS = {
  'application/pdf': 'pdf',
  'text/plain': 'txt',
  'audio/mpeg': 'mp3',
  'audio/ogg': 'ogg',
  'video/mp4': 'mp4',
};

function extensionOf(name) {
  const match = /\.([a-z0-9]{1,8})$/i.exec(name || '');
  return match ? match[1].toLowerCase() : 'bin';
}

// POST /api/upload — вложение к сообщению.
async function uploadAttachment(req, res, next) {
  try {
    await ensureStorageBucket();
    if (!req.file) return res.status(400).json({ message: 'Файл не передан' });

    const isImage = Boolean(IMAGE_EXTENSIONS[req.file.mimetype]);
    const isFile = Boolean(FILE_EXTENSIONS[req.file.mimetype]);

    if (!isImage && !isFile) {
      return res.status(400).json({
        message: 'Можно прикрепить картинку, PDF, текст, mp3 или mp4',
      });
    }

    if (req.file.size > MAX_BYTES) {
      return res.status(413).json({
        message: `Файл больше ${Math.round(MAX_BYTES / 1048576)} МБ`,
      });
    }

    const extension = IMAGE_EXTENSIONS[req.file.mimetype] || FILE_EXTENSIONS[req.file.mimetype];
    // Имя на диске случайное: в исходном бывают пробелы, кириллица и чужие
    // расширения, а ссылка должна оставаться предсказуемой.
    const path = `${req.user.id}/${Date.now()}-${crypto.randomUUID()}.${extension}`;

    const { error } = await supabase.storage
      .from(STORAGE_BUCKET)
      .upload(path, req.file.buffer, { contentType: req.file.mimetype, upsert: false });

    if (error) throw error;

    const { data } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);

    res.status(201).json({
      url: data.publicUrl,
      type: isImage ? 'image' : 'file',
      name: req.file.originalname || `файл.${extensionOf(req.file.originalname)}`,
      size: req.file.size,
    });
  } catch (err) {
    next(err);
  }
}

module.exports = { uploadAttachment, MAX_BYTES };
