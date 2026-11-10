import { $, G, room, state } from './core.js';
import { captureCanvas } from './saveImage.js';
import { packDrawing, scaleStroke, unpackDrawing } from './artdata.js';
import { MAX_LAYERS, layersChanged } from './layers.js';
import { pushHistory } from './history.js';
import { setPaper } from './paper.js';
import { toast } from './ui.js';
import { save } from './persist.js';
import { fbConfig } from '../shared/firebase.js';
import { type Artist, ID_RE, MAX_DATA, MAX_THUMB, artLink, loadArt, publishArt } from '../shared/gallery.js';

/* ---------- แชร์รูปไปแกลเลอรี่ และเอารูปจากแกลเลอรี่มาวาดต่อ ---------- */
const ME = 'yukyik-artist', FROM = 'yukyik-remixfrom';
let pub = true, busy = false, thumb = '';

/** รูปย่อสำหรับการ์ดในแกลเลอรี่ (ด้านยาวสุด 300 พิกเซล) */
function makeThumb(c: HTMLCanvasElement){
  const k = Math.min(1, 300 / Math.max(c.width, c.height));
  const t = document.createElement('canvas'); t.width = Math.max(1, Math.round(c.width * k)); t.height = Math.max(1, Math.round(c.height * k));
  const g = t.getContext('2d')!; g.imageSmoothingQuality = 'high'; g.drawImage(c, 0, 0, t.width, t.height);
  for (const q of [.8, .6, .45]){
    let u = t.toDataURL('image/webp', q);
    if (!u.startsWith('data:image/webp')) u = t.toDataURL('image/jpeg', q);   // Safari บางรุ่นทำ webp ไม่ได้
    if (u.length <= MAX_THUMB) return u;
  }
  return '';
}
function setVis(p: boolean){
  pub = p;
  document.querySelectorAll<HTMLElement>('#shareVis button').forEach(b => b.classList.toggle('on', (b.dataset.v === 'public') === p));
  $('#shareVisNote').textContent = p ? 'ทุกคนเห็นในหน้าแกลเลอรี่ กดหัวใจได้' : 'ไม่ขึ้นในแกลเลอรี่ เห็นได้เฉพาะคนที่มีลิงก์';
}
function readMe(): Artist[]{ try { const v = JSON.parse(localStorage.getItem(ME) || '[]'); return Array.isArray(v) ? v : []; } catch (_) { return []; } }
const val = (id: string) => $<HTMLInputElement>(id).value.replace(/\s+/g, ' ').trim();
function showMsg(t: string | null){ const m = $('#shareMsg'); m.textContent = t || ''; m.hidden = !t; }

function openShare(){
  if (!fbConfig()){ toast('ยังไม่ได้ตั้งค่า Firebase ดูวิธีตั้งค่าในไฟล์ README.md'); return; }
  const {count} = packDrawing();
  if (!count){ toast('ยังไม่มีอะไรบนกระดาษ วาดก่อนแล้วค่อยแชร์นะ'); return; }
  thumb = makeThumb(captureCanvas());
  $<HTMLImageElement>('#shareImg').src = thumb;
  const me = readMe();
  $<HTMLInputElement>('#artist1').value = me[0]?.n || ''; $<HTMLInputElement>('#contact1').value = me[0]?.c || '';
  $<HTMLInputElement>('#artist2').value = me[1]?.n || ''; $<HTMLInputElement>('#contact2').value = me[1]?.c || '';
  $('#artistRow2').hidden = !(room.active || me[1]?.n); $('#addArtist').hidden = !$('#artistRow2').hidden;
  $('#shareForm').hidden = false; $('#shareDone').hidden = true; showMsg(null);
  $('#modal').classList.remove('show'); $('#shareModal').classList.add('show');
  setTimeout(() => $('#artTitle').focus(), 50);
}
function closeShare(){ $('#shareModal').classList.remove('show'); }

