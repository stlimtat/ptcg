import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, it, expect } from "vitest";
import { Card } from "../src/types.js";
import { startGame } from "../src/state.js";
import { applyAction } from "../src/reducer.js";
import { runEpisode } from "../src/rl/episode.js";
import { heuristicPolicy } from "../src/rl/policies.js";
import { replayRecord, snapshotBoard } from "../src/rl/record.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = JSON.parse(fs.readFileSync(path.join(root, "data/cards.json"), "utf8"));
const registry: Record<string, Card> = Object.fromEntries(pool.cards.map((c: any) => [c.id, c]));
const deckOf = (name: string) =>
  JSON.parse(fs.readFileSync(path.join(root, "data/decks", `${name}.json`), "utf8")).cards as string[];

const DECK_A = "beedrill-evolved";
const DECK_B = "crustle-regional-indianapolis-in-2nd";
const seeded = (seed: number) => () => {
  seed = (seed * 1103515245 + 12345) & 0x7fffffff;
  return seed / 0x7fffffff;
};

const play = (seed: number) =>
  runEpisode(deckOf(DECK_A), deckOf(DECK_B), registry, {
    p1: heuristicPolicy(seeded(1)),
    p2: heuristicPolicy(seeded(2)),
  }, { seed, record: true, recordTransitions: false, deckNames: { p1: DECK_A, p2: DECK_B } });

describe("game records", () => {
  it("records one entry per step, with the board after each", () => {
    const result = play(5);
    const record = result.record!;

    expect(record.steps).toHaveLength(result.steps);
    expect(record.winner).toBe(result.winner);
    expect(record.steps.map((s) => s.step)).toEqual(record.steps.map((_, i) => i + 1));

    for (const step of record.steps) {
      expect(step.action.player).toBe(step.seat);
      expect(step.legalCount).toBeGreaterThan(0);
      expect(step.board.p1).toBeTruthy();
      expect(step.board.p2).toBeTruthy();
    }
  });

  it("replays exactly, board for board", () => {
    const record = play(5).record!;
    const { divergences, finalState } = replayRecord(record, registry, startGame, applyAction);

    expect(divergences).toEqual([]);
    expect(finalState.winner).toBe(record.winner);
  });

  it("survives a round trip through JSON, which is how it gets stored", () => {
    const record = play(9).record!;
    const restored = JSON.parse(JSON.stringify(record));

    const { divergences } = replayRecord(restored, registry, startGame, applyAction);
    expect(divergences).toEqual([]);
  });

  it("catches a tampered record rather than replaying it silently", () => {
    const record = play(5).record!;
    // Corrupt a board snapshot: replay must notice it no longer matches.
    const target = record.steps[record.steps.length - 1];
    target.board.p1.prizeCount = target.board.p1.prizeCount + 1;

    const { divergences } = replayRecord(record, registry, startGame, applyAction);
    expect(divergences.length).toBeGreaterThan(0);
    expect(divergences[0]).toContain(`step ${target.step}`);
  });

  it("costs nothing when recording is off", () => {
    const plain = runEpisode(deckOf(DECK_A), deckOf(DECK_B), registry, {
      p1: heuristicPolicy(seeded(1)),
      p2: heuristicPolicy(seeded(2)),
    }, { seed: 5, recordTransitions: false });

    expect(plain.record).toBeUndefined();
    // Same game either way: recording must not perturb play.
    expect(plain.winner).toBe(play(5).winner);
    expect(plain.steps).toBe(play(5).steps);
  });

  it("snapshots the position independently of the recorder", () => {
    const state = startGame(deckOf(DECK_A), deckOf(DECK_B), registry, 3);
    const board = snapshotBoard(state, registry);

    expect(board.turn).toBe(state.turn);
    expect(board.p1.deckCount).toBe(state.players.p1.deck.length);
    expect(board.p1.hand).toHaveLength(state.players.p1.hand.length);
    expect(board.pendingPromote).toEqual(state.pendingPromote);
  });
});
