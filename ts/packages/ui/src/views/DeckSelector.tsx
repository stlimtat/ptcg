import React from 'react';

interface DeckSelectorProps {
  availableDecks: string[];
  p1Selected: string;
  p2Selected: string;
  onP1Change: (deckName: string) => void;
  onP2Change: (deckName: string) => void;
  onStart: () => void;
}

export function DeckSelector({
  availableDecks,
  p1Selected,
  p2Selected,
  onP1Change,
  onP2Change,
  onStart,
}: DeckSelectorProps) {
  const canStart = p1Selected && p2Selected;

  return (
    <div style={{
      maxWidth: '1200px',
      margin: '0 auto',
      padding: '20px',
      fontFamily: 'Arial, sans-serif',
    }}>
      <h1>Pokémon TCG Simulator</h1>
      <p>Select decks for both players to start simulation:</p>

      <div style={{ display: 'flex', gap: '40px', marginBottom: '20px' }}>
        <div>
          <label>
            <strong>Player 1 Deck:</strong>
          </label>
          <select
            value={p1Selected}
            onChange={(e) => onP1Change(e.target.value)}
            style={{ display: 'block', marginTop: '10px', padding: '8px' }}
          >
            <option value="">-- Select Deck --</option>
            {availableDecks.map((deck) => (
              <option key={deck} value={deck}>
                {deck}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label>
            <strong>Player 2 Deck:</strong>
          </label>
          <select
            value={p2Selected}
            onChange={(e) => onP2Change(e.target.value)}
            style={{ display: 'block', marginTop: '10px', padding: '8px' }}
          >
            <option value="">-- Select Deck --</option>
            {availableDecks.map((deck) => (
              <option key={deck} value={deck}>
                {deck}
              </option>
            ))}
          </select>
        </div>
      </div>

      <button
        onClick={onStart}
        disabled={!canStart}
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          cursor: canStart ? 'pointer' : 'not-allowed',
          opacity: canStart ? 1 : 0.5,
        }}
      >
        Start Simulation
      </button>
    </div>
  );
}
