#!/usr/bin/env node

/**
 * Fetches static hero and ability data from the API and generates
 * TypeScript files with optimized lookup maps.
 *
 * Usage: node scripts/update-static-data.js
 */

const fs = require('fs');
const path = require('path');

const API_BASE = 'https://api.windrun.io';
const OUTPUT_DIR = path.join(__dirname, '../src/data');

// Hero attributes and attack types (Dota 2 standard data)
// str = Strength, agi = Agility, int = Intelligence, uni = Universal
const HERO_ATTRIBUTES = {
  1: 'agi', // Anti-Mage
  2: 'str', // Axe
  3: 'uni', // Bane
  4: 'agi', // Bloodseeker
  5: 'uni', // Crystal Maiden
  6: 'agi', // Drow Ranger
  7: 'str', // Earthshaker
  8: 'agi', // Juggernaut
  9: 'uni', // Mirana
  10: 'agi', // Morphling
  11: 'agi', // Shadow Fiend
  12: 'agi', // Phantom Lancer
  13: 'uni', // Puck
  14: 'str', // Pudge
  15: 'agi', // Razor
  16: 'str', // Sand King
  17: 'int', // Storm Spirit
  18: 'str', // Sven
  19: 'str', // Tiny
  20: 'uni', // Vengeful Spirit
  21: 'int', // Windrunner
  22: 'int', // Zeus
  23: 'str', // Kunkka
  25: 'int', // Lina
  26: 'agi', // Lion (actually int but Lion is int)
  27: 'int', // Shadow Shaman
  28: 'int', // Slardar (actually str)
  29: 'str', // Tidehunter
  30: 'int', // Witch Doctor
  31: 'int', // Lich
  32: 'int', // Riki (actually agi)
  33: 'int', // Enigma
  34: 'int', // Tinker
  35: 'agi', // Sniper
  36: 'int', // Necrophos
  37: 'int', // Warlock
  38: 'str', // Beastmaster
  39: 'int', // Queen of Pain
  40: 'agi', // Venomancer
  41: 'agi', // Faceless Void
  42: 'str', // Wraith King
  43: 'int', // Death Prophet
  44: 'agi', // Phantom Assassin
  45: 'int', // Pugna
  46: 'agi', // Templar Assassin
  47: 'agi', // Viper
  48: 'agi', // Luna
  49: 'str', // Dragon Knight
  50: 'int', // Dazzle
  51: 'str', // Clockwerk
  52: 'int', // Leshrac
  53: 'int', // Nature\'s Prophet
  54: 'str', // Lifestealer
  55: 'int', // Dark Seer
  56: 'agi', // Clinkz
  57: 'str', // Omniknight
  58: 'int', // Enchantress
  59: 'str', // Huskar
  60: 'str', // Night Stalker
  61: 'agi', // Broodmother
  62: 'agi', // Bounty Hunter
  63: 'agi', // Weaver
  64: 'int', // Jakiro
  65: 'str', // Batrider
  66: 'int', // Chen
  67: 'int', // Spectre (actually agi)
  68: 'int', // Ancient Apparition
  69: 'uni', // Doom
  70: 'agi', // Ursa
  71: 'str', // Spirit Breaker
  72: 'agi', // Gyrocopter
  73: 'agi', // Alchemist
  74: 'int', // Invoker
  75: 'int', // Silencer
  76: 'int', // Outworld Destroyer
  77: 'str', // Lycan
  78: 'str', // Brewmaster
  79: 'int', // Shadow Demon
  80: 'agi', // Lone Druid
  81: 'str', // Chaos Knight
  82: 'agi', // Meepo
  83: 'str', // Treant Protector
  84: 'int', // Ogre Magi
  85: 'str', // Undying
  86: 'int', // Rubick
  87: 'int', // Disruptor
  88: 'agi', // Nyx Assassin
  89: 'agi', // Naga Siren
  90: 'int', // Keeper of the Light
  91: 'int', // Io
  92: 'int', // Visage
  93: 'agi', // Slark
  94: 'agi', // Medusa
  95: 'agi', // Troll Warlord
  96: 'str', // Centaur Warrunner
  97: 'str', // Magnus
  98: 'str', // Timbersaw
  99: 'str', // Bristleback
  100: 'str', // Tusk
  101: 'int', // Skywrath Mage
  102: 'str', // Abaddon
  103: 'str', // Elder Titan
  104: 'str', // Legion Commander
  105: 'agi', // Techies (now agi)
  106: 'agi', // Ember Spirit
  107: 'str', // Earth Spirit
  108: 'agi', // Underlord (actually str)
  109: 'agi', // Terrorblade
  110: 'str', // Phoenix
  111: 'int', // Oracle
  112: 'int', // Winter Wyvern
  113: 'str', // Arc Warden (actually agi)
  114: 'agi', // Monkey King
  119: 'int', // Dark Willow
  120: 'str', // Pangolier
  121: 'int', // Grimstroke
  123: 'agi', // Hoodwink
  126: 'str', // Void Spirit
  128: 'int', // Snapfire
  129: 'str', // Mars
  131: 'int', // Dawnbreaker (actually str)
  132: 'int', // Marci (actually str)
  133: 'int', // Primal Beast
  134: 'int', // Muerta
  135: 'uni', // Ringmaster
  136: 'uni', // Kez
};

