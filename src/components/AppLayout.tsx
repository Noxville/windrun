import { Outlet } from 'react-router-dom'
import { Navigation } from './Navigation'
import { Footer } from './Footer'

export function AppLayout() {
  return (
    <div className="app">
      <header className="app-header">
        <Navigation />
      </header>
      <main className="app-main">
        <Outlet />
      </main>
      <Footer />
    </div>
  )
}
