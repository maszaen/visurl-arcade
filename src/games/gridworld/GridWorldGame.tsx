'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FLPanel } from '@/components/common/FLPanel';
import { FLLcd } from '@/components/common/FLLcd';
import { FLButton } from '@/components/common/FLButton';
import { FLSegmented } from '@/components/common/FLSegmented';
import { LearningChart } from '@/components/common/LearningChart';

const GRID_SIZE = 8;
const NUM_TILES = GRID_SIZE * GRID_SIZE;
const KEY = 'gridworld_q_v1';
const GAMMA = 0.95;

// Tile types: 0 = Empty, 1 = Wall, 2 = Trap/Lava, 3 = Goal, 4 = Start
const DEFAULT_MAP = [
  4, 0, 0, 0, 1, 0, 0, 0,
  0, 1, 1, 0, 1, 0, 2, 0,
  0, 0, 0, 0, 0, 0, 1, 0,
  1, 1, 0, 2, 1, 0, 0, 0,
  0, 0, 0, 1, 1, 1, 1, 0,
  0, 2, 0, 0, 0, 2, 0, 0,
  0, 1, 1, 1, 0, 1, 1, 0,
  0, 0, 0, 2, 0, 0, 0, 3,
];

const ACTIONS = [
  { dx: 0, dy: -1, name: 'UP', arrow: '↑' },
  { dx: 1, dy: 0, name: 'RIGHT', arrow: '→' },
  { dx: 0, dy: 1, name: 'DOWN', arrow: '↓' },
  { dx: -1, dy: 0, name: 'LEFT', arrow: '←' },
];

interface Agent {
  x: number;
  y: number;
  steps: number;
  totalReward: number;
  isDone: boolean;
  wins: number;
}

