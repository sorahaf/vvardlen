import { $, BOARD, G, ZMAX, ZMIN, inkC, room, state, viewS, viewX, viewY } from './core.js';
import { resample, smooth } from './util.js';
import { OUTLINE_K, outlineColor, outlineWidths } from './geometry.js';
import { PAINT_K } from './paint.js';
import { panBy, viewChanged, zoomAt } from './view.js';
import { layerOf } from './layers.js';
import { pushHistory } from './history.js';
import { setColor, toast, updateUI } from './ui.js';
import { R, roomCommit, roomSendLive } from './room.js';
import { addRecent, dropper, sampleAt, setDropper } from './picker.js';
import { save } from './persist.js';
import type { Pt, RawPt, Stroke } from './types.js';

type PointerLike = { clientX: number; clientY: number };
interface Gesture { d0: number; mx: number; my: number; z0: number; wx: number; wy: number; }
interface PanDrag { id: number; x: number; y: number; px: number; py: number; }

/* ---------- input ---------- */
function spos(e: PointerLike): Pt{ const r = inkC.getBoundingClientRect(); return {x:e.clientX - r.left, y:e.clientY - r.top}; }
function pos(e: PointerLike): Pt{ const p = spos(e); return {x:(p.x - viewX()) / viewS(), y:(p.y - viewY()) / viewS()}; }
function rawPt(e: PointerEvent): RawPt{ const p: RawPt = pos(e); p.pr = e.pressure; p.t = e.timeStamp; p.pen = e.pointerType === 'pen'; return p; }
function newStroke(): Stroke{
  const t = state.brush;
  return {
    // ขนาดวัดบนกระดาษ (ไม่ขึ้นกับการซูม) ค่าเดียวกันได้เส้นหนาเท่ากันเสมอ
    type:t, color:state.color, size:(t === 'eraser' ? Math.max(8, state.size*3) : t === 'paint' ? state.size*PAINT_K : t === 'outline' ? state.size*OUTLINE_K : state.size) / G.VS, flow:state.flow,
    oc:outlineColor(), ow:state.ow / G.VS, tip:state.tip,
    seed:(Math.random()*1e9)|0, wiggle:state.wiggle, pixel:state.pixel / G.VS,
    amp:state.amp / G.VS, wavelen:state.wavelen / G.VS, shape:state.shape, pts:[], wpts:[], cache:{},
    layer:room.active ? undefined : G.activeLayer
  };
}
function onBoard(s: Stroke){
  const pad = s.size + (s.amp || 0) + (s.ow || 0);
  return s.pts.some(p => p.x > -pad && p.y > -pad && p.x < BOARD + pad && p.y < BOARD + pad);
}
function prepare(s: Stroke, source: Pt[]){
  s.pts = resample(source, 3);
  if (s.type === 'outline') s.pw = s.tip === 'round' ? undefined : outlineWidths(s, G.raw);
  if (s.type === 'wave') s.wpts = resample(s.pts, 1);
}
const touches = new Map<number, Pt>();   // นิ้วที่แตะจออยู่
export let gesture: Gesture | null = null, panDrag: PanDrag | null = null;
function cancelStroke(){
  if (!G.current) return;
  G.current = null; G.raw = null; G.activeId = null; G.dirty = true;
  if (room.active && room.fb){ clearTimeout(room.liveTimer ?? undefined); room.liveTimer = null; room.fb.remove(R(`rooms/${room.code}/live/${room.uid}`)).catch(() => {}); }
}
function gestureState(){
  const [a, b] = [...touches.values()];
  return {d:Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)), mx:(a.x + b.x)/2, my:(a.y + b.y)/2};
}
function pointerEnd(e: PointerEvent){
  if (e.pointerType === 'touch'){
    touches.delete(e.pointerId);
    if (gesture && touches.size < 2){ gesture = null; return; }
    if (gesture) return;
  }
  if (panDrag && e.pointerId === panDrag.id){ panDrag = null; return; }
  finish(e);
}
function finish(e?: PointerEvent){
  if (!G.current || !G.raw || (e && e.pointerId !== G.activeId)) return;
  prepare(G.current, smooth(G.raw));
  G.current.cache = {};
  if (G.current.type !== 'eraser') addRecent(G.current.color);
  if (room.active){ if (onBoard(G.current)) roomCommit(G.current); }
  else { pushHistory(); G.strokes = G.strokes.concat([G.current]); G.thumbsDirty = true; }
  G.current = null; G.raw = null; G.activeId = null;
  G.dirty = true; updateUI(); save();
}

