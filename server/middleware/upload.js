/**
 * upload.js — Multer configuration for resume uploads.
 *
 * Security posture:
 *   • memoryStorage: files never touch disk.
 *   • fileFilter: checks BOTH extension AND MIME type declared by the client.
 *     Note — MIME type comes from the browser's Content-Type header, not from
 *     parsing the file's bytes. A determined attacker could spoof it. This
 *     layer is a reasonable first guard; byte-level magic-number checking
 *     would be the next hardening step.
 *   • 5 MB per-file limit, 10-file limit.
 *   • Raw buffers are discarded after metadata is extracted; never returned
 *     to the client or logged.
 */

const multer = require('multer');
const path   = require('path');

// ── Allowed file types ────────────────────────────────────────────────────────

const ALLOWED_MIMETYPES = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
]);

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx']);

// ── File filter ───────────────────────────────────────────────────────────────

function fileFilter(req, file, cb) {
  const ext    = path.extname(file.originalname).toLowerCase();
  const extOk  = ALLOWED_EXTENSIONS.has(ext);
  const mimeOk = ALLOWED_MIMETYPES.has(file.mimetype);

  if (extOk && mimeOk) {
    cb(null, true);
  } else {
    // Attach a custom code so the route handler can return the right HTTP status
    const err = new Error(
      `"${file.originalname}" is not allowed. ` +
      `Only PDF and DOCX files are accepted (detected type: ${file.mimetype}).`
    );
    err.code   = 'INVALID_FILE_TYPE';
    err.status = 422;
    cb(err, false);
  }
}

// ── Multer instance ───────────────────────────────────────────────────────────

const upload = multer({
  storage: multer.memoryStorage(),   // in-memory only — no disk writes
  limits: {
    fileSize: 5 * 1024 * 1024,       // 5 MB per file
    files:    10,                    // maximum 10 files per request
  },
  fileFilter,
});

module.exports = upload;
