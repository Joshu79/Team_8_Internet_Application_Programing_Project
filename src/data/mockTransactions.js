// Fake M-Pesa data — this stands in for the real backend
// which will eventually parse the uploaded PDF statement

export const mockData = {
  month: "June 2026",
  totalSpent: 18450,
  remainingBudget: 6550,
  categories: {
    food: 6200,
    transport: 3100,
    airtime: 1800,
    entertainment: 2400,
    rent: 4000,
    other: 950
  },
  transactions: [
    { date: "2026-06-01", type: "Send Money", recipient: "Mum", amount: 500 },
    { date: "2026-06-02", type: "Paybill", recipient: "Umoja Rent", amount: 4000 },
    { date: "2026-06-04", type: "Buy Goods", recipient: "Java House", amount: 850 },
    { date: "2026-06-05", type: "Send Money", recipient: "John K", amount: 300 },
    { date: "2026-06-07", type: "Airtime", recipient: "Safaricom", amount: 200 },
    { date: "2026-06-10", type: "Buy Goods", recipient: "Naivas", amount: 1200 }
  ]
}