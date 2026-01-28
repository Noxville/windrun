# Windrun Frontend

A React + TypeScript frontend for [windrun.io](https://windrun.io) — a Dota 2 Ability Draft statistics site.

## Architecture

| Layer | Technology |
|-------|-----------|
| Framework | React 18 + TypeScript |
| Build | Vite |
| Routing | React Router v6 |
| Data fetching | TanStack Query (React Query) |
| Tables | TanStack Table + TanStack Virtual |
| Styling | CSS Modules + CSS custom properties |
| Animations | Motion (framer-motion) + CSS transitions |
| Auth | Steam OpenID via API redirect flow |
| Deployment | Static files served via nginx |

## API Configuration

The frontend talks to the Windrun API. The base URL is configurable:

- **Production**: `https://api.windrun.io`
- **Development**: `http://localhost:8100`

Set via `VITE_API_BASE_URL` in `.env.development` / `.env.production`.

## CDN Image Patterns

Hero and ability images are served from the datdota CDN:

```
Hero full:    https://cdn.datdota.com/images/heroes/{picture}_full.png
Hero mini:    https://cdn.datdota.com/images/miniheroes/{picture}.png
Ability icon: https://cdn.datdota.com/images/ability/{shortName}.png
```

Where `{picture}` comes from `/api/v2/static/heroes` and `{shortName}` from `/api/v2/static/abilities`.

## Static Data

The API exposes hero/ability definitions at:
- `GET /api/v2/static/heroes` — hero IDs, names, image keys
- `GET /api/v2/static/abilities` — ability IDs, names, ultimate flag, tooltips

These are fetched once on app load and cached client-side.

## Authentication Flow

1. User clicks "Login with Steam" in the frontend
2. Frontend redirects to `{API_BASE}/user/login`
3. API initiates Steam OpenID handshake
4. Steam authenticates, redirects back to API callback
5. API sets an HTTP-only session cookie
6. API redirects to frontend URL (configurable return URL)
7. Frontend calls `{API_BASE}/user/verify` to get current user info
8. Logout: frontend redirects to `{API_BASE}/user/logout`, which clears cookie and redirects back

## Site Map

### Pages

| Route | Type | Description |
|-------|------|-------------|
| `/` | General | Home — featured matches, site stats, recent activity |
| `/status` | General | Data pipeline status, patch info, game counts |
| `/about` | General | About the site, methodology, credits |
| `/heroes` | Persisted Query | Hero win rates table (sortable, filterable) |
| `/heroes/historic` | Persisted Query | Historical hero rankings across patches |
| `/heroes/:heroId` | Detail | Single hero stats with ability breakdowns |
| `/facets` | Persisted Query | Hero facet statistics |
| `/abilities` | Persisted Query | All ability statistics with valuations |
| `/abilities/:abilityId` | Detail | Single ability detail page |
| `/ability-pairs` | Persisted Query | Ability synergy combinations |
| `/ability-high-skill` | Persisted Query | High-skill bracket ability analysis |
| `/ability-shifts` | Persisted Query | Player stat impacts by ability |
| `/ability-hero-attributes` | Persisted Query | Ability performance by hero attribute/attack type |
| `/ability-by-hero` | Persisted Query | Abilities grouped by originating hero |
| `/ability-aghs` | Persisted Query | Aghanim's upgrade statistics |
| `/leaderboard` | Leaderboard | Regional player rankings |
| `/leaderboard/:region` | Leaderboard | Region-specific leaderboard |
| `/players/:playerId` | User Page | Player profile, stats, match history |
| `/matches/:matchId` | Match Page | Match detail with draft replay widget |
| `/game` | Interactive | Prediction game |

### Key Components

- **DataTable** — TanStack Table + Virtual. Client-side sorting, search, custom filters. Handles 5k+ rows with virtualization.
- **Navigation** — Top nav with dropdowns (Heroes, Abilities, Players, Leaderboards)
- **HeroCard** — Hero portrait with name, CDN image
- **AbilityIcon** — Ability icon with tooltip, CDN image
- **DraftReplay** — Step-through draft visualization (designed for future deep-link pool analysis)
- **SynergyBadge** — Green/red percentage indicator for ability synergies
- **PageShell** — Consistent layout wrapper with nav + footer + page transitions

### Design Principles

- **Theme**: Dark background, high-contrast text, Dota 2 asset colors as accents
- **Fonts**: Distinctive typefaces. Extreme weight contrasts (100-200 vs 800-900). Size jumps of 3x+.
- **Colors**: CSS custom properties. Dominant dark with sharp accent colors.
- **Animations**: Orchestrated page-load staggered reveals, hover micro-interactions. Motion for React, CSS-only where possible.

## Project Phases

### Pages to Do:
- [ ] Separate draft replay widget (deep-link)
- [ ] Player profile page
- [ ] Player match history
- [ ] Player advanced stats

### Authentication
- [ ] Login/logout redirect flow
- [ ] User state via /user/verify
- [ ] Protected UI elements
- [ ] New API endpoints on backend (userLogin, userLogout, userVerify)

## Development

```bash
npm install        # Install dependencies
npm run dev        # Dev server (API: localhost:8100)
npm run build      # Production build → dist/
npm run preview    # Preview production build locally
```

## Deployment

```bash
npm run build
scp -r dist/* user@server:/var/www/windrun/
```

## Key Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Build tool | Vite | Fast builds, modern ESM, perfect for static SPA |
| Styling | CSS Modules + custom properties | Zero runtime, full creative control, scoped |
| Tables | TanStack Table + Virtual | Client-side sort/filter, no API pagination needed, 5k+ row virtualization |
| Auth | API redirect + HTTP-only cookie | Secure (no tokens in JS), simple frontend, leverages existing backend |
| Animations | Motion + CSS | Orchestrated page transitions, CSS micro-interactions |
| Data | TanStack Query | Caching, stale-while-revalidate, loading/error states |

## Important Notes

- Auth handled entirely via HTTP-only cookies set by the API
- Draft replay widget designed for future deep-link analysis capability
- API needs new endpoints: about, predictionGame, userLogin, userLogout, userVerify
- The API returns 503 with Retry-After header when data is being recalculated

## License

This project is licensed under the **GNU Affero General Public License v3.0 (AGPL-3.0)**.

If you modify this project and run it as a network service, you are required to make the source code of your modified version available to users under the same license.

See the [LICENSE](./LICENSE) file for the full license text.

The project name, logo, and branding are not covered by the AGPL license and may not be used without permission.
