import { mockData } from '../data/mockTransactions'
import SpendingChart from '../components/SpendingChart'

const Dashboard = () => {
  return (
    <div className="dashboard">
      <h1>Dashboard</h1>

      <div className="dashboard-summary">
        <p>{mockData.month}</p>
        <p>Total spent: KES {mockData.totalSpent}</p>
        <p>Remaining budget: KES {mockData.remainingBudget}</p>
      </div>

      <h2>Spending by category</h2>
      <div className="chart-container">
        <SpendingChart categories={mockData.categories} />
      </div>
    </div>
  )
}

export default Dashboard