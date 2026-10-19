/**
 * jobMatcher.js — Transparent, dependency-free Job Match scoring service.
 *
 * Scoring Architecture:
 *   • Proportional weights across applicable criteria:
 *       - Required Skills: 60%
 *       - Experience:      30%
 *       - Role Alignment:  10%
 *   • If a component is unavailable or unknown (e.g. no required skills configured,
 *     or candidate experience is not stated in resume), that component is excluded
 *     from the denominator rather than silently awarding free points or unfairly penalizing.
 *   • Honest labeling: unmatched skills are labeled "Not detected in resume",
 *     never claiming the candidate definitely lacks the skill.
 *   • Punctuation-safe normalization for C++, C#, .NET, Node.js, Java, and JavaScript.
 *   • Pure deterministic JavaScript; zero external APIs, zero dependencies.
 */

// Normalizes skill names for comparison while safely handling punctuation
function normalizeSkill(skill) {
  if (!skill || typeof skill !== 'string') return '';
  const trimmed = skill.trim();
  const lower = trimmed.toLowerCase();

  // Exact mappings for punctuation-heavy technologies
  if (lower === 'c++' || lower === 'cpp') return 'C++';
  if (lower === 'c#' || lower === 'csharp') return 'C#';
  if (lower === '.net' || lower === 'dotnet' || lower === '.net core') return '.NET';
  if (lower === 'node.js' || lower === 'nodejs' || lower === 'node') return 'Node.js';
  if (lower === 'react' || lower === 'react.js' || lower === 'reactjs') return 'React';
  if (lower === 'next.js' || lower === 'nextjs' || lower === 'next') return 'Next.js';
  if (lower === 'vue' || lower === 'vue.js' || lower === 'vuejs') return 'Vue.js';
  if (lower === 'angular' || lower === 'angular.js' || lower === 'angularjs') return 'Angular';
  if (lower === 'express' || lower === 'express.js' || lower === 'expressjs') return 'Express';
  if (lower === 'postgres' || lower === 'postgresql') return 'PostgreSQL';
  if (lower === 'rest' || lower === 'restful' || lower === 'rest api' || lower === 'rest apis') return 'REST APIs';
  if (lower === 'ci/cd' || lower === 'cicd') return 'CI/CD';
  if (lower === 'aws' || lower === 'amazon web services') return 'AWS';
  if (lower === 'gcp' || lower === 'google cloud' || lower === 'google cloud platform') return 'GCP';
  if (lower === 'azure' || lower === 'microsoft azure') return 'Azure';
  if (lower === 'k8s' || lower === 'kubernetes') return 'Kubernetes';
  if (lower === 'tailwind' || lower === 'tailwind css' || lower === 'tailwindcss') return 'Tailwind CSS';

  // Strict check for Java vs JavaScript to prevent false substring matches
  if (lower === 'java') return 'Java';
  if (lower === 'javascript' || lower === 'js') return 'JavaScript';
  if (lower === 'typescript' || lower === 'ts') return 'TypeScript';

  return trimmed;
}

// Words to ignore when matching role/title alignment
const TITLE_STOP_WORDS = new Set([
  'senior', 'junior', 'lead', 'principal', 'staff', 'intern', 'internship',
  'entry', 'level', 'i', 'ii', 'iii', 'iv', 'the', 'and', 'for', 'a', 'an',
  'at', 'in', 'of', 'with', 'to', 'role', 'position', 'opening', 'specialist'
]);

/**
 * Checks if a specific skill is present in the candidate profile or raw resume text.
 * Punctuation-safe: handles C++, C#, .NET, Node.js without word boundary failures.
 */
