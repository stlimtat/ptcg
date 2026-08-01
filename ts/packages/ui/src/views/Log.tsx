import React, { useEffect, useRef } from 'react';
import { LogEntry } from '@pokemon-tcg/engine';

interface LogProps {
  logs: LogEntry[];
}

export const Log: React.FC<LogProps> = ({ logs }) => {
  const endRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [logs]);

  return (
    <div style={{ border: '2px solid purple', padding: '10px', maxHeight: '200px', overflowY: 'auto' }}>
      <h3>Game Log</h3>
      {logs.map((log, i) => (
        <div key={i} style={{ fontSize: '12px', marginBottom: '5px' }}>
          <strong>[P{log.player === 'p1' ? '1' : '2'}]</strong> {log.message}
        </div>
      ))}
      <div ref={endRef} />
    </div>
  );
};
