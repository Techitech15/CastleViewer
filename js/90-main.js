"use strict";

/* ====================================================================
 * 4. active castle management (dispose-safe switch)
 * ==================================================================== */
var current = null; // { group, fadeGroups, interiorGroup, info }

function disposeMaterial(mat){
  if (!mat) return;
  if (mat.map) mat.map.dispose();
  mat.dispose();
}
function applyCastle(idx){
  var def = CASTLES[idx];
  if (current){
    current.group.traverse(function(o){
      if (o.geometry) o.geometry.dispose();
      if (o.material){
        if (Array.isArray(o.material)) o.material.forEach(disposeMaterial);
        else disposeMaterial(o.material);
      }
    });
    scene.remove(current.group);
    current = null;
  }
  var built = def.build(T);
  scene.add(built.group);
  current = built;
  currentIdx = idx;

  document.getElementById('castleName').textContent = def.nameJa;
  document.getElementById('castleMeta').textContent = def.flag + ' ' + def.countryJa + ' · ' + def.year + '年';
  document.getElementById('castleDesc').textContent = def.description;
  // reset fade state instantly so a new castle never appears mid-fade
  built.fadeGroups.forEach(function(fg){ setGroupOpacity(fg, 1, true); });
  hideTooltip();

  // apply this castle's view/env tuning (falls back to Bodiam's own
  // longstanding numbers if a registry entry omits `view` entirely).
  var v = def.view || {};
  TARGET_Y = v.targetY != null ? v.targetY : 6.0;
  ZMIN = v.zMin != null ? v.zMin : 20;
  ZMAX = v.zMax != null ? v.zMax : 150;
  var initDist = v.initDist != null ? v.initDist : 105;
  // snap the orbit distance straight to this castle's starting distance
  // (no easing) so the reveal/cutaway state always starts fresh -- carrying
  // over the previous castle's zoomed-in orbDist would otherwise open the
  // new castle already mid-cutaway, at the wrong scale for its ZMIN/ZMAX.
  orbDist = initDist; curDist = initDist;
  // pan target resets to the origin on every switch (new castle, fresh
  // vantage point) -- instant, same treatment as orbDist/curDist above.
  orbTgtX = 0; orbTgtZ = 0; curTgtX = 0; curTgtZ = 0;
  PAN_LIMIT = v.panLimit != null ? v.panLimit : 40;
  FOG_NEAR_SCALE = (v.fogNear != null ? v.fogNear : 90) / 90;
  FOG_FAR_SCALE = (v.fogFar != null ? v.fogFar : 320) / 320;
  var shadowExtent = v.shadowExtent != null ? v.shadowExtent : 60;
  sun.shadow.camera.left = -shadowExtent; sun.shadow.camera.right = shadowExtent;
  sun.shadow.camera.top = shadowExtent; sun.shadow.camera.bottom = -shadowExtent;
  sun.shadow.camera.far = v.shadowFar != null ? v.shadowFar : 220;
  sun.shadow.camera.updateProjectionMatrix();
  // far-clip plane wasn't previously castle-tunable at all (always the
  // constructor's default 1000) -- Vincennes' background mountain rings,
  // pushed out past ~700m by envScale, need a much larger far plane or
  // they simply never reach the GPU's rasteriser.
  camera.far = v.camFar != null ? v.camFar : 1000;
  camera.updateProjectionMatrix();
  ENV_SCALE = v.envScale != null ? v.envScale : 1;
  // envLift: a rigid vertical shift applied to the (already envScale'd)
  // ring, on top of the uniform radius/height scale. Verified empirically
  // (NDC-space projection of sample ring points through the actual
  // camera, not just hand trigonometry) rather than derived analytically:
  // a naive uniform envScale alone was pushing the visible ring points'
  // projected Y comfortably *above* the top of frame (ndcY > 1) at
  // Vincennes' much larger initDist/curDist, so they read as invisible --
  // envLift nudges the ring down (a *negative* value) until the ridge
  // sits back inside the frustum. The ring's geometric base (local Y=-34,
  // scaled) is always deep underground regardless of sign, so this never
  // produces a visible floating gap. Bodiam's envLift is 0 (or omitted),
  // so this is a no-op for it -- position.y simply gets (re-)set to the
  // same 0 it already is.
  ENV_LIFT = v.envLift != null ? v.envLift : 0;
  MOUNTAIN_RINGS.forEach(function(r){ r.mesh.scale.setScalar(ENV_SCALE); r.mesh.position.y = ENV_LIFT; });

  updateLabelVisibility();
  // 城切替のたびに前の城の住人を破棄し、この城の `life` データから作り
  // 直す(トグルOFF中は regenerateResidents 内で何もしない)。
  regenerateResidents();
  // 城切替のたびに自然物(雲・鳥・木・林・湖)も破棄して作り直す。城の
  // 占有範囲とスケールは 15-nature.js が pickables / group から自動導出
  // するので、城ファイル側の設定追加は不要。
  regenerateNature();
}
var currentIdx = 0;

