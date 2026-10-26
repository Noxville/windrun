import { useMemo, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import styles from './Abilities.module.css'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { createColumnHelper } from '@tanstack/react-table'
import { PageShell } from '../components/PageShell'
import {
  DataTable,
  GradientCell,
  DeltaCell,
  AbilityInline,
  HeroInline,
  PatchSelector,
  usePatchSelection,
  useDataTableDisplayIndex,
  ColHeader,
} from '../components'
import { usePersistedQuery } from '../api'
import { heroMiniUrl } from '../config'
import { getAbilityById, getHeroById } from '../data'
import { useAbilityValues, hasRank } from '../utils/abilityValue'
import { useWidePage } from '../utils/useWidePage'

// API response format
interface AbilitiesApiResponse {
  data: {
    patches: { overall: string[] }
    abilityStats: Array<{
      abilityId: number
      numPicks: number
      avgPickPosition: number
      pickPosStdDev: number
      wins: number
      ignored: number
      ownerHero?: number
      winrate: number
      pickRate: number
    }>
  }
}

// Transformed row for table
interface AbilityStatsRow {
  abilityId: number
  abilityName: string
  shortName: string
  isUltimate: boolean
  isHeroAbility: boolean  // true if abilityId < 0 (hero ability decision)
  heroId?: number         // hero ID for hero abilities
  heroPicture?: string    // hero picture for hero abilities
  ownerHeroId?: number
  ownerHeroName?: string  // for search
  picks: number
  wins: number
  winRate: number
  pickRate: number
  avgPickPos: number
  prevAvgPickPos: number | null
  prevWinRate: number | null
  avgPickPosDelta: number | null
  winRateDelta: number | null
  strength: number | null     // win rate points the ability contributes
  mispricing: number | null   // draftRank - strengthRank, in places; null when the server left it unranked
  strengthRank: number | null
  draftRank: number | null
}

function SignedCell({ value, decimals }: { value: number; decimals: number }) {
  const cls = value > 0 ? styles.signedUp : value < 0 ? styles.signedDown : ''
  return (
    <span className={`${styles.signed} ${cls}`}>
      {value > 0 ? '+' : ''}{value.toFixed(decimals)}
    </span>
  )
}

function RankCell() {
  const displayIndex = useDataTableDisplayIndex()
  const rank = displayIndex !== null ? displayIndex + 1 : 0
  return (
    <span style={{ fontSize: 'var(--text-caption)', color: 'var(--color-text-muted)', fontVariantNumeric: 'tabular-nums' }}>
      #{rank}
    </span>
  )
}

const DEFAULT_SORTING: SortingState = [{ id: 'strength', desc: true }]

export function AbilitiesPage() {
  useWidePage()
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING)
  const { currentPatch, prevPatch } = usePatchSelection()

  // Filter toggles from URL
  const hideUltimates = searchParams.get('hideUltimates') === 'true'
  const hideHeroes = searchParams.get('hideHeroes') === 'true'
  const hideAbilities = searchParams.get('hideAbilities') === 'true'

  const toggleFilter = (param: string, currentValue: boolean) => {
    const newParams = new URLSearchParams(searchParams)
    if (currentValue) {
      newParams.delete(param)
    } else {
      newParams.set(param, 'true')
    }
    setSearchParams(newParams)
  }
  const { data: apiResponse, isLoading: currentLoading, error } = usePersistedQuery<AbilitiesApiResponse>(
    '/abilities',
    currentPatch ? { patch: currentPatch } : undefined,
    { enabled: !!currentPatch }
  )

  const { data: prevApiResponse, isLoading: prevLoading } = usePersistedQuery<AbilitiesApiResponse>(
    '/abilities',
    prevPatch ? { patch: prevPatch } : undefined,
    { enabled: !!prevPatch }
  )

  const {
    values: abilityValues,
    total: valuesTotal,
    isLoading: valuesLoading,
    unavailable: valuesUnavailable,
  } = useAbilityValues(currentPatch)

  const isLoading = currentLoading || (prevPatch && prevLoading) || valuesLoading

  // Build lookup for previous patch stats by abilityId
  const prevStatsMap = useMemo(() => {
    if (!prevApiResponse?.data?.abilityStats) return null
    const map = new Map<number, { winrate: number; avgPickPosition: number }>()
    for (const stat of prevApiResponse.data.abilityStats) {
      map.set(stat.abilityId, { winrate: stat.winrate, avgPickPosition: stat.avgPickPosition })
    }
    return map
  }, [prevApiResponse])

  // Transform API response into array format
  const statsData = useMemo<AbilityStatsRow[]>(() => {
    if (!apiResponse?.data?.abilityStats) return []

    return apiResponse.data.abilityStats
      .map(stat => {
        const isHeroAbility = stat.abilityId < 0
        const heroIdFromAbility = isHeroAbility ? Math.abs(stat.abilityId) : undefined
        const hero = heroIdFromAbility ? getHeroById(heroIdFromAbility) : undefined
        const ability = !isHeroAbility ? getAbilityById(stat.abilityId) : undefined

        // For hero abilities (-X), use hero X as owner
        const ownerHeroId = isHeroAbility ? heroIdFromAbility : stat.ownerHero
        const ownerHeroData = ownerHeroId ? getHeroById(ownerHeroId) : undefined

        const abilityValue = abilityValues?.get(stat.abilityId) ?? null
        const ranked = abilityValue !== null && hasRank(abilityValue)

        // Previous patch stats
        const prev = prevStatsMap?.get(stat.abilityId)
        const winRate = stat.winrate * 100
        const avgPickPos = stat.avgPickPosition
        const prevWinRate = prev ? prev.winrate * 100 : null
        const prevAvgPickPos = prev ? prev.avgPickPosition : null

        return {
          abilityId: stat.abilityId,
          abilityName: isHeroAbility
            ? (hero?.englishName ?? `Hero #${heroIdFromAbility}`)
            : (ability?.englishName ?? `Ability #${stat.abilityId}`),
          shortName: ability?.shortName ?? '',
          isUltimate: ability?.isUltimate ?? false,
          isHeroAbility,
          heroId: heroIdFromAbility,
          heroPicture: hero?.picture,
          ownerHeroId,
          ownerHeroName: ownerHeroData?.englishName ?? '',
          picks: stat.numPicks,
          wins: stat.wins,
          winRate,
          pickRate: stat.pickRate * 100,
          avgPickPos,
          prevAvgPickPos,
          prevWinRate,
          avgPickPosDelta: prevAvgPickPos !== null ? avgPickPos - prevAvgPickPos : null,
          winRateDelta: prevWinRate !== null ? winRate - prevWinRate : null,
          strength: abilityValue?.strength ?? null,
          mispricing: ranked ? abilityValue.mispricing : null,
          strengthRank: ranked ? abilityValue.strengthRank : null,
          draftRank: abilityValue?.draftRank ?? null,
        }
      })
      .filter(row => row.picks > 0 && row.abilityName && !row.abilityName.startsWith('special_bonus'))
  }, [apiResponse, prevStatsMap, abilityValues])

  // Calculate total games (sum of picks for non-hero abilities divided by 40)
  const totalGames = useMemo(() => {
    if (!apiResponse?.data?.abilityStats) return 0
    // Sum picks for positive ability IDs only
    const totalPicks = apiResponse.data.abilityStats
      .filter(stat => stat.abilityId > 0)
      .reduce((sum, stat) => sum + stat.numPicks, 0)
    // Each game has 40 ability picks (8 picks per player * 5 players per team, * 2 teams is 80, but each ability picked once so 40)
    return Math.round(totalPicks / 40)
  }, [apiResponse])

  // Fixed thresholds for gradient coloring
  const { minWinRate, maxWinRate, minPickRate, maxPickRate, minPickPos, maxPickPos } = useMemo(() => {
    if (statsData.length === 0) {
      return { minWinRate: 43, maxWinRate: 57, minPickRate: 0, maxPickRate: 100, minPickPos: 1, maxPickPos: 40 }
    }
    const pickRates = statsData.map(r => r.pickRate)
    return {
      minWinRate: 43,  // Fixed threshold
      maxWinRate: 57,  // Fixed threshold
      minPickRate: Math.min(...pickRates),
      maxPickRate: Math.max(...pickRates),
      minPickPos: 1,   // Fixed - earlier is better
      maxPickPos: 40,  // Fixed - max pick position
    }
  }, [statsData])

  const columnHelper = createColumnHelper<AbilityStatsRow>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns = useMemo<ColumnDef<AbilityStatsRow, any>[]>(
    () => [
      {
        id: 'rank',
        header: '#',
        size: 54,
        enableSorting: false,
        cell: () => <RankCell />,
      },
      {
        accessorKey: 'abilityName',
        header: 'Ability',
        size: 240,
        cell: info => {
          const row = info.row.original
          if (row.isHeroAbility && row.heroId && row.heroPicture) {
            return (
              <HeroInline
                id={row.heroId}
                name={row.abilityName}
                picture={row.heroPicture}
              />
            )
          }
          return (
            <AbilityInline
              id={row.abilityId}
              name={row.abilityName}
              shortName={row.shortName}
              isUltimate={row.isUltimate}
            />
          )
        },
      },
      {
        accessorKey: 'ownerHeroId',
        header: 'Hero',
        size: 60,
        cell: info => {
          const heroId = info.getValue() as number | undefined
          if (!heroId) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
          const hero = getHeroById(heroId)
          if (!hero) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
          return (
            <img
              src={heroMiniUrl(hero.picture)}
              alt={hero.englishName}
              style={{
                width: '28px',
                height: '28px',
                objectFit: 'cover',
                objectPosition: 'center',
                borderRadius: 'var(--radius-sm)',
                border: '1px solid var(--color-border)',
              }}
              loading="lazy"
            />
          )
        },
      },
      // Previous patch group
      columnHelper.group({
        id: 'prevPatch',
        header: () => <span style={{ color: 'var(--color-text-muted)' }}>{prevPatch ?? 'Previous'}</span>,
        columns: [
          columnHelper.accessor('prevWinRate', {
            header: () => <ColHeader label="Win Rate" />,
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
          columnHelper.accessor('prevAvgPickPos', {
            header: () => <ColHeader label="Avg Pick" />,
            size: 90,
            cell: info => {
              const value = info.getValue()
              if (value === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              return (
                <GradientCell
                  value={value}
                  min={minPickPos}
                  max={maxPickPos}
                  decimals={1}
                  suffix=""
                  invert={true}
                />
              )
            },
          }),
        ],
      }),
      // Current patch group
      columnHelper.group({
        id: 'currentPatch',
        header: () => <span style={{ color: 'var(--color-accent)' }}>{currentPatch ?? 'Current'}</span>,
        columns: [
          columnHelper.accessor('winRate', {
            header: () => <ColHeader label="Win Rate" />,
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
            header: () => <ColHeader label="ΔWR" />,
            size: 55,
            cell: info => {
              const delta = info.getValue()
              if (delta === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              return <DeltaCell value={delta} decimals={1} suffix="%" />
            },
          }),
          columnHelper.accessor('avgPickPos', {
            header: () => <ColHeader label="Avg Pick" />,
            size: 90,
            cell: info => (
              <GradientCell
                value={info.getValue()}
                min={minPickPos}
                max={maxPickPos}
                decimals={1}
                suffix=""
                invert={true}
              />
            ),
          }),
          columnHelper.accessor('avgPickPosDelta', {
            header: () => <ColHeader label="ΔPick" />,
            size: 65,
            cell: info => {
              const delta = info.getValue()
              if (delta === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              return <DeltaCell value={delta} decimals={1} invertColors={true} />
            },
          }),
          columnHelper.accessor('pickRate', {
            header: () => <ColHeader label="Pick Rate" />,
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
          columnHelper.accessor('strength', {
            header: () => (
              <ColHeader
                label="Strength"
                hint="What this ability contributes to the team holding it, in win rate points, against an ordinary pick. Fitted across every pick in every match on the patch, so it is not the same as win rate."
              />
            ),
            size: 78,
            cell: info => {
              const value = info.getValue()
              if (value === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              return <SignedCell value={value} decimals={1} />
            },
          }),
          columnHelper.accessor('strengthRank', {
            header: () => (
              <ColHeader
                label="Str Rank"
                hint="Where this ability sits when every ability and hero pick is ordered by strength. 1 is the strongest."
              />
            ),
            size: 72,
            cell: info => {
              const rank = info.getValue()
              if (rank === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              return <span className={styles.rankValue}>{rank}</span>
            },
          }),
          columnHelper.accessor('draftRank', {
            header: () => (
              <ColHeader
                label="Pick Rank"
                hint="Where this ability sits when everything is ordered by average pick position. 1 is drafted earliest."
              />
            ),
            size: 74,
            cell: info => {
              const rank = info.getValue()
              if (rank === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              return <span className={styles.rankValue}>{rank}</span>
            },
          }),
          columnHelper.accessor('mispricing', {
            header: () => (
              <ColHeader
                label="Value"
                hint="The gap between what an ability is worth and where the playerbase drafts it, in places. Positive means it goes later than its strength deserves, so you get it cheap."
              />
            ),
            size: 76,
            cell: info => {
              const value = info.getValue()
              if (value === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              const row = info.row.original
              const title =
                row.draftRank !== null && row.strengthRank !== null
                  ? `Drafted ${row.draftRank}th of ${valuesTotal}, ${row.strengthRank}th by strength`
                  : undefined
              const cls = value > 0 ? styles.signedUp : value < 0 ? styles.signedDown : ''
              return (
                <span className={`${styles.mispricing} ${cls}`} title={title}>
                  {value > 0 ? '+' : ''}{Math.round(value)}
                </span>
              )
            },
          }),
        ],
      }),
    ],
    [columnHelper, minWinRate, maxWinRate, minPickRate, maxPickRate, minPickPos, maxPickPos, prevPatch, currentPatch, valuesTotal]
  )

  const tableData = useMemo(
    () => statsData.filter(row => {
      if (hideUltimates && row.isUltimate) return false
      if (hideHeroes && row.isHeroAbility) return false
      if (hideAbilities && !row.isHeroAbility && !row.isUltimate) return false
      return true
    }),
    [hideUltimates, hideHeroes, hideAbilities, statsData]
  )

  const handleRowClick = (row: AbilityStatsRow) => {
    if (row.isHeroAbility && row.heroId) {
      navigate(`/heroes/${row.heroId}`)
    } else {
      navigate(`/abilities/${row.abilityId}`)
    }
  }

  if (error) {
    return (
      <PageShell title="Abilities">
        <p style={{ color: 'var(--color-negative)' }}>
          Error loading ability data. Please try again later.
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Abilities"
      subtitle={prevPatch ? `Comparing ${currentPatch} to ${prevPatch}` : currentPatch ?? 'Loading...'}
      actions={
        <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center' }}>
          <button
            type="button"
            className={`${styles.toggleButton} ${hideUltimates ? styles.toggleButtonActive : ''}`}
            onClick={() => toggleFilter('hideUltimates', hideUltimates)}
          >
            Hide Ultimates
          </button>
          <button
            type="button"
            className={`${styles.toggleButton} ${hideHeroes ? styles.toggleButtonActive : ''}`}
            onClick={() => toggleFilter('hideHeroes', hideHeroes)}
          >
            Hide Heroes
          </button>
          <button
            type="button"
            className={`${styles.toggleButton} ${hideAbilities ? styles.toggleButtonActive : ''}`}
            onClick={() => toggleFilter('hideAbilities', hideAbilities)}
          >
            Hide Abilities
          </button>
          <PatchSelector />
        </div>
      }
    >
      {valuesUnavailable && (
        <p className={styles.valuesNote}>
          Ability Value is not fitted for {currentPatch} yet. The Value and vs Pick columns stay
          empty until the next fit runs.
        </p>
      )}
      <DataTable
        key={currentPatch ?? ''}
        data={tableData}
        columns={columns}
        searchPlaceholder="Search abilities..."
        searchableColumns={['abilityName', 'shortName', 'ownerHeroName']}
        initialSorting={sorting}
        sorting={sorting}
        onSortingChange={setSorting}
        onRowClick={handleRowClick}
        emptyMessage="No abilities found"
        loading={!!isLoading}
        extraStats={{ value: totalGames, label: 'games' }}
      />
    </PageShell>
  )
}
