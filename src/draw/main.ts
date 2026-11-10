import { $, state } from './core.js';
import { loop } from './render.js';
import { buildPaperPicker } from './paper.js';
import { initView, resize, updateZoomUI } from './view.js';
import { initInput } from './input.js';
import { initLayers, renderLayerList } from './layers.js';
import { bindRange, initUi, setBrush, setColor, setOc, setPlaying, setShape, setTip, updateUI } from './ui.js';
import { initSaveImage } from './saveImage.js';
import { autoJoin, initRoom, isFramed, updateRoomUI } from './room.js';
import { initPicker, renderPalette } from './picker.js';
import { initAdjust } from './adjust.js';
import { initKeyboard } from './keyboard.js';
import { initPersist, load } from './persist.js';

import '../i18n/index.js';

// โลโก้ขยับแบบเดียวกับเส้น
const logo = document.querySelector('.logo-line')!;
const logoFrames = ['M9 27 C14 15, 19 31, 23 21 S31 12, 35 19','M9 26 C15 16, 18 30, 23 22 S30 13, 35 18','M10 27 C14 14, 20 30, 22 21 S31 11, 34 19'];
let li = 0;

initView();
initInput();
initLayers();
initUi();
initSaveImage();
initRoom();
initPicker();
initAdjust();
initKeyboard();
initPersist();

/* ---------- เริ่มต้น ---------- */
load();
buildPaperPicker();
bindRange('size', 'size'); bindRange('wiggle', 'wiggle', v => v.toFixed(1)); bindRange('pixel', 'pixel');
bindRange('flow', 'flow', v => Math.round(v * 100) + '%'); bindRange('amp', 'amp'); bindRange('wavelen', 'wavelen'); bindRange('fps', 'fps'); bindRange('ow', 'ow');
renderPalette(); setColor(state.color); setBrush(state.brush); setShape(state.shape); setOc(state.oc); setTip(state.tip); setPlaying(state.playing);
document.querySelectorAll<HTMLElement>('.paper').forEach(b => b.classList.toggle('on', b.dataset.paper === state.paper));
resize(); renderLayerList(); updateUI(); updateRoomUI(); updateZoomUI(); autoJoin();
// ปุ่มดาวน์โหลดซ่อนไว้เมื่อเว็บถูกฝังในกรอบของเว็บอื่น เพราะดาวน์โหลดไม่ได้
$('#dlBtn').hidden = isFramed();
if (!isFramed()) $('#modal .card p').innerHTML = 'กด “ดาวน์โหลด” เพื่อบันทึก<br>หรือคลิกขวา (กดค้างบนมือถือ) ที่รูปแล้วเลือก “บันทึกรูปภาพ”';
requestAnimationFrame(loop);
setInterval(() => { if (state.playing){ li = (li + 1) % 3; logo.setAttribute('d', logoFrames[li]); } }, 120);
