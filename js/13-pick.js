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
  // labels first: they are a depthTest:false overlay drawn on top of
  // everything, so whatever is under the cursor *visually* is the label,
  // not the geometry behind it. Hit-tested in screen space (see
  // labelHitAt) rather than by raycast, because the anti-overlap solver
  // offsets each pill in screen space via Sprite.center -- a 3D ray would
  // test the un-offset quad and miss every stacked label.
  var lblInfo = labelHitAt(clientX - rect.left, clientY - rect.top);
  if (lblInfo){ showTooltip(lblInfo, clientX, clientY); return; }
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
/* -- tooltip DOM + label-linked image clip ----------------------------
 * The tooltip used to be rebuilt with innerHTML on every show, which is
 * fine for two <div>s but fatal for a <video>: a fresh element per hover
 * means a fresh decoder and a fresh network load every time the cursor
 * crosses a pill. So the three nodes (media box / title / desc) are built
 * once and kept; a show only writes textContent and swaps video.src.
 *
 * One <video> serves every clip. It is muted+loop+playsinline (the
 * clips carry no audio track at all, but muted is what makes programmatic
 * play() legal without a user gesture) and preload="none", so nothing is
 * fetched until a hover actually asks for a clip -- an unlabelled orbit
 * costs zero bytes.
 *
 * Clips are looked up optionally: no manifest, no clips table, no entry
 * for this castle+label, or no castle registry at all -> the media box
 * stays hidden and the tooltip is exactly the old text-only one.
 * ------------------------------------------------------------------- */
var ttTitleEl = null, ttDescEl = null, ttMediaEl = null, ttVideoEl = null;
var ttVideoSrc = '';   // src currently attached to ttVideoEl ('' = none)
var ttShownInfo = null; // pickInfo the tooltip currently shows (identity-compared)
function ensureTooltipDom(){
  if (ttTitleEl) return;
  tooltipEl.textContent = '';
  ttMediaEl = document.createElement('div');
  ttMediaEl.className = 'tt-media';
  ttVideoEl = document.createElement('video');
  // properties *and* attributes: some of these are only honoured by the
  // autoplay/inline policy when present as attributes at play() time.
  ttVideoEl.muted = true; ttVideoEl.defaultMuted = true;
  ttVideoEl.loop = true; ttVideoEl.controls = false; ttVideoEl.preload = 'none';
  ttVideoEl.setAttribute('muted', '');
  ttVideoEl.setAttribute('loop', '');
  ttVideoEl.setAttribute('playsinline', '');
  ttVideoEl.setAttribute('webkit-playsinline', '');
  ttVideoEl.setAttribute('preload', 'none');
  ttVideoEl.setAttribute('disablepictureinpicture', '');
  // a decode error must never take the tooltip down with it -- the text
  // still shows, the box just folds away. Forgetting the src as well means
  // the next hover of that same clip re-attaches (and so retries) it rather
  // than taking the "same clip, just seek to 0" path into a dead element.
  ttVideoEl.addEventListener('error', function(){
    ttMediaEl.style.display = 'none';
    ttVideoSrc = '';
  });
  ttMediaEl.appendChild(ttVideoEl);
  ttTitleEl = document.createElement('div'); ttTitleEl.className = 'tt-title';
  ttDescEl = document.createElement('div'); ttDescEl.className = 'tt-desc';
  tooltipEl.appendChild(ttMediaEl);
  tooltipEl.appendChild(ttTitleEl);
  tooltipEl.appendChild(ttDescEl);
}
function tooltipClipFor(info){
  if (!info || !info.name) return null;
  var reg = window.CASTLE_CLIPS;
  var clips = reg && reg.clips;
  if (!clips) return null;
  // castle id comes from the registry entry the viewer is currently on;
  // 20-registry.js / 90-main.js load *after* this file, so both are read
  // defensively (they only ever exist by the time a hover can happen).
  if (typeof CASTLES === 'undefined' || typeof currentIdx !== 'number') return null;
  var def = CASTLES[currentIdx];
  if (!def || !def.id) return null;
  var clip = clips[def.id + '::' + info.name];
  return (clip && clip.src) ? clip : null;
}
function startTooltipClip(clip){
  if (!clip){ stopTooltipClip(); return; }
  ttMediaEl.style.display = 'block';
  if (ttVideoSrc !== clip.src){
    // poster before src: the still is what the box shows until the first
    // frame is decoded, so it has to be in place before loading starts
    ttVideoEl.poster = clip.poster || '';
    ttVideoEl.src = clip.src;
    ttVideoSrc = clip.src;
  } else {
    // same clip hovered again -> restart from the top rather than resuming
    // wherever the previous hover left off
    try { ttVideoEl.currentTime = 0; } catch (e){}
  }
  // play() rejects on a src swap mid-load (AbortError) and whenever the
  // policy declines -- both are non-fatal (the poster stays up), and an
  // unhandled rejection here would show up as a console error.
  var pr = ttVideoEl.play();
  if (pr && pr.catch) pr.catch(function(){});
}
function stopTooltipClip(){
  if (!ttVideoEl) return;
  ttMediaEl.style.display = 'none';
  if (!ttVideoEl.paused) ttVideoEl.pause();
  if (ttVideoEl.readyState > 0){ try { ttVideoEl.currentTime = 0; } catch (e){} }
}
function showTooltip(info, x, y){
  ensureTooltipDom();
  // content is rewritten only when the hovered thing actually changes:
  // doPick runs on every mousemove, and restarting the clip 60x a second
  // while the cursor drifts across one pill would never show a frame past
  // the first. Moving within the same target is a pure reposition.
  if (info !== ttShownInfo){
    ttShownInfo = info;
    ttTitleEl.textContent = info.name;
    ttDescEl.textContent = info.desc;
    startTooltipClip(tooltipClipFor(info));
  }
  tooltipEl.style.display = 'block';
  var pad = 16;
  var rectW = tooltipEl.offsetWidth, rectH = tooltipEl.offsetHeight;
  var left = x + pad, top = y + pad;
  if (left + rectW > window.innerWidth - 8) left = x - rectW - pad;
  if (top + rectH > window.innerHeight - 8) top = y - rectH - pad;
  // a tooltip with a clip is ~3x taller than a text-only one, so the flip
  // above can now land off the *top* of the screen (a cursor near the
  // bottom edge flips a 210px box to y-226). Clamping to the viewport on
  // both ends keeps the whole box visible; the old Math.max(4,..) only
  // ever guarded the near edge.
  if (rectH + 8 < window.innerHeight) top = Math.min(top, window.innerHeight - rectH - 8);
  if (rectW + 8 < window.innerWidth) left = Math.min(left, window.innerWidth - rectW - 8);
  tooltipEl.style.left = Math.max(4,left) + 'px';
  tooltipEl.style.top = Math.max(4,top) + 'px';
}
function hideTooltip(){
  tooltipEl.style.display = 'none';
  // dropping the remembered info makes re-hovering the same label replay
  // the clip from frame 0 instead of picking up mid-loop
  ttShownInfo = null;
  stopTooltipClip();
}

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
/* -- label hover ------------------------------------------------------
 * The same solve that places the pills records each *actually drawn* one
 * as a canvas-pixel box plus its tooltip payload, so hovering a label is
 * answered by a handful of rect tests (no raycast, no extra projection).
 * Only labels that survived the pass are recorded -- one thinned out for
 * want of a free slot, held back by the room-reveal gate, or behind the
 * camera pushes no box, so it is correctly inert to the mouse. The list is
 * rebuilt on exactly the frames the layout is (view fingerprint changed)
 * and cleared whenever labels are off, so it can never describe a stale or
 * invisible label. --------------------------------------------------- */
