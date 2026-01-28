import styles from './Footer.module.css'

export function Footer() {
  return (
    <footer className={styles.footer}>
      <div className={styles.content}>
        <span className={styles.attribution}>
          A passion project by{' '}
          <a href="https://twitter.com/Noxville" target="_blank" rel="noopener noreferrer" className={styles.link}>
            Noxville
          </a>{' '}
          &{' '}
          <a href="https://twitter.com/bukkadota" target="_blank" rel="noopener noreferrer" className={styles.link}>
            bukka
          </a>
        </span>
        <span className={styles.sep}>|</span>
        <a href="https://discord.gg/datdota" target="_blank" rel="noopener noreferrer" className={styles.link}>
          Datdota Discord
        </a>
        <span className={styles.sep}>|</span>
        <a href="https://discord.gg/abilitydraft" target="_blank" rel="noopener noreferrer" className={styles.link}>
          AD Community
        </a>
        <span className={styles.sep}>|</span>
        <a href="https://ko-fi.com/datdota" target="_blank" rel="noopener noreferrer" className={styles.link}>
          Support the site on Ko-fi
        </a>
        <span className={styles.sep}>|</span>
        <a href="https://github.com/Noxville/windrun" target="_blank" rel="noopener noreferrer" className={styles.link}>
          Contribute code on Github
        </a>
      </div>
    </footer>
  )
}
