/**
 * extractor.js — In-memory text extraction service for PDF and DOCX files.
 *
 * Security & Reliability Posture:
 *   • Operates entirely on in-memory buffers; files never touch disk.
 *   • PDF parsing via pdf-parse; DOCX parsing via mammoth.
 *   • Enforces an async timeout per file via Promise.race so adversarial or
 *     pathological files cannot block the server.
 *     (Note: Promise.race does not cancel CPU-bound JavaScript execution in the event
 *     loop, but prevents the HTTP request pipeline from hanging indefinitely.)
 *   • Distinguishes between successful extraction, empty/scanned files, and
 *     unparseable/corrupted files.
 *   • Raw parser error messages and internal stack traces are NEVER exposed.
 *   • Returns a sanitized result with safe status, word count, 500-char preview,
 *     and safe human-readable note. The full extracted text is retained only for
 *     server-side in-memory candidate analysis and must not be exposed via public APIs.
 */

const path = require('path');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');

const EXTRACTION_TIMEOUT_MS = 10000; // 10 seconds per file
const MAX_PREVIEW_CHARS = 500;

/**
 * Counts words by splitting on non-whitespace sequences.
 * Returns 0 for empty or whitespace-only input.
 */
function calculateWordCount(text) {
  if (!text || typeof text !== 'string') return 0;
  const matches = text.trim().match(/\S+/g);
  return matches ? matches.length : 0;
}

/**
 * Produces a safe preview string capped at maxChars (default 500).
 * Cleans excessive interior whitespace for clean presentation while preserving readability.
 */
function generatePreview(text, maxChars = MAX_PREVIEW_CHARS) {
  if (!text || typeof text !== 'string') return '';
  const trimmed = text.trim();
  if (trimmed.length <= maxChars) {
    return trimmed;
  }
  return trimmed.slice(0, maxChars);
}

/**
 * Wraps an extraction promise with an asynchronous timeout.
 * Note: Promise.race prevents the HTTP request from hanging indefinitely,
 * but does not abort the underlying parsing work in the JavaScript event loop.
 */
function withTimeout(promise, ms, filename) {
  let timer;
  const timeoutPromise = new Promise((_, reject) => {
    timer = setTimeout(() => {
      const err = new Error(`Extraction timed out for "${filename}" after ${ms / 1000}s`);
      err.code = 'EXTRACTION_TIMEOUT';
      reject(err);
    }, ms);
  });

  return Promise.race([promise, timeoutPromise]).finally(() => {
    clearTimeout(timer);
  });
}

/**
 * Extracts raw text from a PDF in-memory buffer.
 */
async function parsePdf(buffer) {
  const data = await pdfParse(buffer);
  return (data && typeof data.text === 'string') ? data.text : '';
}

/**
 * Extracts raw text from a DOCX in-memory buffer using mammoth.
 */
async function parseDocx(buffer) {
  const result = await mammoth.extractRawText({ buffer });
  return (result && typeof result.value === 'string') ? result.value : '';
}

/**
 * Extracts text from an uploaded Multer file object.
 *
 * @param {Object} file - Multer file object with { buffer, originalname, mimetype }
 * @returns {Promise<{
 *   status: 'success' | 'empty' | 'failed',
 *   wordCount: number,
 *   preview: string,
 *   extractedText: string,
 *   note: string
 * }>}
 */
async function extractTextFromFile(file) {
  if (!file || !file.buffer) {
    return {
      status: 'failed',
      wordCount: 0,
      preview: '',
      extractedText: '',
      note: 'No file buffer available for text extraction.',
    };
  }

  const filename = file.originalname || 'unknown';
  const ext = path.extname(filename).toLowerCase();
  const mimetype = (file.mimetype || '').toLowerCase();

  const isPdf = ext === '.pdf' || mimetype === 'application/pdf';
  const isDocx = ext === '.docx' ||
    mimetype === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';

  if (!isPdf && !isDocx) {
    return {
      status: 'failed',
      wordCount: 0,
      preview: '',
      extractedText: '',
      note: 'Unsupported file type. Only PDF and DOCX files are supported.',
    };
  }

  try {
    const parsePromise = isPdf ? parsePdf(file.buffer) : parseDocx(file.buffer);
    const rawText = await withTimeout(parsePromise, EXTRACTION_TIMEOUT_MS, filename);
    const trimmed = (rawText || '').trim();

    if (trimmed.length === 0) {
      return {
        status: 'empty',
        wordCount: 0,
        preview: '',
        extractedText: '',
        note: 'No extractable text found. The document may be scanned, image-only, or empty (OCR is not supported).',
      };
    }

    const wordCount = calculateWordCount(trimmed);
    const preview = generatePreview(trimmed, MAX_PREVIEW_CHARS);

    return {
      status: 'success',
      wordCount,
      preview,
      extractedText: rawText,
      note: 'Text extracted successfully.',
    };
  } catch (err) {
    const errMessage = (err && err.message) ? String(err.message).toLowerCase() : '';
    const errName = (err && err.name) ? String(err.name) : '';

    let note = 'Unable to parse file contents. The file may be corrupted or invalid.';

    if (errName === 'PasswordException' || errMessage.includes('password') || errMessage.includes('encrypt')) {
      note = 'File is password-protected or encrypted and cannot be read.';
    } else if ((err && err.code === 'EXTRACTION_TIMEOUT') || errMessage.includes('timed out')) {
      note = 'Extraction timed out while reading document content.';
      
    }

    return {
      status: 'failed',
      wordCount: 0,
      preview: '',
      extractedText: '',
      note,
    };
  }
}

module.exports = {
  extractTextFromFile,
  calculateWordCount,
  generatePreview,
  MAX_PREVIEW_CHARS,
};
