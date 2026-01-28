import { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ColumnDef } from '@tanstack/react-table'
import { createColumnHelper } from '@tanstack/react-table'
import { PageShell } from '../components/PageShell'
import {
  DataTable,
  GradientCell,
  DeltaCell,
  NumericCell,
  AbilityInline,
  PatchSelector,
  usePatchSelection,
} from '../components'
import { usePersistedQuery } from '../api'
import { getAbilityById } from '../data'
import styles from './AbilityAghs.module.css'

interface AghsStatBlock {
  wins: number
  losses: number
  total: number
  winrate: number
}

interface AbilityAghsApiResponse {
  data: {
    patches: { overall: string[] }
    abilityAghs: Array<{
      abilityId: number
      totalGames: number
      noAghsScepter: AghsStatBlock
      aghsScepter: AghsStatBlock
      noAghsShard: AghsStatBlock
      aghsShard: AghsStatBlock
    }>
  }
}

interface AghsRow {
  abilityId: number
  abilityName: string
  shortName: string
  isUltimate: boolean
  totalGames: number
  hasScepter: boolean
  hasShard: boolean
  // Scepter stats
  scepterPickRate: number | null
  scepterWinWithout: number | null
  scepterDelta: number | null
  scepterWinWith: number | null
  scepterGames: number
  // Shard stats
  shardPickRate: number | null
  shardWinWithout: number | null
  shardDelta: number | null
  shardWinWith: number | null
  shardGames: number
}

