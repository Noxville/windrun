import { useState, useEffect } from 'react'
import { useLocation } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { RATING_TAGS, EFFECT_LABEL } from '../utils/ratingTags'
import styles from './About.module.css'

// Opponent-calibration distribution across all ranked accounts (30 contiguous bands)
const CALIBRATION_HISTOGRAM = [
  { sat: 0.017, accounts: 0 }, { sat: 0.050, accounts: 0 },
  { sat: 0.083, accounts: 5 }, { sat: 0.117, accounts: 0 },
  { sat: 0.150, accounts: 5 }, { sat: 0.183, accounts: 36 },
  { sat: 0.217, accounts: 9 }, { sat: 0.250, accounts: 42 },
  { sat: 0.283, accounts: 153 }, { sat: 0.317, accounts: 465 },
  { sat: 0.350, accounts: 769 }, { sat: 0.383, accounts: 3214 },
  { sat: 0.417, accounts: 2503 }, { sat: 0.450, accounts: 1518 },
  { sat: 0.483, accounts: 1617 }, { sat: 0.517, accounts: 2185 },
  { sat: 0.550, accounts: 2986 }, { sat: 0.583, accounts: 4510 },
  { sat: 0.617, accounts: 7117 }, { sat: 0.650, accounts: 11006 },
  { sat: 0.683, accounts: 16132 }, { sat: 0.717, accounts: 24388 },
  { sat: 0.750, accounts: 35524 }, { sat: 0.783, accounts: 45921 },
  { sat: 0.817, accounts: 47862 }, { sat: 0.850, accounts: 36358 },
  { sat: 0.883, accounts: 21995 }, { sat: 0.917, accounts: 10551 },
  { sat: 0.950, accounts: 3089 }, { sat: 0.983, accounts: 153 },
]

// Teammate minus opponent calibration (34 bands, incl. under/overflow)
const DELTA_HISTOGRAM = [
  { delta: -0.413, accounts: 34 }, { delta: -0.388, accounts: 18 }, { delta: -0.363, accounts: 29 },
  { delta: -0.338, accounts: 67 }, { delta: -0.313, accounts: 80 }, { delta: -0.288, accounts: 181 },
  { delta: -0.263, accounts: 258 }, { delta: -0.238, accounts: 416 }, { delta: -0.213, accounts: 622 },
  { delta: -0.188, accounts: 1006 }, { delta: -0.163, accounts: 1460 }, { delta: -0.138, accounts: 2328 },
  { delta: -0.113, accounts: 3655 }, { delta: -0.088, accounts: 5767 }, { delta: -0.063, accounts: 10517 },
  { delta: -0.038, accounts: 27009 }, { delta: -0.013, accounts: 90411 }, { delta: 0.013, accounts: 69910 },
  { delta: 0.038, accounts: 26140 }, { delta: 0.063, accounts: 14990 }, { delta: 0.088, accounts: 9642 },
  { delta: 0.113, accounts: 6132 }, { delta: 0.138, accounts: 3861 }, { delta: 0.163, accounts: 2206 },
  { delta: 0.188, accounts: 1296 }, { delta: 0.213, accounts: 742 }, { delta: 0.238, accounts: 407 },
  { delta: 0.263, accounts: 227 }, { delta: 0.288, accounts: 126 }, { delta: 0.313, accounts: 74 },
  { delta: 0.338, accounts: 32 }, { delta: 0.363, accounts: 21 }, { delta: 0.388, accounts: 10 },
  { delta: 0.413, accounts: 6 },
]

function niceTicks(max: number, count = 4): number[] {
  const raw = (max || 1) / count
  const mag = Math.pow(10, Math.floor(Math.log10(raw)))
  const norm = raw / mag
  const step = (norm <= 1 ? 1 : norm <= 2 ? 2 : norm <= 5 ? 5 : 10) * mag
  const ticks: number[] = []
  // Always run past the max so the top tick bounds the tallest mark
  for (let t = 0; ; t += step) {
    ticks.push(Number(t.toFixed(6)))
    if (t >= max) break
  }
  return ticks
}