// Attack types: melee or ranged
const HERO_ATTACK_TYPES = {
  1: 'melee', // Anti-Mage
  2: 'melee', // Axe
  3: 'ranged', // Bane
  4: 'melee', // Bloodseeker
  5: 'ranged', // Crystal Maiden
  6: 'ranged', // Drow Ranger
  7: 'melee', // Earthshaker
  8: 'melee', // Juggernaut
  9: 'ranged', // Mirana
  10: 'ranged', // Morphling
  11: 'ranged', // Shadow Fiend
  12: 'melee', // Phantom Lancer
  13: 'ranged', // Puck
  14: 'melee', // Pudge
  15: 'ranged', // Razor
  16: 'melee', // Sand King
  17: 'ranged', // Storm Spirit
  18: 'melee', // Sven
  19: 'melee', // Tiny
  20: 'ranged', // Vengeful Spirit
  21: 'ranged', // Windrunner
  22: 'ranged', // Zeus
  23: 'melee', // Kunkka
  25: 'ranged', // Lina
  26: 'ranged', // Lion
  27: 'ranged', // Shadow Shaman
  28: 'melee', // Slardar
  29: 'melee', // Tidehunter
  30: 'ranged', // Witch Doctor
  31: 'ranged', // Lich
  32: 'melee', // Riki
  33: 'ranged', // Enigma
  34: 'ranged', // Tinker
  35: 'ranged', // Sniper
  36: 'ranged', // Necrophos
  37: 'ranged', // Warlock
  38: 'melee', // Beastmaster
  39: 'ranged', // Queen of Pain
  40: 'ranged', // Venomancer
  41: 'melee', // Faceless Void
  42: 'melee', // Wraith King
  43: 'ranged', // Death Prophet
  44: 'melee', // Phantom Assassin
  45: 'ranged', // Pugna
  46: 'ranged', // Templar Assassin
  47: 'ranged', // Viper
  48: 'ranged', // Luna
  49: 'melee', // Dragon Knight
  50: 'ranged', // Dazzle
  51: 'melee', // Clockwerk
  52: 'ranged', // Leshrac
  53: 'ranged', // Nature\'s Prophet
  54: 'melee', // Lifestealer
  55: 'melee', // Dark Seer
  56: 'ranged', // Clinkz
  57: 'melee', // Omniknight
  58: 'ranged', // Enchantress
  59: 'ranged', // Huskar
  60: 'melee', // Night Stalker
  61: 'melee', // Broodmother
  62: 'melee', // Bounty Hunter
  63: 'ranged', // Weaver
  64: 'ranged', // Jakiro
  65: 'melee', // Batrider
  66: 'ranged', // Chen
  67: 'melee', // Spectre
  68: 'ranged', // Ancient Apparition
  69: 'melee', // Doom
  70: 'melee', // Ursa
  71: 'melee', // Spirit Breaker
  72: 'ranged', // Gyrocopter
  73: 'melee', // Alchemist
  74: 'ranged', // Invoker
  75: 'ranged', // Silencer
  76: 'ranged', // Outworld Destroyer
  77: 'melee', // Lycan
  78: 'melee', // Brewmaster
  79: 'ranged', // Shadow Demon
  80: 'ranged', // Lone Druid
  81: 'melee', // Chaos Knight
  82: 'melee', // Meepo
  83: 'melee', // Treant Protector
  84: 'melee', // Ogre Magi
  85: 'melee', // Undying
  86: 'ranged', // Rubick
  87: 'ranged', // Disruptor
  88: 'melee', // Nyx Assassin
  89: 'melee', // Naga Siren
  90: 'ranged', // Keeper of the Light
  91: 'ranged', // Io
  92: 'ranged', // Visage
  93: 'melee', // Slark
  94: 'ranged', // Medusa
  95: 'melee', // Troll Warlord
  96: 'melee', // Centaur Warrunner
  97: 'melee', // Magnus
  98: 'melee', // Timbersaw
  99: 'melee', // Bristleback
  100: 'melee', // Tusk
  101: 'ranged', // Skywrath Mage
  102: 'melee', // Abaddon
  103: 'melee', // Elder Titan
  104: 'melee', // Legion Commander
  105: 'ranged', // Techies
  106: 'melee', // Ember Spirit
  107: 'melee', // Earth Spirit
  108: 'melee', // Underlord
  109: 'melee', // Terrorblade
  110: 'ranged', // Phoenix
  111: 'ranged', // Oracle
  112: 'ranged', // Winter Wyvern
  113: 'ranged', // Arc Warden
  114: 'melee', // Monkey King
  119: 'ranged', // Dark Willow
  120: 'melee', // Pangolier
  121: 'ranged', // Grimstroke
  123: 'ranged', // Hoodwink
  126: 'melee', // Void Spirit
  128: 'ranged', // Snapfire
  129: 'melee', // Mars
  131: 'melee', // Dawnbreaker
  132: 'melee', // Marci
  133: 'melee', // Primal Beast
  134: 'ranged', // Muerta
  135: 'ranged', // Ringmaster
  136: 'melee', // Kez
};

