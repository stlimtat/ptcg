import React from 'react';
import { Action } from '@pokemon-tcg/engine';
import { CardTooltip } from '../components/CardTooltip';

interface ActionBarProps {
  actions: Action[];
  onAction: (action: Action) => void;
  cardRegistry?: Record<string, any>;
  /** Text of the effect currently asking for a decision, if any. */
  prompt?: string;
  /** Resolves an instanceId to the card sitting behind it. */
  cardForInstance?: (instanceId: string) => any;
}

export const ActionBar: React.FC<ActionBarProps> = ({ actions, onAction, cardRegistry = {}, prompt, cardForInstance }) => {
  const getActionLabel = (action: Action) => {
    const act = action as any;
    switch (action.type) {
      case 'endTurn':
        return 'End Turn';
      case 'playPokemon': {
        const card = cardRegistry[act.cardId];
        const cardName = card?.name || 'Pokémon';
        return `Play: ${cardName}`;
      }
      case 'evolve': {
        const card = cardRegistry[act.cardId];
        const cardName = card?.name || 'Evolve';
        return `Evolve to: ${cardName}`;
      }
      case 'attachEnergy':
        return `Attach Energy`;
      case 'playTrainer': {
        const card = cardRegistry[act.cardId];
        const cardName = card?.name || 'Trainer';
        return `Play: ${cardName}`;
      }
      case 'retreat':
        return `Retreat`;
      case 'useAbility':
        return `Ability: ${act.abilityName}`;
      case 'promote':
        return `Promote: ${cardForInstance?.(act.instanceId)?.name ?? 'Pokémon'}`;
      case 'choose':
        if (!act.instanceId) return 'Done';
        return `Choose: ${cardForInstance?.(act.instanceId)?.name ?? act.instanceId}`;
      case 'attack': {
        const attackName = act.attackName || `Attack`;
        return `${attackName}`;
      }
      default:
        return act.type;
    }
  };

  const getCardForAction = (action: Action) => {
    const act = action as any;
    if (act.type === 'playPokemon' || act.type === 'evolve' || act.type === 'playTrainer' || act.type === 'attachEnergy') {
      const cardId = act.cardId || act.energyCardId;
      return cardRegistry[cardId];
    }
    return null;
  };

  return (
    <div style={{ border: '2px solid red', padding: '10px' }}>
      <h3>Actions ({actions.length})</h3>
      {prompt && <p style={{ margin: '0 0 8px', fontWeight: 'bold' }}>{prompt}</p>}
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
        {actions.map((action, i) => {
          const cardDef = getCardForAction(action);
          const act = action as any;
          const cardId = act.cardId || act.energyCardId;
          const label = getActionLabel(action);

          const button = (
            <button
              key={i}
              onClick={() => onAction(action)}
              style={{ padding: '8px 12px', cursor: 'pointer' }}
            >
              {label}
            </button>
          );

          if (cardDef) {
            return (
              <CardTooltip key={i} cardId={cardId} cardName={label} cardDef={cardDef}>
                {button}
              </CardTooltip>
            );
          }
          return button;
        })}
      </div>
    </div>
  );
};
