interface HeroSwapPlayer {
  hero: number
  abilities: number[]
}

// The API can attach a drafted build to its original player after a hero swap.
// Its negative innate ID identifies the hero that should own the whole build.
// Keep player identity/results in place and leave cached API arrays untouched.
export function fixHeroSwaps<T extends HeroSwapPlayer>(
  radiant: T[],
  dire: T[],
): { radiant: T[]; dire: T[] } {
  const fixedPlayers = [...radiant, ...dire].map(p => ({ ...p, abilities: [...p.abilities] }))

  for (const player of fixedPlayers) {
    const innate = player.abilities.find(a => a < 0)
    if (innate === undefined) continue

    const innateHeroId = Math.abs(innate)
    if (innateHeroId !== player.hero) {
      const swapPartner = fixedPlayers.find(p => p.hero === innateHeroId && p !== player)
      if (swapPartner) {
        const temp = player.abilities
        player.abilities = swapPartner.abilities
        swapPartner.abilities = temp
      }
    }
  }

  return {
    radiant: fixedPlayers.slice(0, radiant.length),
    dire: fixedPlayers.slice(radiant.length),
  }
}
