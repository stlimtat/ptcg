#!/usr/bin/env node
// Play one game and print every step: the action taken, who took it, and what
// the engine logged in response. Useful for reading what a deck actually does
// rather than inferring it from win rates.
//
//   node replay.mjs <deckA> <deckB> [--seed 1] [--policy heuristic|random|rollout]
//                   [--board] [--max-turns 100] [--save game.json]
//   node replay.mjs --load game.json [--board]
//
// --board prints the position after every turn ends.
// --save writes a record that --load replays and verifies step by step.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  startGame,
  applyAction,
  seatToAct,
  actionSpace,
  encodeObservation,
  heuristicPolicy,
  randomPolicy,
  rolloutPolicy,
  replayRecord,
  snapshotBoard,
} from './packages/engine/dist/index.js';

const ROOT = path.dirname(fileURLToPath(import.meta.url));
const pool = JSON.parse(fs.readFileSync(path.join(ROOT, 'data/cards.json'), 'utf8'));
const registry = Object.fromEntries(pool.cards.map((c) => [c.id, c]));
const deckDir = path.join(ROOT, 'data/decks');
const deckOf = (name) => JSON.parse(fs.readFileSync(path.join(deckDir, `${name}.json`), 'utf8')).cards;

const arg = (flag, fallback) => {
  const i = process.argv.indexOf(flag);
  return i > 0 ? process.argv[i + 1] : fallback;
};

const LOAD = arg('--load', null);
const SAVE = arg('--save', null);

const [deckA, deckB] = process.argv.slice(2).filter((a) => !a.startsWith('--') && fs.existsSync(path.join(deckDir, `${a}.json`)));
if (!LOAD && (!deckA || !deckB)) {
  console.error('usage: node replay.mjs <deckA> <deckB> [--seed 1] [--policy ...] [--board] [--save game.json]');
  console.error('       node replay.mjs --load game.json [--board]');
  process.exit(1);
}

const SEED = Number(arg('--seed', 1));
const MAX_TURNS = Number(arg('--max-turns', 100));
const SHOW_BOARD = process.argv.includes('--board');
const policyName = arg('--policy', 'heuristic');

const seeded = (seed) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};
const makePolicy = (rng) =>
  policyName === 'random' ? randomPolicy(rng)
  : policyName === 'rollout' ? rolloutPolicy({ candidates: 4, rollouts: 4, rng })
  : heuristicPolicy(rng);

const nameOf = (cardId) => registry[cardId]?.name ?? cardId;

/** Describe an action the way a player would say it out loud. */
function describe(state, action) {
  const seat = action.player;
  const ps = state.players[seat];
  const pokeName = (instanceId) => {
    const found = [ps.active, ...ps.bench].find((p) => p?.card.instanceId === instanceId);
    return found ? nameOf(found.card.cardId) : instanceId;
  };
  const oppName = (instanceId) => {
    const ops = state.players[seat === 'p1' ? 'p2' : 'p1'];
    const found = [ops.active, ...ops.bench].find((p) => p?.card.instanceId === instanceId);
    return found ? nameOf(found.card.cardId) : null;
  };

  switch (action.type) {
    case 'drawCard': return 'draw a card';
    case 'endTurn': return 'end turn';
    case 'playPokemon': return `bench ${nameOf(action.cardId)}`;
    case 'evolve': return `evolve ${pokeName(action.targetInstanceId)} into ${nameOf(action.cardId)}`;
    case 'attachEnergy': return `attach ${nameOf(action.energyCardId)} to ${pokeName(action.targetInstanceId)}`;
    case 'playTrainer':
      return `play ${nameOf(action.cardId)}${action.targetInstanceId ? ` onto ${pokeName(action.targetInstanceId)}` : ''}`;
    case 'retreat': return `retreat, promoting ${pokeName(action.benchInstanceId)}`;
    case 'attack': {
      const def = registry[ps.active?.card.cardId];
      return `attack with ${def?.name ?? '?'}: ${def?.attacks[action.attackIndex]?.name ?? `#${action.attackIndex}`}`;
    }
    case 'promote': {
      const fromHand = ps.hand.find((c) => c.instanceId === action.instanceId);
      return `promote ${fromHand ? nameOf(fromHand.cardId) : pokeName(action.instanceId)} to Active`;
    }
    case 'useAbility': return `use ${action.abilityName} (${pokeName(action.instanceId)})`;
    case 'choose': {
      if (action.instanceId === undefined) return 'decline / stop choosing';
      const card = findCard(state, action.instanceId);
      const opposing = oppName(action.instanceId);
      return `choose ${card ? nameOf(card.cardId) : action.instanceId}${opposing ? " (opponent's)" : ''}`;
    }
    default: return action.type;
  }
}

