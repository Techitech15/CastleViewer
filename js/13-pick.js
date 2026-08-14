"use strict";

/* ====================================================================
 * 5.5 hover / tap tooltip: raycasts ONLY against the current castle's
 * `pickables` array (never the visual meshes), so cost stays flat
 * regardless of scene complexity. Room boxes are only offered once the
 * cutaway has revealed the interior (matches the label fade-in threshold
 * the old sprite system used); structure boxes (towers / gatehouse) are
 * always offered, exterior or not.
 * ==================================================================== */
var raycaster = new T.Raycaster();
var pickNdc = new T.Vector2();
var tooltipEl = document.getElementById('tooltip');
var lastReveal = 0;
function activePickables(){
  if (!current || !current.pickables) return [];
  if (lastReveal > 0.28) return current.pickables;
  return current.pickables.filter(function(p){ return p.userData.pickInfo.kind === 'structure'; });
}
function doPick(clientX, clientY){
  if (!current || dragging || ptrs.size >= 2){ return; }
  var rect = canvas.getBoundingClientRect();
  if (clientX < rect.left || clientX > rect.right || clientY < rect.top || clientY > rect.bottom){ hideTooltip(); return; }
  pickNdc.x = ((clientX - rect.left) / rect.width) * 2 - 1;
  pickNdc.y = -((clientY - rect.top) / rect.height) * 2 + 1;
  raycaster.setFromCamera(pickNdc, camera);
  var targets = activePickables();
  var hits = targets.length ? raycaster.intersectObjects(targets, false) : [];
  if (hits.length){
    showTooltip(hits[0].object.userData.pickInfo, clientX, clientY);
  } else {
    hideTooltip();
  }
}
function showTooltip(info, x, y){
  tooltipEl.innerHTML = '<div class="tt-title">' + info.name + '</div><div class="tt-desc">' + info.desc + '</div>';
  tooltipEl.style.display = 'block';
  var pad = 16;
  var rectW = tooltipEl.offsetWidth, rectH = tooltipEl.offsetHeight;
  var left = x + pad, top = y + pad;
  if (left + rectW > window.innerWidth - 8) left = x - rectW - pad;
  if (top + rectH > window.innerHeight - 8) top = y - rectH - pad;
  tooltipEl.style.left = Math.max(4,left) + 'px';
  tooltipEl.style.top = Math.max(4,top) + 'px';
}
function hideTooltip(){ tooltipEl.style.display = 'none'; }

/* -- always-on labels toggle: independent of the hover tooltip. Exterior
 * ('structure') labels show as soon as the toggle is on, regardless of
 * reveal -- they're never occluded by the cutaway, and at Vincennes'
 * scale the initial reveal can sit below 0.28 (large ZMAX/ZMIN range)
 * even though the towers are fully visible, so gating them the same way
 * room labels are silently hid them at some castles' default zoom.
 * Interior ('room') labels stay gated behind the same 0.28 reveal
 * threshold the room pickables use, so they don't float visibly through
 * a still-solid wall. Re-evaluated every frame (reveal changes
 * continuously) and on toggle/castle-switch. ------------------------- */
var labelsOn = false;
var _lblPos = new T.Vector3();
var _lblNdc = new T.Vector3();
/* -- screen-space label layout ---------------------------------------
 * Every visible label is projected to canvas pixels, then packed so no
 * two pills overlap: a label that collides with an already-placed one is
 * lifted a whole pill-height at a time (up to LBL_SLOTS tries) and, if it
 * still has nowhere to sit, dropped for this view. Nearest-to-camera wins
 * a contested spot, and each label retries its previous slot first, so a
 * slow orbit doesn't make the stack reshuffle every frame.
 * The lift is applied through Sprite.center (an offset in units of the
 * sprite's own screen height) rather than by moving the sprite in world
 * space, so it is exact regardless of camera elevation and identical at a
 * 33m castle and a 470m one.
 * Cost control: the whole solve is skipped while the view fingerprint
 * (castle + camera position + rooms-gate + viewport) is unchanged, so a
 * still camera costs one string compare per frame; while orbiting it is
 * ~20-40 projections plus a handful of rect tests. -------------------- */
