import { G, room } from './core.js';
import { restoreSnapshot, snapshot } from './layers.js';
import { toast, updateUI } from './ui.js';
import { roomClear, roomStep } from './room.js';
import { adj, adjStarting, endAdjust } from './adjust.js';
import { save } from './persist.js';

/* ---------- history ---------- */
export function pushHistory(){
  if (adj && !adjStarting) endAdjust(true);   // กำลังปรับสีเลเยอร์อยู่ ให้จบก่อนแล้วค่อยทำอย่างอื่น
  G.undoStack.push(snapshot());
  if (G.undoStack.length > 300) G.undoStack.shift();
  G.redoStack = [];
}
export function undo(){ if (room.active) return roomStep(true); endAdjust(true); if (!G.undoStack.length) return; G.redoStack.push(snapshot()); restoreSnapshot(G.undoStack.pop()!); }
export function redo(){ if (room.active) return roomStep(false); endAdjust(true); if (!G.redoStack.length) return; G.undoStack.push(snapshot()); restoreSnapshot(G.redoStack.pop()!); }
export function clearAll(){
  if (!G.strokes.length) return;
  if (room.active) return roomClear();
  pushHistory(); G.strokes = []; G.dirty = true; G.thumbsDirty = true; updateUI(); save();
  toast('ล้างกระดาษแล้ว (ทุกเลเยอร์) อยากได้คืนให้กด Undo');
}
