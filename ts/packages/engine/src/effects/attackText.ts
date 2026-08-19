import { Attack, GameState, Player, PokemonInPlay, StatusCondition } from "../types.js";
import { getPokemon, nextRandom } from "../cardLookup.js";
import { applyDamage } from "../attackFlow.js";
import { ask, effectSteps } from "./choice.js";
import { effectiveHp, benchCountersPrevented, immuneToStatus } from "./continuous.js";

/**
 * Attack rules text is compiled from the printed English rather than hand-coded
 * per card: a handful of phrasings cover most of what tournament decks play.
 *
 * ponytail: patterns, not a grammar. Anything unmatched is a no-op and shows up
 * in the coverage test, which is the signal to add a pattern.
 */
const opponentOf = (p: Player): Player => (p === "p1" ? "p2" : "p1");

const pokemonInPlay = (ps: GameState["players"][Player]): PokemonInPlay[] =>
  [ps.active, ...ps.bench].filter((p): p is PokemonInPlay => !!p);

function patch(state: GameState, player: Player, fields: Partial<GameState["players"][Player]>): GameState {
  return { ...state, players: { ...state.players, [player]: { ...state.players[player], ...fields } } };
}

const STATUS: Record<string, StatusCondition> = {
  Asleep: "Asleep",
  Confused: "Confused",
  Paralyzed: "Paralyzed",
  Poisoned: "Poisoned",
  Burned: "Burned",
};

/**
 * Damage the attack adds before Weakness and Resistance. Returns the bonus and
 * the state, because coin flips consume the seeded RNG.
 */
