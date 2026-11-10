import { G, WAVE_FRAMES, state, viewS } from './core.js';
import { curvePath, jitter, mulberry } from './util.js';
import { bakePaint, buildPaint } from './paint.js';
import type { Geom, OutlineBake, Pt, RawPt, Ribbon, Stroke } from './types.js';

/* ---------- pencil grain ---------- */
const grainCache = new Map<string, CanvasPattern | null>();
export function grain(color: string){
  let pat = grainCache.get(color);
  if (pat) return pat;
  if (grainCache.size > 48) grainCache.delete(grainCache.keys().next().value!);   // ลากเลือกสีเองจะได้ไม่สะสมไม่รู้จบ
  const c = document.createElement('canvas'); c.width = c.height = 128;
  const g = c.getContext('2d')!;
  g.fillStyle = color; g.fillRect(0, 0, 128, 128);
  const id = g.getImageData(0, 0, 128, 128), d = id.data, rnd = mulberry(42);
  for (let i = 0; i < d.length; i += 4){
    const r = rnd();
    d[i+3] = r < .14 ? 50 + rnd()*40 : 165 + rnd()*90;
  }
  g.putImageData(id, 0, 0);
  pat = G.ctx.createPattern(c, 'repeat');
  grainCache.set(color, pat);
  return pat;
}

