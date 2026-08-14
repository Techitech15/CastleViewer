"use strict";

/* ====================================================================
 * 3.5 environment layer: time-of-day + weather + background mountains
 *     + rain/snow particles.
 *
 * Built ONCE here, independent of the active castle, so it is reused as
 * castles are switched (no re-creation / no double-dispose risk). Time
 * and weather are each a small state machine that cross-fades between a
 * frozen "from" snapshot and a target preset over TIME_DURATION /
 * WEATHER_DURATION seconds (threejs-landscape: "time of day is
 * interpolation, not a switch" -- switching mid-transition freezes the
 * *current interpolated* values as the new "from", so repeated clicks
 * never jump).
 * ==================================================================== */
function col(hex){ return new T.Color(hex); }

/* ---- waterColor の決め方(重要)---------------------------------------
 * waterColor は「素の色」ではなく **照明で乗算されたあとの見え方** で
 * 決めること。水面(01-moat.js の waterMat / 15-nature.js の湖)は
 * MeshPhongMaterial + shininess 90 + specular 0x9fd4e0 の上向き面なので、
 * 昼(sun 1.55 + hemi 0.65 + ambient 0.22)では素の値が約 1.9〜2.3 倍まで
 * 持ち上がり、しかも specular が青白を足す。
 *   旧 day 0x2e5b66 (46,91,102) -> 実測 #6bb6c3 (107,182,195) 彩度 0.45
 * これがボディアムの水堀が「プールのような明るいシアン」に見えていた
 * 原因で、色指定が間違っていたのではなく乗算で飛んでいた。ボーマリスの
 * 塔頂部が白飛びしたときと同じ現象。
 * 現在値は乗算後に落ち着くところまで下げてある(実測):
 *   day     0x203a3c -> 水堀 #5c888a 彩度 0.34 明度 0.54(草地は明度 0.84)
 *   morning 0x2c4854 -> 朝の青白さは残しつつ明度を下げる
 *   dusk    0x363340 -> 夕日の specular が主役なので素の色は暗く
 *   night   0x111a26 -> 周囲の地面(ほぼ黒)から水面だけが光らない濃さ
 * 変更するときは必ず 朝/昼/夕/夜 の4つを撮って乗算後で確認すること。 */
