import styles from './SynergyBadge.module.css'

interface SynergyBadgeProps {
  value: number
  decimals?: number
  size?: 'sm' | 'md'
  showSign?: boolean
}

export function SynergyBadge({
  value,
  decimals = 1,
  size = 'md',
  showSign = true,
}: SynergyBadgeProps) {
  const isPositive = value > 0.05
  const isNegative = value < -0.05

  const sign = showSign && value > 0 ? '+' : ''
  const variant = isPositive ? 'positive' : isNegative ? 'negative' : 'neutral'

  return (
    <span className={`${styles.badge} ${styles[size]} ${styles[variant]}`}>
      {sign}{value.toFixed(decimals)}%
    </span>
  )
}

interface SynergyBarProps {
  value: number
  maxValue?: number
  showLabel?: boolean
}

export function SynergyBar({ value, maxValue = 10, showLabel = true }: SynergyBarProps) {
  const isPositive = value > 0
  const absValue = Math.abs(value)
  const percentage = Math.min((absValue / maxValue) * 100, 100)

  return (
    <div className={styles.barContainer}>
      <div className={styles.barTrack}>
        <div className={styles.barCenter} />
        {isPositive ? (
          <div
            className={`${styles.barFill} ${styles.barPositive}`}
            style={{ width: `${percentage / 2}%`, left: '50%' }}
          />
        ) : (
          <div
            className={`${styles.barFill} ${styles.barNegative}`}
            style={{ width: `${percentage / 2}%`, right: '50%' }}
          />
        )}
      </div>
      {showLabel && (
        <span className={`${styles.barLabel} ${isPositive ? styles.positive : styles.negative}`}>
          {value > 0 ? '+' : ''}{value.toFixed(1)}%
        </span>
      )}
    </div>
  )
}
