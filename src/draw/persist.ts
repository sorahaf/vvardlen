import { G, room, state } from './core.js';
import { SHAPES, TYPES, clampN, resample } from './util.js';
import { PAPERS } from './paper.js';
import { MAX_LAYERS, layerOf } from './layers.js';
import { toast } from './ui.js';
import { pk } from './picker.js';
import type { Layer, Stroke } from './types.js';

/* ---------- persistence (เฉพาะเบราว์เซอร์นี้) ---------- */
const KEY = 'yukyik-sketch-v1';
export let saveT: number | undefined;
let warned = false;
export function save(){
  clearTimeout(saveT);
  saveT = setTimeout(saveNow, 400);
}
// บันทึกทันที (ใช้ตอนออกจากหน้าหรือสลับแอป ไม่ให้ของที่เพิ่งทำหาย)
function saveNow(){
  clearTimeout(saveT); saveT = undefined;
  {
    try {
      const data = {
        settings:{brush:state.brush, color:state.color, pmode:pk.m, size:state.size, flow:state.flow, wiggle:state.wiggle, pixel:state.pixel, amp:state.amp, wavelen:state.wavelen, shape:state.shape, op:state.op, oc:state.oc, ow:state.ow, tip:state.tip, fps:state.fps, playing:state.playing, paper:state.paper},
        layers:G.layers.map(l => ({id:l.id, name:l.name, visible:l.visible, opacity:l.opacity})), active:G.activeLayer,
        strokes:(room.active && room.solo ? room.solo.strokes : G.strokes).map(s => ({type:s.type, color:s.color, size:s.size, seed:s.seed, wiggle:s.wiggle, pixel:s.pixel, amp:s.amp, wavelen:s.wavelen, shape:s.shape, flow:s.flow, op:s.op, oc:s.oc, ow:s.ow, pw:s.pw,
          layer:s.layer, iso:s.iso, isoA:s.isoA,
          pts:s.pts.map(p => [Math.round(p.x*10)/10, Math.round(p.y*10)/10])}))
      };
      localStorage.setItem(KEY, JSON.stringify(data));
    } catch (_) {
      if (!warned){ warned = true; toast('ที่เก็บรูปในเบราว์เซอร์เต็มแล้ว รูปล่าสุดอาจไม่ถูกเก็บไว้'); }
    }
  }
}
export function load(){
  let d: any = null;   // ข้อมูลจากที่เก็บในเบราว์เซอร์ ตรวจทุกค่าก่อนใช้
  try { d = JSON.parse(localStorage.getItem(KEY) || 'null'); } catch (_) {}
  if (!d || typeof d !== 'object') return;
  const S = d.settings || {};
  if (TYPES.includes(S.brush)) state.brush = S.brush;
  if (/^#[0-9a-f]{6}$/.test(S.color)) state.color = S.color;
  if (S.pmode === 'hsv' || S.pmode === 'ok') pk.m = S.pmode;
  if (SHAPES.includes(S.shape)) state.shape = S.shape;
  if (['ink','white','auto'].includes(S.oc)) state.oc = S.oc;
  if (S.tip === 'taper' || S.tip === 'round') state.tip = S.tip;
  state.op = clampN(S.op, .05, 1, state.op);
  state.ow = clampN(S.ow, 1, 10, state.ow);
  if (PAPERS[S.paper]) state.paper = S.paper;
  if (typeof S.playing === 'boolean') state.playing = S.playing;
  state.size = clampN(S.size, 1, 30, state.size);
  state.wiggle = clampN(S.wiggle, 0, 6, state.wiggle);
  state.pixel = clampN(S.pixel, 3, 20, state.pixel);
  state.amp = clampN(S.amp, 2, 26, state.amp);
  state.wavelen = clampN(S.wavelen, 6, 60, state.wavelen);
  state.fps = clampN(S.fps, 2, 24, state.fps);
  state.flow = clampN(S.flow, .1, 1, state.flow);
  if (Array.isArray(d.layers)){
    const seen = new Set<number>(), ok: Layer[] = [];
    for (const l of d.layers.slice(0, MAX_LAYERS)){
      if (!l || !Number.isInteger(l.id) || l.id < 1 || l.id > 1e6 || seen.has(l.id)) continue;
      seen.add(l.id);
      ok.push({id:l.id, name:typeof l.name === 'string' && l.name.trim() ? l.name.slice(0, 20) : 'เลเยอร์ ' + l.id,
        visible:l.visible !== false, opacity:clampN(l.opacity, 0, 1, 1)});
    }
    if (ok.length){ G.layers = ok; G.activeLayer = layerOf(d.active) ? d.active : ok[ok.length - 1].id; }
  }
  if (!Array.isArray(d.strokes)) return;
  G.strokes = [];
  const intList = (v: unknown): number[] | null => Array.isArray(v) && v.length <= MAX_LAYERS && v.every(Number.isInteger) ? v : null;
  for (const s of d.strokes){
    if (!s || !TYPES.includes(s.type) || !Array.isArray(s.pts)) continue;
    const pts = s.pts.filter((p: unknown) => Array.isArray(p) && isFinite(p[0]) && isFinite(p[1])).map((p: number[]) => ({x:+p[0], y:+p[1]}));
    if (!pts.length) continue;
    const st: Stroke = {
      type:s.type, color:/^#[0-9a-f]{6}$/.test(s.color) ? s.color : '#2a2420', size:clampN(s.size, .05, 400, 4),
      seed:clampN(s.seed, -2e9, 2e9, 1)|0, wiggle:clampN(s.wiggle, 0, 10, 2), pixel:clampN(s.pixel, 1, 200, 6),
      amp:clampN(s.amp, 0, 400, 7), wavelen:clampN(s.wavelen, 2, 800, 18), shape:SHAPES.includes(s.shape) ? s.shape : 'zigzag',
      flow:clampN(s.flow, .05, 1, .55), op:clampN(s.op, .05, 1, 1), oc:/^#[0-9a-f]{6}$/.test(s.oc) ? s.oc : '#2a2420', ow:clampN(s.ow, .05, 100, 3),
      pts:pts.length > 1 ? pts : resample(pts, 3), wpts:[], cache:{},
      layer:layerOf(s.layer) ? s.layer : G.layers[0].id   // รูปเก่าที่ยังไม่มีเลเยอร์ อยู่เลเยอร์ล่างสุด
    };
    const iso = intList(s.iso);
    if (iso && iso.length){
      st.iso = iso;
      st.isoA = Array.isArray(s.isoA) && s.isoA.length === iso.length ? s.isoA.map((a: unknown) => clampN(a, 0, 1, 1)) : iso.map(() => 1);
    }
    if (st.type === 'wave') st.wpts = resample(st.pts, 1);
    if (st.type === 'outline' && Array.isArray(s.pw) && s.pw.length === st.pts.length) st.pw = s.pw.map((v: unknown) => clampN(v, 0, 1, 1));
    G.strokes.push(st);
  }
}

export function initPersist(){
  window.addEventListener('pagehide', () => { if (saveT) saveNow(); });
  document.addEventListener('visibilitychange', () => { if (document.visibilityState === 'hidden' && saveT) saveNow(); });
}
