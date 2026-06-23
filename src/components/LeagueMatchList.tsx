import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { DataTable } from './DataTable'
import { getHeroById } from '../data'
import { heroMiniUrl } from '../config'
import type { LeagueMatch } from '../types'
import styles from './LeagueMatchList.module.css'

function matchRating(m: LeagueMatch): number | null {
  const vals = [m.radiant_avg_rating, m.dire_avg_rating].filter(
    (v): v is number => typeof v === 'number'
  )
  if (vals.length === 0) return null
  return vals.reduce((a, b) => a + b, 0) / vals.length
}

function formatGameStart(ms: number): string {
  const date = new Date(ms)
  if (isNaN(date.getTime())) return '—'
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  })
}

function MatchLink({
  matchId,
  className,
  children,
}: {
  matchId: number
  className?: string
  children: React.ReactNode
}) {
  return (
    <Link
      to={`/matches/${matchId}`}
      className={`${styles.cellLink} ${className ?? ''}`}
    >
      {children}
    </Link>
  )
}

function HeroTeam({ heroes }: { heroes: number[] }) {
  return (
    <div className={styles.heroTeam}>
      {heroes.map((id, i) => {
        const hero = getHeroById(id)
        return hero ? (
          <img
            key={i}
            src={heroMiniUrl(hero.picture)}
            alt={hero.englishName}
            title={hero.englishName}
            className={styles.heroIcon}
            loading="lazy"
          />
        ) : (
          <span key={i} className={styles.heroIcon} title={`Hero ${id}`} />
        )
      })}
    </div>
  )
}

function RatingValue({ value }: { value?: number }) {
  if (typeof value !== 'number') {
    return <span className={styles.ratingMuted}>—</span>
  }
  return <span className={styles.ratingValue}>{Math.round(value)}</span>
}

interface LeagueMatchListProps {
  matches: LeagueMatch[]
  loading?: boolean
  showLeague?: boolean
}

const STEP = 50

export function LeagueMatchList({ matches, loading = false, showLeague = false }: LeagueMatchListProps) {
  const { sliderMin, sliderMax } = useMemo(() => {
    const ratings = matches.map(matchRating).filter((v): v is number => v !== null)
    if (ratings.length === 0) return { sliderMin: 0, sliderMax: 0 }
    const lo = Math.floor(Math.min(...ratings) / STEP) * STEP
    const hi = Math.ceil(Math.max(...ratings) / STEP) * STEP
    return { sliderMin: lo, sliderMax: hi }
  }, [matches])

  const [minRating, setMinRating] = useState(sliderMin)

  // Keep the threshold in range when the dataset changes.
  const clampedMin = Math.min(Math.max(minRating, sliderMin), sliderMax)
  const hasFilter = sliderMax > sliderMin

  const filtered = useMemo(() => {
    if (!hasFilter || clampedMin <= sliderMin) return matches
    return matches.filter(m => {
      const r = matchRating(m)
      return r !== null && r >= clampedMin
    })
  }, [matches, clampedMin, sliderMin, hasFilter])

  const columns = useMemo<ColumnDef<LeagueMatch, unknown>[]>(() => {
    const cols: ColumnDef<LeagueMatch, unknown>[] = [
      {
        accessorKey: 'game_start',
        header: 'Date',
        size: 170,
        cell: info => (
          <MatchLink matchId={info.row.original.match_id} className={styles.date}>
            {formatGameStart(info.getValue() as number)}
          </MatchLink>
        ),
      },
    ]

    if (showLeague) {
      cols.push({
        accessorKey: 'league_name',
        header: 'League',
        size: 200,
        cell: info => {
          const row = info.row.original
          return (
            <Link to={`/leagues/${row.league_id}`} className={styles.leagueLink}>
              {row.league_name}
            </Link>
          )
        },
      })
    }

    cols.push(
      {
        id: 'radiant',
        header: 'Radiant',
        size: 200,
        cell: info => (
          <MatchLink matchId={info.row.original.match_id}>
            <HeroTeam heroes={info.row.original.radiant_heroes} />
          </MatchLink>
        ),
      },
      {
        accessorKey: 'radiant_avg_rating',
        header: 'R. Rating',
        size: 90,
        cell: info => (
          <MatchLink matchId={info.row.original.match_id}>
            <RatingValue value={info.getValue() as number | undefined} />
          </MatchLink>
        ),
      },
      {
        id: 'dire',
        header: 'Dire',
        size: 200,
        cell: info => (
          <MatchLink matchId={info.row.original.match_id}>
            <HeroTeam heroes={info.row.original.dire_heroes} />
          </MatchLink>
        ),
      },
      {
        accessorKey: 'dire_avg_rating',
        header: 'D. Rating',
        size: 90,
        cell: info => (
          <MatchLink matchId={info.row.original.match_id}>
            <RatingValue value={info.getValue() as number | undefined} />
          </MatchLink>
        ),
      }
    )

    return cols
  }, [showLeague])

  return (
    <div className={styles.wrapper}>
      {hasFilter && (
        <div className={styles.filterBar}>
          <label className={styles.filterLabel} htmlFor="minRating">
            Min avg rating
          </label>
          <input
            id="minRating"
            type="range"
            min={sliderMin}
            max={sliderMax}
            step={STEP}
            value={clampedMin}
            onChange={e => setMinRating(Number(e.target.value))}
            className={styles.slider}
          />
          <span className={styles.filterValue}>{clampedMin}</span>
          {clampedMin > sliderMin && (
            <button className={styles.filterReset} onClick={() => setMinRating(sliderMin)}>
              Reset
            </button>
          )}
        </div>
      )}

      <DataTable
        data={filtered}
        columns={columns}
        searchPlaceholder={showLeague ? 'Search leagues...' : 'Search...'}
        searchableColumns={showLeague ? ['league_name'] : undefined}
        initialSorting={[{ id: 'game_start', desc: true }]}
        rowHeight={52}
        emptyMessage="No matches found"
        loading={loading}
      />
    </div>
  )
}
