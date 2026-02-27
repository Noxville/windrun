import { useMemo, useLayoutEffect, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { PageShell } from '../components/PageShell'
import {
  DataTable,
  AbilityInline,
  HeroInline,
  PatchSelector,
  usePatchSelection,
} from '../components'
import { usePersistedQuery } from '../api'
import { getAbilityById, getHeroById } from '../data'
import styles from './AbilityByTime.module.css'

// Tag definitions
interface TagDefinition {
  id: string
  label: string
  color: string
  description: string
  check: (deltas: (number | null)[]) => boolean
}

const TAG_DEFINITIONS: TagDefinition[] = [
  {
    id: 'scaling',
    label: 'Scaling',
    color: '#22c55e', // green
    description: 'All deltas > +0.0% (winrate increases as game goes longer)',
    check: (deltas) => deltas.length >= 5 && deltas.every(d => d !== null && d > 0.0),
  },
  {
    id: 'fallsoff',
    label: 'Falls Off',
    color: '#ef4444', // red
    description: 'All deltas < -0.0% (winrate decreases as game goes longer)',
    check: (deltas) => deltas.length >= 5 && deltas.every(d => d !== null && d < 0.0),
  },
  {
    id: 'midgame',
    label: 'Midgame Peak',
    color: '#eab308', // yellow
    description: 'Peaks in midgame (first & last deltas negative, middle deltas positive)',
    check: (deltas) => {
      if (deltas.length < 5) return false
      const first = deltas[0]
      const last = deltas[deltas.length - 1]
      const middle = deltas.slice(1, -1)
      if (first === null || last === null) return false
      if (first >= 0 || last >= 0) return false
      const middleAvg = middle.reduce((sum: number, d) => sum + (d ?? 0), 0) / middle.length
      return middleAvg > 0.15
    },
  },
  {
    id: 'midgamedip',
    label: 'Midgame Dip',
    color: '#06b6d4', // cyan
    description: 'U-shaped: good early and late, weak in middle',
    check: (deltas) => {
      if (deltas.length < 5) return false
      const first = deltas[0]
      const last = deltas[deltas.length - 1]
      const middle = deltas.slice(1, -1)
      if (first === null || last === null) return false
      if (first <= 0 || last <= 0) return false
      const middleAvg = middle.reduce((sum: number, d) => sum + (d ?? 0), 0) / middle.length
      return middleAvg < -0.3
    },
  },
  {
    id: 'latebloomer',
    label: 'Late Bloomer',
    color: '#8b5cf6', // purple
    description: 'Weak early, strong late (first 2 deltas ≤ 0, last 2 deltas positive)',
    check: (deltas) => {
      if (deltas.length < 5) return false
      const first2 = deltas.slice(0, 2)
      const last2 = deltas.slice(-2)
      const first2Ok = first2.every(d => d !== null && d <= 0)
      const last2Ok = last2.every(d => d !== null && d > 0.5)
      return first2Ok && last2Ok
    },
  },
  {
    id: 'stable',
    label: 'Stable',
    color: '#3b82f6', // blue
    description: 'All deltas between -1.5% and +1.5% (consistent winrate across game duration)',
    check: (deltas) => deltas.length >= 5 && deltas.every(d => d !== null && d > -1.5 && d < 1.5),
  },
  {
    id: 'volatile',
    label: 'Volatile',
    color: '#ec4899', // pink
    description: 'Inconsistent across durations (has both large positive and negative deltas)',
    check: (deltas) => {
      if (deltas.length < 5) return false
      const hasLargePositive = deltas.some(d => d !== null && d > 2.0)
      const hasLargeNegative = deltas.some(d => d !== null && d < -2.0)
      return hasLargePositive && hasLargeNegative
    },
  },
]

function TagCell({ tag }: { tag: TagDefinition | null }) {
  if (!tag) {
    return <span className={styles.noData}>—</span>
  }

  return (
    <span
      className={styles.tagCell}
      style={{ backgroundColor: `${tag.color}33`, borderColor: tag.color }}
      title={tag.description}
    >
      {tag.label}
    </span>
  )
}

// Use wider viewport for this page
function useWiderViewport() {
  useLayoutEffect(() => {
    const appMain = document.querySelector('.app-main')
    if (appMain) {
      appMain.classList.add('app-main-wide')
    }
    return () => {
      if (appMain) {
        appMain.classList.remove('app-main-wide')
      }
    }
  }, [])
}

interface DurationRange {
  label: string
  minSeconds: number
  maxSeconds: number | null
}

interface AbilityBucket {
  label: string
  numGames: number
  numWins: number
}

interface AbilityByTimeStats {
  abilityId: number
  buckets: AbilityBucket[]
}

interface AbilityByTimeApiResponse {
  data: {
    durationRanges: DurationRange[]
    abilityByTimeStats: AbilityByTimeStats[]
  }
}

interface AbilityTimeRow {
  abilityId: number
  abilityName: string
  shortName: string
  isUltimate: boolean
  isHeroAbility: boolean
  heroId?: number
  heroPicture?: string
  ownerHeroId?: number
  totalGames: number
  bucketWinrates: Record<string, number | null> // label -> winrate
  bucketGames: Record<string, number> // label -> games
  bucketDeltas: Record<string, number | null> // "label1->label2" -> delta
  tag: TagDefinition | null
}

function WinrateCell({ value, games }: { value: number | null; games: number }) {
  if (value === null || games < 10) {
    return <span className={styles.noData}>—</span>
  }

  // Color based on winrate: red (40%) -> yellow (50%) -> green (60%)
  const normalizedValue = Math.max(0, Math.min(1, (value - 40) / 20))

  let r: number, g: number, b: number
  if (normalizedValue < 0.5) {
    r = 220
    g = Math.round(100 + normalizedValue * 2 * 120)
    b = 80
  } else {
    r = Math.round(220 - (normalizedValue - 0.5) * 2 * 140)
    g = 220
    b = 80
  }

  const alpha = 0.2 + Math.abs(normalizedValue - 0.5) * 0.4

  return (
    <span
      className={styles.winrateCell}
      style={{ backgroundColor: `rgba(${r}, ${g}, ${b}, ${alpha})` }}
      title={`${games} games`}
    >
      {value.toFixed(1)}%
    </span>
  )
}

function DeltaCell({ value }: { value: number | null }) {
  if (value === null) {
    return <span className={styles.noData}>—</span>
  }

  const isPositive = value > 0
  const isNegative = value < 0
  const absValue = Math.abs(value)

  // Color intensity based on magnitude (0-10% range)
  const intensity = Math.min(1, absValue / 10)
  const alpha = 0.15 + intensity * 0.35

  let color: string
  if (isPositive) {
    color = `rgba(80, 220, 100, ${alpha})`
  } else if (isNegative) {
    color = `rgba(220, 80, 80, ${alpha})`
  } else {
    color = 'transparent'
  }

  return (
    <span
      className={styles.deltaCell}
      style={{ backgroundColor: color }}
    >
      {isPositive ? '+' : ''}{value.toFixed(1)}
    </span>
  )
}

export function AbilityByTimePage() {
  useWiderViewport()
  const [searchParams, setSearchParams] = useSearchParams()
  const { currentPatch } = usePatchSelection()
  const [sorting, setSorting] = useState<SortingState>([])

  // Filter toggles from URL
  const hideUltimates = searchParams.get('hideUltimates') === 'true'
  const hideHeroes = searchParams.get('hideHeroes') === 'true'
  const hideAbilities = searchParams.get('hideAbilities') === 'true'

  // Tag filter toggles from URL (hide specific tags)
  const hiddenTags = TAG_DEFINITIONS.reduce((acc, tag) => {
    acc[tag.id] = searchParams.get(`tag-${tag.id}`) === 'hide'
    return acc
  }, {} as Record<string, boolean>)
  const hideUntagged = searchParams.get('tag-untagged') === 'hide'

  const toggleFilter = (param: string, currentValue: boolean) => {
    const newParams = new URLSearchParams(searchParams)
    if (currentValue) {
      newParams.delete(param)
    } else {
      newParams.set(param, 'true')
    }
    setSearchParams(newParams)
  }

  const toggleTagFilter = (tagId: string, currentValue: boolean) => {
    const newParams = new URLSearchParams(searchParams)
    const paramName = `tag-${tagId}`
    if (currentValue) {
      newParams.delete(paramName)
    } else {
      newParams.set(paramName, 'hide')
    }
    setSearchParams(newParams)
  }

  const { data: apiResponse, isLoading, error } = usePersistedQuery<AbilityByTimeApiResponse>(
    '/abilities-by-time',
    currentPatch ? { patch: currentPatch } : undefined,
    { enabled: !!currentPatch }
  )

  const durationRanges = apiResponse?.data?.durationRanges ?? []

  // Transform API response into table rows
  const tableData = useMemo<AbilityTimeRow[]>(() => {
    if (!apiResponse?.data?.abilityByTimeStats) return []

    const ranges = apiResponse.data.durationRanges ?? []

    return apiResponse.data.abilityByTimeStats
      .map(stat => {
        const isHeroAbility = stat.abilityId < 0
        const heroIdFromAbility = isHeroAbility ? Math.abs(stat.abilityId) : undefined
        const hero = heroIdFromAbility ? getHeroById(heroIdFromAbility) : undefined
        const ability = !isHeroAbility ? getAbilityById(stat.abilityId) : undefined
        const ownerHeroId = isHeroAbility ? heroIdFromAbility : (ability?.ownerHeroId ?? undefined)

        // Build winrate map from buckets
        const bucketWinrates: Record<string, number | null> = {}
        const bucketGames: Record<string, number> = {}
        let totalGames = 0

        stat.buckets.forEach(bucket => {
          bucketGames[bucket.label] = bucket.numGames
          totalGames += bucket.numGames
          if (bucket.numGames > 0) {
            bucketWinrates[bucket.label] = (bucket.numWins / bucket.numGames) * 100
          } else {
            bucketWinrates[bucket.label] = null
          }
        })

        // Calculate deltas between consecutive buckets
        const bucketDeltas: Record<string, number | null> = {}
        const deltaValues: (number | null)[] = []
        for (let i = 0; i < ranges.length - 1; i++) {
          const curr = ranges[i].label
          const next = ranges[i + 1].label
          const currWr = bucketWinrates[curr]
          const nextWr = bucketWinrates[next]
          const deltaKey = `${curr}->${next}`

          if (currWr !== null && nextWr !== null &&
              (bucketGames[curr] ?? 0) >= 10 && (bucketGames[next] ?? 0) >= 10) {
            bucketDeltas[deltaKey] = nextWr - currWr
            deltaValues.push(nextWr - currWr)
          } else {
            bucketDeltas[deltaKey] = null
            deltaValues.push(null)
          }
        }

        // Determine tag (first matching tag wins)
        let tag: TagDefinition | null = null
        for (const tagDef of TAG_DEFINITIONS) {
          if (tagDef.check(deltaValues)) {
            tag = tagDef
            break
          }
        }

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
          totalGames,
          bucketWinrates,
          bucketGames,
          bucketDeltas,
          tag,
        }
      })
      .filter(row => {
        if (row.totalGames < 100) return false
        if (!row.abilityName || row.abilityName.startsWith('special_bonus')) return false
        if (hideUltimates && row.isUltimate) return false
        if (hideHeroes && row.isHeroAbility) return false
        if (hideAbilities && !row.isHeroAbility && !row.isUltimate) return false
        // Filter by tag visibility
        if (row.tag && hiddenTags[row.tag.id]) return false
        if (hideUntagged && !row.tag) return false
        return true
      })
      .sort((a, b) => b.totalGames - a.totalGames)
  }, [apiResponse, currentPatch, hideUltimates, hideHeroes, hideAbilities, hiddenTags, hideUntagged])

  // Calculate tag counts (before tag filtering, so we always show accurate counts)
  const tagCounts = useMemo(() => {
    if (!apiResponse?.data?.abilityByTimeStats) return { untagged: 0 }

    const ranges = apiResponse.data.durationRanges ?? []
    const counts: Record<string, number> = { untagged: 0 }

    // Initialize counts for all tags
    TAG_DEFINITIONS.forEach(tag => {
      counts[tag.id] = 0
    })

    apiResponse.data.abilityByTimeStats.forEach(stat => {
      const bucketWinrates: Record<string, number | null> = {}
      const bucketGames: Record<string, number> = {}
      let totalGames = 0

      stat.buckets.forEach(bucket => {
        bucketGames[bucket.label] = bucket.numGames
        totalGames += bucket.numGames
        if (bucket.numGames > 0) {
          bucketWinrates[bucket.label] = (bucket.numWins / bucket.numGames) * 100
        } else {
          bucketWinrates[bucket.label] = null
        }
      })

      // Skip rows that would be filtered out by non-tag filters
      if (totalGames < 100) return

      const isHeroAbility = stat.abilityId < 0
      const ability = !isHeroAbility ? getAbilityById(stat.abilityId) : undefined
      if (!ability && !isHeroAbility) return
      const isUltimate = ability?.isUltimate ?? false

      if (hideUltimates && isUltimate) return
      if (hideHeroes && isHeroAbility) return
      if (hideAbilities && !isHeroAbility && !isUltimate) return

      // Calculate deltas for this row
      const deltaValues: (number | null)[] = []
      for (let i = 0; i < ranges.length - 1; i++) {
        const curr = ranges[i].label
        const next = ranges[i + 1].label
        const currWr = bucketWinrates[curr]
        const nextWr = bucketWinrates[next]

        if (currWr !== null && nextWr !== null &&
            (bucketGames[curr] ?? 0) >= 10 && (bucketGames[next] ?? 0) >= 10) {
          deltaValues.push(nextWr - currWr)
        } else {
          deltaValues.push(null)
        }
      }

      // Find first matching tag and count it
      let hasTag = false
      for (const tagDef of TAG_DEFINITIONS) {
        if (tagDef.check(deltaValues)) {
          counts[tagDef.id]++
          hasTag = true
          break
        }
      }

      // Count untagged
      if (!hasTag) {
        counts.untagged++
      }
    })

    return counts
  }, [apiResponse, currentPatch, hideUltimates, hideHeroes, hideAbilities])

  // Build columns dynamically based on duration ranges
  const columns = useMemo<ColumnDef<AbilityTimeRow>[]>(() => {
    const baseColumns: ColumnDef<AbilityTimeRow>[] = [
      {
        accessorKey: 'abilityName',
        header: 'Ability',
        size: 220,
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
        id: 'tag',
        header: 'Tag',
        size: 90,
        accessorFn: (row) => {
          const tagOrder: Record<string, number> = { scaling: 0, fallsoff: 1, midgame: 2, midgamedip: 3, latebloomer: 4, volatile: 5, stable: 6 }
          return row.tag ? tagOrder[row.tag.id] ?? 99 : 100
        },
        cell: ({ row }) => <TagCell tag={row.original.tag} />,
      },
    ]

    // Build duration and delta columns interleaved
    const timeColumns: ColumnDef<AbilityTimeRow>[] = []

    durationRanges.forEach((range, i) => {
      // Add duration column
      timeColumns.push({
        id: `duration_${range.label}`,
        header: () => (
          <span className={styles.durationHeader}>
            {range.label}
            <span className={styles.durationSubheader}>min</span>
          </span>
        ),
        size: 65,
        accessorFn: (row) => row.bucketWinrates[range.label] ?? -999,
        cell: ({ row }) => (
          <WinrateCell
            value={row.original.bucketWinrates[range.label]}
            games={row.original.bucketGames[range.label] ?? 0}
          />
        ),
      })

      // Add delta column after each duration (except the last)
      if (i < durationRanges.length - 1) {
        const nextRange = durationRanges[i + 1]
        const deltaKey = `${range.label}->${nextRange.label}`

        timeColumns.push({
          id: `delta_${range.label}_${nextRange.label}`,
          header: () => <span className={styles.deltaHeader}>Δ</span>,
          size: 50,
          accessorFn: (row) => row.bucketDeltas[deltaKey] ?? -999,
          cell: ({ row }) => (
            <DeltaCell value={row.original.bucketDeltas[deltaKey]} />
          ),
        })
      }
    })

    return [...baseColumns, ...timeColumns]
  }, [durationRanges, currentPatch])

  if (error) {
    return (
      <PageShell title="Abilities by Time">
        <p style={{ color: 'var(--color-negative)' }}>
          Error loading ability data. Please try again later.
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Abilities by Time"
      subtitle={currentPatch ? `Patch ${currentPatch}` : 'Loading...'}
      actions={
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem', alignItems: 'flex-end' }}>
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
          <div style={{ display: 'flex', gap: '0.5rem', alignItems: 'center', flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: '800px' }}>
            {TAG_DEFINITIONS.map(tag => (
              <button
                key={tag.id}
                type="button"
                className={`${styles.tagToggleButton} ${hiddenTags[tag.id] ? styles.tagToggleButtonHidden : ''}`}
                style={{
                  '--tag-color': tag.color,
                } as React.CSSProperties}
                onClick={() => toggleTagFilter(tag.id, hiddenTags[tag.id])}
                title={tag.description}
              >
                {hiddenTags[tag.id] ? 'Show' : 'Hide'} {tag.label} ({tagCounts[tag.id] ?? 0})
              </button>
            ))}
            <button
              type="button"
              className={`${styles.tagToggleButton} ${hideUntagged ? styles.tagToggleButtonHidden : ''}`}
              style={{
                '--tag-color': '#6b7280',
              } as React.CSSProperties}
              onClick={() => toggleTagFilter('untagged', hideUntagged)}
              title="Abilities with no special tags"
            >
              {hideUntagged ? 'Show' : 'Hide'} Untagged ({tagCounts.untagged ?? 0})
            </button>
          </div>
        </div>
      }
    >
      <DataTable
        key={currentPatch}
        data={tableData}
        columns={columns}
        searchPlaceholder="Search abilities..."
        searchableColumns={['abilityName', 'shortName']}
        emptyMessage="No abilities found"
        loading={isLoading}
        sorting={sorting}
        onSortingChange={setSorting}
      />
    </PageShell>
  )
}
