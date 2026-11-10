import { type FbSession, connectFirebase } from './firebase.js';

/* ---------- แกลเลอรี่: ข้อมูลรูปที่แชร์ และการกดหัวใจ รายงาน ลบ ----------
   art/{id}      ข้อมูลรูปเต็ม (เส้นทุกเส้น) เปิดอ่านได้ทีละรูปจากลิงก์ แต่ดูรายการทั้งหมดไม่ได้
   gallery/{id}  การ์ดของรูปที่เลือก "แสดงในแกลเลอรี่" (ชื่อ คนวาด รูปย่อ จำนวนหัวใจ)
   likes/{id}/{uid}, reports/{id}/{uid}  ใครกดหัวใจหรือรายงานไปแล้ว */

export interface Artist { n: string; c?: string; }
export interface ArtDoc {
  owner: string; createdAt: number; title: string; artists: Artist[]; public: boolean;
  w: number; h: number; paper: string; fps: number; d: string; from?: string;
}
export interface GalleryItem {
  id: string; owner: string; createdAt: number; title: string; artists: string; thumb: string; likes: number; reports: number;
}
export const ID_RE = /^[A-Za-z0-9_-]{6,30}$/;
export const MAX_DATA = 900000;      // ขนาดข้อมูลเส้นสูงสุดต่อรูป (ตัวอักษร)
export const MAX_THUMB = 150000;     // ขนาดรูปย่อสูงสุด
export const HIDE_AT = 3;            // ถูกรายงานกี่ครั้งถึงซ่อนจากแกลเลอรี่

const str = (v: unknown, max: number) => typeof v === 'string' ? v.replace(/\s+/g, ' ').trim().slice(0, max) : '';
const num = (v: unknown, lo: number, hi: number, def: number) => typeof v === 'number' && isFinite(v) ? Math.min(hi, Math.max(lo, v)) : def;

export function cleanArtists(v: unknown): Artist[]{
  const arr = Array.isArray(v) ? v : (v && typeof v === 'object') ? Object.values(v) : [];
  const out: Artist[] = [];
  for (const a of arr.slice(0, 2)){
    const n = str(a && (a as Artist).n, 30); if (!n) continue;
    const c = str(a && (a as Artist).c, 80);
    out.push(c ? {n, c} : {n});
  }
  return out;
}
export const artistNames = (a: Artist[]) => a.map(x => x.n).join(' & ');

/** ตรวจข้อมูลรูปที่โหลดมา (มาจากคนอื่น ตรวจทุกค่า) */
export function cleanArt(v: any): ArtDoc | null{
  if (!v || typeof v !== 'object' || typeof v.d !== 'string' || v.d.length > MAX_DATA) return null;
  return {
    owner:str(v.owner, 128), createdAt:num(v.createdAt, 0, 1e15, 0), title:str(v.title, 60) || 'ไม่มีชื่อ',
    artists:cleanArtists(v.artists), public:v.public === true,
    w:num(v.w, 50, 6000, 1000), h:num(v.h, 50, 6000, 1000), paper:/^[a-z]{1,20}$/.test(v.paper) ? v.paper : 'plain',
    fps:num(v.fps, 2, 24, 10), d:v.d, from:typeof v.from === 'string' && ID_RE.test(v.from) ? v.from : undefined,
  };
}
export function cleanItem(id: string, v: any): GalleryItem | null{
  if (!ID_RE.test(id) || !v || typeof v !== 'object') return null;
  const thumb = typeof v.thumb === 'string' && /^data:image\/(webp|jpeg|png);base64,[A-Za-z0-9+/=]+$/.test(v.thumb) && v.thumb.length <= MAX_THUMB ? v.thumb : '';
  return {
    id, owner:str(v.owner, 128), createdAt:num(v.createdAt, 0, 1e15, 0), title:str(v.title, 60) || 'ไม่มีชื่อ',
    artists:str(v.artists, 70), thumb, likes:Math.round(num(v.likes, 0, 1e9, 0)), reports:Math.round(num(v.reports, 0, 1e9, 0)),
  };
}

/** ช่องทางติดต่อ: ทำเป็นลิงก์ได้เฉพาะ https:// เท่านั้น นอกนั้นแสดงเป็นข้อความ */
export function contactHref(c: string): string | null{
  try { const u = new URL(c); return u.protocol === 'https:' ? u.href : null; } catch (_) { return null; }
}
/** สร้างชื่อคนวาดพร้อมช่องทางติดต่อ (ไม่ใช้ innerHTML กับข้อความของผู้ใช้) */
export function renderArtists(el: HTMLElement, artists: Artist[]){
  el.textContent = '';
  artists.forEach((a, i) => {
    if (i) el.append(' & ');
    const b = document.createElement('b'); b.textContent = a.n; b.translate = false; el.append(b);
    if (a.c){
      const href = contactHref(a.c);
      const c = document.createElement(href ? 'a' : 'span'); c.className = 'contact'; c.textContent = a.c; c.translate = false;
      if (href){ (c as HTMLAnchorElement).href = href; (c as HTMLAnchorElement).target = '_blank'; (c as HTMLAnchorElement).rel = 'noopener noreferrer nofollow ugc'; }
      el.append(' (', c, ')');
    }
  });
}

