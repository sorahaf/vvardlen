import { $, G, paperC, pctx, state, viewS, viewX, viewY } from './core.js';
import { hash, mulberry } from './util.js';
import { setColor } from './ui.js';
import { save } from './persist.js';

type Ctx = CanvasRenderingContext2D;
/** พื้นที่ของกระดาษที่มองเห็น (หน่วยบนกระดาษ) */
interface Rect { x0: number; y0: number; x1: number; y1: number; }
interface Paper {
  name: string;
  dark: boolean;
  draw(g: Ctx, r: Rect, s: number): void;
  /** ลายที่ติดกับจอ ไม่ซูมตาม */
  screen?(g: Ctx, w: number, h: number): void;
}

/* ---------- papers ----------
   ลายกระดาษวาดตามพิกัดบนกระดาษ (r = พื้นที่ที่มองเห็น, s = ขนาดซูม) จึงซูมและเลื่อนไปพร้อมเส้น
   เส้นบรรทัดหนา 1 พิกเซลจอเสมอ ไม่ว่าจะซูมแค่ไหน */
export const noiseTiles: Record<string, HTMLCanvasElement> = {};
function noisePattern(g: Ctx, alpha: number, light: boolean, s: number){
  const id = alpha + '|' + light;
  if (!noiseTiles[id]){
    const c = document.createElement('canvas'); c.width = c.height = 160;
    const x = c.getContext('2d')!, im = x.createImageData(160, 160), d = im.data, r = mulberry(7);
    for (let i = 0; i < d.length; i += 4){ const v = light ? 255 : 0; d[i] = d[i+1] = d[i+2] = v; d[i+3] = r() * alpha * 255; }
    x.putImageData(im, 0, 0); noiseTiles[id] = c;
  }
  const p = g.createPattern(noiseTiles[id], 'repeat')!;
  if (p.setTransform) p.setTransform(new DOMMatrix().scaleSelf(1/s, 1/s));   // เม็ดเกรนขนาดเท่าเดิมบนจอ
  return p;
}
const area = (g: Ctx, r: Rect, color: string) => { g.fillStyle = color; g.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0); };
const grainFill = (g: Ctx, r: Rect, s: number, alpha: number, light = false) => { g.fillStyle = noisePattern(g, alpha, light, s); g.fillRect(r.x0, r.y0, r.x1 - r.x0, r.y1 - r.y0); };
function gridLines(g: Ctx, r: Rect, step: number, color: string, lw: number, offset = 0, vertical = true, horizontal = true){
  g.strokeStyle = color; g.lineWidth = lw; g.beginPath();
  if (vertical) for (let x = Math.ceil((r.x0 - offset) / step) * step + offset; x <= r.x1; x += step){ g.moveTo(x, r.y0); g.lineTo(x, r.y1); }
  if (horizontal) for (let y = Math.ceil((r.y0 - offset) / step) * step + offset; y <= r.y1; y += step){ g.moveTo(r.x0, y); g.lineTo(r.x1, y); }
  g.stroke();
}
// ของที่วางแบบสุ่ม (เส้นใย รอยเปื้อน) แบ่งเป็นช่อง แต่ละช่องสุ่มด้วยเลขประจำช่อง เลื่อนไปมาแล้วลายไม่เปลี่ยน
function forTiles(r: Rect, size: number, salt: number, fn: (x: number, y: number, rnd: () => number) => void){
  const tx0 = Math.floor(r.x0 / size), tx1 = Math.floor(r.x1 / size), ty0 = Math.floor(r.y0 / size), ty1 = Math.floor(r.y1 / size);
  if ((tx1 - tx0 + 1) * (ty1 - ty0 + 1) > 4000) return;
  for (let ty = ty0; ty <= ty1; ty++) for (let tx = tx0; tx <= tx1; tx++) fn(tx * size, ty * size, mulberry((hash(tx, ty, salt) * 4294967296) | 0));
}
function fibers(g: Ctx, r: Rect, color: string, perTile: number, salt: number){
  g.strokeStyle = color; g.lineWidth = .7;
  for (let band = 0; band < 3; band++){
    g.globalAlpha = .15 + band * .12; g.beginPath();
    forTiles(r, 160, salt + band, (ox, oy, rnd) => {
      for (let i = 0; i < perTile; i++){
        const x = ox + rnd()*160, y = oy + rnd()*160, a = rnd()*Math.PI*2, l = 4 + rnd()*14;
        g.moveTo(x, y); g.quadraticCurveTo(x + Math.cos(a+.6)*l*.5, y + Math.sin(a+.6)*l*.5, x + Math.cos(a)*l, y + Math.sin(a)*l);
      }
    });
    g.stroke();
  }
  g.globalAlpha = 1;
}
function blots(g: Ctx, r: Rect, size: number, salt: number, chance: number, minR: number, maxR: number, color: string){
  forTiles(r, size, salt, (ox, oy, rnd) => {
    if (rnd() > chance) return;
    const x = ox + rnd()*size, y = oy + rnd()*size, rad = minR + rnd()*(maxR - minR), sg = g.createRadialGradient(x, y, 0, x, y, rad);
    sg.addColorStop(0, color); sg.addColorStop(1, color.replace(/[\d.]+\)$/, '0)'));
    g.fillStyle = sg; g.fillRect(x - rad, y - rad, rad*2, rad*2);
  });
}
export const PAPERS: Record<string, Paper> = {
  plain:{name:'ขาว', dark:false, draw(g, r, s){ area(g, r, '#fdfbf6'); grainFill(g, r, s, .035); }},
  lined:{name:'สมุด', dark:false, draw(g, r, s){
    area(g, r, '#fffdf5'); grainFill(g, r, s, .03);
    gridLines(g, r, 30, '#bcd3ea', 1/s, 10, false, true);
    if (r.x0 <= 62 && r.x1 >= 62){ g.strokeStyle = '#f0a0a0'; g.lineWidth = 1.5/s; g.beginPath(); g.moveTo(62, r.y0); g.lineTo(62, r.y1); g.stroke(); }
  }},
  grid:{name:'ตาราง', dark:false, draw(g, r, s){
    area(g, r, '#fbfcf8'); grainFill(g, r, s, .03);
    gridLines(g, r, 20, '#e2ebf1', 1/s); gridLines(g, r, 100, '#c6d7e3', 1/s);
  }},
  dots:{name:'จุด', dark:false, draw(g, r, s){
    area(g, r, '#fcf9f3'); grainFill(g, r, s, .03);
    if ((r.x1 - r.x0) * (r.y1 - r.y0) / 484 > 60000) return;   // ซูมออกไกลมาก ไม่ต้องวาดจุด
    g.fillStyle = '#c6bcae'; g.beginPath();
    const rad = Math.max(1.3, .7/s);
    for (let y = Math.ceil(r.y0/22)*22; y <= r.y1; y += 22) for (let x = Math.ceil(r.x0/22)*22; x <= r.x1; x += 22){ g.moveTo(x + rad, y); g.arc(x, y, rad, 0, Math.PI*2); }
    g.fill();
  }},
  kraft:{name:'คราฟท์', dark:false, draw(g, r, s){
    area(g, r, '#c8a273'); grainFill(g, r, s, .09); grainFill(g, r, s, .05, true);
    fibers(g, r, '#8b6538', 10, 3); fibers(g, r, '#ead1ae', 5, 9);
  }},
  old:{name:'กระดาษเก่า', dark:false, draw(g, r, s){
    area(g, r, '#f1e2c2'); blots(g, r, 300, 5, .55, 20, 90, 'rgba(150,100,40,.10)'); grainFill(g, r, s, .06);
  }, screen(g, w, h){
    // ขอบเข้มแบบกระดาษเก่า อยู่กับจอ ไม่ซูมตาม
    const rg = g.createRadialGradient(w/2, h/2, Math.min(w, h)*.25, w/2, h/2, Math.max(w, h)*.75);
    rg.addColorStop(0, 'rgba(120,80,30,0)'); rg.addColorStop(1, 'rgba(120,80,30,.28)');
    g.fillStyle = rg; g.fillRect(0, 0, w, h);
  }},
  chalk:{name:'กระดานดำ', dark:true, draw(g, r, s){
    area(g, r, '#2d3a33'); blots(g, r, 380, 11, .6, 60, 220, 'rgba(255,255,255,.045)');
    grainFill(g, r, s, .06, true); grainFill(g, r, s, .12);
  }},
  blue:{name:'พิมพ์เขียว', dark:true, draw(g, r, s){
    area(g, r, '#1d4f8f'); grainFill(g, r, s, .05, true);
    gridLines(g, r, 20, 'rgba(255,255,255,.10)', 1/s); gridLines(g, r, 100, 'rgba(255,255,255,.24)', 1/s);
  }}
};
export function drawPaper(){
  const S = viewS(), ox = viewX(), oy = viewY(), p = PAPERS[state.paper];
  pctx.setTransform(1, 0, 0, 1, 0, 0);
  pctx.clearRect(0, 0, paperC.width, paperC.height);
  pctx.setTransform(G.DPR*S, 0, 0, G.DPR*S, G.DPR*ox, G.DPR*oy);
  p.draw(pctx, {x0:-ox/S, y0:-oy/S, x1:(G.W - ox)/S, y1:(G.H - oy)/S}, S);
  if (p.screen){ pctx.setTransform(G.DPR, 0, 0, G.DPR, 0, 0); p.screen(pctx, G.W, G.H); }
  $('#empty').classList.toggle('dark', p.dark);
}
export function buildPaperPicker(){
  const wrap = $('#papers');
  for (const [id, p] of Object.entries(PAPERS)){
    const b = document.createElement('button'); b.className = 'paper'; b.dataset.paper = id; b.title = p.name;
    const c = document.createElement('canvas'); c.width = c.height = 120;
    const g = c.getContext('2d')!; g.scale(.5, .5); p.draw(g, {x0:0, y0:0, x1:240, y1:240}, .5); if (p.screen) p.screen(g, 240, 240);
    const s = document.createElement('span'); s.textContent = p.name;
    b.append(c, s); wrap.append(b);
    b.addEventListener('click', () => setPaper(id));
  }
}
function setPaper(id: string){
  if (!PAPERS[id]) return;
  const wasDark = PAPERS[state.paper].dark, isDark = PAPERS[id].dark;
  state.paper = id;
  document.querySelectorAll<HTMLElement>('.paper').forEach(b => b.classList.toggle('on', b.dataset.paper === id));
  if (isDark && !wasDark && state.color === '#2a2420') setColor('#ffffff', true);
  if (!isDark && wasDark && state.color === '#ffffff') setColor('#2a2420', true);
  drawPaper(); G.dirty = true; save();
}
