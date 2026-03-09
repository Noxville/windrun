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
  ignored?: number
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

// --- Build availability computation ---

const AVAILABILITY_THRESHOLD = 100

/** Binomial coefficient C(n, k) */
function comb(n: number, k: number): number {
  if (k < 0 || k > n) return 0
  if (k === 0 || k === n) return 1
  const j = Math.min(k, n - k)
  let result = 1
  for (let i = 0; i < j; i++) {
    result = result * (n - i) / (i + 1)
  }
  return result
}

/** For each hero in the patch, track which spells and ultimates they bring to the pool */
interface HeroAbilityPool {
  heroId: number
  spells: number[]    // eligible non-ultimate ability IDs (numPicks + ignored >= threshold)
  ultimates: number[] // eligible ultimate ability IDs
}

/** A step in the availability breakdown shown to the user */
interface AvailabilityStep {
  label: string       // e.g. "Mirana (body)" or "Sacred Arrow + Starstorm"
  detail: string      // e.g. "12 / 127 = 9.45%" or "same hero, all 3 spells included"
  subDetail?: string  // e.g. "primary 8.66% + filler 0.04%"
}

interface AvailabilityResult {
  probability: number
  heroesAvailable: number
  steps: AvailabilityStep[]
}

/**
 * Compute the probability that a given build is available in a random draft.
 *
 * Draft mechanics (per game):
 *   1. 12 heroes are randomly chosen from N available heroes.
 *   2. For each chosen hero, all eligible ultimates are auto-added.
 *      If a hero has 0 eligible ultimates, 1 random ultimate from the global pool is added.
 *   3. For each chosen hero, 3 non-ultimate abilities are added:
 *      - If hero has exactly 3 eligible spells → all 3 added.
 *      - If hero has > 3 eligible spells → 3 randomly chosen.
 *      - If hero has < 3 eligible spells → all added, rest filled with random spells from the global pool.
 *
 * Calculation approach:
 *   - The body hero must always be drafted (no filler path for hero bodies).
 *   - Non-body abilities are grouped by their owner hero. For each group, the abilities
 *     can appear via "primary" (owner hero drafted, abilities selected from their pool)
 *     or via "filler" (owner hero NOT drafted, abilities drawn as fillers by other heroes).
 *   - We enumerate all 2^G combinations (primary vs filler per group, G ≤ 4) and sum
 *     the exact probability for each scenario.
 *   - Filler probability per ability is approximate: expectedFillerSlots / totalPoolSize.
 */
