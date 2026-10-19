/**
 * atsScanner.js — Transparent, dependency-free ATS Compatibility Scoring service.
 *
 * Evaluates document readability, section structure, and text extraction hygiene
 * completely independent of Job Match Score.
 *
 * Scoring Categories (Max 100 pts):
 *   1. Content Volume & Density (30 pts): Ideal word count range (200 - 1,200 words).
 *   2. Section Structure (30 pts): Standard Experience, Education, and Skills headings.
 *   3. Contact Completeness (25 pts): Cleanly detectable Email (10), Phone (10), and Name (5).
 *   4. Text Hygiene (15 pts): Evaluates encoding artifacts (replacement characters,
 *      control chars, broken font glyphs) while fully permitting valid Unicode text.
 *
 * Safety & Transparency Rules:
 *   • Empty or unparseable files receive an explicit 'Unparseable' tier (score: null).
 *   • Missing contact fields are treated as a heuristic signal, not proof of ATS rejection.
 *   • Zero external dependencies, pure explainable JavaScript.
 */

// Detects unreadable encoding artifacts: Unicode replacement chars (\uFFFD),
// unprintable control characters (excluding tab, newline, carriage return),
// private use area characters, and common PDF font CID mapping glitches (cid:XX).
const ARTIFACT_REGEX = /[\uFFFD\u0000-\u0008\u000B\u000C\u000E-\u001F\uE000-\uF8FF]|\(cid:\d+\)/g;

/**
 * Evaluates text hygiene by detecting replacement/control characters and CID font artifacts,
 * while intentionally allowing valid international Unicode (accents, umlauts, CJK, Cyrillic, etc.).
 */
function evaluateTextHygiene(rawText) {
  if (!rawText || typeof rawText !== 'string' || rawText.length === 0) {
    return { score: 0, maxScore: 15, status: 'No text available to evaluate encoding hygiene.' };
  }

  const matches = rawText.match(ARTIFACT_REGEX);
  const artifactCount = matches ? matches.length : 0;
  const totalChars = rawText.length;
  const artifactRatio = artifactCount / totalChars;

  if (artifactCount === 0) {
    return {
      score: 15,
      maxScore: 15,
      artifactCount: 0,
      status: 'Clean text stream with valid character encoding and no corrupt font artifacts.',
    };
  }

  if (artifactRatio < 0.005) {
    // Minor artifacts (< 0.5% of characters)
    return {
      score: 8,
      maxScore: 15,
      artifactCount,
      status: `Minor font/character artifacts detected (${artifactCount} instance(s)).`,
    };
  }

  // Significant noise/corruption (broken PDF ligatures or font encoding errors)
  return {
    score: 0,
    maxScore: 15,
    artifactCount,
    status: `Significant encoding artifacts detected (${artifactCount} instance(s)) — text may stem from complex layout graphics or non-standard font encodings.`,
  };
}

/**
 * Evaluates document content volume and word density.
 */
function evaluateContentVolume(wordCount) {
  const count = typeof wordCount === 'number' ? wordCount : 0;

  if (count >= 200 && count <= 1200) {
    return {
      score: 30,
      maxScore: 30,
      wordCount: count,
      status: `Ideal professional resume length (${count} words detected).`,
    };
  }

  if (count >= 100 && count < 200) {
    return {
      score: 20,
      maxScore: 30,
      wordCount: count,
      status: `Brief content (${count} words) — consider expanding on project achievements and responsibilities.`,
    };
  }

  if (count > 1200 && count <= 1800) {
    return {
      score: 20,
      maxScore: 30,
      wordCount: count,
      status: `Lengthy content (${count} words) — standard 1–2 page resumes typically contain under 1,200 words.`,
    };
  }

  if (count > 0 && count < 100) {
    return {
      score: 10,
      maxScore: 30,
      wordCount: count,
      status: `Sparse content (${count} words) — insufficient text density for optimal parsing.`,
    };
  }

  if (count > 1800) {
    return {
      score: 10,
      maxScore: 30,
      wordCount: count,
      status: `Excessive content volume (${count} words) — multi-page documents may exceed ATS character buffers.`,
    };
  }

  return {
    score: 0,
    maxScore: 30,
    wordCount: 0,
    status: 'Zero words detected in document.',
  };
}

/**
 * Checks for the presence of standard ATS section headers in the extracted text.
 */
function evaluateSectionStructure(rawText) {
  if (!rawText || typeof rawText !== 'string') {
    return {
      score: 0,
      maxScore: 30,
      detected: [],
      missing: ['Experience', 'Education', 'Skills'],
      status: 'No standard section headings detected.',
    };
  }

  const detected = [];
  const missing = [];

  // 1. Experience / Work History
  if (/\b(?:experience|work history|employment history|professional experience|work experience|employment background)\b/i.test(rawText)) {
    detected.push('Experience');
  } else {
    missing.push('Experience');
  }

  // 2. Education
  if (/\b(?:education|academic background|academics|qualifications|degrees?|educational background|university|college)\b/i.test(rawText)) {
    detected.push('Education');
  } else {
    missing.push('Education');
  }

  // 3. Skills
  if (/\b(?:skills|technical skills|technologies|core competencies|areas of expertise|competencies|tech stack)\b/i.test(rawText)) {
    detected.push('Skills');
  } else {
    missing.push('Skills');
  }

  const score = detected.length * 10;
  let status = `Detected all 3 standard sections (${detected.join(', ')}).`;
  if (missing.length > 0) {
    status = `Detected ${detected.length} of 3 standard sections. Missing standard heading(s): ${missing.join(', ')}.`;
  }

  return {
    score,
    maxScore: 30,
    detected,
    missing,
    status,
  };
}

