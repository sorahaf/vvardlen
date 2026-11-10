import { BOIL, G, frame, WAVE_FRAMES, inkC, paperC, room, state } from './core.js';
import { render } from './render.js';
import { drawPaper } from './paper.js';

/* ---------- ภาพขยับ GIF ----------
   วาดทุกเฟรมของการขยับ 1 รอบ แล้วเข้ารหัสเป็น GIF เอง (ไม่ใช้ไลบรารีภายนอก)
   สีลดเหลือ 256 สีแบบ median cut + เกลี่ยจุดสีเล็กน้อย (ordered dither) ให้สีไล่ไม่เป็นปื้น */
const GIF_MAX = 720;   // ด้านยาวสุดของ GIF (พิกเซล) ไฟล์จะได้ไม่ใหญ่เกิน
class Bytes {
  a: Uint8Array; n = 0;
  constructor(size: number){ this.a = new Uint8Array(size); }
  byte(v: number){ if (this.n >= this.a.length){ const b = new Uint8Array(this.a.length * 2); b.set(this.a); this.a = b; } this.a[this.n++] = v; }
  bytes(arr: ArrayLike<number>, len = arr.length){ for (let i = 0; i < len; i++) this.byte(arr[i]); }
  u16(v: number){ this.byte(v & 255); this.byte(v >> 8 & 255); }
  str(t: string){ for (const ch of t) this.byte(ch.charCodeAt(0)); }
  out(){ return this.a.subarray(0, this.n); }
}
const lzwTab = new Int32Array(1 << 20), lzwGen = new Int32Array(1 << 20);
let lzwStamp = 0;
function lzwEncode(px: Uint8Array, out: Bytes){
  const MIN = 8, CLEAR = 256, EOI = 257;
  let size = MIN + 1, next = EOI + 1, cur = 0, bits = 0;
  const blk = new Uint8Array(255); let bl = 0;
  const flushBlk = () => { if (bl){ out.byte(bl); out.bytes(blk, bl); bl = 0; } };
  const emit = (code: number) => {
    cur |= code << bits; bits += size;
    while (bits >= 8){ blk[bl++] = cur & 255; cur >>>= 8; bits -= 8; if (bl === 255) flushBlk(); }
  };
  out.byte(MIN);
  lzwStamp++; emit(CLEAR);
  let prefix = px[0];
  for (let i = 1; i < px.length; i++){
    const k = px[i], key = prefix << 8 | k;
    if (lzwGen[key] === lzwStamp){ prefix = lzwTab[key]; continue; }
    emit(prefix);
    if (next === 4096){ emit(CLEAR); next = EOI + 1; size = MIN + 1; lzwStamp++; }
    else { if (next >= 1 << size) size++; lzwGen[key] = lzwStamp; lzwTab[key] = next++; }
    prefix = k;
  }
  emit(prefix); emit(EOI);
  while (bits > 0){ blk[bl++] = cur & 255; cur >>>= 8; bits -= 8; if (bl === 255) flushBlk(); }
  flushBlk(); out.byte(0);
}
const BAYER = [0, 8, 2, 10, 12, 4, 14, 6, 3, 11, 1, 9, 15, 7, 13, 5];
function buildPalette(frames: Uint8ClampedArray[]): number[][]{
  // นับสีแบบ 5 บิตต่อช่อง แล้วแบ่งกล่องที่สีต่างกันมากที่สุดก่อน (คิดจากความแปรปรวนรวม) จนได้ 256 สี
  const hist = new Float64Array(32768);
  for (const f of frames) for (let i = 0; i < f.length; i += 4 * 3) hist[(f[i] >> 3) << 10 | (f[i+1] >> 3) << 5 | (f[i+2] >> 3)]++;
  const WT = [3, 4, 2];   // ตาคนแยกสีเขียวได้ละเอียดสุด รองลงมาแดง แล้วน้ำเงิน
  const ch = (b: number, c: number) => c === 0 ? b >> 10 : c === 1 ? b >> 5 & 31 : b & 31;
  const stat = (bx: number[]) => {
    let n = 0; const s = [0, 0, 0], q = [0, 0, 0];
    for (const b of bx){ const h = hist[b]; n += h; for (let c = 0; c < 3; c++){ const v = ch(b, c); s[c] += v * h; q[c] += v * v * h; } }
    const vr = [0, 1, 2].map(c => (q[c] - s[c] * s[c] / n) * WT[c]);
    const ax = vr.indexOf(Math.max(...vr));
    return {bx, n, err: bx.length < 2 ? 0 : vr[0] + vr[1] + vr[2], ax, mean: s[ax] / n};
  };
  const bins: number[] = [];
  for (let i = 0; i < 32768; i++) if (hist[i]) bins.push(i);
  const boxes = [stat(bins)];
  while (boxes.length < 256){
    let best = -1, be = 0;
    boxes.forEach((b, i) => { if (b.err > be){ be = b.err; best = i; } });
    if (best < 0) break;
    const {bx, ax, mean} = boxes[best];
    const lo = bx.filter(b => ch(b, ax) <= mean), hi = bx.filter(b => ch(b, ax) > mean);
    if (!lo.length || !hi.length){ boxes[best].err = 0; continue; }
    boxes.splice(best, 1, stat(lo), stat(hi));
  }
  const pal = boxes.map(({bx}) => {
    let n = 0, r = 0, g = 0, b = 0;
    for (const x of bx){ const h = hist[x]; n += h; r += (x >> 10) * h; g += (x >> 5 & 31) * h; b += (x & 31) * h; }
    return [Math.round(r / n * 8.226), Math.round(g / n * 8.226), Math.round(b / n * 8.226)];
  });
  while (pal.length < 256) pal.push([0, 0, 0]);
  return pal;
}