function computeBuildAvailability(
  build: BuildSlot[],
  abilityStatsMap: Map<number, AbilityStatEntry>,
): AvailabilityResult | null {
  const filledSlots = build.filter(s => s.abilityId !== null)
  if (filledSlots.length === 0) return null

  const steps: AvailabilityStep[] = []

  // ─── Step 1: Build hero ability pools ─────────────────────────────────────
  // A hero is "available" if its body (negative abilityId) has numPicks + ignored >= threshold.
  const heroPools = new Map<number, HeroAbilityPool>()

  abilityStatsMap.forEach((stat, id) => {
    if (id >= 0) return
    const total = stat.numPicks + (stat.ignored ?? 0)
    if (total >= AVAILABILITY_THRESHOLD) {
      heroPools.set(Math.abs(id), { heroId: Math.abs(id), spells: [], ultimates: [] })
    }
  })

  // Assign each eligible ability to its owner hero
  abilityStatsMap.forEach((stat, id) => {
    if (id <= 0) return
    const total = stat.numPicks + (stat.ignored ?? 0)
    if (total < AVAILABILITY_THRESHOLD) return
    const ability = getAbilityById(id)
    if (!ability?.ownerHeroId) return
    const pool = heroPools.get(ability.ownerHeroId)
    if (!pool) return
    if (ability.isUltimate) pool.ultimates.push(id)
    else pool.spells.push(id)
  })

  const N = heroPools.size
  if (N < 12) return null

  // ─── Step 2: Compute filler statistics ────────────────────────────────────
  // These tell us how many filler slots we expect per game, used to estimate
  // the probability of a specific ability appearing as a filler.
  let totalEligibleUlts = 0
  let totalEligibleSpells = 0
  let heroesWithZeroUlts = 0
  let totalSpellDeficit = 0 // sum of max(0, 3 - numSpells) across all heroes

  heroPools.forEach(pool => {
    totalEligibleUlts += pool.ultimates.length
    totalEligibleSpells += pool.spells.length
    if (pool.ultimates.length === 0) heroesWithZeroUlts++
    if (pool.spells.length < 3) totalSpellDeficit += (3 - pool.spells.length)
  })

  // Expected filler slots per game:
  //   Each drafted hero with 0 ults → 1 filler ult slot
  //   Each drafted hero with K<3 spells → (3-K) filler spell slots
  const expectedFillerUltSlots = 12 * heroesWithZeroUlts / N
  const expectedFillerSpellSlots = 12 * totalSpellDeficit / N

  steps.push({
    label: 'Draft pool',
    detail: `${N} heroes available, 12 drafted per game`,
  })

  // ─── Step 3: Identify body hero and group abilities by owner ──────────────
  const bodySlot = filledSlots.find(s => s.type === 'hero')
  const bodyHeroId = bodySlot ? Math.abs(bodySlot.abilityId!) : null

  // Each non-body ability grouped by its owner hero
  interface AbilityGroup {
    heroId: number
    heroName: string
    neededSpells: number[]
    neededUlts: number[]
    pool: HeroAbilityPool | undefined
    // Precomputed probabilities:
    pSelectionGivenDrafted: number // P(all needed abilities selected | owner hero is drafted)
    pFillerGivenNotDrafted: number // P(all needed abilities appear as fillers | owner NOT drafted)
  }

  const groupMap = new Map<number, AbilityGroup>()

  for (const slot of filledSlots) {
    if (slot.type === 'hero') continue
    const ability = getAbilityById(slot.abilityId!)
    if (!ability?.ownerHeroId) continue

    const heroId = ability.ownerHeroId
    if (!groupMap.has(heroId)) {
      groupMap.set(heroId, {
        heroId,
        heroName: getHeroById(heroId)?.englishName ?? `Hero #${heroId}`,
        neededSpells: [],
        neededUlts: [],
        pool: heroPools.get(heroId),
        pSelectionGivenDrafted: 1,
        pFillerGivenNotDrafted: 1,
      })
    }
    const group = groupMap.get(heroId)!
    if (slot.type === 'ultimate') group.neededUlts.push(slot.abilityId!)
    else group.neededSpells.push(slot.abilityId!)
  }

  // ─── Step 4: Compute per-group probabilities ──────────────────────────────

  // Separate groups: those whose owner IS the body hero vs others
  const bodyGroups: AbilityGroup[] = []     // abilities from the body hero (always primary)
  const otherGroups: AbilityGroup[] = []    // abilities from other heroes (primary or filler)

  for (const group of groupMap.values()) {
    if (group.heroId === bodyHeroId) bodyGroups.push(group)
    else otherGroups.push(group)
  }

  // Helper: compute P(abilities selected from hero | hero drafted)
  function computeSelectionProb(group: AbilityGroup): number {
    const pool = group.pool
    if (!pool) return 0

    // Ultimates: auto-added. Verify they exist in the hero's eligible list.
    for (const ultId of group.neededUlts) {
      if (!pool.ultimates.includes(ultId)) return 0
    }

    // Spells: depends on how many eligible spells the hero has
    const M = pool.spells.length
    const J = group.neededSpells.length
    if (J === 0) return 1
    for (const spellId of group.neededSpells) {
      if (!pool.spells.includes(spellId)) return 0
    }
    if (M <= 3) return 1
    // C(M-J, 3-J) / C(M, 3): probability that all J specific spells are among the 3 chosen
    return comb(M - J, 3 - J) / comb(M, 3)
  }

  // Helper: compute P(all abilities appear as fillers | owner hero NOT drafted)
  function computeFillerProb(group: AbilityGroup): number {
    let p = 1

    // Each needed ultimate: approximate P(drawn as a filler ult)
    // Filler ult slots arise from heroes with 0 eligible ultimates being drafted.
    // P(specific ult drawn) ≈ expectedFillerUltSlots / totalEligibleUlts
    for (let i = 0; i < group.neededUlts.length; i++) {
      if (totalEligibleUlts === 0) return 0
      p *= expectedFillerUltSlots / totalEligibleUlts
    }

    // Each needed spell: approximate P(drawn as a filler spell)
    // Filler spell slots arise from heroes with <3 eligible spells being drafted.
    // P(specific spell drawn) ≈ expectedFillerSpellSlots / totalEligibleSpells
    for (let i = 0; i < group.neededSpells.length; i++) {
      if (totalEligibleSpells === 0) return 0
      p *= expectedFillerSpellSlots / totalEligibleSpells
    }

    return p
  }

  // Compute probabilities for each group
  for (const group of [...bodyGroups, ...otherGroups]) {
    group.pSelectionGivenDrafted = computeSelectionProb(group)
    group.pFillerGivenNotDrafted = computeFillerProb(group)
  }

  // ─── Step 5: Body hero probability ────────────────────────────────────────
  // The body hero must always be drafted. No filler path for hero bodies.
  let pBody = 1
  let bodySelectionP = 1

  if (bodyHeroId !== null) {
    pBody = 12 / N
    const bodyHeroName = getHeroById(bodyHeroId)?.englishName ?? `Hero #${bodyHeroId}`
    steps.push({
      label: `${bodyHeroName} (body)`,
      detail: `must be drafted: 12 / ${N} = ${(pBody * 100).toFixed(2)}%`,
    })

    // If any abilities also come from the body hero, they're always primary
    for (const group of bodyGroups) {
      bodySelectionP *= group.pSelectionGivenDrafted
      if (bodySelectionP === 0) {
        steps.push({
          label: abilityNamesForGroup(group),
          detail: 'not eligible for this hero',
        })
        return { probability: 0, heroesAvailable: N, steps }
      }

      const pool = group.pool!
      const M = pool.spells.length
      const J = group.neededSpells.length
      const names = abilityNamesForGroup(group)

      if (group.neededUlts.length > 0 && J === 0) {
        steps.push({ label: names, detail: `same hero as body, ult auto-added` })
      } else if (M <= 3 || J === 0) {
        steps.push({ label: names, detail: `same hero as body, all ${M} spells included` })
      } else {
        steps.push({
          label: names,
          detail: `same hero, ${J} of ${M} spells (3 chosen) = ${(bodySelectionP * 100).toFixed(2)}%`,
        })
      }
    }
  }

  // ─── Step 6: Enumerate primary/filler combinations for other groups ───────
  // For each non-body group, the abilities can arrive via:
  //   - Primary: owner hero is drafted AND abilities are selected from their pool.
  //   - Filler: owner hero is NOT drafted AND abilities appear as random fillers.
  //
  // We enumerate all 2^G combinations and sum the exact probability for each.
  // G is at most 4 (for a 5-slot build where every ability is from a different hero).
  const G = otherGroups.length
  const numCombos = 1 << G  // 2^G
  let totalP = 0

  for (let combo = 0; combo < numCombos; combo++) {
    // Determine which groups use primary (bit=1) vs filler (bit=0)
    const primaryIdxs: number[] = []
    const fillerIdxs: number[] = []
    for (let g = 0; g < G; g++) {
      if (combo & (1 << g)) primaryIdxs.push(g)
      else fillerIdxs.push(g)
    }

    const numPrimaryHeroes = primaryIdxs.length
    // k = total heroes that must be drafted: body (if set) + primary groups
    const k = (bodyHeroId !== null ? 1 : 0) + numPrimaryHeroes
    // m = filler groups whose heroes must NOT be drafted
    const m = fillerIdxs.length

    // P(all k required heroes are among the 12 drafted):
    //   = (12/N) × (11/(N-1)) × ... × ((12-k+1)/(N-k+1))
    let pHeroesDrafted = pBody
    for (let i = 0; i < numPrimaryHeroes; i++) {
      const slotsLeft = 12 - (bodyHeroId !== null ? 1 : 0) - i
      const heroesLeft = N - (bodyHeroId !== null ? 1 : 0) - i
      pHeroesDrafted *= slotsLeft / heroesLeft
    }

    // P(filler groups' heroes are NOT among the 12 | required heroes are drafted):
    //   The remaining 12-k slots are filled from N-k heroes (excluding required ones).
    //   P(specific hero NOT in remaining) uses sequential exclusion:
    //   = (N-12)/(N-k) × (N-12-1)/(N-k-1) × ...
    let pHeroesExcluded = 1
    for (let j = 0; j < m; j++) {
      pHeroesExcluded *= (N - 12 - j) / (N - k - j)
    }

    // P(ability selection for primary groups):
    let pSelection = bodySelectionP
    for (const gi of primaryIdxs) {
      pSelection *= otherGroups[gi].pSelectionGivenDrafted
    }

    // P(filler draws for filler groups):
    let pFiller = 1
    for (const gi of fillerIdxs) {
      pFiller *= otherGroups[gi].pFillerGivenNotDrafted
    }

    totalP += pHeroesDrafted * pHeroesExcluded * pSelection * pFiller
  }

  // ─── Step 7: Build per-group breakdown for display ────────────────────────
  for (const group of otherGroups) {
    const names = abilityNamesForGroup(group)

    // Per-group marginal: P(primary path) + P(filler path)
    const slotsForHero = 12 - (bodyHeroId !== null ? 1 : 0)
    const heroesForHero = N - (bodyHeroId !== null ? 1 : 0)
    const pHeroDrafted = slotsForHero / heroesForHero
    const pPrimary = pHeroDrafted * group.pSelectionGivenDrafted
    const pFillerPath = (1 - pHeroDrafted) * group.pFillerGivenNotDrafted

    const pool = group.pool
    const M = pool?.spells.length ?? 0
    const J = group.neededSpells.length

    let detail = `via ${group.heroName}: ${slotsForHero}/${heroesForHero}`
    if (M > 3 && J > 0) {
      detail += ` × ${J}/${M} spell selection`
    }
    detail += ` = ${(pPrimary * 100).toFixed(2)}%`

    const step: AvailabilityStep = { label: names, detail }

    if (pFillerPath > 0.00001) {
      step.subDetail = `+ filler path: ~${(pFillerPath * 100).toFixed(4)}%`
    }

    steps.push(step)
  }

  // Show filler context if any filler paths exist
  if (expectedFillerUltSlots > 0 || expectedFillerSpellSlots > 0) {
    const parts: string[] = []
    if (expectedFillerUltSlots > 0) {
      parts.push(`~${expectedFillerUltSlots.toFixed(1)} filler ult slots/game (${heroesWithZeroUlts} heroes with no ult)`)
    }
    if (expectedFillerSpellSlots > 0) {
      parts.push(`~${expectedFillerSpellSlots.toFixed(1)} filler spell slots/game`)
    }
    steps.push({ label: 'Filler context', detail: parts.join('; ') })
  }

  return { probability: totalP, heroesAvailable: N, steps }
}

