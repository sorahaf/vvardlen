/* ---------- โลโก้และภาพในแบนเนอร์ ขยับแบบเดียวกับเส้นบนกระดาน ---------- */
type P = [number, number];
const $ = (s: string) => document.querySelector(s) as Element;

const LOGO = ['M9 27 C14 15, 19 31, 23 21 S31 12, 35 19','M9 26 C15 16, 18 30, 23 22 S30 13, 35 18','M10 27 C14 14, 20 30, 22 21 S31 11, 34 19'];
const wobble = (pts: P[], amp: number): P[] => pts.map(([x, y]) => [x + (Math.random() - .5) * amp, y + (Math.random() - .5) * amp]);
function curve(p: P[]){
  let d = `M${p[0][0].toFixed(1)} ${p[0][1].toFixed(1)}`;
  for (let i = 1; i < p.length - 1; i++){ const mx = (p[i][0] + p[i+1][0]) / 2, my = (p[i][1] + p[i+1][1]) / 2; d += ` Q${p[i][0].toFixed(1)} ${p[i][1].toFixed(1)} ${mx.toFixed(1)} ${my.toFixed(1)}`; }
  const l = p[p.length-1]; return d + ` L${l[0].toFixed(1)} ${l[1].toFixed(1)}`;
}
const pencilBase = Array.from({length:14}, (_, i): P => [40 + i*20, 78 + Math.sin(i / 2) * 18]);   // ดินสอยุกยิก
const pixelBase = Array.from({length:22}, (_, i): P => [44 + i*12, 128 + Math.round(Math.sin(i / 3) * 2) * 10]);   // เส้นพิกเซล
let frame = 0, li = 0;
function drawArt(){
  $('#artPencil').setAttribute('d', curve(wobble(pencilBase, 4)));
  $('#artPencil2').setAttribute('d', curve(wobble(pencilBase, 6)));
  $('#artPixel').innerHTML = wobble(pixelBase, 5).map(([x, y]) => `<rect x="${Math.round(x/6)*6}" y="${Math.round(y/6)*6}" width="12" height="12"/>`).join('');
  let d = ''; const ph = frame * .6;   // เส้นหยัก: หยักวิ่งไปเรื่อย ๆ
  for (let x = 40; x <= 320; x += 2){ const y = 192 + Math.asin(Math.sin(x / 7 - ph)) * 7 + Math.sin(x / 40) * 6; d += (x === 40 ? 'M' : 'L') + x + ' ' + y.toFixed(1); }
  $('#artWave').setAttribute('d', d);
}
export function startArt(){
  setInterval(() => { li = (li + 1) % 3; $('#logoLine').setAttribute('d', LOGO[li]); frame++; drawArt(); }, 120);
  drawArt();
}
