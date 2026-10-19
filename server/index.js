const express = require('express');
const multer  = require('multer');
const upload  = require('./middleware/upload');
const { extractTextFromFile } = require('./services/extractor');
const { extractCandidateInfo } = require('./services/candidateExtractor');
const { calculateJobMatch } = require('./services/jobMatcher');
const { calculateAtsScore } = require('./services/atsScanner');
const { calculateSemanticMatch } = require('./services/semanticMatcher');

const app  = express();
const PORT = process.env.PORT || 5000;

// ─── CORS ─────────────────────────────────────────────────────────────────────
const ALLOWED_ORIGIN = 'http://localhost:5173';

app.use((req, res, next) => {
  res.setHeader('Access-Control-Allow-Origin',  ALLOWED_ORIGIN);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') return res.sendStatus(204);
  next();
});

// ─── Body parser ──────────────────────────────────────────────────────────────
app.use(express.json());

// ─── In-memory store ──────────────────────────────────────────────────────────
// Resets on server restart. Each job carries a `resumes` array of metadata objects.
// Raw file buffers are NEVER stored here.
const jobs = [];

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDate(date) {
  return date.toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric',
  });
}

function parseSkills(skills) {
  if (Array.isArray(skills))          return skills.map((s) => s.trim()).filter(Boolean);
  if (typeof skills === 'string')     return skills.split(',').map((s) => s.trim()).filter(Boolean);
  return [];
}

/**
 * Map a Multer error code to a human-readable message and HTTP status.
 */
