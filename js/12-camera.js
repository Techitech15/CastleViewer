"use strict";

/* ====================================================================
 * 5. camera controls: orbit (drag/touch) + zoom (wheel/pinch), inertial
 * ==================================================================== */
var TARGET_Y = 6.0;
var ZMIN = 20, ZMAX = 150; // camera distance clamp (metres)
var EL_MIN = 0.05, EL_MAX = 1.25; // elevation clamp (radians)

var orbAz = -Math.PI*0.22, orbEl = 0.42, orbDist = 105;
var curAz = orbAz, curEl = orbEl, curDist = orbDist;
// look-at target (ground-plane XZ), pannable via right-drag / shift-drag /
// two-finger drag (section 5.1 below). Eased through the same
// orbX->curX/easeFactor pattern as az/el/dist, and clamped to PAN_LIMIT
// (set per-castle in applyCastle) so panning can't wander off into empty
// field. Reset to the origin on every castle switch (see applyCastle).
var orbTgtX = 0, orbTgtZ = 0;
var curTgtX = orbTgtX, curTgtZ = orbTgtZ;
var PAN_LIMIT = 40;

function easeFactor(dt){
  // frame-rate independent damping
  return reducedMotion ? 1 : (1 - Math.pow(0.001, dt));
}
function placeCamera(k){
  curAz += (orbAz - curAz) * k;
  curEl += (orbEl - curEl) * k;
  curDist += (orbDist - curDist) * k;
  curTgtX += (orbTgtX - curTgtX) * k;
  curTgtZ += (orbTgtZ - curTgtZ) * k;
  var ce = Math.cos(curEl), se = Math.sin(curEl);
  camera.position.set(
    curTgtX + curDist*ce*Math.sin(curAz),
    TARGET_Y + curDist*se,
    curTgtZ + curDist*ce*Math.cos(curAz)
  );
  camera.lookAt(curTgtX, TARGET_Y*0.55, curTgtZ);
}
function layout(){
  var w = window.innerWidth;
  var h = window.innerHeight;
  renderer.setSize(w, h, false);
  camera.aspect = w / Math.max(1,h);
  camera.updateProjectionMatrix();
}
window.addEventListener('resize', layout);

/* -- reveal: normalised 0 (far) .. 1 (near) from camera distance -- */
function computeReveal(){
  var t = (ZMAX - orbDist) / (ZMAX - ZMIN);
  return Math.max(0, Math.min(1, t));
}
var camDir = new T.Vector3();
function updateCamDir(){
  camDir.set(Math.sin(curAz), 0, Math.cos(curAz));
}

var WALL_START = 0.35, WALL_END = 0.58;
// roof fade band pulled down to sit almost on top of the wall band (was
// 0.70-0.86, leaving the roof visibly lingering long after the walls had
// faded) so the roof reads as gone at roughly the same reveal depth the
// camera-facing walls do.
var ROOF_START = 0.40, ROOF_END = 0.62;
// second, deeper cutaway tier -- used by fadeGroups whose descriptor sets
// tier:'inner' (e.g. Vincennes' donjon shell nested inside the outer
// enceinte). Reached only once the outer 'outer'-tier shell has already
// fully faded (WALL_END/ROOF_END below these start points), so the two-
// stage cutaway reads as outer walls first, then the keep. Every fadeGroup
// defaults to tier:'outer' (see setGroupOpacity/updateFade below), so
// castles that never set `tier` -- i.e. Bodiam -- are unaffected.
var DONJON_WALL_START = 0.72, DONJON_WALL_END = 0.90;
var DONJON_ROOF_START = 0.76, DONJON_ROOF_END = 0.92;
var FACE_DOT = 0.25;
function smoothstep(a,b,x){
  if (b<=a) return x<a?0:1;
  var t = Math.max(0, Math.min(1, (x-a)/(b-a)));
  return t*t*(3-2*t);
}
function setGroupOpacity(fg, op, instant){
  fg.op = op;
  var visible = op > 0.02;
  fg.group.visible = visible;
  if (visible){
    var full = op >= 0.999;
    fg.mat.transparent = !full;
    fg.mat.depthWrite = full;
    fg.mat.opacity = op;
  }
}
function updateFade(reveal, dt){
  if (!current) return;
  var k = reducedMotion ? 1 : easeFactor(dt);
  var anyMid = false, anyRoofGone = false;
  current.fadeGroups.forEach(function(fg){
    var inner = fg.tier === 'inner';
    var dirFade = 0;
    if (fg.dir){
      var facing = fg.dir.x*camDir.x + fg.dir.z*camDir.z;
      if (facing > FACE_DOT) dirFade = smoothstep(inner ? DONJON_WALL_START : WALL_START, inner ? DONJON_WALL_END : WALL_END, reveal);
    }
    var roofFade = fg.roof ? smoothstep(inner ? DONJON_ROOF_START : ROOF_START, inner ? DONJON_ROOF_END : ROOF_END, reveal) : 0;
    var fade = Math.max(dirFade, roofFade);
    var targetOp = 1 - fade;
    var nextOp = fg.op + (targetOp - fg.op) * k;
    if (Math.abs(nextOp - targetOp) < 0.003) nextOp = targetOp;
    setGroupOpacity(fg, nextOp);
    if (fade > 0.02 && fade < 0.98) anyMid = true;
    if (fg.roof && roofFade > 0.9) anyRoofGone = true;
  });
  return { anyMid: anyMid, anyRoofGone: anyRoofGone };
}

