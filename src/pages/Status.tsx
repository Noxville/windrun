import { PageShell } from '../components/PageShell'
import { usePersistedQuery } from '../api'
import styles from './Status.module.css'

interface StatusApiResponse {
  data: {
    secs_behind: number
    status: 'OK' | 'CRITICAL'
  }
}

function formatTimeBehind(seconds: number): string {
  if (seconds < 60) return `${seconds} seconds`
  if (seconds < 3600) return `${Math.floor(seconds / 60)} minutes`
  if (seconds < 86400) {
    const hours = Math.floor(seconds / 3600)
    const mins = Math.floor((seconds % 3600) / 60)
    return mins > 0 ? `${hours}h ${mins}m` : `${hours} hours`
  }
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  return hours > 0 ? `${days}d ${hours}h` : `${days} days`
}

export function StatusPage() {
  const { data: apiResponse, isLoading, error } = usePersistedQuery<StatusApiResponse>('/status')

  const status = apiResponse?.data?.status ?? 'UNKNOWN'
  const secsBehind = apiResponse?.data?.secs_behind ?? 0

  return (
    <PageShell
      title="System Status"
      subtitle="Windrun.io data pipeline health"
    >
      {error ? (
        <p style={{ color: 'var(--color-negative)' }}>
          Unable to fetch system status. The API may be unavailable.
        </p>
      ) : isLoading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Loading status...</p>
      ) : (
        <div className={styles.statusGrid}>
          <div className={styles.statusCard}>
            <span className={styles.label}>System Health</span>
            <span className={`${styles.value} ${status === 'OK' ? styles.ok : styles.critical}`}>
              {status}
            </span>
          </div>
          <div className={styles.statusCard}>
            <span className={styles.label}>Data Freshness</span>
            <span className={styles.value}>
              {formatTimeBehind(secsBehind)} behind
            </span>
            <span className={styles.sublabel}>
              {secsBehind < 3600 ? 'Data is fresh' : secsBehind < 86400 ? 'Slight delay' : 'Significant delay'}
            </span>
          </div>
        </div>
      )}
    </PageShell>
  )
}
