/**
 * semanticMatcher.js — Transparent, local AI semantic matching service for ResumeAlign AI.
 *
 * Architecture & Capabilities:
 *   • Powered by @huggingface/transformers and Xenova/all-MiniLM-L6-v2 (quantized 8-bit).
 *   • Runs 100% locally in-process via onnxruntime-node. Zero external API calls, zero paid tokens.
 *   • Singleton pipeline initializer with local-first offline caching.
 *   • Chunked section mean-pooling for long resumes to avoid lossy single-window truncation.
 *   • Cosine similarity between job description embedding and candidate resume embedding.
 *   • Safe fallbacks for empty text, failed extractions, and model initialization errors.
 *   • Preserves candidate privacy: vectors and extracted text are kept private in-memory.
 *   • Explicitly labeled as 'Semantic Relevance' (measuring contextual textual proximity,
 *     NOT a deterministic judgment of candidate hiring suitability).
 */

const dns = require('node:dns');

// Prefer IPv4 resolution to prevent CloudFront IPv6 handshake drops on Windows/ISPs
try {
  dns.setDefaultResultOrder('ipv4first');
} catch (_) {}

// Singleton pipeline promise
let pipelineInstancePromise = null;

// In-memory cache for job description embeddings: Map<jobIdOrHash, Float32Array>
const jobEmbeddingCache = new Map();

/**
 * Retrieves or initializes the shared embedding pipeline singleton.
 * Configured with offline-first local cache resolution.
 */
async function getSemanticPipeline() {
  if (!pipelineInstancePromise) {
    pipelineInstancePromise = (async () => {
      const { pipeline, env } = await import('@huggingface/transformers');

      // Attempt 1: Local cache only (guaranteed offline after initial cache population)
      try {
        env.allowRemoteModels = false;
        env.localFilesOnly = true;
        const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
          dtype: 'q8',
        });
        return extractor;
      } catch (offlineErr) {
        // Attempt 2: If local cache is not populated yet, permit remote fetch to populate it
        env.allowRemoteModels = true;
        env.localFilesOnly = false;
        const extractor = await pipeline('feature-extraction', 'Xenova/all-MiniLM-L6-v2', {
          dtype: 'q8',
        });
        return extractor;
      }
    })().catch((err) => {
      // Reset promise on initialization failure so subsequent requests can retry
      pipelineInstancePromise = null;
      throw err;
    });
  }

  return pipelineInstancePromise;
}

/**
 * Computes cosine similarity between two float vectors.
 * Returns a value between -1.0 and 1.0.
 */
function computeCosineSimilarity(vecA, vecB) {
  if (!vecA || !vecB || vecA.length !== vecB.length || vecA.length === 0) {
    return 0;
  }
  let dotProduct = 0;
  let normA = 0;
  let normB = 0;
  for (let i = 0; i < vecA.length; i++) {
    dotProduct += vecA[i] * vecB[i];
    normA += vecA[i] * vecA[i];
    normB += vecB[i] * vecB[i];
  }
  if (normA === 0 || normB === 0) return 0;
  return dotProduct / (Math.sqrt(normA) * Math.sqrt(normB));
}

/**
 * Normalizes a vector in-place or returns a new unit-length vector.
 */
function normalizeVector(vec) {
  let sumSq = 0;
  for (let i = 0; i < vec.length; i++) {
    sumSq += vec[i] * vec[i];
  }
  const magnitude = Math.sqrt(sumSq);
  if (magnitude === 0) return vec;
  const normalized = new Float32Array(vec.length);
  for (let i = 0; i < vec.length; i++) {
    normalized[i] = vec[i] / magnitude;
  }
  return normalized;
}

/**
 * Splits resume text into sensible chunks of ~120-180 words.
 * Honors section breaks and paragraph boundaries where available
 * rather than hard-cutting sentences or relying blindly on model truncation.
 */
function chunkResumeText(text, targetWordCount = 150) {
  if (!text || typeof text !== 'string') return [];

  // Split on double newlines or common section header patterns
  const rawParagraphs = text
    .split(/\n\s*\n|(?:\r?\n)(?=[A-Z\s]{3,25}:|\b(?:EXPERIENCE|EDUCATION|SKILLS|PROJECTS|SUMMARY|WORK HISTORY|CERTIFICATIONS)\b)/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 0);

  const chunks = [];
  let currentChunkWords = [];

  for (const para of rawParagraphs) {
    const words = para.split(/\s+/).filter(Boolean);
    if (words.length === 0) continue;

    if (currentChunkWords.length + words.length <= targetWordCount) {
      currentChunkWords.push(...words);
    } else {
      if (currentChunkWords.length > 0) {
        chunks.push(currentChunkWords.join(' '));
        currentChunkWords = [];
      }

      // If a single paragraph is longer than targetWordCount, split it into slices
      if (words.length > targetWordCount) {
        for (let i = 0; i < words.length; i += targetWordCount) {
          chunks.push(words.slice(i, i + targetWordCount).join(' '));
        }
      } else {
        currentChunkWords.push(...words);
      }
    }
  }

  if (currentChunkWords.length > 0) {
    chunks.push(currentChunkWords.join(' '));
  }

  // Safety fallback: if no chunks were formed, return original text trimmed
  return chunks.length > 0 ? chunks : [text.trim()];
}

/**
 * Extracts a normalized 384-dimensional embedding for a single text block.
 */
async function embedSingleText(extractor, text) {
  const output = await extractor(text, { pooling: 'mean', normalize: true });
  return new Float32Array(output.data);
}

/**
 * Generates a composite embedding for document text.
 * For long texts, chunks the document, embeds each chunk, and mean-pools them
 * into a single document-level unit vector.
 */
