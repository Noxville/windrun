import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { PageShell } from '../components/PageShell'
import {
  DataTable,
  GradientCell,
  NumericCell,
  AbilityInline,
  AbilityIcon,
  HeroInline,
  PatchSelector,
  usePatchSelection,
} from '../components'
import { usePersistedQuery } from '../api'
import { getAbilityById, getHeroById } from '../data'
import { heroMiniUrl } from '../config'
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

// API response format for triplets
interface AbilityTripletsApiResponse {
  data: {
    patches: { overall: string[] }
    abilityTriplets: Array<{
      abilityIdOne: number
      abilityIdTwo: number
      abilityIdThree: number
      numPicks: number
      wins: number
      winrate: number
    }>
  }
}

// Hidden triple info to display
interface HiddenTriple {
  abilityId: number
  abilityName: string
  shortName: string
  isUltimate: boolean
  isHeroAbility: boolean
  heroId?: number
  heroPicture?: string
  ownerHeroId?: number | null
  numPicks: number
  winrate: number
  winrateShift: number // triplet winrate - pair winrate
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
  hiddenTriples: HiddenTriple[]
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

  // Fetch ability triplets for hidden triple detection
  const { data: tripletsResponse, isLoading: tripletsLoading } = usePersistedQuery<AbilityTripletsApiResponse>(
    '/ability-triplets',
    currentPatch ? { patch: currentPatch } : undefined,
    { enabled: !!currentPatch }
  )

  const isLoading = pairsLoading || abilitiesLoading || tripletsLoading

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

  // Build pair numPicks lookup map for threshold checking
  const pairPicksMap = useMemo(() => {
    if (!pairsResponse?.data?.abilityPairs) return new Map<string, number>()
    const map = new Map<string, number>()
    pairsResponse.data.abilityPairs.forEach(pair => {
      // Keys are already sorted (abilityIdOne < abilityIdTwo)
      const key = `${pair.abilityIdOne}-${pair.abilityIdTwo}`
      map.set(key, pair.numPicks)
    })
    return map
  }, [pairsResponse])

  // Build hidden triples lookup map from triplets data
  // For each triplet (A,B,C), check each implied pair against the threshold
  const hiddenTriplesMap = useMemo(() => {
    const map = new Map<string, HiddenTriple[]>()
    if (!tripletsResponse?.data?.abilityTriplets || pairPicksMap.size === 0) {
      return map
    }

    for (const triplet of tripletsResponse.data.abilityTriplets) {
      const { abilityIdOne: a, abilityIdTwo: b, abilityIdThree: c, numPicks: tripletPicks, winrate } = triplet

      // Check each implied pair: [pairId1, pairId2, hiddenAbilityId]
      const impliedPairs: [number, number, number][] = [
        [a, b, c],
        [a, c, b],
        [b, c, a],
      ]

      for (const [pairId1, pairId2, hiddenId] of impliedPairs) {
        const pairKey = `${pairId1}-${pairId2}`
        const pairPicks = pairPicksMap.get(pairKey)
        if (pairPicks === undefined) continue

        // Determine threshold based on whether any two abilities share the same hero
        const pair1Info = resolveAbilityInfo(pairId1)
        const pair2Info = resolveAbilityInfo(pairId2)
        const hiddenInfo = resolveAbilityInfo(hiddenId)
        const hero1 = pair1Info.ownerHeroId
        const hero2 = pair2Info.ownerHeroId
        const heroHidden = hiddenInfo.ownerHeroId
        const anyTwoShareHero =
          (hero1 != null && hero1 === hero2) ||
          (hero1 != null && hero1 === heroHidden) ||
          (hero2 != null && hero2 === heroHidden)
        const thresholdFactor = anyTwoShareHero ? 0.60 : 0.0001
        const threshold = thresholdFactor * pairPicks

        // Triplet picks must meet threshold relative to pair picks
        if (tripletPicks >= threshold) {
          const info = hiddenInfo
          const existing = map.get(pairKey) ?? []
          existing.push({
            abilityId: info.abilityId,
            abilityName: info.abilityName,
            shortName: info.shortName,
            isUltimate: info.isUltimate,
            isHeroAbility: info.isHeroAbility,
            heroId: info.heroId,
            heroPicture: info.heroPicture,
            ownerHeroId: info.ownerHeroId,
            numPicks: tripletPicks,
            winrate: winrate * 100,
            winrateShift: 0, // Calculated in statsData
          })
          map.set(pairKey, existing)
        }
      }
    }

    return map
  }, [tripletsResponse, pairPicksMap])

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

