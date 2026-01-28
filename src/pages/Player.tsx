import { useParams } from 'react-router-dom'

export function PlayerPage() {
  const { playerId } = useParams()
  return <div className="page page-player"><h1>Player: {playerId}</h1></div>
}
