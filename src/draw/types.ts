// ชนิดข้อมูลหลักของกระดานวาด

export type BrushType = 'pencil' | 'pixel' | 'wave' | 'paint' | 'outline' | 'eraser';
export type InkBrush = Exclude<BrushType, 'eraser'>;
export type WaveShape = 'zigzag' | 'sine' | 'coil';
export type OutlineMode = 'ink' | 'white' | 'auto';
/** ปลายเส้นปากกาขอบ: แหลม (หนาบางตามแรงกดหรือความเร็ว) หรือมน (หนาเท่ากันตลอดเส้น) */
export type OutlineTip = 'taper' | 'round';

export interface Pt { x: number; y: number; }
/** จุดที่รับมาจากเมาส์ นิ้ว หรือปากกา ก่อนเกลี่ยเส้น */
export interface RawPt extends Pt { pr?: number; t?: number; pen?: boolean; }

/** รูปเส้นที่คำนวณแล้ว เก็บไว้ใช้ซ้ำ (แยกตามเฟรมที่สั่น) */
export interface Ribbon { path: Path2D; w: number; }
export interface Geom {
  main?: Path2D;
  ghost?: Path2D;
  fill?: Path2D;
  bake?: PaintBake;
  stamps?: PaintDab[];
  outer?: Ribbon[];
  inner?: Ribbon[];
  pts?: Pt[];
  R?: number[];
}
export interface PaintDab { x: number; y: number; r: number; a: number; rot: number; v: number; t: number; }
export interface PaintBake { img: HTMLCanvasElement; x: number; y: number; w: number; h: number; q: number; }
export interface OutlineBake { img: HTMLCanvasElement; x: number; y: number; w: number; h: number; q: number; }

export interface Stroke {
  id?: string;            // รหัสเส้นในห้องวาดกับเพื่อน
  uid?: string;           // คนวาด (ในห้อง)
  type: BrushType;
  color: string;
  size: number;
  seed: number;
  wiggle: number;
  pixel: number;
  amp: number;
  wavelen: number;
  shape: WaveShape;
  flow: number;
  oc: string;             // สีขอบ (ปากกาขอบ)
  ow: number;             // ความหนาขอบ
  pw?: number[];          // ความหนาแต่ละจุด 0 ถึง 1 (ปากกาขอบแบบปลายแหลม ถ้าไม่มีคือหนาเท่ากันทั้งเส้น)
  tip?: OutlineTip;
  pts: Pt[];
  wpts: Pt[];
  cache: Record<string, Geom>;
  layer?: number;
  iso?: number[];         // กลุ่มที่แยกไว้ตอนรวมเลเยอร์ (ให้ภาพเหมือนเดิมทุกพิกเซล)
  isoA?: number[];        // ความโปร่งของแต่ละกลุ่ม
  _oid?: number;
  runCache?: { key: string; img: OutlineBake[] } | null;
}

export interface Layer { id: number; name: string; visible: boolean; opacity: number; }
export interface Snapshot { strokes: Stroke[]; layers: Layer[]; active: number; }

export interface State {
  brush: BrushType; color: string; size: number; wiggle: number; pixel: number;
  amp: number; wavelen: number; shape: WaveShape; fps: number; playing: boolean;
  paper: string; flow: number; oc: OutlineMode; ow: number; tip: OutlineTip;
}
export type NumKey = { [K in keyof State]: State[K] extends number ? K : never }[keyof State];