export async function makeGif(onProgress: (p: number) => void): Promise<Blob>{
  // 1) วาดทุกเฟรมที่ขนาดปกติ (ไม่สนการซูม)
  const saved: [number, number, number, number, number] = [G.ZOOM, G.PX, G.PY, G.bf, G.wf];
  G.ZOOM = 1; G.PX = 0; G.PY = 0; drawPaper();
  const sx = Math.round(G.OX*G.DPR), sy = Math.round(G.OY*G.DPR);
  const F = frame(), sw = F ? Math.round(F.w*G.VS*G.DPR) : paperC.width, sh = F ? Math.round(F.h*G.VS*G.DPR) : paperC.height;
  const k = Math.min(1, GIF_MAX / Math.max(sw, sh)), w = Math.max(1, Math.round(sw * k)), h = Math.max(1, Math.round(sh * k));
  const off = document.createElement('canvas'); off.width = w; off.height = h;
  const g = off.getContext('2d', {willReadFrequently:true})!;
  const all = room.active ? G.strokes.concat([...room.live.values()]) : G.strokes;
  const wave = all.some(s => s.type === 'wave');
  // เส้นหยักวิ่งเร็วกว่า: ใช้ 12 เฟรม (ครบรอบทั้งหยักและการสั่น) ถ้าไม่มีเส้นหยัก 3 เฟรมก็ครบรอบ
  const n = wave ? WAVE_FRAMES : BOIL, delay = Math.max(2, Math.round(100 / (wave ? state.fps * 2 : state.fps)));
  const frames: Uint8ClampedArray[] = [];
  try {
    for (let i = 0; i < n; i++){
      G.bf = wave ? Math.floor(i / 2) % BOIL : i; G.wf = wave ? i : 0;
      render();
      g.clearRect(0, 0, w, h);
      g.drawImage(paperC, sx, sy, sw, sh, 0, 0, w, h); g.drawImage(inkC, sx, sy, sw, sh, 0, 0, w, h);
      frames.push(g.getImageData(0, 0, w, h).data);
      onProgress(.3 * (i + 1) / n);
      await new Promise(r => setTimeout(r, 0));
    }
  } finally {
    [G.ZOOM, G.PX, G.PY, G.bf, G.wf] = saved; G.paperDirty = true; G.dirty = true;
  }
  // 2) หาชุดสี 256 สี
  const pal = buildPalette(frames);
  const lut = new Int16Array(32768).fill(-1);
  const nearest = (q: number) => {
    if (lut[q] >= 0) return lut[q];
    const r = (q >> 10) * 8.226, gg = (q >> 5 & 31) * 8.226, b = (q & 31) * 8.226;
    let best = 0, bd = 1e9;
    for (let i = 0; i < 256; i++){ const p = pal[i], d = (p[0]-r)**2*.3 + (p[1]-gg)**2*.59 + (p[2]-b)**2*.11; if (d < bd){ bd = d; best = i; } }
    return lut[q] = best;
  };
  // 3) เข้ารหัสทีละเฟรม
  const out = new Bytes(1 << 20);
  out.str('GIF89a'); out.u16(w); out.u16(h); out.byte(0xF7); out.byte(0); out.byte(0);
  for (const p of pal){ out.byte(p[0]); out.byte(p[1]); out.byte(p[2]); }
  out.byte(0x21); out.byte(0xFF); out.byte(11); out.str('NETSCAPE2.0'); out.byte(3); out.byte(1); out.u16(0); out.byte(0);   // เล่นวนไม่รู้จบ
  const idx = new Uint8Array(w * h);
  for (let fi = 0; fi < frames.length; fi++){
    const f = frames[fi];
    for (let y = 0, i = 0; y < h; y++) for (let x = 0; x < w; x++, i++){
      const t = BAYER[(y & 3) << 2 | (x & 3)] - 7.5, o = i * 4;   // เกลี่ยจุดตามตำแหน่ง ทุกเฟรมเหมือนกัน ภาพจึงไม่กะพริบ
      const r = Math.min(255, Math.max(0, f[o] + t)), gg = Math.min(255, Math.max(0, f[o+1] + t)), b = Math.min(255, Math.max(0, f[o+2] + t));
      idx[i] = nearest((r >> 3) << 10 | (gg >> 3) << 5 | (b >> 3));
    }
    out.byte(0x21); out.byte(0xF9); out.byte(4); out.byte(4); out.u16(delay); out.byte(0); out.byte(0);
    out.byte(0x2C); out.u16(0); out.u16(0); out.u16(w); out.u16(h); out.byte(0);
    lzwEncode(idx, out);
    onProgress(.3 + .7 * (fi + 1) / frames.length);
    await new Promise(r => setTimeout(r, 0));
  }
  out.byte(0x3B);
  return new Blob([out.out() as Uint8Array<ArrayBuffer>], {type:'image/gif'});
}
