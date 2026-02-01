import type { ReactNode } from 'react'
import { useScrollForwarding } from '../hooks/ScrollForwarding'
import styles from './PageShell.module.css'

interface PageShellProps {
  title?: string
  subtitle?: ReactNode
  actions?: ReactNode
  children: ReactNode
  compact?: boolean
  contentIsScrollTarget?: boolean
}

export function PageShell({
  title,
  subtitle,
  actions,
  children,
  compact = false,
  contentIsScrollTarget = false,
}: PageShellProps) {
  useScrollForwarding()
  return (
    <div className={`${styles.shell} ${compact ? styles.shellCompact : ''}`}>
      {(title || subtitle || actions) && (
        <header className={styles.header}>
          {(title || actions) && (
            <div className={styles.titleRow}>
              {title && (
                <div className={styles.titleGroup}>
                  <h1 className={styles.title}>{title}</h1>
                  {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
                </div>
              )}
              {actions && <div className={styles.actions}>{actions}</div>}
            </div>
          )}
        </header>
      )}

      <div className={styles.content} data-scroll-target={contentIsScrollTarget}>{children}</div>
    </div>
  )
}
