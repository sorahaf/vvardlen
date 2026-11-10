import { $, G } from './core.js';
import { recolorHex } from './color.js';
import { pushHistory } from './history.js';
import { toast, updateUI } from './ui.js';
import { save } from './persist.js';
import type { Stroke } from './types.js';

/* ---------- ปรับสีทั้งเลเยอร์ ----------
   เลื่อนโทนสีและความสว่างของทุกเส้นในเลเยอร์ (คิดแบบตามสายตา สีจึงไม่เพี้ยน) ลากดูผลได้ก่อน แล้วกดเสร็จหรือยกเลิก */
export let adj: { base: Stroke[]; id: number } | null = null, adjStarting = false, adjT: number | undefined;
function applyAdjust(){
  const dh = +$<HTMLInputElement>('#adjH').value, dl = +$<HTMLInputElement>('#adjL').value;
  $('#adjHOut').textContent = (dh > 0 ? '+' : '') + dh + '°'; $('#adjLOut').textContent = (dl > 0 ? '+' : '') + dl;
  if (!adj){
    if (!dh && !dl) return;
    adjStarting = true; pushHistory(); adjStarting = false;
    adj = {base:G.strokes, id:G.activeLayer};
    $('#adjBtns').hidden = false;
  }
  const memo = new Map<string, string>(), A = adj;
  G.strokes = A.base.map(s => {
    if (s.layer !== A.id || s.type === 'eraser') return s;
    if (!memo.has(s.color)) memo.set(s.color, recolorHex(s.color, dh, dl));
    // เส้นสีน้ำมันเก็บภาพของเส้นไว้ ต้องทำใหม่ ส่วนเส้นอื่นใช้รูปทรงเดิมได้เลย
    return {...s, color:memo.get(s.color)!, cache:s.type === 'paint' ? {} : s.cache};
  });
  G.dirty = true; G.thumbsDirty = true;
}
export function endAdjust(keep: boolean){
  if (!adj) return;
  if (!keep){ G.strokes = adj.base; G.undoStack.pop(); }
  adj = null;
  $<HTMLInputElement>('#adjH').value = '0'; $<HTMLInputElement>('#adjL').value = '0'; $('#adjHOut').textContent = '0°'; $('#adjLOut').textContent = '0';
  $('#adjBtns').hidden = true;
  G.dirty = true; G.thumbsDirty = true; updateUI(); save();
}

export function initAdjust(){
  for (const id of ['#adjH', '#adjL']) $(id).addEventListener('input', () => {
    clearTimeout(adjT); adjT = setTimeout(applyAdjust, 60);   // หน่วงนิดหนึ่ง ไม่คำนวณถี่เกิน
  });
  $('#adjDone').addEventListener('click', () => { clearTimeout(adjT); applyAdjust(); endAdjust(true); toast('ปรับสีเลเยอร์แล้ว'); });
  $('#adjCancel').addEventListener('click', () => { clearTimeout(adjT); endAdjust(false); });
}