/* -- pointer / touch / wheel handling -- */
var ptrs = new Map();
var dragging = false, lastX=0, lastY=0, pinchD=0, pinchDist=orbDist;
var panMode = false; // this drag gesture pans the look-at target instead of orbiting
var pinchMidX=0, pinchMidY=0; // two-finger gesture midpoint, tracked frame-to-frame for pan
function ptrDist(){
  var a = Array.from(ptrs.values());
  return Math.hypot(a[0].x-a[1].x, a[0].y-a[1].y);
}
function ptrMid(){
  var a = Array.from(ptrs.values());
  return { x:(a[0].x+a[1].x)/2, y:(a[0].y+a[1].y)/2 };
}
/* -- 5.1 pan: right-drag / shift+left-drag (mouse) or two-finger drag
 * (touch, alongside the existing pinch-zoom) move the look-at target
 * across the ground plane, using the camera's own current right vector
 * and its forward vector projected onto the ground (elevation ignored --
 * per spec, vertical drag walks the target forward/back along the
 * ground rather than along the camera's tilted view axis). Scaled by
 * curDist so the on-screen drag-to-world-motion ratio stays constant
 * across zoom levels, matching how az/el already feel zoom-independent. */
var PAN_K = 0.0012;
function clampPan(){
  var d = Math.hypot(orbTgtX, orbTgtZ);
  if (d > PAN_LIMIT){
    var s = PAN_LIMIT / d;
    orbTgtX *= s; orbTgtZ *= s;
  }
}
function panBy(dx, dy){
  var rightX = Math.cos(curAz), rightZ = -Math.sin(curAz);
  var fwdX = -Math.sin(curAz), fwdZ = -Math.cos(curAz); // camera->target, ground-projected
  var scale = curDist * PAN_K;
  // vertical drag inverted by user preference: dragging down pulls the
  // scene toward the viewer (target moves away), dragging up pushes it
  orbTgtX -= (rightX*dx - fwdX*dy) * scale;
  orbTgtZ -= (rightZ*dx - fwdZ*dy) * scale;
  clampPan();
}
canvas.addEventListener('contextmenu', function(e){ e.preventDefault(); });
var touchStart = null; // tap-vs-drag detection for touch tooltip picking
canvas.addEventListener('pointerdown', function(e){
  ptrs.set(e.pointerId, {x:e.clientX,y:e.clientY});
  try{ canvas.setPointerCapture(e.pointerId); }catch(_e){}
  if (e.pointerType === 'touch'){
    if (ptrs.size === 1) touchStart = {x:e.clientX, y:e.clientY, t:performance.now()};
  } else {
    hideTooltip();
  }
  if (ptrs.size === 2){
    dragging=false; pinchD = ptrDist(); pinchDist = orbDist;
    var mid0 = ptrMid(); pinchMidX = mid0.x; pinchMidY = mid0.y;
    hideTooltip(); return;
  }
  dragging = true; lastX = e.clientX; lastY = e.clientY;
  panMode = e.pointerType !== 'touch' && (e.button === 2 || (e.button === 0 && e.shiftKey));
  canvas.classList.add('drag');
});
canvas.addEventListener('pointermove', function(e){
  if (ptrs.has(e.pointerId)) ptrs.set(e.pointerId, {x:e.clientX,y:e.clientY});
  if (ptrs.size >= 2){
    var d = ptrDist();
    if (pinchD > 8) orbDist = Math.max(ZMIN, Math.min(ZMAX, pinchDist * (pinchD/d)));
    // two-finger midpoint drift pans, independent of (and simultaneous
    // with) the distance-drift pinch-zoom handled just above.
    var mid = ptrMid();
    panBy(mid.x - pinchMidX, mid.y - pinchMidY);
    pinchMidX = mid.x; pinchMidY = mid.y;
    return;
  }
  if (!dragging){
    if (e.pointerType !== 'touch') doPick(e.clientX, e.clientY);
    return;
  }
  if (panMode){
    panBy(e.clientX - lastX, e.clientY - lastY);
  } else {
    orbAz -= (e.clientX - lastX) * 0.0062;
    orbEl = Math.max(EL_MIN, Math.min(EL_MAX, orbEl - (e.clientY - lastY) * 0.0046));
  }
  lastX = e.clientX; lastY = e.clientY;
  hideTooltip();
});
canvas.addEventListener('pointerleave', function(e){
  if (e.pointerType !== 'touch') hideTooltip();
});
function ptrEnd(e){
  // resolve tap-vs-drag first, but call doPick only after `dragging` below
  // is updated -- doPick bails out while dragging is still true, and a
  // single-pointer tap leaves it true until the ptrs.size===0 branch runs.
  var tapAt = null;
  if (e && e.pointerType === 'touch' && touchStart){
    var dx = e.clientX - touchStart.x, dy = e.clientY - touchStart.y;
    if (Math.hypot(dx,dy) < 10 && performance.now() - touchStart.t < 600){
      tapAt = { x: e.clientX, y: e.clientY };
    } else {
      hideTooltip();
    }
    touchStart = null;
  }
  if (e && ptrs.has(e.pointerId)) ptrs.delete(e.pointerId);
  if (ptrs.size < 2) pinchD = 0;
  if (ptrs.size === 0){ dragging = false; panMode = false; canvas.classList.remove('drag'); }
  else { var a = Array.from(ptrs.values())[0]; lastX=a.x; lastY=a.y; dragging=true; }
  if (tapAt) doPick(tapAt.x, tapAt.y);
}
canvas.addEventListener('pointerup', ptrEnd);
canvas.addEventListener('pointercancel', ptrEnd);
canvas.addEventListener('wheel', function(e){
  e.preventDefault();
  var d = e.deltaMode===1 ? e.deltaY*16 : e.deltaY;
  orbDist = Math.max(ZMIN, Math.min(ZMAX, orbDist * Math.exp(d*0.0016)));
  hideTooltip();
}, {passive:false});

/* ====================================================================
 * 6. reveal indicator UI
 * ==================================================================== */
var dots = [document.getElementById('dot0'), document.getElementById('dot1'), document.getElementById('dot2')];
var revealText = document.getElementById('revealText');
function updateRevealUI(reveal){
  // stage 2 ("内観") now keys off WALL_END rather than the old ROOF_START:
  // walls and roof fade over roughly the same band (Fix 3), so WALL_END
  // is the meaningful "structure is gone" threshold for both.
  var stage = reveal < WALL_START ? 0 : (reveal < WALL_END ? 1 : 2);
  dots.forEach(function(d,i){ d.classList.toggle('on', i<=stage); });
  revealText.textContent = stage===0 ? '外観' : (stage===1 ? '一部カットアウェイ' : '内観');
}
