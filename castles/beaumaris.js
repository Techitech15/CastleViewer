"use strict";

/* ====================================================================
 * Beaumaris Castle (ボーマリス城, Wales, begun 1295) procedural builder
 * ====================================================================
 * Returns the same { group, fadeGroups, interiorGroup, info, pickables,
 * windowMat, waterMats, labelGroup, life } contract as buildBodiam() /
 * buildVincennes(). Beaumaris is Edward I's last and most geometrically
 * regular Welsh castle: a TRUE concentric plan, a squarish inner ward
 * fully enclosed by a lower octagonal outer ward, both moated. It was
 * also never finished -- the towers and gatehouses were left well short
 * of their planned height when money and Edward I himself (d.1307, then
 * master mason James of St George, d.1309) ran out. Both facts drive the
 * two design choices below: (1) a two-tier cutaway exactly like
 * Vincennes' donjon -- the OUTER ward wall (tier 'outer') fades first,
 * then the INNER ward wall/towers/gatehouses (tier 'inner') fade to
 * reveal the interior; (2) every inner-ward tower/gatehouse is modelled
 * with a flat, abruptly truncated top instead of a proper pitched/conical
 * roof, to read visibly as "construction stopped here".
 *
 * ---- provenance of the numbers below --------------------------------
 * MEASURED, medievalheritage.eu (https://medievalheritage.eu/en/main-page/
 * heritage/wales/beaumaris-castle/):
 *   - inner ward 59 x 54 m; inner wall 4.9m thick, 11m high
 *   - outer wall 1.5-1.8m thick, 8m+ high
 *   - inner corner towers: north pair ~8m diameter, south pair ~5m
 *   - north gatehouse great hall ~21 x 7.6m
 * MEASURED, Wikipedia "Beaumaris Castle" (en):
 *   - outer ward ("gap" between the two curtains) ~60ft = 18m across
 *   - outer curtain is eight-sided (octagonal), with 12 turrets and
 *     ~300 firing positions incl. 164 arrow-loops
 *   - inner wall 36ft(11m) high / 15.5ft(4.7m) thick -- matches the
 *     medievalheritage.eu figures used above within rounding
 *   - north gatehouse towers ~32ft (9.75m) short of their planned
 *     height; the rest of the inner-ring towers "roughly half" their
 *     planned height; north gatehouse completed only to first-floor
 *     level (a second storey would have doubled it)
 *   - south gatehouse, six inner-ring towers and the outer "Llanfaes
 *     gate" were left unfinished when work stopped in the 1320s
 *   - moat ~18ft (5.5m) wide (single source, not cross-checked)
 *   - the tidal dock ("Gate next the Sea") let vessels up to 40 tons
 *     sail directly to the castle; no dock dimensions were found
 * SHAPE-ONLY reference (used for geometry/colour, not for dimensions) --
 * photographs and the Cadw ground plan on Wikimedia Commons:
 *   - File:Beaumaris_aerial.jpg and File:Beaumaris_aerial_(cropped).jpg
 *     (vertical aerials): give the octagonal moat hugging the curtain, the
 *     turrets spaced ALONG the straight outer runs, the corner drums, and the
 *     dull olive-brown water
 *   - File:Beaumaris_plan,_Cadw.jpg (measured ground plan): gives both
 *     gatehouses projecting INTO the inner ward on twin D-fronted drums, the
 *     east "Hall and Chamber" / west "Kitchen & Stables" ranges, the Llanfaes
 *     Gate / Gate next the Sea / barbican, and the Castle Dock offset WEST of
 *     the north-south axis
 *   - File:Beaumaris_Castle_-_geograph.org.uk_-_28577.jpg (ground level):
 *     gives the grey-BROWN rubble tone, the narrow turf berm, and the outer
 *     turrets standing 2-3m proud of the parapet
 * ESTIMATED (no source found -- flagged again inline at point of use):
 *   - outer wall thickness taken as 1.65m, the midpoint of the measured
 *     1.5-1.8m range
 *   - every tower/gatehouse BUILT height (only "roughly half of planned"
 *     / "32ft short" are sourced, not an absolute figure), the octagon's
 *     chamfer length, D-tower proportions, merlon size, moat/dock render
 *     dimensions (moat widened from the sourced 5.5m for on-screen
 *     legibility), and every interior room's exact position (Beaumaris'
 *     sparse surviving fabric doesn't fix these to individual rooms)
 * ==================================================================== */
