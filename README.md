# ResumeAlign AI

**An Employer-Side Resume Screening and Candidate Shortlisting System**

ResumeAlign AI is a web application designed to help employers organize job applications, analyze resumes against job requirements, and shortlist candidates using transparent matching criteria and AI-based semantic relevance.

The application supports PDF and DOCX resume uploads and presents multiple scoring dimensions to help recruiters review candidates more efficiently.

## Key Features

- **Job Management:** Create job listings with descriptions, required skills, experience requirements, location, and salary details.
- **Multiple Resume Uploads:** Upload multiple PDF and DOCX resumes for a selected job.
- **Resume Parsing:** Extract available text and candidate details, including contact information, skills, and explicitly stated experience.
- **Job Match Score:** Compare candidates against job requirements using a weighted, rule-based scoring method.
- **ATS Compatibility Score:** Estimate resume compatibility using document content, section structure, contact information, and text quality indicators.
- **AI Semantic Relevance:** Use a pretrained sentence-embedding model to estimate the contextual similarity between a resume and a job description.
- **Candidate Shortlisting:** Display candidates in ranked order with separate scores, matched skills, skills not detected, and score explanations.
- **Privacy-Conscious Responses:** Avoid exposing extracted resume text and internal embedding data in public API responses.

## Technology Stack

| Component | Technology |
|---|---|
| Frontend | React, Vite, JavaScript, CSS |
| Backend | Node.js, Express.js |
| Resume parsing | `pdf-parse`, `mammoth` |
| Semantic matching | `@huggingface/transformers` |
| Semantic model | `Xenova/all-MiniLM-L6-v2` |
| Development and testing | npm, browser, API testing tools |

*Verify package names and versions against the final project files before submission.*

## How It Works

1. The employer creates a job listing and enters the job requirements.
2. The employer uploads resumes in supported PDF or DOCX formats.
3. The backend extracts readable document text and attempts to identify candidate information.
4. The application calculates the Job Match Score and ATS Compatibility Score.
5. The semantic matching service compares resume content with the job description using sentence embeddings.
6. The frontend displays the candidate shortlist, scores, detected skills, and supporting explanations.

## Scoring Approach

### 1. Job Match Score

A rule-based score based on three criteria:

- Skills match: up to 60 points
- Experience match: up to 30 points
- Role alignment: up to 10 points

The score is normalized using the criteria that can be evaluated. A value that could not be determined from the resume should not automatically be treated as a confirmed mismatch.

### 2. ATS Compatibility Score

A heuristic estimate based on:

- Content volume
- Section structure
- Contact information completeness
- Text hygiene

This is an application-generated estimate, not an official score from a commercial Applicant Tracking System.

### 3. AI Semantic Relevance

A pretrained sentence-embedding model converts resume and job-description text into numerical representations and estimates their cosine similarity.

This score measures contextual text similarity. It does not establish that a candidate genuinely possesses a skill or predict hiring success.

### Candidate Ranking

Candidates are primarily ranked by Job Match Score. ATS Compatibility is used as a tie-breaker, followed by upload time. Semantic Relevance is displayed separately and does not directly determine the ranking.

## Project Structure

```text
ResumeAlign-Employer/
├── client/                 # React + Vite frontend
├── server/                 # Express backend and services
├── .gitignore
├── README.md
└── package files           # Verify actual locations before publishing
```

The structure above is a simplified overview. The exact package files and service files should be confirmed against the repository.


## Getting Started

### Prerequisites

- Node.js and npm
- Git
- Internet access for the initial download of the pretrained semantic model, if it is not already cached

### 1. Clone the Repository

```bash
git clone https://github.com/devkh01/ResumeAlign-Employer.git
cd ResumeAlign-Employer
```

Replace `YOUR-USERNAME` with the GitHub username that owns the repository.

### 2. Install Backend Dependencies

Open a terminal in the project root:

```bash
cd server
npm install
```

### 3. Start the Backend

From the `server` directory:

```bash
npm run dev
```

The backend is expected to run at `http://localhost:5000`.

### 4. Install Frontend Dependencies

Open a second terminal in the project root:

```bash
cd client
npm install
```

### 5. Start the Frontend

From the `client` directory:

```bash
npm run dev
```

Open the local URL printed by Vite, normally `http://localhost:5173`.

Keep both terminals running while using the application.

### Production Build

To check the frontend production build:

```bash
cd client
npm run build
```

The backend currently has no configured automated test suite. Its `npm test` command is a placeholder.


## API Overview

The current backend includes these API endpoints:

| Method | Endpoint | Purpose |
|---|---|---|
| GET | `/api/health` | Check backend health |
| GET | `/api/jobs` | Retrieve job listings |
| POST | `/api/jobs` | Create a job listing |
| POST | `/api/jobs/:jobId/resumes` | Upload resumes for a job |
| GET | `/api/jobs/:jobId/candidates` | Retrieve candidates for a job |

Check the backend implementation for the exact request fields, validation rules, and response formats.

## Current Limitations

- Job and candidate data are stored in memory and are lost when the backend restarts.
- Scanned or image-only PDFs without an extractable text layer are not supported through OCR.
- Candidate details depend on what can be extracted from the uploaded document.
- The scoring methods are estimates and may produce false positives or false negatives.
- Semantic similarity is not proof of qualifications, skill proficiency, or future job performance.
- Authentication, persistent database storage, and production deployment are not currently implemented.
- The application is a prototype and should not be used as the sole basis for real hiring decisions.

## Privacy and Responsible Use

Use synthetic or authorized test resumes when demonstrating the application. Do not publish real candidates' resumes, contact details, or extracted personal information in this repository.

Review API responses and repository files before publishing. Never commit passwords, API keys, access tokens, private environment files, or personal candidate data.

## Testing

The project has undergone reported end-to-end checks covering readable PDF and DOCX resumes, semantic matching, unavailable results for unparseable documents, candidate ranking, and the omission of extracted resume text from public API responses. The frontend production build also passed.

These results describe the tested prototype and do not constitute a security audit or production-readiness certification.

## Future Enhancements

- Persistent database integration
- Employer authentication and access control
- OCR support for scanned resumes
- More comprehensive resume parsing and validation
- Exportable shortlisting reports
- Expanded evaluation using diverse, consented test documents
- Accessibility, security, and performance improvements

## Academic Project

ResumeAlign AI is a prototype developed as an academic software project to explore resume parsing, rule-based candidate matching, ATS-oriented checks, and pretrained language-model embeddings.

**Author(s):** Add project team details  
**Department:** Add department name  
**Institution:** Add institution name  
**Academic Year:** Add academic year

## License

No license has been specified yet. Add an appropriate license only after the project team decides how the code may be reused.
