import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, it, expect } from "vitest";
import { GameState, Card, Player } from "../src/types.js";
import { applyAction } from "../src/reducer.js";
import { legalActions } from "../src/legalActions.js";
import { isTrainerImplemented } from "../src/effects/trainers.js";
import { CONTINUOUS_CARDS } from "../src/effects/continuous.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = JSON.parse(fs.readFileSync(path.join(root, "data/cards.json"), "utf8"));
const registry: Record<string, Card> = Object.fromEntries(pool.cards.map((c: any) => [c.id, c]));
const byName = (name: string) => pool.cards.find((c: any) => c.name === name);

let seq = 0;
const inst = (cardId: string) => ({ id: `i${seq}`, cardId, instanceId: `i${seq++}` });
const poke = (cardId: string) => ({
  card: inst(cardId),
  damage: 0,
  attachedEnergy: [],
  attachedTools: [],
  statusConditions: [],
  placedOnTurn: 0,
});

function baseState(): GameState {
  return {
    turn: 3,
    activePlayer: "p1",
    phase: "main",
    cardRegistry: registry,
    rngSeed: 7,
    players: {
      p1: {
        deck: [], hand: [], discard: [], prizes: [],
        active: poke(byName("Budew").id), bench: [],
        energyAttachedThisTurn: false, supporterPlayedThisTurn: false, hasDrawnThisTurn: true,
      },
      p2: {
        deck: [], hand: [], discard: [], prizes: [],
        active: poke(byName("Budew").id), bench: [],
        energyAttachedThisTurn: false, supporterPlayedThisTurn: false, hasDrawnThisTurn: true,
      },
    },
    log: [],
  };
}

/** Play a trainer, then answer each choice it raises with `answers` in order. */
function playTrainer(state: GameState, cardName: string, answers: (string | null)[] = [], player: Player = "p1") {
  const card = state.players[player].hand.find((c) => registry[c.cardId]?.name === cardName)!;
  let next = applyAction(state, { type: "playTrainer", player, cardId: card.cardId });
  for (const answer of answers) {
    expect(next.pendingChoice, `expected a choice before answering ${answer}`).toBeTruthy();
    next = applyAction(next, { type: "choose", player, instanceId: answer ?? undefined });
  }
  return next;
}