export const cursor = $('#cursor');
function moveCursor(e: PointerEvent){
  if (e.pointerType !== 'mouse'){ cursor.style.display = 'none'; return; }
  const p = spos(e);
  const d = Math.max(4, G.ZOOM * (state.brush === 'eraser' ? Math.max(8, state.size*3) : state.brush === 'paint' ? state.size*PAINT_K*1.5 : state.size + (state.brush === 'wave' ? state.amp*2 : 0)));
  cursor.style.display = 'block';
  cursor.style.width = cursor.style.height = d + 'px';
  cursor.style.transform = `translate(${p.x - d/2}px, ${p.y - d/2}px)`;
}

export function initInput(){
  inkC.addEventListener('pointerdown', e => {
    if (e.pointerType === 'touch'){
      touches.set(e.pointerId, spos(e));
      if (touches.size >= 2){
        // นิ้วที่สองมาถึง: ยกเลิกเส้นที่เพิ่งเริ่ม แล้วเปลี่ยนเป็นซูม/เลื่อน
        cancelStroke();
        try { inkC.setPointerCapture(e.pointerId); } catch (_) {}
        const g = gestureState();
        gesture = {d0:g.d, mx:g.mx, my:g.my, z0:G.ZOOM, wx:(g.mx - viewX()) / viewS(), wy:(g.my - viewY()) / viewS()};
        return;
      }
    }
    if (e.button === 1){   // ปุ่มกลางเมาส์ ลากเพื่อเลื่อนกระดาษ
      e.preventDefault();
      try { inkC.setPointerCapture(e.pointerId); } catch (_) {}
      const p = spos(e); panDrag = {id:e.pointerId, x:p.x, y:p.y, px:G.PX, py:G.PY};
      return;
    }
    if (e.button > 0 || G.current || gesture) return;
    if (dropper || e.altKey){   // หลอดดูดสี (หรือกด Alt ค้างแล้วคลิก)
      e.preventDefault(); setColor(sampleAt(spos(e))); if (dropper) setDropper(false);
      return;
    }
    if (!room.active && !layerOf(G.activeLayer)?.visible){ toast('เลเยอร์นี้ซ่อนอยู่ กดรูปตาเพื่อแสดงก่อนวาด'); return; }
    e.preventDefault();
    try { inkC.setPointerCapture(e.pointerId); } catch (_) {}
    G.activeId = e.pointerId;
    G.current = newStroke(); G.raw = [rawPt(e)];
    prepare(G.current, G.raw); G.dirty = true;
    moveCursor(e);
  });
  inkC.addEventListener('pointermove', e => {
    if (e.pointerType === 'touch' && touches.has(e.pointerId)) touches.set(e.pointerId, spos(e));
    if (gesture){
      if (touches.size < 2) return;
      const g = gestureState();
      G.ZOOM = Math.min(ZMAX, Math.max(ZMIN, gesture.z0 * g.d / gesture.d0));
      G.PX = g.mx - G.OX - gesture.wx * viewS(); G.PY = g.my - G.OY - gesture.wy * viewS();
      viewChanged();
      return;
    }
    if (panDrag && e.pointerId === panDrag.id){
      const p = spos(e); G.PX = panDrag.px + p.x - panDrag.x; G.PY = panDrag.py + p.y - panDrag.y; viewChanged();
      return;
    }
    moveCursor(e);
    if (!G.current || !G.raw || e.pointerId !== G.activeId) return;
    const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [e];
    const list = evs.length ? evs : [e];
    for (const ev of list){
      const p = rawPt(ev), l = G.raw[G.raw.length-1];
      if (Math.hypot(p.x - l.x, p.y - l.y) >= 1.2 / viewS()) G.raw.push(p);
    }
    prepare(G.current, smooth(G.raw)); G.dirty = true;
    if (room.active) roomSendLive();
  });
  // ลูกกลิ้ง/ทัชแพด: เลื่อนกระดาษ  |  Ctrl + ลูกกลิ้ง หรือหุบ/ถ่างบนทัชแพด: ซูม
  inkC.addEventListener('wheel', e => {
    e.preventDefault();
    const k = e.deltaMode === 1 ? 16 : e.deltaMode === 2 ? G.H : 1;
    if (e.ctrlKey || e.metaKey){ const p = spos(e); zoomAt(p.x, p.y, Math.exp(-e.deltaY * k * .0025)); }
    else if (e.shiftKey && !e.deltaX) panBy(-e.deltaY * k, 0);
    else panBy(-e.deltaX * k, -e.deltaY * k);
  }, {passive:false});
  inkC.addEventListener('auxclick', e => { if (e.button === 1) e.preventDefault(); });
  inkC.addEventListener('pointerup', pointerEnd);
  inkC.addEventListener('pointercancel', pointerEnd);
  inkC.addEventListener('lostpointercapture', pointerEnd);
  inkC.addEventListener('pointerleave', () => { cursor.style.display = 'none'; });
}