function buildBeaumaris(){
  var group = new T.Group();
  var interiorGroup = new T.Group();
  group.add(interiorGroup);
  var fadeGroups = [];
  var pickables = [];

  /* `skin` picks which procedural material a shell group gets:
   *   'ashlar' 切石   -- both curtains, every drum/D-tower/gatehouse
   *   'rubble' 粗石積み -- the inner-ward building ranges (and every
   *                       truncated cap, which is an exposed wall CORE)
   *   'slate'  スレート -- the ranges' lean-to roofs
   * The default keeps the old Lambert behaviour for anything that has
   * not been given a skin yet, so an un-skinned group still builds. */
  function makeFadeGroup(name, dir, isRoof, colorHex, tier, skin, nrm){
    var mat = skin ? skinMat(colorHex, skin, nrm)
                   : new T.MeshLambertMaterial({ color: colorHex });
    var g = new T.Group();
    g.name = name;
    group.add(g);
    var desc = { group:g, mat:mat, dir:dir, roof: !!isRoof, op:1, name:name, tier: tier || 'outer' };
    fadeGroups.push(desc);
    return desc;
  }
  function norm(x,z){ var l = Math.hypot(x,z)||1; return {x:x/l, z:z/l}; }

  /* ---- palette: cool grey-buff Anglesey limestone/sandstone, a colder
     tone than Bodiam's warm Sussex sandstone or Vincennes' pale Paris
     limestone, per the brief's "冷たい灰色寄り" instruction ----------- */
  /* NOTE on absolute brightness: the shared 'day' lighting rig multiplies an
     up-facing Lambert surface by roughly 1.9-2.2 (sun 1.55 + hemi 0.65 +
     ambient 0.22), so any channel above ~0x86 CLIPS TO 255 on a horizontal
     face. The first palette here used 0x9a998c, which made every flat tower
     top / merlon cap render as pure white (measured: rgb(255,255,255)) and
     "float" off the greyer vertical faces. Every stone tone below is
     therefore kept under that clipping ceiling, which also lands the castle
     on the cool grey Anglesey limestone the real building shows rather than
     the cream it was reading as. */
  // Hues are kept close to neutral (R and B within a few points of G): the
  // 'day' sun is warm (0xfff2d8), so a stone that is already warm at source
  // renders cream. Anglesey limestone reads cool grey in photographs.
  /* Tones lowered a further ~5% after comparing the low-angle render against
     the Wikimedia aerial: at 0x7b the up-facing merlon caps landed near
     rgb(246,246,244) under the noon rig and the whole curtain read as cream,
     where the real Anglesey stone is a mid grey with visible shading. These
     values keep every up-facing cap under ~230 while leaving the sunlit
     vertical faces clearly lighter than the shaded ones. */
  // Hue nudged WARM (R > G > B) at unchanged luminance after looking at the
  // geograph ground-level photo: the real masonry is a grey-BROWN rubble, and
  // a strictly neutral grey read as concrete. The luminance ceiling from the
  // clipping note above is what must not move; the hue may.
  var STONE_WALL   = 0x777268;
  var STONE_WALL_V = 0x6e6960; // slightly darker, towers/gatehouses
  var STONE_DARK   = 0x4b4d49;
  var ROOF_COL      = 0x434542; // flat truncated caps / parapets
  var CAP_COL       = 0x4d4f4a; // outer-turret truncated caps (was the worst white offender)
  var RANGE_WALL_COL = 0x6e7069; // inner-ward building ranges, rubble masonry
  var RANGE_ROOF_COL = 0x3f4143; // Welsh slate (de-blued: 0x474950 rendered lavender)
  var WINDOW_COL    = 0x1b1b17;
  var FLOOR_COL     = 0x736e62;
  var WOOD_COL      = 0x5c4a34;
  // The Wikimedia aerial shows the moat as a DARK olive-brown sheet, not the
  // pale blue-cyan the first pass rendered: it is a shallow, silty tidal
  // ditch overhung by grass banks, so it reflects the bank rather than the sky.
  var WATER_COL     = 0x2a3f36;
  var MOAT_BED_COL  = 0x22301f; // opaque silt bed read through the water sheet
  var GRASS_COL     = 0x4e6c45;
  var GRASS_COL2    = 0x527047; // island lawn, only a shade off the surrounding field
  // bank ramp gradient: starts as turf (not sand) so the moat edge reads as
  // the grassed bank the real castle has, instead of a beach-coloured collar.
  // BANK_COL is now EXACTLY GRASS_COL -- at 0x5c6c46 the extra red made the
  // ramp's dry edge render as a bright khaki band clearly separate from the
  // surrounding field (very obvious in the ground-level render).
  // ...and the lower two stops are pulled UP from near-black: with vertex
  // colours actually working (see octBankRamp) the old 0x232a1c waterline
  // painted a hard black collar round the island, where the aerial shows turf
  // running down to the water with only a damp, slightly darker fringe.
  var BANK_COL      = 0x4e6c45;
  var BANK_MID_COL  = 0x445c3c;
  var BANK_EDGE_COL = 0x36462f;
  var COURT_GRASS_COL = 0x5a7a46;

  /* ================================================================ *
   * 手続き的テクスチャ -- 共有工房 CastleTex(js/02-texture.js)
   * ================================================================ *
   * ボーマリスは「石が2種類ある城」なので、**キットを2つ**焼く。
   *
   *   TEXKIT  切石(ashlar)  : 内郭・外郭の城壁と塔、門楼。
   *                            きちんと通った段、幅の揃ったブロック、
   *                            細い目地。エドワード1世の王室工事の
   *                            仕上げ面はここまで整っている。
   *   RUBKIT  粗石積み(rubble): 内郭の建物レンジと、切り詰められた塔頂。
   *                            段の高さは半分以下、幅は 0.11-0.30m と
   *                            不揃い、目地は太く深い。工事が止まった
   *                            塔の切り口は「壁の中身」がそのまま露出
   *                            した面なので、こちらを貼る。
   *
   * この2つを **同じ画面に並べて描き分ける** ことがこの城の主題なので、
   * 段数(9 対 13)・ブロック幅の振れ(1.6倍 対 2.7倍)・目地の太さ
   * (1.4px 対 2.6px)・面取り(4.2px 対 7.0px)をすべて逆方向に振って
   * ある。パラメータを近づけると、遠景で両者の区別がつかなくなる。
   *
   * ★色は material.color 側に残す。テクスチャの albedo は無彩色で、
   *   normaliseMean が平均輝度を mean(0.88-0.90)に合わせているので、
   *   既存のパレット(白飛び対策でクリップ閾値以下に調整済み)に乗せても
   *   **暗くなる方向にしか動かない**。パレットの数値は1つも変えていない。
   *
   * ★法線マップは高さマップから焼く。切石より粗石のほうが凹凸が深い
   *   (nrm 4.6 対 5.4)。斜光で「不揃いな石の面」が波打つのはここ。 */
  var TEXKIT = CastleTex.kit({
    id: 'beaumaris',
    nrmBoost: 1.80,
    /* -- 切石: 256px = 2.0m、1段 0.222m x 9段、ブロック幅 0.41-0.64m --
     * ボディアム(2.4m / 8段 / 0.58-1.01m)より一回り小さい石にしてある。
     * アングルシー産の石灰岩は大ぶりの砂岩ブロックほど大きく取れず、
     * 現地写真でも城壁の1石は人の頭2つ分ほどしかない。 */
    stone: {
      metres: 2.0, courses: 9, nrm: 4.6, seed: 0x2B9C41,
      blockMin: 48, blockW: [52, 30],       // 0.41 - 0.64m
      joint: 1.4, bevel: 4.2,               // 細い目地 / 控えめな面取り
      mortar: '#8b8880',
      faceLum: [230, 18],                   // 明度の振れは小さい = 揃った切石
      faceRGB: [-2, -1, 2],                 // わずかに寒色へ
      faceH: [0.76, 0.16],                  // 面はほぼ平ら
      stainMul: [0.86, 0.26],
      tint: [0.93, 0.975, 1.02],            // ★冷たい灰色。蜂蜜色/クリーム色の城との差別化の要
      mean: 0.90
    },
    /* -- 屋根: ウェールズ・スレート ---------------------------------
     * makeRoof の seams(横の段)を 5 本立てて「板状に割れた石を下から
     * 上へ重ねた」段を出す。rolls は縦の合わせ目に流用し、峰(rollHi)を
     * 鉛葺きの 0.42 から 0.10 まで落として「立ちはぜ」に見えないように
     * してある。128px = 1.15m なので 1枚 0.23m 角。 */
    roof: {
      px: 128, metres: 1.7, seed: 0x6A11D3,
      lead: '#c9c8c4',
      /* 1タイア(段)0.425m x 4段、1枚の幅 0.567m。実物のスレートの
       * 働き幅はもう少し細かいが、0.23m で焼いた最初の版は **ミップ
       * マップに負けて完全に消え**、屋根が無地のプラスチック板に
       * なった(実測: 屋根 200px / 幅 16.6m で 1段あたり 2.8px)。
       * ウェールズ産の厚い大判スレート(いわゆる queens)を採り、
       * 段が 6px 前後で残るところまで大きくしてある。 */
      rolls: 3, seams: 4,
      /* 縦の合わせ目は弱く、横の段は強く。逆にすると織物に見える
       * (最初の版がまさにそれだった)。 */
      rollLo: 'rgba(26,26,30,0.16)', rollHi: 'rgba(255,255,255,0.05)',
      seam: 'rgba(18,18,22,0.60)',          // 段の重ね = 影が濃い
      warpSpec: [[4,1.0],[9,0.6],[21,0.34]], warpMul: [0.76, 0.42],
      /* ウェールズ・スレートは青紫を帯びるが、前任者が 0x474950 を
       * 「ラベンダーに見える」として抜いた経緯があるので、テクスチャ側
       * で青を足し戻さない。 */
      tint: [1.00, 0.99, 0.99],
      mean: 0.88, nrm: 2.6
    },
    /* -- 敷石: 中庭の通路・厨房の床。切石(2.0m)と非通約に -- */
    /* -- 敷石: 中庭の通路・厨房の床。切石(2.0m)と非通約に --
     * mean は既定 0.91 ではなく 0.85。makePave は **目地が面より明るい**
     * 素材で、平均を上げると一番明るい目地から 255 で頭を打つ(工房の
     * コメント参照)。カットアウェイ(zoom 0.9)の実測でも、画面内で最も
     * 明るい画素は塔でも壁でもなく、南の作業庭の敷石 (240,225,189) だった。
     * 石より床が明るいのは絵として逆なので、素材の側で下げる。 */
    pave: { metres: 1.7, grid: 4, nrm: 3.4, tint: [0.97, 0.99, 1.00], mean: 0.85 },
    /* -- 漆喰: 内壁・仕切り。石(2.0m)/敷石(1.7m)と非通約 -- */
    plaster: { metres: 2.9, nrm: 1.8, tint: [1.00, 0.99, 0.97], mean: 0.87 },
    wood:  { metres: 1.5, nrm: 2.6 },
    straw: { nrm: 2.7 },
    soil:  { nrm: 3.0 },
    turf:  { metres: 2.7 },
    cloth: { nrm: 2.2 },
    /* -- 旗の地色。ここでは船の吹き流しに1枚だけ使う(下の B-2 参照) -- */
    flag: { field: '#7c2a20', band: '#a8926a', edge: '#5d1c15', bars: 2 }
  });
  var RUBKIT = CastleTex.kit({
    id: 'beaumaris-rubble',
    nrmBoost: 1.80,
    /* -- 粗石積み: 256px = 1.9m、1段 0.158m x 12段、幅 0.15-0.40m ----
     * 「不揃いにする」のは3か所:
     *   幅   blockW [20,34] = 最小と最大で 2.7 倍(切石は 1.6 倍)
     *   明度 faceLum の振れ 34(切石は 18)= 石ごとに色が違う
     *   高さ faceH の振れ 0.42(切石は 0.16)= 面から出る量がばらばら
     * さらに目地を太く(joint 2.6px)深く(mortarH 0.40)、面取りを
     * 広く(bevel 7.0px)して、角の落ちた石が厚いモルタルに埋まって
     * いる状態にしている。makeStone は段の高さだけは一定なので、段は
     * 残る -- ボーマリスの壁も実際には「粗く段を通した粗石積み」なので、
     * これは都合がよい。 */
    stone: {
      metres: 1.9, courses: 12, nrm: 5.4, seed: 0x3C71A9,
      blockMin: 18, blockW: [20, 34],       // 0.15 - 0.40m
      joint: 2.6, bevel: 7.0, mortarH: 0.40,
      mortar: '#807d73',                    // 目地は面よりはっきり暗く
      faceLum: [226, 34], faceRGB: [-2, -1, 1],
      faceH: [0.56, 0.42],
      stainMul: [0.78, 0.40], stainH: 0.22, toolH: 0.16,
      tint: [0.97, 0.985, 1.00],
      mean: 0.88
    }
  });
  var TEX      = TEXKIT.tex;                 // TEX.smoke / TEX.flag / TEX.waterN1..3
  var texMat   = TEXKIT.texMat;              // (colorHex, kind, opt) -> MeshPhongMaterial
  var rubMat   = RUBKIT.texMat;
  /* 城のシェル(fadeGroup)が使う3種の肌。 */
  function skinMat(colorHex, skin, nrm){
    if (skin === 'rubble') return rubMat(colorHex, 'stone', { nrm: nrm != null ? nrm : 1.0 });
    if (skin === 'slate')  return texMat(colorHex, 'roof',  { nrm: nrm != null ? nrm : 0.85 });
    return texMat(colorHex, 'stone', { nrm: nrm != null ? nrm : 1.0 });
  }

  /* ---- 毎フレーム更新のディスパッチ ---------------------------------
   * メインループ(js/90-main.js)には手を入れられないので、更新は
   * frustumCulled=false の「時計メッシュ」の onBeforeRender から回す
   * (ボディアムと同じ手口。追加 drawCall は1)。ここでは配列だけ先に
   * 作っておき、煙・吹き流し・水面がそれぞれ push する。時計メッシュ
   * 本体はビルド末尾の B-0 節で置く。
   * 更新関数はすべて「絶対時刻 t の純関数」にすること -- ポストFXが
   * 1フレームに複数回シーンを描いても二重に進まない。 */
  var ANIM = [];
  function nowSec(){
    return (typeof performance !== 'undefined' && performance.now
            ? performance.now() : Date.now()) / 1000;
  }
  /* 時間帯・天候の読み取り(共有ファイルのグローバルを読むだけ。書かない) */
  function envState(){
    var glow = 0, rain = 0, snow = 0, sunMul = 1;
    if (typeof CUR_TIME !== 'undefined' && CUR_TIME){ glow = CUR_TIME.windowGlow || 0; }
    if (typeof CUR_WEATHER !== 'undefined' && CUR_WEATHER){
      rain = CUR_WEATHER.rain || 0; snow = CUR_WEATHER.snow || 0;
      sunMul = CUR_WEATHER.sunMul != null ? CUR_WEATHER.sunMul : 1;
    }
    return { glow: glow, rain: rain, snow: snow, sunMul: sunMul };
  }

  var windowMat = new T.MeshLambertMaterial({ color: WINDOW_COL });
  var floorMat  = texMat(FLOOR_COL, 'pave', { nrm: 0.9 });
  var woodMat   = texMat(WOOD_COL, 'wood', { nrm: 0.8 });
  /* STONE_DARK は「煤けた石」。粗石の肌を弱い法線で貼る(炉の火床まわりは
   * 平滑に見えてほしいので、壁より浅く) */
  var darkMat   = rubMat(STONE_DARK, 'stone', { nrm: 0.5 });
  var hearthMat = rubMat(0x2a1c14, 'stone', { nrm: 0.45 });
  var courtGrassMat = texMat(COURT_GRASS_COL, 'turf');      // 芝の刈りむら(法線なし)
  var wellMat   = new T.MeshBasicMaterial({ color: 0x2e6a7a });

  /* ---- interior / garden palette ---------------------------------------
   * Same clipping ceiling applies as for the stone tones above: any channel
   * over ~0x86 blows out to white on an up-facing Lambert surface under the
   * noon rig, so every tone below is kept under it (the only exceptions are
   * the two MeshBasicMaterial fire glows, which are meant to read as light
   * sources and are not lit by the rig at all). */
  /* Measured against the first interior render: the day rig multiplies an
     up-facing Lambert channel by ~2.0, so 0x7e straw rendered (252,222,132)
     -- a neon yellow floor. Every tone here is therefore chosen so its
     BRIGHTEST channel stays under ~0x6e (110), which lands the lit result
     around 220 and keeps the interiors readable next to the 0x77 stonework. */
  var STRAW_COL   = 0x60563a;
  var SOIL_COL    = 0x43352a;
  var LEAF_A_COL  = 0x3d5e2f;
  var LEAF_B_COL  = 0x4a6c37;
  var HEDGE_COL   = 0x36512c;
  var TRUNK_COL   = 0x453728;
  var IRON_COL    = 0x3a3b3d;
  var LINEN_COL   = 0x6d6a5d;
  var CLOTH_R_COL = 0x6a2e29;
  var CLOTH_B_COL = 0x32415f;
  var PATH_COL    = 0x5f5a50;
  var SACK_COL    = 0x5e5438;
  var POT_COL     = 0x2f2c28;
  var PALE_COL    = 0x6c6858;   // dressed ashlar: altar, chapel furniture
  var FLAG_COL    = 0x5c574d;   // flagged service floors (kitchen, store)
  var WOOD_L_COL  = 0x5f4e37;   // lighter joinery, so beds/tables read apart from beams
  var HORSE_A_COL = 0x4a3a2a;
  var HORSE_B_COL = 0x5e523f;

  /* 素材ごとの kind 割り当て。木・藁・土・布・敷石は既存 kind でそのまま
   * 対応でき、葉・幹・鉄・素焼きは有機物/金属なので Lambert のまま残す
   * (テクスチャを貼ると低ポリの葉が余計にざらつくだけで得がない)。 */
  var strawMat  = texMat(STRAW_COL, 'straw', { nrm: 0.7 });
  var soilMat   = texMat(SOIL_COL, 'soil', { nrm: 0.9 });
  var leafAMat  = new T.MeshLambertMaterial({ color: LEAF_A_COL });
  var leafBMat  = new T.MeshLambertMaterial({ color: LEAF_B_COL });
  var hedgeMat  = new T.MeshLambertMaterial({ color: HEDGE_COL });
  var trunkMat  = new T.MeshLambertMaterial({ color: TRUNK_COL });
  var ironMat   = new T.MeshLambertMaterial({ color: IRON_COL });
  var linenMat  = texMat(LINEN_COL, 'cloth', { nrm: 0.5 });
  var clothRMat = texMat(CLOTH_R_COL, 'cloth', { nrm: 0.5 });
  var clothBMat = texMat(CLOTH_B_COL, 'cloth', { nrm: 0.5 });
  var pathMat   = texMat(PATH_COL, 'pave', { nrm: 0.7 });
  var sackMat   = texMat(SACK_COL, 'cloth', { nrm: 0.6 });
  var potMat    = new T.MeshLambertMaterial({ color: POT_COL });
  /* 切石の「化粧仕上げ」= 祭壇・ヴォールトのリブ・螺旋階段。壁の粗石と
   * 対になるので、こちらは必ず TEXKIT(切石)側から取る。 */
  var paleMat   = texMat(PALE_COL, 'stone', { nrm: 0.6 });
  var flagMat   = texMat(FLAG_COL, 'pave', { nrm: 0.8 });   // 厨房・倉庫の敷石床
  var woodLMat  = texMat(WOOD_L_COL, 'wood', { nrm: 0.6 });
  /* 内壁・仕切りの漆喰(ライムウォッシュ)。粗石のレンジ壁と *目地の
   * 有無* で描き分けるのが狙いで、色はレンジ壁から大きく外さない
   * (灰色に振ると屋内がコンクリートに見える、というのは他城で確認済み)。
   * DoubleSide: カットアウェイでは仕切りの裏側も見える。r128 は
   * faceDirection で法線を反転してから接空間の摂動を掛けるので、
   * normalMap は裏面でも正しい向きに出る。 */
  var PLASTER_COL  = 0x6e685c;
  var plasterMat   = texMat(PLASTER_COL, 'plaster', { nrm: 0.55, side: T.DoubleSide });
  var fireMat   = new T.MeshBasicMaterial({ color: 0xd0752a });
  var emberMat  = new T.MeshBasicMaterial({ color: 0x8f3f18 });
  var glassRMat = new T.MeshBasicMaterial({ color: 0x8c3730 });
  var glassBMat = new T.MeshBasicMaterial({ color: 0x2f4f86 });

  /* interiorGroup shorthand -- every furnishing below goes through these so
     nothing is accidentally left in a fading shell group. */
  function iProp(w,h,d,mat,x,y,z,ry){ var m = mkBox(w,h,d,mat); place(m,x,y,z,ry); interiorGroup.add(m); return m; }
  function iCyl(rt,rb,h,seg,mat,x,y,z,ry){ var m = mkCyl(rt,rb,h,seg,mat); place(m,x,y,z,ry); interiorGroup.add(m); return m; }
  function iCone(r,h,seg,mat,x,y,z,ry){ var m = mkCone(r,h,seg,mat); place(m,x,y,z,ry); interiorGroup.add(m); return m; }
  /* low-poly rounded blob -- orchard canopies and vegetable tufts. Cones read
     as conifers, which is wrong for both a castle kitchen garden and a
     courtyard fruit tree; 6x4 segments keeps it firmly in the viewer's
     faceted style while reading as a broadleaf shape. */
  function iBlob(r, seg, mat, x, y, z, sy){
    var m = new T.Mesh(new T.SphereGeometry(r, seg||6, Math.max(3, Math.round((seg||6)*0.6))), mat);
    m.castShadow = true; m.receiveShadow = true;
    m.position.set(x, y, z);
    if (sy) m.scale.y = sy;
    interiorGroup.add(m);
    return m;
  }

  /* -------------------------------------------------------------- *
   * footprint constants (metres) -- see the provenance note above for
   * which are measured and which are estimated
   * -------------------------------------------------------------- */
  var INNER_HX = 29.5, INNER_HZ = 27;   // measured: 59 x 54m inner ward, wall outer-face half-extents
  var INNER_WT = 4.9, INNER_WH = 11;    // measured: inner wall thickness / height
  var MER = 1.3;                        // estimated: merlon height (not individually sourced)

  var OUTER_GAP = 18;                   // measured: ~60ft outer-ward gap between the two curtains
  var OUTER_WT = 1.65;                  // estimated: midpoint of the measured 1.5-1.8m range
  var OUTER_WH = 8.2;                   // measured: outer wall "just over 8m"
  // The outer ring's merlons were the same 1.3m as the inner ring's, which
  // flattened the height hierarchy: in the aerial the outer curtain is a low
  // apron and the inner ward towers over it. Smaller merlons out here restore
  // that read without touching the two SOURCED wall heights (8.2 / 11).
  var OUTER_MER = 0.8;

  var OHX = INNER_HX + OUTER_GAP + OUTER_WT; // outer wall outer-face half-extent, X (~49.2m)
  var OHZ = INNER_HZ + OUTER_GAP + OUTER_WT; // outer wall outer-face half-extent, Z (~46.7m)
  // estimated: octagon corner cut. Reduced 12 -> 9.5 after tracing the Cadw
  // ground plan: the diagonal faces there are notably SHORTER than the flat
  // N/S/E/W runs (the corners read as big drum towers with a short splay
  // between them), whereas at 12 the eight faces were nearly equal and the
  // plan read as a lozenge rather than Beaumaris' near-rectangular octagon.
  var CHAMFER = 9.5;
  var NS_HALF = OHX - CHAMFER;          // half-length of the flat north/south outer wall run
  var EW_HALF = OHZ - CHAMFER;          // half-length of the flat east/west outer wall run

  /* Inner corner towers. The sourced 8m / 5m diameters must be INTERNAL
     chamber diameters: the curtain they stand on is itself 4.9m thick, so an
     8m EXTERNAL drum would barely project at all -- and in both the aerial
     photo and the Cadw plan all four corner drums bulge well clear of the
     wall face. External radii are therefore taken as the sourced internal
     radius plus roughly a wall thickness of masonry (an ESTIMATE, but one
     that reproduces the plan; the earlier 4.0 / 2.5 left the south pair
     almost invisible from above). */
  var NORTH_CORNER_R = 5.4, SOUTH_CORNER_R = 4.0;
  var NORTH_CORNER_H = 15, SOUTH_CORNER_H = 13;   // estimated built heights ("roughly half of planned")
  var MID_R = 4.6, MID_H = 14;                    // estimated: D-shaped mid-wall towers, no source found

  var GATE_W = 21, GATE_D = 7.6, GATE_H = 13;     // measured hall 21x7.6m; H estimated ("first floor only")
  var GATE2_W = 16, GATE2_D = 6, GATE2_H = 9;      // south gatehouse: estimated, described as unfinished
  var GATE_OPEN_W = 4.4, GATE_OPEN_H = 4.8;        // estimated passage clear opening (both gatehouses)
  // depth each gatehouse block projects PAST the inner curtain into the ward
  // (estimated; the Cadw plan fixes that they project, not by how much)
  var NGATE_PROJ = 5.0, SGATE_PROJ = 3.5;
  // courtyard-facing extremity of each gatehouse's D-drums -- used both by the
  // resident walk area and by the gate paths so nobody walks through the block
  var NGATE_FACE_Z = -INNER_HZ + GATE_D/2 + NGATE_PROJ + (GATE_W-GATE_OPEN_W)/4;
  var SGATE_FACE_Z =  INNER_HZ - GATE2_D/2 - SGATE_PROJ - (GATE2_W-GATE_OPEN_W)/4;

  var OUTER_GATE_GAP = 6;               // estimated breach width, outer ward (Llanfaes gate / Gate next the Sea)
  var OUTER_GATE_STUB_H = 3;            // estimated: never rose above footing height (per the "unfinished" account)
  // estimated: "small towers", no diameter published. Two sizes now -- the
  // Cadw plan draws the eight octagon-corner turrets noticeably larger than
  // the ones spaced along the straight runs.
  // Sizes raised again after the ground-level photo: the outer turrets there
  // are stout drums that stand a clear 2-3m proud of the parapet, not the
  // flush stubs the previous numbers produced.
  // ...but only +1.5 / +1.0, not the +2.0 / +1.4 first tried: at 10.2m the
  // corner turrets came within 0.8m of the 11m INNER curtain and the whole
  // concentric height hierarchy collapsed in the low-angle render, which is
  // the opposite of what both aerials show.
  var OUTER_TURRET_R = 3.6, OUTER_TURRET_H = OUTER_WH + 1.5;
  var OUTER_MIDT_R = 2.5, OUTER_MIDT_H = OUTER_WH + 1.0;

  /* -------------------------------------------------------------- *
   * fade group registry -- 'outer' tier is the octagonal outer ward,
   * 'inner' tier is the inner ward (fades second, per the two-tier
   * cutaway convention Vincennes' donjon established)
   * -------------------------------------------------------------- */
  var owN = makeFadeGroup('outerWallN', {x:0,z:-1}, false, STONE_WALL, 'outer', 'ashlar');
  var owS = makeFadeGroup('outerWallS', {x:0,z:1},  false, STONE_WALL, 'outer', 'ashlar');
  var owE = makeFadeGroup('outerWallE', {x:1,z:0},  false, STONE_WALL, 'outer', 'ashlar');
  var owW = makeFadeGroup('outerWallW', {x:-1,z:0}, false, STONE_WALL, 'outer', 'ashlar');
  var owNE = makeFadeGroup('outerWallNE', norm(1,-1),  false, STONE_WALL, 'outer', 'ashlar');
  var owSE = makeFadeGroup('outerWallSE', norm(1,1),   false, STONE_WALL, 'outer', 'ashlar');
  var owSW = makeFadeGroup('outerWallSW', norm(-1,1),  false, STONE_WALL, 'outer', 'ashlar');
  var owNW = makeFadeGroup('outerWallNW', norm(-1,-1), false, STONE_WALL, 'outer', 'ashlar');

  var iwN = makeFadeGroup('innerWallN', {x:0,z:-1}, false, STONE_WALL, 'inner', 'ashlar');
  var iwS = makeFadeGroup('innerWallS', {x:0,z:1},  false, STONE_WALL, 'inner', 'ashlar');
  var iwE = makeFadeGroup('innerWallE', {x:1,z:0},  false, STONE_WALL, 'inner', 'ashlar');
  var iwW = makeFadeGroup('innerWallW', {x:-1,z:0}, false, STONE_WALL, 'inner', 'ashlar');
  var icNW = makeFadeGroup('innerCornerNW', norm(-1,-1), false, STONE_WALL_V, 'inner', 'ashlar');
  var icNE = makeFadeGroup('innerCornerNE', norm(1,-1),  false, STONE_WALL_V, 'inner', 'ashlar');
  var icSW = makeFadeGroup('innerCornerSW', norm(-1,1),  false, STONE_WALL_V, 'inner', 'ashlar');
  var icSE = makeFadeGroup('innerCornerSE', norm(1,1),   false, STONE_WALL_V, 'inner', 'ashlar');
  var imE = makeFadeGroup('innerMidE', {x:1,z:0},  false, STONE_WALL_V, 'inner', 'ashlar');
  var imW = makeFadeGroup('innerMidW', {x:-1,z:0}, false, STONE_WALL_V, 'inner', 'ashlar');
  var igN = makeFadeGroup('innerGateN', {x:0,z:-1}, false, STONE_WALL_V, 'inner', 'ashlar');
  var igS = makeFadeGroup('innerGateS', {x:0,z:1},  false, STONE_WALL_V, 'inner', 'ashlar');
  // flat truncated caps for every inner-ward tower/gatehouse -- a single
  // shared roof:true group (tier 'inner') so the whole silhouette's caps
  // disappear together once the inner cutaway is deep enough, matching
  // the roofCaps convention Bodiam/Vincennes use for their pitched roofs.
  /* ★切り詰められた塔頂は「屋根」ではなく **壁の切り口** なので、屋根の
   * 肌ではなく粗石(= 壁の中身)を貼る。工事が止まった面という読みが
   * 強くなるうえ、ここは以前 (255,255,255) まで白飛びしていた最悪の
   * 場所でもあり、テクスチャの平均輝度 0.88 が効く。 */
  var innerRoofCaps = makeFadeGroup('innerRoofCaps', null, true, ROOF_COL, 'inner', 'rubble', 0.75);
  // inner-ward building ranges. Shell (facades + gable ends) and slate roofs
  // are two groups because a fadeGroup carries exactly one material; both are
  // roof:true so they fade on reveal depth alone (not camera direction) --
  // otherwise the far range would stay solid and block the cutaway view
  // across the ward. Floors/partitions/furniture stay in interiorGroup, so a
  // fully-revealed ward reads as the surviving foundation plan.
  var rangeShell = makeFadeGroup('innerRangeShell', null, true, RANGE_WALL_COL, 'inner', 'rubble', 1.0);
  var rangeRoofs = makeFadeGroup('innerRangeRoofs', null, true, RANGE_ROOF_COL, 'inner', 'slate', 0.85);

  /* -------------------------------------------------------------- *
   * wall-building helpers (local to this file, same pattern as
   * bodiam.js / vincennes.js's own local copies)
   * -------------------------------------------------------------- */
  function addCrenellations(target, mat, cx, cz, length, ry, topY, thickness, merlonW, gapW, merH){
    merlonW = merlonW || 1.15; gapW = gapW || 1.05;
    merH = merH || MER;
    var mt = thickness*0.72;
    var period = merlonW + gapW;
    var count = Math.max(1, Math.floor(length/period));
    var start = -(count*period)/2 + merlonW/2;
    var co = Math.cos(ry), si = Math.sin(ry);
    for (var i=0;i<count;i++){
      var lx = start + i*period;
      var wx = cx + lx*co, wz = cz - lx*si;
      var m = mkBox(merlonW, merH, mt, mat);
      place(m, wx, topY + merH/2, wz, ry);
      target.add(m);
    }
  }
  function addWindows(target, mat, cx, cz, length, ry, midY, thickness, windows){
    var co = Math.cos(ry), si = Math.sin(ry);
    (windows||[]).forEach(function(w){
      var win = mkBox(w.w, w.h, thickness*1.05, mat);
      place(win, cx+w.x*co, midY+(w.dy||0), cz-w.x*si, ry);
      target.add(win);
    });
  }
  // battered plinth along the foot of a wall run. Only the INNER curtain gets
  // one: at 4.9m the inner wall is nearly three times the thickness of the
  // 1.65m outer curtain, but from a normal viewing angle you only ever see
  // the wall's FACE, so the difference was invisible. Splaying the inner
  // wall's base out to ~6.5m makes the mass read from the ground and from
  // directly overhead. (Beaumaris' curtains do stand on a battered plinth;
  // the exact projection is not published, so 0.8m per side is a modelling
  // estimate chosen for legibility.)
  var PLINTH_H = 2.4, PLINTH_OUT = 0.8;
  function addPlinth(fg, cx, cz, length, ry, wt){
    var p = mkBox(length, PLINTH_H, wt + PLINTH_OUT*2, fg.mat);
    place(p, cx, PLINTH_H/2, cz, ry);
    fg.group.add(p);
  }
  function buildWallSeg(fg, cx, cz, length, ry, wh, wt, merlonW, gapW, windows, plinth, merH){
    var wall = mkBox(length, wh, wt, fg.mat);
    place(wall, cx, wh/2, cz, ry);
    fg.group.add(wall);
    if (plinth) addPlinth(fg, cx, cz, length, ry, wt);
    addCrenellations(fg.group, fg.mat, cx, cz, length, ry, wh, wt, merlonW, gapW, merH);
    if (windows && windows.length) addWindows(fg.group, windowMat, cx, cz, length, ry, wh*0.6, wt, windows);
  }
  function splitForGate(fg, cz, ry, halfX, gateGap, wh, wt, merlonW, gapW, winL, winR, plinth, merH){
    var half = gateGap/2, segLen = halfX-half, segCx = half+segLen/2;
    buildWallSeg(fg, -segCx, cz, segLen, ry, wh, wt, merlonW, gapW, winL, plinth, merH);
    buildWallSeg(fg,  segCx, cz, segLen, ry, wh, wt, merlonW, gapW, winR, plinth, merH);
  }
  // small open-ended cylinder (no auto top/bottom caps) -- used for
  // towers whose flat top is a SEPARATE fading roof piece (innerRoofCaps)
  // rather than baked into the shaft's own material/opacity.
  function openCyl(rt, rb, h, seg){
    var m = new T.Mesh(new T.CylinderGeometry(rt, rb, h, seg, 1, true));
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }

  /* -------------------------------------------------------------- *
   * OUTER WARD: octagonal curtain (rectangle with chamfered corners),
   * gate breaches north (Llanfaes gate) and south (Gate next the Sea),
   * both historically left unfinished -- modelled as open gaps flanked
   * by low foundation stubs rather than full gatehouses.
   * -------------------------------------------------------------- */
  splitForGate(owN, -OHZ, 0, NS_HALF, OUTER_GATE_GAP, OUTER_WH, OUTER_WT, 0.9, 0.85, [], [], false, OUTER_MER);
  splitForGate(owS, OHZ, Math.PI, NS_HALF, OUTER_GATE_GAP, OUTER_WH, OUTER_WT, 0.9, 0.85, [], [], false, OUTER_MER);
  buildWallSeg(owE, OHX, 0, 2*EW_HALF, -Math.PI/2, OUTER_WH, OUTER_WT, 0.9, 0.85, [], false, OUTER_MER);
  buildWallSeg(owW, -OHX, 0, 2*EW_HALF, Math.PI/2, OUTER_WH, OUTER_WT, 0.9, 0.85, [], false, OUTER_MER);

  var chamferLen = CHAMFER*Math.SQRT2;
  buildWallSeg(owNE, (NS_HALF+OHX)/2, -(OHZ+EW_HALF)/2, chamferLen, -Math.PI/4,  OUTER_WH, OUTER_WT, 0.9, 0.85, [], false, OUTER_MER);
  buildWallSeg(owSE, (NS_HALF+OHX)/2,  (OHZ+EW_HALF)/2, chamferLen, -3*Math.PI/4, OUTER_WH, OUTER_WT, 0.9, 0.85, [], false, OUTER_MER);
  buildWallSeg(owSW, -(NS_HALF+OHX)/2, (OHZ+EW_HALF)/2, chamferLen,  3*Math.PI/4, OUTER_WH, OUTER_WT, 0.9, 0.85, [], false, OUTER_MER);
  buildWallSeg(owNW, -(NS_HALF+OHX)/2, -(OHZ+EW_HALF)/2, chamferLen,  Math.PI/4,  OUTER_WH, OUTER_WT, 0.9, 0.85, [], false, OUTER_MER);

  registerPick(pickables, 'structure', 0, OUTER_WH/2, -OHZ, NS_HALF*1.6, OUTER_WH, OUTER_WT*2.4,
    '外郭壁 Outer Curtain Wall', '八角形をなす外郭の防壁。厚さ1.5〜1.8m、高さ8m超。内郭とのあいだに幅約18mの外郭中庭を挟む二重の同心円式構造。');

  function buildOuterGateStub(fg, cz, ry, label, desc){
    [-1,1].forEach(function(side){
      var lx = side*(OUTER_GATE_GAP/2+1.3);
      var pier = mkBox(2.2, OUTER_GATE_STUB_H, OUTER_WT*1.8, fg.mat);
      place(pier, lx, OUTER_GATE_STUB_H/2, cz, ry);
      fg.group.add(pier);
    });
    registerPick(pickables, 'structure', 0, OUTER_GATE_STUB_H*0.6, cz, OUTER_GATE_GAP+6, OUTER_GATE_STUB_H*1.4, OUTER_WT*3, label, desc);
  }
  buildOuterGateStub(owN, -OHZ, 0, '外郭門(未完成) Llanfaes Gate (unfinished)',
    '城下ラン゠ヴァエス方面へ向かう外郭の門。資金枯渇のため基礎周辺の低い石積みだけで工事が止まった。');
  buildOuterGateStub(owS, OHZ, Math.PI, '海の門(未完成) Gate next the Sea (unfinished)',
    '潮汐ドックに面した外郭の門。こちらも未完成のまま放棄された。');

  /* outer turrets: small, purely decorative, never part of the cutaway
     (same convention Vincennes uses for its chemise bartizans).
     The first pass put a turret ONLY on each of the 8 octagon vertices, which
     left the long straight N/S/E/W runs as blank slabs -- but both the aerial
     photo and the Cadw plan show turrets spaced ALONG those runs as well, and
     they are what makes the outer ring read as a bristling apron rather than
     a plain box. Wikipedia records 12 turrets; the layout below is 8 vertex
     drums + 6 smaller mid-run turrets = 14, i.e. an even stylised spacing
     rather than a 1:1 reproduction of the recorded count. */
  var octVerts = [
    {x:-NS_HALF,z:-OHZ}, {x:NS_HALF,z:-OHZ}, {x:OHX,z:-EW_HALF}, {x:OHX,z:EW_HALF},
    {x:NS_HALF,z:OHZ}, {x:-NS_HALF,z:OHZ}, {x:-OHX,z:EW_HALF}, {x:-OHX,z:-EW_HALF}
  ];
  // two per straight run, clear of the central gate breach on N/S. Counting
  // the projections visible on the aerial gives ~16 in total rather than the
  // 12 Wikipedia records, so 8 vertex + 8 mid-run is the spacing used here.
  var octMids = [
    {x:-NS_HALF*0.52,z:-OHZ}, {x:NS_HALF*0.52,z:-OHZ},
    {x:-NS_HALF*0.52,z:OHZ},  {x:NS_HALF*0.52,z:OHZ},
    {x:OHX,z:-EW_HALF*0.5},   {x:OHX,z:EW_HALF*0.5},
    {x:-OHX,z:-EW_HALF*0.5},  {x:-OHX,z:EW_HALF*0.5}
  ];
  var outerTurretMat = texMat(STONE_WALL, 'stone', { nrm: 1.0 });
  // dark capping disc over each turret's flat top. Without it the cylinder's
  // own up-facing cap renders in the wall tone and blows out to pure white
  // under the noon rig, which is exactly the "bright white tower tops" the
  // review flagged; the disc also matches the truncated inner-ward caps.
  /* ★白飛びの最大の原因だった面。粗石(平均輝度 0.88)を貼って明るさを
   * 下げつつ、切り詰められた壁の切り口として読ませる。法線は 0.6 と
   * 浅め -- 真上を向いた面で法線を深く振ると、太陽の方へ傾いた画素が
   * 増えてかえって白飛びが増える。 */
  var turretCapMat = rubMat(CAP_COL, 'stone', { nrm: 0.6 });
  function addOuterTurret(v, r, h){
    var shaft = mkCyl(r, r*1.08, h, 12, outerTurretMat);
    place(shaft, v.x, h/2, v.z);
    group.add(shaft);
    var tcap = new T.Mesh(new T.CircleGeometry(r*1.06, 12), turretCapMat);
    tcap.rotation.x = -Math.PI/2;
    tcap.position.set(v.x, h+0.05, v.z);
    tcap.receiveShadow = true;
    group.add(tcap);
  }
  octVerts.forEach(function(v, vi){
    addOuterTurret(v, OUTER_TURRET_R, OUTER_TURRET_H);
    if (vi === 1){ // one representative tooltip, not all eight
      registerPick(pickables, 'structure', v.x, OUTER_TURRET_H*0.4, v.z, OUTER_TURRET_R*2.6, OUTER_TURRET_H*0.8, OUTER_TURRET_R*2.6,
        '外郭小塔 Outer Ward Turret', '八角形の外郭に点在する小塔。記録では全12基、約300の射撃陣地と164の矢狭間を備えたとされる(本ビューアでは隅8基+壁面6基に様式化)。');
    }
  });
  octMids.forEach(function(v){ addOuterTurret(v, OUTER_MIDT_R, OUTER_MIDT_H); });

  /* -------------------------------------------------------------- *
   * INNER WARD: 59 x 54m rectangle, 4.9m/11m walls, twin-towered
   * gatehouses north (main, larger, completed to first floor) and
   * south (secondary, left more clearly unfinished), 4 round corner
   * towers (north pair larger than south pair, per the measured
   * diameters), D-shaped mid-wall towers on the east/west walls.
   * -------------------------------------------------------------- */
  splitForGate(iwN, -INNER_HZ, 0, INNER_HX, GATE_W, INNER_WH, INNER_WT, 1.15, 1.05,
    [{x:-(INNER_HX-GATE_W/2)*0.5,w:1.4,h:2.2,dy:1.0}], [{x:(INNER_HX-GATE_W/2)*0.5,w:1.4,h:2.2,dy:1.0}], true);
  splitForGate(iwS, INNER_HZ, Math.PI, INNER_HX, GATE2_W, INNER_WH, INNER_WT, 1.15, 1.05,
    [{x:-(INNER_HX-GATE2_W/2)*0.5,w:1.4,h:2.2,dy:1.0}], [{x:(INNER_HX-GATE2_W/2)*0.5,w:1.4,h:2.2,dy:1.0}], true);
  buildWallSeg(iwE, INNER_HX, 0, 2*INNER_HZ, -Math.PI/2, INNER_WH, INNER_WT, 1.15, 1.05,
    [{x:-9,w:1.5,h:2.4,dy:1.0},{x:9,w:1.5,h:2.4,dy:1.0}], true);
  buildWallSeg(iwW, -INNER_HX, 0, 2*INNER_HZ, Math.PI/2, INNER_WH, INNER_WT, 1.15, 1.05,
    [{x:-9,w:1.5,h:2.4,dy:1.0},{x:9,w:1.5,h:2.4,dy:1.0}], true);

  registerPick(pickables, 'structure', 0, INNER_WH/2, -INNER_HZ, INNER_HX*1.2, INNER_WH, INNER_WT*2, '内郭北壁 Inner Ward North Wall', '厚さ4.9m、高さ11mの内郭防壁。');
  registerPick(pickables, 'structure', 0, INNER_WH/2, INNER_HZ, INNER_HX*1.2, INNER_WH, INNER_WT*2, '内郭南壁 Inner Ward South Wall', '厚さ4.9m、高さ11mの内郭防壁。');
  registerPick(pickables, 'structure', INNER_HX, INNER_WH/2, 0, INNER_WT*2, INNER_WH, INNER_HZ*1.2, '内郭東壁 Inner Ward East Wall', '厚さ4.9m、高さ11mの内郭防壁。');
  registerPick(pickables, 'structure', -INNER_HX, INNER_WH/2, 0, INNER_WT*2, INNER_WH, INNER_HZ*1.2, '内郭西壁 Inner Ward West Wall', '厚さ4.9m、高さ11mの内郭防壁。');

  function buildRoundTower(fg, cx, cz, r, h, storeys, label, desc){
    var shaft = openCyl(r, r*1.06, h, 16);
    shaft.material = fg.mat;
    place(shaft, cx, h/2, cz);
    fg.group.add(shaft);
    var plinth = mkCyl(r*1.12, r*1.24, 1.0, 16, fg.mat);
    place(plinth, cx, 0.5, cz);
    fg.group.add(plinth);
    var n = 16;
    for (var i=0;i<n;i+=2){
      var a = (i/n)*Math.PI*2;
      var m = mkBox(r*0.34, MER, r*0.34, fg.mat);
      place(m, cx+Math.cos(a)*r, h+MER/2, cz+Math.sin(a)*r, -a);
      fg.group.add(m);
    }
    for (var s=0;s<storeys;s++){
      for (var k=0;k<4;k++){
        var ang = k*Math.PI/2 + Math.PI/4;
        var wm = mkBox(0.4, 1.5, 0.5, windowMat);
        place(wm, cx+Math.cos(ang)*r*0.98, 3.0+s*4.0, cz+Math.sin(ang)*r*0.98, -ang);
        fg.group.add(wm);
      }
    }
    var cap = new T.Mesh(new T.CircleGeometry(r*1.05, 16), innerRoofCaps.mat);
    cap.rotation.x = -Math.PI/2;
    cap.position.set(cx, h+MER+0.05, cz);
    cap.receiveShadow = true;
    innerRoofCaps.group.add(cap);
    registerPick(pickables, 'structure', cx, h*0.4, cz, r*2.6, h*0.8, r*2.6, label, desc);
  }
  buildRoundTower(icNW, -INNER_HX, -INNER_HZ, NORTH_CORNER_R, NORTH_CORNER_H, 2,
    '北西塔 Northwest Tower', '直径8mの円塔(実測)。北側2基の隅塔の一つ。計画高の約半分までで工事が止まった(記録による推定)。');
  buildRoundTower(icNE, INNER_HX, -INNER_HZ, NORTH_CORNER_R, NORTH_CORNER_H, 2,
    '北東塔 Northeast Tower', '直径8mの円塔(実測)。北側2基の隅塔の一つ。計画高の約半分までで工事が止まった(記録による推定)。');
  buildRoundTower(icSW, -INNER_HX, INNER_HZ, SOUTH_CORNER_R, SOUTH_CORNER_H, 1,
    '南西塔 Southwest Tower', '直径約5mの円塔(実測)。北側の塔よりひとまわり小さい南側2基の隅塔の一つ。');
  buildRoundTower(icSE, INNER_HX, INNER_HZ, SOUTH_CORNER_R, SOUTH_CORNER_H, 1,
    '南東塔 Southeast Tower', '直径約5mの円塔(実測)。北側の塔よりひとまわり小さい南側2基の隅塔の一つ。');

  function buildMidDTower(fg, cx, cz, r, h, outward, label, desc){
    var thetaStart = outward === 'w' ? Math.PI : 0;
    var shaft = new T.Mesh(new T.CylinderGeometry(r, r, h, 16, 1, true, thetaStart, Math.PI), fg.mat);
    shaft.castShadow = true; shaft.receiveShadow = true;
    shaft.position.set(cx, h/2, cz);
    fg.group.add(shaft);
    var dirSign = outward === 'w' ? -1 : 1;
    [-0.6, 0.6].forEach(function(dz){
      var wm = mkBox(0.4, 1.5, 0.5, windowMat);
      place(wm, cx+dirSign*r*0.98, h*0.5, cz+dz*r*0.7, 0);
      fg.group.add(wm);
    });
    // CircleGeometry's theta runs the opposite way round from CylinderGeometry's
    // once the disc is laid flat (rotation.x = -PI/2), so the cap needs a
    // -PI/2 offset to sit over the SAME half as the shaft. Without it the
    // half-disc was rotated 90 degrees off and hung over the curtain instead.
    var cap = new T.Mesh(new T.CircleGeometry(r*1.04, 16, thetaStart - Math.PI/2, Math.PI), innerRoofCaps.mat);
    cap.rotation.x = -Math.PI/2;
    cap.position.set(cx, h+0.05, cz);
    cap.receiveShadow = true;
    innerRoofCaps.group.add(cap);
    registerPick(pickables, 'structure', cx, h*0.4, cz, r*2.2, h*0.8, r*2.2, label, desc);
  }
  var midEmbedE = INNER_HX - INNER_WT/2, midEmbedW = -(INNER_HX - INNER_WT/2);
  buildMidDTower(imE, midEmbedE, 0, MID_R, MID_H, 'e', '中間塔(礼拝堂塔) East Mid Tower / Chapel Tower', 'D字型の中間塔。東壁中央に張り出す。史実の礼拝堂塔に相当する位置(推定)。');
  buildMidDTower(imW, midEmbedW, 0, MID_R, MID_H, 'w', '中間塔 West Mid Tower', 'D字型の中間塔。西壁中央に張り出す。');

  /* The first pass modelled both gatehouses as a flat slab sitting in the line
   * of the curtain, which made them vanish into the wall. Beaumaris' great
   * gatehouses do the opposite: on the Cadw plan (and clearly in the aerial)
   * each one is a deep block that projects INTO the inner ward, its courtyard
   * face carried on a pair of big D-fronted drums flanking the gate passage.
   * That inward mass is the strongest single shape in the whole inner ward, so
   * `projD` (depth of the projection past the curtain) and `drumR` are added
   * here. Depths are ESTIMATED -- the plan fixes the shape, not the metres. */
  function buildGateBlock(fg, cz, ry, w, d, h, openW, openH, finished, projD, inward, label, desc){
    var pillarW = (w-openW)/2;
    var drumR = pillarW/2;
    [-1,1].forEach(function(side){
      var lx = side*(openW/2+pillarW/2);
      var pillar = mkBox(pillarW, h, d, fg.mat);
      place(pillar, lx, h/2, cz, ry);
      fg.group.add(pillar);
      if (projD > 0){
        var rear = mkBox(pillarW, h, projD, fg.mat);
        place(rear, lx, h/2, cz + inward*(d/2 + projD/2), ry);
        fg.group.add(rear);
        var fz = cz + inward*(d/2 + projD);
        var thetaStart = inward > 0 ? -Math.PI/2 : Math.PI/2; // half facing the ward
        var drum = new T.Mesh(new T.CylinderGeometry(drumR, drumR*1.05, h, 16, 1, true, thetaStart, Math.PI), fg.mat);
        drum.castShadow = true; drum.receiveShadow = true;
        drum.position.set(lx, h/2, fz);
        fg.group.add(drum);
        [-1,1].forEach(function(k){ // arrow loops onto the ward
          var wm = mkBox(0.4, 1.5, 0.5, windowMat);
          place(wm, lx + k*drumR*0.6, h*0.5, fz + inward*drumR*0.85, 0);
          fg.group.add(wm);
        });
        var dcap = new T.Mesh(new T.CircleGeometry(drumR*1.05, 16, thetaStart - Math.PI/2, Math.PI), innerRoofCaps.mat);
        dcap.rotation.x = -Math.PI/2;
        dcap.position.set(lx, h+0.06, fz);
        dcap.receiveShadow = true;
        innerRoofCaps.group.add(dcap);
        var rcap = mkBox(pillarW*1.02, 0.5, projD, innerRoofCaps.mat);
        place(rcap, lx, h + 0.25, cz + inward*(d/2 + projD/2), ry);
        innerRoofCaps.group.add(rcap);
      }
    });
    var lintelH = Math.max(0.8, h-openH);
    var lintel = mkBox(openW, lintelH, d + (projD>0 ? projD : 0), fg.mat);
    place(lintel, 0, openH+lintelH/2, cz + inward*(projD>0 ? projD/2 : 0), ry);
    fg.group.add(lintel);
    if (finished) addCrenellations(fg.group, fg.mat, 0, cz, w, ry, h, d, 1.1, 1.0);
    var cap = mkBox(w*1.05, 0.5, d*1.05, innerRoofCaps.mat);
    place(cap, 0, h + (finished?MER:0) + 0.25, cz, ry);
    innerRoofCaps.group.add(cap);
    registerPick(pickables, 'structure', 0, h*0.42, cz + inward*projD*0.5, w*1.1, h*0.8, (d+projD)*1.2, label, desc);
  }
  buildGateBlock(igN, -INNER_HZ, 0, GATE_W, GATE_D, GATE_H, GATE_OPEN_W, GATE_OPEN_H, true, NGATE_PROJ, 1,
    '北門楼 North Gatehouse', '双塔式の主門。1階に幅約21×奥行7.6mの大広間を持つ(実測)。中庭側にD字型の双塔を張り出す。本来2階建てで倍の高さになる計画だったが、1階までで工事が止まった。');
  buildGateBlock(igS, INNER_HZ, Math.PI, GATE2_W, GATE2_D, GATE2_H, GATE_OPEN_W, GATE_OPEN_H, false, SGATE_PROJ, -1,
    '南門楼(未完成) South Gatehouse (unfinished)', '副門。北門楼と同じく中庭側に張り出すが、さらに未完成な状態で放棄され、はるかに低いまま残る。');

  /* -------------------------------------------------------------- *
   * inner ward courtyard lawn + interior rooms (5: 大広間/礼拝堂/厨房/
   * 城代の間/井戸). All furniture sits in interiorGroup (never fades,
   * only becomes visible once the surrounding inner-tier shell fades).
   * -------------------------------------------------------------- */
  var INNER_IN_HX = INNER_HX - INNER_WT, INNER_IN_HZ = INNER_HZ - INNER_WT;
  var courtyard = mkBox(2*INNER_IN_HX, 0.3, 2*INNER_IN_HZ, courtGrassMat);
  place(courtyard, 0, -0.15, 0);
  interiorGroup.add(courtyard);

  function pickRoom(x0,x1,z0,z1,yCenter,h,name,desc){
    registerPick(pickables, 'room', (x0+x1)/2, yCenter, (z0+z1)/2, Math.abs(x1-x0), h, Math.abs(z1-z0), name, desc);
  }

  /* -------------------------------------------------------------- *
   * INNER-WARD BUILDING RANGES (east + west)
   * -------------------------------------------------------------- *
   * The inner ward was never the bare lawn the ruin shows today: ranges of
   * buildings stood with their backs against the inner curtain, and their
   * footings still survive along the EAST and WEST walls (Wikipedia /
   * medievalheritage.eu both describe planned domestic ranges around the
   * courtyard; only foundations remain). Two blocks per side, with a gap
   * left opposite each D-shaped mid tower so the mid-tower chambers -- the
   * chapel on the east -- keep their door onto the ward.
   * ESTIMATED (no source found): every dimension below, the two-block
   * split, the lean-to roof form, and each room's use. What is sourced is
   * only that ranges existed here and roughly where.
   * The ridge is deliberately kept BELOW the 11m curtain so the ranges
   * never break the castle's silhouette -- Beaumaris' unfinished, flat-
   * topped skyline is the one thing the model must not lose.
   * -------------------------------------------------------------- */
  var RANGE_D = 9.0;                        // depth from the curtain's inner face
  var RANGE_IN_X = INNER_IN_HX - RANGE_D;   // courtyard-facing face, |x| = 15.6
  var RANGE_LOW = 5.8, RANGE_HIGH = 9.7;    // eaves height: courtyard side / curtain side
  var RANGE_FLOOR_Y = 0.18;
  // block ends clear the corner towers (north pair reach z=-23, south pair
  // z=+24.5) and leave an 11m gap amidships for the mid-tower doorways.
  var RANGE_Z = [[-21.0, -5.5], [5.5, 21.0]];

  // lean-to end wall: a box whose top edge is re-profiled into the roof
  // slope, so the gable end meets the pitch with no triangular gap. Cheaper
  // and more predictable than Shape/ExtrudeGeometry, and it keeps the whole
  // range on plain BoxGeometry like the rest of this file.
  function slopedEndWall(w, d, hMinusX, hPlusX, mat){
    var geo = new T.BoxGeometry(w, 1, d);
    var pos = geo.attributes.position;
    for (var i=0;i<pos.count;i++){
      if (pos.getY(i) > 0){
        var t = (pos.getX(i) + w/2)/w;
        pos.setY(i, hMinusX + t*(hPlusX - hMinusX));
      } else pos.setY(i, 0);
    }
    pos.needsUpdate = true;
    geo.computeVertexNormals();
    var m = new T.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  function leanRoofX(mat, xLow, xHigh, yLow, yHigh, zc, spanLen){
    var run = xHigh - xLow, rise = yHigh - yLow;
    var m = new T.Mesh(new T.BoxGeometry(Math.hypot(run, rise), 0.42, spanLen), mat);
    m.castShadow = true; m.receiveShadow = true;
    m.position.set((xLow+xHigh)/2, (yLow+yHigh)/2, zc);
    m.rotation.z = Math.atan2(rise, run);
    uvSlateRoof(m, mat);
    return m;
  }
  /* ---- スレート葺きの UV を「軒と平行な段」に向ける -----------------
   * 共有の applyWorldUVs は上向きの面を uv=(x,z) で投影する。この片流れ
   * 屋根は x 方向に傾いているので、そのまま貼ると **段が斜面を駆け上がる
   * 向き** になり、スレートではなく波板に見える。屋根板は回転前のローカル
   * 座標で「長辺 = 斜面方向 = ローカル x」なので、u と v を入れ替えて
   * uv=(z, x) にすれば段は軒と平行に走る。
   * 書いたあと geometry.userData.__uvW を立てて、ビルド末尾の
   * applyWorldUVs に二度書きさせない(共有側の約束どおり)。 */
  function uvSlateRoof(mesh, mat){
    var geo = mesh.geometry, d = mat.userData.uvDensity || 1;
    var pos = geo.attributes.position, uv = geo.attributes.uv, nor = geo.attributes.normal;
    for (var i=0;i<uv.count;i++){
      var nx = Math.abs(nor.getX(i)), ny = Math.abs(nor.getY(i)), nz = Math.abs(nor.getZ(i));
      var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
      if (ny >= nx && ny >= nz)      uv.setXY(i, z*d, x*d);   // 屋根面: u/v を入れ替え
      else if (nx >= nz)             uv.setXY(i, z*d, y*d);
      else                           uv.setXY(i, x*d, y*d);
    }
    uv.needsUpdate = true;
    geo.userData.__uvW = 1;
  }
  function buildRange(side, z0, z1, chimneyZ){
    var xIn = side*RANGE_IN_X, xOut = side*INNER_IN_HX;
    var xMid = (xIn+xOut)/2, zc = (z0+z1)/2, len = z1-z0;

    var f = mkBox(RANGE_D, 0.36, len, floorMat);
    place(f, xMid, RANGE_FLOOR_Y-0.18, zc);
    interiorGroup.add(f);

    var hMinus = side > 0 ? RANGE_LOW : RANGE_HIGH;
    var hPlus  = side > 0 ? RANGE_HIGH : RANGE_LOW;
    [[z0,-0.3],[z1,0.3]].forEach(function(e){
      var w = slopedEndWall(RANGE_D, 0.6, hMinus, hPlus, rangeShell.mat);
      w.position.set(xMid, 0, e[0] + e[1]);
      rangeShell.group.add(w);
    });

    var doorW = 2.8, segLen = (len - doorW)/2;
    [-1,1].forEach(function(s){
      var segZ = zc + s*(doorW/2 + segLen/2);
      var seg = mkBox(0.6, RANGE_LOW, segLen, rangeShell.mat);
      place(seg, xIn, RANGE_LOW/2, segZ);
      rangeShell.group.add(seg);
      [-1,1].forEach(function(k){
        var win = mkBox(0.7, 1.7, 1.05, windowMat);
        place(win, xIn - side*0.03, 3.0, segZ + k*segLen*0.27);
        rangeShell.group.add(win);
      });
    });
    var lintelH = RANGE_LOW - 3.2;
    var lintel = mkBox(0.6, lintelH, doorW, rangeShell.mat);
    place(lintel, xIn, 3.2 + lintelH/2, zc);
    rangeShell.group.add(lintel);

    if (side > 0) rangeRoofs.group.add(leanRoofX(rangeRoofs.mat, xIn-0.7, xOut+2.0, RANGE_LOW+0.25, RANGE_HIGH, zc, len+1.1));
    else          rangeRoofs.group.add(leanRoofX(rangeRoofs.mat, xOut-2.0, xIn+0.7, RANGE_HIGH, RANGE_LOW+0.25, zc, len+1.1));

    /* ブロックを二分する仕切り壁。外周の粗石と違い、屋内側は漆喰塗り
     * (目地の格子が出ない)なので、カットアウェイで開いたとき壁と
     * 仕切りが素材として描き分けられる。 */
    var part = mkBox(RANGE_D-0.7, 2.6, 0.5, plasterMat);
    place(part, xMid, RANGE_FLOOR_Y+1.3, zc);
    interiorGroup.add(part);

    (chimneyZ||[]).forEach(function(cz){
      var c = mkBox(1.0, 3.6, 1.0, rangeShell.mat);
      place(c, side*(INNER_IN_HX-1.5), RANGE_HIGH-0.7, cz);
      rangeShell.group.add(c);
    });
  }

  var WX_IN = -RANGE_IN_X, WX_OUT = -INNER_IN_HX;   // west range, courtyard face / curtain face
  var EX_IN =  RANGE_IN_X, EX_OUT =  INNER_IN_HX;   // east range

  /* -------------------------------------------------------------- *
   * shared furnishing kit
   * -------------------------------------------------------------- *
   * All of it is pure box/cylinder/cone assembly kept deliberately blocky --
   * the whole viewer is low-poly and a detailed prop would read as a bug next
   * to the 16-segment towers. Nothing here is sourced: no inventory of
   * Beaumaris' fittings survives, so every piece is a generic 13th-14th c.
   * furnishing chosen to make the room's USE legible from the cutaway.
   * -------------------------------------------------------------- */
  var FY = RANGE_FLOOR_Y;               // range floor top, y

  // floor covering laid over buildRange's stone slab (straw, boards, rushes)
  function floorSkin(xa, xb, za, zb, mat, y){
    return iProp(Math.abs(xb-xa), 0.07, Math.abs(zb-za), mat, (xa+xb)/2, (y!=null?y:FY)+0.035, (za+zb)/2);
  }
  // barrel: an 8-sided cylinder with two darker hoops
  function barrel(x, z, r, h, y){
    var b = y!=null?y:FY;
    iCyl(r*0.88, r*0.88, h, 8, woodMat, x, b+h/2, z);
    iCyl(r, r, h*0.13, 8, darkMat, x, b+h*0.28, z);
    iCyl(r, r, h*0.13, 8, darkMat, x, b+h*0.72, z);
  }
  // 4-legged trestle table
  function table(x, z, w, d, h, ry, mat){
    var m = mat || woodLMat;
    iProp(w, 0.14, d, m, x, FY+h, z, ry);
    var co = Math.cos(ry||0), si = Math.sin(ry||0);
    [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(function(s){
      var lx = s[0]*(w/2-0.24), lz = s[1]*(d/2-0.18);
      iProp(0.16, h, 0.16, m, x + lx*co + lz*si, FY+h/2, z - lx*si + lz*co, ry);
    });
  }
  // corn-domed sack
  function sack(x, z, s, y){
    var b = y!=null?y:FY;
    iProp(s*0.85, s*0.95, s*0.7, sackMat, x, b+s*0.48, z);
    iProp(s*0.5, s*0.3, s*0.42, sackMat, x, b+s*1.05, z);
  }
  // hay / straw pile: two stacked cones
  function hayPile(x, z, r, h, y){
    var b = y!=null?y:0;
    iCone(r, h*0.72, 7, strawMat, x, b+h*0.36, z);
    iCone(r*0.62, h*0.5, 7, strawMat, x, b+h*0.78, z);
  }
  // stacked firewood: a low crib of round billets
  function woodStack(x, z, w, rows, ry){
    for (var r=0;r<rows;r++){
      var n = Math.max(2, Math.round(w/0.34));
      for (var i=0;i<n;i++){
        var lx = -w/2 + 0.17 + i*0.34 + (r%2?0.08:0);
        var log = mkCyl(0.15, 0.15, 1.5, 6, woodMat);
        log.rotation.z = Math.PI/2;
        var co = Math.cos(ry||0), si = Math.sin(ry||0);
        place(log, x + lx*co, FY + 0.17 + r*0.32, z - lx*si, ry);
        interiorGroup.add(log);
      }
    }
  }
  // hearth fire: ember bed + a few flame shards (MeshBasic, so it stays bright
  // at dusk/night when the rest of the interior goes dark)
  function fire(x, z, s, y){
    var b = y!=null?y:FY;
    iProp(s*1.3, 0.12, s*1.3, emberMat, x, b+0.08, z);
    for (var i=0;i<3;i++){
      var a = i*2.1;
      iCone(s*0.34, s*(0.8+0.22*i), 5, fireMat, x+Math.cos(a)*s*0.28, b+s*(0.42+0.11*i), z+Math.sin(a)*s*0.28);
    }
  }
  /* Open roof truss under a lean-to. First attempt was a tie beam plus a
     free-floating raking strut, which rendered as loose sticks poking above
     the (faded) roof line. This version is a proper couple: a tie beam at
     collar height, a rafter lying just under the roof pitch, and a queen post
     between them -- so it reads as carpentry no matter which way the roof has
     faded. yIn/yOut track leanRoofX's own end heights minus the rafter depth. */
  function truss(side, z){
    var xIn  = side>0 ? RANGE_IN_X   : -RANGE_IN_X;
    var xOut = side>0 ? INNER_IN_HX  : -INNER_IN_HX;
    /* rafter line taken from leanRoofX's own end points minus the roof slab's
       half-thickness: the first numbers here (RANGE_HIGH-0.55) put the outer
       end 0.4m ABOVE the roof underside, and the rafters showed through the
       slate in every top-down render. leanRoofX runs from (|x|=RANGE_IN_X-0.7,
       RANGE_LOW+0.25) to (|x|=INNER_IN_HX+2.0, RANGE_HIGH), i.e. slope 0.312. */
    var yIn = RANGE_LOW - 0.20, yOut = RANGE_HIGH - 1.05;
    var run = Math.abs(xOut-xIn), rise = yOut-yIn;
    iProp(run-0.5, 0.2, 0.2, woodMat, (xIn+xOut)/2, RANGE_LOW-1.15, z);   // tie beam
    var r = mkBox(Math.hypot(run, rise), 0.2, 0.2, woodMat);
    r.position.set((xIn+xOut)/2, (yIn+yOut)/2, z);
    r.rotation.z = side * Math.atan2(rise, run);
    r.castShadow = true;
    interiorGroup.add(r);
    // queen post, from the tie beam up to the rafter a third of the way out
    var t = 0.34, px = xIn + (xOut-xIn)*t, py = yIn + rise*t;
    iProp(0.17, py - (RANGE_LOW-1.15), 0.17, woodMat, px, (py + RANGE_LOW-1.15)/2, z);
  }
  function trusses(side, z0, z1, n){
    for (var i=0;i<n;i++) truss(side, z0 + (z1-z0)*((i+0.5)/n));
  }
  // wall-hung textile (tapestry / banner), a single thin board
  function hanging(x, y, z, w, h, mat, ry, thin){
    return iProp(w, h, thin||0.09, mat, x, y, z, ry);
  }
  // upright ladder leaning against a wall
  function ladder(x, z, h, ry){
    var co = Math.cos(ry||0), si = Math.sin(ry||0);
    [-1,1].forEach(function(s){
      var lx = s*0.28;
      var r = mkBox(0.1, h, 0.1, woodMat);
      place(r, x + lx*co, FY+h/2, z - lx*si, ry);
      r.rotation.x = 0.16;
      interiorGroup.add(r);
    });
    for (var i=1;i<Math.floor(h/0.45);i++) iProp(0.62, 0.07, 0.07, woodMat, x, FY+i*0.45, z + (i*0.45-h/2)*0.16, ry);
  }

  // ---- west range, north block: stable + harness store
  buildRange(-1, RANGE_Z[0][0], RANGE_Z[0][1]);
  (function(){
    var xa = WX_OUT+0.4, xb = WX_IN-0.4;          // -24.2 .. -16.0
    var zPart = (RANGE_Z[0][0]+RANGE_Z[0][1])/2;   // -13.25, the partition
    floorSkin(xa, xb, RANGE_Z[0][0]+0.4, zPart-0.3, strawMat);   // straw over the stalls

    // three loose-boxes divided by low timber partitions, mangers at the curtain
    var stallZ = [-19.3, -17.0, -14.7];
    [-18.15, -15.85].forEach(function(dz){
      iProp(5.6, 1.45, 0.22, woodMat, xa+2.8, FY+0.72, dz);
      iCyl(0.13, 0.13, 1.9, 6, woodMat, xa+5.6, FY+0.95, dz);   // head post
    });
    stallZ.forEach(function(sz){
      iProp(1.0, 0.62, 1.7, woodMat, xa+0.6, FY+0.31, sz);       // manger
      iProp(0.9, 0.16, 1.7, strawMat, xa+0.6, FY+0.7, sz);       // fodder in it
      // hay rack directly over the manger, NOT over the middle of the stall:
      // at xa+2.0 it sat exactly on top of the horse and hid it from above.
      iProp(0.95, 0.68, 1.5, woodMat, xa+0.75, FY+1.85, sz);
    });

    // two horses, one stall left empty so the boxes read as boxes
    function horse(cx, cz, ry, mat){
      var g = new T.Group();
      function b(w,h,d,x,y,z,rz){ var m = mkBox(w,h,d,mat); m.position.set(x,y,z); if (rz) m.rotation.z = rz; g.add(m); return m; }
      b(2.25, 1.02, 0.92, 0, 1.32, 0);
      b(0.72, 1.15, 0.68, -1.02, 1.72, 0, 0.34);
      b(1.02, 0.48, 0.56, -1.56, 2.16, 0, 0.16);
      [[-0.78,-0.3],[-0.78,0.3],[0.82,-0.3],[0.82,0.3]].forEach(function(p){
        var l = mkCyl(0.12, 0.14, 0.92, 6, mat); l.position.set(p[0], 0.46, p[1]); g.add(l);
      });
      b(0.2, 0.85, 0.2, 1.16, 1.42, 0, 0.24);
      g.position.set(cx, FY, cz); g.rotation.y = ry||0;
      interiorGroup.add(g);
    }
    // stood back from the manger so the horse's head clears the hay rack
    horse(xa+3.4, stallZ[0], 0, new T.MeshLambertMaterial({ color: HORSE_A_COL }));
    horse(xa+3.3, stallZ[2], 0.1, new T.MeshLambertMaterial({ color: HORSE_B_COL }));

    // ---- harness store, south of the partition
    floorSkin(xa, xb, zPart+0.3, RANGE_Z[0][1]-0.4, flagMat);
    iProp(0.5, 2.2, 0.5, woodMat, xa+1.4, FY+1.1, -11.2);            // saddle-tree posts
    iProp(0.5, 2.2, 0.5, woodMat, xa+1.4, FY+1.1, -8.4);
    iProp(0.36, 0.24, 3.4, woodMat, xa+1.4, FY+2.1, -9.8);           // rail between them
    iProp(1.1, 0.7, 0.85, woodMat, xa+1.4, FY+2.55, -11.0);          // saddles on the rail
    iProp(1.1, 0.7, 0.85, woodMat, xa+1.4, FY+2.55, -8.7);
    for (var p=0;p<4;p++){                                            // harness pegs + hanging tack
      iProp(0.5, 0.14, 0.14, woodMat, xa+0.35, FY+2.5, -12.4+p*1.5);
      iProp(0.14, 0.9, 0.5, darkMat, xa+0.35, FY+2.0, -12.4+p*1.5);
    }
    barrel(xb-1.3, -11.6, 0.5, 1.05);
    barrel(xb-1.3, -10.3, 0.5, 1.05);
    iProp(2.4, 0.9, 1.1, woodMat, xb-1.6, FY+0.45, -8.2);            // feed bins (were floating
    iProp(1.2, 1.5, 1.2, woodMat, xb-1.4, FY+0.75, -6.6);            //  out on the lawn: the old
                                                                      //  code used WX_IN+2.2, which
                                                                      //  is OUTSIDE a west range)
    hayPile(xa+4.6, -6.9, 1.35, 1.9, FY);
    trusses(-1, RANGE_Z[0][0], RANGE_Z[0][1], 4);
    pickRoom(WX_OUT, WX_IN, RANGE_Z[0][0], RANGE_Z[0][1], 2.6, 4.6,
      '厩舎・馬具庫 Stable & Harness Store (West Range)',
      '西棟北ブロック。内郭西壁に背を預ける建物レンジ(基礎のみ現存)。厩舎としたのは推定で、史料に個別の用途記載はない。仕切り馬房・飼葉桶・鞍掛けなどの什器はすべて中世一般の造作にもとづく想定。');
  })();

  // ---- west range, south block: kitchen + bakehouse (the standalone
  // kitchen that used to float in the middle of the lawn now lives here,
  // so there is exactly one kitchen in the model)
  buildRange(-1, RANGE_Z[1][0], RANGE_Z[1][1], [10.5, 17.0]);
  (function(){
    var xa = WX_OUT+0.4, xb = WX_IN-0.4;
    floorSkin(xa, xb, RANGE_Z[1][0]+0.4, RANGE_Z[1][1]-0.4, flagMat);

    // ---- great kitchen hearth, under the chimney the shell already carries
    iProp(2.6, 0.55, 3.8, hearthMat, xa+1.0, FY+0.27, 10.5);          // raised hearth slab
    iProp(0.5, 1.9, 3.8, darkMat, xa+0.1, FY+1.5, 10.5);              // fire-back
    fire(xa+1.2, 10.5, 0.85, FY+0.55);
    // smoke hood tapering up into the chimney
    var hood = mkBox(2.6, 1.5, 4.2, darkMat);
    place(hood, xa+1.1, FY+3.4, 10.5);
    interiorGroup.add(hood);
    iProp(1.4, 1.3, 2.2, darkMat, xa+1.1, FY+4.7, 10.5);
    // cauldron on an iron trivet, plus a spit across the fire
    iCyl(0.62, 0.5, 0.8, 10, potMat, xa+1.2, FY+1.35, 10.5);
    iCyl(0.68, 0.68, 0.1, 10, ironMat, xa+1.2, FY+1.8, 10.5);
    [-1,1].forEach(function(s){ iCyl(0.07, 0.07, 2.4, 6, ironMat, xa+2.4, FY+1.2, 10.5+s*1.5); });
    var spit = mkCyl(0.06, 0.06, 3.0, 6, ironMat); spit.rotation.x = Math.PI/2;
    place(spit, xa+2.4, FY+2.3, 10.5); interiorGroup.add(spit);

    // dressers, chopping block, water butt, pot rack
    table(xb-1.5, 8.2, 1.3, 3.6, 0.86, 0);
    table(xb-1.5, 12.4, 1.3, 3.2, 0.86, 0);
    iCyl(0.55, 0.5, 0.75, 8, woodMat, xa+4.4, FY+0.38, 7.2);          // chopping block
    barrel(xa+4.2, 12.6, 0.62, 1.25);
    barrel(xa+5.6, 12.4, 0.5, 1.0);
    sack(xb-2.3, 6.6, 0.9); sack(xb-2.9, 7.4, 0.8);
    var rack = mkBox(0.14, 0.14, 3.2, woodMat);
    place(rack, xa+3.4, FY+2.9, 9.4); interiorGroup.add(rack);
    for (var q=0;q<4;q++){
      iCyl(0.05, 0.05, 0.5, 5, ironMat, xa+3.4, FY+2.6, 8.2+q*0.8);
      iCyl(0.26, 0.2, 0.34, 8, potMat, xa+3.4, FY+2.2, 8.2+q*0.8);
    }
    woodStack(xa+3.0, 5.6, 2.2, 3, Math.PI/2);

    // ---- bakehouse: beehive oven against the curtain, kneading trough, peel
    iProp(3.2, 0.7, 3.2, hearthMat, xa+1.2, FY+0.35, 17.0);           // oven platform
    iCyl(1.35, 1.5, 1.1, 10, hearthMat, xa+1.3, FY+1.25, 17.0);       // oven drum
    iCone(1.5, 1.2, 10, hearthMat, xa+1.3, FY+2.3, 17.0);             // beehive dome
    iProp(0.7, 0.85, 0.9, darkMat, xa+2.5, FY+1.15, 17.0);            // arched mouth
    fire(xa+1.5, 17.0, 0.5, FY+0.7);
    table(xb-1.6, 16.4, 1.4, 3.4, 0.86, 0);                            // kneading trough
    iProp(1.1, 0.28, 3.0, woodMat, xb-1.6, FY+1.05, 16.4);
    for (var lf=0;lf<5;lf++) iCyl(0.26, 0.3, 0.2, 8, sackMat, xb-1.5, FY+1.28, 15.2+lf*0.62);
    var peel = mkBox(0.08, 0.1, 2.6, woodMat);
    place(peel, xa+3.4, FY+1.4, 18.6); peel.rotation.x = 0.45;
    interiorGroup.add(peel);
    iProp(0.9, 0.55, 2.4, woodMat, xb-1.4, FY+0.28, 19.4);             // flour bin
    sack(xa+4.6, 19.6, 1.0); sack(xa+5.6, 19.2, 0.85);
    trusses(-1, RANGE_Z[1][0], RANGE_Z[1][1], 4);

    pickRoom(WX_OUT, WX_IN, RANGE_Z[1][0], 13.5, 2.6, 4.6, '厨房 Kitchen (West Range)',
      '西棟南ブロック北半。内郭西壁沿いの調理場(位置・規模ともに推定、個別の実測記録なし)。大炉・大釜・焼き串・煙出しフードを備える。');
    pickRoom(WX_OUT, WX_IN, 13.5, RANGE_Z[1][1], 2.6, 4.6, 'パン焼き所 Bakehouse (West Range)',
      '西棟南ブロック南半。ドーム型のパン窯とこね台を備えた区画(構成はすべて推定)。');
  })();

  // ---- east range, north block: lodgings / retainers' chambers
  buildRange(1, RANGE_Z[0][0], RANGE_Z[0][1], [-17.5]);
  (function(){
    var xa = EX_OUT-0.4, xb = EX_IN+0.4;          // 24.2 .. 16.0
    floorSkin(xb, xa, RANGE_Z[0][0]+0.4, RANGE_Z[0][1]-0.4, woodMat);   // boarded floor

    // ---- north half: the constable's retainers' chamber, with a fireplace
    iProp(1.0, 1.6, 3.0, hearthMat, xa-0.5, FY+0.8, -17.5);           // fireplace recess
    iProp(2.0, 0.45, 3.4, hearthMat, xa-1.3, FY+0.22, -17.5);         // hearthstone
    fire(xa-1.2, -17.5, 0.75, FY+0.45);
    var lhood = mkBox(1.6, 1.2, 3.6, darkMat);
    place(lhood, xa-0.9, FY+2.4, -17.5); interiorGroup.add(lhood);
    hanging(xa-0.12, FY+3.4, -14.6, 0.09, 2.4, clothRMat, 0, 2.6);     // tapestry on the curtain
    hanging(xa-0.12, FY+3.3, -20.0, 0.09, 2.2, clothBMat, 0, 2.4);

    // three beds with chests at their feet
    [[-19.8, 0],[-16.6, 0],[-11.0, 0]].forEach(function(b, bi){
      var bz = b[0];
      iProp(2.3, 0.42, 1.35, woodMat, xa-1.9, FY+0.32, bz);            // frame
      iProp(2.15, 0.3, 1.2, linenMat, xa-1.9, FY+0.66, bz);            // mattress + sheet
      iProp(0.7, 0.24, 1.1, linenMat, xa-2.75, FY+0.9, bz);            // bolster
      iProp(0.16, 1.1, 0.16, woodMat, xa-0.9, FY+0.75, bz-0.6);        // foot posts
      iProp(0.16, 1.1, 0.16, woodMat, xa-0.9, FY+0.75, bz+0.6);
      iProp(1.0, 0.62, 0.65, woodLMat, xa-3.5, FY+0.31, bz, bi*0.12);  // chest
    });
    // a screened cubicle, table and stools in the south half
    iProp(0.24, 2.4, 4.2, woodMat, xa-4.6, FY+1.2, -14.0);             // timber screen
    table(xb+2.2, -10.0, 1.3, 2.2, 0.82, 0);
    iCyl(0.09, 0.09, 0.5, 6, potMat, xb+2.2, FY+1.1, -10.0);           // candle
    iCyl(0.05, 0.05, 0.26, 5, fireMat, xb+2.2, FY+1.42, -10.0);
    [[-9.0],[ -11.0]].forEach(function(s){ iCyl(0.26, 0.3, 0.5, 6, woodMat, xb+3.4, FY+0.25, s[0]); });
    iProp(1.2, 1.1, 1.2, woodLMat, xb+1.4, FY+0.55, -7.2);             // clothes chest
    for (var g=0;g<3;g++) iProp(0.4, 0.12, 0.12, woodMat, xa-0.3, FY+2.6, -8.6+g*1.1);  // wall pegs
    hanging(xa-0.6, FY+2.0, -8.6, 0.5, 1.1, clothBMat, 0, 0.3);
    hanging(xa-0.6, FY+2.05, -6.4, 0.5, 1.0, clothRMat, 0, 0.3);
    // ladder to a boarded sleeping loft in the roof space
    iProp(RANGE_D-2.6, 0.2, 4.4, woodMat, (xa+xb)/2, FY+3.6, -7.4);
    ladder(xb+1.0, -5.2, 3.4, Math.PI);
    trusses(1, RANGE_Z[0][0], RANGE_Z[0][1], 4);
    pickRoom(EX_IN, EX_OUT, RANGE_Z[0][0], RANGE_Z[0][1], 2.6, 4.6,
      '居室・従者宿舎 Lodgings (East Range)',
      '東棟北ブロック。内郭東壁沿いの居住棟(基礎のみ現存、間取り・什器はすべて推定)。暖炉、寝台、衣装櫃、屋根裏の寝床を置く。');
  })();

  // ---- east range, south block: granary / stores
  buildRange(1, RANGE_Z[1][0], RANGE_Z[1][1]);
  (function(){
    var xa = EX_OUT-0.4, xb = EX_IN+0.4;
    floorSkin(xb, xa, RANGE_Z[1][0]+0.4, RANGE_Z[1][1]-0.4, flagMat);

    // timber arcade down the middle of the store, carrying the loft
    for (var c=0;c<4;c++){
      var pz = 7.4 + c*4.0;
      iCyl(0.26, 0.3, 3.3, 8, woodMat, (xa+xb)/2, FY+1.65, pz);
      iProp(1.5, 0.28, 0.3, woodMat, (xa+xb)/2, FY+3.45, pz);          // bolster head
    }
    // loft boards over the CURTAIN half only: a full-width deck (RANGE_D-1.6
    // by 15) covered nearly the whole block and blanked the store out from
    // above, which defeats the point of the cutaway.
    iProp(3.8, 0.2, 13.0, woodMat, xa-2.2, FY+3.68, 13.4);
    ladder(xb+0.9, 6.6, 3.5, Math.PI);

    // plank grain bins against the curtain
    [7.2, 11.0].forEach(function(gz){
      iProp(2.4, 1.7, 3.2, woodMat, xa-1.5, FY+0.85, gz);
      iProp(2.2, 0.14, 3.0, sackMat, xa-1.5, FY+1.78, gz);             // grain heaped level
    });
    // barrels + crates + sacks
    barrel(xa-1.6, 15.0, 0.6, 1.3); barrel(xa-1.6, 16.5, 0.6, 1.3);
    barrel(xa-2.9, 15.7, 0.6, 1.3); barrel(xa-1.6, 15.75, 0.6, 1.3, FY+1.3);
    for (var s2=0;s2<4;s2++) sack(xb+1.5, 8.0+s2*1.3, 0.95);
    for (var s3=0;s3<3;s3++) sack(xb+2.6, 8.6+s3*1.3, 0.85);
    iProp(1.5, 1.4, 1.5, woodLMat, xb+1.6, FY+0.7, 13.2);
    iProp(1.5, 1.4, 1.5, woodLMat, xb+1.6, FY+0.7, 14.9);
    iProp(1.4, 1.3, 1.4, woodLMat, xb+1.7, FY+2.05, 13.4);
    // spear rack: the concentric plan was built for a siege, so arms live here
    iProp(0.3, 0.3, 3.2, woodMat, xb+0.9, FY+1.9, 18.4);
    for (var sp=0;sp<7;sp++){
      iCyl(0.06, 0.06, 2.6, 5, woodMat, xb+0.9, FY+1.3, 17.0+sp*0.45);
      iCone(0.1, 0.42, 5, ironMat, xb+0.9, FY+2.8, 17.0+sp*0.45);
    }
    hayPile(xa-2.2, 19.4, 1.2, 1.7, FY);
    trusses(1, RANGE_Z[1][0], RANGE_Z[1][1], 4);
    pickRoom(EX_IN, EX_OUT, RANGE_Z[1][0], RANGE_Z[1][1], 2.6, 4.6,
      '倉庫・穀物庫 Storehouse & Granary (East Range)',
      '東棟南ブロック。糧食・武具の保管棟(推定)。同心円式の内郭は籠城を前提とした構造で、貯蔵空間が重視された。穀物櫃・樽・袋・槍架を置く。');
  })();

  /* -------------------------------------------------------------- *
   * GREAT HALL -- first floor of the north gatehouse, the only floor it
   * ever got (see buildGateBlock's north tooltip). MEASURED: 21 x 7.6m.
   * Everything inside is ESTIMATED: no inventory survives, so the fit-out
   * is the standard 13th/14th c. hall arrangement -- dais and high table at
   * one end, trestles and benches down the body, wall fireplace, hangings.
   * -------------------------------------------------------------- */
  var HALL_Y = 4.6, HALL_Z = -INNER_HZ;
  (function(){
    var hw = GATE_W-2, hd = GATE_D-1;                 // 19 x 6.6
    var z0 = HALL_Z - hd/2, z1 = HALL_Z + hd/2;
    var topY = HALL_Y + 0.15;                          // walking surface
    iProp(hw, 0.3, hd, floorMat, 0, HALL_Y, HALL_Z);
    iProp(hw-0.6, 0.06, hd-0.6, strawMat, 0, topY+0.03, HALL_Z);   // rushes strewn on the boards

    // dais at the west end, high table and two chairs on it
    var daisX = -hw/2 + 2.6;
    iProp(4.6, 0.34, hd-0.8, paleMat, -hw/2+2.3, topY+0.17, HALL_Z);
    var dTop = topY + 0.34;
    iProp(0.9, 0.16, 4.4, woodLMat, daisX-0.2, dTop+0.82, HALL_Z);
    [-1,1].forEach(function(s){ iProp(0.7, 0.82, 0.7, woodLMat, daisX-0.2, dTop+0.41, HALL_Z+s*1.8); });
    [-1,1].forEach(function(s){                        // high-backed chairs
      iProp(0.6, 0.1, 0.7, woodLMat, daisX+0.9, dTop+0.48, HALL_Z+s*0.9);
      iProp(0.16, 1.5, 0.7, woodLMat, daisX+1.25, dTop+0.75, HALL_Z+s*0.9);
      [-1,1].forEach(function(k){ iProp(0.12, 0.48, 0.12, woodLMat, daisX+0.9, dTop+0.24, HALL_Z+s*0.9+k*0.28); });
    });

    // two trestle tables with a bench each side, running down the hall
    [2.0, 8.0].forEach(function(tx){
      iProp(1.4, 0.15, 4.6, woodLMat, tx, topY+0.78, HALL_Z);
      [-1,1].forEach(function(s){
        iProp(1.1, 0.78, 0.2, woodLMat, tx, topY+0.39, HALL_Z+s*1.8);   // trestle legs
        iProp(0.55, 0.1, 4.2, woodMat, tx+s*1.35, topY+0.47, HALL_Z);   // bench
        iProp(0.16, 0.47, 3.6, woodMat, tx+s*1.35, topY+0.23, HALL_Z);
      });
      // board: cups and a platter
      for (var c=0;c<4;c++) iCyl(0.11, 0.09, 0.2, 6, potMat, tx-0.3, topY+0.95, HALL_Z-1.8+c*1.2);
      iCyl(0.4, 0.36, 0.1, 8, paleMat, tx+0.3, topY+0.9, HALL_Z);
    });

    // wall fireplace on the outer (north) wall, with hood and firedogs
    var fz = z0 + 0.55, fx = hw/2-4.6;
    iProp(3.4, 0.3, 1.0, hearthMat, fx, topY+0.15, fz);
    // Hood in dressed stone, only the fire-back in soot-black: built entirely
    // out of hearthMat (0x2a1c14) the stack rendered as a black slab that
    // blocked the whole near half of the hall in the cutaway view.
    iProp(2.8, 2.0, 0.3, hearthMat, fx, topY+1.3, fz-0.34);          // fire-back
    [-1,1].forEach(function(s){ iProp(0.55, 2.3, 0.9, paleMat, fx+s*1.7, topY+1.45, fz); });  // jambs
    iProp(4.0, 0.4, 1.1, paleMat, fx, topY+2.8, fz);                 // mantel
    iProp(2.8, 1.3, 0.8, paleMat, fx, topY+3.6, fz-0.12);            // tapering hood
    iProp(1.6, 1.2, 0.62, paleMat, fx, topY+4.8, fz-0.12);
    fire(fx, fz, 0.8, topY+0.3);
    [-1,1].forEach(function(s){ iCyl(0.07,0.07,0.7,6, ironMat, fx+s*0.85, topY+0.65, fz); });

    // arcade of wall shafts + tie beams overhead: gives the hall a ceiling
    // without putting a solid lid over the cutaway
    for (var a=0;a<5;a++){
      var ax = -hw/2 + 2.2 + a*3.7;
      [-1,1].forEach(function(s){ iCyl(0.26, 0.3, 4.2, 8, paleMat, ax, topY+2.1, HALL_Z + s*(hd/2-0.45)); });
      iProp(0.26, 0.26, hd-0.9, woodMat, ax, topY+4.25, HALL_Z);
    }
    // hangings behind the dais and along the north wall
    hanging(daisX-1.6, topY+2.6, HALL_Z, 0.1, 3.0, clothRMat, 0, 4.2);
    // both wall hangings must stay inside |x| < GATE_W/2 (10.5) -- the first
    // pass put the red one at x=11 w=4.4, so its outer half hung in mid-air
    // outside the gatehouse block and was clearly visible from the ward.
    // Both wall hangings go on the FAR (ward-side) wall. On the outer wall
    // they hung between the camera and the hall in the north-facing cutaway
    // and screened off the tables they were meant to sit behind.
    hanging(-1.4, topY+2.4, z1-0.16, 4.6, 2.8, clothBMat);
    hanging(6.6, topY+2.4, z1-0.16, 4.2, 2.8, clothRMat);

    // screens passage at the east end, with a serving hatch
    iProp(0.3, 3.4, hd-0.8, woodMat, hw/2-1.8, topY+1.7, HALL_Z);
    iProp(0.42, 1.6, 1.4, hearthMat, hw/2-1.8, topY+0.9, HALL_Z-1.7);

    pickRoom(-(GATE_W/2-1), GATE_W/2-1, z0+0.5, z1-0.5, HALL_Y+2.2, 5.6,
      '大広間 Great Hall (Gatehouse)',
      '北門楼1階の広間、約21×7.6m(実測)。本来は2階建ての計画だったが1階までで工事が止まった。段上の主席卓・架台式の食卓・壁付き暖炉・壁掛けは中世大広間の一般的な構成にもとづく想定。');
  })();

  /* -------------------------------------------------------------- *
   * GATE PASSAGES -- both gatehouses. The passage void is the gap between
   * buildGateBlock's two pillars: |x| < GATE_OPEN_W/2, running the whole
   * depth of the block (d + projD). Residents walk this line (life.gates),
   * so everything added here is either at floor level and flush, or lifted
   * clear above head height.
   * ESTIMATED: the portcullis, its windlass, the door leaves and the murder
   * holes. Beaumaris' gate passages are recorded as having had portcullises
   * and murder holes; no drawing of the actual ironwork survives.
   * -------------------------------------------------------------- */
  function buildGatePassage(cz, inward, d, projD, openW, openH, upperY, label, desc){
    var zOut = cz - inward*d/2, zIn = cz + inward*(d/2 + projD);
    var mid = (zOut+zIn)/2, len = Math.abs(zIn-zOut);
    iProp(openW-0.1, 0.12, len, flagMat, 0, 0.06, mid);            // paved passage
    // two door leaves, swung back flat against the passage walls
    [-1,1].forEach(function(s){
      iProp(0.22, 3.6, 2.0, woodMat, s*(openW/2-0.12), 1.8, zOut + inward*1.4);
      for (var b=0;b<3;b++) iProp(0.3, 0.14, 1.8, ironMat, s*(openW/2-0.12), 0.8+b*1.2, zOut + inward*1.4);
    });
    // portcullis, hoisted so it hangs above head height in its groove
    var pz = zOut + inward*0.9, pBase = 3.1;
    for (var v=0;v<6;v++) iProp(0.12, openH-pBase+0.4, 0.12, ironMat, -openW/2+0.45+v*((openW-0.9)/5), pBase+(openH-pBase+0.4)/2, pz);
    for (var h=0;h<3;h++) iProp(openW-0.5, 0.12, 0.14, ironMat, 0, pBase+0.25+h*((openH-pBase)/2.4), pz);
    for (var t=0;t<6;t++){                                         // downward spikes
      var sp = mkCone(0.1, 0.34, 4, ironMat);
      sp.rotation.z = Math.PI;
      place(sp, -openW/2+0.45+t*((openW-0.9)/5), pBase-0.17, pz);
      interiorGroup.add(sp);
    }
    // murder holes in the passage vault
    for (var m=0;m<3;m++) iProp(0.5, 0.16, 0.5, darkMat, -1.1+m*1.1, openH-0.12, mid + inward*1.2);
    // windlass on the floor above, with its ropes running down to the grille
    if (upperY != null){
      var drum = mkCyl(0.34, 0.34, 2.6, 8, woodMat); drum.rotation.z = Math.PI/2;
      place(drum, 0, upperY+0.62, pz + inward*0.7); interiorGroup.add(drum);
      [-1,1].forEach(function(s){
        iCyl(0.13, 0.13, 0.5, 6, woodMat, s*1.5, upperY+0.62, pz + inward*0.7);
        var spoke = mkBox(0.1, 1.3, 0.1, woodMat);
        place(spoke, s*1.5, upperY+0.62, pz + inward*0.7); spoke.rotation.z = 0.7;
        interiorGroup.add(spoke);
        iCyl(0.05, 0.05, upperY-openH+0.5, 6, darkMat, s*1.2, (upperY+openH)/2, pz);
      });
    }
    registerPick(pickables, 'room', 0, 2.4, mid, openW+1.2, 4.4, len*0.9, label, desc);
  }
  buildGatePassage(-INNER_HZ, 1, GATE_D, NGATE_PROJ, GATE_OPEN_W, GATE_OPEN_H, HALL_Y,
    '北門楼 門道と落とし格子 North Gate Passage & Portcullis',
    '北門楼を貫く門道。落とし格子は上階の巻き上げ機で吊り上げられ、天井には熱湯や礫を落とすための「殺人孔」が開く。門道の存在は遺構で確認できるが、鉄具そのものは失われており、格子・巻き上げ機・扉はいずれも同時代の一般例にもとづく復元表現。');
  buildGatePassage(INNER_HZ, -1, GATE2_D, SGATE_PROJ, GATE_OPEN_W, GATE_OPEN_H, null,
    '南門楼 門道 South Gate Passage',
    '南門楼の門道。この門楼は北門楼よりさらに未完成な段階で放棄されたため、上階の巻き上げ機構は設けられていない。');

  // south gatehouse: the upper floor was never boarded over -- exposed joists
  // spanning the two pillars are the clearest possible read of "unfinished".
  (function(){
    var jy = 6.2;
    for (var i=0;i<7;i++){
      var jz = INNER_HZ + 2.4 - i*1.5;
      iProp(GATE2_W-1.5, 0.26, 0.24, woodMat, 0, jy, jz);
    }
    iProp(GATE2_W-1.5, 0.3, 0.6, paleMat, 0, jy-0.28, INNER_HZ+2.4);
    registerPick(pickables, 'structure', 0, jy, INNER_HZ-1.6, GATE2_W, 1.6, 9.0,
      '南門楼 未完成の床梁 South Gatehouse, Unfinished Floor',
      '上階の床を張るはずだった梁だけが渡されたまま工事が止まった状態。1320年代に工事が停止したという記録にもとづく表現(梁の本数・寸法は推定)。');
  })();

  /* -------------------------------------------------------------- *
   * CHAPEL -- inside the east D-shaped mid tower. Beaumaris' chapel in the
   * eastern middle tower is the best-preserved interior on the site: a
   * rib-vaulted rectangular room with tall pointed lancets and a stone
   * bench (sedilia) round the walls.
   * The half-disc floor here used to be drawn with CircleGeometry(r,20,0,PI),
   * which -- once the disc is laid flat -- covers the z<0 half, i.e. 90 deg
   * off the tower shaft it is supposed to sit in. CylinderGeometry and
   * CircleGeometry run their theta the opposite way round, exactly the
   * offset buildMidDTower already compensates for on its cap. Same -PI/2
   * correction applied here.
   * ESTIMATED: every dimension and the position of each fitting.
   * -------------------------------------------------------------- */
  (function(){
    var cx = midEmbedE, r = MID_R-0.25;                 // 27.05, 4.35
    var wIn = INNER_IN_HX;                              // 24.6, courtyard face of the curtain
    var chapelTex = makeCheckerTexture('#4f4c42', '#6d685a', 5);
    var chapelFloorMat = new T.MeshLambertMaterial({ map: chapelTex });
    var apse = new T.Mesh(new T.CircleGeometry(r, 20, -Math.PI/2, Math.PI), chapelFloorMat);
    apse.rotation.x = -Math.PI/2;
    apse.receiveShadow = true;
    place(apse, cx, 0.07, 0);
    interiorGroup.add(apse);
    // nave: the part of the chamber inside the curtain's own thickness, so
    // the chapel opens onto the ward instead of being a sealed half-drum
    iProp(cx-wIn, 0.1, r*2, chapelFloorMat, (cx+wIn)/2, 0.06, 0);

    // chancel step + altar at the EAST end (the liturgical east is the
    // outward face of the tower here, which is genuinely east at Beaumaris)
    iProp(0.9, 0.22, 3.4, paleMat, cx+2.2, 0.11, 0);
    iProp(1.1, 1.0, 2.3, paleMat, cx+2.9, 0.62, 0);                 // altar block
    iProp(1.35, 0.14, 2.7, paleMat, cx+2.9, 1.19, 0);               // mensa
    iProp(0.16, 1.15, 0.5, paleMat, cx+3.35, 1.84, 0);              // standing cross
    iProp(0.16, 0.42, 1.05, paleMat, cx+3.35, 2.18, 0);
    [-1,1].forEach(function(s){                                      // candles
      iCyl(0.09, 0.09, 0.55, 6, paleMat, cx+2.95, 1.53, s*0.75);
      iCyl(0.05, 0.05, 0.22, 5, fireMat, cx+2.95, 1.9, s*0.75);
    });
    // sedilia: a low stone bench following the curved wall. Kept at 0.42 --
    // at 0.46 with a 1.25 tread it read as a fence ringing the apse rather
    // than a bench against it, and it hid the altar from a low camera.
    for (var b=0;b<7;b++){
      var a = -Math.PI/2 + 0.22 + b*(Math.PI-0.44)/6;
      iProp(0.62, 0.42, 1.25, paleMat, cx+Math.cos(a)*(r-0.32), 0.21, -Math.sin(a)*(r-0.32), -a);
    }
    // two rows of benches in the nave
    [-1.1, 1.1].forEach(function(bz){
      iProp(2.6, 0.1, 0.42, woodMat, cx-1.4, 0.52, bz);
      [-1,1].forEach(function(s){ iProp(0.14, 0.46, 0.36, woodMat, cx-1.4+s*1.1, 0.29, bz); });
    });
    iProp(0.6, 0.35, 0.55, woodLMat, cx-0.4, 1.35, 0);              // lectern desk
    iCyl(0.13, 0.18, 1.2, 8, woodMat, cx-0.4, 0.6, 0);
    iCyl(0.42, 0.5, 0.75, 10, paleMat, wIn+0.9, 0.44, -2.6);        // font

    /* Three tall pointed lancets in the curved wall. These go into the TOWER's
       own fade group, not interiorGroup: every other opening in this castle is
       a windowMat decal inside the wall it pierces, so updateFade's
       EXTRA_HIDE_AT rule takes them away with the masonry. Left in
       interiorGroup they stood in the open as free-floating black slabs once
       the tower dissolved. As a side benefit the D-tower's exterior gains the
       chapel's lancets, which it did not have before. */
    [-0.85, 0, 0.85].forEach(function(off, wi){
      var a = off;
      var wx = cx + Math.cos(a)*(r+0.3), wz = -Math.sin(a)*(r+0.3);
      var jamb = mkBox(0.5, 3.0, 1.05, windowMat);
      place(jamb, wx, 2.5, wz, -a); imE.group.add(jamb);
      var glass = mkBox(0.28, 2.5, 0.72, wi===1 ? glassRMat : glassBMat);
      place(glass, wx, 2.5, wz, -a); imE.group.add(glass);
      var head = mkCone(0.55, 0.85, 4, windowMat);
      place(head, wx, 4.2, wz, -a); imE.group.add(head);
    });

    /* Vault. First attempt was four diagonal ribs meeting on a central boss:
       with the tower shell dissolved that reads as a derrick standing over an
       open floor, not as a ceiling. Replaced with a bay of TRANSVERSE POINTED
       ARCHES on wall shafts plus one longitudinal ridge rib -- the same shape
       the surviving Beaumaris chapel vault springs from, and it stays legible
       from directly overhead because it is a regular rhythm rather than an X.
       Left open (no web panels): a solid vault in interiorGroup never fades
       and would blank the chapel out in every top-down view. */
    var springY = 2.7, apexY = 4.5, halfSpan = r - 0.45;
    [cx-1.8, cx+0.4, cx+2.6].forEach(function(ax){
      var len = Math.hypot(halfSpan, apexY-springY), ang = Math.atan2(apexY-springY, halfSpan);
      [-1,1].forEach(function(s){
        var m = mkBox(0.2, 0.2, len, paleMat);
        m.position.set(ax, (springY+apexY)/2, s*halfSpan/2);
        m.rotation.x = -s*ang;
        m.castShadow = true;
        interiorGroup.add(m);
        iCyl(0.2, 0.24, springY, 8, paleMat, ax, springY/2, s*halfSpan);      // wall shaft
        iProp(0.42, 0.2, 0.42, paleMat, ax, springY+0.1, s*halfSpan);         // capital
      });
    });
    iProp(5.2, 0.18, 0.18, paleMat, cx+0.4, apexY+0.06, 0);          // ridge rib
    iCyl(0.26, 0.26, 0.3, 8, paleMat, cx+0.4, apexY+0.06, 0);        // boss

    pickRoom(wIn, cx+r, -r, r, 2.4, 5.6,
      '礼拝堂 Chapel (East Mid Tower)',
      '東の中間塔に置かれた礼拝堂。ボーマリスで最も保存の良い内部空間で、リブ・ヴォールトの天井と尖頭窓が残る。祭壇・信徒席・洗礼盤・壁沿いの石造ベンチ(セディリア)の配置は推定。');
  })();

  // (The kitchen used to be a free-standing slab in the middle of the lawn.
  //  It is now a room inside the west range -- see buildRange above -- so the
  //  model has exactly one kitchen and nothing floats in the open courtyard.)

  /* -------------------------------------------------------------- *
   * CORNER-TOWER CHAMBERS. All four inner-ward drums get a floor and a
   * newel stair so the cutaway shows rooms rather than empty tubes; the NW
   * one is furnished as the constable's lodging. ESTIMATED throughout.
   * -------------------------------------------------------------- */
  function newelStair(cx, cz, r, turns, rise){
    iCyl(0.28, 0.32, rise+0.4, 8, paleMat, cx, (rise+0.4)/2, cz);   // newel post
    var n = Math.round(turns*10);
    for (var i=0;i<n;i++){
      var a = (i/10)*Math.PI*2, y = 0.22 + i*(rise/n);
      var st = mkBox(r-0.35, 0.2, 0.55, paleMat);
      place(st, cx + Math.cos(a)*(r*0.5), y, cz + Math.sin(a)*(r*0.5), -a);
      interiorGroup.add(st);
    }
  }
  function towerChamber(cx, cz, r, hearthAng){
    var f = new T.Mesh(new T.CircleGeometry(r-0.35, 16), floorMat);
    f.rotation.x = -Math.PI/2; f.receiveShadow = true;
    place(f, cx, 0.1, cz);
    interiorGroup.add(f);
    if (hearthAng != null){
      var hx = cx + Math.cos(hearthAng)*(r-0.7), hz = cz + Math.sin(hearthAng)*(r-0.7);
      iProp(1.5, 0.28, 1.5, hearthMat, hx, 0.24, hz, -hearthAng);
      iProp(1.7, 1.9, 0.4, darkMat, cx + Math.cos(hearthAng)*(r-0.15), 1.05, cz + Math.sin(hearthAng)*(r-0.15), -hearthAng);
      fire(hx, hz, 0.6, 0.36);
    }
  }
  towerChamber(-INNER_HX, -INNER_HZ, NORTH_CORNER_R, 0.5);          // NW, constable
  (function(){
    var nx = -INNER_HX, nz = -INNER_HZ;
    iProp(1.6, 0.4, 2.2, woodLMat, nx+1.5, 0.32, nz-1.0, 0.4);      // bedstead
    iProp(1.45, 0.3, 2.0, linenMat, nx+1.5, 0.65, nz-1.0, 0.4);
    iProp(0.55, 0.22, 1.0, linenMat, nx+2.1, 0.88, nz-1.6, 0.4);
    [[-0.75,-1.05],[0.9,0.75]].forEach(function(p){                  // bed posts + tester rail
      iProp(0.14, 2.1, 0.14, woodLMat, nx+1.5+p[0], 1.15, nz-1.0+p[1], 0.4);
    });
    iProp(1.1, 0.62, 0.62, woodLMat, nx-1.9, 0.31, nz+1.3, -0.3);   // chest
    table(nx-1.2, nz-1.9, 1.0, 1.7, 0.8, 0.5);
    iCyl(0.09, 0.09, 0.45, 6, potMat, nx-1.2, 0.9+FY, nz-1.9);
    hanging(nx+0.6, 2.1, nz+3.2, 2.2, 1.8, clothBMat);   // clear of the curtain's inner face
    newelStair(nx-2.2, nz+2.2, 2.2, 1.4, 3.4);
    pickRoom(nx-NORTH_CORNER_R, nx+NORTH_CORNER_R, nz-NORTH_CORNER_R, nz+NORTH_CORNER_R, 1.4, 3.2,
      "城代の間 Constable's Chamber (NW Tower)",
      '北西塔に想定される居室(位置は推定、史料に個別の記載なし)。天蓋つき寝台・衣装櫃・螺旋階段を置くが、いずれも同時代の一般的な塔内居室にもとづく想定。');
  })();
  towerChamber(INNER_HX, -INNER_HZ, NORTH_CORNER_R, Math.PI-0.5);   // NE, guard room
  (function(){
    var nx = INNER_HX, nz = -INNER_HZ;
    for (var i=0;i<3;i++) iProp(0.6, 0.12, 1.9, woodMat, nx-1.2, 0.5, nz-2.2+i*1.5);  // pallet beds
    barrel(nx+1.6, nz+1.8, 0.5, 1.0, 0.1);
    iProp(0.28, 0.28, 2.4, woodMat, nx-2.4, 1.3, nz+1.4);                              // arms rack
    for (var s=0;s<4;s++) iCyl(0.05, 0.05, 2.2, 5, woodMat, nx-2.4, 1.2, nz+0.5+s*0.5);
    newelStair(nx+2.0, nz+2.0, 2.2, 1.4, 3.2);
    pickRoom(nx-NORTH_CORNER_R, nx+NORTH_CORNER_R, nz-NORTH_CORNER_R, nz+NORTH_CORNER_R, 1.4, 3.2,
      '北東塔 衛士詰所 Guard Room (NE Tower)', '北東塔の一階に想定される衛士の詰所(用途・什器はすべて推定)。');
  })();
  towerChamber(-INNER_HX, INNER_HZ, SOUTH_CORNER_R, null);          // SW, store
  (function(){
    var nx = -INNER_HX, nz = INNER_HZ;
    barrel(nx+1.0, nz-0.8, 0.55, 1.15, 0.1);
    barrel(nx-0.6, nz-1.0, 0.55, 1.15, 0.1);
    barrel(nx+0.3, nz+0.9, 0.55, 1.15, 0.1);
    sack(nx+1.6, nz+1.1, 0.9, 0.1);
    newelStair(nx-1.4, nz+1.6, 1.9, 1.2, 3.0);
  })();
  towerChamber(INNER_HX, INNER_HZ, SOUTH_CORNER_R, null);           // SE, store
  (function(){
    var nx = INNER_HX, nz = INNER_HZ;
    sack(nx-1.2, nz-0.9, 0.95, 0.1); sack(nx-0.2, nz-1.3, 0.85, 0.1);
    barrel(nx+1.1, nz+0.6, 0.55, 1.15, 0.1);
    newelStair(nx+1.3, nz+1.5, 1.9, 1.2, 3.0);
  })();

  // Well, in the inner ward courtyard, under a timber winch frame.
  var WELL_X = 7, WELL_Z = 5;
  (function(){
    var wx = WELL_X, wz = WELL_Z;
    var pad = mkCyl(1.5, 1.5, 0.1, 24, darkMat);
    place(pad, wx, 0.05, wz);
    interiorGroup.add(pad);
    var well = new T.Mesh(new T.CircleGeometry(1.0, 24), wellMat);
    well.rotation.x = -Math.PI/2;
    well.castShadow = false; well.receiveShadow = false;
    place(well, wx, 0.13, wz);
    interiorGroup.add(well);
    var kerb = new T.Mesh(new T.TorusGeometry(1.02, 0.14, 10, 24), darkMat);
    kerb.rotation.x = Math.PI/2;
    place(kerb, wx, 0.26, wz);
    interiorGroup.add(kerb);
    // windlass frame over the shaft (ESTIMATED -- no wellhead survives)
    [-1,1].forEach(function(s){
      iProp(0.24, 2.3, 0.24, woodMat, wx + s*1.35, 1.15, wz);
      var brace = mkBox(1.2, 0.16, 0.16, woodMat);
      place(brace, wx + s*0.9, 1.9, wz); brace.rotation.z = s*0.55;
      interiorGroup.add(brace);
    });
    var axle = mkCyl(0.2, 0.2, 2.7, 8, woodMat); axle.rotation.z = Math.PI/2;
    place(axle, wx, 2.2, wz); interiorGroup.add(axle);
    var crank = mkBox(0.1, 0.7, 0.1, woodMat);
    place(crank, wx+1.5, 2.05, wz); crank.rotation.z = 0.8;
    interiorGroup.add(crank);
    iProp(2.9, 0.16, 0.5, woodMat, wx, 2.48, wz);           // little pent roof over it
    iCyl(0.04, 0.04, 1.3, 5, darkMat, wx, 1.5, wz);         // rope
    iCyl(0.3, 0.26, 0.42, 8, woodMat, wx, 0.75, wz);        // bucket
    pickRoom(wx-2.2, wx+2.2, wz-2.2, wz+2.2, 1.4, 3.0, '井戸 Well',
      '中庭に設けられた井戸(位置は推定)。籠城時の生命線で、同心円式の内郭には不可欠の設備。巻き上げ機は同時代の一般例にもとづく表現。');
  })();

  /* -------------------------------------------------------------- *
   * COURTYARD PLANTING + SERVICE YARD
   * -------------------------------------------------------------- *
   * ENTIRELY ESTIMATED. No excavated garden plan exists for Beaumaris'
   * inner ward -- what is general is that a castle of this size kept a
   * kitchen garden and a herbary inside the walls, and that is what is
   * modelled. Everything sits in the WEST half of the courtyard, between
   * the west range's courtyard face (x = -15.6) and x = -6, plus a strip of
   * orchard along the east; life.courtyard's inner-ward rectangle below is
   * narrowed to match so residents never walk through a bed.
   * -------------------------------------------------------------- */
  var GARD_X0 = -14.9, GARD_X1 = -6.2;
  (function(){
    // ---- gravel path linking the two gate passages, with a spur to the well
    iProp(3.4, 0.12, 33.0, pathMat, 0, 0.055, 2.2);
    iProp(9.0, 0.12, 2.4, pathMat, 4.0, 0.055, WELL_Z);
    iProp(2.6, 0.12, 14.0, pathMat, -5.0, 0.055, 3.0);            // service path down to the west range
    iProp(9.6, 0.12, 2.4, pathMat, -10.2, 0.055, 13.25);          // to the kitchen door
    iProp(9.6, 0.12, 2.4, pathMat, -10.2, 0.055, -13.25);         // to the stable door
    iProp(9.6, 0.12, 2.4, pathMat, 10.4, 0.055, -13.25);          // to the lodgings door
    iProp(9.6, 0.12, 2.4, pathMat, 10.4, 0.055, 13.25);           // to the store door

    // ---- kitchen garden: four raised beds of soil, planted in rows
    function bed(cx, cz, w, len, mat, rows){
      iProp(w, 0.34, len, soilMat, cx, 0.17, cz);                  // board-edged bed
      iProp(w+0.24, 0.16, len+0.24, woodMat, cx, 0.08, cz);
      for (var i=0;i<rows;i++){
        var pz = cz - len/2 + len*(i+0.5)/rows;
        for (var k=-1;k<=1;k++){
          iBlob(0.34, 5, mat, cx + k*(w*0.3), 0.44, pz, 0.68);
        }
      }
    }
    var bedMats = [leafAMat, leafBMat, leafAMat, hedgeMat];
    for (var b=0;b<4;b++) bed(GARD_X0 + 1.1 + b*2.2, -5.0, 1.7, 13.0, bedMats[b], 7);
    // a lean-to garden shed + tool row against the range wall
    iProp(1.8, 1.7, 2.2, woodMat, -15.0, 0.85, -12.6);
    iProp(2.2, 0.2, 2.6, new T.MeshLambertMaterial({ color: RANGE_ROOF_COL }), -15.0, 1.8, -12.6);
    for (var tl=0;tl<3;tl++){
      var tool = mkCyl(0.06, 0.06, 1.8, 5, woodMat);
      place(tool, -14.6+tl*0.34, 0.9, -10.4); tool.rotation.x = 0.22;
      interiorGroup.add(tool);
    }

    // ---- herb garden: a quadripartite plot inside a clipped hedge
    var HB_X = -10.6, HB_Z = 8.6, HB_R = 4.1;
    [[0,-1],[0,1],[-1,0],[1,0]].forEach(function(d){                // hedge frame
      var w = d[0] ? 0.6 : HB_R*2, l = d[0] ? HB_R*2 : 0.6;
      iProp(w, 0.7, l, hedgeMat, HB_X + d[0]*HB_R, 0.35, HB_Z + d[1]*HB_R);
    });
    iProp(HB_R*2-0.6, 0.1, 1.1, pathMat, HB_X, 0.055, HB_Z);        // cross paths
    iProp(1.1, 0.1, HB_R*2-0.6, pathMat, HB_X, 0.055, HB_Z);
    [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(function(q, qi){
      var qx = HB_X + q[0]*HB_R*0.5, qz = HB_Z + q[1]*HB_R*0.5;
      iProp(HB_R-1.0, 0.22, HB_R-1.0, soilMat, qx, 0.11, qz);
      for (var i=0;i<3;i++) for (var j=0;j<3;j++){
        iBlob(0.28, 5, qi%2 ? leafBMat : leafAMat, qx-1.0+i*1.0, 0.36, qz-1.0+j*1.0, 0.72);
      }
    });
    iCyl(0.5, 0.6, 0.9, 8, paleMat, HB_X, 0.45, HB_Z);              // little basin at the crossing
    iCyl(0.42, 0.42, 0.12, 10, wellMat, HB_X, 0.92, HB_Z);

    // ---- service yard between the herb garden and the south gate
    woodStack(-13.8, 15.2, 2.6, 4, 0);
    hayPile(-8.4, 16.6, 1.6, 2.3, 0.05);
    // hand cart, tipped on its shafts
    iProp(2.4, 0.24, 1.6, woodMat, -12.4, 1.0, 19.2, 0.35);
    [-1,1].forEach(function(s){
      var wheel = new T.Mesh(new T.TorusGeometry(0.62, 0.13, 6, 12), woodMat);
      wheel.rotation.y = 0.35 + Math.PI/2;
      place(wheel, -12.4 - s*0.55, 0.66, 19.2 + s*0.75);
      wheel.castShadow = true;
      interiorGroup.add(wheel);
      var shaft = mkBox(2.4, 0.12, 0.12, woodMat);
      place(shaft, -10.9, 0.72, 19.2 + s*0.5, 0.35); shaft.rotation.z = -0.22;
      interiorGroup.add(shaft);
    });
    iProp(1.6, 0.9, 0.7, paleMat, -14.4, 0.45, 5.2);                 // stone water trough
    iProp(1.3, 0.5, 0.45, wellMat, -14.4, 0.72, 5.2);

    // ---- small trees. Deliberately 4-5m, i.e. courtyard scale: the forest
    // outside the moat (built by 15-nature.js) is far larger, and matching
    // that size in here would swallow the ward.
    function courtTree(x, z, h, r, mat){
      iCyl(r*0.15, r*0.24, h*0.52, 6, trunkMat, x, h*0.26, z);
      [-1,1].forEach(function(s){                                   // two low limbs
        var lb = mkCyl(0.07, 0.09, r*1.0, 5, trunkMat);
        place(lb, x + s*r*0.3, h*0.55, z); lb.rotation.z = s*0.7;
        interiorGroup.add(lb);
      });
      iBlob(r, 6, mat, x, h*0.68, z, 0.82);                          // rounded orchard canopy
      iBlob(r*0.66, 5, mat, x - r*0.5, h*0.82, z + r*0.28, 0.8);
      iBlob(r*0.6, 5, mat, x + r*0.48, h*0.8, z - r*0.3, 0.8);
    }
    courtTree(-12.6, 19.6, 4.6, 1.6, leafAMat);
    courtTree(-7.2, 19.9, 4.0, 1.4, leafBMat);
    courtTree(13.0, -10.0, 4.4, 1.55, leafBMat);
    courtTree(13.4, -3.0, 4.1, 1.45, leafAMat);
    courtTree(13.0, 4.6, 4.5, 1.6, leafBMat);
    courtTree(13.4, 11.8, 4.2, 1.5, leafAMat);
    courtTree(-13.2, -19.6, 3.8, 1.35, leafAMat);

    // ---- vine trellis against the west range wall, in the gap between blocks
    for (var tp=0;tp<4;tp++) iProp(0.14, 3.2, 0.14, woodMat, -15.15, 1.6, -3.9+tp*1.6);
    for (var tr=0;tr<4;tr++) iProp(0.1, 0.1, 5.0, woodMat, -15.15, 0.8+tr*0.8, -1.1);
    for (var vn=0;vn<16;vn++){
      iBlob(0.36, 5, vn%3 ? leafAMat : leafBMat, -15.0,
        0.75 + (vn%4)*0.78, -3.7 + Math.floor(vn/4)*1.6 + (vn%4)*0.3, 0.85);
    }
    registerPick(pickables, 'room', (GARD_X0+GARD_X1)/2, 1.0, -5.0, GARD_X1-GARD_X0, 2.0, 14.0,
      '菜園 Kitchen Garden', '内郭中庭に設けた菜園(推定)。中世の城は籠城と日常の両面から城内に菜園を持つのが普通だった。ボーマリスに菜園の発掘記録はなく、配置・規模はすべて想定。');
    registerPick(pickables, 'room', HB_X, 1.0, HB_Z, HB_R*2.2, 2.0, HB_R*2.2,
      '薬草園 Herb Garden', '四分割の区画に生垣をめぐらせた薬草園(推定)。薬草は治療と調理の双方に使われた。');
  })();

  /* -------------------------------------------------------------- *
   * moat + tidal dock. The outer ward footprint is close to (but not
   * exactly) square, so a local rectangle-aware moat builder is used
   * instead of the shared square-only buildWaterMoatSystem -- same
   * technique Vincennes' local buildRectMoatSystem uses (copied/adapted
   * here rather than shared, since 01-moat.js is out of scope to edit).
   * -------------------------------------------------------------- */
  /* OCTAGONAL, not rectangular. The first pass reused Vincennes' rectangle
   * moat, which put a big square of lawn outside each of the four chamfered
   * corners -- immediately wrong against the aerial, where the water follows
   * the eight-sided curtain all the way round at a constant offset. Every ring
   * below is therefore a parallel offset of the curtain's own octagon.
   *
   * Offsetting an octagon (half-extents hx/hz, 45-degree corner cut `ch`)
   * outward by d keeps it an octagon with hx+d, hz+d and ch + d*(2-sqrt2):
   * the N/E/S/W faces move out by d, and the diagonal face moves out by d
   * along its own normal, which costs (2-sqrt2)*d of extra corner cut. */
  function octOff(o, d){
    return { hx:o.hx+d, hz:o.hz+d, ch:o.ch + d*(2-Math.SQRT2) };
  }
  function octPts(o){
    return [
      {x:-(o.hx-o.ch), z:-o.hz}, {x:(o.hx-o.ch), z:-o.hz},
      {x:o.hx, z:-(o.hz-o.ch)},  {x:o.hx, z:(o.hz-o.ch)},
      {x:(o.hx-o.ch), z:o.hz},   {x:-(o.hx-o.ch), z:o.hz},
      {x:-o.hx, z:(o.hz-o.ch)},  {x:-o.hx, z:-(o.hz-o.ch)}
    ];
  }
  // `rev` reverses the winding -- holes are wound opposite to their outer
  // shape, exactly as the rectangle version this replaces did.
  function octShape(o, ShapeCtor, rev){
    var p = octPts(o);
    if (rev) p = p.slice().reverse();
    var s = new ShapeCtor();
    s.moveTo(p[0].x, p[0].z);
    for (var i=1;i<p.length;i++) s.lineTo(p[i].x, p[i].z);
    s.closePath();
    return s;
  }
  // arc-length walk of an octagon, so a ramp between two concentric octagons
  // keeps its vertices paired up face-for-face
  function octWalk(o, t){
    var p = octPts(o), n = p.length, i, segs = [], total = 0;
    for (i=0;i<n;i++){
      var a = p[i], b = p[(i+1)%n];
      var L = Math.hypot(b.x-a.x, b.z-a.z);
      segs.push({a:a, b:b, L:L}); total += L;
    }
    var target = (((t%1)+1)%1)*total, acc = 0;
    for (i=0;i<n;i++){
      if (acc + segs[i].L >= target || i === n-1){
        var f = segs[i].L > 0 ? (target-acc)/segs[i].L : 0;
        f = Math.max(0, Math.min(1, f));
        return { x: segs[i].a.x + (segs[i].b.x-segs[i].a.x)*f,
                 z: segs[i].a.z + (segs[i].b.z-segs[i].a.z)*f };
      }
      acc += segs[i].L;
    }
    return p[0];
  }
  /* local clone of the shared buildBankRamp, walking octagons instead of the
     'rect'/'square'/'circle' rings ringPerimPoint() offers. 01-moat.js is out
     of scope to edit, so the ~25 lines are duplicated here rather than adding
     an 'oct' kind to the shared helper. */
  function octBankRamp(oTop, oBot, yTop, yBot, colTop, colMid, colEdge, segs, steps){
    var positions = [], colors = [], indices = [], stride = steps+1, tmp = new T.Color(), i, j;
    for (i=0;i<=segs;i++){
      var t = i/segs, pT = octWalk(oTop, t), pB = octWalk(oBot, t);
      for (j=0;j<=steps;j++){
        var u = j/steps, eu = smoothstep01(0,1,u);
        positions.push(pT.x + (pB.x-pT.x)*eu, yTop + (yBot-yTop)*eu, pT.z + (pB.z-pT.z)*eu);
        tmp.copy(colTop).lerp(colMid, smoothstep01(0,0.7,u));
        tmp.lerp(colEdge, smoothstep01(0.72,1,u));
        colors.push(tmp.r, tmp.g, tmp.b);
      }
    }
    for (i=0;i<segs;i++){
      for (j=0;j<steps;j++){
        var a = i*stride+j, b = (i+1)*stride+j, c = (i+1)*stride+j+1, d = i*stride+j+1;
        // wound so the computed normals point UP (the shared helper's winding
        // gives downward normals, which is why it needs no vertexColors to
        // read); DoubleSide as a belt-and-braces against the ramp vanishing
        // when seen from a very low camera.
        indices.push(a,d,b, b,d,c);
      }
    }
    var geo = new T.BufferGeometry();
    geo.setIndex(indices);
    geo.setAttribute('position', new T.Float32BufferAttribute(positions, 3));
    geo.setAttribute('color', new T.Float32BufferAttribute(colors, 3));
    geo.computeVertexNormals();
    // r128 removed T.VertexColors; `true` is the current spelling
    var m = new T.Mesh(geo, new T.MeshLambertMaterial({ vertexColors:true, side:T.DoubleSide }));
    m.receiveShadow = true;
    return m;
  }

  function buildOctMoatSystem(opts){
    var g = opts.group;
    var groundY = opts.groundY, waterY = opts.waterY;
    var islandY = opts.islandY!=null?opts.islandY:0.02;
    var oIsland = opts.island, oMoat = opts.moatOuter;
    var bankWOut = opts.bankWidthOut!=null?opts.bankWidthOut:4.0;
    var bankWIn = opts.bankWidthIn!=null?opts.bankWidthIn:3.0;
    var oWaterOut = octOff(oMoat, -bankWOut), oWaterIn = octOff(oIsland, bankWIn);

    var groundSize = opts.groundSize||1800, groundSegs = opts.groundSegs||80;
    var cellSize = groundSize/groundSegs;
    var cutHalf = Math.max(oMoat.hx, oMoat.hz) + Math.max(30, cellSize*2.5);
    var ground = buildUndulatingGround(cutHalf, groundSize, groundSegs, opts.groundMat, cutHalf);
    ground.position.y = groundY;
    g.add(ground);

    var collarShape = new T.Shape();
    collarShape.moveTo(-cutHalf,-cutHalf); collarShape.lineTo(cutHalf,-cutHalf);
    collarShape.lineTo(cutHalf,cutHalf); collarShape.lineTo(-cutHalf,cutHalf); collarShape.closePath();
    collarShape.holes.push(octShape(oMoat, T.Path, true));
    var collarGeo = new T.ShapeGeometry(collarShape);
    collarGeo.rotateX(-Math.PI/2);
    var collar = new T.Mesh(collarGeo, opts.groundMat);
    collar.position.y = groundY; collar.receiveShadow = true;
    g.add(collar);

    var islandGeo = new T.ShapeGeometry(octShape(oIsland, T.Shape));
    islandGeo.rotateX(-Math.PI/2);
    var island = new T.Mesh(islandGeo, opts.islandMat);
    island.position.y = islandY; island.receiveShadow = true;
    g.add(island);

    var colTop = new T.Color(opts.bankColorTop), colMid = new T.Color(opts.bankColorMid), colEdge = new T.Color(opts.bankColorEdge);
    g.add(octBankRamp(oMoat, oWaterOut, groundY, waterY, colTop, colMid, colEdge, 96, 6));
    g.add(octBankRamp(oIsland, oWaterIn, islandY, waterY, colTop, colMid, colEdge, 96, 6));

    var moatShape = octShape(oWaterOut, T.Shape);
    moatShape.holes.push(octShape(oWaterIn, T.Path, true));
    var moatGeo = new T.ShapeGeometry(moatShape);
    moatGeo.rotateX(-Math.PI/2);

    /* Opaque silt BED under the water sheet. Necessary because section 11's
     * applyTimeWeather() overwrites `m.color` on every material registered in
     * `waterMats` with the shared per-time-of-day water colour -- so setting a
     * darker tidal tone on the water material alone does nothing (the first
     * attempt at this rendered exactly the same bright cyan as before). The
     * moat lives in a hole through the ground, so there is nothing behind the
     * sheet either; a dark bed plus a lower opacity lets the shared colour
     * still drive the time-of-day shift while landing the daytime result on
     * the dull olive-brown the aerial photo actually shows. */
    var bedGeo = moatGeo.clone();
    var moatBed = new T.Mesh(bedGeo, new T.MeshLambertMaterial({ color: opts.bedColor }));
    moatBed.position.y = waterY - 0.4;
    moatBed.receiveShadow = true;
    g.add(moatBed);

    // shininess/specular pulled well down from the Bodiam-style bright sheet:
    // the aerial shows a dull silty ditch, not a mirror
    /* opacity 0.42 -> 0.50。B-3 のフレネル反射を入れると、水面の見えは
     * 「地の色 + 空の鏡像」で決まるようになる。0.42 のままだと下の泥床が
     * 透けすぎて、空を映しているのに面として立たない。泥床は残してある
     * ので、真上から覗いたときの「浅い silty ditch」という読みは変わら
     * ない。 */
    var waterMat = new T.MeshPhongMaterial({ color: opts.waterColor, transparent:true, opacity:0.50, shininess:34, specular:0x4e6a62 });
    var moatWater = new T.Mesh(moatGeo, waterMat);
    moatWater.position.y = waterY;
    g.add(moatWater);
    return { waterMat:waterMat, moatWater:moatWater, waterOut:oWaterOut, waterIn:oWaterIn };
  }

  // Berm widened 3 -> 5m: the aerial shows a clear grassed strip between the
  // outer wall foot and the waterline all the way round, not a wall dropping
  // straight into the moat.
  var CURTAIN_OCT = { hx: OHX, hz: OHZ, ch: CHAMFER };
  // 3m, not the 5 the previous pass guessed: the ground-level photo shows the
  // outer curtain and its turrets rising almost straight out of the water,
  // with only a narrow turf fringe -- that near-waterline footing is the
  // single most recognisable thing about the castle from the ground.
  var BAIL_BERM = 3;
  // moat render width widened from the sourced ~5.5m (18ft, single source)
  // for on-screen legibility -- see the header provenance note. MOAT_W is the
  // whole ditch; the graded banks eat bankWidthOut+bankWidthIn of it, so the
  // visible WATER strip is MOAT_W-4.8. Trimmed 15 -> 13 (with the berm taking
  // the difference) after the aerial showed the water as a fairly tight collar.
  var MOAT_W = 14;
  var ISLAND_OCT = octOff(CURTAIN_OCT, BAIL_BERM);
  var MOAT_OCT = octOff(ISLAND_OCT, MOAT_W);
  var BAIL_HX = ISLAND_OCT.hx, BAIL_HZ = ISLAND_OCT.hz;
  var MOAT_OHX = MOAT_OCT.hx, MOAT_OHZ = MOAT_OCT.hz;
  var GROUND_Y = -0.6, WATER_Y = GROUND_Y-1.1;

  var octMoat = buildOctMoatSystem({
    group: group, groundY: GROUND_Y, waterY: WATER_Y,
    island: ISLAND_OCT, moatOuter: MOAT_OCT, islandY: 0.02,
    bankWidthOut: 2.6, bankWidthIn: 2.2,
    groundMat: new T.MeshLambertMaterial({color:GRASS_COL}), islandMat: new T.MeshLambertMaterial({color:GRASS_COL2}),
    waterColor: WATER_COL, bedColor: MOAT_BED_COL,
    bankColorTop: BANK_COL, bankColorMid: BANK_MID_COL, bankColorEdge: BANK_EDGE_COL,
    groundSize: 1800, groundSegs: 80
  });
  var waterMat = octMoat.waterMat;
  /* 潮汐ドックと海への水路は **海水**。堀と同じマテリアルを使うと
   * (a) 堀用の八角形の岸フェードがドックの矩形にかかって破綻し、
   * (b) 「よどんだ内堀」と「潮の出入りする外海」が同じ肌になる。
   * 別マテリアルに分け、B-3 で性格を変えたシェーダを掛ける。時間帯の色は
   * 11-environment.js が waterMats 経由で両方に書くので、朝夕の色の変化は
   * 堀と揃ったままになる(戻り値に両方入れてある)。 */
  var seaMat = new T.MeshPhongMaterial({ color: WATER_COL, transparent:true, opacity:0.72, shininess:34, specular:0x4e6a62 });
  registerPick(pickables, 'structure', 0, WATER_Y+0.1, -MOAT_OHZ+MOAT_W/2, MOAT_OHX*1.5, 1.2, MOAT_W*0.9,
    '水堀 Moat', '海水を引き込んだ水堀が外郭を全周する。史料では幅約5.5m(18フィート、単一出典)とされるが、本ビューアでは視認性のため幅を広めに描画している。');

  function bridgeOverMoat(z0, z1, w){
    var len = Math.abs(z1-z0), mid = (z0+z1)/2;
    var br = mkBox(w, 0.3, len, woodMat);
    place(br, 0, -0.05, mid);
    group.add(br);
  }
  bridgeOverMoat(-MOAT_OHZ+1.0, -OHZ-0.5, 5.0); // north approach
  bridgeOverMoat(MOAT_OHZ-1.0, OHZ+0.5, 4.4);   // south approach -- a plausible pedestrian causeway alongside
                                                  // the tidal dock; a walkway here is a modelling simplification
                                                  // (the real south gate's primary access was by water)

  /* tidal dock + channel to the sea ("Gate next the Sea").
   * SOURCED: vessels of up to 40 tons could sail right up to the castle at
   * high tide, entering through the south outer gate. ESTIMATED: every
   * dimension, plus the jetty, mooring posts and the vessel.
   *
   * The water surface here is drawn just ABOVE the surrounding ground plane
   * instead of at the moat's own level. That is deliberate: the moat lives in
   * a hole punched through the ground mesh, everything outside that hole is a
   * solid opaque collar, and the first version of this dock put its water
   * 1.1m UNDER that collar -- so it never rendered at all and the dock read as
   * two bare rails sticking out into a field. A short sloped sill bridges the
   * ~1.1m step where the channel meets the moat. */
  /* The Cadw ground plan puts the Castle Dock WEST of the castle's north-south
   * axis: the barbican and the causeway sit on the axis, and the dock basin
   * (with its mill) is offset beside them. The first pass centred the dock on
   * x=0, which buried it under the south causeway. The whole dock is therefore
   * built into `dockG`, shifted west, and the IIFE below takes that group as
   * its `group` parameter so every mesh inside lands in it. The two pick
   * volumes are world-space, so they carry DOCK_X explicitly. */
  var DOCK_X = -12;
  var dockG = new T.Group();
  dockG.position.x = DOCK_X;
  group.add(dockG);

  (function(group){
    var BASIN_W = 20, CHAN_W = 10;
    // the basin is held clear of the south causeway's landfall (the bridge
    // ends at MOAT_OHZ-1); the sill starts at the moat's own water edge so
    // the two bodies of water visibly connect under it.
    var zSill = MOAT_OHZ - 2.6;
    var zBasin0 = MOAT_OHZ + 3.5, zBasin1 = MOAT_OHZ + 25;
    var zChan1 = zBasin1 + 46;                     // runs off toward the strait
    var bedY = GROUND_Y + 0.04, surfY = GROUND_Y + 0.11;
    // same silt tone as the moat bed, so the dock and the moat read as one
    // body of water once the shared time-of-day colour is blended over both
    var bedMat  = new T.MeshLambertMaterial({ color: MOAT_BED_COL });
    var quayMat = new T.MeshLambertMaterial({ color: STONE_DARK });

    /* 水面の UV は **ワールドのメートル座標** で書く。BoxGeometry の UV は
     * 面ごとに 0..1 なので、そのままだとさざ波が板1枚に1周期しか乗らず、
     * しかも basin と channel で模様が繋がらない。dockG は x = DOCK_X だけ
     * ずれているので、ローカル座標にメッシュ位置とその offset を足せば
     * ワールド座標になる(B-3 のシェーダは uv=(x,-z) を仮定)。 */
    function uvWaterWorld(mesh, ox, oz){
      var geo = mesh.geometry, pos = geo.attributes.position, uv = geo.attributes.uv;
      for (var i=0;i<uv.count;i++) uv.setXY(i, pos.getX(i)+ox, -(pos.getZ(i)+oz));
      uv.needsUpdate = true;
      geo.userData.__uvW = 1;                 // applyWorldUVs に二度書きさせない
    }
    /* ※ sill だけは x 軸まわりに傾いているので、この式は厳密には
     * 「斜面に沿った長さ」を z として扱う(実長 5m ほどの板で数十cm の
     * 引き伸ばしにしかならないので、そのままにしてある)。 */
    function waterRun(w, za, zb){
      var bed = mkBox(w+1.6, 0.08, zb-za, bedMat);
      place(bed, 0, bedY, (za+zb)/2);
      bed.castShadow = false;
      group.add(bed);
      var surf = mkBox(w, 0.06, zb-za, seaMat);
      place(surf, 0, surfY, (za+zb)/2);
      surf.castShadow = false; surf.receiveShadow = false;
      uvWaterWorld(surf, DOCK_X, (za+zb)/2);
      group.add(surf);
    }
    waterRun(BASIN_W, zBasin0, zBasin1);
    waterRun(CHAN_W, zBasin1, zChan1);

    // sloped sill down the outer moat bank, so the channel visibly feeds the moat
    var sillRun = zBasin0 - zSill, sillRise = surfY - (WATER_Y + 0.05);
    var sill = mkBox(BASIN_W*0.75, 0.06, Math.hypot(sillRun, sillRise), seaMat);
    place(sill, 0, (surfY + WATER_Y + 0.05)/2, (zSill + zBasin0)/2);
    sill.rotation.x = -Math.atan2(sillRise, sillRun);
    sill.castShadow = false; sill.receiveShadow = false;
    uvWaterWorld(sill, DOCK_X, (zSill + zBasin0)/2);
    group.add(sill);

    // Stone-revetted edges, laid FLUSH with the surrounding ground rather than
    // as free-standing walls: an earlier pass used 2.2m walls down both sides
    // plus an end wall, which read as a concrete tray dropped in a field (and
    // the end wall sat straight across the channel mouth).
    var basinLen = zBasin1 - zBasin0;
    [-1,1].forEach(function(side){
      var edge = mkBox(3.0, 0.34, basinLen+2.0, quayMat);
      place(edge, side*(BASIN_W/2+1.5), GROUND_Y+0.17, (zBasin0+zBasin1)/2);
      edge.castShadow = false;
      group.add(edge);
    });
    // head of the basin, left open where the channel runs out: a single slab
    // across the full width would lie straight over the channel water.
    [-1,1].forEach(function(side){
      var seg = (BASIN_W+6-CHAN_W)/2;
      var headEdge = mkBox(seg, 0.34, 3.0, quayMat);
      place(headEdge, side*(CHAN_W/2+seg/2), GROUND_Y+0.17, zBasin1+1.5);
      headEdge.castShadow = false;
      group.add(headEdge);
    });

    // timber jetty running out from the west quay, on posts
    var jettyZ = zBasin0 + basinLen*0.42;
    var jetty = mkBox(11.0, 0.34, 3.4, woodMat);
    place(jetty, -(BASIN_W/2-4.0), GROUND_Y+0.62, jettyZ);
    group.add(jetty);
    for (var i=0;i<4;i++){
      var post = mkCyl(0.24, 0.28, 1.5, 8, woodMat);
      place(post, -(BASIN_W/2-0.6)+i*3.1, GROUND_Y+0.2, jettyZ+1.3);
      group.add(post);
    }
    [-1,1].forEach(function(s){
      var bollard = mkCyl(0.26, 0.3, 1.3, 8, woodMat);
      place(bollard, BASIN_W/2+0.9, GROUND_Y+0.5, jettyZ + s*5.0);
      group.add(bollard);
    });

    // one small vessel moored at the jetty -- the whole point of a tidal dock
    var boatX = -(BASIN_W/2-3.4), boatZ = jettyZ + 4.4, boatY = GROUND_Y + 0.30;
    var hull = mkBox(8.6, 1.5, 3.2, woodMat);
    place(hull, boatX, boatY, boatZ);
    group.add(hull);
    var sheer = mkBox(7.4, 0.5, 3.6, woodMat);          // flared upper strake
    place(sheer, boatX, boatY+0.85, boatZ);
    group.add(sheer);
    [-1,1].forEach(function(s){                          // raked stem / stern posts
      var stem = mkBox(1.6, 1.4, 0.7, woodMat);
      place(stem, boatX + s*4.5, boatY+0.62, boatZ);
      stem.rotation.z = s*0.42;
      group.add(stem);
    });
    var deck = mkBox(2.6, 0.9, 2.4, darkMat);
    place(deck, boatX-2.2, boatY+1.4, boatZ);
    group.add(deck);
    var mast = mkCyl(0.16, 0.22, 8.5, 8, woodMat);
    place(mast, boatX+0.6, boatY+4.9, boatZ);
    group.add(mast);
    var yard = mkBox(0.16, 0.16, 5.4, woodMat);
    place(yard, boatX+0.6, boatY+7.6, boatZ);
    group.add(yard);
    var sail = mkBox(0.08, 3.6, 5.0, texMat(0xb9b2a0, 'cloth', { nrm: 0.5 }));
    place(sail, boatX+0.6, boatY+5.8, boatZ);
    group.add(sail);

    /* ================================================================ *
     * B-2. 旗 -- 城には立てず、ドックの船の檣頭にだけ吹き流しを掛ける
     * ================================================================ *
     * 【なぜ城壁・塔に旗を立てないか】
     * この城の主題は「工事が止まったまま切り詰められた姿」で、塔頂・門楼は
     * いずれも胸壁の途中で断ち切られている(innerRoofCaps が屋根ではなく
     * 粗石 = 壁の切り口なのはそのため)。そこへ竿と旗を立てると、
     *   (1) 竿の高さぶん塔が伸びて見え、低く切り詰めたシルエットという
     *       この城最大の特徴が消える。竿 5m は南側隅塔(13m)の 4割にあたる。
     *   (2) 旗を掲げる場所は本来「完成した胸壁の背後の歩廊」であって、
     *       歩廊が通っていない未完成の塔頂に竿が立つのは考証的に苦しい。
     *   (3) 記録上、資金と国王(1307)・棟梁(1309)を相次いで失い
     *       1320年代に工事が停止した城で、王旗を高く掲げた姿はこの城の
     *       物語と逆を向く。
     * 一方でこの模型は「使われている城」として描かれていて(炉に火が入り、
     * 馬房に馬がいて、煙突から煙が出る)、布のはためきがゼロだとそれは
     * それで嘘になる。そこで、史料に確実な「満潮時に船が城の直下まで
     * 乗り入れた」潮汐ドックの船へ、細い吹き流し(pennon)を1枚だけ掛ける。
     * 城のシルエットには一切触れず、風向きも煙と同じ WIND を使うので、
     * 煙と旗が別方向へなびく矛盾も起きない。
     * ---------------------------------------------------------------- */
    (function mastPennon(){
      var mx = boatX+0.6, my = boatY + 4.9 + 4.25 - 0.35, mz = boatZ;   // 檣頭のすぐ下
      var W = 2.7, H = 0.56;
      var geo = new T.PlaneGeometry(W, H, 16, 3);
      var mat = new T.MeshLambertMaterial({ map: TEX.flag, side: T.DoubleSide });
      var pen = new T.Mesh(geo, mat);
      // 布は影を落とさない: シャドウマップの描画では onBeforeRender が
      // 呼ばれず、1フレーム前の頂点で影が焼かれてちらつく。
      pen.castShadow = false; pen.receiveShadow = false;
      pen.position.set(mx + W/2 + 0.04, my, mz);
      group.add(pen);
      var pos = geo.attributes.position;
      var base = new Float32Array(pos.array);
      ANIM.push(function(t, e){
        if (!pen.visible) return;
        var gust = 0.80 + 0.32*Math.sin(t*0.29) + 0.15*Math.sin(t*0.87);
        var strength = gust * (1 + e.rain*0.55 + e.snow*0.2);
        var sp = 3.4 * (1 + e.rain*0.4);
        var arr = pos.array;
        for (var i=0;i<pos.count;i++){
          var bx = base[i*3], by = base[i*3+1];
          var u = (bx + W/2) / W;                  // 0 = 竿側、1 = 吹き流し端
          var amp = u*u * 0.40 * strength;
          var ph = u*5.2 - t*sp + by*1.1;
          var w1 = Math.sin(ph), w2 = Math.sin(ph*0.57 + 1.7);
          arr[i*3+2] = w1*amp + w2*amp*0.42;
          arr[i*3]   = bx - u*amp*0.30;
          arr[i*3+1] = by + w2*amp*0.16;
        }
        pos.needsUpdate = true;
        geo.computeVertexNormals();
      });
    })();

    registerPick(pickables, 'structure', DOCK_X, GROUND_Y+1.6, (zBasin0+zBasin1)/2, BASIN_W+6, 3.2, (zBasin1-zBasin0),
      '潮汐ドック Tidal Dock ("Gate next the Sea")',
      '南の水路を通じ、満潮時には最大40トン級の船が城門の直下まで乗り入れられたと伝わる(実測)。城の南北軸よりやや西に寄る配置はCadwの遺構平面図に拠る。ドック自体の正確な寸法・桟橋・船は史料未確認のため、規模と細部は推定。');
    registerPick(pickables, 'structure', DOCK_X, GROUND_Y+0.6, (zBasin1+zChan1)/2, CHAN_W+3, 1.6, (zChan1-zBasin1)*0.8,
      '海への水路 Channel to the Sea',
      'メナイ海峡へ通じる潮汐水路。ボーマリスが海に開いた補給拠点として機能したことを示す(経路の詳細は推定)。');
  })(dockG);

  /* ================================================================ *
   * LIVESTOCK & FOWL  (家畜・家禽)
   * ================================================================ *
   * ESTIMATED throughout. No excavated stock record exists for Beaumaris'
   * wards -- what IS general is that a garrisoned royal castle kept its
   * own horses, poultry, a few beasts on the hoof and a dovecote, and that
   * the constable's household ate from them daily. The west range already
   * carries the stable and harness store (also estimated), so the horses
   * simply fill the loose-boxes that were built empty; everything else
   * lives in the EAST strip of the inner ward, between the orchard row at
   * x = 13 and the east range's courtyard face at x = 15.6.
   *
   * Why that strip: life.courtyard's inner-ward rectangle stops at
   * maxX = 11.2 (it was already pulled in to clear the orchard), so it is
   * the one piece of the ward no resident ever walks through -- the same
   * reason the kitchen garden and the herb garden could be put west of
   * GARD_X1. Nothing here moves a bed, a tree, a path or a pick volume.
   *
   * Implementation notes:
   *  - one geometry + one material per species part, shared by every head
   *    (the GEO / MATS pools below). mkBox/mkCyl allocate a fresh
   *    BufferGeometry per mesh, so they are deliberately NOT used here.
   *  - poses and headings vary deterministically (coordinate hash h01);
   *    Math.random is avoided so two renders of the same URL match.
   *  - indoor animals go in interiorGroup, which never fades, so the
   *    horses stay visible the moment the cutaway opens the west range.
   *    Moat and dock birds go in `group` / `dockG` -- they are outside the
   *    shell and no fade tier should touch them.
   *  - every base colour obeys the interior palette's clipping ceiling
   *    (brightest channel <= ~0x77), so even the "white" swan and the
   *    fleece stay under the ~2.0x day multiplier instead of blowing out.
   * ================================================================ */
  var moatBirds = [];                   // 堀に浮かぶ水鳥(B-3 が y を上書きする)
  (function livestock(){
    // ---- shared geometry / material pools ----------------------------
    var GEO = {}, MATS = {};
    function gBox(w,h,d){ var k='B'+w+':'+h+':'+d; return GEO[k] || (GEO[k] = new T.BoxGeometry(w,h,d)); }
    function gCyl(rt,rb,h,s){ var k='C'+rt+':'+rb+':'+h+':'+s; return GEO[k] || (GEO[k] = new T.CylinderGeometry(rt,rb,h,s)); }
    function gSph(r,ws,hs){ var k='S'+r+':'+ws+':'+hs; return GEO[k] || (GEO[k] = new T.SphereGeometry(r,ws,hs)); }
    function gCone(r,h,s){ var k='N'+r+':'+h+':'+s; return GEO[k] || (GEO[k] = new T.ConeGeometry(r,h,s)); }
    function aMat(hex){ return MATS[hex] || (MATS[hex] = new T.MeshLambertMaterial({ color: hex })); }
    function pt(parent, geo, mat, x, y, z, rz, sx, sy, sz){
      var m = new T.Mesh(geo, mat);
      m.position.set(x, y, z);
      if (rz) m.rotation.z = rz;
      if (sx != null) m.scale.set(sx, sy, sz);
      m.castShadow = true; m.receiveShadow = true;
      parent.add(m);
      return m;
    }
    // one animal = one Group; every part is laid out in the animal's own
    // frame with local -X = "forward / head end"
    function spawn(host, x, y, z, ry, scl){
      var g = new T.Group();
      g.position.set(x, y, z);
      if (ry) g.rotation.y = ry;
      if (scl && scl !== 1) g.scale.setScalar(scl);
      host.add(g);
      return g;
    }
    function h01(x, z, s){
      var v = Math.sin(x*127.1 + z*311.7 + (s||0)*74.7) * 43758.5453;
      return v - Math.floor(v);
    }

    /* ---- horse (11 meshes) ------------------------------------------
     * Neck + head hang off a nested Group so ONE rotation switches the
     * animal between head-up, muzzle-at-the-manger and grazing.
     * pose: 0 alert, 1 head at the manger, 2 grazing, 3 lying down. */
    var HIDE = [aMat(0x4a3a2a), aMat(0x5e523f), aMat(0x66645b), aMat(0x32291f)];
    var MANE = [aMat(0x2a2118), aMat(0x3b3226), aMat(0x53514a), aMat(0x231d16)];
    function horse(host, x, y, z, ry, idx, pose, scl){
      var g = spawn(host, x, y, z, ry, scl);
      var mat = HIDE[idx], mane = MANE[idx], lying = pose === 3;
      var bY = lying ? 0.52 : 1.18;
      pt(g, gBox(2.00, lying ? 0.84 : 0.96, 0.88), mat, 0, bY, 0);
      pt(g, gBox(0.62, 0.34, 0.76), mat, -0.84, bY + 0.10, 0);
      pt(g, gBox(0.56, 0.30, 0.72), mat,  0.82, bY + 0.05, 0);
      var neck = new T.Group();
      neck.position.set(-0.92, bY + (lying ? 0.16 : 0.28), 0);
      neck.rotation.z = lying ? 0.66 : (pose === 1 ? 1.55 : (pose === 2 ? 2.28 : 0.30));
      g.add(neck);
      pt(neck, gBox(0.52, 1.00, 0.50), mat, 0, 0.34, 0);
      pt(neck, gBox(0.18, 0.90, 0.14), mane, 0.20, 0.40, 0);
      pt(neck, gBox(0.82, 0.38, 0.42), mat, -0.28, 0.90, 0, 0.26);
      if (lying){
        [[-0.64,0.30],[-0.64,-0.30],[0.70,0.30],[0.70,-0.30]].forEach(function(p){
          pt(g, gBox(0.70, 0.30, 0.26), mat, p[0], 0.16, p[1]);
        });
      } else {
        [[-0.68,0.30],[-0.68,-0.30],[0.76,0.30],[0.76,-0.30]].forEach(function(p){
          pt(g, gCyl(0.11, 0.13, 0.92, 6), mat, p[0], 0.46, p[1]);
        });
      }
      pt(g, gBox(0.15, 0.66, 0.15), mane, 1.02, bY - 0.06, 0, -0.55);
      return g;
    }

    /* ---- domestic fowl (7 meshes) ------------------------------------
     * Drawn life size (~0.35m) then scaled 1.35: a true-to-scale hen is a
     * six-pixel smudge at the ward's default framing, so the flock takes
     * the same legibility latitude the courtyard trees and the moat's
     * render width already do. `cock` = bigger bird, sickle tail, comb. */
    var FOWL = [aMat(0x6a5334), aMat(0x6c6a5e), aMat(0x4b4038)];
    var COMB = aMat(0x76291f), BEAK = aMat(0x6e5a24);
    function fowl(host, x, y, z, ry, idx, peck, cock){
      var g = spawn(host, x, y, z, ry, cock ? 1.70 : 1.35);
      var b = FOWL[idx];
      pt(g, gSph(0.16, 6, 4), b, 0, 0.30, 0, 0, 1.20, 0.98, 0.94);
      var hx = peck ? -0.25 : -0.16, hy = peck ? 0.15 : 0.47;
      pt(g, gSph(0.078, 5, 4), b, hx, hy, 0);
      pt(g, gBox(0.05, cock ? 0.10 : 0.06, 0.03), COMB, hx, hy + (cock ? 0.10 : 0.08), 0);
      pt(g, gCone(0.035, 0.10, 4), BEAK, hx - 0.10, hy - 0.01, 0, Math.PI/2);
      pt(g, gBox(cock ? 0.20 : 0.13, cock ? 0.28 : 0.17, 0.07), b, 0.20, cock ? 0.46 : 0.40, 0, -0.55);
      [0.055, -0.055].forEach(function(lz){
        pt(g, gCyl(0.02, 0.02, 0.20, 4), BEAK, 0.01, 0.10, lz);
      });
      return g;
    }

    /* ---- waterfowl: 0 mallard drake, 1 duck, 2 mute swan, 3 goose ----
     * 5 meshes. The group origin sits ON the water plane, so the flattened
     * body sphere is half submerged the way a real bird floats. */
    function waterBird(host, x, y, z, ry, kind){
      var g = spawn(host, x, y, z, ry);
      var B  = [aMat(0x5a5348), aMat(0x584a38), aMat(0x767470), aMat(0x6a6658)][kind];
      var H  = [aMat(0x27452e), aMat(0x584a38), aMat(0x767470), aMat(0x3a352c)][kind];
      var BK = [aMat(0x6a6a2c), aMat(0x585030), aMat(0x763a18), aMat(0x6a6a2c)][kind];
      var s = kind === 2 ? 1.65 : (kind === 3 ? 1.35 : 1.15);
      var neckH = (kind === 2 ? 0.62 : (kind === 3 ? 0.34 : 0.19)) * s;
      var nx = -0.24*s, ny = 0.12*s, tilt = 0.22;
      var hx = nx - Math.sin(tilt)*neckH, hy = ny + Math.cos(tilt)*neckH;
      pt(g, gSph(0.20, 6, 4), B, 0, 0.10*s, 0, 0, 1.50*s, 0.80*s, 0.95*s);
      pt(g, gCyl(0.05*s, 0.07*s, neckH, 5), H, (nx+hx)/2, (ny+hy)/2, 0, tilt);
      pt(g, gSph(0.085*s, 5, 4), H, hx, hy, 0);
      pt(g, gCone(0.05*s, 0.16*s, 4), BK, hx - 0.10*s, hy - 0.01, 0, Math.PI/2);
      pt(g, gBox(0.26*s, 0.10*s, 0.14*s), B, 0.30*s, 0.16*s, 0, -0.35);
      return g;
    }

    /* ---- sheep / goat (10 meshes). `graze` drops the head to the turf;
     * `goat` swaps the woolly barrel for a leaner one and adds horns. */
    var FLEECE = [aMat(0x6b675c), aMat(0x74705f), aMat(0x5d584c)];
    var FACE = aMat(0x33302a), HORN = aMat(0x6a6252);
    function sheep(host, x, y, z, ry, idx, graze, goat){
      var g = spawn(host, x, y, z, ry);
      var f = goat ? aMat(0x6a5c46) : FLEECE[idx];
      pt(g, gSph(0.34, 6, 4), f, 0, 0.54, 0, 0, 1.35, goat ? 0.82 : 0.98, goat ? 0.86 : 1.0);
      var hx = graze ? -0.52 : -0.46, hy = graze ? 0.22 : 0.66;
      pt(g, gSph(0.13, 5, 4), FACE, hx, hy, 0, 0, 1.35, 1.0, 0.90);
      pt(g, gBox(0.10, 0.09, 0.06), FACE, hx - 0.06, hy + 0.07,  0.11);
      pt(g, gBox(0.10, 0.09, 0.06), FACE, hx - 0.06, hy + 0.07, -0.11);
      if (goat){
        pt(g, gCone(0.035, 0.26, 4), HORN, hx + 0.04, hy + 0.20,  0.07, -0.5);
        pt(g, gCone(0.035, 0.26, 4), HORN, hx + 0.04, hy + 0.20, -0.07, -0.5);
        pt(g, gCone(0.05, 0.16, 4), FACE, hx - 0.02, hy - 0.14, 0, Math.PI);   // beard
      } else {
        pt(g, gSph(0.20, 5, 4), f, 0.30, 0.68, 0, 0, 1.0, 0.85, 0.95);          // shoulder wool
        pt(g, gBox(0.10, 0.16, 0.09), f, 0.44, 0.52, 0, -0.7);                  // short tail
        pt(g, gBox(0.10, 0.10, 0.09), f, -0.30, 0.70, 0);                       // poll
      }
      [[-0.24,0.16],[-0.24,-0.16],[0.24,0.16],[0.24,-0.16]].forEach(function(p){
        pt(g, gCyl(0.05, 0.055, 0.38, 5), FACE, p[0], 0.19, p[1]);
      });
      return g;
    }

    /* ---- pig (10 meshes). `scl` < 1 makes a piglet. ------------------- */
    var PIGM = [aMat(0x6f5a50), aMat(0x59473e), aMat(0x746054)];
    function pig(host, x, y, z, ry, idx, scl){
      var g = spawn(host, x, y, z, ry, scl);
      var m = PIGM[idx];
      pt(g, gSph(0.30, 6, 4), m, 0, 0.46, 0, 0, 1.62, 0.95, 1.02);
      pt(g, gBox(0.34, 0.32, 0.34), m, -0.56, 0.40, 0);
      pt(g, gCyl(0.09, 0.10, 0.13, 6), m, -0.78, 0.34, 0, Math.PI/2);
      pt(g, gBox(0.05, 0.13, 0.11), m, -0.50, 0.58,  0.12, -0.4);
      pt(g, gBox(0.05, 0.13, 0.11), m, -0.50, 0.58, -0.12, -0.4);
      [[-0.26,0.16],[-0.26,-0.16],[0.28,0.16],[0.28,-0.16]].forEach(function(p){
        pt(g, gCyl(0.06, 0.07, 0.30, 5), m, p[0], 0.15, p[1]);
      });
      return g;
    }

    /* ---- hound / watchdog (11 meshes) ------------------------------- */
    var DOGM = [aMat(0x5c4a33), aMat(0x3b332a), aMat(0x6a6153)];
    function dog(host, x, y, z, ry, idx, lying){
      var g = spawn(host, x, y, z, ry);
      var m = DOGM[idx], bY = lying ? 0.20 : 0.46;
      pt(g, gBox(0.66, 0.26, 0.24), m, 0, bY, 0);
      pt(g, gBox(0.26, 0.30, 0.26), m, -0.32, bY + 0.05, 0);
      pt(g, gBox(0.22, 0.20, 0.20), m, -0.52, bY + 0.22, 0);
      pt(g, gBox(0.17, 0.10, 0.11), m, -0.68, bY + 0.16, 0);
      [0.09, -0.09].forEach(function(ez){ pt(g, gBox(0.06, 0.13, 0.09), m, -0.50, bY + 0.36, ez); });
      if (lying){
        [[-0.22,0.14],[-0.22,-0.14],[0.22,0.14],[0.22,-0.14]].forEach(function(p){
          pt(g, gBox(0.34, 0.12, 0.11), m, p[0], 0.06, p[1]);
        });
      } else {
        [[-0.22,0.11],[-0.22,-0.11],[0.24,0.11],[0.24,-0.11]].forEach(function(p){
          pt(g, gCyl(0.045, 0.05, 0.34, 5), m, p[0], 0.17, p[1]);
        });
      }
      pt(g, gBox(0.10, 0.34, 0.08), m, 0.36, bY + 0.10, 0, -0.9);
      return g;
    }

    /* ---- cat, curled up asleep (5 meshes) --------------------------- */
    var CATM = [aMat(0x554736), aMat(0x2e2a24), aMat(0x666055)];
    function cat(host, x, y, z, ry, idx){
      var g = spawn(host, x, y, z, ry);
      var m = CATM[idx];
      pt(g, gSph(0.17, 6, 4), m, 0, 0.13, 0, 0, 1.25, 0.72, 1.05);
      pt(g, gSph(0.085, 5, 4), m, -0.16, 0.17, 0.06);
      pt(g, gCone(0.04, 0.07, 3), m, -0.20, 0.26, 0.11);
      pt(g, gCone(0.04, 0.07, 3), m, -0.13, 0.26, 0.02);
      pt(g, gCyl(0.035, 0.03, 0.44, 5), m, 0.10, 0.07, -0.15, Math.PI/2);
      return g;
    }

    /* ---- pigeon (3 meshes) ------------------------------------------ */
    var DOVEM = [aMat(0x565b64), aMat(0x6a6862), aMat(0x3f4149)];
    function pigeon(host, x, y, z, ry, idx){
      var g = spawn(host, x, y, z, ry, 1.25);
      var m = DOVEM[idx];
      pt(g, gSph(0.095, 5, 4), m, 0, 0.10, 0, 0, 1.50, 1.00, 1.00);
      pt(g, gSph(0.055, 5, 4), m, -0.12, 0.17, 0);
      pt(g, gBox(0.14, 0.05, 0.08), m, 0.16, 0.10, 0, -0.25);
      return g;
    }

    /* ---- fittings: hen house, round dovecote, post-and-rail pen ------ */
    var COOP = aMat(0x5c4a34), COOP_DK = aMat(0x43371f), HOLE = aMat(0x191712);
    function henHouse(host, x, y, z, ry){
      var g = spawn(host, x, y, z, ry);
      pt(g, gBox(1.80, 0.90, 1.30), COOP, 0, 0.65, 0);
      pt(g, gBox(1.98, 0.14, 1.46), COOP_DK, 0, 1.17, 0);
      pt(g, gBox(1.16, 0.10, 1.54), COOP_DK, -0.44, 1.42, 0,  0.62);
      pt(g, gBox(1.16, 0.10, 1.54), COOP_DK,  0.44, 1.42, 0, -0.62);
      [-0.66, 0.66].forEach(function(lx){ [-0.48, 0.48].forEach(function(lz){
        pt(g, gBox(0.12, 0.44, 0.12), COOP_DK, lx, 0.22, lz);
      });});
      pt(g, gBox(0.10, 0.36, 0.32), HOLE, -0.91, 0.62, 0.28);
      pt(g, gBox(1.20, 0.07, 0.44), COOP_DK, -1.46, 0.27, 0.28, 0.42);
      return g;
    }
    /* A round rubble-built dovecote with a conical slate cap and a lantern
     * -- the standard free-standing form in Wales and the Marches, and the
     * shape that reads instantly from directly above (the courtyard is
     * usually seen from the air in this viewer). */
    function dovecote(host, x, y, z){
      var g = spawn(host, x, y, z, 0);
      pt(g, gCyl(1.05, 1.20, 3.10, 12), paleMat, 0, 1.55, 0);
      pt(g, gCyl(1.24, 1.24, 0.16, 12), aMat(0x53504a), 0, 1.30, 0);   // string course
      pt(g, gBox(0.55, 0.90, 0.10), HOLE, 0, 0.65, 1.16);              // doorway
      // three tiers of nest holes on the sunny (south / +Z) half
      for (var t = 0; t < 3; t++){
        for (var k = -2; k <= 2; k++){
          var a = k * 0.42;
          pt(g, gBox(0.16, 0.16, 0.10), HOLE,
             Math.sin(a) * 1.10, 1.85 + t * 0.52, Math.cos(a) * 1.10);
        }
      }
      var cap = pt(g, gCone(1.42, 1.15, 12), aMat(RANGE_ROOF_COL), 0, 3.68, 0);
      cap.receiveShadow = true;
      pt(g, gCyl(0.34, 0.34, 0.46, 8), paleMat, 0, 4.45, 0);           // lantern (birds' entry)
      pt(g, gCone(0.48, 0.36, 8), aMat(RANGE_ROOF_COL), 0, 4.86, 0);
      return g;
    }
    // post-and-rail enclosure, `open` = index of the side left as a gate
    function pen(host, cx, cz, w, d, open){
      var g = spawn(host, cx, 0, cz, 0);
      var RAIL = aMat(0x51422e);
      function run(len, px, pz, along){        // along: 0 = x, 1 = z
        var n = Math.max(2, Math.round(len / 1.2));
        for (var i = 0; i <= n; i++){
          var t = -len/2 + len*i/n;
          pt(g, gCyl(0.07, 0.08, 0.98, 5), RAIL, px + (along ? 0 : t), 0.49, pz + (along ? t : 0));
        }
        [0.38, 0.76].forEach(function(railY){
          pt(g, along ? gBox(0.07, 0.07, len) : gBox(len, 0.07, 0.07), RAIL, px, railY, pz);
        });
      }
      if (open !== 0) run(w, 0, -d/2, 0);
      if (open !== 1) run(w, 0,  d/2, 0);
      if (open !== 2) run(d, -w/2, 0, 1);
      if (open !== 3) run(d,  w/2, 0, 1);
      return g;
    }

    /* =============== WEST RANGE: the stable ========================== *
     * The three loose-boxes at stallZ = -19.3 / -17.0 / -14.7 already had
     * two horses in them (built above); the middle box was left empty so
     * the boxes would read AS boxes. It is filled here, a fourth horse
     * stands in the aisle east of the head posts (x -18.6..-16.0, so the
     * animal runs along Z and clears both the posts and the range wall),
     * and a foal stands beside the mare in the north box. */
    horse(interiorGroup, -21.40, FY, -17.00, 0, 2, 1);            // 葦毛、飼葉桶に首を伸ばす
    horse(interiorGroup, -17.30, FY, -18.00, Math.PI/2, 3, 0);    // 青毛、通路に立つ
    horse(interiorGroup, -19.50, FY, -19.90, 0.28, 1, 2, 0.62);   // 仔馬、母馬のかたわらで草を食む
    cat(interiorGroup, -17.60, FY + 0.90, -8.20, 0.9, 0);         // 馬具庫の飼葉箱の上、鼠捕りの猫
    dog(interiorGroup, -11.20, 0, -13.60, 1.20, 0, false);        // 厩舎の戸口の番犬
    cat(interiorGroup, -21.40, FY, 9.40, -0.6, 1);                // 厨房の炉端の猫

    /* =============== INNER WARD, EAST STRIP: the farmyard ============ */
    dovecote(interiorGroup, 13.60, 0, -17.60);
    // the cote's own flock -- two on the string course, three on the turf
    pigeon(interiorGroup, 12.55, 1.38, -16.95,  1.60, 0);
    pigeon(interiorGroup, 14.55, 1.38, -18.30, -1.30, 1);
    pigeon(interiorGroup, 12.10, 0.00, -19.40,  0.60, 0);
    pigeon(interiorGroup, 14.80, 0.00, -19.90, -0.90, 2);
    pigeon(interiorGroup, 13.20, 0.00, -15.40,  2.40, 1);

    // holding pen: three sheep and a nanny goat, between the two orchard
    // trees at z = -10.0 and z = -3.0 (their canopies stop at -8.45 / -4.45)
    pen(interiorGroup, 13.50, -6.40, 3.30, 3.55, 2);
    var crib = spawn(interiorGroup, 12.75, 0, -7.55, 0.3);                          // hay crib
    pt(crib, gBox(1.30, 0.55, 0.70), aMat(0x51422e), 0, 0.30, 0);
    pt(crib, gBox(1.16, 0.22, 0.58), strawMat, 0, 0.66, 0);
    sheep(interiorGroup, 13.05, 0, -5.55,  1.90, 0, true,  false);
    sheep(interiorGroup, 14.25, 0, -6.40, -1.20, 1, false, false);
    sheep(interiorGroup, 13.30, 0, -7.10,  2.70, 2, true,  false);
    sheep(interiorGroup, 14.35, 0, -5.10, -2.40, 0, false, true);   // 山羊

    // pig sty: a boarded shelter and a sow with piglets
    pen(interiorGroup, 13.50, 0.70, 3.10, 3.45, 2);
    var styRoof = spawn(interiorGroup, 14.20, 0, 1.55, 0);                          // boarded shelter
    pt(styRoof, gBox(1.55, 0.95, 1.70), COOP, 0, 0.48, 0);
    pt(styRoof, gBox(1.75, 0.16, 1.90), COOP_DK, 0, 1.02, 0);
    pig(interiorGroup, 13.00, 0,  0.10,  1.70, 0, 1.0);
    pig(interiorGroup, 13.60, 0,  1.80, -1.40, 2, 0.92);
    pig(interiorGroup, 12.65, 0,  1.35,  2.30, 1, 0.52);
    pig(interiorGroup, 13.15, 0,  1.95, -2.60, 0, 0.48);
    pig(interiorGroup, 12.80, 0, -0.60,  0.70, 1, 0.50);

    // hen house at the south end of the strip, clear of the last orchard
    // tree (canopy stops at z = 13.3)
    henHouse(interiorGroup, 13.40, 0, 17.00, 0.10);
    [[12.20, 15.60, 0], [14.55, 16.10, 1], [12.40, 19.20, 2], [14.20, 20.10, 0]].forEach(function(p){
      var r = h01(p[0], p[1], 5);
      fowl(interiorGroup, p[0], 0, p[1], r*6.283, p[2], r > 0.44, false);
    });
    fowl(interiorGroup, 14.45, 0, 18.70, -2.10, 0, false, true);      // 雄鶏
    dog(interiorGroup, 12.60, 0, -12.90, 0.40, 1, true);              // 中庭の犬

    /* =============== KITCHEN / HERB GARDEN: loose hens =============== *
     * The clear strip between the kitchen-garden beds (which end at
     * z = 1.5) and the herb garden's north hedge (which starts at 4.2),
     * plus the service yard by the south gate. Both are west of
     * life.courtyard's minX (GARD_X1+0.8 = -5.4), so no resident path
     * crosses them. */
    [[ -8.80, 2.90, 0], [-11.20, 3.40, 1], [-13.20, 2.70, 2],
     [ -9.60, 15.40, 1], [-6.60, 17.20, 0], [-11.90, 17.60, 0]].forEach(function(p){
      var r = h01(p[0], p[1], 9);
      fowl(interiorGroup, p[0], 0, p[1], r*6.283, p[2], r > 0.40, false);
    });

    /* =============== THE MOAT ======================================== *
     * The graded banks eat bankWidthIn (2.2) inside and bankWidthOut (2.6)
     * outside, so the open water on the north face runs z = -51.9..-61.1.
     * Birds keep to the middle of that band and clear the north causeway
     * (|x| < 2.5). */
    /* B-3 で堀の水面が実際に上下するようになったので、浮いている鳥は板の
     * 上に置きっぱなしにできない(波の谷で宙に浮き、峰では体が沈む)。
     * 生成したグループを moatBirds に控えておき、毎フレーム頂点シェーダと
     * 同じ式で y を引き直す。ドックの水面は平らなままなので対象外。 */
    [[14.00, -55.50, 0.50], [17.50, -57.00, 2.30], [11.50, -57.60, -1.10]]
      .forEach(function(p){ moatBirds.push({ g: waterBird(group, p[0], WATER_Y, p[1], p[2], 2), y0: WATER_Y }); });   // 白鳥
    [[-15.00, -55.00,  1.20, 1], [-18.50, -56.80, -0.40, 0], [-12.00, -57.60, 2.60, 1],
     [ 57.00,   8.00,  0.90, 0], [ 58.50,  -5.00, -1.60, 1]]
      .forEach(function(p){ moatBirds.push({ g: waterBird(group, p[0], WATER_Y, p[1], p[2], p[3]), y0: WATER_Y }); }); // 鴨

    /* =============== THE TIDAL DOCK ================================== *
     * dockG is the whole dock, shifted DOCK_X west, so these are LOCAL
     * coordinates like every other mesh inside it. The basin water sits at
     * GROUND_Y+0.11 (see the dock note above -- it is drawn above the
     * ground collar, not at the moat's level). Kept clear of the jetty
     * (local x -11.5..-0.5, z 74.5..77.9) and the moored vessel. */
    var DOCK_SURF = GROUND_Y + 0.11;
    [[5.50, 70.50,  0.60, 3], [7.00, 72.20, -1.40, 3], [4.20, 73.60, 2.10, 3]]
      .forEach(function(p){ waterBird(dockG, p[0], DOCK_SURF, p[1], p[2], p[3]); });  // 鵞鳥
    [[3.00, 85.60,  1.10, 0], [5.20, 86.60, -0.70, 1], [7.20, 84.40, 2.40, 0],
     [-5.00, 86.20, 0.30, 1], [-7.60, 85.00, -2.20, 0], [8.20, 68.60, 1.70, 1]]
      .forEach(function(p){ waterBird(dockG, p[0], DOCK_SURF, p[1], p[2], p[3]); });  // 鴨

    /* ---- tooltips. Animal volumes are smaller than the room volumes
     * they sit inside and the raycast takes the nearest hit, so hovering a
     * horse gives the horse while the boards either side still give 厩舎. */
    registerPick(pickables, 'room', -20.20, FY + 1.30, -17.20, 6.4, 2.6, 6.6,
      '馬 Horses', '西棟の馬房につながれた乗馬と仔馬。ボーマリスの守備隊は馬を常備し、馬は城で最も高価な資産のひとつだった(頭数・品種は推定)。');
    registerPick(pickables, 'room', 13.60, 2.20, -17.60, 2.8, 4.4, 2.8,
      '鳩小屋 Dovecote', '円形の石造鳩小屋(推定)。中世の鳩小屋は冬場の生肉と卵、そして畑の肥料になる糞を供給し、その保有は領主・王権の特権だった。');
    registerPick(pickables, 'room', 13.50, 0.90, -6.40, 3.6, 1.8, 3.8,
      '家畜囲い Livestock Pen', '羊と山羊を入れた柵囲い(推定)。羊毛・乳・肉に加え、羊皮紙の材料も城内でまかなえた。');
    registerPick(pickables, 'room', 13.50, 0.85, 0.70, 3.4, 1.7, 3.7,
      '豚小屋 Pig Sty', '豚小屋(推定)。豚は残飯で育ち、秋に屠って塩漬け・燻製にすることで冬の蛋白源になった。');
    registerPick(pickables, 'room', 13.40, 0.95, 17.00, 2.6, 2.0, 2.2,
      '鶏小屋 Hen House', '中庭東辺の鶏小屋(推定)。卵と鶏肉は城の日常食で、家禽の世話は下働きの女性たちの仕事だった。');
    registerPick(pickables, 'structure', 14.30, WATER_Y + 0.80, -56.70, 9.0, 2.0, 5.0,
      '白鳥 Swans', '堀に浮かぶ白鳥。中世イングランド・ウェールズでは白鳥は国王の鳥とされ、飼育には特許が必要な身分の標識だった。');
    registerPick(pickables, 'structure', DOCK_X + 5.5, GROUND_Y + 0.80, 71.60, 7.0, 1.8, 5.0,
      '水鳥 Waterfowl', '潮汐ドックの水面に集まる鵞鳥と鴨。城の家禽は堀やドックの水辺に放たれ、番犬がわりに人の出入りを騒いで知らせもした。');
  })();

  /* ================================================================ *
   * B-0. 毎フレーム更新のディスパッチ(時計メッシュ)
   * ================================================================ *
   * メインループ(js/90-main.js)には手を入れられないので、更新は
   * mesh.onBeforeRender に載せる。ただし three は「visible=false /
   * 視錐台の外」のオブジェクトには onBeforeRender を呼ばないので、
   * 煙のスプライトを個別に消すと二度と復活できない。
   * → frustumCulled=false の極小メッシュを1つだけ「時計」として置き、
   *   そこから煙・吹き流し・水面をまとめて更新する(追加 drawCall は1)。
   * ================================================================ */
  (function(){
    /* 頂点が3つとも原点に重なった退化三角形。面積0なので1画素も塗らない
     * が、renderObject は呼ばれるので onBeforeRender が必ず走る。
     * transparent にしないのが肝心: three は不透明キューを先に描くので、
     * renderOrder -1000 と合わせて「このフレームで最初に呼ばれる」ことが
     * 保証され、吹き流し(不透明メッシュ)も同じフレーム内で更新後に
     * 描かれる。 */
    var tick = new T.Mesh(new T.BufferGeometry(),
      new T.MeshBasicMaterial({ depthWrite:false, depthTest:false }));
    tick.geometry.setAttribute('position', new T.BufferAttribute(new Float32Array(9), 3));
    tick.frustumCulled = false;
    tick.renderOrder = -1000;
    tick.onBeforeRender = function(){
      var t = nowSec(), e = envState();
      for (var i=0;i<ANIM.length;i++) ANIM[i](t, e);
    };
    group.add(tick);
  })();

  /* ================================================================ *
   * B-1. 煙突の煙
   * ================================================================ *
   * 煙を出せる炉はこの城では3つある。いずれも既にモデル上に炉と煙突が
   * あるものだけで、煙のために煙突を足してはいない:
   *   西棟南ブロック 大炉      chimneyZ = 10.5  (buildRange(-1, ...) 参照)
   *   西棟南ブロック パン窯    chimneyZ = 17.0
   *   東棟北ブロック 暖炉      chimneyZ = -17.5
   * 煙突は mkBox(1.0, 3.6, 1.0) を y = RANGE_HIGH-0.7 に置いてあるので、
   * 天端は RANGE_HIGH-0.7+1.8 = 10.8m。煙はそのすぐ上から立てる。
   * 煙突は rangeShell(内郭タイア、roof:true)に属するので、カットアウェイ
   * で棟が消えるときは煙も一緒に消す(fg 引数がその判定を持つ)。
   * スプライト1枚 = 1 drawCall なので、煙突あたり5枚に抑える。
   * ================================================================ */
  var WIND = { x: 0.80, z: 0.60 };     // 南西からの緩い風(単位ベクトルでなくてよい)
  function smokePlume(fg, x, y0, z, opt){
    opt = opt || {};
    var n     = opt.count != null ? opt.count : 5;
    var rise  = opt.rise  != null ? opt.rise  : 12.0;
    var speed = opt.speed != null ? opt.speed : 0.13;   // 1秒あたりの寿命進行
    var base  = opt.base  != null ? opt.base  : 0.55;   // 濃さの基準
    var g = new T.Group();
    g.position.set(x, y0, z);
    (fg ? fg.group : group).add(g);
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
      // 量: 昼 0.82 / 夜 1.00、雨雪で増える
      var amt = Math.min(1.0, 0.82 + e.glow*0.18 + e.rain*0.16 + e.snow*0.12);
      var wind = 1 + e.rain*0.9 + e.snow*0.35;
      var op0 = base * amt * (fg ? fg.op : 1);
      // 昼 0x757068(空より暗い) -> 夜 0xb4afa5(淡い)
      var cr = 0.395 + (0.706-0.395)*e.glow;
      var cg = 0.377 + (0.686-0.377)*e.glow;
      var cb = 0.349 + (0.647-0.349)*e.glow;
      // 棟がフェードで消えているあいだは煙も消す(煙突ごと消えるので)
      if (fg && (!fg.group.visible || fg.op < 0.15)) op0 = 0;
      for (var i=0;i<puffs.length;i++){
        var p = puffs[i];
        var k = (t*speed + p.ph) % 1;                    // 0..1 の寿命
        var op = op0 * Math.min(1, k*5) * Math.pow(1-k, 1.30);
        if (op < 0.012){ p.s.visible = false; continue; }
        var drift = wind * (0.20 + 1.6*k*k);
        var climb = Math.pow(k, 1.35);          // 根元は詰まり、上ほど間隔が開く
        p.s.position.set(
          Math.sin(t*0.55 + p.ph*6.28)*0.30*k + WIND.x*drift,
          climb*rise,
          Math.cos(t*0.41 + p.ph*5.13)*0.30*k + WIND.z*drift
        );
        var sc = 1.45 + k*5.0;                  // 隣の粒と必ず重なる大きさ
        p.s.scale.set(sc, sc, 1);
        p.s.material.opacity = op;
        p.s.material.color.setRGB(cr, cg, cb);
        p.s.visible = true;
      }
    });
    return g;
  }
  var CHIMNEY_TOP = RANGE_HIGH - 0.7 + 1.8 + 0.1;      // = 10.9m
  var CHIMNEY_X   = INNER_IN_HX - 1.5;                 // = 23.1m(buildRange と同じ式)
  /* base は「1粒の最大不透明度」ではなく寿命全体の基準値で、実際の峰は
   * base * 0.82(昼) * 0.5 前後。最初 0.50/0.40/0.34 で焼いたところ厨房の
   * 峰が 0.29 しかなく、昼の明るい空を背に **ほぼ見えなかった**(実測)。
   * 1.35 倍して、昼でも細く立ちのぼるのが分かるところまで上げてある。 */
  smokePlume(rangeShell, -CHIMNEY_X, CHIMNEY_TOP, 10.5,  { base:0.68, rise:16, speed:0.104, count:6 }); // 厨房の大炉
  smokePlume(rangeShell, -CHIMNEY_X, CHIMNEY_TOP, 17.0,  { base:0.52, rise:14, speed:0.121, count:5 }); // パン焼き窯
  smokePlume(rangeShell,  CHIMNEY_X, CHIMNEY_TOP, -17.5, { base:0.44, rise:13, speed:0.113, count:5 }); // 東棟の暖炉

  /* ================================================================ *
   * B-3. 水面 -- 空を映す水(フレネル反射 + 3スケールのさざ波)
   * ================================================================ *
   * castles/bodiam.js の moatWater(完成形の参考実装)からの移植。
   * 考え方は同じで、この城の事情に合わせて 3 点だけ作り直してある。
   *
   *  1. 水面の見えは拡散反射でも鏡面ローブでもなく **空の鏡像** が本体
   *     で、どれだけ映るかは視線の入射角(フレネル)だけで決まる。
   *     → Phong の鏡面を殺し(specularStrength = 0)、Schlick フレネル
   *       F0 = 0.02(水の正しい値)で空の色を混ぜる。
   *  2. 映す空は 11-environment.js と同じ 6 段グラデーション。
   *     scene.background は画面空間のグラデーションなので、反射ベクトル
   *     を **カメラに投影して画面 v 座標を出し**、その位置の色を引く。
   *     水平線で空と水の色が必ず繋がる。
   *  3. さざ波は 3 スケールの法線マップを非通約な周期・別方向・別速度で
   *     スクロールして加算。加えて頂点シェーダで方向波を実際に上下させ、
   *     その高さのラプラシアン(= 峰で正・谷で負)を焦線(コースティクス)
   *     として明暗に掛ける。真上から見ても「波の筋」が読めるのはこの項。
   *
   * ─── ボディアムから作り直した3点 ───────────────────
   *  (a) 堀が **八角形の環** である。ボディアムの岸判定は
   *      max(|x|,|z|) の正方形距離だったので使えない。この城の八角形は
   *        { |x| <= hx, |z| <= hz, |x|+|z| <= hx+hz-ch }
   *      という3本の不等式の共通部分で、外側へ d だけ平行移動すると
   *      hx+d / hz+d / (hx+hz-ch)+d*sqrt2 になる(octOff と同じ性質)。
   *      よって符号つき距離は
   *        f(p) = max( |x|-hx, |z|-hz, (|x|+|z|-K)/sqrt2 ),  K = hx+hz-ch
   *      で厳密に出る。これを内側/外側の汀線に対して1回ずつ評価すれば、
   *      岸フェードも波打ち際の泡も八角形に沿う。
   *  (b) 水面板が ShapeGeometry(三角形数枚)のままでは頂点変位ができ
   *      ないので、八角形の環を **周方向 x 横断方向の格子** に張り替える。
   *      両八角形の頂点が来る t(弧長比)を必ずサンプル列に含めるので、
   *      角が丸く落ちることはない。
   *  (c) 波の振幅はボディアムの半分ほどに落とした(0.130/0.070/0.036 →
   *      0.075/0.042/0.022)。ここは幅 9m ほどの浅い潮汐堀で、外海の
   *      うねりは入って来ない。水鳥が波の谷で宙に浮かないためでもある。
   *
   * 【共有ファイルとの共存】
   * 11-environment.js は毎フレーム waterMat.color / .specular を時間帯色で
   * 上書きする。ここが触るのは normalMap / onBeforeCompile の自前ユニ
   * フォームと shininess だけなので競合しない。水の「地の色」(= 水中の
   * 色)は今までどおり CUR_TIME.waterColor が決める。
   * 共有ヘルパー(01-moat.js / 11-environment.js)は一切変更していない。
   * 空の彩度落としは paintSky と同じ式をこの中にローカルコピーした。
   * ================================================================ */
  (function water(){
    var n1 = TEX.waterN1, n2 = TEX.waterN2, n3 = TEX.waterN3;
    /* vUv をメートル座標そのものに固定する。堀の格子も、ドックの板も、
     * uv = (worldX, -worldZ) を自分で書いてある。repeat=1 / offset=0 に
     * しておけば uvTransform は単位行列になり、vUv がそのままメートル座標
     * として使える(スクロールは全部シェーダ側の自前ユニフォーム)。
     * r128 は map が無い場合 normalMap の matrix を uvTransform に流すので、
     * ここを動かすと 3 枚とも一緒に動いてしまう -- だから offset は使わない。 */
    n1.repeat.set(1, 1); n1.offset.set(0, 0);

    /* ---- 2つの水面で共有するユニフォーム(同じ JS オブジェクトを両方の
     * プログラムに挿すので、更新は1回で済む) ------------------------- */
    var uSky    = { value: [ new T.Vector3(), new T.Vector3(), new T.Vector3(),
                             new T.Vector3(), new T.Vector3(), new T.Vector3() ] };
    var uSunCol = { value: new T.Vector3(0, 0, 0) };
    var uSunDirV= { value: new T.Vector3(0, 1, 0) };
    var uProjY  = { value: 2.6 };
    var uFog    = { value: new T.Vector3(0, 0, 0) };

    /* ---- 八角形の符号つき距離。o = (hx, hz, K) ----------------------- */
    var OCT_D_GLSL =
      'float wOctD( vec2 p, vec3 o ){ vec2 a = abs( p );\n' +
      '  return max( max( a.x - o.x, a.y - o.y ), ( a.x + a.y - o.z ) * 0.70710678 ); }';
    function octVec(o){ return new T.Vector3(o.hx, o.hz, o.hx + o.hz - o.ch); }
    function octDJS(x, z, v){
      var ax = Math.abs(x), az = Math.abs(z);
      return Math.max(Math.max(ax - v.x, az - v.y), (ax + az - v.z) * 0.70710678);
    }

    /* ================================================================ *
     * 水面シェーダの組み立て(堀と海で共用)
     * ================================================================ *
     * C.waves が配列なら頂点変位 + コースティクスまで入る(堀)。
     * null なら法線マップとフレネル反射だけ(ドック: 板が箱なので頂点が
     * 4隅しかなく、変位させる先がない)。
     * 差し替え対象のチャンク名は three のバージョンに依存する。全部
     * 見つかったときだけ差し込む -- 1つでも欠けた状態で残りを入れると
     * 未定義の変数を参照する GLSL になり、水面が真っ黒 + コンソール
     * エラーになる(ボディアムの前任者が踏んだ罠をそのまま踏襲)。
     * ---------------------------------------------------------------- */
    function buildWater(mat, C){
      mat.normalMap = n1;                        // USE_NORMALMAP と vUv を有効にするため
      mat.normalScale = new T.Vector2(1, 1);     // 自前で法線を組むので未使用
      mat.shininess = 1;                         // 鏡面はシェーダ側で完全に殺す

      var uOff1 = { value: new T.Vector2(0, 0) };
      var uOff2 = { value: new T.Vector2(0, 0) };
      var uOff3 = { value: new T.Vector2(0, 0) };
      var uAmp  = { value: 1.0 };
      var uTime = { value: 0 };
      var uOctIn  = { value: C.octIn  || new T.Vector3(1e9, 1e9, 1e9) };
      var uOctOut = { value: C.octOut || new T.Vector3(1e9, 1e9, 1e9) };

      var W_CAUS_NORM = 1, i;
      if (C.waves){
        W_CAUS_NORM = 0;
        for (i = 0; i < C.waves.length; i++){
          var kk = 2 * Math.PI / C.waves[i].lam;
          W_CAUS_NORM += C.waves[i].amp * kk * kk;
        }
      }
      /* GLSL は JS のテーブルから組み立てる。数値を2か所に書くと必ず
       * ずれるので、波の定義は C.waves だけが持つ(水鳥の上下も同じ
       * 配列から計算する)。 */
      function waveGLSL(px, pz){
        var out = [];
        for (var i = 0; i < C.waves.length; i++){
          var w = C.waves[i], k = 2 * Math.PI / w.lam, om = k * w.spd;
          out.push(
            '  { float wp = ' + (w.dx * k).toFixed(6) + ' * ' + px + ' + ' +
                                (w.dz * k).toFixed(6) + ' * ' + pz + ' - ' +
                                om.toFixed(6) + ' * uWTime;',
            '    float ws = sin( wp );',
            '    wWH += ' + w.amp.toFixed(4) + ' * ws;',
            '    wWC += ' + (w.amp * k * k).toFixed(6) + ' * ws;',
            '    wWG += ( ' + (w.amp * k).toFixed(6) + ' * cos( wp ) ) * vec2( ' +
                              w.dx.toFixed(4) + ', ' + w.dz.toFixed(4) + ' ); }'
          );
        }
        return out;
      }

      mat.onBeforeCompile = function(sh){
        var SPM = '#include <specularmap_fragment>',
            NFM = '#include <normal_fragment_maps>',
            FOG = '#include <fog_fragment>',
            BGV = '#include <begin_vertex>';
        var fs = sh.fragmentShader, vs = sh.vertexShader;
        if (fs.indexOf(SPM) < 0 || fs.indexOf(NFM) < 0 || fs.indexOf(FOG) < 0) return;
        if (C.waves && vs.indexOf(BGV) < 0) return;   // 頂点変位と varying は対で入れる

        sh.uniforms.uWN2 = { value: n2 };  sh.uniforms.uWN3 = { value: n3 };
        sh.uniforms.uWOff1 = uOff1; sh.uniforms.uWOff2 = uOff2; sh.uniforms.uWOff3 = uOff3;
        sh.uniforms.uWSky = uSky;         sh.uniforms.uWSunCol = uSunCol;
        sh.uniforms.uWSunDirV = uSunDirV; sh.uniforms.uWProjY = uProjY;
        sh.uniforms.uWFog = uFog;         sh.uniforms.uWAmp = uAmp;
        sh.uniforms.uWTime = uTime;
        sh.uniforms.uWOctIn = uOctIn;     sh.uniforms.uWOctOut = uOctOut;

        /* --- 頂点シェーダ: 実際に水面を上下させる(堀のみ) -----------
         * transformed は begin_vertex が position から作ったオブジェクト
         * 座標。この板は回転しておらず位置 y だけずらしてあるので
         * transformed.xz はそのままワールド xz。vViewPosition は
         * project_vertex が transformed から作るので、変位はそのあとの
         * 反射・フレネル計算にも正しく効く。
         * 傾きは sin の微分そのもの。法線マップと同じ約束
         * ( wS.x -> Nworld.x, -wS.y -> Nworld.z )に合わせて渡すため、
         *   N は ( -dH/dx, 1, -dH/dz ) に比例 -> vWWave = ( -dH/dx, +dH/dz ) */
        if (C.waves){
          vs = [
            'uniform float uWTime;',
            'uniform float uWAmp;',
            'uniform vec3 uWOctIn;',
            'uniform vec3 uWOctOut;',
            'varying vec3 vWWave;',
            OCT_D_GLSL
          ].join('\n') + '\n' + vs;
          vs = vs.replace(BGV, [
            BGV,
            '  float wWfi =  wOctD( transformed.xz, uWOctIn );',   // 内側の汀線からの距離
            '  float wWfo = -wOctD( transformed.xz, uWOctOut );',  // 外側の汀線からの距離
            '  float wWs = clamp( min( wWfi, wWfo ) / ' + C.fade.toFixed(2) + ', 0.0, 1.0 );',
            '  wWs = wWs * wWs * ( 3.0 - 2.0 * wWs );',            // 岸で振幅ゼロ
            '  float wWA = wWs * ( 0.62 + 0.38 * uWAmp );',        // 雨で少し高くなる
            '  float wWH = 0.0, wWC = 0.0; vec2 wWG = vec2( 0.0 );'
          ].concat(waveGLSL('transformed.x', 'transformed.z')).concat([
            '  transformed.y += wWH * wWA;',
            '  vWWave = vec3( -wWG.x, wWG.y, wWC * ' + (1 / W_CAUS_NORM).toFixed(4) + ' ) * wWA;'
          ]).join('\n'));
          sh.vertexShader = vs;
        }

        /* --- 前置き: ユニフォーム宣言と空グラデーションの評価関数 -------
         * uWSky/ストップ位置は 11-environment.js の SKY_STOPS_POS と同じ
         * [0, .30, .52, .68, .84, 1]。clamp した線形ランプを mix で連鎖
         * させると区分線形グラデーションと厳密に一致する。canvas の線形
         * 補間と同じ数値になるので、水平線で空と水の色が一致する。
         * viewMatrix / cameraPosition は three が fragment prefix で宣言
         * 済みなので、ここで再宣言してはならない。 */
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
          'uniform vec3 uWFog;',
          'uniform vec3 uWOctIn;',
          'uniform vec3 uWOctOut;',
          (C.waves ? 'varying vec3 vWWave;' : ''),
          OCT_D_GLSL,
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

        /* 2) 法線: 3スケールの接空間法線を足して、平面(y up)であることを
         * 使って直接ワールド法線を組む。perturbNormal2Arb は画面空間微分
         * から TBN を推定する近似で、3枚を別スケールで混ぜると精度が落ちる
         * うえに水面は完全な水平面なので推定する必要がない。
         *   uv.x = worldX, uv.y = -worldZ なので
         *   T = +X, B = -Z, N = +Y  ->  Nworld = ( s.x, 1, -s.y ) */
        fs = fs.replace(NFM, [
          '  vec2 wS  = ( texture2D( normalMap, vUv * ' + C.uv1.toFixed(5) + ' + uWOff1 ).xy * 2.0 - 1.0 ) * ' + C.w1.toFixed(2) + ';',
          '  wS      += ( texture2D( uWN2,      vUv * ' + C.uv2.toFixed(5) + ' + uWOff2 ).xy * 2.0 - 1.0 ) * ' + C.w2.toFixed(2) + ';',
          '  wS      += ( texture2D( uWN3,      vUv * ' + C.uv3.toFixed(5) + ' + uWOff3 ).xy * 2.0 - 1.0 ) * ' + C.w3.toFixed(2) + ';',
          '  wS *= uWAmp;',
          (C.waves ? '  wS += vWWave.xy;' : ''),
          '  vec3 wNW = normalize( vec3( wS.x, 1.0, -wS.y ) );',
          '  normal = normalize( mat3( viewMatrix ) * wNW );'
        ].join('\n'));

        /* 3) 合成。fog の直前なので gl_FragColor には拡散光だけが入って
         * いる(= 水中の色。時間帯で変わる CUR_TIME.waterColor 由来)。
         *   ・反射ベクトルをカメラに投影して画面 v を出し、同じ空の
         *     グラデーションを引く(screen-space の空の厳密な鏡像)。
         *   ・太陽は「空側のディスク」として反射経由でだけ入れる。
         *   ・岸辺は薄い泡/濡れ。
         * fog はこの後に掛かるので、遠くの水面は空・山と同じ霧色へ沈む。*/
        fs = fs.replace(FOG, [
          '  vec3  wUp  = normalize( mat3( viewMatrix )[ 1 ] );',   // ワールド +Y のビュー空間での向き
          '  vec3  wV   = normalize( vViewPosition );',
          '  float wNdv = clamp( dot( normal, wV ), 0.0, 1.0 );',
          /* 濁った水の「見かけの深さ」。視線側に傾いた波面は水中を通る
           * 距離が短くなるので明るく、逆に傾けば暗く見える。平らな面では
           * 差が 0 になるよう、同じ視線に対する「傾いていない場合の N・V」
           * との差だけを使う(視点に依らない)。 */
          '  float wFlt = clamp( dot( wUp, wV ), 0.0, 1.0 );',
          '  gl_FragColor.rgb *= 1.0 + clamp( ( wNdv - wFlt ) * 6.0, -0.30, 0.30 );',
          /* 濁り。11-environment.js が全城共通で書き込む CUR_TIME.waterColor
           * (昼 0x2c4854)は澄んだ青緑で、そのままだと「泥の多い潮汐堀」が
           * 熱帯のラグーンの色になる。共有ファイルは触れないので、水中の色を
           * ここで落とす。時間帯による色の動きはそのまま生きる。 */
          '  gl_FragColor.rgb *= ' + C.murk.toFixed(3) + ';',
          /* 焦線(コースティクス)。上の屈折項は真上から見ると必ず暗く
           * なる方向にしか動かないので、それだけでは峰が明るくならず波に
           * 見えない。水面を通った光は峰の下で収束し谷の下で発散する。
           * その強さは高さのラプラシアンに比例し、正弦波なら
           *   -Laplacian(h) = Σ A k^2 sin(位相) = 峰で正・谷で負。
           * 頂点側で解析的に出して渡してあるので、ここは掛けるだけ。 */
          (C.waves ? '  gl_FragColor.rgb *= 1.0 + ' + C.caus.toFixed(3) + ' * vWWave.z;' : ''),
          '  vec3  wR   = reflect( -wV, normal );',
          '  float wP   = clamp( 0.5 - 0.5 * ( uWProjY * wR.y / max( -wR.z, 1e-3 ) ), 0.0, 1.0 );',
          '  float wF   = 0.02 + 0.98 * pow( 1.0 - wNdv, 5.0 );',
          '  float wSd  = max( dot( wR, uWSunDirV ), 0.0 );',
          /* 反射光路のかすみ。反射ベクトルが水平に近いほど、その光は地平線
           * まで長い大気を通って来たことになるので霧色へ寄る。これを入れる
           * までは「浅い角度で水が暗い」絵になっていた -- この空は
           * scene.background = 画面空間グラデーションなので、地平線のすぐ
           * 上に出ているのは sky[0]〜sky[1] で、夕焼け色の sky[3..5] は
           * 画面下端 = 地面の裏に隠れている。実際に画面で地平線の帯を
           * 作っているのは fogColor のほうなので、そこへ寄せて初めて
           * 水平線で色が繋がる。 */
          '  float wRy  = dot( wR, wUp );',
          '  float wHz  = ( 1.0 - clamp( wRy * 4.0, 0.0, 1.0 ) ) * ' + C.haze.toFixed(2) + ';',
          /* 太陽は「空側に置いた円板」で、専用の specular 項ではない。
           * 芯 pow(sd,160) + 裾 pow(sd,16)。芯を 1 より十分明るくして
           * おかないと、このあと F を掛けた時点でただの薄い染みになる。
           * 上限は clamp で押さえて白飛びを防ぐ。 */
          '  vec3  wGl  = min( uWSunCol * ' + C.glint.toFixed(2) + ' * ( pow( wSd, 160.0 ) + 0.30 * pow( wSd, 16.0 ) ), vec3( 0.95 ) );',
          '  vec3  wRef = mix( wSkyAt( wP ) * ' + C.skyGain.toFixed(2) + ', uWFog, wHz ) + wGl;',
          '  gl_FragColor.rgb = mix( gl_FragColor.rgb, wRef, wF );',
          /* 真上寄りの視点では wF が 0.02 まで落ちるので、上の mix では
           * きらめきが 1/50 に潰れて一切見えない。太陽を映す向きに立った
           * 波面だけが光る項なので、フレネルの外側にも一定割合を足す。 */
          '  gl_FragColor.rgb += wGl * ( ' + C.spark.toFixed(2) + ' * ( 1.0 - wF ) );',
          /* 波打ち際。八角形の内外の汀線から 1.5m を泡/濡れの帯にする。 */
          (C.foam > 0 ?
          '  float wFi = wOctD( vec2( vUv.x, -vUv.y ), uWOctIn );\n' +
          '  float wFo = -wOctD( vec2( vUv.x, -vUv.y ), uWOctOut );\n' +
          '  float wEg = 1.0 - clamp( min( wFi, wFo ) / 1.1, 0.0, 1.0 );\n' +
          '  float wFn = texture2D( uWN3, vUv * 0.31 + uWOff3 * 1.7 ).x;\n' +
          '  float wFm = ' + C.foam.toFixed(2) + ' * wEg * wEg * clamp( wFn * 1.9 - 0.62, 0.0, 1.0 );\n' +
          '  gl_FragColor.rgb = mix( gl_FragColor.rgb, wSkyAt( 0.92 ) * 0.60, wFm );\n' +
          '  gl_FragColor.a = clamp( gl_FragColor.a + wF * 0.20 + wFm * 0.5, 0.0, 1.0 );'
          : '  gl_FragColor.a = clamp( gl_FragColor.a + wF * 0.20, 0.0, 1.0 );'),
          /* 水面だけの白飛び止め。さざ波を大胆にすると、太陽のきらめきが
           * 「線」から「粒の帯」に広がるぶん飽和画素が増える。このビューアは
           * トーンマッピングを掛けていない = gl_FragColor がほぼそのまま
           * 0-255 になるので、水面の出力だけ 0.96 (245/255) で頭を打たせて
           * おけば、きらめきの形を保ったまま水が 254 に到達しなくなる。 */
          '  gl_FragColor.rgb = min( gl_FragColor.rgb, vec3( 0.96 ) );',
          '#include <fog_fragment>'
        ].join('\n'));

        sh.fragmentShader = fs;
      };
      mat.customProgramCacheKey = function(){ return C.key; };
      mat.needsUpdate = true;
      return { off1: uOff1, off2: uOff2, off3: uOff3, amp: uAmp, time: uTime };
    }

    /* ================================================================ *
     * B-3a. 堀 -- 八角形の環を格子へ張り替えて、方向波で上下させる
     * ================================================================ */
    var OCT_IN = octVec(octMoat.waterIn), OCT_OUT = octVec(octMoat.waterOut);
    /* dx,dz は単位ベクトル。lam=波長(m)、amp=振幅(m)、spd=位相速度(m/s)。
     * 波長は互いに非通約(12.5 / 5.8 / 3.6)。振幅はボディアムの約 55%
     * -- 幅 9m の浅い堀に外海のうねりは入らない。 */
    var WAVES = [
      { dx:  0.9406, dz:  0.3395, lam: 12.5, amp: 0.075, spd: 0.54 },
      { dx: -0.4191, dz:  0.9080, lam:  5.8, amp: 0.042, spd: 0.46 },
      { dx:  0.7779, dz: -0.6283, lam:  3.6, amp: 0.022, spd: 0.40 }
    ];
    var W_CELL = 0.90;                 // 格子間隔(m)。最短波長 3.6m を 4 分割
    var W_FADE = 2.6;                  // 岸から何メートルで振幅ゼロにするか

    /* ---- 水面板を八角形の環の格子へ張り替える ----------------------
     * 元の ShapeGeometry(穴あき八角形 = 三角形わずか十数枚)では頂点が
     * 足りない。周方向は弧長比 t で歩き、横断方向は内外の汀線を線形補間
     * する。t のサンプル列には **両方の八角形の頂点が来る t** を必ず
     * 含めるので、角が弦で丸く落ちることはない。
     * UV は uv=(x,-z) を自分で書く(フラグメント側の約束)。 */
    (function rebuildWaterGrid(){
      var oOut = octMoat.waterOut, oIn = octMoat.waterIn;
      function cornerTs(o){
        var p = octPts(o), n = p.length, L = [], tot = 0, i;
        for (i=0;i<n;i++){
          var a = p[i], b = p[(i+1)%n], d = Math.hypot(b.x-a.x, b.z-a.z);
          L.push(d); tot += d;
        }
        var ts = [], acc = 0;
        for (i=0;i<n;i++){ ts.push(acc/tot); acc += L[i]; }
        return ts;
      }
      // 外周長からおおよその周方向分割数を決める
      var pts = octPts(oOut), per = 0, i, j;
      for (i=0;i<pts.length;i++){
        var a = pts[i], b = pts[(i+1)%pts.length];
        per += Math.hypot(b.x-a.x, b.z-a.z);
      }
      var nT = Math.max(64, Math.round(per / W_CELL));
      var ts = [];
      for (i=0;i<nT;i++) ts.push(i/nT);
      ts = ts.concat(cornerTs(oOut)).concat(cornerTs(oIn));
      ts.sort(function(p,q){ return p-q; });
      var uniq = [];
      for (i=0;i<ts.length;i++){
        if (!uniq.length || ts[i] - uniq[uniq.length-1] > 1e-4) uniq.push(ts[i]);
      }
      if (1 - uniq[uniq.length-1] < 1e-4) uniq.pop();
      uniq.push(1);                                   // 最後の輪を閉じる(t=1 は t=0 と同じ点)

      // 横断方向の分割数は「いちばん狭いところ」で決める
      var wMin = 1e9;
      for (i=0;i<uniq.length;i++){
        var pO = octWalk(oOut, uniq[i]), pI = octWalk(oIn, uniq[i]);
        wMin = Math.min(wMin, Math.hypot(pO.x-pI.x, pO.z-pI.z));
      }
      var nU = Math.max(3, Math.round(wMin / W_CELL));

      var pos = [], uvs = [], nor = [], idx = [];
      for (i=0;i<uniq.length;i++){
        var qO = octWalk(oOut, uniq[i]), qI = octWalk(oIn, uniq[i]);
        for (j=0;j<=nU;j++){
          var u = j/nU;
          var x = qI.x + (qO.x-qI.x)*u, z = qI.z + (qO.z-qI.z)*u;
          pos.push(x, 0, z); nor.push(0, 1, 0); uvs.push(x, -z);
        }
      }
      var stride = nU+1;
      for (i=0;i<uniq.length-1;i++){
        for (j=0;j<nU;j++){
          var A = i*stride+j, B = A+1, Cc = (i+1)*stride+j, D = Cc+1;
          idx.push(A, Cc, B, B, Cc, D);
        }
      }
      var g = new T.BufferGeometry();
      g.setIndex(idx);
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal',   new T.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv',       new T.Float32BufferAttribute(uvs, 2));
      g.computeBoundingSphere();
      g.boundingSphere.radius += 1.0;               // 変位のぶん余裕を持たせる
      g.userData.__uvW = 1;                         // applyWorldUVs に触らせない
      var mw = octMoat.moatWater;
      if (mw.geometry && mw.geometry.dispose) mw.geometry.dispose();
      mw.geometry = g;
    })();

    var MOAT = buildWater(waterMat, {
      key: 'beaumaris-moat-fresnel-v1',
      waves: WAVES, fade: W_FADE,
      octIn: OCT_IN, octOut: OCT_OUT,
      uv1: 1/19, uv2: 1/6.4, uv3: 1/2.6,
      w1: 1.30, w2: 0.80, w3: 0.50,
      skyGain: 0.72,          // 泥の多い内堀。空をボディアムほど素直に返さない
      murk: 0.80,             // 水中の色を落として silty ditch に戻す
      glint: 1.10, haze: 0.75, spark: 0.16, caus: 0.52, foam: 0.18
    });

    /* ================================================================ *
     * B-3b. 潮汐ドックと海への水路 -- 同じ物理、違う性格
     * ================================================================ *
     * 【堀と変えたところと、その理由】
     *  ・skyGain 0.80 -> 0.94 / spark 0.18 -> 0.26:
     *    外海はよどんだ内堀より濁りが少なく、空をそのまま返す。満潮で
     *    海水が入って来る場所なので、明るく硬い反射のほうが正しい。
     *  ・タイル実寸を 19/6.4/2.6m -> 26/9.0/3.4m に伸ばし、流速を約 6割に
     *    落とした。外海のうねりは堀のさざ波より波長が長く、ゆっくり動く。
     *  ・頂点変位なし。ドックの水面は mkBox の薄板で頂点が 4隅しかなく、
     *    変位させる先がない。板を格子に張り替える手もあるが、ドックは
     *    ほぼ真上からしか見えず(城の南、視界のいちばん端)、コースティ
     *    クスに割く頂点の価値がない。法線マップのさざ波だけで足りる。
     *  ・岸の泡なし。basin(幅20m)・channel(幅10m)・sill(傾いた板)で
     *    縁の位置が三者三様なので、1本の距離関数では正しく出せない。
     *    石積みの護岸が水際まで来ているので、泡が無くても不自然でない。
     * ================================================================ */
    var SEA = buildWater(seaMat, {
      key: 'beaumaris-sea-fresnel-v1',
      waves: null, fade: 1,
      uv1: 1/26, uv2: 1/9.0, uv3: 1/3.4,
      w1: 1.20, w2: 0.85, w3: 0.55,
      skyGain: 0.94,
      murk: 0.94,             // 外海は堀ほど濁らない
      glint: 1.20, haze: 0.75, spark: 0.26, caus: 0, foam: 0
    });

    /* ---- 毎フレームの更新 -------------------------------------------
     * 決定性のため Math.random() は一切使わない。すべて絶対時刻 t の
     * 純関数なので、同じ URL の2回のスクショが一致する。 */
    /* 頂点シェーダと同一の式(水鳥用)。同じ WAVES から計算する。 */
    function waveHeightJS(x, z, t){
      var h = 0;
      for (var i = 0; i < WAVES.length; i++){
        var w = WAVES[i], k = 2 * Math.PI / w.lam;
        h += w.amp * Math.sin(k * (w.dx * x + w.dz * z) - k * w.spd * t);
      }
      return h;
    }
    function waveShoreJS(x, z){
      var fi = octDJS(x, z, OCT_IN), fo = -octDJS(x, z, OCT_OUT);
      var u = Math.max(0, Math.min(1, Math.min(fi, fo) / W_FADE));
      return u * u * (3 - 2 * u);
    }
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
      MOAT.amp.value = 1 + rain * 0.45;
      SEA.amp.value  = 1 + rain * 0.38;
      // 単位はタイル/秒。実速度 = 速度 x タイル実寸
      MOAT.off1.value.set(  t * 0.00526 * sp,  t * 0.00311 * sp );
      MOAT.off2.value.set( -t * 0.02031 * sp,  t * 0.01750 * sp );
      MOAT.off3.value.set(  t * 0.04100 * sp, -t * 0.09231 * sp );
      MOAT.time.value = t * sp;
      // 海: 潮は北(城)へ向かって差してくる。堀より遅く、向きを揃える
      SEA.off1.value.set(  t * 0.00190 * sp, -t * 0.00420 * sp );
      SEA.off2.value.set( -t * 0.00860 * sp, -t * 0.01380 * sp );
      SEA.off3.value.set(  t * 0.02400 * sp, -t * 0.05200 * sp );
      SEA.time.value = t * sp;

      /* 水鳥は水面に浮いている。板が本当に上下する以上、置きっぱなしに
       * すると波の谷で宙に浮き、峰では体が沈む。 */
      var wbAmp = 0.62 + 0.38 * MOAT.amp.value;
      for (var wb = 0; wb < moatBirds.length; wb++){
        var b = moatBirds[wb], bp = b.g.position;
        bp.y = b.y0 + waveHeightJS(bp.x, bp.z, MOAT.time.value)
                    * waveShoreJS(bp.x, bp.z) * wbAmp;
      }

      if (typeof camera !== 'undefined' && camera && camera.projectionMatrix){
        // 反射ベクトルを画面 v へ落とすのに使う縦方向の投影係数
        uProjY.value = camera.projectionMatrix.elements[5];
      }
      /* 霧色。11-environment.js が毎フレーム天候の彩度落としまで済ませて
       * scene.fog.color に入れているので、それをそのまま読む(= 山や遠景と
       * 完全に同じ色。だから水平線で必ず繋がる)。 */
      if (typeof scene !== 'undefined' && scene && scene.fog){
        uFog.value.set(scene.fog.color.r, scene.fog.color.g, scene.fog.color.b);
      }
      if (typeof CUR_TIME !== 'undefined' && CUR_TIME){
        var sat = (typeof CUR_WEATHER !== 'undefined' && CUR_WEATHER && CUR_WEATHER.skySatMul != null)
                  ? CUR_WEATHER.skySatMul : 1;
        if (CUR_TIME.sky){
          for (var i = 0; i < 6; i++){
            _wSkyC.copy(CUR_TIME.sky[i]);
            wDesat(_wSkyC, sat);
            uSky.value[i].set(_wSkyC.r, _wSkyC.g, _wSkyC.b);
          }
        }
        /* 太陽(夜は月)の色と強さ。天候で弱まるので e.sunMul を掛ける。
         * ★向きは 11-environment.js の sunAnchorDir をそのまま使う。
         * このビューアの太陽円板と光芒は「仰角をクランプした見かけの方向」
         * に描かれている。水面のきらめきは太陽の鏡像なので、円板と別の
         * 向きで計算すると「水に映った太陽」と「空の太陽」が縦にずれ、
         * 一目で嘘だと分かる。 */
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

  /* ---- テクスチャ密度に合わせて UV をメートル単位へ書き直す --------
   * すべてのメッシュを組み終えた **あと** に1回だけ走らせる。
   * TEXKIT と RUBKIT のどちらの texMat も material.userData.uvDensity を
   * 立てるので、走査は1回で両方に効く(applyWorldUVs は共有モジュール
   * スコープの同じ関数)。 */
  TEXKIT.applyWorldUVs(group);

  /* -------------------------------------------------------------- *
   * info payload + always-on labels
   * -------------------------------------------------------------- */
  var info = {
    rooms: [
      { name:'大広間 (Great Hall, Gatehouse)', desc:'北門楼1階、約21×7.6m。本来2階建て予定だったが1階のみで完成。' },
      { name:'礼拝堂 (Chapel)', desc:'東の中間塔に置かれたと想定される礼拝堂(位置推定)。' },
      { name:'厨房 (Kitchen)', desc:'西棟南ブロック北半。内郭西壁沿いの調理場(位置・規模は推定)。' },
      { name:'パン焼き所 (Bakehouse)', desc:'西棟南ブロック南半。パン窯を備えた区画(推定)。' },
      { name:'厩舎・馬具庫 (Stable)', desc:'西棟北ブロック。基礎のみ現存する西側レンジ(用途は推定)。' },
      { name:'居室・従者宿舎 (Lodgings)', desc:'東棟北ブロック。内郭東壁沿いの居住棟(間取りは推定)。' },
      { name:'倉庫・穀物庫 (Storehouse)', desc:'東棟南ブロック。糧食・武具の保管棟(推定)。' },
      { name:"城代の間 (Constable's Chamber)", desc:'北西塔の居室(位置推定)。天蓋つき寝台と螺旋階段。' },
      { name:'衛士詰所 (Guard Room)', desc:'北東塔一階。寝台と武具架を置く詰所(推定)。' },
      { name:'門道・落とし格子 (Gate Passage)', desc:'北門楼を貫く門道。落とし格子、殺人孔、上階の巻き上げ機。' },
      { name:'井戸 (Well)', desc:'内郭中庭の井戸(位置推定)。巻き上げ機つき。' },
      { name:'菜園 (Kitchen Garden)', desc:'中庭西側の畝立て菜園(配置は推定)。' },
      { name:'薬草園 (Herb Garden)', desc:'生垣で囲った四分割の薬草園(配置は推定)。' }
    ]
  };
  var labelGroup = buildLabelGroup(group, pickables);

  /* ---- resident life data (住人システム、section 6.5 が読む任意フィールド)
   * 同心円式の特徴を生かし、gate.path は内郭側の門口→外郭中庭→外郭の破口
   * を順に貫通する3点(2区間)。衛兵の巡回は内郭と外郭の間の狭い「キル
   * ゾーン」を周回させ、同心円防御の見た目を強調する。 -------------------- */
  // the inner mouth is now at the courtyard face of the gatehouse's inward
  // projection, not at the curtain line -- otherwise residents would appear
  // and vanish inside the new gate block.
  var northGateHalfD = GATE_D/2, southGateHalfD = GATE2_D/2;
  var nInnerMouthZ = NGATE_FACE_Z + 0.4, nOuterMouthZ = -(INNER_HZ+northGateHalfD)-0.2;
  var sInnerMouthZ = SGATE_FACE_Z - 0.4, sOuterMouthZ =  (INNER_HZ+southGateHalfD)+0.2;
  var nBreachZ = -OHZ-0.3, sBreachZ = OHZ+0.3;
  var nVanish = (MOAT_OHZ - OHZ + 6) - 0.3;
  var sVanish = (MOAT_OHZ - OHZ + 6) - 0.3;

  var life = {
    gates: [
      { path:[ {x:0,z:nInnerMouthZ}, {x:0,z:nOuterMouthZ}, {x:0,z:nBreachZ} ], outDir:{x:0,z:-1}, vanishDist: nVanish },
      { path:[ {x:0,z:sInnerMouthZ}, {x:0,z:sOuterMouthZ}, {x:0,z:sBreachZ} ], outDir:{x:0,z:1},  vanishDist: sVanish }
    ],
    courtyard: [
      // 内郭中庭。東西のレンジ(courtyard-facing face at |x| = RANGE_IN_X)の
      // 内側だけを歩かせ、建物の中に住人がめり込まないようにする。
      // north/south limits pulled in to clear the two gatehouse blocks that now
      // project into the ward (NGATE_FACE_Z / SGATE_FACE_Z are their courtyard faces)
      // WEST limit pulled in from -(RANGE_IN_X-1.5) to GARD_X1-1.2: everything
      // west of that is now kitchen garden / herb garden / service yard, and the
      // EAST limit clears the orchard row at x = 13. Residents therefore keep the
      // whole central and eastern courtyard, including the gate-to-gate path.
      // minX must stay EAST of GARD_X1 (-6.2), which is where the outermost
      // kitchen-garden bed board and the herb garden's east hedge actually end
      // -- at GARD_X1-1.2 residents walked straight through that hedge.
      { minX:GARD_X1+0.8, maxX:11.2, minZ:NGATE_FACE_Z+2.0, maxZ:SGATE_FACE_Z-2.0 },
      { minX:-NS_HALF, maxX:NS_HALF, minZ:-OHZ+2, maxZ:-(INNER_HZ+2) },   // 外郭中庭・北帯
      { minX:-NS_HALF, maxX:NS_HALF, minZ:INNER_HZ+2, maxZ:OHZ-2 },      // 外郭中庭・南帯
      { minX:INNER_HX+2, maxX:OHX-2, minZ:-INNER_HZ+2, maxZ:INNER_HZ+2 }, // 外郭中庭・東帯
      { minX:-OHX+2, maxX:-(INNER_HX+2), minZ:-INNER_HZ+2, maxZ:INNER_HZ+2 } // 外郭中庭・西帯
    ],
    // 衛兵は内郭・外郭のあいだの細い空間(キルゾーン)を周回する -- 同心円
    // 式防御の見せ場として、常に地面レベル(y=0)のウェイポイントで構成
    patrol: [
      [INNER_HX+6, 0, -(INNER_HZ+6)], [INNER_HX+6, 0, INNER_HZ+6],
      [-(INNER_HX+6), 0, INNER_HZ+6], [-(INNER_HX+6), 0, -(INNER_HZ+6)]
    ],
    population: { farmers: 10, guards: 5 }
  };

  return { group: group, fadeGroups: fadeGroups, interiorGroup: interiorGroup, info: info,
    pickables: pickables, windowMat: windowMat, waterMats: [waterMat, seaMat], labelGroup: labelGroup, life: life };
}

registerCastle({
  id: 'beaumaris',
  name: 'Beaumaris Castle',
  nameJa: 'ボーマリス城',
  country: 'Wales',
  countryJa: 'ウェールズ(イギリス)',
  flag: '🏴󠁧󠁢󠁷󠁬󠁳󠁿',
  year: '1295',
  description: '1295年、エドワード1世によるウェールズ征服の総仕上げとして着工された、現存する城郭の中でも最も幾何学的に整った同心円式プラン(内郭を外郭が隙間なく取り囲む二重の城壁)を持つ。国王と棟梁ジェイムズ・オブ・セント・ジョージの死、そして資金の枯渇により未完成に終わり、塔や門楼の多くは計画より低く切り詰められたまま今日まで残る。',
  build: buildBeaumaris,
  // outer moat half-extent ~61 x 59m -- a bit larger overall than Bodiam
  // (~47m half-extent), so pull the camera back and extend fog/shadow/
  // far-clip range a little; envScale nudges the shared background
  // mountain ring out to match.
  // initDist raised 130 -> 145 because widening the moat pushed the outer
  // half-extent from ~55m to ~61m: at 130 the moat corners clipped the frame
  // and the opening reveal (0.364) already sat past WALL_START, so the walls
  // began fading before the user had touched anything. 145 gives reveal 0.27.
  view: { targetY: 8, zMin: 25, zMax: 190, initDist: 145,
    fogNear: 120, fogFar: 400, shadowExtent: 75, shadowFar: 260,
    camFar: 1100, panLimit: 55, envScale: 1.3 }
});
