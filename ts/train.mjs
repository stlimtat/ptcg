#!/usr/bin/env node
// Train a policy network on self-play, in two stages:
//
//   1. Behavioural cloning — imitate the heuristic policy. Cheap, reliable, and
//      it lands the network somewhere useful before any exploration happens.
//   2. REINFORCE — policy gradient on the win/loss reward, starting from the
//      cloned weights rather than from noise.
//
//   node train.mjs [--bc-games 300] [--rl-batches 40] [--batch 12] [--eval 120]
//                  [--hidden 128] [--lr 0.002] [--out data/policy.json]
//
// ponytail: a plain 297->hidden->390 MLP in ~150 lines of JS, no framework. The
// bottleneck is the simulator, not the matrix maths.
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  runEpisode,
  heuristicPolicy,
  randomPolicy,
  rolloutPolicy,
  OBSERVATION_SIZE,
  ACTION_SPACE_SIZE,
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

const BC_GAMES = Number(arg('--bc-games', 300));
const DAGGER_ROUNDS = Number(arg('--dagger-rounds', 4));
const DAGGER_GAMES = Number(arg('--dagger-games', 120));
const RL_BATCHES = Number(arg('--rl-batches', 40));
const BATCH = Number(arg('--batch', 12));
const EVAL_GAMES = Number(arg('--eval', 120));
const HIDDEN = Number(arg('--hidden', 128));
const EPOCHS = Number(arg('--epochs', 3));
const LR = Number(arg('--lr', 0.002));
const OUT = arg('--out', 'data/policy.json');
/*
 * The heuristic breaks ties at random, so it only agrees with a differently
 * seeded copy of itself ~82% of the time. That is the ceiling for any imitator.
 * Cloning a deterministic teacher removes the unlearnable label noise.
 */
const DETERMINISTIC_TEACHER = process.argv.includes('--deterministic-teacher');
/*
 * Which policy generates the training labels. The heuristic is ~450x cheaper but
 * the network provably tops out at its level; rollout search is a strictly
 * stronger target, at the cost of much slower data collection.
 */
const TEACHER = arg('--teacher', 'heuristic');
const CANDIDATES = Number(arg('--candidates', 3));
const ROLLOUTS = Number(arg('--rollouts', 3));
const teacher = (seed) =>
  TEACHER === 'rollout'
    ? rolloutPolicy({ candidates: CANDIDATES, rollouts: ROLLOUTS, rng: seeded(seed) })
    : heuristicPolicy(DETERMINISTIC_TEACHER ? () => 0 : seeded(seed));

// Decks the policy trains and is measured on. Kept small so the policy learns to
// play rather than to memorise one matchup.
const TRAIN_DECKS = [
  'crustle-regional-indianapolis-in-2nd',
  'lillie-s-clefairy-naic-2026-new-orleans-1st',
  'dragapult-dusknoir-naic-2026-new-orleans-2nd',
  'hop-s-trevenant-special-event-turin-1st',
];

let rngState = 20260813;
const rng = () => {
  rngState ^= rngState << 13;
  rngState ^= rngState >>> 17;
  rngState ^= rngState << 5;
  rngState >>>= 0;
  return rngState / 0x100000000;
};
const seeded = (seed) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

// ---------------------------------------------------------------------------
// Network: obs -> hidden (ReLU) -> action logits, trained with Adam.
// ---------------------------------------------------------------------------
function zeros(n) {
  return new Float64Array(n);
}

function createNetwork(inputSize, hidden, outputSize) {
  // He initialisation keeps activations from collapsing through the ReLU.
  const scale1 = Math.sqrt(2 / inputSize);
  const scale2 = Math.sqrt(2 / hidden);
  const gauss = () => {
    const u = Math.max(rng(), 1e-9);
    return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rng());
  };
  return {
    inputSize,
    hidden,
    outputSize,
    w1: Float64Array.from({ length: inputSize * hidden }, () => gauss() * scale1),
    b1: zeros(hidden),
    w2: Float64Array.from({ length: hidden * outputSize }, () => gauss() * scale2),
    b2: zeros(outputSize),
  };
}

