import { t } from '../i18n/index.js';
import { $, G, state } from '../draw/core.js';
import { loop } from '../draw/render.js';
import { resize } from '../draw/view.js';
import { PAPERS } from '../draw/paper.js';
import { unpackDrawing } from '../draw/artdata.js';
import { fbConfig } from '../shared/firebase.js';
import { HIDE_AT, ID_RE, artLink, deleteArt, likedSet, loadArt, loadItem, reportArt, reportedSet, renderArtists, session, toggleLike } from '../shared/gallery.js';

/* ---------- หน้าดูรูปจากแกลเลอรี่ ---------- */
const HEART = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M8 13.5S2 10 2 5.8A3.2 3.2 0 0 1 8 4.2a3.2 3.2 0 0 1 6 1.6C14 10 8 13.5 8 13.5z"/></svg>';
const PAUSE = '<svg viewBox="0 0 16 16" fill="currentColor"><rect x="4" y="3" width="3" height="10" rx="1"/><rect x="9" y="3" width="3" height="10" rx="1"/></svg>';
const PLAY = '<svg viewBox="0 0 16 16" fill="currentColor"><path d="M5 3.2v9.6a.6.6 0 0 0 .9.5l7.4-4.8a.6.6 0 0 0 0-1L5.9 2.7a.6.6 0 0 0-.9.5z"/></svg>';
const id = new URLSearchParams(location.search).get('id') || '';

let toastT: number | undefined;
function toast(m: string){ const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }
function fail(m: string){ $('#vMsgText').textContent = m; $('#vMsg').hidden = false; $('#vBar').hidden = true; }

function setHeart(on: boolean, n: number){ const h = $('#vLike'); h.classList.toggle('on', on); h.innerHTML = HEART; h.append(String(n)); }
function setPlay(){
  const b = $('#vPlay'), t = state.playing ? 'หยุดเส้น' : 'ให้เส้นขยับ';
  b.innerHTML = state.playing ? PAUSE : PLAY; b.title = t; b.setAttribute('aria-label', t);
}

async function start(){
  if (!ID_RE.test(id)) return fail('ไม่พบรูปนี้');
  if (!fbConfig()) return fail('ยังไม่ได้ตั้งค่า Firebase ดูวิธีตั้งค่าในไฟล์ README.md');
  let art, item, uid = '';
  try { [art, item] = await Promise.all([loadArt(id), loadItem(id).catch(() => null)]); uid = (await session()).uid; }
  catch (err) { console.warn(err); return fail('เชื่อมต่อไม่ได้ ลองเช็กอินเทอร์เน็ตแล้วลองใหม่'); }
  if (!art) return fail('ไม่พบรูปนี้ อาจถูกลบไปแล้ว');
  const pic = unpackDrawing(art.d);
  if (!pic) return fail('เปิดรูปนี้ไม่ได้');

  const setTitle = () => { document.title = art.title + ' | ' + t('วาดเล่น'); };
  setTitle(); window.addEventListener('langchange', setTitle);
  $('#vTitle').textContent = art.title;
  renderArtists($('#vBy'), art.artists);
  if (art.from){ const f = $<HTMLAnchorElement>('#vFrom'); f.href = 'art.html?id=' + encodeURIComponent(art.from); f.hidden = false; }
  $<HTMLAnchorElement>('#vRemix').href = 'draw.html?remix=' + encodeURIComponent(id);

  G.layers = pic.layers; G.strokes = pic.strokes; G.activeLayer = pic.layers[pic.layers.length - 1].id;
  G.frame = {w:art.w, h:art.h};
  if (PAPERS[art.paper]) state.paper = art.paper;
  state.fps = art.fps; state.playing = true;
  resize(); G.paperDirty = true; G.dirty = true;
  new ResizeObserver(resize).observe($('#stage'));
  requestAnimationFrame(loop);

  const isPublic = art.public && !!item;
  const hiddenByReports = !!item && item.reports >= HIDE_AT && art.owner !== uid;
  if (hiddenByReports) toast('รูปนี้ถูกรายงานหลายครั้ง จึงไม่แสดงในแกลเลอรี่');
  $('#vLike').hidden = !isPublic;
  if (item) setHeart(likedSet().has(id), item.likes);
  $('#vReport').hidden = !isPublic || art.owner === uid;
  if (reportedSet().has(id)) ($<HTMLButtonElement>('#vReport')).disabled = true;
  $('#vDelete').hidden = art.owner !== uid;
  if ($('#vReport').hidden && $('#vDelete').hidden) $('.vmore').hidden = true;
  setPlay();
  $('#vBar').hidden = false;
}

/* ---------- ปุ่มต่างๆ ---------- */
$('#vPlay').addEventListener('click', () => { state.playing = !state.playing; setPlay(); });
$('#vLike').addEventListener('click', async () => {
  const h = $<HTMLButtonElement>('#vLike'); h.disabled = true;
  try { const r = await toggleLike(id); setHeart(r.liked, r.likes); }
  catch (err) { console.warn(err); toast('กดหัวใจไม่สำเร็จ ลองใหม่อีกครั้ง'); }
  finally { h.disabled = false; }
});
$('#vCopy').addEventListener('click', async () => {
  try { await navigator.clipboard.writeText(artLink(id)); toast('คัดลอกลิงก์แล้ว'); }
  catch (_) { prompt(t('คัดลอกลิงก์นี้'), artLink(id)); }
});
const menu = $('#vMenu'), moreBtn = $('#vMoreBtn');
const closeMenu = () => { menu.hidden = true; moreBtn.setAttribute('aria-expanded', 'false'); resetDelete(); };
moreBtn.addEventListener('click', e => { e.stopPropagation(); if (menu.hidden){ menu.hidden = false; moreBtn.setAttribute('aria-expanded', 'true'); } else closeMenu(); });
document.addEventListener('click', e => { if (!menu.hidden && !(e.target as Element).closest('.vmore')) closeMenu(); });
document.addEventListener('keydown', e => { if (e.key === 'Escape') closeMenu(); });

$('#vReport').addEventListener('click', async () => {
  const b = $<HTMLButtonElement>('#vReport');
  if (!confirm(t('รายงานว่ารูปนี้ไม่เหมาะสมใช่ไหม ถ้ามีคนรายงานหลายคน รูปจะถูกซ่อนจากแกลเลอรี่'))) return;
  b.disabled = true;
  try { const ok = await reportArt(id); toast(ok ? 'ส่งรายงานแล้ว ขอบคุณที่ช่วยดูแล' : 'คุณรายงานรูปนี้ไปแล้ว'); closeMenu(); }
  catch (err) { console.warn(err); toast('ส่งรายงานไม่สำเร็จ ลองใหม่อีกครั้ง'); b.disabled = false; }
});
// กดลบ 2 ครั้งเพื่อยืนยัน
let armed = false;
function resetDelete(){ armed = false; $('#vDelete').textContent = 'ลบรูปนี้'; }
$('#vDelete').addEventListener('click', async () => {
  const b = $<HTMLButtonElement>('#vDelete');
  if (!armed){ armed = true; b.textContent = 'กดอีกครั้งเพื่อลบถาวร'; return; }
  b.disabled = true;
  try { await deleteArt(id); location.href = 'gallery.html'; }
  catch (err) { console.warn(err); toast('ลบไม่สำเร็จ ลองใหม่อีกครั้ง'); b.disabled = false; resetDelete(); }
});

start();
