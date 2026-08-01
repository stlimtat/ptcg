import React from 'react';
import { Action } from '@pokemon-tcg/engine';

interface ActionBarProps {
  actions: Action[];
  onAction: (action: Action) => void;
}

export const ActionBar: React.FC<ActionBarProps> = ({ actions, onAction }) => {
  const getActionLabel = (action: Action) => {
    switch (action.type) {
      case 'endTurn':
        return 'End Turn';
      case 'playPokemon':
        return `Play Pokémon`;
      case 'evolve':
        return `Evolve`;
      case 'attachEnergy':
        return `Attach Energy`;
      case 'playTrainer':
        return `Play Trainer`;
      case 'retreat':
        return `Retreat`;
      case 'attack':
        return `Attack ${(action as any).attackIndex}`;
      default:
        return (action as any).type;
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
