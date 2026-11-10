/* ---------- แปลงสี ----------
   ปกติ = HSV (วงล้อคือโทนสีกับความสด แถบคือความสว่าง)
   ตามสายตา = OKLCH: ความสว่างวัดแบบที่ตาเห็น ความสดคิดเป็นสัดส่วนของสีที่จอแสดงได้ ปรับความสว่างแล้วสีไม่จางเป็นเทา */
type RGB = [number, number, number];

const toLin = (c: number) => c <= .04045 ? c / 12.92 : Math.pow((c + .055) / 1.055, 2.4);
export const toGam = (c: number) => c <= .0031308 ? 12.92 * c : 1.055 * Math.pow(c, 1 / 2.4) - .055;
export function hexToRgb(h: string): RGB{ const n = parseInt(h.slice(1), 16); return [(n >> 16) / 255, (n >> 8 & 255) / 255, (n & 255) / 255]; }
export function rgbToHex(r: number, g: number, b: number){ return '#' + [r, g, b].map(v => Math.round(Math.min(1, Math.max(0, v)) * 255).toString(16).padStart(2, '0')).join(''); }
export function rgbToOklab(r: number, g: number, b: number): RGB{
  r = toLin(r); g = toLin(g); b = toLin(b);
  const l = Math.cbrt(.4122214708*r + .5363325363*g + .0514459929*b), m = Math.cbrt(.2119034982*r + .6806995451*g + .1073969566*b), s = Math.cbrt(.0883024619*r + .2817188376*g + .6299787005*b);
  return [.2104542553*l + .7936177850*m - .0040720468*s, 1.9779984951*l - 2.4285922050*m + .4505937099*s, .0259040371*l + .7827717662*m - .8086757660*s];
}
export function oklabToLin(L: number, a: number, b: number): RGB{
  const l = (L + .3963377774*a + .2158037573*b) ** 3, m = (L - .1055613458*a - .0638541728*b) ** 3, s = (L - .0894841775*a - 1.2914855480*b) ** 3;
  return [4.0767416621*l - 3.3077115913*m + .2309699292*s, -1.2684380046*l + 2.6097574011*m - .3413193965*s, -.0041960863*l - .7034186147*m + 1.7076147010*s];
}
const inGamut = (c: RGB) => c[0] >= -1e-4 && c[0] <= 1.0001 && c[1] >= -1e-4 && c[1] <= 1.0001 && c[2] >= -1e-4 && c[2] <= 1.0001;
export function maxChroma(L: number, h: number){   // ความสดสูงสุดที่จอแสดงได้ ที่ความสว่างและโทนนี้
  if (L <= 0 || L >= 1) return 0;
  const ca = Math.cos(h), sa = Math.sin(h);
  let lo = 0, hi = .37;
  for (let i = 0; i < 14; i++){ const m = (lo + hi) / 2; if (inGamut(oklabToLin(L, m*ca, m*sa))) lo = m; else hi = m; }
  return lo;
}
export function oklchHex(L: number, C: number, h: number){ const c = oklabToLin(L, C*Math.cos(h), C*Math.sin(h)); return rgbToHex(toGam(c[0]), toGam(c[1]), toGam(c[2])); }
export function hsvToRgb(h: number, s: number, v: number): RGB{
  const f = (n: number) => { const k = (n + h / 60) % 6; return v - v * s * Math.max(0, Math.min(k, 4 - k, 1)); };
  return [f(5), f(3), f(1)];
}
export function rgbToHsv(r: number, g: number, b: number): RGB{
  const mx = Math.max(r, g, b), mn = Math.min(r, g, b), d = mx - mn;
  let h = 0;
  if (d){ h = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; h *= 60; if (h < 0) h += 360; }
  return [h, mx ? d / mx : 0, mx];
}

/* ปรับสีทั้งเลเยอร์: เลื่อนโทนสีและความสว่างของทุกเส้นในเลเยอร์ (คิดแบบตามสายตา สีจึงไม่เพี้ยน) */
export function recolorHex(hex: string, dh: number, dl: number){
  const [L0, a, b] = rgbToOklab(...hexToRgb(hex));
  const L = Math.min(1, Math.max(0, L0 + dl / 100)), h = Math.atan2(b, a) + dh * Math.PI / 180;
  let C = Math.hypot(a, b);
  if (!inGamut(oklabToLin(L, C*Math.cos(h), C*Math.sin(h)))) C = Math.min(C, maxChroma(L, h));
  return oklchHex(L, C, h);
}
