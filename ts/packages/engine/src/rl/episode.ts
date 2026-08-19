import { Action, Card, GameState, Player } from "../types.js";
import { applyAction } from "../reducer.js";
import { startGame } from "../state.js";
import { encodeObservation } from "./observation.js";
import { actionSpace, ActionSpaceView, encodeAction } from "./actionSpace.js";
import { GameRecord, RecordedStep, snapshotBoard } from "./record.js";

export interface Decision {
  state: GameState;
  seat: Player;
  observation: Float32Array;
  space: ActionSpaceView;
}

/** Returns the index in the action space to take. */
export type Policy = (decision: Decision) => number;

export interface Transition {
  seat: Player;
  observation: Float32Array;
  mask: Uint8Array;
  action: number;
  /** +1 win, -1 loss, 0 otherwise; only the terminal step is non-zero. */
  reward: number;
}

export interface EpisodeResult {
  winner: Player | "draw" | null;
  turns: number;
  steps: number;
  /** Why the game ended, read off the final log line. */
  reason: string;
  transitions: Transition[];
  /** Present when `record` was requested: every action and the board after it. */
  record?: GameRecord;
}

export interface EpisodeOptions {
  seed?: number;
  maxTurns?: number;
  maxSteps?: number;
  /** Skip transition recording when only the result matters (deck evaluation). */
  recordTransitions?: boolean;
  /**
   * Record every action plus the board after it, so the game can be replayed and
   * inspected. Off by default: it costs a snapshot per step, which is wasted
   * work for the thousands of throwaway games deck evaluation runs.
   */
  record?: boolean;
  /** Deck lists, stored in the record so a replay can reconstruct the game. */
  decks?: Record<Player, string[]>;
  deckNames?: Record<Player, string>;
}

/**
 * Play one full game between two policies.
 *
 * Whoever must act next is derived from the state — a pending choice or an owed
 * promotion can put the seat that is *not* the active player on the clock — so a
 * policy never has to reason about turn order.
 */
export function runEpisode(
  p1Deck: string[],
  p2Deck: string[],
  registry: Record<string, Card>,
  policies: Record<Player, Policy>,
  options: EpisodeOptions = {}
): EpisodeResult {
  return playFrom(startGame(p1Deck, p2Deck, registry, options.seed), policies, {
    // The record needs the decks to replay from; carry them through unless the
    // caller supplied their own.
    decks: options.decks ?? { p1: p1Deck, p2: p2Deck },
    ...options,
  });
}

/**
 * Continue a game from an arbitrary position. Decision-time search needs this:
 * a rollout is just "finish this game from here and see who wins".
 */
export function playFrom(
  initial: GameState,
  policies: Record<Player, Policy>,
  options: EpisodeOptions = {}
): EpisodeResult {
  const {
    maxTurns = 100,
    maxSteps = 5000,
    recordTransitions = true,
    record: shouldRecord = false,
  } = options;

  let state = initial;
  const transitions: Transition[] = [];
  const recorded: RecordedStep[] = [];
  let steps = 0;

  while (state.phase !== "gameOver" && state.turn <= maxTurns && steps < maxSteps) {
    const seat = seatToAct(state);
    if (!seat) break;

    const space = actionSpace(state, seat);
    const observation = encodeObservation(state, seat);

    let index = policies[seat]({ state, seat, observation, space });
    let action = space.actions[index];

    // A policy that picks an illegal index falls back to the first legal one,
    // rather than stalling the episode.
    if (!action || !space.mask[index]) {
      index = space.mask.indexOf(1);
      action = index >= 0 ? space.actions[index] : undefined;
    }
    // Anything that did not fit the fixed space is still playable.
    if (!action && space.overflow.length > 0) {
      action = space.overflow[0];
      index = encodeAction(state, action);
    }
    if (!action) break; // genuinely nothing to do

    // Only record decisions the fixed action space can actually express: an
    // overflow action has no index, and a transition without one is unusable
    // as a training label.
    if (recordTransitions && index >= 0) {
      transitions.push({ seat, observation, mask: space.mask, action: index, reward: 0 });
    }

    const logBefore = state.log.length;
    const turnBefore = state.turn;
    state = applyAction(state, action);
    steps++;

    if (shouldRecord) {
      recorded.push({
        step: steps,
        turn: turnBefore,
        seat,
        action,
        legalCount: space.mask.reduce((a: number, b) => a + b, 0) + space.overflow.length,
        log: state.log.slice(logBefore).map((entry) => entry.message),
        board: snapshotBoard(state, initial.cardRegistry),
      });
    }
  }

  const winner = state.winner ?? null;
  if (recordTransitions && winner && winner !== "draw") {
    for (const t of transitions) t.reward = t.seat === winner ? 1 : -1;
  }

  const result: EpisodeResult = {
    winner,
    turns: state.turn,
    steps,
    reason: reasonFor(state),
    transitions,
  };

  if (shouldRecord) {
    result.record = {
      version: 1,
      // The seed as *passed in*: `initial.rngSeed` has already been advanced by
      // the opening shuffle, so replaying from it would deal different hands.
      seed: options.seed,
      decks: options.decks ?? { p1: [], p2: [] },
      deckNames: options.deckNames,
      winner,
      reason: result.reason,
      turns: state.turn,
      steps: recorded,
    };
  }

  return result;
}

/** The seat that owes the next action, or null if the game is stuck. */
export function seatToAct(state: GameState): Player | null {
  if (state.phase === "gameOver") return null;
  if (state.pendingChoice) return state.pendingChoice.player;
  if (state.pendingPromote?.length) return state.pendingPromote[0];
  return state.activePlayer;
}

function reasonFor(state: GameState): string {
  if (state.phase !== "gameOver") return "cut short";
  const last = [...state.log].reverse().find((l) => /decked out|last prize|no Pokémon left/.test(l.message));
  return last?.message ?? "game over";
}
