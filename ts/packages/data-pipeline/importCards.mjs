#!/usr/bin/env node
// Build the Standard-legal card pool from PokemonTCG/pokemon-tcg-data into the
// engine's card schema.
//
//   node packages/data-pipeline/importCards.mjs [--marks G,H,I,J] [--refresh]
//
// Rotation is a regulation-mark filter: when Play! Pokémon rotates, edit MARKS
// (or pass --marks). Basic Energy never rotates and is always included.
// ponytail: raw set files are cached under ts/data/.cache; delete or pass --refresh to refetch.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const CACHE = path.join(ROOT, 'data/.cache');
const SRC = 'https://raw.githubusercontent.com/PokemonTCG/pokemon-tcg-data/master';
const MARKS = new Set((argValue('--marks') ?? 'G,H,I,J').split(','));
const REFRESH = process.argv.includes('--refresh');
// SV-era onwards; older sets cannot carry a mark from G onwards.
const OLDEST_SET_RELEASE = '2023/01/01';

function argValue(flag) {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : undefined;
}

async function fetchJson(urlPath) {
  const cached = path.join(CACHE, urlPath.replace(/\//g, '_'));
  if (!REFRESH && fs.existsSync(cached)) return JSON.parse(fs.readFileSync(cached, 'utf8'));
  const res = await fetch(`${SRC}/${urlPath}`);
  if (!res.ok) throw new Error(`${res.status} fetching ${urlPath}`);
  const json = await res.json();
  fs.mkdirSync(CACHE, { recursive: true });
  fs.writeFileSync(cached, JSON.stringify(json));
  return json;
}

const ENERGY_TYPES = ['Grass', 'Fire', 'Water', 'Lightning', 'Psychic', 'Fighting', 'Darkness', 'Metal', 'Fairy', 'Dragon'];

function stageOf(subtypes) {
  if (subtypes.includes('Stage 2')) return 2;
  if (subtypes.includes('Stage 1')) return 1;
  return 0;
}

// "Pokémon ex rule: When your Pokémon ex is Knocked Out, your opponent takes 2 Prize cards."
function prizeValueOf(rules) {
  const m = /opponent takes (\d+) Prize/i.exec(rules.join(' '));
  return m ? Number(m[1]) : 1;
}

// "100+" / "120×" / "" -> { baseDamage, damageModifier }
function parseDamage(damage) {
  const m = /^(\d+)([+×x])?$/.exec((damage ?? '').trim());
  if (!m) return { baseDamage: 0, damageModifier: null };
  return { baseDamage: Number(m[1]), damageModifier: m[2] ?? null };
}

function trainerSubtype(subtypes) {
  if (subtypes.includes('Supporter')) return 'supporter';
  if (subtypes.includes('Stadium')) return 'stadium';
  if (subtypes.includes('Pokémon Tool')) return 'tool';
  return 'item';
}

/**
 * What an Energy card actually pays for. Getting this from the printed text
 * matters: most Special Energy provides only Colorless, and treating it as a
 * wild that satisfies typed costs makes every Special Energy strictly better
 * than the real card.
 */
function energyProvides(card) {
  if (card.subtypes?.includes('Basic')) {
    return ENERGY_TYPES.find((t) => card.name.includes(t)) ?? 'any';
  }

  const text = (card.rules ?? []).join(' ');
  // "provides every type of Energy" — a genuine wild.
  if (/provides every type of Energy/.test(text)) return 'any';
  // "provides 2 in any combination of Psychic Energy and Darkness Energy"
  const combination = /in any combination of (\w+) Energy and (\w+) Energy/.exec(text);
  if (combination) return [combination[1], combination[2]];
  const single = /it provides (\w+) Energy/.exec(text);
  if (single && ENERGY_TYPES.includes(single[1])) return single[1];
  if (single && single[1] === 'Colorless') return 'Colorless';
  return 'Colorless'; // unparsed Special Energy pays generic costs only
}

function convert(card, setId) {
  const subtypes = card.subtypes ?? [];
  const rules = card.rules ?? [];
  const common = { id: card.id, name: card.name, setId, regulationMark: card.regulationMark ?? null, rulesText: rules };

  if (card.supertype === 'Pokémon') {
    return {
      ...common,
      type: 'pokemon',
      hp: Number(card.hp),
      stage: stageOf(subtypes),
      evolvesFrom: card.evolvesFrom,
      subtypes,
      types: card.types ?? [],
      weakness: card.weaknesses?.[0] ? { type: card.weaknesses[0].type, mult: 2 } : undefined,
      resistance: card.resistances?.[0] ? { type: card.resistances[0].type, reduce: 30 } : undefined,
      retreatCost: card.convertedRetreatCost ?? 0,
      prizeValue: prizeValueOf(rules),
      abilities: (card.abilities ?? []).map((a) => ({ name: a.name, kind: a.type, text: a.text, effect: [] })),
      attacks: (card.attacks ?? []).map((a) => ({
        name: a.name,
        cost: a.cost ?? [],
        ...parseDamage(a.damage),
        text: a.text ?? '',
        effect: [],
      })),
    };
  }
  if (card.supertype === 'Trainer') {
    return { ...common, type: 'trainer', subtype: trainerSubtype(subtypes), text: rules.join(' '), effect: [] };
  }
  if (card.supertype === 'Energy') {
    return {
      ...common,
      type: 'energy',
      basic: subtypes.includes('Basic'),
      providesType: energyProvides(card),
      text: rules.join(' '),
      effect: [],
    };
  }
  return null;
}

const isLegal = (card) =>
  MARKS.has(card.regulationMark) ||
  (card.supertype === 'Energy' && card.subtypes?.includes('Basic'));

const sets = await fetchJson('sets/en.json');
const candidates = sets.filter((s) => s.releaseDate >= OLDEST_SET_RELEASE);
const pool = [];
const bySet = {};

for (const set of candidates) {
  let cards;
  try {
    cards = await fetchJson(`cards/en/${set.id}.json`);
  } catch (e) {
    console.warn(`skip ${set.id}: ${e.message}`);
    continue;
  }
  const legal = cards.filter(isLegal).map((c) => convert(c, set.id)).filter(Boolean);
  if (!legal.length) continue;
  bySet[set.id] = { ptcgoCode: set.ptcgoCode, name: set.name, count: legal.length };
  pool.push(...legal);
}

const out = {
  format: 'Standard',
  regulationMarks: [...MARKS],
  generatedAt: new Date().toISOString().slice(0, 10),
  source: 'https://github.com/PokemonTCG/pokemon-tcg-data',
  sets: bySet,
  cards: pool,
};

fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
fs.writeFileSync(path.join(ROOT, 'data/cards.json'), JSON.stringify(out, null, 1));
fs.writeFileSync(path.join(ROOT, 'packages/ui/public/cards.json'), JSON.stringify(out));

const counts = pool.reduce((m, c) => ((m[c.type] = (m[c.type] || 0) + 1), m), {});
console.log(`sets: ${Object.keys(bySet).length}  cards: ${pool.length}`, counts);
console.log('unimplemented effects:', pool.filter((c) => c.type !== 'pokemon' && !c.effect.length).length, 'trainers/energy');
