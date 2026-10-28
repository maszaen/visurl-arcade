import { GameDefinition } from '@/types/game';
import { TetrisGame } from './tetris/TetrisGame';
import { SnakeGame } from './snake/SnakeGame';
import { GridWorldGame } from './gridworld/GridWorldGame';

/**
 * Q-Learning Games Central Registry
 *
 * To add a new game:
 * 1. Create your game folder in `src/games/<your-game-name>/`
 * 2. Implement your game component with FL Studio styles
 * 3. Add an entry to this `GAME_REGISTRY` array below.
 */
export const GAME_REGISTRY: GameDefinition[] = [
  {
    id: 'tetris',
    name: 'Tetris AI',
    tagline: 'Q-Learning TD dengan 4 Agen dan 1 Otak Neural Network (MLP)',
    description:
      'Empat papan bermain paralel melatih 1 otak bersama berbasis Multi-Layer Perceptron (10 input geometris, 24 neuron tersembunyi). Reward dari baris yang dihapus dan penalti saat game over.',
    detailedDescription:
      'Menggunakan temporal difference Q-learning dengan 10 fitur state (lubang, bumpiness, aggregate height, sumur, transisi baris & kolom). Dilengkapi mode Real dengan lookahead 2-langkah, animasi jatuh, putar, dan efek partikel ledakan.',
    algorithm: 'Deep Q-Learning (MLP)',
    agentsCount: 4,
    tags: ['Neural Net', 'Lookahead', 'Tetris', 'Multi-Agent', 'High Performance'],
    stateSpace: '10 Fitur Geometris',
    actionSpace: 'Rotasi + Kolom Drop',
    rewardScheme: 'Lines Cleared: +1, +3, +6, +10 / Game Over: -10',
    badge: 'Neural Q-Net',
    accentColor: '#ff9b21',
    secondaryColor: '#ffd08a',
    iconType: 'tetris',
    isReady: true,
    version: '1.2.0',
    component: TetrisGame,
  },
  {
    id: 'snake',
    name: 'Snake Xenzia AI',
    tagline: 'Snake Klasik Nokia dilatih dengan Tabel Q dan Deteksi Jebakan Flood-Fill',
    description:
      'Empat ular belajar bersama mengisi 1 tabel Q (144 state). Sensor mendeteksi bahaya di depan/kiri/kanan (tembok, badan sendiri, lubang jebakan buntu), arah apel, dan panjang tubuh.',
    detailedDescription:
      'Menggabungkan tabular Q-learning dengan algoritma BFS reachability (flood-fill) untuk mendeteksi jebakan buntu sebelum melangkah. Memiliki mode Real dengan visualisasi partikel saat memakan apel.',
    algorithm: 'Q-Table',
    agentsCount: 4,
    tags: ['Q-Table', 'Flood-Fill', 'Snake', 'Multi-Agent', 'Classic Nokia'],
    stateSpace: '144 Diskrit State',
    actionSpace: '3 Arah (Lurus, Belok Kanan, Belok Kiri)',
    rewardScheme: 'Makan Apel: +10 / Tabrakan: -10 / Jarak Apel: ±0.1',
    badge: 'Q-Table 144S',
    accentColor: '#4ade80',
    secondaryColor: '#f87171',
    iconType: 'snake',
    isReady: true,
    version: '1.1.0',
    component: SnakeGame,
  },
  {
    id: 'gridworld',
    name: 'GridWorld Maze AI',
    tagline: 'Frozen Lake RL dengan Visualisasi Panah Kebijakan (Policy Vector)',
    description:
      'Lab navigasi grid 8x8 licin (stochastic transitions). Agen belajar rute tercepat menuju target hijau sembari menghindari kolam lava merah dan rintangan dinding.',
    detailedDescription:
      'Menampilkan vektor kebijakan (policy arrow) yang dipelajari pada setiap ubin secara langsung di atas canvas, memudahkan analisis konvergensi Q-learning.',
    algorithm: 'Q-Table',
    agentsCount: 2,
    tags: ['GridWorld', 'Policy Vector', 'Frozen Lake', 'Beginner Friendly'],
    stateSpace: '64 Tile State',
    actionSpace: '4 Arah (Atas, Kanan, Bawah, Kiri)',
    rewardScheme: 'Goal: +20 / Trap: -10 / Step: -0.1',
    badge: 'Policy Visualizer',
    accentColor: '#22d3ee',
    secondaryColor: '#9be34a',
    iconType: 'grid',
    isReady: true,
    version: '1.0.0',
    component: GridWorldGame,
  },
];

export function getGameById(id: string): GameDefinition | undefined {
  return GAME_REGISTRY.find((g) => g.id === id);
}
