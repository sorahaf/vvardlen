import { $, G, stage, state } from './core.js';
import { panBy, resetView, zoomAt } from './view.js';
import { redo, undo } from './history.js';
import { closeColorPop, closeLayerPop, closeSheet, setBrush, setGray, setPlaying, setRange } from './ui.js';
import { closeRoomModal } from './room.js';
import { dropper, setDropper } from './picker.js';

/* ---------- ปุ่มลัดบนคีย์บอร์ด ---------- */
export function initKeyboard(){
  window.addEventListener('keydown', e => {
    const target = e.target as HTMLInputElement;
    if (target.tagName === 'INPUT' && target.type !== 'range') return;
    // ใช้ e.code (ตำแหน่งปุ่ม) แทน e.key เพราะตอนใช้แป้นภาษาไทย ปุ่ม Z จะได้ตัว "ผ" แทน "z"
    const mod = e.ctrlKey || e.metaKey, c = e.code;
    if (mod){
      if (c === 'KeyZ'){ e.preventDefault(); e.shiftKey ? redo() : undo(); }
      else if (c === 'KeyY'){ e.preventDefault(); redo(); }
      else if (c === 'Equal' || c === 'NumpadAdd'){ e.preventDefault(); zoomAt(G.W/2, G.H/2, 1.25); }
      else if (c === 'Minus' || c === 'NumpadSubtract'){ e.preventDefault(); zoomAt(G.W/2, G.H/2, 1/1.25); }
      else if (c === 'Digit0' || c === 'Numpad0'){ e.preventDefault(); resetView(); }
      return;
    }
    if (c === 'Digit1') setBrush('pencil');
    else if (c === 'Digit2') setBrush('pixel');
    else if (c === 'Digit3') setBrush('wave');
    else if (c === 'Digit4') setBrush('paint');
    else if (c === 'Digit5') setBrush('outline');
    else if (c === 'Digit6' || c === 'KeyE') setBrush('eraser');
    else if (c === 'KeyI') setDropper(!dropper);
    else if (c === 'KeyG') setGray(!stage.classList.contains('gray'));
    else if (c === 'BracketLeft') setRange('size', 'size', Math.max(1, state.size - 1));
    else if (c === 'BracketRight') setRange('size', 'size', Math.min(30, state.size + 1));
    else if (c === 'Space'){
      e.preventDefault();
      const a = document.activeElement as HTMLElement | null;
      if (a && a.tagName === 'BUTTON') a.blur();
      setPlaying(!state.playing);
    }
    else if (c === 'Escape' || e.key === 'Escape'){ $('#modal').classList.remove('show'); closeRoomModal(); closeSheet(); closeColorPop(); closeLayerPop(); if (dropper) setDropper(false); }
    else if (c.startsWith('Arrow') && target.type !== 'range'){   // ลูกศรเลื่อนกระดาษ (ยกเว้นตอนกำลังเลื่อนแถบปรับค่า)
      e.preventDefault();
      const d = e.shiftKey ? 200 : 60;
      panBy(c === 'ArrowLeft' ? d : c === 'ArrowRight' ? -d : 0, c === 'ArrowUp' ? d : c === 'ArrowDown' ? -d : 0);
    }
  });
}
