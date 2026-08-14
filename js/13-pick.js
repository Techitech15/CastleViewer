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
function updateLabelVisibility(){
  if (!current || !current.labelGroup) return;
  current.labelGroup.visible = labelsOn;
  if (!labelsOn) return;
  var roomsOk = lastReveal > 0.28;
  current.labelGroup.children.forEach(function(spr){
    var kind = spr.userData.labelKind;
    spr.visible = kind === 'room' ? roomsOk : true;
    if (!spr.visible) return;
    // constant on-screen size: a fixed world height reads fine at Bodiam's
    // 105m but is sub-pixel at Vincennes' 450m, so scale with camera
    // distance instead (0.02·d ≈ 24px tall at any zoom, fov 42)
    spr.getWorldPosition(_lblPos);
    var d = _lblPos.distanceTo(camera.position);
    var h = d * (kind === 'room' ? 0.016 : 0.02);
    spr.scale.set(h * spr.userData.aspect, h, 1);
  });
}
document.getElementById('labelToggle').addEventListener('change', function(){
  labelsOn = this.checked;
  updateLabelVisibility();
});