function forward(net, obs) {
  const h = zeros(net.hidden);
  for (let j = 0; j < net.hidden; j++) {
    let sum = net.b1[j];
    for (let i = 0; i < net.inputSize; i++) sum += obs[i] * net.w1[i * net.hidden + j];
    h[j] = sum > 0 ? sum : 0; // ReLU
  }
  const logits = zeros(net.outputSize);
  for (let k = 0; k < net.outputSize; k++) {
    let sum = net.b2[k];
    for (let j = 0; j < net.hidden; j++) sum += h[j] * net.w2[j * net.outputSize + k];
    logits[k] = sum;
  }
  return { h, logits };
}

/** Softmax over legal actions only; illegal ones get exactly zero probability. */
function maskedSoftmax(logits, mask) {
  let max = -Infinity;
  for (let i = 0; i < logits.length; i++) if (mask[i] && logits[i] > max) max = logits[i];
  const probs = zeros(logits.length);
  let total = 0;
  for (let i = 0; i < logits.length; i++) {
    if (!mask[i]) continue;
    const e = Math.exp(logits[i] - max);
    probs[i] = e;
    total += e;
  }
  if (total === 0) return probs;
  for (let i = 0; i < probs.length; i++) probs[i] /= total;
  return probs;
}

function createAdam(net) {
  const slot = () => ({
    w1: zeros(net.w1.length), b1: zeros(net.b1.length),
    w2: zeros(net.w2.length), b2: zeros(net.b2.length),
  });
  return { m: slot(), v: slot(), t: 0 };
}

function applyGradients(net, grads, adam, lr) {
  adam.t++;
  const beta1 = 0.9;
  const beta2 = 0.999;
  const correction1 = 1 - Math.pow(beta1, adam.t);
  const correction2 = 1 - Math.pow(beta2, adam.t);
  for (const key of ['w1', 'b1', 'w2', 'b2']) {
    const p = net[key];
    const g = grads[key];
    const m = adam.m[key];
    const v = adam.v[key];
    for (let i = 0; i < p.length; i++) {
      m[i] = beta1 * m[i] + (1 - beta1) * g[i];
      v[i] = beta2 * v[i] + (1 - beta2) * g[i] * g[i];
      p[i] -= (lr * (m[i] / correction1)) / (Math.sqrt(v[i] / correction2) + 1e-8);
    }
  }
}

const emptyGrads = (net) => ({
  w1: zeros(net.w1.length), b1: zeros(net.b1.length),
  w2: zeros(net.w2.length), b2: zeros(net.b2.length),
});

/**
 * Accumulate gradients for one decision. `dLogits` is the derivative of the loss
 * with respect to the logits, which is all that differs between the two stages:
 * cloning uses (probs - onehot), REINFORCE uses (probs - onehot) * advantage.
 */
function backward(net, obs, h, dLogits, grads) {
  const dh = zeros(net.hidden);
  for (let k = 0; k < net.outputSize; k++) {
    const d = dLogits[k];
    if (d === 0) continue;
    grads.b2[k] += d;
    for (let j = 0; j < net.hidden; j++) {
      grads.w2[j * net.outputSize + k] += h[j] * d;
      dh[j] += net.w2[j * net.outputSize + k] * d;
    }
  }
  for (let j = 0; j < net.hidden; j++) {
    if (h[j] <= 0) continue; // ReLU gate
    const d = dh[j];
    if (d === 0) continue;
    grads.b1[j] += d;
    for (let i = 0; i < net.inputSize; i++) grads.w1[i * net.hidden + j] += obs[i] * d;
  }
}

// ---------------------------------------------------------------------------
// Policies built on the network
// ---------------------------------------------------------------------------
const greedyNetPolicy = (net) => ({ observation, space }) => {
  const { logits } = forward(net, observation);
  let best = -1;
  let bestLogit = -Infinity;
  for (let i = 0; i < logits.length; i++) {
    if (space.mask[i] && logits[i] > bestLogit) {
      bestLogit = logits[i];
      best = i;
    }
  }
  return best;
};

