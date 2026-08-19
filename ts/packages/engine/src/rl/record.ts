import { Action, Card, GameState, Player } from "../types.js";

/**
 * A game recorded well enough to replay it.
 *
 * The engine is deterministic given a seed and a list of actions, so the seed
 * plus `steps[].action` is the authoritative record — everything else is
 * derived, and `replayRecord` re-derives it to prove the record is faithful.
 *
 * `board` is a human- and diff-readable snapshot after each step. It exists so a
 * replay can be inspected without instantiating the engine, and so a divergence
 * between record and replay can be localised to a step rather than just
 * detected.
 */
export interface RecordedStep {
  /** 1-based index over the whole game. */
  step: number;
  turn: number;
  seat: Player;
  action: Action;
  /** How many actions were legal here — the branching factor at this decision. */
  legalCount: number;
  /** Log lines the engine produced in response to this action. */
  log: string[];
  board: BoardSnapshot;
}

export interface PokemonSnapshot {
  card: string;
  name: string;
  damage: number;
  hp: number;
  energy: string[];
  tools: string[];
  status: string[];
}

export interface SideSnapshot {
  active: PokemonSnapshot | null;
  bench: PokemonSnapshot[];
  handCount: number;
  hand: string[];
  deckCount: number;
  discardCount: number;
  prizeCount: number;
}

export interface BoardSnapshot {
  turn: number;
  phase: GameState["phase"];
  activePlayer: Player;
  stadium: string | null;
  pendingChoice: { player: Player; prompt: string; optionCount: number } | null;
  pendingPromote: Player[];
  p1: SideSnapshot;
  p2: SideSnapshot;
}

export interface GameRecord {
  version: 1;
  seed: number | undefined;
  decks: Record<Player, string[]>;
  deckNames?: Record<Player, string>;
  winner: Player | "draw" | null;
  reason: string;
  turns: number;
  steps: RecordedStep[];
}

const nameOf = (registry: Record<string, Card>, cardId: string) => registry[cardId]?.name ?? cardId;

function snapshotPokemon(
  registry: Record<string, Card>,
  poke: GameState["players"][Player]["active"]
): PokemonSnapshot | null {
  if (!poke) return null;
  const def = registry[poke.card.cardId];
  return {
    card: poke.card.cardId,
    name: def?.name ?? poke.card.cardId,
    damage: poke.damage,
    hp: def?.type === "pokemon" ? def.hp : 0,
    energy: poke.attachedEnergy.map((e) => nameOf(registry, e.cardId)),
    tools: poke.attachedTools.map((t) => nameOf(registry, t.cardId)),
    status: [...poke.statusConditions],
  };
}

function snapshotSide(registry: Record<string, Card>, state: GameState, seat: Player): SideSnapshot {
  const ps = state.players[seat];
  return {
    active: snapshotPokemon(registry, ps.active),
    bench: ps.bench.map((p) => snapshotPokemon(registry, p)!),
    handCount: ps.hand.length,
    hand: ps.hand.map((c) => nameOf(registry, c.cardId)),
    deckCount: ps.deck.length,
    discardCount: ps.discard.length,
    prizeCount: ps.prizes.length,
  };
}

/** Everything about a position that is worth reading back later. */
export function snapshotBoard(state: GameState, registry?: Record<string, Card>): BoardSnapshot {
  const reg = registry ?? state.cardRegistry ?? {};
  return {
    turn: state.turn,
    phase: state.phase,
    activePlayer: state.activePlayer,
    stadium: state.stadium ? nameOf(reg, state.stadium.cardId) : null,
    pendingChoice: state.pendingChoice
      ? {
          player: state.pendingChoice.player,
          prompt: state.pendingChoice.prompt,
          optionCount: state.pendingChoice.options.length,
        }
      : null,
    pendingPromote: [...(state.pendingPromote ?? [])],
    p1: snapshotSide(reg, state, "p1"),
    p2: snapshotSide(reg, state, "p2"),
  };
}

/**
 * Re-run a record's actions against a fresh game and report where — if anywhere —
 * the replay diverges from what was recorded. An empty list means the record
 * reproduces exactly.
 */
export function replayRecord(
  record: GameRecord,
  registry: Record<string, Card>,
  startGame: (p1: string[], p2: string[], reg: Record<string, Card>, seed?: number) => GameState,
  applyAction: (state: GameState, action: Action) => GameState
): { divergences: string[]; finalState: GameState } {
  let state = startGame(record.decks.p1, record.decks.p2, registry, record.seed);
  const divergences: string[] = [];

  for (const step of record.steps) {
    try {
      state = applyAction(state, step.action);
    } catch (error) {
      divergences.push(`step ${step.step}: action rejected on replay (${(error as Error).message})`);
      break;
    }

    const replayed = snapshotBoard(state, registry);
    if (JSON.stringify(replayed) !== JSON.stringify(step.board)) {
      divergences.push(`step ${step.step}: board differs after ${step.action.type}`);
    }
  }

  return { divergences, finalState: state };
}

/** One line per step, in the same shape replay.mjs prints. */
export function formatRecord(record: GameRecord): string {
  const lines: string[] = [];
  const p1 = record.deckNames?.p1 ?? "p1";
  const p2 = record.deckNames?.p2 ?? "p2";
  lines.push(`${p1} (p1) vs ${p2} (p2), seed ${record.seed ?? "unseeded"}`);

  let turn = -1;
  for (const step of record.steps) {
    if (step.turn !== turn) {
      turn = step.turn;
      lines.push(`── turn ${turn} ${"─".repeat(40)}`);
    }
    lines.push(`${String(step.step).padStart(4)} ${step.seat}  ${step.action.type}  (${step.legalCount} legal)`);
    for (const entry of step.log) lines.push(`       → ${entry}`);
  }

  lines.push(`result: ${record.winner ?? "unfinished"} — ${record.reason} (turn ${record.turns})`);
  return lines.join("\n");
}