var TIME_STATES = {
  morning: {
    sunPos: new T.Vector3(-95, 32, 24), sunColor: col(0xffd9a0), sunIntensity: 1.15,
    hemiSky: col(0xcfd8e6), hemiGround: col(0x5a4a3a), hemiIntensity: 0.55,
    ambientColor: col(0xfff2df), ambientIntensity: 0.20,
    fogColor: col(0xd9c9b0), fogNear: 90, fogFar: 650,
    sky: [col(0x3f6a92), col(0x7d9dc0), col(0xb9c8c9), col(0xe3c9a0), col(0xf2d9ae), col(0xfbe6c2)],
    waterColor: col(0x2c4854), windowGlow: 0.0, mountainColor: col(0x93a2a0)
  },
  day: {
    sunPos: new T.Vector3(60, 85, 40), sunColor: col(0xfff2d8), sunIntensity: 1.55,
    hemiSky: col(0xdfe9f2), hemiGround: col(0x4a4530), hemiIntensity: 0.65,
    ambientColor: col(0xffffff), ambientIntensity: 0.22,
    fogColor: col(0xcdddE3), fogNear: 140, fogFar: 900,
    sky: [col(0x4f8dc7), col(0x7fb1de), col(0xa7c7e2), col(0xbcd7ea), col(0xd3d8c5), col(0xe7e2c9)],
    waterColor: col(0x203a3c), windowGlow: 0.0, mountainColor: col(0x7fa898)
  },
  dusk: {
    sunPos: new T.Vector3(-78, 20, -52), sunColor: col(0xff9a56), sunIntensity: 1.05,
    hemiSky: col(0x5b4a6e), hemiGround: col(0x2c2436), hemiIntensity: 0.48,
    ambientColor: col(0xffb37a), ambientIntensity: 0.18,
    fogColor: col(0xaa6f66), fogNear: 90, fogFar: 760,
    sky: [col(0x1c2350), col(0x3a3468), col(0x7a4f74), col(0xc96a52), col(0xe8935a), col(0xf0b378)],
    waterColor: col(0x363340), windowGlow: 0.4, mountainColor: col(0x4a3c52)
  },
  night: {
    sunPos: new T.Vector3(40, 60, -70), sunColor: col(0xaebfe6), sunIntensity: 0.62,
    hemiSky: col(0x1c2540), hemiGround: col(0x0a0a12), hemiIntensity: 0.40,
    ambientColor: col(0x8fa0cf), ambientIntensity: 0.15,
    fogColor: col(0x0b1220), fogNear: 80, fogFar: 560,
    sky: [col(0x02040c), col(0x050a18), col(0x0a1428), col(0x0d1a34), col(0x111f3c), col(0x182742)],
    waterColor: col(0x111a26), windowGlow: 1.0, mountainColor: col(0x0a1220)
  }
};
var WEATHER_STATES = {
  clear:  { sunMul: 1.00, ambientMul: 1.00, fogNearMul: 1.00, fogFarMul: 1.00, skySatMul: 1.00, rain: 0, snow: 0 },
  cloudy: { sunMul: 0.50, ambientMul: 0.82, fogNearMul: 0.82, fogFarMul: 0.68, skySatMul: 0.42, rain: 0, snow: 0 },
  rain:   { sunMul: 0.38, ambientMul: 0.78, fogNearMul: 0.70, fogFarMul: 0.56, skySatMul: 0.34, rain: 1, snow: 0 },
  snow:   { sunMul: 0.58, ambientMul: 0.85, fogNearMul: 0.60, fogFarMul: 0.48, skySatMul: 0.52, rain: 0, snow: 1 }
};

function cloneTimeState(s){
  return {
    sunPos: s.sunPos.clone(), sunColor: s.sunColor.clone(), sunIntensity: s.sunIntensity,
    hemiSky: s.hemiSky.clone(), hemiGround: s.hemiGround.clone(), hemiIntensity: s.hemiIntensity,
    ambientColor: s.ambientColor.clone(), ambientIntensity: s.ambientIntensity,
    fogColor: s.fogColor.clone(), fogNear: s.fogNear, fogFar: s.fogFar,
    sky: s.sky.map(function(c){ return c.clone(); }),
    waterColor: s.waterColor.clone(), windowGlow: s.windowGlow, mountainColor: s.mountainColor.clone()
  };
}
function blendTime(dst, a, b, t){
  dst.sunPos.copy(a.sunPos).lerp(b.sunPos, t);
  dst.sunColor.copy(a.sunColor).lerp(b.sunColor, t);
  dst.sunIntensity = a.sunIntensity + (b.sunIntensity - a.sunIntensity) * t;
  dst.hemiSky.copy(a.hemiSky).lerp(b.hemiSky, t);
  dst.hemiGround.copy(a.hemiGround).lerp(b.hemiGround, t);
  dst.hemiIntensity = a.hemiIntensity + (b.hemiIntensity - a.hemiIntensity) * t;
  dst.ambientColor.copy(a.ambientColor).lerp(b.ambientColor, t);
  dst.ambientIntensity = a.ambientIntensity + (b.ambientIntensity - a.ambientIntensity) * t;
  dst.fogColor.copy(a.fogColor).lerp(b.fogColor, t);
  dst.fogNear = a.fogNear + (b.fogNear - a.fogNear) * t;
  dst.fogFar = a.fogFar + (b.fogFar - a.fogFar) * t;
  for (var i=0;i<6;i++) dst.sky[i].copy(a.sky[i]).lerp(b.sky[i], t);
  dst.waterColor.copy(a.waterColor).lerp(b.waterColor, t);
  dst.windowGlow = a.windowGlow + (b.windowGlow - a.windowGlow) * t;
  dst.mountainColor.copy(a.mountainColor).lerp(b.mountainColor, t);
}
function cloneWeatherState(s){
  return { sunMul:s.sunMul, ambientMul:s.ambientMul, fogNearMul:s.fogNearMul, fogFarMul:s.fogFarMul, skySatMul:s.skySatMul, rain:s.rain, snow:s.snow };
}
function blendWeather(dst, a, b, t){
  dst.sunMul = a.sunMul + (b.sunMul - a.sunMul) * t;
  dst.ambientMul = a.ambientMul + (b.ambientMul - a.ambientMul) * t;
  dst.fogNearMul = a.fogNearMul + (b.fogNearMul - a.fogNearMul) * t;
  dst.fogFarMul = a.fogFarMul + (b.fogFarMul - a.fogFarMul) * t;
  dst.skySatMul = a.skySatMul + (b.skySatMul - a.skySatMul) * t;
  dst.rain = a.rain + (b.rain - a.rain) * t;
  dst.snow = a.snow + (b.snow - a.snow) * t;
}

