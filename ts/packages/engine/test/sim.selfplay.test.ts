// Headless self-play harness. Proves the engine can drive a whole game with no
// React UI — the prerequisite for any RL training loop.
// ponytail: uniform-random policy, no reward shaping. Swap in a policy function
// where the action is picked.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { it, expect } from 'vitest';
import { startGame, legalActions, applyAction, seatToAct, GameState } from '../src/index';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../..');
const cardsFile = JSON.parse(fs.readFileSync(path.join(root, 'packages/ui/public/cards.json'), 'utf8'));
const registry: Record<string, any> = Object.fromEntries(cardsFile.cards.map((c: any) => [c.id, c]));

const deckOf = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(root, 'data/decks', `${name}.json`), 'utf8')).cards as string[];

function play(deckA: string, deckB: string, seed: number, maxTurns = 200) {
  let s: GameState = startGame(deckOf(deckA), deckOf(deckB), registry, seed);
  const counts: Record<string, number> = {};
  let steps = 0;

  while (s.phase !== 'gameOver' && s.turn <= maxTurns && steps < 50000) {
    // Some card text puts the *opponent* on the clock (choosing a new Active,
    // for instance), so the engine decides who acts, not the harness.
    const actor = seatToAct(s);
    if (!actor) break;
    const legal = legalActions(s, actor);
    if (legal.length === 0) return { result: 'deadlock', turn: s.turn, actor, counts };
    const a = legal[Math.floor(Math.random() * legal.length)];
    counts[a.type] = (counts[a.type] || 0) + 1;
    s = applyAction(s, a);
    steps++;
  }

  return {
    result: s.phase === 'gameOver' ? `winner:${s.winner}` : 'turn-cap-reached',
    turn: s.turn,
    steps,
    counts,
    prizesLeft: [s.players.p1.prizes.length, s.players.p2.prizes.length],
  };
}

const MATCHUPS: [string, string][] = [
  ['lillie-s-clefairy-naic-2026-new-orleans-1st', 'dragapult-dusknoir-naic-2026-new-orleans-2nd'],
  ['hop-s-trevenant-special-event-turin-1st', 'slowking-special-event-turin-2nd'],
  ['dragapult-regional-melbourne-1st', 'hydrapple-regional-campinas-1st'],
];

it('plays competitive decks to a result', () => {
  const results = MATCHUPS.flatMap(([a, b]) =>
    [1, 2, 3].map((seed) => {
      const r = play(a, b, seed);
      console.log(a, 'vs', b, JSON.stringify(r));
      return r;
    })
  );
  // Every game must reach a winner — no stalls, no deadlocks.
  expect(results.every((r) => r.result.startsWith('winner:'))).toBe(true);
}, 120000);

it('is deterministic for a fixed seed', () => {
  const [a, b] = MATCHUPS[0];
  const first = startGame(deckOf(a), deckOf(b), registry, 42);
  const second = startGame(deckOf(a), deckOf(b), registry, 42);
  expect(second.players.p1.hand.map((c) => c.cardId)).toEqual(first.players.p1.hand.map((c) => c.cardId));
  expect(second.players.p2.prizes.map((c) => c.cardId)).toEqual(first.players.p2.prizes.map((c) => c.cardId));
});
