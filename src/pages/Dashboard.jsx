import { useEffect, useState } from 'react'
import { mockData } from '../data/mockTransactions'
import SpendingChart from '../components/SpendingChart'
import Footer from '../components/Footer'

const Dashboard = () => {
  const [partnerSummary, setPartnerSummary] = useState(null)
  const [partnerStatus, setPartnerStatus] = useState('loading')
  const [retryCount, setRetryCount] = useState(0)
  const today = new Date()
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`

  useEffect(() => {
    const controller = new AbortController()

    async function loadPartnerSummary() {
      setPartnerStatus('loading')
      try {
        const response = await fetch(`/v1/partner/expenses/summary?month=${currentMonth}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Partner summary unavailable')
        const summary = await response.json()
        setPartnerSummary(summary)
        setPartnerStatus('loaded')
      } catch (error) {
        if (error.name !== 'AbortError') setPartnerStatus('error')
      }
    }

    loadPartnerSummary()
    return () => controller.abort()
  }, [currentMonth, retryCount])

  const formatKes = (amount) => new Intl.NumberFormat('en-KE').format(amount)

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Dashboard</h1>
        <span className="dashboard-period">{mockData.month}</span>
      </div>

      <div className="dashboard-summary">
        <div className="summary-card">
          <p className="summary-card-label">Total spent</p>
          <p className="summary-card-value">
            <span className="summary-card-currency">KES</span>
            {mockData.totalSpent.toLocaleString()}
          </p>
        </div>
        <div className="summary-card">
          <p className="summary-card-label">Remaining budget</p>
          <p className="summary-card-value positive">
            <span className="summary-card-currency">KES</span>
            {mockData.remainingBudget.toLocaleString()}
          </p>
        </div>
        <div className="summary-card">
          <p className="summary-card-label">Categories</p>
          <p className="summary-card-value">{mockData.categories.length}</p>
        </div>
      </div>

      <section className="partner-summary-section" aria-labelledby="partner-summary-title">
        <div className="partner-summary-heading">
          <div>
            <p className="summary-card-label">Connected service</p>
            <h2 id="partner-summary-title">FitCoach spending</h2>
          </div>
          {partnerStatus === 'loaded' && <span className="partner-summary-month">{partnerSummary.month}</span>}
        </div>

        {partnerStatus === 'loading' && <p className="partner-summary-message" role="status">Loading partner spending…</p>}
        {partnerStatus === 'error' && (
          <div className="partner-summary-message" role="status">
            <p>FitCoach spending is unavailable right now. Your Pesa Tracker dashboard is still available.</p>
            <button className="partner-summary-retry" onClick={() => setRetryCount((count) => count + 1)}>Try again</button>
          </div>
        )}
        {partnerStatus === 'loaded' && (
          <div className="partner-summary-grid">
            <article className="partner-summary-item">
              <p className="summary-card-label">Spent this month</p>
              <p className="summary-card-value"><span className="summary-card-currency">KES</span>{formatKes(partnerSummary.totalSpent)}</p>
            </article>
            <article className="partner-summary-item">
              <p className="summary-card-label">Monthly allowance</p>
              <p className="summary-card-value"><span className="summary-card-currency">KES</span>{formatKes(partnerSummary.monthlyAllowance)}</p>
            </article>
            <article className="partner-summary-item">
              <p className="summary-card-label">Remaining</p>
              <p className="summary-card-value positive"><span className="summary-card-currency">KES</span>{formatKes(partnerSummary.remaining)}</p>
            </article>
          </div>
        )}
      </section>

      <div className="chart-section">
        <h2>Spending by category</h2>
        <div className="chart-container">
          <SpendingChart categories={mockData.categories} />
        </div>
      </div>

      <Footer />
    </div>
  )
}

export default Dashboard
