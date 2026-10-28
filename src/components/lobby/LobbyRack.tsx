'use client';

import React, { useState, useMemo } from 'react';
import { GameMetadata } from '@/types/game';
import { FLPanel } from '@/components/common/FLPanel';
import { FLButton } from '@/components/common/FLButton';
import { FLLcd } from '@/components/common/FLLcd';

interface LobbyRackProps {
  games: GameMetadata[];
  onSelectGame: (id: string) => void;
}

export const LobbyRack: React.FC<LobbyRackProps> = ({ games, onSelectGame }) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('ALL');

  const categories = ['ALL', 'Q-TABLE', 'NEURAL NET', 'MULTI-AGENT'];

  const filteredGames = useMemo(() => {
    return games.filter((game) => {
      const matchSearch =
        game.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        game.tagline.toLowerCase().includes(searchQuery.toLowerCase()) ||
        game.tags.some((t) => t.toLowerCase().includes(searchQuery.toLowerCase())) ||
        game.algorithm.toLowerCase().includes(searchQuery.toLowerCase());

      if (!matchSearch) return false;

      if (selectedCategory === 'Q-TABLE') return game.algorithm === 'Q-Table';
      if (selectedCategory === 'NEURAL NET') return game.algorithm.includes('MLP') || game.algorithm.includes('Neural');
      if (selectedCategory === 'MULTI-AGENT') return game.agentsCount > 1;

      return true;
    });
  }, [games, searchQuery, selectedCategory]);

  return (
    <div className="fl-wrap">
      {/* Lobby Master Rack Header */}
      <header className="fl-bar">
        <div className="fl-brand">
          <svg width="30" height="30" viewBox="0 0 28 28" aria-hidden="true">
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
            <small>Arcade Rack · Pilih atau Cari Game RL untuk Dilatih</small>
          </div>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          <div className="fl-lcds two">
            <FLLcd label="Total Game" value={games.length} className="w-24" />
            <FLLcd label="Status Rack" value="READY" variant="green" className="w-24" />
          </div>
        </div>
      </header>

      {/* Rack Controls: Search & Category Filter */}
      <section className="fl-panel mb-3">
        <div className="fl-panel-head">
          <span>Browser Rack & Filter</span>
          <span className="tag">
            Ditemukan: <b>{filteredGames.length} game</b>
          </span>
        </div>
        <div className="fl-pb">
          <div className="flex flex-col sm:flex-row gap-3 items-stretch sm:items-center">
            {/* Search Input */}
            <div className="relative flex-1">
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Cari game (contoh: Tetris, Snake, Q-Table, Neural, dsb)..."
                className="fl-input pl-8"
              />
              <svg
                className="absolute left-2.5 top-2.5 w-3.5 h-3.5 text-[var(--mut)]"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
                />
              </svg>
              {searchQuery && (
                <button
                  type="button"
                  onClick={() => setSearchQuery('')}
                  className="absolute right-2 top-2 text-[var(--mut)] hover:text-white text-xs px-1"
                >
                  ✕
                </button>
              )}
            </div>

            {/* Filter buttons */}
            <div className="flex gap-1 overflow-x-auto pb-1 sm:pb-0">
              {categories.map((cat) => (
                <button
                  key={cat}
                  type="button"
                  onClick={() => setSelectedCategory(cat)}
                  className={`fl-btn text-[11px] ${selectedCategory === cat ? 'on' : ''}`}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Game Modules Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {filteredGames.map((game) => (
          <div
            key={game.id}
            className="fl-panel flex flex-col justify-between hover:border-[var(--ac)] transition-all duration-150 group"
          >
            <div>
              {/* Module Header Strip */}
              <div className="flex items-center gap-2 h-7 px-3 bg-gradient-to-b from-[#2e353d] to-[#21262c] border-b border-[var(--bd)] rounded-t-[3px]">
                <span
                  className="w-2 h-2 rounded-[2px]"
                  style={{
                    backgroundColor: game.accentColor || '#ff9b21',
                    boxShadow: `0 0 6px ${game.accentColor || '#ff9b21'}`,
                  }}
                />
                <span className="font-bold text-[11px] tracking-[0.14em] uppercase text-[#d2d9e0]">
                  {game.name}
                </span>
                <span className="ml-auto text-[9.5px] font-semibold text-[var(--mut)] bg-[#171a1e] px-1.5 py-0.5 rounded border border-[var(--bd)]">
                  {game.badge}
                </span>
              </div>

              {/* Module Body */}
              <div className="p-3">
                <p className="text-[12px] text-[var(--tx)] font-semibold mb-1">
                  {game.tagline}
                </p>
                <p className="text-[11px] text-[var(--mut)] line-clamp-3 mb-3 leading-relaxed">
                  {game.description}
                </p>

                {/* Specs LCDs */}
                <div className="grid grid-cols-2 gap-1.5 mb-3">
                  <div className="p-1.5 bg-[var(--field)] border border-[#06080a] rounded shadow-[inset_0_1px_4px_rgba(0,0,0,0.7)]">
                    <span className="block text-[8.5px] font-bold text-[var(--mut)] uppercase tracking-wider">
                      Arsitektur RL
                    </span>
                    <span className="block text-[11px] font-bold text-[var(--ac2)] truncate mt-0.5">
                      {game.algorithm}
                    </span>
                  </div>

                  <div className="p-1.5 bg-[var(--field)] border border-[#06080a] rounded shadow-[inset_0_1px_4px_rgba(0,0,0,0.7)]">
                    <span className="block text-[8.5px] font-bold text-[var(--mut)] uppercase tracking-wider">
                      Agen Paralel
                    </span>
                    <span className="block text-[11px] font-bold text-[var(--led)] truncate mt-0.5">
                      {game.agentsCount} Agen Bersama
                    </span>
                  </div>

                  <div className="p-1.5 bg-[var(--field)] border border-[#06080a] rounded shadow-[inset_0_1px_4px_rgba(0,0,0,0.7)]">
                    <span className="block text-[8.5px] font-bold text-[var(--mut)] uppercase tracking-wider">
                      State Space
                    </span>
                    <span className="block text-[11px] font-bold text-[var(--tx)] truncate mt-0.5">
                      {game.stateSpace}
                    </span>
                  </div>

                  <div className="p-1.5 bg-[var(--field)] border border-[#06080a] rounded shadow-[inset_0_1px_4px_rgba(0,0,0,0.7)]">
                    <span className="block text-[8.5px] font-bold text-[var(--mut)] uppercase tracking-wider">
                      Action Space
                    </span>
                    <span className="block text-[11px] font-bold text-[var(--tx)] truncate mt-0.5">
                      {game.actionSpace}
                    </span>
                  </div>
                </div>

                {/* Tags */}
                <div className="flex flex-wrap gap-1 mb-2">
                  {game.tags.map((tag) => (
                    <span
                      key={tag}
                      className="text-[9px] px-1.5 py-0.5 rounded bg-[var(--p3)] text-[var(--mut)] border border-[var(--bd)] font-mono"
                    >
                      #{tag}
                    </span>
                  ))}
                </div>
              </div>
            </div>

            {/* Launch Button Strip */}
            <div className="p-3 pt-0">
              <button
                type="button"
                onClick={() => onSelectGame(game.id)}
                className="w-full h-8 fl-btn on flex items-center justify-center gap-2 uppercase tracking-[0.1em] text-[11px] font-bold"
              >
                <span className="w-2 h-2 rounded-full bg-black/60 shadow-[0_0_6px_#fff]" />
                Launch / Latih Game
                <span className="font-mono text-xs">→</span>
              </button>
            </div>
          </div>
        ))}
      </div>

      {filteredGames.length === 0 && (
        <div className="fl-panel p-8 text-center text-[var(--mut)]">
          <p className="text-sm font-semibold text-[var(--tx)] mb-1">
            Tidak ada game yang cocok dengan pencarian &quot;{searchQuery}&quot;
          </p>
          <p className="text-xs mb-4">Coba ganti kata kunci atau pilih kategori ALL.</p>
          <FLButton onClick={() => { setSearchQuery(''); setSelectedCategory('ALL'); }}>
            Reset Pencarian
          </FLButton>
        </div>
      )}

      {/* Developer Extension Guide Panel */}
      <section className="fl-panel mt-4">
        <div className="fl-panel-head green">
          <span>Panduan Modifikasi & Tambah Game Baru</span>
          <span className="tag">Extensible Architecture</span>
        </div>
        <div className="fl-pb text-[12px] text-[var(--mut)] leading-relaxed space-y-2">
          <p>
            Project ini dirancang sangat modular agar Anda bisa membuat banyak game reinforcement learning
            baru dengan cepat. Untuk menambahkan game baru:
          </p>
          <ol className="list-decimal list-inside space-y-1 font-mono text-[11px] text-[var(--tx)] bg-[var(--field)] p-3 rounded border border-[var(--bd)]">
            <li>
              Buat folder baru di <code className="text-[var(--ac)]">src/games/&lt;nama-game&gt;/</code>
            </li>
            <li>
              Buat komponen React dengan UI FL Studio (gunakan <code className="text-[var(--ac2)]">FLPanel</code>, <code className="text-[var(--ac2)]">FLLcd</code>, <code className="text-[var(--ac2)]">FLButton</code>, <code className="text-[var(--ac2)]">LearningChart</code>).
            </li>
            <li>
              Daftarkan game Anda di <code className="text-[var(--ac)]">src/games/registry.ts</code> pada array <code className="text-[var(--ac2)]">GAME_REGISTRY</code>.
            </li>
          </ol>
          <p>
            Game baru otomatis akan langsung muncul di search bar, filter kategori, tab navigasi, dan siap dimainkan!
          </p>
        </div>
      </section>
    </div>
  );
};
