'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FLPanel } from '@/components/common/FLPanel';
import { FLLcd } from '@/components/common/FLLcd';
import { FLButton } from '@/components/common/FLButton';
import { FLSegmented } from '@/components/common/FLSegmented';
import { LearningChart } from '@/components/common/LearningChart';

const N = 16;
const G = 0.9;
const KEY = 'snakeai_q_v1';
const NS = 144;
const DX = [1, 0, -1, 0];
const DY = [0, 1, 0, -1];

interface SnakeEnv {
  g: number;
  occ: Uint8Array;
  sn: number[];
  d: number;
  score: number;
  since: number;
  over: number;
  food: number;
}

interface Particle {
  x: number;
  y: number;
  vx: number;
  vy: number;
  l: number;
}

interface RealState {
  e: SnakeEnv;
  t: number;
  ph: 'play' | 'over';
  parts: Particle[];
  st: string;
  steps: number;
}

export const SnakeGame: React.FC<{ onBackToLobby?: () => void }> = () => {
  const [mode, setMode] = useState<'train' | 'real'>('train');
  const [speed, setSpeed] = useState<number>(0.15);
  const [realSpeed, setRealSpeed] = useState<number>(1);
  const [greedy, setGreedy] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [canUndo, setCanUndo] = useState<boolean>(false);

  // Stats displayed on LCDs
  const [epCount, setEpCount] = useState<number>(0);
  const [bestScore, setBestScore] = useState<number>(0);
  const [applesCount, setApplesCount] = useState<number>(0);
  const [epsilonVal, setEpsilonVal] = useState<string>('1.00');
  const [alphaVal, setAlphaVal] = useState<string>('0.200');
  const [avgScore, setAvgScore] = useState<string>('0');
  const [seriesData, setSeriesData] = useState<number[]>([]);

  // Agent LCDs
  const [agentScores, setAgentScores] = useState<number[]>([0, 0, 0, 0]);
  const [agentGames, setAgentGames] = useState<number[]>([0, 0, 0, 0]);

  // Real Mode Stats
  const [realGamesCount, setRealGamesCount] = useState<number>(0);
  const [realBestScore, setRealBestScore] = useState<number>(0);

  // IO Modal
  const [showIO, setShowIO] = useState<boolean>(false);
  const [ioMode, setIoMode] = useState<'export' | 'import'>('export');
  const [exportText, setExportText] = useState<string>('');
  const [importText, setImportText] = useState<string>('');

  // Refs for animation & state persistence across frames
  const canvasRefs = [
    useRef<HTMLCanvasElement | null>(null),
    useRef<HTMLCanvasElement | null>(null),
    useRef<HTMLCanvasElement | null>(null),
    useRef<HTMLCanvasElement | null>(null),
  ];
  const realCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Internal mutable simulation engine state
  const engineRef = useRef<{
    Q: Float32Array;
    eps: number;
    ep: number;
    best: number;
    steps: number;
    apples: number;
    recent: number[];
    series: number[];
    envs: SnakeEnv[];
    dirty: boolean;
    acc: number;
    rbest: number;
    rgames: number;
    undo: string | null;
    realState: RealState | null;
  }>({
    Q: new Float32Array(NS * 3),
    eps: 1,
    ep: 0,
    best: 0,
    steps: 0,
    apples: 0,
    recent: [],
    series: [],
    envs: [],
    dirty: false,
    acc: 0,
    rbest: 0,
    rgames: 0,
    undo: null,
    realState: null,
  });

  const greedyRef = useRef(greedy);
  greedyRef.current = greedy;
  const speedRef = useRef(speed);
  speedRef.current = speed;
  const realSpeedRef = useRef(realSpeed);
  realSpeedRef.current = realSpeed;
  const modeRef = useRef(mode);
  modeRef.current = mode;

  // Environment helper functions
  const newEnv = useCallback((): SnakeEnv => {
    const e: SnakeEnv = {
      g: 0,
      occ: new Uint8Array(N * N),
      sn: [],
      d: 0,
      score: 0,
      since: 0,
      over: 0,
      food: 0,
    };
    resetEnv(e);
    return e;
  }, []);

  const spawnFood = (e: SnakeEnv): boolean => {
    const L = N * N - e.sn.length;
    if (L <= 0) return false;
    let k = Math.floor(Math.random() * L);
    for (let i = 0; i < N * N; i++) {
      if (!e.occ[i]) {
        if (!k--) {
          e.food = i;
          return true;
        }
      }
    }
    return false;
  };

  const resetEnv = (e: SnakeEnv) => {
    e.occ.fill(0);
    const m = (N >> 1) * N + (N >> 1);
    e.sn = [m, m - 1, m - 2];
    e.sn.forEach((i) => (e.occ[i] = 1));
    e.d = 0;
    e.score = 0;
    e.since = 0;
    e.over = 0;
    spawnFood(e);
  };

  // BFS Reachability check for pockets / traps
  const visArr = useRef(new Int32Array(N * N));
  const stkArr = useRef(new Int32Array(N * N));
  const vsRef = useRef(0);

  const reach = (e: SnakeEnv, s: number, tail: number, lim: number) => {
    vsRef.current++;
    const vs = vsRef.current;
    const VIS = visArr.current;
    const STK = stkArr.current;
    let n = 0,
      p = 0;
    STK[p++] = s;
    VIS[s] = vs;
    while (p) {
      const c = STK[--p];
      if (++n >= lim) return n;
      const x = c % N,
        y = (c / N) | 0;
      for (let k = 0; k < 4; k++) {
        const nx = x + DX[k],
          ny = y + DY[k];
        if (nx < 0 || ny < 0 || nx >= N || ny >= N) continue;
        const j = ny * N + nx;
        if (VIS[j] === vs || (e.occ[j] && j !== tail)) continue;
        VIS[j] = vs;
        STK[p++] = j;
      }
    }
    return n;
  };

  const getState = (e: SnakeEnv) => {
    const h = e.sn[0],
      hx = h % N,
      hy = (h / N) | 0,
      len = e.sn.length,
      tail = e.sn[len - 1];
    let d = 0;
    for (let a = 0; a < 3; a++) {
      const nd = a ? (e.d + (a === 1 ? 1 : 3)) & 3 : e.d;
      const nx = hx + DX[nd],
        ny = hy + DY[nd];
      let bad = 0;
      if (nx < 0 || ny < 0 || nx >= N || ny >= N) bad = 1;
      else {
        const j = ny * N + nx;
        if (e.occ[j] && j !== tail) bad = 1;
        else if (reach(e, j, tail, len) < len) bad = 1;
      }
      d |= bad << a;
    }
    const fx = (e.food % N) - hx,
      fy = ((e.food / N) | 0) - hy,
      r = (e.d + 1) & 3;
    const f = fx * DX[e.d] + fy * DY[e.d],
      sd = fx * DX[r] + fy * DY[r];
    return ((d * 3 + (sd === 0 ? 0 : sd > 0 ? 1 : 2)) * 3 + (f === 0 ? 0 : f > 0 ? 1 : 2)) * 2 + (len >= 20 ? 1 : 0);
  };

  const dist = (f: number, h: number) => Math.abs((f % N) - (h % N)) + Math.abs(((f / N) | 0) - ((h / N) | 0));

  const moveEnv = (e: SnakeEnv, a: number) => {
    const nd = a ? (e.d + (a === 1 ? 1 : 3)) & 3 : e.d;
    const h = e.sn[0],
      nx = (h % N) + DX[nd],
      ny = ((h / N) | 0) + DY[nd];
    e.d = nd;
    if (nx < 0 || ny < 0 || nx >= N || ny >= N) {
      e.over = 1;
      return -10;
    }
    const j = ny * N + nx,
      eat = j === e.food,
      tail = e.sn[e.sn.length - 1];
    if (!eat) e.occ[tail] = 0;
    if (e.occ[j]) {
      e.over = 1;
      return -10;
    }
    const d0 = dist(e.food, h);
    e.sn.unshift(j);
    e.occ[j] = 1;
    if (eat) {
      e.score++;
      e.since = 0;
      engineRef.current.apples++;
      if (!spawnFood(e)) e.over = 1;
      return 10;
    }
    e.sn.pop();
    e.since++;
    if (e.since > 100 + 2 * e.sn.length) {
      e.over = 1;
      return -5;
    }
    return dist(e.food, j) < d0 ? 0.1 : -0.1;
  };

  const getAlpha = (steps: number) => Math.max(0.03, 0.2 - (0.17 * steps) / 150000);

  const act = (s: number, explore: boolean) => {
    const { Q, eps } = engineRef.current;
    if (explore && Math.random() < eps) return Math.floor(Math.random() * 3);
    const o = s * 3;
    let b = 0,
      bv = -1e9;
    for (let a = 0; a < 3; a++) {
      const v = Q[o + a] + Math.random() * 1e-6;
      if (v > bv) {
        bv = v;
        b = a;
      }
    }
    return b;
  };

  const qmax = (s: number) => {
    const { Q } = engineRef.current;
    const o = s * 3;
    return Math.max(Q[o], Q[o + 1], Q[o + 2]);
  };

  const endGame = (e: SnakeEnv) => {
    const eng = engineRef.current;
    eng.ep++;
    e.g++;
    eng.recent.push(e.score);
    if (eng.recent.length > 50) eng.recent.shift();
    if (e.score > eng.best) eng.best = e.score;
    eng.series.push(e.score);
    if (!greedyRef.current) {
      eng.eps = Math.max(0.02, eng.eps * 0.992);
    }
    resetEnv(e);
  };

  const stepEnv = (e: SnakeEnv) => {
    const eng = engineRef.current;
    const s = getState(e);
    const a = act(s, !greedyRef.current);
    const r = moveEnv(e, a);
    if (!greedyRef.current) {
      const o = s * 3 + a;
      const alpha = getAlpha(eng.steps);
      eng.Q[o] += alpha * ((e.over ? r : r + G * qmax(getState(e))) - eng.Q[o]);
      eng.dirty = true;
      eng.steps++;
    }
    if (e.over) endGame(e);
  };

  // Drawing helpers
  const blk = (c: CanvasRenderingContext2D, x: number, y: number, s: number, col: string) => {
    c.fillStyle = col;
    c.fillRect(x, y, s, s);
    c.fillStyle = 'rgba(255,255,255,0.12)';
    c.fillRect(x + s * 0.2, y + s * 0.2, s * 0.6, s * 0.6);
    c.fillStyle = 'rgba(255,255,255,0.4)';
    c.fillRect(x, y, s, s * 0.14);
    c.fillRect(x, y, s * 0.14, s);
    c.fillStyle = 'rgba(0,0,0,0.3)';
    c.fillRect(x, y + s * 0.86, s, s * 0.14);
    c.fillRect(x + s * 0.86, y, s * 0.14, s);
  };

  const paintSnake = (
    c: CanvasRenderingContext2D,
    e: SnakeEnv,
    ox: number,
    oy: number,
    S: number,
    big: boolean
  ) => {
    const fx = e.food % N,
      fy = (e.food / N) | 0,
      n = e.sn.length;
    // Apple
    c.fillStyle = '#f87171';
    c.beginPath();
    c.arc(ox + (fx + 0.5) * S, oy + (fy + 0.5) * S, S * 0.36, 0, 6.2832);
    c.fill();
    if (big) {
      c.fillStyle = '#4ade80';
      c.fillRect(ox + (fx + 0.5) * S - 1, oy + fy * S + 1, 2, S * 0.22);
    }
    // Body
    for (let i = n - 1; i >= 0; i--) {
      const k = e.sn[i],
        x = ox + (k % N) * S,
        y = oy + (((k / N) | 0) * S),
        t = i / Math.max(1, n - 1);
      const col = i ? `hsl(${33 + 4 * t},100%,${62 - 22 * t}%)` : '#ffe0a8';
      if (big) blk(c, x, y, S, col);
      else {
        c.fillStyle = col;
        c.fillRect(x + 0.5, y + 0.5, S - 1, S - 1);
      }
    }
    // Eyes
    const h = e.sn[0],
      hx = ox + (h % N) * S,
      hy = oy + (((h / N) | 0) * S),
      d = e.d,
      px = -DY[d],
      py = DX[d],
      er = big ? S * 0.11 : S * 0.1;
    c.fillStyle = '#1d1300';
    for (const sg of [-1, 1]) {
      c.beginPath();
      c.arc(
        hx + S * 0.5 + DX[d] * S * 0.18 + px * sg * S * 0.2,
        hy + S * 0.5 + DY[d] * S * 0.18 + py * sg * S * 0.2,
        er,
        0,
        6.2832
      );
      c.fill();
    }
  };

  // Real Mode Step & Update
  const initRealMode = useCallback(() => {
    const e = newEnv();
    engineRef.current.realState = {
      e,
      t: 0,
      ph: 'play',
      parts: [],
      st: 'Mengejar apel',
      steps: 0,
    };
  }, [newEnv]);

  const rStep = () => {
    const rs = engineRef.current.realState;
    if (!rs) return;
    const e = rs.e;
    const s = getState(e);
    rs.st = s >= 18 ? 'Menghindar' : 'Mengejar apel';
    const a = act(s, false);
    const prevScore = e.score;
    moveEnv(e, a);
    rs.steps++;

    if (e.score > prevScore) {
      const h = e.sn[0];
      const X0 = 10,
        Y0 = 20,
        S = 18;
      for (let k = 0; k < 10; k++) {
        rs.parts.push({
          x: X0 + ((h % N) + 0.5) * S,
          y: Y0 + (((h / N) | 0) + 0.5) * S,
          vx: (Math.random() - 0.5) * 200,
          vy: -Math.random() * 160,
          l: 0.5 + Math.random() * 0.4,
        });
      }
    }

    if (e.over) {
      rs.ph = 'over';
      rs.t = 0;
      rs.st = 'Game over';
      engineRef.current.rgames++;
      if (e.score > engineRef.current.rbest) {
        engineRef.current.rbest = e.score;
      }
      engineRef.current.dirty = true;
    }
  };

  const rUpdate = (dt: number) => {
    const rs = engineRef.current.realState;
    if (!rs) return;
    rs.t += dt;
    for (const q of rs.parts) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 420 * dt;
      q.l -= dt;
    }
    rs.parts = rs.parts.filter((q) => q.l > 0);

    if (rs.ph === 'play') {
      const iv = 0.11;
      while (rs.t >= iv) {
        rs.t -= iv;
        rStep();
        if (rs.ph !== 'play') break;
      }
    } else if (rs.t > 2.2) {
      initRealMode();
    }
  };

  const rDraw = () => {
    const cv = realCanvasRef.current;
    if (!cv) return;
    const rx = cv.getContext('2d');
    if (!rx) return;
    const rs = engineRef.current.realState;
    if (!rs) return;

    const e = rs.e;
    const X0 = 10,
      Y0 = 20,
      S = 18;
    const BW = S * N;

    rx.setTransform(2, 0, 0, 2, 0, 0);
    rx.clearRect(0, 0, 420, 330);

    // Board background
    rx.fillStyle = '#12161b';
    rx.fillRect(X0 - 4, Y0 - 4, BW + 8, BW + 8);

    // Subtle grid
    rx.strokeStyle = 'rgba(255,255,255,0.06)';
    rx.lineWidth = 1;
    rx.beginPath();
    for (let k = 0; k <= N; k++) {
      rx.moveTo(X0 + k * S + 0.5, Y0);
      rx.lineTo(X0 + k * S + 0.5, Y0 + BW);
      rx.moveTo(X0, Y0 + k * S + 0.5);
      rx.lineTo(X0 + BW, Y0 + k * S + 0.5);
    }
    rx.stroke();

    // Border glow
    rx.strokeStyle = 'rgba(255,155,33,0.35)';
    rx.strokeRect(X0 - 3.5, Y0 - 3.5, BW + 7, BW + 7);

    paintSnake(rx, e, X0, Y0, S, true);

    // Particles
    for (const q of rs.parts) {
      rx.globalAlpha = Math.max(0, q.l);
      rx.fillStyle = '#f87171';
      rx.fillRect(q.x - 3, q.y - 3, 6, 6);
    }
    rx.globalAlpha = 1;

    const px = 316;
    rx.textAlign = 'left';
    let y = 34;
    const rbv = Math.max(engineRef.current.rbest, e.score);

    const statsList = [
      ['SKOR', e.score],
      ['PANJANG', e.sn.length],
      ['LANGKAH', rs.steps],
      ['GAME', engineRef.current.rgames],
      ['REKOR', rbv],
    ] as const;

    for (const [a, b] of statsList) {
      rx.fillStyle = '#8f9ba8';
      rx.font = "700 10px 'Archivo', system-ui, sans-serif";
      rx.fillText(a, px, y);
      rx.fillStyle = '#ff9b21';
      rx.font = "700 22px 'Archivo', system-ui, sans-serif";
      rx.fillText(String(b), px, y + 24);
      y += 48;
    }

    rx.fillStyle = '#8f9ba8';
    rx.font = "700 10px 'Archivo', system-ui, sans-serif";
    rx.fillText('BOT LAGI', px, y);
    rx.fillStyle = '#e4e9ef';
    rx.font = "700 13px 'Archivo', system-ui, sans-serif";
    rx.fillText(rs.st, px, y + 20);

    if (rs.ph === 'over') {
      rx.fillStyle = 'rgba(0,0,0,0.6)';
      rx.fillRect(X0 - 4, Y0 - 4, BW + 8, BW + 8);
      rx.fillStyle = '#fff';
      rx.font = "800 26px 'Archivo', system-ui, sans-serif";
      rx.textAlign = 'center';
      rx.fillText('GAME OVER', X0 + BW / 2, Y0 + BW / 2);
      rx.textAlign = 'left';
    }
  };

  // Serialization helpers
  const pack = useCallback(() => {
    const eng = engineRef.current;
    return JSON.stringify({
      m: 'qtab1',
      v: 1,
      t: new Date().toISOString(),
      ns: NS,
      q: Array.from(eng.Q, (v) => +v.toFixed(4)),
      eps: eng.eps,
      ep: eng.ep,
      best: eng.best,
      steps: eng.steps,
      apples: eng.apples,
      rbest: eng.rbest,
      rgames: eng.rgames,
      series: eng.series.slice(-3000),
    });
  }, []);

  const unpack = (t: string) => {
    const d = JSON.parse(t);
    if (
      !d ||
      d.m !== 'qtab1' ||
      d.ns !== NS ||
      !Array.isArray(d.q) ||
      d.q.length !== NS * 3 ||
      !d.q.every(Number.isFinite) ||
      !Number.isFinite(d.eps) ||
      d.ep < 0
    ) {
      throw new Error('Format tidak valid');
    }
    const eng = engineRef.current;
    const nn = (v: any) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
    eng.Q = Float32Array.from(d.q);
    eng.eps = d.eps;
    eng.ep = d.ep;
    eng.best = nn(d.best);
    eng.steps = nn(d.steps);
    eng.apples = nn(d.apples);
    eng.rbest = nn(d.rbest);
    eng.rgames = nn(d.rgames);
    eng.series = (d.series || []).filter(Number.isFinite);
    eng.recent = eng.series.slice(-50);
  };

  const saveToStorage = () => {
    try {
      localStorage.setItem(KEY, pack());
      setStatusMsg('Tersimpan otomatis');
    } catch {
      setStatusMsg('Penyimpanan lokal diblokir, gunakan Ekspor');
    }
    engineRef.current.dirty = false;
  };

  const loadFromStorage = useCallback(() => {
    try {
      const t = localStorage.getItem(KEY);
      if (t) {
        unpack(t);
        setStatusMsg('Progress sebelumnya dimuat');
        return true;
      }
    } catch {}
    return false;
  }, []);

  // Initialize engine
  useEffect(() => {
    const eng = engineRef.current;
    eng.Q = new Float32Array(NS * 3);
    eng.eps = 1;
    eng.ep = 0;
    eng.best = 0;
    eng.steps = 0;
    eng.apples = 0;
    eng.rbest = 0;
    eng.rgames = 0;
    eng.recent = [];
    eng.series = [];
    eng.envs = [0, 1, 2, 3].map(newEnv);

    loadFromStorage();
    initRealMode();

    try {
      const u = localStorage.getItem(KEY + '_undo');
      if (u) {
        eng.undo = u;
        setCanUndo(true);
      }
    } catch {}
  }, [newEnv, loadFromStorage, initRealMode]);

  // Main game loop
  useEffect(() => {
    let animId: number;
    let last = performance.now();
    let tickC = 0;
    let tickS = 0;

    const loop = (now: number) => {
      now = now || performance.now();
      const dt = Math.min(0.05, (now - last) / 1000);
      last = now;

      const eng = engineRef.current;

      if (modeRef.current === 'train') {
        eng.acc += speedRef.current;
        let n = 0;
        const tb = performance.now();
        while (eng.acc >= 1 && n < 400 && performance.now() - tb < 14) {
          for (const e of eng.envs) stepEnv(e);
          eng.acc--;
          n++;
        }
        if (eng.acc >= 1) eng.acc = 0;

        // Render agent boards
        eng.envs.forEach((e, i) => {
          const cv = canvasRefs[i].current;
          if (!cv) return;
          const f = cv.getContext('2d');
          if (!f) return;

          f.setTransform(2, 0, 0, 2, 0, 0);
          f.fillStyle = '#12161b';
          f.fillRect(0, 0, 128, 128);

          f.strokeStyle = 'rgba(255,255,255,0.035)';
          f.lineWidth = 1;
          f.beginPath();
          for (let k = 1; k < N; k++) {
            f.moveTo(k * 8 + 0.5, 0);
            f.lineTo(k * 8 + 0.5, 128);
            f.moveTo(0, k * 8 + 0.5);
            f.lineTo(128, k * 8 + 0.5);
          }
          f.stroke();
          paintSnake(f, e, 0, 0, 8, false);
        });

        // Throttle UI React state updates for fast speeds
        if (++tickC % 6 === 0) {
          setEpCount(eng.ep);
          setBestScore(eng.best);
          setApplesCount(eng.apples);
          setEpsilonVal((greedyRef.current ? 0 : eng.eps).toFixed(2));
          setAlphaVal(getAlpha(eng.steps).toFixed(3));
          setAvgScore(
            eng.recent.length
              ? (eng.recent.reduce((a, b) => a + b, 0) / eng.recent.length).toFixed(1)
              : '0'
          );
          setAgentScores(eng.envs.map((e) => e.score));
          setAgentGames(eng.envs.map((e) => e.g));
          setSeriesData([...eng.series]);
        }
      } else {
        rUpdate(dt * realSpeedRef.current);
        rDraw();
        if (++tickC % 10 === 0) {
          setRealGamesCount(eng.rgames);
          setRealBestScore(eng.rbest);
        }
      }

      if (++tickS % 120 === 0 && eng.dirty) {
        saveToStorage();
      }

      animId = requestAnimationFrame(loop);
    };

    animId = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(animId);
  }, []);

  const handleResetBrain = () => {
    if (confirm('Hapus semua yang sudah dipelajari ular?')) {
      const eng = engineRef.current;
      eng.undo = pack();
      try {
        localStorage.setItem(KEY + '_undo', eng.undo);
      } catch {}
      setCanUndo(true);

      eng.Q.fill(0);
      eng.eps = 1;
      eng.ep = 0;
      eng.best = 0;
      eng.steps = 0;
      eng.apples = 0;
      eng.series = [];
      eng.recent = [];
      eng.envs.forEach(resetEnv);
      try {
        localStorage.removeItem(KEY);
      } catch {}
      setStatusMsg('Otak ular direset');
      setSeriesData([]);
    }
  };

  const handleUndo = () => {
    const eng = engineRef.current;
    if (!eng.undo) return;
    if (confirm('Kembalikan kondisi otak ular sebelum reset/impor?')) {
      unpack(eng.undo);
      saveToStorage();
      eng.undo = null;
      try {
        localStorage.removeItem(KEY + '_undo');
      } catch {}
      setCanUndo(false);
      setStatusMsg('Kondisi otak dikembalikan');
      setSeriesData([...eng.series]);
    }
  };

  const handleOpenExport = () => {
    setExportText(pack());
    setIoMode('export');
    setShowIO(true);
    try {
      navigator.clipboard.writeText(pack()).then(() => {
        setStatusMsg('Teks ekspor disalin ke clipboard');
      });
    } catch {}
  };

  const handleOpenImport = () => {
    setImportText('');
    setIoMode('import');
    setShowIO(true);
  };

  const handleApplyImport = () => {
    const v = importText.trim();
    if (!v) {
      setStatusMsg('Kolom impor kosong, tidak ada yang diubah');
      return;
    }
    try {
      const d = JSON.parse(v);
      const eng = engineRef.current;
      eng.undo = pack();
      try {
        localStorage.setItem(KEY + '_undo', eng.undo);
      } catch {}
      setCanUndo(true);

      unpack(v);
      saveToStorage();
      setShowIO(false);
      setStatusMsg(`Impor berhasil: ${d.ep} game, rekor ${d.best || 0}`);
      setSeriesData([...eng.series]);
    } catch {
      setStatusMsg('Format data salah atau tidak valid');
    }
  };

  return (
    <div className="fl-wrap">
      {/* Sub Header for Snake */}
      <header className="fl-bar">
        <div className="fl-brand">
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <g fill="#ff9b21">
              <rect x="1" y="2" width="7.5" height="7.5" rx="1" />
              <rect x="9.25" y="2" width="7.5" height="7.5" rx="1" />
              <rect x="9.25" y="10.25" width="7.5" height="7.5" rx="1" />
              <rect x="17.5" y="10.25" width="7.5" height="7.5" rx="1" fill="#ffd08a" />
            </g>
            <circle cx="5" cy="14" r="3" fill="#e5484d" />
            <rect x="1" y="21" width="24" height="3" rx="1.5" fill="#4a525c" />
          </svg>
          <div>
            <h1>
              Snake <em>AI</em>
            </h1>
            <small>Xenzia · Q-Learning · 4 Agen · 1 Tabel Q (144 State)</small>
          </div>
        </div>
        <nav className="fl-tabs">
          <button
            type="button"
            onClick={() => setMode('train')}
            className={`fl-btn ${mode === 'train' ? 'on' : ''}`}
          >
            Training
          </button>
          <button
            type="button"
            onClick={() => {
              setMode('real');
              if (!engineRef.current.realState) initRealMode();
            }}
            className={`fl-btn ${mode === 'real' ? 'on' : ''}`}
          >
            Real mode
          </button>
        </nav>
      </header>

      <p className="fl-intro">
        Empat papan jalan bareng dengan satu tabel Q bersama. Ular mengamati bahaya di depan,
        kiri, dan kanan (tembok, badan, serta ruang jebakan buntu dengan flood-fill), arah apel, dan
        panjang badan. Reward +10 jika makan apel, -10 jika mati, serta dorongan kecil jika makin
        mendekati apel.
      </p>

      {/* TRAINING VIEW */}
      {mode === 'train' && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-[6px] items-start">
          <div className="flex flex-col gap-[6px] min-w-0">
            <FLPanel
              title="Agen"
              tag={
                <>
                  G = game agen · angka = <b className="text-[var(--ac)]">skor apel</b>
                </>
              }
            >
              <div className="fl-agents">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="fl-ag">
                    <div className="fl-agh">
                      <span>A{i + 1}</span>
                      <div className="fl-agr">
                        <em className="game" title="Jumlah game sesi ini">
                          {agentGames[i]}
                        </em>
                        <b title="Skor apel berjalan">{agentScores[i]}</b>
                      </div>
                    </div>
                    <canvas
                      ref={canvasRefs[i]}
                      width={256}
                      height={256}
                      className="w-full h-auto bg-[var(--field)] block"
                    />
                  </div>
                ))}
              </div>
            </FLPanel>
          </div>

          <div className="flex flex-col gap-[6px] min-w-0">
            {/* Monitor */}
            <FLPanel title="Monitor">
              <div className="fl-lcds">
                <FLLcd label="Game" value={epCount} title="Game selesai" />
                <FLLcd label="Avg 50" value={avgScore} title="Rata-rata apel (50 game terakhir)" />
                <FLLcd label="Rekor" value={bestScore} title="Rekor apel dalam satu game" />
                <FLLcd label="Epsilon" value={epsilonVal} title="Peluang gerakan acak (eksplorasi)" />
                <FLLcd label="Alpha" value={alphaVal} title="Laju belajar" />
                <FLLcd label="Apel" value={applesCount} title="Total apel dimakan semua agen" />
              </div>
            </FLPanel>

            {/* Transport / Controls */}
            <FLPanel title="Transport">
              <div className="fl-stack">
                <div>
                  <div className="fl-lab">Tempo Training</div>
                  <FLSegmented
                    value={speed}
                    onChange={(val) => setSpeed(val)}
                    options={[
                      { value: 0.15, label: 'Pelan' },
                      { value: 1, label: '1x' },
                      { value: 8, label: '8x' },
                      { value: 60, label: '60x' },
                      { value: 150, label: 'Turbo' },
                    ]}
                  />
                </div>

                <FLButton
                  led
                  ledActive={greedy}
                  onClick={() => setGreedy(!greedy)}
                  className="w-full justify-start px-[10px]"
                >
                  Mode serius (Eksploitasi): {greedy ? 'ON' : 'OFF'}
                </FLButton>

                <div>
                  <div className="fl-lab">Data Otak</div>
                  <div className="fl-row">
                    <FLButton danger onClick={handleResetBrain} className="flex-1">
                      Reset Otak
                    </FLButton>
                    <FLButton onClick={handleOpenExport} className="flex-1">
                      Ekspor
                    </FLButton>
                    <FLButton onClick={handleOpenImport} className="flex-1">
                      Impor
                    </FLButton>
                    {canUndo && (
                      <FLButton onClick={handleUndo} className="flex-1">
                        Urungkan
                      </FLButton>
                    )}
                  </div>
                </div>

                {showIO && (
                  <div className="mt-2 p-2 bg-[var(--p3)] border border-[var(--bd)] rounded">
                    {ioMode === 'export' ? (
                      <>
                        <div className="fl-lab">Teks Ekspor Model (JSON)</div>
                        <textarea
                          readOnly
                          value={exportText}
                          className="w-full h-20 p-1.5 text-[11px] font-mono bg-[var(--field)] text-[var(--tx)] border border-[var(--bd)] rounded resize-none"
                          onClick={(e) => (e.target as HTMLTextAreaElement).select()}
                        />
                      </>
                    ) : (
                      <>
                        <div className="fl-lab">Tempel Teks Ekspor di Sini</div>
                        <textarea
                          value={importText}
                          onChange={(e) => setImportText(e.target.value)}
                          placeholder="Paste JSON model..."
                          className="w-full h-20 p-1.5 text-[11px] font-mono bg-[var(--field)] text-[var(--tx)] border border-[var(--bd)] rounded resize-none"
                        />
                        <div className="fl-row mt-2">
                          <FLButton onClick={handleApplyImport}>Terapkan Impor</FLButton>
                        </div>
                      </>
                    )}
                    <div className="fl-row mt-2 justify-end">
                      <FLButton onClick={() => setShowIO(false)}>Tutup</FLButton>
                    </div>
                  </div>
                )}

                <div className="fl-status">
                  {statusMsg && <span className="fl-status-saved">{statusMsg}</span>}
                </div>
              </div>
            </FLPanel>

            {/* Learning Curve Chart */}
            <FLPanel
              title="Kurva Belajar"
              tag={
                seriesData.length >= 20 ? (
                  <>
                    rata-rata 20 game: <b>{(seriesData.slice(-20).reduce((a, b) => a + b, 0) / 20).toFixed(1)}</b>
                  </>
                ) : (
                  '–'
                )
              }
            >
              <LearningChart series={seriesData} bucketSize={20} height={160} unit="game" />
            </FLPanel>
          </div>
        </div>
      )}

      {/* REAL MODE VIEW */}
      {mode === 'real' && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,440px)_320px] gap-[6px] justify-center items-start">
          <FLPanel
            title="Real Mode"
            tag="Bot Bermain Sendiri"
            bodyClassName="flex justify-center p-2"
          >
            <canvas
              ref={realCanvasRef}
              width={840}
              height={660}
              className="block w-full max-w-[420px] h-auto mx-auto rounded"
            />
          </FLPanel>

          <FLPanel title="Kontrol Real Mode">
            <div className="fl-stack">
              <div>
                <div className="fl-lab">Kecepatan Bot</div>
                <FLSegmented
                  value={realSpeed}
                  onChange={(val) => setRealSpeed(val)}
                  options={[
                    { value: 0.5, label: '0.5x' },
                    { value: 1, label: '1x' },
                    { value: 2, label: '2x' },
                    { value: 4, label: '4x' },
                  ]}
                />
              </div>

              <FLButton onClick={initRealMode} className="w-full">
                Ulang Game Real
              </FLButton>

              <div className="fl-lcds two">
                <FLLcd label="Game Real" value={realGamesCount} />
                <FLLcd label="Rekor Real" value={realBestScore} />
              </div>

              <p className="text-[11px] text-[var(--mut)] leading-relaxed mt-2">
                {epCount > 0
                  ? 'Bot menggunakan tabel Q yang telah dipelajari tanpa gerakan acak (eksplorasi dimatikan). '
                  : 'Tabel Q masih kosong/awal sehingga bot masih bermain acak. Latih terlebih dahulu di Training Mode. '}
                Training agen di latar belakang dijeda saat Anda berada di Real Mode.
              </p>
            </div>
          </FLPanel>
        </div>
      )}
    </div>
  );
};
