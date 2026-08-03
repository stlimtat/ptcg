import React from 'react';
import { Action } from '@pokemon-tcg/engine';

interface ActionBarProps {
  actions: Action[];
  onAction: (action: Action) => void;
  cardRegistry?: Record<string, any>;
}

export const ActionBar: React.FC<ActionBarProps> = ({ actions, onAction, cardRegistry = {} }) => {
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
      case 'attack': {
        const attackName = act.attackName || `Attack`;
        return `${attackName}`;
      }
      default:
        return act.type;
    }
  };

  return (
    <div style={{ border: '2px solid red', padding: '10px' }}>
      <h3>Actions ({actions.length})</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '5px' }}>
        {actions.map((action, i) => (
          <button
            key={i}
            onClick={() => onAction(action)}
            style={{ padding: '8px 12px', cursor: 'pointer' }}
          >
            {getActionLabel(action)}
          </button>
        ))}
      </div>
    </div>
  );
};
