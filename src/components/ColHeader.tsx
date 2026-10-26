import { Link } from 'react-router-dom'
import styles from './ColHeader.module.css'

interface ColHeaderProps {
  label: string
  hint?: string
  to?: string
}

// Stacks a multi-word header onto one word per line so the column can stay narrow
export function ColHeader({ label, hint, to = '/about#ability-value' }: ColHeaderProps) {
  const words = label.split(' ')
  return (
    <span className={styles.colHeader}>
      <span className={styles.colHeaderLabel}>
        {words.map(word => (
          <span key={word}>{word}</span>
        ))}
      </span>
      {hint && (
        <Link to={to} className={styles.hint} title={hint} aria-label={hint}>
          ?
        </Link>
      )}
    </span>
  )
}