/** Format ability names for a hero group */
function abilityNamesForGroup(group: { neededUlts: number[]; neededSpells: number[] }): string {
  const names = [
    ...group.neededUlts.map(id => getAbilityById(id)?.englishName ?? `#${id}`),
    ...group.neededSpells.map(id => getAbilityById(id)?.englishName ?? `#${id}`),
  ]
  return names.join(' + ')
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

  // Build availability: probability this exact build could appear in a random draft
  const availability = useMemo(() => {
    return computeBuildAvailability(build, abilityStatsMap)
  }, [build, abilityStatsMap])

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

          {/* Build Availability */}
          {availability && (
            <div className={styles.statsSection}>
              <h3 className={styles.statsSectionTitle}>Build Availability</h3>
              <div className={styles.availabilityHeader}>
                <span className={styles.availabilityValue}>
                  {availability.probability < 0.00005
                    ? '< 0.01%'
                    : (availability.probability * 100).toFixed(4) + '%'}
                </span>
                <span className={styles.availabilityApprox}>
                  ~1 / {availability.probability > 0
                    ? Math.round(1 / availability.probability).toLocaleString()
                    : '∞'} games
                </span>
              </div>
              <div className={styles.availabilityBreakdown}>
                {availability.steps.map((step, i) => (
                  <div key={i} className={styles.availabilityStep}>
                    <span className={styles.availabilityStepLabel}>{step.label}</span>
                    <span className={styles.availabilityStepDetail}>{step.detail}</span>
                    {step.subDetail && (
                      <span className={styles.availabilityStepSub}>{step.subDetail}</span>
                    )}
                  </div>
                ))}
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
