import { useState, useMemo, useCallback, useEffect, useRef } from 'react'
import { useSearchParams } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { AbilityIcon, PatchSelector, usePatchSelection } from '../components'
import { usePersistedQuery } from '../api'
import { getAbilityById, getHeroById, abilitiesById } from '../data'
import { heroMiniUrl } from '../config'
import type { Ability } from '../data'
import styles from './HeroBuilder.module.css'

// --- API response types ---

interface AbilityStatEntry {
  abilityId: number
  numPicks: number
  wins: number
  winrate: number
  pickRate: number
  avgPickPosition: number
}

interface AbilitiesApiResponse {
  data: {
    patches: { overall: string[] }
    abilityStats: AbilityStatEntry[]
  }
}

interface AbilityPairEntry {
  abilityIdOne: number
  abilityIdTwo: number
  numPicks: number
  wins: number
  winrate: number
}

interface AbilityPairsApiResponse {
  data: {
    abilityPairs: AbilityPairEntry[]
    abilityStats: Array<{ abilityId: number; winrate: number }>
  }
}

interface AbilityShiftEntry {
  abilityId: number
  killsShift: number
  deathsShift: number
  killAssistShift: number
  gpmShift: number
  xpmShift: number
  dmgShift: number
  healingShift: number
}

interface AbilityShiftsApiResponse {
  data: {
    abilityShifts: AbilityShiftEntry[]
  }
}

interface AghsStatBlock {
  wins: number
  losses: number
  total: number
  winrate: number
}

interface AbilityAghsEntry {
  abilityId: number
  totalGames: number
  aghsScepter: AghsStatBlock
  aghsShard: AghsStatBlock
}

interface AbilityAghsApiResponse {
  data: {
    abilityAghs: AbilityAghsEntry[]
  }
}

interface HeroesApiResponse {
  data: {
    heroStats: Record<string, Record<string, { wins: number; numGames: number; winrate: number }>>
  }
}

// --- Slot types ---

type SlotType = 'hero' | 'spell' | 'ultimate'

interface BuildSlot {
  type: SlotType
  abilityId: number | null
}

const INITIAL_BUILD: BuildSlot[] = [
  { type: 'hero', abilityId: null },
  { type: 'spell', abilityId: null },
  { type: 'spell', abilityId: null },
  { type: 'spell', abilityId: null },
  { type: 'ultimate', abilityId: null },
]

// Color constants matching Match page
const COLORS = {
  spell: '#5b8def',
  ultimate: '#f5c542',
  hero: '#2dd4bf',
}

const SHIFT_FIELDS = [
  { key: 'kills', label: 'Kills', better: 'high' },
  { key: 'deaths', label: 'Deaths', better: 'low' },
  { key: 'killAssist', label: 'K+A', better: 'high' },
  { key: 'gpm', label: 'GPM', better: 'high' },
  { key: 'xpm', label: 'XPM', better: 'high' },
  { key: 'dmg', label: 'Damage', better: 'high' },
  { key: 'healing', label: 'Healing', better: 'high' },
] as const

type ShiftKey = typeof SHIFT_FIELDS[number]['key']

const SHIFT_ENTRY_KEYS: Record<ShiftKey, keyof AbilityShiftEntry> = {
  kills: 'killsShift',
  deaths: 'deathsShift',
  killAssist: 'killAssistShift',
  gpm: 'gpmShift',
  xpm: 'xpmShift',
  dmg: 'dmgShift',
  healing: 'healingShift',
}

function getSlotLabel(type: SlotType): string {
  switch (type) {
    case 'hero': return 'Hero Body'
    case 'spell': return 'Ability'
    case 'ultimate': return 'Ultimate'
  }
}

function getSlotColor(type: SlotType): string {
  return COLORS[type]
}

// --- Picker modal ---

interface PickerProps {
  type: SlotType
  onSelect: (id: number) => void
  onClose: () => void
  excludeIds: Set<number>
  availableIds: Set<number>
}

