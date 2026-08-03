import React, { useState } from 'react';

interface CardTooltipProps {
  cardId: string;
  cardName: string;
  cardDef?: any;
  children: React.ReactNode;
}

export const CardTooltip: React.FC<CardTooltipProps> = ({
  cardId,
  cardName,
  cardDef,
  children,
}) => {
  const [showTooltip, setShowTooltip] = useState(false);

  if (!cardDef) {
    return <>{children}</>;
  }

  const getCardDetails = () => {
    if (cardDef.type === 'pokemon') {
      return `
        HP: ${cardDef.hp}
        Type: ${cardDef.types?.join(', ') || 'N/A'}
        Retreat Cost: ${cardDef.retreatCost || 0}
        Attacks: ${cardDef.attacks?.length || 0}
      `;
    } else if (cardDef.type === 'trainer') {
      return `
        Subtype: ${cardDef.subtype}
      `;
    } else if (cardDef.type === 'energy') {
      return `
        Provides: ${cardDef.providesType}
      `;
    }
    return '';
  };

  return (
    <div
      style={{ position: 'relative', display: 'inline-block' }}
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      {showTooltip && (
        <div
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '50%',
            transform: 'translateX(-50%)',
            background: '#333',
            color: '#fff',
            padding: '8px',
            borderRadius: '4px',
            fontSize: '12px',
            whiteSpace: 'nowrap',
            zIndex: 1000,
            marginBottom: '5px',
          }}
        >
          <div style={{ fontWeight: 'bold' }}>{cardName}</div>
          <div style={{ fontSize: '11px', marginTop: '4px' }}>
            {getCardDetails()}
          </div>
        </div>
      )}
    </div>
  );
};
