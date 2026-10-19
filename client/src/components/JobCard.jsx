/**
 * JobCard — displays a single posted job in the Active Jobs list.
 *
 * Props:
 *   job              { id, title, skills[], experience, location, salary,
 *                      status, createdAt, resumeCount }
 *   onUpload         (job) => void  — opens the resume upload modal for this job
 *   onViewCandidates (job) => void  — opens the ranked shortlist for this job
 */
function JobCard({ job, onUpload, onViewCandidates }) {
  return (
    <div className="job-card">
      <div className="job-card-body">
        {/* Title */}
        <h3 className="job-card-title">{job.title}</h3>

        {/* Meta row */}
        <div className="job-card-meta">
          <span className="job-meta-item">
            <span className="job-meta-icon">📍</span>
            {job.location}
          </span>
          <span className="job-meta-item">
            <span className="job-meta-icon">⏱</span>
            {job.experience} yr{Number(job.experience) !== 1 ? 's' : ''} exp.
          </span>
          <span className="job-meta-item">
            <span className="job-meta-icon">💰</span>
            {job.salary}
          </span>
          {job.resumeCount > 0 && (
            <span className="job-meta-item">
              <span className="job-meta-icon">📄</span>
              {job.resumeCount} resume{job.resumeCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>

        {/* Skills */}
        {job.skills.length > 0 && (
          <div className="job-card-skills">
            {job.skills.map((skill, idx) => (
              <span key={idx} className="skill-tag">{skill}</span>
            ))}
          </div>
        )}
      </div>

      {/* Right side */}
      <div className="job-card-right">
        <span className="status-badge status-active">{job.status}</span>
        <span className="job-card-date">Posted {job.createdAt}</span>
        <div className="job-card-actions">
          {job.resumeCount > 0 && onViewCandidates && (
            <button
              className="btn btn-primary job-card-shortlist-btn"
              onClick={() => onViewCandidates(job)}
              aria-label={`View ranked shortlist for ${job.title}`}
            >
              ⭐ View Shortlist ({job.resumeCount})
            </button>
          )}
          <button
            className="btn btn-ghost job-card-upload-btn"
            onClick={() => onUpload(job)}
            aria-label={`Upload resumes for ${job.title}`}
          >
            📤 Upload Resumes
          </button>
        </div>
      </div>
    </div>
  )
}

export default JobCard