const samplingNetPolicy = (net, sink) => ({ observation, space }) => {
  const { h, logits } = forward(net, observation);
  const probs = maskedSoftmax(logits, space.mask);
  let roll = rng();
  let chosen = -1;
  for (let i = 0; i < probs.length; i++) {
    roll -= probs[i];
    if (probs[i] > 0 && roll <= 0) {
      chosen = i;
      break;
    }
  }
  if (chosen < 0) chosen = space.mask.indexOf(1);
  sink?.push({ observation, h, probs, action: chosen });
  return chosen;
};

// ---------------------------------------------------------------------------
// Evaluation
// ---------------------------------------------------------------------------
const cloneNet = (n) => ({
  ...n,
  w1: Float64Array.from(n.w1), b1: Float64Array.from(n.b1),
  w2: Float64Array.from(n.w2), b2: Float64Array.from(n.b2),
});

/**
 * Win rate with its standard error. Reporting a bare percentage over a hundred
 * games invites reading noise as progress — the interval is the point.
 */
function measure(policyFactory, opponentFactory, games) {
  const rate = winRateAgainst(policyFactory, opponentFactory, games);
  const stdError = Math.sqrt((rate * (1 - rate)) / Math.max(1, games));
  return { rate, stdError, games };
}

const fmt = ({ rate, stdError }) => `${(rate * 100).toFixed(1)}% ± ${(stdError * 100 * 1.96).toFixed(1)}`;

/** Head-to-head between two networks, seats swapped every other game. */
function headToHead(netA, netB, games) {
  let winsA = 0;
  let decided = 0;
  for (let i = 0; i < games; i++) {
    const deck = deckOf(TRAIN_DECKS[i % TRAIN_DECKS.length]);
    const swap = i % 2 === 1;
    const result = runEpisode(deck, deck, registry, {
      p1: swap ? greedyNetPolicy(netB) : greedyNetPolicy(netA),
      p2: swap ? greedyNetPolicy(netA) : greedyNetPolicy(netB),
    }, { seed: 60000 + i, recordTransitions: false });
    if (!result.winner) continue;
    decided++;
    if (result.winner === (swap ? 'p2' : 'p1')) winsA++;
  }
  const rate = decided ? winsA / decided : 0;
  return { rate, stdError: Math.sqrt((rate * (1 - rate)) / Math.max(1, decided)), games: decided };
}

function winRateAgainst(policyFactory, opponentFactory, games) {
  let wins = 0;
  let decided = 0;
  for (let i = 0; i < games; i++) {
    const deck = deckOf(TRAIN_DECKS[i % TRAIN_DECKS.length]);
    const swap = i % 2 === 1;
    const result = runEpisode(
      deck,
      deck,
      registry,
      {
        p1: swap ? opponentFactory(seeded(i + 7000)) : policyFactory(),
        p2: swap ? policyFactory() : opponentFactory(seeded(i + 7000)),
      },
      { seed: i + 1, recordTransitions: false }
    );
    if (!result.winner) continue;
    decided++;
    if (result.winner === (swap ? 'p2' : 'p1')) wins++;
  }
  return decided ? wins / decided : 0;
}

// ---------------------------------------------------------------------------
// Stage 1: behavioural cloning
// ---------------------------------------------------------------------------
const net = createNetwork(OBSERVATION_SIZE, HIDDEN, ACTION_SPACE_SIZE);
const adam = createAdam(net);

console.log(`network ${OBSERVATION_SIZE} -> ${HIDDEN} -> ${ACTION_SPACE_SIZE}`);
console.log(`collecting ${BC_GAMES} games of ${TEACHER} play...`);

const samples = [];
for (let i = 0; i < BC_GAMES; i++) {
  const deck = deckOf(TRAIN_DECKS[i % TRAIN_DECKS.length]);
  const result = runEpisode(deck, deck, registry, {
    p1: teacher(i * 2 + 1),
    p2: teacher(i * 2 + 2),
  }, { seed: i + 1 });
  for (const t of result.transitions) if (t.mask[t.action]) samples.push(t);
}
console.log(`  ${samples.length} decisions`);

const MINIBATCH = 64;

