import type { Layer, RawPt, Snapshot, State, Stroke } from './types.js';
import type { FbDatabase } from '../shared/firebase.js';
import type { StrokeData } from './room.js';

/** หาองค์ประกอบในหน้า (ทุกตัวที่เรียกมีอยู่ในหน้าแน่นอน) */
export const $ = <T extends Element = HTMLElement>(sel: string): T => document.querySelector(sel) as T;
export const stage = $('#stage'), paperC = $<HTMLCanvasElement>('#paper'), inkC = $<HTMLCanvasElement>('#ink');
export const pctx = paperC.getContext('2d')!;
export const mainCtx = inkC.getContext('2d')!;

export const BOIL = 3;          // จำนวนเฟรมของการสั่นแบบ "line boil"
export const WAVE_FRAMES = 12;  // จำนวนเฟรมของคลื่นที่วิ่ง (วนลูป)

export const state: State = {
  brush:'pencil', color:'#2a2420', size:4, wiggle:2.2, pixel:6,
  amp:7, wavelen:18, shape:'zigzag', fps:10, playing:true, paper:'plain', flow:.55, op:1, oc:'ink', ow:3, tip:'taper'
};
// ในห้องวาดกับเพื่อน ทุกเครื่องเห็นกระดาษสี่เหลี่ยมจัตุรัสแผ่นเดียวกัน (BOARD x BOARD หน่วย) ย่อขยายให้พอดีจอ
export const BOARD = 1000;
// ซูมและเลื่อนกระดาษ: ZOOM คูณเพิ่มจากขนาดพอดีจอ, PX/PY คือระยะที่เลื่อนไป (หน่วยพิกเซลจอ)
export const ZMIN = .5, ZMAX = 5;
export const viewS = () => G.VS * G.ZOOM, viewX = () => G.OX + G.PX, viewY = () => G.OY + G.PY;

/* ---------- ห้องวาดกับเพื่อน ---------- */
export interface RoomMeta { name?: string; createdAt?: number; owner?: string; private?: boolean; }
/** สิ่งที่ทำในห้อง (ไว้ Undo เฉพาะของตัวเอง) */
type RoomStep = { type: 'add'; id: string; data: StrokeData } | { type: 'clear'; items: [string, StrokeData][] };
/** รูปที่วาดคนเดียว เก็บไว้ระหว่างอยู่ในห้อง */
interface SoloSave { strokes: Stroke[]; undoStack: Snapshot[]; redoStack: Snapshot[]; }
export const room = {
  active: false, code: null as string | null, slot: null as 'a' | 'b' | null, uid: null as string | null,
  fb: null as FbDatabase | null, db: null as unknown,   // Firebase (โหลดตอนเข้าห้องครั้งแรก)
  unsubs: [] as (() => void)[], live: new Map<string, Stroke>(),
  myUndo: [] as RoomStep[], myRedo: [] as RoomStep[], solo: null as SoloSave | null, meta: null as RoomMeta | null, key: null as string | null,
  expireTimer: undefined as number | undefined, dropTimer: undefined as number | undefined, members: 0, connected: false, lastLive: 0,
  liveTimer: null as number | null, busy: false,
};

// ค่าที่หลายส่วนของโปรแกรมใช้ร่วมกันและเปลี่ยนค่าได้
export const G = {
  ctx: mainCtx as CanvasRenderingContext2D,   // ที่ที่กำลังวาดอยู่ (จอ หรือพื้นที่ร่างของเลเยอร์)
  W: 0,
  H: 0,
  DPR: 1,
  strokes: [] as Stroke[],
  undoStack: [] as Snapshot[],
  redoStack: [] as Snapshot[],
  VS: 1,
  OX: 0,
  OY: 0,
  ZOOM: 1,
  PX: 0,
  PY: 0,
  paperDirty: true,
  current: null as Stroke | null,        // เส้นที่กำลังวาด
  raw: null as RawPt[] | null,           // จุดดิบของเส้นที่กำลังวาด
  activeId: null as number | null,       // pointer ที่กำลังวาด
  dirty: true,
  bf: 0,   // เฟรมการสั่นของเส้น
  wf: 0,   // เฟรมคลื่นของเส้นหยัก
  layers: [{id:1, name:'เลเยอร์ 1', visible:true, opacity:1}] as Layer[],
  activeLayer: 1,
  thumbsDirty: true,
  thumbsAt: 0,
};