function AbilityPicker({ type, onSelect, onClose, excludeIds, availableIds }: PickerProps) {
  const [search, setSearch] = useState('')
  const searchLower = search.toLowerCase()

  const items = useMemo(() => {
    if (type === 'hero') {
      const heroIds: number[] = []
      availableIds.forEach(id => { if (id < 0) heroIds.push(id) })

      return heroIds
        .map(negId => {
          const hero = getHeroById(Math.abs(negId))
          return hero ? { id: negId, name: hero.englishName, picture: hero.picture, isHero: true as const } : null
        })
        .filter((h): h is NonNullable<typeof h> => h !== null)
        .filter(h => !excludeIds.has(h.id))
        .filter(h => !searchLower || h.name.toLowerCase().includes(searchLower))
        .sort((a, b) => a.name.localeCompare(b.name))
    }

    const isUlt = type === 'ultimate'
    return Object.values(abilitiesById)
      .filter((a): a is Ability => {
        if (!a || !a.englishName || a.valveId <= 0) return false
        if (a.isUltimate !== isUlt) return false
        if (excludeIds.has(a.valveId)) return false
        if (!availableIds.has(a.valveId)) return false
        return true
      })
      .map(a => ({
        id: a.valveId,
        name: a.englishName,
        shortName: a.shortName,
        isUltimate: a.isUltimate ?? false,
        isHero: false as const,
        ownerHeroName: a.ownerHeroId ? getHeroById(a.ownerHeroId)?.englishName : undefined,
      }))
      .filter(a => !searchLower || a.name.toLowerCase().includes(searchLower) || (a.ownerHeroName?.toLowerCase().includes(searchLower)))
      .sort((a, b) => a.name.localeCompare(b.name))
  }, [type, excludeIds, searchLower, availableIds])

  const color = getSlotColor(type)

  return (
    <div className={styles.pickerOverlay} onClick={onClose}>
      <div className={styles.pickerModal} onClick={e => e.stopPropagation()}>
        <div className={styles.pickerHeader}>
          <h3 className={styles.pickerTitle} style={{ color }}>
            Select {getSlotLabel(type)}
          </h3>
          <button className={styles.pickerClose} onClick={onClose}>&times;</button>
        </div>
        <input
          className={styles.pickerSearch}
          type="text"
          placeholder={`Search ${type === 'hero' ? 'heroes' : 'abilities'}...`}
          value={search}
          onChange={e => setSearch(e.target.value)}
          autoFocus
        />
        <div className={styles.pickerGrid}>
          {items.map(item => (
            <button
              key={item.id}
              className={styles.pickerItem}
              onClick={() => onSelect(item.id)}
              title={item.name}
            >
              {item.isHero ? (
                <img
                  src={heroMiniUrl(item.picture)}
                  alt={item.name}
                  className={styles.pickerHeroImg}
                />
              ) : (
                <AbilityIcon
                  id={item.id}
                  name={item.name}
                  shortName={item.shortName}
                  isUltimate={item.isUltimate}
                  size="md"
                  showTooltip={false}
                />
              )}
              <span className={styles.pickerItemName}>{item.name}</span>
            </button>
          ))}
          {items.length === 0 && (
            <div className={styles.pickerEmpty}>No results found</div>
          )}
        </div>
      </div>
    </div>
  )
}

// --- Stat display helpers ---

function formatPercent(v: number): string {
  return (v * 100).toFixed(1) + '%'
}

function formatShift(v: number): string {
  const sign = v >= 0 ? '+' : ''
  return sign + v.toFixed(2)
}

// Percentile color: 0% = red, 50% = neutral, 100% = green
// For "deaths" invert it (lower is better)
function percentileColor(pct: number): string {
  // pct is 0..1
  const t = Math.max(0, Math.min(1, pct))
  if (t < 0.5) {
    // red to yellow
    const r = 239
    const g = Math.round(68 + (197 - 68) * (t / 0.5))
    const b = Math.round(68 * (1 - t / 0.5))
    return `rgb(${r},${g},${b})`
  } else {
    // yellow to green
    const r = Math.round(239 - (239 - 34) * ((t - 0.5) / 0.5))
    const g = Math.round(197 + (197 - 197) * ((t - 0.5) / 0.5))
    const b = Math.round(0 + 94 * ((t - 0.5) / 0.5))
    return `rgb(${r},${g},${b})`
  }
}

