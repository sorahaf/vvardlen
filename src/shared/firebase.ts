/* ---------- ส่วนที่หน้ารวมห้องและกระดานวาดใช้ร่วมกัน: Firebase และรหัสห้อง ---------- */

const FB_VER = '12.4.0';
const CODE_CHARS = '23456789ABCDEFGHJKMNPQRSTUVWXYZ';   // ไม่มี 0 O 1 I L ที่สับสนง่าย
export const CODE_RE = /^[23456789ABCDEFGHJKMNPQRSTUVWXYZ]{6}$/;  // รหัสห้องและรหัสผ่าน 6 ตัว
export const ROOM_TTL = 3 * 24 * 60 * 60 * 1000;                  // ห้องอยู่ได้ 3 วัน

interface FirebaseConfig { apiKey: string; authDomain?: string; databaseURL: string; projectId?: string; appId?: string; }
declare global { interface Window { FIREBASE_CONFIG?: FirebaseConfig; } }

/* ชนิดข้อมูลแบบย่อของ Firebase SDK ที่โหลดจาก gstatic (ใส่เฉพาะส่วนที่เว็บนี้ใช้) */
interface DbRef { key: string | null; }
interface DbQuery {}
export interface Snapshot { key: string | null; val(): any; exists(): boolean; }
type Unsub = () => void;
export interface FbDatabase {
  getDatabase(app: unknown): unknown;
  ref(db: unknown, path?: string): DbRef;
  get(r: DbRef | DbQuery): Promise<Snapshot>;
  set(r: DbRef, v: unknown): Promise<void>;
  update(r: DbRef, v: Record<string, unknown>): Promise<void>;
  remove(r: DbRef): Promise<void>;
  push(r: DbRef): DbRef;
  onValue(r: DbRef | DbQuery, cb: (s: Snapshot) => void, err?: (e: unknown) => void): Unsub;
  onChildAdded(r: DbRef, cb: (s: Snapshot) => void, err?: (e: unknown) => void): Unsub;
  onChildChanged(r: DbRef, cb: (s: Snapshot) => void, err?: (e: unknown) => void): Unsub;
  onChildRemoved(r: DbRef, cb: (s: Snapshot) => void, err?: (e: unknown) => void): Unsub;
  onDisconnect(r: DbRef): { remove(): Promise<void>; cancel(): Promise<void>; };
  runTransaction(r: DbRef, fn: (v: unknown) => unknown): Promise<{ committed: boolean; snapshot: Snapshot }>;
  serverTimestamp(): object;
  query(r: DbRef, ...c: unknown[]): DbQuery;
  orderByChild(path: string): unknown;
  limitToLast(n: number): unknown;
}
export interface FbSession { fb: FbDatabase; db: unknown; uid: string; }

export function fbConfig(): FirebaseConfig | null {
  const c = window.FIREBASE_CONFIG;
  if (!c || typeof c !== 'object' || !c.apiKey || !c.databaseURL || String(c.apiKey).includes('ใส่')) return null;
  return c;
}

let session: Promise<FbSession> | null = null;
/** โหลด Firebase และล็อกอินแบบไม่ระบุตัวตน (ทำครั้งเดียว) */
export function connectFirebase(): Promise<FbSession> {
  if (session) return session;
  const cfg = fbConfig();
  if (!cfg) return Promise.reject({code:'no-config'});
  session = (async () => {
    const base = `https://www.gstatic.com/firebasejs/${FB_VER}/`;
    const [appM, authM, dbM] = await Promise.all([
      import(/* @vite-ignore */ base + 'firebase-app.js'), import(/* @vite-ignore */ base + 'firebase-auth.js'), import(/* @vite-ignore */ base + 'firebase-database.js')
    ]);
    const app = appM.initializeApp(cfg);
    const cred = await authM.signInAnonymously(authM.getAuth(app));
    const fb = dbM as FbDatabase;
    return {fb, db: fb.getDatabase(app), uid: cred.user.uid as string};
  })();
  session.catch(() => { session = null; });   // พลาดแล้วลองใหม่ได้
  return session;
}

export function genCode(){ const a = new Uint32Array(6); crypto.getRandomValues(a); return Array.from(a, n => CODE_CHARS[n % CODE_CHARS.length]).join(''); }

/** แปลงข้อผิดพลาดจาก Firebase เป็นชื่อสั้น ๆ สำหรับเลือกข้อความที่จะแสดง */
export function errKey(err: unknown, known: Record<string, string>): string {
  const e = err as { code?: string; message?: string } | null;
  const c = String((e && (e.code || e.message)) || '');
  if (known[c]) return c;
  if (/operation-not-allowed|admin-restricted|configuration-not-found/.test(c)) return 'auth';
  if (/unauthorized-domain|requests-from-referer/.test(c)) return 'domain';
  if (/permission|PERMISSION_DENIED/i.test(c)) return 'denied';
  return 'net';
}

/* รหัสผ่านห้องส่วนตัวที่เคยเข้าสำเร็จ เก็บไว้ในเบราว์เซอร์นี้ */
const MYKEYS = 'yukyik-mykeys';
export function savedKeys(): Record<string, string> { try { return JSON.parse(localStorage.getItem(MYKEYS) || '{}') || {}; } catch (_) { return {}; } }
export function readSavedKey(code: string){ const k = savedKeys()[code]; return CODE_RE.test(k) ? k : null; }
export function saveKey(code: string, key: string){ try { const k = savedKeys(); k[code] = key; localStorage.setItem(MYKEYS, JSON.stringify(k)); } catch (_) {} }
export function forgetKey(code: string){ try { const k = savedKeys(); if (code in k){ delete k[code]; localStorage.setItem(MYKEYS, JSON.stringify(k)); } } catch (_) {} }
