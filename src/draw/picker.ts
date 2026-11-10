import { $, G, inkC, mainCtx, pctx, state } from './core.js';
import { closeColorPop, setColor, toast } from './ui.js';
import { save } from './persist.js';

import { hexToRgb, hsvToRgb, maxChroma, oklabToLin, oklchHex, rgbToHex, rgbToHsv, rgbToOklab, toGam } from './color.js';
import type { Pt } from './types.js';

/* ---------- ตัวเลือกสี: วงล้อ แถบความสว่าง รหัสสี สีที่เพิ่งใช้ สีที่บันทึกไว้ และหลอดดูดสี ---------- */
/** ค่าของตัวเลือกสี: m โหมด, h โทนสี (องศา), s ความสด, v ความสว่าง (0 ถึง 1) */
export const pk: { m: 'ok' | 'hsv'; h: number; s: number; v: number } = {m:'ok', h:30, s:0, v:.3};
function pkHex(){
  if (pk.m === 'hsv') return rgbToHex(...hsvToRgb(pk.h, pk.s, pk.v));
  const hr = pk.h * Math.PI / 180;
  return oklchHex(pk.v, pk.s * maxChroma(pk.v, hr), hr);
}
export function pkFromHex(hex: string){
  const rgb = hexToRgb(hex);
  if (pk.m === 'hsv'){ const [h, s, v] = rgbToHsv(...rgb); if (s > .001) pk.h = h; pk.s = s; pk.v = v; return; }
  const [L, a, b] = rgbToOklab(...rgb), C = Math.hypot(a, b);
  if (C > .002){ pk.h = (Math.atan2(b, a) * 180 / Math.PI + 360) % 360; }
  const mc = maxChroma(L, pk.h * Math.PI / 180);
  pk.s = mc > 0 ? Math.min(1, C / mc) : 0; pk.v = Math.min(1, Math.max(0, L));
}
// วาดวงล้อ (ทำเฉพาะตอนความสว่างหรือโหมดเปลี่ยน)
let wheelDrawn = '';
export function drawWheel(){
  const key = pk.m + pk.v.toFixed(3);
  if (key === wheelDrawn) return;
  wheelDrawn = key;
  const c = $<HTMLCanvasElement>('#wheel'), N = c.width, R = N / 2 - 4, g = c.getContext('2d')!, im = g.createImageData(N, N), d = im.data;
  let maxC = new Float32Array(0);
  if (pk.m === 'ok'){ maxC = new Float32Array(361); for (let i = 0; i <= 360; i++) maxC[i] = maxChroma(pk.v, i * Math.PI / 180); }
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++){
    const dx = x - N/2 + .5, dy = y - N/2 + .5, r = Math.hypot(dx, dy) / R;
    if (r > 1.02) continue;
    const hd = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360, sat = Math.min(1, r);
    let rgb: number[];
    if (pk.m === 'hsv') rgb = hsvToRgb(hd, sat, pk.v);
    else { const hr = hd * Math.PI / 180, C = sat * maxC[Math.round(hd)], l = oklabToLin(pk.v, C*Math.cos(hr), C*Math.sin(hr)); rgb = [toGam(l[0]), toGam(l[1]), toGam(l[2])]; }
    const i = (y*N + x) * 4;
    d[i] = rgb[0]*255; d[i+1] = rgb[1]*255; d[i+2] = rgb[2]*255;
    d[i+3] = 255 * Math.min(1, Math.max(0, (1.02 - r) * R / 1.5));   // ขอบนุ่ม
  }
  g.putImageData(im, 0, 0);
}
export function updatePickerUI(){
  const dot = $('#wheelDot'), a = pk.h * Math.PI / 180, R = (150 - 4) / 300 * 100;
  dot.style.left = (50 + Math.cos(a) * pk.s * R) + '%'; dot.style.top = (50 + Math.sin(a) * pk.s * R) + '%';
  dot.style.background = state.color;
  $('#pkCur').style.background = state.color;
  const hexIn = $<HTMLInputElement>('#hexIn');
  if (document.activeElement !== hexIn) hexIn.value = state.color.toUpperCase();
  $<HTMLInputElement>('#pkV').value = String(pk.v); $('#pkVOut').textContent = Math.round(pk.v * 100) + '%';
  // แถบความสว่างแสดงสีจริงตั้งแต่มืดสุดถึงสว่างสุด
  const keep = pk.v, stops: string[] = [];
  for (let i = 0; i <= 8; i++){ pk.v = i / 8; stops.push(pkHex()); }
  pk.v = keep;
  $('#pkV').style.setProperty('--track', `linear-gradient(90deg,${stops.join(',')})`);
  document.querySelectorAll<HTMLElement>('#pkMode button').forEach(b => b.classList.toggle('on', b.dataset.m === pk.m));
  document.querySelectorAll<HTMLElement>('.mini-sw button').forEach(b => b.classList.toggle('on', b.dataset.color === state.color));
}
let wheelRaf = 0;
function pickerChanged(){
  setColor(pkHex(), false, true);
  if (!wheelRaf) wheelRaf = requestAnimationFrame(() => { wheelRaf = 0; drawWheel(); });
}

