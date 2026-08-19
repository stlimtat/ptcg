import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";
import { describe, it, expect } from "vitest";
import { Card, GameState, Player } from "../src/types.js";
import { applyAction } from "../src/reducer.js";
import { legalActions } from "../src/legalActions.js";
import { resolveAttack } from "../src/attackFlow.js";
import { isAttackTextHandled } from "../src/effects/attackText.js";
import { isAbilityImplemented } from "../src/effects/abilities.js";
import { CONTINUOUS_CARDS } from "../src/effects/continuous.js";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../..");
const pool = JSON.parse(fs.readFileSync(path.join(root, "data/cards.json"), "utf8"));
const registry: Record<string, Card> = Object.fromEntries(pool.cards.map((c: any) => [c.id, c]));
const byName = (name: string) => pool.cards.find((c: any) => c.name === name);

let seq = 0;
const inst = (cardId: string) => ({ id: `a${seq}`, cardId, instanceId: `a${seq++}` });
const poke = (cardId: string, energy: string[] = []) => ({
  card: inst(cardId),
  damage: 0,
  attachedEnergy: energy.map(inst),
  attachedTools: [],
  statusConditions: [],
  placedOnTurn: 0,
});

function baseState(): GameState {
  const empty = (active: any) => ({
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
    rngSeed: 12345,
    players: { p1: empty(poke(byName("Budew").id)), p2: empty(poke(byName("Budew").id)) },
    log: [],
  };
}

/** Basic Energy of the type an attack cost asks for (Colorless takes anything). */
const energyFor = (costType: string) =>
  inst((byName(`${costType === "Colorless" ? "Psychic" : costType} Energy`) ?? byName("Psychic Energy")).id);

const payFor = (attack: any) => attack.cost.map((t: string) => energyFor(t));

/** Find a card whose attack text matches, so tests track the real card pool. */
function cardWithAttackText(pattern: RegExp, opts: { stage?: number } = {}) {
  return pool.cards.find(
    (c: any) =>
      c.type === "pokemon" &&
      (opts.stage === undefined || c.stage === opts.stage) &&
      c.attacks?.some((a: any) => pattern.test(a.text ?? ""))
  );
}

describe("attack text effects", () => {
  it("applies a Special Condition named in the attack text", () => {
    const card = cardWithAttackText(/Your opponent's Active Pokémon is now Asleep/);
    const index = card.attacks.findIndex((a: any) => /is now Asleep/.test(a.text ?? ""));
    const state = baseState();
    state.players.p1.active = poke(card.id);
    state.players.p1.active.attachedEnergy = payFor(card.attacks[index]);

    const next = resolveAttack(state, "p1", index);
    expect(next.players.p2.active!.statusConditions).toContain("Asleep");
  });

  it("adds bonus damage for each Benched Pokémon", () => {
    const card = cardWithAttackText(/This attack does \d+ more damage for each Benched Pokémon \(both/);
    const index = card.attacks.findIndex((a: any) =>
      /more damage for each Benched Pokémon \(both/.test(a.text ?? "")
    );
    const attack = card.attacks[index];
    const per = Number(/does (\d+) more damage/.exec(attack.text)![1]);

    const state = baseState();
    state.players.p1.active = poke(card.id);
    state.players.p1.active.attachedEnergy = payFor(attack);
    state.players.p1.bench = [poke(byName("Budew").id), poke(byName("Budew").id)];
    state.players.p2.bench = [poke(byName("Budew").id)];
    // A big defender so the damage lands instead of knocking it out.
    state.players.p2.active = poke(byName("Mega Kangaskhan ex").id);

    const next = resolveAttack(state, "p1", index);
    const defenderDef: any = registry[state.players.p2.active.card.cardId];
    const weak = defenderDef.weakness && (registry[card.id] as any).types.includes(defenderDef.weakness.type);
    const expected = (attack.baseDamage + per * 3) * (weak ? 2 : 1);
    expect(next.players.p2.active!.damage).toBe(expected);
  });

  it("asks where to put damage counters, and knocks out a Benched Pokémon that fills up", () => {
    const card = cardWithAttackText(/Put \d+ damage counters on your opponent's Benched Pokémon in any way you like/);
    const index = card.attacks.findIndex((a: any) => /Put \d+ damage counters/.test(a.text ?? ""));
    const attack = card.attacks[index];
    const counters = Number(/Put (\d+) damage counters/.exec(attack.text)![1]);

    const state = baseState();
    state.players.p1.active = poke(card.id);
    state.players.p1.active.attachedEnergy = payFor(attack);
    state.players.p2.active = poke(byName("Mega Kangaskhan ex").id);
    // Pre-damaged so the counters this attack places are lethal.
    const target = poke(byName("Budew").id);
    target.damage = 30 - counters * 10;
    state.players.p2.bench = [target];

    let next = resolveAttack(state, "p1", index);
    expect(next.pendingChoice?.prompt).toMatch(/damage counters/);
    expect(next.pendingChoice?.repeatable).toBe(true);

    // All counters onto the one Benched Pokémon.
    for (let i = 0; i < counters; i++) {
      next = applyAction(next, { type: "choose", player: "p1", instanceId: target.card.instanceId });
    }

    expect(next.pendingChoice).toBeUndefined();
    expect(next.players.p2.bench).toHaveLength(0);
    expect(next.players.p1.prizes.length).toBeLessThan(6);
  });

  it("covers the attack texts printed on Pokémon in tournament decks", () => {
    const decks = fs
      .readdirSync(path.join(root, "data/decks"))
      .filter((f) => f.endsWith(".json") && f !== "index.json")
      // Only real tournament lists: evolved decks are search output.
      .filter((f) => !!JSON.parse(fs.readFileSync(path.join(root, "data/decks", f), "utf8")).tournament);

    let handled = 0;
    let total = 0;
    const missing: Record<string, number> = {};
    for (const file of decks) {
      const deck = JSON.parse(fs.readFileSync(path.join(root, "data/decks", file), "utf8"));
      for (const id of deck.cards) {
        const def: any = registry[id];
        if (def?.type !== "pokemon") continue;
        for (const attack of def.attacks ?? []) {
          total++;
          if (isAttackTextHandled(attack.text ?? "")) handled++;
          else missing[attack.text] = (missing[attack.text] ?? 0) + 1;
        }
      }
    }

    console.log(`attack texts: ${handled}/${total} printed attacks handled (${((handled / total) * 100).toFixed(0)}%)`);
    console.log(
      "top unhandled:",
      Object.entries(missing)
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
        .map(([t, n]) => `${n}x ${t.slice(0, 70)}`)
    );
    expect(handled / total).toBeGreaterThan(0.6);
  });
});

describe("activated abilities", () => {
  it("offers a usable Ability and spends it for the turn", () => {
    const drakloak = byName("Drakloak");
    const state = baseState();
    state.players.p1.bench = [poke(drakloak.id)];

    const offered = legalActions(state, "p1").filter((a) => a.type === "useAbility");
    expect(offered).toHaveLength(1);
    expect((offered[0] as any).abilityName).toBe("Recon Directive");

    let next = applyAction(state, offered[0]);
    expect(next.pendingChoice?.prompt).toMatch(/top 2 cards/);
    next = applyAction(next, {
      type: "choose",
      player: "p1",
      instanceId: next.pendingChoice!.options[0],
    });

    expect(next.players.p1.hand).toHaveLength(1);
    // Once per turn only.
    expect(legalActions(next, "p1").filter((a) => a.type === "useAbility")).toHaveLength(0);
  });

  it("gates an Ability on its printed condition", () => {
    const fezandipiti = byName("Fezandipiti ex");
    const state = baseState();
    state.players.p1.bench = [poke(fezandipiti.id)];

    // Flip the Script needs a knockout on the opponent's last turn.
    expect(legalActions(state, "p1").filter((a) => a.type === "useAbility")).toHaveLength(0);

    state.players.p1.koedLastTurn = true;
    const offered = legalActions(state, "p1").filter((a) => a.type === "useAbility");
    expect(offered).toHaveLength(1);

    const next = applyAction(state, offered[0]);
    expect(next.players.p1.hand).toHaveLength(3);
  });

  it("reports ability coverage over tournament decks", () => {
    const decks = fs
      .readdirSync(path.join(root, "data/decks"))
      .filter((f) => f.endsWith(".json") && f !== "index.json")
      // Only real tournament lists: evolved decks are search output.
      .filter((f) => !!JSON.parse(fs.readFileSync(path.join(root, "data/decks", f), "utf8")).tournament);

    const copies: Record<string, number> = {};
    for (const file of decks) {
      const deck = JSON.parse(fs.readFileSync(path.join(root, "data/decks", file), "utf8"));
      for (const id of deck.cards) {
        const def: any = registry[id];
        for (const ability of def?.abilities ?? []) copies[ability.name] = (copies[ability.name] ?? 0) + 1;
      }
    }

    const total = Object.values(copies).reduce((a, b) => a + b, 0);
    const done = Object.entries(copies).filter(([n]) => isAbilityImplemented(n) || CONTINUOUS_CARDS.has(n));
    const covered = done.reduce((s, [, n]) => s + n, 0);
    console.log(`abilities: ${covered}/${total} copies implemented (${((covered / total) * 100).toFixed(0)}%)`);
    console.log(
      "top unimplemented:",
      Object.entries(copies)
        .filter(([n]) => !isAbilityImplemented(n) && !CONTINUOUS_CARDS.has(n))
        .sort((a, b) => b[1] - a[1])
        .slice(0, 6)
    );
    expect(covered).toBeGreaterThan(0);
  });
});
