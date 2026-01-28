import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { PageShell } from '../components/PageShell'
import {
  DataTable,
  GradientCell,
  AbilityInline,
  HeroInline,
  DeltaCell,
  PatchSelector,
  usePatchSelection,
} from '../components'
import { usePersistedQuery } from '../api'
import { heroMiniUrl } from '../config'
import { getAbilityById, getHeroById } from '../data'

interface AbilityStat {
  abilityId: number
  numPicks: number
  avgPickPosition: number
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
  // Avg pick columns
  avgPickHighSkill: number
  avgPickAll: number
  avgPickDelta: number
}

export function AbilityHighSkillPage() {
  const navigate = useNavigate()
  const { currentPatch } = usePatchSelection()
  const { data: apiResponse, isLoading, error } = usePersistedQuery<AbilityHighSkillApiResponse>(
    '/ability-high-skill',
    currentPatch ? { patch: currentPatch } : undefined,
    { enabled: !!currentPatch }
  )

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
        const avgPickHighSkill = stat.avgPickPosition
        const avgPickAll = allStat?.avgPickPosition ?? stat.avgPickPosition

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
          winRateDelta: winRateHighSkill - winRateAll,
          avgPickHighSkill,
          avgPickAll,
          avgPickDelta: avgPickHighSkill - avgPickAll,
        }
      })
      .filter(row => row.abilityName && !row.abilityName.startsWith('special_bonus'))
  }, [apiResponse])

  const columns = useMemo<ColumnDef<AbilityHighSkillRow>[]>(
    () => [
      {
        accessorKey: 'abilityName',
        header: 'Ability',
        size: 220,
        cell: info => {
          const row = info.row.original
          // For hero abilities, render HeroInline instead
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
        size: 50,
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
      // Winrate group
      {
        accessorKey: 'winRateHighSkill',
        header: 'WR High',
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
        accessorKey: 'winRateDelta',
        header: 'WR Δ',
        size: 70,
        cell: info => (
          <DeltaCell value={info.getValue() as number} decimals={1} suffix="%" />
        ),
      },
      {
        accessorKey: 'winRateAll',
        header: 'WR All',
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
      // Avg pick group
      {
        accessorKey: 'avgPickHighSkill',
        header: 'Pick High',
        size: 80,
        cell: info => (
          <GradientCell
            value={info.getValue() as number}
            min={1}
            max={40}
            decimals={1}
            invert={true}
          />
        ),
      },
      {
        accessorKey: 'avgPickDelta',
        header: 'Pick Δ',
        size: 70,
        cell: info => {
          const value = info.getValue() as number
          // Negative delta = picked earlier in high skill = good
          return (
            <DeltaCell value={value} decimals={1} invertColors />
          )
        },
      },
      {
        accessorKey: 'avgPickAll',
        header: 'Pick All',
        size: 80,
        cell: info => (
          <GradientCell
            value={info.getValue() as number}
            min={1}
            max={40}
            decimals={1}
            invert={true}
          />
        ),
      },
    ],
    []
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
      <DataTable
        data={statsData}
        columns={columns}
        searchPlaceholder="Search abilities..."
        searchableColumns={['abilityName', 'shortName', 'ownerHeroName']}
        initialSorting={[{ id: 'winRateDelta', desc: true }]}
        onRowClick={handleRowClick}
        emptyMessage="No high skill data found"
        loading={isLoading}
      />
    </PageShell>
  )
}
