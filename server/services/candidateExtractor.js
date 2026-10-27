/**
 * candidateExtractor.js — Extracts structured candidate information from resume text.
 *
 * Security & Accuracy Safeguards:
 *   • Operates entirely on the already-extracted in-memory text string.
 *   • Conservative detection: returns null or empty array when uncertain.
 *   • Never invents details or infers absent skills.
 *   • Punctuation-safe skill matching (e.g. C++, C#, .NET, Node.js).
 *   • Conservative phone detection to eliminate dates, year ranges, and IDs.
 *   • Strictly explicit experience pattern detection.
 */

// ── Curated Skill Definitions with Punctuation-Safe Matchers ─────────────────
// Each definition provides a canonical display name and a regex specifically designed
// to avoid false substring matches and correctly handle punctuation.
const SKILL_DEFINITIONS = [
  // Languages & runtimes
  { name: 'JavaScript', pattern: /\bJavaScript\b/i },
  { name: 'TypeScript', pattern: /\bTypeScript\b/i },
  { name: 'Python',     pattern: /\bPython\b/i },
  { name: 'Java',       pattern: /\bJava\b(?!\s*script)/i }, // Never match JavaScript
  { name: 'C++',        pattern: /(?:^|[^a-zA-Z0-9])C\+\+(?=[^a-zA-Z0-9+]|$)/i },
  { name: 'C#',         pattern: /(?:^|[^a-zA-Z0-9])C#(?=[^a-zA-Z0-9#]|$)/i },
  { name: '.NET',       pattern: /(?:^|[^a-zA-Z0-9])\.NET\b/i },
  { name: 'Node.js',    pattern: /(?:^|[^a-zA-Z0-9])(?:Node\.js|Nodejs|\bNode\b(?=\s*(?:js|backend|developer)))(?=[^a-zA-Z0-9]|$)/i },
  { name: 'PHP',        pattern: /\bPHP\b/i },
  { name: 'Ruby',       pattern: /\bRuby\b(?!\s*on\s*rails)/i },
  { name: 'Ruby on Rails', pattern: /\b(?:Ruby\s+on\s+Rails|Rails)\b/i },
  { name: 'Go',         pattern: /\b(?:Golang|Go\s+programming)\b/i },
  { name: 'Rust',       pattern: /\bRust\b(?=\s*(?:language|programming|developer|backend))/i },
  { name: 'Swift',      pattern: /\bSwift\b(?=\s*(?:language|developer|ios))/i },
  { name: 'Kotlin',     pattern: /\bKotlin\b/i },

  // Frontend frameworks & technologies
  { name: 'React',      pattern: /\bReact(?:\.js|js)?\b/i },
  { name: 'Next.js',    pattern: /(?:^|[^a-zA-Z0-9])Next(?:\.js|js)?\b/i },
  { name: 'Vue.js',     pattern: /(?:^|[^a-zA-Z0-9])Vue(?:\.js|js)?\b/i },
  { name: 'Angular',    pattern: /\bAngular(?:\.js|js)?\b/i },
  { name: 'HTML',       pattern: /\bHTML5?\b/i },
  { name: 'CSS',        pattern: /\bCSS3?\b/i },
  { name: 'Tailwind CSS', pattern: /\b(?:Tailwind(?:\s*CSS)?)\b/i },
  { name: 'Redux',      pattern: /\bRedux\b/i },

  // Backend & APIs
  { name: 'Express',    pattern: /(?:^|[^a-zA-Z0-9])Express(?:\.js|js)?\b/i },
  { name: 'Django',     pattern: /\bDjango\b/i },
  { name: 'Flask',      pattern: /\bFlask\b/i },
  { name: 'Spring Boot', pattern: /\b(?:Spring\s*Boot|Spring\s*Framework)\b/i },
  { name: 'REST APIs',  pattern: /\b(?:RESTful|REST\s*APIs?|REST)\b/i },
  { name: 'GraphQL',    pattern: /\bGraphQL\b/i },

  // Databases & storage
  { name: 'SQL',        pattern: /\bSQL\b/i },
  { name: 'PostgreSQL', pattern: /\b(?:PostgreSQL|Postgres)\b/i },
  { name: 'MySQL',      pattern: /\bMySQL\b/i },
  { name: 'MongoDB',    pattern: /\bMongoDB\b/i },
  { name: 'Redis',      pattern: /\bRedis\b/i },

  // Cloud & DevOps
  { name: 'AWS',        pattern: /\b(?:AWS|Amazon\s*Web\s*Services)\b/i },
  { name: 'Azure',      pattern: /\b(?:Microsoft\s*Azure|Azure)\b/i },
  { name: 'GCP',        pattern: /\b(?:Google\s*Cloud(?:\s*Platform)?|GCP)\b/i },
  { name: 'Docker',     pattern: /\bDocker\b/i },
  { name: 'Kubernetes', pattern: /\b(?:Kubernetes|K8s)\b/i },
  { name: 'CI/CD',      pattern: /(?:^|[^a-zA-Z0-9])CI\/CD(?=[^a-zA-Z0-9]|$)/i },
  { name: 'Git',        pattern: /\bGit\b(?!\s*hub|\s*lab)/i },
  { name: 'GitHub',     pattern: /\bGitHub\b/i },
  { name: 'Linux',      pattern: /\bLinux\b/i },

  // Methodologies & practices
  { name: 'Agile',      pattern: /\bAgile\b/i },
  { name: 'Scrum',      pattern: /\bScrum\b/i },
  { name: 'Microservices', pattern: /\bMicroservices\b/i },
  { name: 'Unit Testing', pattern: /\b(?:Unit\s*Testing|Jest|Mocha|PyTest)\b/i },
];

// Common header phrases that should never be identified as candidate names
const HEADER_DENYLIST = new Set([
  'resume', 'curriculum vitae', 'cv', 'contact', 'contact information',
  'summary', 'professional summary', 'executive summary', 'profile',
  'experience', 'work experience', 'professional experience', 'employment',
  'education', 'skills', 'technical skills', 'core competencies',
  'projects', 'certifications', 'objective', 'career objective'
]);

/**
 * Extracts a candidate's email address.
 * Returns the lowercased email or null.
 */
function extractEmail(text) {
  if (!text || typeof text !== 'string') return null;
  const match = text.match(/[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}/);
  return match ? match[0].trim().toLowerCase() : null;
}

/**
 * Extracts a candidate's phone number with conservative validation to avoid
 * false positives from dates, years (e.g. 2018-2022), and IDs.
 */
function extractPhone(text) {
  if (!text || typeof text !== 'string') return null;

  // 1. High-confidence: explicitly labeled phone numbers
  const labeled = text.match(/(?:phone|tel|mobile|cell|contact)[\s:#-]*(\+?\d[\d\s().-]{8,18}\d)/i);
  if (labeled) {
    const candidate = labeled[1].trim();
    const digitsOnly = candidate.replace(/\D/g, '');
    if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
      return candidate;
    }
  }

  // 2. Standard formatted phone numbers with parentheses and dashes e.g. (555) 123-4567, (555) 111-2222, or 555-123-4567
  const formatted = text.match(/(?<!\d)(?:\+?1[-.\s]?)?(?:\(([2-9]\d{2})\)[-.\s]?|([2-9]\d{2})[-.\s])(\d{3})[-.\s](\d{4})\b/);
  if (formatted) {
    // Exclude if it looks like a date range e.g. 2019-2020 or math
    const digitsOnly = formatted[0].replace(/\D/g, '');
    if (digitsOnly.length === 10 || (digitsOnly.length === 11 && digitsOnly.startsWith('1'))) {
      return formatted[0].trim();
    }
  }

  // 3. International format starting with + (e.g. +91-9876543210, +91 9876543210, +44 20 7946 0958, +44-7911-123456)
  const intl = text.match(/(?<!\w)\+\d{1,3}[-.\s]?(?:\(?\d{1,4}\)?[-.\s]?){1,4}\d{3,10}\b/);
  if (intl) {
    const digitsOnly = intl[0].replace(/\D/g, '');
    if (digitsOnly.length >= 10 && digitsOnly.length <= 15) {
      return intl[0].trim();
    }
  }

  return null;
}

/**
 * Extracts candidate name from the top section of the resume.
 * Criteria: 2 to 4 capitalized words, no numbers/symbols/emails, not a section header.
 * Returns formatted name string or null if uncertain.
 */
function extractName(text) {
  if (!text || typeof text !== 'string') return null;

  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .slice(0, 10); // Inspect first 10 non-empty lines

  for (const line of lines) {
    // Skip lines with emails, URLs, or digits
    if (line.includes('@') || line.includes('http') || line.includes('www.') || /\d/.test(line)) {
      continue;
    }

    const lower = line.toLowerCase();
    if (HEADER_DENYLIST.has(lower)) {
      continue;
    }

    // Split line into words
    const words = line.split(/\s+/);
    if (words.length < 2 || words.length > 4) {
      continue;
    }

    // Every word must be letters only (with optional trailing period for initials like "M.")
    const validWords = words.every((w) => /^[A-Za-z]+(?:\.[A-Za-z]+|\.)?$/.test(w) && w.length >= 2);
    if (!validWords) {
      continue;
    }

    // Check capitalization: either ALL CAPS or Title Case
    const isUpper = line === line.toUpperCase();
    const isTitle = words.every((w) => w[0] === w[0].toUpperCase());

    if (isUpper || isTitle) {
      // Normalize: if ALL CAPS, convert to Title Case for clean presentation
      if (isUpper) {
        return words
          .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
          .join(' ');
      }
      return line;
    }
  }

  return null;
}

/**
 * Extracts recognized skills using punctuation-safe regex matchers.
 * Returns an array of canonical skill names (e.g. ['React', 'Node.js', 'C++']).
 */

function extractSkills(text) {
  if (!text || typeof text !== 'string') return [];

  const detected = [];

  // Split text into sentences or bullet-like lines so a negative statement
  // does not automatically cancel a positive mention elsewhere.
  const statements = text
    .split(/[\n\r•;]+|(?<=[.!?])\s+/)
    .map((statement) => statement.trim())
    .filter(Boolean);

  for (const skill of SKILL_DEFINITIONS) {
    const positiveMention = statements.some((statement) => {
      if (!skill.pattern.test(statement)) return false;

      // Conservative handling of explicit negative/limiting statements.
      const negativeContext =
        /\b(?:no|not|never|without|lack(?:s|ing)?|limited evidence of|little experience with|no experience with|beginner-level)\b/i;

      return !negativeContext.test(statement);
    });

    if (positiveMention) {
      detected.push(skill.name);
    }
  }

  return detected;
}


/**
 * Extracts explicit, reliable experience statements (e.g. "5+ years", "3 years").
 * Returns formatted experience string or null when not explicitly stated.
 */
function extractExperience(text) {
  if (!text || typeof text !== 'string') return null;

  const wordMap = {
    one: '1', two: '2', three: '3', four: '4', five: '5',
    six: '6', seven: '7', eight: '8', nine: '9', ten: '10',
  };

  // Pattern A: "X+ years of experience" or "X years experience"
  const matchA = text.match(
    /\b(\d{1,2}(?:\.\d+)?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten))\+?\s*(?:years?|yrs?)(?:\s+of)?\s+(?:professional\s+|relevant\s+|work\s+|software\s+|industry\s+)?experience\b/i
  );
  if (matchA) {
    const raw = matchA[1].toLowerCase();
    const num = wordMap[raw] || raw;
    const hasPlus = matchA[0].includes('+');
    return `${num}${hasPlus ? '+' : ''} years`;
  }

  // Pattern B: "Experience: X+ years"
  const matchB = text.match(
    /(?:total|overall|professional|work)?\s*experience\s*:\s*(\d{1,2}(?:\.\d+)?|\b(?:one|two|three|four|five|six|seven|eight|nine|ten))\+?\s*(?:years?|yrs?)\b/i
  );
  if (matchB) {
    const raw = matchB[1].toLowerCase();
    const num = wordMap[raw] || raw;
    const hasPlus = matchB[0].includes('+');
    return `${num}${hasPlus ? '+' : ''} years`;
  }

  return null;
}

/**
 * Composite candidate information extractor.
 *
 * @param {string} rawText - The already-extracted resume text.
 * @returns {{
 *   name: string | null,
 *   email: string | null,
 *   phone: string | null,
 *   skills: string[],
 *   experience: string | null
 * }}
 */
function extractCandidateInfo(rawText) {
  if (!rawText || typeof rawText !== 'string' || rawText.trim().length === 0) {
    return {
      name: null,
      email: null,
      phone: null,
      skills: [],
      experience: null,
    };
  }

  return {
    name: extractName(rawText),
    email: extractEmail(rawText),
    phone: extractPhone(rawText),
    skills: extractSkills(rawText),
    experience: extractExperience(rawText),
  };
}

module.exports = {
  extractCandidateInfo,
  extractEmail,
  extractPhone,
  extractName,
  extractSkills,
  extractExperience,
};
