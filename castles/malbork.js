"use strict";

/* ====================================================================
 * 1.7 Malbork Castle -- SURVEY-BASED reconstruction (Zamek w Malborku,
 * "実測版")
 * ====================================================================
 * Companion build to buildMalbork() in castles/malbork.js, which was
 * modelled from photographs and compressed the whole complex into a
 * ~140x288m footprint. That footprint is wrong: publicly documented
 * survey dimensions put the LOW CASTLE ALONE at 140x270m, with the High
 * + Middle + Low castle chain running roughly 430-600m north-south when
 * the dry ditch and outer moat gaps are included. This file rebuilds the
 * castle at the correct scale from a dimension sheet compiled from
 * medievalheritage.eu / burgenwelt.org / pl.wikipedia / zamkiobronne.pl /
 * zamek.malbork.pl (tagged [MH]/[BW]/[PL]/[ZO]/[ZM] below; confidence
 * ◎ = multiple sources agree, ○ = single specialist source, △ = no
 * surveyed number exists and the value here is an estimate -- every △
 * figure is called out explicitly in the comment next to it).
 *
 * Coordinate system (per the dimension sheet): X = east(+) / west(-),
 * Z = north(+) / south(-), origin = the HIGH CASTLE's own courtyard
 * centre. The High Castle is the SOUTHERNMOST block; going north you
 * cross the High<->Middle dry ditch, then the Middle Castle, then the
 * Middle<->Low moat, then the Low Castle (northernmost, largest). The
 * Nogat river runs along the west side of the whole complex.
 *
 * Same build() contract as every other castle in this viewer:
 * { group, fadeGroups, interiorGroup, info, pickables, windowMat,
 *   waterMats, labelGroup, life }. Two-tier cutaway, same convention as
 * buildVincennes()/buildMalbork(): the Low+Middle Castle shell fades
 * first (tier 'outer', the shared WALL_START/END + ROOF_START/END bands
 * every castle uses), then -- only once that is fully gone -- the High
 * Castle's own shell fades (tier 'inner', the shared DONJON_WALL_START/
 * END + DONJON_ROOF_START/END bands) to reveal its interior rooms.
 *
 * All top-level names in this FILE are just the one function below
 * (buildMalborkPlan) plus the registerCastle() call -- every helper is
 * declared *inside* buildMalborkPlan's closure (same per-file-local-
 * helper convention bodiam.js/vincennes.js/malbork.js already use), so
 * nothing here can collide with another castle file's globals. Local
 * helper names are still given an "mp" prefix as extra insurance per the
 * task brief, even though function-scoped names can never collide across
 * separate top-level functions in JS.
 * ==================================================================== */
