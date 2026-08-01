import React, { useReducer, useEffect, useRef } from 'react';
import { GameState, Action, applyAction, legalActions, createInitialState, CardInstance } from '@pokemon-tcg/engine';
import { Board } from './views/Board';
import { Hand } from './views/Hand';
import { ActionBar } from './views/ActionBar';
import { Log } from './views/Log';
import { loadCardRegistry, loadDeck } from './utils/cardLoader';
import { getBotAction } from './controllers/botController';

// ponytail: polyfill randomUUID for browser
if (typeof (globalThis as any).crypto === 'undefined') {
  (globalThis as any).crypto = {
    getRandomValues: (arr: Uint8Array) => {
      for (let i = 0; i < arr.length; i++) {
        arr[i] = Math.floor(Math.random() * 256);
      }
      return arr;
    }
  };
}

const cardRegistry = loadCardRegistry();

// Load real Standard-format decks
const P1_DECK = loadDeck('dragapult-ex');
const P2_DECK = loadDeck('zoroark-ex');

export default function App() {
  const [state, dispatch] = useReducer(
    (s: GameState, action: Action) => {
      try {
        return applyAction(s, action);
      } catch (e) {
        console.error('Action failed:', e);
        return s;
      }
    },
    createInitialState(P1_DECK, P2_DECK)
  );

  const botTimeoutRef = useRef<NodeJS.Timeout>();

  // Bot loop: when p2 turn, auto-play random legal action
  useEffect(() => {
    if (state.activePlayer === 'p2' && state.phase !== 'gameOver') {
      botTimeoutRef.current = setTimeout(() => {
        const action = getBotAction(state);
        if (action) {
          dispatch(action);
        }
      }, 500);
    }

    return () => {
      if (botTimeoutRef.current) clearTimeout(botTimeoutRef.current);
    };
  }, [state.activePlayer, state.phase, state.turn]);

  const handleAction = (action: Action) => {
    // Override player to ensure it's p1
    const p1Action = { ...action, player: 'p1' } as Action;
    dispatch(p1Action);
  };

  const legal = legalActions(state, 'p1');

  return (
    <div style={{ maxWidth: '1200px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
      <h1>Pokémon TCG</h1>
      <div>
        <strong>Turn: {state.turn}</strong> |
        <strong> Phase: {state.phase}</strong> |
        <strong> Active: {state.activePlayer === 'p1' ? 'YOU' : 'OPPONENT'}</strong>
        {state.winner && <strong style={{ color: 'red' }}> GAME OVER - {state.winner.toUpperCase()} WINS!</strong>}
      </div>

      <Board state={state} cardRegistry={cardRegistry} />

      {state.activePlayer === 'p1' && state.phase !== 'gameOver' && (
        <>
          <Hand
            hand={state.players.p1.hand}
            cardRegistry={cardRegistry}
            onCardClick={() => {}}
          />
          <ActionBar actions={legal} onAction={handleAction} />
        </>
      )}

      {state.activePlayer === 'p2' && state.phase !== 'gameOver' && (
        <div style={{ padding: '10px', background: '#ffebee', border: '1px solid red' }}>
          <p>Opponent is thinking...</p>
        </div>
      )}

      <Log logs={state.log} />
    </div>
  );
}
