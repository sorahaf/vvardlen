import '../i18n/index.js';
import { CODE_RE, fbConfig } from '../shared/firebase.js';
import { $, type Filter, cleanup, createRoom, ensureFirebase, errKey, render, showMsg, st, watchList } from './rooms.js';
import { startArt } from './art.js';

/* ---------- หน้ารวมห้อง ---------- */
function openCreate(){
  showMsg(fbConfig() ? null : 'no-config', '#createMsg');
  $('#createModal').classList.add('show');
  setTimeout(() => $('#nameInput').focus(), 50);
}
function closeCreate(){ $('#createModal').classList.remove('show'); }

document.querySelectorAll<HTMLElement>('#vis button').forEach(b => b.addEventListener('click', () => {
  st.vis = b.dataset.vis === 'private' ? 'private' : 'public';
  document.querySelectorAll('#vis button').forEach(x => x.classList.toggle('on', x === b));
  $('#visNote').textContent = st.vis === 'private'
    ? 'คนอื่นเห็นชื่อห้อง แต่ต้องมีรหัสผ่านถึงจะเข้าได้ ระบบสุ่มรหัสผ่านให้'
    : 'ทุกคนเห็นในรายการและกดเข้าได้ทันที';
}));
document.querySelectorAll<HTMLElement>('#filter button').forEach(b => b.addEventListener('click', () => {
  st.filter = (b.dataset.f || 'all') as Filter;
  document.querySelectorAll('#filter button').forEach(x => x.classList.toggle('on', x === b));
  render();
}));
$('#openCreate').addEventListener('click', openCreate);
$('#emptyCreate').addEventListener('click', openCreate);
$('#closeCreate').addEventListener('click', closeCreate);
$('#createModal').addEventListener('click', e => { if ((e.target as Element).id === 'createModal') closeCreate(); });
window.addEventListener('keydown', e => { if (e.key === 'Escape') closeCreate(); });
$('#nameInput').addEventListener('keydown', e => { if (e.key === 'Enter') $('#createBtn').click(); });
$('#createBtn').addEventListener('click', async () => {
  if (st.busy) return;
  st.busy = true; showMsg(null, '#createMsg');
  const b = $<HTMLButtonElement>('#createBtn'); b.disabled = true; b.textContent = 'กำลังสร้างห้อง';
  try { await createRoom(); }
  catch (err) { console.warn(err); showMsg(errKey(err), '#createMsg'); b.disabled = false; b.textContent = 'สร้างห้อง'; }
  finally { st.busy = false; }
});
const codeIn = $<HTMLInputElement>('#codeInput');
codeIn.addEventListener('input', () => { codeIn.value = codeIn.value.toUpperCase().replace(/[^0-9A-Z]/g, '').slice(0, 6); });
$('#joinForm').addEventListener('submit', e => {
  e.preventDefault();
  if (!CODE_RE.test(codeIn.value)){ showMsg('bad-code'); return; }
  location.href = 'draw.html?room=' + codeIn.value;
});

startArt();

/* ---------- เริ่ม ---------- */
(async () => {
  if (!fbConfig()){
    showMsg('no-config'); $('#list').textContent = '';
    $<HTMLButtonElement>('#createBtn').disabled = true;
    $('#empty').hidden = false; $('#emptyText').textContent = 'ยังดูรายการห้องไม่ได้ ระหว่างนี้กด “เริ่มวาดเลย” ได้ก่อน'; $('#emptyCreate').hidden = true;
    return;
  }
  try { await ensureFirebase(); watchList(); }
  catch (err) { console.warn(err); showMsg(errKey(err)); $('#list').textContent = ''; }
  setInterval(() => { cleanup(); render(); }, 30000);   // อัปเดตเวลานับถอยหลัง
})();
