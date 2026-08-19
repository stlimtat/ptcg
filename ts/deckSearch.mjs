#!/usr/bin/env node
// Search for a 60-card list by hill climbing on win rate against a fixed
// gauntlet of tournament decks.
//
//   node deckSearch.mjs [--seed-deck <name>] [--iterations 150] [--games 40]
//                       [--gauntlet 6] [--out evolved]
//
// Every candidate is scored on the *same* seeds as the incumbent (common random
// numbers), so a comparison reflects the decklist rather than luck of the draw.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runEpisode, heuristicPolicy } from './packages/engine/dist/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const pool = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/cards.json'), 'utf8'));
const registry = Object.fromEntries(pool.cards.map((c) => [c.id, c]));

const deckDir = path.join(ROOT, 'data/decks');
const deckNames = fs
  .readdirSync(deckDir)
  .filter((f) => f.endsWith('.json') && f !== 'index.json')
  .map((f) => f.replace(/\.json$/, ''));
const deckOf = (name) => JSON.parse(fs.readFileSync(path.join(deckDir, `${name}.json`), 'utf8')).cards;

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : fallback;
};

const ITERATIONS = Number(arg('--iterations', 150));
const GAMES = Number(arg('--games', 40));
const GAUNTLET_SIZE = Number(arg('--gauntlet', 6));
const OUT_NAME = arg('--out', 'evolved');
const SEED_DECK = arg('--seed-deck', deckNames[0]);

// Deterministic RNG: the whole search is reproducible.
let rngState = Number(arg('--rng', 20260812)) >>> 0;
const rng = () => {
  rngState ^= rngState << 13;
  rngState ^= rngState >>> 17;
  rngState ^= rngState << 5;
  rngState >>>= 0;
  return rngState / 0x100000000;
};
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const seededRng = (seed) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

// ---------------------------------------------------------------------------
// Candidate pool: cards that actually see tournament play. Searching all 4582
// Standard cards would spend the whole budget on unplayable ones.
// ---------------------------------------------------------------------------
const CANDIDATES = [...new Set(deckNames.flatMap(deckOf))];
const nameOf = (id) => registry[id].name;
const isBasicEnergy = (id) => registry[id].type === 'energy' && registry[id].basic === true;
const isBasicPokemon = (id) => registry[id].type === 'pokemon' && registry[id].stage === 0;

// Copy limits are per card *name*, and basic Energy is exempt.
function copyCounts(deck) {
  const counts = {};
  for (const id of deck) counts[nameOf(id)] = (counts[nameOf(id)] ?? 0) + 1;
  return counts;
}

function canAdd(deck, id) {
  if (isBasicEnergy(id)) return true;
  return (copyCounts(deck)[nameOf(id)] ?? 0) < 4;
}

/**
 * Make a mutated list playable again: drop Evolution Pokémon whose previous
 * stage is missing, and guarantee enough Basics to open a game with.
 */
function repair(deck) {
  const names = new Set(deck.map(nameOf));
  let fixed = deck.filter((id) => {
    const def = registry[id];
    if (def.type !== 'pokemon' || def.stage === 0) return true;
    // Rare Candy lets a Stage 2 skip its middle stage, so only the Basic matters.
    return def.evolvesFrom ? names.has(def.evolvesFrom) || hasBasicLine(names, def) : true;
  });

  const basics = () => fixed.filter(isBasicPokemon).length;
  const basicPool = CANDIDATES.filter(isBasicPokemon);
  let guard = 0;
  while (basics() < 4 && guard++ < 60) {
    const add = pick(basicPool);
    if (!canAdd(fixed, add)) continue;
    // Replace something that is not a Basic Pokémon.
    const removable = fixed.map((id, i) => [id, i]).filter(([id]) => !isBasicPokemon(id));
    if (removable.length === 0) break;
    fixed.splice(pick(removable)[1], 1);
    fixed.push(add);
  }

  while (fixed.length > 60) fixed.splice(Math.floor(rng() * fixed.length), 1);
  while (fixed.length < 60) {
    const add = pick(CANDIDATES);
    if (canAdd(fixed, add)) fixed.push(add);
  }
  return fixed;
}

function hasBasicLine(names, def) {
  // Walk back down the evolution chain looking for a Basic that is present.
  let current = def;
  for (let depth = 0; depth < 3 && current?.evolvesFrom; depth++) {
    const previous = pool.cards.find((c) => c.type === 'pokemon' && c.name === current.evolvesFrom);
    if (!previous) return false;
    if (previous.stage === 0 && names.has(previous.name)) return true;
    current = previous;
  }
  return false;
}

function mutate(deck) {
  const next = [...deck];
  const swaps = 1 + Math.floor(rng() * 3); // 1-3 cards at a time
  for (let i = 0; i < swaps; i++) {
    next.splice(Math.floor(rng() * next.length), 1);
    for (let attempt = 0; attempt < 20; attempt++) {
      const add = pick(CANDIDATES);
      if (canAdd(next, add)) {
        next.push(add);
        break;
      }
    }
  }
  return repair(next);
}

// ---------------------------------------------------------------------------
// Fitness
// ---------------------------------------------------------------------------
const gauntlet = deckNames.slice(0, GAUNTLET_SIZE);

/**
 * Per-game results on a fixed block of seeds. Returning the individual outcomes
 * (not just the rate) lets two decks be compared game by game on identical
 * conditions, which is far less noisy than comparing two independent averages.
 */
