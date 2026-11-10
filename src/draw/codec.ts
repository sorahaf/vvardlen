import { SHAPES, TYPES, clampN, r2, resample } from './util.js';
import type { BrushType, Pt, Stroke, WaveShape } from './types.js';

/* ---------- แปลงเส้นเป็นข้อมูลที่ส่งหรือเก็บได้ และแปลงกลับ ----------
   ใช้ทั้งห้องวาดกับเพื่อนและแกลเลอรี่ ตรวจค่าทุกตัวตอนแปลงกลับ เพราะข้อมูลมาจากคนอื่น */
export const MAX_PTS = 5000;

/** ข้อมูลเส้นแบบย่อ (ชื่อสั้นเพื่อประหยัดที่) */
export interface PackedStroke {
  t: BrushType; c: string; s: number; sd: number; w: number; px: number; a: number; wl: number; sh: WaveShape; p: string;
  fl?: number; op?: number; oc?: string; ow?: number; pw?: string;
}
/** maxPts ติดลบ = เก็บจุดท้ายสุด (ใช้กับเส้นที่กำลังวาด) */
export function packStroke(s: Stroke, maxPts = MAX_PTS): PackedStroke{
  let pts = s.pts;
  const lim = Math.abs(maxPts);
  if (pts.length > lim) pts = maxPts < 0 ? pts.slice(-lim) : pts.slice(0, lim);
  const p: number[] = new Array(pts.length * 2);
  for (let i = 0; i < pts.length; i++){ p[i*2] = Math.round(pts[i].x); p[i*2+1] = Math.round(pts[i].y); }
  const d: PackedStroke = {
    t:s.type, c:/^#[0-9a-f]{6}$/.test(s.color) ? s.color : '#2a2420',
    s:r2(clampN(s.size, .05, 400, 4)), sd:s.seed|0, w:r2(clampN(s.wiggle, 0, 10, 2)), px:r2(clampN(s.pixel, 1, 200, 6)),
    a:r2(clampN(s.amp, 0, 400, 7)), wl:r2(clampN(s.wavelen, 2, 800, 18)), sh:SHAPES.includes(s.shape) ? s.shape : 'zigzag',
    p:p.join(',')
  };
  if (s.type === 'paint') d.fl = r2(clampN(s.flow, .05, 1, .55));
  if (s.op !== undefined && s.op < 1) d.op = r2(clampN(s.op, .05, 1, 1));
  if (s.type === 'outline'){
    d.oc = /^#[0-9a-f]{6}$/.test(s.oc) ? s.oc : '#2a2420'; d.ow = r2(clampN(s.ow, .05, 100, 3));
    if (Array.isArray(s.pw) && s.pw.length === s.pts.length){
      const pw = s.pts.length === pts.length ? s.pw : maxPts < 0 ? s.pw.slice(-pts.length) : s.pw.slice(0, pts.length);
      d.pw = pw.map((v: number) => Math.round(clampN(v, 0, 1, 1) * 100)).join(',');
    }
  }
  return d;
}
export function unpackStroke(d: any): Stroke | null{   // d มาจากคนอื่น ตรวจทุกค่าก่อนใช้
  if (!d || typeof d !== 'object' || !TYPES.includes(d.t) || typeof d.p !== 'string' || d.p.length > 60000) return null;
  const nums = d.p.split(',', MAX_PTS * 2), pts: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2){
    const x = +nums[i], y = +nums[i+1];
    if (isFinite(x) && isFinite(y) && Math.abs(x) < 1e6 && Math.abs(y) < 1e6) pts.push({x, y});
  }
  if (!pts.length) return null;
  const s: Stroke = {
    type:d.t, color:/^#[0-9a-f]{6}$/.test(d.c) ? d.c : '#2a2420', size:clampN(d.s, .05, 400, 4), seed:clampN(d.sd, -2e9, 2e9, 1)|0,
    wiggle:clampN(d.w, 0, 10, 2), pixel:clampN(d.px, 2, 200, 6), amp:clampN(d.a, 0, 400, 7), wavelen:clampN(d.wl, 2, 800, 18), flow:clampN(d.fl, .05, 1, .55), op:clampN(d.op, .05, 1, 1),
    shape:SHAPES.includes(d.sh) ? d.sh : 'zigzag',
    oc:/^#[0-9a-f]{6}$/.test(d.oc) ? d.oc : '#2a2420', ow:clampN(d.ow, .05, 100, 3),
    pts:pts.length > 1 ? pts : [pts[0], {x:pts[0].x + .3, y:pts[0].y + .1}], wpts:[], cache:{}
  };
  if (s.type === 'wave') s.wpts = resample(s.pts, 1);
  if (s.type === 'outline' && typeof d.pw === 'string' && d.pw.length <= 30000){
    const pw = d.pw.split(',').map((v: string) => clampN(+v / 100, 0, 1, 1));
    if (pw.length === s.pts.length) s.pw = pw;
  }
  return s;
}
