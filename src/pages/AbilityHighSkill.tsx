import { useMemo, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { createColumnHelper } from '@tanstack/react-table'
import { PageShell } from '../components/PageShell'
import {
  DataTable,
  GradientCell,
  AbilityInline,
  HeroInline,
  DeltaCell,
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
import styles from './AbilityHighSkill.module.css'

interface AbilityStat {
  abilityId: number
  numPicks: number
  avgPickPosition?: number
  wins: number
  ownerHero?: number
  winrate: number
  pickRate: number
}

interface AbilityHighSkillApiResponse {
  data: {
    allData: {
      patches: { overall: string[] }
      abilityStats: AbilityStat[]
    }
    highSkillData: {
      patches: { overall: string[] }
      abilityStats: AbilityStat[]
    }
  }
}

interface AbilityHighSkillRow {
  abilityId: number
  abilityName: string
  shortName: string
  isUltimate: boolean
  isHeroAbility: boolean  // true if abilityId < 0 (hero ability decision)
  heroId?: number         // hero ID for hero abilities
  heroPicture?: string    // hero picture for hero abilities
  ownerHeroId?: number
  ownerHeroName?: string  // for search
  // Winrate columns
  winRateHighSkill: number
  winRateAll: number
  winRateDelta: number
  pickRateHighSkill: number
  // Avg pick columns
  avgPickHighSkill: number | null
  avgPickAll: number | null
  avgPickDelta: number | null
  // Ability value columns
  strength: number | null
  strengthRank: number | null
  pickRankHighSkill: number | null
  value: number | null
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

function SignedCell({ value, decimals }: { value: number; decimals: number }) {
  const cls = value > 0 ? styles.signedUp : value < 0 ? styles.signedDown : ''
  return (
    <span className={`${styles.signed} ${cls}`}>
      {value > 0 ? '+' : ''}{value.toFixed(decimals)}
    </span>
  )
}

export function AbilityHighSkillPage() {
  useWidePage()
  const navigate = useNavigate()
  const [sorting, setSorting] = useState<SortingState>(DEFAULT_SORTING)
  const { currentPatch } = usePatchSelection()
  const { data: apiResponse, isLoading, error } = usePersistedQuery<AbilityHighSkillApiResponse>(
    '/ability-high-skill',
    currentPatch ? { patch: currentPatch } : undefined,
    { enabled: !!currentPatch }
  )

  const {
    values: abilityValues,
    total: valuesTotal,
    isLoading: valuesLoading,
    unavailable: valuesUnavailable,
  } = useAbilityValues(currentPatch)

  // Strength is fitted on all matches, so rank the high skill bracket's own draft
  // order against it. Both ranks span the same set, so the gap is comparable to
  // the Value shown on the Abilities page.
  const pickRankHighSkill = useMemo(() => {
    const stats = apiResponse?.data?.highSkillData?.abilityStats
    if (!stats) return null
    const ranked = stats
      .filter(s => s.avgPickPosition != null)
      .sort((a, b) => a.avgPickPosition! - b.avgPickPosition!)
    const map = new Map<number, number>()
    ranked.forEach((s, i) => map.set(s.abilityId, i + 1))
    return map
  }, [apiResponse])

  // Transform API response - show high skill data with delta from all data
  const statsData = useMemo<AbilityHighSkillRow[]>(() => {
    if (!apiResponse?.data?.highSkillData?.abilityStats) return []

    const allStats = apiResponse.data.allData?.abilityStats ?? []
    const allStatsMap = new Map(allStats.map(s => [s.abilityId, s]))

    return apiResponse.data.highSkillData.abilityStats
      .map(stat => {
        const isHeroAbility = stat.abilityId < 0
        const heroIdFromAbility = isHeroAbility ? Math.abs(stat.abilityId) : undefined
        const hero = heroIdFromAbility ? getHeroById(heroIdFromAbility) : undefined
        const ability = !isHeroAbility ? getAbilityById(stat.abilityId) : undefined

        // For hero abilities (-X), use hero X as owner
        const ownerHeroId = isHeroAbility ? heroIdFromAbility : stat.ownerHero
        const ownerHeroData = ownerHeroId ? getHeroById(ownerHeroId) : undefined

        const allStat = allStatsMap.get(stat.abilityId)
        const winRateHighSkill = stat.winrate * 100
        const winRateAll = (allStat?.winrate ?? stat.winrate) * 100
        const avgPickHighSkill = stat.avgPickPosition ?? null
        const avgPickAll = allStat?.avgPickPosition ?? stat.avgPickPosition ?? null

        const abilityValue = abilityValues?.get(stat.abilityId) ?? null
        const strengthRank =
          abilityValue !== null && hasRank(abilityValue) ? abilityValue.strengthRank : null
        const draftRank = pickRankHighSkill?.get(stat.abilityId) ?? null

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
          winRateHighSkill,
          winRateAll,
          pickRateHighSkill: stat.pickRate * 100,
          winRateDelta: winRateHighSkill - winRateAll,
          avgPickHighSkill,
          avgPickAll,
          avgPickDelta:
            avgPickHighSkill !== null && avgPickAll !== null
              ? avgPickHighSkill - avgPickAll
              : null,
          strength: abilityValue?.strength ?? null,
          strengthRank,
          pickRankHighSkill: draftRank,
          value: strengthRank !== null && draftRank !== null ? draftRank - strengthRank : null,
        }
      })
      .filter(row => row.abilityName && !row.abilityName.startsWith('special_bonus'))
  }, [apiResponse, abilityValues, pickRankHighSkill])

  // Each game has 40 ability picks, so total picks over 40 is the game count
  const totalGames = useMemo(() => {
    const stats = apiResponse?.data?.highSkillData?.abilityStats
    if (!stats) return 0
    const totalPicks = stats
      .filter(stat => stat.abilityId > 0)
      .reduce((sum, stat) => sum + stat.numPicks, 0)
    return Math.round(totalPicks / 40)
  }, [apiResponse])

  const { minPickRate, maxPickRate } = useMemo(() => {
    if (statsData.length === 0) return { minPickRate: 0, maxPickRate: 100 }
    const rates = statsData.map(r => r.pickRateHighSkill)
    return { minPickRate: Math.min(...rates), maxPickRate: Math.max(...rates) }
  }, [statsData])

  const columnHelper = createColumnHelper<AbilityHighSkillRow>()

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns = useMemo<ColumnDef<AbilityHighSkillRow, any>[]>(
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
          if (row.isHeroAbility && row.heroId) {
            return (
              <HeroInline
                id={row.heroId}
                name={row.abilityName}
                picture={row.heroPicture || ''}
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
      // All brackets group
      columnHelper.group({
        id: 'allSkill',
        header: () => <span style={{ color: 'var(--color-text-muted)' }}>All Skill</span>,
        columns: [
          columnHelper.accessor('winRateAll', {
            header: () => <ColHeader label="Win Rate" />,
            size: 90,
            cell: info => (
              <GradientCell value={info.getValue()} min={43} max={57} decimals={1} suffix="%" />
            ),
          }),
          columnHelper.accessor('avgPickAll', {
            header: () => <ColHeader label="Avg Pick" />,
            size: 90,
            cell: info => {
              const value = info.getValue()
              if (value === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              return <GradientCell value={value} min={1} max={40} decimals={1} invert={true} />
            },
          }),
        ],
      }),
      // High skill group
      columnHelper.group({
        id: 'highSkill',
        header: () => <span style={{ color: 'var(--color-accent)' }}>High Skill</span>,
        columns: [
          columnHelper.accessor('winRateHighSkill', {
            header: () => <ColHeader label="Win Rate" />,
            size: 90,
            meta: { hasBorderLeft: true },
            cell: info => (
              <GradientCell value={info.getValue()} min={43} max={57} decimals={1} suffix="%" />
            ),
          }),
          columnHelper.accessor('winRateDelta', {
            header: () => <ColHeader label="ΔWR" />,
            size: 55,
            cell: info => <DeltaCell value={info.getValue()} decimals={1} suffix="%" />,
          }),
          columnHelper.accessor('avgPickHighSkill', {
            header: () => <ColHeader label="Avg Pick" />,
            size: 90,
            cell: info => {
              const value = info.getValue()
              if (value === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              return <GradientCell value={value} min={1} max={40} decimals={1} invert={true} />
            },
          }),
          columnHelper.accessor('avgPickDelta', {
            header: () => <ColHeader label="ΔPick" />,
            size: 65,
            cell: info => {
              const value = info.getValue()
              if (value === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              // Negative delta = picked earlier in high skill = good
              return <DeltaCell value={value} decimals={1} invertColors />
            },
          }),
          columnHelper.accessor('pickRateHighSkill', {
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
                hint="What this ability contributes to the team holding it, in win rate points, against an ordinary pick. Fitted across all matches on the patch, not just the high skill bracket."
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
                hint="Where this ability sits when everything is ordered by strength. 1 is the strongest."
              />
            ),
            size: 72,
            cell: info => {
              const rank = info.getValue()
              if (rank === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              return <span className={styles.rankValue}>{rank}</span>
            },
          }),
          columnHelper.accessor('pickRankHighSkill', {
            header: () => (
              <ColHeader
                label="Pick Rank"
                hint="Where this ability sits when the high skill bracket's own draft order is ranked. 1 is drafted earliest by high skill players."
              />
            ),
            size: 74,
            cell: info => {
              const rank = info.getValue()
              if (rank === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              return <span className={styles.rankValue}>{rank}</span>
            },
          }),
          columnHelper.accessor('value', {
            header: () => (
              <ColHeader
                label="Value"
                hint="The gap between what an ability is worth and where high skill players draft it, in places. Positive means they take it later than its strength deserves."
              />
            ),
            size: 76,
            cell: info => {
              const value = info.getValue()
              if (value === null) return <span style={{ color: 'var(--color-text-muted)' }}>—</span>
              const row = info.row.original
              const title =
                row.pickRankHighSkill !== null && row.strengthRank !== null
                  ? `High skill players draft it ${row.pickRankHighSkill}th of ${valuesTotal}, ${row.strengthRank}th by strength`
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
    [columnHelper, valuesTotal, minPickRate, maxPickRate]
  )

  const handleRowClick = (row: AbilityHighSkillRow) => {
    if (row.isHeroAbility && row.heroId) {
      navigate(`/heroes/${row.heroId}`)
    } else {
      navigate(`/abilities/${row.abilityId}`)
    }
  }

  if (error) {
    return (
      <PageShell title="High Skill Abilities">
        <p style={{ color: 'var(--color-negative)' }}>
          Error loading high skill data. Please try again later.
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="High Skill Abilities"
      subtitle={currentPatch ? `Patch ${currentPatch}` : 'Loading...'}
      actions={<PatchSelector />}
    >
      {valuesUnavailable && (
        <p className={styles.valuesNote}>
          Ability Value is not fitted for {currentPatch} yet. The Strength and Value columns stay
          empty until the next fit runs.
        </p>
      )}
      <DataTable
        key={currentPatch ?? ''}
        data={statsData}
        columns={columns}
        searchPlaceholder="Search abilities..."
        searchableColumns={['abilityName', 'shortName', 'ownerHeroName']}
        initialSorting={sorting}
        sorting={sorting}
        onSortingChange={setSorting}
        onRowClick={handleRowClick}
        emptyMessage="No high skill data found"
        loading={isLoading || valuesLoading}
        extraStats={{ value: totalGames, label: 'high skill games' }}
      />
    </PageShell>
  )
}
