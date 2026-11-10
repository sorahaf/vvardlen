import { $, G, room } from './core.js';
import { resample } from './util.js';
import { resize, updateZoomUI } from './view.js';
import { renderLayerList } from './layers.js';
import { closeSheet, toast, updateUI } from './ui.js';
import { SHAPES, TYPES, clampN, r2 } from './util.js';
import { CODE_RE, ROOM_TTL, type Snapshot as DbSnap, connectFirebase, errKey as errKind, fbConfig, readSavedKey, saveKey } from '../shared/firebase.js';
import type { BrushType, Pt, Stroke, WaveShape } from './types.js';
import type { RoomMeta } from './core.js';

/* ---------- วาดกับเพื่อน (Firebase Realtime Database) ---------- */
const MAX_PTS = 5000, LIVE_PTS = 1500;

const needsKey = (err: unknown) => { const c = (err as {code?: string} | null)?.code; return c === 'need-key' || c === 'wrong-key'; };
export function isFramed(){ try { return window.self !== window.top; } catch (_) { return true; } }
export const R = (p: string) => room.fb!.ref(room.db, p);

export async function ensureFirebase(){
  if (room.fb) return room.fb;
  const s = await connectFirebase();
  room.uid = s.uid; room.db = s.db; room.fb = s.fb;
  return s.fb;
}

