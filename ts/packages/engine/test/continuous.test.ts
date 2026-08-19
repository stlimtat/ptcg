import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, it, expect } from "vitest";
import { Card, GameState } from "../src/types.js";
import { applyAction } from "../src/reducer.js";
import { legalActions } from "../src/legalActions.js";
import { damageFor } from "../src/attackFlow.js";
import {
  effectiveHp,
  effectiveRetreatCost,
  effectiveWeakness,
  benchLimit,
  abilitiesLocked,
  toolsDisabled,
} from "../src/effects/continuous.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = JSON.parse(fs.readFileSync(path.join(root, "data/cards.json"), "utf8"));
const registry: Record<string, Card> = Object.fromEntries(pool.cards.map((c: any) => [c.id, c]));
const byName = (name: string) => pool.cards.find((c: any) => c.name === name);

let seq = 0;
const inst = (cardId: string) => ({ id: `c${seq}`, cardId, instanceId: `c${seq++}` });
const poke = (cardId: string): any => ({
  card: inst(cardId),
  damage: 0,
  attachedEnergy: [],
  attachedTools: [],
  statusConditions: [],
  placedOnTurn: 0,
});

function baseState(): GameState {
  const side = (active: any) => ({
    deck: Array.from({ length: 20 }, () => inst(byName("Psychic Energy").id)),
    hand: [], discard: [], prizes: Array.from({ length: 6 }, () => inst(byName("Psychic Energy").id)),
    active, bench: [],
    energyAttachedThisTurn: false, supporterPlayedThisTurn: false, hasDrawnThisTurn: true,
  });
  return {
    turn: 3,
    activePlayer: "p1",
    phase: "main",
    cardRegistry: registry,
    rngSeed: 4242,
    players: { p1: side(poke(byName("Budew").id)), p2: side(poke(byName("Budew").id)) },
    log: [],
  };
}

const withStadium = (state: GameState, name: string): GameState => ({
  ...state,
  stadium: inst(byName(name).id),
});

describe("tools", () => {
  it("Hero's Cape raises effective HP, so a knockout needs more damage", () => {
    const state = baseState();
    const target = poke(byName("Budew").id);
    const bare = effectiveHp(state, target);

    target.attachedTools = [inst(byName("Hero's Cape").id)];
    expect(effectiveHp(state, target)).toBe(bare + 100);
  });

  it("Air Balloon lowers the Retreat Cost", () => {
    const state = baseState();
    const heavy = poke(byName("Mega Kangaskhan ex").id);
    const bare = effectiveRetreatCost(state, "p1", heavy);
    expect(bare).toBeGreaterThan(0);

    heavy.attachedTools = [inst(byName("Air Balloon").id)];
    expect(effectiveRetreatCost(state, "p1", heavy)).toBe(Math.max(0, bare - 2));
  });

  it("Jamming Tower switches every Tool off", () => {
    const state = withStadium(baseState(), "Jamming Tower");
    const target = poke(byName("Budew").id);
    target.attachedTools = [inst(byName("Hero's Cape").id)];

    expect(toolsDisabled(state)).toBe(true);
    expect(effectiveHp(state, target)).toBe(registry[target.card.cardId].hp);
  });
});

describe("stadiums", () => {
  it("Risky Ruins chips a Basic as it is benched, but not a Darkness one", () => {
    let state = withStadium(baseState(), "Risky Ruins");
    const grass = byName("Budew"); // Grass Basic
    const dark = pool.cards.find(
      (c: any) => c.type === "pokemon" && c.stage === 0 && c.types?.includes("Darkness")
    );
    state.players.p1.hand = [inst(grass.id), inst(dark.id)];

    const playGrass = legalActions(state, "p1").find(
      (a: any) => a.type === "playPokemon" && a.cardId === grass.id
    )!;
    const afterGrass = applyAction(state, playGrass);
    expect(afterGrass.players.p1.bench[0].damage).toBe(20);

    const playDark = legalActions(afterGrass, "p1").find(
      (a: any) => a.type === "playPokemon" && a.cardId === dark.id
    )!;
    const afterDark = applyAction(afterGrass, playDark);
    expect(afterDark.players.p1.bench[1].damage).toBe(0);
  });

  it("Area Zero Underdepths widens the Bench only for a player with a Tera Pokémon", () => {
    const state = withStadium(baseState(), "Area Zero Underdepths");
    expect(benchLimit(state, "p1")).toBe(5);

    const tera = pool.cards.find(
      (c: any) => c.type === "pokemon" && (c.subtypes ?? []).some((s: string) => /Tera/i.test(s))
    );
    state.players.p1.bench = [poke(tera.id)];
    expect(benchLimit(state, "p1")).toBe(8);
    expect(benchLimit(state, "p2")).toBe(5);
  });

  it("Team Rocket's Watchtower silences Colorless Abilities on both sides", () => {
    const colorlessWithAbility = pool.cards.find(
      (c: any) => c.type === "pokemon" && c.types?.includes("Colorless") && c.abilities?.length > 0
    );
    const plain = baseState();
    const target = poke(colorlessWithAbility.id);
    expect(abilitiesLocked(plain, target)).toBe(false);

    const locked = withStadium(plain, "Team Rocket's Watchtower");
    expect(abilitiesLocked(locked, target)).toBe(true);
  });
});

describe("continuous abilities", () => {
  it("Fairy Zone rewrites the Weakness of the opponent's Dragon Pokémon", () => {
    const state = baseState();
    const dragon = pool.cards.find((c: any) => c.type === "pokemon" && c.types?.includes("Dragon"));
    const target = poke(dragon.id);
    state.players.p2.active = target;

    const before = effectiveWeakness(state, "p2", target);
    state.players.p1.bench = [poke(byName("Lillie's Clefairy ex").id)];
    const after = effectiveWeakness(state, "p2", target);

    expect(after?.type).toBe("Psychic");
    expect(after).not.toEqual(before);
  });

  it("Skyliner zeroes the Retreat Cost of your Basic Pokémon", () => {
    const state = baseState();
    const basic = poke(byName("Mega Kangaskhan ex").id);
    state.players.p1.active = basic;
    expect(effectiveRetreatCost(state, "p1", basic)).toBeGreaterThan(0);

    state.players.p1.bench = [poke(byName("Latias ex").id)];
    expect(effectiveRetreatCost(state, "p1", basic)).toBe(0);
    // The opponent's Basics are unaffected.
    expect(effectiveRetreatCost(state, "p2", basic)).toBeGreaterThan(0);
  });
});

describe("damage pipeline", () => {
  it("adds Tool damage before Weakness is applied", () => {
    const state = baseState();
    // A Pokémon without a Rule Box, so Brave Bangle applies.
    const attacker = pool.cards.find(
      (c: any) =>
        c.type === "pokemon" &&
        (c.prizeValue ?? 1) === 1 &&
        c.attacks?.length &&
        c.attacks[0].baseDamage > 0 &&
        !(c.subtypes ?? []).includes("ex")
    );
    const source = poke(attacker.id);
    state.players.p1.active = source;
    state.players.p2.active = poke(byName("Mega Kangaskhan ex").id);

    const bare = damageFor(state, "p1", 0);
    source.attachedTools = [inst(byName("Brave Bangle").id)];
    const boosted = damageFor(state, "p1", 0);

    const weak = registry[state.players.p2.active.card.cardId] as any;
    const multiplier =
      weak.weakness && (registry[attacker.id] as any).types.includes(weak.weakness.type) ? 2 : 1;
    expect(boosted - bare).toBe(30 * multiplier);
  });
});
