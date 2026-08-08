import { useState } from 'react'
import LandingPage from './pages/LandingPage'
import RegisterPage from './pages/RegisterPage'
import AuthPage from './pages/AuthPage'
import DashboardPage from './pages/DashboardPage'
import Navbar from './components/Navbar'

export type Page = 'home' | 'register' | 'auth' | 'dashboard'

export default function App() {
  const [page, setPage] = useState<Page>('home')

  const renderPage = () => {
    switch (page) {
      case 'home': return <LandingPage onNavigate={setPage} />
      case 'register': return <RegisterPage onNavigate={setPage} />
      case 'auth': return <AuthPage onNavigate={setPage} />
      case 'dashboard': return <DashboardPage onNavigate={setPage} />
    }
  }

  return (
    <div className="app">
      <Navbar currentPage={page} onNavigate={setPage} />
      <main className="main-content">
        {renderPage()}
      </main>
    </div>
  )
}