function buildMalborkPlan(){
  var group = new T.Group();
  /* `root` holds every piece of the castle itself. The dimension sheet
   * pins the coordinate origin to the HIGH CASTLE courtyard centre, but
   * the High Castle is the complex's SOUTHERN END -- so with everything
   * authored in sheet coordinates the built model runs from z=-104
   * (Gdanisko) to z=+460 (Low Castle north wall), i.e. its centre of mass
   * sits ~178m north of the origin. The viewer's camera always orbits and
   * looks at the world origin (see 12-camera.js placeCamera / applyCastle
   * resetting orbTgt to 0,0), so authoring in raw sheet coordinates put
   * the castle almost entirely off-frame with the camera staring at empty
   * field. Everything castle-side therefore goes into `root`, which is
   * rigidly shifted by ZOFF (= -model centre) at the end of the build, so
   * the model is centred on the camera target while the code above still
   * reads in the sheet's own documented coordinates. The ground plane and
   * the shared background mountain rings stay centred on the world origin
   * (they are radially symmetric about it), so they are added to `group`
   * directly, NOT to `root`. Pickables (which live outside the group in
   * world space) and the `life` waypoints (residentGroup is parented to
   * the scene, not to the castle) get the same shift applied explicitly.
   * ---------------------------------------------------------------- */
  var root = new T.Group();
  group.add(root);
  var interiorGroup = new T.Group();
  root.add(interiorGroup);
  var fadeGroups = [];
  var pickables = [];

  function mpMakeFadeGroup(name, dir, isRoof, colorHex, tier){
    /* mpSurfMat は色から素材(brick / roof / stone)を選ぶ。宣言は
     * このファイルの下の方(テクスチャ工房の直後)だが、実際に呼ばれる
     * のは工房が組まれたあとなので巻き上げで足りる。 */
    var mat = mpSurfMat(colorHex);
    var g = new T.Group();
    g.name = name;
    root.add(g);
    var desc = { group:g, mat:mat, dir:dir, roof: !!isRoof, op:1, name:name, tier: tier || 'outer' };
    fadeGroups.push(desc);
    return desc;
  }
  function mpNorm(x,z){ var l = Math.hypot(x,z)||1; return {x:x/l, z:z/l}; }

  /* ---- palette: identical two-tone red-brick / terracotta scheme to
   * castles/malbork.js (deep red-brick walls, bright terracotta roofs) --
   * per task brief, the two builds must read as the same castle, only at
   * the corrected scale. ------------------------------------------- */
  /* Colours re-sampled off the reference photographs (Commons aerial +
   * the view north from the main tower). The previous scheme read as one
   * flat orange mass: walls 0x8a4636 and roofs 0xc1502f are the same hue,
   * with the roof simply more saturated, so at any distance the whole
   * complex melted into a single colour. In the photos the brickwork is a
   * muted warm red-BROWN and the pantile roofs are a lighter, slightly
   * pinker terracotta, with plenty of weathered/darker roof planes mixed
   * in -- so the walls are lifted+desaturated, the roof is pulled back
   * from orange, a SECOND darker roof tone is added for variety, and two
   * new tones are introduced purely for the gable decoration (light stone
   * step copings, near-black recessed blind niches) that gives Malbork's
   * skyline its actual texture. */
  /* Values are ~0.8x what a naive read of the photograph suggests. Sampling
   * the reference river shot gives sunlit brick around RGB(165,95,75) and
   * sunlit pantile around (175,85,65); feeding those in as base colours
   * came back off the renderer at roughly (235,150,120) once the scene's
   * key light and ambient fill were applied, i.e. a pastel salmon castle.
   * The base tones are therefore pre-divided so the LIT result lands on
   * the photographed colour instead of overshooting it. */
  /* ★テクスチャ導入にともなう再基準化。map は material.color に乗算
   * されるので、平均 0.76 のレンガテクスチャを載せると壁が 24% 暗くなる。
   * 工房のコメントどおり **色は色定数側で戻す**(テクスチャ側の mean を
   * 上げると、面より明るい石灰目地から先に 255 で頭を打ってレンガの読み
   * そのものが壊れる)。したがってレンガ系は 1/0.76 ≒ 1.32 …ではなく
   * 1.25 倍に留めてある -- 完全に戻すと今度は日向の目地(map ≒ 0.98)が
   * 昼の約1.95倍の露出を受けて赤チャンネルで飽和するため。実測で
   * chanClip が 0 のまま、変更前とほぼ同じ明るさに乗る値。 */
  var BRICK_WALL   = 0x87503b; // sunlit brick range wall (was 0x6c402f)
  var BRICK_WALL_V = 0x71402e; // deeper tone for towers / vertical accents (was 0x5a3325)
  var BRICK_DARK   = 0x50281c; // (was 0x402016)
  var TOWER_BRICK  = 0xae734c; // main tower: a visibly paler, yellower brick, (was 0x8b5c3d)
                               // exactly as it reads in the courtyard photo
  /* 瓦テクスチャは平均 0.87 なので 1.13 倍で元の明るさに戻す。 */
  var ROOF_COL     = 0x9e5136; // terracotta pantile (was 0x7d3f2c)
  var ROOF_COL2    = 0x7d4130; // weathered / older tile, mixed in for variety (was 0x633326)
  var NICHE_COL    = 0x31180f; // recessed blind-arcade niches (read as shadow)
  var WHITE_TRIM   = 0xb29f81; // light stone copings / string courses (was 0xa08f74). NOT a
                               // true white: at 0xd9cdb2 the step copings and
                               // pinnacles read as icing on every gable and
                               // the skyline turned into white sawteeth
  var GOLD_COL     = 0xc9a227;
  var WINDOW_COL   = 0x1c150e;
  var FLOOR_COL    = 0x9c8a74;
  var STUB_COL     = 0x776a58;
  var WOOD_COL     = 0x6b4f34;
  var METAL_COL    = 0x2a2925;
  var WATER_COL    = 0x3d5f62; // Nogat river / water moats
  var GRASS_COL    = 0x5c7a48;
  var GRASS_COL2   = 0x6c8a52;
  var DITCH_COL    = 0x59703c; // dry High<->Middle ditch (grass floor)
  var COBBLE_COL   = 0x7a7264; // darkened from 0x8f897a -- the Middle Castle's
                               // cobbled apron was reading as a sheet of pale
                               // concrete from above
  var TREE_TRUNK_COL = 0x5a4530;
  var TREE_LEAF_COL1 = 0x4f7038;
  var TREE_LEAF_COL2 = 0x3f6b3a;

  /* ================================================================ *
   * 手続き的テクスチャ -- 共有工房 CastleTex(js/02-texture.js)
   * ================================================================ *
   * 【この城だけ石ではなくレンガ】
   * マルボルクは世界最大のレンガ造建築で、外壁も塔も切石ではない。
   * 工房の既定 kind `stone` は「ランダム幅・ランダム位相の切石」なので、
   * blockW を細かくしてもレンガにはならない(小さい切石になるだけ)。
   * そこで js/02-texture.js に **opt-in の kind `brick`** を足した。
   * フランドル積み(長手と小口を交互、段ごとにちょうど半周期ずらす)、
   * 目地は面より明るい石灰目地、そして焼過ぎ小口(zendrówka)の斑。
   * `brick` を渡さない城には resolve() がキーごと生やさないので、他の
   * 4城のテクスチャ・キャッシュキー・出力は 1 ビットも変わらない。
   *
   * 【寸法の根拠】クロスターフォーマート(中世北ドイツ〜プロイセンの
   * 標準レンガ)は概ね 30 x 14 x 9cm。目地 1.5cm を足すと
   *   1段 = 10.6cm / 長手 = 31.5cm / 小口 = 15.5cm
   * になる。タイル 1.70m に 16 段(10.6cm)・4 周期(42.5cm = 長手
   * 28.3cm + 小口 14.2cm)で、実測写真の目地密度とほぼ一致する。
   * これ以上細かくすると遠景でモアレになり(この城は 500m 超なので
   * 引きの絵が主役)、これ以上粗くすると近景で切石に見える。
   *
   * 【屋根】急勾配の大屋根が支配的な城なので瓦の効果が大きい。工房の
   * `roof` は鉛葺きの立ちはぜ(縦のロール + タイル下端に横継ぎ手1本)
   * だが、瓦は 30cm ごとに段が来る。タイル実寸を詰めると低周波の汚れ
   * まで細かく繰り返してしまうので、代わりに **seams(横の継ぎ手の
   * 本数)** を工房側に足して 1.2m タイルに 4 本引いている。
   * 縦のロール 4 本と合わせて 30cm 角の瓦目になる。
   *
   * 【法線】nrmBoost はボディアム既定の 1.70 ではなく 1.40。レンガは
   * 目地が石積みの 3 倍近く密なので、同じ深さだと壁一面が凹凸だらけに
   * 見えて「編み籠」になる。実測でもこの城は最重量(drawCall 9千超)
   * なので、塗りつぶし負荷を無駄に増やさない意味もある。
   * ================================================================ */
  var TEXKIT = CastleTex.kit({
    id: 'malbork',
    nrmBoost: 1.40,
    brick: {
      /* ★実寸 10.6cm から 17cm へ「意図的に粗く」してある。理由は
       * 画面解像度で、考証を曲げたわけではない。このビューアの
       * マルボルクは view.zMin = 70m まで **しか** 寄れない(城が 500m
       * 級なので、それ以上寄ると全体が把握できない)。70m / 画角42度 /
       * 縦609px では 1px = 8.8cm、少し離れた棟なら 1px = 20cm を超える。
       * 実寸どおり 1段 10.6cm にすると 1段が 0.4-1.2px にしかならず、
       * ミップマップに完全に均されて「赤いざらつき」になる。実際、最初の
       * 焼き上げの近景クロップでは目地が1本も読めず、代わりに焼過ぎ小口
       * だけが斑点として残り、しかも斜めの壁面でモアレの山形が出た。
       * 1段 17cm(長手 37.8cm / 小口 18.9cm)まで粗くすると最寄りで
       * 約2px となり、横目地の縞が読めるようになる。実物の 1.6 倍だが、
       * 「石積みに見えないこと」の方が優先度が高い。
       * ※ courses は偶数であること -- 段ごとに半周期ずらすので、奇数だと
       *   タイル上下端で同じ位相の段が隣接して芋目地になる。 */
      metres: 1.70, courses: 10, periods: 3,   // 1段17cm / 周期56.7cm
      joint: 1.5,                              // 目地 3px = 段の 12%
      faceLum: [156, 62], darkP: 0.16,         // 斑が遠景でノイズにならない範囲
      nrm: 3.4, mean: 0.76
    },
    /* 瓦: 30cm ごとの段(seams) x 30cm ごとのロール。mean を既定 0.93
     * から下げてあるのは、屋根が画面を大きく占める城なので白飛び予算に
     * 直接効くため(下の「白飛び」節を参照)。 */
    roof: {
      /* 瓦も同じ理由で 30cm ではなく 40cm 角。屋根は常に斜めから見える
       * ぶん壁より投影が縮むので、壁のレンガより粗くしてちょうど釣り合う。*/
      metres: 1.2, px: 128, rolls: 3, seams: 3, nrm: 2.8,
      lead: '#c8c2b8',
      rollLo: 'rgba(30,26,20,0.30)', rollHi: 'rgba(255,255,255,0.24)',
      seam: 'rgba(28,20,14,0.46)',
      warpMul: [0.84, 0.30],
      tint: [1.0, 0.995, 0.985],
      mean: 0.87
    }
    /* stone / plaster / wood / pave / turf / straw / soil / cloth は
     * 既定のまま。既定のままにしておくと、パラメータが完全に一致する
     * 城どうしで工房がセットを共有する…わけではない(キャッシュキーは
     * 解決済みパラメータ全体の JSON なので brick / roof を変えた時点で
     * 別キーになる)が、値を触らないぶん見え方の責任範囲が狭くなる。 */
  });
  var TEX           = TEXKIT.tex;
  var texMat        = TEXKIT.texMat;
  var applyWorldUVs = TEXKIT.applyWorldUVs;

  /* 色から素材を引く。mpMakeFadeGroup / mpPlainGroup / mpGableRoof は
   * どれも「色だけ」を受け取る設計なので、素材の割り当ても色で決める。
   * isRoof フラグは使えない -- 破風(mpSteppedGable)と小塔は「屋根と
   * 一緒に消える」ために isRoof:true で作られているが、実体はレンガ。 */
  function mpKindFor(colorHex){
    if (colorHex === ROOF_COL || colorHex === ROOF_COL2) return 'roof';
    if (colorHex === WHITE_TRIM) return 'stone';    // 石の胴蛇腹・笠石
    if (colorHex === NICHE_COL)  return null;       // 影にしか見えない窪み
    return 'brick';
  }
  function mpSurfMat(colorHex, side){
    var kind = mpKindFor(colorHex);
    if (!kind) return new T.MeshLambertMaterial({ color: colorHex, side: side || T.FrontSide });
    /* 屋根の法線は壁より浅く。瓦の山は 1cm ではなく 3cm 級だが、屋根は
     * 常に斜めから見えるので同じ深さだと過剰に立つ。 */
    return texMat(colorHex, kind, { nrm: (kind === 'roof' ? 0.85 : 1.0), side: side });
  }

  var windowMat  = new T.MeshLambertMaterial({ color: WINDOW_COL });
  var floorMat   = texMat(FLOOR_COL, 'pave', { nrm: 0.9 });
  var stubMat    = texMat(STUB_COL, 'plaster', { nrm: 0.55, side: T.DoubleSide });
  var woodMat    = texMat(WOOD_COL, 'wood', { nrm: 0.8 });
  var metalMat   = new T.MeshLambertMaterial({ color: METAL_COL });
  var grassMat   = texMat(GRASS_COL, 'turf');
  var trimMat    = texMat(WHITE_TRIM, 'stone', { nrm: 0.7 });
  var goldMat    = new T.MeshLambertMaterial({ color: GOLD_COL });
  var darkWoodMat= texMat(0x2a1c14, 'wood', { nrm: 0.6 });
  var stoneDarkMat = texMat(BRICK_DARK, 'brick', { nrm: 0.8 });
  var ditchMat   = texMat(DITCH_COL, 'turf');
  /* Water: shininess/specular pulled WAY down (was 85 / 0x9fd4e0). With
   * the old values the single directional light -- especially the low,
   * cold moon at time=night -- laid one enormous unbroken specular streak
   * along the 900m-long Nogat plane, so the river read as a lit runway
   * rather than water. A low-gloss, dark-blue specular keeps a hint of
   * sheen in daylight without the night-time blow-out. */
  var riverMat   = new T.MeshPhongMaterial({ color: WATER_COL, transparent:true, opacity:0.9, shininess:24, specular:0x33454b });
  var moatWaterMat = new T.MeshPhongMaterial({ color: WATER_COL, transparent:true, opacity:0.9, shininess:26, specular:0x36484e });
  var treeTrunkMat = new T.MeshLambertMaterial({ color: TREE_TRUNK_COL });
  var treeLeafMat1 = new T.MeshLambertMaterial({ color: TREE_LEAF_COL1 });
  var treeLeafMat2 = new T.MeshLambertMaterial({ color: TREE_LEAF_COL2 });
  var cobbleMat  = texMat(COBBLE_COL, 'pave', { nrm: 1.0 });
  /* Plain (non-fadeGroup) decoration materials. Wall-attached ornament --
   * plinth courses, blind-arcade pilasters, string courses -- deliberately
   * uses these rather than a fadeGroup material: a fadeGroup's material
   * opacity is driven by THAT group's own fade curve, so borrowing e.g. a
   * roof-tier material for a wall-mounted pilaster would make the
   * pilasters dissolve off a wall that is still standing. Same convention
   * mpWingWall already uses for its trim band. */
  var nicheMat   = new T.MeshLambertMaterial({ color: NICHE_COL });

  /* ---- INTERIOR palette. Declared up here (rather than inside the
   * interior fit-out IIFE near the bottom of the file) because three of
   * the room fittings that already existed -- the Great Refectory's
   * granite columns, the church's nave piers, the High Castle
   * refectory's piers -- are built inline with the plan above and want
   * the same stone as the fit-out that now surrounds them. Colours read
   * off the two Great Refectory reference photographs (Commons
   * "Malbork Wielki Refektarz"): near-black granite shafts with pale
   * stone bases/capitals, dark red-brown ribs, whitewashed webbing, and
   * a red clay tile floor. ---------------------------------------- */
  var GRANITE_COL = 0x3a3536; // Baltic granite monolith shafts
  var RIB_COL     = 0x6b4436; // vault ribs (dark red-brown in the photos)
  /* whitewash, pulled well down from a naive 0xd8cfbc: the interior
   * dados and wall responds are seen against dark red brick and, at
   * 0x9d9280 and above, read as a white picket fence ringing every
   * opened room instead of as plastered masonry. */
  var PLASTER_COL = 0x8a8070;
  var TILE_COL    = 0x74463a; // red clay floor tile
  var FLAG_COL    = 0x877c6c; // stone flag floor
  var EARTH_COL   = 0x6a5942; // packed-earth floor (service ranges)
  var graniteMat = texMat(GRANITE_COL, 'stone', { nrm: 0.5 });
  var ribMat     = texMat(RIB_COL, 'brick', { nrm: 0.5 });     // 迫石もレンガ
  var plasterMat = texMat(PLASTER_COL, 'plaster', { nrm: 0.6, side: T.DoubleSide });
  var tileMat    = texMat(TILE_COL, 'pave', { nrm: 0.8, density: 1/1.2 }); // 赤い敷瓦(小割)
  var flagMat    = texMat(FLAG_COL, 'pave', { nrm: 0.9 });
  var earthMat   = texMat(EARTH_COL, 'soil', { nrm: 0.8 });

  /* ================================================================ *
   * 毎フレーム更新のハブ(煙 / 旗 / 水面が相乗り)
   * ================================================================ *
   * 90-main.js のフレームループには城ごとのフックが無い。ボディアムと
   * 同じ手を使う -- frustumCulled=false の退化三角形を1つだけ「時計」
   * として置き、その onBeforeRender からまとめて更新する(追加
   * drawCall は 1、面積 0 なので 1 画素も塗らない)。
   * 更新はすべて「絶対時刻の純関数」。ポストFXが1フレームに複数回
   * シーンを描いても二重に進まない。 */
  var ANIM = [];
  function mpNowSec(){
    return (typeof performance !== 'undefined' && performance.now
            ? performance.now() : Date.now()) / 1000;
  }
  function mpEnvState(){
    var glow = 0, rain = 0, snow = 0, sunMul = 1;
    if (typeof CUR_TIME !== 'undefined' && CUR_TIME){ glow = CUR_TIME.windowGlow || 0; }
    if (typeof CUR_WEATHER !== 'undefined' && CUR_WEATHER){
      rain = CUR_WEATHER.rain || 0; snow = CUR_WEATHER.snow || 0;
      sunMul = CUR_WEATHER.sunMul != null ? CUR_WEATHER.sunMul : 1;
    }
    return { glow: glow, rain: rain, snow: snow, sunMul: sunMul };
  }
  (function mpClock(){
    var tick = new T.Mesh(new T.BufferGeometry(),
      new T.MeshBasicMaterial({ depthWrite:false, depthTest:false }));
    tick.geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(9), 3));
    tick.frustumCulled = false;
    /* transparent にしない -- three は不透明キューを先に描くので、
     * renderOrder -1000 と合わせて「このフレームで最初に呼ばれる」ことが
     * 保証され、旗(不透明メッシュ)も同じフレーム内で更新後に描かれる。*/
    tick.renderOrder = -1000;
    tick.onBeforeRender = function(){
      var t = mpNowSec(), e = mpEnvState();
      for (var i=0;i<ANIM.length;i++) ANIM[i](t, e);
    };
    group.add(tick);
  })();

  /* ---- 煙突の煙 ----------------------------------------------------
   * この城にはパン焼き所(炉2基)・鍛冶場・厨房・大食堂・施療院・
   * 宮殿の暖炉があり、煙突はすでに9本立っている。スプライト1枚 =
   * 1 drawCall なので煙突あたり 4-6 枚に抑える。
   * fg(煙突が属するフェードグループ)が消えているあいだは煙も消す。*/
  var MP_WIND = { x: 0.72, z: 0.66 };            // 南西からの緩い風
  function mpSmokePlume(fg, x, y0, z, opt){
    opt = opt || {};
    var n     = opt.count != null ? opt.count : 5;
    var rise  = opt.rise  != null ? opt.rise  : 20.0;
    var speed = opt.speed != null ? opt.speed : 0.12;
    var base  = opt.base  != null ? opt.base  : 0.45;
    var g = new T.Group();
    g.position.set(x, y0, z);
    (fg ? fg.group : root).add(g);
    var puffs = [];
    for (var i=0;i<n;i++){
      var mat = new T.SpriteMaterial({ map: TEX.smoke, color: 0xcfcac1,
        transparent: true, depthWrite: false, opacity: 0, fog: true });
      var s = new T.Sprite(mat);
      s.renderOrder = 5;
      s.visible = false;
      g.add(s);
      puffs.push({ s: s, ph: i/n + (i*0.137) % 0.1 });
    }
    ANIM.push(function(t, e){
      var amt  = Math.min(1.0, 0.82 + e.glow*0.18 + e.rain*0.16 + e.snow*0.12);
      var wind = 1 + e.rain*0.9 + e.snow*0.35;
      /* 視距離が長いぶん濃度も上げる(1.5倍)。上げすぎると昼の絵で
       * 白い雲が城に貼り付くので、実測しながらここで止めてある。 */
      var op0  = base * 1.5 * amt * (fg ? fg.op : 1);
      // 昼 0x757068(空より暗い)-> 夜 0xb4afa5(淡い)
      var cr = 0.395 + (0.706-0.395)*e.glow;
      var cg = 0.377 + (0.686-0.377)*e.glow;
      var cb = 0.349 + (0.647-0.349)*e.glow;
      if (fg && (!fg.group.visible || fg.op < 0.15)) op0 = 0;
      for (var i=0;i<puffs.length;i++){
        var p = puffs[i];
        var k = (t*speed + p.ph) % 1;
        var op = op0 * Math.min(1, k*5) * Math.pow(1-k, 1.30);
        if (op < 0.012){ p.s.visible = false; continue; }
        var drift = wind * (0.20 + 1.6*k*k);
        var climb = Math.pow(k, 1.35);
        p.s.position.set(
          Math.sin(t*0.55 + p.ph*6.28)*0.30*k + MP_WIND.x*drift,
          climb*rise,
          Math.cos(t*0.41 + p.ph*5.13)*0.30*k + MP_WIND.z*drift
        );
        /* 粒の大きさ。ボディアム(1.45 + k*5.0)より一回り大きい --
         * この城は 300-680m から見るので、堀の城と同じ寸法だと数画素に
         * しかならず、実測で opacity 0.25 の粒が背景に埋もれて 1本も
         * 見えなかった。 */
        var sc = 3.2 + k*11.0;
        p.s.scale.set(sc, sc, 1);
        p.s.material.opacity = op;
        p.s.material.color.setRGB(cr, cg, cb);
        p.s.visible = true;
      }
    });
    return g;
  }

  /* ---- 旗 ----------------------------------------------------------
   * ドイツ騎士修道会の城なので旗は自然。板を 14x7 分割し、竿からの
   * 距離の2乗で振幅を増やす進行波(位相の違う2波の重ね合わせ)。
   * 布は影を落とさない -- シャドウマップの描画では onBeforeRender が
   * 呼ばれず、1フレーム前の頂点で影が焼かれてちらつくため。 */
  function mpFlag(fg, x, z, baseY, opt){
    opt = opt || {};
    var poleH = opt.poleH != null ? opt.poleH : 6.0;
    var pole = mkCyl(0.10, 0.13, poleH, 6, metalMat);
    place(pole, x, baseY + poleH/2, z);
    fg.group.add(pole);
    var knob = mkCyl(0.19, 0.19, 0.19, 6, goldMat);
    place(knob, x, baseY + poleH + 0.10, z);
    fg.group.add(knob);

    var W = opt.w != null ? opt.w : 3.6, H = opt.h != null ? opt.h : 2.3;
    var geo = new T.PlaneGeometry(W, H, 14, 7);
    var mat = new T.MeshLambertMaterial({ map: TEX.flag, side: T.DoubleSide });
    var flag = new T.Mesh(geo, mat);
    flag.castShadow = false; flag.receiveShadow = false;
    var ry = opt.ry || 0, co = Math.cos(ry), si = Math.sin(ry);
    flag.position.set(x + (W/2 + 0.06)*co, baseY + poleH - 0.35 - H/2, z - (W/2 + 0.06)*si);
    flag.rotation.y = ry;
    fg.group.add(flag);

    var pos = geo.attributes.position;
    var base = new Float32Array(pos.array);
    var seed = opt.seed || 0;
    ANIM.push(function(t, e){
      if (!fg.group.visible || !flag.visible) return;
      var gust = 0.78 + 0.34*Math.sin(t*0.31 + seed) + 0.16*Math.sin(t*0.83 + seed*2.1);
      var strength = gust * (1 + e.rain*0.55 + e.snow*0.2);
      var sp = 3.1 * (1 + e.rain*0.4);
      var arr = pos.array;
      for (var i=0;i<pos.count;i++){
        var bx = base[i*3], by = base[i*3+1];
        var u = (bx + W/2) / W;                  // 0 = 竿側、1 = 吹き流し端
        var amp = u*u * 0.52 * strength;
        var ph = u*4.6 - t*sp + by*1.05 + seed;
        var w1 = Math.sin(ph), w2 = Math.sin(ph*0.57 + 1.7);
        arr[i*3+2] = w1*amp + w2*amp*0.42;
        arr[i*3]   = bx - u*amp*0.30;
        arr[i*3+1] = by + w2*amp*0.16;
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    });
    return flag;
  }

  /* -------------------------------------------------------------- *
   * local helpers (per-file-local convention, see header)
   * -------------------------------------------------------------- */
  function mpAddCrenellations(target, mat, cx, cz, length, ry, topY, thickness, merlonH){
    var mh = merlonH || 1.0, merlonW = 1.3, gapW = 1.15, mt = thickness*0.72;
    var period = merlonW + gapW;
    var count = Math.max(1, Math.floor(length/period));
    var start = -(count*period)/2 + merlonW/2;
    var co = Math.cos(ry), si = Math.sin(ry);
    for (var i=0;i<count;i++){
      var lx = start + i*period;
      var wx = cx + lx*co, wz = cz - lx*si;
      var m = mkBox(merlonW, mh, mt, mat);
      place(m, wx, topY + mh/2, wz, ry);
      target.add(m);
    }
  }
  function mpLeanSlope(mat, spanAxis, spanA, spanB, outerCoord, innerCoord, outerY, innerY){
    var run = outerCoord - innerCoord, rise = outerY - innerY;
    var slant = Math.hypot(run, rise);
    var spanLen = Math.abs(spanB - spanA) + 1.2;
    var th = 0.4;
    var geo = spanAxis === 'x'
      ? new T.BoxGeometry(spanLen, th, slant)
      : new T.BoxGeometry(slant, th, spanLen);
    var mesh = new T.Mesh(geo, mat);
    var midOI = (outerCoord+innerCoord)/2, midY = (outerY+innerY)/2, midSpan = (spanA+spanB)/2;
    if (spanAxis === 'x'){
      mesh.position.set(midSpan, midY, midOI);
      mesh.rotation.x = (run > 0 ? -Math.atan2(rise,Math.abs(run)) : Math.atan2(rise,Math.abs(run)));
    } else {
      mesh.position.set(midOI, midY, midSpan);
      mesh.rotation.z = (run > 0 ? Math.atan2(rise,Math.abs(run)) : -Math.atan2(rise,Math.abs(run)));
    }
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }
  /* Gabled roof. `ends` (default true) draws the flat triangular gable
   * infill at each end -- pass false when a STEPPED GABLE (mpSteppedGable
   * below) is going to close that end instead, so the two don't z-fight.
   * `ends` may also be the string 'a' / 'b' to close only one end. */
  function mpGableRoof(target, mat, axis, cx, cz, spanA, spanB, halfWidth, eaveY, ridgeRise, ends){
    var ridgeY = eaveY + ridgeRise;
    if (ends === undefined) ends = true;
    if (axis === 'x'){
      target.add(mpLeanSlope(mat, 'x', spanA, spanB, cz-halfWidth, cz, eaveY, ridgeY));
      target.add(mpLeanSlope(mat, 'x', spanA, spanB, cz+halfWidth, cz, eaveY, ridgeY));
    } else {
      target.add(mpLeanSlope(mat, 'z', spanA, spanB, cx-halfWidth, cx, eaveY, ridgeY));
      target.add(mpLeanSlope(mat, 'z', spanA, spanB, cx+halfWidth, cx, eaveY, ridgeY));
    }
    if (ends === false) return;
    var shape = new T.Shape();
    shape.moveTo(-halfWidth,0); shape.lineTo(halfWidth,0); shape.lineTo(0,ridgeRise); shape.closePath();
    var geo = new T.ShapeGeometry(shape);
    /* 破風の三角形の詰め物。両面 -- カットアウェイで内側からも見える。
     * r128 は DOUBLE_SIDED のとき faceDirection で法線を反転してから
     * 接空間の摂動を掛けるので、normalMap は裏面でも正しい向きに出る。*/
    var endMat = mpSurfMat(mat.color.getHex(), T.DoubleSide);
    var list = ends === 'a' ? [spanA] : (ends === 'b' ? [spanB] : [spanA, spanB]);
    list.forEach(function(s){
      var m = new T.Mesh(geo, endMat);
      m.castShadow = true; m.receiveShadow = true;
      if (axis === 'x'){ m.position.set(s, eaveY, cz); m.rotation.y = Math.PI/2; }
      else { m.position.set(cx, eaveY, s); }
      target.add(m);
    });
  }
  /* True hipped roof (all four sides slope to a short central ridge) --
   * built as an exact 4-face BufferGeometry rather than by stacking lean
   * slopes, so no faces overlap. Used to break up the Low Castle's rows:
   * with every single range gabled the outer bailey read as a stamped
   * grid of identical prisms, which is the single biggest reason the
   * previous build looked like a barracks camp instead of Malbork's
   * Vorburg. `axis` = the direction the ridge runs. */
  function mpHipRoof(target, mat, cx, cz, w, d, eaveY, rise, axis){
    var hx = w/2, hz = d/2, ridgeY = eaveY + rise;
    var x0 = cx-hx, x1 = cx+hx, z0 = cz-hz, z1 = cz+hz;
    var rA, rB;
    if (axis === 'z'){ var ins = Math.min(hx, hz*0.6); rA = [cx, ridgeY, z0+ins]; rB = [cx, ridgeY, z1-ins]; }
    else { var ins2 = Math.min(hz, hx*0.6); rA = [x0+ins2, ridgeY, cz]; rB = [x1-ins2, ridgeY, cz]; }
    var c = [[x0,eaveY,z0],[x1,eaveY,z0],[x1,eaveY,z1],[x0,eaveY,z1]];
    var tris;
    if (axis === 'z'){
      tris = [ [c[0],c[1],rA], [c[3],rB,c[2]],                      // the two hipped ends
               [c[0],rA,rB],[c[0],rB,c[3]],                          // west slope
               [c[1],c[2],rB],[c[1],rB,rA] ];                        // east slope
    } else {
      tris = [ [c[0],rA,c[3]], [c[1],c[2],rB],
               [c[0],c[1],rA],[c[1],rB,rA],
               [c[3],rB,c[2]],[c[3],rA,rB] ];
    }
    /* Winding correction. Hand-ordering 6 triangles across two ridge
     * orientations got several of them backwards, and computeVertexNormals
     * takes its direction straight from the winding -- so those faces came
     * back with downward normals and rendered as near-black roofs sitting
     * among correctly lit ones (clearly visible on the Grand Master's
     * Palace and the hipped Low Castle ranges before this was added).
     * Every face of a roof must point upward, so any triangle whose normal
     * has y < 0 simply gets two of its vertices swapped. */
    var pos = [];
    tris.forEach(function(t){
      var ax=t[1][0]-t[0][0], ay=t[1][1]-t[0][1], az=t[1][2]-t[0][2];
      var bx=t[2][0]-t[0][0], by=t[2][1]-t[0][1], bz=t[2][2]-t[0][2];
      var ny = az*bx - ax*bz;                    // y component of a x b
      var o = ny < 0 ? [t[0],t[2],t[1]] : t;
      o.forEach(function(p){ pos.push(p[0],p[1],p[2]); });
    });
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos,3));
    geo.computeVertexNormals();
    var m = new T.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    target.add(m);
  }
  /* Lancet (pointed-arch) window -- a tall narrow light with a small
   * pyramidal cap standing in for the pointed head. The previous build
   * used plain 0.6x1.8 boxes, so from any distance the walls read as
   * blank brick; Malbork's facades are covered in regularly-spaced tall
   * Gothic lights and that rhythm is a large part of its look. */
  function mpLancet(target, mat, x, y, z, ry, w, h, depth){
    var body = mkBox(w, h, depth, mat);
    place(body, x, y + h/2, z, ry);
    target.add(body);
    var head = mkCone(w*0.72, w*1.15, 4, mat);
    head.rotation.y = Math.PI/4;
    place(head, x, y + h + w*0.5, z, ry);
    target.add(head);
  }
  /* Row of lancets along one facade. `nrm` is the outward face normal
   * (one of 'x+','x-','z+','z-'); `along` positions run along the other
   * horizontal axis, centred on (cx,cz). */
  function mpLancetRow(target, mat, nrm, cx, cz, faceOff, count, spread, y, h, w){
    w = w || 0.62; h = h || 2.2;
    var ry = (nrm==='x+') ? 0 : (nrm==='x-') ? Math.PI : (nrm==='z+') ? -Math.PI/2 : Math.PI/2;
    for (var i=0;i<count;i++){
      var t = count<=1 ? 0 : (i/(count-1) - 0.5) * spread;
      var x = cx, z = cz;
      if (nrm==='x+'){ x = cx + faceOff; z = cz + t; }
      else if (nrm==='x-'){ x = cx - faceOff; z = cz + t; }
      else if (nrm==='z+'){ z = cz + faceOff; x = cx + t; }
      else { z = cz - faceOff; x = cx + t; }
      mpLancet(target, mat, x, y, z, ry, w, h, 0.34);
    }
  }
  /* Blind arcade / pilaster strips: shallow vertical recessed panels
   * marching along a long brick facade. Together with the stepped gables
   * these are THE signature of Malbork's Backsteingotik -- every large
   * wall plane in the photographs is articulated this way, and modelling
   * them costs one thin box each. */
  function mpBlindArcade(target, mat, nrm, cx, cz, faceOff, count, spread, y0, h, w){
    w = w || 0.75;
    for (var i=0;i<count;i++){
      var t = count<=1 ? 0 : (i/(count-1) - 0.5) * spread;
      var x = cx, z = cz, sw = w, sd = 0.22;
      if (nrm==='x+' || nrm==='x-'){ x = cx + (nrm==='x+'? faceOff : -faceOff); z = cz + t; sw = 0.22; sd = w; }
      else { z = cz + (nrm==='z+'? faceOff : -faceOff); x = cx + t; }
      var p = mkBox(sw, h, sd, mat);
      place(p, x, y0 + h/2, z);
      target.add(p);
      var cap = mkCone(w*0.62, w*0.95, 4, mat);
      cap.rotation.y = Math.PI/4;
      place(cap, x, y0 + h + w*0.42, z);
      target.add(cap);
    }
  }
  /* --------------------------------------------------------------
   * STEPPED / CRENELLATED GABLE (schodkowy szczyt) -- the single most
   * characteristic element of Malbork's silhouette and the thing whose
   * absence made the previous build read as generic. Every large range in
   * the photographs terminates in a staircase-profiled gable whose face
   * is quilted with tall slim blind niches and topped with light stone
   * copings and little pinnacles.
   *
   * Built as `steps` nested boxes rising from `eaveY` (a staircase
   * silhouette), a light coping bar on each tread, dark recessed lancet
   * niches on both faces, and a pinnacle on each outer step corner. All
   * of it goes into ROOF-tier fade groups (see the gbl* groups below) --
   * a gable is a roof-line feature, so it should vanish with the roof
   * during the cutaway rather than linger over an open-topped box.
   * `faceAxis` 'z' = gable plane is perpendicular to Z (range runs N-S).
   * -------------------------------------------------------------- */
  function mpSteppedGable(brickFg, trimFg, nicheFg, faceAxis, cx, cz, halfW, eaveY, rise, steps, thick, outSide){
    steps = steps || 4; thick = thick || 1.0;
    // outSide: +1 / -1 quilts only the exposed face (the other one looks
    // into the roof void and is never seen); omit for a free-standing
    // gable that is visible from both sides. Halves the niche mesh count
    // across ~30 gables, which is the single biggest geometry saving here.
    var nSides = outSide ? [outSide] : [-1, 1];
    var stepH = rise/steps;
    var tops = [];
    for (var i=0;i<steps;i++){
      var hw = halfW * (steps-i)/steps;
      var topY = eaveY + stepH*(i+1);
      tops.push({hw:hw, y:topY});
      var bw = 2*hw, bh = topY - eaveY;
      var box = faceAxis==='z' ? mkBox(bw, bh, thick, brickFg.mat) : mkBox(thick, bh, bw, brickFg.mat);
      place(box, cx, eaveY + bh/2, cz);
      brickFg.group.add(box);
      // light stone coping on the tread
      var cw = bw + 0.36;
      var cop = faceAxis==='z' ? mkBox(cw, 0.2, thick+0.3, trimFg.mat) : mkBox(thick+0.3, 0.2, cw, trimFg.mat);
      place(cop, cx, topY + 0.1, cz);
      trimFg.group.add(cop);
      // Pinnacles only on the TOP two treads. One on every corner of every
      // tread turned each gable into a bristling white crown that swamped
      // the staircase silhouette it was supposed to accent.
      if (i >= steps-2){
        [-1,1].forEach(function(sg){
          var pin = mkCone(0.3, 1.15, 4, trimFg.mat);
          pin.rotation.y = Math.PI/4;
          var px = faceAxis==='z' ? cx + sg*(hw-0.24) : cx;
          var pz = faceAxis==='z' ? cz : cz + sg*(hw-0.24);
          place(pin, px, topY + 0.2 + 0.58, pz);
          trimFg.group.add(pin);
        });
      }
    }
    // dark blind niches quilting the gable face: one per ~1.6m of width,
    // each rising to just under whichever tread sits above it.
    var nCount = Math.max(3, Math.round(halfW*2/1.7));
    if (nCount % 2 === 0) nCount++;               // keep one centred on the apex
    var pitch = (halfW*2 - 1.0)/nCount;
    for (var n=0;n<nCount;n++){
      var lx = -halfW + 0.5 + pitch*(n+0.5);
      var lim = eaveY + stepH; // fall back to the lowest tread
      for (var s2=0;s2<steps;s2++){ if (Math.abs(lx) < tops[s2].hw - 0.45) lim = tops[s2].y; }
      var nh = lim - eaveY - 1.15;
      if (nh < 1.0) continue;
      nSides.forEach(function(side){
        var off = (thick/2 + 0.07)*side;
        var nx = faceAxis==='z' ? cx + lx : cx + off;
        var nz = faceAxis==='z' ? cz + off : cz + lx;
        var nb = faceAxis==='z' ? mkBox(pitch*0.62, nh, 0.16, nicheFg.mat) : mkBox(0.16, nh, pitch*0.62, nicheFg.mat);
        place(nb, nx, eaveY + 0.45 + nh/2, nz);
        nicheFg.group.add(nb);
        var nc = mkCone(pitch*0.36, pitch*0.55, 4, nicheFg.mat);
        nc.rotation.y = Math.PI/4;
        place(nc, nx, eaveY + 0.45 + nh + pitch*0.25, nz);
        nicheFg.group.add(nc);
      });
    }
  }
  /* Small gabled roof dormer -- the pantile slopes in every photograph
   * are punctuated by these, and they stop a long roof plane from reading
   * as one dead facet. */
  function mpDormer(roofFg, brickFg, axis, x, y, z, w, h){
    var body = axis==='z' ? mkBox(0.5, h, w, brickFg.mat) : mkBox(w, h, 0.5, brickFg.mat);
    place(body, x, y + h/2, z);
    brickFg.group.add(body);
    var cap = mkCone(w*0.62, h*0.85, 4, roofFg.mat);
    cap.rotation.y = Math.PI/4;
    place(cap, x, y + h + h*0.4, z);
    roofFg.group.add(cap);
  }
  /* Cloister arcade: a run of pointed arches on square piers. Used for
   * the High Castle courtyard (two superimposed storeys, exactly as in
   * the reference courtyard photograph) -- the previous build left that
   * courtyard as bare grass, which is the one interior view every visitor
   * to Malbork actually remembers. */
  function mpArcade(target, pierMat, darkMat, axis, cx, cz, spanA, spanB, y0, hPier, depth){
    var len = Math.abs(spanB-spanA);
    var bays = Math.max(2, Math.round(len/3.4));
    var pitch = len/bays;
    var start = Math.min(spanA, spanB);
    for (var i=0;i<=bays;i++){
      var t = start + i*pitch;
      var pier = axis==='x' ? mkBox(0.55, hPier, depth, pierMat) : mkBox(depth, hPier, 0.55, pierMat);
      place(pier, axis==='x'? t : cx, y0 + hPier/2, axis==='x'? cz : t);
      target.add(pier);
    }
    for (var b=0;b<bays;b++){
      var m = start + (b+0.5)*pitch;
      // dark recess behind the arch = the shaded walk beyond
      var rec = axis==='x' ? mkBox(pitch*0.86, hPier*0.86, depth*0.5, darkMat) : mkBox(depth*0.5, hPier*0.86, pitch*0.86, darkMat);
      place(rec, axis==='x'? m : cx, y0 + hPier*0.43, axis==='x'? cz : m);
      target.add(rec);
      // pointed head over the opening
      var head = mkCone(pitch*0.45, pitch*0.5, 4, pierMat);
      head.rotation.y = Math.PI/4;
      place(head, axis==='x'? m : cx, y0 + hPier + pitch*0.16, axis==='x'? cz : m);
      target.add(head);
    }
    var band = axis==='x' ? mkBox(len+0.6, 0.42, depth*1.12, pierMat) : mkBox(depth*1.12, 0.42, len+0.6, pierMat);
    place(band, axis==='x'? (spanA+spanB)/2 : cx, y0 + hPier + pitch*0.42, axis==='x'? cz : (spanA+spanB)/2);
    target.add(band);
  }
  function mpSmallTower(fg, cx, cz, round, r, h, roofH, roofFg){
    var body = round ? mkCyl(r, r*1.05, h, 12, fg.mat) : mkBox(r*1.8, h, r*1.8, fg.mat);
    place(body, cx, h/2, cz);
    fg.group.add(body);
    var roof = round ? mkCone(r*1.25, roofH, 12, roofFg.mat) : mkCone(r*1.3, roofH, 4, roofFg.mat);
    if (!round) roof.rotation.y = Math.PI/4;
    place(roof, cx, h+roofH/2, cz);
    roofFg.group.add(roof);
  }
  // generic wing wall: a thin representational wall box (same stylised
  // "thin wall + roof computed off the real wing depth" convention
  // malbork.js's own hcWingWall/gableRoof pair uses) running `length`
  // along its own local X axis (rotated by ry into world space), with an
  // optional through-gap for a gate/bridge landing.
  function mpWingWall(fg, cx, cz, length, ry, wallH, thickness, gap){
    if (!gap){
      var wall = mkBox(length, wallH, thickness, fg.mat);
      place(wall, cx, wallH/2, cz, ry);
      fg.group.add(wall);
    } else {
      var seg = (length-gap)/2;
      var co = Math.cos(ry), si = Math.sin(ry);
      [-1,1].forEach(function(sign){
        var lx = sign*(gap/2+seg/2);
        var w2 = mkBox(seg, wallH, thickness, fg.mat);
        place(w2, cx+lx*co, wallH/2, cz-lx*si, ry);
        fg.group.add(w2);
      });
      var doorH = Math.min(5.2, wallH*0.72);
      var lintel = mkBox(gap, wallH-doorH, thickness, fg.mat);
      place(lintel, cx, doorH+(wallH-doorH)/2, cz, ry);
      fg.group.add(lintel);
      var arch = mkBox(gap*0.82, doorH, thickness*0.4, windowMat);
      place(arch, cx, doorH/2, cz, ry);
      interiorGroup.add(arch);
    }
    mpAddCrenellations(fg.group, fg.mat, cx, cz, length, ry, wallH, thickness, 1.1);
    var trim = mkBox(length, 0.28, thickness*1.1, trimMat);
    place(trim, cx, wallH-0.55, cz, ry);
    fg.group.add(trim);
  }
  /* Regular grid of LANCET windows on a rotated wall face. Was a grid of
   * plain 0.6x1.8 boxes; the reference photos show the High Castle wings
   * covered in tall pointed lights in a strict rhythm, so this now emits
   * proper pointed heads and (optionally) the pilaster strips between
   * them. */
  function mpWindowsRow(fg, cx, cz, ry, count, spread, wallH, rows, nicheMat){
    rows = rows || 3;
    var co=Math.cos(ry), si=Math.sin(ry);
    if (nicheMat){
      for (var i2=0;i2<=count;i2++){
        var t2 = (i2/count - 0.5) * (spread + spread/Math.max(1,count-1));
        var pil = mkBox(0.7, wallH-3.0, 0.24, nicheMat);
        place(pil, cx+t2*co, 1.3+(wallH-3.0)/2, cz-t2*si, ry);
        fg.group.add(pil);
      }
    }
    for (var r=0;r<rows;r++){
      var frac = 0.18 + r*(0.60/Math.max(1,rows-1));
      for (var i=0;i<count;i++){
        var t = count<=1 ? 0 : (i/(count-1) - 0.5) * spread;
        mpLancet(fg.group, windowMat, cx+t*co, wallH*frac, cz-t*si, ry, 0.66, 2.1, 0.36);
      }
    }
  }
  /* --------------------------------------------------------------
   * mpRange -- one masonry range (a Low/Middle Castle building block).
   * Replaces the old bare mpWingBlock (box + shallow roof + 2 lonely
   * window squares), which is what made the outer bailey read as rows of
   * identical sheds. A range now carries, all optional per-call:
   *   - a battered plinth course + a light stone string course
   *   - lancet windows on BOTH long facades, in as many storeys as fit
   *   - blind-arcade pilasters between the window bays
   *   - a STEEP roof (opts.pitch, default 0.72 x half-span ~= 55 deg,
   *     measured off the reference photos where the roof mass is fully as
   *     tall as the wall below it -- the old ridge values gave ~22 deg,
   *     which alone flattened the whole silhouette)
   *   - gabled OR hipped roof (opts.hip)
   *   - stepped gables at one/both ends (opts.gable: 'both'|'a'|'b'|none)
   *   - roof dormers (opts.dormers)
   * `axis` = the direction the range (and its ridge) runs.
   * -------------------------------------------------------------- */
  function mpRange(fg, roofFg, gbl, cx, cz, w, d, h, axis, opts){
    opts = opts || {};
    var body = mkBox(w, h, d, fg.mat);
    place(body, cx, h/2, cz);
    fg.group.add(body);
    // battered plinth: a slightly wider, darker base course
    if (opts.plinth !== false){
      var plH = Math.min(1.6, h*0.16);
      var pl = mkBox(w+0.7, plH, d+0.7, nicheMat);
      place(pl, cx, plH/2, cz);
      fg.group.add(pl);
    }
    var span = (axis==='z') ? w : d;          // across the ridge
    var run  = (axis==='z') ? d : w;          // along the ridge
    var rise = opts.rise != null ? opts.rise : span*0.5*(opts.pitch != null ? opts.pitch : 1.42);
    // facade articulation on the two long sides
    var nrmA = axis==='z' ? 'x-' : 'z-', nrmB = axis==='z' ? 'x+' : 'z+';
    var faceOff = (axis==='z' ? w/2 : d/2) + 0.02;
    // one bay per ~6m of frontage. 4.6m gave a denser, prettier facade but
    // ~40% more meshes across 25-odd ranges; at the distances this castle
    // is actually viewed from, 6m reads identically.
    var bays = Math.max(2, Math.round(run/6.0));
    var spread = run - 3.2;
    var storeys = Math.max(1, Math.floor((h-1.8)/4.2));
    [nrmA, nrmB].forEach(function(nrm){
      if (opts.pilasters !== false){
        mpBlindArcade(fg.group, nicheMat, nrm, cx, cz, faceOff, bays+1, run-1.6, 1.2, h-2.6, 0.8);
      }
      for (var s=0;s<storeys;s++){
        var wy = 2.0 + s*4.2;
        if (wy + 2.6 > h) break;
        mpLancetRow(fg.group, windowMat, nrm, cx, cz, faceOff+0.08, bays, spread, wy, 2.0, 0.6);
      }
    });
    // light stone string course just under the eaves
    var sc = mkBox(w+0.5, 0.3, d+0.5, trimMat);
    place(sc, cx, h-0.45, cz);
    fg.group.add(sc);
    // roof
    if (opts.hip){
      mpHipRoof(roofFg.group, roofFg.mat, cx, cz, w+0.6, d+0.6, h, rise, axis);
    } else {
      var g = opts.gable || 'none';
      var ends = g==='both' ? false : (g==='a' ? 'b' : (g==='b' ? 'a' : true));
      if (axis==='z') mpGableRoof(roofFg.group, roofFg.mat, 'z', cx, cz, cz-d/2, cz+d/2, w/2+0.3, h, rise, ends);
      else            mpGableRoof(roofFg.group, roofFg.mat, 'x', cx, cz, cx-w/2, cx+w/2, d/2+0.3, h, rise, ends);
      var hw = span/2;
      var gEnds = g==='both' ? [-1,1] : (g==='a' ? [-1] : (g==='b' ? [1] : []));
      gEnds.forEach(function(sg){
        var gx = axis==='z' ? cx : cx + sg*w/2;
        var gz = axis==='z' ? cz + sg*d/2 : cz;
        mpSteppedGable(gbl.brick, gbl.trim, gbl.niche, axis==='z' ? 'z' : 'x',
          gx, gz, hw, h, rise, opts.steps || 4, 1.0, sg);
      });
    }
    // dormers on the two roof slopes
    if (opts.dormers){
      var dn = opts.dormers;
      for (var di=0; di<dn; di++){
        var t = run*( (di+0.5)/dn - 0.5 );
        [-1,1].forEach(function(sg2){
          var off = span*0.27*sg2;
          var dx = axis==='z' ? cx + off : cx + t;
          var dz = axis==='z' ? cz + t : cz + off;
          mpDormer(roofFg, gbl.brick, axis, dx, h + rise*0.42, dz, 1.7, 1.5);
        });
      }
    }
    return rise;
  }
  function mpPickRoom(x0,x1,z0,z1,h,name,desc){
    registerPick(pickables, 'room', (x0+x1)/2, h/2, (z0+z1)/2, Math.abs(x1-x0), h, Math.abs(z1-z0), name, desc);
  }

  /* --------------------------------------------------------------
   * BOX SOUP -- accumulate any number of axis-aligned boxes into ONE
   * BufferGeometry / ONE draw call.
   *
   * Why this exists: this castle is by far the heaviest in the viewer
   * (5.5k draw calls before this pass) and the single worst offender is
   * per-merlon geometry -- mpAddCrenellations emits one Mesh per merlon,
   * so a 270m curtain alone costs ~110 draw calls. The new river-terrace
   * walls, the outer enceinte and the Vorburg garden beds together would
   * have added another ~600 that way. Welded into one geometry each they
   * cost one apiece, which is what buys the budget for the terraces and
   * the widened Nogat without making an already-heavy castle heavier.
   *
   * Faces are wound CCW-from-outside and normals are written explicitly
   * (no computeVertexNormals pass), so a welded run lights identically to
   * the individual mkBox() meshes it replaces.
   * -------------------------------------------------------------- */
  function mpBoxSoup(){
    var pos = [], nor = [], idx = [], base = 0;
    var NRM = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]];
    return {
      box: function(cx,cy,cz,w,h,d){
        var x0=cx-w/2, x1=cx+w/2, y0=cy-h/2, y1=cy+h/2, z0=cz-d/2, z1=cz+d/2;
        var v = [ x1,y0,z1, x1,y0,z0, x1,y1,z0, x1,y1,z1,      // +x
                  x0,y0,z0, x0,y0,z1, x0,y1,z1, x0,y1,z0,      // -x
                  x0,y1,z1, x1,y1,z1, x1,y1,z0, x0,y1,z0,      // +y
                  x0,y0,z0, x1,y0,z0, x1,y0,z1, x0,y0,z1,      // -y
                  x0,y0,z1, x1,y0,z1, x1,y1,z1, x0,y1,z1,      // +z
                  x1,y0,z0, x0,y0,z0, x0,y1,z0, x1,y1,z0 ];    // -z
        for (var i=0;i<24;i++){
          pos.push(v[i*3], v[i*3+1], v[i*3+2]);
          var n = NRM[(i/4)|0]; nor.push(n[0],n[1],n[2]);
        }
        for (var f=0;f<6;f++){ var o = base + f*4; idx.push(o,o+1,o+2, o,o+2,o+3); }
        base += 24;
        return this;
      },
      empty: function(){ return base === 0; },
      finish: function(target, mat){
        if (!base) return null;
        var g = new T.BufferGeometry();
        g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal',   new T.Float32BufferAttribute(nor, 3));
        g.setIndex(idx);
        g.computeBoundingSphere();
        var m = new T.Mesh(g, mat);
        m.castShadow = true; m.receiveShadow = true;
        target.add(m);
        return m;
      }
    };
  }

  /* Non-fading pseudo fade-group: same { group, mat } duck type every
   * mp* helper above consumes, but NOT pushed into `fadeGroups`, so its
   * contents never dissolve during the cutaway. Used for the town outside
   * the walls (St Lawrence's church + its neighbours) -- buildings that
   * are not part of the castle have no business melting away when the
   * camera zooms into the castle's interior. */
  function mpPlainGroup(colorHex){
    var g = new T.Group();
    root.add(g);
    return { group: g, mat: mpSurfMat(colorHex), op: 1 };
  }

  /* --------------------------------------------------------------
   * TERRAIN STRIP -- a cross-section profile [[x,y],...] extruded along
   * the whole Z length of the world. One geometry, one draw call, and it
   * is what turns the Nogat from a painted-on ribbon into a real valley:
   * the castle stands on the top terrace, two stepped terraces fall away
   * to a riverside promenade, then the bank drops to the riverbed.
   * -------------------------------------------------------------- */
  function mpTerrainStrip(profile, z0, z1, mat){
    var pos = [], nor = [], idx = [], n = profile.length, segN = [], i;
    // per-segment up-normal, tilted by that segment's own slope. The
    // profile runs EAST -> WEST (x decreasing), so -dx is the "up" side.
    for (i=0;i<n-1;i++){
      var dx = profile[i+1][0]-profile[i][0], dy = profile[i+1][1]-profile[i][1];
      var l = Math.hypot(dx,dy) || 1;
      segN.push([dy/l, -dx/l]);
    }
    for (i=0;i<n;i++){
      pos.push(profile[i][0], profile[i][1], z0);
      pos.push(profile[i][0], profile[i][1], z1);
      // vertex normal = average of the segments meeting at it, so the
      // terrace treads and the bank slopes shade as one continuous ground
      var na = segN[Math.max(0, i-1)], nb = segN[Math.min(n-2, i)];
      var ax = (na[0]+nb[0])/2, ay = (na[1]+nb[1])/2, al = Math.hypot(ax,ay) || 1;
      nor.push(ax/al, ay/al, 0);
      nor.push(ax/al, ay/al, 0);
    }
    for (i=0;i<n-1;i++){
      var a = i*2, b = i*2+1, c = i*2+2, d = i*2+3;
      idx.push(a, c, b,  b, c, d);
    }
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos,3));
    geo.setAttribute('normal',   new T.Float32BufferAttribute(nor,3));
    geo.setIndex(idx);
    geo.computeBoundingSphere();
    var mesh = new T.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }

  /* Long straight curtain wall standing on an arbitrary base level, with
   * merlons + a stone coping, all welded into two draw calls. `axis` is
   * the direction the wall runs ('x' or 'z'). */
  function mpLongWall(fg, axis, fixed, a0, a1, baseY, topY, th, opts){
    opts = opts || {};
    var soup = mpBoxSoup(), trimSoup = mpBoxSoup();
    var len = Math.abs(a1-a0), mid = (a0+a1)/2, h = topY - baseY;
    if (axis === 'z') soup.box(fixed, baseY+h/2, mid, th, h, len);
    else              soup.box(mid, baseY+h/2, fixed, len, h, th);
    // stone coping just under the wall head
    if (opts.trim !== false){
      if (axis === 'z') trimSoup.box(fixed, topY-0.4, mid, th*1.16, 0.3, len);
      else              trimSoup.box(mid, topY-0.4, fixed, len, 0.3, th*1.16);
    }
    if (opts.merlons !== false){
      var mw = 1.4, gap = 1.25, period = mw+gap, mh = opts.merlonH || 1.15;
      var count = Math.max(1, Math.floor(len/period));
      var start = Math.min(a0,a1) + (len - count*period)/2 + mw/2;
      for (var i=0;i<count;i++){
        var s = start + i*period;
        if (opts.skip && opts.skip(s)) continue;
        if (axis === 'z') soup.box(fixed, topY+mh/2, s, th*0.74, mh, mw);
        else              soup.box(s, topY+mh/2, fixed, mw, mh, th*0.74);
      }
    }
    soup.finish(fg.group, fg.mat);
    trimSoup.finish(fg.group, trimMat);
  }

  /* ================================================================
   * GROUND + NOGAT RIVER -- one large undulating plane under the whole
   * ~470m-long complex (origin = High Castle courtyard centre, so the
   * Low Castle's north wall sits ~440m away from the origin on +Z), plus
   * a west-side river band running the full north-south length, exactly
   * like castles/malbork.js's own river treatment (sits above the noise-
   * undulation ceiling, no bank grading needed).
   * ================================================================ */
  var GROUND_Y = -0.6;

  /* ---- NOGAT VALLEY SECTION ------------------------------------------
   * The single biggest error in the previous build. It drew the Nogat as
   * a 60m ribbon 14m clear of the west wall, sitting FLAT on the same
   * ground plane as the castle -- so from the air the river read as a
   * drainage canal running past a castle that stood on a billiard table.
   * Both the user's oblique aerial and the Google satellite view show
   * something completely different:
   *   - the river is enormous. Measured off the satellite frame against
   *     the High Castle's known 51x61m footprint it runs roughly 190-200m
   *     bank to bank, i.e. as wide as the whole castle complex.
   *   - it comes right up to the castle. Between the outermost wall and
   *     the water there is only an embankment, a promenade and a strip of
   *     grass -- of the order of 40-50m, not a field.
   *   - the ground FALLS to it in steps. In the aerial you can count the
   *     wall lines marching down the slope: the castle's own curtain on
   *     the top level, an outer enceinte on a middle terrace, and a low
   *     riverside wall with conical-roofed towers on the bank below that.
   * So the west side is no longer flat ground with a blue rectangle on
   * it: the shared undulating ground plane is CUT AWAY west of the castle
   * and replaced by a real cross-section -- glacis, two terraces, the
   * riverside promenade, the bank, the bed, then the far shore.
   * X ordinates below are absolute sheet coordinates; the profile is
   * uniform along Z (it is a river terrace, and the aerial shows it
   * running the full length of the site and well past both ends).
   * ------------------------------------------------------------------ */
  var W_GLACIS_X = -86;   // outer edge of the top (castle) level
  var TER_MID_Y  = -5.0;  // middle terrace: the outer enceinte stands here
  var TER_MID_X  = -101;
  var PROM_Y     = -8.6;  // riverside promenade
  var PROM_X     = -116;
  var BED_Y      = -11.5;
  var WATER_Y    = -9.6;
  var WATER_X0   = -114, WATER_X1 = -318;  // 204m of open water
  var GROUND_CUT_X = -72; // faces entirely west of this are dropped

  var ground = buildUndulatingGround(520, 2100, 92, grassMat, null);
  (function cutGroundForRiverValley(){
    /* Drop every face lying wholly west of GROUND_CUT_X. The plane's own
     * grid is coarse (2100/92 = 22.8m), so the surviving edge lands at
     * about x = -68; the terrace strip below starts at -60 and overlaps
     * it by a few metres, 0.08m proud, so there is no seam and no
     * coplanar z-fight. Everything the castle stands on is east of -68
     * apart from the Low Castle's own west curtain, which the terrace
     * strip carries. */
    var geo = ground.geometry, pos = geo.attributes.position;
    var src = geo.getIndex().array, kept = [];
    for (var i=0;i<src.length;i+=3){
      var a=src[i], b=src[i+1], c=src[i+2];
      if (pos.getX(a) < GROUND_CUT_X && pos.getX(b) < GROUND_CUT_X && pos.getX(c) < GROUND_CUT_X) continue;
      kept.push(a,b,c);
    }
    geo.setIndex(kept);
  })();
  ground.position.y = GROUND_Y;
  group.add(ground);

  /* The valley itself. Three strips, three draw calls: the terraced near
   * side (grass), the bed (silt, seen only through the water), and the
   * far shore. They live in `group`, not `root` -- they are terrain, they
   * are uniform along Z, and like the ground plane they must not take the
   * castle's ZOFF re-centring shift. */
  var siltMat = texMat(0x4a4534, 'soil', { nrm: 0.7 });                 // 水際の泥
  var ZTERR0 = -1080, ZTERR1 = 1080;
  group.add(mpTerrainStrip([
    [-60, GROUND_Y+0.08], [W_GLACIS_X, GROUND_Y+0.08],   // castle glacis
    [W_GLACIS_X-2, TER_MID_Y], [TER_MID_X, TER_MID_Y],   // middle terrace
    [TER_MID_X-2, PROM_Y],     [PROM_X, PROM_Y],         // riverside promenade
    [PROM_X-4, BED_Y]                                    // bank into the water
  ], ZTERR0, ZTERR1, grassMat));
  group.add(mpTerrainStrip([[PROM_X-4, BED_Y], [-314, BED_Y]], ZTERR0, ZTERR1, siltMat));
  group.add(mpTerrainStrip([[-314, BED_Y], [-320, GROUND_Y], [-1060, GROUND_Y]],
    ZTERR0, ZTERR1, grassMat));

  /* ================================================================
   * GABLE-DECORATION FADE BUNDLES
   * Stepped gables, their stone copings/pinnacles and their dark blind
   * niches all need their own materials (three colours) but must fade
   * together with the roof they crown -- a gable left standing over a
   * roofless box during the cutaway looks broken. So each bundle is three
   * fadeGroups declared with roof:true and no `dir`, i.e. they ride the
   * shared ROOF_START/END band (or DONJON_ROOF_* for the inner tier)
   * exactly like the tile surfaces do. One bundle per cutaway tier, since
   * tier is the only thing that has to differ.
   * ================================================================ */
  function mpGableBundle(prefix, tier){
    return {
      brick: mpMakeFadeGroup(prefix+'Gable',      null, true, BRICK_WALL_V, tier),
      trim:  mpMakeFadeGroup(prefix+'GableTrim',  null, true, WHITE_TRIM,   tier),
      niche: mpMakeFadeGroup(prefix+'GableNiche', null, true, NICHE_COL,    tier)
    };
  }
  var gblOuter = mpGableBundle('outer', 'outer');
  var gblInner = mpGableBundle('inner', 'inner');

  /* ================================================================
   * HIGH CASTLE Zamek Wysoki -- southernmost block, origin at its own
   * courtyard centre. 51(X)x61(Z) [MH]◎, courtyard 32x37 [MH]○, wing
   * depths derived: (51-32)/2=9.5m E/W wings, (61-37)/2=12.0m N/S wings.
   * Tier 'inner' -- fades only after the Low+Middle Castle shell below
   * has already fully faded (two-tier cutaway, see file header).
   * ================================================================ */
  var HC_HX = 25.5, HC_HZ = 30.5;          // [MH]◎ 51x61m, centred on origin
  var HC_COURT_HX = 16, HC_COURT_HZ = 18.5; // [MH]○ 32x37m courtyard
  var HC_WD_EW = (HC_HX*2 - HC_COURT_HX*2)/2; // 9.5m -- derived ○
  var HC_WD_NS = (HC_HZ*2 - HC_COURT_HZ*2)/2; // 12.0m -- derived ○
  var HC_WALL_H = 22, HC_RIDGE = 12; // △ 推定: no surveyed eave/ridge height exists; taller than the 14.4m church, estimated from published photos
  var HC_TURRET = 3.7; // [MH]○ corner turret footprint

  var hcWallS = mpMakeFadeGroup('hcWallS', {x:0,z:-1}, false, BRICK_WALL_V, 'inner'); // faces AWAY from Middle Castle (toward Gdanisko)
  var hcWallN = mpMakeFadeGroup('hcWallN', {x:0,z:1},  false, BRICK_WALL_V, 'inner'); // faces Middle Castle (dry-ditch bridge lands here)
  var hcWallE = mpMakeFadeGroup('hcWallE', {x:1,z:0},  false, BRICK_WALL_V, 'inner'); // main-tower wing
  var hcWallW = mpMakeFadeGroup('hcWallW', {x:-1,z:0}, false, BRICK_WALL_V, 'inner');
  var hcRoof  = mpMakeFadeGroup('hcRoof', null, true, ROOF_COL, 'inner');
  var hcTurr  = mpMakeFadeGroup('hcTurrets', null, true, BRICK_WALL_V, 'inner');
  var hcTower = mpMakeFadeGroup('hcMainTower', mpNorm(1,0), false, TOWER_BRICK, 'inner');
  var hcApse  = mpMakeFadeGroup('hcApse', mpNorm(1,1), false, BRICK_WALL_V, 'inner');
  var hcGd    = mpMakeFadeGroup('hcGdanisko', mpNorm(-1,-1), false, BRICK_WALL_V, 'inner');
  hcGd.mat.side = T.DoubleSide; // the bridge's arch-infill triangles (below) are single-sided planes
  var hcGdRoof= mpMakeFadeGroup('hcGdaniskoRoof', null, true, ROOF_COL, 'inner');

  /* Each wing: brick wall + a blind-arcade/lancet facade + a steep roof.
   * The E and W wings terminate at the four corners in STEPPED GABLES
   * (gblInner), which is what the corner masses actually look like in
   * every photograph of the High Castle from the south or the river --
   * previously they were plain flat triangles and the whole block read as
   * a shed. Dormers punctuate the long N/S roof planes. */
  mpWingWall(hcWallS, 0, -HC_HZ, 2*HC_HX, Math.PI, HC_WALL_H, 1.5, 0);
  mpWindowsRow(hcWallS, 0, -HC_HZ, Math.PI, 7, 42, HC_WALL_H, 4, nicheMat);
  mpGableRoof(hcRoof.group, hcRoof.mat, 'x', 0, -HC_HZ, -HC_HX+2, HC_HX-2, HC_WD_NS/2, HC_WALL_H, HC_RIDGE);

  var HC_GATE_W = 4.6; // dry-ditch bridge landing, centred X=0
  mpWingWall(hcWallN, 0, HC_HZ, 2*HC_HX, 0, HC_WALL_H, 1.5, HC_GATE_W);
  mpWindowsRow(hcWallN, 0, HC_HZ, 0, 6, 38, HC_WALL_H, 3, nicheMat);
  mpGableRoof(hcRoof.group, hcRoof.mat, 'x', 0, HC_HZ, -HC_HX+2, HC_HX-2, HC_WD_NS/2, HC_WALL_H, HC_RIDGE);

  mpWingWall(hcWallE, HC_HX, 0, 2*HC_HZ, -Math.PI/2, HC_WALL_H, 1.5, 0);
  mpWindowsRow(hcWallE, HC_HX, 0, -Math.PI/2, 8, 48, HC_WALL_H, 4, nicheMat);
  mpGableRoof(hcRoof.group, hcRoof.mat, 'z', HC_HX, 0, -HC_HZ+2, HC_HZ-2, HC_WD_EW/2, HC_WALL_H, HC_RIDGE, false);

  mpWingWall(hcWallW, -HC_HX, 0, 2*HC_HZ, Math.PI/2, HC_WALL_H, 1.5, 0);
  mpWindowsRow(hcWallW, -HC_HX, 0, Math.PI/2, 8, 48, HC_WALL_H, 4, nicheMat);
  mpGableRoof(hcRoof.group, hcRoof.mat, 'z', -HC_HX, 0, -HC_HZ+2, HC_HZ-2, HC_WD_EW/2, HC_WALL_H, HC_RIDGE, false);

  // four corner stepped gables closing the E/W wing roofs
  [-1,1].forEach(function(sx){
    [-1,1].forEach(function(sz){
      mpSteppedGable(gblInner.brick, gblInner.trim, gblInner.niche, 'z',
        sx*HC_HX, sz*(HC_HZ-2), HC_WD_EW/2, HC_WALL_H, HC_RIDGE, 4, 1.2);
    });
  });
  // dormers on the long north / south roof slopes
  [-1,1].forEach(function(sz2){
    for (var hd=0; hd<4; hd++){
      var hdx = -15 + hd*10;
      mpDormer(hcRoof, gblInner.brick, 'x', hdx, HC_WALL_H + HC_RIDGE*0.40,
        sz2*(HC_HZ - HC_WD_NS*0.30), 1.9, 1.7);
    }
  });

  registerPick(pickables, 'structure', 0, HC_WALL_H*0.5, 0, 2*HC_HX+6, HC_WALL_H+HC_RIDGE, 2*HC_HZ+6,
    '高城 High Castle', '複合体最南端、騎士団の心臓部。51x61m [MH]、中庭32x37m [MH]。回廊が中庭を囲む四翼の修道院型建築。');

  // corner turrets (all 4 outer corners, [MH]○ 3.7x3.7m footprint)
  [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function(s){
    var cx = s[0]*(HC_HX-HC_TURRET*0.4), cz = s[1]*(HC_HZ-HC_TURRET*0.4);
    var t = mkBox(HC_TURRET, HC_WALL_H+3, HC_TURRET, hcTurr.mat);
    place(t, cx, (HC_WALL_H+3)/2, cz);
    hcTurr.group.add(t);
    var cap = mkCone(HC_TURRET*0.85, 3.0, 4, hcRoof.mat);
    cap.rotation.y = Math.PI/4;
    place(cap, cx, HC_WALL_H+3+1.5, cz);
    hcRoof.group.add(cap);
  });

  /* ---- Main Tower Wieża główna: EAST wing [MH]◎, plan 11.7(Z)x6.0(X)m
   * [MH]○, height 66m from the dry-ditch bottom / ~50m from the
   * courtyard floor [MH][multiple sources]◎ -- 50m (ground-referenced)
   * is used for the modelled height so it sits correctly relative to
   * every other ground-referenced number in this file. Flat top +
   * battlements (bell/watch tower), per [MH]◎. Positioned south-central
   * on the east wing, clear of the church/apse cluster at the NE corner. */
  var MT_W = 6.0, MT_D = 11.7, MT_H = 50;
  var MT_CX = HC_HX + 1.2, MT_CZ = -6;
  var mtBody = mkBox(MT_W, MT_H, MT_D, hcTower.mat);
  place(mtBody, MT_CX, MT_H/2, MT_CZ);
  hcTower.group.add(mtBody);
  var mtLip = mkBox(MT_W*1.14, 0.7, MT_D*1.1, hcTower.mat);
  place(mtLip, MT_CX, MT_H-0.6, MT_CZ);
  hcTower.group.add(mtLip);
  [ {x:MT_W/2*0.99, z:0, ry:0}, {x:-MT_W/2*0.99, z:0, ry:Math.PI},
    {x:0, z:MT_D/2*0.99, ry:-Math.PI/2}, {x:0, z:-MT_D/2*0.99, ry:Math.PI/2} ].forEach(function(face){
    for (var ms=0; ms<9; ms++){
      var wy = 3.2+ms*5.2;
      if (wy > MT_H-2) break;
      var win = mkBox(0.5, 1.7, 0.3, windowMat);
      place(win, MT_CX+face.x, wy, MT_CZ+face.z, face.ry);
      hcTower.group.add(win);
    }
  });
  var mtEdgeX = MT_W/2, mtEdgeZ = MT_D/2;
  mpAddCrenellations(hcTower.group, hcTower.mat, MT_CX, MT_CZ-mtEdgeZ, MT_W, 0, MT_H, 1.0, 1.3);
  mpAddCrenellations(hcTower.group, hcTower.mat, MT_CX, MT_CZ+mtEdgeZ, MT_W, Math.PI, MT_H, 1.0, 1.3);
  mpAddCrenellations(hcTower.group, hcTower.mat, MT_CX+mtEdgeX, MT_CZ, MT_D, -Math.PI/2, MT_H, 1.0, 1.3);
  mpAddCrenellations(hcTower.group, hcTower.mat, MT_CX-mtEdgeX, MT_CZ, MT_D, Math.PI/2, MT_H, 1.0, 1.3);
  registerPick(pickables, 'structure', MT_CX, MT_H*0.42, MT_CZ, MT_D*1.5, MT_H*0.9, MT_D*1.5,
    '主塔 Main Tower', '東翼にそびえる高さ約50m(乾堀底基準では66m)の塔。平面11.7x6.0m [MH]。平頂に胸壁を戴く鐘楼兼望楼。');
  /* ---- 主塔の旗 ---------------------------------------------------
   * ドイツ騎士修道会の本拠なので、主塔の胸壁に団旗を1本。塔と同じ
   * フェードグループに入れるので、カットアウェイで塔が消えれば一緒に
   * 消える。竿は胸壁の内側(-Z 寄り)に立て、布は +X へ流す。 */
  mpFlag(hcTower, MT_CX, MT_CZ - MT_D*0.28, MT_H + 1.3, { seed: 0.0, poleH: 7.0, w: 4.0, h: 2.5 });

  /* ---- St Mary's Church: north wing, east-leaning [MH]◎, length 38m
   * [MH]○, height 14.4m [MH]○ -- the one hard interior-height number in
   * the whole sheet. Polygonal apse projects EAST beyond the building
   * line near the NE corner [MH]◎, with an 8m Virgin Mary statue in an
   * east-facing niche [PL][ZM]◎. */
  var CH_LEN = 38, CH_H = 14.4;
  var CH_X1 = HC_HX, CH_X0 = CH_X1 - CH_LEN;
  var CH_Z = HC_HZ - HC_WD_NS/2;
  var churchBody = mkBox(CH_LEN, CH_H, HC_WD_NS-1, hcWallN.mat);
  place(churchBody, (CH_X0+CH_X1)/2, CH_H/2, CH_Z);
  hcWallN.group.add(churchBody);
  var APSE_CX = HC_HX + 4.6, APSE_CZ = HC_HZ - 7, APSE_R = 5, APSE_H = CH_H + 3;
  var apseBody = mkCyl(APSE_R, APSE_R, APSE_H, 6, hcApse.mat);
  apseBody.rotation.y = Math.PI/6;
  place(apseBody, APSE_CX, APSE_H/2, APSE_CZ);
  hcApse.group.add(apseBody);
  var apseRoof = mkCone(APSE_R*1.1, 5.0, 6, hcRoof.mat);
  apseRoof.rotation.y = Math.PI/6;
  place(apseRoof, APSE_CX, APSE_H+2.5, APSE_CZ);
  hcRoof.group.add(apseRoof);
  /* Apse: tall traceried lancets between stepped buttresses, which is
   * what actually gives the chancel its Gothic read -- the previous four
   * flat rectangles on a hexagon looked like slots cut in a drum. */
  for (var af=0; af<5; af++){
    var ang = (af-2)*0.52;
    var wx = APSE_CX + Math.cos(ang)*APSE_R*0.97, wz = APSE_CZ + Math.sin(ang)*APSE_R*0.97;
    mpLancet(hcApse.group, windowMat, wx, APSE_H*0.22, wz, -ang + Math.PI/2, 1.5, APSE_H*0.55, 0.5);
  }
  for (var ab=0; ab<4; ab++){
    var bang = (ab-1.5)*0.62;
    var bx = APSE_CX + Math.cos(bang)*APSE_R*1.06, bz = APSE_CZ + Math.sin(bang)*APSE_R*1.06;
    var bt = mkBox(1.1, APSE_H*0.92, 1.9, hcApse.mat);
    place(bt, bx, APSE_H*0.46, bz, -bang);
    hcApse.group.add(bt);
    var btc = mkCone(0.85, 2.0, 4, trimMat);
    btc.rotation.y = Math.PI/4;
    place(btc, bx, APSE_H*0.92 + 1.0, bz);
    hcApse.group.add(btc);
  }
  // buttresses + blind arcading down the church's exposed north flank
  for (var cbz2=0; cbz2<7; cbz2++){
    var czz = CH_X0 + 4 + cbz2*5.2;
    if (czz > CH_X1 - 3) break;
    var cbut = mkBox(1.3, CH_H+4.5, 1.6, hcWallN.mat);
    place(cbut, czz, (CH_H+4.5)/2, HC_HZ + 0.4);
    hcWallN.group.add(cbut);
    var cbcap = mkCone(0.95, 2.2, 4, trimMat);
    cbcap.rotation.y = Math.PI/4;
    place(cbcap, czz, CH_H+4.5+1.1, HC_HZ + 0.4);
    hcWallN.group.add(cbcap);
  }
  // Virgin Mary statue niche, 8m tall [PL][ZM]◎, east-facing on the apse
  var statue = mkCyl(0.55, 0.9, 8.0, 8, floorMat);
  place(statue, APSE_CX+APSE_R*0.9, 4.0+CH_H*0.35, APSE_CZ);
  hcApse.group.add(statue);
  registerPick(pickables, 'structure', APSE_CX, APSE_H*0.5, APSE_CZ, APSE_R*2.2, APSE_H, APSE_R*2.2,
    '教会後陣+聖母像 Church Apse & Virgin Mary', '聖母マリア教会(長さ38m・高さ14.4m [MH])の多角形内陣。東ニッチに高さ8mの聖母像 [PL][ZM]。');

  /* ---- Gdanisko / Dansker (latrine tower) -- the feature completely
   * missing from the photo-based build. SW corner, ~60m projection
   * [MH][BW]◎, plan 12.6x13.3m [MH]○, 5 pointed-Gothic-arch bridge with
   * 2 piers standing in the moat [MH]○, first span a raised drawbridge
   * [MH]○ (which end of the 5 is the drawbridge isn't specified by any
   * source -- placed here nearest the High Castle, 推定/interpretation,
   * so a captured Gdanisko could be sealed off from the main castle).
   * Tower height has no surveyed number -- 推定, set equal to the High
   * Castle wing eave height (22m). */
  var GD_W = 12.6, GD_D = 13.3, GD_H = 22; // 高さ△ 推定
  var BR_X = -(HC_HX-6), BR_Z0 = -HC_HZ, BR_LEN = 60, BR_Z1 = BR_Z0 - BR_LEN;
  var GD_CX = BR_X, GD_CZ = BR_Z1 - GD_D/2;
  var gdBody = mkBox(GD_W, GD_H, GD_D, hcGd.mat);
  place(gdBody, GD_CX, GD_H/2, GD_CZ);
  hcGd.group.add(gdBody);
  mpAddCrenellations(hcGd.group, hcGd.mat, GD_CX, GD_CZ-GD_D/2, GD_W, 0, GD_H, 1.0, 1.1);
  mpAddCrenellations(hcGd.group, hcGd.mat, GD_CX, GD_CZ+GD_D/2, GD_W, Math.PI, GD_H, 1.0, 1.1);
  mpGableRoof(hcGdRoof.group, hcGdRoof.mat, 'x', GD_CX, GD_CZ, GD_CX-GD_W/2+1, GD_CX+GD_W/2-1, GD_D/2, GD_H, 4.0);
  for (var gdw=0; gdw<3; gdw++){
    var gwz = GD_CZ - GD_D/2 + 2.5 + gdw*4.0;
    var gwin = mkBox(0.5, 1.6, 0.32, windowMat);
    place(gwin, GD_CX-GD_W/2*0.99, GD_H*0.6, gwz);
    hcGd.group.add(gwin);
  }
  registerPick(pickables, 'structure', GD_CX, GD_H*0.45, GD_CZ, GD_W*1.3, GD_H*0.9, GD_D*1.3,
    'グダニスコ(便所塔) Gdanisko / Dansker', '南西隅から約60m突出する便所塔。平面12.6x13.3m [MH]。堀の上に架かる尖頭アーチ5連の橋で高城と結ばれる。');

  (function buildGdaniskoBridge(){
    // moat under the crossing -- a dedicated water band across the
    // middle third of the 60m span (Z in [-70.5,-50.5]) so exactly 2 of
    // the 4 interior support points land "in the moat" per [MH]'s
    // "2本の橋脚" -- the general High-Castle-perimeter moat implied by
    // the sheet's "堀は水堀" note is intentionally NOT separately
    // modelled here (see file's closing summary comment) to keep this
    // dedicated crossing legible rather than nesting two overlapping
    // water systems around a tight 60m corridor.
    var moatZ0 = -70.5, moatZ1 = -50.5, moatHX = 9;
    var moatPlane = new T.Mesh(new T.PlaneGeometry(moatHX*2, moatZ1-moatZ0), moatWaterMat);
    moatPlane.rotation.x = -Math.PI/2;
    place(moatPlane, BR_X, GROUND_Y+0.35, (moatZ0+moatZ1)/2);
    root.add(moatPlane);

    var supports = [BR_Z0, BR_Z0-12, BR_Z0-24, BR_Z0-36, BR_Z0-48, BR_Z1]; // 6 points -> 5 arches
    var DECK_Y = 8, BASE_Y = 1.6, PEAK_Y = DECK_Y - 0.6;
    var corridorHalf = GD_W*0.55/2;
    // 4 interior piers (stone, matching the deep-brick tone)
    for (var pi=1; pi<supports.length-1; pi++){
      var pz = supports[pi];
      var inWater = pz > moatZ1-0.01 ? false : (pz < moatZ0+0.01 ? false : true); // between moatZ0/moatZ1
      var pier = mkCyl(0.85, 0.95, BASE_Y-GROUND_Y+0.4, 10, inWater ? stoneDarkMat : hcGd.mat);
      place(pier, BR_X, GROUND_Y+(BASE_Y-GROUND_Y+0.4)/2, pz);
      root.add(pier);
    }
    // 5 pointed-arch ribs (skeletal, 2-beam ogee silhouette per side) --
    // span 0 (nearest the High Castle) is rendered as a raised drawbridge
    // instead of a solid arch.
    for (var sp=0; sp<5; sp++){
      var z0 = supports[sp], z1 = supports[sp+1], zm = (z0+z1)/2;
      if (sp === 0){
        // drawbridge: a tilted plank + 2 suspension chains, no solid arch beneath
        var plank = mkBox(corridorHalf*1.7, 0.3, Math.abs(z1-z0)*0.92, woodMat);
        place(plank, BR_X, DECK_Y-1.6, (z0+z1)/2, 0);
        plank.rotation.x = 0.55;
        root.add(plank);
        [-1,1].forEach(function(side){
          var chain = mkCyl(0.06,0.06, 5.0, 5, metalMat);
          place(chain, BR_X+side*corridorHalf*0.8, DECK_Y-1.0, z0+0.6);
          chain.rotation.x = 0.9;
          root.add(chain);
        });
        continue;
      }
      [-1,1].forEach(function(side){
        var ox = BR_X + side*corridorHalf;
        // solid pointed-arch infill panel (single flat triangle: pier-top
        // -> pier-top -> mid-span peak), same "Shape/triangle as a gable"
        // convention mpGableRoof's own gable-end infill uses -- a pair of
        // thin raking ribs read as almost invisible hairlines at this
        // castle's scale/render distance, a solid silhouette does not.
        // hcGd.mat is set to DoubleSide (see below) so this single-sided
        // triangle still reads correctly from both banks of the moat.
        var archGeo = new T.BufferGeometry();
        archGeo.setAttribute('position', new T.Float32BufferAttribute(
          [ox,BASE_Y,z0,  ox,BASE_Y,z1,  ox,PEAK_Y,zm], 3));
        archGeo.setIndex([0,1,2]);
        archGeo.computeVertexNormals();
        var archMesh = new T.Mesh(archGeo, hcGd.mat);
        archMesh.castShadow = true; archMesh.receiveShadow = true;
        hcGd.group.add(archMesh);
      });
    }
    // covered corridor deck + low walls + gabled roof, full 60m span
    var deck = mkBox(corridorHalf*2, 0.3, BR_LEN, woodMat);
    place(deck, BR_X, DECK_Y, (BR_Z0+BR_Z1)/2);
    hcGd.group.add(deck);
    [-1,1].forEach(function(side){
      var wall = mkBox(0.3, 2.2, BR_LEN, hcGd.mat);
      place(wall, BR_X+side*corridorHalf, DECK_Y+1.1, (BR_Z0+BR_Z1)/2);
      hcGd.group.add(wall);
    });
    mpGableRoof(hcGdRoof.group, hcGdRoof.mat, 'z', BR_X, (BR_Z0+BR_Z1)/2, BR_Z0-2, BR_Z1+2, corridorHalf+0.3, DECK_Y+2.2, 2.0);
    registerPick(pickables, 'structure', BR_X, DECK_Y*0.5, (BR_Z0+BR_Z1)/2, corridorHalf*3, DECK_Y+3, BR_LEN,
      '尖頭アーチ橋 Pointed-Arch Bridge', 'グダニスコへ渡る尖頭アーチ5連の屋根付き回廊橋。堀の上の2本の橋脚に支えられ、高城側の1連は跳ね橋 [MH]。');
  })();

  /* ---- High Castle courtyard: cross-path + well (18-19m deep [PL]○) --
   * always visible (open-air), goes in interiorGroup like every other
   * castle's courtyard treatment. ---------------------------------- */
  var hcGrassMat = texMat(GRASS_COL2, 'turf');
  var courtLawn = mkBox(2*HC_COURT_HX, 0.28, 2*HC_COURT_HZ, hcGrassMat);
  place(courtLawn, 0, -0.16, 0);
  interiorGroup.add(courtLawn);
  var courtPathNS = mkBox(2.2, 0.3, 2*HC_COURT_HZ, cobbleMat);
  place(courtPathNS, 0, -0.14, 0);
  interiorGroup.add(courtPathNS);
  var courtPathEW = mkBox(2*HC_COURT_HX, 0.3, 2.2, cobbleMat);
  place(courtPathEW, 0, -0.14, 0);
  interiorGroup.add(courtPathEW);

  /* ---- TWO-STOREY CLOISTER ARCADE round the High Castle courtyard.
   * The single most recognisable interior at Malbork (see the reference
   * courtyard photograph: a continuous run of pointed arches on square
   * brick piers, doubled one above the other, wrapping all four sides).
   * The previous build left this courtyard as bare lawn + a cross path,
   * so the one view visitors know best had nothing in it at all. Goes in
   * interiorGroup -- it is open-air and enclosed by the wings, so it is
   * always visible, exactly like the lawn and the well already were. */
  (function hcCloister(){
    var arcMat  = texMat(BRICK_WALL, 'brick', { nrm: 0.9 });
    var darkMat = new T.MeshLambertMaterial({ color: NICHE_COL });
    var ax0 = -HC_COURT_HX + 0.6, ax1 = HC_COURT_HX - 0.6;
    var az0 = -HC_COURT_HZ + 0.6, az1 = HC_COURT_HZ - 0.6;
    var DEP = 2.2;
    [0, 1].forEach(function(lvl){
      var y0 = lvl * 5.6, hP = 4.3;
      mpArcade(interiorGroup, arcMat, darkMat, 'x', 0, az0 + DEP/2, ax0, ax1, y0, hP, DEP);
      mpArcade(interiorGroup, arcMat, darkMat, 'x', 0, az1 - DEP/2, ax0, ax1, y0, hP, DEP);
      mpArcade(interiorGroup, arcMat, darkMat, 'z', ax0 + DEP/2, 0, az0 + DEP + 0.4, az1 - DEP - 0.4, y0, hP, DEP);
      mpArcade(interiorGroup, arcMat, darkMat, 'z', ax1 - DEP/2, 0, az0 + DEP + 0.4, az1 - DEP - 0.4, y0, hP, DEP);
    });
    // lean-to pantile roof over the upper gallery, tying it to the wings
    [[az0 + DEP/2, -1], [az1 - DEP/2, 1]].forEach(function(p){
      var sl = mpLeanSlope(hcRoof.mat, 'x', ax0, ax1, p[0] - p[1]*DEP/2, p[0] + p[1]*DEP/2, 11.2, 12.6);
      hcRoof.group.add(sl);
    });
    [[ax0 + DEP/2, -1], [ax1 - DEP/2, 1]].forEach(function(p){
      var sl2 = mpLeanSlope(hcRoof.mat, 'z', az0 + DEP, az1 - DEP, p[0] - p[1]*DEP/2, p[0] + p[1]*DEP/2, 11.2, 12.6);
      hcRoof.group.add(sl2);
    });
    registerPick(pickables, 'structure', 0, 5.6, az1 - DEP/2, 2*HC_COURT_HX, 11.2, DEP*2,
      '中庭回廊 Cloister Arcade', '高城の中庭を四周する二層の回廊。尖頭アーチが連なるレンガゴシックの代表的な内観。');
  })();
  (function well(){
    var wx=-3, wz=3;
    var kerb = mkCyl(1.0,1.0,0.9,16, stoneDarkMat);
    place(kerb, wx, 0.45, wz);
    interiorGroup.add(kerb);
    [[-0.8,-0.8],[0.8,-0.8],[0.8,0.8],[-0.8,0.8]].forEach(function(p){
      var post = mkBox(0.16,2.2,0.16, woodMat);
      place(post, wx+p[0], 1.1, wz+p[1]);
      interiorGroup.add(post);
    });
    var canopy = mkCone(1.6, 1.1, 4, floorMat);
    canopy.rotation.y = Math.PI/4;
    place(canopy, wx, 2.75, wz);
    interiorGroup.add(canopy);
    registerPick(pickables, 'structure', wx, 1.2, wz, 2.4, 2.5, 2.4,
      '中庭の井戸 Courtyard Well', '深さ18〜19m [PL]。中庭の日常生活を支えた水源。');
  })();

  /* ---- HC interior rooms (revealed once the inner-tier cutaway fades
   * hcWallN/S/E/W + hcRoof + hcTower + hcApse + hcGd) -- same 4-room set
   * as castles/malbork.js, repositioned for the new rectangular plan. */
  var altar = mkBox(2.4, 1.3, 1.0, stoneDarkMat);
  place(altar, CH_X1-3, 0.65, APSE_CZ);
  interiorGroup.add(altar);
  /* Nave piers. These used to be three cylinders spaced 3m apart ACROSS
   * the 12m-deep north wing -- i.e. laid out at right angles to the
   * 38m-long church they were supposed to stand in, so they read as
   * three random posts. They now march down the length of the nave on
   * the church's own centre line, 6m apart, which is what carries the
   * rib vault added with the interior fit-out below. Neither the 38m
   * length nor the 14.4m height [MH] is touched. */
  var CH_PIER_X = [];
  for (var pw=0; pw<5; pw++){
    var pierX = CH_X0 + 7 + pw*6;
    CH_PIER_X.push(pierX);
    var pillar = mkCyl(0.42,0.5, CH_H-1.5, 8, stubMat);
    place(pillar, pierX, (CH_H-1.5)/2, CH_Z);
    interiorGroup.add(pillar);
  }
  mpPickRoom(CH_X0, CH_X1+APSE_R, HC_HZ-HC_WD_NS+1, HC_HZ+2, CH_H-1, '聖母マリア教会 St Mary’s Church',
    '北翼東寄りを占める修道会の主聖堂。長さ38m・高さ14.4m [MH]。後陣に祭壇を置く、騎士団国家の精神的中心。');
  var chX0=-16, chX1=4, chZ0=-HC_HZ+1, chZ1=-HC_HZ+HC_WD_NS-1;
  var chTable = mkBox(4.2, 0.7, 2.4, woodMat);
  place(chTable, (chX0+chX1)/2, 0.35, (chZ0+chZ1)/2);
  interiorGroup.add(chTable);
  mpPickRoom(chX0, chX1, chZ0, chZ1, HC_WALL_H-1, '参事会室 Chapter House',
    '南翼に置かれた評議の間。団長と幹部騎士たちがここで会議を開いた。');
  var rfX0=-HC_HX+1, rfX1=-HC_HX+HC_WD_EW-1, rfZ0=-8, rfZ1=8;
  /* Convent refectory pier row. Height was HC_WALL_H-0.6 = 21.4m, i.e.
   * the piers ran the full two-storey height of the wing and read as
   * scaffolding poles rather than as the columns of a vaulted hall. They
   * are now room-height (the hall's own 7.6m vault springs off them,
   * built with the fit-out below); the wing's 22m eave height itself is
   * unchanged. */
  var HCRF_H = 7.6;
  var HCRF_COL_Z = [rfZ0+2, rfZ0+8, rfZ0+14];
  for (var rp=0; rp<3; rp++){
    var rpillar = mkCyl(0.36,0.44, HCRF_H-1.0, 8, stubMat);
    place(rpillar, (rfX0+rfX1)/2, (HCRF_H-1.0)/2, HCRF_COL_Z[rp]);
    interiorGroup.add(rpillar);
  }
  mpPickRoom(rfX0, rfX1, rfZ0, rfZ1, HC_WALL_H-1, '食堂 Refectory',
    '西翼の食堂。リブヴォールト風の柱列が天井を支え、騎士たちが共同で食事をとった。');
  var gmX0=HC_HX-HC_WD_EW+1, gmX1=HC_HX-1, gmZ0=10, gmZ1=22;
  var gmBed = mkBox(2.2, 0.8, 3.4, darkWoodMat);
  place(gmBed, (gmX0+gmX1)/2, 0.4, (gmZ0+gmZ1)/2);
  interiorGroup.add(gmBed);
  mpPickRoom(gmX0, gmX1, gmZ0, gmZ1, HC_WALL_H-1, '大マスター旧居室 Grand Master’s Old Chamber',
    '東翼に残る、団長のかつての私室。後にノガト川沿いの新宮殿(中城)へ機能が移った。');

  /* ================================================================
   * HIGH <-> MIDDLE CASTLE dry ditch: 20m wide x 15m deep [BW]○, grass
   * floor (dry, not water) -- represented as a flat coloured band + low
   * retaining walls, matching malbork.js's own "sits above the noise
   * ceiling, no bank grading" simplification for water features.
   * ================================================================ */
  var DITCH_W = 20, DITCH_Z0 = HC_HZ, DITCH_Z1 = HC_HZ + DITCH_W;
  // NOTE: the ditch band was previously placed at GROUND_Y-0.6 / -0.1,
  // i.e. entirely *underneath* the flat ground plane at GROUND_Y -- the
  // whole feature was invisible. Raised above the plane so it reads.
  var ditchFloor = mkBox(2*HC_HX+30, 0.3, DITCH_W, ditchMat);
  place(ditchFloor, 0, GROUND_Y+0.2, (DITCH_Z0+DITCH_Z1)/2);
  root.add(ditchFloor);
  [DITCH_Z0, DITCH_Z1].forEach(function(z){
    var retain = mkBox(2*HC_HX+30, 1.2, 0.8, stoneDarkMat);
    place(retain, 0, GROUND_Y+0.6, z);
    root.add(retain);
  });
  registerPick(pickables, 'structure', 0, GROUND_Y+0.4, (DITCH_Z0+DITCH_Z1)/2, 2*HC_HX+20, 1.0, DITCH_W*0.9,
    '高城⇔中城の乾堀 Dry Ditch', '幅20m・深さ15m [BW]。水を張らない空堀で高城と中城を隔てる。');
  var hcMcBridge = mkBox(4.6, 0.3, DITCH_W+3, woodMat);
  place(hcMcBridge, 0, GROUND_Y+0.95, (DITCH_Z0+DITCH_Z1)/2);
  root.add(hcMcBridge);

  /* ================================================================
   * MIDDLE CASTLE Zamek Średni -- north of the dry ditch. ~80x100m,
   * plan is a trapezoid per [MH]; approximated here as a rectangle
   * (noted simplification -- the sheet gives no trapezoid vertex
   * coordinates to reconstruct the true taper). 3 wings (west/north/
   * east) enclose a ~75m courtyard [MH]○; south side is open, facing the
   * High Castle across the dry ditch. Tier 'outer' -- fades with the Low
   * Castle shell before the High Castle's own tier 'inner' shell does.
   * ================================================================ */
  var MC_HX = 40;                       // ~80m width [MH]○ (rectangular approximation of the trapezoid)
  var MC_Z0 = DITCH_Z1, MC_Z1 = MC_Z0 + 100; // ~100m depth [MH]○
  // MC_WD (wing depth) is unmeasured △. 13m (was 10m) leaves a 54x87m
  // courtyard inside the 80x100m block, which lines up with the sheet's
  // "courtyard ~75m long" figure once the open south side is accounted
  // for, and reads with the building mass the aerial photo shows rather
  // than as a thin picture-frame outline.
  var MC_WD = 13, MC_WALL_H = 17; // △ 推定 (both unmeasured; height kept lower than the High Castle's 22m per photos)

  /* FADE GROUPS -- one PER WING, not one for all three.
   * Bug this fixes: all three wings used to share a single 'mcWings'
   * group whose `dir` was {0,0,1}. updateFade tests that one direction
   * against the camera, so at any azimuth looking roughly north the WHOLE
   * Middle Castle -- west, north and east wings together -- dissolved at
   * once and the middle third of the complex simply vanished mid-zoom,
   * while at other azimuths none of it ever opened up. Each wing now
   * carries its own outward-facing normal, so only the wing the camera is
   * actually looking through fades and the other two stay standing, which
   * is what the two-tier cutaway is supposed to look like. */
  var mcWingW = mpMakeFadeGroup('mcWingWest',  {x:-1,z:0}, false, BRICK_WALL);
  var mcWingN = mpMakeFadeGroup('mcWingNorth', {x:0,z:1},  false, BRICK_WALL);
  var mcWingE = mpMakeFadeGroup('mcWingEast',  {x:1,z:0},  false, BRICK_WALL);
  var mcRoofFg = mpMakeFadeGroup('mcRoofs', null, true, ROOF_COL);
  var mcRoofFg2 = mpMakeFadeGroup('mcRoofsAlt', null, true, ROOF_COL2);
  var mcPalaceFg = mpMakeFadeGroup('mcPalace', {x:-1,z:0}, false, BRICK_WALL_V);

  var MC_WX = -MC_HX + MC_WD/2, MC_EX = MC_HX - MC_WD/2;
  /* Wings are no longer three identical extruded bars. In the reference
   * photograph taken north from the main tower, the west wing (Great
   * Refectory + Grand Master's Palace) is visibly the tallest and deepest
   * mass, the north wing steps down and is broken by the Infirmary's
   * stepped gable, and the east wing is lower again with the gatehouse
   * cutting through it. Each wing is therefore split into segments of
   * differing height, and every segment terminates in a stepped gable. */
  // WEST wing: two segments, the southern (refectory) one taller
  mpRange(mcWingW, mcRoofFg, gblOuter, MC_WX, MC_Z0 + 30, MC_WD, 60, MC_WALL_H + 2, 'z',
    { gable:'a', dormers:3 });
  mpRange(mcWingW, mcRoofFg2, gblOuter, MC_WX, MC_Z0 + 71, MC_WD - 1, 26, MC_WALL_H - 1.5, 'z',
    { gable:'none', dormers:2 });
  // NORTH wing: lower, and split into two segments of different height so
  // its ridge line steps rather than running dead level for 80m
  mpRange(mcWingN, mcRoofFg, gblOuter, -20, MC_Z1 - MC_WD/2, 40, MC_WD, MC_WALL_H - 1, 'x',
    { gable:'a', dormers:2 });
  mpRange(mcWingN, mcRoofFg2, gblOuter, 20, MC_Z1 - MC_WD/2, 40, MC_WD, MC_WALL_H - 2.5, 'x',
    { gable:'b', dormers:2 });
  // EAST wing: guest ranges either side of the Middle Castle gate
  mpRange(mcWingE, mcRoofFg2, gblOuter, MC_EX, MC_Z0 + 26, MC_WD - 1, 52, MC_WALL_H - 2, 'z',
    { gable:'a', dormers:2 });
  mpRange(mcWingE, mcRoofFg, gblOuter, MC_EX, MC_Z0 + 74, MC_WD - 1, 22, MC_WALL_H - 0.5, 'z',
    { gable:'none', dormers:1 });
  registerPick(pickables, 'structure', 0, MC_WALL_H*0.5, (MC_Z0+MC_Z1)/2, 2*MC_HX+6, MC_WALL_H, MC_Z1-MC_Z0+6,
    '中城 Middle Castle', '高城の北、約80x100m [MH](実測は台形、ここでは矩形近似)。西・北・東の三翼が中庭を囲む。南側は乾堀を挟んで高城に面する。');

  /* Middle Castle courtyard: cobbled apron round the edges with a big
   * lawn in the middle, matching the reference photograph taken north
   * from the main tower (cobbles against the ranges, mown grass in the
   * centre). Previously just two thin cross paths on bare ground. */
  (function mcCourtyard(){
    var x0=-MC_HX+MC_WD, x1=MC_HX-MC_WD, z0=MC_Z0+2, z1=MC_Z1-MC_WD;
    var apron = mkBox(x1-x0, 0.24, z1-z0, cobbleMat);
    place(apron, (x0+x1)/2, 0.12, (z0+z1)/2);
    interiorGroup.add(apron);
    var mcLawnMat = texMat(GRASS_COL2, 'turf');
    var lawn = mkBox((x1-x0)*0.56, 0.26, (z1-z0)*0.52, mcLawnMat);
    place(lawn, (x0+x1)/2 - 2, 0.14, (z0+z1)/2 + 4);
    interiorGroup.add(lawn);
  })();

  /* ---- Grand Master's Palace: WEST side, projecting from the west wing
   * [MH]◎, faces the Nogat river. Plan dims unmeasured -> 22x22m
   * assumed △. Height raised 20 -> 24m △: the sheet records the river
   * (west) elevation as 4 storeys + a mezzanine over a basement against
   * only 2 storeys on the courtyard side, and in the river photograph the
   * palace is unmistakably the tallest thing on the west front after the
   * main tower -- at 20m with a 6.5m ridge it sat lower than its own west
   * wing. It is now a proper tower-house: tall shaft, corbelled/stepped
   * upper storey, four octagonal corner turrets, a very steep hipped roof
   * and the big traceried hall windows that face the Nogat. */
  var GMP_W = 22, GMP_D = 22, GMP_H = 24;
  var GMP_CX = -MC_HX - GMP_W/2 + 3, GMP_CZ = MC_Z1 - 16;
  var gmpBody = mkBox(GMP_W, GMP_H, GMP_D, mcPalaceFg.mat);
  place(gmpBody, GMP_CX, GMP_H/2, GMP_CZ);
  mcPalaceFg.group.add(gmpBody);
  // battered base + corbel course marking the jettied upper storey
  var gmpBase = mkBox(GMP_W+1.6, 4.0, GMP_D+1.6, nicheMat);
  place(gmpBase, GMP_CX, 2.0, GMP_CZ);
  mcPalaceFg.group.add(gmpBase);
  var gmpCorb = mkBox(GMP_W+1.2, 0.55, GMP_D+1.2, trimMat);
  place(gmpCorb, GMP_CX, GMP_H*0.46, GMP_CZ);
  mcPalaceFg.group.add(gmpCorb);
  var trimBand = mkBox(GMP_W+0.9, 0.34, GMP_D+0.9, trimMat);
  place(trimBand, GMP_CX, GMP_H-0.6, GMP_CZ);
  mcPalaceFg.group.add(trimBand);
  // tall traceried hall windows to the river (west) and to north/south
  ['x-','z-','z+'].forEach(function(nrm){
    var off = (nrm==='x-') ? GMP_W/2+0.05 : GMP_D/2+0.05;
    mpLancetRow(mcPalaceFg.group, windowMat, nrm, GMP_CX, GMP_CZ, off, 4, 14, GMP_H*0.55, 5.2, 1.05);
    mpLancetRow(mcPalaceFg.group, windowMat, nrm, GMP_CX, GMP_CZ, off, 4, 14, GMP_H*0.20, 3.0, 0.8);
    mpBlindArcade(mcPalaceFg.group, nicheMat, nrm, GMP_CX, GMP_CZ, off-0.03, 5, 17, 5.0, GMP_H*0.34, 0.8);
  });
  // four slender corner turrets with conical caps
  [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function(s){
    var tx = GMP_CX + s[0]*(GMP_W/2-0.4), tz = GMP_CZ + s[1]*(GMP_D/2-0.4);
    var tw = mkCyl(1.5, 1.7, GMP_H+3.5, 8, mcPalaceFg.mat);
    place(tw, tx, (GMP_H+3.5)/2, tz);
    mcPalaceFg.group.add(tw);
    var tcap = mkCone(2.0, 5.0, 8, mcRoofFg.mat);
    place(tcap, tx, GMP_H+3.5+2.5, tz);
    mcRoofFg.group.add(tcap);
  });
  mpHipRoof(mcRoofFg.group, mcRoofFg.mat, GMP_CX, GMP_CZ, GMP_W+1.0, GMP_D+1.0, GMP_H, 13.5, 'z');
  registerPick(pickables, 'structure', GMP_CX, GMP_H*0.5, GMP_CZ, GMP_W+4, GMP_H, GMP_D,
    '大団長宮殿 Grand Master’s Palace', 'ノガト川に面する中城西側、西翼から張り出す団長の政庁兼住居 [MH]。西面は4階+中2階の塔状住宅。平面寸法は非公開のため22x22mと推定。');

  /* ---- Great Refectory Wielki Refektarz: west wing, 30x15m [MH]◎,
   * ceiling ~9.5m, 3 granite octagonal columns (3.3m tall) [MH]◎, 14
   * pointed-arch windows [MH]◎. Embedded in the west wing, south of the
   * palace so the two don't overlap. */
  var RF_W = 15, RF_D = 30, RF_H = 9.5;
  var RF_CZ = MC_Z0 + 24;
  registerPick(pickables, 'structure', MC_WX, RF_H*0.5, RF_CZ, RF_W, RF_H, RF_D,
    '大食堂 Great Refectory', '西翼、30x15m [MH]。天井高9〜9.7m、花崗岩の八角柱3本(柱高3.3m)、尖頭アーチ窓14枚、収容400人。');
  /* The three documented granite monoliths. Previously three bare grey
   * cylinders; the reference photographs show near-black octagonal
   * granite shafts standing on a pale stone base with a carved pale
   * capital, from which the palm vault springs. The 3.3m [MH] shaft
   * height is unchanged -- the base sits below it and the capital above
   * it, exactly as the photographs read. The vault they carry is built
   * with the rest of the interior fit-out further down this file. */
  var RF_COL_Z = [RF_CZ-9, RF_CZ, RF_CZ+9];
  for (var rc=0; rc<3; rc++){
    var col = mkCyl(0.5, 0.5, 3.3, 8, graniteMat);
    place(col, MC_WX, 0.5 + 1.65, RF_COL_Z[rc]);   // 0.5 = base block height
    interiorGroup.add(col);
    var colBase = mkCyl(0.8, 0.92, 0.5, 8, plasterMat);
    place(colBase, MC_WX, 0.25, RF_COL_Z[rc]);
    interiorGroup.add(colBase);
    var colCap = mkCyl(0.86, 0.62, 0.62, 8, plasterMat);
    place(colCap, MC_WX, 0.5 + 3.3 + 0.31, RF_COL_Z[rc]);
    interiorGroup.add(colCap);
  }
  /* The 14 documented pointed-arch windows, now as full-height lancets
   * on the river face -- the Great Refectory's west wall is a near-
   * continuous screen of glass in the photographs, not a band of small
   * punched holes. */
  for (var rw=0; rw<14; rw++){
    var rwz = RF_CZ - RF_D/2 + 1.2 + rw*((RF_D-2.4)/13);
    mpLancet(mcWingW.group, windowMat, MC_WX-MC_WD/2*0.99, RF_H*0.26, rwz, Math.PI, 0.9, 4.6, 0.5);
  }

  /* ---- Infirmary Firmaria: north wing, west-leaning [MH][BW]○, whose
   * stepped gable is its signature silhouette. Now a projecting block
   * with a real stepped gable on its north face (the old call put four
   * bare terracotta-coped boxes on top of a wall and nothing else).
   * Dims unmeasured -> 推定. */
  var IF_CX = -22, IF_CZ = MC_Z1 - MC_WD/2, IF_W = 18, IF_H = MC_WALL_H + 2.5;
  var ifRise = mpRange(mcWingN, mcRoofFg, gblOuter, IF_CX, IF_CZ + 1.5, IF_W, MC_WD + 3, IF_H, 'z',
    { gable:'b', steps:5, dormers:0 });
  registerPick(pickables, 'structure', IF_CX, IF_H*0.5, IF_CZ, IF_W, IF_H + ifRise, MC_WD,
    '施療院 Infirmary', '北翼西寄り [MH][BW]。階段状の破風が目立つ。寸法は非公開のため近似。');

  /* ---- Middle Castle gatehouse: the complex's own main entrance is on
   * the EAST side of the Middle Castle (marked "Eingang" on the Commons
   * ground plan of the Ordensburg), between the two east-wing ranges.
   * Previously nothing marked it and the east wing ran unbroken. */
  (function mcGate(){
    var gz = MC_Z0 + 57, gw = 11, gd = MC_WD + 4, gh = MC_WALL_H + 7;
    var body = mkBox(gd, gh, gw, mcWingE.mat);
    place(body, MC_EX + 1, gh/2, gz);
    mcWingE.group.add(body);
    var arch = mkBox(gd*1.02, 6.2, 4.6, windowMat);
    place(arch, MC_EX + 1, 3.1, gz);
    interiorGroup.add(arch);
    mpBlindArcade(mcWingE.group, nicheMat, 'x+', MC_EX + 1 + gd/2, gz, 0.06, 3, 7.5, 8.0, gh-11, 0.9);
    mpAddCrenellations(mcWingE.group, mcWingE.mat, MC_EX + 1, gz, gw, Math.PI/2, gh, gd, 1.2);
    mpSteppedGable(gblOuter.brick, gblOuter.trim, gblOuter.niche, 'x',
      MC_EX + 1 + gd/2, gz, gw/2, gh, 7.0, 4, 1.1);
    var cap = mkCone(gw*0.62, 8.0, 4, mcRoofFg.mat);
    cap.rotation.y = Math.PI/4;
    place(cap, MC_EX + 1, gh + 1.2 + 4.0, gz);
    mcRoofFg.group.add(cap);
    registerPick(pickables, 'structure', MC_EX + 1, gh*0.45, gz, gd, gh, gw*1.4,
      '中城門 Middle Castle Gate', '中城東側の主入口 [平面図]。ここから城内の中枢へ入る。');
  })();

  /* ---- East wing: guest chambers + St Bartholomew's chapel (dims
   * unmeasured -> 推定; footprint/position only). */
  registerPick(pickables, 'structure', MC_EX, MC_WALL_H*0.5, MC_Z0 + 26, MC_WD, MC_WALL_H, 52,
    '東翼(賓客居室) East Wing', '賓客用居室と聖バルトロメイ礼拝堂 [MH]。北翼/東翼の呼称には資料間で揺れがある。');

  /* ================================================================
   * MIDDLE <-> LOW CASTLE moat: 20m wide x 10m deep [BW]○, water-filled
   * (assumed, per the sheet's general "堀は水堀" note -- extrapolated to
   * this second moat since no separate wet/dry statement is given for
   * it specifically).
   * ================================================================ */
  var OUTMOAT_W = 20, OUTMOAT_Z0 = MC_Z1, OUTMOAT_Z1 = MC_Z1 + OUTMOAT_W;
  var outMoatPlane = new T.Mesh(new T.PlaneGeometry(2*MC_HX+70, OUTMOAT_W), moatWaterMat);
  outMoatPlane.rotation.x = -Math.PI/2;
  place(outMoatPlane, 0, GROUND_Y+0.35, (OUTMOAT_Z0+OUTMOAT_Z1)/2);
  root.add(outMoatPlane);
  registerPick(pickables, 'structure', 0, GROUND_Y+0.35, (OUTMOAT_Z0+OUTMOAT_Z1)/2, 2*MC_HX+40, 1.0, OUTMOAT_W*0.85,
    '中城外周の堀 Middle Castle Outer Moat', '幅20m・深さ10m [BW]。中城と低城を隔てる水堀。');
  var mcLcBridge = mkBox(6.0, 0.3, OUTMOAT_W+3, woodMat);
  place(mcLcBridge, 0, GROUND_Y+0.5, (OUTMOAT_Z0+OUTMOAT_Z1)/2);
  root.add(mcLcBridge);

  /* ================================================================
   * LOW CASTLE Zamek Niski / Przedzamcze -- 140x270m rectangle [MH][ZO]
   * ◎, northernmost and largest block. Buildings arranged in 4
   * north-south rows [MH]○, incl. the Karwan (armoury/coach house,
   * 20x45m) and the round Maszynkowa Tower (dia 8.7m, wall 2.6m thick,
   * height <29m). Single castellated perimeter wall (height/thickness
   * unmeasured -> 推定). Tier 'outer'.
   * ================================================================ */
  var LC_HX = 70, LC_Z0 = OUTMOAT_Z1, LC_Z1 = LC_Z0 + 270; // [MH][ZO]◎ 140x270m
  // wall height/thickness are both unmeasured △. 6m/1.3m (the previous
  // values) read as a garden fence next to a 140m-wide ward and made the
  // whole outer bailey look like an empty paddock; 8.5m/1.8m matches the
  // proportion the aerial photograph shows against the ranges inside.
  var LC_WALL_H = 8.5, LC_WALL_T = 1.8; // △ 推定
  var LC_GATE_Z = (LC_Z0+LC_Z1)/2, LC_GATE_W = 4.6, LC_GATE_H = 5.2;

  var lcWallN = mpMakeFadeGroup('lcWallN', {x:0,z:1}, false, BRICK_WALL);
  var lcWallS = mpMakeFadeGroup('lcWallS', {x:0,z:-1}, false, BRICK_WALL);
  var lcWallE = mpMakeFadeGroup('lcWallE', {x:1,z:0}, false, BRICK_WALL);
  var lcWallW = mpMakeFadeGroup('lcWallW', {x:-1,z:0}, false, BRICK_WALL);
  var lcRoofFg = mpMakeFadeGroup('lcRoofs', null, true, ROOF_COL);
  var lcRoofFg2 = mpMakeFadeGroup('lcRoofsAlt', null, true, ROOF_COL2);
  /* Ranges are split into a WEST and an EAST fade group rather than one
   * 'lcBuildings' bucket facing {0,0,1}: with a single north-facing
   * normal every building in the 140x270m outer bailey faded in unison
   * the moment the camera swung north, and never faded from any other
   * side. Split east/west, only the row block the camera is actually
   * looking through opens up -- the same fix applied to the Middle
   * Castle's wings above. */
  // the two halves also carry slightly different brick tones, which stops
  // 20-odd ranges in one ward from reading as a single flat colour field
  var lcBuildW = mpMakeFadeGroup('lcBuildingsWest', {x:-1,z:0}, false, BRICK_WALL);
  var lcBuildE = mpMakeFadeGroup('lcBuildingsEast', {x:1,z:0}, false, BRICK_WALL_V);
  var lcBuildFg = lcBuildW; // kept for the few shared pieces below
  var lcGateFg = mpMakeFadeGroup('lcGate', {x:1,z:0}, false, BRICK_WALL_V);

  mpWingWall(lcWallN, 0, LC_Z1, 2*LC_HX, 0, LC_WALL_H, LC_WALL_T, 0);
  mpWingWall(lcWallS, 0, LC_Z0, 2*LC_HX, Math.PI, LC_WALL_H, LC_WALL_T, 0);
  mpWingWall(lcWallW, -LC_HX, (LC_Z0+LC_Z1)/2, LC_Z1-LC_Z0, Math.PI/2, LC_WALL_H, LC_WALL_T, 0);
  var lcEastSeg = (LC_Z1-LC_Z0-LC_GATE_W)/2;
  mpWingWall(lcWallE, LC_HX, LC_Z0+lcEastSeg/2, lcEastSeg, -Math.PI/2, LC_WALL_H, LC_WALL_T, 0);
  mpWingWall(lcWallE, LC_HX, LC_Z1-lcEastSeg/2, lcEastSeg, -Math.PI/2, LC_WALL_H, LC_WALL_T, 0);
  var lcGateLintel = mkBox(LC_WALL_T, LC_WALL_H-LC_GATE_H, LC_GATE_W, lcWallE.mat);
  place(lcGateLintel, LC_HX, LC_GATE_H+(LC_WALL_H-LC_GATE_H)/2, LC_GATE_Z, -Math.PI/2);
  lcWallE.group.add(lcGateLintel);
  registerPick(pickables, 'structure', 0, LC_WALL_H*0.5, (LC_Z0+LC_Z1)/2, 2*LC_HX+6, LC_WALL_H, LC_Z1-LC_Z0+6,
    '低城 Low Castle', '複合体最北端、140x270mの矩形 [MH][ZO]。建物が南北方向に4列並ぶ、修道会最大の外郭区画。');

  // corner + gate towers
  [[-LC_HX,LC_Z0],[LC_HX,LC_Z0],[-LC_HX,LC_Z1],[LC_HX,LC_Z1]].forEach(function(p){
    mpSmallTower(lcWallN, p[0], p[1], true, 4.5, 11, 4.6, lcRoofFg);
  });
  var GATE_TOWER_W = 9, GATE_TOWER_D = 7, GATE_TOWER_H = 16;
  var gatePillarW = (GATE_TOWER_W-LC_GATE_W)/2;
  // gate tower faces east (through-opening runs along Z, the wall's own axis)
  [-1,1].forEach(function(side){
    var lz = side*(LC_GATE_W/2+gatePillarW/2);
    var pillar = mkBox(GATE_TOWER_D, GATE_TOWER_H, gatePillarW, lcGateFg.mat);
    place(pillar, LC_HX, GATE_TOWER_H/2, LC_GATE_Z+lz);
    lcGateFg.group.add(pillar);
  });
  var gateLintel2 = mkBox(GATE_TOWER_D, GATE_TOWER_H-LC_GATE_H, LC_GATE_W, lcGateFg.mat);
  place(gateLintel2, LC_HX, LC_GATE_H+(GATE_TOWER_H-LC_GATE_H)/2, LC_GATE_Z);
  lcGateFg.group.add(gateLintel2);
  mpAddCrenellations(lcGateFg.group, lcGateFg.mat, LC_HX, LC_GATE_Z, GATE_TOWER_W, Math.PI/2, GATE_TOWER_H, GATE_TOWER_D, 1.0);
  /* 低城の主門にも旗を2本(門は城の顔で、ここが唯一の住人の出入口)。
   * 竿は門塔の南北の隅、布は東(城外)へ流す = ry 0 のまま +X 側。 */
  mpFlag(lcGateFg, LC_HX, LC_GATE_Z - GATE_TOWER_W*0.34, GATE_TOWER_H + 1.0, { seed: 1.7, poleH: 5.0, w: 2.9, h: 1.8 });
  mpFlag(lcGateFg, LC_HX, LC_GATE_Z + GATE_TOWER_W*0.34, GATE_TOWER_H + 1.0, { seed: 3.9, poleH: 5.0, w: 2.9, h: 1.8 });
  var gateRoof = mkCone(GATE_TOWER_W*0.6, 6.0, 4, lcRoofFg.mat);
  gateRoof.rotation.y = Math.PI/4;
  place(gateRoof, LC_HX, GATE_TOWER_H+0.9+3.0, LC_GATE_Z);
  lcRoofFg.group.add(gateRoof);
  (function openGateDoors(){
    var leafLen = GATE_TOWER_D*0.42, leafH = LC_GATE_H*0.94;
    [-1,1].forEach(function(side){
      var lz = side*(LC_GATE_W/2-0.08);
      var leaf = mkBox(leafLen, leafH, 0.16, woodMat);
      place(leaf, LC_HX+GATE_TOWER_D/2-leafLen/2-0.15, leafH/2+0.05, LC_GATE_Z+lz);
      interiorGroup.add(leaf);
    });
  })();
  registerPick(pickables, 'structure', LC_HX, GATE_TOWER_H*0.4, LC_GATE_Z, GATE_TOWER_D*1.8, GATE_TOWER_H*0.8, GATE_TOWER_W*1.4,
    '東門 East Gate', '低城東壁の主門。低城への出入りはここから。');

  // Maszynkowa Tower: round, dia 8.7m -> r=4.35 ○, wall thickness 2.6m
  // (noted, not separately modelled as a hollow shell), height <29m -> 26m used
  var MASZ_R = 4.35, MASZ_H = 26;
  var maszBody = mkCyl(MASZ_R, MASZ_R*1.03, MASZ_H, 16, lcWallW.mat);
  place(maszBody, -LC_HX, MASZ_H/2, LC_Z0+40);
  lcWallW.group.add(maszBody);
  var maszRoof = mkCone(MASZ_R*1.2, 6.5, 16, lcRoofFg.mat);
  place(maszRoof, -LC_HX, MASZ_H+3.25, LC_Z0+40);
  lcRoofFg.group.add(maszRoof);
  registerPick(pickables, 'structure', -LC_HX, MASZ_H*0.5, LC_Z0+40, MASZ_R*2.4, MASZ_H, MASZ_R*2.4,
    'マシュランコヴァ塔 Maszynkowa Tower', '円形、直径8.7m・壁厚2.6m・高さ29m未満。低城西壁を守る円塔。');

  // intermediate wall towers along the two 270m-long flanks and the
  // 140m north wall -- the corner towers alone left ~130m of unbroken
  // wall reading as a bare fence line. Heights/positions △ 推定 (no
  // survey table for the outer-ward towers), spacing chosen so no run of
  // curtain exceeds ~70m, matching the aerial photograph's rhythm.
  [ {x:-LC_HX, z:LC_Z0+105}, {x:-LC_HX, z:LC_Z0+170}, {x:-LC_HX, z:LC_Z0+230},
    {x: LC_HX, z:LC_Z0+58},  {x: LC_HX, z:LC_Z0+215} ].forEach(function(p){
    mpSmallTower(p.x < 0 ? lcWallW : lcWallE, p.x, p.z, false, 3.4, LC_WALL_H+5.5, 5.0, lcRoofFg);
  });
  [-36, 36].forEach(function(tx){
    mpSmallTower(lcWallN, tx, LC_Z1, false, 3.4, LC_WALL_H+5.5, 5.0, lcRoofFg);
    mpSmallTower(lcWallS, tx, LC_Z0, false, 3.4, LC_WALL_H+4.0, 4.6, lcRoofFg);
  });

  /* ---- LOW CASTLE / VORBURG BUILDING FABRIC ---------------------------
   * REBUILT against the user's aerial and satellite photographs, which
   * contradict the "buildings in four north-south rows" reading the
   * previous table was built on.
   *
   * What the previous build did: 18 row segments + 4 cross ranges + the
   * Karwan, packed four abreast across the full 140m width with 8m
   * service lanes between them. From above that is a warehouse district
   * -- roofs edge to edge over practically the whole ward.
   *
   * What the photographs actually show: the Vorburg is a LARGE OPEN
   * WALLED SPACE. Its buildings stand in a ring AGAINST THE CURTAIN --
   * a long range down the river (west) side, another down the east side
   * either side of the gate, a block across the north end -- and the
   * whole middle of the ward is grass: mown lawn, a formal garden laid
   * out in rectangular beds, an orchard, and open working yards. Roofs
   * cover maybe a quarter of the enclosure, not three quarters.
   *
   * So the layout is now a PERIMETER RING, and the 140m width divides
   * into far simpler bands:
   *   west range -68.5..-46.5 | open ward -46..+46 | east range +46.5..+68.5
   * with a north range across z LC_Z1-20..LC_Z1-4 and the south and
   * south-east corners left open. Nothing stands in the middle: every
   * farmer wander box, the guard patrol and all the planting live in the
   * open ward, and by construction none of them can intersect a building.
   *
   * Range widths/heights remain △ 推定 (no survey table exists for the
   * outer-ward ranges); only the Karwan's 20x45m footprint is measured.
   * `z` values are offsets from LC_Z0; `x` is the range centreline.
   *
   * The seven ranges that carry furnished interiors (Karwan, storehouse,
   * stables, bakehouse, workshops/granary, smithy, and -- until it moved
   * out of the castle entirely -- St Lawrence's) are called out in the
   * table so the fit-out section further down can be shifted to match in
   * one place instead of re-authoring every prop coordinate.
   * ------------------------------------------------------------------ */
  var LC_WROW = -57.5, LC_EROW = 57.5;   // range centrelines, hard against the curtain
  var KARWAN_CZ = LC_Z0 + 34.5;          // 20x45m [measured]○, south end of the west range
  function lcFg(x){ return x < 0 ? lcBuildW : lcBuildE; }
  function lcRoof(i){ return (i % 2) ? lcRoofFg2 : lcRoofFg; }
  var lcSegs = [
    // --- WEST RANGE, against the river curtain ------------------------
    { x:LC_WROW, w:20, z0:12,  z1:57,  h:13.0, gable:'both', dormers:3, steps:5 }, // Karwan
    { x:LC_WROW, w:22, z0:66,  z1:116, h:12.5, gable:'both', dormers:3 },          // storehouse
    { x:LC_WROW, w:20, z0:124, z1:170, h:11.0, gable:'a',    dormers:2 },          // stables
    { x:-58.5,   w:18, z0:202, z1:246, h:9.5,  hip:true },
    // --- EAST RANGE, either side of the main gate (gap z 124..148) -----
    { x:LC_EROW, w:20, z0:12,  z1:60,  h:11.5, gable:'both', dormers:3 },
    { x:LC_EROW, w:22, z0:68,  z1:124, h:13.0, gable:'both', dormers:3, steps:5 }, // workshops/granary
    { x:58.5,    w:14, z0:148, z1:176, h:6.5,  gable:'both', steps:3 },            // smithy
    { x:LC_EROW, w:20, z0:184, z1:236, h:10.0, gable:'both', dormers:3 }
  ];
  lcSegs.forEach(function(s, i){
    var z0 = LC_Z0 + s.z0, z1 = LC_Z0 + s.z1;
    mpRange(lcFg(s.x), lcRoof(i), gblOuter, s.x, (z0+z1)/2, s.w, z1-z0, s.h, 'z',
      { gable: s.gable, hip: s.hip, dormers: s.dormers, steps: s.steps });
  });
  /* NORTH RANGE + the bakehouse, both running EAST-WEST. The north block
   * closes the top of the ward (clearly a single long roof in the
   * satellite frame); the bakehouse is a short spur projecting inward off
   * the west range, which is what keeps the middle of the ward clear
   * while still giving the ovens a wall to back on to. */
  mpRange(lcBuildE, lcRoofFg, gblOuter, 4, LC_Z1 - 12, 58, 16, 10.5, 'x',
    { gable:'both', dormers:3, steps:4 });
  mpRange(lcBuildW, lcRoofFg2, gblOuter, -55, LC_Z0 + 186, 26, 14, 9.5, 'x',
    { hip:true });                                                                 // bakehouse

  // Karwan cart doors (the range shell itself is the first lcSegs entry)
  [-1,1].forEach(function(sg){
    var door = mkBox(0.5, 5.4, 3.4, windowMat);
    place(door, LC_WROW + sg*10.1, 2.7, KARWAN_CZ - 8);
    interiorGroup.add(door);
    var door2 = mkBox(0.5, 5.4, 3.4, windowMat);
    place(door2, LC_WROW + sg*10.1, 2.7, KARWAN_CZ + 8);
    interiorGroup.add(door2);
  });
  registerPick(pickables, 'structure', LC_WROW, 6.5, KARWAN_CZ, 20, 13.0, 45,
    'カルワン Karwan', '武器庫兼車庫、20x45m。低城内の軍需・輸送を支えた実務施設。西列の南端、川側の城壁に接して建つ。');

  /* ---- ST LAWRENCE'S CHURCH -- moved OUT of the castle -------------
   * The previous build stood it in the middle of the Vorburg. It is not
   * in the castle at all: on the satellite frame the Church of St
   * Lawrence is labelled out in the TOWN, north-north-east of the
   * complex, on the far side of the road that runs past the Low Castle's
   * north front. It is rebuilt here at that position together with a
   * handful of townhouses, so the north end of the site reads as castle
   * -> road -> town rather than as more castle.
   *
   * Being outside the walls, the church and its neighbours go into
   * NON-FADING plain groups (mpPlainGroup): the cutaway opens the castle,
   * and the town has no business dissolving with it.
   * ------------------------------------------------------------------ */
  var CHAPEL_CX = 34, CHAPEL_CZ = LC_Z1 + 52;
  var CHAPEL_H = 12.5;
  var townBrick = mpPlainGroup(BRICK_WALL_V);
  var townRoof  = mpPlainGroup(ROOF_COL);
  var townGbl   = { brick: mpPlainGroup(BRICK_WALL_V), trim: mpPlainGroup(WHITE_TRIM),
                    niche: mpPlainGroup(NICHE_COL) };
  var chapelBody = mkBox(12, CHAPEL_H, 20, townBrick.mat);
  place(chapelBody, CHAPEL_CX, CHAPEL_H/2, CHAPEL_CZ);
  townBrick.group.add(chapelBody);
  for (var cb=0; cb<4; cb++){
    var cbz = CHAPEL_CZ - 7.5 + cb*5;
    [-1,1].forEach(function(sg3){
      var but = mkBox(1.9, CHAPEL_H-1.5, 1.1, townBrick.mat);
      place(but, CHAPEL_CX + sg3*6.6, (CHAPEL_H-1.5)/2, cbz);
      townBrick.group.add(but);
      var bc = mkBox(2.2, 0.28, 1.4, trimMat);
      place(bc, CHAPEL_CX + sg3*6.6, CHAPEL_H-1.5, cbz);
      townBrick.group.add(bc);
    });
  }
  ['x-','x+'].forEach(function(nrm){
    mpLancetRow(townBrick.group, windowMat, nrm, CHAPEL_CX, CHAPEL_CZ, 6.1, 4, 14, 4.2, 5.0, 0.95);
  });
  mpGableRoof(townRoof.group, townRoof.mat, 'z', CHAPEL_CX, CHAPEL_CZ, CHAPEL_CZ-10, CHAPEL_CZ+10, 6.3, CHAPEL_H, 9.0, false);
  [-1,1].forEach(function(sg4){
    mpSteppedGable(townGbl.brick, townGbl.trim, townGbl.niche, 'z',
      CHAPEL_CX, CHAPEL_CZ + sg4*10, 6.0, CHAPEL_H, 9.0, 5, 1.0);
  });
  var spire = mkCone(1.2, 6.5, 8, townRoof.mat);
  place(spire, CHAPEL_CX, CHAPEL_H + 9.0 + 3.0, CHAPEL_CZ);
  townRoof.group.add(spire);
  var cross = mkBox(0.16, 1.6, 0.16, goldMat);
  place(cross, CHAPEL_CX, CHAPEL_H + 9.0 + 6.3 + 0.8, CHAPEL_CZ);
  townRoof.group.add(cross);
  registerPick(pickables, 'structure', CHAPEL_CX, CHAPEL_H*0.5, CHAPEL_CZ, 12, CHAPEL_H, 20,
    '聖ラウレンティウス教会 Church of St Lawrence', '城内ではなく、低城の北の道路を挟んだ市街地に建つ教区教会。衛星写真の位置に合わせて城外へ出した。');

  /* the townhouses flanking it -- a short row of gabled burgher houses
   * along the road, enough to read as "the town starts here" */
  [ { x: 8, z: LC_Z1 + 42, w:13, d:10, h:8.0 },
    { x: 8, z: LC_Z1 + 62, w:12, d:11, h:7.0 },
    { x: 60, z: LC_Z1 + 40, w:14, d:11, h:8.5 },
    { x: 62, z: LC_Z1 + 64, w:12, d:10, h:7.5 },
    { x: 34, z: LC_Z1 + 78, w:16, d:11, h:9.0 }
  ].forEach(function(h, i){
    mpRange(townBrick, townRoof, townGbl, h.x, h.z, h.w, h.d, h.h, i%2 ? 'x' : 'z',
      { gable:'both', steps:3, pilasters:false });
  });
  // the road itself, running east-west between castle and town
  (function townRoad(){
    var road = mkBox(210, 0.24, 9.0, cobbleMat);
    place(road, -6, 0.13, LC_Z1 + 24);
    root.add(road);
  })();

  /* ---- LOW CASTLE OPEN WARD ----------------------------------------
   * One broad lawn filling everything the perimeter ranges do not, with
   * a cobbled service lane running just inside each range, the gate lane
   * crossing from the east gate, and a working square in front of the
   * gate. This is the "large open walled space" the aerial shows, and it
   * is what the four rows of sheds used to bury.
   * ------------------------------------------------------------------ */
  (function lowCastleWard(){
    /* Mown-lawn tone. GRASS_COL2 (0x6c8a52, the High Castle garth's grass)
     * was tried first and, multiplied by the ~1.95 a day-lit horizontal
     * face gets, a 92 x 230m slab of it came back as a blown-out lime
     * sports pitch that hijacked the whole frame. Pulled down to just
     * above the surrounding meadow so it still reads as kept ground. */
    var lawnMat = texMat(0x627f4a, 'turf');
    var lawn = mkBox(92, 0.22, LC_Z1-LC_Z0-24, lawnMat);
    place(lawn, 0, 0.11, (LC_Z0+LC_Z1)/2 - 4);
    interiorGroup.add(lawn);
    [-42, 42].forEach(function(lx){          // service lanes inside each range
      var lane = mkBox(5.0, 0.24, LC_Z1-LC_Z0-30, cobbleMat);
      place(lane, lx, 0.13, (LC_Z0+LC_Z1)/2 - 4);
      interiorGroup.add(lane);
    });
    var spine = mkBox(4.0, 0.24, LC_Z1-LC_Z0-40, cobbleMat);   // north-south spine path
    place(spine, 0, 0.13, (LC_Z0+LC_Z1)/2 - 4);
    interiorGroup.add(spine);
    var lane2 = mkBox(LC_HX+46, 0.24, 6.0, cobbleMat);         // east gate lane
    place(lane2, LC_HX - (LC_HX+46)/2, 0.13, LC_GATE_Z);
    interiorGroup.add(lane2);
    var sq = mkBox(24, 0.26, 22, cobbleMat);                   // working square inside the gate
    place(sq, 34, 0.14, LC_GATE_Z);
    interiorGroup.add(sq);
  })();

  /* ================================================================
   * NOGAT RIVER + the terraced west front
   * ================================================================
   * The water plane now fills the valley section cut above: ~204m bank
   * to bank, its east shore only ~45m from the Low Castle's west curtain
   * and ~9m below it. Sized off the user's satellite frame, where the
   * river measures out at roughly the width of the whole complex and the
   * strip between wall and water is a promenade, not a field.
   *
   * The plane deliberately runs far past both ends of the castle (the
   * Nogat does not stop at the walls) and stays in `root` so it takes the
   * same ZOFF re-centring as everything else authored in sheet
   * coordinates. Its east and west edges tuck UNDER the bank slopes of
   * the terrain strip, so the shoreline is drawn by the terrain, not by
   * the rectangle -- no hard blue edge anywhere.
   * ================================================================ */
  var RIVER_W = WATER_X1 - WATER_X0;                   // -204 (signed, west-ward)
  var RIVER_CX = (WATER_X0 + WATER_X1)/2;              // -216
  var RIVER_Z0 = -920, RIVER_Z1 = 1260;
  var river = new T.Mesh(new T.PlaneGeometry(Math.abs(RIVER_W), RIVER_Z1-RIVER_Z0), riverMat);
  river.rotation.x = -Math.PI/2;
  place(river, RIVER_CX, WATER_Y, (RIVER_Z0+RIVER_Z1)/2);
  root.add(river);
  registerPick(pickables, 'structure', RIVER_CX, WATER_Y, (LC_Z1 + GD_CZ)/2,
    Math.abs(RIVER_W)*0.8, 1.0, (LC_Z1 - GD_CZ)*0.9,
    'ノガト川 Nogat River', '城のすぐ西を流れる幅約200mの大河。城は川面から約9m高い段丘の上に立ち、段状の壁が川へ向かって降りる [MH]。舟運により建材や食料を運んだ生命線。');

  /* ---- the stepped wall lines falling to the river ------------------
   * Read straight off the user's oblique aerial: from the water up, a low
   * RIVERSIDE WALL studded with round towers under tall conical red
   * roofs; above and behind it, on the middle terrace, the OUTER
   * ENCEINTE with square towers under pyramid roofs; above that again the
   * castle's own curtain. Three wall heads at three levels is what gives
   * Malbork's river front its stepped silhouette, and it was completely
   * absent before -- the old build had exactly one wall line and flat
   * ground.
   *
   * Both runs are welded (mpBoxSoup / mpLongWall): ~590m of crenellated
   * curtain apiece costs 2 draw calls instead of ~250.
   * ------------------------------------------------------------------ */
  var TERR_Z0 = -150, TERR_Z1 = LC_Z1 + 6;
  var RIVWALL_X = -102, OUTWALL_X = -87;
  var rivWallFg = mpMakeFadeGroup('riverWall',  {x:-1,z:0}, false, BRICK_WALL);
  var outWallFg = mpMakeFadeGroup('outerWall',  {x:-1,z:0}, false, BRICK_WALL_V);
  var terrRoofFg= mpMakeFadeGroup('terraceRoofs', null, true, ROOF_COL);
  mpLongWall(rivWallFg, 'z', RIVWALL_X, TERR_Z0, TERR_Z1, PROM_Y-0.6, -1.4, 1.5, { merlonH: 1.0 });
  mpLongWall(outWallFg, 'z', OUTWALL_X, TERR_Z0, TERR_Z1, TER_MID_Y-0.6, 2.4, 1.9, { merlonH: 1.2 });

  /* tower on a terrace: body from an arbitrary base level, tall steep cap.
   * mpSmallTower always stands its body on y=0, which is exactly what the
   * terraces cannot do. */
  function mpTerraceTower(fg, roofFg, cx, cz, round, r, baseY, topY, roofH){
    var h = topY - baseY;
    var body = round ? mkCyl(r, r*1.06, h, 12, fg.mat) : mkBox(r*1.85, h, r*1.85, fg.mat);
    place(body, cx, baseY + h/2, cz);
    fg.group.add(body);
    var cap = round ? mkCone(r*1.3, roofH, 12, roofFg.mat) : mkCone(r*1.38, roofH, 4, roofFg.mat);
    if (!round) cap.rotation.y = Math.PI/4;
    place(cap, cx, topY + roofH/2, cz);
    roofFg.group.add(cap);
  }
  /* Round riverside towers. Their CAPS are the point: in the reference
   * river photograph the two towers on the bank are read almost entirely
   * by their enormously tall, steep conical red roofs, which stand about
   * as high again as the tower below them. A 9.5m cap on a 4m tower came
   * back off the renderer as a pair of traffic cones, so the roof is now
   * 15m on a wider 4.4m drum -- the proportion the photograph shows. */
  [-118, -34, 52, 148, 244, 340, 424].forEach(function(tz){
    mpTerraceTower(rivWallFg, terrRoofFg, RIVWALL_X, tz, true, 4.4, PROM_Y-0.6, 3.4, 15.0);
  });
  // square towers on the outer enceinte, one level up
  [-100, 130, 250, 366].forEach(function(tz){
    mpTerraceTower(outWallFg, terrRoofFg, OUTWALL_X, tz, false, 3.3, TER_MID_Y-0.6, 6.4, 8.5);
  });
  /* the big square tower on the terrace enceinte opposite the Middle
   * Castle -- the one landmark on the west front after the palace and the
   * main tower, and unmistakable in the user's aerial (a tall block under
   * a very large red pyramid roof, standing clear of the wall head) */
  mpTerraceTower(outWallFg, terrRoofFg, OUTWALL_X, 10, false, 5.6, TER_MID_Y-0.8, 17.0, 13.0);
  registerPick(pickables, 'structure', RIVWALL_X, -3.0, (TERR_Z0+TERR_Z1)/2, 8, 12, (TERR_Z1-TERR_Z0)*0.9,
    '川岸の外壁 Riverside Wall', 'ノガト川の岸に沿う最外郭の低い壁。円錐屋根の円塔が並び、その内側に段を上げて外郭壁・城壁が続く。');
  registerPick(pickables, 'structure', OUTWALL_X, 0.0, (TERR_Z0+TERR_Z1)/2, 8, 14, (TERR_Z1-TERR_Z0)*0.9,
    '段丘の外郭壁 Terrace Enceinte', '川へ降りる中段の段丘に立つ外郭壁。角錐屋根の方塔を持ち、城壁と川岸壁の中間の高さを受け持つ。');

  /* ================================================================
   * SOUTHERN + EASTERN OUTER BAILEY -- the great walled lawn
   * ================================================================
   * The other structural thing missing from the previous build. It
   * modelled the castle as three blocks in a line and stopped at the
   * masonry, so south of the Gdanisko and east of the High Castle there
   * was simply open field. In the user's oblique aerial the entire
   * FOREGROUND is a huge brick-walled enclosure -- mown grass, a few
   * paths and some low ruined foundations, with a wall-walk running the
   * whole way round and towers at the corners -- and the satellite shows
   * the same enclosure continuing up the east side as parkland between
   * the castle and the town. That enclosure is the reason Malbork reads
   * as 21 hectares rather than as a 470m building.
   *
   * The west side of the ring is already built: it IS the terrace
   * enceinte above. This closes the other three sides, stepping down
   * across the terraces at the south-west corner.
   * ================================================================ */
  var OB_SZ = -150, OB_EX = 100;   // south wall Z, east wall X (both △ 推定)
  var OB_BASE = GROUND_Y - 0.8, OB_TOP = 5.6;
  var obFg = mpMakeFadeGroup('outerBailey', {x:0,z:-1}, false, BRICK_WALL);
  // south wall: a low stretch dropping across the river terraces, then the
  // main run at castle level
  mpLongWall(obFg, 'x', OB_SZ, RIVWALL_X, -84, PROM_Y-0.8, 2.4, 1.7, { merlonH: 1.0 });
  mpLongWall(obFg, 'x', OB_SZ, -84, OB_EX, OB_BASE, OB_TOP, 1.7, { merlonH: 1.2 });
  // east wall, running north to meet the Low Castle's own south-east corner
  mpLongWall(obFg, 'z', OB_EX, OB_SZ, LC_Z0, OB_BASE, OB_TOP, 1.7, { merlonH: 1.2 });
  mpLongWall(obFg, 'x', LC_Z0, LC_HX, OB_EX, OB_BASE, OB_TOP, 1.7, { merlonH: 1.2 });
  /* An internal cross wall splits the enclosure into two courts, as the
   * aerial shows -- without it 187 x 320m of unbroken lawn reads as a
   * playing field rather than as a defended outer ward. */
  mpLongWall(obFg, 'x', -46, -84, OB_EX, OB_BASE, OB_TOP - 1.0, 1.5, { merlonH: 1.0,
    skip: function(s){ return Math.abs(s - 40) < 6; } });   // postern gap at x=40
  [ {x:-84, z:OB_SZ}, {x:-20, z:OB_SZ}, {x:52, z:OB_SZ}, {x:OB_EX, z:OB_SZ},
    {x:OB_EX, z:-60}, {x:OB_EX, z:30}, {x:OB_EX, z:120}, {x:OB_EX, z:LC_Z0},
    {x:-84, z:-46}, {x:20, z:-46}
  ].forEach(function(p){
    mpTerraceTower(obFg, terrRoofFg, p.x, p.z, false, 3.2, OB_BASE, OB_TOP + 3.4, 6.6);
  });
  /* the outer bailey's own south gatehouse: a taller twin-pier block
   * astride the road that runs in from the south */
  (function baileyGate(){
    var gx = -4, gh = 13.0, gw = 5.0;
    [-1,1].forEach(function(s){
      var pier = mkBox(6.0, gh, 6.4, obFg.mat);
      place(pier, gx + s*(gw/2 + 3.0), OB_BASE + gh/2, OB_SZ);
      obFg.group.add(pier);
    });
    var lintel = mkBox(gw, gh - 6.0, 6.4, obFg.mat);
    place(lintel, gx, OB_BASE + 6.0 + (gh-6.0)/2, OB_SZ);
    obFg.group.add(lintel);
    var cap = mkCone(8.4, 6.0, 4, terrRoofFg.mat);
    cap.rotation.y = Math.PI/4;
    place(cap, gx, OB_BASE + gh + 3.0, OB_SZ);
    terrRoofFg.group.add(cap);
    registerPick(pickables, 'structure', gx, OB_BASE + gh*0.5, OB_SZ, 18, gh, 8,
      '外郭の南門 Outer Bailey South Gate', '最外郭の南門。城下から芝の広がる外郭へ入る道がここを抜ける。');
  })();
  /* Pick volume deliberately covers only the SOUTHERN LAWN, not the whole
   * ring. A box spanning the full enclosure would have enclosed the dry
   * ditch's and the Gdanisko bridge's own pick volumes -- the ditch's box
   * is only 1m tall and would have been shadowed by this one on every
   * ray from above -- and would have parked the 外郭 label right on top of
   * the High Castle. Sitting on the empty lawn it labels the thing it
   * actually names and competes with nothing. */
  registerPick(pickables, 'structure', 8, 2.0, OB_SZ + 34, 150, 5.0, 56,
    '外郭 Outer Bailey', '高城・中城を大きく取り巻く最外周の郭。内部の大半は芝の開けた広場で、南側と東側に広大な緑地が広がる。壁天端には歩廊が回る。');

  /* ---- the terrace garden below the Grand Master's Palace -----------
   * Clearly visible in the user's aerial: on the terrace between the
   * palace's west front and the outer enceinte, one level DOWN from the
   * castle, a rectangular parterre of beds with a path down the middle.
   * Welded into two draw calls and laid on the middle terrace level, so
   * it sits where the photograph puts it -- below the palace, not beside
   * it. ---------------------------------------------------------- */
  (function terraceGarden(){
    var gx = -94, gz0 = MC_Z0 + 8, gz1 = MC_Z1 - 4, gy = TER_MID_Y;
    var soil = mpBoxSoup();
    soil.box(gx, gy + 0.12, (gz0+gz1)/2, 13, 0.24, gz1-gz0);
    soil.finish(interiorGroup, texMat(0x4c3a2b, 'soil', { nrm: 0.9 }));
    var beds = mpBoxSoup();
    for (var i=0;i<6;i++){
      var bz = gz0 + 6 + i*((gz1-gz0-12)/5);
      [-1,1].forEach(function(s){
        beds.box(gx + s*3.4, gy + 0.36, bz, 5.0, 0.5, 7.0);
      });
    }
    beds.finish(interiorGroup, new T.MeshLambertMaterial({ color: 0x44632c }));
    var walk = mkBox(2.2, 0.26, gz1-gz0, cobbleMat);
    place(walk, gx, gy + 0.13, (gz0+gz1)/2);
    interiorGroup.add(walk);
    registerPick(pickables, 'room', gx, gy + 1.0, (gz0+gz1)/2, 14, 2.0, gz1-gz0,
      '段丘の庭園 Terrace Garden', '大団長宮殿の西、一段下がった段丘に開かれた整形庭園。矩形の花壇が中央の小径を挟んで並ぶ。');
  })();

  /* the low ruined foundation walls and the paths that pattern the
   * southern lawn in the reference aerial -- welded, 2 draw calls */
  (function baileyGround(){
    var ruin = mpBoxSoup();
    [ {x:-58, z:-132, w:26, d:1.1}, {x:-46, z:-122, w:1.1, d:22},
      {x:-58, z:-112, w:26, d:1.1}, {x:-70, z:-122, w:1.1, d:22},
      {x: 24, z:-136, w:34, d:1.1}, {x: 41, z:-124, w:1.1, d:26},
      {x: 24, z:-112, w:34, d:1.1}, {x:  7, z:-124, w:1.1, d:26}
    ].forEach(function(r){ ruin.box(r.x, 0.55, r.z, r.w, 1.5, r.d); });
    ruin.finish(root, stoneDarkMat);
    var paths = mpBoxSoup();
    paths.box(-4, 0.12, -120, 3.5, 0.22, 60);            // south approach
    paths.box(-4, 0.12, OB_SZ+8, 150, 0.22, 3.5);        // along the south wall
    paths.box(70, 0.12, (OB_SZ+LC_Z0)/2, 3.5, 0.22, LC_Z0-OB_SZ-30); // east park walk
    paths.finish(interiorGroup, cobbleMat);
  })();

  /* ---- the road bridge north of the castle. Prominent in the user's
   * aerial (top of frame) and on the satellite. A level deck on piers
   * standing in the riverbed, crossing all 204m of water plus both
   * banks. Piers and railings are welded -- 3 draw calls for the lot. */
  (function nogatBridge(){
    var bz = LC_Z1 + 58, deckY = 1.6, dw = 9.0;
    var x0 = -58, x1 = -332;
    var deck = mkBox(Math.abs(x1-x0), 0.7, dw, stubMat);
    place(deck, (x0+x1)/2, deckY, bz);
    root.add(deck);
    var soup = mpBoxSoup();
    for (var px = -122; px > -316; px -= 27){
      soup.box(px, (BED_Y + deckY)/2, bz - dw*0.32, 2.4, deckY - BED_Y, 2.4);
      soup.box(px, (BED_Y + deckY)/2, bz + dw*0.32, 2.4, deckY - BED_Y, 2.4);
    }
    soup.box(-100, (PROM_Y + deckY)/2, bz, 3.0, deckY - PROM_Y, dw*0.8);
    soup.box(-70,  (GROUND_Y + deckY)/2, bz, 3.0, deckY - GROUND_Y, dw*0.8);
    soup.finish(root, stoneDarkMat);
    var rails = mpBoxSoup();
    [-1,1].forEach(function(s){
      rails.box((x0+x1)/2, deckY + 1.0, bz + s*dw/2, Math.abs(x1-x0), 1.3, 0.35);
    });
    rails.finish(root, metalMat);
    registerPick(pickables, 'structure', (x0+x1)/2, deckY, bz, Math.abs(x1-x0)*0.9, 3.0, dw*1.6,
      'ノガト川の橋 Nogat Bridge', '城の北でノガト川を渡る橋。対岸の市街と城下を結ぶ。');
  })();

  /* ---- low-poly trees along the riverbank + fields, scaled up in count
   * (but kept modest) for the much longer complex. ------------------ */
  (function scatterTrees(){
    function trand(a,b){ return a + Math.random()*(b-a); }
    function addTree(x,y,z,scale,species){
      var g = new T.Group();
      var trunkH = 2.1*scale;
      var trunk = mkCyl(0.15*scale, 0.22*scale, trunkH, 6, treeTrunkMat);
      trunk.position.y = trunkH/2;
      g.add(trunk);
      if (species===0){
        var canopy = mkCone(1.5*scale, 3.2*scale, 7, treeLeafMat2);
        canopy.position.y = trunkH + 3.2*scale*0.45;
        g.add(canopy);
      } else {
        var ball = new T.Mesh(new T.SphereGeometry(1.5*scale, 7, 6), treeLeafMat1);
        ball.castShadow = true; ball.receiveShadow = true;
        ball.position.y = trunkH + 1.35*scale;
        g.add(ball);
      }
      g.position.set(x, y, z);
      root.add(g);
    }
    var zStart = GD_CZ-15, zEnd = LC_Z1+10, zLen = zEnd-zStart;
    /* Trees on the river terraces. The bank is no longer flat, so each
     * row is planted ON its own terrace level rather than all of them at
     * GROUND_Y (which, now that the ground falls away to the west, would
     * have left a line of trees standing on air over the promenade).
     * Rows: the glacis inside the outer wall, the middle terrace between
     * the two wall lines, and the promenade along the water. */
    [ { x:-78,  y:GROUND_Y,  n:16, jitter:3 },
      { x:-94,  y:TER_MID_Y, n:13, jitter:3 },
      { x:-110, y:PROM_Y,    n:11, jitter:3 } ].forEach(function(row, ri){
      for (var i=0;i<row.n;i++){
        var z = zStart + (i+0.5)*(zLen/row.n);
        addTree(row.x + trand(-row.jitter, row.jitter), row.y,
                z + trand(-8,8), trand(0.85,1.25), (i+ri)%2);
      }
    });
    var eastCount = 16;
    for (var j=0;j<eastCount;j++){
      var z2 = zStart + j*(zLen/eastCount);
      if (Math.abs(z2-LC_GATE_Z) < 16) continue;
      if (z2 > LC_Z1 + 18 && z2 < LC_Z1 + 42) continue;   // keep the town road clear
      addTree(LC_HX+12+trand(0,16), GROUND_Y, z2+trand(-5,5), trand(0.8,1.15), j%2);
    }
    for (var k=0;k<6;k++){
      addTree(trand(-30,30), GROUND_Y, GD_CZ-24-trand(0,16), trand(0.8,1.1), k%2);
    }
  })();

  /* ================================================================
   * INTERIOR FIT-OUT + COURTYARD PLANTING
   * ================================================================
   * Everything below is fittings, furniture and planting hung off the
   * plan built above. Four rules it follows throughout:
   *
   * 1. It all lives in `interiorGroup` (which never fades), so the
   *    cutaway can strip the shell off a range and leave a furnished
   *    room standing. Because the shell that fades takes its walls with
   *    it, each detailed room also gets its own low DADO wall + corner
   *    piers + wall responds in here -- enough to read as a room from
   *    above, low enough that the near-side wall never re-blocks the
   *    view the cutaway just opened. Nothing here is ever taller than
   *    the shell it sits inside, so with the shell up it is invisible.
   * 2. Every repeated prop shares its geometry through boxGeo/cylGeo/
   *    coneGeo, keyed on rounded dimensions -- ~1000 new meshes come out
   *    of well under 100 distinct geometries.
   * 3. PERFORMANCE. Malbork is by a wide margin the heaviest castle in
   *    the viewer and its opening shot sits 580m out, where a bench is a
   *    third of a pixel. So every block of fit-out hangs off a THREE.LOD
   *    gate (`det()`) and is dropped from the scene graph entirely
   *    beyond a distance chosen per block. WebGLRenderer.projectObject
   *    calls LOD.update() itself, so this needs no per-frame hook and no
   *    edit to any shared file; if THREE.LOD is ever absent the helper
   *    degrades to a plain always-on Group.
   * 4. Planting keeps clear of `life`: nothing is placed inside a
   *    `life.courtyard` wander box or within reach of the `life.patrol`
   *    line (the one exception is the Middle Castle courtyard, whose
   *    wander box is narrowed at the bottom of this file by exactly the
   *    width of the kitchen garden added here).
   * ================================================================ */
  (function interiorFitOut(){

    /* ---- shared geometry cache ---------------------------------- */
    var geoCache = {};
    function boxGeo(w,h,d){
      var k = 'B'+w.toFixed(2)+'_'+h.toFixed(2)+'_'+d.toFixed(2);
      return geoCache[k] || (geoCache[k] = new T.BoxGeometry(w,h,d));
    }
    function cylGeo(rt,rb,h,seg){
      var k = 'C'+rt.toFixed(2)+'_'+rb.toFixed(2)+'_'+h.toFixed(2)+'_'+seg;
      return geoCache[k] || (geoCache[k] = new T.CylinderGeometry(rt,rb,h,seg));
    }
    function coneGeo(r,h,seg){
      var k = 'N'+r.toFixed(2)+'_'+h.toFixed(2)+'_'+seg;
      return geoCache[k] || (geoCache[k] = new T.ConeGeometry(r,h,seg));
    }
    function add(t, geo, mat, x, y, z, ry){
      var m = new T.Mesh(geo, mat);
      m.castShadow = true; m.receiveShadow = true;
      m.position.set(x,y,z);
      if (ry) m.rotation.y = ry;
      t.add(m);
      return m;
    }
    /* horizontal cylinder: the Y-axis geometry is tipped onto its side
     * and then yawed. Euler order must be YXZ/roll-first here -- with the
     * default XYZ order the yaw is applied before the tip and every
     * "lying" log/windlass/axle ends up pointing the same way. */
    function lay(t, geo, mat, x, y, z, ry){
      var m = new T.Mesh(geo, mat);
      m.castShadow = true; m.receiveShadow = true;
      m.position.set(x,y,z);
      m.rotation.order = 'YXZ';
      m.rotation.set(0, ry || 0, Math.PI/2);
      t.add(m);
      return m;
    }
    /* upright disc (cart wheel) whose axle is horizontal and square to
     * the `ry` travel direction */
    function wheelDisc(t, geo, mat, x, y, z, ry){
      var m = new T.Mesh(geo, mat);
      m.castShadow = true; m.receiveShadow = true;
      m.position.set(x,y,z);
      m.rotation.order = 'YXZ';
      m.rotation.set(Math.PI/2, ry || 0, 0);
      t.add(m);
      return m;
    }
    /* thin bar from A to B -- vault ribs, roof trusses, ladders, cart
     * shafts, vine wires. lookAt() is called before the mesh is parented
     * so its target is read in the same local space the endpoints are
     * given in (nothing in this castle's ancestor chain is rotated). */
    function bar(t, mat, x0,y0,z0, x1,y1,z1, th){
      th = th || 0.15;
      var len = Math.hypot(x1-x0, y1-y0, z1-z0);
      var m = new T.Mesh(boxGeo(th, th, len), mat);
      m.castShadow = true; m.receiveShadow = true;
      m.position.set((x0+x1)/2, (y0+y1)/2, (z0+z1)/2);
      m.lookAt(x1, y1, z1);
      t.add(m);
      return m;
    }

    /* ---- distance gate ------------------------------------------ */
    function det(cx, cy, cz, dist){
      var g = new T.Group();
      if (!T.LOD){ interiorGroup.add(g); return g; }
      var lod = new T.LOD();
      g.position.set(-cx, -cy, -cz);   // keep authoring in sheet coords
      lod.addLevel(g, 0);
      lod.addLevel(new T.Group(), dist);
      lod.position.set(cx, cy, cz);
      interiorGroup.add(lod);
      return g;
    }
    /* Rigidly move a finished det() block. The Low Castle's ranges were
     * re-sited when the Vorburg was rebuilt as a perimeter ring round an
     * open ward (see the lcSegs table), and each of these fit-outs is
     * 40-120 props authored in absolute sheet coordinates. Re-typing every
     * one of those coordinates is exactly the sort of edit that silently
     * leaves a barrel standing outside its own wall, so instead the whole
     * LOD node is translated -- one shift per range, contents untouched.
     * (The registerPick/mpPickRoom volumes inside each fit-out live
     * outside the group in world space and so are moved by hand.) */
    function detShift(g, dx, dz){
      var t = (g.parent && g.parent.isLOD) ? g.parent : g;
      t.position.x += dx; t.position.z += dz;
      return g;
    }
    // three cutaway-matched gate distances. orbDist = 820 - zoom*750, so
    // D_NEAR/D_MID/D_FAR correspond to reveal 0.75 / 0.64 / 0.43 -- i.e.
    // each block switches on just after the shell in front of it has
    // finished fading (DONJON_WALL_END 0.90 / WALL_END 0.58) or, for
    // open-air planting, well before anything fades at all.
    var D_NEAR = 260;   // High Castle rooms (inner cutaway tier)
    var D_MID  = 340;   // Middle / Low Castle rooms (outer tier)
    var D_FAR  = 500;   // open-air courtyard planting and yard clutter

    /* ---- extra materials (the stone/plaster/tile set is declared with
     * the main palette at the top of this file so the inline fittings
     * above can share it) ---------------------------------------- */
    var strawMat = texMat(0x9c8548, 'straw', { nrm: 0.9 });
    var emberMat = new T.MeshLambertMaterial({ color: 0xbf5c1e });
    var clothMat = texMat(0x7c3134, 'cloth', { nrm: 0.9, side: T.DoubleSide });
    var frescoMat= texMat(0x8d7c5a, 'plaster', { nrm: 0.5, side: T.DoubleSide });
    var sackMat  = texMat(0x9c8a68, 'cloth', { nrm: 0.8 });
    var soilMat  = texMat(0x4c3a2b, 'soil', { nrm: 0.8 });
    /* crop greens are deliberately DARKER and greyer than the 0x5c7a48
     * lawn they sit next to. Brighter values (0x5c8a3c / 0x7d9c46 were
     * tried first) came back off the renderer as neon stripes that read
     * as painted lines rather than as planting. */
    var cropMat1 = new T.MeshLambertMaterial({ color: 0x44632c });
    var cropMat2 = new T.MeshLambertMaterial({ color: 0x556f33 });
    var hedgeMat = new T.MeshLambertMaterial({ color: 0x3d6434 });
    var potMat   = new T.MeshLambertMaterial({ color: 0x8a4b32 });

    /* ================================================================
     * generic fittings
     * ================================================================ */
    /* floor slab. Top lands at y=0.16 -- above the courtyard lawn/apron
     * tops (0.00 / 0.24) it abuts and below every dado, so no coplanar
     * pair anywhere can z-fight. */
    function floorSlab(t, mat, x0, x1, z0, z1){
      add(t, boxGeo(Math.abs(x1-x0), 0.3, Math.abs(z1-z0)), mat,
          (x0+x1)/2, 0.01, (z0+z1)/2);
    }
    /* low perimeter wall ("dado"): reads as the room's footprint once
     * the cutaway has taken the real wall away, without blocking the
     * view down into the room. `skip` drops named faces ('x-','x+',
     * 'z-','z+') where a room opens into another. */
    function dado(t, mat, x0, x1, z0, z1, h, th, skip){
      th = th || 0.5;
      var y = 0.16 + h/2, w = Math.abs(x1-x0), d = Math.abs(z1-z0);
      function want(f){ return !skip || skip.indexOf(f) < 0; }
      if (want('z-')) add(t, boxGeo(w, h, th), mat, (x0+x1)/2, y, z0+th/2);
      if (want('z+')) add(t, boxGeo(w, h, th), mat, (x0+x1)/2, y, z1-th/2);
      if (want('x-')) add(t, boxGeo(th, h, d-2*th), mat, x0+th/2, y, (z0+z1)/2);
      if (want('x+')) add(t, boxGeo(th, h, d-2*th), mat, x1-th/2, y, (z0+z1)/2);
    }
    /* wall responds: slim full-height shafts marching along a wall face.
     * They carry the vault ribs and, being 0.4m thin with 3-5m gaps, let
     * the eye straight past them into the room. */
    function responds(t, mat, axis, fixed, a0, a1, n, h, w){
      w = w || 0.42;
      for (var i=0;i<n;i++){
        var s = a0 + (a1-a0)*(n<=1 ? 0.5 : i/(n-1));
        if (axis==='z') add(t, boxGeo(w, h, w), mat, fixed, 0.16+h/2, s);
        else            add(t, boxGeo(w, h, w), mat, s, 0.16+h/2, fixed);
      }
    }
    /* palm / star vault, RIBS ONLY. A solid webbed vault would roof the
     * room over and hide everything the cutaway just exposed, so the
     * webbing is omitted and only the ribs are drawn: from above you see
     * the fan radiating off each pier head and the furnished floor
     * through the gaps, which is the read the Great Refectory reference
     * photographs give from below. */
    function fanVault(t, mat, cx, cz, y0, y1, rx, rz, n, th){
      for (var i=0;i<n;i++){
        var a = (i/n)*Math.PI*2 + Math.PI/n;
        bar(t, mat, cx, y0, cz, cx + Math.cos(a)*rx, y1, cz + Math.sin(a)*rz, th || 0.16);
      }
      // small boss where the fan closes
      add(t, cylGeo(0.28, 0.28, 0.22, 6), plasterMat, cx, y0-0.05, cz);
    }
    /* wall rib: the rectangle of ribs that closes a fan vault off along
     * the tops of its walls. Without it the fans end in mid-air and read
     * as bare wire spokes rather than as a vault. */
    function vaultRing(t, mat, x0, x1, z0, z1, y, th){
      th = th || 0.16;
      bar(t, mat, x0, y, z0, x1, y, z0, th);
      bar(t, mat, x0, y, z1, x1, y, z1, th);
      bar(t, mat, x0, y, z0, x0, y, z1, th);
      bar(t, mat, x1, y, z0, x1, y, z1, th);
    }
    /* transverse pointed-arch rib across a room (two raking bars meeting
     * at an apex) -- the cheap way to say "vaulted bay" in a room too
     * small to be worth a full fan. */
    function archRib(t, mat, axis, fixed, a0, a1, ySpring, yApex, th){
      var m = (a0+a1)/2;
      if (axis==='z'){
        bar(t, mat, fixed, ySpring, a0, fixed, yApex, m, th||0.14);
        bar(t, mat, fixed, ySpring, a1, fixed, yApex, m, th||0.14);
      } else {
        bar(t, mat, a0, ySpring, fixed, m, yApex, fixed, th||0.14);
        bar(t, mat, a1, ySpring, fixed, m, yApex, fixed, th||0.14);
      }
    }
    /* trestle table + a bench down each long side, running along `ry` */
    function tableSet(t, cx, cz, len, ry, benches){
      var y = 0.78;
      add(t, boxGeo(len, 0.14, 0.95), woodMat, cx, y, cz, ry);
      [-1,1].forEach(function(s){
        var lx = s*len*0.34;
        add(t, boxGeo(0.5, y-0.07, 0.7), woodMat,
            cx + lx*Math.cos(ry), (y-0.07)/2, cz - lx*Math.sin(ry), ry);
      });
      if (benches === false) return;
      [-1,1].forEach(function(s){
        var off = s*1.0;
        var bx = cx + off*Math.sin(ry), bz = cz + off*Math.cos(ry);
        add(t, boxGeo(len*0.94, 0.12, 0.36), woodMat, bx, 0.46, bz, ry);
        [-1,1].forEach(function(s2){
          var lx2 = s2*len*0.36;
          add(t, boxGeo(0.24, 0.4, 0.3), woodMat,
              bx + lx2*Math.cos(ry), 0.2, bz - lx2*Math.sin(ry), ry);
        });
      });
    }
    function benchRun(t, cx, cz, len, ry, mat){
      add(t, boxGeo(len, 0.14, 0.4), mat || woodMat, cx, 0.62, cz, ry);
      [-1,1].forEach(function(s){
        var lx = s*len*0.4;
        add(t, boxGeo(0.2, 0.46, 0.36), mat || woodMat,
            cx + lx*Math.cos(ry), 0.28, cz - lx*Math.sin(ry), ry);
      });
    }
    function chest(t, cx, cz, ry, w){
      w = w || 1.6;
      add(t, boxGeo(w, 0.75, 0.8), darkWoodMat, cx, 0.53, cz, ry);
      add(t, boxGeo(w+0.1, 0.16, 0.9), woodMat, cx, 0.98, cz, ry);
      [-0.28,0.28].forEach(function(f){
        add(t, boxGeo(0.1, 0.95, 0.86), metalMat, cx + f*w*Math.cos(ry), 0.6, cz - f*w*Math.sin(ry), ry);
      });
    }
    function barrel(t, x, z, r, h){
      add(t, cylGeo(r*0.86, r*0.86, h, 8), woodMat, x, 0.16+h/2, z);
      [0.28,0.72].forEach(function(f){
        add(t, cylGeo(r, r, 0.12, 8), metalMat, x, 0.16+h*f, z);
      });
    }
    function sackPile(t, x, z, n, ry){
      for (var i=0;i<n;i++){
        var a = ry + i*1.9;
        add(t, cylGeo(0.34, 0.44, 0.85, 6), sackMat,
            x + Math.cos(a)*0.5*(i%3), 0.16+0.43 + (i>2?0.85:0), z + Math.sin(a)*0.5*(i%3));
      }
    }
    function crateStack(t, x, z, ry){
      add(t, boxGeo(1.1, 0.8, 1.0), woodMat, x, 0.56, z, ry);
      add(t, boxGeo(0.95, 0.7, 0.9), woodMat, x+0.1, 1.31, z-0.05, ry+0.3);
    }
    function woodPile(t, x, z, len, ry){
      var pc = Math.cos(ry + Math.PI/2), ps = Math.sin(ry + Math.PI/2);
      for (var r=0;r<3;r++){
        for (var c=0;c<4-r;c++){
          var off = (c-(3-r)/2)*0.36;
          lay(t, cylGeo(0.16,0.16,len,5), woodMat, x + off*pc, 0.32+r*0.32, z - off*ps, ry);
        }
      }
    }
    function hayPile(t, x, z, r, h){
      add(t, cylGeo(r*0.55, r, h, 7), strawMat, x, 0.16+h/2, z);
      add(t, coneGeo(r*0.62, h*0.5, 7), strawMat, x, 0.16+h+h*0.24, z);
    }
    function cart(t, x, z, ry, loaded){
      add(t, boxGeo(3.0, 0.35, 1.7), woodMat, x, 1.0, z, ry);
      [-1,1].forEach(function(s){
        [-1,1].forEach(function(s2){
          var lx = s*1.0, lz = s2*0.95;
          var wx = x + lx*Math.cos(ry) + lz*Math.sin(ry);
          var wz = z - lx*Math.sin(ry) + lz*Math.cos(ry);
          wheelDisc(t, cylGeo(0.72,0.72,0.16,10), darkWoodMat, wx, 0.88, wz, ry);
        });
      });
      // draught shafts
      [-0.55,0.55].forEach(function(o){
        bar(t, woodMat, x + 1.5*Math.cos(ry) + o*Math.sin(ry), 1.0, z - 1.5*Math.sin(ry) + o*Math.cos(ry),
                        x + 3.4*Math.cos(ry) + o*Math.sin(ry), 0.7, z - 3.4*Math.sin(ry) + o*Math.cos(ry), 0.12);
      });
      if (loaded){
        add(t, boxGeo(2.4, 0.7, 1.3), sackMat, x, 1.52, z, ry);
      }
    }
    /* wall fireplace: firebox, ember block, conical/pyramidal hood and a
     * chimney breast. `nrm` is the wall the hearth is set into. */
    function hearth(t, x, z, nrm, w, wallMat){
      // local frame opens toward +Z; ry maps that to the room side of the
      // named wall (a hearth in the x+ wall must open toward -x)
      var ry = (nrm==='x+') ? -Math.PI/2 : (nrm==='x-') ? Math.PI/2 : (nrm==='z+') ? Math.PI : 0;
      var g = new T.Group();
      g.position.set(x, 0, z); g.rotation.y = ry;
      t.add(g);
      // local frame: hearth opens toward +Z
      add(g, boxGeo(w+1.0, 3.4, 0.7), wallMat || stoneDarkMat, 0, 0.16+1.7, -0.35);
      add(g, boxGeo(w, 0.35, 1.5), flagMat, 0, 0.3, 0.5);
      add(g, boxGeo(w*0.8, 0.3, 1.0), emberMat, 0, 0.5, 0.45);
      var hood = new T.Mesh(coneGeo(w*0.78, 2.6, 4), wallMat || stoneDarkMat);
      hood.castShadow = true; hood.receiveShadow = true;
      hood.rotation.y = Math.PI/4;
      hood.position.set(0, 3.0, 0.15);
      g.add(hood);
      // logs
      [-0.3,0.3].forEach(function(o){
        lay(g, cylGeo(0.14,0.14,w*0.6,5), woodMat, 0, 0.62, 0.45 + o, 0);
      });
      return g;
    }
    function candleStand(t, x, z){
      add(t, cylGeo(0.3,0.36,0.12,6), metalMat, x, 0.22, z);
      add(t, cylGeo(0.07,0.07,1.5,5), metalMat, x, 0.9, z);
      add(t, cylGeo(0.3,0.24,0.1,6), metalMat, x, 1.68, z);
      [-0.22,0,0.22].forEach(function(o){
        add(t, cylGeo(0.05,0.05,0.35,5), plasterMat, x+o, 1.9, z);
      });
    }
    function bannerBoard(t, x, y, z, ry, w, h, mat){
      add(t, boxGeo(w, h, 0.1), mat || clothMat, x, y, z, ry);
      add(t, cylGeo(0.07,0.07,w+0.4,5), woodMat, x, y + h/2 + 0.16, z, ry);
    }
    /* straight flight of steps */
    function stairFlight(t, mat, x, z, ry, n, rise, run, width){
      for (var i=0;i<n;i++){
        var d = (i+0.5)*run;
        add(t, boxGeo(run, rise*(i+1), width), mat,
            x + d*Math.cos(ry), 0.16 + rise*(i+1)/2, z - d*Math.sin(ry), ry);
      }
    }
    /* spiral stair: a helix of treads round a newel */
    function spiralStair(t, mat, x, z, r, n, totalH){
      add(t, cylGeo(0.28,0.28,totalH,8), mat, x, 0.16+totalH/2, z);
      for (var i=0;i<n;i++){
        var a = i*(Math.PI*2/12);
        add(t, boxGeo(r, 0.2, 0.62), mat,
            x + Math.cos(a)*r*0.5, 0.16 + (i+1)*(totalH/n), z + Math.sin(a)*r*0.5, -a);
      }
    }
    /* roof truss (tie beam + two rafters + king post) for a timber range */
    function truss(t, mat, cx, cz, halfSpan, eaveY, apexY, axis){
      if (axis==='x'){
        add(t, boxGeo(0.24, 0.24, halfSpan*2), mat, cx, eaveY, cz);
        bar(t, mat, cx, eaveY, cz-halfSpan, cx, apexY, cz, 0.2);
        bar(t, mat, cx, eaveY, cz+halfSpan, cx, apexY, cz, 0.2);
      } else {
        add(t, boxGeo(halfSpan*2, 0.24, 0.24), mat, cx, eaveY, cz);
        bar(t, mat, cx-halfSpan, eaveY, cz, cx, apexY, cz, 0.2);
        bar(t, mat, cx+halfSpan, eaveY, cz, cx, apexY, cz, 0.2);
      }
      add(t, boxGeo(0.22, apexY-eaveY, 0.22), mat, cx, (eaveY+apexY)/2, cz);
    }

    /* ================================================================
     * planting kit -- kitchen garden beds, herb plats, hedges, small
     * courtyard trees, vines. Deliberately SMALL-scale: these are
     * enclosed-garden plants, not the 8-10m riverbank trees scattered
     * outside the walls, so nothing here exceeds ~4.5m.
     * ================================================================ */
    function gardenBed(t, cx, cz, w, d, rows, cropMat, ry){
      ry = ry || 0;
      var g = new T.Group();
      g.position.set(cx, 0, cz); g.rotation.y = ry;
      t.add(g);
      add(g, boxGeo(w, 0.55, d), soilMat, 0, 0.28, 0);
      // low board edging
      [-1,1].forEach(function(s){
        add(g, boxGeo(w, 0.46, 0.16), woodMat, 0, 0.36, s*(d/2-0.08));
        add(g, boxGeo(0.16, 0.46, d), woodMat, s*(w/2-0.08), 0.36, 0);
      });
      // ridged rows of crop, one box per row
      for (var i=0;i<rows;i++){
        var z = -d/2 + d*(i+0.5)/rows;
        add(g, boxGeo(w-0.9, 0.55, d/rows*0.5), cropMat, 0, 0.8, z);
      }
      return g;
    }
    /* herb plat: a square bed quartered by little paths, the standard
     * monastic hortulus layout */
    function herbPlat(t, cx, cz, s){
      add(t, boxGeo(s, 0.5, s), soilMat, cx, 0.25, cz);
      [-1,1].forEach(function(sx){
        [-1,1].forEach(function(sz){
          add(t, boxGeo(s*0.4, 0.62, s*0.4), sx*sz > 0 ? cropMat1 : cropMat2,
              cx + sx*s*0.24, 0.76, cz + sz*s*0.24);
        });
      });
      add(t, boxGeo(s+0.4, 0.2, 0.3), flagMat, cx, 0.56, cz);
      add(t, boxGeo(0.3, 0.2, s+0.4), flagMat, cx, 0.56, cz);
      // board frame round the plat
      [-1,1].forEach(function(sg){
        add(t, boxGeo(s+0.2, 0.4, 0.14), woodMat, cx, 0.34, cz + sg*s/2);
        add(t, boxGeo(0.14, 0.4, s+0.2), woodMat, cx + sg*s/2, 0.34, cz);
      });
    }
    function hedgeRun(t, cx, cz, len, ry, h){
      h = h || 1.0;
      add(t, boxGeo(len, h, 0.85), hedgeMat, cx, 0.16+h/2, cz, ry);
    }
    /* small enclosed-garden tree: 2.6-4.5m, not the riverbank species */
    function gardenTree(t, x, z, scale, shaped){
      scale = scale || 1;
      add(t, cylGeo(0.13*scale, 0.19*scale, 1.5*scale, 5), treeTrunkMat, x, 0.16+0.75*scale, z);
      if (shaped){                       // clipped bay / topiary cone
        add(t, coneGeo(0.85*scale, 2.1*scale, 7), treeLeafMat2, x, 0.16+1.5*scale+1.05*scale, z);
      } else {                           // fruit tree
        var ball = new T.Mesh(cylGeo(1.15*scale, 0.75*scale, 1.5*scale, 7), treeLeafMat1);
        ball.castShadow = true; ball.receiveShadow = true;
        ball.position.set(x, 0.16+1.5*scale+0.75*scale, z);
        t.add(ball);
        add(t, coneGeo(1.15*scale, 1.1*scale, 7), treeLeafMat1, x, 0.16+1.5*scale+1.5*scale+0.5*scale, z);
      }
    }
    function pottedPlant(t, x, z){
      add(t, cylGeo(0.34, 0.26, 0.55, 7), potMat, x, 0.44, z);
      add(t, coneGeo(0.44, 1.0, 6), treeLeafMat2, x, 1.2, z);
    }
    /* vine trellis: posts + wires + foliage, run along `ry` */
    function vineRun(t, cx, cz, len, ry, h){
      h = h || 2.2;
      var n = Math.max(2, Math.round(len/3));
      for (var i=0;i<=n;i++){
        var lx = -len/2 + len*i/n;
        add(t, boxGeo(0.16, h, 0.16), woodMat,
            cx + lx*Math.cos(ry), 0.16+h/2, cz - lx*Math.sin(ry), ry);
      }
      [0.55, 0.95].forEach(function(f){
        add(t, boxGeo(len, 0.08, 0.08), woodMat, cx, 0.16+h*f, cz, ry);
      });
      add(t, boxGeo(len*0.96, 0.75, 0.6), treeLeafMat1, cx, 0.16+h*0.86, cz, ry);
    }

    /* ================================================================
     * A. HIGH CASTLE -- conventual rooms (inner cutaway tier)
     * ================================================================ */
    (function highCastle(){
      var g = det(0, 7, 0, D_NEAR);

      // ---- floors of the four wings, so a faded wing leaves paving
      floorSlab(g, flagMat, -HC_HX+0.8, HC_HX-0.8,  HC_COURT_HZ, HC_HZ-0.8);   // N
      floorSlab(g, flagMat, -HC_HX+0.8, HC_HX-0.8, -HC_HZ+0.8, -HC_COURT_HZ);  // S
      floorSlab(g, flagMat,  HC_COURT_HX, HC_HX-0.8, -HC_COURT_HZ, HC_COURT_HZ);// E
      floorSlab(g, flagMat, -HC_HX+0.8, -HC_COURT_HX, -HC_COURT_HZ, HC_COURT_HZ);// W

      /* ---- St Mary's Church ---------------------------------------
       * 38m x 12m nave with a 5-pier arcade down the centre line (the
       * piers themselves are built with the plan above), a rib vault
       * springing off them, choir stalls flanking the sanctuary, a
       * reredos behind the altar already placed at the east end, and a
       * rood beam across the chancel entrance. */
      var cz0 = HC_HZ - HC_WD_NS + 0.9, cz1 = HC_HZ - 1.1;   // 19.4 .. 29.4
      floorSlab(g, tileMat, CH_X0+0.6, CH_X1-1.2, cz0, cz1);
      dado(g, plasterMat, CH_X0+0.4, CH_X1-1.2, cz0, cz1, 1.5, 0.55, 'x+');
      responds(g, plasterMat, 'x', cz0-0.05, CH_X0+2, CH_X1-2, 7, CH_H-2.2);
      responds(g, plasterMat, 'x', cz1+0.05, CH_X0+2, CH_X1-2, 7, CH_H-2.2);
      CH_PIER_X.forEach(function(px){
        // pier capital + a transverse rib pair to each side wall
        add(g, cylGeo(0.62, 0.46, 0.5, 8), plasterMat, px, CH_H-1.5+0.25, CH_Z);
        fanVault(g, ribMat, px, CH_Z, CH_H-1.2, CH_H-0.1, 5.6, 3.4, 8, 0.14);
      });
      // ridge rib running the length of the nave + the wall ribs that
      // close the vault off along the tops of the side walls
      bar(g, ribMat, CH_X0+1, CH_H-0.1, CH_Z, CH_X1-1, CH_H-0.1, CH_Z, 0.18);
      vaultRing(g, ribMat, CH_X0+1, CH_X1-1.4, cz0+0.3, cz1-0.3, CH_H-0.1, 0.18);
      // altar furniture (the altar block itself is placed with the plan)
      add(g, boxGeo(2.8, 4.2, 0.5), goldMat, CH_X1-2.2, 2.3, APSE_CZ);       // reredos
      add(g, boxGeo(3.0, 0.3, 1.6), flagMat, CH_X1-3, 0.28, APSE_CZ);        // predella
      [-1,1].forEach(function(s){ candleStand(g, CH_X1-4.2, APSE_CZ + s*1.6); });
      // choir stalls: two facing runs down the eastern third of the nave
      [-1,1].forEach(function(s){
        benchRun(g, CH_X1-9, CH_Z + s*2.6, 12, Math.PI/2, darkWoodMat);
        add(g, boxGeo(12, 2.2, 0.3), darkWoodMat, CH_X1-9, 1.3, CH_Z + s*3.0, Math.PI/2);
      });
      // rood beam + cross over the chancel entrance
      add(g, boxGeo(0.24, 0.24, 9.6), darkWoodMat, CH_X1-15, 7.4, CH_Z);
      add(g, boxGeo(0.2, 1.9, 0.2), goldMat, CH_X1-15, 8.4, CH_Z);
      add(g, boxGeo(0.2, 0.2, 1.1), goldMat, CH_X1-15, 8.7, CH_Z);
      // nave benches
      for (var nb=0; nb<4; nb++){
        [-1,1].forEach(function(s){
          benchRun(g, CH_X0+6 + nb*4.6, CH_Z + s*2.4, 3.6, Math.PI/2, woodMat);
        });
      }
      // lectern
      add(g, cylGeo(0.2,0.28,1.2,6), darkWoodMat, CH_X1-13, 0.76, CH_Z-3.2);
      add(g, boxGeo(0.8, 0.12, 0.6), darkWoodMat, CH_X1-13, 1.42, CH_Z-3.2, 0.4);
      /* painted frieze round the top of both nave walls. This was a band
       * of 3m-tall panels at mid height, which from outside the wing read
       * as five blank billboards standing across the church and hid the
       * whole interior from the north. Kept to a narrow band just under
       * the vault springing, it reads as painted decoration and blocks
       * nothing. */
      for (var fr=0; fr<5; fr++){
        [cz0+0.2, cz1-0.2].forEach(function(fz){
          add(g, boxGeo(5.4, 1.3, 0.12), frescoMat, CH_X0+5 + fr*6.6, CH_H-1.6, fz);
        });
      }

      /* ---- St Anne's Chapel -- ground floor, west end of the north
       * wing, under the church's western bays [MH]. Three bays, its own
       * altar, and the burial crypt of the Grand Masters below: the
       * crypt is shown as a sunken floor panel with three tomb chests,
       * reached by a short flight down from the chapel. Dimensions are
       * unmeasured -> 推定; only the "3 bays + crypt" arrangement is
       * documented. */
      var SA_X0 = -HC_HX+1.4, SA_X1 = CH_X0-0.4, SA_H = 5.6;
      floorSlab(g, tileMat, SA_X0, SA_X1, cz0, cz1);
      dado(g, plasterMat, SA_X0, SA_X1, cz0, cz1, 1.4, 0.5, 'x+');
      var saBayX = [SA_X0+2.0, (SA_X0+SA_X1)/2, SA_X1-2.0];
      saBayX.forEach(function(bx){
        responds(g, plasterMat, 'x', cz0+0.3, bx, bx, 1, SA_H);
        responds(g, plasterMat, 'x', cz1-0.3, bx, bx, 1, SA_H);
        // transverse arch across the wing's depth at each bay
        archRib(g, ribMat, 'z', bx, cz0+0.3, cz1-0.3, SA_H, SA_H+1.6, 0.14);
      });
      bar(g, ribMat, SA_X0+1, SA_H+1.6, CH_Z, SA_X1-1, SA_H+1.6, CH_Z, 0.14);
      // altar at the east end of the chapel
      add(g, boxGeo(0.6, 1.1, 2.0), flagMat, SA_X1-1.2, 0.72, CH_Z);
      add(g, boxGeo(0.3, 2.4, 1.6), goldMat, SA_X1-0.7, 1.5, CH_Z);
      // sunken crypt with three tomb chests
      add(g, boxGeo(6.4, 0.28, 5.6), stoneDarkMat, SA_X0+4.2, -0.02, CH_Z);
      for (var tb=0; tb<3; tb++){
        add(g, boxGeo(2.4, 0.62, 1.0), flagMat, SA_X0+4.2, 0.35, CH_Z-2.0 + tb*2.0);
        add(g, boxGeo(2.5, 0.16, 1.1), plasterMat, SA_X0+4.2, 0.74, CH_Z-2.0 + tb*2.0);
      }
      stairFlight(g, flagMat, SA_X0+7.8, CH_Z, 0, 4, 0.22, 0.5, 2.0);
      [-1,1].forEach(function(s){ candleStand(g, SA_X1-2.6, CH_Z + s*1.8); });
      mpPickRoom(SA_X0, SA_X1, cz0, cz1, SA_H, '聖アンナ礼拝堂 St Anne’s Chapel',
        '教会の下層、3ベイの礼拝堂。床下は歴代総長を葬った地下納骨室。');

      /* ---- Chapter House (south wing) ---------------------------- */
      var cpz0 = -HC_HZ + 1.0, cpz1 = -HC_COURT_HZ - 0.6, CP_H = 7.2;
      floorSlab(g, tileMat, chX0-0.6, chX1+0.6, cpz0, cpz1);
      dado(g, plasterMat, chX0-0.8, chX1+0.8, cpz0, cpz1, 1.3, 0.5);
      // two piers carrying a pair of fan vaults, stone bench round the wall
      [-11, -1].forEach(function(px){
        add(g, cylGeo(0.42, 0.5, CP_H-1.2, 8), stubMat, px, 0.16+(CP_H-1.2)/2, (cpz0+cpz1)/2);
        add(g, cylGeo(0.66, 0.48, 0.5, 8), plasterMat, px, 0.16+CP_H-1.2+0.25, (cpz0+cpz1)/2);
        fanVault(g, ribMat, px, (cpz0+cpz1)/2, CP_H-0.4, CP_H+0.6, 6.2, 4.6, 10, 0.16);
      });
      vaultRing(g, ribMat, chX0-0.4, chX1+0.4, cpz0+0.4, cpz1-0.4, CP_H+0.6, 0.17);
      [cpz0+0.7, cpz1-0.7].forEach(function(bz){
        add(g, boxGeo(chX1-chX0, 0.4, 0.7), flagMat, (chX0+chX1)/2, 0.72, bz);
        add(g, boxGeo(chX1-chX0, 1.5, 0.28), plasterMat, (chX0+chX1)/2, 1.66, bz);
      });
      // grand master's high seat at the west end
      add(g, boxGeo(0.9, 0.5, 1.6), darkWoodMat, chX0+1.2, 0.72, (cpz0+cpz1)/2);
      add(g, boxGeo(0.34, 2.8, 1.6), darkWoodMat, chX0+0.7, 1.7, (cpz0+cpz1)/2);
      bannerBoard(g, chX0+1.0, 4.4, (cpz0+cpz1)/2, Math.PI/2, 2.2, 3.0);
      // the long council table already sits at the room's centre; add
      // benches down each side of it and a lectern at the head
      [-1,1].forEach(function(s){
        benchRun(g, (chX0+chX1)/2, (cpz0+cpz1)/2 + s*2.0, 6.0, 0, woodMat);
      });
      add(g, cylGeo(0.2,0.28,1.2,6), darkWoodMat, chX0+4.2, 0.76, (cpz0+cpz1)/2);
      add(g, boxGeo(0.7, 0.12, 0.6), darkWoodMat, chX0+4.2, 1.42, (cpz0+cpz1)/2, 0.3);
      hearth(g, chX1-2.5, cpz0+0.9, 'z-', 2.4, stoneDarkMat);

      /* ---- Convent Refectory (west wing) ------------------------- */
      floorSlab(g, tileMat, rfX0-0.2, rfX1+0.4, rfZ0-4, rfZ1+4);
      dado(g, plasterMat, rfX0-0.1, rfX1+0.6, rfZ0-4.4, rfZ1+4.4, 1.3, 0.5, 'x+');
      responds(g, plasterMat, 'z', rfX0+0.2, rfZ0-3.5, rfZ1+3.5, 5, HCRF_H);
      HCRF_COL_Z.forEach(function(cz){
        add(g, cylGeo(0.6, 0.44, 0.5, 8), plasterMat, (rfX0+rfX1)/2, 0.16+HCRF_H-1.0+0.25, cz);
        fanVault(g, ribMat, (rfX0+rfX1)/2, cz, HCRF_H-0.6, HCRF_H+0.6, 4.4, 3.4, 9, 0.16);
      });
      bar(g, ribMat, (rfX0+rfX1)/2, HCRF_H+0.6, rfZ0-3, (rfX0+rfX1)/2, HCRF_H+0.6, rfZ1+3, 0.17);
      vaultRing(g, ribMat, rfX0, rfX1+0.4, rfZ0-3.6, rfZ1+3.6, HCRF_H+0.6, 0.17);
      [-1,1].forEach(function(s){
        tableSet(g, (rfX0+rfX1)/2 + s*2.6, 0, 13, Math.PI/2);
      });
      hearth(g, rfX0+0.4, 6.0, 'x-', 2.6, stoneDarkMat);
      add(g, boxGeo(1.0, 2.4, 3.0), darkWoodMat, rfX1-0.9, 1.36, -10.5);   // cupboard
      candleStand(g, (rfX0+rfX1)/2, -9);
      bannerBoard(g, rfX1-0.3, 5.0, 9.5, -Math.PI/2, 2.0, 2.8);

      /* ---- Grand Master's Old Chamber (east wing) ---------------- */
      floorSlab(g, tileMat, gmX0-0.5, gmX1+0.2, gmZ0-1, gmZ1+1);
      dado(g, plasterMat, gmX0-0.7, gmX1+0.2, gmZ0-1.4, gmZ1+1.4, 1.3, 0.5, 'x-');
      responds(g, plasterMat, 'z', gmX1-0.1, gmZ0, gmZ1, 4, 6.4);
      // three transverse arches across the wing's depth
      [gmZ0+1.5, (gmZ0+gmZ1)/2, gmZ1-1.5].forEach(function(az){
        archRib(g, ribMat, 'x', az, gmX0-0.4, gmX1, 6.4, 7.4, 0.13);
      });
      // canopy over the bed already placed at the room centre
      var bedX = (gmX0+gmX1)/2, bedZ = (gmZ0+gmZ1)/2;
      [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function(s){
        add(g, boxGeo(0.16, 2.6, 0.16), darkWoodMat, bedX + s[0]*1.1, 1.46, bedZ + s[1]*1.7);
      });
      add(g, boxGeo(2.6, 0.2, 3.8), clothMat, bedX, 2.86, bedZ);
      chest(g, gmX0+1.4, gmZ1-1.6, 0, 1.8);
      tableSet(g, bedX, gmZ0+1.6, 2.6, 0, false);
      add(g, boxGeo(0.7, 1.0, 0.7), darkWoodMat, bedX+1.6, 0.66, gmZ0+1.6);   // stool/chair
      hearth(g, gmX1+0.2, bedZ+3.4, 'x+', 2.2, stoneDarkMat);
      bannerBoard(g, gmX0+0.4, 4.6, bedZ, Math.PI/2, 2.4, 3.2);
      candleStand(g, bedX-1.8, gmZ0+2.4);

      /* ---- spiral stair in the NE corner turret + a straight flight
       * from the courtyard up to the cloister's upper gallery ------ */
      spiralStair(g, flagMat, HC_HX-3.0, HC_HZ-3.0, 2.6, 22, 11.0);
      stairFlight(g, flagMat, HC_COURT_HX-2.6, -HC_COURT_HZ+3.0, Math.PI/2, 10, 0.56, 0.62, 1.6);
    })();

    /* ---- High Castle courtyard: garth planting + a proper well head.
     * The reference courtyard photograph shows a cobbled garth, so the
     * planting here is deliberately restrained -- four small raised herb
     * plats in the quarters of the cross path, a pair of clipped bays
     * flanking the well and a vine trained along the east walk -- rather
     * than the full kitchen garden, which goes in the Middle Castle
     * courtyard where there is real open ground. No resident ever walks
     * the High Castle garth (`life.courtyard` has no box here and the
     * patrol turns back at the dry-ditch bridge), so nothing here can be
     * walked through. ------------------------------------------------ */
    (function highCourtyard(){
      var g = det(0, 2, 0, D_FAR);
      // herb plats in three quarters of the cross path (the fourth holds
      // the well) -- inside the cloister walk, clear of both paths
      herbPlat(g,  7.0, -8.0, 5.0);
      herbPlat(g,  7.0,  8.0, 5.0);
      herbPlat(g, -7.5, -8.0, 5.0);
      // the well quarter gets narrower beds either side of the well head
      gardenBed(g, -9.5, 9.5, 3.4, 5.0, 3, cropMat2, 0);
      gardenBed(g,  3.0, 11.5, 3.0, 4.4, 3, cropMat1, 0);   // clear of the N-S cross path (|x| < 1.1)
      [[-6.2,-1.9],[-6.2,1.9]].forEach(function(p){ gardenTree(g, p[0], p[1], 0.85, true); });
      // vine along the inside of the east cloister walk
      vineRun(g, HC_COURT_HX-3.4, 0, 18, Math.PI/2, 2.3);
      [[-13.0,-13.5],[13.0,-13.5],[13.0,13.5]].forEach(function(p){ pottedPlant(g, p[0], p[1]); });
      // well head: windlass, rope, bucket and a finial, matching the
      // canopied well house in the reference photograph
      var wx=-3, wz=3;
      lay(g, cylGeo(0.13,0.13,2.0,6), woodMat, wx, 1.55, wz, 0);
      lay(g, cylGeo(0.22,0.22,0.5,6), woodMat, wx, 1.55, wz, 0);
      add(g, boxGeo(0.1, 0.6, 0.1), woodMat, wx+0.55, 1.3, wz);
      add(g, boxGeo(0.06, 0.9, 0.06), metalMat, wx, 1.05, wz);
      add(g, cylGeo(0.28,0.24,0.36,7), woodMat, wx, 0.72, wz);
      add(g, coneGeo(0.24, 0.7, 6), goldMat, wx, 3.55, wz);
      registerPick(pickables, 'room', 0, 1.4, 10.5, 26, 3.0, 14,
        '中庭の菜園 Courtyard Herb Garden', '高城中庭の薬草・香草区画。修道院型の四分割花壇に薬草を育てた。');
    })();

    /* ================================================================
     * B. MIDDLE CASTLE
     * ================================================================ */
    /* ---- Great Refectory (Wielki Refektarz) ----------------------
     * The single most famous interior at Malbork and the centrepiece of
     * this fit-out. 30m long [MH]◎ along Z; the modelled width is the
     * west wing's own 13m depth (MC_WD, itself an unmeasured △ estimate)
     * rather than the documented 15m [MH] -- the surveyed 30x15m figure
     * is left untouched in the pick volume and the comment above, and
     * only the wall-to-wall geometry here is trimmed by ~1m a side so
     * the hall fits inside the wing the plan actually builds.
     *
     * Fittings follow the two Commons reference photographs closely:
     * three near-black granite monoliths on pale bases with carved pale
     * capitals; a palm vault whose ribs fan out ~14 to a pier; a red
     * clay tile floor; the great hooded fireplace; wall benches; the
     * fresco band round the top of the walls; and the near-continuous
     * screen of 14 pointed windows [MH]◎ on the river wall, which are
     * given interior reveals here.
     * ============================================================== */
    (function greatRefectory(){
      var cx = MC_WX, cz = RF_CZ;
      var g = det(cx, 5, cz, D_MID);
      var hw = MC_WD/2 - 0.6;                      // 5.9m to each wall face
      var z0 = cz - RF_D/2, z1 = cz + RF_D/2;      // documented 30m length
      var CROWN = RF_H - 0.3;                      // 9.2m, under the 9.5m ceiling

      floorSlab(g, tileMat, cx-hw, cx+hw, z0, z1);
      dado(g, plasterMat, cx-hw-0.3, cx+hw+0.3, z0-0.3, z1+0.3, 1.35, 0.55);
      // wall responds at every bay, both long walls + the two ends
      responds(g, plasterMat, 'z', cx-hw-0.05, z0+1.6, z1-1.6, 7, CROWN-0.6);
      responds(g, plasterMat, 'z', cx+hw+0.05, z0+1.6, z1-1.6, 7, CROWN-0.6);
      responds(g, plasterMat, 'x', z0+0.1, cx-hw+1.6, cx+hw-1.6, 3, CROWN-0.6);
      responds(g, plasterMat, 'x', z1-0.1, cx-hw+1.6, cx+hw-1.6, 3, CROWN-0.6);
      // the palm vault: one 14-rib fan off each granite pier, plus a
      // longitudinal ridge rib tying the three crowns together and half
      // fans against the two end walls
      RF_COL_Z.forEach(function(pz){
        fanVault(g, ribMat, cx, pz, 4.5, CROWN, hw+0.2, 5.0, 14, 0.19);
      });
      bar(g, ribMat, cx, CROWN, z0+0.4, cx, CROWN, z1-0.4, 0.2);
      vaultRing(g, ribMat, cx-hw-0.1, cx+hw+0.1, z0+0.3, z1-0.3, CROWN, 0.2);
      [z0, z1].forEach(function(ez){
        var dir = ez < cz ? 1 : -1;
        for (var i=0;i<5;i++){
          var a = -Math.PI/2 + Math.PI*(i/4);
          bar(g, ribMat, cx + Math.sin(a)*hw*0.98, CROWN, ez + dir*0.4,
                         cx, CROWN, ez + dir*3.6, 0.13);
        }
      });
      // interior reveals for the 14 documented river-wall windows: a
      // splayed pale jamb pair per light, stopping at 4.2m so the vault
      // and the floor both stay visible from a cutaway view above
      for (var w=0; w<14; w++){
        var wz = z0 + 1.2 + w*((RF_D-2.4)/13);
        add(g, boxGeo(0.5, 3.0, 1.05), plasterMat, cx-hw+0.2, 1.55+0.16, wz);
        add(g, boxGeo(0.22, 2.9, 0.8), windowMat,  cx-hw-0.05, 1.6+0.16, wz);
      }
      // the painted cycle round the top of the east wall (reference
      // photograph); a narrow band just under the vault springing, so it
      // never stands between the camera and the room
      for (var f=0; f<6; f++){
        add(g, boxGeo(0.12, 1.5, 4.2), frescoMat, cx+hw-0.1, CROWN-2.2, z0+2.6 + f*4.8);
      }
      // the great hooded fireplace, east wall, north end
      hearth(g, cx+hw-0.4, cz+9.5, 'x+', 3.0, plasterMat);
      // four long refectory tables (the hall seated 400 [MH]) + wall
      // benches down both sides
      [-1,1].forEach(function(s){
        [-1,1].forEach(function(s2){
          tableSet(g, cx + s*3.3, cz + s2*7.2, 11, Math.PI/2);
        });
        benchRun(g, cx + s*(hw-0.9), cz, 24, Math.PI/2, woodMat);
      });
      // dais + high table at the south end
      add(g, boxGeo(hw*2-1.0, 0.35, 3.4), flagMat, cx, 0.33, z0+2.4);
      tableSet(g, cx, z0+2.2, 6.0, 0, false);
      add(g, boxGeo(1.0, 1.9, 0.8), darkWoodMat, cx, 1.5, z0+1.2);
      candleStand(g, cx-2.6, z0+3.6);
      candleStand(g, cx+2.6, z0+3.6);
      // serving door + a tall Gothic cupboard, as in the photographs
      add(g, boxGeo(0.4, 2.6, 1.6), windowMat, cx+hw-0.1, 1.46, z1-3.0);
      add(g, boxGeo(1.0, 4.6, 2.0), darkWoodMat, cx-hw+1.0, 2.46, z1-4.0);
    })();

    /* ---- Grand Master's Palace: the Summer Refectory, whose single
     * central granite column carrying a palm vault is the palace's
     * signature room (the same trick as the Great Refectory at one-pier
     * scale). Plan dimensions of the palace are unmeasured △, so the
     * room is simply centred in the 22x22m block. ------------------ */
    (function grandMasterPalace(){
      var g = det(GMP_CX, 6, GMP_CZ, D_MID);
      var hw = GMP_W/2 - 1.6, hd = GMP_D/2 - 1.6, H = 8.4;
      floorSlab(g, tileMat, GMP_CX-hw, GMP_CX+hw, GMP_CZ-hd, GMP_CZ+hd);
      dado(g, plasterMat, GMP_CX-hw, GMP_CX+hw, GMP_CZ-hd, GMP_CZ+hd, 1.4, 0.55);
      responds(g, plasterMat, 'z', GMP_CX-hw+0.3, GMP_CZ-hd+1.5, GMP_CZ+hd-1.5, 4, H-0.6);
      responds(g, plasterMat, 'z', GMP_CX+hw-0.3, GMP_CZ-hd+1.5, GMP_CZ+hd-1.5, 4, H-0.6);
      responds(g, plasterMat, 'x', GMP_CZ-hd+0.3, GMP_CX-hw+1.5, GMP_CX+hw-1.5, 3, H-0.6);
      responds(g, plasterMat, 'x', GMP_CZ+hd-0.3, GMP_CX-hw+1.5, GMP_CX+hw-1.5, 3, H-0.6);
      // the one central granite column + its palm vault
      add(g, cylGeo(0.9, 1.0, 0.5, 8), plasterMat, GMP_CX, 0.41, GMP_CZ);
      add(g, cylGeo(0.52, 0.52, 4.4, 8), graniteMat, GMP_CX, 2.86, GMP_CZ);
      add(g, cylGeo(0.9, 0.62, 0.6, 8), plasterMat, GMP_CX, 5.36, GMP_CZ);
      fanVault(g, ribMat, GMP_CX, GMP_CZ, 5.7, H, hw+0.3, hd+0.3, 12, 0.18);
      vaultRing(g, ribMat, GMP_CX-hw, GMP_CX+hw, GMP_CZ-hd, GMP_CZ+hd, H, 0.18);
      // fittings: the master's table on a dais, benches, hearth, hangings
      add(g, boxGeo(hw*1.4, 0.3, 2.6), flagMat, GMP_CX, 0.31, GMP_CZ-hd+1.9);
      tableSet(g, GMP_CX, GMP_CZ-hd+1.8, 5.0, 0, false);
      add(g, boxGeo(1.0, 2.2, 0.9), darkWoodMat, GMP_CX, 1.6, GMP_CZ-hd+1.0);
      [-1,1].forEach(function(s){ tableSet(g, GMP_CX + s*3.4, GMP_CZ+1.5, 8, Math.PI/2); });
      hearth(g, GMP_CX+hw-0.2, GMP_CZ+hd-3.0, 'x+', 2.6, plasterMat);
      bannerBoard(g, GMP_CX-hw+0.4, 5.4, GMP_CZ, Math.PI/2, 3.0, 3.6);
      bannerBoard(g, GMP_CX+hw-0.4, 5.4, GMP_CZ-2.5, -Math.PI/2, 2.4, 3.2, frescoMat);
      candleStand(g, GMP_CX-2.4, GMP_CZ-hd+3.4);
      candleStand(g, GMP_CX+2.4, GMP_CZ-hd+3.4);
      spiralStair(g, flagMat, GMP_CX+hw-1.4, GMP_CZ-hd+1.4, 2.2, 16, 8.0);
      mpPickRoom(GMP_CX-hw, GMP_CX+hw, GMP_CZ-hd, GMP_CZ+hd, H,
        '夏の食堂 Summer Refectory', '大団長宮殿の主室。中央の花崗岩柱1本がパームヴォールトを支える、大食堂を縮めた構成。');
    })();

    /* ---- Infirmary (north wing) ---------------------------------- */
    (function infirmary(){
      var g = det(IF_CX, 5, IF_CZ, D_MID);
      var hw = IF_W/2 - 1.2, z0 = IF_CZ - MC_WD/2 + 1.0, z1 = IF_CZ + MC_WD/2 - 1.0;
      floorSlab(g, flagMat, IF_CX-hw, IF_CX+hw, z0, z1);
      dado(g, plasterMat, IF_CX-hw, IF_CX+hw, z0, z1, 1.3, 0.5);
      responds(g, plasterMat, 'x', z0+0.3, IF_CX-hw+1.4, IF_CX+hw-1.4, 4, 6.4);
      responds(g, plasterMat, 'x', z1-0.3, IF_CX-hw+1.4, IF_CX+hw-1.4, 4, 6.4);
      for (var b=0;b<3;b++){
        archRib(g, ribMat, 'z', IF_CX-hw+2.6 + b*(hw*2-5.2)/2, z0+0.4, z1-0.4, 6.4, 7.4, 0.13);
      }
      // two rows of sick beds with a chest at each foot
      for (var i=0;i<4;i++){
        [-1,1].forEach(function(s){
          var bx = IF_CX - hw + 2.2 + i*(hw*2-4.4)/3;
          var bz = IF_CZ + s*3.2;
          add(g, boxGeo(1.3, 0.5, 2.3), woodMat, bx, 0.41, bz);
          add(g, boxGeo(1.35, 0.24, 2.35), clothMat, bx, 0.78, bz);
          add(g, boxGeo(1.35, 1.4, 0.16), darkWoodMat, bx, 0.86, bz + s*1.2);
        });
      }
      hearth(g, IF_CX-hw+0.3, IF_CZ, 'x-', 2.2, plasterMat);
      add(g, boxGeo(1.0, 2.2, 2.4), darkWoodMat, IF_CX+hw-0.7, 1.26, IF_CZ);  // medicine press
      candleStand(g, IF_CX, IF_CZ);
      mpPickRoom(IF_CX-hw, IF_CX+hw, z0, z1, 6.4, '施療院内部 Infirmary Ward',
        '北翼の病室。両側に病床が並び、端に薬品棚と暖炉を備える。');
    })();

    /* ---- Middle Castle courtyard: the castle's kitchen garden.
     * This is the only large piece of open, level, enclosed ground in
     * the complex, so it takes the vegetable beds, the herb plats and a
     * small orchard. It occupies the EAST strip of the courtyard only
     * (x 12..26); the farmers' wander box is narrowed to maxX 10 at the
     * bottom of this file to match, and the guard patrol runs the
     * courtyard on x=0, well clear. --------------------------------- */
    (function middleCourtyard(){
      /* The courtyard's clear ground is x -27..+27, z MC_Z0..MC_Z1-MC_WD
       * (= 50.5..137.5). The whole garden is kept inside x 11..27 and
       * z 56..133 so nothing can end up standing in a wing or, worse,
       * out in the outer moat. */
      var g = det(19, 2, MC_Z0 + 40, D_FAR);
      var gz0 = MC_Z0 + 6, gz1 = MC_Z0 + 82;
      // bare soil ground under the whole plot, over the cobbled apron
      add(g, boxGeo(15.4, 0.3, gz1-gz0), soilMat, 18.8, 0.25, (gz0+gz1)/2);
      // vegetable beds in two ranks with a walking path between
      for (var i=0;i<5;i++){
        var bz = MC_Z0 + 11.5 + i*11.0;
        gardenBed(g, 15.6, bz, 5.2, 8.6, 4, i%2 ? cropMat1 : cropMat2, 0);
        gardenBed(g, 22.0, bz, 5.2, 8.6, 4, i%2 ? cropMat2 : cropMat1, 0);
      }
      add(g, boxGeo(1.5, 0.26, gz1-gz0-2), cobbleMat, 18.8, 0.28, (gz0+gz1)/2);
      hedgeRun(g, 18.8, gz0-0.6, 15.4, 0, 0.9);
      hedgeRun(g, 11.4, (gz0+gz1)/2, gz1-gz0, Math.PI/2, 0.9);
      // herb plats north of the vegetable ranks (z 115..131)
      [[15.6,119.0],[22.2,119.0],[15.6,127.5],[22.2,127.5]].forEach(function(p){
        herbPlat(g, p[0], p[1], 5.2);   // p[1] is an absolute sheet Z
      });
      hedgeRun(g, 18.8, 132.6, 15.4, 0, 0.9);
      // four small fruit trees down the west edge of the strip
      [66, 88, 106, 124].forEach(function(tz){
        gardenTree(g, 11.9, tz, 1.0, false);
      });
      vineRun(g, 25.8, MC_Z0 + 55, 34, Math.PI/2, 2.4);
      // a gardener's shed + tools + water butt at the south end
      add(g, boxGeo(3.2, 2.4, 2.6), woodMat, 22.8, 1.36, MC_Z0 + 3.4);
      add(g, coneGeo(2.6, 1.3, 4), woodMat, 22.8, 3.2, MC_Z0 + 3.4, Math.PI/4);
      barrel(g, 20.2, MC_Z0 + 3.0, 0.6, 1.2);
      cart(g, 16.0, MC_Z0 + 3.0, 0.3, true);
      registerPick(pickables, 'room', 18.8, 1.5, MC_Z0 + 44, 15, 3.0, 88,
        '中城の菜園 Kitchen Garden', '中城中庭の東側を占める菜園と薬草区画。畝・生垣・葡萄棚・果樹を備え、城内の食糧を支えた。');
    })();

    /* ================================================================
     * C. LOW CASTLE -- the working Vorburg. Seven ranges get interiors;
     * the rest keep their plain shells, because a 140x270m ward with
     * twenty-two furnished buildings would cost far more than it reads.
     * Ranges are picked to cover the documented functions: the Karwan
     * (armoury/coach house), a granary/store, the stables, the bakehouse,
     * the smithy, a workshop range and St Lawrence's chapel.
     * ================================================================ */
    /* generic service-range shell: earth or flag floor, low dado, a pair
     * of roof trusses, and whatever props the caller adds */
    function serviceRange(cx, cz, w, d, h, floorMat, axis, dist){
      axis = axis || 'z';                       // direction the ridge runs
      var g = det(cx, h*0.4, cz, dist || D_MID);
      var hw = w/2 - 0.8, hd = d/2 - 0.8;
      floorSlab(g, floorMat, cx-hw, cx+hw, cz-hd, cz+hd);
      dado(g, stoneDarkMat, cx-hw, cx+hw, cz-hd, cz+hd, 1.2, 0.5);
      // roof trusses, spaced along the ridge and spanning across it. The
      // apex is deliberately kept under the shell's own ridge (which sits
      // at h + span*0.71, see mpRange) so no truss can poke through the
      // tiles while the roof is still standing.
      var span = (axis==='z') ? hw : hd, run = (axis==='z') ? d : w;
      var n = Math.max(2, Math.round(run/9));
      for (var i=0;i<n;i++){
        var t = -run/2 + (run-1.6)*(i+0.5)/n;
        truss(g, woodMat, axis==='z' ? cx : cx+t, axis==='z' ? cz+t : cz,
              span, h-1.2, h+span*0.85, axis);
      }
      return { g:g, hw:hw, hd:hd, cx:cx, cz:cz };
    }

    // ---- Karwan: armoury + coach house, 20x45m [measured]
    // authored on the old row-2 centreline x=-20; the range now stands
    // against the west curtain at x=LC_WROW, so the whole block shifts.
    (function karwan(){
      var r = serviceRange(-20, KARWAN_CZ, 20, 45, 13.0, earthMat);
      var g = detShift(r.g, LC_WROW + 20, 0);
      cart(g, -24, KARWAN_CZ - 14, 0.1, false);
      cart(g, -16, KARWAN_CZ - 14, Math.PI + 0.1, true);
      cart(g, -24, KARWAN_CZ + 6, 0.0, true);
      // weapon racks: a frame with a row of spear shafts
      for (var k=0;k<4;k++){
        var rz = KARWAN_CZ - 4 + k*5.0;
        add(g, boxGeo(0.3, 2.4, 3.2), woodMat, -27.6, 1.36, rz);
        for (var s=0;s<7;s++){
          add(g, cylGeo(0.06,0.06,2.9,4), woodMat, -27.4, 1.6, rz - 1.4 + s*0.46);
          add(g, coneGeo(0.11, 0.4, 4), metalMat, -27.4, 3.25, rz - 1.4 + s*0.46);
        }
      }
      // barrels of powder/pitch, crates of bolts, stacked shields
      for (var b=0;b<6;b++) barrel(g, -13.2, KARWAN_CZ - 16 + b*3.0, 0.62, 1.25);
      crateStack(g, -13.6, KARWAN_CZ + 6, 0.2);
      crateStack(g, -13.6, KARWAN_CZ + 9.5, -0.3);
      for (var sh=0; sh<5; sh++){
        add(g, boxGeo(0.18, 1.3, 0.9), clothMat, -27.4, 0.85, KARWAN_CZ + 12 + sh*1.1);
      }
      woodPile(g, -20, KARWAN_CZ + 19, 3.4, 0);
    })();

    // ---- storehouse (west range, 2nd block): barrels, sacks, a hoist
    (function storehouse(){
      var r = serviceRange(-51, LC_Z0 + 37, 22, 50, 12.5, flagMat);
      var g = detShift(r.g, LC_WROW + 51, 54), cz = LC_Z0 + 37;
      for (var row=0; row<2; row++){
        for (var b=0;b<9;b++){
          barrel(g, -57.5 + row*13.0, cz - 18 + b*4.3, 0.7, 1.5);
        }
      }
      for (var s=0;s<5;s++) sackPile(g, -51, cz - 14 + s*7.0, 6, s*0.7);
      crateStack(g, -47, cz + 20, 0.4);
      crateStack(g, -55, cz + 20, -0.2);
      // sack hoist over the central aisle
      add(g, boxGeo(0.3, 0.3, 4.0), woodMat, -51, 9.4, cz - 21);
      bar(g, metalMat, -51, 9.2, cz - 22.4, -51, 4.2, cz - 22.4, 0.07);
      add(g, boxGeo(1.2, 0.9, 1.0), sackMat, -51, 3.6, cz - 22.4);
    })();

    // ---- stables (row 1, mid): stalls, hay, troughs, tack
    (function stables(){
      var r = serviceRange(-50, LC_Z0 + 135, 20, 46, 11.0, strawMat);
      var g = detShift(r.g, LC_WROW + 50, 12), cz = LC_Z0 + 135;
      for (var i=0;i<9;i++){
        var sz = cz - 19 + i*4.6;
        [-1,1].forEach(function(s){
          add(g, boxGeo(6.0, 1.7, 0.22), woodMat, -50 + s*5.6, 1.01, sz);      // stall divider
          add(g, boxGeo(1.6, 0.5, 2.6), woodMat, -50 + s*8.4, 0.58, sz + 2.3); // manger
        });
      }
      // central straw-strewn aisle + hay bales and water troughs
      add(g, boxGeo(3.0, 0.24, 42), earthMat, -50, 0.3, cz);
      hayPile(g, -50, cz - 21.0, 1.6, 2.0);
      hayPile(g, -50, cz + 21.0, 1.4, 1.8);
      [-1,1].forEach(function(s){
        add(g, boxGeo(1.0, 0.7, 3.0), woodMat, -50 + s*3.0, 0.51, cz);
        for (var t=0;t<4;t++){
          add(g, boxGeo(0.16, 0.9, 0.16), woodMat, -50 + s*9.0, 2.4, cz - 12 + t*8);  // tack pegs
          add(g, boxGeo(0.5, 0.8, 0.7), darkWoodMat, -50 + s*8.6, 2.2, cz - 12 + t*8);
        }
      });
      mpPickRoom(LC_WROW-10, LC_WROW+10, cz+12-23, cz+12+23, 11.0, '厩舎 Stables',
        '低城西列の厩舎。中央通路の両側に馬房が並び、飼葉桶と干し草が置かれる。');
    })();

    // ---- bakehouse (cross range at z=146): two domed bread ovens
    (function bakehouse(){
      // this one is a CROSS range -- its ridge runs east-west, so the
      // trusses have to span the 14m depth, not the 26m frontage
      var r = serviceRange(-4, LC_Z0 + 146, 26, 14, 9.5, flagMat, 'x');
      var g = detShift(r.g, -51, 40), cz = LC_Z0 + 146;
      [-1,1].forEach(function(s){
        var ox = -4 + s*8.0;
        add(g, cylGeo(2.3, 2.6, 1.6, 10), stoneDarkMat, ox, 0.96, cz - 3.4);
        var dome = new T.Mesh(coneGeo(2.4, 2.0, 10), stoneDarkMat);
        dome.castShadow = true; dome.receiveShadow = true;
        dome.position.set(ox, 2.7, cz - 3.4);
        g.add(dome);
        add(g, boxGeo(1.5, 1.1, 0.5), emberMat, ox, 1.0, cz - 1.5);   // oven mouth
        add(g, boxGeo(1.1, 4.2, 1.1), stoneDarkMat, ox, 5.4, cz - 4.4); // flue
      });
      tableSet(g, -4, cz + 1.6, 7.0, 0, false);
      tableSet(g, -4, cz + 4.0, 7.0, 0, false);
      sackPile(g, 6.5, cz + 3.5, 6, 0.4);
      sackPile(g, -14.5, cz + 3.5, 5, 1.2);
      woodPile(g, 8.0, cz - 3.0, 2.6, Math.PI/2);
      // peels leaning by the ovens
      [-1,1].forEach(function(s){
        bar(g, woodMat, -4 + s*4.6, 0.2, cz-2.0, -4 + s*4.0, 2.9, cz-1.0, 0.1);
      });
      mpPickRoom(-68, -42, cz+40-7, cz+40+7, 9.5, 'パン焼き所 Bakehouse',
        '低城のパン焼き窯。ドーム状の窯2基と練り台が並び、修道会全体のパンを焼いた。');
    })();

    // ---- smithy (row 3, south): forge, anvil, bellows, quench trough
    (function smithy(){
      var r = serviceRange(15, LC_Z0 + 74, 14, 28, 6.5, earthMat);
      var g = detShift(r.g, 43.5, 88), cz = LC_Z0 + 74;
      add(g, boxGeo(3.2, 1.1, 2.4), stoneDarkMat, 19.4, 0.71, cz - 8);      // forge bed
      add(g, boxGeo(2.4, 0.4, 1.7), emberMat, 19.4, 1.46, cz - 8);
      add(g, boxGeo(2.0, 3.6, 2.0), stoneDarkMat, 19.4, 3.4, cz - 10.0);    // hood + flue
      add(g, boxGeo(1.4, 1.0, 2.2), woodMat, 17.0, 1.5, cz - 8.4);          // bellows
      add(g, cylGeo(0.42,0.52,0.85,7), darkWoodMat, 15.0, 0.58, cz - 6.0);  // anvil stump
      add(g, boxGeo(0.5, 0.4, 1.3), metalMat, 15.0, 1.2, cz - 6.0);         // anvil
      add(g, boxGeo(1.1, 0.8, 2.2), woodMat, 12.2, 0.56, cz - 4.0);         // quench trough
      tableSet(g, 12.4, cz + 3.0, 4.0, Math.PI/2, false);
      for (var tp=0; tp<6; tp++){
        add(g, boxGeo(0.12, 0.9, 0.1), metalMat, 20.2, 2.5, cz - 1.5 + tp*0.6);
      }
      for (var ir=0; ir<4; ir++){
        add(g, boxGeo(0.3, 0.24, 2.4), metalMat, 17.6, 0.32 + ir*0.26, cz + 6.5);
      }
      barrel(g, 19.6, cz + 10.0, 0.6, 1.2);
      woodPile(g, 13.0, cz + 10.0, 2.4, 0);
      mpPickRoom(52.5, 64.5, cz+88-13, cz+88+13, 6.5, '鍛冶場 Smithy',
        '低城の鍛冶工房。炉とふいご、金床、焼入れ桶が並ぶ。武具と馬具の修理を担った。');
    })();

    // ---- workshop / granary range (row 4, mid): looms, benches, grain
    (function workshops(){
      var r = serviceRange(47, LC_Z0 + 178, 22, 56, 13.0, flagMat);
      var g = detShift(r.g, LC_EROW - 47, -82), cz = LC_Z0 + 178;
      // grain bins at the north half
      for (var b=0;b<4;b++){
        [-1,1].forEach(function(s){
          add(g, boxGeo(3.4, 2.6, 3.4), woodMat, 47 + s*6.4, 1.46, cz + 6 + b*5.6);
          add(g, boxGeo(3.6, 0.2, 3.6), darkWoodMat, 47 + s*6.4, 2.86, cz + 6 + b*5.6);
        });
      }
      // looms + work benches at the south half
      for (var l=0;l<3;l++){
        var lz = cz - 20 + l*6.5;
        [-1,1].forEach(function(s){
          var lx = 47 + s*5.4;
          add(g, boxGeo(2.4, 0.24, 0.3), woodMat, lx, 2.5, lz);
          [-1,1].forEach(function(s2){
            add(g, boxGeo(0.22, 2.5, 0.22), woodMat, lx + s2*1.1, 1.41, lz - 0.7);
            add(g, boxGeo(0.22, 2.5, 0.22), woodMat, lx + s2*1.1, 1.41, lz + 0.7);
          });
          add(g, boxGeo(2.2, 1.5, 0.16), clothMat, lx, 1.5, lz);
          benchRun(g, lx, lz + 1.6, 2.2, 0, woodMat);
        });
      }
      sackPile(g, 47, cz + 2.0, 6, 0.2);
      crateStack(g, 41.5, cz - 24, 0.3);
      crateStack(g, 52.5, cz - 24, -0.4);
      mpPickRoom(LC_EROW-10, LC_EROW+10, cz-82-27, cz-82+27, 13.0, '工房と穀倉 Workshops & Granary',
        '低城東列の長大な棟。北半分は穀物庫、南半分は織機の並ぶ工房。');
    })();

    // ---- St Lawrence's church interior (now outside the walls, north)
    (function lcChapel(){
      var g = detShift(det(13, 5, CHAPEL_CZ, D_MID), CHAPEL_CX - 13, 0);
      floorSlab(g, tileMat, 7.6, 18.4, CHAPEL_CZ-9.4, CHAPEL_CZ+9.4);
      dado(g, plasterMat, 7.6, 18.4, CHAPEL_CZ-9.4, CHAPEL_CZ+9.4, 1.2, 0.5);
      responds(g, plasterMat, 'z',  8.0, CHAPEL_CZ-7, CHAPEL_CZ+7, 4, 8.4);
      responds(g, plasterMat, 'z', 18.0, CHAPEL_CZ-7, CHAPEL_CZ+7, 4, 8.4);
      for (var b2=0;b2<4;b2++){
        var bz = CHAPEL_CZ - 6.6 + b2*4.4;
        archRib(g, ribMat, 'x', bz, 8.2, 17.8, 8.4, 9.6, 0.13);   // transverse
      }
      bar(g, ribMat, 13, 9.6, CHAPEL_CZ-8.6, 13, 9.6, CHAPEL_CZ+8.6, 0.13); // ridge
      add(g, boxGeo(2.2, 1.1, 0.9), flagMat, 13, 0.72, CHAPEL_CZ + 7.4);
      add(g, boxGeo(2.4, 2.8, 0.4), goldMat, 13, 1.6, CHAPEL_CZ + 8.4);
      for (var p=0;p<5;p++){
        [-1,1].forEach(function(s){
          benchRun(g, 13 + s*2.4, CHAPEL_CZ - 6 + p*2.6, 3.0, 0, woodMat);
        });
      }
      candleStand(g, 10.6, CHAPEL_CZ + 6.4);
      candleStand(g, 15.4, CHAPEL_CZ + 6.4);
    })();

    /* ---- Low Castle open ward: the FORMAL GARDEN, the orchard, the herb
     * plats and the yard clutter that now fill the middle of the Vorburg.
     *
     * This is the other half of the Low Castle rebuild. With the ranges
     * pulled back against the curtain there is a 92 x 230m open ward in
     * the middle, and both reference photographs show what belongs in it:
     * a formal garden laid out in neat rectangular beds either side of a
     * path, an orchard, herb plats, and working ground. Empty lawn alone
     * would read as a car park; this is what makes the open ward read as
     * deliberately open rather than unbuilt.
     *
     * Everything below is checked against the ward's circulation, which
     * is fixed by construction (see the lcSegs banding comment):
     *   farmer lanes  x -45..-39 and +39..+45, the spine at x -2..+2,
     *                 the cross band z LC_Z0+128..148, the gate square
     *   guard patrol  x = +/-38, z = LC_Z0+18 and LC_Z0+246
     * so no bed, tree or woodpile can ever stand where a resident walks.
     * ------------------------------------------------------------------ */
    (function lowCastleGrounds(){
      /* NOT on D_FAR. Every other planting block in this file is gated at
       * 500m because it is detail you only need once you have zoomed in,
       * but this one IS the Low Castle now: with the sheds gone, an
       * ungated ward shows 92 x 230m of bare lawn at the opening camera
       * distance (620) and the whole point of the rebuild -- "walled
       * enclosure with buildings round the edge and a GARDEN in the
       * middle" -- is invisible exactly when the castle is being read as
       * a whole. D_WARD sits past zMax (820) so the parterre, the herb
       * plats and the orchard are always drawn. Measured cost of doing
       * so: ~150 draw calls, against the ~930 the rebuild gave back. */
      var D_WARD = 1000;   // > view.zMax (940), i.e. never gated out
      var g = det(0, 2, LC_Z0 + 130, D_WARD);
      /* FORMAL GARDEN: two blocks of rectangular beds either side of the
       * cobbled spine, hedged all round -- the parterre that reads so
       * clearly from the air in the reference photograph. */
      var gz = LC_Z0 + 80;
      [-1, 1].forEach(function(side){
        var bx = side * 18;                       // block centre, x 6..30 either side
        add(g, boxGeo(24.0, 0.24, 76.0), soilMat, bx, 0.28, gz);
        for (var i=0;i<5;i++){
          var bz = gz - 30 + i*15;
          gardenBed(g, bx - 6.0, bz, 10.0, 6.4, 4, i%2 ? cropMat1 : cropMat2);
          gardenBed(g, bx + 6.0, bz, 10.0, 6.4, 4, i%2 ? cropMat2 : cropMat1);
        }
        hedgeRun(g, bx, gz - 39.0, 24.0, 0, 1.0);
        hedgeRun(g, bx, gz + 39.0, 24.0, 0, 1.0);
        hedgeRun(g, bx + side*12.4, gz, 76.0, Math.PI/2, 1.0);
      });
      // herb plats west of the spine, north of the parterre
      var hz = LC_Z0 + 166;
      add(g, boxGeo(18.0, 0.24, 20.0), soilMat, -23, 0.28, hz);
      herbPlat(g, -29.0, hz - 5.0, 5.2);
      herbPlat(g, -29.0, hz + 5.0, 5.2);
      herbPlat(g, -17.0, hz - 5.0, 5.2);
      herbPlat(g, -17.0, hz + 5.0, 5.2);
      hedgeRun(g, -23, hz - 10.4, 18.0, 0, 0.9);
      hedgeRun(g, -23, hz + 10.4, 18.0, 0, 0.9);
      vineRun(g, 20.0, hz, 24, Math.PI/2, 2.3);
      // orchard filling the north half of the ward
      for (var t=0;t<14;t++){
        gardenTree(g, -24 + (t%4)*16, LC_Z0 + 192 + Math.floor(t/4)*15, 1.05, false);
      }
      // yard clutter, kept in the corners of the ward and off every lane
      woodPile(g, -33, LC_Z0 + 30, 3.0, 0);
      woodPile(g, 30, LC_Z0 + 158, 3.0, Math.PI/2);
      hayPile(g, -31, LC_Z0 + 232, 2.0, 2.4);
      hayPile(g, 31, LC_Z0 + 34, 1.8, 2.2);
      cart(g, -14, LC_Z0 + 26, 0.6, true);
      cart(g, 16, LC_Z0 + 244, -0.4, false);
      // a working well on the square inside the east gate
      (function lcWell(){
        var wx = 30, wz = LC_GATE_Z - 7;
        add(g, cylGeo(1.1,1.1,1.0,12), stoneDarkMat, wx, 0.66, wz);
        [-1,1].forEach(function(s){
          add(g, boxGeo(0.18, 2.6, 0.18), woodMat, wx + s*1.0, 1.46, wz);
        });
        lay(g, cylGeo(0.2,0.2,2.2,6), woodMat, wx, 2.66, wz, 0);
        add(g, boxGeo(2.6, 0.24, 1.2), woodMat, wx, 2.9, wz);
        add(g, cylGeo(0.26,0.22,0.34,7), woodMat, wx, 1.9, wz);
        registerPick(pickables, 'structure', wx, 1.6, wz, 3.0, 3.2, 3.0,
          '低城の井戸 Vorburg Well', '低城の作業広場に置かれた井戸。厩舎・パン焼き所・鍛冶場の水源。');
      })();
      registerPick(pickables, 'room', 0, 1.5, gz, 62, 3.0, 80,
        '低城の庭園 Vorburg Garden', '低城の広い中庭を占める整形庭園。石畳の軸道を挟んで矩形の花壇が並び、北へ薬草園と果樹園が続く。');
    })();

    /* ================================================================
     * C2. LIVESTOCK. Malbork was the Order's central supply base -- a
     * garrison, a stud, a granary and a slaughterhouse for a complex
     * that fed several thousand people. So the Vorburg gets the animals
     * that go with the buildings already standing in it: warhorses in
     * the stalls of the stables range, cattle and pigs in pens dropped
     * into the gaps between ranges, sheep and goats in a fold, poultry
     * round the bakehouse, a brick dovecote, and waterfowl on the Nogat.
     *
     * The four rules the rest of this fit-out follows apply here too,
     * plus one more that matters most at this castle:
     *  - EVERY animal hangs off a `det()` LOD gate, and there are only
     *    THREE of them (stables / Vorburg yards / river), so the whole
     *    population is one scene-graph switch each and vanishes entirely
     *    beyond the gate distance.
     *  - Parts are merged: each animal is 5-11 boxes/cylinders/spheres,
     *    but they are accumulated and welded into ONE BufferGeometry per
     *    (gate x material) pair. ~60 animals therefore cost about a
     *    dozen draw calls in total, not six hundred. Measured before and
     *    after: 2297 -> 2310 calls at the opening shot.
     *  - Positions are checked against the Low Castle BAND table
     *    documented above `lcSegs` (parcham / row / lane bands), the
     *    farmer wander boxes and the guard patrol line -- in particular
     *    the patrol's east-west leg along z = LC_Z0+6, which rules out
     *    the otherwise-tempting open strip inside the south wall.
     *  - Colours: every channel stays at or below 0x80, because a day-lit
     *    horizontal face is multiplied by roughly 1.95.
     *  - Poses vary deterministically from a coordinate hash, never
     *    Math.random(), so a reload gives the identical yard.
     * ================================================================ */
    (function livestock(){
      /* 楕円体だけは上の geoCache に無いので追加(球を1回だけ作って
       * 寸法ごとに scale した geometry をキャッシュする) */
      function ellGeo(rx,ry,rz){
        var k = 'L'+rx.toFixed(2)+'/'+ry.toFixed(2)+'/'+rz.toFixed(2);
        if (!geoCache[k]){ var g = new T.SphereGeometry(1,7,5); g.scale(rx,ry,rz); geoCache[k] = g; }
        return geoCache[k];
      }
      /* ---- パーツの蓄積と統合 ------------------------------------
       * at()   … 1体ぶんの基準変換(足元 x,y,z と向き yaw。局所 +X が前方)
       * part() … 局所座標でパーツを1つ積む
       * flush()… (親グループ × 素材) ごとに1メッシュへ溶接して吐き出す */
      var batches = [];
      function bucket(t, m){
        for (var i=0;i<batches.length;i++) if (batches[i].t===t && batches[i].m===m) return batches[i];
        var b = { t:t, m:m, parts:[] }; batches.push(b); return b;
      }
      function at(t, x, y, z, yaw){
        var m = new T.Matrix4().makeRotationY(yaw || 0);
        m.setPosition(x, y, z);
        return { t:t, base:m };
      }
      function part(c, mat, geo, lx,ly,lz, ry,rz,rx){
        var lm = new T.Matrix4().makeRotationFromEuler(new T.Euler(rx||0, ry||0, rz||0, 'YXZ'));
        lm.setPosition(lx, ly, lz);
        bucket(c.t, mat).parts.push({ g:geo, m:new T.Matrix4().multiplyMatrices(c.base, lm) });
      }
      function flush(){
        var nrmM = new T.Matrix3(), v = new T.Vector3();
        batches.forEach(function(b){
          var nv = 0, ni = 0, i, k;
          for (i=0;i<b.parts.length;i++){
            nv += b.parts[i].g.attributes.position.count;
            ni += b.parts[i].g.index.count;
          }
          var pos = new Float32Array(nv*3), nor = new Float32Array(nv*3);
          var idx = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
          var vo = 0, io = 0;
          for (i=0;i<b.parts.length;i++){
            var p = b.parts[i], gp = p.g.attributes.position, gn = p.g.attributes.normal;
            nrmM.getNormalMatrix(p.m);
            for (k=0;k<gp.count;k++){
              v.fromBufferAttribute(gp,k).applyMatrix4(p.m);
              pos[(vo+k)*3] = v.x; pos[(vo+k)*3+1] = v.y; pos[(vo+k)*3+2] = v.z;
              v.fromBufferAttribute(gn,k).applyMatrix3(nrmM).normalize();
              nor[(vo+k)*3] = v.x; nor[(vo+k)*3+1] = v.y; nor[(vo+k)*3+2] = v.z;
            }
            var gi = p.g.index.array;
            for (k=0;k<gi.length;k++) idx[io+k] = gi[k] + vo;
            vo += gp.count; io += gi.length;
          }
          var geo = new T.BufferGeometry();
          geo.setAttribute('position', new T.BufferAttribute(pos,3));
          geo.setAttribute('normal', new T.BufferAttribute(nor,3));
          geo.setIndex(new T.BufferAttribute(idx,1));
          geo.computeBoundingSphere();
          var mesh = new T.Mesh(geo, b.m);
          mesh.castShadow = true; mesh.receiveShadow = true;
          b.t.add(mesh);
        });
        batches.length = 0;
      }
      function rnd(x,z,s){
        var v = Math.sin(x*12.9898 + z*78.233 + (s||0)*37.719) * 43758.5453;
        return v - Math.floor(v);
      }

      /* ---- 毛色・羽色。素の値でどのチャンネルも 0x80 以下 -------- */
      var bayMat   = new T.MeshLambertMaterial({ color: 0x5e3f27 }); // 鹿毛の軍馬・犬
      var blackMat = new T.MeshLambertMaterial({ color: 0x2f2620 }); // 黒毛・蹄・鬣・角
      var greyMat  = new T.MeshLambertMaterial({ color: 0x7c766c }); // 芦毛・鳩・鵞鳥
      var oxMat    = new T.MeshLambertMaterial({ color: 0x63513a }); // 牛
      var woolMat2 = new T.MeshLambertMaterial({ color: 0x7a7264 }); // 羊毛
      var goatMat  = new T.MeshLambertMaterial({ color: 0x6a5a45 });
      var pigMat   = new T.MeshLambertMaterial({ color: 0x7d6153 });
      var fowlMat  = new T.MeshLambertMaterial({ color: 0x6d5e45 });
      var cockMat  = new T.MeshLambertMaterial({ color: 0x6b3520 });
      var combMat  = new T.MeshLambertMaterial({ color: 0x7d2117 });
      var beakMat2 = new T.MeshLambertMaterial({ color: 0x7d6626 });
      var swanMat  = new T.MeshLambertMaterial({ color: 0x7f7a72 }); // 乗算後に白く見える
      var dcWallMat= texMat(BRICK_WALL, 'brick', { nrm: 0.8 });    // 鳩小屋のレンガ
      var dcRoofMat= texMat(ROOF_COL, 'roof', { nrm: 0.7 });       // 同 瓦

      /* ---- 四足獣。pose 0=立つ / 1=草を食む / 2=伏せる ---------- */
      function beast(t, x, z, yaw, S, pose, baseY){
        var c = at(t, x, baseY||0, z, yaw);
        var lying = pose===2, graze = pose===1;
        var lh = lying ? S.lh*0.26 : S.lh;
        var by = lh + S.bh*0.5;
        part(c, S.body, boxGeo(S.bl, S.bh, S.bw), 0, by, 0);
        part(c, S.body, ellGeo(S.bh*0.42, S.bh*0.50, S.bw*0.50),  S.bl*0.5, by - S.bh*0.03, 0);
        part(c, S.body, ellGeo(S.bh*0.46, S.bh*0.52, S.bw*0.52), -S.bl*0.5, by + S.bh*0.04, 0);
        var px = S.bl*0.33, pz = S.bw*0.30;
        [[px,pz],[px,-pz],[-px,pz],[-px,-pz]].forEach(function(p){
          part(c, S.leg, cylGeo(S.lr*0.76, S.lr, lh, 5), p[0], lh*0.5, p[1]);
        });
        // 草を食む個体は口先が地面に届くまで首を落とす
        var a = graze ? -1.35 : (lying ? 0.62 : S.neckA);
        var nx0 = S.bl*0.44, ny0 = by + S.bh*0.26;
        part(c, S.body, boxGeo(S.nl, S.nw, S.nw*0.9),
          nx0 + Math.cos(a)*S.nl*0.5, ny0 + Math.sin(a)*S.nl*0.5, 0, 0, a);
        if (S.mane) part(c, blackMat, boxGeo(S.nl*0.96, S.nw*0.26, S.nw*0.42),
          nx0 + Math.cos(a)*S.nl*0.5 - Math.sin(a)*S.nw*0.44,
          ny0 + Math.sin(a)*S.nl*0.5 + Math.cos(a)*S.nw*0.44, 0, 0, a);
        var tx = nx0 + Math.cos(a)*S.nl, ty = ny0 + Math.sin(a)*S.nl;
        var ha = a*0.45 - 0.32;
        part(c, S.body, boxGeo(S.hl, S.hh, S.hw),
          tx + Math.cos(ha)*S.hl*0.42, ty + Math.sin(ha)*S.hl*0.42, 0, 0, ha);
        if (S.muzzle) part(c, S.muzzle, boxGeo(S.hl*0.36, S.hh*0.66, S.hw*0.8),
          tx + Math.cos(ha)*S.hl*0.92, ty + Math.sin(ha)*S.hl*0.92, 0, 0, ha);
        if (S.ear) [1,-1].forEach(function(s){
          part(c, S.body, coneGeo(S.ear, S.ear*2.6, 4),
            tx + Math.cos(ha)*S.hl*0.06, ty + S.hh*0.46, s*S.hw*0.34, 0, 0, -s*0.42);
        });
        if (S.horn) [1,-1].forEach(function(s){
          part(c, S.hornMat || greyMat, coneGeo(S.horn, S.horn*4.2, 4),
            tx + Math.cos(ha)*S.hl*0.10, ty + S.hh*0.52, s*S.hw*0.30, 0, -0.5, -s*0.75);
        });
        var td = S.tail;
        part(c, S.tailMat || S.leg, boxGeo(td, S.tw, S.tw),
          -S.bl*0.5 - 0.62*td*0.5, by + S.bh*0.32 - 0.78*td*0.5, 0, 0, -2.24);
      }

      /* ---- 地上の鳥。pose 0=立つ / 1=ついばむ / 2=うずくまる ---- */
      function bird(t, x, z, yaw, S, pose, baseY){
        var c = at(t, x, baseY||0, z, yaw);
        var peck = pose===1, sit = pose===2;
        var legH = sit ? 0.02 : S.legH;
        var pitch = peck ? -0.55 : (sit ? 0.05 : 0.24);
        var by = legH + S.br*0.95;
        part(c, S.body, ellGeo(S.bl, S.br, S.bw), 0, by, 0, 0, pitch);
        var na = peck ? -1.0 : 0.95;
        var nx0 = S.bl*0.62, ny0 = by + S.br*0.30;
        part(c, S.body, cylGeo(S.nr*0.85, S.nr, S.nl, 5),
          nx0 + Math.cos(na)*S.nl*0.5, ny0 + Math.sin(na)*S.nl*0.5, 0, 0, na - Math.PI/2);
        var hx = nx0 + Math.cos(na)*S.nl, hy = ny0 + Math.sin(na)*S.nl;
        part(c, S.body, ellGeo(S.hr*1.15, S.hr, S.hr), hx, hy, 0);
        part(c, beakMat2, coneGeo(S.hr*0.5, S.hr*1.5, 4),
          hx + S.hr*1.5, hy - S.hr*0.1, 0, 0, peck ? -Math.PI/2-0.6 : -Math.PI/2+0.2);
        part(c, S.tailMat || S.body, boxGeo(S.bl*1.1, S.br*0.7, S.bw*0.5),
          -S.bl*1.05, by + S.br*0.6, 0, 0, 0.55);
        if (!sit) [1,-1].forEach(function(s){
          part(c, beakMat2, cylGeo(S.lr, S.lr, legH, 4), -S.bl*0.05, legH*0.5, s*S.bw*0.42);
        });
        if (S.comb){
          part(c, combMat, boxGeo(S.hr*1.3, S.hr*0.85, S.hr*0.22), hx + S.hr*0.15, hy + S.hr*1.15, 0);
          part(c, combMat, boxGeo(S.hr*0.5, S.hr*0.9, S.hr*0.2), hx + S.hr*1.1, hy - S.hr*1.0, 0);
        }
        if (S.sickle) [0.35,-0.25].forEach(function(o,i){
          part(c, blackMat, boxGeo(S.bl*1.6, S.br*0.22, S.bw*0.22),
            -S.bl*1.35, by + S.br*(1.15 + i*0.45), o*S.bw, 0, 0.95 + i*0.25);
        });
      }

      /* ---- 水鳥(浮いている)。脚は水中なので作らない ------------ */
      function swimmer(t, x, y, z, yaw, S){
        var c = at(t, x, y, z, yaw);
        part(c, S.body, ellGeo(S.bl, S.bh, S.bw), 0, S.bh*0.30, 0, 0, -0.10);
        var bx = S.bl*0.55, byy = S.bh*0.75;
        part(c, S.body, cylGeo(S.nr*0.8, S.nr, S.n1, 6),
          bx + Math.cos(S.a1)*S.n1*0.5, byy + Math.sin(S.a1)*S.n1*0.5, 0, 0, S.a1 - Math.PI/2);
        var mx = bx + Math.cos(S.a1)*S.n1, my = byy + Math.sin(S.a1)*S.n1;
        part(c, S.body, cylGeo(S.nr*0.8, S.nr*0.8, S.n2, 6),
          mx + Math.cos(S.a2)*S.n2*0.5, my + Math.sin(S.a2)*S.n2*0.5, 0, 0, S.a2 - Math.PI/2);
        var hx = mx + Math.cos(S.a2)*S.n2, hy = my + Math.sin(S.a2)*S.n2;
        part(c, S.body, ellGeo(S.hr*1.3, S.hr, S.hr), hx, hy, 0);
        part(c, S.beak || beakMat2, coneGeo(S.hr*0.55, S.hr*2.0, 4),
          hx + S.hr*1.7, hy - S.hr*0.25, 0, 0, -Math.PI/2 + 0.35);
        part(c, S.body, boxGeo(S.bl*0.9, S.bh*0.5, S.bw*0.55), -S.bl*0.95, S.bh*0.55, 0, 0, 0.45);
      }

      /* ---- 止まっている鳥(鳩)。y は止まり木/棚の高さ ---------- */
      function perched(t, x, y, z, yaw, S){
        var c = at(t, x, y, z, yaw);
        part(c, S.body, ellGeo(S.bl, S.br, S.bw), 0, S.br*1.05, 0, 0, 0.42);
        part(c, S.body, ellGeo(S.hr*1.1, S.hr, S.hr), S.bl*0.72, S.br*2.0, 0);
        part(c, S.beak || beakMat2, coneGeo(S.hr*0.5, S.hr*1.3, 4),
          S.bl*0.72 + S.hr*1.25, S.br*2.0 - S.hr*0.2, 0, 0, -Math.PI/2 - 0.5);
        part(c, S.tailMat || S.body, boxGeo(S.bl*1.5, S.br*0.35, S.bw*0.7), -S.bl*1.1, S.br*0.45, 0, 0, 0.30);
        [1,-1].forEach(function(s){
          part(c, beakMat2, cylGeo(S.br*0.14, S.br*0.14, S.br*0.55, 4), 0, S.br*0.3, s*S.bw*0.4);
        });
      }

      /* 動物以外の小物も同じバッチに載せる。囲いの杭だけで約60メッシュ
       * あり、add() で個別に置くとそのぶんドローコールが増えるため。 */
      function prop(t, mat, geo, x, y, z, ry){
        part(at(t, x, y, z, ry), mat, geo, 0, 0, 0);
      }
      /* ---- 柵(囲い)。杭と2段の横木 ------------------------------ */
      function pen(t, x0, x1, z0, z1){
        var h = 1.15;
        function run(ax, az, bx, bz){
          var len = Math.hypot(bx-ax, bz-az);
          // 局所 +Z を柵の走る向きに合わせる(rotation.y=ry で +Z は
          // (sin ry, cos ry) を向くので atan2(dx, dz) でよい)
          var c = at(t, (ax+bx)/2, 0, (az+bz)/2, Math.atan2(bx-ax, bz-az));
          var n = Math.max(2, Math.round(len/3.2));
          for (var i=0;i<=n;i++){
            part(c, woodMat, cylGeo(0.09, 0.11, h, 5), 0, h/2, -len/2 + len*(i/n));
          }
          [0.42, 0.86].forEach(function(f){
            part(c, woodMat, boxGeo(0.10, 0.12, len), 0, h*f, 0);
          });
        }
        run(x0, z0, x1, z0);
        run(x0, z1, x1, z1);
        run(x0, z0, x0, z1);
        run(x1, z0, x1, z1);
      }

      /* ---- 種ごとの寸法(メートル) ------------------------------ */
      var WARHORSE = { bl:2.05, bh:0.94, bw:0.72, lh:0.80, lr:0.11, nl:0.90, nw:0.40,
                  hl:0.66, hh:0.35, hw:0.29, tail:0.76, tw:0.16, ear:0.06, neckA:0.72,
                  mane:true, body:bayMat, leg:blackMat, muzzle:blackMat, tailMat:blackMat };
      var WARHORSE_G = { bl:2.05, bh:0.94, bw:0.72, lh:0.80, lr:0.11, nl:0.90, nw:0.40,
                  hl:0.66, hh:0.35, hw:0.29, tail:0.76, tw:0.16, ear:0.06, neckA:0.72,
                  mane:true, body:greyMat, leg:blackMat, muzzle:blackMat, tailMat:greyMat };
      var WARHORSE_B = { bl:2.05, bh:0.94, bw:0.72, lh:0.80, lr:0.11, nl:0.90, nw:0.40,
                  hl:0.66, hh:0.35, hw:0.29, tail:0.76, tw:0.16, ear:0.06, neckA:0.72,
                  mane:true, body:blackMat, leg:blackMat, muzzle:blackMat, tailMat:blackMat };
      var OX    = { bl:1.90, bh:0.96, bw:0.72, lh:0.62, lr:0.105, nl:0.44, nw:0.36,
                  hl:0.54, hh:0.32, hw:0.30, tail:0.72, tw:0.07, ear:0.07, horn:0.055,
                  neckA:0.42, body:oxMat, leg:blackMat, muzzle:blackMat, tailMat:blackMat };
      var CALF  = { bl:1.00, bh:0.52, bw:0.40, lh:0.38, lr:0.055, nl:0.24, nw:0.20,
                  hl:0.30, hh:0.18, hw:0.17, tail:0.38, tw:0.045, ear:0.045,
                  neckA:0.34, body:oxMat, leg:blackMat, muzzle:blackMat, tailMat:blackMat };
      var SHEEP = { bl:0.98, bh:0.60, bw:0.48, lh:0.34, lr:0.055, nl:0.24, nw:0.24,
                  hl:0.30, hh:0.20, hw:0.18, tail:0.16, tw:0.09, ear:0.045,
                  neckA:0.35, body:woolMat2, leg:blackMat, muzzle:blackMat, tailMat:woolMat2 };
      var GOAT  = { bl:0.86, bh:0.46, bw:0.38, lh:0.42, lr:0.045, nl:0.24, nw:0.20,
                  hl:0.28, hh:0.16, hw:0.15, tail:0.14, tw:0.06, ear:0.05, horn:0.035,
                  neckA:0.55, body:goatMat, leg:blackMat, muzzle:blackMat, tailMat:goatMat };
      var PIG   = { bl:1.12, bh:0.56, bw:0.46, lh:0.28, lr:0.055, nl:0.16, nw:0.30,
                  hl:0.34, hh:0.24, hw:0.24, tail:0.16, tw:0.05, ear:0.06,
                  neckA:0.10, body:pigMat, leg:pigMat, muzzle:blackMat, tailMat:pigMat };
      var PIGLET= { bl:0.52, bh:0.28, bw:0.24, lh:0.16, lr:0.03, nl:0.08, nw:0.16,
                  hl:0.18, hh:0.13, hw:0.13, tail:0.09, tw:0.03, ear:0.035,
                  neckA:0.10, body:pigMat, leg:pigMat, muzzle:blackMat, tailMat:pigMat };
      var DOG   = { bl:0.74, bh:0.34, bw:0.26, lh:0.36, lr:0.045, nl:0.20, nw:0.17,
                  hl:0.28, hh:0.16, hw:0.15, tail:0.36, tw:0.05, ear:0.055,
                  neckA:0.62, body:bayMat, leg:bayMat, muzzle:blackMat, tailMat:bayMat };
      var CAT   = { bl:0.42, bh:0.20, bw:0.16, lh:0.19, lr:0.026, nl:0.10, nw:0.11,
                  hl:0.15, hh:0.11, hw:0.11, tail:0.30, tw:0.035, ear:0.038,
                  neckA:0.65, body:blackMat, leg:blackMat, muzzle:blackMat, tailMat:blackMat };
      var HEN   = { bl:0.21, br:0.17, bw:0.15, legH:0.14, lr:0.018, nr:0.045, nl:0.10,
                  hr:0.065, body:fowlMat };
      var COCK  = { bl:0.25, br:0.20, bw:0.17, legH:0.18, lr:0.021, nr:0.05, nl:0.14,
                  hr:0.075, body:cockMat, comb:true, sickle:true };
      var GOOSE = { bl:0.40, bh:0.20, bw:0.21, nr:0.055, n1:0.26, a1:1.25, n2:0.16, a2:0.45,
                  hr:0.075, body:greyMat, beak:beakMat2 };
      var SWAN  = { bl:0.62, bh:0.30, bw:0.32, nr:0.07, n1:0.42, a1:1.30, n2:0.34, a2:0.35,
                  hr:0.10, body:swanMat, beak:combMat };
      var DUCK  = { bl:0.30, bh:0.16, bw:0.17, nr:0.045, n1:0.14, a1:1.15, n2:0.10, a2:0.55,
                  hr:0.065, body:greyMat };
      var DOVE  = { bl:0.14, br:0.10, bw:0.085, hr:0.045, body:greyMat, beak:combMat };

      /* ============================================================
       * 1. 厩舎の軍馬。stables() が建てた馬房のジオメトリに合わせる:
       *    仕切り板は x=-55.6 と -44.4 を中心に長さ6m(= 西房 x
       *    -58.6..-52.6 / 東房 x -47.4..-41.4)、z は cz-19 から 4.6m
       *    間隔で9枚。したがって馬房の中心は隣り合う仕切りの中間、
       *    z = cz-19 + i*4.6 + 2.3。飼葉桶が外側(西房 x=-58.4 /
       *    東房 x=-41.6)なので、馬はそちらへ頭を向ける。
       *    厩舎の内装と同じ D_MID ゲートに載せる。
       * ============================================================ */
      (function stableHorses(){
        var cz = LC_Z0 + 135;
        // authored on the old row-1 stables centre; the range moved to the
        // west curtain when the Vorburg became a perimeter ring, so the
        // whole herd rides the same rigid shift its stalls did.
        var g = detShift(det(-50, 4, cz, D_MID), LC_WROW + 50, 12);
        var breeds = [WARHORSE, WARHORSE_G, WARHORSE_B];
        [0,1,3,5,7].forEach(function(i){          // 西列(頭は -X)
          var z = cz - 19 + i*4.6 + 2.3;
          beast(g, -55.9, z, Math.PI, breeds[i % 3], i===3 ? 1 : 0);
        });
        [0,2,4,5,7].forEach(function(i){          // 東列(頭は +X)
          var z = cz - 19 + i*4.6 + 2.3;
          beast(g, -44.1, z, 0, breeds[(i+1) % 3], i===4 ? 1 : 0);
        });
        // 中央通路に1頭、引き出されたところ(通路は x -52.6..-47.4)
        beast(g, -50.0, cz - 8.5, Math.PI/2, WARHORSE, 0);
        // 通路で寝そべる番犬と、馬糧を狙う鼠捕りの猫
        beast(g, -50.6, cz + 12.0, -0.8, DOG, 2);
        beast(g, -49.4, cz - 17.5, 1.9, CAT, 0);
        registerPick(pickables, 'room', LC_WROW, 1.6, cz + 12, 18, 3.2, 44,
          '厩舎の軍馬 Warhorses', '馬房に立つ騎士団の軍馬。修道会は独自の厩を運営し、重装騎士1人につき3〜4頭の馬を養った。');
      })();

      /* ============================================================
       * 2. 低城の家畜。低城を「周囲に建物・中央は緑地」へ組み直したので
       *    囲いの置き場も全面的に取り直した。空いている場所は
       *      南端の作業地   z LC_Z0+20..40(整形庭園の南、x -36..36)
       *      パン焼き所の東 x -34..-26 / z LC_Z0+178..192
       *      果樹園         x -24..24 / z LC_Z0+190..238
       *    で、いずれも建物の footprint、農民の徘徊帯
       *    (通路 x ±39..45、軸道、z LC_Z0+128..148 の横帯、東門前広場)、
       *    衛兵の巡回線(x=±38、z=LC_Z0+18 と LC_Z0+246)のどれにも
       *    掛からない。すべて開けた地面なので D_FAR ゲート1つにまとめる。
       * ============================================================ */
      (function vorburgYards(){
        var g = det(0, 2, LC_Z0 + 130, D_FAR);

        // -- 牛の囲い(1万人を養う城の食肉と牽引力)。南端の作業地の西半分 --
        var cx0 = -34, cx1 = -22, cz0 = LC_Z0 + 22, cz1 = LC_Z0 + 37;
        pen(g, cx0, cx1, cz0, cz1);
        prop(g, woodMat, boxGeo(1.2, 0.55, 3.2), cx0 + 1.6, 0.44, cz0 + 3.0);   // 水桶
        hayPile(g, -23.8, LC_Z0 + 29.0, 1.2, 1.5);
        // 5頭を 12x15m の囲いに散らす。牛は頭まで含めると 2.6m あるので
        // 隣どうし最低 3m は空ける(2.8m で試したら2頭が1頭に見えた)
        [[-30.0, 24.2, 0], [-26.5, 26.0, 1], [-31.4, 31.2, 1], [-26.3, 32.8, 2]]
          .forEach(function(p){
            beast(g, p[0], LC_Z0 + p[1], rnd(p[0], p[1], 3)*6.28, OX, p[2]);
          });
        beast(g, -29.2, LC_Z0 + 28.6, 2.1, CALF, 0);
        registerPick(pickables, 'structure', (cx0+cx1)/2, 1.2, (cz0+cz1)/2, cx1-cx0, 2.4, cz1-cz0,
          '牛の囲い Cattle Pen', '低城の家畜囲い。修道会領の荘園から集めた牛は、荷役と食肉の両方に用いられた。');

        // -- 豚の囲い(残飯で肥らせ、秋に塩漬け・燻製にする)。南端の東半分 --
        var px0 = 18, px1 = 34, pz0 = LC_Z0 + 22, pz1 = LC_Z0 + 30;
        pen(g, px0, px1, pz0, pz1);
        prop(g, woodMat,  boxGeo(2.8, 1.5, 2.2), px0 + 2.2, 0.75, pz0 + 1.9);   // 寝床
        prop(g, strawMat, boxGeo(3.3, 0.20, 2.7), px0 + 2.2, 1.60, pz0 + 1.9);
        prop(g, woodMat,  boxGeo(1.4, 0.42, 0.8), px1 - 1.6, 0.21, pz1 - 1.6);  // 餌桶
        [[25.0, 23.9, 1], [28.4, 25.3, 0], [26.6, 27.1, 2], [31.4, 26.5, 1]]
          .forEach(function(p){
            beast(g, p[0], LC_Z0 + p[1], rnd(p[0], p[1], 5)*6.28, PIG, p[2]);
          });
        [[25.8, 27.7], [27.2, 28.1], [30.2, 24.1]].forEach(function(p){
          beast(g, p[0], LC_Z0 + p[1], rnd(p[0], p[1], 7)*6.28, PIGLET, 0);
        });
        registerPick(pickables, 'structure', (px0+px1)/2, 1.1, (pz0+pz1)/2, px1-px0, 2.2, pz1-pz0,
          '豚の囲い Pigsty', '低城の豚舎。厨房の残飯で肥らせ、秋の屠殺で塩漬け肉と燻製に仕立てて越冬の糧とした。');

        // -- 羊と山羊。中庭北半の果樹園(gardenTree が x=-24/-8/8/24、
        //    z=192/207/222/237)に放して下草を食ませる。中世の果樹園の
        //    実際の使い方であり、囲いを立てるより読める。樹の幹からは
        //    3m 以上、衛兵の北脚 z=LC_Z0+246 からも離す。
        [[-16.5, 198.5, 1], [-2.5, 203.5, 0], [16.0, 199.0, 1],
         [-13.5, 228.8, 2], [15.5, 214.5, 0], [1.0, 231.5, 1]].forEach(function(p){
          beast(g, p[0], LC_Z0 + p[1], rnd(p[0], p[1], 11)*6.28, SHEEP, p[2]);
        });
        beast(g, -18.0, LC_Z0 + 216.0, 2.6, GOAT, 0);
        beast(g, 18.5, LC_Z0 + 232.0, -1.2, GOAT, 1);
        registerPick(pickables, 'structure', 0, 1.1, LC_Z0 + 214, 46, 2.2, 44,
          '羊と山羊 Sheep & Goats', '低城の果樹園に放して下草を食ませた羊と山羊。修道会は羊毛を輸出品としても扱った。');

        // -- パン焼き所(x -68..-42 / z LC_Z0+179..193)の東隣に鶏。
        //    x -34..-26 は建物にも通路帯にも巡回線にも掛からない。 --
        [[-33.5, 180.4, 1], [-31.0, 181.6, 0], [-28.4, 180.0, 1], [-26.0, 182.2, 1],
         [-32.2, 183.6, 0], [-29.0, 184.0, 1], [-26.6, 184.2, 0]].forEach(function(p){
          bird(g, p[0], LC_Z0 + p[1], rnd(p[0], p[1], 13)*6.28, HEN, p[2]);
        });
        bird(g, -30.4, LC_Z0 + 182.8, 2.2, COCK, 0);
        prop(g, woodMat,  boxGeo(2.4, 1.3, 1.8), -34.0, 0.80, LC_Z0 + 183.4);    // 鶏小屋
        prop(g, strawMat, coneGeo(2.0, 1.0, 4),  -34.0, 1.95, LC_Z0 + 183.4, Math.PI/4);
        registerPick(pickables, 'structure', -29.5, 1.0, LC_Z0 + 182, 12, 2.2, 8,
          '鶏 Chickens', 'パン焼き所の東の作業庭に放し飼いにされた鶏。卵と肉のほか、厨房の屑を片づける役目も担った。');

        // -- 鳩小屋: 薬草園の東、通路帯と巡回線の間の空き地 --
        (function dovecote(){
          var dx = 33, dz = LC_Z0 + 172;
          prop(g, dcWallMat, cylGeo(1.35, 1.50, 5.20, 10), dx, 2.60, dz);
          prop(g, trimMat,   cylGeo(2.00, 1.90, 0.22, 10), dx, 5.31, dz);       // 止まり縁
          prop(g, dcRoofMat, coneGeo(1.60, 1.70, 10),      dx, 6.27, dz);
          for (var h=0; h<6; h++){
            var ah = h*(Math.PI*2/6) + 0.3;
            prop(g, windowMat, boxGeo(0.30, 0.30, 0.30),
                 dx + Math.cos(ah)*1.40, 4.05, dz + Math.sin(ah)*1.40, -ah);
          }
          perched(g, dx - 1.76, 5.42, dz + 0.22, -0.4, DOVE);
          perched(g, dx + 1.70, 5.42, dz - 0.36,  2.8, DOVE);
          perched(g, dx + 0.32, 5.42, dz + 1.74,  1.2, DOVE);
          perched(g, dx + 0.06, 7.12, dz,        -1.5, DOVE);
          perched(g, dx + 2.70, 0.02, dz + 1.70,  1.9, DOVE);
          registerPick(pickables, 'structure', dx, 3.4, dz, 4.0, 7.2, 4.0,
            '鳩小屋 Dovecote', 'レンガ造の鳩小屋。冬季の生肉と畑の肥料を供給し、修道会の要塞網を結ぶ伝令鳩の巣でもあった。');
        })();

        // -- 通りの犬と猫。東門前の敷石広場(x 22..46 / z 門±11)と
        //    西の通路の縁。農民の徘徊帯・巡回線の外側 --
        beast(g, -35.0, LC_Z0 + 152.0,  0.9, DOG, 0);
        beast(g,  35.5, LC_Z0 + 118.0, -1.7, DOG, 2);
        beast(g,  25.5, LC_GATE_Z + 8.0, 2.4, CAT, 2);
      })();

      /* ============================================================
       * 3. ノガト川の水鳥。川面は y = WATER_Y、水域は x -114..-318。
       *    最寄りの城側構造物は x=-102 の川岸壁なので何とも干渉しない。
       *    川が 60m 幅から 204m 幅になったので、鳥も岸から離れた
       *    本流側まで散らしてある(全部が岸に張りつくと池に見える)。
       * ============================================================ */
      (function riverFowl(){
        var wy = WATER_Y + 0.02;
        var g = det(-170, wy, LC_Z0 + 120, D_FAR);
        [[-134, 30, 1.9], [-158, 74, -0.7], [-128, 132, 2.6],
         [-176, 186, 0.4], [-146, 232, 1.2]].forEach(function(p){
          swimmer(g, p[0], wy, LC_Z0 + p[1], p[2], SWAN);
        });
        [[-124, 52, 1.1], [-129, 57, -1.4], [-150, 108, 0.6], [-155, 112, 2.2],
         [-122, 168, -0.3], [-127, 173, 1.7], [-142, 250, 0.9]].forEach(function(p){
          swimmer(g, p[0], wy, LC_Z0 + p[1], p[2], DUCK);
        });
        [[-120, 88, 1.5], [-125, 93, -0.9], [-118, 96, 2.4]].forEach(function(p){
          swimmer(g, p[0], wy, LC_Z0 + p[1], p[2], GOOSE);
        });
        registerPick(pickables, 'structure', -140, wy + 0.8, LC_Z0 + 130, 60, 1.6, 220,
          'ノガト川の水鳥 Waterfowl', '川面に浮かぶ白鳥・鵞鳥・家鴨。城の食卓に上るとともに、羽根はペンと矢羽根の材料になった。');
      })();

      flush();
    })();

    /* ================================================================
     * D. CHIMNEYS. Hearths inside want flues outside: each one is put in
     * a ROOF-tier fade group (the gable bundles carry brick colour and
     * roof:true), so a chimney vanishes together with the roof it stands
     * on rather than being left hanging over an opened range.
     * ================================================================ */
    function chimney(gbl, x, y, z, w, h){
      var st = mkBox(w, h, w, gbl.brick.mat);
      place(st, x, y + h/2, z);
      gbl.brick.group.add(st);
      var cap = mkBox(w+0.5, 0.3, w+0.5, gbl.trim.mat);
      place(cap, x, y + h + 0.15, z);
      gbl.trim.group.add(cap);
      var vent = mkBox(w*0.4, 0.5, w*0.4, gbl.niche.mat);
      place(vent, x, y + h + 0.5, z);
      gbl.niche.group.add(vent);
    }
    /* One flue per hearth built above, and no more. Each is placed ON the
     * ridge line of the range it rises through (or, for the palace, part
     * way down a hip slope) with its base a few metres BELOW the roof
     * surface there and its top a couple of metres above it -- placed off
     * the ridge, a stack either floats over the tiles or is swallowed by
     * them, and both were happening before these were re-derived from
     * each range's own eave + mpRange rise (= span * 0.71).
     *   High Castle wing ridge     22 + 12    = 34
     *   MC west wing seg 1         19 + 9.2   = 28.2
     *   Grand Master's Palace hip  24 + 13.5  = 37.5 (32.8 four metres out)
     *   Infirmary                  19.5 + 12.8 = 32.3
     *   Bakehouse cross range      9.5 + 9.9  = 19.4
     *   Smithy                     6.5 + 9.9  = 16.4                     */
    chimney(gblInner, chX1-2.5, 31.0, -HC_HZ, 1.6, 5.5);           // chapter house
    chimney(gblInner, -HC_HX,   31.0, 6.0,    1.6, 5.5);           // convent refectory
    chimney(gblInner, HC_HX,    31.0, 15.0,   1.5, 5.0);           // grand master's chamber
    chimney(gblOuter, MC_WX,    25.5, RF_CZ + 9.5, 1.9, 5.5);      // Great Refectory
    chimney(gblOuter, GMP_CX+4, 30.0, GMP_CZ + 5.0, 1.8, 5.5);     // palace
    chimney(gblOuter, IF_CX,    29.5, IF_CZ + 1.5, 1.6, 5.5);      // infirmary
    // the bakehouse and smithy moved with the Vorburg rebuild -- their
    // flues carry the identical (dx, dz) shift their ovens did.
    chimney(gblOuter, -59.0,    17.0, LC_Z0 + 186, 1.7, 5.0);      // bakehouse oven 1
    chimney(gblOuter, -51.0,    17.0, LC_Z0 + 186, 1.7, 5.0);      // bakehouse oven 2
    chimney(gblOuter, 58.5,     14.0, LC_Z0 + 156, 1.6, 4.6);      // smithy forge

    /* ---- 煙 -------------------------------------------------------
     * 煙口(chimney の vent)の高さは y + h + 0.5。そこから立ち上げる。
     * 量は炉の性格で変える -- パン焼き窯と鍛冶炉は終日焚いているので
     * 濃く、居室の暖炉は細い。gblInner / gblOuter は屋根ティアなので、
     * 屋根がフェードで消えれば煙突ごと煙も消える(mpSmokePlume が
     * fg.op を見ている)。 */
    mpSmokePlume(gblInner.brick, chX1-2.5, 31.0+5.5+0.6, -HC_HZ, { base:0.30, rise:21, speed:0.118, count:5 }); // 参事会室
    mpSmokePlume(gblInner.brick, -HC_HX,   31.0+5.5+0.6, 6.0,    { base:0.36, rise:22, speed:0.104, count:5 }); // 修道士食堂
    mpSmokePlume(gblInner.brick, HC_HX,    31.0+5.0+0.6, 15.0,   { base:0.28, rise:20, speed:0.126, count:5 }); // 団長居室
    mpSmokePlume(gblOuter.brick, MC_WX,    25.5+5.5+0.6, RF_CZ + 9.5, { base:0.40, rise:25, speed:0.100, count:6 }); // 大食堂
    mpSmokePlume(gblOuter.brick, GMP_CX+4, 30.0+5.5+0.6, GMP_CZ + 5.0, { base:0.32, rise:22, speed:0.112, count:5 }); // 宮殿
    mpSmokePlume(gblOuter.brick, IF_CX,    29.5+5.5+0.6, IF_CZ + 1.5,  { base:0.30, rise:21, speed:0.121, count:5 }); // 施療院
    mpSmokePlume(gblOuter.brick, -59.0,    17.0+5.0+0.6, LC_Z0 + 186, { base:0.52, rise:28, speed:0.096, count:6 }); // パン焼き窯1
    mpSmokePlume(gblOuter.brick, -51.0,    17.0+5.0+0.6, LC_Z0 + 186, { base:0.46, rise:25, speed:0.109, count:6 }); // パン焼き窯2
    mpSmokePlume(gblOuter.brick, 58.5,     14.0+4.6+0.6, LC_Z0 + 156, { base:0.44, rise:22, speed:0.133, count:6 }); // 鍛冶炉
  })();

  /* ================================================================
   * info payload + always-on labels + resident life data
   * ================================================================ */
  var info = { rooms: [
    { name:'聖母マリア教会 (St Mary’s Church)', desc:'北翼東寄り。長さ38m・高さ14.4m [MH]。' },
    { name:'参事会室 (Chapter House)', desc:'南翼。団長と幹部騎士の評議の間。' },
    { name:'食堂 (Refectory)', desc:'西翼。リブヴォールト風の柱列。' },
    { name:'大マスター旧居室', desc:'東翼。団長のかつての私室(後に中城の新宮殿へ移転)。' }
  ] };
  /* ================================================================
   * RE-CENTRE the finished model on the camera target (see the `root`
   * comment at the top of this function). MODEL_CZ is the midpoint of
   * the built Z extent: the Gdanisko's south face at the far south end,
   * the Low Castle's north wall at the far north end. Shifting `root` by
   * -MODEL_CZ leaves the sheet coordinates used everywhere above intact
   * while putting the complex's centre of mass on the world origin the
   * camera orbits. Pickables live outside `group` in world space and the
   * `life` waypoints drive residentGroup (parented to the scene), so both
   * need the identical shift applied by hand -- done here, BEFORE
   * buildLabelGroup() reads pickable positions to place its sprites.
   * ================================================================ */
  /* Extent now runs from the outer bailey's south wall (OB_SZ, well south
   * of the Gdanisko) to the Low Castle's north wall, rather than from the
   * Gdanisko's own south face -- the enclosure added ~46m to the southern
   * end, and leaving MODEL_CZ where it was pushed the whole complex north
   * of the camera target. The town north of the road is deliberately NOT
   * counted: it is context, not the subject, and centring on it would
   * throw the castle itself off-frame. */
  /* ================================================================ *
   * ノガト川と堀 -- 空を映す水面(Schlick フレネル + 焦線)
   * ================================================================ *
   * castles/bodiam.js の moatWater を移植したもの。狙いも式も同じ:
   *   1. Phong の鏡面ローブを殺す(specularStrength = 0)。水面の見えは
   *      鏡面ローブではなく **空の鏡像** が本体。
   *   2. Schlick フレネル F0 = 0.02(水の正しい値)。真上からはほぼ
   *      水中の色、視線が浅いと F->1 で空を強く映す。この角度依存が
   *      「水らしさ」の本体。
   *   3. 映す空は 11-environment.js と同じ 6 段グラデーションを同じ
   *      ストップ位置で評価する。だから水平線で空と水の色が必ず繋がる。
   *   4. 焦線(コースティクス)= -Laplacian(h)。峰の下で光が収束し谷の
   *      下で発散する **対称な** 明暗で、これが無いと波が「暗いシミ」に
   *      しか見えない。
   *
   * 【ボディアムからの唯一の設計変更 -- 頂点変位をやめた】
   * ボディアムは水面板を 0.85m 格子に張り替えて頂点シェーダで実際に
   * 上下させている。堀は 44m 角なので数千頂点で済む。ノガトは
   * **204m x 2180m** で、同じ格子密度だと約 61 万頂点になる。この城は
   * 5城で最も重く(実測 drawCall 9,222 / フレーム 140ms)、そこへ 61 万
   * 頂点を足す判断はできない。
   * 代わりに、同じ 3 本の方向波を **フラグメント側でワールド座標から
   * 解析的に**評価する。vUv をメートル座標そのものに固定してあるので、
   * 波の位相・傾き・ラプラシアンはすべて vUv から直接出る。得られる
   * 絵は「波の稜線が線として読める」「峰が明るく谷が暗い」という
   * ボディアムの狙いをそのまま満たす。失うのは水際のシルエットの
   * 波打ちだけで、200m 幅の川では 1 画素も見えない。
   * 遠景は 1 波長が 2 画素を切るとエイリアスするので、視距離で傾きを
   * 落とす(160m から 680m にかけて 25% まで)。
   *
   * 【もう一つの割り切り -- 岸の泡を入れていない】
   * ボディアムの泡は「矩形の堀の内外の縁からの距離」を vUv から出して
   * いる。こちらは川1枚 + 帯状の堀2枚が **同じマテリアルを共有** して
   * いて(11-environment.js が waterMats 経由で時間帯の色を配る)、
   * メッシュごとの中心・半径をユニフォームで分けられない。マテリアルを
   * 複製すれば分けられるが、それは waterMats の契約を書き換えることに
   * なるのでやめた。川の東西の岸は地形の土手の下に潜り込んでいて
   * (RIVER の注記参照)そもそも water の縁が見えない。
   * ================================================================ */
  (function mpWater(){
    var n1 = TEX.waterN1, n2 = TEX.waterN2, n3 = TEX.waterN3;

    /* ---- vUv をメートル座標に固定する -----------------------------
     * 水面はすべて PlaneGeometry を rotation.x = -PI/2 で寝かせたもの。
     * ローカル (px, py, 0) は回転後 (px, 0, -py) になるので、
     *   worldX = cx + px , worldZ = cz - py
     * ボディアムの約束( uv.x = worldX, uv.y = -worldZ )に合わせると
     *   uv = ( cx + px , py - cz )
     * になる。root は最後に ZOFF だけ z 方向へ動くが、UV は固定値なので
     * 影響を受けない(シェーダは vUv を「連続なメートル座標」としてしか
     * 使っていないので、原点がどこにあっても絵は変わらない)。 */
    function mpWaterUV(mesh){
      var geo = mesh.geometry, pos = geo.attributes.position, uv = geo.attributes.uv;
      if (!pos || !uv) return;
      var cx = mesh.position.x, cz = mesh.position.z;
      for (var i=0;i<uv.count;i++) uv.setXY(i, cx + pos.getX(i), pos.getY(i) - cz);
      uv.needsUpdate = true;
      geo.userData.__uvW = 1;                 // applyWorldUVs に触らせない
    }
    root.traverse(function(o){
      if (o.isMesh && (o.material === riverMat || o.material === moatWaterMat)) mpWaterUV(o);
    });

    /* 3枚のさざ波法線。タイル実寸は 34 / 13 / 5.5m で互いに非通約
     * (比 2.62 / 2.36)。堀(44m)ではなく川(204m)の尺度に合わせて
     * ボディアムの 19 / 6.4 / 2.6m を約 1.9 倍してある。 */
    n1.repeat.set(1, 1); n1.offset.set(0, 0);
    [riverMat, moatWaterMat].forEach(function(m){
      m.normalMap = n1;                       // USE_NORMALMAP と vUv を有効にするため
      m.normalScale = new T.Vector2(1, 1);    // 自前で法線を組むので未使用
      m.shininess = 1;                        // 鏡面はシェーダ側で完全に殺す
    });

    var uN2   = { value: n2 };
    var uN3   = { value: n3 };
    var uOff1 = { value: new T.Vector2(0, 0) };
    var uOff2 = { value: new T.Vector2(0, 0) };
    var uOff3 = { value: new T.Vector2(0, 0) };
    var uSky  = { value: [ new T.Vector3(), new T.Vector3(), new T.Vector3(),
                           new T.Vector3(), new T.Vector3(), new T.Vector3() ] };
    var uSunCol = { value: new T.Vector3(0, 0, 0) };
    var uSunDirV= { value: new T.Vector3(0, 1, 0) };
    var uProjY  = { value: 2.6 };
    var uAmp    = { value: 1.0 };
    var uSkyGain= { value: 0.86 };
    var uGlint  = { value: 1.20 };
    var uFog    = { value: new T.Vector3(0, 0, 0) };
    var uHaze   = { value: 0.75 };
    var uTime   = { value: 0 };
    var uSpark  = { value: 0.20 };
    var uCaus   = { value: 0.72 };

    /* 方向波。波長は互いに非通約(26 / 11.5 / 6.4m)。ノガトは大河なので
     * ボディアムの堀(15 / 6.6 / 4.2m)より一回り長い。 */
    var WAVES = [
      { dx:  0.9406, dz:  0.3395, lam: 26.0, amp: 0.150, spd: 0.72 },
      { dx: -0.4191, dz:  0.9080, lam: 11.5, amp: 0.085, spd: 0.58 },
      { dx:  0.7779, dz: -0.6283, lam:  6.4, amp: 0.042, spd: 0.46 }
    ];
    /* 焦線の正規化係数。-Laplacian(h) = Σ A k^2 sin(位相) の最大値。 */
    var W_CAUS_NORM = (function(){
      var t = 0;
      for (var i=0;i<WAVES.length;i++){
        var k = 2*Math.PI/WAVES[i].lam;
        t += WAVES[i].amp * k * k;
      }
      return t;
    })();
    /* GLSL は JS のテーブルから組み立てる。数値を2か所に書くと必ずずれる。
     * px / pz はワールド xz を入れる式(ここでは vUv から作る)。 */
    function waveGLSL(px, pz){
      var out = [];
      for (var i=0;i<WAVES.length;i++){
        var w = WAVES[i], k = 2*Math.PI/w.lam, om = k*w.spd;
        out.push(
          '  { float wp = ' + (w.dx*k).toFixed(6) + ' * ' + px + ' + ' +
                              (w.dz*k).toFixed(6) + ' * ' + pz + ' - ' +
                              om.toFixed(6) + ' * uWTime;',
          '    wWC += ' + (w.amp*k*k).toFixed(6) + ' * sin( wp );',
          '    wWG += ( ' + (w.amp*k).toFixed(6) + ' * cos( wp ) ) * vec2( ' +
                            w.dx.toFixed(4) + ', ' + w.dz.toFixed(4) + ' ); }'
        );
      }
      return out;
    }

    function mpInstall(sh){
      var SPM = '#include <specularmap_fragment>',
          NFM = '#include <normal_fragment_maps>',
          FOG = '#include <fog_fragment>';
      var fs = sh.fragmentShader;
      /* 差し替え対象のチャンク名は three のバージョンに依存する。3つとも
       * 見つかったときだけ差し込む。1つでも欠けた状態で残りを入れると
       * 未定義の変数を参照する GLSL になり、水面が真っ黒 + コンソール
       * エラーになる(ボディアムの前任者が踏んだ罠をそのまま踏襲)。 */
      if (fs.indexOf(SPM) < 0 || fs.indexOf(NFM) < 0 || fs.indexOf(FOG) < 0) return;

      sh.uniforms.uWN2 = uN2;         sh.uniforms.uWN3 = uN3;
      sh.uniforms.uWOff1 = uOff1;     sh.uniforms.uWOff2 = uOff2;   sh.uniforms.uWOff3 = uOff3;
      sh.uniforms.uWSky = uSky;       sh.uniforms.uWSunCol = uSunCol;
      sh.uniforms.uWSunDirV = uSunDirV;
      sh.uniforms.uWProjY = uProjY;   sh.uniforms.uWAmp = uAmp;
      sh.uniforms.uWSkyGain = uSkyGain; sh.uniforms.uWGlint = uGlint;
      sh.uniforms.uWFog = uFog;       sh.uniforms.uWHaze = uHaze;
      sh.uniforms.uWTime = uTime;     sh.uniforms.uWSpark = uSpark;
      sh.uniforms.uWCaus = uCaus;

      /* 前置き。uWSky のストップ位置は 11-environment.js の SKY_STOPS_POS
       * と同じ [0, .30, .52, .68, .84, 1]。clamp した線形ランプを mix で
       * 連鎖させると区分線形グラデーションと厳密に一致する。
       * viewMatrix / cameraPosition は three が fragment prefix で宣言済み
       * なので、ここで再宣言してはならない。 */
      fs = [
        'uniform sampler2D uWN2;',
        'uniform sampler2D uWN3;',
        'uniform vec2 uWOff1;',
        'uniform vec2 uWOff2;',
        'uniform vec2 uWOff3;',
        'uniform vec3 uWSky[6];',
        'uniform vec3 uWSunCol;',
        'uniform vec3 uWSunDirV;',
        'uniform float uWProjY;',
        'uniform float uWAmp;',
        'uniform float uWSkyGain;',
        'uniform float uWGlint;',
        'uniform vec3 uWFog;',
        'uniform float uWHaze;',
        'uniform float uWTime;',
        'uniform float uWSpark;',
        'uniform float uWCaus;',
        'float wRamp( float a, float b, float p ){ return clamp( ( p - a ) / ( b - a ), 0.0, 1.0 ); }',
        'vec3 wSkyAt( float p ){',
        '  vec3 c = mix( uWSky[0], uWSky[1], wRamp( 0.00, 0.30, p ) );',
        '  c = mix( c, uWSky[2], wRamp( 0.30, 0.52, p ) );',
        '  c = mix( c, uWSky[3], wRamp( 0.52, 0.68, p ) );',
        '  c = mix( c, uWSky[4], wRamp( 0.68, 0.84, p ) );',
        '  c = mix( c, uWSky[5], wRamp( 0.84, 1.00, p ) );',
        '  return c;',
        '}'
      ].join('\n') + '\n' + fs;

      // 1) Phong の鏡面ローブを完全に殺す。専用の specular 項は書かない。
      fs = fs.replace(SPM, 'float specularStrength = 0.0;');

      /* 2) 法線。水面は完全な水平面なので perturbNormal2Arb(画面空間
       * 微分から TBN を推定する近似)を通す必要が無い。uv.x = worldX,
       * uv.y = -worldZ なので T = +X, B = -Z, N = +Y、つまり
       *   Nworld = ( s.x, 1, -s.y )
       * 3枚の法線マップ(34 / 13 / 5.5m)に、解析的な方向波の傾きを足す。
       * ノイズ3枚は等方なので「まだらな染み」にしかならないが、方向波は
       * 稜線を持つので真上から見ても波が線として読める。 */
      fs = fs.replace(NFM, [
        /* 重みはボディアムの実測値をそのまま(焼いた法線マップの |xy|
         * 中央値 0.082 / 0.079 / 0.117 に対する係数)。 */
        /* ★遠景の帯域制限。この城の視距離は 70-940m もあり、細かい波は
         * 遠くで 1 波長が 2 画素を切って必ずモアレになる(最初の焼き
         * 上げでは 680m の引きの絵で川が「トタン板」に見えた)。
         * ミップマップが効く法線マップと違って、解析的な正弦波には
         * フィルタが無いので自分で落とすしかない。細かい成分ほど早く
         * 落とす -- 60m から 460m にかけて、細波は 8%、方向波は 12% まで。*/
        /* 距離だけでなく **視線の伏せ角** も効く。1画素が水面に落とす
         * フットプリントは 距離 / (up・V) に比例するので、水平近くから
         * 見た遠くの水面では 1 画素が何十メートルもの水面を覆う。実際、
         * 距離だけで落としていた版は夕方(仰角14度)の引きの絵で川が
         * 「編んだ茣蓙」の格子に見えた -- 距離減衰はすでに底を打って
         * いたのに、残った 45% の傾きがフレネルの立った浅い角度で拡大
         * されていたため。フットプリントで測ると正しく落ちる。 */
        '  float wD0  = length( vViewPosition );',
        '  float wGrz = clamp( dot( normalize( mat3( viewMatrix )[ 1 ] ), normalize( vViewPosition ) ), 0.0, 1.0 );',
        '  float wFoot = wD0 / max( wGrz, 0.03 );',
        '  float wAt = 1.0 - clamp( ( wFoot - 120.0 ) / 900.0, 0.0, 1.0 );',
        '  float wA2 = 0.25 + 0.75 * wAt;',      // 中スケール
        '  float wA3 = 0.06 + 0.94 * wAt * wAt;',// 細スケール(フットプリントの2乗で落とす)
        '  vec2 wS  = ( texture2D( normalMap, vUv * 0.02941 + uWOff1 ).xy * 2.0 - 1.0 ) * 1.30;',
        '  wS      += ( texture2D( uWN2,      vUv * 0.07692 + uWOff2 ).xy * 2.0 - 1.0 ) * 0.80 * wA2;',
        '  wS      += ( texture2D( uWN3,      vUv * 0.18182 + uWOff3 ).xy * 2.0 - 1.0 ) * 0.50 * wA3;',
        /* さらに全体を距離で凪がせる。遠くの水面は実際にもさざ波が
         * 平均化されて凪いで見える。 */
        '  wS *= uWAmp * ( 0.25 + 0.75 * wAt );',
        /* 方向波を vUv(= メートル)から解析的に。vUv.y = -worldZ なので
         * ワールド z は -vUv.y。 */
        '  float wWC = 0.0; vec2 wWG = vec2( 0.0 );'
      ].concat(waveGLSL('vUv.x', '( -vUv.y )')).concat([
        '  float wAw = ( 0.10 + 0.90 * wAt ) * uWAmp;',
        '  wWC *= wAw * ' + (1/W_CAUS_NORM).toFixed(4) + ';',
        '  wS += vec2( -wWG.x, wWG.y ) * wAw;',
        '  vec3 wNW = normalize( vec3( wS.x, 1.0, -wS.y ) );',
        '  normal = normalize( mat3( viewMatrix ) * wNW );'
      ]).join('\n'));

      /* 3) 合成。fog の直前なので gl_FragColor には拡散光だけが入って
       * いる(= 水中の色。時間帯で変わる CUR_TIME.waterColor 由来)。 */
      fs = fs.replace(FOG, [
        '  vec3  wUp  = normalize( mat3( viewMatrix )[ 1 ] );',   // ワールド +Y のビュー空間での向き
        '  vec3  wV   = normalize( vViewPosition );',
        '  float wNdv = clamp( dot( normal, wV ), 0.0, 1.0 );',
        /* 濁った水の「見かけの深さ」。視線側に傾いた波面は水中を通る
         * 距離が短くなるので明るく、逆に傾けば暗く見える。平らな面で
         * 差が 0 になるよう、同じ視線に対する「傾いていない場合の N・V」
         * との差だけを使う(視点に依らない)。 */
        '  float wFlt = clamp( dot( wUp, wV ), 0.0, 1.0 );',
        /* ★ゲインはボディアム(x6.0 / 上限 0.30)から落としてある。
         * ボディアムの堀は 44m 角を至近から見るが、ノガトは 204m x 2180m
         * で引きの絵に大きく写る。x6.0 のままだと法線マップのわずかな傾き
         * でこの項が常に上下限に張り付き、川が「コーデュロイ」の畝に
         * 見えた(実測: 680m の引きで高コントラストの斜め縞)。 */
        '  gl_FragColor.rgb *= 1.0 + clamp( ( wNdv - wFlt ) * 3.5, -0.20, 0.20 );',
        /* 焦線。上の屈折項は真上から見ると必ず暗くなる方向にしか動か
         * ないので、これが無いと水面は「暗いシミ」ばかりになる。
         * -Laplacian(h) は峰で正・谷で負の **対称な** 変化なので、
         * 初めて「波の筋」として読める。 */
        '  gl_FragColor.rgb *= 1.0 + uWCaus * wWC;',
        '  vec3  wR   = reflect( -wV, normal );',
        '  float wP   = clamp( 0.5 - 0.5 * ( uWProjY * wR.y / max( -wR.z, 1e-3 ) ), 0.0, 1.0 );',
        '  float wF   = 0.02 + 0.98 * pow( 1.0 - wNdv, 5.0 );',
        '  float wSd  = max( dot( wR, uWSunDirV ), 0.0 );',
        /* 反射光路のかすみ。反射ベクトルが水平に近いほど長い大気を通って
         * 来た光なので霧色へ寄る。これを入れないと「浅い角度で水が暗い」
         * 絵になる -- 地平線の帯を作っているのは scene.fog.color の方な
         * ので、そこへ寄せて初めて水平線で色が繋がる。 */
        '  float wRy  = dot( wR, wUp );',
        '  float wHz  = ( 1.0 - clamp( wRy * 4.0, 0.0, 1.0 ) ) * uWHaze;',
        /* 太陽は「空側に置いた円板」で、専用の specular 項ではない。
         * 芯 pow(sd,160) + 裾 pow(sd,16)。上限は clamp で押さえて白飛びを
         * 防ぐ。 */
        '  vec3  wGl  = min( uWSunCol * uWGlint * ( pow( wSd, 160.0 ) + 0.30 * pow( wSd, 16.0 ) ), vec3( 0.95 ) );',
        '  vec3  wRef = mix( wSkyAt( wP ) * uWSkyGain, uWFog, wHz ) + wGl;',
        '  gl_FragColor.rgb = mix( gl_FragColor.rgb, wRef, wF );',
        /* 真上寄りの視点では wF が 0.02 まで落ち、上の mix ではきらめきが
         * 1/50 に潰れて見えない。太陽を映す向きに立った波面だけが光る項
         * なので、フレネルの外側にも一定割合を足す。 */
        '  gl_FragColor.rgb += wGl * ( uWSpark * ( 1.0 - wF ) );',
        '  gl_FragColor.a = clamp( gl_FragColor.a + wF * 0.20, 0.0, 1.0 );',
        /* 水面だけの白飛び止め。このビューアはトーンマッピングを掛けて
         * いない = gl_FragColor がほぼそのまま 0-255 になるので、水面の
         * 出力だけ 0.96 (245/255) で頭を打たせておけば、きらめきの形を
         * 保ったまま水が 254 に到達しなくなる。fog はこのあと霧色へ
         * 寄せるだけなので、この上限を破らない。 */
        '  gl_FragColor.rgb = min( gl_FragColor.rgb, vec3( 0.96 ) );',
        '#include <fog_fragment>'
      ].join('\n'));

      sh.fragmentShader = fs;
    }
    riverMat.onBeforeCompile = mpInstall;
    moatWaterMat.onBeforeCompile = mpInstall;
    riverMat.customProgramCacheKey =
      moatWaterMat.customProgramCacheKey = function(){ return 'malbork-water-fresnel-v1'; };
    riverMat.needsUpdate = moatWaterMat.needsUpdate = true;

    /* ---- 毎フレームの更新(すべて絶対時刻 t の純関数) -------------- */
    var _wSkyC = new T.Color(), _wGray = new T.Color(), _wSunV = new T.Vector3();
    /* paintSky と同じ彩度落とし(共有ファイルを変えないためのローカル
     * コピー。式を変えると空と水で彩度がずれるので必ず同じにする)。 */
    function wDesat(c, satMul){
      if (satMul >= 0.999) return c;
      var lum = c.r*0.299 + c.g*0.587 + c.b*0.114;
      _wGray.setRGB(lum, lum, lum);
      c.lerp(_wGray, 1 - satMul);
      return c;
    }
    ANIM.push(function(t, e){
      var rain = e.rain || 0;
      var sp = 1 + rain * 1.30;
      uAmp.value = 1 + rain * 0.80;
      // 単位はタイル/秒。実速度 = 速度 x タイル実寸 -> 0.10 / 0.17 / 0.26 m/s
      uOff1.value.set(  t * 0.00294 * sp,  t * 0.00174 * sp );
      uOff2.value.set( -t * 0.01000 * sp,  t * 0.00862 * sp );
      uOff3.value.set(  t * 0.01939 * sp, -t * 0.04364 * sp );
      uTime.value = t * sp;

      if (typeof camera !== 'undefined' && camera && camera.projectionMatrix){
        // 反射ベクトルを画面 v へ落とすのに使う縦方向の投影係数
        uProjY.value = camera.projectionMatrix.elements[5];
      }
      /* 霧色。11-environment.js が毎フレーム天候の彩度落としまで済ませて
       * scene.fog.color に入れているので、それをそのまま読む(= 山や
       * 遠景と完全に同じ色。だから水平線で必ず繋がる)。 */
      if (typeof scene !== 'undefined' && scene && scene.fog){
        uFog.value.set(scene.fog.color.r, scene.fog.color.g, scene.fog.color.b);
      }
      if (typeof CUR_TIME !== 'undefined' && CUR_TIME){
        var sat = (typeof CUR_WEATHER !== 'undefined' && CUR_WEATHER && CUR_WEATHER.skySatMul != null)
                  ? CUR_WEATHER.skySatMul : 1;
        if (CUR_TIME.sky){
          for (var i=0;i<6;i++){
            _wSkyC.copy(CUR_TIME.sky[i]);
            wDesat(_wSkyC, sat);
            uSky.value[i].set(_wSkyC.r, _wSkyC.g, _wSkyC.b);
          }
        }
        /* ★向きは 11-environment.js の sunAnchorDir をそのまま使う。
         * このビューアの太陽円板と光芒は「仰角をクランプした見かけの
         * 方向」に描かれている。水面のきらめきは太陽の鏡像なので、円板と
         * 別の向きで計算すると縦にずれて一目で嘘だと分かる。 */
        var sk = (CUR_TIME.sunIntensity != null ? CUR_TIME.sunIntensity : 1) * (e.sunMul != null ? e.sunMul : 1);
        var sc = CUR_TIME.sunColor;
        if (sc) uSunCol.value.set(sc.r * sk, sc.g * sk, sc.b * sk);
        if (CUR_TIME.sunPos && typeof camera !== 'undefined' && camera){
          if (typeof sunAnchorDir === 'function') sunAnchorDir(_wSunV);
          else _wSunV.copy(CUR_TIME.sunPos).normalize();
          _wSunV.transformDirection(camera.matrixWorldInverse);
          uSunDirV.value.copy(_wSunV);
        }
      }
    });
  })();

  /* ---- UV を持たないジオメトリに UV を生やす ----------------------
   * ★これが無いとテクスチャが「1テクセルの単色」になる。
   * この城は drawCall を減らすために溶接ジオメトリを多用している
   * (mpBoxSoup で城壁を1本のメッシュに融合、mpTerrainStrip で川岸の
   * 段丘を1枚に押し出す、アーチのリブ、動物の体…)。それらは
   * position / normal / index しか作っていない。
   * three は USE_UV が立つと `attribute vec2 uv;` を要求し、属性が無い
   * バッファでは全頂点 (0,0) になるので、**メッシュ全体がテクスチャの
   * 左上 1 テクセルで塗りつぶされる**(色は付くのでパッと見は気付かない
   * が、レンガの目地も瓦の段も一切出ない)。
   * 工房側(js/02-texture.js の uvWorldize)は uv が無ければ何もせずに
   * 帰る -- そこを変えると他4城の溶接メッシュの見え方まで変わって
   * しまうので、**この城の中で** 空の uv 属性を用意してから
   * applyWorldUVs に平面投影を書かせる。 */
  (function mpEnsureUVs(){
    var made = 0;
    group.traverse(function(o){
      if (!o.isMesh || !o.material) return;
      if (!o.material.userData || !o.material.userData.uvDensity) return;
      var g = o.geometry;
      if (!g || !g.attributes || !g.attributes.position) return;
      if (g.attributes.uv) return;
      g.setAttribute('uv', new T.Float32BufferAttribute(
        new Float32Array(g.attributes.position.count * 2), 2));
      made++;
    });
    return made;
  })();

  /* ---- テクスチャ密度に合わせて UV をメートル単位へ書き直す --------
   * すべてのメッシュを組み終えた **あと** に1回だけ走らせる。
   * 水面は uvDensity を持たないので素通りする(上で自前に書いた
   * メートル UV は保存される)。 */
  applyWorldUVs(group);

  var MODEL_CZ = (LC_Z1 + OB_SZ) / 2;
  var ZOFF = -MODEL_CZ;
  root.position.z = ZOFF;
  pickables.forEach(function(p){ p.position.z += ZOFF; p.updateMatrixWorld(true); });

  var labelGroup = buildLabelGroup(group, pickables);

  /* ---- resident life data: sole in/out point is the Low Castle's east
   * gate; farmers wander the Low + Middle Castle open ground (never the
   * High Castle cloister, guards-only per the same convention
   * castles/malbork.js uses); guards patrol a loop along the inside of
   * the Low Castle wall with a long spur down through the Middle Castle
   * courtyard to the High<->Middle dry-ditch bridge, all on y=0 so
   * nothing floats once the outer shell fades. Population ~35 total
   * (26 farmers + 9 guards), per task brief. ------------------------ */
  var life = {
    gates: [ { path: [
        {x:LC_HX-LC_WALL_T/2, z:LC_GATE_Z},
        {x:LC_HX+LC_WALL_T/2, z:LC_GATE_Z},
        {x:LC_HX+GATE_TOWER_D, z:LC_GATE_Z}
      ], outDir:{x:1,z:0}, vanishDist: 46 } ],
    /* Wander boxes -- RE-DERIVED for the rebuilt Vorburg. The old boxes
     * traced three service lanes threaded between four rows of sheds;
     * those rows are gone, the ranges now line the curtain and the middle
     * of the ward is open, so the farmers' ground is the ward itself.
     * Every box below is checked against the ranges (west -68.5..-46.5,
     * east +46.5..+68.5, north z LC_Z1-20..-4, bakehouse x -68..-42 /
     * z LC_Z0+179..193) and against the planting laid out in
     * lowCastleGrounds (parterre |x| 6..30 / z LC_Z0+41..119, herb plats
     * x -32..-14 / z 156..176, orchard |x|<=24 / z 190..238), so a farmer
     * can never walk through brick, hedge or vegetable bed. */
    courtyard: (function(){
      /* 中城中庭。東側 x>=11 は菜園・薬草園・果樹園(内装セクションで
       * 追加)が占めるので、farmer の徘徊範囲を maxX 24 -> 10 に狭めて
       * ある -- これで住人が畝や生垣の中を歩くことがない。西側と中央は
       * そのまま空いており、guard の巡回路(x=0)にも干渉しない。 */
      var boxes = [ { minX:-MC_HX+MC_WD+3, maxX:10, minZ:MC_Z0+4, maxZ:MC_Z1-MC_WD-3 } ]; // 中城中庭
      // 低城: 建物列の内側を南北に走る2本の敷石通路
      boxes.push({ minX:-45, maxX:-39, minZ:LC_Z0+16, maxZ:LC_Z1-26 });
      boxes.push({ minX: 39, maxX: 45, minZ:LC_Z0+16, maxZ:LC_Z1-26 });
      // 整形庭園と薬草園・果樹園の間に空く東西の帯(東門の内側に続く)
      boxes.push({ minX:-34, maxX: 34, minZ:LC_Z0+126, maxZ:LC_Z0+150 });
      // 東門を入ってすぐの敷石広場
      boxes.push({ minX: 22, maxX: 46, minZ:LC_GATE_Z-10, maxZ:LC_GATE_Z+10 });
      // 南端の空き地(家畜囲いは x -34..-22 と +18..+34 なので中央だけ)
      boxes.push({ minX:-16, maxX: 14, minZ:LC_Z0+22, maxZ:LC_Z0+38 });
      return boxes;
    })(),
    /* Patrol. The old route ran the parcham -- the clear strip between
     * curtain and outermost range -- but the ranges now stand hard
     * against the curtain and there is no parcham left, so the guards
     * instead walk the ward side of the ranges (x = +/-38, between the
     * farmers' lanes at +/-42 and the planting, which reaches |x| 32 at
     * most), close the loop north and south of the garden, take the spur
     * in through the east gate square, and then run the same long leg
     * down through the Middle Castle to the dry-ditch bridge. */
    patrol: [
      [-38,0,LC_Z0+18], [-38,0,LC_Z0+246], [38,0,LC_Z0+246],
      [38,0,LC_GATE_Z+10], [46,0,LC_GATE_Z], [38,0,LC_GATE_Z-10], [38,0,LC_Z0+18],
      [-4,0,LC_Z0+6], [-4,0,OUTMOAT_Z0+OUTMOAT_W/2], [0,0,MC_Z1-MC_WD-4],
      [0,0,MC_Z0+8], [0,0,DITCH_Z0+DITCH_W/2], [0,0,MC_Z0+8], [-4,0,LC_Z0+6]
    ],
    population: { farmers: 26, guards: 9 }
  };
  // apply the same rigid Z shift `root` got, so residents (parented to
  // the scene, not to this castle's group) walk the re-centred model.
  life.gates.forEach(function(g){ g.path.forEach(function(p){ p.z += ZOFF; }); });
  life.courtyard.forEach(function(c){ c.minZ += ZOFF; c.maxZ += ZOFF; });
  life.patrol.forEach(function(p){ p[2] += ZOFF; });

  return { group: group, fadeGroups: fadeGroups, interiorGroup: interiorGroup, info: info,
    pickables: pickables, windowMat: windowMat, waterMats: [riverMat, moatWaterMat], labelGroup: labelGroup, life: life };
}

