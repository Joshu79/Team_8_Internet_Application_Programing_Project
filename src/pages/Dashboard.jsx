import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import SpendingChart from '../components/SpendingChart'
import Footer from '../components/Footer'

const Dashboard = ({ user }) => {
  const [summary, setSummary] = useState(null)
  const [dataStatus, setDataStatus] = useState('loading')
  const [reloadCount, setReloadCount] = useState(0)
  const [partnerSummary, setPartnerSummary] = useState(null)
  const [partnerStatus, setPartnerStatus] = useState('loading')
  const [partnerRetryCount, setPartnerRetryCount] = useState(0)
  const today = new Date()
  const currentMonth = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
  const monthLabel = new Intl.DateTimeFormat('en-KE', { month: 'long', year: 'numeric' }).format(today)
  const firstName = (user?.name || user?.username || user?.fullName || 'there').trim().split(/\s+/)[0] || 'there'
  const greetingName = firstName.charAt(0).toUpperCase() + firstName.slice(1)
  const formatKes = (amount) => new Intl.NumberFormat('en-KE', { maximumFractionDigits: 2 }).format(amount)

  useEffect(() => {
    const controller = new AbortController()
    async function loadDashboard() {
      setDataStatus('loading')
      try {
        const response = await fetch(`/v1/app/dashboard?month=${currentMonth}`, {
          credentials: 'same-origin',
          signal: controller.signal,
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.message || 'Your spending summary could not be loaded.')
        setSummary(data)
        setDataStatus('loaded')
      } catch (error) {
        if (error.name !== 'AbortError') setDataStatus('error')
      }
    }
    loadDashboard()
    return () => controller.abort()
  }, [currentMonth, reloadCount])

  useEffect(() => {
    const controller = new AbortController()
    async function loadPartnerSummary() {
      setPartnerStatus('loading')
      try {
        const response = await fetch(`/v1/partner/expenses/summary?month=${currentMonth}`, {
          signal: controller.signal,
        })
        if (!response.ok) throw new Error('Partner summary unavailable')
        const data = await response.json()
        setPartnerSummary(data)
        setPartnerStatus('loaded')
      } catch (error) {
        if (error.name !== 'AbortError') setPartnerStatus('error')
      }
    }
    loadPartnerSummary()
    return () => controller.abort()
  }, [currentMonth, partnerRetryCount])

  const categories = summary?.categories || {}
  const expenses = summary?.expenses || []

  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>Welcome {greetingName}</h1>
        <time className="dashboard-period" dateTime={currentMonth}>{monthLabel}</time>
      </div>

      {dataStatus === 'error' ? (
        <section className="dashboard-state dashboard-state-error" role="alert">
          <h2>We couldn’t load your budget yet</h2>
          <p>Make sure the API server and MySQL database are running, then try again.</p>
          <button className="cta-button" onClick={() => setReloadCount((count) => count + 1)}>Try again</button>
        </section>
      ) : (
        <>
          <div className="dashboard-summary" aria-live="polite">
            <article className="summary-card">
              <p className="summary-card-label">Monthly budget</p>
              <p className="summary-card-value">
                {dataStatus === 'loading' ? '—' : summary.monthlyBudget === null ? 'Not set' : <><span className="summary-card-currency">KES</span>{formatKes(summary.monthlyBudget)}</>}
              </p>
            </article>
            <article className="summary-card">
              <p className="summary-card-label">Spent this month</p>
              <p className="summary-card-value">
                {dataStatus === 'loading' ? '—' : <><span className="summary-card-currency">KES</span>{formatKes(summary.totalSpent)}</>}
              </p>
            </article>
            <article className="summary-card">
              <p className="summary-card-label">Balance remaining</p>
              <p className={`summary-card-value ${summary?.remaining >= 0 ? 'positive' : 'negative'}`}>
                {dataStatus === 'loading' ? '—' : summary.remaining === null ? 'Set a budget' : <><span className="summary-card-currency">KES</span>{formatKes(summary.remaining)}</>}
              </p>
            </article>
          </div>

          {summary?.monthlyBudget === null && dataStatus === 'loaded' && (
            <div className="dashboard-notice">
              <span>Set a monthly budget to see your remaining balance.</span>
              <Link to="/upload">Set budget</Link>
            </div>
          )}

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
                <button className="partner-summary-retry" onClick={() => setPartnerRetryCount((count) => count + 1)}>Try again</button>
              </div>
            )}
            {partnerStatus === 'loaded' && partnerSummary.stale && (
              <p className="partner-summary-message" role="status">
                Showing saved data from {partnerSummary.asOf ? new Date(partnerSummary.asOf).toLocaleString() : 'an earlier time'}. The partner is not responding.
              </p>
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

          <div className="dashboard-content-grid">
            <section className="chart-section">
              <div className="dashboard-section-heading">
                <div>
                  <p className="summary-card-label">Your activity</p>
                  <h2>Spending by category</h2>
                </div>
                <Link to="/upload" className="dashboard-text-link">Add expense</Link>
              </div>
              {dataStatus === 'loading' ? (
                <p className="dashboard-empty-state" role="status">Loading spending data…</p>
              ) : Object.keys(categories).length ? (
                <div className="chart-container"><SpendingChart categories={categories} /></div>
              ) : (
                <p className="dashboard-empty-state">Your category breakdown will appear after you add an expense.</p>
              )}
            </section>

            <section className="recent-expenses-section" aria-labelledby="recent-expenses-title">
              <div className="dashboard-section-heading">
                <div>
                  <p className="summary-card-label">Latest entries</p>
                  <h2 id="recent-expenses-title">Recent expenses</h2>
                </div>
                <Link to="/upload" className="dashboard-text-link">Add new</Link>
              </div>
              {expenses.length ? (
                <ul className="recent-expenses-list" tabIndex={0} aria-label="All expenses this month">
                  {expenses.map((expense) => (
                    <li key={expense.id} className="recent-expense-row">
                      <span className="recent-expense-icon" aria-hidden="true"><i className="bi bi-receipt" /></span>
                      <span className="recent-expense-description">
                        <strong>{expense.description}</strong>
                        <small>{expense.category} · {new Date(`${expense.date}T00:00:00`).toLocaleDateString('en-KE', { day: 'numeric', month: 'short' })}</small>
                      </span>
                      <strong className="recent-expense-amount">− KES {formatKes(expense.amount)}</strong>
                    </li>
                  ))}
                </ul>
              ) : (
                <p className="dashboard-empty-state">No expenses saved for this month yet.</p>
              )}
            </section>
          </div>
        </>
      )}

      <Footer />
    </div>
  )
}

export default Dashboard