function isSkillPresent(skillName, candidateSkillsSet, rawText) {
  const norm = normalizeSkill(skillName);

  // 1. Check in extracted canonical candidate skills
  if (candidateSkillsSet.has(norm.toLowerCase())) {
    return true;
  }

  // 2. Direct check in raw text with punctuation-safe boundary guards
  if (!rawText || typeof rawText !== 'string') return false;

  let pattern;
  if (norm === 'C++') {
    pattern = /(?:^|[^a-zA-Z0-9])C\+\+(?=[^a-zA-Z0-9+]|$)/i;
  } else if (norm === 'C#') {
    pattern = /(?:^|[^a-zA-Z0-9])C#(?=[^a-zA-Z0-9#]|$)/i;
  } else if (norm === '.NET') {
    pattern = /(?:^|[^a-zA-Z0-9])\.NET\b/i;
  } else if (norm === 'Node.js') {
    pattern = /(?:^|[^a-zA-Z0-9])(?:Node\.js|Nodejs|\bNode\b(?=\s*(?:js|backend|developer)))(?=[^a-zA-Z0-9]|$)/i;
  } else if (norm === 'Java') {
    pattern = /\bJava\b(?!\s*script)/i;
  } else if (norm === 'CI/CD') {
    pattern = /(?:^|[^a-zA-Z0-9])CI\/CD(?=[^a-zA-Z0-9]|$)/i;
  } else {
    // Alphanumeric standard skills
    const escaped = norm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    pattern = new RegExp(`\\b${escaped}\\b`, 'i');
  }

  return pattern.test(rawText);
}

/**
 * Calculates the Job Match Score and returns a transparent breakdown.
 *
 * @param {Object} job - Job object with { title, skills, experience, description }
 * @param {Object} candidate - Candidate object with { name, email, phone, skills, experience }
 * @param {string} rawText - Private extracted text for keyword verification
 * @returns {Object} Job match score details and transparent breakdown
 */
