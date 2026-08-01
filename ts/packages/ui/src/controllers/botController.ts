import { GameState, Action, legalActions } from '@pokemon-tcg/engine';

export function getBotAction(state: GameState): Action | null {
  const available = legalActions(state, 'p2');
  if (available.length === 0) return null;

  // ponytail: random action selection. Replace with actual AI heuristics later.
  return available[Math.floor(Math.random() * available.length)];
}
