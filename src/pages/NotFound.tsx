import { PageShell } from '../components/PageShell'
import styles from './Error.module.css'

export function NotFoundPage() {
  return (
    <PageShell title="Page Not Found">
      <div className={styles.container}>
        <img
          src="https://cdn.datdota.com/images/errors/sad2.png"
          alt="Not Found"
          className={styles.image}
        />
        <h2 className={styles.title}>Page Not Found</h2>
        <p className={styles.message}>
          The page you're looking for doesn't exist or has been moved.
        </p>
      </div>
    </PageShell>
  )
}
