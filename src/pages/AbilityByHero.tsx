import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import {
  HeroMini,
  AbilityIcon,
  GradientCell,
  PatchSelector,
  usePatchSelection,
} from '../components'
import { usePersistedQuery } from '../api'
import { getAbilityById, heroesById, abilitiesById } from '../data'
import styles from './AbilityByHero.module.css'

interface AbilitiesApiResponse {
  data: {
    patches: { overall: string[] }
    abilityStats: Array<{
      abilityId: number
      numPicks: number
      avgPickPosition: number
      wins: number
      ownerHero?: number
      winrate: number
      pickRate: number
    }>
  }
}

interface HeroAbilityRow {
  heroId: number
  heroName: string
  heroPicture: string
  heroBodyWinRate: number | null
  heroBodyAvgPick: number | null
  abilities: Array<{
    abilityId: number
    abilityName: string
    shortName: string
    isUltimate: boolean
    winRate: number
    avgPickPos: number
    picks: number
  }>
  avgSpellWinRate: number | null
  avgPickPos: number | null
  totalPicks: number
}

type SortColumn = 'heroName' | 'heroBodyWinRate' | 'avgSpellWinRate' | 'avgPickPos'
type SortDirection = 'asc' | 'desc'

export function AbilityByHeroPage() {
  const navigate = useNavigate()
  const { currentPatch } = usePatchSelection()
  const [sortColumn, setSortColumn] = useState<SortColumn>('avgSpellWinRate')
  const [sortDirection, setSortDirection] = useState<SortDirection>('desc')

  const { data: apiResponse, isLoading, error } = usePersistedQuery<AbilitiesApiResponse>(
    '/abilities',
    currentPatch ? { patch: currentPatch } : undefined,
    { enabled: !!currentPatch }
  )

  // Build hero -> abilities mapping
  const heroData = useMemo<HeroAbilityRow[]>(() => {
    if (!apiResponse?.data?.abilityStats) return []

    // First, build a map of ownerHeroId -> abilities from static data
    const heroAbilitiesMap: Record<number, number[]> = {}
    Object.values(abilitiesById).forEach(ability => {
      if (ability.ownerHeroId && ability.valveId > 0) {
        if (!heroAbilitiesMap[ability.ownerHeroId]) {
          heroAbilitiesMap[ability.ownerHeroId] = []
        }
        heroAbilitiesMap[ability.ownerHeroId].push(ability.valveId)
      }
    })

    // Build a map of abilityId -> stats from API
    const abilityStatsMap: Record<number, typeof apiResponse.data.abilityStats[0]> = {}
    apiResponse.data.abilityStats.forEach(stat => {
      abilityStatsMap[stat.abilityId] = stat
    })

    // Build hero rows
    const rows: HeroAbilityRow[] = []

    Object.values(heroesById).forEach(hero => {
      const heroId = hero.id
      const abilityIds = heroAbilitiesMap[heroId] || []

      // Get hero body stats (negative ID)
      const heroBodyStats = abilityStatsMap[-heroId]
      const heroBodyWinRate = heroBodyStats ? heroBodyStats.winrate * 100 : null
      const heroBodyAvgPick = heroBodyStats ? heroBodyStats.avgPickPosition : null

      // Get ability stats
      const abilities = abilityIds
        .map(abilityId => {
          const ability = getAbilityById(abilityId)
          const stats = abilityStatsMap[abilityId]
          if (!ability || !stats || stats.numPicks < 20) return null
          return {
            abilityId,
            abilityName: ability.englishName,
            shortName: ability.shortName,
            isUltimate: ability.isUltimate ?? false,
            winRate: stats.winrate * 100,
            avgPickPos: stats.avgPickPosition,
            picks: stats.numPicks,
          }
        })
        .filter((a): a is NonNullable<typeof a> => a !== null)
        .sort((a, b) => a.avgPickPos - b.avgPickPos)

      if (abilities.length === 0 && heroBodyWinRate === null) return

      // Calculate averages for spells only (not including body)
      const spellWinRates = abilities.map(a => a.winRate)
      const allAvgPicks = abilities.map(a => a.avgPickPos)
      const totalPicks = abilities.reduce((sum, a) => sum + a.picks, 0) + (heroBodyStats?.numPicks ?? 0)

      // Include body in avg pick calculation
      if (heroBodyAvgPick !== null) allAvgPicks.push(heroBodyAvgPick)

      const avgSpellWinRate = spellWinRates.length > 0
        ? spellWinRates.reduce((a, b) => a + b, 0) / spellWinRates.length
        : null
      const avgPickPos = allAvgPicks.length > 0
        ? allAvgPicks.reduce((a, b) => a + b, 0) / allAvgPicks.length
        : null

      rows.push({
        heroId,
        heroName: hero.englishName,
        heroPicture: hero.picture,
        heroBodyWinRate,
        heroBodyAvgPick,
        abilities,
        avgSpellWinRate,
        avgPickPos,
        totalPicks,
      })
    })

    return rows.filter(r => r.totalPicks >= 50)
  }, [apiResponse])

  // Sort the data
  const sortedData = useMemo(() => {
    const sorted = [...heroData]
    sorted.sort((a, b) => {
      let aVal: number | string | null
      let bVal: number | string | null

      switch (sortColumn) {
        case 'heroName':
          aVal = a.heroName
          bVal = b.heroName
          break
        case 'heroBodyWinRate':
          aVal = a.heroBodyWinRate
          bVal = b.heroBodyWinRate
          break
        case 'avgSpellWinRate':
          aVal = a.avgSpellWinRate
          bVal = b.avgSpellWinRate
          break
        case 'avgPickPos':
          aVal = a.avgPickPos
          bVal = b.avgPickPos
          break
        default:
          return 0
      }

      // Handle nulls
      if (aVal === null && bVal === null) return 0
      if (aVal === null) return 1
      if (bVal === null) return -1

      // Compare
      let result: number
      if (typeof aVal === 'string' && typeof bVal === 'string') {
        result = aVal.localeCompare(bVal)
      } else {
        result = (aVal as number) - (bVal as number)
      }

      return sortDirection === 'desc' ? -result : result
    })
    return sorted
  }, [heroData, sortColumn, sortDirection])

  const handleSort = (column: SortColumn) => {
    if (sortColumn === column) {
      setSortDirection(d => d === 'asc' ? 'desc' : 'asc')
    } else {
      setSortColumn(column)
      // Default direction based on column type
      setSortDirection(column === 'heroName' || column === 'avgPickPos' ? 'asc' : 'desc')
    }
  }

  const SortIndicator = ({ column }: { column: SortColumn }) => {
    if (sortColumn !== column) return null
    return <span className={styles.sortIndicator}>{sortDirection === 'asc' ? '▲' : '▼'}</span>
  }

  const handleHeroClick = (heroId: number) => {
    navigate(`/heroes/${heroId}`)
  }

  const handleAbilityClick = (abilityId: number, e: React.MouseEvent) => {
    e.stopPropagation()
    navigate(`/abilities/${abilityId}`)
  }

  if (error) {
    return (
      <PageShell title="Abilities by Hero">
        <p style={{ color: 'var(--color-negative)' }}>
          Error loading ability data. Please try again later.
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Abilities by Hero"
      subtitle={currentPatch ? `Patch ${currentPatch}` : 'Loading...'}
      actions={<PatchSelector />}
    >
      {isLoading ? (
        <p style={{ color: 'var(--color-text-muted)' }}>Loading...</p>
      ) : (
        <div className={styles.container}>
          <div className={styles.headerRow}>
            <div
              className={`${styles.heroCol} ${styles.sortableHeader}`}
              onClick={() => handleSort('heroName')}
            >
              Hero <SortIndicator column="heroName" />
            </div>
            <div
              className={`${styles.bodyCol} ${styles.sortableHeader}`}
              onClick={() => handleSort('heroBodyWinRate')}
            >
              Body WR <SortIndicator column="heroBodyWinRate" />
            </div>
            <div className={styles.abilitiesCol}>Abilities</div>
            <div
              className={`${styles.avgCol} ${styles.sortableHeader}`}
              onClick={() => handleSort('avgSpellWinRate')}
            >
              Spell WR <SortIndicator column="avgSpellWinRate" />
            </div>
            <div
              className={`${styles.avgCol} ${styles.sortableHeader}`}
              onClick={() => handleSort('avgPickPos')}
            >
              Avg Pick <SortIndicator column="avgPickPos" />
            </div>
          </div>
          {sortedData.map(hero => (
            <div
              key={hero.heroId}
              className={styles.heroRow}
              onClick={() => handleHeroClick(hero.heroId)}
            >
              <div className={styles.heroCol}>
                <HeroMini name={hero.heroName} picture={hero.heroPicture} height={32} />
                <span className={styles.heroName}>{hero.heroName}</span>
              </div>
              <div className={styles.bodyCol}>
                {hero.heroBodyWinRate !== null ? (
                  <GradientCell
                    value={hero.heroBodyWinRate}
                    min={43}
                    max={57}
                    decimals={1}
                    suffix="%"
                  />
                ) : (
                  <span className={styles.noData}>-</span>
                )}
              </div>
              <div className={styles.abilitiesCol}>
                {hero.abilities.map(ability => (
                  <div
                    key={ability.abilityId}
                    className={styles.abilityItem}
                    onClick={(e) => handleAbilityClick(ability.abilityId, e)}
                  >
                    <AbilityIcon
                      id={ability.abilityId}
                      name={ability.abilityName}
                      shortName={ability.shortName}
                      isUltimate={ability.isUltimate}
                      size="sm"
                    />
                    <span className={styles.abilityName}>{ability.abilityName}</span>
                    <div className={styles.abilityStats}>
                      <GradientCell
                        value={ability.winRate}
                        min={43}
                        max={57}
                        decimals={1}
                        suffix="%"
                      />
                      <span className={styles.avgPickStat}>{ability.avgPickPos.toFixed(1)}</span>
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.avgCol}>
                {hero.avgSpellWinRate !== null ? (
                  <GradientCell
                    value={hero.avgSpellWinRate}
                    min={43}
                    max={57}
                    decimals={1}
                    suffix="%"
                  />
                ) : (
                  <span className={styles.noData}>-</span>
                )}
              </div>
              <div className={styles.avgCol}>
                {hero.avgPickPos !== null ? (
                  <span className={styles.avgPickValue}>{hero.avgPickPos.toFixed(1)}</span>
                ) : (
                  <span className={styles.noData}>-</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </PageShell>
  )
}