// --- URL state ---

const SLOT_PARAM_KEYS = ['hero', 'a1', 'a2', 'a3', 'ult'] as const

function buildFromParams(searchParams: URLSearchParams): BuildSlot[] {
  return INITIAL_BUILD.map((slot, i) => {
    const raw = searchParams.get(SLOT_PARAM_KEYS[i])
    const parsed = raw ? parseInt(raw, 10) : NaN
    return { ...slot, abilityId: isNaN(parsed) ? null : parsed }
  })
}

// --- Shift extremes computation ---

interface ShiftExtremes {
  min: Record<ShiftKey, number>
  max: Record<ShiftKey, number>
}

function computeShiftExtremes(
  shiftsMap: Map<number, AbilityShiftEntry>,
  availableIds: Set<number>,
): ShiftExtremes {
  // Categorize shifts by slot type
  const heroShifts: AbilityShiftEntry[] = []
  const spellShifts: AbilityShiftEntry[] = []
  const ultShifts: AbilityShiftEntry[] = []

  shiftsMap.forEach((shift, id) => {
    if (!availableIds.has(id)) return
    if (id < 0) {
      heroShifts.push(shift)
    } else {
      const ability = getAbilityById(id)
      if (!ability) return
      if (ability.isUltimate) {
        ultShifts.push(shift)
      } else {
        spellShifts.push(shift)
      }
    }
  })

  const makeZero = (): Record<ShiftKey, number> => ({
    kills: 0, deaths: 0, killAssist: 0, gpm: 0, xpm: 0, dmg: 0, healing: 0,
  })

  const min = makeZero()
  const max = makeZero()

  for (const field of SHIFT_FIELDS) {
    const k = field.key
    const entryKey = SHIFT_ENTRY_KEYS[k]

    const getVal = (s: AbilityShiftEntry) => s[entryKey] as number

    // Best/worst hero
    const heroVals = heroShifts.map(getVal)
    const heroMin = heroVals.length > 0 ? Math.min(...heroVals) : 0
    const heroMax = heroVals.length > 0 ? Math.max(...heroVals) : 0

    // Top/bottom 3 spells
    const spellVals = spellShifts.map(getVal).sort((a, b) => a - b)
    const spellMin3 = spellVals.slice(0, 3).reduce((s, v) => s + v, 0)
    const spellMax3 = spellVals.slice(-3).reduce((s, v) => s + v, 0)

    // Best/worst ultimate
    const ultVals = ultShifts.map(getVal)
    const ultMin = ultVals.length > 0 ? Math.min(...ultVals) : 0
    const ultMax = ultVals.length > 0 ? Math.max(...ultVals) : 0

    min[k] = heroMin + spellMin3 + ultMin
    max[k] = heroMax + spellMax3 + ultMax
  }

  return { min, max }
}

// --- Main page ---

