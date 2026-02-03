import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import styles from './Abilities.module.css'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { PageShell } from '../components/PageShell'
import {
  DataTable,
  GradientCell,
  NumericCell,
  AbilityInline,
  HeroInline,
  PatchSelector,
  usePatchSelection,
  useDataTableDisplayIndex,
} from '../components'
import { usePersistedQuery } from '../api'
import { heroMiniUrl } from '../config'
import { getAbilityById, getHeroById } from '../data'

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
    abilityValuations: Record<string, number>
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
  value: number | null    // ability valuation (picked early/late relative to expected)
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

const DEFAULT_SORTING: SortingState = [{ id: 'winRate', desc: true }]

export function AbilitiesPage() {
  const navigate = useNavigate()
  const [showOnlyAbilities, setShowOnlyAbilities] = useState(false)
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING)
  const { currentPatch, prevPatch } = usePatchSelection()
  const { data: apiResponse, isLoading, error } = usePersistedQuery<AbilitiesApiResponse>(
    '/abilities',
    currentPatch ? { patch: currentPatch } : undefined,
    { enabled: !!currentPatch }
  )

  // Transform API response into array format
  const statsData = useMemo<AbilityStatsRow[]>(() => {
    if (!apiResponse?.data?.abilityStats) return []

    const valuations = apiResponse.data.abilityValuations ?? {}

    return apiResponse.data.abilityStats
      .map(stat => {
        const isHeroAbility = stat.abilityId < 0
        const heroIdFromAbility = isHeroAbility ? Math.abs(stat.abilityId) : undefined
        const hero = heroIdFromAbility ? getHeroById(heroIdFromAbility) : undefined
        const ability = !isHeroAbility ? getAbilityById(stat.abilityId) : undefined

        // For hero abilities (-X), use hero X as owner
        const ownerHeroId = isHeroAbility ? heroIdFromAbility : stat.ownerHero
        const ownerHeroData = ownerHeroId ? getHeroById(ownerHeroId) : undefined

        // Get valuation from the map (key is string)
        const valuation = valuations[String(stat.abilityId)] ?? null

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
          winRate: stat.winrate * 100,
          pickRate: stat.pickRate * 100,
          avgPickPos: stat.avgPickPosition,
          value: valuation,
        }
      })
      .filter(row => row.picks > 0 && row.abilityName && !row.abilityName.startsWith('special_bonus'))
  }, [apiResponse])

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

  const columns = useMemo<ColumnDef<AbilityStatsRow>[]>(
    () => [
      {
        id: 'rank',
        header: '#',
        size: 44,
        enableSorting: false,
        cell: () => <RankCell />,
      },
      {
        accessorKey: 'abilityName',
        header: 'Ability',
        size: 240,
        cell: info => {
          const row = info.row.original
          // For hero abilities, render HeroInline instead
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
      {
        accessorKey: 'winRate',
        header: 'Win Rate',
        size: 100,
        cell: info => (
          <GradientCell
            value={info.getValue() as number}
            min={minWinRate}
            max={maxWinRate}
            decimals={1}
            suffix="%"
          />
        ),
      },
      {
        accessorKey: 'pickRate',
        header: 'Pick Rate',
        size: 100,
        cell: info => (
          <GradientCell
            value={info.getValue() as number}
            min={minPickRate}
            max={maxPickRate}
            decimals={1}
            suffix="%"
          />
        ),
      },
      {
        accessorKey: 'avgPickPos',
        header: 'Avg Pick',
        size: 100,
        cell: info => (
          <GradientCell
            value={info.getValue() as number}
            min={minPickPos}
            max={maxPickPos}
            decimals={1}
            suffix=""
            invert={true}
          />
        ),
      },
      {
        accessorKey: 'value',
        header: () => (
          <span style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
            Value
            <span
              title="How early/late this ability is picked relative to its win rate. Positive = picked later than expected (undervalued). Negative = picked earlier than expected (overvalued). See About page for details."
              style={{
                cursor: 'help',
                fontSize: '12px',
                color: 'var(--color-text-muted)',
                border: '1px solid var(--color-border)',
                borderRadius: '50%',
                width: '14px',
                height: '14px',
                display: 'inline-flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              ?
            </span>
          </span>
        ),
        size: 90,
        cell: info => {
          const value = info.getValue() as number | null
          if (value === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
          const color = value > 0.02 ? 'var(--color-positive)' : value < -0.02 ? 'var(--color-negative)' : 'var(--color-text)'
          return (
            <span style={{ color, fontVariantNumeric: 'tabular-nums' }}>
              {value > 0 ? '+' : ''}{(value * 100).toFixed(1)}%
            </span>
          )
        },
      },
      {
        accessorKey: 'picks',
        header: 'Picks',
        size: 80,
        cell: info => <NumericCell value={info.getValue() as number} decimals={0} />,
      },
      {
        accessorKey: 'wins',
        header: 'Wins',
        size: 80,
        cell: info => <NumericCell value={info.getValue() as number} decimals={0} />,
      },
    ],
    [minWinRate, maxWinRate, minPickRate, maxPickRate, minPickPos, maxPickPos]
  )

  const tableData = useMemo(
    () => (showOnlyAbilities ? statsData.filter(row => !row.isHeroAbility) : statsData),
    [showOnlyAbilities, statsData]
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
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            type="button"
            className={`${styles.toggleButton} ${showOnlyAbilities ? styles.toggleButtonActive : ''}`}
            onClick={() => setShowOnlyAbilities(prev => !prev)}
          >
            Show only abilities
          </button>
          <PatchSelector />
        </div>
      }
    >
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
        loading={isLoading}
        extraStats={{ value: totalGames, label: 'games' }}
      />
    </PageShell>
  )
}
