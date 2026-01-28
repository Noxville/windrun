import { useState } from 'react'
import { Link } from 'react-router-dom'
import { abilityIconUrl } from '../config'
import styles from './AbilityIcon.module.css'

interface AbilityIconProps {
  id: number
  name: string
  shortName: string
  isUltimate?: boolean
  size?: 'xs' | 'sm' | 'md' | 'lg'
  showTooltip?: boolean
  tooltipText?: string
  linkTo?: string
  newTab?: boolean
}

export function AbilityIcon({
  name,
  shortName,
  isUltimate = false,
  size = 'md',
  showTooltip = true,
  tooltipText,
  linkTo,
  newTab = false,
}: AbilityIconProps) {
  const [imgError, setImgError] = useState(false)

  const content = (
    <div
      className={`${styles.icon} ${styles[size]} ${isUltimate ? styles.ultimate : ''}`}
      data-tooltip={showTooltip ? tooltipText || name : undefined}
    >
      {!imgError ? (
        <img
          src={abilityIconUrl(shortName)}
          alt={name}
          className={styles.image}
          loading="lazy"
          onError={() => setImgError(true)}
        />
      ) : (
        <div className={styles.fallback}>
          {name.charAt(0)}
        </div>
      )}
      {isUltimate && <div className={styles.ultimateBadge} />}
    </div>
  )

  if (linkTo) {
    if (newTab) {
      return (
        <a href={linkTo} className={styles.link} target="_blank" rel="noopener noreferrer">
          {content}
        </a>
      )
    }
    return (
      <Link to={linkTo} className={styles.link}>
        {content}
      </Link>
    )
  }

  return content
}

interface AbilityInlineProps {
  id: number
  name: string
  shortName: string
  isUltimate?: boolean
  linkTo?: string
  newTab?: boolean
}

export function AbilityInline({
  id,
  name,
  shortName,
  isUltimate = false,
  linkTo,
  newTab = false,
}: AbilityInlineProps) {
  const content = (
    <span className={styles.inline}>
      <span className={styles.inlineIconWrapper}>
        <AbilityIcon
          id={id}
          name={name}
          shortName={shortName}
          isUltimate={isUltimate}
          size="sm"
          showTooltip={false}
        />
      </span>
      <span className={`${styles.inlineName} ${isUltimate ? styles.inlineUltimate : ''}`}>
        {name}
      </span>
    </span>
  )

  if (linkTo) {
    if (newTab) {
      return (
        <a href={linkTo} className={styles.inlineLink} target="_blank" rel="noopener noreferrer">
          {content}
        </a>
      )
    }
    return (
      <Link to={linkTo} className={styles.inlineLink}>
        {content}
      </Link>
    )
  }

  return content
}

interface AbilityRowProps {
  abilities: Array<{
    id: number
    name: string
    shortName: string
    isUltimate?: boolean
  }>
  size?: 'xs' | 'sm' | 'md'
}

export function AbilityRow({ abilities, size = 'sm' }: AbilityRowProps) {
  return (
    <div className={styles.row}>
      {abilities.map(ability => (
        <AbilityIcon
          key={ability.id}
          id={ability.id}
          name={ability.name}
          shortName={ability.shortName}
          isUltimate={ability.isUltimate}
          size={size}
          linkTo={`/abilities/${ability.id}`}
        />
      ))}
    </div>
  )
}
