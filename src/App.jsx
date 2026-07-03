import { BrowserRouter, Routes, Route } from 'react-router-dom'
import Landing from './pages/Landing'
import Upload from './pages/Upload'
import Dashboard from './pages/Dashboard'
import ParentReport from './pages/ParentReport'
import './App.css'

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Landing />} />
        <Route path="/upload" element={<Upload />} />
        <Route path="/dashboard" element={<Dashboard />} />
        <Route path="/report/:id" element={<ParentReport />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App