var select = document.getElementById('castleSelect');
CASTLES.forEach(function(c, i){
  var opt = document.createElement('option');
  opt.value = i; opt.textContent = c.nameJa + ' — ' + c.countryJa + ' (' + c.year + ')';
  select.appendChild(opt);
});
select.addEventListener('change', function(){
  // guard: a synthetic change event can arrive with a non-option value
  var idx = parseInt(select.value, 10);
  if (CASTLES[idx]) applyCastle(idx);
});

function wireSeg(id, onPick){
  var el = document.getElementById(id);
  Array.prototype.forEach.call(el.querySelectorAll('button'), function(btn){
    btn.addEventListener('click', function(){ onPick(btn.dataset.k); });
  });
}
wireSeg('timeSeg', setTimeOfDay);
wireSeg('weatherSeg', setWeather);

/* ====================================================================
 * 7. main loop
 * ==================================================================== */
/* Opening state can be driven from the query string so a screenshot can
 * be reproduced by URL alone -- e.g.
 *   index.html?castle=beaumaris&time=dusk&weather=rain&az=2.4&el=0.35&zoom=0.3
 * This exists for headless capture (each run gets its own browser process
 * instead of several agents fighting over one shared tab). Every key is
 * optional; unknown or malformed values are ignored and the normal
 * defaults apply, so a plain index.html open is completely unaffected.
 *   castle : registry id (falls back to index 0)
 *   time   : morning | day | dusk | night
 *   weather: clear | cloudy | rain | snow
 *   az, el : camera azimuth / elevation in radians
 *   zoom   : 0 (far) .. 1 (near), same scale as __setZoom
 *   panx,panz : pan target in metres
 *   labels, residents : 1 to switch on */