var TIME_DURATION = 1.6, WEATHER_DURATION = 1.3;
var CUR_TIME = cloneTimeState(TIME_STATES.day);
var CUR_WEATHER = cloneWeatherState(WEATHER_STATES.clear);
var timeTrans = { key:'day', from: cloneTimeState(TIME_STATES.day), to: TIME_STATES.day, t: 1 };
var weatherTrans = { key:'clear', from: cloneWeatherState(WEATHER_STATES.clear), to: WEATHER_STATES.clear, t: 1 };

// keep the segmented-button UI in sync regardless of caller (real click,
// or the window.__setEnv debug hook used by the quality-gate script)
function syncSegUI(groupId, key){
  var el = document.getElementById(groupId);
  if (!el) return;
  Array.prototype.forEach.call(el.querySelectorAll('button'), function(b){
    b.classList.toggle('active', b.dataset.k === key);
  });
}
function setTimeOfDay(key){
  syncSegUI('timeSeg', key);
  if (!TIME_STATES[key] || (key === timeTrans.key && timeTrans.t >= 1)) return;
  var wasNight = timeTrans.key === 'night';
  timeTrans.from = cloneTimeState(CUR_TIME); // freeze current interpolated state, not the old preset
  timeTrans.to = TIME_STATES[key];
  timeTrans.t = 0;
  timeTrans.key = key;
  // 夜⇔非夜の切り替えだけ農民の人数が変わるので、その境をまたいだ時だけ
  // 住人トグルON中の住人を再生成する(低コストな追従実装、6章参照)。
  if (residentsOn && wasNight !== (key === 'night')) regenerateResidents();
}
function setWeather(key){
  syncSegUI('weatherSeg', key);
  if (!WEATHER_STATES[key] || (key === weatherTrans.key && weatherTrans.t >= 1)) return;
  weatherTrans.from = cloneWeatherState(CUR_WEATHER);
  weatherTrans.to = WEATHER_STATES[key];
  weatherTrans.t = 0;
  weatherTrans.key = key;
}
function stepTransitions(dt){
  if (timeTrans.t < 1){
    timeTrans.t = Math.min(1, timeTrans.t + dt / TIME_DURATION);
    blendTime(CUR_TIME, timeTrans.from, timeTrans.to, smoothstep01(0,1,timeTrans.t));
  }
  if (weatherTrans.t < 1){
    weatherTrans.t = Math.min(1, weatherTrans.t + dt / WEATHER_DURATION);
    blendWeather(CUR_WEATHER, weatherTrans.from, weatherTrans.to, smoothstep01(0,1,weatherTrans.t));
  }
}