/* ---------- จำไว้ในเบราว์เซอร์ ---------- */
const MINE = 'yukyik-myart', LIKED = 'yukyik-liked', REPORTED = 'yukyik-reported';
export interface MyArt { id: string; title: string; thumb: string; public: boolean; createdAt: number; }
const readJSON = <T>(k: string, def: T): T => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return v ?? def; } catch (_) { return def; } };
const writeJSON = (k: string, v: unknown) => { try { localStorage.setItem(k, JSON.stringify(v)); } catch (_) {} };
export function myArt(): MyArt[]{
  const v = readJSON<unknown[]>(MINE, []);
  return Array.isArray(v) ? v.filter((x: any) => x && ID_RE.test(x.id)).map((x: any) => ({id:x.id, title:str(x.title, 60), thumb:typeof x.thumb === 'string' && x.thumb.startsWith('data:image/') ? x.thumb : '', public:x.public === true, createdAt:num(x.createdAt, 0, 1e15, 0)})) : [];
}
export function rememberArt(a: MyArt){ writeJSON(MINE, [a, ...myArt().filter(x => x.id !== a.id)].slice(0, 40)); }
export function forgetArt(id: string){ writeJSON(MINE, myArt().filter(x => x.id !== id)); }
const idSet = (k: string) => new Set(readJSON<string[]>(k, []).filter(x => typeof x === 'string'));
export const likedSet = () => idSet(LIKED);
export const reportedSet = () => idSet(REPORTED);
function setFlag(k: string, id: string, on: boolean){ const s = idSet(k); if (on) s.add(id); else s.delete(id); writeJSON(k, [...s].slice(-500)); }

/* ---------- ทำงานกับฐานข้อมูล ---------- */
export const session = () => connectFirebase();
const R = (s: FbSession, p: string) => s.fb.ref(s.db, p);

export async function loadArt(id: string): Promise<ArtDoc | null>{
  if (!ID_RE.test(id)) return null;
  const s = await session();
  return cleanArt((await s.fb.get(R(s, `art/${id}`))).val());
}
export async function loadGallery(limit: number): Promise<GalleryItem[]>{
  const s = await session(), fb = s.fb;
  const v = (await fb.get(fb.query(R(s, 'gallery'), fb.orderByChild('createdAt'), fb.limitToLast(limit)))).val() || {};
  return Object.entries<any>(v).map(([id, x]) => cleanItem(id, x)).filter((x): x is GalleryItem => !!x);
}
export async function loadItem(id: string): Promise<GalleryItem | null>{
  const s = await session();
  return cleanItem(id, (await s.fb.get(R(s, `gallery/${id}`))).val());
}

/** กดหัวใจหรือเอาออก คืนค่าสถานะใหม่และจำนวนหัวใจ (ลองใหม่ 1 ครั้งถ้ามีคนกดพร้อมกัน) */
export async function toggleLike(id: string): Promise<{ liked: boolean; likes: number }>{
  const s = await session();
  for (let tryNo = 0; ; tryNo++){
    const [mine, cnt] = await Promise.all([s.fb.get(R(s, `likes/${id}/${s.uid}`)), s.fb.get(R(s, `gallery/${id}/likes`))]);
    const liked = mine.exists(), n = Math.max(0, +cnt.val() || 0), next = liked ? n - 1 : n + 1;
    try {
      await s.fb.update(R(s, '/'), {[`likes/${id}/${s.uid}`]: liked ? null : true, [`gallery/${id}/likes`]: next});
      setFlag(LIKED, id, !liked);
      return {liked: !liked, likes: next};
    } catch (err) { if (tryNo >= 1) throw err; }
  }
}
export async function reportArt(id: string): Promise<boolean>{
  const s = await session();
  for (let tryNo = 0; ; tryNo++){
    const [mine, cnt] = await Promise.all([s.fb.get(R(s, `reports/${id}/${s.uid}`)), s.fb.get(R(s, `gallery/${id}/reports`))]);
    if (mine.exists()){ setFlag(REPORTED, id, true); return false; }
    try {
      await s.fb.update(R(s, '/'), {[`reports/${id}/${s.uid}`]: true, [`gallery/${id}/reports`]: (+cnt.val() || 0) + 1});
      setFlag(REPORTED, id, true);
      return true;
    } catch (err) { if (tryNo >= 1) throw err; }
  }
}
export async function deleteArt(id: string){
  const s = await session();
  await s.fb.update(R(s, '/'), {[`art/${id}`]: null, [`gallery/${id}`]: null, [`likes/${id}`]: null, [`reports/${id}`]: null});
  forgetArt(id);
}
/** แชร์รูปใหม่ คืนรหัสรูป */
export async function publishArt(art: Omit<ArtDoc, 'owner' | 'createdAt'>, thumb: string): Promise<string>{
  const s = await session(), fb = s.fb;
  const id = fb.push(R(s, 'art')).key!;
  const TS = fb.serverTimestamp();
  const doc: Record<string, unknown> = {...art, owner:s.uid, createdAt:TS, artists:Object.assign({}, art.artists)};
  if (!art.from) delete doc.from;
  const upd: Record<string, unknown> = {[`art/${id}`]: doc};
  if (art.public) upd[`gallery/${id}`] = {owner:s.uid, createdAt:TS, title:art.title, artists:artistNames(art.artists).slice(0, 70), thumb, likes:0, reports:0};
  await fb.update(R(s, '/'), upd);
  rememberArt({id, title:art.title, thumb, public:art.public, createdAt:Date.now()});
  return id;
}
export const artLink = (id: string) => new URL('art.html?id=' + encodeURIComponent(id), location.href).href;
