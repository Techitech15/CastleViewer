"use strict";

var T = THREE;
var reducedMotion = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

/* ====================================================================
 * 0. small geometry / material helpers
 * ==================================================================== */
function mkBox(w,h,d,mat){
  var m = new T.Mesh(new T.BoxGeometry(w,h,d), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function mkCyl(rt,rb,h,seg,mat){
  var m = new T.Mesh(new T.CylinderGeometry(rt,rb,h,seg), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function mkCone(r,h,seg,mat){
  var m = new T.Mesh(new T.ConeGeometry(r,h,seg), mat);
  m.castShadow = true; m.receiveShadow = true;
  return m;
}
function place(mesh,x,y,z,ry){
  mesh.position.set(x,y,z);
  if (ry) mesh.rotation.y = ry;
  return mesh;
}

/* ---- room / structure hover-tooltip picking -------------------------
 * Rooms used to carry an always-visible canvas-sprite label. That is
 * replaced by a hidden pick volume + HTML tooltip (see section 5.5), so
 * this factory builds an invisible raycast target instead of a sprite.
 * The mesh is intentionally never added to the scene graph -- raycasting
 * only needs its world matrix (computed once, it never moves), so it
 * costs zero GPU state and needs no disposal bookkeeping on castle
 * switch (it is simply dropped with the rest of the old `built` object). */
function registerPick(list, kind, x, y, z, w, h, d, name, desc){
  var mesh = new T.Mesh(new T.BoxGeometry(Math.max(w,0.5), Math.max(h,0.5), Math.max(d,0.5)));
  mesh.position.set(x, y, z);
  mesh.updateMatrixWorld(true);
  mesh.userData.pickInfo = { kind: kind, name: name, desc: desc };
  list.push(mesh);
  return mesh;
}

/* cheap deterministic pseudo-noise (sum of sines) -- no external noise
   library, used for both ground undulation and the mountain ridgelines */
function hashNoise2(x, z){
  return Math.sin(x*0.11 + z*0.07)*0.55 + Math.sin(x*0.23 - z*0.17 + 1.7)*0.28 + Math.sin(x*0.05+z*0.031+4.1)*1.0;
}
function ridgeNoise1D(a, seed){
  return Math.sin(a*3 + seed)*0.5 + Math.sin(a*7.3 + seed*1.7)*0.28 +
         Math.sin(a*12.7 + seed*2.3)*0.16 + Math.sin(a*21.1 + seed*3.9)*0.08;
}
function smoothstep01(a,b,x){
  if (b<=a) return x<a?0:1;
  var t = Math.max(0, Math.min(1, (x-a)/(b-a)));
  return t*t*(3-2*t);
}
/* rolling ground plane: flat out to `flatR` (so the moat/island/bridge
   height relationships never move), then a gentle noise undulation
   fades in over the next 40m so the horizon doesn't read as a dead-flat
   disc once the background mountains (section 3.5) are added.
   `cutHalf` (optional): drop any triangle with a vertex inside the axis-
   aligned square of half-extent `cutHalf` -- used to punch a (grid-
   quantised, slightly generous) hole under a moat/bank system that dips
   below this plane's flat height, so this continuous plane can't poke
   through geometry that's meant to be lower. The caller is responsible
   for covering the resulting hole with its own precise geometry (see
   buildWaterMoatSystem's "collar", section 0.5) -- this function only
   guarantees no ground triangle survives with any vertex inside
   `cutHalf`, it does not fill the gap itself. */
function buildUndulatingGround(flatR, size, segs, mat, cutHalf){
  var geo = new T.PlaneGeometry(size, size, segs, segs);
  geo.rotateX(-Math.PI/2);
  var pos = geo.attributes.position;
  var i;
  for (i=0;i<pos.count;i++){
    var x = pos.getX(i), z = pos.getZ(i);
    var d = Math.hypot(x,z);
    var t = smoothstep01(flatR, flatR+40, d);
    pos.setY(i, hashNoise2(x,z) * 2.2 * t);
  }
  geo.computeVertexNormals();
  if (cutHalf != null){
    var srcIdx = geo.getIndex().array, kept = [];
    for (i=0;i<srcIdx.length;i+=3){
      var a=srcIdx[i], b=srcIdx[i+1], c=srcIdx[i+2];
      var sqA = Math.max(Math.abs(pos.getX(a)), Math.abs(pos.getZ(a)));
      var sqB = Math.max(Math.abs(pos.getX(b)), Math.abs(pos.getZ(b)));
      var sqC = Math.max(Math.abs(pos.getX(c)), Math.abs(pos.getZ(c)));
      if (sqA < cutHalf || sqB < cutHalf || sqC < cutHalf) continue; // any corner inside -> drop the whole face
      kept.push(a,b,c);
    }
    geo.setIndex(kept);
  }
  var mesh = new T.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}

/* two-colour checker texture (e.g. Flemish tile floors); repeat-tiled so
   it reads at any UV scale a BoxGeometry face happens to produce */
function makeCheckerTexture(colorA, colorB, tilesPerSide){
  var cell = 32, n = 2; // 2x2 cell canvas, repeated via texture.repeat
  var c = document.createElement('canvas');
  c.width = c.height = cell*n;
  var ctx = c.getContext('2d');
  ctx.fillStyle = colorA; ctx.fillRect(0,0,c.width,c.height);
  ctx.fillStyle = colorB;
  ctx.fillRect(0,0,cell,cell);
  ctx.fillRect(cell,cell,cell,cell);
  var tex = new T.CanvasTexture(c);
  tex.wrapS = T.RepeatWrapping; tex.wrapT = T.RepeatWrapping;
  tex.repeat.set(tilesPerSide||6, tilesPerSide||6);
  tex.magFilter = T.NearestFilter;
  return tex;
}

/* label sprite (canvas-text pill) used by the "always-on labels" toggle
 * (section 6). Castle-agnostic: any castle's room-name strings can use
 * this.
 * depthTest is OFF (with a high renderOrder) so a label always draws on
 * top of the castle. Reason: the cutaway's whole purpose is to show the
 * interior, but a half-faded wall still writes depth while opaque and the
 * un-faded near walls certainly do, so room labels behind them were
 * either clipped away entirely or half-swallowed by a floor/wall/furniture
 * mesh that happened to intersect the sprite quad. Labels are an overlay,
 * not scene geometry -- occluding them defeats the point. Room labels are
 * still gated behind the reveal threshold (see updateLabelVisibility) so
 * this never shows interior names through a fully solid castle.
 * frustumCulled is off because updateLabelVisibility offsets the sprite in
 * screen space via `center` (anti-overlap stacking); the cull test only
 * knows the un-offset position and would pop labels out near the top edge
 * of the frame. Label counts are tiny (5-22 per castle), so always
 * submitting them costs nothing measurable. */
function roundRectPath(ctx,x,y,w,h,r){
  ctx.beginPath();
  ctx.moveTo(x+r,y);
  ctx.arcTo(x+w,y,x+w,y+h,r);
  ctx.arcTo(x+w,y+h,x,y+h,r);
  ctx.arcTo(x,y+h,x,y,r);
  ctx.arcTo(x,y,x+w,y,r);
  ctx.closePath();
}
/* `withBadge` draws a small accent-coloured play triangle at the left of
 * the pill, marking a label that has an image clip behind it. The badge is
 * decided per castle at runtime (a clip exists or it does not), not at
 * build time, so it is applied by setLabelBadge() below rather than here --
 * this function only knows how to draw the two variants. */
function makeTextSprite(text, worldHeight, withBadge){
  var fontSize = 30, padX = 16, padY = 10;
  var badgeW = withBadge ? Math.round(fontSize * 0.82) : 0;
  var c = document.createElement('canvas');
  var ctx = c.getContext('2d');
  ctx.font = '700 ' + fontSize + 'px sans-serif';
  var textW = Math.ceil(ctx.measureText(text).width);
  c.width = textW + padX*2 + badgeW;
  c.height = fontSize + padY*2;
  ctx.font = '700 ' + fontSize + 'px sans-serif'; // canvas resize resets ctx state
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  roundRectPath(ctx, 1, 1, c.width-2, c.height-2, 9);
  ctx.fillStyle = 'rgba(16,17,13,0.72)';
  ctx.fill();
  ctx.lineWidth = 1.4;
  ctx.strokeStyle = 'rgba(238,230,211,0.4)';
  ctx.stroke();
  if (withBadge){
    var bx = padX * 0.75, bcy = c.height/2, bs = fontSize * 0.34;
    ctx.beginPath();
    ctx.moveTo(bx, bcy - bs);
    ctx.lineTo(bx + bs*1.5, bcy);
    ctx.lineTo(bx, bcy + bs);
    ctx.closePath();
    ctx.fillStyle = '#d7b26a'; // --accent, same as the UI highlight
    ctx.fill();
  }
  ctx.fillStyle = '#f2ead6';
  ctx.fillText(text, badgeW + padX + textW/2, c.height/2 + 1);
  var tex = new T.CanvasTexture(c);
  var mat = new T.SpriteMaterial({ map: tex, transparent: true, depthWrite: false, depthTest: false });
  var spr = new T.Sprite(mat);
  spr.renderOrder = 9000;
  spr.frustumCulled = false;
  var h = worldHeight || 0.9;
  spr.scale.set(h * (c.width/c.height), h, 1);
  return spr;
}

/* Swap a label pill between its plain and badged forms. Which labels carry
 * a clip is only knowable once the viewer is on a given castle (the clip
 * registry is keyed by castle id), so the badge is applied after the fact
 * instead of at build time. Returns true when the sprite actually changed,
 * so the caller can invalidate the label layout -- the pill gets wider, so
 * its cached aspect ratio has to be refreshed too. */
function setLabelBadge(spr, want){
  want = !!want;
  if (!!spr.userData.hasClip === want) return false;
  var pi = spr.userData.pickInfo;
  if (!pi) return false;
  var fresh = makeTextSprite(pi.name.split(' ')[0],
    pi.kind === 'structure' ? 1.4 : 0.85, want);
  if (spr.material){
    if (spr.material.map) spr.material.map.dispose();
    spr.material.dispose();
  }
  spr.material = fresh.material;
  spr.userData.hasClip = want;
  spr.userData.aspect = fresh.scale.x / fresh.scale.y;
  return true;
}

/* always-on label group, built from a castle's `pickables` list. Shared
 * across every castle build() so a new registry entry gets this for free
 * just by populating `pickables` the normal way (registerPick) -- no
 * per-castle label code needed.
 * Every pickable (both 'structure' and 'room' kind) gets a sprite, sized
 * off the pickable's own pick-volume height so it floats just above the
 * tower/room without per-castle tuning. Each sprite is tagged with its
 * kind in userData so updateLabelVisibility (section 6) can gate them
 * independently once the toggle is on: 'structure' labels (towers, gates,
 * walls, ...) show immediately since they're exterior and never occluded
 * by the cutaway; 'room' labels stay gated behind the reveal threshold so
 * they don't float visibly through a still-solid wall.
 * The sprite sits exactly ON the top face of its pick volume (the anchor);
 * the visible lift above that -- and any extra lift used to unstack
 * overlapping labels -- is applied per frame in *screen* space through
 * Sprite.center (see updateLabelVisibility). A fixed world-space lift was
 * what buried labels in the first place: +0.6m clears a Bodiam room wall
 * (33m castle) but is invisible at Malbork (470m), and any single constant
 * is wrong for both. A screen-space lift is scale-free by construction --
 * it reads the same at every castle and every zoom. */
function buildLabelGroup(group, pickables){
  var labelGroup = new T.Group();
  labelGroup.visible = false;
  group.add(labelGroup);
  pickables.forEach(function(p){
    var pi = p.userData.pickInfo;
    var shortName = pi.name.split(' ')[0];
    var worldHeight = pi.kind === 'structure' ? 1.4 : 0.85;
    var spr = makeTextSprite(shortName, worldHeight);
    var h = p.geometry.parameters.height;
    var ay = p.position.y + h/2;
    spr.position.set(p.position.x, ay, p.position.z);
    spr.userData.labelKind = pi.kind;
    // same tooltip payload the pick volume carries, so hovering the label
    // itself can show the identical tooltip without a second lookup
    // (see labelHitAt / doPick, section 5.5)
    spr.userData.pickInfo = pi;
    // anchor = top-centre of the pick volume, in the castle group's local
    // space. Kept separately from position because the layout pass needs a
    // stable point to project (position never moves now, but this keeps the
    // two concerns readable and survives any future world-space nudge).
    spr.userData.anchor = new T.Vector3(p.position.x, ay, p.position.z);
    // pill aspect ratio, kept so the per-frame constant-screen-size
    // rescale in updateLabelVisibility preserves the text proportions
    spr.userData.aspect = spr.scale.x / spr.scale.y;
    // last anti-overlap stacking level, retried first next solve (hysteresis)
    spr.userData.slot = 0;
    labelGroup.add(spr);
  });
  return labelGroup;
}
