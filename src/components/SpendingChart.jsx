import { Doughnut } from 'react-chartjs-2'
import { Chart as ChartJS, ArcElement, Tooltip, Legend } from 'chart.js'

ChartJS.register(ArcElement, Tooltip, Legend)

const SpendingChart = ({ categories }) => {
  const chartData = {
    labels: Object.keys(categories),
    datasets: [
      {
        label: 'Spending by category',
        data: Object.values(categories),
        backgroundColor: [
          '#4CAF50',
          '#2196F3',
          '#FFC107',
          '#9C27B0',
          '#F44336',
          '#607D8B',
          '#00A651',
          '#FF7043',
          '#7E57C2',
          '#00897B',
          '#EF6C00',
          '#5E35B1',
          '#9E9D24',
          '#3949AB',
          '#8E24AA',
          '#6D4C41',
          '#546E7A'
        ]
      }
    ]
  }

  return <Doughnut data={chartData} options={{ maintainAspectRatio: false, plugins: { legend: { position: 'bottom' } } }} />
}

export default SpendingChart
