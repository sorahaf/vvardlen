import { $, BOARD, G, inkC, paperC, room } from './core.js';
import { render } from './render.js';
import { drawPaper } from './paper.js';
import { toast } from './ui.js';
import { makeGif } from './gif.js';

/* ---------- บันทึกรูป (PNG และ GIF) ---------- */
let lastBlob: Blob | null = null;
let pngUrl = '', gifUrl: string | null = null, gifBusy = false;
type Format = 'png' | 'gif';
const outImg = () => $<HTMLImageElement>('#outImg'), dlBtn = () => $<HTMLAnchorElement>('#dlBtn');
function showFormat(f: Format){
  document.querySelectorAll<HTMLElement>('#fmtSeg button').forEach(b => b.classList.toggle('on', b.dataset.f === f));
  $('#copyImg').hidden = f === 'gif';   // คัดลอก GIF ลงคลิปบอร์ดเบราว์เซอร์ส่วนใหญ่ยังไม่รองรับ
  dlBtn().download = f === 'gif' ? 'wadlen.gif' : 'wadlen.png';
  if (f === 'png'){ outImg().src = pngUrl; dlBtn().href = pngUrl; $('#gifBusy').hidden = true; return; }
  if (gifUrl){ outImg().src = gifUrl; dlBtn().href = gifUrl; return; }
  if (gifBusy) return;
  gifBusy = true; $('#gifBusy').hidden = false; $('#gifBar').style.width = '0';
  $('#gifMsg').textContent = 'กำลังทำ GIF รอสักครู่';
  makeGif(p => { $('#gifBar').style.width = Math.round(p * 100) + '%'; })
    // ใช้ลิงก์แบบ data: (เหมือนภาพ PNG) เพราะบางหน้าที่ฝังเว็บไว้ เช่น หน้าพรีวิว ไม่ยอมโหลดลิงก์แบบ blob:
    .then(blob => new Promise<[Blob, string]>((ok, fail) => { const r = new FileReader(); r.onload = () => ok([blob, r.result as string]); r.onerror = fail; r.readAsDataURL(blob); }))
    .then(([blob, url]) => {
      gifUrl = url;
      if (document.querySelector<HTMLElement>('#fmtSeg .on')?.dataset.f === 'gif'){ outImg().src = url; dlBtn().href = url; }
      toast('ทำ GIF เสร็จแล้ว ขนาด ' + Math.max(1, Math.round(blob.size / 1024)) + ' KB');
    })
    .catch(err => { console.warn(err); toast('ทำ GIF ไม่สำเร็จ ลองใหม่อีกครั้ง'); showFormat('png'); })
    .finally(() => { gifBusy = false; $('#gifBusy').hidden = true; });
}
function closeSaveModal(){ $('#modal').classList.remove('show'); }

export function initSaveImage(){
  $('#saveBtn').addEventListener('click', () => {
    // บันทึกที่ขนาดปกติเสมอ ไม่ว่าตอนนี้ซูมอยู่แค่ไหน แล้วค่อยคืนมุมมองเดิม
    const saved: [number, number, number] = [G.ZOOM, G.PX, G.PY];
    G.ZOOM = 1; G.PX = 0; G.PY = 0;
    drawPaper(); render();
    // ในห้องบันทึกเฉพาะกระดาษสี่เหลี่ยมของห้อง ไม่เอาพื้นที่หรี่รอบ ๆ
    const sx = Math.round(G.OX*G.DPR), sy = Math.round(G.OY*G.DPR);
    const sw = room.active ? Math.round(BOARD*G.VS*G.DPR) : paperC.width, sh = room.active ? sw : paperC.height;
    const c = document.createElement('canvas'); c.width = sw; c.height = sh;
    const g = c.getContext('2d')!;
    g.drawImage(paperC, sx, sy, sw, sh, 0, 0, sw, sh); g.drawImage(inkC, sx, sy, sw, sh, 0, 0, sw, sh);
    [G.ZOOM, G.PX, G.PY] = saved; G.paperDirty = true; G.dirty = true;
    pngUrl = c.toDataURL('image/png');
    lastBlob = null; c.toBlob(b => { lastBlob = b; }, 'image/png');
    gifUrl = null;
    showFormat('png');
    $('#modal').classList.add('show');
  });
  document.querySelectorAll<HTMLElement>('#fmtSeg button').forEach(b => b.addEventListener('click', () => showFormat(b.dataset.f as Format)));
  outImg().addEventListener('error', () => { if (outImg().getAttribute('src')) toast('แสดงรูปในหน้านี้ไม่ได้ ลองเปิดเว็บจากลิงก์ของคุณ (GitHub Pages) แล้วบันทึกอีกครั้ง'); });
  $('#closeModal').addEventListener('click', closeSaveModal);
  $('#modal').addEventListener('click', e => { if ((e.target as Element).id === 'modal') closeSaveModal(); });
  $('#copyImg').addEventListener('click', async () => {
    try {
      if (!lastBlob || !('ClipboardItem' in window)) throw 0;
      await navigator.clipboard.write([new ClipboardItem({'image/png': lastBlob})]);
      toast('คัดลอกรูปแล้ว วางที่ไหนก็ได้เลย');
    } catch (_) { toast('คัดลอกไม่ได้ ลองคลิกขวาที่รูปแล้วกดบันทึกแทนนะ'); }
  });
}