async function embedDocumentText(extractor, text) {
  const chunks = chunkResumeText(text);

  if (chunks.length === 1) {
    const vec = await embedSingleText(extractor, chunks[0]);
    return { embedding: vec, chunkCount: 1 };
  }

  // Multi-chunk document: embed each chunk and pool
  const chunkEmbeddings = await Promise.all(
    chunks.map((chunk) => embedSingleText(extractor, chunk))
  );

  const dim = chunkEmbeddings[0].length;
  const pooled = new Float32Array(dim);

  for (const emb of chunkEmbeddings) {
    for (let d = 0; d < dim; d++) {
      pooled[d] += emb[d];
    }
  }

  for (let d = 0; d < dim; d++) {
    pooled[d] /= chunkEmbeddings.length;
  }

  return { embedding: normalizeVector(pooled), chunkCount: chunks.length };
}

/**
 * Maps a cosine similarity score (typically 0.0 - 0.85) to an explainable tier.
 */
function getSemanticTier(score) {
  if (typeof score !== 'number' || isNaN(score)) return 'Unavailable';
  if (score >= 65) return 'High Semantic Relevance';
  if (score >= 45) return 'Moderate Semantic Relevance';
  if (score >= 25) return 'Low Semantic Relevance';
  return 'Minimal / Unrelated';
}

/**
 * Calculates local AI semantic similarity between a job description and extracted resume text.
 *
 * @param {object} job - Job object containing title, description, and skills.
 * @param {string} resumeText - Full extracted resume text (kept private in server memory).
 * @returns {Promise<object>} Explainable semantic match result.
 */
async function calculateSemanticMatch(job, resumeText) {
  const resultTemplate = {
    score: null,             // 0 - 100 scaled integer score
    similarity: null,        // raw cosine similarity (-1.0 to 1.0, formatted to 4 decimals)
    tier: 'Unavailable',
    label: 'Semantic Relevance',
    summaryNote: '',
    chunkCount: 0,
    limitations: [],
    status: 'unavailable',   // 'success' | 'unavailable' | 'error'
  };

  // 1. Guard: Check resume text validity
  if (!resumeText || typeof resumeText !== 'string' || !resumeText.trim()) {
    return {
      ...resultTemplate,
      summaryNote: 'Semantic relevance unavailable (resume text extraction was empty or unparseable).',
      limitations: ['No readable textual content extracted from the uploaded document.'],
    };
  }

  // 2. Guard: Check job description validity
  const jobTitle = String(job?.title || '').trim();
  const jobDescription = String(job?.description || '').trim();
  const jobSkills = Array.isArray(job?.skills) ? job.skills.join(', ') : '';

  const combinedJobText = [
    jobTitle ? `Job Title: ${jobTitle}` : '',
    jobDescription,
    jobSkills ? `Key Skills: ${jobSkills}` : '',
  ]
    .filter(Boolean)
    .join('\n\n')
    .trim();

  if (!combinedJobText) {
    return {
      ...resultTemplate,
      summaryNote: 'Semantic relevance unavailable (job has no description or title to compare against).',
      limitations: ['Job description text is required to evaluate semantic relevance.'],
    };
  }

  try {
    // 3. Load or reuse singleton embedding pipeline
    const extractor = await getSemanticPipeline();

    // 4. Retrieve or compute cached job embedding
    const jobCacheKey = job?.id ? `job-${job.id}` : combinedJobText;
    let jobEmbedding = jobEmbeddingCache.get(jobCacheKey);

    if (!jobEmbedding) {
      const jobDoc = await embedDocumentText(extractor, combinedJobText);
      jobEmbedding = jobDoc.embedding;
      if (job?.id) {
        jobEmbeddingCache.set(jobCacheKey, jobEmbedding);
      }
    }

    // 5. Generate candidate resume embedding using chunked section pooling
    const { embedding: resumeEmbedding, chunkCount } = await embedDocumentText(extractor, resumeText);

    // 6. Compute cosine similarity
    const rawSimilarity = computeCosineSimilarity(jobEmbedding, resumeEmbedding);

    // Clamp cosine similarity to 0 - 1 for UI score scaling (cosine is typically 0.0 - 0.85 for language models)
    const scaledScore = Math.max(0, Math.min(100, Math.round(rawSimilarity * 100)));
    const tier = getSemanticTier(scaledScore);

    return {
      score: scaledScore,
      similarity: Number(rawSimilarity.toFixed(4)),
      tier,
      label: 'Semantic Relevance',
      summaryNote: `Evaluated semantic relevance using local pretrained sentence embeddings across ${chunkCount} document chunk(s).`,
      chunkCount,
      limitations: [
        'Measures conceptual and contextual vocabulary similarity between the job description and resume.',
        'Does not measure candidate qualification authenticity, character, or hiring suitability probability.',
      ],
      status: 'success',
    };
  } catch (error) {
    // Non-fatal error handling: server continues operating even if local inference encounters an issue
    return {
      ...resultTemplate,
      status: 'error',
      summaryNote: 'Semantic relevance calculation encountered an internal error.',
      limitations: [
        `Local inference error: ${error.message || 'Model execution failed'}`,
      ],
    };
  }
}

/**
 * Clears the in-memory job embedding cache (useful for tests or job updates).
 */
function clearJobEmbeddingCache(jobId = null) {
  if (jobId) {
    jobEmbeddingCache.delete(`job-${jobId}`);
  } else {
    jobEmbeddingCache.clear();
  }
}

module.exports = {
  calculateSemanticMatch,
  getSemanticPipeline,
  chunkResumeText,
  computeCosineSimilarity,
  clearJobEmbeddingCache,
};