function multerErrorResponse(err) {
  switch (err.code) {
    case 'LIMIT_FILE_SIZE':
      return { status: 413, error: 'One or more files exceed the 5 MB size limit.' };
    case 'LIMIT_FILE_COUNT':
      return { status: 400, error: 'Too many files. Maximum 10 files per upload.' };
    case 'LIMIT_UNEXPECTED_FILE':
      return { status: 400, error: 'Unexpected form field. Use the field name "resumes".' };
    case 'INVALID_FILE_TYPE':
      return { status: 422, error: err.message };
    default:
      return { status: 400, error: err.message || 'File upload error.' };
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────

// GET /api/health
app.get('/api/health', (req, res) => {
  res.status(200).json({
    status: 'ok',
    message: 'ResumeAlign AI server is running',
  });
});

// GET /api/jobs — return all jobs (newest first).
// The `resumes` array is not included in the list response; only its count is,
// to keep payloads small and to avoid returning candidate data unnecessarily.
app.get('/api/jobs', (req, res) => {
  const summary = jobs.map(({ resumes, ...job }) => ({
    ...job,
    resumeCount: resumes.length,
  }));
  res.status(200).json(summary);
});

// POST /api/jobs — create a new job
app.post('/api/jobs', (req, res) => {
  const { title, description, skills, experience, location, salary } = req.body || {};

  const fieldErrors = {};
  if (!title || !String(title).trim())
    fieldErrors.title = 'Job title is required.';
  if (!description || !String(description).trim())
    fieldErrors.description = 'Job description is required.';

  if (Object.keys(fieldErrors).length > 0) {
    return res.status(422).json({
      error:  'Validation failed. Please provide all required fields.',
      fields: fieldErrors,
    });
  }

  const newJob = {
    id:          Date.now(),
    title:       String(title).trim(),
    description: String(description).trim(),
    skills:      parseSkills(skills),
    experience:  String(experience ?? '0').trim(),
    location:    String(location  ?? '').trim() || 'Not specified',
    salary:      String(salary    ?? '').trim() || 'Not specified',
    status:      'Active',
    createdAt:   formatDate(new Date()),
    resumes:     [],   // ← metadata array; buffers are never stored
  };

  jobs.unshift(newJob);
  // Return the job without the (currently empty) resumes array
  const { resumes, ...jobSummary } = newJob;
  res.status(201).json({ ...jobSummary, resumeCount: 0 });
});

// GET /api/jobs/:jobId/candidates — return ranked candidates for a specific job
app.get('/api/jobs/:jobId/candidates', (req, res) => {
  const jobId = Number(req.params.jobId);
  const job   = jobs.find((j) => j.id === jobId);

  if (!job) {
    return res.status(404).json({
      error: `Job with ID ${jobId} not found.`,
    });
  }

  // Clone resumes array and strip private extractedText
  const safeCandidates = job.resumes.map(
    ({ extractedText, ...safeResume }) => safeResume
  );

  // Deterministic Ranking Comparator:
  // 1. Primary: Job Match Score descending. Put unavailable/null Job Match Scores last.
  // 2. Secondary tie-breaker: ATS Compatibility Score descending. (null ATS score treated as -1)
  // 3. Tertiary tie-breaker: Upload time descending (newest first).
  safeCandidates.sort((a, b) => {
    const aScore = typeof a.jobMatch?.score === 'number' ? a.jobMatch.score : -1;
    const bScore = typeof b.jobMatch?.score === 'number' ? b.jobMatch.score : -1;

    // Highest Job Match Score first; null/unavailable (-1) sorted to the bottom
    if (bScore !== aScore) {
      return bScore - aScore;
    }

    // Tie-breaker: ATS Compatibility Score descending
    const aAts = typeof a.atsCompatibility?.score === 'number' ? a.atsCompatibility.score : -1;
    const bAts = typeof b.atsCompatibility?.score === 'number' ? b.atsCompatibility.score : -1;
    if (bAts !== aAts) {
      return bAts - aAts;
    }

    // Tertiary tie-breaker: upload time descending (newest first)
    const aTime = a.uploadedAt ? new Date(a.uploadedAt).getTime() : 0;
    const bTime = b.uploadedAt ? new Date(b.uploadedAt).getTime() : 0;
    return bTime - aTime;
  });

  return res.status(200).json({
    job: {
      id: job.id,
      title: job.title,
      skills: job.skills,
      experience: job.experience,
      location: job.location,
      salary: job.salary,
      createdAt: job.createdAt,
      totalCandidates: safeCandidates.length,
    },
    candidates: safeCandidates,
  });
});

// POST /api/jobs/:jobId/resumes — upload resumes for a specific job
app.post('/api/jobs/:jobId/resumes', (req, res) => {
  // 1. Validate the job exists BEFORE processing files (cheap check first)
  const jobId = Number(req.params.jobId);
  const job   = jobs.find((j) => j.id === jobId);

  if (!job) {
    return res.status(404).json({
      error: `Job with ID ${jobId} not found.`,
    });
  }

  // 2. Run Multer inline so we can intercept its errors and return structured JSON
  upload.array('resumes', 10)(req, res, async (err) => {
    if (err) {
      const { status, error } = multerErrorResponse(err);
      return res.status(status).json({ error });
    }

    const files = req.files || [];

    // 3. Guard: at least one file must be present
    if (files.length === 0) {
      return res.status(400).json({
        error: 'No files were provided. Please select at least one PDF or DOCX file.',
      });
    }

    // 4. Extract text while buffer is available in memory
    // Each file is processed independently; a failed file does not prevent others from succeeding
    const processedResumes = await Promise.all(
      files.map(async (file) => {
        const extraction = await extractTextFromFile(file);

        // Immediate cleanup: discard file buffer so memory is promptly freed
        file.buffer = null;

        // Extract structured candidate details from the already-extracted text
        const candidate = (extraction.status === 'success' && extraction.extractedText)
          ? extractCandidateInfo(extraction.extractedText)
          : { name: null, email: null, phone: null, skills: [], experience: null };

        // Calculate job match score based on job requirements vs candidate qualifications
        const jobMatch = (extraction.status === 'success' && extraction.extractedText)
          ? calculateJobMatch(job, candidate, extraction.extractedText)
          : {
              score: null,
              tier: 'Unavailable',
              applicableCriteria: [],
              summaryNote: 'Job match score unavailable (text extraction was empty or failed).',
              breakdown: null,
              limitations: [],
            };

        // Calculate ATS compatibility score based on document structure, volume, contact info, and text hygiene
        const atsCompatibility = calculateAtsScore(file, extraction, candidate);

        // Calculate semantic relevance based on deep conceptual similarity to job requirements
        const semanticMatch = (extraction.status === 'success' && extraction.extractedText)
          ? await calculateSemanticMatch(job, extraction.extractedText)
          : {
              score: null,
              similarity: null,
              tier: 'Unavailable',
              label: 'Semantic Relevance',
              summaryNote: 'Semantic relevance unavailable (text extraction was empty or failed).',
              chunkCount: 0,
              limitations: ['Resume text extraction was empty or failed.'],
              status: 'unavailable',
            };

        return {
          id: `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`,
          filename: file.originalname,
          size: file.size,
          mimetype: file.mimetype,
          uploadedAt: new Date().toISOString(),
          extractionStatus: extraction.status, // 'success' | 'empty' | 'failed'
          wordCount: extraction.wordCount,
          preview: extraction.preview,         // limited to 500 characters
          extractionNote: extraction.note,
          candidate,                          // structured candidate details (name, email, phone, skills, experience)
          jobMatch,                           // transparent job match score and breakdown
          atsCompatibility,                   // transparent ATS compatibility score, breakdown, suggestions
          semanticMatch,                      // local AI semantic relevance evaluation
          // Full extracted text is stored privately in memory for future candidate scoring
          // and is never exposed in client responses or public list endpoints
          extractedText: extraction.extractedText,
        };
      })
    );

    // 5. Persist records to the correct job in memory
    job.resumes.push(...processedResumes);

    // 6. Return only safe metadata to client (strip private extractedText)
    const safeAccepted = processedResumes.map(
      ({ extractedText, ...safeResume }) => safeResume
    );

    return res.status(200).json({
      message: `${safeAccepted.length} resume(s) uploaded for "${job.title}".`,
      accepted: safeAccepted,
      jobId: job.id,
      jobTitle: job.title,
    });
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`ResumeAlign AI server running on http://localhost:${PORT}`);
});
