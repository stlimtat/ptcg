import { CardInstance, GameState, Player } from "../types.js";

/**
 * Card effects that need a decision park a PendingChoice on the state and stop.
 * The player answers with a `choose` action, and once enough cards are picked
 * the effect resumes at `step`.
 *
 * Choices are asked one card at a time on purpose: enumerating every k-of-n
 * subset would blow up the action space an agent has to search.
 */
export interface PendingChoice {
  player: Player;
  prompt: string;
  /** instanceIds still selectable */
  options: string[];
  /** cards picked so far */
  picked: string[];
  /** how many more may be picked */
  remaining: number;
  /** may the player stop early (or pick nothing at all)? */
  optional: boolean;
  /** effect to resume, and which step of it */
  effect: string;
  step: number;
  /** options stay selectable after being picked (e.g. damage counters) */
  repeatable?: boolean;
  /** parameters the resuming step needs, e.g. how many counters to place */
  args?: (string | number)[];
}

export function ask(
  state: GameState,
  choice: Omit<PendingChoice, "picked"> & { picked?: string[] }
): GameState {
  // Nothing to choose from: resume immediately rather than stalling the game.
  if (choice.options.length === 0 || choice.remaining <= 0) {
    return resumeEffect(state, choice.effect, choice.step, choice.player, choice.picked ?? [], choice.args);
  }
  return { ...state, pendingChoice: { picked: [], ...choice } };
}

/** Find a card instance anywhere in either player's zones. */
export function findInstance(state: GameState, instanceId: string): CardInstance | null {
  for (const p of ["p1", "p2"] as Player[]) {
    const ps = state.players[p];
    for (const zone of [ps.hand, ps.deck, ps.discard, ps.prizes]) {
      const hit = zone.find((c) => c.instanceId === instanceId);
      if (hit) return hit;
    }
    for (const poke of [ps.active, ...ps.bench]) {
      if (!poke) continue;
      if (poke.card.instanceId === instanceId) return poke.card;
      const attached = [...poke.attachedEnergy, ...poke.attachedTools].find(
        (c) => c.instanceId === instanceId
      );
      if (attached) return attached;
    }
  }
  return null;
}

// Effects register their steps here; trainers.ts fills it in. Kept as a
// registry so choice.ts does not have to import every effect module.
export type EffectStep = (
  state: GameState,
  player: Player,
  picked: CardInstance[],
  args?: (string | number)[]
) => GameState;

export const effectSteps = new Map<string, EffectStep[]>();

export function resumeEffect(
  state: GameState,
  effect: string,
  step: number,
  player: Player,
  pickedIds: string[],
  args?: (string | number)[]
): GameState {
  const steps = effectSteps.get(effect);
  const fn = steps?.[step];
  if (!fn) return { ...state, pendingChoice: undefined };
  const picked = pickedIds.map((id) => findInstance(state, id)).filter((c): c is CardInstance => !!c);
  return fn({ ...state, pendingChoice: undefined }, player, picked, args);
}