export function HeroBuilderPage() {
  const { patches, currentPatch } = usePatchSelection()
  const [searchParams, setSearchParams] = useSearchParams()
  const [pickerSlot, setPickerSlot] = useState<number | null>(null)
  const didAutoSetPatch = useRef(false)

  // Auto-set patch to latest when no patch param in URL
  useEffect(() => {
    if (didAutoSetPatch.current) return
    if (patches.length === 0) return
    if (searchParams.has('patch')) return
    didAutoSetPatch.current = true
    const latest = patches[patches.length - 1]
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      next.set('patch', latest)
      return next
    }, { replace: true })
  }, [patches, searchParams, setSearchParams])

  // Hydrate build from URL params
  const build = useMemo(() => buildFromParams(searchParams), [searchParams])

  // Helper to update a single slot in the URL
  const updateSlot = useCallback((index: number, abilityId: number | null) => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      const key = SLOT_PARAM_KEYS[index]
      if (abilityId !== null) {
        next.set(key, String(abilityId))
      } else {
        next.delete(key)
      }
      return next
    })
  }, [setSearchParams])

  // Fetch data
  const patchParams = currentPatch ? { patch: currentPatch } : undefined

  const { data: abilitiesData } = usePersistedQuery<AbilitiesApiResponse>(
    '/abilities', patchParams
  )
  const { data: pairsData } = usePersistedQuery<AbilityPairsApiResponse>(
    '/ability-pairs', patchParams
  )
  const { data: shiftsData } = usePersistedQuery<AbilityShiftsApiResponse>(
    '/ability-shifts', patchParams
  )
  const { data: aghsData } = usePersistedQuery<AbilityAghsApiResponse>(
    '/ability-aghs', patchParams
  )
  const { data: heroesData } = usePersistedQuery<HeroesApiResponse>(
    '/heroes', patchParams
  )

  // Build lookup maps
  const abilityStatsMap = useMemo(() => {
    const map = new Map<number, AbilityStatEntry>()
    abilitiesData?.data?.abilityStats?.forEach(s => map.set(s.abilityId, s))
    return map
  }, [abilitiesData])

  const pairsMap = useMemo(() => {
    const map = new Map<string, AbilityPairEntry>()
    pairsData?.data?.abilityPairs?.forEach(p => {
      const key = p.abilityIdOne < p.abilityIdTwo
        ? `${p.abilityIdOne}-${p.abilityIdTwo}`
        : `${p.abilityIdTwo}-${p.abilityIdOne}`
      map.set(key, p)
    })
    return map
  }, [pairsData])

  const pairWinrates = useMemo(() => {
    const map = new Map<number, number>()
    pairsData?.data?.abilityStats?.forEach(s => map.set(s.abilityId, s.winrate))
    return map
  }, [pairsData])

  const shiftsMap = useMemo(() => {
    const map = new Map<number, AbilityShiftEntry>()
    shiftsData?.data?.abilityShifts?.forEach(s => map.set(s.abilityId, s))
    return map
  }, [shiftsData])

  const aghsMap = useMemo(() => {
    const map = new Map<number, AbilityAghsEntry>()
    aghsData?.data?.abilityAghs?.forEach(s => map.set(s.abilityId, s))
    return map
  }, [aghsData])

  // Hero stats lookup (heroId -> { winrate, numGames })
  const heroStatsMap = useMemo(() => {
    const map = new Map<number, { winrate: number; numGames: number }>()
    if (!heroesData?.data?.heroStats || !currentPatch) return map
    const patchStats = heroesData.data.heroStats
    for (const [heroId, patches] of Object.entries(patchStats)) {
      const stat = patches[currentPatch]
      if (stat) map.set(Number(heroId), { winrate: stat.winrate, numGames: stat.numGames })
    }
    return map
  }, [heroesData, currentPatch])

  // Set of ability/hero IDs that exist in this patch's stats
  const availableIds = useMemo(() => {
    const set = new Set<number>()
    abilitiesData?.data?.abilityStats?.forEach(s => set.add(s.abilityId))
    return set
  }, [abilitiesData])

  // Selected IDs (for excluding from picker)
  const selectedIds = useMemo(() => {
    const set = new Set<number>()
    build.forEach(slot => {
      if (slot.abilityId !== null) set.add(slot.abilityId)
    })
    return set
  }, [build])

  // Handlers
  const handleSlotClick = useCallback((index: number) => {
    setPickerSlot(index)
  }, [])

  const handleSelect = useCallback((id: number) => {
    if (pickerSlot === null) return
    updateSlot(pickerSlot, id)
    setPickerSlot(null)
  }, [pickerSlot, updateSlot])

  const handleClearSlot = useCallback((index: number) => {
    updateSlot(index, null)
  }, [updateSlot])

  const handleReset = useCallback(() => {
    setSearchParams(prev => {
      const next = new URLSearchParams(prev)
      SLOT_PARAM_KEYS.forEach(key => next.delete(key))
      return next
    })
  }, [setSearchParams])

  // Resolved abilities for display
  const resolvedSlots = useMemo(() => {
    return build.map(slot => {
      if (slot.abilityId === null) return { ...slot, ability: null, hero: null }
      if (slot.type === 'hero') {
        const hero = getHeroById(Math.abs(slot.abilityId))
        return { ...slot, ability: null, hero: hero ?? null }
      }
      const ability = getAbilityById(slot.abilityId)
      return { ...slot, ability: ability ?? null, hero: null }
    })
  }, [build])

  // All selected IDs (including hero body) for pair synergy
  const allSelectedAbilityIds = useMemo(() => {
    return build
      .filter(s => s.abilityId !== null)
      .map(s => s.abilityId!)
  }, [build])

  // Compute pairwise synergies for ALL selected slots (including hero body)
  const synergies = useMemo(() => {
    const ids = allSelectedAbilityIds
    const results: Array<{
      idA: number; idB: number
      nameA: string; nameB: string
      synergy: number; numPicks: number
    }> = []

    for (let i = 0; i < ids.length; i++) {
      for (let j = i + 1; j < ids.length; j++) {
        const a = ids[i]
        const b = ids[j]
        const key = a < b ? `${a}-${b}` : `${b}-${a}`
        const pair = pairsMap.get(key)
        if (pair && pair.numPicks >= 5) {
          const wrA = pairWinrates.get(a) ?? 0.5
          const wrB = pairWinrates.get(b) ?? 0.5
          const expected = (wrA + wrB) / 2
          const synergy = pair.winrate - expected

          const nameForId = (id: number): string => {
            if (id < 0) return getHeroById(Math.abs(id))?.englishName ?? `Hero ${Math.abs(id)}`
            return getAbilityById(id)?.englishName ?? `#${id}`
          }

          results.push({
            idA: a, idB: b,
            nameA: nameForId(a), nameB: nameForId(b),
            synergy, numPicks: pair.numPicks,
          })
        }
      }
    }

    return results.sort((a, b) => Math.abs(b.synergy) - Math.abs(a.synergy))
  }, [allSelectedAbilityIds, pairsMap, pairWinrates])

  // Aggregate shift stats for ALL selected slots (including hero body)
  const aggregateShifts = useMemo(() => {
    const ids = allSelectedAbilityIds
    if (ids.length === 0) return null

    const totals: Record<ShiftKey, number> = {
      kills: 0, deaths: 0, killAssist: 0, gpm: 0, xpm: 0, dmg: 0, healing: 0,
    }
    let count = 0

    ids.forEach(id => {
      const shift = shiftsMap.get(id)
      if (shift) {
        for (const field of SHIFT_FIELDS) {
          totals[field.key] += shift[SHIFT_ENTRY_KEYS[field.key]] as number
        }
        count++
      }
    })

    return count > 0 ? totals : null
  }, [allSelectedAbilityIds, shiftsMap])

  // Shift extremes for percentile calculation
  const shiftExtremes = useMemo(() => {
    if (shiftsMap.size === 0) return null
    return computeShiftExtremes(shiftsMap, availableIds)
  }, [shiftsMap, availableIds])

  // Aghs info for selected abilities (non-hero only)
  const aghsInfo = useMemo(() => {
    return build
      .filter(s => s.type !== 'hero' && s.abilityId !== null)
      .map(s => {
        const aghs = aghsMap.get(s.abilityId!)
        const ability = getAbilityById(s.abilityId!)
        if (!aghs || !ability) return null
        if (!ability.hasScepter && !ability.hasShard) return null
        return {
          abilityId: s.abilityId!,
          name: ability.englishName,
          shortName: ability.shortName,
          isUltimate: ability.isUltimate ?? false,
          hasScepter: ability.hasScepter ?? false,
          hasShard: ability.hasShard ?? false,
          scepter: aghs.aghsScepter,
          shard: aghs.aghsShard,
          totalGames: aghs.totalGames,
        }
      })
      .filter((a): a is NonNullable<typeof a> => a !== null)
  }, [build, aghsMap])

  const filledCount = build.filter(s => s.abilityId !== null).length

  // Render icon for an ability/hero ID (used in synergy pairs)
  const renderPairIcon = (id: number) => {
    if (id < 0) {
      const hero = getHeroById(Math.abs(id))
      if (!hero) return null
      return (
        <img
          src={heroMiniUrl(hero.picture)}
          alt={hero.englishName}
          title={hero.englishName}
          className={styles.synergyHeroImg}
        />
      )
    }
    const ability = getAbilityById(id)
    if (!ability) return null
    return (
      <AbilityIcon
        id={id}
        name={ability.englishName}
        shortName={ability.shortName}
        isUltimate={ability.isUltimate ?? false}
        size="sm"
      />
    )
  }

  return (
    <PageShell
      title="Hero Builder"
      actions={<PatchSelector />}
    >
      <div className={styles.builderLayout}>
        {/* Left column: build slots + stat shifts */}
        <div className={styles.buildColumn}>
          <div className={styles.slotsRow}>
            {build.map((slot, idx) => {
              const resolved = resolvedSlots[idx]
              const color = getSlotColor(slot.type)
              const bgColor = color + '14'
              const borderColor = slot.abilityId !== null ? color + '80' : color + '40'

              // Per-slot stats
              const abilityStat = slot.abilityId !== null ? abilityStatsMap.get(slot.abilityId) : undefined
              const heroStat = slot.type === 'hero' && slot.abilityId !== null
                ? heroStatsMap.get(Math.abs(slot.abilityId))
                : undefined

              return (
                <div key={idx} className={styles.slotWrapper}>
                  <div className={styles.slotLabel} style={{ color }}>
                    {getSlotLabel(slot.type)}
                  </div>
                  <div
                    className={`${styles.slot} ${slot.abilityId !== null ? styles.slotFilled : ''}`}
                    style={{ backgroundColor: bgColor, borderColor }}
                    onClick={() => slot.abilityId === null ? handleSlotClick(idx) : undefined}
                  >
                    {slot.abilityId === null ? (
                      <button
                        className={styles.addButton}
                        style={{ color }}
                        onClick={() => handleSlotClick(idx)}
                      >
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={styles.addIcon}>
                          <line x1="12" y1="5" x2="12" y2="19" />
                          <line x1="5" y1="12" x2="19" y2="12" />
                        </svg>
                      </button>
                    ) : slot.type === 'hero' && resolved.hero ? (
                      <div className={styles.slotContent}>
                        <img
                          src={heroMiniUrl(resolved.hero.picture)}
                          alt={resolved.hero.englishName}
                          className={styles.slotHeroImg}
                        />
                        <span className={styles.slotName}>{resolved.hero.englishName}</span>
                      </div>
                    ) : resolved.ability ? (
                      <div className={styles.slotContent}>
                        <AbilityIcon
                          id={slot.abilityId!}
                          name={resolved.ability.englishName}
                          shortName={resolved.ability.shortName}
                          isUltimate={resolved.ability.isUltimate ?? false}
                          size="lg"
                          showTooltip={false}
                        />
                        <span className={styles.slotName}>{resolved.ability.englishName}</span>
                      </div>
                    ) : (
                      <span className={styles.slotName}>Unknown</span>
                    )}
                    {slot.abilityId !== null && (
                      <button
                        className={styles.clearButton}
                        onClick={(e) => { e.stopPropagation(); handleClearSlot(idx) }}
                        title="Remove"
                      >
                        &times;
                      </button>
                    )}
                  </div>
                  {/* Per-slot mini stats */}
                  {slot.abilityId !== null && (abilityStat || heroStat) && (
                    <div className={styles.slotMiniStats}>
                      {slot.type === 'hero' && heroStat ? (
                        <>
                          <div className={styles.miniStat}>
                            <span className={styles.miniStatLabel}>WR%</span>
                            <span className={styles.miniStatValue}>{formatPercent(heroStat.winrate)}</span>
                          </div>
                          <div className={styles.miniStat}>
                            <span className={styles.miniStatLabel}>Games</span>
                            <span className={styles.miniStatValue}>{heroStat.numGames.toLocaleString()}</span>
                          </div>
                          {abilityStat && (
                            <div className={styles.miniStat}>
                              <span className={styles.miniStatLabel}>Avg Pick</span>
                              <span className={styles.miniStatValue}>{abilityStat.avgPickPosition.toFixed(1)}</span>
                            </div>
                          )}
                        </>
                      ) : abilityStat ? (
                        <>
                          <div className={styles.miniStat}>
                            <span className={styles.miniStatLabel}>WR%</span>
                            <span className={styles.miniStatValue}>{formatPercent(abilityStat.winrate)}</span>
                          </div>
                          <div className={styles.miniStat}>
                            <span className={styles.miniStatLabel}>Picks</span>
                            <span className={styles.miniStatValue}>{abilityStat.numPicks.toLocaleString()}</span>
                          </div>
                          <div className={styles.miniStat}>
                            <span className={styles.miniStatLabel}>Avg Pick</span>
                            <span className={styles.miniStatValue}>{abilityStat.avgPickPosition.toFixed(1)}</span>
                          </div>
                        </>
                      ) : null}
                    </div>
                  )}
                </div>
              )
            })}
          </div>

          {filledCount > 0 && (
            <button className={styles.resetButton} onClick={handleReset}>
              Reset Build
            </button>
          )}

          {/* Combined Stat Shifts */}
          {aggregateShifts && (
            <div className={styles.statsSection}>
              <h3 className={styles.statsSectionTitle}>Combined Stat Shifts</h3>
              <div className={styles.shiftGrid}>
                {SHIFT_FIELDS.map(field => {
                  const value = aggregateShifts[field.key]
                  let percentile: number | null = null
                  if (shiftExtremes) {
                    const range = shiftExtremes.max[field.key] - shiftExtremes.min[field.key]
                    if (range > 0) {
                      const raw = (value - shiftExtremes.min[field.key]) / range
                      percentile = field.better === 'low' ? 1 - raw : raw
                    }
                  }
                  const pctColor = percentile !== null ? percentileColor(percentile) : undefined

                  return (
                    <div key={field.key} className={styles.shiftItem}>
                      <span className={styles.shiftLabel}>{field.label}</span>
                      <span
                        className={styles.shiftValue}
                        style={pctColor ? { color: pctColor } : undefined}
                      >
                        {formatShift(value)}
                      </span>
                      {percentile !== null && (
                        <span
                          className={styles.shiftPercentile}
                          style={{ color: pctColor }}
                        >
                          {Math.round(percentile * 100)}th pct
                        </span>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>

        {/* Right column: synergies + aghs */}
        {filledCount > 0 && (
          <div className={styles.statsColumn}>
            {synergies.length > 0 && (
              <div className={styles.statsSection}>
                <h3 className={styles.statsSectionTitle}>Pair Synergies</h3>
                <div className={styles.synergyList}>
                  {synergies.map(s => (
                    <div key={`${s.idA}-${s.idB}`} className={styles.synergyRow}>
                      <div className={styles.synergyIcons}>
                        {renderPairIcon(s.idA)}
                        <span className={styles.synergyPlus}>+</span>
                        {renderPairIcon(s.idB)}
                      </div>
                      <span
                        className={styles.synergyValue}
                        style={{ color: s.synergy >= 0 ? '#22c55e' : '#ef4444' }}
                      >
                        {s.synergy >= 0 ? '+' : ''}{(s.synergy * 100).toFixed(1)}%
                      </span>
                      <span className={styles.synergyPicks}>({s.numPicks})</span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {aghsInfo.length > 0 && (
              <div className={styles.statsSection}>
                <h3 className={styles.statsSectionTitle}>Aghanim's Upgrades</h3>
                <div className={styles.aghsList}>
                  {aghsInfo.map(a => (
                    <div key={a.abilityId} className={styles.aghsRow}>
                      <div className={styles.aghsAbility}>
                        <AbilityIcon
                          id={a.abilityId}
                          name={a.name}
                          shortName={a.shortName}
                          isUltimate={a.isUltimate}
                          size="sm"
                          showTooltip={false}
                        />
                        <span>{a.name}</span>
                      </div>
                      {a.hasScepter && a.scepter.total > 0 && (() => {
                        const pickupRate = (a.scepter.total / a.totalGames) * 100
                        const withoutTotal = a.totalGames - a.scepter.total
                        const withoutWins = (abilityStatsMap.get(a.abilityId)?.wins ?? 0) - a.scepter.wins
                        const withoutWr = withoutTotal > 0 ? withoutWins / withoutTotal : 0
                        const wrShift = a.scepter.winrate - withoutWr
                        return (
                          <div className={styles.aghsBlock}>
                            <span className={styles.aghsLabel}>Scepter</span>
                            <div className={styles.aghsStatLine}>
                              <span className={styles.aghsStatKey}>Winrate with</span>
                              <span className={styles.aghsStatVal} style={{ color: a.scepter.winrate >= 0.5 ? '#22c55e' : '#ef4444' }}>
                                {formatPercent(a.scepter.winrate)}
                              </span>
                            </div>
                            <div className={styles.aghsStatLine}>
                              <span className={styles.aghsStatKey}>Winrate without</span>
                              <span className={styles.aghsStatVal} style={{ color: withoutWr >= 0.5 ? '#22c55e' : '#ef4444' }}>
                                {formatPercent(withoutWr)}
                              </span>
                              <span className={styles.aghsShift} style={{ color: wrShift >= 0 ? '#22c55e' : '#ef4444' }}>
                                ({wrShift >= 0 ? '+' : ''}{(wrShift * 100).toFixed(1)}%)
                              </span>
                            </div>
                            <div className={styles.aghsStatLine}>
                              <span className={styles.aghsStatKey}>Pickup rate</span>
                              <span className={styles.aghsStatVal}>{pickupRate.toFixed(1)}%</span>
                              <span className={styles.aghsPicks}>({a.scepter.total.toLocaleString()} games)</span>
                            </div>
                          </div>
                        )
                      })()}
                      {a.hasShard && a.shard.total > 0 && (() => {
                        const pickupRate = (a.shard.total / a.totalGames) * 100
                        const withoutTotal = a.totalGames - a.shard.total
                        const withoutWins = (abilityStatsMap.get(a.abilityId)?.wins ?? 0) - a.shard.wins
                        const withoutWr = withoutTotal > 0 ? withoutWins / withoutTotal : 0
                        const wrShift = a.shard.winrate - withoutWr
                        return (
                          <div className={styles.aghsBlock}>
                            <span className={styles.aghsLabel}>Shard</span>
                            <div className={styles.aghsStatLine}>
                              <span className={styles.aghsStatKey}>Winrate with</span>
                              <span className={styles.aghsStatVal} style={{ color: a.shard.winrate >= 0.5 ? '#22c55e' : '#ef4444' }}>
                                {formatPercent(a.shard.winrate)}
                              </span>
                            </div>
                            <div className={styles.aghsStatLine}>
                              <span className={styles.aghsStatKey}>Winrate without</span>
                              <span className={styles.aghsStatVal} style={{ color: withoutWr >= 0.5 ? '#22c55e' : '#ef4444' }}>
                                {formatPercent(withoutWr)}
                              </span>
                              <span className={styles.aghsShift} style={{ color: wrShift >= 0 ? '#22c55e' : '#ef4444' }}>
                                ({wrShift >= 0 ? '+' : ''}{(wrShift * 100).toFixed(1)}%)
                              </span>
                            </div>
                            <div className={styles.aghsStatLine}>
                              <span className={styles.aghsStatKey}>Pickup rate</span>
                              <span className={styles.aghsStatVal}>{pickupRate.toFixed(1)}%</span>
                              <span className={styles.aghsPicks}>({a.shard.total.toLocaleString()} games)</span>
                            </div>
                          </div>
                        )
                      })()}
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Picker modal */}
      {pickerSlot !== null && (
        <AbilityPicker
          type={build[pickerSlot].type}
          onSelect={handleSelect}
          onClose={() => setPickerSlot(null)}
          excludeIds={selectedIds}
          availableIds={availableIds}
        />
      )}
    </PageShell>
  )
}
