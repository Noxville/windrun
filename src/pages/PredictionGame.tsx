import { PageShell } from '../components/PageShell'
import { useAuth } from '../api'
import styles from './PredictionGame.module.css'

export function PredictionGamePage() {
  const { user, login } = useAuth()

  return (
    <PageShell
      title="Prediction Game"
      subtitle="Test your Ability Draft knowledge"
    >
      <div className={styles.container}>
        {!user ? (
          <div className={styles.loginPrompt}>
            <h2 className={styles.promptTitle}>Log in to Play</h2>
            <p className={styles.promptText}>
              Sign in with your Steam account to play the Ability Draft prediction game
              and compete on the leaderboards.
            </p>
            <button onClick={login} className={styles.loginButton}>
              <svg className={styles.steamIcon} viewBox="0 0 32 32" fill="currentColor">
                <path d="M15.974 0C7.596 0 .765 6.464.042 14.681l8.583 3.543a4.52 4.52 0 0 1 2.55-.786c.085 0 .17.003.253.008l3.82-5.531v-.078c0-3.322 2.703-6.025 6.025-6.025s6.025 2.703 6.025 6.025-2.703 6.025-6.025 6.025h-.14l-5.446 3.886c0 .07.004.14.004.211 0 2.493-2.027 4.52-4.52 4.52a4.525 4.525 0 0 1-4.476-3.903L.633 19.971C2.35 27.076 8.548 32.2 15.974 32.2c8.837 0 16-7.163 16-16s-7.163-16-16-16zm-5.01 24.692l-1.946-.803a3.393 3.393 0 0 0 3.134 2.087 3.393 3.393 0 0 0 3.389-3.39 3.393 3.393 0 0 0-3.39-3.388c-.573 0-1.112.145-1.585.399l2.01.83a2.5 2.5 0 0 1-1.612 4.265zm10.31-12.855a4.016 4.016 0 0 0-4.012-4.012 4.016 4.016 0 0 0-4.012 4.012 4.016 4.016 0 0 0 4.012 4.012 4.016 4.016 0 0 0 4.012-4.012zm-7.019 0a3.01 3.01 0 0 1 3.007-3.007 3.01 3.01 0 0 1 3.008 3.007 3.01 3.01 0 0 1-3.008 3.008 3.01 3.01 0 0 1-3.007-3.008z"/>
              </svg>
              Log in with Steam
            </button>
          </div>
        ) : (
          <div className={styles.gameArea}>
            <div className={styles.welcomeMessage}>
              <h2>Welcome, {user.name}!</h2>
              <p className={styles.comingSoon}>
                The prediction game is coming soon. Check back later!
              </p>
            </div>
          </div>
        )}
      </div>
    </PageShell>
  )
}
