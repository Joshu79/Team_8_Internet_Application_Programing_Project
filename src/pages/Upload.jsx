import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import Footer from '../components/Footer'

const UploadIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="17 8 12 3 7 8" />
    <line x1="12" y1="3" x2="12" y2="15" />
  </svg>
)

const FileIcon = () => (
  <svg viewBox="0 0 24 24" aria-hidden="true">
    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z" />
    <polyline points="14 2 14 8 20 8" />
  </svg>
)

const Upload = () => {
  const [selectedFile, setSelectedFile] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const navigate = useNavigate()

  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file) setSelectedFile(file)
  }

  const handleDrop = (event) => {
    event.preventDefault()
    const file = event.dataTransfer.files[0]
    if (file && file.type === 'application/pdf') setSelectedFile(file)
  }

  const handleDragOver = (event) => event.preventDefault()

  const handleProcess = () => {
    setIsProcessing(true)
    // Simulate backend processing — replace with real API call later
    setTimeout(() => navigate('/dashboard'), 1500)
  }

  const handleReset = () => setSelectedFile(null)

  return (
    <div className="upload-page">
      <h1>Upload your M-Pesa statement</h1>
      <p>We'll read your PDF and show you exactly where your money went.</p>

      <div
        className="upload-box"
        onDrop={handleDrop}
        onDragOver={handleDragOver}
      >
        {!selectedFile ? (
          <>
            <div className="upload-icon">
              <UploadIcon />
            </div>
            <p className="upload-box-primary">Drag and drop your PDF here</p>
            <p className="upload-box-secondary">Supports M-Pesa statement PDFs</p>
            <span className="upload-divider">or</span>
            <label className="cta-button">
              Choose file
              <input
                type="file"
                accept="application/pdf"
                onChange={handleFileChange}
                style={{ display: 'none' }}
              />
            </label>
          </>
        ) : (
          <>
            <div className="upload-file-info">
              <div className="upload-file-icon">
                <FileIcon />
              </div>
              <div style={{ overflow: 'hidden' }}>
                <p className="upload-file-name">{selectedFile.name}</p>
                <p className="upload-file-type">PDF · {(selectedFile.size / 1024).toFixed(0)} KB</p>
              </div>
            </div>

            {isProcessing ? (
              <div className="upload-processing">
                <span className="spinner" />
                Reading your statement…
              </div>
            ) : (
              <>
                <button className="cta-button" onClick={handleProcess}>
                  Analyse statement →
                </button>
                <button
                  onClick={handleReset}
                  style={{
                    background: 'none',
                    border: 'none',
                    fontSize: '13px',
                    color: 'var(--ink-subtle)',
                    cursor: 'pointer',
                    padding: '4px',
                  }}
                >
                  Choose a different file
                </button>
              </>
            )}
          </>
        )}
      </div>

      <Footer />
    </div>
  )
}

export default Upload