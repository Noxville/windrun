import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { createColumnHelper } from '@tanstack/react-table'
import { PageShell } from '../components/PageShell'
import {
  DataTable,
  GradientCell,
  HeroInline,
  DeltaCell,
  PatchSelector,
  usePatchSelection,
} from '../components'
import { usePersistedQuery } from '../api'
import { getHeroById } from '../data'

// API response format for hero stats
interface HeroesApiResponse {
  data: {
    patches: { overall: string[] }
    heroStats: Record<string, Record<string, { wins: number; numGames: number; winrate: number }>>
  }
}

// Transformed row for table
interface HeroStatsRow {
  heroId: number
  heroName: string
  shortName: string
  picture: string
  games: number
  wins: number
  winRate: number
  pickRate: number
  prevWinRate: number | null
  prevPickRate: number | null
  winRateDelta: number | null
  pickRateDelta: number | null
}

export function HeroesPage() {
  const navigate = useNavigate()
  const { currentPatch, prevPatch } = usePatchSelection()

  // Fetch current patch data
  const { data: currentData, isLoading: currentLoading, error } = usePersistedQuery<HeroesApiResponse>(
    '/heroes',
    currentPatch ? { patch: currentPatch } : undefined,
    { enabled: !!currentPatch }
  )

  // Fetch previous patch data (only if we have a previous patch)
  const { data: prevData, isLoading: prevLoading } = usePersistedQuery<HeroesApiResponse>(
    '/heroes',
    prevPatch ? { patch: prevPatch } : undefined,
    { enabled: !!prevPatch }
  )

  const isLoading = currentLoading || (prevPatch && prevLoading)

  // Transform API response into array format
  const statsData = useMemo<HeroStatsRow[]>(() => {
    if (!currentData?.data?.heroStats || !currentPatch) return []

    const heroStats = currentData.data.heroStats
    const prevHeroStats = prevData?.data?.heroStats

    // Calculate total games for pick rate (current patch)
    let totalGames = 0
    Object.values(heroStats).forEach(patchData => {
      const stats = patchData[currentPatch]
      if (stats) totalGames += stats.numGames
    })
    const matchCount = totalGames / 10

    // Calculate total games for previous patch pick rate
    let prevTotalGames = 0
    if (prevHeroStats && prevPatch) {
      Object.values(prevHeroStats).forEach(patchData => {
        const stats = patchData[prevPatch]
        if (stats) prevTotalGames += stats.numGames
      })
    }
    const prevMatchCount = prevTotalGames / 10

    return Object.entries(heroStats).map(([heroId, patchData]) => {
      const stats = patchData[currentPatch]
      const hero = getHeroById(Number(heroId))

      const winRate = (stats?.winrate ?? 0) * 100
      const pickRate = matchCount > 0 ? ((stats?.numGames ?? 0) / matchCount) * 100 : 0

      // Previous patch stats
      let prevWinRate: number | null = null
      let prevPickRate: number | null = null

      if (prevHeroStats && prevPatch) {
        const prevStats = prevHeroStats[heroId]?.[prevPatch]
        if (prevStats) {
          prevWinRate = prevStats.winrate * 100
          prevPickRate = prevMatchCount > 0 ? (prevStats.numGames / prevMatchCount) * 100 : 0
        }
      }

      return {
        heroId: Number(heroId),
        heroName: hero?.englishName ?? `Hero #${heroId}`,
        shortName: hero?.shortName ?? '',
        picture: hero?.picture ?? '',
        games: stats?.numGames ?? 0,
        wins: stats?.wins ?? 0,
        winRate,
        pickRate,
        prevWinRate,
        prevPickRate,
        winRateDelta: prevWinRate !== null ? winRate - prevWinRate : null,
        pickRateDelta: prevPickRate !== null ? pickRate - prevPickRate : null,
      }
    }).filter(row => row.games > 0)
  }, [currentData, prevData, currentPatch, prevPatch])

  // Calculate total games (sum of all games divided by 10 since 10 heroes per game)
  const totalGames = useMemo(() => {
    const totalHeroGames = statsData.reduce((sum, row) => sum + row.games, 0)
    return Math.round(totalHeroGames / 10)
  }, [statsData])

  // Fixed thresholds for gradient coloring (43% to 57% for winrate)
  const { minWinRate, maxWinRate, minPickRate, maxPickRate } = useMemo(() => {
    if (statsData.length === 0) {
      return { minWinRate: 43, maxWinRate: 57, minPickRate: 0, maxPickRate: 20 }
    }
    const pickRates = statsData.map(r => r.pickRate)
    return {
      minWinRate: 43,  // Fixed threshold
      maxWinRate: 57,  // Fixed threshold
      minPickRate: Math.min(...pickRates),
      maxPickRate: Math.max(...pickRates),
    }
  }, [statsData])

  const columnHelper = createColumnHelper<HeroStatsRow>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns = useMemo<ColumnDef<HeroStatsRow, any>[]>(
    () => [
      columnHelper.accessor('heroName', {
        header: 'Hero',
        size: 200,
        cell: info => {
          const row = info.row.original
          return (
            <HeroInline
              id={row.heroId}
              name={row.heroName}
              picture={row.picture}
            />
          )
        },
      }),
      // Previous patch column group
      columnHelper.group({
        id: 'prevPatch',
        header: () => <span style={{ color: 'var(--color-text-muted)' }}>{prevPatch ?? 'Previous'}</span>,
        columns: [
          columnHelper.accessor('prevWinRate', {
            header: 'Win Rate',
            size: 90,
            cell: info => {
              const value = info.getValue()
              if (value === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              return (
                <GradientCell
                  value={value}
                  min={minWinRate}
                  max={maxWinRate}
                  decimals={1}
                  suffix="%"
                />
              )
            },
          }),
          columnHelper.accessor('prevPickRate', {
            header: 'Pick Rate',
            size: 90,
            cell: info => {
              const value = info.getValue()
              if (value === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              return (
                <GradientCell
                  value={value}
                  min={minPickRate}
                  max={maxPickRate}
                  decimals={1}
                  suffix="%"
                />
              )
            },
          }),
        ],
      }),
      // Current patch column group
      columnHelper.group({
        id: 'currentPatch',
        header: () => <span style={{ color: 'var(--color-accent)' }}>{currentPatch ?? 'Current'}</span>,
        columns: [
          columnHelper.accessor('winRate', {
            header: 'Win Rate',
            size: 90,
            meta: { hasBorderLeft: true },
            cell: info => (
              <GradientCell
                value={info.getValue()}
                min={minWinRate}
                max={maxWinRate}
                decimals={1}
                suffix="%"
              />
            ),
          }),
          columnHelper.accessor('winRateDelta', {
            header: 'ΔWR',
            size: 65,
            cell: info => {
              const delta = info.getValue()
              if (delta === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              return <DeltaCell value={delta} decimals={1} suffix="%" />
            },
          }),
          columnHelper.accessor('pickRate', {
            header: 'Pick Rate',
            size: 90,
            cell: info => (
              <GradientCell
                value={info.getValue()}
                min={minPickRate}
                max={maxPickRate}
                decimals={1}
                suffix="%"
              />
            ),
          }),
          columnHelper.accessor('pickRateDelta', {
            header: 'ΔPR',
            size: 65,
            cell: info => {
              const delta = info.getValue()
              if (delta === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              return <DeltaCell value={delta} decimals={1} suffix="%" />
            },
          }),
        ],
      }),
    ],
    [columnHelper, minWinRate, maxWinRate, minPickRate, maxPickRate, prevPatch, currentPatch]
  )

  const handleRowClick = (row: HeroStatsRow) => {
    navigate(`/heroes/${row.heroId}`)
  }

  if (error) {
    return (
      <PageShell title="Heroes">
        <p style={{ color: 'var(--color-negative)' }}>
          Error loading hero data. Please try again later.
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Heroes"
      subtitle={prevPatch ? `Comparing ${currentPatch} to ${prevPatch}` : currentPatch ?? 'Loading...'}
      actions={<PatchSelector />}
    >
      <DataTable
        data={statsData}
        columns={columns}
        searchPlaceholder="Search heroes..."
        searchableColumns={['heroName', 'shortName']}
        initialSorting={[{ id: 'winRate', desc: true }]}
        onRowClick={handleRowClick}
        emptyMessage="No heroes found"
        loading={!!isLoading}
        extraStats={{ value: totalGames, label: 'games' }}
      />
    </PageShell>
  )
}
