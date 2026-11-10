import { CODE_RE, ROOM_TTL, type FbDatabase, connectFirebase, errKey as errKind, forgetKey, genCode, saveKey, savedKeys } from '../shared/firebase.js';

/* ---------- รายการห้อง ---------- */
export const $ = <T extends Element = HTMLElement>(s: string): T => document.querySelector(s) as T;

export type Filter = 'all' | 'public' | 'private' | 'mine';
interface RoomInfo { code: string; name: string; private: boolean; owner: string; createdAt: number; }
export const st = {
  fb: null as FbDatabase | null, db: null as unknown, uid: null as string | null,
  rooms: {} as Record<string, RoomInfo>, counts: {} as Record<string, number>, slotUnsubs: {} as Record<string, () => void>,
  filter: 'all' as Filter, vis: 'public' as 'public' | 'private', busy: false,
  cleaned: new Set<string>(), confirmDel: null as string | null, openKey: {} as Record<string, string>,
};

const ICON_PEOPLE = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="6" cy="5.5" r="2.3"/><path d="M1.8 13.5c.4-2.4 2.1-3.8 4.2-3.8s3.8 1.4 4.2 3.8"/><circle cx="11.3" cy="5" r="1.8"/><path d="M11.6 9.3c1.5.2 2.4 1.4 2.7 3.2"/></svg>';
const ICON_CLOCK = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round"><circle cx="8" cy="8" r="6"/><path d="M8 4.5V8l2.5 1.5"/></svg>';

function leftText(ms: number){
  if (ms <= 0) return 'หมดอายุแล้ว';
  const h = Math.floor(ms / 3600000), d = Math.floor(h / 24);
  if (d >= 1) return `หายในอีก ${d} วัน ${h % 24} ชม.`;
  if (h >= 1) return `หายในอีก ${h} ชม.`;
  return `หายในอีก ${Math.max(1, Math.ceil(ms / 60000))} นาที`;
}
export const ERR: Record<string, string> = {
  'no-config':'ยังไม่ได้ตั้งค่า Firebase จึงยังเปิดห้องไม่ได้ ดูวิธีตั้งค่าในไฟล์ README.md (วาดคนเดียวใช้ได้ตามปกติ)',
  'auth':'ยังไม่ได้เปิดการเข้าใช้แบบไม่ระบุตัวตน (Anonymous) ใน Firebase',
  'domain':'โดเมนของเว็บนี้ยังไม่ได้รับอนุญาตใน Firebase (Authorized domains)',
  'denied':'ฐานข้อมูลไม่อนุญาต ลองเช็กว่าใส่ Security Rules ชุดล่าสุดแล้วหรือยัง',
  'bad-code':'รหัสห้องต้องมี 6 ตัว',
  'busy':'สร้างห้องไม่สำเร็จ ลองใหม่อีกครั้ง',
  'net':'เชื่อมต่อไม่ได้ ลองเช็กอินเทอร์เน็ตแล้วลองใหม่'
};
export const errKey = (err: unknown) => errKind(err, ERR);
export function showMsg(k: string | null, where = '#msg'){ const m = $(where); m.textContent = k ? (ERR[k] || k) : ''; m.hidden = !k; }

export async function ensureFirebase(){
  if (st.fb) return st.fb;
  const s = await connectFirebase();
  st.uid = s.uid; st.db = s.db; st.fb = s.fb;
  return s.fb;
}
const R = (p: string) => st.fb!.ref(st.db, p);