/* สีที่เพิ่งใช้ และสีที่บันทึกไว้ (เก็บในเบราว์เซอร์) */
const COLKEY = 'yukyik-colors';
let palette: { recent: string[]; saved: string[] } = {recent:[], saved:[]};
function savePalette(){ try { localStorage.setItem(COLKEY, JSON.stringify(palette)); } catch (_) {} }
export function renderPalette(){
  for (const [id, list] of [['#recentSw', palette.recent], ['#savedSw', palette.saved]] as const){
    const box = $(id); box.textContent = '';
    if (!list.length){
      const e = document.createElement('span'); e.className = 'pk-empty';
      e.textContent = id === '#recentSw' ? 'วาดแล้วสีจะมาอยู่ตรงนี้' : 'กด “+ เก็บสีนี้” เพื่อเก็บสีไว้ใช้';
      box.append(e); continue;
    }
    for (const c of list){
      const b = document.createElement('button'); b.style.background = c; b.dataset.color = c; b.title = c.toUpperCase();
      b.addEventListener('click', () => {
        if (id === '#savedSw' && box.classList.contains('editing')){ palette.saved = palette.saved.filter(x => x !== c); savePalette(); renderPalette(); return; }
        setColor(c);
      });
      box.append(b);
    }
  }
  if (!palette.saved.length) $('#savedSw').classList.remove('editing');
  $('#editSaved').textContent = $('#savedSw').classList.contains('editing') ? 'เสร็จ' : 'ลบ';
  $('#editSaved').hidden = !palette.saved.length;
  updatePickerUI();
}
export function addRecent(c: string){
  if (!/^#[0-9a-f]{6}$/.test(c) || palette.recent[0] === c) return;
  palette.recent = [c, ...palette.recent.filter(x => x !== c)].slice(0, 8);
  savePalette(); renderPalette();
}

/* หลอดดูดสี: แตะที่ภาพ ได้สีที่เห็นตรงนั้น (รวมสีกระดาษด้วย) */
export let dropper = false;
export function setDropper(on: boolean){
  dropper = on;
  $('#eyeDrop').classList.toggle('on', on);
  inkC.classList.toggle('dropper', on);
  if (on){ closeColorPop(); toast('แตะที่ภาพเพื่อดูดสี'); }
}
export function sampleAt(p: Pt){
  const x = Math.min(inkC.width - 1, Math.max(0, Math.round(p.x * G.DPR))), y = Math.min(inkC.height - 1, Math.max(0, Math.round(p.y * G.DPR)));
  const a = mainCtx.getImageData(x, y, 1, 1).data, b = pctx.getImageData(x, y, 1, 1).data, al = a[3] / 255;
  const mix = (i: number) => (a[i] * al + b[i] * (1 - al)) / 255;
  return rgbToHex(mix(0), mix(1), mix(2));
}

export function initPicker(){
  (() => {
    const wrap = $('.wheel-wrap');
    let dragging = false;
    const pick = (e: PointerEvent) => {
      const r = $('#wheel').getBoundingClientRect(), R = r.width * (150 - 4) / 300;
      const dx = e.clientX - r.left - r.width/2, dy = e.clientY - r.top - r.height/2;
      pk.h = (Math.atan2(dy, dx) * 180 / Math.PI + 360) % 360; pk.s = Math.min(1, Math.hypot(dx, dy) / R);
      pickerChanged();
    };
    wrap.addEventListener('pointerdown', e => { dragging = true; try { wrap.setPointerCapture(e.pointerId); } catch (_) {} pick(e); });
    wrap.addEventListener('pointermove', e => { if (dragging) pick(e); });
    wrap.addEventListener('pointerup', () => { dragging = false; });
    wrap.addEventListener('pointercancel', () => { dragging = false; });
  })();
  $('#pkV').addEventListener('input', e => { pk.v = +(e.target as HTMLInputElement).value; pickerChanged(); });
  document.querySelectorAll<HTMLElement>('#pkMode button').forEach(b => b.addEventListener('click', () => {
    pk.m = b.dataset.m === 'hsv' ? 'hsv' : 'ok'; pkFromHex(state.color); drawWheel(); updatePickerUI(); save();
  }));
  const hexIn = $<HTMLInputElement>('#hexIn');
  hexIn.addEventListener('input', () => {
    let v = hexIn.value.trim().toLowerCase().replace(/[^#0-9a-f]/g, '');
    if (!v.startsWith('#')) v = '#' + v.replace(/#/g, '');
    if (/^#[0-9a-f]{3}$/.test(v)) v = '#' + v[1]+v[1]+v[2]+v[2]+v[3]+v[3];
    if (/^#[0-9a-f]{6}$/.test(v)) setColor(v);
  });
  hexIn.addEventListener('blur', () => { hexIn.value = state.color.toUpperCase(); });
  hexIn.addEventListener('keydown', e => { if (e.key === 'Enter') hexIn.blur(); });
  $('#hexCopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(state.color.toUpperCase()); toast('คัดลอก ' + state.color.toUpperCase() + ' แล้ว'); }
    catch (_) { hexIn.focus(); hexIn.select(); toast('กดค้างที่รหัสสีแล้วเลือกคัดลอกได้เลย'); }
  });
  try { const p = JSON.parse(localStorage.getItem(COLKEY) || '{}'); const ok = (a: unknown): string[] => Array.isArray(a) ? a.filter(c => /^#[0-9a-f]{6}$/.test(c)) : [];
    palette = {recent:ok(p.recent).slice(0, 8), saved:ok(p.saved).slice(0, 24)}; } catch (_) {}
  $('#saveColor').addEventListener('click', () => {
    if (palette.saved.includes(state.color)){ toast('มีสีนี้อยู่แล้ว'); return; }
    if (palette.saved.length >= 24){ toast('เก็บได้สูงสุด 24 สี ลบสีเก่าก่อนนะ'); return; }
    palette.saved = [...palette.saved, state.color]; savePalette(); renderPalette();
  });
  $('#editSaved').addEventListener('click', () => { $('#savedSw').classList.toggle('editing'); renderPalette(); });
  $('#eyeDrop').addEventListener('click', () => setDropper(!dropper));

}
