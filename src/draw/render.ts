import { BOIL, G, WAVE_FRAMES, frame, inkC, mainCtx, room, state, viewS, viewX, viewY } from './core.js';
import { drawOutlineRun, geom, grain, planStrokes, strokeRibbon } from './geometry.js';
import { drawPaint, drawPaintImage } from './paint.js';
import { PAPERS, drawPaper } from './paper.js';
import { renderLayers, scratchPool, updateThumbs } from './layers.js';
import type { Stroke } from './types.js';

/* ---------- render ---------- */

export function drawStroke(s: Stroke, live: boolean){
  const g = geom(s, G.bf, G.wf, live);
  G.ctx.save();
  G.ctx.lineCap = 'round'; G.ctx.lineJoin = 'round';
  const op = s.op ?? 1;
  G.ctx.globalAlpha = op;
  switch (s.type){
    case 'pencil': {
      const pat = grain(s.color);
      if (!pat) break;
      if (pat.setTransform) pat.setTransform(new DOMMatrix().translateSelf(G.bf*37, G.bf*23).scaleSelf(1/(G.DPR*viewS()), 1/(G.DPR*viewS())));
      G.ctx.strokeStyle = pat;
      G.ctx.lineWidth = s.size; G.ctx.stroke(g.main!);
      G.ctx.globalAlpha = .42 * op; G.ctx.lineWidth = Math.max(.8, s.size * .5); G.ctx.stroke(g.ghost!);
      break;
    }
    case 'pixel':
      G.ctx.fillStyle = s.color; G.ctx.fill(g.fill!); break;
    case 'outline':
      strokeRibbon(G.ctx, g.outer!, s.oc); strokeRibbon(G.ctx, g.inner!, s.color); break;
    case 'wave':
      G.ctx.strokeStyle = s.color; G.ctx.lineWidth = s.size;
      if (s.shape === 'zigzag'){ G.ctx.lineJoin = 'miter'; G.ctx.miterLimit = 3; }
      G.ctx.stroke(g.main!); break;
    case 'paint':
      if (g.bake) drawPaintImage(s, g.bake); else drawPaint(s, g);
      break;
    case 'eraser':
      G.ctx.globalCompositeOperation = 'destination-out';
      G.ctx.strokeStyle = '#000'; G.ctx.lineWidth = s.size; G.ctx.stroke(g.main!); break;
  }
  G.ctx.restore();
}
export function render(){
  G.ctx = mainCtx;
  G.ctx.setTransform(1, 0, 0, 1, 0, 0);
  G.ctx.clearRect(0, 0, inkC.width, inkC.height);
  const S = viewS();
  G.ctx.setTransform(G.DPR*S, 0, 0, G.DPR*S, G.DPR*viewX(), G.DPR*viewY());
  const F = frame();
  if (!room.active){
    renderLayers(mainCtx, [G.DPR*S, 0, 0, G.DPR*S, G.DPR*viewX(), G.DPR*viewY()], inkC.width, inkC.height, scratchPool, true);
    G.ctx = mainCtx;
  } else {
    G.ctx.save(); G.ctx.beginPath(); G.ctx.rect(0, 0, F!.w, F!.h); G.ctx.clip();
    const seq = G.current ? G.strokes.concat([G.current]) : G.strokes, liveSet = new Set(G.current ? [G.current] : []);
    for (const it of planStrokes(seq, liveSet)){
      if (it.run) drawOutlineRun(it.run, it.erasers!, liveSet); else drawStroke(it.s!, it.s === G.current);
    }
    for (const s of room.live.values()) drawStroke(s, true);
    G.ctx.restore();
  }
  if (F){
    // หรี่พื้นที่นอกกรอบกระดาษ และตีกรอบให้เห็นขอบ
    G.ctx.setTransform(G.DPR, 0, 0, G.DPR, 0, 0);
    const bw = F.w*S, bh = F.h*S, bx = viewX(), by = viewY();
    G.ctx.beginPath(); G.ctx.rect(0, 0, G.W, G.H); G.ctx.rect(bx, by, bw, bh);
    G.ctx.fillStyle = PAPERS[state.paper].dark ? 'rgba(0,0,0,.35)' : 'rgba(60,40,20,.13)';
    G.ctx.fill('evenodd');
    G.ctx.strokeStyle = PAPERS[state.paper].dark ? 'rgba(255,255,255,.35)' : 'rgba(42,36,32,.35)';
    G.ctx.setLineDash([6, 5]); G.ctx.lineWidth = 1.2; G.ctx.strokeRect(bx + .5, by + .5, bw - 1, bh - 1); G.ctx.setLineDash([]);
  }
}
let lastKey = '';
export function loop(now: number){
  requestAnimationFrame(loop);
  if (state.playing){
    const t = now / 1000;
    G.bf = Math.floor(t * state.fps) % BOIL;
    G.wf = Math.floor(t * state.fps * 2) % WAVE_FRAMES;
  }
  if (G.paperDirty){ drawPaper(); G.paperDirty = false; }
  updateThumbs(now);
  const key = G.bf + '|' + G.wf;
  if (G.dirty || key !== lastKey){
    try { render(); } catch (err) { console.error(err); }
    lastKey = key; G.dirty = false;
  }
}
