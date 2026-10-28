'use client';

import React, { useState, useEffect } from 'react';
import { GAME_REGISTRY, getGameById } from '@/games/registry';
import { FLHeader } from '@/components/common/FLHeader';
import { LobbyRack } from '@/components/lobby/LobbyRack';

export default function Home() {
  const [activeGameId, setActiveGameId] = useState<string | null>(null);

  // Sync with URL hash if present (e.g. #tetris, #snake, #gridworld)
  useEffect(() => {
    const hash = window.location.hash.replace('#', '');
    if (hash && getGameById(hash)) {
      setActiveGameId(hash);
    }

    const handleHashChange = () => {
      const h = window.location.hash.replace('#', '');
      if (h && getGameById(h)) {
        setActiveGameId(h);
      } else if (!h) {
        setActiveGameId(null);
      }
    };

    window.addEventListener('hashchange', handleHashChange);
    return () => window.removeEventListener('hashchange', handleHashChange);
  }, []);

  const handleSelectGame = (id: string | null) => {
    setActiveGameId(id);
    if (id) {
      window.location.hash = id;
    } else {
      history.pushState('', document.title, window.location.pathname + window.location.search);
    }
  };

  const activeGame = activeGameId ? getGameById(activeGameId) : null;
  const ActiveGameComponent = activeGame?.component;

  return (
    <main className="min-h-screen py-2 px-1 sm:px-2 md:px-4">
      {/* Master Top Bar */}
      <FLHeader
        games={GAME_REGISTRY}
        activeGameId={activeGameId}
        onSelectGame={handleSelectGame}
      />

      {/* Main View: Either Lobby Rack or Active Game */}
      {ActiveGameComponent ? (
        <ActiveGameComponent onBackToLobby={() => handleSelectGame(null)} />
      ) : (
        <LobbyRack
          games={GAME_REGISTRY}
          onSelectGame={handleSelectGame}
        />
      )}
    </main>
  );
}