/**
 * Evaluates contact info extractability as a heuristic completeness signal.
 */
function evaluateContactCompleteness(candidate) {
  const detected = [];
  const missing = [];
  let score = 0;

  if (candidate?.email) {
    detected.push('Email');
    score += 10;
  } else {
    missing.push('Email');
  }

  if (candidate?.phone) {
    detected.push('Phone');
    score += 10;
  } else {
    missing.push('Phone');
  }

  if (candidate?.name) {
    detected.push('Name');
    score += 5;
  } else {
    missing.push('Name');
  }

  let status = 'Complete contact details detected.';
  if (missing.length > 0) {
    status = `Cleanly detected ${detected.join(', ') || 'none'}; could not detect ${missing.join(', ')}.`;
  }

  return {
    score,
    maxScore: 25,
    detected,
    missing,
    status,
    note: 'Heuristic check: missing fields indicate extraction uncertainty or non-standard formatting, not absolute ATS incompatibility.',
  };
}

/**
 * Calculates the comprehensive ATS Compatibility Score.
 *
 * @param {Object} file - File metadata { originalname, size, mimetype }
 * @param {Object} extraction - Extraction result { status, wordCount, preview, extractedText }
 * @param {Object} candidate - Extracted candidate metadata { name, email, phone, skills, experience }
 * @returns {Object} ATS compatibility assessment object
 */
function calculateAtsScore(file, extraction, candidate) {
  // Guard: Empty or unparseable files receive explicit Unparseable status
  if (!extraction || extraction.status !== 'success' || !extraction.extractedText || extraction.wordCount === 0) {
    return {
      score: null,
      tier: 'Unparseable',
      status: 'Document contains no extractable text stream. Scanned or image-only documents cannot be evaluated for ATS text compatibility without OCR.',
      breakdown: null,
      suggestions: [
        'Upload a text-based PDF or DOCX file exported directly from a word processor (Word, Google Docs, Pages) rather than a scanned graphic.',
      ],
      disclosure: 'Evaluates document readability, section structure, and character encoding hygiene. Separate from Job Match Score and does not guarantee ranking in commercial ATS software.',
    };
  }

  const rawText = extraction.extractedText;
  const volume = evaluateContentVolume(extraction.wordCount);
  const sections = evaluateSectionStructure(rawText);
  const contact = evaluateContactCompleteness(candidate);
  const hygiene = evaluateTextHygiene(rawText);

  const totalScore = volume.score + sections.score + contact.score + hygiene.score;

  let tier = 'Low Compatibility';
  if (totalScore >= 80) {
    tier = 'High Compatibility';
  } else if (totalScore >= 50) {
    tier = 'Moderate Compatibility';
  }

  // Generate actionable suggestions based on point deductions
  const suggestions = [];

  if (volume.score < 30) {
    if (extraction.wordCount < 200) {
      suggestions.push('Expand resume text to at least 200–400 words with specific achievements and job duties.');
    } else {
      suggestions.push('Condense content toward 1–2 pages (under 1,200 words) for optimal scanning speed.');
    }
  }

  if (sections.missing.length > 0) {
    suggestions.push(`Add clear, standard section headings for: ${sections.missing.join(', ')}.`);
  }

  if (!candidate?.email) {
    suggestions.push('Include a clearly readable email address in the header.');
  }

  if (!candidate?.phone) {
    suggestions.push('Include a standard phone number (e.g. (555) 123-4567 or +1-555-123-4567).');
  }

  if (hygiene.score < 15) {
    suggestions.push('Avoid complex multi-column tables or non-standard fonts that generate corrupt characters when converted to text.');
  }

  if (suggestions.length === 0) {
    suggestions.push('Excellent document formatting: clean character encoding, standard section headings, and complete contact details.');
  }

  return {
    score: totalScore,
    tier,
    status: `${tier} (${totalScore} / 100 pts)`,
    breakdown: {
      contentVolume: volume,
      sectionHeaders: sections,
      contactInfo: contact,
      textHygiene: hygiene,
    },
    suggestions,
    disclosure: 'Evaluates document readability, section structure, and character encoding hygiene. Separate from Job Match Score and does not guarantee ranking in commercial ATS software.',
  };
}

module.exports = {
  calculateAtsScore,
  evaluateTextHygiene,
  evaluateContentVolume,
  evaluateSectionStructure,
  evaluateContactCompleteness,
};
