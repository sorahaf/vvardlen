import { $, G, mainCtx, room } from './core.js';
import { drawOutlineRun, planStrokes } from './geometry.js';
import { drawStroke } from './render.js';
import { pushHistory } from './history.js';
import { closeLayerPop, toast, updateUI } from './ui.js';
import { endAdjust } from './adjust.js';
import { save } from './persist.js';
import type { Snapshot, Stroke } from './types.js';

type Matrix = [number, number, number, number, number, number];

/* ---------- layers (วาดคนเดียว) ----------
   เลเยอร์คือกลุ่มของเส้น แต่ละเส้นรู้ว่าอยู่เลเยอร์ไหน (s.layer)
   ยางลบลบได้เฉพาะในเลเยอร์ของตัวเอง เพราะแต่ละเลเยอร์วาดลงพื้นที่ร่างของตัวเองก่อนรวมลงจอ
   ตอนรวมเลเยอร์ เส้นจากเลเยอร์บนจะถูกห่อเป็นกลุ่ม (s.iso) ยางลบของเลเยอร์บนจึงยังไม่ไปลบเลเยอร์ล่าง ภาพหลังรวมเหมือนเดิมทุกจุด */
export const MAX_LAYERS = 10;
export const layerOf = (id: number | undefined) => G.layers.find(l => l.id === id);
const activeIndex = () => G.layers.findIndex(l => l.id === G.activeLayer);
export const scratchPool: HTMLCanvasElement[] = [], thumbPool: HTMLCanvasElement[] = [];
function scratch(pool: HTMLCanvasElement[], i: number, w: number, h: number){
  let c = pool[i];
  if (!c){ c = pool[i] = document.createElement('canvas'); }
  if (c.width !== w || c.height !== h){ c.width = w; c.height = h; }
  const g = c.getContext('2d')!;
  g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = 1; g.globalCompositeOperation = 'source-over';
  g.clearRect(0, 0, w, h);
  return c;
}
/** วาดทุกเลเยอร์ลง target ด้วยการแปลงพิกัด T (กระดาษ -> พิกเซล) */
export function renderLayers(target: CanvasRenderingContext2D, T: Matrix, w: number, h: number, pool: HTMLCanvasElement[], withLive: boolean){
  const byLayer = new Map<number, Stroke[]>(G.layers.map(l => [l.id, []]));
  for (const s of G.strokes){ const list = s.layer === undefined ? undefined : byLayer.get(s.layer); if (list) list.push(s); }
  for (const L of G.layers){
    if (!L.visible) continue;
    const base = byLayer.get(L.id)!, live = withLive && G.current && G.current.layer === L.id ? G.current : null;
    if (!base.length && !live) continue;
    const list = live ? base.concat([live]) : base, liveSet = new Set(live ? [live] : []), plan = planStrokes(list, liveSet);
    // ทางลัด: เลเยอร์ทึบ ไม่มียางลบ ไม่มีกลุ่ม วาดลงจอตรง ๆ ได้เลย
    if (L.opacity >= 1 && !list.some(s => s.type === 'eraser' || (s.iso && s.iso.length))){
      G.ctx = target; G.ctx.setTransform(...T);
      for (const it of plan){ if (it.run) drawOutlineRun(it.run, it.erasers!, liveSet); else drawStroke(it.s!, it.s === live); }
      continue;
    }
    const stack = [{c:scratch(pool, 0, w, h), a:1}], path: number[] = [];
    const flush = () => {
      const top = stack.pop()!; path.pop();
      const g = stack[stack.length - 1].c.getContext('2d')!;
      g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.globalAlpha = top.a; g.drawImage(top.c, 0, 0); g.restore();
    };
    for (const it of plan){
      const s = it.run ? it.run[0] : it.s!;
      const iso = s.iso || [];
      let k = 0; while (k < path.length && k < iso.length && path[k] === iso[k]) k++;
      while (path.length > k) flush();
      while (path.length < iso.length){
        const lvl = path.length;
        stack.push({c:scratch(pool, stack.length, w, h), a:s.isoA && typeof s.isoA[lvl] === 'number' ? s.isoA[lvl] : 1});
        path.push(iso[lvl]);
      }
      G.ctx = stack[stack.length - 1].c.getContext('2d')!; G.ctx.setTransform(...T);
      if (it.run) drawOutlineRun(it.run, it.erasers!, liveSet); else drawStroke(s, s === live);
    }
    while (path.length) flush();
    target.save(); target.setTransform(1, 0, 0, 1, 0, 0); target.globalAlpha = L.opacity; target.drawImage(stack[0].c, 0, 0); target.restore();
  }
  G.ctx = mainCtx;
}

