'use client';

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { FLPanel } from '@/components/common/FLPanel';
import { FLLcd } from '@/components/common/FLLcd';
import { FLButton } from '@/components/common/FLButton';
import { FLSegmented } from '@/components/common/FLSegmented';
import { LearningChart } from '@/components/common/LearningChart';

const COLS = 10;
const ROWS = 20;
const G = 0.95;
const KEY = 'tetrisai_mlp_v1';
const NF = 10;
const HN = 24;
const RW = [0, 1, 3, 6, 10];
const COL = ['', '#22d3ee', '#facc15', '#a78bfa', '#4ade80', '#f87171', '#60a5fa', '#fb923c'];

interface ShapeVariation {
  c: [number, number][];
  w: number;
  h: number;
}

const BASE_SHAPES: [number, number][][] = [
  [[0, 0], [0, 1], [0, 2], [0, 3]], // I
  [[0, 0], [0, 1], [1, 0], [1, 1]], // O
  [[0, 1], [1, 0], [1, 1], [1, 2]], // T
  [[0, 1], [0, 2], [1, 0], [1, 1]], // S
  [[0, 0], [0, 1], [1, 1], [1, 2]], // Z
  [[0, 0], [1, 0], [1, 1], [1, 2]], // J
  [[0, 2], [1, 0], [1, 1], [1, 2]], // L
];

function normCoords(c: [number, number][]): [number, number][] {
  const mr = Math.min(...c.map((p) => p[0]));
  const mc = Math.min(...c.map((p) => p[1]));
  return c.map((p) => [p[0] - mr, p[1] - mc]);
}

const ROTATED_SHAPES: ShapeVariation[][] = BASE_SHAPES.map((b) => {
  const out: ShapeVariation[] = [];
  const seen = new Set<string>();
  let c = b;
  for (let k = 0; k < 4; k++) {
    c = normCoords(c);
    const key = c
      .map((p) => p.join())
      .sort()
      .join('|');
    if (!seen.has(key)) {
      seen.add(key);
      const w = Math.max(...c.map((p) => p[1])) + 1;
      const h = Math.max(...c.map((p) => p[0])) + 1;
      out.push({ c, w, h });
    }
    c = c.map((p) => [p[1], -p[0]]);
  }
  return out;
});

interface TetrisEnv {
  board: Uint8Array;
  cur: number;
  nxt: number;
  lines: number;
  pieces: number;
  wins: number;
  prev: Float64Array | null;
}

interface Debris {
  x: number;
  y: number;
  vx: number;
  vy: number;
  l: number;
  col: string;
}

interface RealTetrisState {
  b: Uint8Array;
  cur: number;
  nxt: number;
  lines: number;
  score: number;
  pieces: number;
  wins: number;
  winT: number;
  ph: 'plan' | 'rot' | 'slide' | 'drop' | 'lock' | 'clear' | 'over';
  t: number;
  p: {
    si: number;
    s: ShapeVariation;
    x: number;
    y: number;
    ang: number;
    vy: number;
  } | null;
  tg: {
    si: number;
    x: number;
    y: number;
    s: ShapeVariation;
  } | null;
  rows: number[];
  parts: Debris[];
  rotLeft: number;
}

const STAT_DESC: Record<string, string> = {
  plan: 'Berpikir',
  rot: 'Memutar',
  slide: 'Menggeser',
  drop: 'Menjatuhkan',
  lock: 'Mengunci',
  clear: 'Hapus baris',
  over: 'Game over',
};

