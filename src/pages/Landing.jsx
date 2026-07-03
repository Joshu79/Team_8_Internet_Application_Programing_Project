import { Link } from 'react-router-dom'

const Landing = () => {
  return (
    <div className="landing">
      <h1>PesaTrack</h1>
      <p>See where your money actually goes — straight from your M-Pesa statement.</p>
      <Link to="/upload" className="cta-button">Get Started</Link>
    </div>
  )
}

export default Landing