function findCard(state, instanceId) {
  for (const p of ['p1', 'p2']) {
    const ps = state.players[p];
    for (const zone of [ps.hand, ps.deck, ps.discard, ps.prizes]) {
      const hit = zone.find((c) => c.instanceId === instanceId);
      if (hit) return hit;
    }
    for (const poke of [ps.active, ...ps.bench]) {
      if (!poke) continue;
      if (poke.card.instanceId === instanceId) return poke.card;
      const attached = [...poke.attachedEnergy, ...poke.attachedTools].find((c) => c.instanceId === instanceId);
      if (attached) return attached;
    }
  }
  return null;
}

const describePokemon = (state, poke) => {
  if (!poke) return '(empty)';
  const def = registry[poke.card.cardId];
  const hp = def?.hp ?? 0;
  const status = poke.statusConditions.length ? ` [${poke.statusConditions.join(',')}]` : '';
  const tools = poke.attachedTools.length ? ` +${poke.attachedTools.map((t) => nameOf(t.cardId)).join(',')}` : '';
  return `${def?.name ?? '?'} ${Math.max(0, hp - poke.damage)}/${hp}hp E:${poke.attachedEnergy.length}${tools}${status}`;
};

function printBoard(state) {
  for (const seat of ['p1', 'p2']) {
    const ps = state.players[seat];
    console.log(
      `      ${seat}: prizes ${ps.prizes.length} deck ${ps.deck.length} hand ${ps.hand.length} | ` +
        `Active ${describePokemon(state, ps.active)}`
    );
    if (ps.bench.length) {
      console.log(`          bench: ${ps.bench.map((p) => describePokemon(state, p)).join(' | ')}`);
    }
  }
  if (state.stadium) console.log(`      stadium: ${nameOf(state.stadium.cardId)}`);
}

// ---------------------------------------------------------------------------
if (LOAD) {
  const record = JSON.parse(fs.readFileSync(LOAD, 'utf8'));
  console.log(`replaying ${LOAD}`);
  console.log(`p1: ${record.deckNames?.p1 ?? '(deck list only)'}`);
  console.log(`p2: ${record.deckNames?.p2 ?? '(deck list only)'}`);
  console.log(`seed ${record.seed}, ${record.steps.length} steps\n`);

  let turn = null;
  for (const step of record.steps) {
    if (step.turn !== turn) {
      turn = step.turn;
      console.log(`\n── turn ${turn} ${'─'.repeat(50)}`);
    }
    console.log(`${String(step.step).padStart(4)} ${step.seat}  ${step.action.type}   (${step.legalCount} legal)`);
    for (const entry of step.log) {
      if (/drew a card|ended turn/.test(entry)) continue;
      console.log(`       → ${entry}`);
    }
    if (SHOW_BOARD && step.action.type === 'endTurn') {
      for (const seat of ['p1', 'p2']) {
        const side = step.board[seat];
        const show = (p) => (p ? `${p.name} ${Math.max(0, p.hp - p.damage)}/${p.hp}hp E:${p.energy.length}` : '(empty)');
        console.log(`      ${seat}: prizes ${side.prizeCount} deck ${side.deckCount} hand ${side.handCount} | Active ${show(side.active)}`);
        if (side.bench.length) console.log(`          bench: ${side.bench.map(show).join(' | ')}`);
      }
    }
  }

  // Prove the record is faithful rather than merely printable.
  const { divergences } = replayRecord(record, registry, startGame, applyAction);
  console.log(`\n${'═'.repeat(60)}`);
  console.log(`result: ${record.winner ?? 'unfinished'} on turn ${record.turns} — ${record.reason}`);
  console.log(
    divergences.length
      ? `VERIFY FAILED: ${divergences.length} divergence(s)\n  ${divergences.slice(0, 5).join('\n  ')}`
      : 'verified: replay reproduces every recorded board exactly'
  );
  process.exit(divergences.length ? 1 : 0);
}

