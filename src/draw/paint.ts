import { G, inkC, viewS, viewX, viewY } from './core.js';
import { hash, mulberry } from './util.js';
import type { Geom, PaintBake, PaintDab, Stroke } from './types.js';

/* ---------- แปรงสีน้ำมัน ----------
   ประทับลายปลายพู่กัน (ขอบขุย มีลายขนแปรง) เรียงตามเส้น แต่ละรอยโปร่งนิด ๆ ทาทับกันแล้วสีจึงซ้อนและไล่เข้ากันเอง */
export const PAINT_K = 2.5;          // แปรงสีน้ำมันใหญ่กว่าแปรงอื่น 2.5 เท่าที่ความหนาเท่ากัน
const TIP = 128, TIP_VARIANTS = 4;
const tipCache: HTMLCanvasElement[] = [];
function valueNoise(seed: number, cells: number){
  const rnd = mulberry(seed), g: number[] = [];
  for (let i = 0; i < (cells + 1) * (cells + 1); i++) g.push(rnd());
  return (x: number, y: number) => {   // x, y อยู่ในช่วง 0..1
    const fx = x * cells, fy = y * cells, ix = Math.min(cells - 1, Math.floor(fx)), iy = Math.min(cells - 1, Math.floor(fy));
    const tx = fx - ix, ty = fy - iy, sx = tx*tx*(3 - 2*tx), sy = ty*ty*(3 - 2*ty), w = cells + 1;
    const a = g[iy*w + ix], b = g[iy*w + ix + 1], c = g[(iy+1)*w + ix], d = g[(iy+1)*w + ix + 1];
    return a + (b - a)*sx + (c - a)*sy + (a - b - c + d)*sx*sy;
  };
}
function paintTip(v: number){
  if (tipCache[v]) return tipCache[v];
  const c = document.createElement('canvas'); c.width = c.height = TIP;
  const g = c.getContext('2d')!, im = g.createImageData(TIP, TIP), d = im.data;
  const edgeN = valueNoise(101 + v, 7), grainN = valueNoise(202 + v, 44), rnd = mulberry(303 + v);
  const rows = valueNoise(404 + v, 40);   // ลายขนแปรงวิ่งตามแนวนอน
  for (let y = 0; y < TIP; y++) for (let x = 0; x < TIP; x++){
    const u = x / TIP, w = y / TIP, nx = (x - TIP/2) / (TIP*.47), ny = (y - TIP/2) / (TIP*.3);
    const dist = Math.sqrt(nx*nx + ny*ny) + (edgeN(u, w) - .5) * .6;
    let a = 1 - Math.min(1, Math.max(0, (dist - .62) / .3));   // ขอบคมกว่าเดิม แต่ยังขุย ๆ
    a = a*a*(3 - 2*a);
    const bristle = rows(.5, w) * (.6 + .4 * rows(u * .2, w));
    a *= .35 + .65 * bristle;                                   // ลายขนแปรงชัดขึ้น
    a *= .45 + .55 * grainN(u, w);                              // เนื้อสีเป็นเม็ด ๆ
    if (rnd() < .08 + dist * .25) a *= .15;   // จุดแห้งที่สีไม่ติด เยอะขึ้นตรงขอบ
    d[(y*TIP + x)*4 + 3] = Math.max(0, Math.min(255, a * 255));
  }
  g.putImageData(im, 0, 0);
  return tipCache[v] = c;
}
const spriteCache = new Map<string, HTMLCanvasElement>();
function shade(hex: string, t: number){   // t: 0 สีเดิม, 1 อ่อนลง, 2 เข้มขึ้น
  const n = parseInt(hex.slice(1), 16), r = n >> 16, g = n >> 8 & 255, b = n & 255;
  const mix = t === 1 ? [255, .2] : t === 2 ? [0, .16] : [0, 0];
  const f = (c: number) => Math.round(c + (mix[0] - c) * mix[1]);
  return `rgb(${f(r)},${f(g)},${f(b)})`;
}
function paintSprite(color: string, v: number, t: number){
  const key = color + v + t;
  let c = spriteCache.get(key);
  if (c) return c;
  if (spriteCache.size > 120) spriteCache.delete(spriteCache.keys().next().value!);
  c = document.createElement('canvas'); c.width = c.height = TIP;
  const g = c.getContext('2d')!;
  g.drawImage(paintTip(v), 0, 0);
  g.globalCompositeOperation = 'source-in';
  g.fillStyle = shade(color, t); g.fillRect(0, 0, TIP, TIP);
  spriteCache.set(key, c);
  return c;
}
export function buildPaint(s: Stroke, v: number): Geom{
  const p = s.pts, n = p.length, stamps: PaintDab[] = [];
  const step = Math.max(1, Math.round(s.size * .14 / 3));   // จุดบนเส้นห่างกัน 3 หน่วย
  const shimmer = s.size * .05 * (.3 + s.wiggle / 3);
  for (let i = 0; i < n; i += step){
    const a = p[Math.max(0, i - 2)], b = p[Math.min(n - 1, i + 2)];
    const ang = Math.atan2(b.y - a.y, b.x - a.x);
    const head = Math.min(1, (i + 1) / (n * .12 + 2)), tail = Math.min(1, (n - i) / (n * .18 + 2));
    const taper = .35 + .65 * Math.min(head, tail);
    stamps.push({
      x:p[i].x + (hash(s.seed, i, v*3 + 1) - .5) * shimmer,
      y:p[i].y + (hash(s.seed, i, v*3 + 2) - .5) * shimmer,
      r:s.size * taper * (.85 + .3 * hash(s.seed + 2, i, 0)),
      rot:ang + (hash(s.seed + 5, i, 0) - .5) * .5 + (hash(s.seed + 9, i, v) - .5) * .08 * s.wiggle,
      a:s.flow * (.38 + .4 * hash(s.seed + 3, i, 0)),
      v:Math.floor(hash(s.seed + 4, i, 0) * TIP_VARIANTS), t:Math.floor(hash(s.seed + 6, i, 0) * 3)
    });
  }
  return {stamps};
}
// รวมรอยพู่กันทั้งเส้นเป็นภาพเดียว (ทำครั้งเดียวต่อเส้น) แล้ววาดภาพนั้นทุกเฟรม เร็วกว่าประทับทีละรอยมาก
export function bakePaint(s: Stroke): PaintBake{
  const stamps = buildPaint(s, 0).stamps!;
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const st of stamps){ x0 = Math.min(x0, st.x - st.r); y0 = Math.min(y0, st.y - st.r); x1 = Math.max(x1, st.x + st.r); y1 = Math.max(y1, st.y + st.r); }
  const bw = Math.max(1, x1 - x0), bh = Math.max(1, y1 - y0);
  // ความละเอียดของภาพ = ความคมที่เห็นบนจอตอนนี้ แต่ไม่เกิน 2048 จุดต่อด้าน และไม่เกิน 4 ล้านจุดทั้งภาพ (กันกินหน่วยความจำ)
  const q = Math.max(.25, Math.min(G.DPR * viewS(), 2048 / Math.max(bw, bh), Math.sqrt(4e6 / (bw * bh))));
  const c = document.createElement('canvas'); c.width = Math.ceil(bw * q); c.height = Math.ceil(bh * q);
  const g = c.getContext('2d')!;
  for (const st of stamps){
    const k = q * st.r / (TIP * .47), cs = Math.cos(st.rot) * k, sn = Math.sin(st.rot) * k;
    g.globalAlpha = st.a;
    g.setTransform(cs, sn, -sn, cs, (st.x - x0) * q, (st.y - y0) * q);
    g.drawImage(paintSprite(s.color, st.v, st.t), -TIP/2, -TIP/2);
  }
  return {img:c, x:x0, y:y0, w:bw, h:bh, q};
}
export function drawPaintImage(s: Stroke, b: PaintBake){
  // ภาพทั้งเส้นขยับเล็กน้อยตามจังหวะ ให้ยุกยิกเหมือนแปรงอื่น
  const j = s.size * .025 * s.wiggle;
  G.ctx.drawImage(b.img, b.x + (hash(s.seed, G.bf, 7) - .5) * j, b.y + (hash(s.seed, G.bf, 8) - .5) * j, b.w, b.h);
}
interface LiveLayer { c: HTMLCanvasElement; g: CanvasRenderingContext2D; stroke: Stroke; view: string; done: number; }
let liveLayer: LiveLayer | null = null;
export function drawPaint(s: Stroke, geo: Geom){
  const stamps = geo.stamps!;
  const k0 = G.DPR * viewS(), ox = G.DPR * viewX(), oy = G.DPR * viewY();
  if (s === G.current){
    // เส้นที่กำลังวาด: เก็บรอยที่วาดไปแล้วไว้ในชั้นของตัวเอง เติมเฉพาะรอยใหม่
    const view = [inkC.width, inkC.height, k0, ox, oy, s.color].join('|');
    if (!liveLayer || liveLayer.stroke !== s || liveLayer.view !== view){
      const c = liveLayer && liveLayer.c.width === inkC.width && liveLayer.c.height === inkC.height ? liveLayer.c : document.createElement('canvas');
      c.width = inkC.width; c.height = inkC.height;
      liveLayer = {c, g:c.getContext('2d')!, stroke:s, view, done:0};
    }
    const L = liveLayer;
    for (let i = L.done; i < stamps.length - 1; i++){   // รอยสุดท้ายยังขยับได้ เลยยังไม่วาดลงชั้น
      const st = stamps[i], k = k0 * st.r / (TIP * .47), c = Math.cos(st.rot) * k, sn = Math.sin(st.rot) * k;
      L.g.globalAlpha = st.a;
      L.g.setTransform(c, sn, -sn, c, ox + k0 * st.x, oy + k0 * st.y);
      L.g.drawImage(paintSprite(s.color, st.v, st.t), -TIP/2, -TIP/2);
    }
    L.done = Math.max(L.done, stamps.length - 1);
    G.ctx.setTransform(1, 0, 0, 1, 0, 0); G.ctx.globalAlpha = 1;
    G.ctx.drawImage(L.c, 0, 0);
    return;
  }
  // เส้นสดของเพื่อนในห้อง: วาดทีละรอย (ข้ามบางรอยเพื่อความเร็ว)
  const skip = stamps.length > 300 ? 2 : 1;
  for (let n = 0; n < stamps.length; n += skip){
    const st = stamps[n];
    const k = k0 * st.r / (TIP * .47), c = Math.cos(st.rot) * k, sn = Math.sin(st.rot) * k;
    G.ctx.globalAlpha = Math.min(1, st.a * skip);
    G.ctx.setTransform(c, sn, -sn, c, ox + k0 * st.x, oy + k0 * st.y);
    G.ctx.drawImage(paintSprite(s.color, st.v, st.t), -TIP/2, -TIP/2);
  }
}