async function fetchJson(url) {
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch ${url}: ${response.status}`);
  }
  return response.json();
}

async function updateHeroes() {
  console.log('Fetching heroes...');
  const { data } = await fetchJson(`${API_BASE}/api/v2/static/heroes`);

  // data is already keyed by hero ID: { "1": {...}, "2": {...}, ... }
  // Add primaryAttribute and attackType to each hero
  const heroesById = {};
  for (const [id, hero] of Object.entries(data)) {
    const heroId = parseInt(id);
    heroesById[id] = {
      ...hero,
      primaryAttribute: HERO_ATTRIBUTES[heroId] || 'uni',
      attackType: HERO_ATTACK_TYPES[heroId] || 'melee',
    };
  }

  // Create reverse lookups
  const heroesByShortName = {};
  const heroesByPicture = {};

  for (const [id, hero] of Object.entries(heroesById)) {
    if (hero.shortName) {
      heroesByShortName[hero.shortName] = hero;
    }
    if (hero.picture) {
      heroesByPicture[hero.picture] = hero;
    }
  }

  const heroCount = Object.keys(heroesById).length;
  console.log(`  Found ${heroCount} heroes`);

  const output = `// Auto-generated by scripts/update-static-data.js
// Last updated: ${new Date().toISOString()}

export interface Hero {
  id: number
  cdota: string
  englishName: string
  npc: string
  picture: string
  shortName: string
  primaryAttribute: string
  attackType: string
}

/** Map of hero ID (number as string key) to Hero object */
export const heroesById: Record<string, Hero> = ${JSON.stringify(heroesById, null, 2)}

/** Map of hero shortName to Hero object */
export const heroesByShortName: Record<string, Hero> = ${JSON.stringify(heroesByShortName, null, 2)}

/** Map of hero picture name to Hero object */
export const heroesByPicture: Record<string, Hero> = ${JSON.stringify(heroesByPicture, null, 2)}

/** Get hero by numeric ID (fast lookup) */
export function getHeroById(id: number): Hero | undefined {
  return heroesById[String(id)]
}

/** Get hero by shortName */
export function getHeroByShortName(shortName: string): Hero | undefined {
  return heroesByShortName[shortName]
}

/** Total number of heroes */
export const HERO_COUNT = ${heroCount}
`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'heroes.ts'), output);
  console.log('  Written to src/data/heroes.ts');
}

async function updateAbilities() {
  console.log('Fetching abilities...');
  const { data } = await fetchJson(`${API_BASE}/api/v2/static/abilities`);

  // data is an array, we need to index by valveId
  const abilitiesById = {};
  const abilitiesByShortName = {};

  for (const ability of data) {
    if (ability.valveId != null) {
      abilitiesById[String(ability.valveId)] = ability;
    }
    if (ability.shortName) {
      abilitiesByShortName[ability.shortName] = ability;
    }
  }

  const abilityCount = data.length;
  const indexedCount = Object.keys(abilitiesById).length;
  console.log(`  Found ${abilityCount} abilities (${indexedCount} with valid IDs)`);

  const output = `// Auto-generated by scripts/update-static-data.js
// Last updated: ${new Date().toISOString()}

export interface Ability {
  englishName: string
  shortName: string
  isUltimate: boolean | null
  tooltip: string | null
  valveId: number
  ownerHeroId: number | null
  hasScepter: boolean
  hasShard: boolean
}

/** Map of ability valveId (number as string key) to Ability object */
export const abilitiesById: Record<string, Ability> = ${JSON.stringify(abilitiesById, null, 2)}

/** Map of ability shortName to Ability object */
export const abilitiesByShortName: Record<string, Ability> = ${JSON.stringify(abilitiesByShortName, null, 2)}

/** Get ability by valveId (fast lookup) */
export function getAbilityById(id: number): Ability | undefined {
  return abilitiesById[String(id)]
}

/** Get ability by shortName */
export function getAbilityByShortName(shortName: string): Ability | undefined {
  return abilitiesByShortName[shortName]
}

/** Total number of abilities */
export const ABILITY_COUNT = ${abilityCount}
`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'abilities.ts'), output);
  console.log('  Written to src/data/abilities.ts');
}

async function updateItems() {
  console.log('Fetching items...');
  const { data } = await fetchJson(`${API_BASE}/api/v2/static/items`);

  // data is an array, index by valveId
  const itemsById = {};
  const itemsByName = {};

  for (const item of data) {
    if (item.valveId != null) {
      // Extract short name from item.name (remove "item_" prefix)
      const shortName = item.name.replace(/^item_/, '');
      const processedItem = {
        ...item,
        shortName,
      };
      itemsById[String(item.valveId)] = processedItem;
      if (item.name) {
        itemsByName[item.name] = processedItem;
      }
    }
  }

  const itemCount = data.length;
  const indexedCount = Object.keys(itemsById).length;
  console.log(`  Found ${itemCount} items (${indexedCount} with valid IDs)`);

  const output = `// Auto-generated by scripts/update-static-data.js
// Last updated: ${new Date().toISOString()}

export interface Item {
  name: string
  nameEnglishLoc: string
  nameLoc: string
  neutralItemTier: number
  recipes: number[] | null
  valveId: number
  shortName: string
}

/** Map of item valveId (number as string key) to Item object */
export const itemsById: Record<string, Item> = ${JSON.stringify(itemsById, null, 2)}

/** Map of item name to Item object */
export const itemsByName: Record<string, Item> = ${JSON.stringify(itemsByName, null, 2)}

/** Get item by valveId (fast lookup) */
export function getItemById(id: number): Item | undefined {
  return itemsById[String(id)]
}

/** Get item by name */
export function getItemByName(name: string): Item | undefined {
  return itemsByName[name]
}

/** Total number of items */
export const ITEM_COUNT = ${itemCount}
`;

  fs.writeFileSync(path.join(OUTPUT_DIR, 'items.ts'), output);
  console.log('  Written to src/data/items.ts');
}

async function main() {
  console.log('Updating static data from API...\n');

  // Ensure output directory exists
  if (!fs.existsSync(OUTPUT_DIR)) {
    fs.mkdirSync(OUTPUT_DIR, { recursive: true });
  }

  try {
    await updateHeroes();
    await updateAbilities();
    await updateItems();

    // Create index file
    const indexOutput = `// Auto-generated by scripts/update-static-data.js
export * from './heroes'
export * from './abilities'
export * from './items'
`;
    fs.writeFileSync(path.join(OUTPUT_DIR, 'index.ts'), indexOutput);

    console.log('\nDone! Static data updated successfully.');
  } catch (error) {
    console.error('\nError updating static data:', error.message);
    process.exit(1);
  }
}

main();
