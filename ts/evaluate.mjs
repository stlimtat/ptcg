#!/usr/bin/env node
// Deck evaluation by self-play. This is the loop deck-search is meant to drive:
// swap in a learned policy, or mutate a decklist, and measure the win rate.
//
//   node evaluate.mjs <deckA> <deckB> [--games 100] [--policy heuristic|random|rollout]
//   node evaluate.mjs --all [--games 20]              round robin over every deck
//   node evaluate.mjs --all --decks a,b,c [--games 40] round robin over a subset
//
// The rollout policy is ~450x slower per game, so a full round robin under it is
// an overnight job. Use --decks to re-check a shortlist instead.
//
// Seats are swapped every other game so the result measures the deck, not the
// advantage of going first.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runEpisode, heuristicPolicy, randomPolicy, rolloutPolicy } from './packages/engine/dist/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const pool = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/cards.json'), 'utf8'));
const registry = Object.fromEntries(pool.cards.map((c) => [c.id, c]));

const deckDir = path.join(ROOT, 'data/decks');
const deckNames = fs
  .readdirSync(deckDir)
  .filter((f) => f.endsWith('.json') && f !== 'index.json')
  .map((f) => f.replace(/\.json$/, ''));
const deckOf = (name) => JSON.parse(fs.readFileSync(path.join(deckDir, `${name}.json`), 'utf8')).cards;

function argValue(flag, fallback) {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : fallback;
}

const games = Number(argValue('--games', 100));
const policyName = argValue('--policy', 'heuristic');
const CANDIDATES = Number(argValue('--candidates', 5));
const ROLLOUTS = Number(argValue('--rollouts', 5));
// Rollout search is ~450x slower per game than the heuristic; use it to check
// conclusions, not to grind a round robin.
const makePolicy =
  policyName === 'random'
    ? randomPolicy
    : policyName === 'rollout'
      ? (rng) => rolloutPolicy({ candidates: CANDIDATES, rollouts: ROLLOUTS, rng })
      : heuristicPolicy;

// Deterministic per-game RNG so a run is reproducible end to end.
const seeded = (seed) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

function match(deckA, deckB, count) {
  const tally = { a: 0, b: 0, unfinished: 0, turns: 0, reasons: {} };
  for (let i = 0; i < count; i++) {
    const swap = i % 2 === 1;
    const result = runEpisode(
      deckOf(swap ? deckB : deckA),
      deckOf(swap ? deckA : deckB),
      registry,
      { p1: makePolicy(seeded(i * 2 + 1)), p2: makePolicy(seeded(i * 2 + 2)) },
      { seed: i + 1, recordTransitions: false }
    );

    tally.turns += result.turns;
    tally.reasons[result.reason] = (tally.reasons[result.reason] ?? 0) + 1;

    const seatOfA = swap ? 'p2' : 'p1';
    if (!result.winner) tally.unfinished++;
    else if (result.winner === seatOfA) tally.a++;
    else tally.b++;
  }
  return tally;
}

if (process.argv.includes('--all')) {
  const count = Number(argValue('--games', 20));
  const subset = argValue('--decks', null);
  const entrants = subset ? subset.split(',').map((d) => d.trim()) : deckNames;
  const unknown = entrants.filter((d) => !deckNames.includes(d));
  if (unknown.length) {
    console.error(`unknown decks: ${unknown.join(', ')}`);
    process.exit(1);
  }
  const wins = Object.fromEntries(entrants.map((d) => [d, { played: 0, won: 0 }]));

  for (let i = 0; i < entrants.length; i++) {
    for (let j = i + 1; j < entrants.length; j++) {
      const [a, b] = [entrants[i], entrants[j]];
      const tally = match(a, b, count);
      wins[a].played += tally.a + tally.b;
      wins[b].played += tally.a + tally.b;
      wins[a].won += tally.a;
      wins[b].won += tally.b;
    }
    console.error(`  ...${entrants[i]} done`);
  }

  const table = Object.entries(wins)
    .map(([deck, { played, won }]) => ({ deck, played, won, rate: played ? won / played : 0 }))
    .sort((x, y) => y.rate - x.rate);

  console.log(`\nround robin, ${entrants.length} decks, ${count} games per pairing, ${policyName} policy\n`);
  for (const row of table) {
    const interval = 1.96 * Math.sqrt((row.rate * (1 - row.rate)) / Math.max(1, row.played)) * 100;
    console.log(
      `${(row.rate * 100).toFixed(1).padStart(5)}% ± ${interval.toFixed(1).padStart(4)}  ` +
        `${String(row.won).padStart(4)}/${String(row.played).padEnd(5)} ${row.deck}`
    );
  }
} else {
  const [deckA, deckB] = process.argv.slice(2).filter((a) => !a.startsWith('--') && deckNames.includes(a));
  if (!deckA || !deckB) {
    console.error('usage: node evaluate.mjs <deckA> <deckB> [--games N] [--policy heuristic|random]');
    console.error('       node evaluate.mjs --all [--games N]');
    console.error(`\ndecks:\n  ${deckNames.join('\n  ')}`);
    process.exit(1);
  }

  const tally = match(deckA, deckB, games);
  const decided = tally.a + tally.b;
  const rate = tally.a / decided;
  const interval = 1.96 * Math.sqrt((rate * (1 - rate)) / decided) * 100;
  console.log(`${games} games, ${policyName} policy, seats swapped each game\n`);
  console.log(`${deckA}: ${tally.a} (${(rate * 100).toFixed(1)}% ± ${interval.toFixed(1)})`);
  console.log(`${deckB}: ${tally.b} (${((1 - rate) * 100).toFixed(1)}%)`);
  console.log(`unfinished: ${tally.unfinished}   mean turns: ${(tally.turns / games).toFixed(1)}`);
  console.log('endings:', tally.reasons);
}
