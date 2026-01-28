import { useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { PageShell } from '../components/PageShell'
import {
  DataTable,
  GradientCell,
  NumericCell,
  AbilityInline,
  HeroInline,
  PatchSelector,
  usePatchSelection,
} from '../components'
import { usePersistedQuery } from '../api'
import { getAbilityById, getHeroById } from '../data'
import styles from './AbilityPairs.module.css'

// API response format for pairs
interface AbilityPairsApiResponse {
  data: {
    patches: { overall: string[] }
    abilityPairs: Array<{
      abilityIdOne: number
      abilityIdTwo: number
      numPicks: number
      wins: number
      winrate: number
    }>
  }
}

// API response format for individual abilities
interface AbilitiesApiResponse {
  data: {
    patches: { overall: string[] }
    abilityStats: Array<{
      abilityId: number
      numPicks: number
      wins: number
      winrate: number
    }>
  }
}

// Helper to resolve ability info including hero abilities
function resolveAbilityInfo(abilityId: number) {
  const isHeroAbility = abilityId < 0
  const heroIdFromAbility = isHeroAbility ? Math.abs(abilityId) : undefined
  const hero = heroIdFromAbility ? getHeroById(heroIdFromAbility) : undefined
  const ability = !isHeroAbility ? getAbilityById(abilityId) : undefined

  return {
    abilityId,
    abilityName: isHeroAbility
      ? (hero?.englishName ?? `Hero #${heroIdFromAbility}`)
      : (ability?.englishName ?? `Ability #${abilityId}`),
    shortName: ability?.shortName ?? '',
    isUltimate: ability?.isUltimate ?? false,
    isHeroAbility,
    heroId: heroIdFromAbility,
    heroPicture: hero?.picture,
    ownerHeroId: isHeroAbility ? heroIdFromAbility : ability?.ownerHeroId,
  }
}

// Transformed row for table
interface AbilityPairRow {
  key: string
  abilityIdOne: number
  abilityNameOne: string
  shortNameOne: string
  isUltimateOne: boolean
  isHeroAbilityOne: boolean
  heroIdOne?: number
  heroPictureOne?: string
  ownerHeroIdOne?: number | null
  winRateOne: number | null
  abilityIdTwo: number
  abilityNameTwo: string
  shortNameTwo: string
  isUltimateTwo: boolean
  isHeroAbilityTwo: boolean
  heroIdTwo?: number
  heroPictureTwo?: string
  ownerHeroIdTwo?: number | null
  winRateTwo: number | null
  picks: number
  wins: number
  pairWinRate: number
  synergy: number | null
}

// Render cell for ability (or hero)
function AbilityCell({ row, which }: { row: AbilityPairRow; which: 'one' | 'two' }) {
  const isHeroAbility = which === 'one' ? row.isHeroAbilityOne : row.isHeroAbilityTwo
  const heroId = which === 'one' ? row.heroIdOne : row.heroIdTwo
  const heroPicture = which === 'one' ? row.heroPictureOne : row.heroPictureTwo
  const abilityId = which === 'one' ? row.abilityIdOne : row.abilityIdTwo
  const abilityName = which === 'one' ? row.abilityNameOne : row.abilityNameTwo
  const shortName = which === 'one' ? row.shortNameOne : row.shortNameTwo
  const isUltimate = which === 'one' ? row.isUltimateOne : row.isUltimateTwo

  // For hero abilities, always render as HeroInline
  if (isHeroAbility && heroId) {
    return (
      <HeroInline
        id={heroId}
        name={abilityName}
        picture={heroPicture || ''}
        linkTo={`/heroes/${heroId}`}
      />
    )
  }

  return (
    <AbilityInline
      id={abilityId}
      name={abilityName}
      shortName={shortName}
      isUltimate={isUltimate}
      linkTo={`/abilities/${abilityId}`}
    />
  )
}

export function AbilityPairsPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { currentPatch } = usePatchSelection()
  const excludeSameHero = searchParams.get('excludeSameHero') === 'true'

  // Fetch ability pairs
  const { data: pairsResponse, isLoading: pairsLoading, error: pairsError } = usePersistedQuery<AbilityPairsApiResponse>(
    '/ability-pairs',
    currentPatch ? { patch: currentPatch } : undefined,
    { enabled: !!currentPatch }
  )

  // Fetch individual ability stats for winrates
  const { data: abilitiesResponse, isLoading: abilitiesLoading } = usePersistedQuery<AbilitiesApiResponse>(
    '/abilities',
    currentPatch ? { patch: currentPatch } : undefined,
    { enabled: !!currentPatch }
  )

  const isLoading = pairsLoading || abilitiesLoading

  const handleExcludeSameHeroToggle = () => {
    const newParams = new URLSearchParams(searchParams)
    if (excludeSameHero) {
      newParams.delete('excludeSameHero')
    } else {
      newParams.set('excludeSameHero', 'true')
    }
    setSearchParams(newParams)
  }

  // Build ability winrate map
  const abilityWinRateMap = useMemo(() => {
    if (!abilitiesResponse?.data?.abilityStats) return {}
    const map: Record<number, number> = {}
    abilitiesResponse.data.abilityStats.forEach(stat => {
      map[stat.abilityId] = stat.winrate * 100
    })
    return map
  }, [abilitiesResponse])

  // Transform API response into array format
  const statsData = useMemo<AbilityPairRow[]>(() => {
    if (!pairsResponse?.data?.abilityPairs) return []

    return pairsResponse.data.abilityPairs
      .map(pair => {
        const one = resolveAbilityInfo(pair.abilityIdOne)
        const two = resolveAbilityInfo(pair.abilityIdTwo)
        const winRateOne = abilityWinRateMap[pair.abilityIdOne] ?? null
        const winRateTwo = abilityWinRateMap[pair.abilityIdTwo] ?? null
        const pairWinRate = pair.winrate * 100

        // Calculate synergy: pair winrate - geometric mean of individual winrates
        let synergy: number | null = null
        if (winRateOne !== null && winRateTwo !== null && winRateOne > 0 && winRateTwo > 0) {
          const geometricMean = Math.sqrt(winRateOne * winRateTwo)
          synergy = pairWinRate - geometricMean
        }

        return {
          key: `${pair.abilityIdOne}-${pair.abilityIdTwo}`,
          abilityIdOne: one.abilityId,
          abilityNameOne: one.abilityName,
          shortNameOne: one.shortName,
          isUltimateOne: one.isUltimate,
          isHeroAbilityOne: one.isHeroAbility,
          heroIdOne: one.heroId,
          heroPictureOne: one.heroPicture,
          ownerHeroIdOne: one.ownerHeroId,
          winRateOne,
          abilityIdTwo: two.abilityId,
          abilityNameTwo: two.abilityName,
          shortNameTwo: two.shortName,
          isUltimateTwo: two.isUltimate,
          isHeroAbilityTwo: two.isHeroAbility,
          heroIdTwo: two.heroId,
          heroPictureTwo: two.heroPicture,
          ownerHeroIdTwo: two.ownerHeroId,
          winRateTwo,
          picks: pair.numPicks,
          wins: pair.wins,
          pairWinRate,
          synergy,
        }
      })
      .filter(row => row.picks >= 50)
      .filter(row => {
        if (!excludeSameHero) return true
        // Exclude pairs where both abilities came from the same hero
        if (row.ownerHeroIdOne == null || row.ownerHeroIdTwo == null) return true
        return row.ownerHeroIdOne !== row.ownerHeroIdTwo
      })
  }, [pairsResponse, abilityWinRateMap, excludeSameHero])

  const columns = useMemo<ColumnDef<AbilityPairRow>[]>(
    () => [
      {
        accessorKey: 'abilityNameOne',
        header: 'Ability 1',
        size: 200,
        cell: info => <AbilityCell row={info.row.original} which="one" />,
      },
      {
        accessorKey: 'winRateOne',
        header: 'WR 1',
        size: 70,
        cell: info => {
          const value = info.getValue() as number | null
          if (value === null) return <span style={{ color: 'var(--color-text-muted)' }}>-</span>
          return (
            <GradientCell
              value={value}
              min={43}
              max={57}
              decimals={1}
              suffix="%"
            />
          )
        },
      },
      {
        accessorKey: 'abilityNameTwo',
        header: 'Ability 2',
        size: 200,
        cell: info => <AbilityCell row={info.row.original} which="two" />,
      },
      {
        accessorKey: 'winRateTwo',
        header: 'WR 2',
        size: 70,
        cell: info => {
          const value = info.getValue() as number | null
          if (value === null) return <span style={{ color: 'var(--color-text-muted)' }}>-</span>
          return (
            <GradientCell
              value={value}
              min={43}
              max={57}
              decimals={1}
              suffix="%"
            />
          )
        },
      },
      {
        accessorKey: 'pairWinRate',
        header: 'Pair WR',
        size: 80,
        cell: info => (
          <GradientCell
            value={info.getValue() as number}
            min={43}
            max={57}
            decimals={1}
            suffix="%"
          />
        ),
      },
      {
        accessorKey: 'synergy',
        header: 'Synergy',
        size: 80,
        cell: info => {
          const value = info.getValue() as number | null
          if (value === null) return <span style={{ color: 'var(--color-text-muted)' }}>-</span>
          const isPositive = value >= 0
          return (
            <span style={{
              color: isPositive ? 'var(--color-positive)' : 'var(--color-negative)',
              fontWeight: 'var(--weight-regular)'
            }}>
              {isPositive ? '+' : ''}{value.toFixed(1)}%
            </span>
          )
        },
      },
      {
        accessorKey: 'picks',
        header: 'Picks',
        size: 70,
        cell: info => <NumericCell value={info.getValue() as number} decimals={0} />,
      },
    ],
    []
  )

  if (pairsError) {
    return (
      <PageShell title="Ability Pairs">
        <p style={{ color: 'var(--color-negative)' }}>
          Error loading ability pairs data. Please try again later.
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Ability Pairs"
      subtitle={currentPatch ? `Patch ${currentPatch}` : 'Loading...'}
      actions={
        <div style={{ display: 'flex', gap: '1rem', alignItems: 'center' }}>
          <button
            className={`${styles.toggleButton} ${excludeSameHero ? styles.toggleButtonActive : ''}`}
            onClick={handleExcludeSameHeroToggle}
          >
            Exclude Same Hero
          </button>
          <PatchSelector />
        </div>
      }
    >
      <DataTable
        data={statsData}
        columns={columns}
        searchPlaceholder="Search ability pairs..."
        searchableColumns={['abilityNameOne', 'abilityNameTwo', 'shortNameOne', 'shortNameTwo']}
        initialSorting={[{ id: 'synergy', desc: true }]}
        emptyMessage="No ability pairs found"
        loading={isLoading}
      />
    </PageShell>
  )
}
