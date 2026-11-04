import { Link, useParams } from 'react-router-dom'
import Footer from '../components/Footer'

const ParentReport = () => {
  const { id } = useParams()

  return (
    <main className="parent-report-page">
      <header className="report-page-heading">
        <h1>Parent report</h1>
        <p>A clear overview of spending activity and budget progress.</p>
      </header>

      <section className="report-panel" aria-labelledby="report-panel-title">
        <h2 id="report-panel-title">Report details</h2>
        <p>
          No statement data is available for report {id} yet. Upload a statement to prepare spending details and category totals.
        </p>
        <Link to="/upload" className="cta-button">Upload a statement</Link>
      </section>
      <Footer />
    </main>
  )
}

export default ParentReport