var SKY_STOPS_POS = [0, 0.30, 0.52, 0.68, 0.84, 1];
var _skyOut = [col(0), col(0), col(0), col(0), col(0), col(0)];
var _tmpGray = col(0);
function desaturate(c, satMul){
  if (satMul >= 0.999) return c;
  var lum = c.r*0.299 + c.g*0.587 + c.b*0.114;
  _tmpGray.setRGB(lum, lum, lum);
  c.lerp(_tmpGray, 1 - satMul);
  return c;
}
function paintSky(){
  var g = skyCtx.createLinearGradient(0,0,0,512);
  for (var i=0;i<6;i++){
    _skyOut[i].copy(CUR_TIME.sky[i]);
    desaturate(_skyOut[i], CUR_WEATHER.skySatMul);
    g.addColorStop(SKY_STOPS_POS[i], '#' + _skyOut[i].getHexString());
  }
  skyCtx.fillStyle = g;
  skyCtx.fillRect(0,0,8,512);
  skyTex.needsUpdate = true;
}

var WARM_GLOW = col(0xffb066);
function applyEnvironment(){
  paintSky();
  sun.position.copy(CUR_TIME.sunPos);
  sun.color.copy(CUR_TIME.sunColor);
  sun.intensity = CUR_TIME.sunIntensity * CUR_WEATHER.sunMul;
  hemi.color.copy(CUR_TIME.hemiSky);
  hemi.groundColor.copy(CUR_TIME.hemiGround);
  hemi.intensity = CUR_TIME.hemiIntensity * CUR_WEATHER.ambientMul;
  fill.color.copy(CUR_TIME.ambientColor);
  fill.intensity = CUR_TIME.ambientIntensity * CUR_WEATHER.ambientMul;
  scene.fog.color.copy(CUR_TIME.fogColor);
  desaturate(scene.fog.color, CUR_WEATHER.skySatMul);
  scene.fog.near = CUR_TIME.fogNear * CUR_WEATHER.fogNearMul * FOG_NEAR_SCALE;
  scene.fog.far = Math.max(scene.fog.near + 20, CUR_TIME.fogFar * CUR_WEATHER.fogFarMul * FOG_FAR_SCALE);
  if (current){
    (current.waterMats || []).forEach(function(m){ m.color.copy(CUR_TIME.waterColor); });
    if (current.windowMat){
      current.windowMat.emissive.copy(WARM_GLOW).multiplyScalar(CUR_TIME.windowGlow * 0.85);
    }
  }
}

/* ---- background mountains: 2-3 low-poly ridgeline rings, one draw call
 * each, merged as a single BufferGeometry per ring (no external merge
 * utility needed since each ring already IS one mesh). Sits well outside
 * the camera's orbit clamp (ZMAX below) so it reads from every azimuth.
 * Colour = per-ring mix of the current time-of-day mountain colour toward
 * the current fog colour (farther ring mixes in more fog = hazier). */