/* ---------- geometry builders ---------- */
function buildPencil(s: Stroke, v: number): Geom{
  const amp = s.wiggle * (0.55 + s.size * 0.07);
  const main = jitter(s.pts, amp, s.seed, v, 7);
  const ghost = jitter(s.pts, amp * 1.25 + .4, s.seed + 101, v, 6);
  return {main:curvePath(main), ghost:curvePath(ghost)};
}
function buildPixel(s: Stroke, v: number): Geom{
  const cell = s.pixel;
  const t = Math.max(1, Math.round(s.size / cell));
  const off = Math.floor((t - 1) / 2);
  const jp = jitter(s.pts, s.wiggle * cell * 0.25, s.seed, v, 5);
  const seen = new Set<string>(), path = new Path2D();
  const stamp = (cx: number, cy: number) => {
    for (let dx = 0; dx < t; dx++) for (let dy = 0; dy < t; dy++){
      const X = cx + dx - off, Y = cy + dy - off, k = X + ',' + Y;
      if (!seen.has(k)){ seen.add(k); path.rect(X*cell, Y*cell, cell, cell); }
    }
  };
  let px: number | null = null, py = 0;
  for (const p of jp){
    const cx = Math.floor(p.x / cell), cy = Math.floor(p.y / cell);
    if (px === null){ stamp(cx, cy); }
    else if (cx !== px || cy !== py){
      // Bresenham
      let x0: number = px, y0 = py; const dx = Math.abs(cx - x0), dy = -Math.abs(cy - y0);
      const sx = x0 < cx ? 1 : -1, sy = y0 < cy ? 1 : -1; let err = dx + dy;
      while (true){
        stamp(x0, y0);
        if (x0 === cx && y0 === cy) break;
        const e2 = 2*err;
        if (e2 >= dy){ err += dy; x0 += sx; }
        if (e2 <= dx){ err += dx; y0 += sy; }
      }
    }
    px = cx; py = cy;
  }
  return {fill:path};
}
function buildWave(s: Stroke, f: number): Geom{
  const p = s.wpts, n = p.length, path = new Path2D();
  const L = (n - 1);              // wpts resampled at 1px
  const phase = f / WAVE_FRAMES * Math.PI * 2;
  const k = Math.PI * 2 / s.wavelen;
  const taperLen = Math.min(12, s.wavelen * .6);
  for (let i = 0; i < n; i++){
    const a = p[Math.max(0, i - 3)], b = p[Math.min(n - 1, i + 3)];
    let tx = b.x - a.x, ty = b.y - a.y; const len = Math.hypot(tx, ty) || 1; tx /= len; ty /= len;
    const nx = -ty, ny = tx;
    const taper = Math.max(0, Math.min(1, i / taperLen, (L - i) / taperLen));
    const th = i * k - phase;
    let on = 0, ot = 0;
    if (s.shape === 'zigzag') on = (2 / Math.PI) * Math.asin(Math.sin(th));
    else if (s.shape === 'sine') on = Math.sin(th);
    else { on = Math.sin(th); ot = Math.cos(th) * .9; }
    const A = s.amp * taper;
    const x = p[i].x + nx*on*A + tx*ot*A, y = p[i].y + ny*on*A + ty*ot*A;
    if (i === 0) path.moveTo(x, y); else path.lineTo(x, y);
  }
  return {main:path};
}
function buildEraser(s: Stroke): Geom{ return {main:curvePath(s.pts)}; }
// ปากกาขอบ: เส้นสีมีขอบรอบ ขยับยุกยิกเหมือนดินสอแต่เบากว่า
export const OUTLINE_K = 2;   // เนื้อสีหนากว่าดินสอ 2 เท่าที่ความหนาเท่ากัน
// เส้นหนาบางไม่เท่ากัน: แบ่งเป็นช่วงตามความหนา แต่ละช่วงลากเป็นเส้นหัวมน วาดทับกันด้วยสีทึบจึงต่อกันเนียน
function ribbon(pts: Pt[], rad: number[]): Ribbon[]{
  const out: Ribbon[] = [], n = pts.length;
  for (let i = 0; i < n - 1;){
    const w = Math.round((rad[i] + rad[i+1]) * 4) / 4;   // ความกว้างของช่วง (ปัดทีละ 0.25)
    let j = i + 1;
    while (j < n - 1 && Math.round((rad[j] + rad[j+1]) * 4) / 4 === w) j++;
    if (w > .2){
      const path = new Path2D(); path.moveTo(pts[i].x, pts[i].y);
      for (let k = i + 1; k <= j; k++) path.lineTo(pts[k].x, pts[k].y);
      out.push({path, w});
    }
    i = j;
  }
  return out;
}
export function strokeRibbon(g: CanvasRenderingContext2D, rb: Ribbon[], color: string){
  g.lineCap = 'round'; g.lineJoin = 'round'; g.strokeStyle = color;
  for (const r of rb){ g.lineWidth = r.w; g.stroke(r.path); }
}
function buildOutline(s: Stroke, v: number): Geom{
  const pts = jitter(s.pts, s.wiggle * (.35 + s.size * .03), s.seed, v, 8), n = pts.length;
  const R: number[] = new Array(n), r: number[] = new Array(n), full = s.size / 2 + s.ow;
  for (let i = 0; i < n; i++){
    const f = s.pw && s.pw.length === n ? s.pw[i] : 1;
    R[i] = full * f; r[i] = Math.max(0, R[i] - s.ow);
  }
  return {outer:ribbon(pts, R), inner:ribbon(pts, r), pts, R};
}
// ความหนาแต่ละจุด: ปากกาที่มีแรงกดใช้แรงกด ส่วนเมาส์และนิ้วใช้ความเร็ว (ลากเร็วเส้นบาง) และหัวท้ายเรียวแหลมแบบสะบัด
export function outlineWidths(s: Stroke, rawPts: RawPt[] | null): number[]{
  const n = s.pts.length, out: number[] = new Array(n).fill(1);
  if (rawPts && rawPts.length > 1){
    const d = [0], f: number[] = [];
    for (let k = 1; k < rawPts.length; k++) d.push(d[k-1] + Math.hypot(rawPts[k].x - rawPts[k-1].x, rawPts[k].y - rawPts[k-1].y));
    let ema = 1;
    for (let k = 0; k < rawPts.length; k++){
      const q = rawPts[k];
      let v: number;
      if (q.pen && q.pr && q.pr > 0) v = .2 + .8 * Math.min(1, q.pr);
      else if (k === 0) v = 1;
      else {
        const dt = Math.max(4, (q.t || 0) - (rawPts[k-1].t || 0)), sp = (d[k] - d[k-1]) * viewS() / dt;   // พิกเซลต่อมิลลิวินาที
        v = Math.max(.45, Math.min(1, 1.15 - .22 * sp));
      }
      ema += (v - ema) * (q.pen ? .5 : .25); f.push(ema);
    }
    const total = d[d.length - 1] || 1;
    for (let i = 0, k = 0; i < n; i++){
      const at = Math.min(total, i * total / Math.max(1, n - 1));
      while (k < d.length - 2 && d[k+1] < at) k++;
      const t = Math.max(0, Math.min(1, (at - d[k]) / ((d[k+1] - d[k]) || 1)));
      out[i] = f[k] + (f[k+1] - f[k]) * t;
    }
  }
  const len = (n - 1) * 3, unit = s.size / 2 + s.ow;
  const head = Math.min(len * .3, unit * 2.2), tail = Math.min(len * .45, unit * 4.5);
  const ease = (x: number) => { x = Math.max(0, Math.min(1, x)); return x * (2 - x); };
  for (let i = 0; i < n; i++){
    const at = i * 3;
    out[i] = Math.round(out[i] * ease(.12 + at / (head || 1)) * ease(.05 + (len - at) / (tail || 1)) * 100) / 100;
  }
  return out;
}
let outlineSeq = 0;
const oid = (s: Stroke) => s._oid || (s._oid = ++outlineSeq);
// เส้นขอบที่ถูกยางลบ: วาดเป็นภาพแล้วตัดส่วนที่ลบออก เนื้อสีโดนตัดลึกกว่าเท่าความหนาขอบ เส้นขอบจึงตามรอยลบด้วย
function bakeOutlineRun(run: Stroke[], erasers: Stroke[], v: number): OutlineBake{
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  const gs = run.map(s => geom(s, v, 0, false));
  run.forEach((_, k) => { const g = gs[k]; g.pts!.forEach((p, i) => { const r = g.R![i];
    x0 = Math.min(x0, p.x - r); y0 = Math.min(y0, p.y - r); x1 = Math.max(x1, p.x + r); y1 = Math.max(y1, p.y + r); }); });
  x0 -= 2; y0 -= 2; x1 += 2; y1 += 2;
  const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0);
  const q = Math.max(.25, Math.min(G.DPR * viewS(), 2048 / Math.max(bw, bh), Math.sqrt(4e6 / (bw * bh))));
  const W2 = Math.ceil(bw * q), H2 = Math.ceil(bh * q);
  const c = document.createElement('canvas'); c.width = W2; c.height = H2;
  const g = c.getContext('2d')!, s0 = run[0];
  g.setTransform(q, 0, 0, q, -x0 * q, -y0 * q);
  for (const gg of gs) strokeRibbon(g, gg.outer!, s0.oc);
  const cut = (gg: CanvasRenderingContext2D, extra: number) => {
    gg.globalCompositeOperation = 'destination-out'; gg.lineCap = 'round'; gg.lineJoin = 'round'; gg.strokeStyle = '#000';
    for (const e of erasers){ gg.lineWidth = e.size + extra; gg.stroke(geom(e, 0, 0, false).main!); }
  };
  cut(g, 0);
  // เนื้อสีวาดแยกอีกแผ่น แล้วลบกว้างกว่ายางลบจริงเท่าความหนาขอบ ขอบสีเข้มจึงโผล่ตามรอยที่ลบ
  const m = document.createElement('canvas'); m.width = W2; m.height = H2;
  const mg = m.getContext('2d')!;
  mg.setTransform(q, 0, 0, q, -x0 * q, -y0 * q);
  for (const gg of gs) strokeRibbon(mg, gg.inner!, s0.color);
  cut(mg, s0.ow * 2);
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalCompositeOperation = 'source-over'; g.drawImage(m, 0, 0);
  return {img:c, x:x0, y:y0, w:bw, h:bh, q};
}
// วาดเส้นปากกาขอบที่อยู่ติดกันและสีเดียวกันพร้อมกัน: ขอบทั้งหมดก่อน แล้วค่อยเนื้อสี เส้นที่วาดต่อกันจึงเชื่อมเป็นชิ้นเดียว
export function drawOutlineRun(run: Stroke[], erasers: Stroke[], liveSet?: Set<Stroke>){
  if (erasers.length){
    const s0 = run[0], key = run.map(oid).join(',') + '|' + erasers.map(oid).join(',') + '|' + s0.color + s0.oc;
    if (!s0.runCache || s0.runCache.key !== key) s0.runCache = {key, img:[]};
    const b = s0.runCache.img[G.bf] || (s0.runCache.img[G.bf] = bakeOutlineRun(run, erasers, G.bf));
    G.ctx.drawImage(b.img, b.x, b.y, b.w, b.h);
    return;
  }
  const gs = run.map(s => geom(s, G.bf, G.wf, !!liveSet && liveSet.has(s)));
  G.ctx.save();
  for (const g of gs) strokeRibbon(G.ctx, g.outer!, run[0].oc);
  for (const g of gs) strokeRibbon(G.ctx, g.inner!, run[0].color);
  G.ctx.restore();
}
const sameIso = (a?: number[], b?: number[]) => { a = a || []; b = b || []; return a.length === b.length && a.every((x, i) => x === b[i]); };
const isoPrefix = (e?: number[], s?: number[]) => { e = e || []; s = s || []; return e.length <= s.length && e.every((x, i) => x === s[i]); };
// แบ่งรายการเส้นเป็นชุด: เส้นปากกาขอบที่ติดกันสีเดียวกันอยู่ชุดเดียวกัน พร้อมยางลบที่มาทีหลังและลบโดนชุดนั้น
interface PlanItem { s?: Stroke; run?: Stroke[]; erasers?: Stroke[]; iso?: number[]; }
export function planStrokes(list: Stroke[], liveSet?: Set<Stroke>): PlanItem[]{
  const out: PlanItem[] = [];
  for (let i = 0; i < list.length; i++){
    const s = list[i];
    if (s.type !== 'outline'){ out.push({s}); continue; }
    const run = [s];
    while (i + 1 < list.length){
      const t = list[i+1];
      if (t.type !== 'outline' || t.color !== s.color || t.oc !== s.oc || Math.abs(t.ow - s.ow) > 1e-6 || !sameIso(t.iso, s.iso)) break;
      run.push(t); i++;
    }
    const erasers: Stroke[] = [];
    for (let j = i + 1; j < list.length; j++){ const e = list[j]; if (e.type === 'eraser' && isoPrefix(e.iso, s.iso) && !(liveSet && liveSet.has(e))) erasers.push(e); }
    out.push({run, erasers, iso:s.iso});
  }
  return out;
}
function darker(hex: string){
  const n = parseInt(hex.slice(1), 16), f = (c: number) => Math.round(c * .45).toString(16).padStart(2, '0');
  return '#' + f(n >> 16) + f(n >> 8 & 255) + f(n & 255);
}
export function outlineColor(){ return state.oc === 'white' ? '#ffffff' : state.oc === 'auto' ? darker(state.color) : '#2a2420'; }

/** รูปเส้นของเฟรมที่ต้องการ (เก็บไว้ใช้ซ้ำ ยกเว้นเส้นที่กำลังวาด) */
export function geom(s: Stroke, vb: number, vw: number, live: boolean): Geom{
  const key = s.type === 'wave' ? 'w' + vw : (s.type === 'eraser' || s.type === 'paint') ? 'e' : 'b' + vb;
  if (!live && s.cache[key]) return s.cache[key];
  let g: Geom;
  if (s.type === 'pencil') g = buildPencil(s, vb);
  else if (s.type === 'pixel') g = buildPixel(s, vb);
  else if (s.type === 'wave') g = buildWave(s, vw);
  else if (s.type === 'paint') g = live ? buildPaint(s, 0) : {bake:bakePaint(s)};
  else if (s.type === 'outline') g = buildOutline(s, vb);
  else g = buildEraser(s);
  if (!live) s.cache[key] = g;
  return g;
}
