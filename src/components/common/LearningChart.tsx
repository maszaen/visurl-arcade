import React, { useEffect, useRef } from 'react';

interface LearningChartProps {
  series: number[];
  title?: string;
  bucketSize?: number;
  height?: number;
  unit?: string;
}

const fmt = (v: number) => (Math.abs(v) >= 10 ? v.toFixed(0) : v.toFixed(1));

export const LearningChart: React.FC<LearningChartProps> = ({
  series,
  bucketSize = 20,
  height = 160,
  unit = 'game',
}) => {
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  useEffect(() => {
    const cv = canvasRef.current;
    if (!cv) return;
    const ch = cv.getContext('2d');
    if (!ch) return;

    const render = () => {
      const rect = cv.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      const w = Math.max(160, Math.round(rect.width));
      const h = Math.max(100, Math.round(height));

      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) {
        cv.width = Math.round(w * dpr);
        cv.height = Math.round(h * dpr);
      }

      ch.setTransform(dpr, 0, 0, dpr, 0, 0);
      ch.clearRect(0, 0, w, h);

      // Bucket data
      const pts: number[] = [];
      for (let i = 0; i + bucketSize <= series.length; i += bucketSize) {
        let s = 0;
        for (let j = i; j < i + bucketSize; j++) s += series[j];
        pts.push(s / bucketSize);
      }

      const L = 34,
        R = 12,
        T = 10,
        B = 20,
        pw = w - L - R,
        ph = h - T - B;
      const mx = Math.max(3, Math.ceil(Math.max(0, ...pts) * 1.1));

      ch.font = "600 10px 'Archivo', system-ui, sans-serif";
      ch.textBaseline = 'middle';

      // Grid lines
      for (let k = 0; k <= 4; k++) {
        const y = T + ph - (k / 4) * ph;
        ch.strokeStyle = k ? 'rgba(255,255,255,0.07)' : 'rgba(255,255,255,0.22)';
        ch.lineWidth = 1;
        ch.beginPath();
        ch.moveTo(L, Math.round(y) + 0.5);
        ch.lineTo(w - R, Math.round(y) + 0.5);
        ch.stroke();
        ch.fillStyle = '#8f9ba8';
        ch.textAlign = 'right';
        ch.fillText(fmt((mx * k) / 4), L - 6, y);
      }

      const vis = Math.min(pts.length, 200);
      const st = pts.length - vis;
      ch.textBaseline = 'alphabetic';

      if (!pts.length) {
        ch.fillStyle = '#8f9ba8';
        ch.textAlign = 'center';
        ch.fillText(`Menunggu ${bucketSize} game pertama untuk titik awal`, L + pw / 2, T + ph / 2);
        return;
      }

      const xOf = (i: number) => (vis > 1 ? L + (i / (vis - 1)) * pw : L + pw / 2);
      const yOf = (v: number) => T + ph - (v / mx) * ph;

      // Area gradient
      const g = ch.createLinearGradient(0, T, 0, T + ph);
      g.addColorStop(0, 'rgba(255,155,33,0.38)');
      g.addColorStop(1, 'rgba(255,155,33,0)');

      if (vis > 1) {
        ch.beginPath();
        for (let i = 0; i < vis; i++) {
          const x = xOf(i),
            y = yOf(pts[st + i]);
          i ? ch.lineTo(x, y) : ch.moveTo(x, y);
        }
        ch.lineTo(xOf(vis - 1), T + ph);
        ch.lineTo(xOf(0), T + ph);
        ch.closePath();
        ch.fillStyle = g;
        ch.fill();

        // Stroke line
        ch.beginPath();
        for (let i = 0; i < vis; i++) {
          const x = xOf(i),
            y = yOf(pts[st + i]);
          i ? ch.lineTo(x, y) : ch.moveTo(x, y);
        }
        ch.strokeStyle = '#ff9b21';
        ch.lineWidth = 2;
        ch.lineJoin = 'round';
        ch.stroke();
      }

      // Latest point dot and score
      const lv = pts[pts.length - 1];
      const lx = xOf(vis - 1);
      const ly = yOf(lv);

      ch.fillStyle = '#ff9b21';
      ch.beginPath();
      ch.arc(lx, ly, 3.5, 0, Math.PI * 2);
      ch.fill();

      ch.font = "700 11px 'Archivo', system-ui, sans-serif";
      ch.textAlign = lx > w - R - 30 ? 'right' : 'left';
      ch.fillStyle = '#12161b';
      ch.lineWidth = 3;
      ch.strokeStyle = '#12161b';

      const tx = lx > w - R - 30 ? lx - 7 : lx + 7;
      const ty = Math.max(T + 9, Math.min(T + ph - 4, ly - 8));
      ch.strokeText(fmt(lv), tx, ty);
      ch.fillStyle = '#fff';
      ch.fillText(fmt(lv), tx, ty);

      // Footer labels
      ch.font = "600 10px 'Archivo', system-ui, sans-serif";
      ch.fillStyle = '#8f9ba8';
      ch.textAlign = 'left';
      ch.fillText(`${unit} ${(st + 1) * bucketSize}`, L, h - 5);
      ch.textAlign = 'right';
      ch.fillText(`${unit} ${pts.length * bucketSize}`, w - R, h - 5);
    };

    render();

    const ro = new ResizeObserver(() => {
      render();
    });
    ro.observe(cv);

    return () => ro.disconnect();
  }, [series, bucketSize, height, unit]);

  return (
    <div className="w-full bg-[var(--field)] border border-[#06080a] rounded-[3px] shadow-[inset_0_1px_4px_rgba(0,0,0,0.7)] overflow-hidden">
      <canvas ref={canvasRef} style={{ width: '100%', height: `${height}px`, display: 'block' }} />
    </div>
  );
};