async function doShare(){
  if (busy) return;
  const title = val('#artTitle').slice(0, 60);
  const artists: Artist[] = [];
  for (const i of ['1', '2']){
    const n = val('#artist' + i).slice(0, 30), c = val('#contact' + i).slice(0, 80);
    if (n && (i === '1' || !$('#artistRow2').hidden)) artists.push(c ? {n, c} : {n});
  }
  if (!title){ showMsg('ตั้งชื่อรูปก่อนนะ'); $('#artTitle').focus(); return; }
  if (!artists.length){ showMsg('ใส่ชื่อคนวาดอย่างน้อย 1 คน'); $('#artist1').focus(); return; }
  const {d, w, h} = packDrawing();
  if (d.length > MAX_DATA){ showMsg('รูปนี้มีเส้นเยอะเกินไป แชร์ไม่ได้ ลองรวมหรือลบบางเส้นก่อน'); return; }
  if (pub && !thumb){ showMsg('ทำรูปย่อไม่สำเร็จ ลองใหม่อีกครั้ง'); return; }
  try { localStorage.setItem(ME, JSON.stringify(artists)); } catch (_) {}
  busy = true; showMsg(null);
  const btn = $<HTMLButtonElement>('#shareBtn'); btn.disabled = true; btn.textContent = 'กำลังแชร์';
  try {
    let from: string | undefined;
    try { const f = localStorage.getItem(FROM) || ''; if (ID_RE.test(f)) from = f; } catch (_) {}
    const id = await publishArt({title, artists, public:pub, w, h, paper:state.paper, fps:state.fps, d, from}, thumb);
    try { localStorage.removeItem(FROM); } catch (_) {}
    const link = artLink(id);
    $<HTMLInputElement>('#artLink').value = link; $<HTMLAnchorElement>('#openArt').href = link;
    $('#shareForm').hidden = true; $('#shareDone').hidden = false;
  } catch (err) {
    console.warn(err);
    const c = String((err as {code?: string; message?: string})?.code || (err as Error)?.message || '');
    showMsg(/permission|PERMISSION_DENIED/i.test(c) ? 'ฐานข้อมูลไม่อนุญาต ลองเช็กว่าใส่ Security Rules ชุดล่าสุดแล้วหรือยัง' : 'แชร์ไม่สำเร็จ ลองเช็กอินเทอร์เน็ตแล้วลองใหม่');
  } finally { busy = false; btn.disabled = false; btn.textContent = 'แชร์รูป'; }
}

/** เปิด draw.html?remix=รหัสรูป: เอารูปนั้นมาเป็นเลเยอร์ใหม่บนกระดาษของเรา */
async function importRemix(){
  let id = '';
  try { id = new URLSearchParams(location.search).get('remix') || ''; } catch (_) {}
  if (!id) return;
  history.replaceState(null, '', location.pathname);   // รีโหลดแล้วไม่ต้องดึงซ้ำ
  if (!ID_RE.test(id) || room.active) return;
  toast('กำลังโหลดรูปมาวาดต่อ');
  try {
    const art = await loadArt(id);
    const pic = art && unpackDrawing(art.d);
    if (!art || !pic){ toast('ไม่พบรูปนี้ อาจถูกลบไปแล้ว'); return; }
    const room_ = MAX_LAYERS - G.layers.length;
    if (room_ < 1){ toast('มีได้สูงสุด 10 เลเยอร์ ลบเลเยอร์เก่าก่อนนะ'); return; }
    pushHistory();
    // ย่อให้พอดีจอ แล้ววางไว้กลางจอ
    const k = Math.min(1, G.W / art.w, G.H / art.h), dx = (G.W - art.w * k) / 2, dy = (G.H - art.h * k) / 2;
    const base = G.layers.reduce((m, l) => Math.max(m, l.id), 0);
    const flat = pic.layers.length > room_;   // เลเยอร์ไม่พอ รวมเป็นเลเยอร์เดียว
    const newLayers = flat ? [{id:base + 1, name:art.title.slice(0, 20), visible:true, opacity:1}]
      : pic.layers.map((l, i) => ({...l, id:base + 1 + i, name:(pic.layers.length > 1 ? art.title.slice(0, 14) + ' ' + (i + 1) : art.title.slice(0, 20))}));
    for (const s of pic.strokes){ scaleStroke(s, k, dx, dy); s.layer = flat ? base + 1 : base + s.layer!; }
    G.layers = [...G.layers, ...newLayers];
    G.strokes = [...G.strokes, ...pic.strokes];
    G.activeLayer = newLayers[newLayers.length - 1].id;
    setPaper(art.paper);
    try { localStorage.setItem(FROM, id); } catch (_) {}
    layersChanged(); save();
    toast('เอารูปมาเป็นเลเยอร์ใหม่แล้ว วาดต่อได้เลย');
  } catch (err) { console.warn(err); toast('โหลดรูปไม่สำเร็จ ลองเช็กอินเทอร์เน็ตแล้วลองใหม่'); }
}

export function initShare(){
  $('#shareOpen').addEventListener('click', openShare);
  $('#shareClose').addEventListener('click', closeShare);
  $('#shareModal').addEventListener('click', e => { if ((e.target as Element).id === 'shareModal') closeShare(); });
  document.querySelectorAll<HTMLElement>('#shareVis button').forEach(b => b.addEventListener('click', () => setVis(b.dataset.v === 'public')));
  $('#addArtist').addEventListener('click', () => { $('#artistRow2').hidden = false; $('#addArtist').hidden = true; $('#artist2').focus(); });
  $('#shareBtn').addEventListener('click', doShare);
  $('#copyArtLink').addEventListener('click', async () => {
    const i = $<HTMLInputElement>('#artLink');
    try { await navigator.clipboard.writeText(i.value); toast('คัดลอกลิงก์แล้ว ส่งให้เพื่อนได้เลย'); }
    catch (_) { i.focus(); i.select(); toast('กดค้างที่ลิงก์แล้วเลือกคัดลอกได้เลย'); }
  });
  setVis(true);
  importRemix();
}