/* ประวัติย้อนกลับเก็บทั้งเส้นและรายการเลเยอร์ */
export function snapshot(): Snapshot{ return {strokes: G.strokes, layers:G.layers.map(l => ({...l})), active:G.activeLayer}; }
export function restoreSnapshot(sn: Snapshot){
  G.strokes = sn.strokes; G.layers = sn.layers.map(l => ({...l}));
  G.activeLayer = layerOf(sn.active) ? sn.active : G.layers[G.layers.length - 1].id;
  G.dirty = true; layersChanged();
}

function layersChanged(){
  G.dirty = true; G.thumbsDirty = true;
  renderLayerList(); updateUI(); save();
}
function addLayer(){
  if (G.layers.length >= MAX_LAYERS){ toast('มีได้สูงสุด 10 เลเยอร์'); return; }
  pushHistory();
  const id = G.layers.reduce((m, l) => Math.max(m, l.id), 0) + 1, i = activeIndex();
  G.layers = [...G.layers.slice(0, i + 1), {id, name:'เลเยอร์ ' + id, visible:true, opacity:1}, ...G.layers.slice(i + 1)];
  G.activeLayer = id; layersChanged();
}
function deleteLayer(){
  if (G.layers.length <= 1){ toast('ต้องมีอย่างน้อย 1 เลเยอร์'); return; }
  pushHistory();
  const i = activeIndex(), id = G.activeLayer;
  G.strokes = G.strokes.filter(s => s.layer !== id);
  G.layers = G.layers.filter(l => l.id !== id);
  G.activeLayer = G.layers[Math.max(0, i - 1)].id;
  layersChanged();
  toast('ลบเลเยอร์แล้ว อยากได้คืนให้กด Undo');
}
function moveLayer(dir: number){
  const i = activeIndex(), j = i + dir;
  if (j < 0 || j >= G.layers.length) return;
  pushHistory();
  const next = G.layers.slice(); [next[i], next[j]] = [next[j], next[i]]; G.layers = next;
  layersChanged();
}
function mergeDown(){
  const i = activeIndex();
  if (i <= 0){ toast('ไม่มีเลเยอร์ข้างล่างให้รวม'); return; }
  const upper = G.layers[i], lower = G.layers[i - 1];
  if (!upper.visible || !lower.visible){ toast('แสดงทั้งสองเลเยอร์ก่อนรวม'); return; }
  pushHistory();
  const mine = G.strokes.filter(s => s.layer === upper.id);
  // ห่อเป็นกลุ่มเมื่อจำเป็น: เลเยอร์บนมียางลบ หรือโปร่งแสง หรือความโปร่งสองเลเยอร์ไม่เท่ากัน
  const wrap = upper.opacity !== lower.opacity || mine.some(s => s.type === 'eraser' && !(s.iso && s.iso.length));
  const gid = G.strokes.reduce((m, s) => Math.max(m, ...(s.iso || [0])), 0) + 1;
  const a = lower.opacity > 0 ? Math.min(1, upper.opacity / lower.opacity) : 1;
  const moved = mine.map((s): Stroke => wrap
    ? {...s, layer:lower.id, iso:[gid, ...(s.iso || [])], isoA:[a, ...(s.isoA || (s.iso || []).map(() => 1))]}
    : {...s, layer:lower.id});
  G.strokes = G.strokes.filter(s => s.layer !== upper.id).concat(moved);
  G.layers = G.layers.filter(l => l.id !== upper.id);
  G.activeLayer = lower.id;
  layersChanged();
  toast('รวมลงเลเยอร์ “' + lower.name + '” แล้ว');
}