        // Get hidden triples from the pre-computed map
        const pairKey = `${pair.abilityIdOne}-${pair.abilityIdTwo}`
        const rawHiddenTriples = hiddenTriplesMap.get(pairKey) ?? []

        // Process hidden triples: calculate winrateShift, filter by same hero, sort by shift
        const hiddenTriples = rawHiddenTriples
          .map(triple => ({
            ...triple,
            winrateShift: triple.winrate - pairWinRate, // triplet WR - pair WR
          }))
          .filter(triple => {
            if (!excludeSameHero) return true
            // Filter out hidden triples from same hero as ability 1 or ability 2
            if (triple.ownerHeroId == null) return true
            if (one.ownerHeroId != null && triple.ownerHeroId === one.ownerHeroId) return false
            if (two.ownerHeroId != null && triple.ownerHeroId === two.ownerHeroId) return false
            return true
          })
          .sort((a, b) => b.winrateShift - a.winrateShift) // Sort by shift descending

        return {
          key: pairKey,
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
          hiddenTriples,
        }
      })
      .filter(row => row.picks >= 50)
      .filter(row => {
        if (!excludeSameHero) return true
        // Exclude pairs where both abilities came from the same hero
        if (row.ownerHeroIdOne == null || row.ownerHeroIdTwo == null) return true
        return row.ownerHeroIdOne !== row.ownerHeroIdTwo
      })
  }, [pairsResponse, abilityWinRateMap, excludeSameHero, hiddenTriplesMap])

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
        accessorKey: 'hiddenTriples',
        header: () => (
          <span>
            Hidden Triples
            <span
              className={styles.helpIcon}
              title="Third ability from a commonly drafted triplet. If pair (A,B) is often picked with C, and the triplet has similar pick counts, C is shown here. These pairs may have inflated synergy."
            >
              ?
            </span>
          </span>
        ),
        size: 120,
        cell: info => {
          const triples = info.getValue() as HiddenTriple[]
          if (triples.length === 0) {
            return <span style={{ color: 'var(--color-text-muted)' }}>-</span>
          }

          // Helper to get background color based on winrate shift
          const getShiftBackground = (shift: number) => {
            // Clamp shift to -10 to +10 range for color intensity
            const clampedShift = Math.max(-10, Math.min(10, shift))
            const intensity = Math.abs(clampedShift) / 10 // 0 to 1
            const alpha = 0.15 + intensity * 0.35 // 0.15 to 0.5 alpha
            if (shift >= 0) {
              return `rgba(34, 197, 94, ${alpha})` // green
            } else {
              return `rgba(239, 68, 68, ${alpha})` // red
            }
          }

          const formatShift = (shift: number) => shift >= 0 ? `+${shift.toFixed(1)}%` : `${shift.toFixed(1)}%`

          const getTooltipText = (triple: HiddenTriple) =>
            `${triple.abilityName}\n${triple.numPicks.toLocaleString()} games\n${triple.winrate.toFixed(1)}% WR\nShift: ${formatShift(triple.winrateShift)}`

          return (
            <div className={styles.tripletCell}>
              {triples.map(triple => (
                triple.isHeroAbility && triple.heroId ? (
                  <Link
                    key={triple.abilityId}
                    to={`/heroes/${triple.heroId}`}
                    className={styles.tripletIcon}
                    style={{ background: getShiftBackground(triple.winrateShift) }}
                    title={getTooltipText(triple)}
                  >
                    <img
                      src={heroMiniUrl(triple.heroPicture || '')}
                      alt={triple.abilityName}
                      className={styles.tripletHeroIcon}
                    />
                  </Link>
                ) : (
                  <span
                    key={triple.abilityId}
                    className={styles.tripletIcon}
                    style={{ background: getShiftBackground(triple.winrateShift) }}
                    title={getTooltipText(triple)}
                  >
                    <AbilityIcon
                      id={triple.abilityId}
                      name={triple.abilityName}
                      shortName={triple.shortName}
                      isUltimate={triple.isUltimate}
                      size="sm"
                      showTooltip={false}
                      linkTo={`/abilities/${triple.abilityId}`}
                    />
                  </span>
                )
              ))}
            </div>
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