var MOUNTAIN_RINGS = [];
(function buildMountains(){
  var defs = [
    { radius: 340, baseY: -34, peakBase: 26, peakVar: 32, segs: 84, mixToFog: 0.12, seed: 3.1 },
    { radius: 520, baseY: -34, peakBase: 34, peakVar: 44, segs: 72, mixToFog: 0.36, seed: 14.7 },
    { radius: 700, baseY: -34, peakBase: 40, peakVar: 54, segs: 60, mixToFog: 0.62, seed: 27.4 }
  ];
  defs.forEach(function(d, ringIdx){
    var seg = d.segs, pos = [], idxArr = [];
    for (var i=0;i<=seg;i++){
      var a = i/seg * Math.PI*2;
      var ty = d.peakBase + ridgeNoise1D(a, d.seed) * d.peakVar;
      var x = Math.cos(a)*d.radius, z = Math.sin(a)*d.radius;
      pos.push(x, d.baseY, z,  x, ty, z);
    }
    for (i=0;i<seg;i++){
      var b0=i*2, t0=i*2+1, b1=(i+1)*2, t1=(i+1)*2+1;
      idxArr.push(b0,b1,t0,  t0,b1,t1);
    }
    var geo = new T.BufferGeometry();
    geo.setIndex(idxArr);
    geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    geo.computeVertexNormals();
    var mat = new T.MeshBasicMaterial({ color: 0x7a97a0, fog: true, side: T.DoubleSide });
    var mesh = new T.Mesh(geo, mat);
    mesh.frustumCulled = false;
    mesh.renderOrder = -10 + ringIdx;
    scene.add(mesh);
    MOUNTAIN_RINGS.push({ mesh: mesh, mixToFog: d.mixToFog });
  });
})();
var _mtnTmp = col(0);
function updateMountains(){
  MOUNTAIN_RINGS.forEach(function(r){
    _mtnTmp.copy(CUR_TIME.mountainColor).lerp(CUR_TIME.fogColor, r.mixToFog);
    desaturate(_mtnTmp, CUR_WEATHER.skySatMul);
    r.mesh.material.color.copy(_mtnTmp);
  });
}

/* ---- rain / snow: anchored to the camera's XZ position so the volume
 * always surrounds the viewer (threejs-weather: "anchor the volume in
 * the frustum"). Float32BufferAttribute COPIES the array handed to it,
 * so we keep a reference to attr.array (not the original array) for the
 * per-frame update -- the classic "nothing moves" trap.
 *
 * Rain and snow must read as visibly different weather, not two shades
 * of the same round dot, so they use different primitives: snow is
 * THREE.Points with a soft circular sprite (slow, sideways sway); rain is
 * THREE.LineSegments -- a real 2-vertex streak per drop, pale blue-grey,
 * low opacity, falling far faster than snow -- built directly from the
 * drop's own fall/wind position each frame (drop head = current position,
 * tail = a fixed offset back along the fall+wind direction). */
