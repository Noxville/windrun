import { PageShell } from '../components/PageShell'
import styles from './Error.module.css'

export function ErrorPage() {
  return (
    <PageShell title="Error">
      <div className={styles.container}>
        <img
          src="https://cdn.datdota.com/images/errors/sad2.png"
          alt="Error"
          className={styles.image}
        />
        <h2 className={styles.title}>Something went wrong</h2>
        <p className={styles.message}>
          We encountered an unexpected error. Please try again later.
        </p>
      </div>
    </PageShell>
  )
}