/* รายการเลเยอร์ในแถบเครื่องมือ (บนสุดอยู่บน) */
const EYE_ON = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M1.5 8S4 3.5 8 3.5 14.5 8 14.5 8 12 12.5 8 12.5 1.5 8 1.5 8z"/><circle cx="8" cy="8" r="2"/></svg>';
const EYE_OFF = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="M2 2l12 12M6.6 3.7A6.6 6.6 0 0 1 8 3.5C12 3.5 14.5 8 14.5 8a12 12 0 0 1-1.9 2.5M10.9 11.7A6.4 6.4 0 0 1 8 12.5C4 12.5 1.5 8 1.5 8a12.4 12.4 0 0 1 3-3.4"/></svg>';
let renaming: number | null = null;
export function renderLayerList(){
  $('#layerBtn').hidden = room.active;
  if (room.active){ closeLayerPop(); return; }
  $('#layerBtnNum').textContent = G.layers.length > 1 ? (activeIndex() + 1) + '/' + G.layers.length : '';
  const list = $('#layerList');
  list.textContent = '';
  for (let i = G.layers.length - 1; i >= 0; i--){
    const L = G.layers[i];
    const row = document.createElement('div');
    row.className = 'layer' + (L.id === G.activeLayer ? ' on' : '') + (L.visible ? '' : ' off');
    row.dataset.id = String(L.id);
    const eye = document.createElement('button');
    eye.className = 'eye'; eye.innerHTML = L.visible ? EYE_ON : EYE_OFF;
    eye.setAttribute('aria-label', L.visible ? 'ซ่อนเลเยอร์' : 'แสดงเลเยอร์');
    eye.addEventListener('click', e => { e.stopPropagation(); L.visible = !L.visible; G.dirty = true; G.thumbsDirty = true; renderLayerList(); save(); });
    const th = document.createElement('canvas'); th.className = 'lthumb'; th.width = 112; th.height = 80; th.dataset.id = String(L.id);
    let name: HTMLInputElement | HTMLSpanElement;
    if (renaming === L.id){
      const inp = name = document.createElement('input'); inp.className = 'lname-in'; inp.value = L.name; inp.maxLength = 20;
      const done = (ok: boolean) => {
        if (renaming !== L.id) return;
        renaming = null;
        const v = inp.value.replace(/\s+/g, ' ').trim();
        if (ok && v) L.name = v;
        renderLayerList(); save();
      };
      inp.addEventListener('keydown', e => { if (e.key === 'Enter') done(true); else if (e.key === 'Escape') done(false); e.stopPropagation(); });
      name.addEventListener('blur', () => done(true));
      name.addEventListener('click', e => e.stopPropagation());
      setTimeout(() => { inp.focus(); inp.select(); }, 0);
    } else {
      name = document.createElement('span'); name.className = 'lname'; name.textContent = L.name;
      name.title = 'กดอีกครั้งเพื่อเปลี่ยนชื่อ';
      name.addEventListener('click', e => { if (L.id === G.activeLayer){ e.stopPropagation(); renaming = L.id; renderLayerList(); } });
    }
    row.append(eye, th, name);
    row.addEventListener('click', () => { if (G.activeLayer !== L.id){ endAdjust(true); G.activeLayer = L.id; renderLayerList(); save(); } });
    list.append(row);
  }
  const i = activeIndex(), A = G.layers[i];
  $<HTMLButtonElement>('#layAdd').disabled = G.layers.length >= MAX_LAYERS;
  $<HTMLButtonElement>('#layUp').disabled = i >= G.layers.length - 1;
  $<HTMLButtonElement>('#layDown').disabled = i <= 0;
  $<HTMLButtonElement>('#layMerge').disabled = i <= 0;
  $<HTMLButtonElement>('#layDel').disabled = G.layers.length <= 1;
  $<HTMLInputElement>('#layOpacity').value = String(A.opacity);
  $('#layOpOut').textContent = Math.round(A.opacity * 100) + '%';
  G.thumbsDirty = true;
}
// รูปตัวอย่างของแต่ละเลเยอร์ อัปเดตไม่บ่อย (ไม่เกินทุกครึ่งวินาที) จะได้ไม่หนักเครื่อง

export function updateThumbs(now: number){
  if (!G.thumbsDirty || G.current || room.active || now - G.thumbsAt < 500 || $('#layerPop').hidden) return;   // วาดรูปตัวอย่างเฉพาะตอนเปิดกล่องเลเยอร์
  G.thumbsDirty = false; G.thumbsAt = now;
  const k = Math.min(112 / Math.max(1, G.W), 80 / Math.max(1, G.H)), keep = G.layers;   // ย่อทั้งหน้าให้พอดีกรอบ
  for (const th of document.querySelectorAll<HTMLCanvasElement>('#layerList .lthumb')){
    const L = layerOf(Number(th.dataset.id)); if (!L) continue;
    const g = th.getContext('2d')!;
    g.setTransform(1, 0, 0, 1, 0, 0); g.clearRect(0, 0, th.width, th.height);
    G.layers = [{...L, visible:true, opacity:1}];
    try { renderLayers(g, [k, 0, 0, k, (112 - G.W * k) / 2, (80 - G.H * k) / 2], 112, 80, thumbPool, false); } finally { G.layers = keep; }
  }
}

export function initLayers(){
  $('#layAdd').addEventListener('click', addLayer);
  $('#layDel').addEventListener('click', deleteLayer);
  $('#layUp').addEventListener('click', () => moveLayer(1));
  $('#layDown').addEventListener('click', () => moveLayer(-1));
  $('#layMerge').addEventListener('click', mergeDown);
  $('#layOpacity').addEventListener('input', e => {
    const L = layerOf(G.activeLayer); if (!L) return;
    L.opacity = Math.min(1, Math.max(0, +(e.target as HTMLInputElement).value || 0));
    $('#layOpOut').textContent = Math.round(L.opacity * 100) + '%';
    G.dirty = true; G.thumbsDirty = true; save();
  });
}