var LBL_GAP = 0.5;    // base lift above the pick volume, in pill heights
var LBL_STEP = 1.12;  // stacking step, in pill heights
var LBL_SLOTS = 4;    // stacking levels tried (0..LBL_SLOTS-1) before dropping
var _lblEntries = []; // reused entry pool (no per-frame allocation)
var _lblOrder = [];   // the pool's live slice, sorted near -> far
var _lblRects = [];   // flat x0,y0,x1,y1 quads of the labels already placed
var _lblKey = '';     // view fingerprint of the last solve
function lblRectFree(x0, y0, x1, y1){
  for (var i = 0; i < _lblRects.length; i += 4){
    if (x0 < _lblRects[i+2] && x1 > _lblRects[i] &&
        y0 < _lblRects[i+3] && y1 > _lblRects[i+1]) return false;
  }
  return true;
}
function updateLabelVisibility(){
  if (!current || !current.labelGroup) return;
  current.labelGroup.visible = labelsOn;
  if (!labelsOn) return;
  var roomsOk = lastReveal > 0.28;
  var vw = window.innerWidth, vh = window.innerHeight;
  var key = current.labelGroup.id + '|' + (roomsOk ? 1 : 0) + '|' + vw + 'x' + vh + '|' +
            camera.position.x.toFixed(2) + ',' + camera.position.y.toFixed(2) + ',' +
            camera.position.z.toFixed(2) + ',' + curAz.toFixed(4) + ',' + curEl.toFixed(4);
  if (key === _lblKey) return; // view unchanged -> last frame's layout still holds
  _lblKey = key;

  var kids = current.labelGroup.children, i, n = 0;
  for (i = 0; i < kids.length; i++){
    var spr = kids[i];
    var kind = spr.userData.labelKind;
    if (kind === 'room' && !roomsOk){ spr.visible = false; continue; }
    // constant on-screen size: a fixed world height reads fine at Bodiam's
    // 105m but is sub-pixel at Vincennes' 450m, so scale with camera
    // distance instead (0.02·d ≈ 24px tall at any zoom, fov 42)
    _lblPos.copy(spr.userData.anchor).applyMatrix4(current.labelGroup.matrixWorld);
    var d = _lblPos.distanceTo(camera.position);
    var h = d * (kind === 'room' ? 0.016 : 0.02);
    spr.scale.set(h * spr.userData.aspect, h, 1);
    var e = _lblEntries[n] || (_lblEntries[n] = {});
    e.spr = spr; e.d = d; e.x = _lblPos.x; e.y = _lblPos.y; e.z = _lblPos.z;
    n++;
  }
  // drop pool references past the live count so a castle switch can't leave
  // the previous castle's (already disposed) sprites reachable
  for (i = n; i < _lblEntries.length; i++) _lblEntries[i].spr = null;
  _lblOrder.length = 0;
  for (i = 0; i < n; i++) _lblOrder.push(_lblEntries[i]);
  _lblOrder.sort(function(a, b){ return a.d - b.d; }); // nearest label wins a contested slot
  // pill height in CSS px is the same for every label of a kind (the world
  // height above is proportional to camera distance, which cancels), so it
  // comes straight out of the fov rather than from a per-label projection
  var pxUnit = vh / (2 * Math.tan(camera.fov * Math.PI / 360));
  _lblRects.length = 0;
  for (i = 0; i < n; i++){
    var en = _lblOrder[i], sp = en.spr;
    _lblNdc.set(en.x, en.y, en.z).project(camera);
    if (_lblNdc.z > 1){ sp.visible = false; continue; } // behind the camera
    var sx = (_lblNdc.x * 0.5 + 0.5) * vw;
    var sy = (1 - (_lblNdc.y * 0.5 + 0.5)) * vh;
    var pxH = (sp.userData.labelKind === 'room' ? 0.016 : 0.02) * pxUnit;
    var pxW = pxH * sp.userData.aspect;
    if (sx < -pxW || sx > vw + pxW || sy < -pxH * 8 || sy > vh + pxH){
      sp.visible = true; continue; // off-screen: never competes for a slot
    }
    var prev = sp.userData.slot | 0, placed = -1, cy = 0;
    for (var t = -1; t < LBL_SLOTS; t++){
      var slot = t < 0 ? prev : t;
      if (t >= 0 && slot === prev) continue; // already tried as the hysteresis pick
      cy = sy - (LBL_GAP + slot * LBL_STEP + 0.5) * pxH;
      if (lblRectFree(sx - pxW/2 - 1, cy - pxH/2 - 1, sx + pxW/2 + 1, cy + pxH/2 + 1)){
        placed = slot; break;
      }
    }
    if (placed < 0){ sp.visible = false; continue; } // fully boxed in -> thin it out
    sp.visible = true;
    sp.userData.slot = placed;
    sp.center.set(0.5, -(LBL_GAP + placed * LBL_STEP));
    _lblRects.push(sx - pxW/2, cy - pxH/2, sx + pxW/2, cy + pxH/2);
  }
}
document.getElementById('labelToggle').addEventListener('change', function(){
  labelsOn = this.checked;
  updateLabelVisibility();
});
