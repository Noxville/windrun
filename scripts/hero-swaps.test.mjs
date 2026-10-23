import assert from 'node:assert/strict'
import test from 'node:test'
import { fixHeroSwaps } from '../src/utils/heroSwaps.ts'

const player = (steamId, hero, abilities) => ({
  steamId, hero, abilities, kills: steamId, items: [steamId + 1],
})

test('swapped builds follow the final hero without moving player identity or results', () => {
  const before = [player(200348990, 4, [-11, 100, 101]), player(2, 11, [200, -4, 201])]
  const snapshot = structuredClone(before)
  const { radiant } = fixHeroSwaps(before, [])
  assert.deepEqual(radiant[0], { ...before[0], abilities: [200, -4, 201] })
  assert.deepEqual(radiant[1], { ...before[1], abilities: [-11, 100, 101] })
  assert.deepEqual(before, snapshot, 'React Query cache must remain unmodified')
  assert.notEqual(radiant[0].abilities, before[1].abilities)
  assert.deepEqual(fixHeroSwaps(radiant, []).radiant, radiant, 'Already corrected data is stable')
})

test('unchanged and missing-marker builds are preserved', () => {
  const radiant = [player(1, 4, [-4, 100]), player(2, 11, [200, 201]), player(3, 22, [])]
  const dire = [player(4, 55, [-55, 300])]
  assert.deepEqual(fixHeroSwaps(radiant, dire), { radiant, dire })
})

test('a marker with no matching hero does not discard or invent abilities', () => {
  const radiant = [player(1, 4, [-99, 100])]
  assert.deepEqual(fixHeroSwaps(radiant, []), { radiant, dire: [] })
})

test('Dire swaps preserve team membership and roster lengths', () => {
  const radiant = [player(1, 22, [-22, 300])]
  const dire = [player(2, 4, [-11, 100]), player(3, 11, [-4, 200])]
  const fixed = fixHeroSwaps(radiant, dire)
  assert.deepEqual(fixed.radiant, radiant)
  assert.deepEqual(fixed.dire.map(p => p.steamId), [2, 3])
  assert.deepEqual(fixed.dire.map(p => p.abilities), [[-4, 200], [-11, 100]])
})
