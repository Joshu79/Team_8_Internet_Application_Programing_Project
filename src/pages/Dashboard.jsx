import { mockData } from '../data/mockTransactions'
import Footer from '../components/Footer'

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
      <Footer/>
    </div>
  )
}

export default Dashboard