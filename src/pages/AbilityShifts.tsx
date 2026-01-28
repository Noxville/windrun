import { useMemo } from 'react'
import type { ColumnDef } from '@tanstack/react-table'
import { PageShell } from '../components/PageShell'
import {
  DataTable,
  AbilityInline,
  HeroMini,
  PatchSelector,
  usePatchSelection,
} from '../components'
import { usePersistedQuery } from '../api'
import { getAbilityById, heroesById } from '../data'
import styles from './AbilityShifts.module.css'

interface AbilityShift {
  abilityId: number
  killsShift: number
  deathsShift: number
  killAssistShift: number
  gpmShift: number
  xpmShift: number
  dmgShift: number
  healingShift: number
}

interface AbilityStat {
  abilityId: number
  numPicks: number
  avgPickPosition: number
  wins: number
  winrate: number
  pickRate: number
}

interface AbilityShiftsApiResponse {
  data: {
    abilityShifts: AbilityShift[]
    abilityStats: AbilityStat[]
    patches: { overall: string[] }
  }
}

interface ShiftRow {
  abilityId: number
  abilityName: string
  shortName: string
  isUltimate: boolean
  isHeroBody: boolean
  heroPicture?: string
  killsShift: number
  deathsShift: number
  killAssistShift: number
  gpmShift: number
  xpmShift: number
  dmgShift: number
  healingShift: number
  winrate: number
}

// Gradient cell for shift values (can be positive or negative)
function ShiftCell({
  value,
  min,
  max,
  inverted = false,
}: {
  value: number
  min: number
  max: number
  inverted?: boolean
}) {
  const displayValue = value.toFixed(3)

  // Normalize to 0-1 range
  const normalizedValue = Math.max(0, Math.min(1, (value - min) / (max - min)))

  // For inverted (like deaths, where lower is better), flip the color
  const colorValue = inverted ? 1 - normalizedValue : normalizedValue

  // Generate color from red (0) through yellow (0.5) to green (1)
  let r: number, g: number, b: number
  if (colorValue < 0.5) {
    // Red to yellow
    r = 220
    g = Math.round(100 + colorValue * 2 * 120)
    b = 80
  } else {
    // Yellow to green
    r = Math.round(220 - (colorValue - 0.5) * 2 * 140)
    g = 220
    b = 80
  }

  const alpha = 0.25 + Math.abs(colorValue - 0.5) * 0.5

  return (
    <span
      className={styles.shiftCell}
      style={{ backgroundColor: `rgba(${r}, ${g}, ${b}, ${alpha})` }}
    >
      {value >= 0 ? '+' : ''}{displayValue}
    </span>
  )
}

