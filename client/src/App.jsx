import { useState, useEffect } from 'react'
import Sidebar        from './components/Sidebar.jsx'
import Dashboard      from './components/Dashboard.jsx'
import CreateJobForm    from './components/CreateJobForm.jsx'
import ResumeUpload     from './components/ResumeUpload.jsx'
import CandidateShortlist from './components/CandidateShortlist.jsx'

const API_BASE = 'http://localhost:5000';

/**
 * App — root component.
 *
 * State:
 *   currentView            string      — which page is visible
 *   jobs                   Job[]       — list from the backend (source of truth)
 *   showJobForm            boolean     — whether the Create Job modal is open
 *   selectedJob            Job|null    — the job whose resume-upload modal is open
 *   selectedShortlistJobId number|null — the job selected in the Candidates shortlist view
 *   loading                boolean     — true while the initial GET /api/jobs is in flight
 *   apiError               string|null — message shown if GET /api/jobs fails
 */
function App() {
  const [currentView,            setCurrentView]            = useState('dashboard')
  const [jobs,                   setJobs]                   = useState([])
  const [showJobForm,            setShowJobForm]            = useState(false)
  const [selectedJob,            setSelectedJob]            = useState(null)   // upload modal target
  const [selectedShortlistJobId, setSelectedShortlistJobId] = useState(null)   // shortlist view target
  const [loading,                setLoading]                = useState(true)
  const [apiError,               setApiError]               = useState(null)

  // ── Job fetching ─────────────────────────────────────────────────────────────

  /** Initial load — shows the spinner while running. */
  useEffect(() => {
    async function fetchJobs() {
      try {
        const res  = await fetch(`${API_BASE}/api/jobs`)
        if (!res.ok) throw new Error(`Server responded with ${res.status}`)
        const data = await res.json()
        setJobs(data)
      } catch {
        setApiError(
          'Could not load jobs from the server. ' +
          'Make sure the backend is running on port 5000.'
        )
      } finally {
        setLoading(false)
      }
    }
    fetchJobs()
  }, [])

  /**
   * Silent refresh — called after a successful upload to update resumeCount
   * on each job card without flashing the full-page loading spinner.
   */
  async function refreshJobs() {
    try {
      const res = await fetch(`${API_BASE}/api/jobs`)
      if (!res.ok) return
      const data = await res.json()
      setJobs(data)
    } catch {
      // Silent — don't disrupt the upload success screen on a refresh failure
    }
  }

  // ── Job creation ─────────────────────────────────────────────────────────────

  /**
   * Called by CreateJobForm with validated field values.
   * POSTs to the backend and adds the server-returned job object to state.
   * Throws on failure so the form can display the error.
   */
  async function handleJobSubmit(fields) {
    const res  = await fetch(`${API_BASE}/api/jobs`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body:    JSON.stringify(fields),
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Failed to create job. Please try again.')
    }
    setJobs((prev) => [data, ...prev])
    setShowJobForm(false)
    setCurrentView('dashboard')
  }

  // ── Resume upload ─────────────────────────────────────────────────────────────

  /** Opens the upload modal for the clicked job card. */
  function handleUploadResumes(job) {
    setSelectedJob(job)
  }

  /**
   * Called by ResumeUpload with a populated FormData object.
   * Uses the server-assigned job ID from selectedJob — never a client-invented ID.
   * Returns the server response on success; throws on failure.
   */
  async function handleUploadSubmit(formData) {
    const res  = await fetch(`${API_BASE}/api/jobs/${selectedJob.id}/resumes`, {
      method: 'POST',
      body:   formData,
      // NOTE: Do NOT set Content-Type here.
      // The browser must set it automatically so it includes the multipart boundary.
    })
    const data = await res.json()
    if (!res.ok) {
      throw new Error(data.error || 'Upload failed. Please try again.')
    }
    // Refresh job list so resumeCount badges update without a full reload
    await refreshJobs()
    return data
  }

  /** Closes the upload modal and clears the selected job. */
  function handleUploadClose() {
    setSelectedJob(null)
  }

  /** Navigates directly to the ranked shortlist for a specific job. */
  function handleViewCandidates(job) {
    setSelectedShortlistJobId(job.id)
    setCurrentView('candidates')
  }

  // ── Page metadata ─────────────────────────────────────────────────────────────

  const PAGE_META = {
    dashboard:    { title: 'Dashboard',             subtitle: 'Overview of your hiring activity' },
    'create-job': { title: 'Create Job',            subtitle: 'Post a new job opening'           },
    candidates:   { title: 'Candidates & Shortlist', subtitle: 'Browse ranked candidates scored against job requirements' },
  }
  const meta = PAGE_META[currentView] || PAGE_META.dashboard

  return (
    <div className="app-shell">
      {/* Sidebar navigation */}
      <Sidebar
        currentView={currentView}
        onNavigate={(view) => {
          setCurrentView(view)
          if (view === 'create-job') setShowJobForm(true)
        }}
      />

      {/* Main area */}
      <div className="main-content">
        <header className="topbar">
          <div>
            <p className="topbar-title">{meta.title}</p>
            <p className="topbar-subtitle">{meta.subtitle}</p>
          </div>
          <div className="topbar-right">
            <span className="topbar-badge">● Live</span>
          </div>
        </header>

        <main className="page-content">
          {currentView === 'dashboard' && (
            <Dashboard
              jobs={jobs}
              loading={loading}
              apiError={apiError}
              onDismissError={() => setApiError(null)}
              onOpenJobForm={() => setShowJobForm(true)}
              onUploadResumes={handleUploadResumes}
              onViewCandidates={handleViewCandidates}
            />
          )}

          {currentView === 'create-job' && !showJobForm && (
            <div className="placeholder-page">
              <div className="placeholder-page-icon">➕</div>
              <h2>Create a New Job Posting</h2>
              <p>Use the button below to open the job creation form.</p>
              <button
                className="btn btn-primary"
                onClick={() => setShowJobForm(true)}
              >
                Open Job Form
              </button>
            </div>
          )}

          {currentView === 'candidates' && (
            <CandidateShortlist
              jobs={jobs}
              selectedJobId={selectedShortlistJobId}
              onSelectJob={(id) => setSelectedShortlistJobId(id)}
              onUploadResumes={handleUploadResumes}
              onNavigate={(view) => {
                setCurrentView(view)
                if (view === 'create-job') setShowJobForm(true)
              }}
            />
          )}
        </main>
      </div>

      {/* Create Job modal */}
      {showJobForm && (
        <CreateJobForm
          onSubmit={handleJobSubmit}
          onCancel={() => {
            setShowJobForm(false)
            if (currentView === 'create-job') setCurrentView('dashboard')
          }}
        />
      )}

      {/* Resume Upload modal — only when a job is selected */}
      {selectedJob && (
        <ResumeUpload
          job={selectedJob}
          onSubmit={handleUploadSubmit}
          onCancel={handleUploadClose}
        />
      )}
    </div>
  )
}

export default App
