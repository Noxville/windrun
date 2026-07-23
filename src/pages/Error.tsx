import { Link, useRouteError, isRouteErrorResponse } from 'react-router-dom'
import { Navigation } from '../components/Navigation'
import { Footer } from '../components/Footer'
import { PageShell } from '../components/PageShell'
import styles from './Error.module.css'

function ErrorContent({ error }: { error?: unknown }) {
  let title = 'Something went wrong'
  let message = 'We encountered an unexpected error. Please try again later.'

  if (isRouteErrorResponse(error)) {
    title = `${error.status} ${error.statusText}`.trim()
    if (typeof error.data === 'string' && error.data) message = error.data
  }

  const detail = error instanceof Error ? (error.stack ?? error.message) : null

  return (
    <PageShell title="Error">
      <div className={styles.container}>
        <img
          src="https://cdn.datdota.com/images/errors/sad2.png"
          alt="Error"
          className={styles.image}
        />
        <h2 className={styles.title}>{title}</h2>
        <p className={styles.message}>{message}</p>
        {import.meta.env.DEV && detail && <pre className={styles.details}>{detail}</pre>}
        <Link to="/" className={styles.homeLink}>
          Back to homepage
        </Link>
      </div>
    </PageShell>
  )
}

export function ErrorPage() {
  return <ErrorContent />
}

// Route-level error boundary. When any child route throws, React Router
// renders this in place of the parent AppLayout, so it re-renders the app
// chrome (nav + footer) itself to keep the page looking consistent.
export function RouteErrorBoundary() {
  const error = useRouteError()
  return (
    <div className="app">
      <header className="app-header">
        <Navigation />
      </header>
      <main className="app-main">
        <ErrorContent error={error} />
      </main>
      <Footer />
    </div>
  )
}