var _lblHits = [];    // pooled { x0, y0, x1, y1, info } boxes, canvas px
var _lblHitN = 0;     // live length of _lblHits (the pool itself is longer)
function clearLabelHits(){
  for (var i = 0; i < _lblHits.length; i++) _lblHits[i].info = null;
  _lblHitN = 0;
}
function labelHitAt(px, py){
  for (var i = 0; i < _lblHitN; i++){
    var hb = _lblHits[i];
    if (hb.info && px >= hb.x0 && px <= hb.x1 && py >= hb.y0 && py <= hb.y1) return hb.info;
  }
  return null;
}
function lblRectFree(x0, y0, x1, y1){
  for (var i = 0; i < _lblRects.length; i += 4){
    if (x0 < _lblRects[i+2] && x1 > _lblRects[i] &&
        y0 < _lblRects[i+3] && y1 > _lblRects[i+1]) return false;
  }
  return true;
}
function updateLabelVisibility(){
  if (!current || !current.labelGroup){ clearLabelHits(); _lblKey = ''; return; }
  current.labelGroup.visible = labelsOn;
  // labels off -> nothing is hoverable, and the fingerprint is invalidated
  // so switching them back on re-solves (and re-fills the hit list) even
  // though the view itself never moved
  if (!labelsOn){ clearLabelHits(); _lblKey = ''; return; }
  var roomsOk = lastReveal > 0.28;
  var vw = window.innerWidth, vh = window.innerHeight;
  var key = current.labelGroup.id + '|' + (roomsOk ? 1 : 0) + '|' + vw + 'x' + vh + '|' +
            camera.position.x.toFixed(2) + ',' + camera.position.y.toFixed(2) + ',' +
            camera.position.z.toFixed(2) + ',' + curAz.toFixed(4) + ',' + curEl.toFixed(4);
  if (key === _lblKey) return; // view unchanged -> last frame's layout still holds
  _lblKey = key;
  // project() reads camera.matrixWorldInverse, which is only refreshed by
  // renderer.render(). On the boot solve (and on any solve that runs before
  // this frame's render) it is still the *previous* frame's -- at boot,
  // literally the identity, which threw every anchor to a garbage screen
  // point: measured, Bodiam placed 3 of 24 pills and put the NW tower's at
  // (812,508) instead of (201,145), and with a static camera the fingerprint
  // never changed so that layout stuck. Refreshing both matrices here costs
  // one matrix invert on solve frames only, and makes the boxes recorded
  // below exactly the boxes that get drawn.
  camera.updateMatrixWorld();
  current.labelGroup.updateWorldMatrix(true, false);

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
  _lblHitN = 0;
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
    // (sx, cy) is already the pill's true on-screen centre: `center.y` puts
    // the sprite's own UV row -(LBL_GAP + slot*LBL_STEP) on the projected
    // anchor, i.e. lifts the quad's midpoint by that many pill heights plus
    // the half-height between UV -c and UV 0.5 -- exactly the cy above. So
    // the collision rect the solver just used *is* the hover rect.
    var hb = _lblHits[_lblHitN] || (_lblHits[_lblHitN] = {});
    hb.x0 = sx - pxW/2; hb.y0 = cy - pxH/2;
    hb.x1 = sx + pxW/2; hb.y1 = cy + pxH/2;
    hb.info = sp.userData.pickInfo || null;
    _lblHitN++;
  }
  // release pooled entries past the live count so a castle switch can't
  // leave the previous castle's pickInfo reachable (mirrors _lblEntries)
  for (i = _lblHitN; i < _lblHits.length; i++) _lblHits[i].info = null;
}
document.getElementById('labelToggle').addEventListener('change', function(){
  labelsOn = this.checked;
  updateLabelVisibility();
});

