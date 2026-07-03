import { mockData } from '../data/mockTransactions'

const Dashboard = () => {
  return (
    <div>
      <h1>Dashboard</h1>
      <p>{mockData.month}</p>
      <p>Total spent: KES {mockData.totalSpent}</p>
      <p>Remaining budget: KES {mockData.remainingBudget}</p>

      <h2>Spending by category</h2>
      <ul>
        {Object.entries(mockData.categories).map(([category, amount]) => (
          <li key={category}>
            {category}: KES {amount}
          </li>
        ))}
      </ul>
    </div>
  )
}

export default Dashboard