function playBlock(deck, games, seedBase) {
  const outcomes = [];
  for (let i = 0; i < games; i++) {
    const opponent = deckOf(gauntlet[i % gauntlet.length]);
    const swap = i % 2 === 1; // alternate who goes first
    const result = runEpisode(
      swap ? opponent : deck,
      swap ? deck : opponent,
      registry,
      {
        p1: heuristicPolicy(seededRng(seedBase + i * 2 + 1)),
        p2: heuristicPolicy(seededRng(seedBase + i * 2 + 2)),
      },
      { seed: seedBase + i + 1, recordTransitions: false }
    );
    if (!result.winner) outcomes.push(null);
    else outcomes.push(result.winner === (swap ? 'p2' : 'p1') ? 1 : 0);
  }
  return outcomes;
}

const rateOf = (outcomes) => {
  const decided = outcomes.filter((o) => o !== null);
  return decided.length ? decided.reduce((a, b) => a + b, 0) / decided.length : 0;
};

/**
 * Paired sign test over games both decks played under identical conditions.
 * Returns true only when the candidate wins clearly more of the games they
 * disagree on than chance would explain (~2 standard errors).
 */
function beatsIncumbent(candidateOutcomes, incumbentOutcomes) {
  let candidateOnly = 0;
  let incumbentOnly = 0;
  for (let i = 0; i < candidateOutcomes.length; i++) {
    const a = candidateOutcomes[i];
    const b = incumbentOutcomes[i];
    if (a === null || b === null || a === b) continue;
    if (a === 1) candidateOnly++;
    else incumbentOnly++;
  }
  const disagreements = candidateOnly + incumbentOnly;
  if (disagreements < 10) return false; // too little evidence either way
  // Under "no difference" each disagreement is a coin flip.
  const expected = disagreements / 2;
  const stdError = Math.sqrt(disagreements) / 2;
  return candidateOnly - expected > 2 * stdError;
}

// ---------------------------------------------------------------------------
// Hill climb
// ---------------------------------------------------------------------------
let best = repair(deckOf(SEED_DECK));
let bestOutcomes = playBlock(best, GAMES, 0);
let bestScore = rateOf(bestOutcomes);
const startScore = bestScore;
console.log(`seed deck ${SEED_DECK}: ${(startScore * 100).toFixed(1)}% over ${GAMES} games vs ${gauntlet.length} decks`);

let accepted = 0;
let screened = 0;
for (let i = 0; i < ITERATIONS; i++) {
  const candidate = mutate(best);
  const outcomes = playBlock(candidate, GAMES, 0);

  // Cheap screen first: no point confirming something that is not even ahead.
  if (rateOf(outcomes) <= bestScore) continue;
  screened++;

  // Confirm on a fresh, independent block of seeds. A candidate that only looks
  // good on the seeds it was selected against does not survive this.
  const confirmSeed = 100000 + i * 977;
  const candidateConfirm = playBlock(candidate, GAMES, confirmSeed);
  const incumbentConfirm = playBlock(best, GAMES, confirmSeed);
  if (!beatsIncumbent(candidateConfirm, incumbentConfirm)) continue;

  best = candidate;
  bestOutcomes = playBlock(best, GAMES, 0);
  bestScore = rateOf(bestOutcomes);
  accepted++;
  console.log(
    `  iter ${String(i).padStart(4)}: ${(bestScore * 100).toFixed(1)}% search, ` +
      `${(rateOf(candidateConfirm) * 100).toFixed(1)}% vs ${(rateOf(incumbentConfirm) * 100).toFixed(1)}% confirm  (accepted ${accepted})`
  );
}

// Confirm on fresh seeds — the search score is optimistic, having been the thing
// we selected on.
const holdout = (deck) => {
  let wins = 0;
  let decided = 0;
  for (let i = 0; i < GAMES * 2; i++) {
    const opponent = deckOf(gauntlet[i % gauntlet.length]);
    const swap = i % 2 === 1;
    const result = runEpisode(
      swap ? opponent : deck,
      swap ? deck : opponent,
      registry,
      { p1: heuristicPolicy(seededRng(9000 + i)), p2: heuristicPolicy(seededRng(41000 + i)) },
      { seed: 5000 + i, recordTransitions: false }
    );
    if (!result.winner) continue;
    decided++;
    if (result.winner === (swap ? 'p2' : 'p1')) wins++;
  }
  return decided ? wins / decided : 0;
};

const seedHoldout = holdout(repair(deckOf(SEED_DECK)));
const bestHoldout = holdout(best);

const counts = copyCounts(best);
const listing = Object.entries(counts)
  .sort((a, b) => b[1] - a[1])
  .map(([name, n]) => `${n} ${name}`);

const outPath = path.join(deckDir, `${OUT_NAME}.json`);
fs.writeFileSync(
  outPath,
  JSON.stringify(
    {
      name: `Evolved from ${SEED_DECK}`,
      source: 'deckSearch.mjs',
      seedDeck: SEED_DECK,
      searchScore: bestScore,
      holdoutScore: bestHoldout,
      gauntlet,
      cards: best,
    },
    null,
    1
  )
);

console.log(`\nsearch score:  ${(startScore * 100).toFixed(1)}% -> ${(bestScore * 100).toFixed(1)}%  (${accepted} accepted of ${screened} that screened ahead, ${ITERATIONS} iterations)`);
console.log(`holdout score: ${(seedHoldout * 100).toFixed(1)}% -> ${(bestHoldout * 100).toFixed(1)}%  (fresh seeds, ${GAMES * 2} games)`);
console.log(`\nwritten to ${path.relative(ROOT, outPath)}\n`);
console.log(listing.join('\n'));
