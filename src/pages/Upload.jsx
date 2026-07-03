const Upload = () => {
  return (
    <div className="upload-page">
      <h1>Upload your M-Pesa statement</h1>
      <p>We'll read your PDF and show you exactly where your money went.</p>
      <div className="upload-box">
        <p>Drag and drop your PDF here</p>
        <p>or</p>
        <button className="cta-button">Choose File</button>
      </div>
    </div>
  )
}

export default Upload