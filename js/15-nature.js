"use strict";

/* ====================================================================
 * 1.5 nature / landscape layer — 全城共通、完全に城非依存。
 *
 * 雲・鳥・木・林/森・湖 を「城ファイルに一切設定を書き足さずに」自動
 * 生成する。城側から読むのは build() が既に返している汎用フィールド
 * (`pickables` / `life.gates` / `group` の可視メッシュ)だけで、この
 * ファイルのために castles/*.js を編集する必要はない。
 *
 * ---- 城のスケールをどう自動導出するか ------------------------------
 * 1) `current.pickables` (構造物のピック用ボックス) の XZ バウンディング
 *    ボックスを取り、その最大辺 `spanMax` を「城の代表寸法」とする。
 *    ボディアム ≒ 45m、マルボルク ≒ 500m。
 * 2) `current.group` の可視メッシュを走査し、XZ 幅が spanMax*2.6 を超える
 *    平たいメッシュ(= 地面プレーン)を「地形(TERRAIN)」として分離、
 *    それ以外(城本体・堀・土手・橋・川・丘の斜面)をすべて足し合わせた
 *    AABB を「除外ゾーン」とする。地面だけが除かれるので、堀や川の上に
 *    木が生えることは構造的に起こらない。城ごとの定数は不要。
 * 3) 配置半径 rFar = min(地形の広がり*0.9, その城の fogFar*0.85,
 *    max(除外ゾーン半径*1.9, ZMAX*1.6))。木の背丈は ZMAX から
 *    pow(ZMAX/150, 0.45) で導出(ボディアム 10.5m 〜 マルボルク 22m)。
 *    雲・鳥の高度/半径/サイズも同じく ZMAX と ENV_SCALE から導く。
 * 4) 地面の高さは TERRAIN へのレイキャストで取得する(城ごとの groundY
 *    や起伏ノイズの位相を知らなくても、必ず地面の上に立つ)。
 *
 * ---- 干渉しないための約束 ------------------------------------------
 * ・自然物は `pickables` に一切入れない → ツールチップのレイキャスト
 *   (13-pick.js)は自然物を無視する。
 * ・`current.group` にも入れない → カットアウェイの opacity フェード
 *   (12-camera.js) と applyCastle の dispose 走査の対象外。
 * ・`life.gates` の外側経路(農民が場外へ歩き去る先)は帯状に除外する。
 * ・決定論的: Math.random() は使わず、城 id から作った mulberry32 と
 *   既存の hashNoise2 座標ハッシュだけを使う(同じ城なら毎回同じ絵)。
 * ・共有リソース(木のジオメトリ/マテリアル、雲テクスチャ、鳥、湖の
 *   マテリアル)は一度だけ生成して城を跨いで使い回し、城切替では個体
 *   (InstancedMesh と湖のジオメトリ)だけを破棄する。
 * ==================================================================== */