describe("trainer effects", () => {
  it("Ultra Ball discards 2 cards, then fetches a Pokémon from the deck", () => {
    const state = baseState();
    const ultraBall = inst(byName("Ultra Ball").id);
    const junk = [inst(byName("Switch").id), inst(byName("Judge").id)];
    const target = inst(byName("Fezandipiti ex").id);
    state.players.p1.hand = [ultraBall, ...junk];
    state.players.p1.deck = [target, inst(byName("Psychic Energy").id)];

    const next = playTrainer(state, "Ultra Ball", [
      junk[0].instanceId,
      junk[1].instanceId,
      target.instanceId,
    ]);

    expect(next.players.p1.hand.map((c) => c.instanceId)).toEqual([target.instanceId]);
    // Ultra Ball itself plus the two discarded cards
    expect(next.players.p1.discard).toHaveLength(3);
    expect(next.players.p1.deck).toHaveLength(1);
  });

  it("Ultra Ball is illegal without 2 other cards to discard", () => {
    const state = baseState();
    const ultraBall = inst(byName("Ultra Ball").id);
    state.players.p1.hand = [ultraBall, inst(byName("Judge").id)];
    const playable = legalActions(state, "p1").filter((a) => a.type === "playTrainer");

    expect(playable.some((a: any) => a.cardId === ultraBall.cardId)).toBe(false);
    expect(playable).toHaveLength(1); // the Judge is still fine
  });

  it("Boss's Orders drags a Benched Pokémon into the Active Spot", () => {
    const state = baseState();
    state.players.p1.hand = [inst(byName("Boss's Orders").id)];
    const benched = poke(byName("Fezandipiti ex").id);
    const oldActive = state.players.p2.active!;
    state.players.p2.bench = [benched];

    const next = playTrainer(state, "Boss's Orders", [benched.card.instanceId]);

    expect(next.players.p2.active!.card.instanceId).toBe(benched.card.instanceId);
    expect(next.players.p2.bench.map((p) => p.card.instanceId)).toEqual([oldActive.card.instanceId]);
  });

  it("Judge refills both hands to 4", () => {
    const state = baseState();
    state.players.p1.hand = [inst(byName("Judge").id), inst(byName("Switch").id)];
    state.players.p1.deck = Array.from({ length: 10 }, () => inst(byName("Psychic Energy").id));
    state.players.p2.hand = Array.from({ length: 7 }, () => inst(byName("Switch").id));
    state.players.p2.deck = Array.from({ length: 10 }, () => inst(byName("Psychic Energy").id));

    const next = playTrainer(state, "Judge");

    expect(next.players.p1.hand).toHaveLength(4);
    expect(next.players.p2.hand).toHaveLength(4);
    // Judge itself is in the discard, the rest of the old hand went back to the deck
    expect(next.players.p1.deck).toHaveLength(7);
  });

  it("Rare Candy jumps a Basic straight to Stage 2", () => {
    const state = baseState();
    const basic = poke(byName("Ralts").id);
    const stage2 = inst(byName("Gardevoir ex").id);
    state.players.p1.active = basic;
    state.players.p1.hand = [inst(byName("Rare Candy").id), stage2];

    const next = playTrainer(state, "Rare Candy", [basic.card.instanceId, stage2.instanceId]);

    expect(next.players.p1.active!.card.instanceId).toBe(stage2.instanceId);
    expect(next.players.p1.discard.some((c) => c.instanceId === basic.card.instanceId)).toBe(true);
  });

  it("a Tool stays in play attached, a Stadium goes to the Stadium zone", () => {
    const state = baseState();
    const tool = inst(byName("Lucky Helmet").id);
    const stadium = inst(byName("Risky Ruins").id);
    state.players.p1.hand = [tool, stadium];

    const withTool = applyAction(state, {
      type: "playTrainer",
      player: "p1",
      cardId: tool.cardId,
      targetInstanceId: state.players.p1.active!.card.instanceId,
    });
    expect(withTool.players.p1.active!.attachedTools).toHaveLength(1);
    expect(withTool.players.p1.discard).toHaveLength(0);

    const withStadium = applyAction(withTool, { type: "playTrainer", player: "p1", cardId: stadium.cardId });
    expect(withStadium.stadium!.instanceId).toBe(stadium.instanceId);
    expect(withStadium.players.p1.discard).toHaveLength(0);
  });

  it("a pending choice blocks every other action", () => {
    const state = baseState();
    state.players.p1.hand = [inst(byName("Boss's Orders").id), inst(byName("Switch").id)];
    state.players.p1.bench = [poke(byName("Budew").id)];
    state.players.p2.bench = [poke(byName("Budew").id)];

    const card = state.players.p1.hand[0];
    const asking = applyAction(state, { type: "playTrainer", player: "p1", cardId: card.cardId });

    expect(asking.pendingChoice).toBeTruthy();
    expect(legalActions(asking, "p1").every((a) => a.type === "choose")).toBe(true);
    expect(legalActions(asking, "p2")).toHaveLength(0);
  });

  it("covers the trainers that actually show up in tournament decks", () => {
    const decks = fs
      .readdirSync(path.join(root, "data/decks"))
      .filter((f) => f.endsWith(".json") && f !== "index.json")
      // Only real tournament lists: evolved decks are search output.
      .filter((f) => !!JSON.parse(fs.readFileSync(path.join(root, "data/decks", f), "utf8")).tournament);

    const copies: Record<string, number> = {};
    for (const file of decks) {
      const deck = JSON.parse(fs.readFileSync(path.join(root, "data/decks", file), "utf8"));
      for (const id of deck.cards) {
        const def = registry[id];
        if (def?.type !== "trainer") continue;
        copies[def.name] = (copies[def.name] ?? 0) + 1;
      }
    }

    const subtypeOf = (name: string) => (Object.values(registry).find((c) => c.name === name) as any)?.subtype;
    const total = Object.values(copies).reduce((a, b) => a + b, 0);

    const withEffect = Object.entries(copies).filter(
      ([name]) => isTrainerImplemented(name) || CONTINUOUS_CARDS.has(name)
    );
    // Routed into the right zone, but the printed text still does nothing.
    const routedOnly = Object.entries(copies).filter(
      ([name]) =>
        !isTrainerImplemented(name) && !CONTINUOUS_CARDS.has(name) && ["tool", "stadium"].includes(subtypeOf(name))
    );
    const sum = (rows: [string, number][]) => rows.reduce((a, [, n]) => a + n, 0);

    const missing = Object.entries(copies)
      .filter(
        ([name]) =>
          !isTrainerImplemented(name) && !CONTINUOUS_CARDS.has(name) && !["tool", "stadium"].includes(subtypeOf(name))
      )
      .sort((a, b) => b[1] - a[1]);

    console.log(`trainer copies in decks: ${total}`);
    console.log(`  effect implemented:    ${sum(withEffect)} (${((sum(withEffect) / total) * 100).toFixed(0)}%)`);
    console.log(`  routed, text ignored:  ${sum(routedOnly)} (tools/stadiums)`);
    console.log(`  no-op:                 ${sum(missing as [string, number][])}`);
    console.log("top no-ops:", missing.slice(0, 8));

    expect(sum(withEffect) / total).toBeGreaterThan(0.7);
  });
});
