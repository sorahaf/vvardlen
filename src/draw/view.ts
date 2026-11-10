import { $, BOARD, G, ZMAX, ZMIN, inkC, paperC, room, stage, viewS, viewX, viewY } from './core.js';
import { drawPaper } from './paper.js';
import { gesture } from './input.js';

/* ---------- sizing ---------- */
export function resize(){
  const r = stage.getBoundingClientRect();
  G.W = Math.max(1, Math.round(r.width)); G.H = Math.max(1, Math.round(r.height));
  G.DPR = Math.min(window.devicePixelRatio || 1, 2);
  if (room.active){
    const mobile = window.matchMedia('(max-width:760px), (max-height:500px)').matches;
    const land = window.matchMedia('(max-height:500px) and (orientation:landscape)').matches;
    const top = land ? 12 : 64, bottom = mobile && !land ? 86 : 14, left = land ? 76 : 12, right = land ? 64 : 12;
    G.VS = Math.max(.1, Math.min((G.W - left - right) / BOARD, (G.H - top - bottom) / BOARD));
    G.OX = left + ((G.W - left - right) - BOARD*G.VS) / 2;
    G.OY = top + ((G.H - top - bottom) - BOARD*G.VS) / 2;
  } else { G.VS = 1; G.OX = 0; G.OY = 0; }
  for (const c of [paperC, inkC]){ c.width = Math.round(G.W*G.DPR); c.height = Math.round(G.H*G.DPR); }
  clampPan(); drawPaper(); G.dirty = true;
}

/* ---------- zoom & pan ---------- */
// ไม่ให้เลื่อนจนกระดาษหลุดจอไปหมด ต้องเห็นอย่างน้อย 80 พิกเซล
function clampPan(){
  const S = viewS(), cw = (room.active ? BOARD : G.W / G.VS) * S, ch = (room.active ? BOARD : G.H / G.VS) * S, m = 80;
  G.PX = Math.min(G.W - m - G.OX, Math.max(m - G.OX - cw, G.PX));
  G.PY = Math.min(G.H - m - G.OY, Math.max(m - G.OY - ch, G.PY));
}
export function viewChanged(){ clampPan(); G.dirty = true; G.paperDirty = true; updateZoomUI(); scheduleSharpen(); }
// ซูมเข้าแล้วหยุดสักครู่ ให้ทำภาพเส้นสีน้ำมันใหม่ให้คมตามระดับซูม
export let sharpenT: number | undefined;
function scheduleSharpen(){
  clearTimeout(sharpenT);
  sharpenT = setTimeout(() => {
    if (gesture){ scheduleSharpen(); return; }
    const need = G.DPR * viewS();
    for (const s of G.strokes){
      const b = s.type === 'paint' && s.cache.e && s.cache.e.bake;
      if (b && b.q < need / 1.4 && b.img.width < 2048 && b.img.height < 2048 && b.img.width * b.img.height < 4e6 * .9) delete s.cache.e;
      const o = s.runCache && s.runCache.img.find(Boolean);
      if (o && o.q < need / 1.4 && o.img.width < 2048 && o.img.height < 2048 && o.img.width * o.img.height < 4e6 * .9) s.runCache = null;
    }
    G.dirty = true;
  }, 300);
}
export function zoomAt(sx: number, sy: number, factor: number){
  const z = Math.min(ZMAX, Math.max(ZMIN, G.ZOOM * factor));
  const wx = (sx - viewX()) / viewS(), wy = (sy - viewY()) / viewS();   // จุดบนกระดาษใต้เคอร์เซอร์ต้องอยู่ที่เดิม
  G.ZOOM = z; G.PX = sx - G.OX - wx * viewS(); G.PY = sy - G.OY - wy * viewS();
  viewChanged();
}
export function panBy(dx: number, dy: number){ G.PX += dx; G.PY += dy; viewChanged(); }
export function resetView(){ G.ZOOM = 1; G.PX = 0; G.PY = 0; viewChanged(); }
export function updateZoomUI(){
  const pct = Math.round(G.ZOOM * 100) + '%';
  $('#zoomPct').textContent = pct; $('#zoomChip').textContent = pct;
  $('#zoomChip').hidden = Math.abs(G.ZOOM - 1) < .01 && Math.abs(G.PX) < 1 && Math.abs(G.PY) < 1;
}

export function initView(){
  new ResizeObserver(resize).observe(stage);
}