/* ---- 決定論的乱数 (mulberry32) + 文字列ハッシュ -------------------- */
function natStrSeed(s){
  var h = 2166136261, i;
  for (i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); }
  return h >>> 0;
}
function natRng(seed){
  var a = seed >>> 0;
  return function(){
    a = (a + 0x6D2B79F5) | 0;
    var t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function natLerp(a,b,t){ return a + (b-a)*t; }
function natClamp(v,a,b){ return v<a?a:(v>b?b:v); }
// 点 (px,pz) と線分 (ax,az)-(bx,bz) の距離(門の外側経路よけに使う)
function natSegDist(px,pz,ax,az,bx,bz){
  var dx = bx-ax, dz = bz-az;
  var L2 = dx*dx + dz*dz;
  var t = L2 > 1e-6 ? ((px-ax)*dx + (pz-az)*dz) / L2 : 0;
  t = natClamp(t, 0, 1);
  var qx = ax + dx*t, qz = az + dz*t;
  return Math.hypot(px-qx, pz-qz);
}

var natureOn = true;
var natureGroup = new T.Group();
scene.add(natureGroup);

/* ====================================================================
 * A. 共有アセット(初回だけ生成し、城を跨いで使い回す)
 * ==================================================================== */
var NAT_SHARED = null;

/* 部品ジオメトリを1本の頂点カラー付きジオメトリへ手で結合する。
 * BufferGeometryUtils を読み込まずに済ませるための最小実装で、これに
 * よって 1樹種 = 1 InstancedMesh = 1ドローコールに収まる(幹と樹冠の
 * 色分けは頂点カラー、個体ごとの色ゆらぎは instanceColor が担う)。 */
function natMergeParts(parts){
  var pos = [], nor = [], colArr = [], idx = [], off = 0;
  parts.forEach(function(p){
    var g = p.geo;
    var gp = g.attributes.position, gn = g.attributes.normal, gi = g.index;
    var i;
    for (i=0;i<gp.count;i++){
      pos.push(gp.getX(i), gp.getY(i), gp.getZ(i));
      nor.push(gn.getX(i), gn.getY(i), gn.getZ(i));
      colArr.push(p.color.r, p.color.g, p.color.b);
    }
    if (gi){ for (i=0;i<gi.count;i++) idx.push(gi.getX(i) + off); }
    else { for (i=0;i<gp.count;i++) idx.push(i + off); }
    off += gp.count;
    g.dispose();
  });
  var geo = new T.BufferGeometry();
  geo.setIndex(idx);
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.setAttribute('normal', new T.Float32BufferAttribute(nor, 3));
  geo.setAttribute('color', new T.Float32BufferAttribute(colArr, 3));
  geo.computeBoundingSphere();
  return geo;
}
function natPart(geo, x, y, z, sx, sy, sz, hex){
  if (sx !== 1 || sy !== 1 || sz !== 1) geo.scale(sx, sy, sz);
  geo.translate(x, y, z);
  return { geo: geo, color: new T.Color(hex) };
}
/* ==== 空気遠近(aerial perspective)==================================
 * 【症状】中景〜遠景の木だけが手前と同じ鮮やかな緑のまま、背景の丘に
 * 貼り付けたシールのように浮く。
 *
 * 【調べた結果 — フォグが効いていないのではない】
 * 木のマテリアルは material.fog === true で、InstancedMesh + vertexColors
 * でも fog は正しく合成される。効いていないのは **木がフォグの届く距離
 * まで届いていないから**。城側の view.fogNear/fogFar は「城の全景が霞ま
 * ない」ように相当遠くへ置かれている:
 *
 *   マルボルク 昼/晴 実測 -- fog.near 1182 / fog.far 7313
 *     木の最遠(城中心から)   995m   -> フォグ寄与  0%
 *     最も内側の山並みリング   884m   -> フォグ寄与  0%
 *   ボディアム 昼/晴 実測 -- fog.near 187 / fog.far 1209
 *     木の最遠                 446m   -> フォグ寄与 25%
 *
 * つまり昼晴のマルボルクでは scene.fog は画面のどこにも効いていない。
 * それでも背景の丘が淡いのは、山並みリング(11-environment.js の
 * MOUNTAIN_RINGS / updateMountains)が「mountainColor を距離ごとに
 * fogColor へ mixToFog だけ混ぜた色」を焼き込んでいるため:
 *   リング実色  #88aea1 / #9bbbb3 / #afc8c6  (彩度 0.18 前後)
 *   木の描画色  #81b96a 前後                 (彩度 0.43)
 * この彩度差 0.18 vs 0.43 が、ユーザの言う「霧のかかり具合が違う」の
 * 正体。scene.fog を近づけると城本体まで霞むので触れない。
 *
 * 【対策】木にだけ、山並みが焼き込んでいるのと同じ淡さのランプを足す。
 * onBeforeCompile でフォグ合成の直前に (1) 距離に応じた脱色 (2) 遠景色
 * への寄せ を入れる。距離はフォグ用 varying(r128 は fogDepth、後の版は
 * vFogDepth と名前が変わる)を使わず、MeshPhongMaterial が必ず持つ
 * vViewPosition から取るのでバージョン差の影響を受けない。
 * ランプの near/far は最も内側の山並みリング半径 340*ENV_SCALE を基準に
 * するので、この層の方針どおり城ごとの定数は要らない。
 * ==================================================================== */
var NAT_HAZE_COLOR = new T.Color(0xcdddE3);
// x=near, y=far, z=最大量。初期値は natUpdateHaze() が毎フレーム上書きする
// (城が決まるまでのつなぎ。NAT.hazeNear/hazeFar/hazeMax の既定値と揃える)
var NAT_HAZE_RANGE = new T.Vector3(200, 1400, 0.58);
function natApplyAerialHaze(mat){
  mat.onBeforeCompile = function(shader){
    shader.uniforms.natHazeColor = { value: NAT_HAZE_COLOR };
    shader.uniforms.natHazeRange = { value: NAT_HAZE_RANGE };
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {',
        'uniform vec3 natHazeColor;\nuniform vec3 natHazeRange;\nvoid main() {')
      .replace('#include <fog_fragment>', [
        '\tfloat natH = smoothstep( natHazeRange.x, natHazeRange.y, length( vViewPosition ) ) * natHazeRange.z;',
        '\tfloat natLum = dot( gl_FragColor.rgb, vec3( 0.299, 0.587, 0.114 ) );',
        // 脱色を主、遠景色への寄せを従にする。寄せを強くしすぎると、木だけ
        // が青灰色になって「まだ霞んでいない鮮やかな草地の上に立つ枯れ木」
        // という逆の違和感が出る(地面プレーンには霧が届いていないため)。
        '\tgl_FragColor.rgb = mix( gl_FragColor.rgb, vec3( natLum ), natH * 0.90 );',
        '\tgl_FragColor.rgb = mix( gl_FragColor.rgb, natHazeColor, natH * 0.40 );',
        '#include <fog_fragment>'
      ].join('\n'));
  };
  // onBeforeCompile を付けたマテリアルは、同じ定義の素の Phong と
  // プログラムキャッシュを共有してしまわないよう別キーにしておく。
  mat.customProgramCacheKey = function(){ return 'natAerialHaze'; };
  return mat;
}
/* 遠景色とランプを毎フレーム時間帯/天候へ追従させる(uniform を差し替え
 * るのではなく、共有している Color / Vector3 の中身を書き換える)。 */
var _natHazeTmp = new T.Color();
function natUpdateHaze(){
  // 遠景色 = その時間帯の fogColor(空の霞)と mountainColor(遠い丘)の
  // 中間。山並みリングと同じ desaturate(skySatMul) も通すので、曇や雨で
  // 空が灰色へ寄れば遠景の木も同じだけ灰色へ寄る。
  // mountainColor 寄りにするほど遠景の木が山並みリングと同じ色味になる。
  _natHazeTmp.copy(CUR_TIME.fogColor).lerp(CUR_TIME.mountainColor, 0.55);
  desaturate(_natHazeTmp, CUR_WEATHER.skySatMul);
  NAT_HAZE_COLOR.copy(_natHazeTmp);
  // 曇/雨/雪は霞み始めを手前へ寄せる(scene.fog の fogFarMul と同じ向き)
  var wf = natLerp(1, CUR_WEATHER.fogFarMul, 0.55);
  var near = NAT.hazeNear, far = Math.max(near + 1, NAT.hazeFar * wf);
  NAT_HAZE_RANGE.set(near, far,
    natClamp(NAT.hazeMax + (1 - CUR_WEATHER.skySatMul) * 0.16, 0, 0.86));
}

/* 樹種: すべて「高さ1・根元 y=0」の単位空間で作る。実際の背丈は
 * インスタンス行列のスケールで与えるので、1本ごとの新規ジオメトリは
 * 一切生成しない。針葉樹2種 + 広葉樹2種。 */
function natBuildTreeSpecies(){
  var sp = [];
  // 1) トウヒ(針葉樹・暗色・円錐3段)
  sp.push({
    key: 'spruce', conifer: true,
    geo: natMergeParts([
      natPart(new T.CylinderGeometry(0.022, 0.042, 0.34, 6), 0, 0.17, 0, 1,1,1, 0x4a3a28),
      natPart(new T.ConeGeometry(0.200, 0.50, 7), 0, 0.35, 0, 1,1,1, 0x2c4526),
      natPart(new T.ConeGeometry(0.150, 0.42, 7), 0, 0.62, 0, 1,1,1, 0x33502c),
      natPart(new T.ConeGeometry(0.093, 0.34, 7), 0, 0.85, 0, 1,1,1, 0x395a31)
    ])
  });
  // 2) マツ(針葉樹・幹が高く傘状)
  sp.push({
    key: 'pine', conifer: true,
    geo: natMergeParts([
      natPart(new T.CylinderGeometry(0.026, 0.050, 0.66, 6), 0, 0.33, 0, 1,1,1, 0x5c4630),
      natPart(new T.ConeGeometry(0.215, 0.38, 8), 0, 0.76, 0, 1,1,1, 0x40602f),
      natPart(new T.ConeGeometry(0.135, 0.28, 8), 0, 0.92, 0, 1,1,1, 0x486a34)
    ])
  });
  // 3) オーク(広葉樹・丸い樹冠+こぶ)
  sp.push({
    key: 'oak', conifer: false,
    geo: natMergeParts([
      natPart(new T.CylinderGeometry(0.038, 0.068, 0.46, 6), 0, 0.23, 0, 1,1,1, 0x53412c),
      natPart(new T.SphereGeometry(0.30, 8, 6), 0, 0.68, 0, 1, 0.86, 1, 0x4c6d30),
      natPart(new T.SphereGeometry(0.19, 6, 5), 0.19, 0.53, 0.04, 1, 0.9, 1, 0x44632b),
      natPart(new T.SphereGeometry(0.16, 6, 5), -0.16, 0.60, -0.13, 1, 0.9, 1, 0x53763a)
    ])
  });
  // 4) ポプラ(広葉樹・細身で縦長)
  sp.push({
    key: 'poplar', conifer: false,
    geo: natMergeParts([
      natPart(new T.CylinderGeometry(0.020, 0.036, 0.58, 5), 0, 0.29, 0, 1,1,1, 0x7c7460),
      natPart(new T.SphereGeometry(0.175, 7, 6), 0, 0.70, 0, 1, 1.72, 1, 0x6b8a3c)
    ])
  });
  // Lambert は r128 で flatShading を持たない(コンソール警告になる)ため、
  // ローポリらしい面の切り替わりを出すのに shininess 0 の Phong を使う。
  var mat = natApplyAerialHaze(
    new T.MeshPhongMaterial({ vertexColors: true, flatShading: true, shininess: 0 }));
  sp.forEach(function(s){ s.mat = mat; });
  return sp;
}
/* ふわっとした雲の canvas テクスチャ。決定論的に配置した放射グラデの
 * 重ね塗りで、底が平らな積雲のシルエットを作る。 */
function natMakeCloudTexture(seed){
  var c = document.createElement('canvas');
  c.width = 256; c.height = 128;
  var ctx = c.getContext('2d');
  var rnd = natRng(seed);
  var i, puffs = 26;
  for (i=0;i<puffs;i++){
    var t = rnd()*2 - 1;                       // -1..1 (横位置)
    var px = 128 + t*100;
    var lift = (1 - Math.abs(t)*Math.abs(t));  // 中央ほど高く盛る
    var py = 92 - lift*(16 + rnd()*30);
    var r = 12 + lift*26 * (0.55 + rnd()*0.75);
    // 芯をしっかり出す(なだらかなグラデだけだと、遠景で巨大に引き伸ば
    // したとき「もやっとした霧の染み」にしか見えない)
    var g = ctx.createRadialGradient(px, py, 0, px, py, r);
    g.addColorStop(0,    'rgba(255,255,255,0.96)');
    g.addColorStop(0.55, 'rgba(255,255,255,0.62)');
    g.addColorStop(1,    'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath(); ctx.arc(px, py, r, 0, Math.PI*2); ctx.fill();
  }
  // 底面をなだらかに切り落として「浮いている雲」らしい平底にする
  ctx.globalCompositeOperation = 'destination-out';
  var fade = ctx.createLinearGradient(0, 86, 0, 116);
  fade.addColorStop(0, 'rgba(0,0,0,0)');
  fade.addColorStop(1, 'rgba(0,0,0,1)');
  ctx.fillStyle = fade;
  ctx.fillRect(0, 86, 256, 42);
  ctx.globalCompositeOperation = 'source-over';
  var tex = new T.CanvasTexture(c);
  tex.needsUpdate = true;
  return tex;
}
/* 鳥: 単位翼(付け根 x=0 から翼端 x=1)。左右2枚の板で V 字を作り、
 * rotation.z の逆位相で羽ばたかせる。 */
function natMakeWingGeometry(){
  var pos = [
     0.02, 0, -0.16,
     0.02, 0,  0.20,
     0.55, 0,  0.05,
     0.55, 0,  0.05,
     0.02, 0,  0.20,
     1.00, 0,  0.02,
     0.02, 0,  0.20,
     0.98, 0, -0.02,
     1.00, 0,  0.02
  ];
  var geo = new T.BufferGeometry();
  geo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
  geo.computeVertexNormals();
  return geo;
}
function natBuildShared(){
  if (NAT_SHARED) return NAT_SHARED;
  NAT_SHARED = {
    species: natBuildTreeSpecies(),
    cloudTex: [natMakeCloudTexture(11), natMakeCloudTexture(29), natMakeCloudTexture(53)],
    wingGeo: natMakeWingGeometry(),
    birdMat: new T.MeshBasicMaterial({ color: 0x24242a, side: T.DoubleSide, transparent: true, opacity: 0.92, fog: true }),
    lakeMat: new T.MeshPhongMaterial({ color: 0x2e5b66, transparent: true, opacity: 0.88, shininess: 90, specular: 0x9fd4e0 }),
    bedMat: new T.MeshLambertMaterial({ color: 0x33301f }),
    bankMat: new T.MeshLambertMaterial({ vertexColors: true })
  };
  return NAT_SHARED;
}

/* ====================================================================
 * B. 城の占有範囲・地形の自動導出
 * ==================================================================== */
var NAT = {
  seed: 0, ready: false,
  terrain: [], terrainTopY: 0, terrainRayLen: 1, terrainMaxR: 0,
  ex: null, exPad: 0, spanMax: 1, rFar: 0, treeScale: 1,
  hazeNear: 200, hazeFar: 1400, hazeMax: 0.62,
  waterBoxes: [], gateSegs: [], lakes: [], trees: [], instanced: [],
  buildMs: 0
};
var _natBox = new T.Box3();
var _natVec = new T.Vector3();

function natComputeFootprint(){
  var picks = (current && current.pickables) || [];
  var pMinX = Infinity, pMaxX = -Infinity, pMinZ = Infinity, pMaxZ = -Infinity;
  picks.forEach(function(p){
    var par = p.geometry.parameters;
    var hw = par.width/2, hd = par.depth/2;
    pMinX = Math.min(pMinX, p.position.x - hw); pMaxX = Math.max(pMaxX, p.position.x + hw);
    pMinZ = Math.min(pMinZ, p.position.z - hd); pMaxZ = Math.max(pMaxZ, p.position.z + hd);
  });
  if (!isFinite(pMinX)){ pMinX = -20; pMaxX = 20; pMinZ = -20; pMaxZ = 20; }
  var spanMax = Math.max(pMaxX - pMinX, pMaxZ - pMinZ);
  // 地面プレーンとみなす閾値: 城の代表寸法の 2.6 倍を超える「平たい」
  // メッシュ。全城で ground/field プレーンだけがここに落ちる。
  var flatThresh = spanMax * 2.6;

  var ex = { minX: pMinX, maxX: pMaxX, minZ: pMinZ, maxZ: pMaxZ };
  var terrain = [], waterBoxes = [];
  var tTop = -Infinity, tBot = Infinity, tMaxR = 0;
  current.group.updateMatrixWorld(true);
  current.group.traverse(function(o){
    if (!o.isMesh || !o.geometry || o.isSprite) return;
    if (!o.geometry.boundingBox) o.geometry.computeBoundingBox();
    if (!o.geometry.boundingBox) return;
    _natBox.copy(o.geometry.boundingBox).applyMatrix4(o.matrixWorld);
    var w = _natBox.max.x - _natBox.min.x, d = _natBox.max.z - _natBox.min.z;
    var h = _natBox.max.y - _natBox.min.y;
    var wide = Math.max(w, d);
    var mat0 = Array.isArray(o.material) ? o.material[0] : o.material;
    var isWater = !!(mat0 && mat0.transparent && mat0.opacity < 0.98);
    if (wide > flatThresh && h < wide * 0.35){
      // 広い平面 = 地面。ただし半透明(= 海/大きな水面)なら地面には
      // せず「水」として扱う -- 地面にすると木がその上に立ってしまう。
      if (isWater){
        waterBoxes.push({ minX:_natBox.min.x, maxX:_natBox.max.x, minZ:_natBox.min.z, maxZ:_natBox.max.z });
        return;
      }
      terrain.push(o);
      tTop = Math.max(tTop, _natBox.max.y); tBot = Math.min(tBot, _natBox.min.y);
      tMaxR = Math.max(tMaxR, Math.min(Math.min(-_natBox.min.x, _natBox.max.x),
                                       Math.min(-_natBox.min.z, _natBox.max.z)));
      return;
    }
    ex.minX = Math.min(ex.minX, _natBox.min.x); ex.maxX = Math.max(ex.maxX, _natBox.max.x);
    ex.minZ = Math.min(ex.minZ, _natBox.min.z); ex.maxZ = Math.max(ex.maxZ, _natBox.max.z);
    if (isWater){
      waterBoxes.push({ minX:_natBox.min.x, maxX:_natBox.max.x, minZ:_natBox.min.z, maxZ:_natBox.max.z });
    }
  });

  NAT.spanMax = spanMax;
  NAT.ex = ex;
  NAT.exPad = Math.max(4, spanMax * 0.05);
  NAT.terrain = terrain;
  NAT.terrainTopY = isFinite(tTop) ? tTop + 60 : 60;
  NAT.terrainRayLen = isFinite(tBot) ? (NAT.terrainTopY - tBot + 60) : 400;
  NAT.terrainMaxR = tMaxR;
  NAT.waterBoxes = waterBoxes;

  var exR = Math.hypot(Math.max(-ex.minX, ex.maxX), Math.max(-ex.minZ, ex.maxZ));
  var castleFogFar = FOG_FAR_SCALE * 320;   // その城の view.fogFar(10-scene.js 参照)
  // 霧の到達距離いっぱいまで木を伸ばす(最外周は霞んで「遠景の森」に
  // なる)。地面プレーンの外へは出さない。
  NAT.rFar = Math.min(tMaxR * 0.9, castleFogFar * 1.1,
                      Math.max(exR * 1.9, ZMAX * 2.2));
  NAT.treeScale = natClamp(Math.pow(ZMAX / 150, 0.45), 0.8, 2.4);

  // 空気遠近のランプ。「完全に霞んだ距離」の目安として、最も内側の
  // 山並みリングの半径(11-environment.js: 340 * ENV_SCALE)を使う ---
  // 遠景の木が溶け込むべき相手がまさにそのリングだから。木がリングより
  // 外まで伸びる城では rFar 側で伸ばす。
  var mtnR = 340 * ENV_SCALE;
  NAT.hazeNear = mtnR * 0.42;
  NAT.hazeFar  = Math.max(mtnR * 1.75, NAT.rFar * 1.40);
  NAT.hazeMax  = 0.58;

  // 住人が場外へ歩き去る経路(門の外側口 -> 消失点)を帯状に確保する
  var segs = [];
  var life = current.life;
  if (life && life.gates){
    life.gates.forEach(function(g){
      var outer = g.path[g.path.length-1];
      var vd = (g.vanishDist || 40) * 1.7;
      segs.push({ ax: outer.x, az: outer.z,
        bx: outer.x + g.outDir.x*vd, bz: outer.z + g.outDir.z*vd,
        w: Math.max(6, spanMax*0.03) });
    });
  }
  NAT.gateSegs = segs;
}

/* 地面高さ: TERRAIN(地面プレーンのみ)へ真上からレイキャスト。城ごとの
 * groundY / 起伏ノイズの位相を知らなくても正しく接地する。 */
var _natRay = new T.Raycaster();
var _natRayDir = new T.Vector3(0, -1, 0);
var _natRayOrg = new T.Vector3();
function natGroundY(x, z){
  if (!NAT.terrain.length) return null;
  _natRayOrg.set(x, NAT.terrainTopY, z);
  _natRay.set(_natRayOrg, _natRayDir);
  _natRay.near = 0; _natRay.far = NAT.terrainRayLen;
  var hits = _natRay.intersectObjects(NAT.terrain, false);
  return hits.length ? hits[0].point.y : null;
}
function natInExclusion(x, z, pad){
  var e = NAT.ex, p = pad || 0;
  return x > e.minX - p && x < e.maxX + p && z > e.minZ - p && z < e.maxZ + p;
}
function natInWater(x, z, pad){
  var i, p = pad || 0;
  for (i=0;i<NAT.waterBoxes.length;i++){
    var b = NAT.waterBoxes[i];
    if (x > b.minX - p && x < b.maxX + p && z > b.minZ - p && z < b.maxZ + p) return true;
  }
  return false;
}
function natOnGatePath(x, z, extra){
  var i;
  for (i=0;i<NAT.gateSegs.length;i++){
    var s = NAT.gateSegs[i];
    if (natSegDist(x, z, s.ax, s.az, s.bx, s.bz) < s.w + (extra||0)) return true;
  }
  return false;
}
function natInLake(x, z, extra){
  var i;
  for (i=0;i<NAT.lakes.length;i++){
    var L = NAT.lakes[i];
    if (Math.hypot(x - L.cx, z - L.cz) < L.rOuter + (extra||0)) return true;
  }
  return false;
}
// 自然物を置いてよい場所か(城・水面・門の経路・湖の内外判定をまとめて)
function natSpotOk(x, z, clearance){
  var c = clearance || 0;
  if (natInExclusion(x, z, NAT.exPad + c)) return false;
  if (natInWater(x, z, c + NAT.spanMax*0.01)) return false;
  if (natOnGatePath(x, z, c)) return false;
  return true;
}

/* ====================================================================
 * C. 湖・池
 * ==================================================================== */
var NAT_LAKE_SEG = 40, NAT_LAKE_STEP = 5;
/* 岸辺は 01-moat.js の buildBankRamp と同じ流儀 -- 外周(乾いた土)から
 * 水際(濡れた泥)へ頂点カラーを smoothstep で繋いだリング。ただし外周
 * 側の Y は「その角度で実測した地面の高さ」を使うので、起伏のある地面
 * にも段差なく馴染む。水面は周囲地面の最高点よりわずかに上に張り、湖底
 * の不透明ディスクで下の草地を隠す(地面を貫通させない)。 */
function natBuildLake(cx, cz, R, rnd){
  var i, j;
  var ph1 = rnd()*6.283, ph2 = rnd()*6.283, ph3 = rnd()*6.283;
  var ang = [], rIn = [], rOut = [], gH = [];
  var maxG = -Infinity;
  for (i=0;i<=NAT_LAKE_SEG;i++){
    var a = i/NAT_LAKE_SEG * Math.PI*2;
    var shape = 1 + 0.17*Math.sin(a*2 + ph1) + 0.10*Math.sin(a*3 + ph2) + 0.06*Math.sin(a*5 + ph3);
    var ri = R * shape;
    var ro = ri * 1.30;
    var gy = natGroundY(cx + Math.cos(a)*ro, cz + Math.sin(a)*ro);
    if (gy === null) return null;                 // 地面の外にはみ出す -> 作らない
    ang.push(a); rIn.push(ri); rOut.push(ro); gH.push(gy);
    if (gy > maxG) maxG = gy;
  }
  // 湖の内側の最高地面も測って水没させる(中心+中間リング)
  for (i=0;i<12;i++){
    var a2 = i/12 * Math.PI*2;
    var gy2 = natGroundY(cx + Math.cos(a2)*R*0.55, cz + Math.sin(a2)*R*0.55);
    if (gy2 === null) return null;
    if (gy2 > maxG) maxG = gy2;
  }
  var gc = natGroundY(cx, cz);
  if (gc === null) return null;
  if (gc > maxG) maxG = gc;

  var clear = 0.35 + NAT.spanMax * 0.002;
  var waterY = maxG + clear;
  var bedY = waterY - clear*0.8;                  // 湖底は必ず地面より上

  var colTop = new T.Color(0x8d7c52), colMid = new T.Color(0x6a5838), colEdge = new T.Color(0x3a2e1a);
  var pos = [], colArr = [], idx = [];
  var stride = NAT_LAKE_STEP + 1;
  var tmp = new T.Color();
  for (i=0;i<=NAT_LAKE_SEG;i++){
    var ca = Math.cos(ang[i]), sa = Math.sin(ang[i]);
    for (j=0;j<=NAT_LAKE_STEP;j++){
      var u = j/NAT_LAKE_STEP, eu = smoothstep01(0,1,u);
      var rr = rOut[i] + (rIn[i] - rOut[i])*eu;
      var yy = gH[i] + (bedY - gH[i])*eu;
      pos.push(cx + ca*rr, yy, cz + sa*rr);
      tmp.copy(colTop).lerp(colMid, smoothstep01(0,0.7,u));
      tmp.lerp(colEdge, smoothstep01(0.72,1,u));
      colArr.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (i=0;i<NAT_LAKE_SEG;i++){
    for (j=0;j<NAT_LAKE_STEP;j++){
      var a0 = i*stride+j, b0 = (i+1)*stride+j, c0 = (i+1)*stride+j+1, d0 = i*stride+j+1;
      idx.push(a0,b0,d0, b0,c0,d0);
    }
  }
  var bankGeo = new T.BufferGeometry();
  bankGeo.setIndex(idx);
  bankGeo.setAttribute('position', new T.Float32BufferAttribute(pos,3));
  bankGeo.setAttribute('color', new T.Float32BufferAttribute(colArr,3));
  bankGeo.computeVertexNormals();
  var bank = new T.Mesh(bankGeo, NAT_SHARED.bankMat);
  bank.receiveShadow = true;

  // 湖底(不透明)と水面(半透明)の扇形ディスク
  function fan(y, shrink){
    var ii = [];
    var p = [cx, y, cz];   // 中心 + 岸のリング(不規則な湖形をそのまま使う)
    for (i=0;i<=NAT_LAKE_SEG;i++){
      var r2 = rIn[i]*shrink;
      p.push(cx + Math.cos(ang[i])*r2, y, cz + Math.sin(ang[i])*r2);
    }
    for (i=1;i<=NAT_LAKE_SEG;i++) ii.push(0, i+1, i);
    var g = new T.BufferGeometry();
    g.setIndex(ii);
    g.setAttribute('position', new T.Float32BufferAttribute(p,3));
    g.computeVertexNormals();
    return g;
  }
  var bedGeo = fan(bedY, 1.001);
  var bed = new T.Mesh(bedGeo, NAT_SHARED.bedMat);
  bed.receiveShadow = true;
  var watGeo = fan(waterY, 0.998);
  // 水面のマテリアルは湖ごとに複製する。堀と違って湖は中景〜遠景に置か
  // れるので、木と同じ空気遠近を「その湖までの距離」で個別にかけたい。
  var watMat = NAT_SHARED.lakeMat.clone();
  watMat.color.copy(CUR_TIME.waterColor);   // 最初の updateNature までの1フレーム分
  var water = new T.Mesh(watGeo, watMat);

  natureGroup.add(bank); natureGroup.add(bed); natureGroup.add(water);
  var rOutMax = 0;
  for (i=0;i<rOut.length;i++) rOutMax = Math.max(rOutMax, rOut[i]);
  return { cx:cx, cz:cz, y:waterY, rOuter:rOutMax, mat:watMat, meshes:[bank, bed, water] };
}

/* ====================================================================
 * D. 木・林・森
 * ==================================================================== */
function natPlaceTrees(){
  var rnd = natRng(NAT.seed ^ 0x9e3779b9);
  var rFar = NAT.rFar;
  if (!(rFar > 1)) return;
  var scale = NAT.treeScale;
  // 木は静止物なので reducedMotion でも大きくは減らさない(減らすのは
  // 雲の流れ・羽ばたきの方。ここは生成時のレイキャスト量の配慮のみ)
  var budget = reducedMotion ? 420 : 720;
  var minClear = 2.5 * scale;
  var picks = [];   // { x,y,z,sp,h,w,rot }

  function accept(x, z, spIdx, sizeMul){
    if (picks.length >= budget) return false;
    if (!natSpotOk(x, z, minClear)) return false;
    if (natInLake(x, z, minClear + 1.5*scale)) return false;
    var y = natGroundY(x, z);
    if (y === null) return false;
    // 座標ハッシュで一本ごとの背丈・傾きを決める(位置が同じなら同じ姿)
    var n = hashNoise2(x*0.37, z*0.41);
    var h = (8.6 + 4.4*(0.5 + 0.5*Math.sin(n*2.1))) * scale * sizeMul;
    var w = h * (0.86 + 0.28*(0.5 + 0.5*Math.cos(n*3.7)));
    picks.push({ x:x, y:y, z:z, sp:spIdx, h:h, w:w, rot: n*3.1 });
    return true;
  }

  // --- 林/森: 木の塊。遠いほど大きく密にして「森」に見せる ---------
  var groveN = 8 + Math.round(rFar / Math.max(60, NAT.spanMax*0.9));
  groveN = Math.min(groveN, 16);
  var gi, attempt;
  for (gi=0; gi<groveN; gi++){
    var gx = 0, gz = 0, ok = false;
    for (attempt=0; attempt<40; attempt++){
      var gt = 0.34 + 0.64*rnd();
      // 方位は黄金角ベース + ゆらぎ。完全な乱数だと林が一方向へ偏り、
      // 回り込んだときに何もない四半分ができてしまう。
      var ga = gi*2.399963 + rnd()*0.9 + attempt*0.37;
      gx = Math.cos(ga)*rFar*gt; gz = Math.sin(ga)*rFar*gt;
      if (natSpotOk(gx, gz, minClear*3) && !natInLake(gx, gz, rFar*0.09)){ ok = true; break; }
    }
    if (!ok) continue;
    var far01 = natClamp(Math.hypot(gx, gz) / rFar, 0, 1);
    var gr = rFar * (0.045 + 0.075*rnd()) * (0.7 + 0.6*far01);
    var count = Math.round(natLerp(16, 46, far01) * (0.7 + 0.6*rnd()));
    // 林ごとに主樹種を決め、3割だけ別種を混ぜる(単調な植林に見せない)
    var main = Math.floor(rnd()*4) % 4;
    var sub = (main + 1 + Math.floor(rnd()*3)) % 4;
    var k;
    for (k=0;k<count;k++){
      var rr = gr * Math.sqrt(rnd());
      var aa = rnd()*Math.PI*2;
      var tx = gx + Math.cos(aa)*rr, tz = gz + Math.sin(aa)*rr;
      // 中心ほど背が高い塊にすると、林が丸いドーム状のシルエットになる
      var sizeMul = 0.82 + 0.35*(1 - rr/Math.max(gr,0.001)) + 0.2*rnd();
      accept(tx, tz, rnd() < 0.7 ? main : sub, sizeMul);
    }
  }
  // --- 単木/疎林: 近景の抜けを埋める ------------------------------
  var singles = reducedMotion ? 90 : 150;
  for (gi=0; gi<singles; gi++){
    var sr = rFar * (0.12 + 0.88*Math.sqrt(rnd()));
    var sa2 = gi*2.399963 + rnd()*1.2;
    accept(Math.cos(sa2)*sr, Math.sin(sa2)*sr, Math.floor(rnd()*4)%4, 0.8 + 0.5*rnd());
  }

  // --- InstancedMesh 化(樹種ごとに1ドローコール) -----------------
  var dummy = new T.Object3D();
  var tint = new T.Color();
  var s;
  for (s=0; s<NAT_SHARED.species.length; s++){
    var list = picks.filter(function(p){ return p.sp === s; });
    if (!list.length) continue;
    var im = new T.InstancedMesh(NAT_SHARED.species[s].geo, NAT_SHARED.species[s].mat, list.length);
    im.instanceMatrix.setUsage(T.StaticDrawUsage);
    im.castShadow = true;
    im.receiveShadow = true;
    im.frustumCulled = false;   // インスタンスは原点から遠く広がるため
    var q;
    for (q=0;q<list.length;q++){
      var p = list[q];
      dummy.position.set(p.x, p.y, p.z);
      dummy.rotation.set(0, p.rot, 0);
      dummy.scale.set(p.w, p.h, p.w);
      dummy.updateMatrix();
      im.setMatrixAt(q, dummy.matrix);
      var v = hashNoise2(p.x*0.19, p.z*0.23);
      tint.setRGB(1 + 0.10*Math.sin(v*2.7), 1 + 0.13*Math.sin(v*1.3+1.1), 1 + 0.08*Math.cos(v*3.1));
      im.setColorAt(q, tint);
    }
    im.instanceMatrix.needsUpdate = true;
    if (im.instanceColor) im.instanceColor.needsUpdate = true;
    natureGroup.add(im);
    NAT.instanced.push(im);
  }
  NAT.trees = picks;
}

/* ====================================================================
 * E. 雲(常設プール。城ごとにレイアウトだけ組み直す)
 * ==================================================================== */
var NAT_CLOUD_MAX = reducedMotion ? 16 : 34;
var natClouds = [];
function natInitClouds(){
  if (natClouds.length) return;
  var i;
  for (i=0;i<NAT_CLOUD_MAX;i++){
    var mat = new T.SpriteMaterial({ map: NAT_SHARED.cloudTex[i % 3], transparent: true,
      depthWrite: false, opacity: 0, fog: false });
    var spr = new T.Sprite(mat);
    spr.renderOrder = -5;
    spr.frustumCulled = false;
    spr.visible = false;
    natureGroup.add(spr);
    natClouds.push({ spr: spr, mat: mat, a: 0, r: 0, alt: 0, w: 0, rank: 0, shade: 1, drift: 0 });
  }
}
function natLayoutClouds(){
  var rnd = natRng(NAT.seed ^ 0x51ed270b);
  var R = Math.max(ZMAX * 2.3, NAT.rFar * 1.25) * (0.75 + 0.25*ENV_SCALE);
  // far-clip の内側に収める(はみ出すと遠側の雲が切れて消える)
  R = Math.min(R, Math.max(ZMAX * 1.5, (camera.far - ZMAX) * 0.82));
  var A = ZMAX * 0.78;
  var i;
  for (i=0;i<natClouds.length;i++){
    var c = natClouds[i];
    // 方位は黄金角で刻む -- rank(=雲量に応じて出す順番)が i 順なので、
    // 角度まで乱数にすると晴天時に見える少数の雲が空の一角へ固まる。
    c.a = (i * 2.399963 + rnd()*0.5) % (Math.PI*2);
    c.r = R * (0.55 + 0.55*rnd());
    // 高度は「その雲までの距離 × 仰角」で決める。ZMAX だけから決めると、
    // 城が大きいほど雲の仰角が上がって画面上端の外へ出てしまう(ヴァンセ
    // ンヌで実測: 仰角 11-20 度 = 見える空の帯 0-11 度の外)。仰角 3〜9 度
    // に収まるようにすれば、どの城でも水平寄りの通常視点で空に入る。
    c.alt = A * 0.38 + c.r * (0.05 + 0.10*rnd());
    c.w = ZMAX * (0.55 + 0.80*rnd());
    c.rank = (i + 0.5) / natClouds.length;   // 雲量に応じて出す順番(決定論)
    c.shade = 0.86 + 0.26*rnd();
    c.drift = (0.0035 + 0.0035*rnd()) * (rnd() < 0.5 ? 1 : 1); // 全体が同方向へ流れる
  }
}
var _cloudCol = new T.Color();
var NAT_WHITE = new T.Color(0xffffff);
function natUpdateClouds(dt){
  // 天候の「厚さ」は sunMul から連続的に導く(clear 0 -> rain 1)
  var overcast = natClamp((1 - CUR_WEATHER.sunMul) / 0.62, 0, 1);
  var coverage = 0.46 + 0.52*overcast;
  var altMul = natLerp(1.0, 0.72, overcast);   // 曇/雨/雪では雲が低く垂れこめる
  // 色: その時間帯の霧色を土台に、太陽色を混ぜて朝/夕を染め、晴天ほど
  // 白へ寄せる。夜は霧色自体が暗いので自動的に暗い雲になる。
  // 夜だけは白へ寄せない(寄せると真っ暗な空に発光する塊が浮いて見える)。
  // 夕はむしろ夕日を受けて明るいので、windowGlow 0.4 の段階では暗くしない。
  var nightAmt = natClamp((CUR_TIME.windowGlow - 0.45) / 0.55, 0, 1);
  _cloudCol.copy(CUR_TIME.fogColor).lerp(CUR_TIME.sunColor, 0.34 * (1 - 0.55*nightAmt));
  _cloudCol.lerp(NAT_WHITE, 0.48 * (1 - overcast*0.6) * (1 - 0.85*nightAmt));
  _cloudCol.multiplyScalar((1 - 0.28*overcast) * (1 - 0.5*nightAmt));
  desaturate(_cloudCol, natClamp(CUR_WEATHER.skySatMul + 0.35, 0, 1));
  var i;
  for (i=0;i<natClouds.length;i++){
    var c = natClouds[i];
    var op = natClamp((coverage - c.rank) * 3.2, 0, 1) * (0.88 + 0.12*overcast);
    if (op <= 0.01){ c.spr.visible = false; continue; }
    c.spr.visible = true;
    if (!reducedMotion) c.a += c.drift * dt;
    var y = c.alt * altMul;
    c.spr.position.set(Math.cos(c.a)*c.r, y, Math.sin(c.a)*c.r);
    c.spr.scale.set(c.w, c.w*0.42, 1);
    c.mat.opacity = op;
    c.mat.color.copy(_cloudCol).multiplyScalar(c.shade);
  }
}

/* ====================================================================
 * F. 鳥(常設プール)
 * ==================================================================== */
var NAT_BIRD_MAX = reducedMotion ? 6 : 15;
var natBirds = [];
function natInitBirds(){
  if (natBirds.length) return;
  var i;
  for (i=0;i<NAT_BIRD_MAX;i++){
    var g = new T.Group();
    var wr = new T.Mesh(NAT_SHARED.wingGeo, NAT_SHARED.birdMat);
    var wl = new T.Mesh(NAT_SHARED.wingGeo, NAT_SHARED.birdMat);
    wl.scale.x = -1;
    g.add(wr); g.add(wl);
    g.frustumCulled = false;
    g.visible = false;
    natureGroup.add(g);
    natBirds.push({ obj: g, wr: wr, wl: wl, r: 0, a0: 0, w: 0, alt: 0, bob: 0, flap: 0, size: 1 });
  }
}
function natLayoutBirds(){
  var rnd = natRng(NAT.seed ^ 0x2545f491);
  var size = ZMAX * 0.012;               // 遠景の城でも見える大きさに自動調整
  var baseR = Math.max(ZMAX * 0.55, NAT.spanMax * 0.75);
  var i;
  for (i=0;i<natBirds.length;i++){
    var b = natBirds[i];
    b.size = size * (0.75 + 0.5*rnd());
    b.r = baseR * (0.45 + 0.85*rnd());
    b.a0 = (i * 2.399963 + rnd()*0.4) % (Math.PI*2);
    b.w = (0.055 + 0.05*rnd()) * (rnd() < 0.25 ? -1 : 1);   // 旋回の速さ/向き
    b.alt = ZMAX * (0.20 + 0.26*rnd());
    b.bob = ZMAX * 0.02 * (0.5 + rnd());
    b.flap = 5.5 + 3.5*rnd();
    b.obj.scale.setScalar(b.size);
  }
}
var _natT = 0;
function natUpdateBirds(dt){
  _natT += dt;
  // 夜は数を減らす(windowGlow: 昼0 / 夕0.4 / 夜1.0 を暗さの指標に使う)、
  // 強い雨でも減らす。時間帯の遷移中も連続的に増減する。
  var dark = CUR_TIME.windowGlow;
  var vis = natClamp(1 - dark*0.95, 0, 1) * natClamp(1 - CUR_WEATHER.rain*0.45, 0, 1);
  var shown = Math.round(natBirds.length * vis);
  var i;
  for (i=0;i<natBirds.length;i++){
    var b = natBirds[i];
    if (i >= shown){ b.obj.visible = false; continue; }
    b.obj.visible = true;
    var a = b.a0 + _natT * b.w;
    var x = Math.cos(a)*b.r, z = Math.sin(a)*b.r;
    var y = b.alt + Math.sin(_natT*0.5 + b.a0)*b.bob;
    b.obj.position.set(x, y, z);
    // 進行方向(接線)を向く。翼は +X/-X へ伸び、機首は +Z。
    b.obj.rotation.y = -a + (b.w > 0 ? Math.PI : 0);
    b.obj.rotation.z = (b.w > 0 ? -0.25 : 0.25);           // 旋回のバンク
    if (!reducedMotion){
      var f = Math.sin(_natT*b.flap + b.a0);
      b.wr.rotation.z = -0.18 + f*0.55;
      b.wl.rotation.z =  0.18 - f*0.55;
    } else {
      b.wr.rotation.z = -0.25; b.wl.rotation.z = 0.25;
    }
  }
}

/* ====================================================================
 * G. 生成 / 破棄 / 毎フレーム更新
 * ==================================================================== */
function disposeNature(){
  // 共有ジオメトリ/マテリアル(樹種・雲テクスチャ・鳥・湖マテリアル)は
  // 破棄しない -- 城を跨いで使い回す。城ごとの個体だけを確実に外す。
  NAT.instanced.forEach(function(im){
    natureGroup.remove(im);
    if (im.dispose) im.dispose();           // instanceMatrix / instanceColor
  });
  NAT.instanced.length = 0;
  NAT.lakes.forEach(function(L){
    L.meshes.forEach(function(m){
      natureGroup.remove(m);
      m.geometry.dispose();                 // 湖は城ごとに地形へ合わせて作る
    });
    if (L.mat) L.mat.dispose();             // 水面マテリアルも湖ごとの複製
  });
  NAT.lakes.length = 0;
  NAT.trees.length = 0;
  NAT.terrain.length = 0;
  NAT.waterBoxes.length = 0;
  NAT.gateSegs.length = 0;
  NAT.ready = false;
}
function regenerateNature(){
  disposeNature();
  natBuildShared();
  natInitClouds();
  natInitBirds();
  if (!current){ natureGroup.visible = false; return; }
  natureGroup.visible = natureOn;
  var t0 = (window.performance && performance.now) ? performance.now() : 0;
  var def = CASTLES[currentIdx] || {};
  NAT.seed = natStrSeed(def.id || ('castle' + currentIdx));

  natComputeFootprint();
  natLayoutClouds();
  natLayoutBirds();
  if (!natureOn){ NAT.ready = true; return; }

  if (NAT.terrain.length && NAT.rFar > 1){
    // 湖: 城の規模に応じて 1〜3 面。木より先に置いて、木側で避ける。
    var lrnd = natRng(NAT.seed ^ 0x68bc21eb);
    var lakeN = 1 + (NAT.rFar > 380 ? 1 : 0) + (NAT.rFar > 780 ? 1 : 0);
    var li, attempt;
    for (li=0; li<lakeN; li++){
      var R = NAT.rFar * (0.075 + 0.05*lrnd());
      for (attempt=0; attempt<26; attempt++){
        var la = lrnd()*Math.PI*2;
        var lr = NAT.rFar * (0.42 + 0.45*lrnd());
        var lx = Math.cos(la)*lr, lz = Math.sin(la)*lr;
        if (!natSpotOk(lx, lz, R*1.45)) continue;
        if (natInLake(lx, lz, R*2.2)) continue;
        var lake = natBuildLake(lx, lz, R, lrnd);
        if (lake){ NAT.lakes.push(lake); break; }
      }
    }
    natPlaceTrees();
  }
  NAT.buildMs = ((window.performance && performance.now) ? performance.now() : 0) - t0;
  NAT.ready = true;
}
var _natLakeCol = new T.Color();
function updateNature(dt){
  if (!natureOn || !NAT_SHARED) return;
  natUpdateHaze();
  natUpdateClouds(dt);
  natUpdateBirds(dt);
  // 湖の水面は水堀と同じ方針で時間帯の水色に追従させる。ただし湖は中景
  // 〜遠景にあるので、木と同じランプでカメラからの距離ぶんだけ脱色して
  // 遠景色へ寄せる(青が周囲の淡い色調から浮くのを防ぐ)。
  var i;
  for (i=0;i<NAT.lakes.length;i++){
    var L = NAT.lakes[i];
    var d = Math.hypot(camera.position.x - L.cx, camera.position.y - L.y,
                       camera.position.z - L.cz);
    var h = smoothstep01(NAT_HAZE_RANGE.x, NAT_HAZE_RANGE.y, d) * NAT_HAZE_RANGE.z;
    _natLakeCol.copy(CUR_TIME.waterColor);
    desaturate(_natLakeCol, 1 - h*0.60);
    _natLakeCol.lerp(NAT_HAZE_COLOR, h*0.25);
    L.mat.color.copy(_natLakeCol);
  }
}

/* ---- デバッグ用フック(本番UIには影響しない) --------------------- */
window.__setNature = function(on){
  natureOn = !!on;
  natureGroup.visible = natureOn;
  regenerateNature();
  if (typeof renderer !== 'undefined') renderer.render(scene, camera);
};
window.__natureStats = function(){
  return {
    on: natureOn, ready: NAT.ready, seed: NAT.seed, buildMs: Math.round(NAT.buildMs),
    spanMax: Math.round(NAT.spanMax), rFar: Math.round(NAT.rFar),
    treeScale: Math.round(NAT.treeScale*100)/100,
    exclusion: NAT.ex ? { minX: Math.round(NAT.ex.minX), maxX: Math.round(NAT.ex.maxX),
                          minZ: Math.round(NAT.ex.minZ), maxZ: Math.round(NAT.ex.maxZ) } : null,
    terrainMeshes: NAT.terrain.length, terrainMaxR: Math.round(NAT.terrainMaxR),
    waterBoxes: NAT.waterBoxes.length, gateSegs: NAT.gateSegs.length,
    trees: NAT.trees.length, instancedMeshes: NAT.instanced.length,
    lakes: NAT.lakes.map(function(L){
      return { x: Math.round(L.cx), z: Math.round(L.cz), r: Math.round(L.rOuter) }; }),
    clouds: natClouds.length, birds: natBirds.length,
    natureGroupChildren: natureGroup.children.length
  };
};
window.__natureHaze = function(){
  return { near: Math.round(NAT_HAZE_RANGE.x), far: Math.round(NAT_HAZE_RANGE.y),
    max: Math.round(NAT_HAZE_RANGE.z*100)/100, color: '#'+NAT_HAZE_COLOR.getHexString(),
    sceneFogNear: Math.round(scene.fog.near), sceneFogFar: Math.round(scene.fog.far) };
};
