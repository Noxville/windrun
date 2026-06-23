import { PageShell } from '../components/PageShell'
import { LeagueMatchList } from '../components/LeagueMatchList'
import { usePersistedQuery } from '../api'
import type { LeagueMatch } from '../types'

export function LeagueGamesPage() {
  const { data, isLoading, error } = usePersistedQuery<{ data: LeagueMatch[] }>('/league-matches')

  if (error) {
    return (
      <PageShell title="League Games">
        <p style={{ color: 'var(--color-negative)' }}>
          Error loading league games. Please try again later.
        </p>
      </PageShell>
    )
  }

  return (
    <PageShell title="League Games" subtitle="Recent ticketed matches across all leagues">
      <LeagueMatchList matches={data?.data ?? []} loading={isLoading} showLeague />
    </PageShell>
  )
}