var WEATHER_REDUCED = reducedMotion;
var RAIN_N = WEATHER_REDUCED ? 260 : 2200;
var SNOW_N = WEATHER_REDUCED ? 200 : 1300;
function makeSoftDotTexture(){
  var c = document.createElement('canvas');
  c.width = c.height = 32;
  var ctx = c.getContext('2d');
  var g = ctx.createRadialGradient(16,16,0,16,16,16);
  g.addColorStop(0, 'rgba(255,255,255,0.95)');
  g.addColorStop(0.6, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,32,32);
  return new T.CanvasTexture(c);
}
var SNOW_TEX = makeSoftDotTexture();
function buildWeatherPoints(n, spread, height, size, color, opacityMax, tex){
  var arr = new Float32Array(n*3);
  for (var i=0;i<n;i++){
    arr[i*3]   = (Math.random()-0.5)*spread;
    arr[i*3+1] = Math.random()*height;
    arr[i*3+2] = (Math.random()-0.5)*spread;
  }
  var geo = new T.BufferGeometry();
  var attr = new T.Float32BufferAttribute(arr, 3);
  attr.setUsage(T.DynamicDrawUsage);
  geo.setAttribute('position', attr);
  var mat = new T.PointsMaterial({ color: color, map: tex, size: size, transparent: true, opacity: 0, depthWrite: false, sizeAttenuation: true });
  var pts = new T.Points(geo, mat);
  pts.frustumCulled = false;
  pts.visible = false;
  scene.add(pts);
  return { points: pts, mat: mat, arr: attr.array, attr: attr, n: n, spread: spread, height: height, opacityMax: opacityMax };
}
function buildRainStreaks(n, spread, height, opacityMax){
  var arr = new Float32Array(n*3); // logical drop position (head)
  for (var i=0;i<n;i++){
    arr[i*3]   = (Math.random()-0.5)*spread;
    arr[i*3+1] = Math.random()*height;
    arr[i*3+2] = (Math.random()-0.5)*spread;
  }
  var lineArr = new Float32Array(n*2*3); // head+tail per drop, filled every frame
  var geo = new T.BufferGeometry();
  var attr = new T.Float32BufferAttribute(lineArr, 3);
  attr.setUsage(T.DynamicDrawUsage);
  geo.setAttribute('position', attr);
  var mat = new T.LineBasicMaterial({ color: 0x9fb2c2, transparent: true, opacity: 0, depthWrite: false, fog: false });
  var seg = new T.LineSegments(geo, mat);
  seg.frustumCulled = false;
  seg.visible = false;
  scene.add(seg);
  return { seg: seg, mat: mat, arr: arr, lineAttr: attr, n: n, spread: spread, height: height, opacityMax: opacityMax };
}
var RAIN = buildRainStreaks(RAIN_N, 100, 55, 0.42);
var SNOW = buildWeatherPoints(SNOW_N, 110, 60, 0.34, 0xffffff, 0.85, SNOW_TEX);
var _snowSway = 0;
var RAIN_TAIL = 1.7; // metres of streak trailing each drop
function updateWeatherParticles(dt, camX, camZ){
  RAIN.seg.position.set(camX, 0, camZ);
  SNOW.points.position.set(camX, 0, camZ);
  var rainAmt = CUR_WEATHER.rain, snowAmt = CUR_WEATHER.snow;
  RAIN.seg.visible = rainAmt > 0.005;
  SNOW.points.visible = snowAmt > 0.005;
  RAIN.mat.opacity = rainAmt * RAIN.opacityMax;
  SNOW.mat.opacity = snowAmt * SNOW.opacityMax;
  if (rainAmt > 0.005){
    if (!WEATHER_REDUCED){
      var arr = RAIN.arr, fall = 46*dt, wind = 6*dt; // ~11x snow's fall speed
      for (var i=0;i<RAIN.n;i++){
        var iy = i*3+1;
        arr[iy] -= fall;
        arr[iy-1] += wind;
        if (arr[iy] < -2){
          arr[iy] = RAIN.height * (0.6 + Math.random()*0.4);
          arr[iy-1] = (Math.random()-0.5)*RAIN.spread;
          arr[iy+1] = (Math.random()-0.5)*RAIN.spread;
        }
      }
    }
    // rebuild the head/tail line buffer from the drop positions -- tail
    // trails opposite the fall+wind direction so each segment reads as a
    // short streak rather than a dot.
    var src = RAIN.arr, dst = RAIN.lineAttr.array;
    for (var k=0;k<RAIN.n;k++){
      var sx=src[k*3], sy=src[k*3+1], sz=src[k*3+2];
      var d6=k*6;
      dst[d6]=sx; dst[d6+1]=sy; dst[d6+2]=sz;
      dst[d6+3]=sx-0.09; dst[d6+4]=sy+RAIN_TAIL; dst[d6+5]=sz;
    }
    RAIN.lineAttr.needsUpdate = true;
  }
  if (snowAmt > 0.005 && !WEATHER_REDUCED){
    _snowSway += dt;
    var sarr = SNOW.arr, sfall = 4.2*dt;
    for (var j=0;j<SNOW.n;j++){
      var sy2 = j*3+1;
      sarr[sy2] -= sfall;
      sarr[sy2-1] += Math.sin(_snowSway*0.8 + j*0.37) * 0.55 * dt;
      sarr[sy2+1] += Math.cos(_snowSway*0.6 + j*0.53) * 0.4 * dt;
      if (sarr[sy2] < -2){
        sarr[sy2] = SNOW.height * (0.6 + Math.random()*0.4);
        sarr[sy2-1] = (Math.random()-0.5)*SNOW.spread;
        sarr[sy2+1] = (Math.random()-0.5)*SNOW.spread;
      }
    }
    SNOW.attr.needsUpdate = true;
  }
}