export const TetrisGame: React.FC<{ onBackToLobby?: () => void }> = () => {
  const [mode, setMode] = useState<'train' | 'real'>('train');
  const [speed, setSpeed] = useState<number>(0.15);
  const [realSpeed, setRealSpeed] = useState<number>(1);
  const [greedy, setGreedy] = useState<boolean>(false);
  const [statusMsg, setStatusMsg] = useState<string>('');
  const [canUndo, setCanUndo] = useState<boolean>(false);

  // Stats
  const [epCount, setEpCount] = useState<number>(0);
  const [avgScore, setAvgScore] = useState<string>('0');
  const [bestScore, setBestScore] = useState<number>(0);
  const [epsilonVal, setEpsilonVal] = useState<string>('1.00');
  const [alphaVal, setAlphaVal] = useState<string>('0.100');
  const [totalWins, setTotalWins] = useState<number>(0);
  const [seriesData, setSeriesData] = useState<number[]>([]);

  // Agent individual scores
  const [agentLines, setAgentLines] = useState<number[]>([0, 0, 0, 0]);
  const [agentWins, setAgentWins] = useState<number[]>([0, 0, 0, 0]);

  // Real Mode Stats
  const [realWins, setRealWins] = useState<number>(0);
  const [realBest, setRealBest] = useState<number>(0);

  // IO Modal
  const [showIO, setShowIO] = useState<boolean>(false);
  const [ioMode, setIoMode] = useState<'export' | 'import'>('export');
  const [exportText, setExportText] = useState<string>('');
  const [importText, setImportText] = useState<string>('');

  const canvasRefs = [
    useRef<HTMLCanvasElement | null>(null),
    useRef<HTMLCanvasElement | null>(null),
    useRef<HTMLCanvasElement | null>(null),
    useRef<HTMLCanvasElement | null>(null),
  ];
  const realCanvasRef = useRef<HTMLCanvasElement | null>(null);

  // Engine references
  const engineRef = useRef<{
    W1: Float64Array;
    B1: Float64Array;
    W2: Float64Array;
    B2: number;
    HID: Float64Array;
    T1: Uint8Array;
    T2: Uint8Array;
    HG: Int32Array;
    NB: Uint8Array;
    eps: number;
    ep: number;
    best: number;
    steps: number;
    wins: number;
    rwins: number;
    rbest: number;
    recent: number[];
    series: number[];
    envs: TetrisEnv[];
    dirty: boolean;
    acc: number;
    undo: string | null;
    realState: RealTetrisState | null;
  }>({
    W1: new Float64Array(HN * NF),
    B1: new Float64Array(HN),
    W2: new Float64Array(HN),
    B2: 0,
    HID: new Float64Array(HN),
    T1: new Uint8Array(200),
    T2: new Uint8Array(200),
    HG: new Int32Array(COLS),
    NB: new Uint8Array(200),
    eps: 1,
    ep: 0,
    best: 0,
    steps: 0,
    wins: 0,
    rwins: 0,
    rbest: 0,
    recent: [],
    series: [],
    envs: [],
    dirty: false,
    acc: 0,
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

  // Neural Network & Feature Extractor
  const initNet = useCallback(() => {
    const eng = engineRef.current;
    eng.W1 = new Float64Array(HN * NF);
    eng.B1 = new Float64Array(HN);
    eng.W2 = new Float64Array(HN);
    eng.B2 = 0;
    for (let i = 0; i < eng.W1.length; i++) eng.W1[i] = (Math.random() - 0.5) * 0.6;
    for (let i = 0; i < HN; i++) eng.W2[i] = (Math.random() - 0.5) * 0.6;
  }, []);

  const fwd = (f: Float64Array): number => {
    const eng = engineRef.current;
    let s = eng.B2;
    for (let j = 0; j < HN; j++) {
      let a = eng.B1[j];
      const o = j * NF;
      for (let i = 0; i < NF; i++) a += eng.W1[o + i] * f[i];
      a = Math.tanh(a);
      eng.HID[j] = a;
      s += eng.W2[j] * a;
    }
    return s;
  };

  const updateNet = (f: Float64Array, target: number, a: number) => {
    const eng = engineRef.current;
    let d = target - fwd(f);
    d = Math.max(-10, Math.min(10, d));
    for (let j = 0; j < HN; j++) {
      const g = d * eng.W2[j] * (1 - eng.HID[j] * eng.HID[j]);
      const o = j * NF;
      eng.W2[j] += a * d * eng.HID[j];
      eng.B1[j] += a * g;
      for (let i = 0; i < NF; i++) eng.W1[o + i] += a * g * f[i];
    }
    eng.B2 += a * d;
    if (!Number.isFinite(eng.B2) || !Number.isFinite(eng.W2[0])) initNet();
  };

  const getAlpha = (steps: number) => Math.max(0.002, 0.01 - (0.008 * steps) / 240000);

  // Board logic
  const fits = (b: Uint8Array, s: ShapeVariation, x: number, y: number) => {
    for (const p of s.c) {
      const r = y + p[0];
      if (r >= ROWS || b[r * COLS + x + p[1]]) return false;
    }
    return true;
  };

  const dropY = (b: Uint8Array, s: ShapeVariation, x: number) => {
    if (!fits(b, s, x, 0)) return -1;
    let y = 0;
    while (fits(b, s, x, y + 1)) y++;
    return y;
  };

  const placePiece = (
    src: Uint8Array,
    dst: Uint8Array,
    s: ShapeVariation,
    x: number,
    y: number,
    id: number
  ) => {
    const eng = engineRef.current;
    eng.T1.set(src);
    for (const p of s.c) eng.T1[(y + p[0]) * COLS + x + p[1]] = id;
    let w = ROWS - 1,
      n = 0;
    dst.fill(0);
    for (let r = ROWS - 1; r >= 0; r--) {
      let f = true;
      for (let c = 0; c < COLS; c++) {
        if (!eng.T1[r * COLS + c]) {
          f = false;
          break;
        }
      }
      if (f) {
        n++;
        continue;
      }
      for (let c = 0; c < COLS; c++) dst[w * COLS + c] = eng.T1[r * COLS + c];
      w--;
    }
    return n;
  };

  const extractFeats = (b: Uint8Array): Float64Array => {
    const eng = engineRef.current;
    const f = new Float64Array(NF);
    let holes = 0,
      bump = 0,
      agg = 0,
      mx = 0,
      pv = 0;
    for (let c = 0; c < COLS; c++) {
      let r = 0;
      while (r < ROWS && !b[r * COLS + c]) r++;
      const h = ROWS - r;
      eng.HG[c] = h;
      for (let k = r + 1; k < ROWS; k++) {
        if (!b[k * COLS + c]) holes++;
      }
      agg += h;
      if (h > mx) mx = h;
      if (c) bump += Math.abs(h - pv);
      pv = h;
    }
    let wells = 0;
    for (let c = 0; c < COLS; c++) {
      const l = c ? eng.HG[c - 1] : 99;
      const r = c < COLS - 1 ? eng.HG[c + 1] : 99;
      const d = Math.min(l, r) - eng.HG[c];
      if (d > 0) wells += d;
    }
    let rt = 0;
    for (let r = 0; r < ROWS; r++) {
      let p = 1;
      for (let c = 0; c < COLS; c++) {
        const v = b[r * COLS + c] ? 1 : 0;
        if (v !== p) rt++;
        p = v;
      }
      if (p !== 1) rt++;
    }
    let ct = 0;
    for (let c = 0; c < COLS; c++) {
      let p = 0;
      for (let r = 0; r < ROWS; r++) {
        const v = b[r * COLS + c] ? 1 : 0;
        if (v !== p) ct++;
        p = v;
      }
      if (p !== 1) ct++;
    }
    f[0] = holes / 10;
    f[1] = bump / 40;
    f[2] = agg / 150;
    f[3] = mx / 20;
    f[4] = wells / 30;
    f[5] = rt / 100;
    f[6] = ct / 60;
    f[7] = f[3] * f[3];
    f[8] = f[0] * f[0];
    f[9] = f[1] * f[1];
    return f;
  };

  interface Option {
    s: ShapeVariation;
    x: number;
    y: number;
    f: Float64Array;
    r: number;
    q: number;
  }

  const enumOpts = (b: Uint8Array, cur: number): Option[] => {
    const eng = engineRef.current;
    const o: Option[] = [];
    for (const s of ROTATED_SHAPES[cur]) {
      for (let x = 0; x + s.w <= COLS; x++) {
        const y = dropY(b, s, x);
        if (y < 0) continue;
        const n = placePiece(b, eng.T2, s, x, y, 1);
        const f = extractFeats(eng.T2);
        o.push({
          s,
          x,
          y,
          f,
          r: RW[n],
          q: RW[n] + G * fwd(f) + Math.random() * 1e-6,
        });
      }
    }
    return o;
  };

  const pickBest = (o: Option[]): Option | null => {
    let b: Option | null = null;
    for (const e of o) if (!b || e.q > b.q) b = e;
    return b;
  };

  const lookPick = (b: Uint8Array, cur: number, nxt: number): Option | null => {
    const eng = engineRef.current;
    const o = enumOpts(b, cur);
    if (!o.length) return null;
    o.sort((a, c) => c.q - a.q);
    let bo: Option | null = null,
      bq = -1e9;
    for (const e of o.slice(0, 6)) {
      placePiece(b, eng.NB, e.s, e.x, e.y, 1);
      const o2 = enumOpts(eng.NB, nxt);
      const q = e.r + G * (o2.length ? pickBest(o2)!.q : -10);
      if (q > bq) {
        bq = q;
        bo = e;
      }
    }
    return bo;
  };

  const resetEnv = (e: TetrisEnv) => {
    e.board.fill(0);
    e.cur = Math.floor(Math.random() * 7);
    e.nxt = Math.floor(Math.random() * 7);
    e.lines = 0;
    e.pieces = 0;
    e.wins = 0;
    e.prev = null;
  };

  const newEnv = useCallback((): TetrisEnv => {
    const e: TetrisEnv = {
      board: new Uint8Array(200),
      cur: 0,
      nxt: 0,
      lines: 0,
      pieces: 0,
      wins: 0,
      prev: null,
    };
    resetEnv(e);
    return e;
  }, []);

  const endGame = (e: TetrisEnv) => {
    const eng = engineRef.current;
    eng.ep++;
    eng.recent.push(e.lines);
    if (eng.recent.length > 50) eng.recent.shift();
    if (e.lines > eng.best) eng.best = e.lines;
    eng.series.push(e.lines);
    if (!greedyRef.current) {
      eng.eps = Math.max(0.02, eng.eps * 0.9993);
    }
    resetEnv(e);
  };

  const stepEnv = (e: TetrisEnv) => {
    const eng = engineRef.current;
    const o = enumOpts(e.board, e.cur);
    if (!o.length) {
      if (!greedyRef.current && e.prev) {
        updateNet(e.prev, -10, getAlpha(eng.steps));
        eng.dirty = true;
        eng.steps++;
      }
      endGame(e);
      return;
    }
    const bo = pickBest(o)!;
    if (!greedyRef.current && e.prev) {
      updateNet(e.prev, bo.q, getAlpha(eng.steps));
      eng.dirty = true;
      eng.steps++;
    }
    const c = greedyRef.current
      ? lookPick(e.board, e.cur, e.nxt) || bo
      : Math.random() < eng.eps
      ? o[Math.floor(Math.random() * o.length)]
      : bo;

    const n = placePiece(e.board, eng.T2, c.s, c.x, c.y, e.cur + 1);
    e.board.set(eng.T2);
    if (n && !e.board.some((v) => v)) {
      e.wins++;
      eng.wins++;
      eng.dirty = true;
    }
    e.lines += n;
    e.pieces++;
    e.prev = c.f;
    e.cur = e.nxt;
    e.nxt = Math.floor(Math.random() * 7);
    if (e.lines > eng.best) eng.best = e.lines;
  };

  // Real Mode logic
  const rndPiece = () => Math.floor(Math.random() * 7);
  const easeOut = (t: number) => 1 - Math.pow(1 - t, 3);

  const initRealMode = useCallback(() => {
    engineRef.current.realState = {
      b: new Uint8Array(200),
      cur: rndPiece(),
      nxt: rndPiece(),
      lines: 0,
      score: 0,
      pieces: 0,
      wins: 0,
      winT: 0,
      ph: 'plan',
      t: 0,
      p: null,
      tg: null,
      rows: [],
      parts: [],
      rotLeft: 0,
    };
  }, []);

  const rPlan = () => {
    const rs = engineRef.current.realState;
    if (!rs) return;
    const o2 = lookPick(rs.b, rs.cur, rs.nxt);
    const bo = o2
      ? {
          si: ROTATED_SHAPES[rs.cur].indexOf(o2.s),
          x: o2.x,
          y: o2.y,
          s: o2.s,
        }
      : null;

    if (!bo) {
      rs.ph = 'over';
      rs.t = 0;
      rs.p = null;
      if (rs.lines > engineRef.current.rbest) engineRef.current.rbest = rs.lines;
      return;
    }

    const s0 = ROTATED_SHAPES[rs.cur][0];
    rs.tg = bo;
    rs.p = {
      si: 0,
      s: s0,
      x: Math.floor((COLS - s0.w) / 2),
      y: 0,
      ang: 0,
      vy: 0,
    };
    rs.rotLeft = bo.si;
    rs.ph = rs.rotLeft > 0 ? 'rot' : 'slide';
    rs.t = 0;
  };

  const lockRealPiece = () => {
    const rs = engineRef.current.realState;
    if (!rs || !rs.p || !rs.tg) return;
    const id = rs.cur + 1;
    for (const q of rs.p.s.c) rs.b[(rs.tg.y + q[0]) * COLS + rs.tg.x + q[1]] = id;
    rs.rows = [];
    for (let r = 0; r < ROWS; r++) {
      let f = true;
      for (let c = 0; c < COLS; c++) {
        if (!rs.b[r * COLS + c]) {
          f = false;
          break;
        }
      }
      if (f) rs.rows.push(r);
    }
    const n = rs.rows.length;
    rs.lines += n;
    rs.score += [0, 100, 300, 500, 800][n];

    const X0 = 10,
      Y0 = 20,
      S = 28;
    for (const r of rs.rows) {
      for (let c = 0; c < COLS; c++) {
        for (let k = 0; k < 2; k++) {
          rs.parts.push({
            x: X0 + (c + 0.5) * S,
            y: Y0 + (r + 0.5) * S,
            vx: (Math.random() - 0.5) * 260,
            vy: -Math.random() * 220,
            l: 0.6 + Math.random() * 0.4,
            col: COL[rs.b[r * COLS + c]],
          });
        }
      }
    }
    rs.p = null;
  };

  const collapseRealBoard = () => {
    const rs = engineRef.current.realState;
    if (!rs) return;
    const nb = new Uint8Array(200);
    let w = ROWS - 1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (rs.rows.includes(r)) continue;
      for (let c = 0; c < COLS; c++) nb[w * COLS + c] = rs.b[r * COLS + c];
      w--;
    }
    rs.b = nb;
    rs.rows = [];
    if (!nb.some((v) => v)) {
      rs.wins++;
      engineRef.current.rwins++;
      engineRef.current.dirty = true;
      rs.winT = 1.4;
    }
  };

  const nextRealPiece = () => {
    const rs = engineRef.current.realState;
    if (!rs) return;
    rs.cur = rs.nxt;
    rs.nxt = rndPiece();
    rs.pieces++;
    rs.ph = 'plan';
    rs.t = 0;
    rs.p = null;
  };

  const rUpdate = (dt: number) => {
    const rs = engineRef.current.realState;
    if (!rs) return;
    rs.t += dt;
    if (rs.winT > 0) rs.winT -= dt;
    for (const q of rs.parts) {
      q.x += q.vx * dt;
      q.y += q.vy * dt;
      q.vy += 500 * dt;
      q.l -= dt;
    }
    rs.parts = rs.parts.filter((q) => q.l > 0);

    const p = rs.p;
    const tg = rs.tg;

    switch (rs.ph) {
      case 'plan':
        if (rs.t > 0.12) rPlan();
        break;
      case 'rot':
        if (p) {
          const D = 0.17;
          p.ang = easeOut(Math.min(1, rs.t / D)) * (Math.PI / 2);
          if (rs.t >= D) {
            const s = p.s;
            p.si++;
            const ns = ROTATED_SHAPES[rs.cur][p.si];
            p.x += s.w / 2 - ns.w / 2;
            p.y += s.h / 2 - ns.h / 2;
            p.s = ns;
            p.ang = 0;
            rs.rotLeft--;
            rs.t = 0;
            if (rs.rotLeft <= 0) rs.ph = 'slide';
          }
        }
        break;
      case 'slide':
        if (p && tg) {
          const st = 14 * dt;
          const dx = tg.x - p.x;
          if (Math.abs(dx) <= st) p.x = tg.x;
          else p.x += Math.sign(dx) * st;
          p.y += (0 - p.y) * Math.min(1, dt * 20);
          if (p.x === tg.x) {
            p.y = 0;
            p.vy = 5;
            rs.ph = 'drop';
            rs.t = 0;
          }
        }
        break;
      case 'drop':
        if (p && tg) {
          p.vy = Math.min(70, p.vy + 110 * dt);
          p.y += p.vy * dt;
          if (p.y >= tg.y) {
            p.y = tg.y;
            rs.ph = 'lock';
            rs.t = 0;
            lockRealPiece();
          }
        }
        break;
      case 'lock':
        if (rs.t >= 0.09) {
          if (rs.rows.length) {
            rs.ph = 'clear';
            rs.t = 0;
          } else nextRealPiece();
        }
        break;
      case 'clear':
        if (rs.t >= 0.3) {
          collapseRealBoard();
          nextRealPiece();
        }
        break;
      case 'over':
        if (rs.t > 2.2) initRealMode();
        break;
    }
  };

  const drawBlock = (
    c: CanvasRenderingContext2D,
    x: number,
    y: number,
    s: number,
    col: string
  ) => {
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

  const rDraw = () => {
    const cv = realCanvasRef.current;
    if (!cv) return;
    const rx = cv.getContext('2d');
    if (!rx) return;
    const rs = engineRef.current.realState;
    if (!rs) return;

    const X0 = 10,
      Y0 = 20,
      S = 28;
    const BW = S * COLS;
    const BH = S * ROWS;

    rx.setTransform(2, 0, 0, 2, 0, 0);
    rx.clearRect(0, 0, 420, 600);

    // Board field
    rx.fillStyle = '#12161b';
    rx.fillRect(X0 - 4, Y0 - 4, BW + 8, BH + 8);

    // Grid lines
    rx.strokeStyle = 'rgba(255,255,255,0.06)';
    rx.lineWidth = 1;
    rx.beginPath();
    for (let c = 0; c <= COLS; c++) {
      rx.moveTo(X0 + c * S + 0.5, Y0);
      rx.lineTo(X0 + c * S + 0.5, Y0 + BH);
    }
    for (let r = 0; r <= ROWS; r++) {
      rx.moveTo(X0, Y0 + r * S + 0.5);
      rx.lineTo(X0 + BW, Y0 + r * S + 0.5);
    }
    rx.stroke();

    const fo = rs.ph === 'clear' && Math.floor(rs.t / 0.06) % 2 === 0;

    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        const v = rs.b[r * COLS + c];
        if (v) drawBlock(rx, X0 + c * S, Y0 + r * S, S, fo && rs.rows.includes(r) ? '#ffffff' : COL[v]);
      }
    }

    if (rs.p && rs.tg) {
      rx.strokeStyle = COL[rs.cur + 1];
      rx.globalAlpha = 0.55;
      rx.lineWidth = 2;
      for (const q of rs.tg.s.c) {
        rx.strokeRect(X0 + (rs.tg.x + q[1]) * S + 2, Y0 + (rs.tg.y + q[0]) * S + 2, S - 4, S - 4);
      }
      rx.globalAlpha = 1;

      const p = rs.p;
      const s = p.s;
      rx.save();
      rx.translate(X0 + (p.x + s.w / 2) * S, Y0 + (p.y + s.h / 2) * S);
      rx.rotate(p.ang);
      for (const q of s.c) {
        drawBlock(rx, (q[1] - s.w / 2) * S, (q[0] - s.h / 2) * S, S, COL[rs.cur + 1]);
      }
      rx.restore();
    }

    // Particles
    for (const q of rs.parts) {
      rx.globalAlpha = Math.max(0, q.l);
      rx.fillStyle = q.col;
      rx.fillRect(q.x - 3, q.y - 3, 6, 6);
    }
    rx.globalAlpha = 1;

    // Board clear win banner
    if (rs.winT > 0) {
      rx.globalAlpha = Math.min(1, rs.winT);
      rx.fillStyle = '#9be34a';
      rx.font = "800 34px 'Archivo', system-ui, sans-serif";
      rx.textAlign = 'center';
      rx.fillText('WIN!', X0 + BW / 2, Y0 + BH * 0.35);
      rx.font = "700 12px 'Archivo', system-ui, sans-serif";
      rx.fillText('PAPAN KOSONG', X0 + BW / 2, Y0 + BH * 0.35 + 20);
      rx.globalAlpha = 1;
    }

    // HUD sidebar
    const px = 306;
    rx.textAlign = 'left';
    rx.fillStyle = '#8f9ba8';
    rx.font = "700 10px 'Archivo', system-ui, sans-serif";
    rx.fillText('BERIKUTNYA', px, 36);

    for (const q of ROTATED_SHAPES[rs.nxt][0].c) {
      drawBlock(rx, px + 8 + q[1] * 16, 48 + q[0] * 16, 16, COL[rs.nxt + 1]);
    }

    let y = 150;
    const hudItems = [
      ['BARIS', rs.lines],
      ['SKOR', rs.score],
      ['BIDAK', rs.pieces],
      ['WIN', rs.wins],
      ['REKOR BARIS', Math.max(engineRef.current.rbest, rs.lines)],
    ] as const;

    for (const [a, b] of hudItems) {
      rx.fillStyle = '#8f9ba8';
      rx.font = "700 10px 'Archivo', system-ui, sans-serif";
      rx.fillText(a, px, y);
      rx.fillStyle = '#ff9b21';
      rx.font = "700 22px 'Archivo', system-ui, sans-serif";
      rx.fillText(String(b), px, y + 24);
      y += 56;
    }

    rx.fillStyle = '#8f9ba8';
    rx.font = "700 10px 'Archivo', system-ui, sans-serif";
    rx.fillText('BOT LAGI', px, y);
    rx.fillStyle = '#e4e9ef';
    rx.font = "700 14px 'Archivo', system-ui, sans-serif";
    rx.fillText(STAT_DESC[rs.ph] || rs.ph, px, y + 20);

    if (rs.ph === 'over') {
      rx.fillStyle = 'rgba(0,0,0,0.6)';
      rx.fillRect(X0 - 4, Y0 - 4, BW + 8, BH + 8);
      rx.fillStyle = '#fff';
      rx.font = "800 26px 'Archivo', system-ui, sans-serif";
      rx.textAlign = 'center';
      rx.fillText('GAME OVER', X0 + BW / 2, Y0 + BH / 2);
      rx.textAlign = 'left';
    }
  };

  // Pack / Unpack
  const pack = useCallback(() => {
    const eng = engineRef.current;
    const r = (a: Float64Array) => Array.from(a, (v) => +v.toFixed(5));
    return JSON.stringify({
      m: 'mlp1',
      v: 2,
      t: new Date().toISOString(),
      nf: NF,
      hn: HN,
      w1: r(eng.W1),
      b1: r(eng.B1),
      w2: r(eng.W2),
      b2: +eng.B2.toFixed(5),
      eps: eng.eps,
      ep: eng.ep,
      best: eng.best,
      steps: eng.steps,
      avg50: eng.recent.length
        ? +(eng.recent.reduce((a, b) => a + b, 0) / eng.recent.length).toFixed(2)
        : 0,
      wins: eng.wins,
      rwins: eng.rwins,
      rbest: eng.rbest,
      series: eng.series.slice(-3000),
    });
  }, []);

  const unpack = (t: string) => {
    const d = JSON.parse(t);
    if (
      !d ||
      d.m !== 'mlp1' ||
      d.nf !== NF ||
      d.hn !== HN ||
      !d.w1 ||
      d.w1.length !== HN * NF ||
      !d.b1 ||
      d.b1.length !== HN ||
      !d.w2 ||
      d.w2.length !== HN ||
      typeof d.b2 !== 'number'
    ) {
      throw new Error('Format tidak cocok');
    }
    const eng = engineRef.current;
    const nn = (v: any) => (Number.isFinite(v) && v > 0 ? Math.floor(v) : 0);
    eng.W1 = Float64Array.from(d.w1);
    eng.B1 = Float64Array.from(d.b1);
    eng.W2 = Float64Array.from(d.w2);
    eng.B2 = d.b2;
    eng.eps = d.eps;
    eng.ep = d.ep;
    eng.best = d.best;
    eng.steps = d.steps || 0;
    eng.series = d.series || [];
    eng.recent = eng.series.slice(-50);
    eng.wins = nn(d.wins);
    eng.rwins = nn(d.rwins);
    eng.rbest = nn(d.rbest);
  };

  const saveToStorage = () => {
    try {
      localStorage.setItem(KEY, pack());
      setStatusMsg('Tersimpan otomatis');
    } catch {
      setStatusMsg('Penyimpanan lokal diblokir');
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

  useEffect(() => {
    const eng = engineRef.current;
    initNet();
    eng.eps = 1;
    eng.ep = 0;
    eng.best = 0;
    eng.steps = 0;
    eng.wins = 0;
    eng.rwins = 0;
    eng.rbest = 0;
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
  }, [initNet, newEnv, loadFromStorage, initRealMode]);

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
          f.fillRect(0, 0, 140, 280);

          f.strokeStyle = 'rgba(255,255,255,0.035)';
          f.lineWidth = 1;
          f.beginPath();
          for (let c = 1; c < COLS; c++) {
            f.moveTo(c * 14 + 0.5, 0);
            f.lineTo(c * 14 + 0.5, 280);
          }
          for (let r = 1; r < ROWS; r++) {
            f.moveTo(0, r * 14 + 0.5);
            f.lineTo(140, r * 14 + 0.5);
          }
          f.stroke();

          for (let r = 0; r < ROWS; r++) {
            for (let c = 0; c < COLS; c++) {
              const v = e.board[r * COLS + c];
              if (v) {
                f.fillStyle = COL[v];
                f.fillRect(c * 14 + 1, r * 14 + 1, 12, 12);
                f.fillStyle = 'rgba(255,255,255,0.28)';
                f.fillRect(c * 14 + 1, r * 14 + 1, 12, 2);
              }
            }
          }
        });

        // Throttle UI update
        if (++tickC % 6 === 0) {
          setEpCount(eng.ep);
          setBestScore(eng.best);
          setTotalWins(eng.wins);
          setEpsilonVal((greedyRef.current ? 0 : eng.eps).toFixed(2));
          setAlphaVal(getAlpha(eng.steps).toFixed(3));
          setAvgScore(
            eng.recent.length
              ? (eng.recent.reduce((a, b) => a + b, 0) / eng.recent.length).toFixed(1)
              : '0'
          );
          setAgentLines(eng.envs.map((e) => e.lines));
          setAgentWins(eng.envs.map((e) => e.wins));
          setSeriesData([...eng.series]);
        }
      } else {
        rUpdate(dt * realSpeedRef.current);
        rDraw();
        if (++tickC % 10 === 0) {
          setRealWins(eng.rwins);
          setRealBest(eng.rbest);
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
    if (confirm('Hapus semua yang sudah dipelajari Tetris AI?')) {
      const eng = engineRef.current;
      eng.undo = pack();
      try {
        localStorage.setItem(KEY + '_undo', eng.undo);
      } catch {}
      setCanUndo(true);

      initNet();
      eng.eps = 1;
      eng.ep = 0;
      eng.best = 0;
      eng.steps = 0;
      eng.wins = 0;
      eng.series = [];
      eng.recent = [];
      eng.envs.forEach(resetEnv);
      try {
        localStorage.removeItem(KEY);
      } catch {}
      setStatusMsg('Otak Tetris AI direset');
      setSeriesData([]);
    }
  };

  const handleUndo = () => {
    const eng = engineRef.current;
    if (!eng.undo) return;
    if (confirm('Kembalikan kondisi otak Tetris AI sebelum reset/impor?')) {
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
      setStatusMsg('Kolom impor kosong');
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
      setStatusMsg('Format data salah atau tidak kompatibel');
    }
  };

  return (
    <div className="fl-wrap">
      {/* Title Bar */}
      <header className="fl-bar">
        <div className="fl-brand">
          <svg width="26" height="26" viewBox="0 0 26 26" aria-hidden="true">
            <g fill="#ff9b21">
              <rect x="1" y="2" width="7.5" height="7.5" rx="1" />
              <rect x="9.25" y="2" width="7.5" height="7.5" rx="1" />
              <rect x="17.5" y="2" width="7.5" height="7.5" rx="1" />
              <rect x="9.25" y="10.25" width="7.5" height="7.5" rx="1" fill="#ffd08a" />
            </g>
            <rect x="1" y="21" width="24" height="3" rx="1.5" fill="#4a525c" />
          </svg>
          <div>
            <h1>
              Tetris <em>AI</em>
            </h1>
            <small>Q-Learning (TD) · 4 Agen · 1 Otak Neural Network (MLP 10-24-1)</small>
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
        Empat papan jalan bareng dengan satu otak bersama: jaringan saraf kecil yang dilatih
        dengan Q-learning (TD). Reward hanya dari baris yang terhapus (+1, +3, +6, +10), penalti
        jika game over. Dilengkapi evaluasi fitur geometri board (lubang, bumpiness, tinggi agregat,
        sumur, dan transisi).
      </p>

      {/* TRAINING VIEW */}
      {mode === 'train' && (
        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1fr)_320px] gap-[6px] items-start">
          <div className="flex flex-col gap-[6px] min-w-0">
            <FLPanel
              title="Agen"
              tag={
                <>
                  W = win sesi · angka = <b className="text-[var(--ac)]">baris</b>
                </>
              }
            >
              <div className="fl-agents">
                {[0, 1, 2, 3].map((i) => (
                  <div key={i} className="fl-ag">
                    <div className="fl-agh">
                      <span>A{i + 1}</span>
                      <div className="fl-agr">
                        <em className="win" title="Win sesi (papan kosong)">
                          {agentWins[i]}
                        </em>
                        <b title="Baris selesai">{agentLines[i]}</b>
                      </div>
                    </div>
                    <canvas
                      ref={canvasRefs[i]}
                      width={280}
                      height={560}
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
                <FLLcd label="Avg 50" value={avgScore} title="Rata-rata baris (50 game terakhir)" />
                <FLLcd label="Rekor" value={bestScore} title="Rekor baris dalam satu game" />
                <FLLcd label="Epsilon" value={epsilonVal} title="Peluang gerakan acak (eksplorasi)" />
                <FLLcd label="Alpha" value={alphaVal} title="Laju belajar jaringan saraf" />
                <FLLcd label="Win" value={totalWins} title="Total win (papan bersih) semua agen" />
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
                  Mode Serius (Lookahead 2 Langkah): {greedy ? 'ON' : 'OFF'}
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
                        <div className="fl-lab">Teks Ekspor Bobot Neural Network</div>
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
              height={1200}
              className="block w-full max-w-[420px] h-auto mx-auto rounded"
            />
          </FLPanel>

          <FLPanel title="Kontrol Real Mode">
            <div className="fl-stack">
              <div>
                <div className="fl-lab">Kecepatan Eksekusi</div>
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
                <FLLcd label="Win Real" value={realWins} title="Papan bersih di real mode" />
                <FLLcd label="Rekor Real" value={realBest} title="Rekor baris di real mode" />
              </div>

              <p className="text-[11px] text-[var(--mut)] leading-relaxed mt-2">
                {epCount > 0
                  ? 'Bot menggunakan jaringan saraf hasil training tanpa eksplorasi acak, ditambah lookahead 2 langkah untuk mengantisipasi bidak berikutnya. '
                  : 'Otak masih belum terlatih, bot akan bermain secara heuristik acak. Latih terlebih dahulu di Training Mode. '}
                Training agen di latar belakang dijeda saat Anda berada di Real Mode.
              </p>
            </div>
          </FLPanel>
        </div>
      )}
    </div>
  );
};
