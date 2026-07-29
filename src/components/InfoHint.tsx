import { Link } from 'react-router-dom'
import styles from './InfoHint.module.css'

interface InfoHintProps {
  text: string
  to?: string
}

export function InfoHint({ text, to = '/about#windrun-rating' }: InfoHintProps) {
  return (
    <Link to={to} className={styles.hint} data-hint={text} aria-label={text}>
      ?
    </Link>
  )
}
