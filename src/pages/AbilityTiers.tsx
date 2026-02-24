import { useMemo } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { AbilityIcon, PatchSelector, usePatchSelection } from '../components'
import { usePersistedQuery } from '../api'
import { getAbilityById, getHeroById } from '../data'
import { heroMiniUrl } from '../config'
import styles from './AbilityTiers.module.css'

// API response format (same as Abilities page)
interface AbilitiesApiResponse {
  data: {
    patches: { overall: string[] }
    abilityStats: Array<{
      abilityId: number
      numPicks: number
      wins: number
      ownerHero?: number
      winrate: number
    }>
  }
}

// Simplified ability data for tier display
interface TierAbility {
  abilityId: number
  abilityName: string
  shortName: string
  isUltimate: boolean
  isHeroAbility: boolean
  heroId?: number
  heroPicture?: string
  ownerHeroId?: number
  ownerHeroName?: string
  winRate: number
  picks: number
}

// Tier definitions with percentile thresholds
const TIERS = [
  { name: 'S', threshold: 0.03, color: '#ff7f7f' },  // Top 3%
  { name: 'A', threshold: 0.10, color: '#ffbf7f' },  // Top 10%
  { name: 'B', threshold: 0.25, color: '#ffdf7f' },  // Top 25%
  { name: 'C', threshold: 0.50, color: '#ffff7f' },  // Top 50%
  { name: 'D', threshold: 0.75, color: '#bfff7f' },  // Top 75%
  { name: 'E', threshold: 0.90, color: '#7fbfff' },  // Top 90%
  { name: 'F', threshold: 1.00, color: '#bf7fbf' },  // Bottom 10%
] as const

export function AbilityTiersPage() {
  const [searchParams, setSearchParams] = useSearchParams()
  const { currentPatch } = usePatchSelection()

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

  const { data: apiResponse, isLoading, error } = usePersistedQuery<AbilitiesApiResponse>(
    '/abilities',
    currentPatch ? { patch: currentPatch } : undefined,
    { enabled: !!currentPatch }
  )

  // Transform API response and filter
  const abilities = useMemo<TierAbility[]>(() => {
    if (!apiResponse?.data?.abilityStats) return []

    return apiResponse.data.abilityStats
      .map(stat => {
        const isHeroAbility = stat.abilityId < 0
        const heroIdFromAbility = isHeroAbility ? Math.abs(stat.abilityId) : undefined
        const hero = heroIdFromAbility ? getHeroById(heroIdFromAbility) : undefined
        const ability = !isHeroAbility ? getAbilityById(stat.abilityId) : undefined
        const ownerHeroId = isHeroAbility ? heroIdFromAbility : stat.ownerHero
        const ownerHeroData = ownerHeroId ? getHeroById(ownerHeroId) : undefined

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
          winRate: stat.winrate * 100,
          picks: stat.numPicks,
        }
      })
      .filter(row => row.picks > 0 && row.abilityName && !row.abilityName.startsWith('special_bonus'))
      .filter(row => {
        if (hideUltimates && row.isUltimate) return false
        if (hideHeroes && row.isHeroAbility) return false
        if (hideAbilities && !row.isHeroAbility && !row.isUltimate) return false
        return true
      })
  }, [apiResponse, hideUltimates, hideHeroes, hideAbilities])

  // Sort by winrate and assign tiers based on percentile
  const tierGroups = useMemo(() => {
    if (abilities.length === 0) return []

    // Sort by winrate descending
    const sorted = [...abilities].sort((a, b) => b.winRate - a.winRate)
    const total = sorted.length

    // Group abilities into tiers based on percentile position
    const groups: { tier: typeof TIERS[number]; abilities: TierAbility[] }[] = TIERS.map(tier => ({
      tier,
      abilities: [],
    }))

    sorted.forEach((ability, index) => {
      const percentile = (index + 1) / total
      // Find the first tier whose threshold is >= this percentile
      const tierIndex = TIERS.findIndex(t => percentile <= t.threshold)
      groups[tierIndex >= 0 ? tierIndex : TIERS.length - 1].abilities.push(ability)
    })

    return groups
  }, [abilities])

  if (error) {
    return (
      <PageShell title="Ability Tiers">
        <p style={{ color: 'var(--color-negative)' }}>
          Error loading ability data. Please try again later.
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Ability Tiers"
      subtitle={currentPatch ? `Patch ${currentPatch}` : 'Loading...'}
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
      {isLoading ? (
        <div className={styles.loading}>Loading abilities...</div>
      ) : (
        <div className={styles.tierList}>
          {tierGroups.map(({ tier, abilities: tierAbilities }) => (
            <div key={tier.name} className={styles.tierRow}>
              <div
                className={styles.tierLabel}
                style={{ backgroundColor: tier.color }}
              >
                {tier.name}
              </div>
              <div className={styles.tierAbilities}>
                {tierAbilities.map(ability => (
                  ability.isHeroAbility && ability.heroId ? (
                    <Link
                      key={ability.abilityId}
                      to={`/heroes/${ability.heroId}`}
                      className={styles.abilitySlot}
                      title={`${ability.abilityName}\nOwner: ${ability.ownerHeroName || 'N/A'}\nWin Rate: ${ability.winRate.toFixed(1)}%`}
                    >
                      <img
                        src={heroMiniUrl(ability.heroPicture || '')}
                        alt={ability.abilityName}
                        className={styles.heroIcon}
                      />
                    </Link>
                  ) : (
                    <span
                      key={ability.abilityId}
                      className={styles.abilitySlot}
                      title={`${ability.abilityName}\nOwner: ${ability.ownerHeroName || 'N/A'}\nWin Rate: ${ability.winRate.toFixed(1)}%`}
                    >
                      <AbilityIcon
                        id={ability.abilityId}
                        name={ability.abilityName}
                        shortName={ability.shortName}
                        isUltimate={ability.isUltimate}
                        size="md"
                        showTooltip={false}
                        linkTo={`/abilities/${ability.abilityId}`}
                      />
                    </span>
                  )
                ))}
                {tierAbilities.length === 0 && (
                  <span className={styles.emptyTier}>No abilities</span>
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      <div className={styles.legend}>
        <p className={styles.legendTitle}>Tier Thresholds (by win rate percentile)</p>
        <div className={styles.legendItems}>
          {TIERS.map((tier, i) => {
            const prevThreshold = i === 0 ? 0 : TIERS[i - 1].threshold
            const label = i === 0
              ? `Top ${(tier.threshold * 100).toFixed(0)}%`
              : `${(prevThreshold * 100).toFixed(0)}% - ${(tier.threshold * 100).toFixed(0)}%`
            return (
              <span key={tier.name} className={styles.legendItem}>
                <span
                  className={styles.legendColor}
                  style={{ backgroundColor: tier.color }}
                />
                <span className={styles.legendText}>{tier.name}: {label}</span>
              </span>
            )
          })}
        </div>
      </div>
    </PageShell>
  )
}