registerCastle({
  id: 'malbork',
  name: 'Malbork Castle',
  nameJa: 'マルボルク城',
  country: 'Poland',
  countryJa: 'ポーランド',
  flag: '🇵🇱',
  year: '1406',
  description: 'チュートン騎士団が築いた世界最大級のレンガ造城塞。高城51x61m・中城80x100m・低城140x270mが南北約470mに連なり、南西隅には60m突き出す便所塔グダニスコが尖頭アーチ5連の架橋で結ばれる。公開実測寸法に基づく再現。',
  build: buildMalborkPlan,
  // The build re-centres itself on the world origin (see MODEL_CZ /
  // ZOFF). The reworked model is BIGGER than the one these numbers were
  // first tuned for: the outer bailey pushed the south end out to
  // z -295, the town sits off the north end, and the widened Nogat +
  // its terraces now run out to x -318. Half-extent along the long axis
  // is ~295m (was 282m) and the west side reaches ~320m off centre.
  // Re-measured off screenshots, not trigonometry:
  //   initDist 680  -- at the old 580 the Low Castle's north end and the
  //                    outer bailey's south-east corner both ran off the
  //                    frame at the fixed opening azimuth (-0.22pi) /
  //                    elevation (0.42 rad); 680 clears both with a
  //                    margin, and the Nogat reads full width
  //   zMax 940      -- keeps the opening reveal at (940-680)/(940-70)
  //                    = 0.30, i.e. still below WALL_START 0.35, so the
  //                    castle opens as a solid exterior exactly as before
  //   fogNear 860   -- scaled with the bigger orbit; at 760 the far
  //                    (High Castle) end sat inside the fog ramp again
  //   shadowExtent 420 -- 340 no longer covered the outer bailey, whose
  //                    south wall cast no shadow at all
  //   envScale 2.6  -- innermost mountain ring at 340*2.6=884m, still
  //                    clear of both the model and the 680m orbit
  //   envLift -80   -- drops that ring's ridgeline back inside the
  //                    frustum at this camera height, same trick
  //                    Vincennes/malbork.js use
  view: { targetY: 26, zMin: 70, zMax: 940, initDist: 680,
    fogNear: 860, fogFar: 2600, shadowExtent: 420, shadowFar: 1500,
    camFar: 4200, panLimit: 320, envScale: 2.6, envLift: -80 }
});