export const GridWorldGame: React.FC<{ onBackToLobby?: () => void }> = () => {
  const [speed, setSpeed] = useState<number>(1);
  const [greedy, setGreedy] = useState<boolean>(false);
  const [showPolicy, setShowPolicy] = useState<boolean>(true);

  const [episodes, setEpisodes] = useState<number>(0);
  const [totalWins, setTotalWins] = useState<number>(0);
  const [bestSteps, setBestSteps] = useState<number>(0);
  const [epsilonVal, setEpsilonVal] = useState<string>('1.00');
  const [alphaVal, setAlphaVal] = useState<string>('0.200');
  const [avgSteps, setAvgSteps] = useState<string>('0');
  const [seriesData, setSeriesData] = useState<number[]>([]);

  const mainCanvasRef = useRef<HTMLCanvasElement | null>(null);

  const engineRef = useRef<{
    Q: Float32Array; // NUM_TILES * 4 actions
    eps: number;
    ep: number;
    wins: number;
    bestSteps: number;
    recentSteps: number[];
    series: number[];
    agents: Agent[];
    dirty: boolean;
    acc: number;
  }>({
    Q: new Float32Array(NUM_TILES * 4),
    eps: 1,
    ep: 0,
    wins: 0,
    bestSteps: 999,
    recentSteps: [],
    series: [],
    agents: [],
    dirty: false,
    acc: 0,
  });

  const speedRef = useRef(speed);
  speedRef.current = speed;
  const greedyRef = useRef(greedy);
  greedyRef.current = greedy;
  const showPolicyRef = useRef(showPolicy);
  showPolicyRef.current = showPolicy;

  const resetAgent = (ag: Agent) => {
    ag.x = 0;
    ag.y = 0;
    ag.steps = 0;
    ag.totalReward = 0;
    ag.isDone = false;
  };

  const getAlpha = (ep: number) => Math.max(0.02, 0.2 - (0.18 * ep) / 2000);

  const qMax = (state: number) => {
    const o = state * 4;
    const { Q } = engineRef.current;
    return Math.max(Q[o], Q[o + 1], Q[o + 2], Q[o + 3]);
  };

  const chooseAction = (state: number, explore: boolean) => {
    const { Q, eps } = engineRef.current;
    if (explore && Math.random() < eps) {
      return Math.floor(Math.random() * 4);
    }
    const o = state * 4;
    let bestA = 0;
    let maxV = -1e9;
    for (let a = 0; a < 4; a++) {
      const v = Q[o + a] + Math.random() * 1e-6;
      if (v > maxV) {
        maxV = v;
        bestA = a;
      }
    }
    return bestA;
  };

  const stepAgent = (ag: Agent) => {
    if (ag.isDone) {
      resetAgent(ag);
      return;
    }

    const eng = engineRef.current;
    const curIdx = ag.y * GRID_SIZE + ag.x;
    const action = chooseAction(curIdx, !greedyRef.current);
    const act = ACTIONS[action];

    // Slippery condition (10% chance to deviate)
    let actualAct = act;
    if (Math.random() < 0.1) {
      actualAct = ACTIONS[Math.floor(Math.random() * 4)];
    }

    let nx = ag.x + actualAct.dx;
    let ny = ag.y + actualAct.dy;

    // Boundary check
    if (nx < 0 || nx >= GRID_SIZE || ny < 0 || ny >= GRID_SIZE) {
      nx = ag.x;
      ny = ag.y;
    }

    const nextIdx = ny * GRID_SIZE + nx;
    const tileType = DEFAULT_MAP[nextIdx];

    // Wall collision
    if (tileType === 1) {
      nx = ag.x;
      ny = ag.y;
    }

    ag.x = nx;
    ag.y = ny;
    ag.steps++;

    const newIdx = ny * GRID_SIZE + nx;
    const newTile = DEFAULT_MAP[newIdx];

    let reward = -0.1; // Step penalty
    let terminal = false;

    if (newTile === 3) {
      // Goal
      reward = 20;
      terminal = true;
      ag.wins++;
      eng.wins++;
      if (ag.steps < eng.bestSteps) eng.bestSteps = ag.steps;
    } else if (newTile === 2) {
      // Lava trap
      reward = -10;
      terminal = true;
    } else if (ag.steps > 120) {
      // Max steps exceeded
      reward = -5;
      terminal = true;
    }

    ag.totalReward += reward;

    // Q-Learning TD Update
    if (!greedyRef.current) {
      const o = curIdx * 4 + action;
      const target = terminal ? reward : reward + GAMMA * qMax(newIdx);
      const alpha = getAlpha(eng.ep);
      eng.Q[o] += alpha * (target - eng.Q[o]);
      eng.dirty = true;
    }

    if (terminal) {
      ag.isDone = true;
      eng.ep++;
      eng.recentSteps.push(ag.steps);
      if (eng.recentSteps.length > 50) eng.recentSteps.shift();
      eng.series.push(ag.steps);
      if (!greedyRef.current) {
        eng.eps = Math.max(0.02, eng.eps * 0.996);
      }
    }
  };

  useEffect(() => {
    const eng = engineRef.current;
    eng.agents = [
      { x: 0, y: 0, steps: 0, totalReward: 0, isDone: false, wins: 0 },
      { x: 0, y: 0, steps: 0, totalReward: 0, isDone: false, wins: 0 },
    ];
  }, []);

  // Main Loop
  useEffect(() => {
    let animId: number;
    let tickC = 0;

    const loop = () => {
      const eng = engineRef.current;
      eng.acc += speedRef.current;

      while (eng.acc >= 1) {
        for (const ag of eng.agents) {
          stepAgent(ag);
        }
        eng.acc--;
      }

      // Draw Grid
      const cv = mainCanvasRef.current;
      if (cv) {
        const c = cv.getContext('2d');
        if (c) {
          const w = 480;
          const h = 480;
          cv.width = w;
          cv.height = h;
          c.clearRect(0, 0, w, h);

          const tileSize = w / GRID_SIZE;

          for (let y = 0; y < GRID_SIZE; y++) {
            for (let x = 0; x < GRID_SIZE; x++) {
              const idx = y * GRID_SIZE + x;
              const type = DEFAULT_MAP[idx];
              const px = x * tileSize;
              const py = y * tileSize;

              // Tile base
              if (type === 1) {
                // Wall
                c.fillStyle = '#2a3037';
                c.fillRect(px, py, tileSize, tileSize);
                c.fillStyle = '#171a1e';
                c.fillRect(px + 4, py + 4, tileSize - 8, tileSize - 8);
              } else if (type === 2) {
                // Lava
                c.fillStyle = '#4a1518';
                c.fillRect(px, py, tileSize, tileSize);
                c.fillStyle = '#e5484d';
                c.beginPath();
                c.arc(px + tileSize / 2, py + tileSize / 2, tileSize * 0.28, 0, Math.PI * 2);
                c.fill();
              } else if (type === 3) {
                // Goal
                c.fillStyle = '#1b3820';
                c.fillRect(px, py, tileSize, tileSize);
                c.fillStyle = '#9be34a';
                c.beginPath();
                c.arc(px + tileSize / 2, py + tileSize / 2, tileSize * 0.32, 0, Math.PI * 2);
                c.fill();
              } else {
                // Empty tile
                c.fillStyle = '#12161b';
                c.fillRect(px, py, tileSize, tileSize);
              }

              // Subtle borders
              c.strokeStyle = 'rgba(255,255,255,0.06)';
              c.lineWidth = 1;
              c.strokeRect(px + 0.5, py + 0.5, tileSize - 1, tileSize - 1);

              // Policy directional indicator
              if (showPolicyRef.current && type === 0) {
                const o = idx * 4;
                let bestA = 0;
                let maxV = -1e9;
                for (let a = 0; a < 4; a++) {
                  if (eng.Q[o + a] > maxV) {
                    maxV = eng.Q[o + a];
                    bestA = a;
                  }
                }
                if (maxV !== 0) {
                  c.fillStyle = 'rgba(255,155,33,0.7)';
                  c.font = "700 16px 'Archivo', system-ui";
                  c.textAlign = 'center';
                  c.textBaseline = 'middle';
                  c.fillText(ACTIONS[bestA].arrow, px + tileSize / 2, py + tileSize / 2);
                }
              }
            }
          }

          // Draw Agents
          const colors = ['#22d3ee', '#fb923c'];
          eng.agents.forEach((ag, i) => {
            if (ag.isDone) return;
            const px = ag.x * tileSize + tileSize / 2;
            const py = ag.y * tileSize + tileSize / 2;
            c.fillStyle = colors[i % colors.length];
            c.beginPath();
            c.arc(px, py, tileSize * 0.24, 0, Math.PI * 2);
            c.fill();
            c.strokeStyle = '#fff';
            c.lineWidth = 2;
            c.stroke();
          });
        }
      }

      if (++tickC % 6 === 0) {
        setEpisodes(eng.ep);
        setTotalWins(eng.wins);
        setBestSteps(eng.bestSteps === 999 ? 0 : eng.bestSteps);
        setEpsilonVal((greedyRef.current ? 0 : eng.eps).toFixed(2));
        setAlphaVal(getAlpha(eng.ep).toFixed(3));
        setAvgSteps(
          eng.recentSteps.length
            ? (eng.recentSteps.reduce((a, b) => a + b, 0) / eng.recentSteps.length).toFixed(1)
            : '0'
        );
        setSeriesData([...eng.series]);
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleReset = () => {
    const eng = engineRef.current;
    eng.Q.fill(0);
    eng.eps = 1;
    eng.ep = 0;
    eng.wins = 0;
    eng.bestSteps = 999;
    eng.recentSteps = [];
    eng.series = [];
    eng.agents.forEach(resetAgent);
    setSeriesData([]);
  };

  return (
    <div className="fl-wrap">
      <header className="fl-bar">
        <div className="fl-brand">
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <g fill="#22d3ee">
              <rect x="2" y="2" width="6" height="6" rx="1" />
              <rect x="10" y="2" width="6" height="6" rx="1" />
              <rect x="18" y="2" width="6" height="6" rx="1" />
              <rect x="2" y="10" width="6" height="6" rx="1" />
              <rect x="18" y="10" width="6" height="6" rx="1" />
              <rect x="2" y="18" width="6" height="6" rx="1" />
              <rect x="10" y="18" width="6" height="6" rx="1" />
              <rect x="18" y="18" width="6" height="6" rx="1" fill="#9be34a" />
            </g>
          </svg>
          <div>
            <h1>
              GridWorld <em>Maze AI</em>
            </h1>
            <small>Frozen Lake RL · 64 State · 4 Aksi · Visualisasi Policy Vector</small>
          </div>
        </div>
      </header>

      <p className="fl-intro">
        Agen belajar menemukan jalan terpendek menuju Goal hijau menghindari lubang lava merah dan
        rintangan dinding pada papan licin (stochastic transitions). Arah panah oranye pada setiap tile
        menunjukkan arah kebijakan (policy) terbaik yang telah dipelajari agen secara real-time.
      </p>

      <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-[6px] items-start">
        <div className="flex flex-col gap-[6px] min-w-0">
          <FLPanel
            title="Grid World Arena"
            tag="Hijau: Goal · Merah: Trap · Abu: Tembok"
            bodyClassName="flex justify-center p-3"
          >
            <canvas
              ref={mainCanvasRef}
              width={480}
              height={480}
              className="block w-full max-w-[480px] h-auto rounded border border-[var(--bd)] bg-[var(--field)] shadow-[inset_0_1px_4px_rgba(0,0,0,0.7)]"
            />
          </FLPanel>
        </div>

        <div className="flex flex-col gap-[6px] min-w-0">
          <FLPanel title="Monitor RL">
            <div className="fl-lcds">
              <FLLcd label="Episode" value={episodes} />
              <FLLcd label="Avg Steps" value={avgSteps} />
              <FLLcd label="Best Steps" value={bestSteps} />
              <FLLcd label="Epsilon" value={epsilonVal} />
              <FLLcd label="Alpha" value={alphaVal} />
              <FLLcd label="Total Wins" value={totalWins} variant="green" />
            </div>
          </FLPanel>

          <FLPanel title="Transport">
            <div className="fl-stack">
              <div>
                <div className="fl-lab">Tempo Training</div>
                <FLSegmented
                  value={speed}
                  onChange={(val) => setSpeed(val)}
                  options={[
                    { value: 0.2, label: 'Pelan' },
                    { value: 1, label: '1x' },
                    { value: 5, label: '5x' },
                    { value: 20, label: 'Fast' },
                  ]}
                />
              </div>

              <FLButton
                led
                ledActive={greedy}
                onClick={() => setGreedy(!greedy)}
                className="w-full justify-start px-[10px]"
              >
                Mode Eksploitasi (Greedy): {greedy ? 'ON' : 'OFF'}
              </FLButton>

              <FLButton
                led
                ledActive={showPolicy}
                onClick={() => setShowPolicy(!showPolicy)}
                className="w-full justify-start px-[10px]"
              >
                Tampilkan Panah Policy: {showPolicy ? 'ON' : 'OFF'}
              </FLButton>

              <FLButton danger onClick={handleReset} className="w-full">
                Reset Tabel Q
              </FLButton>
            </div>
          </FLPanel>

          <FLPanel title="Kurva Langkah per Episode">
            <LearningChart series={seriesData} bucketSize={10} height={150} unit="ep" />
          </FLPanel>
        </div>
      </div>
    </div>
  );
};
