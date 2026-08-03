import React from 'react';
import { CardInstance } from '@pokemon-tcg/engine';
import { CardRegistry } from '../types';
import { CardTooltip } from '../components/CardTooltip';

interface HandProps {
  hand: CardInstance[];
  cardRegistry: CardRegistry;
  onCardClick: (card: CardInstance) => void;
}

export const Hand: React.FC<HandProps> = ({ hand, cardRegistry, onCardClick }) => {
  return (
    <div style={{ border: '2px solid green', padding: '10px', marginBottom: '20px' }}>
      <h3>Your Hand ({hand.length})</h3>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: '10px' }}>
        {hand.map((card) => (
          <CardTooltip
            key={card.instanceId}
            cardId={card.cardId}
            cardName={cardRegistry[card.cardId]?.name || card.cardId}
            cardDef={cardRegistry[card.cardId]}
          >
            <button
              onClick={() => onCardClick(card)}
              style={{
                padding: '10px',
                border: '1px solid gray',
                cursor: 'pointer',
                background: '#f9f9f9',
              }}
            >
              {cardRegistry[card.cardId]?.name || card.cardId}
              <br />
              <small>{cardRegistry[card.cardId]?.type}</small>
            </button>
          </CardTooltip>
        ))}
      </div>
    </div>
  );
};
