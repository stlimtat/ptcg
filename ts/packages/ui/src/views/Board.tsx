import React from 'react';
import { GameState, CardInstance } from '@pokemon-tcg/engine';
import { CardRegistry } from '../types';

interface BoardProps {
  state: GameState;
  cardRegistry: CardRegistry;
}

export const Board: React.FC<BoardProps> = ({ state, cardRegistry }) => {
  const renderPokemon = (poke: any) => (
    <div style={{ border: '1px solid black', padding: '10px', marginRight: '10px' }}>
      <div>{cardRegistry[poke.card.cardId]?.name || poke.card.cardId}</div>
      <div>HP: {poke.damage}</div>
      <div>Energy: {poke.attachedEnergy.length}</div>
    </div>
  );

  return (
    <div style={{ border: '2px solid blue', padding: '10px', marginBottom: '20px' }}>
      <h2>Game Board</h2>
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <div>
          <h3>P2 (Opponent)</h3>
          <div style={{ display: 'flex' }}>
            {state.players.p2.active && renderPokemon(state.players.p2.active)}
          </div>
          <div>Bench: {state.players.p2.bench.map((p) => renderPokemon(p))}</div>
          <div style={{ background: '#f0f0f0', padding: '5px', marginTop: '10px' }}>
            <strong>Prizes ({state.players.p2.prizes.length}):</strong>
            <div style={{ fontSize: '0.8em', color: '#666' }}>
              {state.players.p2.prizes.map((p, i) => (
                <div key={i}>{cardRegistry[p.cardId]?.name || p.cardId}</div>
              ))}
            </div>
          </div>
        </div>
        <div>
          <h3>P1 (You)</h3>
          <div style={{ display: 'flex' }}>
            {state.players.p1.active && renderPokemon(state.players.p1.active)}
          </div>
          <div>Bench: {state.players.p1.bench.map((p) => renderPokemon(p))}</div>
          <div style={{ background: '#f0f0f0', padding: '5px', marginTop: '10px' }}>
            <strong>Prizes ({state.players.p1.prizes.length}):</strong>
            <div style={{ fontSize: '0.8em', color: '#666' }}>
              {state.players.p1.prizes.map((p, i) => (
                <div key={i}>{cardRegistry[p.cardId]?.name || p.cardId}</div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