function barPath(x: number, y: number, w: number, h: number, r = 4): string {
  const rr = Math.max(0, Math.min(r, w / 2, h))
  return `M ${x} ${y + h} L ${x} ${y + rr} Q ${x} ${y} ${x + rr} ${y}` +
    ` L ${x + w - rr} ${y} Q ${x + w} ${y} ${x + w} ${y + rr} L ${x + w} ${y + h} Z`
}

function ChartTooltip({ x, y, children }: { x: number; y: number; children: React.ReactNode }) {
  return (
    <div className={styles.chartTooltip} style={{ left: `${Math.min(92, Math.max(8, x))}%`, top: `${y}%` }}>
      {children}
    </div>
  )
}

function CalibrationChart() {
  const [hover, setHover] = useState<number | null>(null)

  const total = CALIBRATION_HISTOGRAM.reduce((s, x) => s + x.accounts, 0)
  const bands = CALIBRATION_HISTOGRAM.filter(x => x.sat >= 0.25)
  const pct = bands.map(x => (100 * x.accounts) / total)

  const W = 1000
  const H = 300
  const m = { t: 16, r: 20, b: 46, l: 58 }
  const iw = W - m.l - m.r
  const ih = H - m.t - m.b

  const ticks = niceTicks(Math.max(...pct))
  const yMax = ticks[ticks.length - 1]

  const bw = iw / bands.length
  const barW = Math.min(24, bw - 2)
  const lo = bands[0].sat
  const satStep = (bands[bands.length - 1].sat - lo) / (bands.length - 1)
  const xMid = (i: number) => m.l + i * bw + bw / 2
  const xOf = (sat: number) => m.l + ((sat - lo) / satStep + 0.5) * bw

  return (
    <div className={styles.chartWrap}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img"
        aria-label="Opponent calibration distribution across ranked accounts">
        {ticks.map(t => {
          const y = m.t + ih - (t / yMax) * ih
          return (
            <g key={`y${t}`}>
              <line className={styles.gridline} x1={m.l} y1={y} x2={m.l + iw} y2={y} />
              <text className={styles.axis} x={m.l - 8} y={y + 3} textAnchor="end">{t}%</text>
            </g>
          )
        })}
        <text className={styles.chartPanelTitle} x={m.l} y={m.t - 2}>% of players</text>

        {bands.map((b, i) => {
          const h = (pct[i] / yMax) * ih
          return (
            <path key={`b${b.sat}`} d={barPath(xMid(i) - barW / 2, m.t + ih - h, barW, h)}
              className={hover === null || hover === i ? styles.markPrimary : styles.markPrimaryDim} />
          )
        })}

        <line className={styles.axisline} x1={m.l} y1={m.t + ih} x2={m.l + iw} y2={m.t + ih} />
        {[0.25, 0.5, 0.75, 1].map(v => (
          <text key={`x${v}`} className={styles.axis} x={xOf(v)} y={m.t + ih + 16} textAnchor="middle">
            {v.toFixed(2)}
          </text>
        ))}
        <text className={styles.axisTitle} x={m.l + iw / 2} y={H - 8} textAnchor="middle">
          opponent calibration
        </text>

        {bands.map((b, i) => (
          <rect key={`h${b.sat}`} x={m.l + i * bw} y={m.t} width={bw} height={ih}
            fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
      </svg>
      {hover !== null && (
        <ChartTooltip x={(xMid(hover) / W) * 100} y={(m.t / H) * 100}>
          <div className={styles.tooltipTitle}>calibration {bands[hover].sat.toFixed(2)}</div>
          <div>{pct[hover].toFixed(2)}% of players</div>
          <div className={styles.tooltipMuted}>{bands[hover].accounts.toLocaleString()} accounts</div>
        </ChartTooltip>
      )}
    </div>
  )
}

function DeltaChart() {
  const [hover, setHover] = useState<number | null>(null)

  const total = DELTA_HISTOGRAM.reduce((s, x) => s + x.accounts, 0)
  const pct = DELTA_HISTOGRAM.map(x => (100 * x.accounts) / total)

  const W = 1000
  const H = 300
  const m = { t: 16, r: 20, b: 46, l: 58 }
  const iw = W - m.l - m.r
  const ih = H - m.t - m.b

  const ticks = niceTicks(Math.max(...pct))
  const yMax = ticks[ticks.length - 1]

  const bw = iw / DELTA_HISTOGRAM.length
  const barW = Math.min(24, bw - 2)
  const lo = DELTA_HISTOGRAM[0].delta
  const deltaStep = (DELTA_HISTOGRAM[DELTA_HISTOGRAM.length - 1].delta - lo) / (DELTA_HISTOGRAM.length - 1)
  const xMid = (i: number) => m.l + i * bw + bw / 2
  const xOf = (d: number) => m.l + ((d - lo) / deltaStep + 0.5) * bw

  const bandClass = (delta: number) => {
    if (delta <= -0.06) return styles.markPrimary
    if (delta >= 0.06) return styles.markWarning
    return styles.markNeutral
  }
  const bandLabel = (delta: number) => {
    if (delta <= -0.06) return 'opponents more calibrated'
    if (delta >= 0.06) return 'teammates more calibrated'
    return 'symmetric'
  }

  return (
    <div className={styles.chartWrap}>
      <svg viewBox={`0 0 ${W} ${H}`} className={styles.chart} role="img"
        aria-label="Distribution of the gap between teammate calibration and opponent calibration">
        {ticks.map(t => {
          const y = m.t + ih - (t / yMax) * ih
          return (
            <g key={`y${t}`}>
              <line className={styles.gridline} x1={m.l} y1={y} x2={m.l + iw} y2={y} />
              <text className={styles.axis} x={m.l - 8} y={y + 3} textAnchor="end">{t}%</text>
            </g>
          )
        })}
        <text className={styles.chartPanelTitle} x={m.l} y={m.t - 2}>% of players</text>

        {DELTA_HISTOGRAM.map((d, i) => {
          const h = (pct[i] / yMax) * ih
          return (
            <path key={`d${d.delta}`} d={barPath(xMid(i) - barW / 2, m.t + ih - h, barW, h)}
              className={`${bandClass(d.delta)} ${hover !== null && hover !== i ? styles.markFaded : ''}`} />
          )
        })}

        <line className={styles.zeroLine} x1={xOf(0)} y1={m.t} x2={xOf(0)} y2={m.t + ih} />
        <line className={styles.axisline} x1={m.l} y1={m.t + ih} x2={m.l + iw} y2={m.t + ih} />
        {[-0.2, -0.1, 0, 0.1, 0.2].map(v => (
          <text key={`x${v}`} className={styles.axis} x={xOf(v)} y={m.t + ih + 16} textAnchor="middle">
            {v > 0 ? `+${v}` : v}
          </text>
        ))}
        <text className={styles.axisTitle} x={m.l + iw / 2} y={H - 8} textAnchor="middle">
          teammate calibration − opponent calibration
        </text>

        {DELTA_HISTOGRAM.map((d, i) => (
          <rect key={`h${d.delta}`} x={m.l + i * bw} y={m.t} width={bw} height={ih}
            fill="transparent" onMouseEnter={() => setHover(i)} onMouseLeave={() => setHover(null)} />
        ))}
      </svg>
      {hover !== null && (
        <ChartTooltip x={(xMid(hover) / W) * 100} y={(m.t / H) * 100}>
          <div className={styles.tooltipTitle}>
            {DELTA_HISTOGRAM[hover].delta > 0 ? '+' : ''}{DELTA_HISTOGRAM[hover].delta.toFixed(3)}
          </div>
          <div>{pct[hover].toFixed(2)}% of players</div>
          <div className={styles.tooltipMuted}>{bandLabel(DELTA_HISTOGRAM[hover].delta)}</div>
          <div className={styles.tooltipMuted}>{DELTA_HISTOGRAM[hover].accounts.toLocaleString()} accounts</div>
        </ChartTooltip>
      )}
      <div className={styles.legend}>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchPrimary}`} />Opponents more calibrated (playing up)
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchNeutral}`} />Symmetric (honest)
        </span>
        <span className={styles.legendItem}>
          <span className={`${styles.swatch} ${styles.swatchWarning}`} />Teammates more calibrated (stacking)
        </span>
      </div>
    </div>
  )
}

export function AboutPage() {
  const { hash } = useLocation()

  useEffect(() => {
    if (!hash) return
    document.getElementById(hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }, [hash])

  return (
    <PageShell title="About">
      <div className={styles.content}>
        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>About Windrun</h2>
          <p className={styles.text}>
            Windrun is a statistics website dedicated to Dota 2's Ability Draft game mode.
            We track matches, analyze ability performance, and provide insights to help players
            improve their drafting decisions.
          </p>
        </section>

        <section className={styles.section} id="windrun-rating">
          <h2 className={styles.sectionTitle}>Windrun Rating</h2>
          <p className={styles.text}>
            Every ranked account carries three numbers. They are all shown on your profile.
          </p>
          <dl className={styles.terms}>
            <dt className={styles.term}>Raw Rating</dt>
            <dd className={styles.termBody}>
              Pure TrueSkill, computed only from who you beat and who beat you. This is the
              original rating calculation, unchanged, and it still updates every few hours.
            </dd>
            <dt className={styles.term}>Penalty</dt>
            <dd className={styles.termBody}>
              A percentage reduction applied to your raw rating, driven by the tags on your
              account. Most accounts have no penalty at all. Penalties combine into a single
              percentage, and they only ever affect your ladder rating, never the raw rating,
              and never the rating of anyone you played against.
            </dd>
            <dt className={styles.term}>Rating</dt>
            <dd className={styles.termBody}>
              Your raw rating with the penalty taken off: <code className={styles.code}>rating
              = raw rating × (1 − penalty)</code>. This is what the leaderboard sorts on and
              what your rank and percentile are drawn from.
            </dd>
          </dl>
          <p className={styles.note}>
            Account-based metrics recompute weekly, and move slowly for accounts with a long
            history. Your raw TrueSkill rating still updates every few hours.
          </p>
        </section>

        <section className={styles.section}>
          <h2 className={styles.sectionTitle}>What We Measure</h2>
          <p className={styles.text}>
            The key metric is <strong>opponent calibration</strong>: roughly "what fraction of
            the opponents I face are experienced?", smoothed over a range of game counts and
            capped so that anyone past the threshold counts as fully calibrated (1.0). Here's
            how it is distributed across the ranked population.
          </p>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Opponent calibration across all ranked accounts</div>
            <CalibrationChart />
          </div>
          <p className={styles.text}>
            Honest players, at every rating, tend to face opponents and teammates who are{' '}
            <em>symmetrically</em> calibrated. Abuse shows up as an <strong>asymmetry</strong>:
            the gap between how calibrated your teammates are and how calibrated your opponents
            are. The bulk of the ladder sits in the neutral middle.
          </p>
          <div className={styles.card}>
            <div className={styles.cardTitle}>Teammate − opponent calibration difference</div>
            <DeltaChart />
          </div>
        </section>

        <section className={styles.section} id="account-tags">
          <h2 className={styles.sectionTitle}>Account Tags</h2>
          <p className={styles.text}>
            Tags describe a pattern we detected on an account. Only some of them carry a rating
            penalty; the rest are shown purely for visibility.
          </p>
          <ul className={styles.list}>
            {Object.entries(RATING_TAGS).map(([key, info]) => (
              <li key={key}>
                <strong>{info.label}</strong> <span className={`${styles.pill} ${info.effect === 'tag-only' ? styles.pillNeutral : styles.pillPenalised}`}>{EFFECT_LABEL[info.effect]}</span>
                {': '}{info.description}
              </li>
            ))}
          </ul>
          <p className={styles.text}>
            Bots are the one hard exclusion: 35.8k accounts are flagged and 375k matches blocked,
            and none of them feed into any rating update.
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