export function watchList(){
  const fb = st.fb!;
  const q = fb.query(R('lobby'), fb.orderByChild('createdAt'), fb.limitToLast(100));
  fb.onValue(q, snap => {
    const v = snap.val() || {};
    st.rooms = {};
    for (const [code, r] of Object.entries<any>(v)){   // ข้อมูลจากฐานข้อมูล ตรวจทุกค่าก่อนใช้
      if (!CODE_RE.test(code) || !r || typeof r !== 'object') continue;
      st.rooms[code] = {
        code, name:typeof r.name === 'string' ? r.name.slice(0, 40) : 'ห้องไม่มีชื่อ',
        private:r.private === true, owner:typeof r.owner === 'string' ? r.owner : '',
        createdAt:typeof r.createdAt === 'number' ? r.createdAt : 0
      };
    }
    syncCounts(); cleanup(); render();
  }, err => { console.warn(err); showMsg(errKey(err)); $('#list').innerHTML = ''; });
}
// นับคนในแต่ละห้อง
function syncCounts(){
  for (const code of Object.keys(st.slotUnsubs)){
    if (!st.rooms[code]){ st.slotUnsubs[code](); delete st.slotUnsubs[code]; delete st.counts[code]; }
  }
  for (const code of Object.keys(st.rooms)){
    if (st.slotUnsubs[code]) continue;
    st.slotUnsubs[code] = st.fb!.onValue(R(`rooms/${code}/slots`), snap => {
      st.counts[code] = Object.values(snap.val() || {}).filter(Boolean).length;
      render();
    }, () => {});
  }
}
// ลบห้องที่ครบ 3 วัน (ใครเปิดหน้านี้ก็ช่วยลบได้ กฎของฐานข้อมูลยอมให้ลบเฉพาะห้องที่หมดอายุ)
export function cleanup(){
  const now = Date.now();
  for (const r of Object.values(st.rooms)){
    if (now < r.createdAt + ROOM_TTL || st.cleaned.has(r.code)) continue;
    st.cleaned.add(r.code);
    deleteRoom(r.code).catch(err => console.warn('cleanup', r.code, err));
  }
}
function deleteRoom(code: string){
  forgetKey(code);
  return st.fb!.update(R('/'), {[`rooms/${code}`]:null, [`lobby/${code}`]:null, [`secrets/${code}`]:null});
}
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => {
  const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e;
};
export function render(){
  const list = $('#list'), now = Date.now();
  const ae = document.activeElement, holder = ae && ae.closest<HTMLElement>('[data-key-for]'), focusKey = holder ? holder.dataset.keyFor : null;
  const all = Object.values(st.rooms).filter(r => now < r.createdAt + ROOM_TTL).sort((a, b) => b.createdAt - a.createdAt);
  const shown = all.filter(r => st.filter === 'all' || (st.filter === 'public' && !r.private) || (st.filter === 'private' && r.private) || (st.filter === 'mine' && r.owner === st.uid));
  $('#count').textContent = all.length ? `(${all.length})` : '';
  list.textContent = '';
  const keys = savedKeys();
  for (const r of shown){
    const mine = r.owner === st.uid, n = st.counts[r.code] || 0, full = n >= 2;
    const card = el('div', 'room' + (mine ? ' mine' : ''));
    const main = el('div');
    const nm = el('div', 'r-name', r.name); nm.translate = r.name === 'ห้องไม่มีชื่อ';   // ชื่อที่คนตั้งเองไม่ต้องแปล
    const meta = el('div', 'r-meta');
    const tag = el('span', 'tag' + (r.private ? ' private' : ''), r.private ? 'ส่วนตัว' : 'สาธารณะ');
    const ppl = el('span'); ppl.innerHTML = ICON_PEOPLE; ppl.append(` ${n}/2`); if (full) ppl.classList.add('full');
    const tm = el('span'); tm.innerHTML = ICON_CLOCK; tm.append(' ' + leftText(r.createdAt + ROOM_TTL - now));
    meta.append(tag, ppl, tm);
    if (mine) meta.append(el('span', 'tag me', 'ห้องของคุณ'));
    if (!r.private) meta.append(el('span', '', 'รหัส ' + r.code));
    main.append(nm, meta);

    const act = el('div', 'r-act');
    const go = el('button', 'btn primary');
    const myKey = CODE_RE.test(keys[r.code]) ? keys[r.code] : null;   // รหัสห้องส่วนตัวที่เคยเข้าสำเร็จ
    go.textContent = full ? 'เต็มแล้ว' : (r.private && !myKey ? 'ใส่รหัสผ่าน' : 'เข้าห้อง');
    go.disabled = full;
    act.append(go);
    let keyRow: HTMLFormElement | null = null;
    if (r.private && !myKey){
      const form = keyRow = el('form', 'r-key'); form.hidden = !(r.code in st.openKey);
      const inp = el('input', 'input code-in'); inp.maxLength = 6; inp.placeholder = 'รหัสผ่าน 6 ตัว';
      inp.autocapitalize = 'characters'; inp.spellcheck = false; inp.value = st.openKey[r.code] || '';
      inp.addEventListener('input', () => { inp.value = inp.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 6); st.openKey[r.code] = inp.value; });
      const ok = el('button', 'btn', 'เข้า'); ok.type = 'submit';
      form.append(inp, ok);
      form.addEventListener('submit', e => {
        e.preventDefault();
        if (!CODE_RE.test(inp.value)){ showMsg('รหัสผ่านต้องมี 6 ตัว'); return; }
        location.href = `draw.html?room=${r.code}&key=${inp.value}`;
      });
      go.addEventListener('click', () => {
        if (r.code in st.openKey) delete st.openKey[r.code]; else st.openKey[r.code] = '';
        render(); document.querySelector<HTMLInputElement>(`[data-key-for="${r.code}"] input`)?.focus();
      });
      form.dataset.keyFor = r.code;
    } else {
      go.addEventListener('click', () => { location.href = `draw.html?room=${r.code}` + (r.private && myKey ? `&key=${myKey}` : ''); });
    }
    if (mine){
      const del = el('button', 'btn danger');
      const confirming = st.confirmDel === r.code;
      del.textContent = confirming ? 'ยืนยันลบ' : 'ลบห้อง';
      if (confirming) del.classList.add('confirm');
      del.addEventListener('click', async () => {
        if (st.confirmDel !== r.code){   // กดครั้งแรกให้ยืนยันก่อน
          st.confirmDel = r.code; render();
          setTimeout(() => { if (st.confirmDel === r.code){ st.confirmDel = null; render(); } }, 3000);
          return;
        }
        st.confirmDel = null; del.disabled = true; del.textContent = 'กำลังลบ';
        try { await deleteRoom(r.code); showMsg(null); } catch (err) { console.warn(err); showMsg(errKey(err)); render(); }
      });
      act.append(del);
    }
    card.append(main, act);
    if (keyRow) card.append(keyRow);
    list.append(card);
  }
  if (focusKey){ const f = list.querySelector<HTMLInputElement>(`[data-key-for="${focusKey}"] input`); if (f){ f.focus(); f.setSelectionRange(f.value.length, f.value.length); } }
  $('#empty').hidden = shown.length > 0;
  $('#emptyText').textContent = all.length === 0 ? 'ยังไม่มีห้องที่เปิดอยู่' : 'ไม่มีห้องในหมวดนี้';
  $('#emptyCreate').hidden = all.length > 0;
}

/* ---------- สร้างห้อง ---------- */
export async function createRoom(){
  const fb = await ensureFirebase();
  const name = $<HTMLInputElement>('#nameInput').value.replace(/\s+/g, ' ').trim().slice(0, 30) || 'ห้องวาดเล่น';
  const priv = st.vis === 'private';
  for (let i = 0; i < 6; i++){
    const code = genCode();
    if ((await fb.get(R(`rooms/${code}/meta`))).exists()) continue;
    const TS = fb.serverTimestamp(), upd: Record<string, unknown> = {};
    upd[`rooms/${code}/meta`] = {createdAt:TS, owner:st.uid, name, private:priv};
    upd[`lobby/${code}`] = {createdAt:TS, owner:st.uid, name, private:priv};
    let key: string | null = null;
    if (priv){
      key = genCode();
      upd[`secrets/${code}`] = key;
      upd[`rooms/${code}/keys/${st.uid}`] = key;
    }
    await fb.update(R('/'), upd);
    if (key) saveKey(code, key);
    location.href = `draw.html?room=${code}` + (key ? `&key=${key}` : '');
    return;
  }
  throw {code:'busy'};
}
