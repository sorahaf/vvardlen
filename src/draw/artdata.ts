import { G, room } from './core.js';
import { type PackedStroke, packStroke, unpackStroke } from './codec.js';
import { clampN, resample } from './util.js';
import type { Layer, Stroke } from './types.js';

/* ---------- แปลงทั้งรูป (ทุกเลเยอร์) เป็นข้อความสำหรับแกลเลอรี่ และแปลงกลับ ----------
   เก็บเป็นเส้น ไม่ใช่ภาพ เปิดดูแล้วเส้นยังขยับได้ และเอาไปวาดต่อได้ */
interface PackedArt { v: 1; L: { o: number }[]; S: (PackedStroke & { l: number; i?: number[]; ia?: number[] })[]; }
const MAX_STROKES = 4000;

/** รูปที่อยู่บนกระดาษตอนนี้ (ข้ามเลเยอร์ที่ซ่อนไว้) */
export function packDrawing(): { d: string; w: number; h: number; count: number }{
  let layers: Layer[], strokes: Stroke[];
  if (room.active){ layers = [{id:1, name:'', visible:true, opacity:1}]; strokes = G.strokes.map(s => ({...s, layer:1})); }
  else { layers = G.layers.filter(l => l.visible); strokes = G.strokes; }
  const index = new Map(layers.map((l, i) => [l.id, i]));
  const S: PackedArt['S'] = [];
  for (const s of strokes){
    const l = index.get(s.layer ?? -1);
    if (l === undefined || S.length >= MAX_STROKES) continue;
    const p: PackedArt['S'][number] = {...packStroke(s), l};
    if (s.iso && s.iso.length){ p.i = s.iso.slice(); p.ia = (s.isoA || []).slice(); }
    S.push(p);
  }
  const art: PackedArt = {v:1, L:layers.map(l => ({o:Math.round(l.opacity * 100) / 100})), S};
  const w = room.active ? 1000 : Math.round(G.W / G.VS), h = room.active ? 1000 : Math.round(G.H / G.VS);
  return {d:JSON.stringify(art), w, h, count:S.length};
}

/** แปลงกลับ ตรวจค่าทุกตัวเพราะข้อมูลมาจากคนอื่น */
export function unpackDrawing(d: string): { layers: Layer[]; strokes: Stroke[] } | null{
  let a: any;
  try { a = JSON.parse(d); } catch (_) { return null; }
  if (!a || a.v !== 1 || !Array.isArray(a.L) || !Array.isArray(a.S) || !a.L.length) return null;
  const layers: Layer[] = a.L.slice(0, 10).map((l: any, i: number) => ({id:i + 1, name:'', visible:true, opacity:clampN(l && l.o, 0, 1, 1)}));
  const ints = (v: unknown) => Array.isArray(v) && v.length <= 10 && v.every(Number.isInteger) ? v as number[] : undefined;
  const strokes: Stroke[] = [];
  for (const p of a.S.slice(0, MAX_STROKES)){
    const s = unpackStroke(p);
    if (!s || !Number.isInteger(p.l) || p.l < 0 || p.l >= layers.length) continue;
    s.layer = p.l + 1;
    const iso = ints(p.i);
    if (iso){ s.iso = iso; s.isoA = (Array.isArray(p.ia) ? p.ia : []).slice(0, iso.length).map((x: unknown) => clampN(x, 0, 1, 1)); }
    strokes.push(s);
  }
  return {layers, strokes};
}

/** ย่อหรือขยายเส้นและเลื่อนตำแหน่ง (ใช้ตอนเอารูปมาวาดต่อบนจอขนาดอื่น) */
export function scaleStroke(s: Stroke, k: number, dx: number, dy: number){
  s.pts = s.pts.map(p => ({x:p.x * k + dx, y:p.y * k + dy}));
  s.size *= k; s.ow *= k; s.pixel *= k; s.amp *= k; s.wavelen *= k;
  if (s.type === 'wave') s.wpts = resample(s.pts, 1);
  s.cache = {};
}
