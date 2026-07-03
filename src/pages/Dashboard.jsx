import { mockData } from '../data/mockTransactions'
import SpendingChart from '../components/SpendingChart'

const Dashboard = () => {
  return (
    <div>
      <h1>Dashboard</h1>
      <p>{mockData.month}</p>
      <p>Total spent: KES {mockData.totalSpent}</p>
      <p>Remaining budget: KES {mockData.remainingBudget}</p>

      <h2>Spending by category</h2>
      <div style={{ maxWidth: '400px' }}>
        <SpendingChart categories={mockData.categories} />
      </div>
    </div>
  )
}

export default Dashboard