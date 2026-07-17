import { Link } from 'react-router-dom'

const Landing = () => {
  return (
    <div className="landing">
      <div className="landing-inner">
        <span className="landing-eyebrow">M-Pesa Statement Analyser</span>
        <h1>Pesa<span>Track</span></h1>
        <p className="landing-sub">
          See exactly where your money goes — upload your M-Pesa statement and get a clear breakdown in seconds.
        </p>
        <div className="landing-actions">
          <Link to="/upload" className="cta-button">
            Get started →
          </Link>
          <span className="landing-hint">No account needed · PDF only</span>
        </div>
      </div>
    </div>
  )
}

export default Landing