/** One supervised pass over the dataset, imitating the recorded expert action. */
function trainEpoch(dataset) {
  for (let i = dataset.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [dataset[i], dataset[j]] = [dataset[j], dataset[i]];
  }

  let loss = 0;
  let correct = 0;
  for (let start = 0; start < dataset.length; start += MINIBATCH) {
    const batch = dataset.slice(start, start + MINIBATCH);
    const grads = emptyGrads(net);
    for (const sample of batch) {
      const { h, logits } = forward(net, sample.observation);
      const probs = maskedSoftmax(logits, sample.mask);
      loss -= Math.log(Math.max(probs[sample.action], 1e-9));

      let argmax = -1;
      let best = -Infinity;
      for (let i = 0; i < probs.length; i++) if (probs[i] > best) { best = probs[i]; argmax = i; }
      if (argmax === sample.action) correct++;

      const dLogits = zeros(ACTION_SPACE_SIZE);
      for (let i = 0; i < dLogits.length; i++) dLogits[i] = probs[i] / batch.length;
      dLogits[sample.action] -= 1 / batch.length;
      backward(net, sample.observation, h, dLogits, grads);
    }
    applyGradients(net, grads, adam, LR);
  }
  return { loss: loss / dataset.length, agreement: correct / dataset.length };
}

for (let epoch = 0; epoch < EPOCHS; epoch++) {
  const { loss, agreement } = trainEpoch(samples);
  console.log(`  epoch ${epoch + 1}: loss ${loss.toFixed(4)}  agreement ${(agreement * 100).toFixed(1)}%`);
}

const bcVsHeuristic = measure(() => greedyNetPolicy(net), heuristicPolicy, EVAL_GAMES);
const bcVsRandom = measure(() => greedyNetPolicy(net), randomPolicy, EVAL_GAMES);
console.log(`\nafter cloning: ${fmt(bcVsHeuristic)} vs heuristic, ${fmt(bcVsRandom)} vs random`);
if (TEACHER === 'rollout') {
  // Far fewer games: every one of these runs the slow search on the far side.
  const vsTeacher = measure(
    () => greedyNetPolicy(net),
    (rng) => rolloutPolicy({ candidates: CANDIDATES, rollouts: ROLLOUTS, rng }),
    Math.min(60, EVAL_GAMES)
  );
  console.log(`               ${fmt(vsTeacher)} vs its rollout teacher`);
}
// Keep the cloned weights so DAgger's contribution can be measured, not assumed.
const bcNet = cloneNet(net);

// ---------------------------------------------------------------------------
// Stage 1b: DAgger
//
// Plain cloning only ever sees states the *expert* reaches. The moment the
// network drifts off that path it is in territory it was never trained on, and
// the error compounds. DAgger fixes exactly that: play with the network, ask the
// expert what it would have done in the states the network actually visits, and
// add those labels to the dataset.
// ---------------------------------------------------------------------------
const daggerPolicy = (expert, sink) => (decision) => {
  const chosen = greedyNetPolicy(net)(decision);
  const expertAction = expert(decision);
  // Label the state the *network* reached with the expert's answer.
  if (expertAction >= 0 && decision.space.mask[expertAction]) {
    sink.push({
      observation: decision.observation,
      mask: decision.space.mask,
      action: expertAction,
    });
  }
  return chosen;
};

for (let round = 0; round < DAGGER_ROUNDS; round++) {
  const fresh = [];
  for (let i = 0; i < DAGGER_GAMES; i++) {
    const deck = deckOf(TRAIN_DECKS[i % TRAIN_DECKS.length]);
    const expert = teacher(30000 + round * 1000 + i);
    const learnerSeat = i % 2 === 0 ? 'p1' : 'p2';
    runEpisode(deck, deck, registry, {
      p1: learnerSeat === 'p1' ? daggerPolicy(expert, fresh) : heuristicPolicy(seeded(i)),
      p2: learnerSeat === 'p2' ? daggerPolicy(expert, fresh) : heuristicPolicy(seeded(i)),
    }, { seed: 30000 + round * 1000 + i, recordTransitions: false });
  }
  samples.push(...fresh);

  const { loss, agreement } = trainEpoch(samples);
  // No per-round win rate here: 60 games cannot resolve the differences
  // involved, and printing it invites reading noise as a trend.
  console.log(
    `  dagger ${round + 1}: +${fresh.length} states (${samples.length} total)  ` +
      `loss ${loss.toFixed(4)}  agreement ${(agreement * 100).toFixed(1)}%`
  );
}

