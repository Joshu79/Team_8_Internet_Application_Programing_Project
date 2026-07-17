import { mockData } from '../data/mockTransactions'
import SpendingChart from '../components/SpendingChart'
import Footer from '../components/Footer'

const Dashboard = () => {
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