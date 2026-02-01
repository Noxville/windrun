import { PageShell } from '../components/PageShell'
import styles from './About.module.css'

export function AboutPage() {
  return (
    <PageShell title="About" contentIsScrollTarget={true}>
      <div className={styles.content}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>About Windrun</h2>
          <p className={styles.text}>
            Windrun is a statistics website dedicated to Dota 2's Ability Draft game mode.
            We track matches, analyze ability performance, and provide insights to help players
            improve their drafting decisions.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Ability Valuation</h2>
          <p className={styles.text}>
            The "Value" column on the Abilities page shows how early or late an ability is typically
            picked relative to its actual win rate performance.
          </p>
          <ul className={styles.list}>
            <li>
              <strong>Positive values (green)</strong>: The ability is picked later than its win rate
              suggests it should be. This could be an undervalued pick worth targeting.
            </li>
            <li>
              <strong>Negative values (red)</strong>: The ability is picked earlier than its win rate
              suggests it should be. Players may be overvaluing this ability.
            </li>
            <li>
              <strong>Values near zero</strong>: The ability is picked at approximately the "correct"
              position relative to its performance.
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Highest Priority</h2>
          <p className={styles.text}>
            In the Draft Replay on match pages, the "Highest Priority" section shows abilities
            that are most contended among all players in the draft.
          </p>
          <p className={styles.text}>
            This is calculated by counting how many players have each ability in their top 5
            synergy picks (based on ability pair win rates) or their top 5 overall picks
            (based on individual ability win rates). The abilities that appear most frequently
            across all players' shortlists are shown as high priority picks.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Expected Scepter / Shard</h2>
          <p className={styles.text}>
            In the Role Analysis table on match pages, "Expected Scepter" and "Expected Shard"
            columns show the cumulative likelihood that a player will purchase these items
            based on their drafted abilities.
          </p>
          <ul className={styles.list}>
            <li>
              <strong>Expected Scepter (Σ Scep)</strong>: The sum of Aghanim's Scepter pickup rates
              for each ability in the player's draft that has a Scepter upgrade available.
              For example, if a player has two abilities with 30% and 25% scepter pickup rates,
              their expected scepter value is 55%.
            </li>
            <li>
              <strong>Expected Shard (Σ Shard)</strong>: The sum of Aghanim's Shard pickup rates
              for each ability in the player's draft that has a Shard upgrade available.
            </li>
          </ul>
          <p className={styles.text}>
            Only abilities that have a Scepter or Shard upgrade are included in these calculations.
            Higher values suggest the player may want to prioritize purchasing these items.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Data Sources</h2>
          <p className={styles.text}>
            Match data is collected from the Steam Web API, replays are downloaded and parsed to extract ability
              draft specific statistics. We analyze pick order, win rates, ability combinations, and player
            performance across different skill brackets.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>API Usage</h2>
          <p className={styles.text}>
            The API is primarily designed to power this frontend. If you'd like to use it for a project,
            please chat to Noxville on Discord and get approval first. It would be greatly appreciated if you
            also used a custom user-agent to identify your application.
          </p>
          <p className={styles.text}>In general:</p>
          <ul className={styles.list}>
            <li>Try and cache results where you can</li>
            <li>Do not make too many concurrent requests - also leave a gap between consecutive requests</li>
            <li>
              Do not to programmatically request "slow" queries:{' '}
              <code className={styles.code}>/abilities/$abilityId</code>,{' '}
              <code className={styles.code}>/heroes/$heroId</code>,{' '}
              <code className={styles.code}>/players/$playerId/matches</code>,{' '}
              <code className={styles.code}>/players/$playerId/stats</code>
            </li>
          </ul>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>Contact</h2>
          <p className={styles.text}>
            For questions, feedback, or bug reports, please reach out via the community channels.
          </p>
        </section>
      </div>
    </PageShell>
  )
}
