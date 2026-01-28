import { Link } from 'react-router-dom'
import { heroImageUrl, heroMiniUrl } from '../config'
import styles from './HeroCard.module.css'

interface HeroCardProps {
  id: number
  name: string
  picture: string
  winRate?: number
  subtitle?: string
  size?: 'sm' | 'md' | 'lg'
  linkTo?: string
}

export function HeroCard({
  name,
  picture,
  winRate,
  subtitle,
  size = 'md',
  linkTo,
}: HeroCardProps) {
  const content = (
    <div className={`${styles.card} ${styles[size]}`}>
      <div className={styles.imageWrap}>
        <img
          src={heroImageUrl(picture)}
          alt={name}
          className={styles.image}
          loading="lazy"
        />
      </div>
      <div className={styles.info}>
        <span className={styles.name}>{name}</span>
        {winRate !== undefined && (
          <span className={styles.winRate}>{winRate.toFixed(1)}%</span>
        )}
        {subtitle && <span className={styles.subtitle}>{subtitle}</span>}
      </div>
    </div>
  )

  if (linkTo) {
    return (
      <Link to={linkTo} className={styles.link}>
        {content}
      </Link>
    )
  }

  return content
}

interface HeroMiniProps {
  name: string
  picture: string
  height?: number
  className?: string
}

export function HeroMini({ name, picture, height = 28, className = '' }: HeroMiniProps) {
  // Dota hero portraits are roughly 127:71 aspect ratio
  const width = Math.round(height * (127 / 71))
  return (
    <img
      src={heroMiniUrl(picture)}
      alt={name}
      width={width}
      height={height}
      className={`${styles.mini} ${className}`}
      loading="lazy"
    />
  )
}

interface HeroInlineProps {
  id: number
  name: string
  picture: string
  linkTo?: string
}

export function HeroInline({ name, picture, linkTo }: HeroInlineProps) {
  const content = (
    <span className={styles.inline}>
      <span className={styles.inlineIconWrapper}>
        <span className={styles.inlineIconSquare}>
          <img
            src={heroMiniUrl(picture)}
            alt={name}
            className={styles.inlineIconImg}
            loading="lazy"
          />
        </span>
      </span>
      <span className={styles.inlineName}>{name}</span>
    </span>
  )

  if (linkTo) {
    return (
      <Link to={linkTo} className={styles.inlineLink}>
        {content}
      </Link>
    )
  }

  return content
}
