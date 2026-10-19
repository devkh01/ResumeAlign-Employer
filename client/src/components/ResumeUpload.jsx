import { useState, useRef } from 'react'

// ── Constants ─────────────────────────────────────────────────────────────────

const ALLOWED_EXTENSIONS = new Set(['.pdf', '.docx'])
const ALLOWED_MIMETYPES  = new Set([
  'application/pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
])
const MAX_FILE_SIZE  = 5 * 1024 * 1024   // 5 MB — mirrors backend limit
const MAX_FILE_COUNT = 10

// ── Helpers ───────────────────────────────────────────────────────────────────

function isAllowed(file) {
  const ext = file.name.substring(file.name.lastIndexOf('.')).toLowerCase()
  return ALLOWED_EXTENSIONS.has(ext) && ALLOWED_MIMETYPES.has(file.type)
}

function formatBytes(bytes) {
  if (bytes < 1024)              return `${bytes} B`
  if (bytes < 1024 * 1024)      return `${(bytes / 1024).toFixed(1)} KB`
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`
}

// ── Component ─────────────────────────────────────────────────────────────────

/**
 * ResumeUpload — modal overlay for uploading resumes to a specific job.
 *
 * Props:
 *   job       { id, title }           — the job these resumes belong to
 *   onSubmit  async (FormData) => {}  — performs the POST; throws on error
 *   onCancel  ()             => void  — closes the modal
 */
function ResumeUpload({ job, onSubmit, onCancel }) {
  const [files,            setFiles]            = useState([])       // File objects queued for upload
  const [submitting,       setSubmitting]       = useState(false)    // POST in flight
  const [result,           setResult]           = useState(null)     // success response from server
  const [error,            setError]            = useState(null)     // error message (client or server)
  const [warnings,         setWarnings]         = useState([])       // skipped files (wrong type/size)
  const [expandedPreviews, setExpandedPreviews] = useState({})       // track open/collapsed previews

  const fileInputRef = useRef(null)

  // ── File selection ──────────────────────────────────────────────────────────

  function handleFileChange(e) {
    const selected = Array.from(e.target.files)
    const newWarnings = []
    const toAdd      = []

    for (const file of selected) {
      if (!isAllowed(file)) {
        newWarnings.push(`"${file.name}" skipped — only PDF and DOCX are allowed.`)
        continue
      }
      if (file.size > MAX_FILE_SIZE) {
        newWarnings.push(`"${file.name}" skipped — exceeds the 5 MB limit (${formatBytes(file.size)}).`)
        continue
      }
      toAdd.push(file)
    }

    setFiles((prev) => {
      const existingNames = new Set(prev.map((f) => f.name))
      const deduplicated  = toAdd.filter((f) => {
        if (existingNames.has(f.name)) {
          newWarnings.push(`"${f.name}" skipped — already in the list.`)
          return false
        }
        return true
      })
      // Enforce the 10-file cap
      const combined = [...prev, ...deduplicated]
      if (combined.length > MAX_FILE_COUNT) {
        const excess = combined.length - MAX_FILE_COUNT
        newWarnings.push(`${excess} file(s) skipped — maximum ${MAX_FILE_COUNT} files per upload.`)
        return combined.slice(0, MAX_FILE_COUNT)
      }
      return combined
    })

    setWarnings(newWarnings)
    setError(null)
    // Reset the input so the same file can be re-selected after removal
    e.target.value = ''
  }

  function removeFile(idx) {
    setFiles((prev) => prev.filter((_, i) => i !== idx))
    setWarnings([])
    setError(null)
  }

  function togglePreview(idx) {
    setExpandedPreviews((prev) => ({
      ...prev,
      [idx]: !prev[idx],
    }))
  }

  function resetToUploadMore() {
    setResult(null)
    setFiles([])
    setWarnings([])
    setError(null)
    setExpandedPreviews({})
  }

  // ── Upload ──────────────────────────────────────────────────────────────────

  async function handleUpload() {
    if (files.length === 0 || submitting) return

    const formData = new FormData()
    files.forEach((f) => formData.append('resumes', f))

    setSubmitting(true)
    setError(null)

    try {
      const data = await onSubmit(formData)   // App.jsx performs the POST
      setResult(data)
      setFiles([])                            // clear queue after success
      setWarnings([])

      // Automatically expand preview for successfully extracted files by default
      const initialPreviews = {}
      if (data && Array.isArray(data.accepted)) {
        data.accepted.forEach((item, idx) => {
          if (item.extractionStatus === 'success') {
            initialPreviews[idx] = true
          }
        })
      }
      setExpandedPreviews(initialPreviews)
    } catch (err) {
      setError(err.message || 'Upload failed. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // Compute extraction stats if result is present
  const acceptedList = result?.accepted || []
  const successCount = acceptedList.filter((f) => f.extractionStatus === 'success').length
  const emptyCount   = acceptedList.filter((f) => f.extractionStatus === 'empty').length
  const failedCount  = acceptedList.filter((f) => f.extractionStatus === 'failed').length

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div
      className="modal-overlay"
      role="dialog"
      aria-modal="true"
      aria-labelledby="upload-title"
    >
      <div className="form-panel upload-modal-panel">

        {/* Header */}
        <div className="form-panel-header">
          <div>
            <h2 className="form-panel-title" id="upload-title">
              Upload Resumes
            </h2>
            <p className="form-panel-subtitle">
              Job: <strong style={{ color: 'var(--text-primary)' }}>{job.title}</strong>
            </p>
          </div>
          <button
            className="form-close-btn"
            onClick={onCancel}
            aria-label="Close"
            disabled={submitting}
          >
            ✕
          </button>
        </div>

        {/* Body */}
        <div className="form-body">

          {/* ── Results state (after extraction) ───────────────────────── */}
          {result && (
            <div className="upload-results-container">
              {/* Top summary banner */}
              <div className="upload-result-banner">
                <div className="upload-result-icon">
                  {failedCount === 0 && emptyCount === 0 ? '✅' : 'ℹ️'}
                </div>
                <div style={{ flex: 1 }}>
                  <p className="upload-result-title">{result.message}</p>
                  <div className="upload-stats-pills">
                    <span className="upload-stat-pill stat-pill-success">
                      ✓ {successCount} Extracted
                    </span>
                    {emptyCount > 0 && (
                      <span className="upload-stat-pill stat-pill-warning">
                        ⚠ {emptyCount} Scanned / Empty
                      </span>
                    )}
                    {failedCount > 0 && (
                      <span className="upload-stat-pill stat-pill-danger">
                        ✕ {failedCount} Failed
                      </span>
                    )}
                  </div>
                </div>
              </div>

              {/* Scanned/Empty warning alert */}
              {emptyCount > 0 && (
                <div className="upload-warning-banner" role="alert">
                  <span className="upload-warning-icon">⚠️</span>
                  <div>
                    <strong>OCR Notice:</strong> {emptyCount} file{emptyCount !== 1 ? 's' : ''} contained no selectable text.
                    Scanned image PDFs or documents containing only images require OCR (optical character recognition), which is not supported in this version.
                  </div>
                </div>
              )}

              {/* Extraction failure alert */}
              {failedCount > 0 && (
                <div className="upload-error-banner" role="alert">
                  <span className="upload-warning-icon">✕</span>
                  <div>
                    <strong>Parsing Error:</strong> {failedCount} file{failedCount !== 1 ? 's' : ''} could not be parsed.
                    The files may be corrupted, password-protected, or in an unsupported format.
                  </div>
                </div>
              )}

              {/* Processed resumes list */}
              <div className="upload-processed-section">
                <p className="upload-file-list-label">
                  Extracted Resumes &amp; Text Previews ({acceptedList.length})
                </p>

                <div className="upload-processed-list">
                  {acceptedList.map((f, i) => {
                    const isSuccess = f.extractionStatus === 'success'
                    const isEmpty   = f.extractionStatus === 'empty'
                    const isFailed  = f.extractionStatus === 'failed'
                    const isExpanded = !!expandedPreviews[i]

                    return (
                      <div key={f.id || i} className="upload-processed-card">
                        <div className="upload-processed-header">
                          <div className="upload-processed-info">
                            <span className="upload-file-icon">
                              {f.mimetype === 'application/pdf' ? '📄' : '📝'}
                            </span>
                            <div>
                              <span className="upload-processed-name">{f.filename}</span>
                              <span className="upload-processed-meta">
                                {formatBytes(f.size)} · {f.wordCount ?? 0} words
                              </span>
                            </div>
                          </div>

                          <div className="upload-processed-actions">
                            {isSuccess && f.jobMatch && f.jobMatch.score !== null && (
                              <span className={`match-badge match-tier-${f.jobMatch.tier.toLowerCase().replace(/\s+/g, '-')}`}>
                                🎯 {f.jobMatch.score}% Match
                              </span>
                            )}
                            {f.atsCompatibility && f.atsCompatibility.score !== null && (
                              <span className={`ats-badge ats-tier-${f.atsCompatibility.tier.toLowerCase().replace(/\s+/g, '-')}`}>
                                📋 {f.atsCompatibility.score}% ATS
                              </span>
                            )}
                            {f.atsCompatibility && f.atsCompatibility.score === null && (
                              <span className="ats-badge ats-tier-unparseable">
                                📋 ATS Unparseable
                              </span>
                            )}
                            {f.semanticMatch && f.semanticMatch.score !== null ? (
                              <span className={`semantic-badge semantic-tier-${f.semanticMatch.tier.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`} title={f.semanticMatch.summaryNote || 'Conceptual textual similarity'}>
                                ≈ {f.semanticMatch.score}% Semantic
                              </span>
                            ) : f.semanticMatch ? (
                              <span className="semantic-badge semantic-tier-unavailable" title={f.semanticMatch.summaryNote || 'Score unavailable'}>
                                ≈ Semantic Unavailable
                              </span>
                            ) : null}
                            {isSuccess && (
                              <span className="status-badge badge-extracted">
                                ✓ Extracted
                              </span>
                            )}
                            {isEmpty && (
                              <span className="status-badge badge-empty">
                                ⚠ Scanned / Empty
                              </span>
                            )}
                            {isFailed && (
                              <span className="status-badge badge-failed">
                                ✕ Failed
                              </span>
                            )}

                            {isSuccess && f.preview && (
                              <button
                                type="button"
                                className="btn-preview-toggle"
                                onClick={() => togglePreview(i)}
                                aria-expanded={isExpanded}
                                aria-label={`${isExpanded ? 'Hide' : 'Show'} preview for ${f.filename}`}
                              >
                                {isExpanded ? 'Hide Preview ▲' : 'Show Preview ▼'}
                              </button>
                            )}
                          </div>
                        </div>

                        {/* Candidate Information (Name, Email, Phone, Experience, Skills) */}
                        {isSuccess && f.candidate && (
                          <div className="candidate-card-body">
                            <div className="candidate-meta-grid">
                              <div className="candidate-meta-item">
                                <span className="candidate-meta-icon">👤</span>
                                <span className="candidate-meta-label">Name:</span>
                                <span className={`candidate-meta-val ${!f.candidate.name ? 'meta-val-empty' : ''}`}>
                                  {f.candidate.name || 'Not detected'}
                                </span>
                              </div>
                              <div className="candidate-meta-item">
                                <span className="candidate-meta-icon">✉️</span>
                                <span className="candidate-meta-label">Email:</span>
                                <span className={`candidate-meta-val ${!f.candidate.email ? 'meta-val-empty' : ''}`}>
                                  {f.candidate.email || 'Not detected'}
                                </span>
                              </div>
                              <div className="candidate-meta-item">
                                <span className="candidate-meta-icon">📞</span>
                                <span className="candidate-meta-label">Phone:</span>
                                <span className={`candidate-meta-val ${!f.candidate.phone ? 'meta-val-empty' : ''}`}>
                                  {f.candidate.phone || 'Not detected'}
                                </span>
                              </div>
                              <div className="candidate-meta-item">
                                <span className="candidate-meta-icon">💼</span>
                                <span className="candidate-meta-label">Experience:</span>
                                <span className={`candidate-meta-val ${!f.candidate.experience ? 'meta-val-empty' : ''}`}>
                                  {f.candidate.experience ? `${f.candidate.experience} detected` : 'Not specified'}
                                </span>
                              </div>
                            </div>

                            {/* Detected Skills */}
                            <div className="candidate-skills-section">
                              <span className="candidate-skills-label">Detected Skills:</span>
                              <div className="candidate-skills-list">
                                {Array.isArray(f.candidate.skills) && f.candidate.skills.length > 0 ? (
                                  f.candidate.skills.map((skill, sIdx) => (
                                    <span key={sIdx} className="candidate-skill-tag">
                                      {skill}
                                    </span>
                                  ))
                                ) : (
                                  <span className="candidate-skills-empty">
                                    No recognized skills detected
                                  </span>
                                )}
                              </div>
                            </div>
                          </div>
                        )}

                        {/* Job Match Analysis */}
                        {isSuccess && f.jobMatch && (
                          <div className="job-match-card-section">
                            <div className="job-match-header-row">
                              <div className="job-match-title-area">
                                <span className="job-match-badge-icon">🎯</span>
                                <span className="job-match-title">Job Match Analysis</span>
                                {f.jobMatch.score !== null ? (
                                  <span className={`job-match-pill match-tier-${f.jobMatch.tier.toLowerCase().replace(/\s+/g, '-')}`}>
                                    {f.jobMatch.score}% · {f.jobMatch.tier}
                                  </span>
                                ) : (
                                  <span className="job-match-pill match-tier-unavailable">
                                    Score Unavailable
                                  </span>
                                )}
                              </div>
                              <span className="job-match-criteria-summary">
                                {f.jobMatch.summaryNote}
                              </span>
                            </div>

                            {/* Transparent Criteria Breakdown */}
                            {f.jobMatch.breakdown && (
                              <div className="job-match-criteria-grid">
                                {/* 1. Skills Matching */}
                                <div className="match-criterion-box">
                                  <div className="criterion-top">
                                    <span className="criterion-name">⚡ Required Skills</span>
                                    {f.jobMatch.breakdown.skills.weight > 0 ? (
                                      <span className="criterion-pts">
                                        {f.jobMatch.breakdown.skills.earned} / {f.jobMatch.breakdown.skills.weight} pts
                                      </span>
                                    ) : (
                                      <span className="criterion-excluded-tag">Excluded from Weight</span>
                                    )}
                                  </div>
                                  <div className="criterion-status-text">
                                    {f.jobMatch.breakdown.skills.status}
                                  </div>

                                  {f.jobMatch.breakdown.skills.weight > 0 && (
                                    <div className="criterion-skills-detail">
                                      {f.jobMatch.breakdown.skills.matched.length > 0 && (
                                        <div className="skills-subgroup">
                                          <span className="skills-subgroup-label label-matched">
                                            ✓ Matched:
                                          </span>
                                          <div className="skills-subgroup-pills">
                                            {f.jobMatch.breakdown.skills.matched.map((s, idx) => (
                                              <span key={idx} className="skill-pill-matched">
                                                {s}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                      {f.jobMatch.breakdown.skills.notDetected.length > 0 && (
                                        <div className="skills-subgroup">
                                          <span className="skills-subgroup-label label-not-detected">
                                            ✕ Not detected in resume:
                                          </span>
                                          <div className="skills-subgroup-pills">
                                            {f.jobMatch.breakdown.skills.notDetected.map((s, idx) => (
                                              <span key={idx} className="skill-pill-not-detected">
                                                {s}
                                              </span>
                                            ))}
                                          </div>
                                        </div>
                                      )}
                                    </div>
                                  )}
                                </div>

                                {/* 2. Experience Requirement */}
                                <div className="match-criterion-box">
                                  <div className="criterion-top">
                                    <span className="criterion-name">💼 Experience</span>
                                    {f.jobMatch.breakdown.experience.weight > 0 ? (
                                      <span className="criterion-pts">
                                        {f.jobMatch.breakdown.experience.earned} / {f.jobMatch.breakdown.experience.weight} pts
                                      </span>
                                    ) : (
                                      <span className="criterion-excluded-tag">Excluded from Weight</span>
                                    )}
                                  </div>
                                  <div className="criterion-status-text">
                                    {f.jobMatch.breakdown.experience.status}
                                  </div>
                                </div>

                                {/* 3. Role Title Alignment */}
                                <div className="match-criterion-box">
                                  <div className="criterion-top">
                                    <span className="criterion-name">🎯 Role Alignment</span>
                                    {f.jobMatch.breakdown.role.weight > 0 ? (
                                      <span className="criterion-pts">
                                        {f.jobMatch.breakdown.role.earned} / {f.jobMatch.breakdown.role.weight} pts
                                      </span>
                                    ) : (
                                      <span className="criterion-excluded-tag">Excluded from Weight</span>
                                    )}
                                  </div>
                                  <div className="criterion-status-text">
                                    {f.jobMatch.breakdown.role.status}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Scoring Disclosures and Limitations */}
                            <div className="match-disclosure-note">
                              ℹ️ <em>Match score is a keyword heuristic based on detected qualifications vs. job requirements. Unmatched skills are labeled &ldquo;Not detected in resume&rdquo; and do not indicate a verified lack of skill. ATS readability is evaluated separately.</em>
                            </div>
                          </div>
                        )}

                        {/* ATS Compatibility Analysis */}
                        {f.atsCompatibility && (
                          <div className="ats-card-section">
                            <div className="ats-header-row">
                              <div className="ats-title-area">
                                <span className="ats-badge-icon">📋</span>
                                <span className="ats-title">ATS Compatibility Analysis</span>
                                {f.atsCompatibility.score !== null ? (
                                  <span className={`ats-pill ats-tier-${f.atsCompatibility.tier.toLowerCase().replace(/\s+/g, '-')}`}>
                                    {f.atsCompatibility.score}% · {f.atsCompatibility.tier}
                                  </span>
                                ) : (
                                  <span className="ats-pill ats-tier-unparseable">
                                    Unparseable Document
                                  </span>
                                )}
                              </div>
                              <span className="ats-summary-text">
                                {f.atsCompatibility.status}
                              </span>
                            </div>

                            {/* Transparent 4-Category Breakdown Grid */}
                            {f.atsCompatibility.breakdown && (
                              <div className="ats-criteria-grid">
                                {/* 1. Content Volume & Density */}
                                <div className="ats-criterion-box">
                                  <div className="criterion-top">
                                    <span className="criterion-name">📄 Content Volume</span>
                                    <span className="criterion-pts">
                                      {f.atsCompatibility.breakdown.contentVolume.score} / {f.atsCompatibility.breakdown.contentVolume.maxScore} pts
                                    </span>
                                  </div>
                                  <div className="criterion-status-text">
                                    {f.atsCompatibility.breakdown.contentVolume.status}
                                  </div>
                                </div>

                                {/* 2. Section Structure */}
                                <div className="ats-criterion-box">
                                  <div className="criterion-top">
                                    <span className="criterion-name">📑 Section Structure</span>
                                    <span className="criterion-pts">
                                      {f.atsCompatibility.breakdown.sectionHeaders.score} / {f.atsCompatibility.breakdown.sectionHeaders.maxScore} pts
                                    </span>
                                  </div>
                                  <div className="criterion-status-text">
                                    {f.atsCompatibility.breakdown.sectionHeaders.status}
                                  </div>
                                  <div className="ats-sections-subgroup">
                                    {f.atsCompatibility.breakdown.sectionHeaders.detected.length > 0 && (
                                      <div className="ats-sections-tags">
                                        <span className="ats-sections-label label-detected">Detected:</span>
                                        {f.atsCompatibility.breakdown.sectionHeaders.detected.map((sec, sIdx) => (
                                          <span key={sIdx} className="ats-tag-detected">✓ {sec}</span>
                                        ))}
                                      </div>
                                    )}
                                    {f.atsCompatibility.breakdown.sectionHeaders.missing.length > 0 && (
                                      <div className="ats-sections-tags">
                                        <span className="ats-sections-label label-missing">Missing:</span>
                                        {f.atsCompatibility.breakdown.sectionHeaders.missing.map((sec, sIdx) => (
                                          <span key={sIdx} className="ats-tag-missing">✕ {sec}</span>
                                        ))}
                                      </div>
                                    )}
                                  </div>
                                </div>

                                {/* 3. Contact Info Completeness */}
                                <div className="ats-criterion-box">
                                  <div className="criterion-top">
                                    <span className="criterion-name">📇 Contact Info (Heuristic)</span>
                                    <span className="criterion-pts">
                                      {f.atsCompatibility.breakdown.contactInfo.score} / {f.atsCompatibility.breakdown.contactInfo.maxScore} pts
                                    </span>
                                  </div>
                                  <div className="criterion-status-text">
                                    {f.atsCompatibility.breakdown.contactInfo.status}
                                  </div>
                                  <div className="ats-heuristic-subnote">
                                    ℹ️ {f.atsCompatibility.breakdown.contactInfo.note}
                                  </div>
                                </div>

                                {/* 4. Text Hygiene & Encoding */}
                                <div className="ats-criterion-box">
                                  <div className="criterion-top">
                                    <span className="criterion-name">🔤 Text Hygiene</span>
                                    <span className="criterion-pts">
                                      {f.atsCompatibility.breakdown.textHygiene.score} / {f.atsCompatibility.breakdown.textHygiene.maxScore} pts
                                    </span>
                                  </div>
                                  <div className="criterion-status-text">
                                    {f.atsCompatibility.breakdown.textHygiene.status}
                                  </div>
                                </div>
                              </div>
                            )}

                            {/* Actionable Suggestions */}
                            {Array.isArray(f.atsCompatibility.suggestions) && f.atsCompatibility.suggestions.length > 0 && (
                              <div className="ats-suggestions-box">
                                <span className="ats-suggestions-title">💡 Readability &amp; ATS Recommendations:</span>
                                <ul className="ats-suggestions-list">
                                  {f.atsCompatibility.suggestions.map((suggestion, sIdx) => (
                                    <li key={sIdx} className="ats-suggestion-item">
                                      {suggestion}
                                    </li>
                                  ))}
                                </ul>
                              </div>
                            )}

                            {/* Transparency Disclosures and Heuristic Limitation Note */}
                            <div className="ats-disclosure-note">
                              ℹ️ <em>{f.atsCompatibility.disclosure}</em>
                            </div>
                          </div>
                        )}

                        {/* Semantic Relevance Section */}
                        {isSuccess && f.semanticMatch && (
                          <div className="semantic-match-card-section">
                            <div className="semantic-match-header-row">
                              <div className="semantic-match-title-area">
                                <span className="semantic-match-badge-icon">≈</span>
                                <span className="semantic-match-title">Semantic Relevance Analysis</span>
                                {f.semanticMatch.score !== null ? (
                                  <span className={`semantic-match-pill semantic-tier-${f.semanticMatch.tier.toLowerCase().replace(/[^a-z0-9]+/g, '-')}`}>
                                    {f.semanticMatch.score}% · {f.semanticMatch.tier}
                                  </span>
                                ) : (
                                  <span className="semantic-match-pill semantic-tier-unavailable">
                                    Score Unavailable
                                  </span>
                                )}
                              </div>
                              <span className="semantic-match-criteria-summary">
                                {f.semanticMatch.summaryNote}
                              </span>
                            </div>

                            {Array.isArray(f.semanticMatch.limitations) && f.semanticMatch.limitations.length > 0 && (
                              <div className="semantic-limitations-box">
                                {f.semanticMatch.limitations.map((lim, lIdx) => (
                                  <p key={lIdx} className="semantic-limitation-item">
                                    ℹ️ {lim}
                                  </p>
                                ))}
                              </div>
                            )}
                          </div>
                        )}

                        {/* Extraction note for empty or failed files */}
                        {(isEmpty || isFailed) && f.extractionNote && (
                          <div className="upload-extraction-note">
                            <span className="note-icon">{isEmpty ? 'ℹ' : '⚠'}</span>
                            <span className="note-text">{f.extractionNote}</span>
                          </div>
                        )}

                        {/* Text preview limited to 500 characters */}
                        {isSuccess && isExpanded && f.preview && (
                          <div className="upload-preview-wrapper">
                            <div className="upload-preview-header">
                              <span className="preview-label">
                                In-Memory Text Preview (First {f.preview.length} characters)
                              </span>
                              <span className="preview-security-tag">
                                🔒 Full text saved privately in memory
                              </span>
                            </div>
                            <pre className="upload-preview-text">{f.preview}</pre>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          )}

          {/* ── Upload form (hidden after success) ───────────────────────── */}
          {!result && (
            <>
              {/* Warnings (client-side skipped files) */}
              {warnings.length > 0 && (
                <div className="upload-warning-banner">
                  <span>⚠️</span>
                  <ul style={{ margin: 0, paddingLeft: '1rem' }}>
                    {warnings.map((w, i) => <li key={i}>{w}</li>)}
                  </ul>
                </div>
              )}

              {/* Server / request error */}
              {error && (
                <div className="form-server-error" role="alert">
                  <span>⚠️</span>
                  <span>{error}</span>
                </div>
              )}

              {/* Drop zone / file picker */}
              <div
                className="upload-dropzone"
                onClick={() => !submitting && fileInputRef.current?.click()}
                role="button"
                tabIndex={submitting ? -1 : 0}
                onKeyDown={(e) => e.key === 'Enter' && fileInputRef.current?.click()}
                aria-label="Click to select PDF or DOCX files"
              >
                <div className="upload-dropzone-icon">📂</div>
                <p className="upload-dropzone-text">
                  Click to select <strong>PDF</strong> or <strong>DOCX</strong> files
                </p>
                <p className="upload-dropzone-hint">
                  Max {MAX_FILE_COUNT} files · 5 MB each · Text will be extracted in memory
                </p>
                <input
                  ref={fileInputRef}
                  type="file"
                  accept=".pdf,.docx"
                  multiple
                  style={{ display: 'none' }}
                  onChange={handleFileChange}
                  disabled={submitting}
                />
              </div>

              {/* Selected file list */}
              {files.length > 0 && (
                <div className="upload-file-list">
                  <p className="upload-file-list-label">
                    {files.length} file{files.length !== 1 ? 's' : ''} queued for upload &amp; text extraction
                  </p>
                  {files.map((file, idx) => (
                    <div key={idx} className="upload-file-item">
                      <span className="upload-file-icon">
                        {file.type === 'application/pdf' ? '📄' : '📝'}
                      </span>
                      <div className="upload-file-info">
                        <span className="upload-file-name">{file.name}</span>
                        <span className="upload-file-size">{formatBytes(file.size)}</span>
                      </div>
                      <button
                        className="upload-file-remove"
                        onClick={() => removeFile(idx)}
                        disabled={submitting}
                        aria-label={`Remove ${file.name}`}
                      >
                        ✕
                      </button>
                    </div>
                  ))}
                </div>
              )}

              {files.length === 0 && !error && warnings.length === 0 && (
                <p className="upload-no-files-hint">
                  No files selected yet. Click the area above to add resumes.
                </p>
              )}
            </>
          )}

        </div>

        {/* Footer */}
        <div className="form-footer">
          {result ? (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={resetToUploadMore}
              >
                + Upload More Resumes
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={onCancel}
              >
                Done
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                className="btn btn-ghost"
                onClick={onCancel}
                disabled={submitting}
              >
                Cancel
              </button>
              <button
                type="button"
                className="btn btn-primary"
                onClick={handleUpload}
                disabled={files.length === 0 || submitting}
              >
                {submitting
                  ? '⏳ Extracting & Uploading…'
                  : `📤 Upload & Extract ${files.length > 0 ? `(${files.length})` : ''}`}
              </button>
            </>
          )}
        </div>

      </div>
    </div>
  )
}

export default ResumeUpload
