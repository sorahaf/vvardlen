import '../i18n/index.js';
import { fbConfig } from '../shared/firebase.js';
import { type GalleryItem, HIDE_AT, likedSet, loadGallery, myArt, toggleLike } from '../shared/gallery.js';

/* ---------- หน้าแกลเลอรี่ ---------- */
const $ = <T extends Element = HTMLElement>(s: string): T => document.querySelector(s) as T;
const PAGE = 30;
let items: GalleryItem[] = [], limit = PAGE, sort: 'new' | 'top' | 'mine' = 'new', loading = false;
const HEART = '<svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M8 13.5S2 10 2 5.8A3.2 3.2 0 0 1 8 4.2a3.2 3.2 0 0 1 6 1.6C14 10 8 13.5 8 13.5z"/></svg>';

let toastT: number | undefined;
function toast(m: string){ const t = $('#toast'); t.textContent = m; t.classList.add('show'); clearTimeout(toastT); toastT = setTimeout(() => t.classList.remove('show'), 2600); }
function showMsg(m: string | null){ const e = $('#msg'); e.textContent = m || ''; e.hidden = !m; }
const el = <K extends keyof HTMLElementTagNameMap>(tag: K, cls = '', text = '') => { const e = document.createElement(tag); if (cls) e.className = cls; if (text) e.textContent = text; return e; };

function card(it: { id: string; title: string; artists?: string; thumb: string; likes?: number; private?: boolean }, liked: Set<string>){
  const c = el('article', 'art');
  const a = el('a', 'pic'); a.href = 'art.html?id=' + encodeURIComponent(it.id);
  if (it.thumb){ const img = el('img'); img.src = it.thumb; img.alt = it.title; img.loading = 'lazy'; img.translate = false; a.append(img); }
  if (it.private) a.append(el('span', 'lock', 'เฉพาะคนมีลิงก์'));
  const info = el('div', 'info'), txt = el('div', 'txt');
  const t = el('div', 't', it.title); t.translate = false; txt.append(t);
  if (it.artists){ const by = el('div', 'by', it.artists); by.translate = false; txt.append(by); }
  info.append(txt);
  if (it.likes !== undefined){
    const h = el('button', 'heart' + (liked.has(it.id) ? ' on' : '')); h.innerHTML = HEART; h.append(String(it.likes));
    h.setAttribute('aria-label', 'กดหัวใจ');
    h.addEventListener('click', async () => {
      h.disabled = true;
      try {
        const r = await toggleLike(it.id);
        const x = items.find(i => i.id === it.id); if (x) x.likes = r.likes;
        h.classList.toggle('on', r.liked); h.innerHTML = HEART; h.append(String(r.likes));
      } catch (err) { console.warn(err); toast('กดหัวใจไม่สำเร็จ ลองใหม่อีกครั้ง'); }
      finally { h.disabled = false; }
    });
    info.append(h);
  }
  c.append(a, info);
  return c;
}

function render(){
  const g = $('#gal'); g.textContent = '';
  const liked = likedSet();
  let list: Parameters<typeof card>[0][];
  if (sort === 'mine'){
    list = myArt().map(m => ({id:m.id, title:m.title, thumb:m.thumb, private:!m.public}));
  } else {
    const ok = items.filter(i => i.reports < HIDE_AT);
    list = ok.sort((a, b) => sort === 'top' ? (b.likes - a.likes || b.createdAt - a.createdAt) : b.createdAt - a.createdAt);
  }
  for (const it of list) g.append(card(it, liked));
  $('#empty').hidden = list.length > 0;
  $('#emptyText').textContent = sort === 'mine' ? 'ยังไม่เคยแชร์รูปจากเครื่องนี้' : 'ยังไม่มีรูปในแกลเลอรี่ มาเป็นคนแรกกัน';
  $('#more').hidden = sort === 'mine' || items.length < limit;
}

async function load(){
  if (loading) return;
  if (!fbConfig()){ showMsg('ยังไม่ได้ตั้งค่า Firebase ดูวิธีตั้งค่าในไฟล์ README.md'); $('#gal').textContent = ''; return; }
  loading = true;
  try { items = await loadGallery(limit); showMsg(null); }
  catch (err) { console.warn(err); showMsg('เชื่อมต่อไม่ได้ ลองเช็กอินเทอร์เน็ตแล้วลองใหม่'); }
  finally { loading = false; render(); }
}

document.querySelectorAll<HTMLElement>('#sort button').forEach(b => b.addEventListener('click', () => {
  sort = (b.dataset.s || 'new') as typeof sort;
  document.querySelectorAll('#sort button').forEach(x => x.classList.toggle('on', x === b));
  render();
}));
$('#more').addEventListener('click', () => { limit += PAGE; load(); });
$('#refresh').addEventListener('click', load);
load();