export function damageBonus(
  state: GameState,
  attacker: Player,
  attack: Attack
): [number, GameState] {
  const text = attack.text ?? "";
  const me = state.players[attacker];
  const them = state.players[opponentOf(attacker)];

  let m: RegExpExecArray | null;

  if ((m = /Flip a coin until you get tails\. This attack does (\d+) more damage for each heads/.exec(text))) {
    const per = Number(m[1]);
    let next = state;
    let heads = 0;
    for (;;) {
      const [value, after] = nextRandom(next);
      next = after;
      if (value < 0.5) break;
      heads++;
      if (heads > 50) break; // guard against a pathological RNG
    }
    return [heads * per, next];
  }

  if ((m = /Flip a coin\. If heads, this attack does (\d+) more damage/.exec(text))) {
    const [value, next] = nextRandom(state);
    return [value >= 0.5 ? Number(m[1]) : 0, next];
  }

  if ((m = /This attack does (\d+) more damage for each Benched Pokémon \(both/.exec(text))) {
    return [Number(m[1]) * (me.bench.length + them.bench.length), state];
  }

  if ((m = /This attack does (\d+) damage for each of your Benched Pokémon/.exec(text))) {
    return [Number(m[1]) * me.bench.length, state];
  }

  if ((m = /This attack does (\d+) more damage for each Energy attached to both Active Pokémon/.exec(text))) {
    const count = (me.active?.attachedEnergy.length ?? 0) + (them.active?.attachedEnergy.length ?? 0);
    return [Number(m[1]) * count, state];
  }

  if ((m = /If your opponent's Active Pokémon is a Pokémon ex, this attack does (\d+) more damage/.exec(text))) {
    const def = them.active && (getPokemon(state, them.active.card.cardId) as any);
    const isEx = def && (def.subtypes ?? []).includes("ex");
    return [isEx ? Number(m[1]) : 0, state];
  }

  if ((m = /This attack does (\d+) more damage for each Energy attached to this Pokémon/.exec(text))) {
    return [Number(m[1]) * (me.active?.attachedEnergy.length ?? 0), state];
  }

  // "does N damage for each of your <Name> and <Name> in play" — the printed
  // damage is per copy, so the total replaces the base rather than adding to it.
  if ((m = /This attack does (\d+) damage for each of your ([^.]+?) in play/.exec(text))) {
    const per = Number(m[1]);
    const names = m[2].split(/,| and /).map((n) => n.trim()).filter(Boolean);
    const count = [me.active, ...me.bench]
      .filter((p): p is PokemonInPlay => !!p)
      .filter((p) => {
        const def = getPokemon(state, p.card.cardId);
        return !!def && names.includes(def.name);
      }).length;
    return [per * count - attack.baseDamage, state];
  }

  return [0, state];
}

/** Effects that resolve after the damage lands. May ask the player to choose. */
export function afterAttack(state: GameState, attacker: Player, attack: Attack): GameState {
  const text = attack.text ?? "";
  const defender = opponentOf(attacker);
  let next = state;
  let m: RegExpExecArray | null;

  // Special Conditions on the defender.
  if ((m = /Your opponent's Active Pokémon is now (Asleep|Confused|Paralyzed|Poisoned|Burned)/.exec(text))) {
    const condition = STATUS[m[1]];
    const active = next.players[defender].active;
    if (active && !active.statusConditions.includes(condition) && !immuneToStatus(next, active)) {
      next = patch(next, defender, {
        active: { ...active, statusConditions: [...active.statusConditions, condition] },
      });
    }
  }

  if ((m = /This Pokémon also does (\d+) damage to itself/.exec(text))) {
    next = applyDamage(next, attacker, Number(m[1]), null);
    if (next.phase === "gameOver") return next;
  }

  if ((m = /Discard (\d+|all) Energy from this Pokémon/.exec(text))) {
    const active = next.players[attacker].active;
    if (active) {
      const count = m[1] === "all" ? active.attachedEnergy.length : Number(m[1]);
      const discarded = active.attachedEnergy.slice(0, count);
      next = patch(next, attacker, {
        active: { ...active, attachedEnergy: active.attachedEnergy.slice(count) },
        discard: [...next.players[attacker].discard, ...discarded],
      });
    }
  }

  if ((m = /Heal (\d+) damage from this Pokémon/.exec(text))) {
    const active = next.players[attacker].active;
    if (active) {
      next = patch(next, attacker, { active: { ...active, damage: Math.max(0, active.damage - Number(m[1])) } });
    }
  }

  if ((m = /Draw (\d+) cards/.exec(text))) {
    const ps = next.players[attacker];
    const n = Math.min(Number(m[1]), ps.deck.length);
    next = patch(next, attacker, { deck: ps.deck.slice(n), hand: [...ps.hand, ...ps.deck.slice(0, n)] });
  }

  // "During your opponent's next turn, …" lockouts.
  const locks: GameState["ongoing"] = [...(next.ongoing ?? [])];
  if (/During your opponent's next turn, they can't play any Item cards/.test(text)) {
    locks.push({ kind: "itemLock", appliesTo: defender });
  }
  if (/During your opponent's next turn, the Defending Pokémon can't retreat/.test(text)) {
    locks.push({ kind: "noRetreat", appliesTo: defender, instanceId: next.players[defender].active?.card.instanceId });
  }
  if (/During your next turn, this Pokémon can't attack/.test(text)) {
    locks.push({ kind: "noAttack", appliesTo: attacker, instanceId: next.players[attacker].active?.card.instanceId });
  }
  if (locks.length !== (next.ongoing ?? []).length) next = { ...next, ongoing: locks };

  // Recovery from the discard pile.
  if ((m = /Put up to (\d+) ([A-Z][\wé' -]*?) from your discard pile onto your Bench/.exec(text))) {
    const name = m[2].trim();
    return ask(next, {
      player: attacker,
      prompt: `Put up to ${m[1]} ${name} from your discard pile onto your Bench`,
      options: next.players[attacker].discard
        .filter((c) => getPokemon(next, c.cardId)?.name === name)
        .map((c) => c.instanceId),
      remaining: Math.min(Number(m[1]), Math.max(0, 5 - next.players[attacker].bench.length)),
      optional: true,
      effect: "attack:benchFromDiscard",
      step: 0,
      args: [attacker],
    });
  }

  if (/Put a Pokémon from your discard pile into your hand/.test(text)) {
    return ask(next, {
      player: attacker,
      prompt: "Put a Pokémon from your discard pile into your hand",
      options: next.players[attacker].discard
        .filter((c) => !!getPokemon(next, c.cardId))
        .map((c) => c.instanceId),
      remaining: 1,
      optional: true,
      effect: "attack:handFromDiscard",
      step: 0,
      args: [attacker],
    });
  }

  // Choice-driven effects. Each parks a pending choice and resumes from the
  // registry below.
  if ((m = /Put (\d+) damage counters on your opponent's Benched Pokémon in any way you like/.exec(text))) {
    // Battle Cage stops attack effects putting counters on the Bench at all.
    const options = benchCountersPrevented(next) ? [] : next.players[defender].bench.map((p) => p.card.instanceId);
    return ask(next, {
      player: attacker,
      prompt: `Place ${m[1]} damage counters on your opponent's Bench`,
      options,
      remaining: Number(m[1]),
      optional: false,
      repeatable: true,
      effect: "attack:placeCounters",
      step: 0,
      args: [defender],
    });
  }

  if ((m = /This attack does (\d+) damage to 1 of your opponent's Pokémon/.exec(text))) {
    return ask(next, {
      player: attacker,
      prompt: `Choose a Pokémon to take ${m[1]} damage`,
      options: pokemonInPlay(next.players[defender]).map((p) => p.card.instanceId),
      remaining: 1,
      optional: false,
      effect: "attack:snipe",
      step: 0,
      args: [defender, Number(m[1])],
    });
  }

  if (/Switch this Pokémon with 1 of your Benched Pokémon/.test(text)) {
    return ask(next, {
      player: attacker,
      prompt: "Switch this Pokémon with one of your Benched Pokémon",
      options: next.players[attacker].bench.map((p) => p.card.instanceId),
      remaining: 1,
      optional: false,
      effect: "attack:switchSelf",
      step: 0,
      args: [attacker],
    });
  }

  if (/Switch out your opponent's Active Pokémon to the Bench/.test(text)) {
    // The opponent chooses their new Active, so this becomes their decision.
    const ops = next.players[defender];
    if (ops.active && ops.bench.length > 0) {
      return ask(next, {
        player: defender,
        prompt: "Choose your new Active Pokémon",
        options: ops.bench.map((p) => p.card.instanceId),
        remaining: 1,
        optional: false,
        effect: "attack:switchSelf",
        step: 0,
        args: [defender],
      });
    }
  }

  // "Ascension" — evolve this Pokémon straight out of the deck.
  if (/Search your deck for a card that evolves from this Pokémon/.test(text)) {
    const active = next.players[attacker].active;
    const def = active && getPokemon(next, active.card.cardId);
    if (active && def) {
      return ask(next, {
        player: attacker,
        prompt: "Search your deck for a card that evolves from this Pokémon",
        options: next.players[attacker].deck
          .filter((c) => getPokemon(next, c.cardId)?.evolvesFrom === def.name)
          .map((c) => c.instanceId),
        remaining: 1,
        optional: true,
        effect: "attack:ascension",
        step: 0,
        args: [attacker, active.card.instanceId],
      });
    }
  }

  if (/Put this Pokémon and all attached cards into your hand/.test(text)) {
    const ps = next.players[attacker];
    const active = ps.active;
    if (active) {
      next = patch(next, attacker, {
        active: null,
        hand: [...ps.hand, active.card, ...active.attachedEnergy, ...active.attachedTools],
      });
      // Needs a new Active, unless there is nothing left to promote.
      if (next.players[attacker].bench.length === 0) {
        return { ...next, phase: "gameOver", winner: defender };
      }
      next = { ...next, pendingPromote: [...(next.pendingPromote ?? []), attacker] };
    }
  }

  return next;
}

effectSteps.set("attack:placeCounters", [
  (state, _player, picked, args) => {
    const owner = args?.[0] as Player;
    let next = state;
    // Each counter is 10 damage, applied one at a time so a knockout mid-way
    // still resolves through the normal path.
    for (const card of picked) {
      const target = next.players[owner].bench.find((p) => p.card.instanceId === card.instanceId);
      if (!target) continue;
      const bench = next.players[owner].bench.map((p) =>
        p.card.instanceId === card.instanceId ? { ...p, damage: p.damage + 10 } : p
      );
      next = patch(next, owner, { bench });
    }
    return knockOutDamagedBench(next, owner);
  },
]);

effectSteps.set("attack:snipe", [
  (state, player, picked, args) => {
    const owner = args?.[0] as Player;
    const amount = Number(args?.[1] ?? 0);
    const card = picked[0];
    if (!card) return state;
    const ps = state.players[owner];

    if (ps.active?.card.instanceId === card.instanceId) {
      // Weakness and Resistance do apply in the Active Spot.
      return applyDamage(state, owner, amount, player);
    }
    const bench = ps.bench.map((p) =>
      p.card.instanceId === card.instanceId ? { ...p, damage: p.damage + amount } : p
    );
    return knockOutDamagedBench(patch(state, owner, { bench }), owner, player);
  },
]);

effectSteps.set("attack:ascension", [
  (state, _player, picked, args) => {
    const owner = args?.[0] as Player;
    const targetId = String(args?.[1] ?? "");
    const evolution = picked[0];
    if (!evolution) return state;
    const ps = state.players[owner];
    const evolve = (p: PokemonInPlay) =>
      p.card.instanceId === targetId
        ? { ...p, card: evolution, statusConditions: [], placedOnTurn: state.turn }
        : p;
    return patch(state, owner, {
      deck: ps.deck.filter((c) => c.instanceId !== evolution.instanceId),
      active: ps.active ? evolve(ps.active) : null,
      bench: ps.bench.map(evolve),
    });
  },
]);

effectSteps.set("attack:benchFromDiscard", [
  (state, _player, picked, args) => {
    const owner = args?.[0] as Player;
    const ids = new Set(picked.map((c) => c.instanceId));
    const ps = state.players[owner];
    return patch(state, owner, {
      discard: ps.discard.filter((c) => !ids.has(c.instanceId)),
      bench: [
        ...ps.bench,
        ...picked.map((card) => ({
          card,
          damage: 0,
          attachedEnergy: [],
          attachedTools: [],
          statusConditions: [],
          placedOnTurn: state.turn,
        })),
      ],
    });
  },
]);

effectSteps.set("attack:handFromDiscard", [
  (state, _player, picked, args) => {
    const owner = args?.[0] as Player;
    const ids = new Set(picked.map((c) => c.instanceId));
    const ps = state.players[owner];
    return patch(state, owner, {
      discard: ps.discard.filter((c) => !ids.has(c.instanceId)),
      hand: [...ps.hand, ...picked],
    });
  },
]);

effectSteps.set("attack:switchSelf", [
  (state, _player, picked, args) => {
    const owner = args?.[0] as Player;
    const ps = state.players[owner];
    const incoming = ps.bench.find((p) => p.card.instanceId === picked[0]?.instanceId);
    if (!incoming || !ps.active) return state;
    return patch(state, owner, {
      active: { ...incoming, statusConditions: [] },
      bench: [...ps.bench.filter((p) => p !== incoming), ps.active],
    });
  },
]);

/** Bench Pokémon that reached their HP from counters or snipes are knocked out. */
function knockOutDamagedBench(state: GameState, owner: Player, attacker: Player | null = null): GameState {
  let next = state;
  for (const poke of [...next.players[owner].bench]) {
    const def = getPokemon(next, poke.card.cardId);
    if (!def || poke.damage < effectiveHp(next, poke)) continue;

    const ps = next.players[owner];
    next = patch(next, owner, {
      bench: ps.bench.filter((p) => p.card.instanceId !== poke.card.instanceId),
      discard: [...ps.discard, poke.card, ...poke.attachedEnergy, ...poke.attachedTools],
      koedLastTurn: true,
    });
    next = {
      ...next,
      log: [
        ...next.log,
        { timestamp: Date.now(), player: owner, message: `${def.name} was Knocked Out on the Bench` },
      ],
    };

    const taker = attacker ?? opponentOf(owner);
    const prizeCount = Math.min(def.prizeValue ?? 1, next.players[taker].prizes.length);
    const taken = next.players[taker].prizes.slice(0, prizeCount);
    next = patch(next, taker, {
      prizes: next.players[taker].prizes.slice(prizeCount),
      hand: [...next.players[taker].hand, ...taken],
    });
    if (next.players[taker].prizes.length === 0) {
      return { ...next, phase: "gameOver", winner: taker };
    }
    // Losing a Benched Pokémon never empties the Active Spot, so no promotion is owed.
  }
  return next;
}

/** Every phrasing this module understands; the coverage test reads it too. */
export const HANDLED_PATTERNS: RegExp[] = [
  /During your opponent's next turn, they can't play any Item cards/,
  /During your opponent's next turn, the Defending Pokémon can't retreat/,
  /During your next turn, this Pokémon can't attack/,
  /Put up to (\d+) ([A-Z][\wé' -]*?) from your discard pile onto your Bench/,
  /Put a Pokémon from your discard pile into your hand/,
  /Flip a coin until you get tails\. This attack does (\d+) more damage for each heads/,
  /Flip a coin\. If heads, this attack does (\d+) more damage/,
  /This attack does (\d+) more damage for each Benched Pokémon \(both/,
  /This attack does (\d+) damage for each of your Benched Pokémon/,
  /This attack does (\d+) more damage for each Energy attached to both Active Pokémon/,
  /If your opponent's Active Pokémon is a Pokémon ex, this attack does (\d+) more damage/,
  /This attack does (\d+) more damage for each Energy attached to this Pokémon/,
  /This attack does (\d+) damage for each of your ([^.]+?) in play/,
  /Your opponent's Active Pokémon is now (Asleep|Confused|Paralyzed|Poisoned|Burned)/,
  /This Pokémon also does (\d+) damage to itself/,
  /Discard (\d+|all) Energy from this Pokémon/,
  /Heal (\d+) damage from this Pokémon/,
  /Draw (\d+) cards/,
  /Put (\d+) damage counters on your opponent's Benched Pokémon in any way you like/,
  /This attack does (\d+) damage to 1 of your opponent's Pokémon/,
  /Switch this Pokémon with 1 of your Benched Pokémon/,
  /Switch out your opponent's Active Pokémon to the Bench/,
  /Put this Pokémon and all attached cards into your hand/,
  /Search your deck for a card that evolves from this Pokémon/,
];

/** True when any pattern in this module recognises the text. */
export function isAttackTextHandled(text: string): boolean {
  if (!text.trim()) return true; // vanilla attack: nothing to do
  return HANDLED_PATTERNS.some((p) => p.test(text));
}
