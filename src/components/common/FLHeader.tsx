import React from 'react';
import { GameMetadata } from '@/types/game';

interface FLHeaderProps {
  games: GameMetadata[];
  activeGameId: string | null;
  onSelectGame: (id: string | null) => void;
}

export const FLHeader: React.FC<FLHeaderProps> = ({
  games,
  activeGameId,
  onSelectGame,
}) => {
  return (
    <header className="fl-bar">
      <div
        className="fl-brand cursor-pointer select-none"
        onClick={() => onSelectGame(null)}
        title="Kembali ke Arcade Lobby"
      >
        <svg width="28" height="28" viewBox="0 0 28 28" aria-hidden="true">
          <g fill="#ff9b21">
            <rect x="2" y="3" width="7" height="7" rx="1.5" />
            <rect x="10.5" y="3" width="7" height="7" rx="1.5" />
            <rect x="19" y="3" width="7" height="7" rx="1.5" />
            <rect x="10.5" y="11.5" width="7" height="7" rx="1.5" fill="#ffd08a" />
          </g>
          <circle cx="5.5" cy="15" r="3" fill="#e5484d" />
          <rect x="2" y="22" width="24" height="3" rx="1.5" fill="#4a525c" />
        </svg>
        <div>
          <h1>
            Q-LEARNING <em>GAMES</em>
          </h1>
          <small>VisuRL Arcade · Modular RL Environment Lab</small>
        </div>
      </div>

      <nav className="fl-tabs flex items-center gap-1 overflow-x-auto max-w-full py-1">
        <button
          type="button"
          onClick={() => onSelectGame(null)}
          className={`fl-btn ${activeGameId === null ? 'on' : ''}`}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
          Lobby Rack
        </button>

        {games.map((g) => (
          <button
            key={g.id}
            type="button"
            onClick={() => onSelectGame(g.id)}
            className={`fl-btn ${activeGameId === g.id ? 'on' : ''}`}
          >
            <span
              className="w-1.5 h-1.5 rounded-full"
              style={{ backgroundColor: g.accentColor || '#ff9b21' }}
            />
            {g.name}
          </button>
        ))}
      </nav>
    </header>
  );
};
