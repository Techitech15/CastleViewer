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
    waterColor: col(0x2c4854), windowGlow: 0.0, mountainColor: col(0x93a2a0),
    waterSpecular: col(0x9fd4e0), sunDisk: 1.0
  },
  day: {
    sunPos: new T.Vector3(60, 85, 40), sunColor: col(0xfff2d8), sunIntensity: 1.55,
    hemiSky: col(0xdfe9f2), hemiGround: col(0x4a4530), hemiIntensity: 0.65,
    ambientColor: col(0xffffff), ambientIntensity: 0.22,
    fogColor: col(0xcdddE3), fogNear: 140, fogFar: 900,
    sky: [col(0x4f8dc7), col(0x7fb1de), col(0xa7c7e2), col(0xbcd7ea), col(0xd3d8c5), col(0xe7e2c9)],
    waterColor: col(0x203a3c), windowGlow: 0.0, mountainColor: col(0x7fa898),
    // 昼の太陽は仰角 49.7 度。sunAnchorDir のクランプで地平線近くへ降ろすと
    // 「真昼なのに夕日の位置に太陽がある」絵になるので円板は出さない。
    waterSpecular: col(0x9fd4e0), sunDisk: 0.0
  },
  dusk: {
    sunPos: new T.Vector3(-78, 20, -52), sunColor: col(0xff9a56), sunIntensity: 1.05,
    hemiSky: col(0x5b4a6e), hemiGround: col(0x2c2436), hemiIntensity: 0.48,
    ambientColor: col(0xffb37a), ambientIntensity: 0.18,
    fogColor: col(0xaa6f66), fogNear: 90, fogFar: 760,
    sky: [col(0x1c2350), col(0x3a3468), col(0x7a4f74), col(0xc96a52), col(0xe8935a), col(0xf0b378)],
    waterColor: col(0x363340), windowGlow: 0.4, mountainColor: col(0x4a3c52),
    waterSpecular: col(0x9fd4e0), sunDisk: 1.0
  },
  night: {
    sunPos: new T.Vector3(40, 60, -70), sunColor: col(0xaebfe6), sunIntensity: 0.62,
    hemiSky: col(0x1c2540), hemiGround: col(0x0a0a12), hemiIntensity: 0.40,
    ambientColor: col(0x8fa0cf), ambientIntensity: 0.15,
    fogColor: col(0x0b1220), fogNear: 80, fogFar: 560,
    sky: [col(0x02040c), col(0x050a18), col(0x0a1428), col(0x0d1a34), col(0x111f3c), col(0x182742)],
    waterColor: col(0x111a26), windowGlow: 1.0, mountainColor: col(0x0a1220),
    /* ★夜だけ水面の specular を落とす(実測に基づく)。
     * 水面は MeshPhongMaterial + shininess 90 + specular 0x9fd4e0 で、月光
     * (dir 0.62 / 0xaebfe6)の鏡面ローブが夜のフレームで **輝度 0.84** に
     * 達していた(fx_night_off.png を実測、該当画素 約6万)。一方その夜に
     * 光らせたい窓明かりは中央値 0.51・最大 0.66、ステンドグラスは 0.40 が
     * 上限。つまり「窓より水面のほうが明るい」ので、輝度しきい値では
     * 両者を絶対に分離できない(しきい値を上げれば水面だけが残り、
     * 下げれば水面が先に飽和する = ブルームが水面で暴発していた原因)。
     * 彩度で分ける案も、鏡面の裾が (95,141,187) と十分に青いため不可。
     * 唯一の分離手段は水面側の輝度を下げること。0x9fd4e0 の約 16% まで
     * 落とすと鏡面ピークは 0.84 -> 0.24 前後になり、窓(0.51)/ステンド
     * グラス(0.40)の下に十分な余裕をもって潜る。月明かりの照り返し
     * 自体は周囲の水面(0.13)の 2 倍弱として残るので消えはしない。
     * 朝/昼/夕は 0x9fd4e0 のまま = 素材側の既定値と同一で、実測で
     * 調整済みの waterColor の見えには一切影響しない。 */
    waterSpecular: col(0x1a2325), sunDisk: 0.0
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
    waterColor: s.waterColor.clone(), windowGlow: s.windowGlow, mountainColor: s.mountainColor.clone(),
    waterSpecular: s.waterSpecular.clone(), sunDisk: s.sunDisk
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
  dst.waterSpecular.copy(a.waterSpecular).lerp(b.waterSpecular, t);
  dst.sunDisk = a.sunDisk + (b.sunDisk - a.sunDisk) * t;
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

/* ====================================================================
 * 3.6 太陽円板(sun disk)
 *
 * なぜ要るか
 * ----------
 * 光芒(js/17-postfx.js)は「画面内の明るい点を太陽方向へ引き伸ばす」
 * 放射ブラーなので、引き伸ばす **種** が画面に無ければ何も起きない。
 * この空は 8x512 のグラデーション(paintSky)だけで太陽が一切描かれて
 * いなかったため、光芒をONにしても画面がわずかに暖色へ寄るだけだった。
 * ここで実体のある円板を1枚置くことで、初めて光条になる。
 *
 * 実装方針
 * --------
 * ・Sprite 1枚 = 1 draw call。加算合成なので空を暗くすることはない。
 * ・depthTest は残す。地形・山・城は不透明で先に深度を書くので、
 *   太陽はそれらに **正しく隠れる**。城の輪郭で光条が途切れるのは
 *   この深度テストの結果で、god ray らしさはここから出る。
 * ・fog:false。カメラ far の 0.72 倍という遠方に置くので、fog を効かせる
 *   と芯まで霧の色に染まって種として使えなくなる。
 * ・frustumCulled:false。画面端で Sprite のバウンディング球判定により
 *   ぱっと消えるのを避ける(1 draw call なので常時描いて構わない)。
 *
 * 位置(★仰角クランプを外せるかの再評価結果)
 * ---------------------------------------------
 * 厳密投影には戻せない。このビューアの軌道カメラは必ず城を見下ろすため、
 * 視軸のピッチは orbEl(下限 EL_MIN=0.05)よりさらに下を向く:
 *   pitch = atan((TARGET_Y*0.45 + dist*sin el) / (dist*cos el)) > el
 * 縦半画角は 21 度(fov 42)なので、太陽が画面に入る条件は
 *   太陽仰角 + pitch < 21 度。
 * 朝の sunPos は仰角 18.1 度で、pitch は最小でも 2.9 度を超えるため
 * 18.1 + 2.9 = 21.0 度 = ちょうど画面上端。つまり **朝はどんな視点でも
 * 厳密投影では太陽が画面内に入らない**(実測: 最良条件で sy=1.044)。
 * 夕は仰角 12.0 度なので el<=0.10 前後まで下げれば厳密でも入る(sy=0.89)。
 * 朝を捨てられない以上クランプは残す。なお空自体が「カメラ姿勢に依らない
 * 画面空間のグラデーション」でありもともと物理的な天球ではないので、
 * 仰角だけを圧縮しても破綻は生じない。方位は sunPos のままなので、
 * 太陽は必ず正しい側(影と反対側)に出る。
 * ★重要: 円板と光芒の中心は必ずこの同じ sunAnchorDir を使うこと。
 *   別々に計算すると光条が円板からずれて一瞬で嘘だと分かる。
 *
 * クランプ値 0.13rad(7.4度)の決め方(撮って選んだ)
 * ---------------------------------------------------
 *   0.20 … 太陽が画面のかなり上に出る。地平線の太陽に見えない。
 *   0.09 … 山の稜線すれすれまで下がるが、視点によっては稜線に完全に
 *          隠れて種が消え、光芒が出なくなる。
 *   0.13 … 稜線のすぐ上・雲の帯に掛かる高さ。雲に部分的に遮られるので
 *          遮蔽由来の粗密も乗る。朝(el=0.06, zoom=0.5)で sy=0.79、
 *          夕で sy=0.77 と、どちらも余裕をもって画面内に入る。
 * なお太陽が画面内に入るのはカメラ仰角が低いとき(概ね orbEl<=0.15)。
 * 既定の見下ろし視点(orbEl=0.42)では太陽は画面上端の外にあり、光芒は
 * 意図どおり出ない ―― これは不具合ではなく、画面外の光源から光条を
 * 出さないという要件そのもの。
 * ================================================================== */
var SUN_ANCHOR_ELEV_MAX = 0.13; // rad ≒ 7.4 度
var SUN_DISK_ANGLE = 0.20;      // 円板+ハロの見かけの直径(rad)。縦画角 0.733rad
function sunAnchorDir(out){
  out.copy(CUR_TIME.sunPos).normalize();
  var hLen = Math.sqrt(out.x*out.x + out.z*out.z);
  var elev = Math.asin(Math.max(-1, Math.min(1, out.y)));
  var e = Math.min(elev, SUN_ANCHOR_ELEV_MAX);
  if (hLen > 1e-6){
    var ch = Math.cos(e) / hLen;
    out.set(out.x * ch, Math.sin(e), out.z * ch);
  }
  return out;
}

function makeSunDiskTexture(){
  var c = document.createElement('canvas');
  c.width = c.height = 128;
  var ctx = c.getContext('2d');
  var g = ctx.createRadialGradient(64,64,0,64,64,64);
  // 芯は完全な白。放射ブラーのしきい値(その時間帯の空のピーク輝度基準)
  // を確実に超えさせるのが目的なので、色付けは material.color に任せる。
  g.addColorStop(0.00, 'rgba(255,255,255,1)');
  g.addColorStop(0.13, 'rgba(255,255,255,1)');
  g.addColorStop(0.19, 'rgba(255,247,226,0.34)');
  g.addColorStop(0.34, 'rgba(255,226,178,0.09)');
  g.addColorStop(0.66, 'rgba(255,206,150,0.02)');
  g.addColorStop(1.00, 'rgba(255,196,140,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0,0,128,128);
  /* ★放射状のスポーク(光条の種)
   * 円板が完全に等方だと、放射ブラーは「等方な芯」を「等方に」引き伸ばす
   * だけなので、出てくるのは光条ではなく円い滲みになる(実測: 円板だけを
   * 入れた段階では、太陽の周りが均一に明るくなるだけで筋が一本も出ない)。
   * 本来この手法で筋が出るのは、雲や建物が太陽を **部分的に遮って** 種に
   * 角度方向の粗密ができたときだけで、太陽が開けた空にある構図では
   * 原理的に何も起きない。
   * そこで円板そのものに角度方向の粗密を持たせる。長短のスポークを
   * 交互に 12 本、芯から外側へ落ちる線形グラデーションで薄く重ねる。
   * 加算合成なので空の上では飽和して明部抽出のしきい値を超え、放射
   * ブラーがこれを引き伸ばして光条になる。遮蔽物がある構図では、
   * それによる粗密も従来どおりそのまま乗る。 */
  ctx.globalCompositeOperation = 'lighter';
  for (var i = 0; i < 12; i++){
    var a = i * Math.PI / 6 + 0.16;
    var len = (i % 2 === 0) ? 60 : 38;     // 長短交互
    var half = (i % 2 === 0) ? 0.050 : 0.075;
    var sg = ctx.createLinearGradient(64, 64, 64 + Math.cos(a)*len, 64 + Math.sin(a)*len);
    sg.addColorStop(0.00, 'rgba(255,252,242,0.50)');
    sg.addColorStop(0.30, 'rgba(255,242,212,0.20)');
    sg.addColorStop(1.00, 'rgba(255,232,196,0)');
    ctx.fillStyle = sg;
    ctx.beginPath();
    ctx.moveTo(64, 64);
    ctx.arc(64, 64, len, a - half, a + half);
    ctx.closePath();
    ctx.fill();
  }
  ctx.globalCompositeOperation = 'source-over';
  return new T.CanvasTexture(c);
}
var SUN_DISK = new T.Sprite(new T.SpriteMaterial({
  map: makeSunDiskTexture(), color: 0xffffff, transparent: true,
  blending: T.AdditiveBlending, depthWrite: false, fog: false, opacity: 0
}));
SUN_DISK.frustumCulled = false;
SUN_DISK.visible = false;
scene.add(SUN_DISK);

var _sunAnchorTmp = new T.Vector3();
function updateSunDisk(){
  /* 天候: 曇/雨/雪では隠す。CUR_WEATHER.sunMul は 晴1.00/曇0.50/雨0.38/
   * 雪0.58 なので、0.62〜0.95 の smoothstep で晴だけが 1、他は 0 になる
   * (天候トランジション中は滑らかに消える)。時間帯側は sunDisk が
   * 朝1/昼0/夕1/夜0。夜に月を出さないのも、昼に地平線の太陽を出さないのも
   * ここで決まる。 */
  var vis = CUR_TIME.sunDisk * smoothstep01(0.62, 0.95, CUR_WEATHER.sunMul);
  SUN_DISK.visible = vis > 0.01;
  if (!SUN_DISK.visible) return;
  // カメラ相対で置くので、camera.matrixWorld の更新状況に依存しない
  // (position だけ見る)。far の内側に必ず収まる距離を使う。
  var dist = camera.far * 0.72;
  sunAnchorDir(_sunAnchorTmp);
  SUN_DISK.position.copy(camera.position).addScaledVector(_sunAnchorTmp, dist);
  var size = dist * SUN_DISK_ANGLE;
  SUN_DISK.scale.set(size, size, 1);
  SUN_DISK.material.opacity = vis;
  SUN_DISK.material.color.copy(CUR_TIME.sunColor);
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
    (current.waterMats || []).forEach(function(m){
      m.color.copy(CUR_TIME.waterColor);
      // 堀は Phong 前提だが、将来 Lambert/Basic の水面を返す城が来ても
      // ここで落とさない(specular を持つものにだけ配る)。
      if (m.specular) m.specular.copy(CUR_TIME.waterSpecular);
    });
    if (current.windowMat){
      current.windowMat.emissive.copy(WARM_GLOW).multiplyScalar(CUR_TIME.windowGlow * 0.85);
    }
  }
  /* 湖(js/15-nature.js)の水面は堀と同じ Phong + specular 0x9fd4e0 だが、
   * 湖ごとにマテリアルを複製しているため current.waterMats には入らない。
   * 夜の specular 抑制を堀にだけ効かせると、湖のある城(ヴァンセンヌ/
   * マルボルク)で同じ白飛びが残るので、NAT.lakes 側にも同じ値を配る。
   * updateNature が触るのは L.mat.color だけなので競合しない。 */
  if (typeof NAT !== 'undefined' && NAT && NAT.lakes){
    for (var li = 0; li < NAT.lakes.length; li++){
      var lm = NAT.lakes[li].mat;
      if (lm && lm.specular) lm.specular.copy(CUR_TIME.waterSpecular);
    }
  }
  updateSunDisk();
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
