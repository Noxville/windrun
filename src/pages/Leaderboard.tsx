import { useMemo } from 'react'
import { useSearchParams, useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { PageShell } from '../components/PageShell'
import { DataTable, NumericCell, GradientCell } from '../components'
import { usePersistedQuery } from '../api'
import styles from './Leaderboard.module.css'

const REGIONS = [
  { id: 'global', label: 'Global' },
  { id: 'europe', label: 'Europe' },
  { id: 'sea', label: 'SEA' },
  { id: 'china', label: 'China' },
  { id: 'americas', label: 'Americas' },
]

interface LeaderboardApiResponse {
  data: Array<{
    steamId: number
    rating: number
    winLoss: {
      wins: number
      losses: number
      total: number
      winrate: number
    }
    overallRank: number
    regionalRank: number
    nickname: string
    region: string
    avatar?: string
    lastMatch?: string
  }>
}

interface LeaderboardRow {
  rank: number
  globalRank: number
  region: string
  playerId: number
  playerName: string
  profilePicture?: string
  matches: number
  wins: number
  winRate: number
  rating?: number
}

// Map API region codes to display labels
const REGION_LABELS: Record<string, string> = {
  europe: 'EU',
  sea: 'SEA',
  china: 'CN',
  americas: 'NA',
}


export function LeaderboardPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const navigate = useNavigate()
  const currentRegion = searchParams.get('region') || 'global'
  const isRegionalView = currentRegion !== 'global'

  const { data: apiResponse, isLoading, error } = usePersistedQuery<LeaderboardApiResponse>(
    `/leaderboard/${currentRegion}`
  )

  const handleRegionChange = (region: string) => {
    setSearchParams({ region })
  }

  const statsData = useMemo<LeaderboardRow[]>(() => {
    if (!apiResponse?.data || !Array.isArray(apiResponse.data)) return []
    return apiResponse.data.map(player => ({
      rank: isRegionalView ? player.regionalRank : player.overallRank,
      globalRank: player.overallRank,
      region: player.region,
      playerId: player.steamId,
      playerName: player.nickname,
      profilePicture: player.avatar,
      matches: player.winLoss.total,
      wins: player.winLoss.wins,
      winRate: player.winLoss.winrate * 100,
      rating: player.rating,
    }))
  }, [apiResponse, isRegionalView])

  const columns = useMemo<ColumnDef<LeaderboardRow>[]>(() => {
    const cols: ColumnDef<LeaderboardRow>[] = [
      {
        accessorKey: 'rank',
        header: 'Rank',
        size: 60,
        cell: info => {
          const rank = info.getValue() as number
          return (
            <span className={rank <= 3 ? styles.topRank : styles.rank}>
              {rank}
            </span>
          )
        },
      },
    ]

    // Add global rank column when viewing regional leaderboard
    if (isRegionalView) {
      cols.push({
        accessorKey: 'globalRank',
        header: 'Global',
        size: 70,
        cell: info => {
          const rank = info.getValue() as number
          return <span className={styles.globalRank}>{rank}</span>
        },
      })
    }

    // Add region column when viewing global leaderboard
    if (!isRegionalView) {
      cols.push({
        accessorKey: 'region',
        header: 'Region',
        size: 70,
        cell: info => {
          const region = info.getValue() as string
          return <span className={styles.regionTag}>{REGION_LABELS[region] || region}</span>
        },
      })
    }

    cols.push(
      {
        accessorKey: 'playerName',
        header: 'Player',
        size: 220,
        cell: info => {
          const row = info.row.original
          return (
            <div className={styles.playerCell}>
              {row.profilePicture && (
                <img
                  src={row.profilePicture}
                  alt=""
                  className={styles.avatar}
                  loading="lazy"
                />
              )}
              <span className={styles.playerName}>{row.playerName}</span>
            </div>
          )
        },
      },
      {
        accessorKey: 'winRate',
        header: 'Win Rate',
        size: 100,
        cell: info => (
          <GradientCell
            value={info.getValue() as number}
            min={45}
            max={65}
            decimals={1}
            suffix="%"
          />
        ),
      },
      {
        accessorKey: 'matches',
        header: 'Matches',
        size: 90,
        cell: info => <NumericCell value={info.getValue() as number} decimals={0} />,
      },
      {
        accessorKey: 'wins',
        header: 'Wins',
        size: 80,
        cell: info => <NumericCell value={info.getValue() as number} decimals={0} />,
      },
      {
        accessorKey: 'rating',
        header: 'Rating',
        size: 90,
        cell: info => {
          const rating = info.getValue() as number | undefined
          if (rating === undefined) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
          return <NumericCell value={rating} decimals={0} />
        },
      },
      {
        id: 'links',
        header: 'Links',
        size: 80,
        cell: info => {
          const row = info.row.original
          return (
            <div className={styles.linksCell}>
              <a
                href={`https://www.dotabuff.com/players/${row.playerId}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.externalLink}
                onClick={e => e.stopPropagation()}
                title="Dotabuff"
              >
                <img
                  src="https://www.dotabuff.com/favicon.ico"
                  alt="Dotabuff"
                  className={styles.externalIcon}
                />
              </a>
              <a
                href={`https://www.opendota.com/players/${row.playerId}`}
                target="_blank"
                rel="noopener noreferrer"
                className={styles.externalLink}
                onClick={e => e.stopPropagation()}
                title="OpenDota"
              >
                <img
                  src="/opendota-icon.png"
                  alt="OpenDota"
                  className={styles.externalIcon}
                />
              </a>
            </div>
          )
        },
      }
    )

    return cols
  }, [isRegionalView])

  const handleRowClick = (row: LeaderboardRow) => {
    navigate(`/players/${row.playerId}`)
  }

  if (error) {
    return (
      <PageShell title="Leaderboard">
        <p style={{ color: 'var(--color-negative)' }}>
          Error loading leaderboard data. Please try again later.
        </p>
      </PageShell>
    )
  }

  const regionLabel = REGIONS.find(r => r.id === currentRegion)?.label || 'Global'

  return (
    <PageShell
      title="Leaderboard"
      subtitle={`Top Ability Draft players - ${regionLabel}`}
      actions={
        <div className={styles.regionSelector}>
          {REGIONS.map(region => (
            <button
              key={region.id}
              className={`${styles.regionButton} ${currentRegion === region.id ? styles.regionButtonActive : ''}`}
              onClick={() => handleRegionChange(region.id)}
            >
              {region.label}
            </button>
          ))}
        </div>
      }
    >
      <DataTable
        data={statsData}
        columns={columns}
        searchPlaceholder="Search players..."
        searchableColumns={['playerName']}
        initialSorting={[{ id: 'rank', desc: false }]}
        onRowClick={handleRowClick}
        emptyMessage="No players found"
        loading={isLoading}
      />
    </PageShell>
  )
}
