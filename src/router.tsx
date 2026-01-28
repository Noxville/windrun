/**
 * Copyright (C) 2026 Ben Steenhuisen
 *
 * This program is free software: you can redistribute it and/or modify
 * it under the terms of the GNU Affero General Public License as
 * published by the Free Software Foundation, either version 3 of the
 * License, or (at your option) any later version.
 *
 * This program is distributed in the hope that it will be useful,
 * but WITHOUT ANY WARRANTY; without even the implied warranty of
 * MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE. See the
 * GNU Affero General Public License for more details.
 *
 * You should have received a copy of the GNU Affero General Public License
 * along with this program. If not, see <https://www.gnu.org/licenses/>.
 */

import { createBrowserRouter } from 'react-router-dom'
import { AppLayout } from './components/AppLayout'
import { HomePage } from './pages/Home'
import { StatusPage } from './pages/Status'
import { AboutPage } from './pages/About'
import { HeroesPage } from './pages/Heroes'
import { HeroesHistoricPage } from './pages/HeroesHistoric'
import { HeroDetailPage } from './pages/HeroDetail'
import { FacetsPage } from './pages/Facets'
import { AbilitiesPage } from './pages/Abilities'
import { AbilityDetailPage } from './pages/AbilityDetail'
import { AbilityPairsPage } from './pages/AbilityPairs'
import { AbilityHighSkillPage } from './pages/AbilityHighSkill'
import { AbilityShiftsPage } from './pages/AbilityShifts'
import { AbilityHeroAttributesPage } from './pages/AbilityHeroAttributes'
import { AbilityByHeroPage } from './pages/AbilityByHero'
import { AbilityAghsPage } from './pages/AbilityAghs'
import { LeaderboardPage } from './pages/Leaderboard'
import { DistributionPage } from './pages/Distribution'
import { PlayerPage } from './pages/Player'
import { MatchPage } from './pages/Match'
import { PredictionGamePage } from './pages/PredictionGame'
import { ErrorPage } from './pages/Error'
import { NotFoundPage } from './pages/NotFound'

export const router = createBrowserRouter([
  {
    element: <AppLayout />,
    children: [
      { path: '/', element: <HomePage /> },
      { path: '/status', element: <StatusPage /> },
      { path: '/about', element: <AboutPage /> },
      { path: '/heroes', element: <HeroesPage /> },
      { path: '/heroes/historic', element: <HeroesHistoricPage /> },
      { path: '/heroes/:heroId', element: <HeroDetailPage /> },
      { path: '/facets', element: <FacetsPage /> },
      { path: '/abilities', element: <AbilitiesPage /> },
      { path: '/abilities/:abilityId', element: <AbilityDetailPage /> },
      { path: '/ability-pairs', element: <AbilityPairsPage /> },
      { path: '/ability-high-skill', element: <AbilityHighSkillPage /> },
      { path: '/ability-shifts', element: <AbilityShiftsPage /> },
      { path: '/ability-hero-attributes', element: <AbilityHeroAttributesPage /> },
      { path: '/ability-by-hero', element: <AbilityByHeroPage /> },
      { path: '/ability-aghs', element: <AbilityAghsPage /> },
      { path: '/leaderboard', element: <LeaderboardPage /> },
      { path: '/leaderboard/:region', element: <LeaderboardPage /> },
      { path: '/player-distribution', element: <DistributionPage /> },
      { path: '/players/:playerId', element: <PlayerPage /> },
      { path: '/matches/:matchId', element: <MatchPage /> },
      { path: '/game', element: <PredictionGamePage /> },
      { path: '/error', element: <ErrorPage /> },
      { path: '*', element: <NotFoundPage /> },
    ],
  },
])
