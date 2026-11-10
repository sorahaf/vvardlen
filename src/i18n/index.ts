/* วาดเล่น: สลับภาษาไทย / อังกฤษ
   หน้าเว็บเขียนเป็นภาษาไทยตามปกติ ไฟล์นี้จะแปลข้อความบนหน้าให้เองเมื่อเลือก EN
   - คำแปลอยู่ในไฟล์ en.ts
   - ข้อความที่ไม่อยากให้แปล (เช่น ชื่อห้องที่คนตั้งเอง) ใส่ translate="no" ไว้ที่แท็ก */
import { EN } from './en.js';

export type Lang = 'th' | 'en';
const TH_RE = /[฀-๿]/;
const KEY = 'yukyik-lang';
let lang: Lang;
{
  let saved: string | null = null;
  try { saved = localStorage.getItem(KEY); } catch (_) {}
  lang = saved === 'th' || saved === 'en' ? saved : /^th\b/i.test(navigator.language || '') ? 'th' : 'en';
}

// แปลงคำที่มี {x} เป็นรูปแบบสำหรับจับข้อความ
interface Pattern { re: RegExp; names: string[]; en: string; }
const PATS: Pattern[] = [];
for (const k in EN){
  if (!k.includes('{')) continue;
  const names: string[] = [];
  const src = k.replace(/[.*+?^$()|[\]\\]/g, '\\$&').replace(/\{(\w+)\}/g, (_, n: string) => { names.push(n); return '(.+?)'; });
  PATS.push({re: new RegExp('^' + src + '$'), names, en: EN[k]});
}
const fill = (s: string, v: Record<string, string>) => s.replace(/\{(\w+)\}/g, (m, n: string) => n in v ? v[n] : m);
/** ข้อความที่ยังไม่มีคำแปล (ไว้เช็กตอนพัฒนา) */
export const missing = new Set<string>();
function lookup(k: string): string | null {
  if (k in EN) return EN[k];
  for (const p of PATS){
    const m = k.match(p.re);
    if (m){ const v: Record<string, string> = {}; p.names.forEach((n, i) => v[n] = m[i + 1]); return fill(p.en, v); }
  }
  missing.add(k);
  return null;
}
function trText(s: string): string | null {
  const k = s.trim();
  if (!k || !TH_RE.test(k)) return null;
  const e = lookup(k);
  if (e == null) return null;
  const at = s.indexOf(k);
  return s.slice(0, at) + e + s.slice(at + k.length);
}

// ---------- แปลข้อความบนหน้า ----------
// จำข้อความไทยเดิมไว้ สลับกลับเป็นไทยได้ทันที
const ATTRS = ['title', 'aria-label', 'placeholder', 'alt', 'content'];
const textMemo = new WeakMap<Text, {th: string; en: string}>();
const attrMemo = new WeakMap<Element, Record<string, [string, string]>>();
const touched = new Set<Text | Element>();
const skip = (el: Element | null) => !el || !!el.closest('script,style,[translate="no"]');
function doText(n: Text){
  const cur = n.nodeValue || '', m = textMemo.get(n);
  const orig = m && cur === m.en ? m.th : cur;
  if (!TH_RE.test(orig)) return;
  const e = trText(orig);
  if (e == null) return;
  textMemo.set(n, {th: orig, en: e}); touched.add(n);
  if (cur !== e) n.nodeValue = e;
}
function doAttr(el: Element, a: string){
  const cur = el.getAttribute(a);
  if (cur == null) return;
  let m = attrMemo.get(el);
  if (!m){ m = {}; attrMemo.set(el, m); }
  const orig = (m[a] && cur === m[a][1]) ? m[a][0] : cur;
  if (!TH_RE.test(orig)) return;
  const e = trText(orig);
  if (e == null) return;
  m[a] = [orig, e]; touched.add(el);
  if (cur !== e) el.setAttribute(a, e);
}
function walk(root: Node){
  if (root.nodeType === Node.TEXT_NODE){ if (!skip(root.parentElement)) doText(root as Text); return; }
  if (root.nodeType !== Node.ELEMENT_NODE || skip(root as Element)) return;
  const tw = document.createTreeWalker(root, NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_TEXT, {
    acceptNode: n => n.nodeType === Node.ELEMENT_NODE && skip(n as Element) ? NodeFilter.FILTER_REJECT : NodeFilter.FILTER_ACCEPT });
  for (let n: Node | null = root; n; n = tw.nextNode()){
    if (n.nodeType === Node.TEXT_NODE) doText(n as Text);
    else for (const a of ATTRS) if ((n as Element).hasAttribute(a)) doAttr(n as Element, a);
  }
}
function restore(){
  for (const n of touched){
    if (n instanceof Text){ const m = textMemo.get(n); if (m && n.nodeValue === m.en) n.nodeValue = m.th; }
    else { const m = attrMemo.get(n) || {}; for (const a in m){ const [th, en] = m[a]; if (n.getAttribute(a) === en) n.setAttribute(a, th); } }
  }
  touched.clear();
}
const mo = new MutationObserver(list => {
  for (const r of list){
    if (r.type === 'characterData') walk(r.target);
    else if (r.type === 'attributes'){ const t = r.target as Element; if (!skip(t) && r.attributeName) doAttr(t, r.attributeName); }
    else r.addedNodes.forEach(walk);
  }
});
let titleTh: string | null = null;
function apply(){
  document.documentElement.lang = lang;
  document.querySelectorAll<HTMLElement>('.lang-switch button').forEach(b => {
    b.classList.toggle('on', b.dataset.lang === lang); b.setAttribute('aria-pressed', String(b.dataset.lang === lang));
  });
  if (titleTh == null) titleTh = document.title;
  if (lang === 'en'){
    walk(document.head); walk(document.body);
    document.title = lookup(titleTh) || titleTh;
    mo.observe(document.body, {subtree:true, childList:true, characterData:true, attributes:true, attributeFilter:ATTRS});
  } else {
    mo.disconnect(); restore(); document.title = titleTh;
  }
}

// ---------- ปุ่ม TH / EN ----------
function mount(){
  document.querySelectorAll('.lang-slot').forEach(slot => {
    if (slot.firstChild) return;
    slot.innerHTML = '<div class="lang-switch" role="group" aria-label="Language" translate="no">' +
      '<button type="button" data-lang="th">TH</button>' +
      '<button type="button" data-lang="en"><svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="8" cy="8" r="6.2"/><path d="M1.8 8h12.4M8 1.8c2 2.2 2 10.2 0 12.4M8 1.8c-2 2.2-2 10.2 0 12.4"/></svg>EN</button></div>';
    slot.querySelectorAll<HTMLElement>('button').forEach(b => b.addEventListener('click', () => setLang(b.dataset.lang === 'en' ? 'en' : 'th')));
  });
}
export function setLang(l: Lang){
  if (l === lang) return;
  lang = l;
  try { localStorage.setItem(KEY, l); } catch (_) {}
  apply();
  window.dispatchEvent(new CustomEvent('langchange', {detail:l}));
}
export const getLang = () => lang;
/** t('ข้อความไทย') คืนคำตามภาษาที่เลือก */
export const t = (s: string) => lang === 'en' ? (lookup(s) ?? s) : s;

declare global { interface Window { i18n: { readonly lang: Lang; set: typeof setLang; t: typeof t; missing: Set<string> }; } }
window.i18n = { get lang(){ return lang; }, set: setLang, t, missing };

function start(){ mount(); apply(); }
if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start); else start();
