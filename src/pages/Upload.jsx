import { useEffect, useState } from 'react'
import Footer from '../components/Footer'

const categories = [
  'Food', 'Transport', 'Airtime', 'Entertainment', 'Rent',
  'Education', 'Health', 'Shopping', 'Campus & supplies',
  'Subscriptions', 'Fitness', 'Utilities', 'Personal care',
  'Family & support', 'Savings', 'Travel', 'Other',
]

const getCurrentMonth = () => {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}`
}

const getToday = () => {
  const today = new Date()
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`
}

const Upload = () => {
  const [budgetMonth, setBudgetMonth] = useState(getCurrentMonth)
  const [monthlyBudget, setMonthlyBudget] = useState('')
  const [description, setDescription] = useState('')
  const [amount, setAmount] = useState('')
  const [adjustmentAmount, setAdjustmentAmount] = useState('')
  const [category, setCategory] = useState('Food')
  const [date, setDate] = useState(getToday)
  const [budgetState, setBudgetState] = useState('loading')
  const [savingBudget, setSavingBudget] = useState(false)
  const [savingAdjustment, setSavingAdjustment] = useState(false)
  const [savingExpense, setSavingExpense] = useState(false)
  const [budgetMessage, setBudgetMessage] = useState('')
  const [expenseMessage, setExpenseMessage] = useState('')

  useEffect(() => {
    const controller = new AbortController()
    async function loadBudget() {
      setBudgetState('loading')
      setBudgetMessage('')
      try {
        const response = await fetch(`/v1/app/dashboard?month=${budgetMonth}`, {
          credentials: 'same-origin',
          signal: controller.signal,
        })
        const data = await response.json().catch(() => ({}))
        if (!response.ok) throw new Error(data.message || 'Could not load this month’s budget.')
        setMonthlyBudget(data.monthlyBudget === null ? '' : String(data.monthlyBudget))
        setBudgetState('loaded')
      } catch (error) {
        if (error.name !== 'AbortError') {
          setBudgetMessage(error.message || 'Could not connect to Pesa Tracker. Start the server and database.')
          setBudgetState('error')
        }
      }
    }
    loadBudget()
    return () => controller.abort()
  }, [budgetMonth])

  const saveBudget = async (event) => {
    event.preventDefault()
    setBudgetMessage('')
    setSavingBudget(true)
    try {
      const response = await fetch('/v1/app/budget', {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ month: budgetMonth, monthlyBudget: Number(monthlyBudget) }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Could not save your budget.')
      setBudgetState('loaded')
      setBudgetMessage(`Budget saved for ${budgetMonth}.`)
    } catch (error) {
      setBudgetState('error')
      setBudgetMessage(error.message || 'Could not connect to Pesa Tracker. Start the server and database.')
    } finally {
      setSavingBudget(false)
    }
  }

  const adjustBudget = async (event) => {
    event.preventDefault()
    setBudgetMessage('')
    setSavingAdjustment(true)
    const action = event.nativeEvent.submitter?.value
    try {
      const response = await fetch('/v1/app/budget/adjust', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ month: budgetMonth, action, amount: Number(adjustmentAmount) }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Could not adjust your budget.')
      setMonthlyBudget(String(data.monthlyBudget))
      setAdjustmentAmount('')
      setBudgetState('loaded')
      setBudgetMessage(`Budget ${action === 'add' ? 'increased' : 'reduced'} to KES ${new Intl.NumberFormat('en-KE').format(data.monthlyBudget)} for ${budgetMonth}.`)
    } catch (error) {
      setBudgetState('error')
      setBudgetMessage(error.message || 'Could not connect to Pesa Tracker. Start the server and database.')
    } finally {
      setSavingAdjustment(false)
    }
  }

  const saveExpense = async (event) => {
    event.preventDefault()
    setExpenseMessage('')
    setSavingExpense(true)
    try {
      const response = await fetch('/v1/app/expenses', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'same-origin',
        body: JSON.stringify({ amount: Number(amount), category, description, date }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) throw new Error(data.message || 'Could not save your expense.')
      setExpenseMessage('Expense saved. It will appear in the dashboard for that month.')
      setDescription('')
      setAmount('')
    } catch (error) {
      setExpenseMessage(error.message || 'Could not connect to Pesa Tracker. Start the server and database.')
    } finally {
      setSavingExpense(false)
    }
  }

  return (
    <main className="upload-page budget-page">
      <header className="budget-page-heading">
        <p className="page-eyebrow">Your money, in one place</p>
        <h1>Manage your budget</h1>
        <p>Set a monthly limit and record expenses as they happen. Your balance updates automatically.</p>
      </header>

      <div className="budget-entry-grid">
        <section className="budget-form-card" aria-labelledby="monthly-budget-title">
          <div className="form-card-heading">
            <span className="form-card-icon" aria-hidden="true"><i className="bi bi-wallet2" /></span>
            <div>
              <h2 id="monthly-budget-title">Monthly budget</h2>
              <p>Choose the amount you plan to spend.</p>
            </div>
          </div>

          <form onSubmit={saveBudget}>
            <div className="budget-form-fields">
              <label className="budget-field">
                <span>Month</span>
                <input
                  type="month"
                  value={budgetMonth}
                  onChange={(event) => setBudgetMonth(event.target.value)}
                  required
                />
              </label>
              <label className="budget-field">
                <span>Budget amount (KES)</span>
                <input
                  type="number"
                  min="1"
                  max="99999999.99"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="e.g. 25000"
                  value={monthlyBudget}
                  onChange={(event) => setMonthlyBudget(event.target.value)}
                  required
                />
              </label>
            </div>
            {budgetMessage && <p className={`form-feedback ${budgetState === 'error' ? 'is-error' : 'is-success'}`} role={budgetState === 'error' ? 'alert' : 'status'}>{budgetMessage}</p>}
            <button className="cta-button" type="submit" disabled={savingBudget || budgetState === 'loading'}>
              {savingBudget ? 'Saving…' : 'Save monthly budget'}
            </button>
          </form>

          <div className="budget-adjustment">
            <div className="budget-adjustment-heading">
              <h3>Adjust saved budget</h3>
              <p>Current budget: <strong>{monthlyBudget !== '' ? `KES ${new Intl.NumberFormat('en-KE').format(Number(monthlyBudget))}` : 'Not set'}</strong></p>
            </div>
            <form onSubmit={adjustBudget}>
              <label className="budget-field">
                <span>Adjustment amount (KES)</span>
                <input
                  type="number"
                  min="0.01"
                  max="99999999.99"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="e.g. 1000"
                  value={adjustmentAmount}
                  onChange={(event) => setAdjustmentAmount(event.target.value)}
                  required
                />
              </label>
              <div className="budget-adjustment-actions">
                <button className="budget-adjust-button increase" type="submit" value="add" disabled={savingAdjustment || budgetState === 'loading'}>
                  {savingAdjustment ? 'Saving…' : '＋ Increase budget'}
                </button>
                <button className="budget-adjust-button decrease" type="submit" value="subtract" disabled={savingAdjustment || budgetState === 'loading'}>
                  {savingAdjustment ? 'Saving…' : '− Reduce budget'}
                </button>
              </div>
            </form>
          </div>
        </section>

        <section className="budget-form-card" aria-labelledby="add-expense-title">
          <div className="form-card-heading">
            <span className="form-card-icon" aria-hidden="true"><i className="bi bi-receipt" /></span>
            <div>
              <h2 id="add-expense-title">Add an expense</h2>
              <p>Each entry is included in your monthly total.</p>
            </div>
          </div>

          <form onSubmit={saveExpense}>
            <label className="budget-field">
              <span>What did you spend on?</span>
              <input
                type="text"
                maxLength="180"
                placeholder="e.g. Lunch at campus café"
                value={description}
                onChange={(event) => setDescription(event.target.value)}
                required
              />
            </label>
            <div className="budget-form-fields">
              <label className="budget-field">
                <span>Category</span>
                <select value={category} onChange={(event) => setCategory(event.target.value)}>
                  {categories.map((item) => <option key={item} value={item}>{item}</option>)}
                </select>
              </label>
              <label className="budget-field">
                <span>Amount (KES)</span>
                <input
                  type="number"
                  min="0.01"
                  max="10000000"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="e.g. 450"
                  value={amount}
                  onChange={(event) => setAmount(event.target.value)}
                  required
                />
              </label>
            </div>
            <label className="budget-field">
              <span>Date</span>
              <input type="date" value={date} onChange={(event) => setDate(event.target.value)} required />
            </label>
            {expenseMessage && <p className={`form-feedback ${expenseMessage.startsWith('Expense saved') ? 'is-success' : 'is-error'}`} role={expenseMessage.startsWith('Expense saved') ? 'status' : 'alert'}>{expenseMessage}</p>}
            <button className="cta-button" type="submit" disabled={savingExpense}>
              {savingExpense ? 'Saving…' : 'Add expense'}
            </button>
          </form>
        </section>
      </div>

      <aside className="import-note">
        <i className="bi bi-info-circle" aria-hidden="true" />
        <p><strong>Statement import is coming later.</strong> For now, enter expenses manually. Saved entries appear in your dashboard.</p>
      </aside>

      <Footer />
    </main>
  )
}

export default Upload
