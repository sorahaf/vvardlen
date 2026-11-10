import { $, G, room, stage, state } from './core.js';
import { resetView, zoomAt } from './view.js';
import { cursor } from './input.js';
import { clearAll, redo, undo } from './history.js';
import { drawWheel, pkFromHex, updatePickerUI } from './picker.js';
import { endAdjust } from './adjust.js';
import { save } from './persist.js';
import type { BrushType, InkBrush, NumKey, OutlineMode, OutlineTip, WaveShape } from './types.js';

/* ---------- UI ---------- */
// fromPicker: สีมาจากวงล้อ/แถบความสว่าง ไม่ต้องคำนวณตำแหน่งบนวงล้อใหม่
export function setColor(c: string, keepBrush = false, fromPicker = false){
  if (!/^#[0-9a-f]{6}$/i.test(c)) return;
  state.color = c.toLowerCase();
  $('#cdot').style.background = state.color;
  if (!fromPicker){ pkFromHex(state.color); drawWheel(); }
  updatePickerUI();
  if (state.brush === 'eraser' && !keepBrush) setBrush(lastInkBrush);
  save();
}
let lastInkBrush: InkBrush = 'pencil';
/** แต่ละแปรงจำค่าของตัวเอง (ความหนา ความทึบ การสั่น) สลับแปรงแล้วค่าจะตามแปรงนั้น */
export const brushMem: Partial<Record<BrushType, { size: number; op: number; wiggle: number }>> = {};
const applyRange = (id: string, v: number) => { const e = $<HTMLInputElement>('#' + id); e.value = String(v); e.dispatchEvent(new Event('input')); };
export function setBrush(b: BrushType){
  const prev = state.brush;
  if (prev !== b){
    brushMem[prev] = {size:state.size, op:state.op, wiggle:state.wiggle};
    const m = brushMem[b];
    if (m){ applyRange('size', m.size); applyRange('op', m.op); applyRange('wiggle', m.wiggle); }
  }
  state.brush = b;
  if (b !== 'eraser') lastInkBrush = b;
  document.querySelectorAll<HTMLElement>('.tool,.dtool').forEach(t => t.classList.toggle('on', t.dataset.brush === b));
  document.querySelectorAll<HTMLElement>('.opt').forEach(o => { o.hidden = !(o.dataset.for || '').split(' ').includes(b); });
  $('#colorSec .fold-body').style.opacity = b === 'eraser' ? '.45' : '1';
  cursor.classList.toggle('square', b === 'pixel');
  save();
}
export function setOc(m: OutlineMode){
  state.oc = m;
  document.querySelectorAll<HTMLElement>('#ocSeg button').forEach(x => x.classList.toggle('on', x.dataset.oc === m));
  save();
}
export function setTip(t: OutlineTip){
  state.tip = t;
  document.querySelectorAll<HTMLElement>('#tipSeg button').forEach(x => x.classList.toggle('on', x.dataset.tip === t));
  save();
}
export function setShape(s: WaveShape){
  state.shape = s;
  document.querySelectorAll<HTMLElement>('#shapeSeg button').forEach(x => x.classList.toggle('on', x.dataset.shape === s));
  save();
}
export function bindRange(id: string, key: NumKey, fmt: (v: number) => string | number = v => v){
  const el = $<HTMLInputElement>('#' + id), out = $('#' + id + 'Out');
  el.value = String(state[key]); out.textContent = String(fmt(state[key]));
  el.addEventListener('input', () => { state[key] = parseFloat(el.value); out.textContent = String(fmt(state[key])); save(); });
}
export function setRange(id: string, key: NumKey, v: number){ state[key] = v; $<HTMLInputElement>('#' + id).value = String(v); $('#' + id + 'Out').textContent = String(v); }

const ICON_PAUSE = '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="3.5" y="2.5" width="3" height="11" rx="1"/><rect x="9.5" y="2.5" width="3" height="11" rx="1"/></svg>';
const ICON_PLAY = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M4 2.6v10.8c0 .5.5.8.9.5l8.3-5.4c.4-.2.4-.8 0-1L4.9 2.1c-.4-.3-.9 0-.9.5z"/></svg>';
export function setPlaying(p: boolean){
  state.playing = p;
  $('#playBtn').innerHTML = p ? ICON_PAUSE + '<span class="lbl">หยุดเส้น</span>' : ICON_PLAY + '<span class="lbl">เล่นต่อ</span>';
  G.dirty = true; save();
}
export function updateUI(){
  const canUndo = room.active ? room.myUndo.length > 0 : G.undoStack.length > 0;
  const canRedo = room.active ? room.myRedo.length > 0 : G.redoStack.length > 0;
  $<HTMLButtonElement>('#undoBtn').disabled = $<HTMLButtonElement>('#mUndo').disabled = !canUndo;
  $<HTMLButtonElement>('#redoBtn').disabled = $<HTMLButtonElement>('#mRedo').disabled = !canRedo;
  $('#empty').classList.toggle('gone', G.strokes.length > 0 || !!G.current);
}
// พับเก็บแต่ละหมวด (สีเส้น ปรับเส้น เลือกกระดาษ) และจำไว้ว่าพับหมวดไหนอยู่
function foldState(): Record<string, boolean>{ try { return JSON.parse(localStorage.getItem('yukyik-folds') || '{}') || {}; } catch (_) { return {}; } }
function setFold(sec: HTMLElement, open: boolean){
  sec.classList.toggle('closed', !open);
  sec.querySelector('.fold-head')!.setAttribute('aria-expanded', String(open));
  try { const f = foldState(); f[sec.dataset.fold || ''] = open; localStorage.setItem('yukyik-folds', JSON.stringify(f)); } catch (_) {}
}
/* แผ่นเครื่องมือบนมือถือ */
const mq = window.matchMedia('(max-width:760px), (max-height:500px)');
function openSheet(){ closeColorPop(); closeLayerPop(); $('#panel').classList.add('open'); $('#backdrop').classList.add('show'); }
export function closeSheet(){ $('#panel').classList.remove('open'); $('#backdrop').classList.remove('show'); }
export function closeColorPop(){ $('#colorPop').hidden = true; }
// มือถือ: ย้ายตัวเลือกสีไปไว้ในกล่องที่เด้งจากวงกลมสีด้านล่าง / จอใหญ่: อยู่ในหมวดสีเส้น
function placePicker(){
  const home = mq.matches ? $('#colorPop') : $('#colorSec .fold-inner');
  if ($('#picker').parentElement !== home) home.append($('#picker'));
  if (!mq.matches) closeColorPop();
}
export function closeLayerPop(){ endAdjust(true); $('#layerPop').hidden = true; $('#layerBtn').classList.remove('on'); }

export let toastT: number | undefined;
export function toast(msg: string){ const t = $('#toast'); t.textContent = msg; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }

/* ดูภาพขาวดำชั่วคราว (ไม่เปลี่ยนสีจริง ไม่ติดไปตอนบันทึกรูป) */
export function setGray(on: boolean){
  stage.classList.toggle('gray', on);
  $('#grayBtn').classList.toggle('on', on);
  $('#grayBtn').setAttribute('aria-pressed', String(on));
}

export function initUi(){
  $('#grayBtn').addEventListener('click', () => setGray(!stage.classList.contains('gray')));
  document.querySelectorAll<HTMLElement>('.tool').forEach(t => t.addEventListener('click', () => setBrush(t.dataset.brush as BrushType)));
  document.querySelectorAll<HTMLElement>('#shapeSeg button').forEach(b => b.addEventListener('click', () => setShape(b.dataset.shape as WaveShape)));
  document.querySelectorAll<HTMLElement>('#ocSeg button').forEach(b => b.addEventListener('click', () => setOc(b.dataset.oc as OutlineMode)));
  document.querySelectorAll<HTMLElement>('#tipSeg button').forEach(b => b.addEventListener('click', () => setTip(b.dataset.tip === 'round' ? 'round' : 'taper')));
  
  $('#undoBtn').addEventListener('click', undo);
  $('#mUndo').addEventListener('click', undo);
  $('#mRedo').addEventListener('click', redo);
  $('#redoBtn').addEventListener('click', redo);
  $('#clearBtn').addEventListener('click', clearAll);
  $('#playBtn').addEventListener('click', () => setPlaying(!state.playing));
  $('#zoomIn').addEventListener('click', () => zoomAt(G.W/2, G.H/2, 1.25));
  $('#zoomOut').addEventListener('click', () => zoomAt(G.W/2, G.H/2, 1/1.25));
  $('#zoomPct').addEventListener('click', resetView);
  $('#zoomChip').addEventListener('click', resetView);
  document.querySelectorAll<HTMLElement>('.fold[data-fold]').forEach(sec => {
    sec.querySelector('.fold-head')!.addEventListener('click', () => setFold(sec, sec.classList.contains('closed')));
    if (foldState()[sec.dataset.fold || ''] === false) setFold(sec, false);
  });
  $('#dockMore').addEventListener('click', openSheet);
  $('#layerBtn').addEventListener('click', e => {
    e.stopPropagation(); closeColorPop();
    const open = $('#layerPop').hidden;
    $('#layerPop').hidden = !open; $('#layerBtn').classList.toggle('on', !!open);
    if (open){ G.thumbsDirty = true; G.thumbsAt = 0; }
  });
  $('#layerPopClose').addEventListener('click', closeLayerPop);
  $('#dockColor').addEventListener('click', e => { e.stopPropagation(); closeLayerPop(); $('#colorPop').hidden = !$('#colorPop').hidden; });
  document.addEventListener('pointerdown', e => {
    const t = e.target as Element;
    if (!$('#colorPop').hidden && !t.closest('#colorPop') && !t.closest('#dockColor')) closeColorPop();
    if (!$('#layerPop').hidden && !t.closest('#layerPop') && !t.closest('#layerBtn')) closeLayerPop();
  });
  $('#closeSheet').addEventListener('click', closeSheet);
  $('#backdrop').addEventListener('click', closeSheet);
  mq.addEventListener('change', e => { if (!e.matches) closeSheet(); placePicker(); });
  placePicker();
  (() => {
    const dock = $('#dock'), sep = dock.querySelector('.sep');
    document.querySelectorAll<HTMLElement>('.tool').forEach(t => {
      const b = document.createElement('button'), brush = t.dataset.brush as BrushType;
      b.className = 'dtool'; b.dataset.brush = brush; b.setAttribute('aria-label', t.querySelector('span')!.textContent || '');
      b.append(t.querySelector('svg')!.cloneNode(true));
      b.addEventListener('click', () => setBrush(brush));
      dock.insertBefore(b, sep);
    });
  })();
}