let state = startGame(deckOf(deckA), deckOf(deckB), registry, SEED);
const policies = { p1: makePolicy(seeded(SEED * 2 + 1)), p2: makePolicy(seeded(SEED * 2 + 2)) };

console.log(`p1: ${deckA}`);
console.log(`p2: ${deckB}`);
console.log(`seed ${SEED}, ${policyName} policy\n`);

const recorded = [];
let step = 0;
let turn = null;
while (state.phase !== 'gameOver' && state.turn <= MAX_TURNS && step < 5000) {
  const seat = seatToAct(state);
  if (!seat) break;

  if (state.turn !== turn) {
    turn = state.turn;
    console.log(`\n── turn ${turn} ${'─'.repeat(50)}`);
  }

  const space = actionSpace(state, seat);
  const index = policies[seat]({ state, seat, observation: encodeObservation(state, seat), space });
  const action = space.actions[index] ?? space.actions[space.mask.indexOf(1)] ?? space.overflow[0];
  if (!action) break;

  const legalCount = space.mask.reduce((a, b) => a + b, 0) + space.overflow.length;
  const prompt = state.pendingChoice ? ` {${state.pendingChoice.prompt}}` : '';
  const text = describe(state, action);

  const before = state.log.length;
  const turnBefore = state.turn;
  state = applyAction(state, action);
  step++;

  recorded.push({
    step,
    turn: turnBefore,
    seat,
    action,
    legalCount,
    log: state.log.slice(before).map((entry) => entry.message),
    board: snapshotBoard(state, registry),
  });

  console.log(`${String(step).padStart(4)} ${seat}  ${text}${prompt}   (${legalCount} legal)`);
  // Anything the engine said in response: knockouts, prizes, coin flips.
  for (const entry of state.log.slice(before)) {
    if (/drew a card|ended turn|played |promoted/.test(entry.message)) continue;
    console.log(`       → ${entry.message}`);
  }

  if (SHOW_BOARD && action.type === 'endTurn') printBoard(state);
}

console.log(`\n${'═'.repeat(60)}`);
console.log(`result: ${state.winner ? `${state.winner} wins` : 'unfinished'} on turn ${state.turn} after ${step} steps`);
const ending = [...state.log].reverse().find((l) => /decked out|last prize|no Pokémon left/.test(l.message));
if (ending) console.log(`reason: ${ending.message}`);
printBoard(state);

if (SAVE) {
  const record = {
    version: 1,
    seed: SEED,
    decks: { p1: deckOf(deckA), p2: deckOf(deckB) },
    deckNames: { p1: deckA, p2: deckB },
    winner: state.winner ?? null,
    reason: ending?.message ?? 'game over',
    turns: state.turn,
    steps: recorded,
  };
  fs.writeFileSync(SAVE, JSON.stringify(record, null, 1));

  const { divergences } = replayRecord(record, registry, startGame, applyAction);
  console.log(`\nsaved ${recorded.length} steps to ${SAVE}`);
  console.log(divergences.length ? `WARNING: ${divergences.length} divergence(s) on verify` : 'verified: record replays exactly');
}