function calculateJobMatch(job, candidate, rawText = '') {
  const jobSkills = Array.isArray(job?.skills) ? job.skills.filter(Boolean) : [];
  const candSkills = Array.isArray(candidate?.skills) ? candidate.skills : [];
  const candSkillsSet = new Set(candSkills.map((s) => normalizeSkill(s).toLowerCase()));

  let totalEarned = 0;
  let totalApplicableWeight = 0;
  const applicableCriteria = [];

  // ── 1. Skills Matching (Weight: 60) ─────────────────────────────────────────
  let skillsBreakdown = null;
  if (jobSkills.length > 0) {
    const matched = [];
    const notDetected = [];

    for (const reqSkill of jobSkills) {
      const canonical = normalizeSkill(reqSkill);
      if (isSkillPresent(canonical, candSkillsSet, rawText)) {
        matched.push(canonical);
      } else {
        notDetected.push(canonical);
      }
    }

    const skillsWeight = 60;
    const skillsRatio = matched.length / jobSkills.length;
    const skillsEarned = skillsRatio * skillsWeight;

    totalEarned += skillsEarned;
    totalApplicableWeight += skillsWeight;
    applicableCriteria.push('skills');

    skillsBreakdown = {
      weight: skillsWeight,
      earned: Math.round(skillsEarned * 10) / 10,
      matchedCount: matched.length,
      totalRequired: jobSkills.length,
      matched,
      notDetected,
      status: `Matched ${matched.length} of ${jobSkills.length} required skill(s)`,
    };
  } else {
    skillsBreakdown = {
      weight: 0,
      earned: 0,
      matchedCount: 0,
      totalRequired: 0,
      matched: [],
      notDetected: [],
      status: 'No required skills configured for this job (excluded from total weight)',
    };
  }

  // ── 2. Experience Matching (Weight: 30) ──────────────────────────────────────
  let experienceBreakdown = null;
  const reqYrs = parseFloat(job?.experience) || 0;
  const candExpStr = candidate?.experience;

  let candYrs = null;
  if (candExpStr && typeof candExpStr === 'string') {
    const match = candExpStr.match(/(\d+(?:\.\d+)?)/);
    if (match) {
      candYrs = parseFloat(match[1]);
    }
  }

  if (reqYrs === 0) {
    // No minimum experience required
    experienceBreakdown = {
      weight: 0,
      earned: 0,
      status: 'No minimum experience required for this job',
      detected: candExpStr || 'Not specified',
      required: 'None',
    };
  } else if (candYrs !== null) {
    // Experience is known and verified
    const expWeight = 30;
    let expRatio = 1.0;
    let expStatus = `Meets requirement (${candExpStr} vs ${reqYrs} yr(s) required)`;

    if (candYrs < reqYrs) {
      expRatio = candYrs / reqYrs;
      expStatus = `Below requirement (${candExpStr} vs ${reqYrs} yr(s) required)`;
    } else if (candYrs > reqYrs) {
      expStatus = `Exceeds requirement (${candExpStr} vs ${reqYrs} yr(s) required)`;
    }

    const expEarned = expRatio * expWeight;
    totalEarned += expEarned;
    totalApplicableWeight += expWeight;
    applicableCriteria.push('experience');

    experienceBreakdown = {
      weight: expWeight,
      earned: Math.round(expEarned * 10) / 10,
      status: expStatus,
      detected: candExpStr,
      required: `${reqYrs} yr(s)`,
    };
  } else {
    // Candidate experience is unknown: do NOT award neutral points silently
    experienceBreakdown = {
      weight: 0,
      earned: 0,
      status: 'Experience not specified in resume — not verified (excluded from total weight)',
      detected: null,
      required: `${reqYrs} yr(s)`,
    };
  }

  // ── 3. Role / Title Alignment (Weight: 10) ──────────────────────────────────
  let roleBreakdown = null;
  const jobTitle = String(job?.title || '').trim();
  const titleKeywords = jobTitle
    .split(/[\s/,-]+/)
    .map((w) => w.trim().toLowerCase())
    .filter((w) => w.length >= 3 && !TITLE_STOP_WORDS.has(w));

  if (titleKeywords.length > 0) {
    const roleWeight = 10;
    const lowerText = (rawText || '').toLowerCase();
    const matchedKeywords = titleKeywords.filter((kw) => lowerText.includes(kw));

    let roleRatio = 0;
    if (matchedKeywords.length === titleKeywords.length) {
      roleRatio = 1.0;
    } else if (matchedKeywords.length > 0) {
      roleRatio = 0.6;
    }

    const roleEarned = roleRatio * roleWeight;
    totalEarned += roleEarned;
    totalApplicableWeight += roleWeight;
    applicableCriteria.push('role');

    roleBreakdown = {
      weight: roleWeight,
      earned: Math.round(roleEarned * 10) / 10,
      matchedKeywords,
      status: matchedKeywords.length > 0
        ? `Role keywords matched: ${matchedKeywords.join(', ')}`
        : 'No role title keywords detected in resume',
    };
  } else {
    roleBreakdown = {
      weight: 0,
      earned: 0,
      status: 'No specific role title keywords to compare',
    };
  }

  // ── 4. Final Score & Tier Calculation ────────────────────────────────────────
  let finalScore = null;
  let matchTier = 'Unavailable';

  if (totalApplicableWeight > 0) {
    finalScore = Math.min(100, Math.max(0, Math.round((totalEarned / totalApplicableWeight) * 100)));

    if (finalScore >= 80) {
      matchTier = 'Strong Match';
    } else if (finalScore >= 50) {
      matchTier = 'Moderate Match';
    } else {
      matchTier = 'Low Match';
    }
  }

  // Explain which criteria contributed
  const criteriaExplanation = applicableCriteria.length === 3
    ? 'Calculated over all 3 criteria: skills (60%), experience (30%), and role alignment (10%).'
    : `Calculated over ${applicableCriteria.length} available criteria (${applicableCriteria.join(', ')}), scaled proportionally to 100%.`;

  return {
    score: finalScore,
    tier: matchTier,
    applicableCriteria,
    summaryNote: criteriaExplanation,
    breakdown: {
      skills: skillsBreakdown,
      experience: experienceBreakdown,
      role: roleBreakdown,
    },
    limitations: [
      'Keyword-based heuristic match; does not evaluate actual work quality or code samples.',
      'Unmatched skills are labeled "Not detected in resume" and may be present in unstated form.',
    ],
  };
}

module.exports = {
  calculateJobMatch,
  normalizeSkill,
};