/* -- testing helpers: the label counterparts of __findPickScreen. They read
 * the same hit list doPick uses, so a test that hovers where these point is
 * hovering exactly what the user sees. ------------------------------- */
window.__findLabelScreen = function(nameSubstr){
  // centre (client px) of the first *currently drawn* label whose tooltip
  // name contains `nameSubstr`; null if that label is thinned out or off.
  var rect = canvas.getBoundingClientRect();
  for (var i = 0; i < _lblHitN; i++){
    var hb = _lblHits[i];
    if (!hb.info || hb.info.name.indexOf(nameSubstr) < 0) continue;
    return { x: rect.left + (hb.x0 + hb.x1)/2, y: rect.top + (hb.y0 + hb.y1)/2,
             w: hb.x1 - hb.x0, h: hb.y1 - hb.y0, name: hb.info.name };
  }
  return null;
};
window.__labelHitAt = function(clientX, clientY){
  // the exact probe doPick runs before it raycasts: which label (if any)
  // is under this client point. null when none / labels off.
  var rect = canvas.getBoundingClientRect();
  return labelHitAt(clientX - rect.left, clientY - rect.top);
};
window.__ttClip = function(){
  // what the tooltip's single reused <video> is doing right now, for tests:
  // `shown` is whether the media box is actually laid out (a clipless label
  // leaves it display:none), `src` is the attribute as authored.
  if (!ttVideoEl) return { built: false, shown: false, src: '', paused: true };
  return {
    built: true,
    shown: ttMediaEl.style.display === 'block' && ttMediaEl.offsetWidth > 0,
    tooltipShown: tooltipEl.style.display === 'block',
    src: ttVideoEl.getAttribute('src') || '',
    poster: ttVideoEl.getAttribute('poster') || '',
    paused: ttVideoEl.paused,
    readyState: ttVideoEl.readyState,
    currentTime: ttVideoEl.currentTime,
    error: ttVideoEl.error ? ttVideoEl.error.code : 0,
    videoCount: document.querySelectorAll('#tooltip video').length,
    title: ttTitleEl ? ttTitleEl.textContent : '',
    box: (function(){ var r = tooltipEl.getBoundingClientRect();
      return { x: r.left, y: r.top, w: r.width, h: r.height }; })()
  };
};
window.__labelHits = function(){
  // every drawn label's box + name, in draw (near -> far) order
  var out = [], rect = canvas.getBoundingClientRect();
  for (var i = 0; i < _lblHitN; i++){
    var hb = _lblHits[i];
    if (!hb.info) continue;
    out.push({ name: hb.info.name, kind: hb.info.kind,
               x: rect.left + (hb.x0 + hb.x1)/2, y: rect.top + (hb.y0 + hb.y1)/2,
               w: hb.x1 - hb.x0, h: hb.y1 - hb.y0 });
  }
  return out;
};