function bootParams(){
  var q = {};
  (location.search || '').replace(/^\?/, '').split('&').forEach(function(kv){
    if (!kv) return;
    var i = kv.indexOf('=');
    if (i < 0) return;
    q[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
  });
  return q;
}
var BOOT = bootParams();
function bootNum(key){
  var v = parseFloat(BOOT[key]);
  return isFinite(v) ? v : null;
}

var bootIdx = 0;
if (BOOT.castle){
  for (var bi = 0; bi < CASTLES.length; bi++){
    if (CASTLES[bi].id === BOOT.castle){ bootIdx = bi; break; }
  }
}
applyCastle(bootIdx);
document.getElementById('castleSelect').value = String(bootIdx);
if (BOOT.time) setTimeOfDay(BOOT.time);
if (BOOT.weather) setWeather(BOOT.weather);
if (BOOT.time || BOOT.weather){
  // land on the requested state immediately -- a boot-time cross-fade
  // would leave a headless capture showing whatever the default was
  timeTrans.t = 1; CUR_TIME = cloneTimeState(timeTrans.to);
  weatherTrans.t = 1; CUR_WEATHER = cloneWeatherState(weatherTrans.to);
}
if (BOOT.labels === '1'){
  labelsOn = true;
  document.getElementById('labelToggle').checked = true;
}
if (BOOT.residents === '1'){
  residentsOn = true;
  document.getElementById('residentToggle').checked = true;
  regenerateResidents();
}
if (bootNum('az') !== null) orbAz = bootNum('az');
if (bootNum('el') !== null) orbEl = Math.max(EL_MIN, Math.min(EL_MAX, bootNum('el')));
if (bootNum('zoom') !== null){
  var bz = Math.max(0, Math.min(1, bootNum('zoom')));
  orbDist = ZMAX - bz * (ZMAX - ZMIN);
}
if (bootNum('panx') !== null) orbTgtX = bootNum('panx');
if (bootNum('panz') !== null) orbTgtZ = bootNum('panz');
clampPan();
curAz = orbAz; curEl = orbEl; curDist = orbDist;
curTgtX = orbTgtX; curTgtZ = orbTgtZ;

layout();
placeCamera(1);
updateCamDir();
lastReveal = computeReveal();
updateFade(lastReveal, 1);
updateRevealUI(lastReveal);
updateLabelVisibility();

stepTransitions(0); applyEnvironment(); updateMountains(); // paint the correct sky before the first frame

var prev = performance.now();
function frame(now){
  var dt = Math.min(0.05, (now - prev) / 1000);
  prev = now;
  var k = reducedMotion ? 1 : (1 - Math.pow(0.001, dt));
  placeCamera(k);
  updateCamDir();
  var reveal = computeReveal();
  lastReveal = reveal;
  updateFade(reveal, dt);
  updateRevealUI(reveal);
  updateLabelVisibility();
  updateResidents(dt);
  updateNature(dt);
  stepTransitions(dt);
  applyEnvironment();
  updateMountains();
  updateWeatherParticles(dt, camera.position.x, camera.position.z);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
document.getElementById('loading').style.display = 'none';
requestAnimationFrame(frame);

/* ====================================================================
 * 8. debug hooks (do not affect production UI)
 * ==================================================================== */
window.__setZoom = function(t){
  // t: 0 (far) .. 1 (near) -> maps to orbDist, snaps instantly (no easing)
  t = Math.max(0, Math.min(1, t));
  orbDist = ZMAX - t*(ZMAX-ZMIN);
  curDist = orbDist;
  placeCamera(1); updateCamDir();
  var reveal = computeReveal();
  lastReveal = reveal;
  updateFade(reveal, 1);
  updateRevealUI(reveal);
  updateLabelVisibility();
  renderer.render(scene, camera);
};
window.__setOrbit = function(az, el){
  orbAz = az; orbEl = Math.max(EL_MIN, Math.min(EL_MAX, el));
  curAz = orbAz; curEl = orbEl;
  placeCamera(1); updateCamDir();
  var reveal = computeReveal();
  lastReveal = reveal;
  updateFade(reveal, 1);
  updateLabelVisibility();
  renderer.render(scene, camera);
};
window.__applyCastle = applyCastle;
window.__setLabels = function(on){
  // testing helper: toggles always-on labels + syncs the UI checkbox,
  // without requiring a real click.
  labelsOn = !!on;
  document.getElementById('labelToggle').checked = labelsOn;
  updateLabelVisibility();
  renderer.render(scene, camera);
};
window.__setResidents = function(on){
  // testing helper: toggles the 住人 (residents) system + syncs the UI
  // checkbox, without requiring a real click.
  residentsOn = !!on;
  document.getElementById('residentToggle').checked = residentsOn;
  regenerateResidents();
  renderer.render(scene, camera);
};
window.__findPickScreen = function(nameSubstr){
  // testing helper: projects the first pickable whose tooltip name
  // contains `nameSubstr` to canvas screen coordinates (CSS pixels).
  if (!current || !current.pickables) return null;
  var hit = current.pickables.filter(function(p){ return p.userData.pickInfo.name.indexOf(nameSubstr) >= 0; })[0];
  if (!hit) return null;
  var v = hit.position.clone().project(camera);
  var rect = canvas.getBoundingClientRect();
  return { x: rect.left + (v.x*0.5+0.5)*rect.width, y: rect.top + (1-(v.y*0.5+0.5))*rect.height };
};
window.__setEnv = function(timeKey, weatherKey, instant){
  // testing helper: switches time-of-day / weather, optionally skipping
  // the cross-fade so quality-gate scripts can iterate combinations fast.
  if (timeKey) setTimeOfDay(timeKey);
  if (weatherKey) setWeather(weatherKey);
  if (instant){
    timeTrans.t = 1; CUR_TIME = cloneTimeState(timeTrans.to);
    weatherTrans.t = 1; CUR_WEATHER = cloneWeatherState(weatherTrans.to);
  }
  stepTransitions(0); applyEnvironment(); updateMountains();
  updateWeatherParticles(0, camera.position.x, camera.position.z);
  renderer.render(scene, camera);
};
window.__pickAt = function(clientX, clientY){ doPick(clientX, clientY); };
window.__setPan = function(x, z){
  // testing helper: snaps the pan target instantly (no easing), through
  // the same clamp real drag input goes through.
  orbTgtX = x; orbTgtZ = z; clampPan();
  curTgtX = orbTgtX; curTgtZ = orbTgtZ;
  placeCamera(1); updateCamDir();
  renderer.render(scene, camera);
};
window.__panBy = function(dx, dy){
  // testing helper: runs the exact drag-delta pan path (panBy) real
  // pointer input uses, then snaps curTgt to match (no easing lag) so the
  // effect is immediately observable.
  panBy(dx, dy);
  curTgtX = orbTgtX; curTgtZ = orbTgtZ;
  placeCamera(1); updateCamDir();
  renderer.render(scene, camera);
};
window.__debugState = function(){
  return {
    orbTgtX: orbTgtX, orbTgtZ: orbTgtZ, curTgtX: curTgtX, curTgtZ: curTgtZ, PAN_LIMIT: PAN_LIMIT,
    camFar: camera.far, envScale: ENV_SCALE, envLift: ENV_LIFT,
    fogNear: scene.fog.near, fogFar: scene.fog.far,
    cameraPos: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
    mountainRings: MOUNTAIN_RINGS.map(function(r){
      return { scale: r.mesh.scale.x, posY: r.mesh.position.y };
    }),
    residentsOn: residentsOn, residentCount: residents.length,
    residentGroupChildren: residentGroup.children.length
  };
};
window.__stepResidents = function(steps, dt){
  // testing helper: fast-forwards the resident state machine without
  // waiting on real time, then re-renders once. Lets a QA pass catch a
  // farmer mid-gate-passage ('through'/'throughIn') deterministically
  // instead of hoping a burst of screenshots lands on the right frame.
  steps = steps || 1; dt = dt || 0.1;
  for (var i=0;i<steps;i++) updateResidents(dt);
  renderer.render(scene, camera);
};
window.__residentStates = function(){
  // testing helper: dumps each resident's kind/state/position so a QA
  // pass can confirm farmers actually reach 'through'/'throughIn' (i.e.
  // walk the gate opening) rather than only ever 'wander'/'outside'.
  return residents.map(function(npc){
    return { kind: npc.kind, state: npc.state,
      x: npc.obj.position.x, z: npc.obj.position.z, visible: npc.obj.visible };
  });
};
window.__scene = scene; window.__camera = camera; window.__renderer = renderer;
window.__MOUNTAIN_RINGS = MOUNTAIN_RINGS;
