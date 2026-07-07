import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

const Upload = () => {
  const [selectedFile, setSelectedFile] = useState(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const navigate = useNavigate()

  const handleFileChange = (event) => {
    const file = event.target.files[0]
    if (file) {
      setSelectedFile(file)
    }
  }

  const handleProcess = () => {
    setIsProcessing(true)

    // Simulate backend processing delay
    // Later, this is where we'd actually send the PDF to a real backend
    setTimeout(() => {
      navigate('/dashboard')
    }, 1500)
  }

  return (
    <div className="upload-page">
      <h1>Upload your M-Pesa statement</h1>
      <p>We'll read your PDF and show you exactly where your money went.</p>

      <div className="upload-box">
        {!selectedFile ? (
          <>
            <p>Drag and drop your PDF here</p>
            <p>or</p>
            <label className="cta-button">
              Choose File
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
            <p>Selected: {selectedFile.name}</p>
            <button
              className="cta-button"
              onClick={handleProcess}
              disabled={isProcessing}
            >
              {isProcessing ? 'Processing...' : 'Process Statement'}
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default Upload