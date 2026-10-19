import SummaryCard from './SummaryCard.jsx'
import JobCard     from './JobCard.jsx'

/**
 * Dashboard — main view shown when currentView === 'dashboard'.
 *
 * Props:
 *   jobs             Job[]       — jobs fetched from the backend
 *   loading          boolean     — true while GET /api/jobs is in flight
 *   apiError         string|null — error message if the fetch failed
 *   onDismissError   () => void  — clears the error banner
 *   onOpenJobForm    () => void  — opens the Create Job modal
 *   onUploadResumes  (job) => void
 *   onViewCandidates (job) => void
 */
function Dashboard({
  jobs,
  loading,
  apiError,
  onDismissError,
  onOpenJobForm,
  onUploadResumes,
  onViewCandidates,
}) {
  // Show spinner while the initial fetch is running
  if (loading) {
    return (
      <div className="loading-state">
        <div className="spinner" />
        <p>Loading jobs from server…</p>
      </div>
    )
  }

  // Calculate live counts across all jobs
  const totalResumes = jobs.reduce((sum, j) => sum + (Number(j.resumeCount) || 0), 0)
  const jobsWithResumes = jobs.filter((j) => (Number(j.resumeCount) || 0) > 0).length

  return (
    <>
      {/* API error banner — only shown when the initial fetch fails */}
      {apiError && (
        <div className="api-error-banner" role="alert">
          <span className="api-error-icon">⚠️</span>
          <span className="api-error-text">{apiError}</span>
          <button
            className="api-error-dismiss"
            onClick={onDismissError}
            aria-label="Dismiss error"
          >
            ✕
          </button>
        </div>
      )}

      {/* Welcome banner */}
      <div className="welcome-banner">
        <div className="welcome-text">
          <h2>Hiring Overview</h2>
          <p>
            Review active job requisitions, track resume evaluations, and inspect ranked candidate shortlists.
          </p>
        </div>
        <button className="btn btn-primary" onClick={onOpenJobForm}>
          ➕ Create New Job
        </button>
      </div>

      {/* Summary cards with live calculated values */}
      <div className="summary-grid">
        <SummaryCard
          label="Active Jobs"
          value={jobs.length}
          icon="💼"
          accentColor="#1B4D3E"
          iconBg="#EBF3F0"
          note="Positions actively accepting applicants"
        />
        <SummaryCard
          label="Resumes Reviewed"
          value={totalResumes}
          icon="📄"
          accentColor="#285E4D"
          iconBg="#F0F5F3"
          note="Total evaluated across all active postings"
        />
        <SummaryCard
          label="Active Shortlists"
          value={jobsWithResumes}
          icon="⭐"
          accentColor="#526058"
          iconBg="#F4F5F2"
          note="Positions with ranked candidate profiles"
        />
      </div>

      {/* Active Jobs list */}
      <div className="section-header">
        <div>
          <h2 className="section-title">Active Job Postings</h2>
          <p className="section-subtitle">
            {jobs.length === 0
              ? 'No jobs posted yet'
              : `${jobs.length} job${jobs.length !== 1 ? 's' : ''} currently active`}
          </p>
        </div>
        {jobs.length > 0 && (
          <button className="btn btn-ghost" onClick={onOpenJobForm}>
            ➕ Add Another Job
          </button>
        )}
      </div>

      {jobs.length === 0 ? (
        <div className="empty-state">
          <div className="empty-icon">📋</div>
          <h3>No job postings yet</h3>
          <p>Create your first job posting to start shortlisting candidates.</p>
          <button className="btn btn-primary" onClick={onOpenJobForm}>
            ➕ Create First Job
          </button>
        </div>
      ) : (
        <div className="job-list">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onUpload={onUploadResumes}
              onViewCandidates={onViewCandidates}
            />
          ))}
        </div>
      )}
    </>
  )
}

export default Dashboard
