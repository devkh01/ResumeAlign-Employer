import { useState } from 'react'

const EMPTY_FORM = {
  title:       '',
  description: '',
  skills:      '',
  experience:  '',
  location:    '',
  salary:      '',
}

/**
 * Client-side validation — mirrors the backend rules so the user gets
 * instant feedback without a round trip for common mistakes.
 * Returns an object: keys present = that field has an error.
 */
function validate(fields) {
  const errors = {}
  if (!fields.title.trim())
    errors.title = 'Job title is required.'
  if (!fields.description.trim())
    errors.description = 'Job description is required.'
  if (!fields.skills.trim())
    errors.skills = 'At least one required skill is needed.'
  if (!fields.experience.trim())
    errors.experience = 'Minimum experience is required.'
  else if (isNaN(Number(fields.experience)) || Number(fields.experience) < 0)
    errors.experience = 'Enter a valid number (e.g. 2).'
  if (!fields.location.trim())
    errors.location = 'Location is required.'
  return errors
}

/**
 * CreateJobForm — modal overlay with a controlled form.
 *
 * Props:
 *   onSubmit  async (fields) => void  — called with validated fields on submit;
 *                                       must throw an Error to signal failure
 *   onCancel  ()             => void  — closes the form without saving
 */
function CreateJobForm({ onSubmit, onCancel }) {
  const [fields,      setFields]      = useState(EMPTY_FORM)
  const [errors,      setErrors]      = useState({})
  const [touched,     setTouched]     = useState({})
  const [submitting,  setSubmitting]  = useState(false)   // in-flight POST
  const [serverError, setServerError] = useState(null)    // backend error message

  function handleChange(e) {
    const { name, value } = e.target
    setFields((prev) => ({ ...prev, [name]: value }))
    if (errors[name]) setErrors((prev) => ({ ...prev, [name]: '' }))
    if (serverError)  setServerError(null)   // clear server error on any edit
  }

  function handleBlur(e) {
    const { name } = e.target
    setTouched((prev) => ({ ...prev, [name]: true }))
  }

  async function handleSubmit(e) {
    e.preventDefault()

    // 1. Client-side validation first (no network call needed for obvious gaps)
    const validationErrors = validate(fields)
    if (Object.keys(validationErrors).length > 0) {
      setErrors(validationErrors)
      setTouched(Object.fromEntries(Object.keys(EMPTY_FORM).map((k) => [k, true])))
      return
    }

    // 2. POST to backend — onSubmit is async and throws on failure
    setSubmitting(true)
    setServerError(null)
    try {
      await onSubmit({
        title:       fields.title.trim(),
        description: fields.description.trim(),
        // Send skills as a comma-separated string; backend normalises it
        skills:      fields.skills,
        experience:  fields.experience.trim(),
        location:    fields.location.trim(),
        salary:      fields.salary.trim(),
      })
      // If onSubmit resolves, App.jsx closes the modal — nothing more to do here
    } catch (err) {
      setServerError(err.message || 'Something went wrong. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  function showError(name) {
    return touched[name] && errors[name]
  }

  return (
    <div className="modal-overlay" role="dialog" aria-modal="true" aria-labelledby="form-title">
      <div className="form-panel">

        {/* Header */}
        <div className="form-panel-header">
          <div>
            <h2 className="form-panel-title" id="form-title">Create New Job Posting</h2>
            <p className="form-panel-subtitle">Fields marked with * are required</p>
          </div>
          <button
            className="form-close-btn"
            onClick={onCancel}
            aria-label="Close form"
            disabled={submitting}
          >
            ✕
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} noValidate>
          <div className="form-body">

            {/* Server-returned error banner */}
            {serverError && (
              <div className="form-server-error" role="alert">
                <span>⚠️</span>
                <span>{serverError}</span>
              </div>
            )}

            {/* Job Title */}
            <div className="form-group">
              <label className="form-label" htmlFor="title">
                Job Title <span className="required">*</span>
              </label>
              <input
                id="title"
                name="title"
                type="text"
                className={`form-input ${showError('title') ? 'error' : ''}`}
                placeholder="e.g. Senior Frontend Developer"
                value={fields.title}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={submitting}
              />
              {showError('title') && <span className="form-error">{errors.title}</span>}
            </div>

            {/* Job Description */}
            <div className="form-group">
              <label className="form-label" htmlFor="description">
                Job Description <span className="required">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                className={`form-textarea ${showError('description') ? 'error' : ''}`}
                placeholder="Describe the role, responsibilities, and expectations…"
                value={fields.description}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={submitting}
              />
              {showError('description') && <span className="form-error">{errors.description}</span>}
            </div>

            {/* Required Skills */}
            <div className="form-group">
              <label className="form-label" htmlFor="skills">
                Required Skills <span className="required">*</span>
              </label>
              <input
                id="skills"
                name="skills"
                type="text"
                className={`form-input ${showError('skills') ? 'error' : ''}`}
                placeholder="e.g. React, Node.js, SQL (comma-separated)"
                value={fields.skills}
                onChange={handleChange}
                onBlur={handleBlur}
                disabled={submitting}
              />
              <span className="form-hint">Separate skills with commas.</span>
              {showError('skills') && <span className="form-error">{errors.skills}</span>}
            </div>

            {/* Experience & Location */}
            <div className="form-row">
              <div className="form-group">
                <label className="form-label" htmlFor="experience">
                  Min. Experience (years) <span className="required">*</span>
                </label>
                <input
                  id="experience"
                  name="experience"
                  type="number"
                  min="0"
                  className={`form-input ${showError('experience') ? 'error' : ''}`}
                  placeholder="e.g. 3"
                  value={fields.experience}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  disabled={submitting}
                />
                {showError('experience') && <span className="form-error">{errors.experience}</span>}
              </div>

              <div className="form-group">
                <label className="form-label" htmlFor="location">
                  Location <span className="required">*</span>
                </label>
                <input
                  id="location"
                  name="location"
                  type="text"
                  className={`form-input ${showError('location') ? 'error' : ''}`}
                  placeholder="e.g. Remote / New York"
                  value={fields.location}
                  onChange={handleChange}
                  onBlur={handleBlur}
                  disabled={submitting}
                />
                {showError('location') && <span className="form-error">{errors.location}</span>}
              </div>
            </div>

            {/* Offered Salary (optional) */}
            <div className="form-group">
              <label className="form-label" htmlFor="salary">
                Offered Salary{' '}
                <span style={{ color: 'var(--text-muted)', fontWeight: 400 }}>(optional)</span>
              </label>
              <input
                id="salary"
                name="salary"
                type="text"
                className="form-input"
                placeholder="e.g. $80,000 – $110,000 / year"
                value={fields.salary}
                onChange={handleChange}
                disabled={submitting}
              />
            </div>

          </div>

          {/* Footer */}
          <div className="form-footer">
            <button
              type="button"
              className="btn btn-ghost"
              onClick={onCancel}
              disabled={submitting}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="btn btn-primary"
              disabled={submitting}
            >
              {submitting ? '⏳ Posting…' : '➕ Post Job'}
            </button>
          </div>
        </form>

      </div>
    </div>
  )
}

export default CreateJobForm