const daggerVsHeuristic = measure(() => greedyNetPolicy(net), heuristicPolicy, EVAL_GAMES);
const daggerVsRandom = measure(() => greedyNetPolicy(net), randomPolicy, EVAL_GAMES);
console.log(`\nafter DAgger: ${fmt(daggerVsHeuristic)} vs heuristic, ${fmt(daggerVsRandom)} vs random`);
const daggerVsBc = headToHead(net, bcNet, EVAL_GAMES);
console.log(`DAgger vs cloned head-to-head: ${fmt(daggerVsBc)}`);

// ---------------------------------------------------------------------------
// Stage 2: REINFORCE against the heuristic
// ---------------------------------------------------------------------------
let baseline = 0; // running mean return, the variance reduction for REINFORCE
for (let batch = 0; batch < RL_BATCHES; batch++) {
  const grads = emptyGrads(net);
  let batchReturn = 0;
  let episodes = 0;

  for (let game = 0; game < BATCH; game++) {
    const deck = deckOf(TRAIN_DECKS[(batch * BATCH + game) % TRAIN_DECKS.length]);
    const trace = [];
    const learnerSeat = game % 2 === 0 ? 'p1' : 'p2';
    const seedIndex = 20000 + batch * BATCH + game;

    const result = runEpisode(deck, deck, registry, {
      p1: learnerSeat === 'p1' ? samplingNetPolicy(net, trace) : heuristicPolicy(seeded(seedIndex)),
      p2: learnerSeat === 'p2' ? samplingNetPolicy(net, trace) : heuristicPolicy(seeded(seedIndex)),
    }, { seed: seedIndex, recordTransitions: false });

    if (!result.winner || trace.length === 0) continue;
    const reward = result.winner === learnerSeat ? 1 : -1;
    batchReturn += reward;
    episodes++;

    // Undiscounted REINFORCE: every decision in the game shares its outcome.
    const advantage = (reward - baseline) / Math.max(1, trace.length);
    for (const step of trace) {
      const dLogits = zeros(ACTION_SPACE_SIZE);
      for (let i = 0; i < dLogits.length; i++) dLogits[i] = step.probs[i] * advantage;
      dLogits[step.action] -= advantage;
      backward(net, step.observation, step.h, dLogits, grads);
    }
  }

  if (episodes === 0) continue;
  const meanReturn = batchReturn / episodes;
  baseline = 0.9 * baseline + 0.1 * meanReturn;
  for (const key of ['w1', 'b1', 'w2', 'b2']) {
    for (let i = 0; i < grads[key].length; i++) grads[key][i] /= episodes;
  }
  applyGradients(net, grads, adam, LR);

  if ((batch + 1) % 10 === 0) {
    const rate = winRateAgainst(() => greedyNetPolicy(net), heuristicPolicy, 40);
    console.log(`  batch ${batch + 1}: mean return ${meanReturn.toFixed(2)}  vs heuristic ${(rate * 100).toFixed(1)}%`);
  }
}

const rlVsHeuristic = measure(() => greedyNetPolicy(net), heuristicPolicy, EVAL_GAMES);
const rlVsRandom = measure(() => greedyNetPolicy(net), randomPolicy, EVAL_GAMES);
console.log(`\nafter REINFORCE: ${fmt(rlVsHeuristic)} vs heuristic, ${fmt(rlVsRandom)} vs random`);

fs.writeFileSync(
  path.join(ROOT, OUT),
  JSON.stringify({
    observationSize: OBSERVATION_SIZE,
    actionSpaceSize: ACTION_SPACE_SIZE,
    hidden: HIDDEN,
    trainedOn: TRAIN_DECKS,
    scores: { bcVsHeuristic, bcVsRandom, daggerVsHeuristic, daggerVsRandom, daggerVsBc, rlVsHeuristic, rlVsRandom },
    w1: [...net.w1], b1: [...net.b1], w2: [...net.w2], b2: [...net.b2],
  })
);
console.log(`\nweights written to ${OUT}`);
