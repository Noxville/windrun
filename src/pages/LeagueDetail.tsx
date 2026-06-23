import { useParams, Link } from 'react-router-dom'
import { PageShell } from '../components/PageShell'
import { LeagueMatchList } from '../components/LeagueMatchList'
import { usePersistedQuery } from '../api'
import type { LeagueMatch, LeagueInfo } from '../types'

export function LeagueDetailPage() {
  const { leagueId } = useParams()

  const { data: infoData, error: infoError } = usePersistedQuery<{ data: LeagueInfo }>(
    leagueId ? `/league/${leagueId}/info` : null
  )
  const { data: matchData, isLoading, error: matchError } = usePersistedQuery<{ data: LeagueMatch[] }>(
    leagueId ? `/league/${leagueId}/league-matches` : null
  )

  if (infoError || matchError) {
    return (
      <PageShell title="League">
        <p style={{ color: 'var(--color-negative)' }}>
          Error loading this league.{' '}
          <Link to="/league-games" style={{ color: 'var(--color-accent)' }}>
            Back to League Games
          </Link>
        </p>
      </PageShell>
    )
  }

  const info = infoData?.data
  const title = info?.name ?? 'League'
  const subtitle = info ? `Tier ${info.tier} · ${info.league_id}` : undefined

  return (
    <PageShell title={title} subtitle={subtitle}>
      <LeagueMatchList matches={matchData?.data ?? []} loading={isLoading} />
    </PageShell>
  )
}
