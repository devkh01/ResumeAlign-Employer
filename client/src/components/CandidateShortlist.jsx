import { useState, useEffect } from 'react'

const API_BASE = 'http://localhost:5000'

/**
 * CandidateShortlist — displays ranked candidate profiles for a specific job.
 *
 * Requirements Met:
 *   • Ranked primarily by Job Match Score descending; tie-break by ATS score & upload time.
 *   • Job Match Score and ATS Compatibility Score displayed separately with independent tiers.
 *   • Transparent breakdown: matched skills, skills not detected, experience evaluation.
 *   • Safe handling of unavailable scores and unknown experience.
 *   • Beginner-readable code with zero external libraries.
 */
function CandidateShortlist({ jobs, selectedJobId, onSelectJob, onUploadResumes, onNavigate }) {
  const [activeJobId, setActiveJobId] = useState(selectedJobId || (jobs.length > 0 ? jobs[0].id : null))
  const [candidatesData, setCandidatesData] = useState(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState(null)
  const [expandedId, setExpandedId] = useState(null)

  // Keep activeJobId in sync if parent selectedJobId changes
  useEffect(() => {
    if (selectedJobId && selectedJobId !== activeJobId) {
      setActiveJobId(selectedJobId)
    }
  }, [selectedJobId])

  // Fetch ranked candidates whenever activeJobId changes
  useEffect(() => {
    if (!activeJobId) {
      setCandidatesData(null)
      return
    }

    let isMounted = true
    setLoading(true)
    setError(null)

    async function fetchCandidates() {
      try {
        const res = await fetch(`${API_BASE}/api/jobs/${activeJobId}/candidates`)
        if (!res.ok) {
          const errData = await res.json().catch(() => ({}))
          throw new Error(errData.error || `Server responded with ${res.status}`)
        }
        const data = await res.json()
        if (isMounted) {
          setCandidatesData(data)
        }
      } catch (err) {
        if (isMounted) {
          setError(err.message || 'Failed to load candidates for this job.')
        }
      } finally {
        if (isMounted) {
          setLoading(false)
        }
      }
    }

    fetchCandidates()

    return () => {
      isMounted = false
    }
  }, [activeJobId])

  function handleJobChange(e) {
    const newId = Number(e.target.value)
    setActiveJobId(newId)
    if (onSelectJob) onSelectJob(newId)
  }

  function toggleExpand(id) {
    setExpandedId((prev) => (prev === id ? null : id))
  }

  // Active job reference from the jobs array
  const currentJob = jobs.find((j) => j.id === activeJobId) || candidatesData?.job

  return (
    <div className="shortlist-container">
      {/* Shortlist Header Bar with Job Switcher */}
      <div className="shortlist-header-bar">
        <div className="shortlist-header-info">
          <div className="shortlist-title-row">
            <span className="shortlist-main-icon">⭐</span>
            <h2 className="shortlist-main-title">Candidate Shortlist</h2>
          </div>
          <p className="shortlist-subtitle">
            Ranked by Job Match Score based on detected qualifications vs. job requirements.
          </p>
        </div>

        {/* Job selector dropdown */}
        <div className="shortlist-controls">
          <label htmlFor="job-selector" className="shortlist-select-label">
            Active Job:
          </label>
          <select
            id="job-selector"
            className="form-select shortlist-job-select"
            value={activeJobId || ''}
            onChange={handleJobChange}
            disabled={jobs.length === 0}
          >
            {jobs.length === 0 && <option value="">No jobs available</option>}
            {jobs.map((j) => (
              <option key={j.id} value={j.id}>
                {j.title} ({j.resumeCount ?? 0} {j.resumeCount === 1 ? 'resume' : 'resumes'})
              </option>
            ))}
          </select>

          {currentJob && (
            <button
              className="btn btn-primary btn-sm shortlist-upload-btn"
              onClick={() => onUploadResumes(currentJob)}
            >
              📤 Upload Resumes
            </button>
          )}
        </div>
      </div>

      {/* Job Requirements Snapshot Pill Row */}
      {currentJob && (
        <div className="shortlist-job-summary">
          <div className="job-summary-item">
            <span className="job-summary-label">Role:</span>
            <strong className="job-summary-val">{currentJob.title}</strong>
          </div>
          <div className="job-summary-item">
            <span className="job-summary-label">Required Experience:</span>
            <span className="job-summary-val">
              {currentJob.experience ? `${currentJob.experience} yr(s)` : 'Not specified'}
            </span>
          </div>
          {Array.isArray(currentJob.skills) && currentJob.skills.length > 0 && (
            <div className="job-summary-item skills-summary-item">
              <span className="job-summary-label">Required Skills:</span>
              <div className="job-summary-skills-list">
                {currentJob.skills.map((s, idx) => (
                  <span key={idx} className="skill-tag">{s}</span>
                ))}
              </div>
            </div>
          )}
        </div>
      )}

      {/* Loading state */}
      {loading && (
        <div className="loading-state">
          <div className="spinner" />
          <p>Loading ranked candidate shortlist…</p>
        </div>
      )}

      {/* Error state */}
      {error && !loading && (
        <div className="api-error-banner" role="alert">
          <span className="api-error-icon">⚠️</span>
          <span className="api-error-text">{error}</span>
        </div>
      )}

      {/* Empty State: No jobs posted yet */}
      {!loading && !error && jobs.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">💼</div>
          <h3>No Jobs Posted Yet</h3>
          <p>Create a job posting to begin collecting and shortlisting candidates.</p>
          <button className="btn btn-primary" onClick={() => onNavigate('create-job')}>
            ➕ Create First Job
          </button>
        </div>
      )}

      {/* Empty State: Job has 0 resumes */}
      {!loading && !error && currentJob && candidatesData?.candidates?.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">👥</div>
          <h3>No Candidates Uploaded Yet</h3>
          <p>Upload PDF or DOCX resumes for <strong>{currentJob.title}</strong> to view the ranked shortlist.</p>
          <button className="btn btn-primary" onClick={() => onUploadResumes(currentJob)}>
            📤 Upload Resumes Now
          </button>
        </div>
      )}

      {/* Ranked Candidate List */}
      {!loading && !error && candidatesData?.candidates && candidatesData.candidates.length > 0 && (
        <div className="shortlist-candidate-list">
          <div className="shortlist-count-banner">
            <span>
              Showing <strong>{candidatesData.candidates.length}</strong> ranked candidate
              {candidatesData.candidates.length !== 1 ? 's' : ''} for <strong>{currentJob?.title}</strong>
            </span>
            <span className="shortlist-ranking-hint">
              Ranked by Job Match Score (highest first) · Ties broken by ATS Compatibility
            </span>
          </div>

          {candidatesData.candidates.map((cand, index) => {
            const rank = index + 1
            const isExpanded = expandedId === (cand.id || index)
            const hasMatchScore = cand.jobMatch && cand.jobMatch.score !== null
            const hasAtsScore = cand.atsCompatibility && cand.atsCompatibility.score !== null
            const candidateInfo = cand.candidate || {}
            const matchedSkills = cand.jobMatch?.breakdown?.skills?.matched || []
            const notDetectedSkills = cand.jobMatch?.breakdown?.skills?.notDetected || []

            // Rank badge styling
            let rankClass = 'rank-other'
            if (rank === 1) rankClass = 'rank-gold'
            else if (rank === 2) rankClass = 'rank-silver'
            else if (rank === 3) rankClass = 'rank-bronze'

            return (
              <div
                key={cand.id || index}
                className={`candidate-shortlist-card ${isExpanded ? 'card-expanded' : ''}`}
              >
                {/* Card Top Row: Rank Badge, Candidate Header, Dual Score Badges */}
                <div className="shortlist-card-header">
                  <div className="shortlist-candidate-title-area">
                    <span className={`shortlist-rank-badge ${rankClass}`}>
                      #{rank}
                    </span>
                    <div>
                      <h3 className="shortlist-candidate-name">
                        {candidateInfo.name || cand.filename}
                      </h3>
                      <div className="shortlist-candidate-contact-row">
                        {candidateInfo.email ? (
                          <span className="candidate-contact-pill">
                            ✉️ {candidateInfo.email}
                          </span>
                        ) : (
                          <span className="candidate-contact-pill pill-missing">
                            ✉️ Email not detected
                          </span>
                        )}

                        {candidateInfo.phone ? (
                          <span className="candidate-contact-pill">
                            📞 {candidateInfo.phone}
                          </span>
                        ) : (
                          <span className="candidate-contact-pill pill-missing">
                            📞 Phone not detected
                          </span>
                        )}

                        <span className="candidate-contact-pill">
                          💼 Experience: {candidateInfo.experience ? candidateInfo.experience : 'Not specified'}
                        </span>

                        <span className="candidate-file-meta">
                          📄 {cand.filename} ({cand.wordCount ?? 0} words)
                        </span>
                      </div>
                    </div>
                  </div>

                  {/* Triad Score Badges: Separate Job Match, ATS Score & Semantic Relevance */}
                  <div className="shortlist-scores-area">
                    {/* Job Match Score Badge */}
                    {hasMatchScore ? (
                      <div className="score-badge-wrap">
                        <span className="score-category-label">Job Match</span>
                        <span className={`match-badge match-tier-${cand.jobMatch.tier.toLowerCase().replace(/\s+/g, '-')}`} title="Deterministic match score based on job requirements vs detected qualifications">
                          🎯 {cand.jobMatch.score}% · {cand.jobMatch.tier}
                        </span>
                      </div>
                    ) : (
                      <div className="score-badge-wrap">
                        <span className="score-category-label">Job Match</span>
                        <span className="match-badge match-tier-unavailable" title="Job match score unavailable">
                          🎯 Score Unavailable
                        </span>
                      </div>
                    )}

                    {/* ATS Compatibility Score Badge */}
                    {hasAtsScore ? (
                      <div className="score-badge-wrap">
                        <span className="score-category-label">ATS Readability</span>
                        <span className={`ats-badge ats-tier-${cand.atsCompatibility.tier.toLowerCase().replace(/\s+/g, '-')}`} title="Document readability and formatting compatibility">
                          📋 {cand.atsCompatibility.score}% ATS
                        </span>
                      </div>
                    ) : (
                      <div className="score-badge-wrap">
                        <span className="score-category-label">ATS Readability</span>
                        <span className="ats-badge ats-tier-unparseable" title="Document readability unparseable">
                          📋 {cand.atsCompatibility?.tier || 'Unparseable'}
                        </span>
                      </div>
                    )}

                    {/* Semantic Relevance Score Badge */}
                    {cand.semanticMatch && cand.semanticMatch.score !== null ? (
                      <div className="score-badge-wrap">
                        <span className="score-category-label">Semantic Relevance</span>
                        <span className={`semantic-badge semantic-tier-${cand.semanticMatch.tier.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} title={cand.semanticMatch.summaryNote || 'Conceptual textual similarity'}>
                          ≈ {cand.semanticMatch.score}% · {cand.semanticMatch.tier}
                        </span>
                      </div>
                    ) : (
                      <div className="score-badge-wrap">
                        <span className="score-category-label">Semantic Relevance</span>
                        <span className="semantic-badge semantic-tier-unavailable" title={cand.semanticMatch?.summaryNote || 'Score unavailable'}>
                          ≈ {cand.semanticMatch?.tier || 'Unavailable'}
                        </span>
                      </div>
                    )}
                  </div>
                </div>

                {/* Candidate Skills Comparison Section */}
                <div className="shortlist-skills-comparison">
                  {/* Matched Skills */}
                  <div className="skills-comparison-group">
                    <span className="skills-comp-label label-matched">
                      ✓ Matched Required Skills ({matchedSkills.length}):
                    </span>
                    <div className="skills-comp-pills">
                      {matchedSkills.length > 0 ? (
                        matchedSkills.map((s, idx) => (
                          <span key={idx} className="skill-pill-matched">
                            {s}
                          </span>
                        ))
                      ) : (
                        <span className="skills-comp-empty">
                          No required skills detected in resume
                        </span>
                      )}
                    </div>
                  </div>

                  {/* Skills Not Detected in Resume */}
                  {notDetectedSkills.length > 0 && (
                    <div className="skills-comparison-group">
                      <span className="skills-comp-label label-not-detected">
                        ✕ Not detected in resume ({notDetectedSkills.length}):
                      </span>
                      <div className="skills-comp-pills">
                        {notDetectedSkills.map((s, idx) => (
                          <span key={idx} className="skill-pill-not-detected" title="Skill not explicitly identified in extracted text; not proof the candidate lacks this skill">
                            {s}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* All other detected skills */}
                  {Array.isArray(candidateInfo.skills) && candidateInfo.skills.length > 0 && (
                    <div className="skills-comparison-group">
                      <span className="skills-comp-label label-other-skills">
                        Additional Detected Skills:
                      </span>
                      <div className="skills-comp-pills">
                        {candidateInfo.skills
                          .filter((s) => !matchedSkills.includes(s))
                          .slice(0, 10)
                          .map((s, idx) => (
                            <span key={idx} className="candidate-skill-tag">
                              {s}
                            </span>
                          ))}
                        {candidateInfo.skills.filter((s) => !matchedSkills.includes(s)).length > 10 && (
                          <span className="candidate-skills-empty">
                            +{candidateInfo.skills.filter((s) => !matchedSkills.includes(s)).length - 10} more
                          </span>
                        )}
                      </div>
                    </div>
                  )}
                </div>

                {/* Card Action Bar: Toggle Breakdown Details */}
                <div className="shortlist-card-bottom">
                  <div className="shortlist-summary-snippet">
                    <span className="summary-snippet-icon">ℹ️</span>
                    <span>{cand.jobMatch?.summaryNote || 'Evaluation completed'}</span>
                  </div>
                  <button
                    type="button"
                    className="btn-breakdown-toggle"
                    onClick={() => toggleExpand(cand.id || index)}
                    aria-expanded={isExpanded}
                    aria-controls={`breakdown-${cand.id || index}`}
                  >
                    <span className="toggle-btn-text">
                      {isExpanded ? 'Hide Detailed Scoring' : 'View Detailed Scoring'}
                    </span>
                    <svg
                      className={`toggle-chevron-icon ${isExpanded ? 'chevron-expanded' : ''}`}
                      width="12"
                      height="12"
                      viewBox="0 0 12 12"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      aria-hidden="true"
                    >
                      <polyline points="2 4 6 8 10 4" />
                    </svg>
                  </button>
                </div>

                {/* Collapsible Score Breakdown & Explanations */}
                {isExpanded && (
                  <div id={`breakdown-${cand.id || index}`} className="shortlist-expanded-breakdown">
                    {/* Job Match Detailed Criteria Breakdown */}
                    {cand.jobMatch?.breakdown && (() => {
                      const skillsW = cand.jobMatch.breakdown.skills?.weight || 0
                      const skillsE = cand.jobMatch.breakdown.skills?.earned || 0
                      const expW = cand.jobMatch.breakdown.experience?.weight || 0
                      const expE = cand.jobMatch.breakdown.experience?.earned || 0
                      const roleW = cand.jobMatch.breakdown.role?.weight || 0
                      const roleE = cand.jobMatch.breakdown.role?.earned || 0

                      const totalEarnedPts = Math.round((skillsE + expE + roleE) * 10) / 10
                      const totalApplicableWeight = skillsW + expW + roleW
                      const isScaled = totalApplicableWeight > 0 && totalApplicableWeight !== 100

                      return (
                        <div className="expanded-section">
                          <div className="section-title-row">
                            <h4 className="expanded-section-title">
                              <span className="section-title-icon">🎯</span> Job Match Criteria Breakdown
                            </h4>
                            <div className="section-score-summary">
                              <span className="job-match-total-pts-badge">
                                {totalApplicableWeight > 0 ? (
                                  isScaled ? (
                                    `Total: ${totalEarnedPts} / ${totalApplicableWeight} applicable pts (${cand.jobMatch.score}%)`
                                  ) : (
                                    `Total: ${totalEarnedPts} / 100 pts (${cand.jobMatch.score}%)`
                                  )
                                ) : (
                                  'No criteria applicable'
                                )}
                              </span>
                            </div>
                          </div>

                          <p className="expanded-summary-note">
                            {cand.jobMatch.summaryNote}
                          </p>

                          <div className="job-match-criteria-grid">
                            {/* Skills */}
                            <div className="match-criterion-box">
                              <div className="criterion-top">
                                <span className="criterion-name">Required Skills</span>
                                <span className="criterion-pts">
                                  {cand.jobMatch.breakdown.skills.earned} / {cand.jobMatch.breakdown.skills.weight} pts
                                </span>
                              </div>
                              <div className="criterion-status-text">
                                {cand.jobMatch.breakdown.skills.status}
                              </div>
                            </div>

                            {/* Experience */}
                            <div className="match-criterion-box">
                              <div className="criterion-top">
                                <span className="criterion-name">Experience Match</span>
                                {cand.jobMatch.breakdown.experience.weight > 0 ? (
                                  <span className="criterion-pts">
                                    {cand.jobMatch.breakdown.experience.earned} / {cand.jobMatch.breakdown.experience.weight} pts
                                  </span>
                                ) : (
                                  <span className="criterion-excluded-tag">Excluded</span>
                                )}
                              </div>
                              <div className="criterion-status-text">
                                {cand.jobMatch.breakdown.experience.status}
                              </div>
                            </div>

                            {/* Role Alignment */}
                            <div className="match-criterion-box">
                              <div className="criterion-top">
                                <span className="criterion-name">Role Title Alignment</span>
                                {cand.jobMatch.breakdown.role.weight > 0 ? (
                                  <span className="criterion-pts">
                                    {cand.jobMatch.breakdown.role.earned} / {cand.jobMatch.breakdown.role.weight} pts
                                  </span>
                                ) : (
                                  <span className="criterion-excluded-tag">Excluded</span>
                                )}
                              </div>
                              <div className="criterion-status-text">
                                {cand.jobMatch.breakdown.role.status}
                              </div>
                            </div>
                          </div>

                          <div className="match-disclosure-note" role="note">
                            <span className="disclosure-icon">ℹ️</span>
                            <div className="disclosure-text">
                              <strong>Methodology Note:</strong> Match score is a deterministic keyword heuristic based on detected qualifications. Unmatched skills are labeled &ldquo;Not detected in resume&rdquo; and do not indicate a verified lack of skill. This evaluation does not constitute an automated hiring decision.
                            </div>
                          </div>
                        </div>
                      )
                    })()}

                    {/* ATS Compatibility Breakdown */}
                    {cand.atsCompatibility?.breakdown && (
                      <div className="expanded-section">
                        <div className="section-title-row">
                          <h4 className="expanded-section-title">
                            <span className="section-title-icon">📋</span> ATS Readability & Structure Breakdown
                          </h4>
                          <div className="section-score-summary">
                            <span className="ats-total-pts-badge">
                              Total: {cand.atsCompatibility.score} / 100 pts
                            </span>
                          </div>
                        </div>

                        <div className="ats-criteria-grid">
                          <div className="ats-criterion-box">
                            <div className="criterion-top">
                              <span className="criterion-name">📄 Content Volume</span>
                              <span className="criterion-pts">
                                {cand.atsCompatibility.breakdown.contentVolume.score} / {cand.atsCompatibility.breakdown.contentVolume.maxScore} pts
                              </span>
                            </div>
                            <div className="criterion-status-text">
                              {cand.atsCompatibility.breakdown.contentVolume.status}
                            </div>
                          </div>

                          <div className="ats-criterion-box">
                            <div className="criterion-top">
                              <span className="criterion-name">📑 Section Structure</span>
                              <span className="criterion-pts">
                                {cand.atsCompatibility.breakdown.sectionHeaders.score} / {cand.atsCompatibility.breakdown.sectionHeaders.maxScore} pts
                              </span>
                            </div>
                            <div className="criterion-status-text">
                              {cand.atsCompatibility.breakdown.sectionHeaders.status}
                            </div>
                          </div>

                          <div className="ats-criterion-box">
                            <div className="criterion-top">
                              <span className="criterion-name">📇 Contact Details</span>
                              <span className="criterion-pts">
                                {cand.atsCompatibility.breakdown.contactInfo.score} / {cand.atsCompatibility.breakdown.contactInfo.maxScore} pts
                              </span>
                            </div>
                            <div className="criterion-status-text">
                              {cand.atsCompatibility.breakdown.contactInfo.status}
                            </div>
                            <div className="ats-heuristic-subnote">
                              <span className="disclosure-sub-icon">ℹ️</span>
                              <span>{cand.atsCompatibility.breakdown.contactInfo.note}</span>
                            </div>
                          </div>

                          <div className="ats-criterion-box">
                            <div className="criterion-top">
                              <span className="criterion-name">🔤 Text Hygiene</span>
                              <span className="criterion-pts">
                                {cand.atsCompatibility.breakdown.textHygiene.score} / {cand.atsCompatibility.breakdown.textHygiene.maxScore} pts
                              </span>
                            </div>
                            <div className="criterion-status-text">
                              {cand.atsCompatibility.breakdown.textHygiene.status}
                            </div>
                          </div>
                        </div>

                        {/* ATS Suggestions */}
                        {Array.isArray(cand.atsCompatibility.suggestions) && cand.atsCompatibility.suggestions.length > 0 && (
                          <div className="ats-suggestions-box">
                            <span className="ats-suggestions-title">💡 Readability Recommendations:</span>
                            <ul className="ats-suggestions-list">
                              {cand.atsCompatibility.suggestions.map((sug, sIdx) => (
                                <li key={sIdx} className="ats-suggestion-item">{sug}</li>
                              ))}
                            </ul>
                          </div>
                        )}

                        <div className="ats-disclosure-note" role="note">
                          <span className="disclosure-icon">ℹ️</span>
                          <div className="disclosure-text">
                            <strong>Readability Disclaimer:</strong> {cand.atsCompatibility.disclosure}
                          </div>
                        </div>
                      </div>
                    )}

                    {/* Semantic Relevance Section */}
                    {cand.semanticMatch && (
                      <div className="expanded-section">
                        <div className="section-title-row">
                          <h4 className="expanded-section-title">
                            <span className="section-title-icon">≈</span> Semantic Relevance Analysis
                          </h4>
                          <div className="section-score-summary">
                            {cand.semanticMatch.score !== null ? (
                              <span className={`semantic-badge semantic-tier-${cand.semanticMatch.tier.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                                {cand.semanticMatch.score}% · {cand.semanticMatch.tier}
                              </span>
                            ) : (
                              <span className="semantic-badge semantic-tier-unavailable">
                                Score Unavailable
                              </span>
                            )}
                          </div>
                        </div>

                        <p className="expanded-summary-note">
                          {cand.semanticMatch.summaryNote}
                        </p>

                        {Array.isArray(cand.semanticMatch.limitations) && cand.semanticMatch.limitations.length > 0 && (
                          <div className="semantic-limitations-box">
                            {cand.semanticMatch.limitations.map((lim, lIdx) => (
                              <p key={lIdx} className="semantic-limitation-item">
                                ℹ️ {lim}
                              </p>
                            ))}
                          </div>
                        )}
                      </div>
                    )}

                    {/* In-memory preview snippet */}
                    {cand.preview && (
                      <div className="expanded-section">
                        <h4 className="expanded-section-title">🔒 Extracted Text Preview (First 500 characters)</h4>
                        <pre className="upload-preview-text">{cand.preview}</pre>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

export default CandidateShortlist