export function AbilityAghsPage() {
  const navigate = useNavigate()
  const { currentPatch } = usePatchSelection()

  const { data: apiResponse, isLoading, error } = usePersistedQuery<AbilityAghsApiResponse>(
    '/ability-aghs',
    currentPatch ? { patch: currentPatch } : undefined,
    { enabled: !!currentPatch }
  )

  const statsData = useMemo<AghsRow[]>(() => {
    if (!apiResponse?.data?.abilityAghs) return []

    return apiResponse.data.abilityAghs
      .map(stat => {
        const ability = getAbilityById(stat.abilityId)
        const hasScepter = ability?.hasScepter ?? false
        const hasShard = ability?.hasShard ?? false

        // Calculate pickup rates
        const scepterPickRate = hasScepter && stat.totalGames > 0
          ? (stat.aghsScepter.total / stat.totalGames) * 100
          : null
        const shardPickRate = hasShard && stat.totalGames > 0
          ? (stat.aghsShard.total / stat.totalGames) * 100
          : null

        // Calculate deltas (already in decimal form, convert to %)
        const scepterDelta = hasScepter
          ? (stat.aghsScepter.winrate - stat.noAghsScepter.winrate) * 100
          : null
        const shardDelta = hasShard
          ? (stat.aghsShard.winrate - stat.noAghsShard.winrate) * 100
          : null

        return {
          abilityId: stat.abilityId,
          abilityName: ability?.englishName ?? `Ability #${stat.abilityId}`,
          shortName: ability?.shortName ?? '',
          isUltimate: ability?.isUltimate ?? false,
          totalGames: stat.totalGames,
          hasScepter,
          hasShard,
          // Scepter
          scepterPickRate,
          scepterWinWithout: hasScepter ? stat.noAghsScepter.winrate * 100 : null,
          scepterDelta,
          scepterWinWith: hasScepter ? stat.aghsScepter.winrate * 100 : null,
          scepterGames: stat.aghsScepter.total,
          // Shard
          shardPickRate,
          shardWinWithout: hasShard ? stat.noAghsShard.winrate * 100 : null,
          shardDelta,
          shardWinWith: hasShard ? stat.aghsShard.winrate * 100 : null,
          shardGames: stat.aghsShard.total,
        }
      })
      .filter(row => row.totalGames >= 50)
      .filter(row => row.hasScepter || row.hasShard)
  }, [apiResponse])

  const columnHelper = createColumnHelper<AghsRow>()

  const emptyCell = <span style={{ color: 'var(--color-text-muted)' }}>—</span>

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const columns = useMemo<ColumnDef<AghsRow, any>[]>(
    () => [
      columnHelper.accessor('abilityName', {
        header: 'Ability',
        size: 220,
        cell: info => {
          const row = info.row.original
          return (
            <AbilityInline
              id={row.abilityId}
              name={row.abilityName}
              shortName={row.shortName}
              isUltimate={row.isUltimate}
            />
          )
        },
      }),
      columnHelper.accessor('totalGames', {
        header: 'Games',
        size: 70,
        cell: info => <NumericCell value={info.getValue()} decimals={0} />,
      }),
      // Aghanim's Scepter column group
      columnHelper.group({
        id: 'scepter',
        header: () => <span className={styles.scepter}>Aghanim's Scepter</span>,
        columns: [
          columnHelper.accessor('scepterPickRate', {
            header: 'Pick%',
            size: 70,
            meta: { hasBorderLeft: true },
            cell: info => {
              const value = info.getValue()
              if (value === null) return emptyCell
              return <NumericCell value={value} decimals={1} suffix="%" />
            },
          }),
          columnHelper.accessor('scepterWinWithout', {
            header: 'Without',
            size: 80,
            cell: info => {
              const value = info.getValue()
              if (value === null) return emptyCell
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
          }),
          columnHelper.accessor('scepterDelta', {
            header: 'Delta',
            size: 65,
            cell: info => {
              const value = info.getValue()
              if (value === null) return emptyCell
              return <DeltaCell value={value} decimals={1} suffix="%" />
            },
          }),
          columnHelper.accessor('scepterWinWith', {
            header: 'With',
            size: 80,
            cell: info => {
              const value = info.getValue()
              if (value === null) return emptyCell
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
          }),
        ],
      }),
      // Aghanim's Shard column group
      columnHelper.group({
        id: 'shard',
        header: () => <span className={styles.shard}>Aghanim's Shard</span>,
        columns: [
          columnHelper.accessor('shardPickRate', {
            header: 'Pick%',
            size: 70,
            meta: { hasBorderLeft: true },
            cell: info => {
              const value = info.getValue()
              if (value === null) return emptyCell
              return <NumericCell value={value} decimals={1} suffix="%" />
            },
          }),
          columnHelper.accessor('shardWinWithout', {
            header: 'Without',
            size: 80,
            cell: info => {
              const value = info.getValue()
              if (value === null) return emptyCell
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
          }),
          columnHelper.accessor('shardDelta', {
            header: 'Delta',
            size: 65,
            cell: info => {
              const value = info.getValue()
              if (value === null) return emptyCell
              return <DeltaCell value={value} decimals={1} suffix="%" />
            },
          }),
          columnHelper.accessor('shardWinWith', {
            header: 'With',
            size: 80,
            cell: info => {
              const value = info.getValue()
              if (value === null) return emptyCell
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
          }),
        ],
      }),
    ],
    [columnHelper]
  )

  const handleRowClick = (row: AghsRow) => {
    navigate(`/abilities/${row.abilityId}`)
  }

  if (error) {
    return (
      <PageShell title="Aghanim's Abilities">
        <p style={{ color: 'var(--color-negative)' }}>
          Error loading Aghanim's data. Please try again later.
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell
      title="Aghanim's Abilities"
      subtitle={currentPatch ? `Patch ${currentPatch}` : 'Loading...'}
      actions={<PatchSelector />}
    >
      <DataTable
        data={statsData}
        columns={columns}
        searchPlaceholder="Search abilities..."
        searchableColumns={['abilityName', 'shortName']}
        initialSorting={[{ id: 'scepterDelta', desc: true }]}
        onRowClick={handleRowClick}
        emptyMessage="No Aghanim's abilities found"
        loading={isLoading}
      />
    </PageShell>
  )
}
