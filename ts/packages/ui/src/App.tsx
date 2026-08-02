import React, { useReducer, useEffect, useRef, useState } from 'react';
import { GameState, Action, applyAction, legalActions, createInitialState, CardInstance } from '@pokemon-tcg/engine';
import { Board } from './views/Board';
import { Hand } from './views/Hand';
import { ActionBar } from './views/ActionBar';
import { Log } from './views/Log';
import { loadCardRegistry, loadDeck, initializeData } from './utils/cardLoader';
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

export default function App() {
  const [cardRegistry, setCardRegistry] = useState<any>({});
  const [p1Deck, setP1Deck] = useState<string[]>([]);
  const [p2Deck, setP2Deck] = useState<string[]>([]);
  const [loaded, setLoaded] = useState(false);

  const [state, setGameState] = useState<GameState>(createInitialState([], []));

  const dispatch = (action: Action) => {
    try {
      setGameState(applyAction(state, action));
    } catch (e) {
      console.error('Action failed:', e);
    }
  };

  useEffect(() => {
    const loadData = async () => {
      try {
        const cardsRes = await fetch('/cards.json');
        const cardsData = await cardsRes.json();
        const registry: any = {};
        const cardsList = Array.isArray(cardsData) ? cardsData : (cardsData.cards || []);
        for (const card of cardsList) {
          registry[card.id] = card;
        }
        setCardRegistry(registry);

        const dragRes = await fetch('/decks/dragapult-ex.json');
        const dragDeck = await dragRes.json();
        setP1Deck(dragDeck.cards || []);

        const zoroRes = await fetch('/decks/zoroark-ex.json');
        const zoroDeck = await zoroRes.json();
        setP2Deck(zoroDeck.cards || []);
        setLoaded(true);
      } catch (e) {
        console.error('Failed to load data:', e);
        setLoaded(true);
      }
    };
    loadData();
  }, []);

  // Update game state when decks are loaded
  useEffect(() => {
    if (p1Deck.length > 0 && p2Deck.length > 0) {
      setGameState(createInitialState(p1Deck, p2Deck));
    }
  }, [p1Deck, p2Deck]);

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

  if (!loaded) {
    return (
      <div style={{ maxWidth: '1200px', margin: '0 auto', fontFamily: 'Arial, sans-serif' }}>
        <h1>Pokémon TCG</h1>
        <p>Loading game data...</p>
      </div>
    );
  }

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