export function AbilityShiftsPage() {
  const { currentPatch } = usePatchSelection()

  const { data: apiResponse, isLoading, error } = usePersistedQuery<AbilityShiftsApiResponse>(
    '/ability-shifts',
    currentPatch ? { patch: currentPatch } : undefined,
    { enabled: !!currentPatch }
  )

  const shiftData = useMemo<ShiftRow[]>(() => {
    if (!apiResponse?.data?.abilityShifts || !apiResponse?.data?.abilityStats) return []

    // Build winrate map from abilityStats
    const winrateMap: Record<number, number> = {}
    apiResponse.data.abilityStats.forEach(stat => {
      winrateMap[stat.abilityId] = stat.winrate
    })

    const rows: ShiftRow[] = []

    apiResponse.data.abilityShifts.forEach(shift => {
      const abilityId = shift.abilityId
      const winrate = winrateMap[abilityId] ?? 0

      // Check if this is a hero body (negative ID)
      if (abilityId < 0) {
        const heroId = -abilityId
        const hero = heroesById[heroId]
        if (hero) {
          rows.push({
            abilityId,
            abilityName: `${hero.englishName} (Body)`,
            shortName: hero.picture,
            isUltimate: false,
            isHeroBody: true,
            heroPicture: hero.picture,
            killsShift: shift.killsShift,
            deathsShift: shift.deathsShift,
            killAssistShift: shift.killAssistShift,
            gpmShift: shift.gpmShift,
            xpmShift: shift.xpmShift,
            dmgShift: shift.dmgShift,
            healingShift: shift.healingShift,
            winrate,
          })
        }
      } else {
        const ability = getAbilityById(abilityId)
        if (ability) {
          rows.push({
            abilityId,
            abilityName: ability.englishName,
            shortName: ability.shortName,
            isUltimate: ability.isUltimate ?? false,
            isHeroBody: false,
            killsShift: shift.killsShift,
            deathsShift: shift.deathsShift,
            killAssistShift: shift.killAssistShift,
            gpmShift: shift.gpmShift,
            xpmShift: shift.xpmShift,
            dmgShift: shift.dmgShift,
            healingShift: shift.healingShift,
            winrate,
          })
        }
      }
    })

    return rows
  }, [apiResponse])

  const columns = useMemo<ColumnDef<ShiftRow>[]>(
    () => [
      {
        accessorKey: 'abilityName',
        header: 'Ability',
        size: 220,
        cell: info => {
          const row = info.row.original
          if (row.isHeroBody) {
            return (
              <div className={styles.abilityCell}>
                <HeroMini name={row.abilityName} picture={row.heroPicture!} height={28} />
                <span className={styles.heroBodyName}>{row.abilityName}</span>
              </div>
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
        accessorKey: 'killsShift',
        header: () => <span className={styles.headerKill}>Kill Δ</span>,
        size: 90,
        cell: info => <ShiftCell value={info.getValue() as number} min={-0.4} max={0.4} />,
      },
      {
        accessorKey: 'deathsShift',
        header: () => <span className={styles.headerDeath}>Death Δ</span>,
        size: 90,
        cell: info => <ShiftCell value={info.getValue() as number} min={-0.4} max={0.4} inverted />,
      },
      {
        accessorKey: 'killAssistShift',
        header: () => <span className={styles.headerKA}>K+A Δ</span>,
        size: 90,
        cell: info => <ShiftCell value={info.getValue() as number} min={-0.4} max={0.4} />,
      },
      {
        accessorKey: 'gpmShift',
        header: () => <span className={styles.headerGPM}>GPM Δ</span>,
        size: 90,
        cell: info => <ShiftCell value={info.getValue() as number} min={-0.5} max={0.5} />,
      },
      {
        accessorKey: 'xpmShift',
        header: () => <span className={styles.headerXPM}>XPM Δ</span>,
        size: 90,
        cell: info => <ShiftCell value={info.getValue() as number} min={-0.4} max={0.4} />,
      },
      {
        accessorKey: 'dmgShift',
        header: () => <span className={styles.headerDmg}>Dmg Δ</span>,
        size: 90,
        cell: info => <ShiftCell value={info.getValue() as number} min={-0.4} max={0.4} />,
      },
      {
        accessorKey: 'healingShift',
        header: () => <span className={styles.headerHeal}>Heal Δ</span>,
        size: 90,
        cell: info => <ShiftCell value={info.getValue() as number} min={-0.1} max={0.8} />,
      },
      {
        accessorKey: 'winrate',
        header: 'Win %',
        size: 80,
        cell: info => {
          const value = (info.getValue() as number) * 100
          // Color from 40% to 60%
          const normalized = Math.max(0, Math.min(1, (value - 40) / 20))
          let r: number, g: number
          if (normalized < 0.5) {
            r = 220
            g = Math.round(80 + normalized * 2 * 140)
          } else {
            r = Math.round(220 - (normalized - 0.5) * 2 * 140)
            g = 220
          }
          const alpha = 0.25 + Math.abs(normalized - 0.5) * 0.5
          return (
            <span
              className={styles.winrateCell}
              style={{ backgroundColor: `rgba(${r}, ${g}, 80, ${alpha})` }}
            >
              {value.toFixed(2)}%
            </span>
          )
        },
      },
    ],
    []
  )

  if (error) {
    return (
      <PageShell title="Ability Stats Shifts">
        <p style={{ color: 'var(--color-negative)' }}>
          Error loading ability shift data. Please try again later.
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Ability Stats Shifts"
      subtitle={currentPatch ? `Patch ${currentPatch} - How abilities shift player stats vs game average` : 'Loading...'}
      actions={<PatchSelector />}
    >
      <DataTable
        data={shiftData}
        columns={columns}
        searchPlaceholder="Search abilities..."
        searchableColumns={['abilityName', 'shortName']}
        initialSorting={[{ id: 'winrate', desc: true }]}
        emptyMessage="No ability shift data found"
        loading={isLoading}
      />
    </PageShell>
  )
}