/* แปลงเส้นเป็นข้อมูลที่ส่งได้ และแปลงกลับ (ตรวจค่าทุกตัวก่อนใช้) */
/** ข้อมูลเส้นตามที่เก็บใน Firebase (ชื่อสั้นเพื่อประหยัดที่) */
export interface StrokeData {
  u: string | null; t: BrushType; c: string; s: number; sd: number; w: number; px: number; a: number; wl: number; sh: WaveShape; p: string;
  fl?: number; oc?: string; ow?: number; pw?: string; ts?: object | number;
}
function encode(s: Stroke, live: boolean): StrokeData{
  let pts = s.pts;
  if (pts.length > (live ? LIVE_PTS : MAX_PTS)) pts = live ? pts.slice(-LIVE_PTS) : pts.slice(0, MAX_PTS);
  const p: number[] = new Array(pts.length * 2);
  for (let i = 0; i < pts.length; i++){ p[i*2] = Math.round(pts[i].x); p[i*2+1] = Math.round(pts[i].y); }
  const d: StrokeData = {
    u:live ? room.uid : (s.uid || room.uid), t:s.type, c:/^#[0-9a-f]{6}$/.test(s.color) ? s.color : '#2a2420',
    s:r2(clampN(s.size, .05, 400, 4)), sd:s.seed|0, w:r2(clampN(s.wiggle, 0, 10, 2)), px:r2(clampN(s.pixel, 1, 200, 6)),
    a:r2(clampN(s.amp, 0, 400, 7)), wl:r2(clampN(s.wavelen, 2, 800, 18)), sh:SHAPES.includes(s.shape) ? s.shape : 'zigzag',
    p:p.join(',')
  };
  if (s.type === 'paint') d.fl = r2(clampN(s.flow, .05, 1, .55));
  if (s.type === 'outline'){
    d.oc = /^#[0-9a-f]{6}$/.test(s.oc) ? s.oc : '#2a2420'; d.ow = r2(clampN(s.ow, .05, 100, 3));
    if (Array.isArray(s.pw) && s.pw.length === s.pts.length){
      const pw = s.pts.length === pts.length ? s.pw : live ? s.pw.slice(-pts.length) : s.pw.slice(0, pts.length);
      d.pw = pw.map((v: number) => Math.round(clampN(v, 0, 1, 1) * 100)).join(',');
    }
  }
  if (!live) d.ts = room.fb!.serverTimestamp();
  return d;
}
function decode(d: any): Stroke | null{   // d มาจากฐานข้อมูล ตรวจทุกค่าก่อนใช้
  if (!d || typeof d !== 'object' || !TYPES.includes(d.t) || typeof d.p !== 'string' || d.p.length > 60000) return null;
  const nums = d.p.split(',', MAX_PTS * 2), pts: Pt[] = [];
  for (let i = 0; i + 1 < nums.length; i += 2){
    const x = +nums[i], y = +nums[i+1];
    if (isFinite(x) && isFinite(y) && Math.abs(x) < 1e6 && Math.abs(y) < 1e6) pts.push({x, y});
  }
  if (!pts.length) return null;
  const s: Stroke = {
    type:d.t, color:/^#[0-9a-f]{6}$/.test(d.c) ? d.c : '#2a2420', size:clampN(d.s, .05, 400, 4), seed:clampN(d.sd, -2e9, 2e9, 1)|0,
    wiggle:clampN(d.w, 0, 10, 2), pixel:clampN(d.px, 2, 200, 6), amp:clampN(d.a, 0, 400, 7), wavelen:clampN(d.wl, 2, 800, 18), flow:clampN(d.fl, .05, 1, .55),
    shape:SHAPES.includes(d.sh) ? d.sh : 'zigzag', uid:typeof d.u === 'string' ? d.u : '',
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
function insertSorted(s: Stroke){
  if (G.strokes.some(x => x.id === s.id)) return;
  const next = G.strokes.slice();
  let i = next.length;
  while (i > 0 && next[i-1].id! > s.id!) i--;
  next.splice(i, 0, s);
  G.strokes = next; G.dirty = true;
}
function removeLocal(id: string | null){
  const i = G.strokes.findIndex(x => x.id === id);
  if (i >= 0){ G.strokes = G.strokes.slice(0, i).concat(G.strokes.slice(i + 1)); G.dirty = true; }
}

/* ห้อง */
async function claimSlot(code: string): Promise<'a' | 'b' | null>{
  const fb = room.fb!;
  const cur = (await fb.get(R(`rooms/${code}/slots`))).val() || {};
  if (cur.a === room.uid) return 'a';
  if (cur.b === room.uid) return 'b';
  for (const slot of ['a', 'b'] as const){
    if (cur[slot]) continue;
    try {
      const res = await fb.runTransaction(R(`rooms/${code}/slots/${slot}`), v => (v === null || v === room.uid) ? room.uid : undefined);
      if (res.committed && res.snapshot.val() === room.uid) return slot;
    } catch (_) {}
  }
  return null;
}
function expiresAt(meta: RoomMeta | null){ return (meta && meta.createdAt || 0) + ROOM_TTL; }
function leftText(ms: number){
  if (ms <= 0) return 'หมดอายุแล้ว';
  const h = Math.floor(ms / 3600000), d = Math.floor(h / 24);
  if (d >= 1) return `ห้องจะหายในอีก ${d} วัน ${h % 24} ชั่วโมง`;
  if (h >= 1) return `ห้องจะหายในอีก ${h} ชั่วโมง`;
  return `ห้องจะหายในอีก ${Math.max(1, Math.ceil(ms / 60000))} นาที`;
}
async function joinRoom(code: string, key: string | null){
  const fb = await ensureFirebase();
  const meta = (await fb.get(R(`rooms/${code}/meta`))).val();
  if (!meta) throw {code:'not-found'};
  if (Date.now() > expiresAt(meta)) throw {code:'expired'};
  room.meta = meta; room.key = null;
  if (meta.private === true){
    key = key || readSavedKey(code);   // เคยเข้าห้องนี้แล้ว ใช้รหัสที่จำไว้
    if (meta.owner !== room.uid){
      if (!key) throw {code:'need-key'};
      // เขียนรหัสผ่านลงที่ของตัวเอง กฎของฐานข้อมูลจะยอมก็ต่อเมื่อรหัสตรงกับของห้อง
      try { await fb.set(R(`rooms/${code}/keys/${room.uid}`), key); }
      catch (err) { if (errKey(err) === 'denied') throw {code:'wrong-key'}; throw err; }
    }
    room.key = key;
  }
  const slot = await claimSlot(code);
  if (!slot) throw {code:'full'};
  if (room.key) saveKey(code, room.key);   // จำไว้ กลับมาเข้าห้องนี้อีกจะได้ไม่ต้องพิมพ์ใหม่
  await enterRoom(code, slot);
}
async function enterRoom(code: string, slot: 'a' | 'b'){
  const fb = room.fb!, base = `rooms/${code}`;
  if (G.current){ G.current = null; G.raw = null; G.activeId = null; }
  room.solo = {strokes: G.strokes, undoStack: G.undoStack, redoStack: G.redoStack};
  G.strokes = []; G.undoStack = []; G.redoStack = [];
  Object.assign(room, {active:true, code, slot, myUndo:[], myRedo:[], members:1, connected:true});
  room.live.clear();

  // ถ้าเจ้าของลบห้อง หรือห้องครบ 3 วัน ให้ออกจากห้องเอง
  room.unsubs.push(fb.onValue(R(`${base}/meta`), (snap: DbSnap) => {
    if (!room.active) return;
    if (!snap.exists()){ leaveRoom().then(() => toast('ห้องนี้ถูกลบแล้ว รูปเดิมของคุณกลับมาแล้ว')); return; }
    room.meta = snap.val(); updateRoomUI();
  }));
  clearTimeout(room.expireTimer);
  room.expireTimer = setTimeout(() => { if (room.active) leaveRoom().then(() => toast('ห้องนี้ครบ 3 วันแล้ว จึงปิดไป')); },
    Math.min(2147483647, Math.max(0, expiresAt(room.meta) - Date.now())));

  const sref = R(`${base}/strokes`);
  room.unsubs.push(fb.onChildAdded(sref, snap => {
    const s = decode(snap.val()); if (!s) return;
    s.id = snap.key!; insertSorted(s); updateUI();
  }, roomFail));
  room.unsubs.push(fb.onChildRemoved(sref, snap => { removeLocal(snap.key); updateUI(); }));

  const lref = R(`${base}/live`);
  const onLive = (snap: DbSnap) => {
    if (!snap.key || snap.key === room.uid) return;
    const s = decode(snap.val());
    if (s) room.live.set(snap.key, s); else room.live.delete(snap.key);
    G.dirty = true;
  };
  room.unsubs.push(fb.onChildAdded(lref, onLive), fb.onChildChanged(lref, onLive),
    fb.onChildRemoved(lref, snap => { room.live.delete(snap.key || ''); G.dirty = true; }));

  room.unsubs.push(fb.onValue(R(`${base}/slots`), snap => {
    const v = snap.val() || {};
    const n = Object.values(v).filter(Boolean).length, prev = room.members;
    room.members = Math.max(1, n);
    if (n > prev && prev >= 1 && n >= 2) toast('เพื่อนเข้าห้องแล้ว วาดด้วยกันได้เลย');
    if (n < prev && prev >= 2) toast('เพื่อนออกจากห้องแล้ว');
    updateRoomUI();
  }));

  // ต่อเน็ตใหม่เมื่อไหร่ ให้จองที่นั่งกลับคืน และตั้งให้ลบที่นั่งเองเมื่อหลุด
  room.unsubs.push(fb.onValue(R('.info/connected'), async snap => {
    clearTimeout(room.dropTimer);
    if (!snap.val()){
      // ตอนเริ่มต่อ Firebase จะบอกว่าออฟไลน์แป๊บหนึ่งก่อนเสมอ จึงรอดูก่อนค่อยขึ้นว่ากำลังต่อใหม่
      room.dropTimer = setTimeout(() => { room.connected = false; updateRoomUI(); }, 1500);
      return;
    }
    room.connected = true; updateRoomUI();
    if (!room.active || room.code !== code) return;
    try {
      const s = await claimSlot(code);
      if (!room.active || room.code !== code) return;   // ออกจากห้องไประหว่างรอ
      if (!s){ toast('ห้องนี้มีคนครบ 2 คนแล้ว'); leaveRoom(); return; }
      room.slot = s;
      await fb.onDisconnect(R(`${base}/slots/${s}`)).remove();
      await fb.onDisconnect(R(`${base}/live/${room.uid}`)).remove();
    } catch (err) { console.warn(err); }
  }));

  try { history.replaceState(null, '', '?room=' + code + (room.key ? '&key=' + room.key : '')); } catch (_) {}
  G.ZOOM = 1; G.PX = 0; G.PY = 0;
  resize(); updateUI(); updateRoomUI(); updateZoomUI(); renderLayerList();
}
async function leaveRoom(){
  if (!room.active) return;
  const fb = room.fb!, base = `rooms/${room.code}`, slot = room.slot;
  room.unsubs.forEach(u => { try { u(); } catch (_) {} });
  room.unsubs = [];
  clearTimeout(room.liveTimer ?? undefined); room.liveTimer = null;
  clearTimeout(room.expireTimer); room.expireTimer = undefined;
  clearTimeout(room.dropTimer);
  try {
    const lr = R(`${base}/live/${room.uid}`);
    await fb.onDisconnect(lr).cancel(); await fb.remove(lr);
    if (slot){ const sr = R(`${base}/slots/${slot}`); await fb.onDisconnect(sr).cancel(); await fb.remove(sr); }
  } catch (_) {}
  room.active = false; room.code = null; room.slot = null; room.live.clear();
  if (room.solo){ ({strokes: G.strokes, undoStack: G.undoStack, redoStack: G.redoStack} = room.solo); room.solo = null; }
  G.current = null; G.raw = null; G.activeId = null;
  try { history.replaceState(null, '', location.pathname); } catch (_) {}
  G.ZOOM = 1; G.PX = 0; G.PY = 0;
  resize(); updateUI(); updateRoomUI(); updateZoomUI(); renderLayerList();
}

/* ส่งเส้น */
export function roomSendLive(){
  const now = performance.now();
  if (now - room.lastLive < 70){
    if (!room.liveTimer) room.liveTimer = setTimeout(() => { room.liveTimer = null; roomSendLive(); }, 75);
    return;
  }
  room.lastLive = now;
  if (!G.current || !room.active) return;
  room.fb!.set(R(`rooms/${room.code}/live/${room.uid}`), encode(G.current, true)).catch(() => {});
}
export function roomCommit(s: Stroke){
  const fb = room.fb!, base = `rooms/${room.code}`;
  clearTimeout(room.liveTimer ?? undefined); room.liveTimer = null;
  const id = fb.push(R(`${base}/strokes`)).key!;
  const data = encode(s, false);
  const local = decode(Object.assign({}, data, {ts:0}));
  if (!local) return;
  local.id = id;
  insertSorted(local);
  fb.set(R(`${base}/strokes/${id}`), data).catch(err => { removeLocal(id); updateUI(); roomFail(err); });
  fb.remove(R(`${base}/live/${room.uid}`)).catch(() => {});
  room.myUndo.push({type:'add', id, data});
  if (room.myUndo.length > 200) room.myUndo.shift();
  room.myRedo = [];
}
export function roomClear(){
  const fb = room.fb!, base = `rooms/${room.code}/strokes`;
  const items = G.strokes.filter(s => s.id).map((s): [string, StrokeData] => [s.id!, encode(s, false)]);
  G.strokes = []; G.dirty = true;
  fb.remove(R(base)).catch(roomFail);
  room.myUndo.push({type:'clear', items}); room.myRedo = [];
  updateUI();
  toast('ล้างกระดาษของห้องแล้ว อยากได้คืนให้กด Undo');
}
export function roomStep(isUndo: boolean){
  const from = isUndo ? room.myUndo : room.myRedo, to = isUndo ? room.myRedo : room.myUndo;
  const e = from.pop(); if (!e) return;
  const fb = room.fb!, base = `rooms/${room.code}/strokes`;
  const restore = (list: [string, StrokeData][]) => {
    const upd: Record<string, StrokeData> = {};
    for (const [id, d] of list){
      const data = Object.assign({}, d, {ts:fb.serverTimestamp()}); upd[id] = data;
      const s = decode(Object.assign({}, d, {ts:0})); if (s){ s.id = id; insertSorted(s); }
    }
    fb.update(R(base), upd).catch(roomFail);
  };
  if (e.type === 'add'){
    if (isUndo){ removeLocal(e.id); fb.remove(R(`${base}/${e.id}`)).catch(roomFail); }
    else restore([[e.id, e.data]]);
  } else if (e.type === 'clear'){
    if (isUndo) restore(e.items);
    else { G.strokes = []; G.dirty = true; fb.remove(R(base)).catch(roomFail); }
  }
  to.push(e); updateUI();
}

/* หน้าต่างห้อง */
export const ERR: Record<string, string> = {
  'need-key':'ห้องนี้เป็นห้องส่วนตัว ใส่รหัสผ่านก่อนนะ',
  'wrong-key':'รหัสผ่านไม่ถูกต้อง',
  'expired':'ห้องนี้ครบ 3 วันแล้ว จึงปิดไป',
  'no-config':'ยังไม่ได้ตั้งค่า Firebase ดูวิธีตั้งค่าในไฟล์ README.md',
  'not-found':'ไม่พบห้องนี้ ลองเช็กรหัสอีกครั้ง',
  'full':'ห้องนี้มีคนครบ 2 คนแล้ว',
  'bad-code':'รหัสห้องต้องมี 6 ตัว',
  'auth':'ยังไม่ได้เปิดการเข้าใช้แบบไม่ระบุตัวตน (Anonymous) ใน Firebase',
  'domain':'โดเมนของเว็บนี้ยังไม่ได้รับอนุญาตใน Firebase (Authorized domains)',
  'denied':'ฐานข้อมูลไม่อนุญาต ลองเช็กว่าใส่ Security Rules แล้วหรือยัง',
  'net':'เชื่อมต่อไม่ได้ ลองเช็กอินเทอร์เน็ตแล้วลองใหม่'
};
export const errKey = (err: unknown) => errKind(err, ERR);
function roomFail(err: unknown){ console.warn(err); toast(ERR[errKey(err)]); }
function showRoomMsg(key: string | null){ const m = $('#roomMsg'); m.textContent = key ? (ERR[key] || key) : ''; m.hidden = !key; }
function roomReady(){ return fbConfig() ? null : 'no-config'; }
function openRoomModal(){
  closeSheet();
  showRoomMsg(room.active ? null : roomReady());
  updateRoomUI();
  $('#roomModal').classList.add('show');
}
export function closeRoomModal(){ $('#roomModal').classList.remove('show'); }
function roomLink(){ return location.origin + location.pathname + '?room=' + room.code + (room.key ? '&key=' + room.key : ''); }
export function updateRoomUI(){
  const on = room.active;
  $('#roomBtn').classList.toggle('live', on);
  $('#roomLbl').textContent = on ? (room.connected ? 'ห้อง ' + room.code : 'กำลังต่อใหม่') : 'วาดกับเพื่อน';
  $('#roomBadge').hidden = !on;
  $('#roomCount').textContent = room.members + '/2';
  $('#roomDot').classList.toggle('off', !room.connected);
  $('#memberDot').classList.toggle('off', !room.connected);
  $('#roomLobby').hidden = on; $('#roomIn').hidden = !on;
  $('#roomTitle').textContent = on ? 'คุณอยู่ในห้องแล้ว' : 'วาดกับเพื่อน';
  if (on){
    const m = room.meta || {};
    $('#roomName').textContent = typeof m.name === 'string' ? m.name : 'ห้อง ' + room.code;
    $('#roomName').translate = typeof m.name !== 'string';   // ชื่อที่คนตั้งเองไม่ต้องแปล
    $('#roomTag').textContent = m.private ? 'ส่วนตัว' : 'สาธารณะ';
    $('#roomTag').classList.toggle('private', !!m.private);
    $('#keyLine').hidden = !(m.private && room.key);
    $('#keyBig').textContent = room.key || '';
    $('#expireText').textContent = leftText(expiresAt(m) - Date.now());
    $('#codeBig').textContent = room.code;
    $<HTMLInputElement>('#shareLink').value = roomLink();
    $('#memberText').textContent = !room.connected ? 'เน็ตหลุด กำลังเชื่อมต่อใหม่'
      : room.members >= 2 ? 'เพื่อนอยู่ในห้องแล้ว วาดด้วยกันได้เลย' : 'ตอนนี้มีคุณคนเดียว ส่งลิงก์ให้เพื่อนได้เลย';
  }
  const blocked = !!roomReady() || room.busy;
  $<HTMLButtonElement>('#joinBtn').disabled = blocked; $<HTMLInputElement>('#codeInput').disabled = $<HTMLInputElement>('#keyInput').disabled = !!roomReady();
}
async function runRoomAction(fn: () => Promise<void>, btn: HTMLElement, busyText: string){
  if (room.busy) return;
  room.busy = true; showRoomMsg(null);
  const old = btn.textContent; btn.textContent = busyText; updateRoomUI();
  try { await fn(); closeRoomModal(); toast('เข้าห้อง ' + room.code + ' แล้ว'); }
  catch (err) { console.warn(err); showRoomMsg(errKey(err)); }
  finally { room.busy = false; btn.textContent = old; updateRoomUI(); }
}
// เปิดลิงก์ที่มี ?room=รหัส แล้วเข้าห้องให้อัตโนมัติ
export function autoJoin(){
  let code = '', key: string | null = null;
  try {
    const q = new URLSearchParams(location.search);
    code = (q.get('room') || '').toUpperCase();
    key = (q.get('key') || '').toUpperCase() || null;
  } catch (_) {}
  if (!code) return;
  if (key && !CODE_RE.test(key)) key = null;
  if (!CODE_RE.test(code) || roomReady()){ openRoomModal(); if (!roomReady()) showRoomMsg('not-found'); return; }
  $<HTMLInputElement>('#codeInput').value = code;
  if (key) $<HTMLInputElement>('#keyInput').value = key;
  toast('กำลังเข้าห้อง ' + code);
  room.busy = true;
  joinRoom(code, key).then(() => toast('เข้าห้อง ' + code + ' แล้ว'))
    .catch(err => {
      console.warn(err); openRoomModal(); showRoomMsg(errKey(err));
      if (needsKey(err)){ $('#keyForm').hidden = false; $('#keyInput').focus(); }
    })
    .finally(() => { room.busy = false; updateRoomUI(); });
}

export function initRoom(){
  $('#roomBtn').addEventListener('click', openRoomModal);
  $('#roomClose').addEventListener('click', closeRoomModal);
  $('#roomModal').addEventListener('click', e => { if ((e.target as Element).id === 'roomModal') closeRoomModal(); });
  const codeOnly = (e: Event) => {
    const t = e.target as HTMLInputElement, v = t.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 6);
    if (v !== t.value) t.value = v;
  };
  $('#keyInput').addEventListener('input', codeOnly);
  $('#keyForm').addEventListener('submit', e => { e.preventDefault(); $<HTMLFormElement>('#joinForm').requestSubmit(); });
  $('#codeInput').addEventListener('input', codeOnly);
  $('#joinForm').addEventListener('submit', e => {
    e.preventDefault();
    const code = $<HTMLInputElement>('#codeInput').value.trim().toUpperCase();
    if (!CODE_RE.test(code)){ showRoomMsg('bad-code'); return; }
    const key = $<HTMLInputElement>('#keyInput').value.trim().toUpperCase() || null;
    runRoomAction(async () => {
      try { await joinRoom(code, key); }
      catch (err) { if (needsKey(err)){ $('#keyForm').hidden = false; $('#keyInput').focus(); } throw err; }
    }, $('#joinBtn'), 'กำลังเข้า');
  });
  $('#leaveRoom').addEventListener('click', async () => { await leaveRoom(); closeRoomModal(); toast('ออกจากห้องแล้ว รูปเดิมของคุณกลับมาแล้ว'); });
  $('#copyLink').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText(roomLink()); toast('คัดลอกลิงก์แล้ว ส่งให้เพื่อนได้เลย'); }
    catch (_) { const i = $<HTMLInputElement>('#shareLink'); i.focus(); i.select(); toast('กดค้างที่ลิงก์แล้วเลือกคัดลอกได้เลย'); }
  });
  window.addEventListener('pagehide', () => {
    if (room.active && room.fb){ try { room.fb.remove(R(`rooms/${room.code}/live/${room.uid}`)); } catch (_) {} }
  });
}
