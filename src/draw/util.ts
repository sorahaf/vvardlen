import type { BrushType, Pt, WaveShape } from './types.js';

/* ---------- ตรวจค่า ---------- */
export const TYPES: BrushType[] = ['pencil','pixel','wave','paint','outline','eraser'];
export const SHAPES: WaveShape[] = ['zigzag','sine','coil'];
/** ตัวเลขในช่วง lo ถึง hi ถ้าไม่ใช่ตัวเลขให้ใช้ค่า def */
export const clampN = (v: unknown, lo: number, hi: number, def: number) => (typeof v === 'number' && isFinite(v)) ? Math.min(hi, Math.max(lo, v)) : def;
export const r2 = (v: number) => Math.round(v * 100) / 100;

/* ---------- utils ---------- */
export function hash(a: number, b: number, c: number){
  let h = Math.imul(a|0, 374761393) ^ Math.imul((b|0) + 1013, 668265263) ^ Math.imul((c|0) + 7919, 1274126177);
  h = Math.imul(h ^ (h >>> 13), 1103515245);
  h ^= h >>> 16;
  h = Math.imul(h, 2246822519);
  h ^= h >>> 13;
  return (h >>> 0) / 4294967296;
}
export function mulberry(a: number){ return () => { a |= 0; a = a + 0x6D2B79F5 | 0; let t = Math.imul(a ^ a >>> 15, 1 | a); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; }; }

export function smooth(pts: Pt[]): Pt[]{
  if (pts.length < 3) return pts.slice();
  const out = [pts[0]];
  for (let i = 1; i < pts.length - 1; i++){
    const a = pts[i-1], b = pts[i], c = pts[i+1];
    out.push({x:(a.x + b.x*2 + c.x)/4, y:(a.y + b.y*2 + c.y)/4});
  }
  out.push(pts[pts.length-1]);
  return out;
}
export function resample(pts: Pt[], step: number): Pt[]{
  if (!pts.length) return [];
  if (pts.length === 1) return [{x:pts[0].x, y:pts[0].y}, {x:pts[0].x + .3, y:pts[0].y + .1}];
  const out = [{x:pts[0].x, y:pts[0].y}];
  let prev = {x:pts[0].x, y:pts[0].y}, acc = 0;
  for (let i = 1; i < pts.length; i++){
    const p = pts[i];
    let d = Math.hypot(p.x - prev.x, p.y - prev.y);
    while (acc + d >= step && d > 0){
      const t = (step - acc) / d;
      const n = {x:prev.x + (p.x - prev.x)*t, y:prev.y + (p.y - prev.y)*t};
      out.push(n); prev = n; acc = 0;
      d = Math.hypot(p.x - prev.x, p.y - prev.y);
    }
    acc += d; prev = {x:p.x, y:p.y};
  }
  const last = pts[pts.length-1];
  if (acc > step*0.25 || out.length < 2) out.push({x:last.x, y:last.y});
  return out;
}
export function jitter(pts: Pt[], amp: number, seed: number, v: number, K: number): Pt[]{
  const n = pts.length, out: Pt[] = new Array(n);
  if (amp <= 0) return pts;
  const nc = Math.ceil(n / K) + 2, ox = new Float32Array(nc), oy = new Float32Array(nc);
  for (let j = 0; j < nc; j++){
    ox[j] = (hash(seed, j, v*2+1)*2 - 1) * amp;
    oy[j] = (hash(seed, j, v*2+2)*2 - 1) * amp;
  }
  for (let i = 0; i < n; i++){
    const f = i / K, j = Math.floor(f), t = f - j, s = t*t*(3 - 2*t);
    const dx = ox[j] + (ox[j+1] - ox[j])*s + (hash(seed + 7, i, v) - .5) * amp * .3;
    const dy = oy[j] + (oy[j+1] - oy[j])*s + (hash(seed + 13, i, v) - .5) * amp * .3;
    out[i] = {x:pts[i].x + dx, y:pts[i].y + dy};
  }
  return out;
}
export function curvePath(p: Pt[]){
  const path = new Path2D();
  path.moveTo(p[0].x, p[0].y);
  if (p.length < 3){ for (let i = 1; i < p.length; i++) path.lineTo(p[i].x, p[i].y); return path; }
  for (let i = 1; i < p.length - 1; i++){
    const mx = (p[i].x + p[i+1].x)/2, my = (p[i].y + p[i+1].y)/2;
    path.quadraticCurveTo(p[i].x, p[i].y, mx, my);
  }
  const l = p[p.length-1]; path.lineTo(l.x, l.y);
  return path;
}
