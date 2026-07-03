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
          '#607D8B'
        ]
      }
    ]
  }

  return <Doughnut data={chartData} options={{ maintainAspectRatio: false }} />
}

export default SpendingChart