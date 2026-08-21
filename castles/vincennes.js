"use strict";

/* ====================================================================
 * 1.5 Chateau de Vincennes procedural builder
 * ====================================================================
 * Returns the same { group, fadeGroups, interiorGroup, info, pickables,
 * windowMat, waterMats, labelGroup } contract as buildBodiam(). At ~10x
 * Bodiam's footprint (330x175m rectangular enceinte vs. a 33m square),
 * this is a TWO-TIER cutaway: the outer enceinte (walls/towers, tier
 * 'outer', the same WALL_START/END + ROOF_START/END bands Bodiam uses)
 * fades first as the camera zooms in; the donjon's own shell (tier
 * 'inner', DONJON_WALL_START/END + DONJON_ROOF_START/END -- see section
 * 5) only fades once the camera is close enough that the outer shell has
 * already faded away, revealing the keep's five floors.
 *
 * Layout follows the real enceinte's official plan (long axis is
 * north-south, 330m; short axis is east-west, 175m): 3 towers each on
 * the short north/south walls (2 corners + a gate in the middle), 3
 * towers spaced along the long east wall, and NO towers on the west wall
 * -- the donjon + its chemise instead bite into and bulge out past the
 * west wall there, exactly as the plan shows.
 */
function buildVincennes(){
  var group = new T.Group();
  var interiorGroup = new T.Group();
  group.add(interiorGroup);
  var fadeGroups = [];
  var pickables = [];

  /* opt(任意) = texMat の第3引数。省略時は「屋根 = スレート(pave を
   * スレート寸法で使う)/ それ以外 = 切石」。isRoof は *フェードの段*
   * を決めるフラグであって素材ではない点に注意 -- ドンジョンの隅塔
   * (dTurrets)は屋根と同時に消えるが石積みである。
   * Lambert -> Phong(shininess 0 / specular 黒)に差し替えているが、
   * カットアウェイが触るのは .opacity / .transparent / .depthWrite だけ
   * なので、フェードの挙動は Lambert のときと同一。 */
  function makeFadeGroup(name, dir, isRoof, colorHex, tier, opt){
    var kind = (opt && opt.kind) || (isRoof ? 'slate' : 'stone');
    var mat = matFor(colorHex, kind, opt);
    var g = new T.Group();
    g.name = name;
    group.add(g);
    var desc = { group:g, mat:mat, dir:dir, roof: !!isRoof, op:1, name:name, tier: tier || 'outer' };
    fadeGroups.push(desc);
    return desc;
  }

  /* ---- palette: pale Paris limestone, slate roofs ------------------
   * Reference photos (Commons "Chateau-de-Vincennes-donjon.jpg",
   * "Château de Vincennes Paris FRA 002.jpg") show a very light, warm
   * cream limestone -- the earlier 0xb9b2a0/0x8a8474 pair read grey-brown
   * and made the chemise look like a different, darker material than the
   * donjon it wraps. Everything above ground is now the same cream family,
   * only lightly value-separated so faces still read apart. */
  var STONE_WALL   = 0xd2c8ae;
  var STONE_WALL_V = 0xc9bea2;
  var STONE_DARK   = 0xc3b89c;
  var ROOF_COL     = 0x3f3c38; // dark slate -- used for roofs, chemise walkway cap, bartizan caps
  var WINDOW_COL   = 0x1c150e;
  var FLOOR_COL    = 0x9c9484;
  var STUB_COL     = 0x776f5e;
  var WOOD_COL     = 0x6b4f34;
  var METAL_COL    = 0x2a2925;
  var WATER_COL    = 0x35545c;
  var GRASS_COL    = 0x5c7a48;
  var GRASS_COL2   = 0x6c8a52;
  var BANK_COL     = 0x8a7a58;
  var BANK_MID_COL = 0x62543a;
  var BANK_EDGE_COL= 0x2f2617;
  var COURT_GRASS_COL = 0x6a8d4f;

  /* ================================================================ *
   * 手続き的テクスチャ -- 共有工房 CastleTex(js/02-texture.js)
   * ================================================================ *
   * 既定値はボディアム(蜂蜜色の砂岩の粗石)の値なので、王城ヴァンセンヌ
   * 向けに 3 か所を振り直している。使える kind と opt は js/02-texture.js
   * の冒頭コメントを参照。
   *
   *  1) stone = 「丁寧に整形された切石」。ボディアムとの差は色ではなく
   *     **目地と揃い方**。ボディアムの砂岩は目地が太く(joint 1.5px)、
   *     石ごとの明度が ±22 も振れる粗石だが、ヴァンセンヌの石灰岩は
   *     王の石工が挽いた切石なので目地は髪の毛ほど(joint 1.0px =
   *     実寸 9mm)、石の幅も 0.64-0.83m の狭い範囲に揃い、明度差は
   *     ±15 しかない。段は 8 -> 9 に増やして 1 段 0.267m。
   *     色そのものは material.color(STONE_WALL = 0xd2c8ae)が持つ。
   *
   *  2) slate = **屋根はスレート**であって鉛葺きではない。工房の 'roof'
   *     は立ちはぜ(standing seam)の鉛屋根で、板状の薄い石を重ねた
   *     スレートには使えない。そこで 'pave'(不定形の板石)を
   *     スレート寸法(1タイル 1.30m / 4x4 = 1枚 0.325m)で使う。
   *     pave はセルごとに明度が振れて縁が面取りされるので、
   *     「1枚ずつ色味の違う薄板を重ねた」スレートの読みになる。
   *     床の敷石は同じテクスチャを density 側で 0.5m 角に伸ばして使う
   *     (matFor の 'floor')。
   *     'roof' の方はドンジョン頂部の **鉛のテラス** に残す -- 実物も
   *     ここだけは平らな鉛葺きで、円錐スレートとは別物。
   *
   *  3) nrmBoost 1.60(既定 1.70 から少し浅く)。切石は粗石より面が
   *     平らなので、同じ深さだと目地が溝に見えすぎる。
   * ---------------------------------------------------------------- */
  var TEXKIT = CastleTex.kit({
    id: 'vincennes',
    nrmBoost: 1.60,
    stone: {
      metres: 2.4, courses: 9,
      mortar: '#9a9488', mortarH: 0.36,     // 目地は浅い(切石は目地が薄い)
      blockMin: 66, blockW: [68, 20],       // 0.64-0.83m の揃ったブロック
      joint: 1.0,                           // 目地の半幅 1px = 実寸 9mm
      faceLum: [234, 15],                   // 石ごとの明度差を小さく
      edgeHi: 'rgba(255,255,255,0.26)', edgeLo: 'rgba(70,62,48,0.26)',
      bevel: 3.4, faceH: [0.76, 0.16],      // 面のばらつきも小さく
      toolH: 0.07, stainH: 0.11,            // のみ跡・風化の高さ寄与を控えめに
      stainMul: [0.88, 0.20],               // 風化の斑も浅く
      tint: [1.0, 0.997, 0.99],             // ほぼ無彩色(色は material.color 側)
      mean: 0.90, nrm: 3.6
    },
    // スレート: 1タイル 1.30m の 4x4 = 1枚 0.325m 角
    pave: {
      metres: 1.30, grid: 4,
      mortar: '#83807a', mortarH: 0.26,
      faceLum: [226, 30],                   // 1枚ごとの色味の差はむしろ大きく
      bevel: 2.6, faceH: [0.70, 0.24],
      wearMul: [0.86, 0.26],
      tint: [1.0, 1.0, 0.995],
      mean: 0.91, nrm: 3.2
    },
    // 鉛のテラス: 立ちはぜは 0.47m ごと
    roof: { metres: 1.4, rolls: 3, lead: '#cdc9c2', mean: 0.93, nrm: 2.6 },
    // 漆喰。石(2.4m)と非通約に保つ(02-texture.js の注記)
    plaster: { metres: 2.9, nrm: 1.9 },
    // 旗: フランス王家の青地に金の帯(紋章の忠実再現は狙わない)
    flag: { field: '#2c4682', band: '#c2a558', edge: '#1d2f5c', bars: 3 }
  });
  var TEX           = TEXKIT.tex;             // TEX.smoke / TEX.flag / TEX.waterN1..3
  var applyWorldUVs = TEXKIT.applyWorldUVs;   // (root) ビルド末尾で1回だけ

  /* 論理素材名 -> (工房の kind, UV 密度)。'slate' と 'floor' は同じ
   * pave テクスチャを別の実寸で使うためのラベル。 */
  function matFor(colorHex, kind, opt){
    opt = opt || {};
    var o = { nrm: opt.nrm, side: opt.side, density: opt.density };
    var k = kind;
    if (kind === 'slate'){ k = 'pave'; if (o.nrm == null) o.nrm = 0.85; }
    else if (kind === 'floor'){ k = 'pave'; if (o.density == null) o.density = 1/2.0; }
    if (o.nrm == null) delete o.nrm;
    if (o.side == null) delete o.side;
    if (o.density == null) delete o.density;
    var t = TEX[k];
    /* 法線マップを持たない kind(= turf)は Lambert のままで済ませる。
     * 工房の texMat は必ず MeshPhongMaterial を作るが、これは
     * 「r128 の Lambert が normalMap を無視する」ための回避策なので、
     * そもそも法線マップが無い素材には理由がない。しかも Phong は
     * shininess 0 / specular 黒にしても鏡面項をピクセルごとに評価する。
     * ヴァンセンヌは外郭の芝が 175x330m あって画面のいちばん広い面なので、
     * ここだけで実測 frame time が効く(zoom=0.3 で約 6ms)。
     * 見えは完全に同じ(鏡面ハイライトが出ないことは元から)。 */
    if (t && !t.normal){
      var m = new T.MeshLambertMaterial({
        color: colorHex, map: t.map, side: o.side || T.FrontSide });
      m.userData.uvDensity = (o.density != null ? o.density : 1/t.metres);
      return m;
    }
    return TEXKIT.texMat(colorHex, k, o);
  }
  var texMat = matFor;

  var windowMat = new T.MeshLambertMaterial({ color: WINDOW_COL });
  var floorMat  = texMat(FLOOR_COL, 'floor', { nrm: 0.9 });
  /* 内壁・仕切りの漆喰。両面 -- r128 は DOUBLE_SIDED のとき法線を
   * faceDirection で反転してから接空間の摂動を掛けるので、normalMap は
   * 裏面でも正しい向きに出る。 */
  var stubMat   = texMat(STUB_COL, 'plaster', { nrm: 0.55, side: T.DoubleSide });
  var woodMat   = texMat(WOOD_COL, 'wood', { nrm: 0.8 });
  var metalMat  = new T.MeshLambertMaterial({ color: METAL_COL });
  var grassMat  = new T.MeshLambertMaterial({ color: GRASS_COL }); // 2.4km の外周地面。テクスチャは載せない
  var grassMat2 = texMat(GRASS_COL2, 'turf');
  var courtGrassMat = texMat(COURT_GRASS_COL, 'turf');
  var darkWoodMat = texMat(0x2a1c14, 'wood', { nrm: 0.7 });
  var chemiseMat = texMat(STONE_DARK, 'stone', { nrm: 1.0 });
  var slateMat = texMat(ROOF_COL, 'slate');

  /* ---- interior fit-out + garden palette ---------------------------
   * Everything below is closure-local (file-header rule: no new top-level
   * names, so five castle builders can be loaded side by side). */
  var ribMat       = texMat(0xa89d86, 'stone', { nrm: 0.7 });  // dressed stone ribs/pillars
  var timberMat    = texMat(0x7a5a3a, 'wood', { nrm: 0.7 });   // plank floors
  var strawMat     = texMat(0xc7ac66, 'straw', { nrm: 0.7 });
  var clothRedMat  = texMat(0x8c2f2a, 'cloth', { nrm: 0.5 });
  var clothBlueMat = texMat(0x2f4a86, 'cloth', { nrm: 0.5 });
  var clothGoldMat = texMat(0xb08a3c, 'cloth', { nrm: 0.5 });
  var linenMat     = texMat(0xd8cfb4, 'cloth', { nrm: 0.45 });
  var emberMat     = new T.MeshLambertMaterial({ color: 0xd2691e });
  var sootMat      = new T.MeshLambertMaterial({ color: 0x33302b });
  var flagstoneMat = texMat(0x8f8878, 'floor', { nrm: 0.85 });
  var soilMat      = texMat(0x4b3726, 'soil', { nrm: 0.9 });
  var leafMat      = new T.MeshLambertMaterial({ color: 0x3f6b32 });
  var leafMat2     = new T.MeshLambertMaterial({ color: 0x527f39 });
  var cropMat      = new T.MeshLambertMaterial({ color: 0x6d9640 });
  var herbMat      = new T.MeshLambertMaterial({ color: 0x87a552 });
  var hedgeMat     = new T.MeshLambertMaterial({ color: 0x3a5f31 });
  var trunkMat     = new T.MeshLambertMaterial({ color: 0x5a4430 });
  var bloomMat     = new T.MeshLambertMaterial({ color: 0xc8607e });
  var bloom2Mat    = new T.MeshLambertMaterial({ color: 0xd8c25a });
  var bathWaterMat = new T.MeshLambertMaterial({ color: 0x4d7f8c });

  /* generic placement shorthands -- every interior/garden piece below is
   * built through these so the fit-out code stays readable. */
  function boxAt(parent, x,y,z, w,h,d, mat, ry){
    var m = mkBox(w,h,d,mat); place(m,x,y,z,ry); parent.add(m); return m;
  }
  function cylAt(parent, x,y,z, rt,rb,h,seg, mat, ry){
    var m = mkCyl(rt,rb,h,seg,mat); place(m,x,y,z,ry); parent.add(m); return m;
  }
  function mkSphere(r, mat){
    var m = new T.Mesh(new T.SphereGeometry(r, 7, 5), mat);
    m.castShadow = true; m.receiveShadow = true;
    return m;
  }
  /* a box stretched along an arbitrary 3D segment -- vault ribs, roof
   * beams, ladder rails. rotation.order is forced to 'YXZ' so the yaw is
   * applied outermost: with the default 'XYZ' the pitch would be taken in
   * world X and diagonal ribs would twist off their corners. */
  function beamBetween(parent, ax,ay,az, bx,by,bz, w,h, mat){
    var dx=bx-ax, dy=by-ay, dz=bz-az;
    var len = Math.hypot(dx,dy,dz) || 0.001;
    var m = mkBox(w, h, len, mat);
    m.position.set((ax+bx)/2, (ay+by)/2, (az+bz)/2);
    m.rotation.order = 'YXZ';
    m.rotation.y = Math.atan2(dx, dz);
    m.rotation.x = -Math.asin(Math.max(-1, Math.min(1, dy/len)));
    parent.add(m);
    return m;
  }

  /* ---- reusable furniture ------------------------------------------
   * All of these take a `ry` yaw and lay their parts out in the rotated
   * local frame (local +X = right, local +Z = "into the room"), using the
   * same x+lx*cos+lz*sin / z-lx*sin+lz*cos convention the wall builders
   * above already use. */
  function localXZ(x,z,ry,lx,lz){
    var co=Math.cos(ry||0), si=Math.sin(ry||0);
    return [x + lx*co + lz*si, z - lx*si + lz*co];
  }
  function addTable(parent, x,y,z, w,d, ry, mat){
    boxAt(parent, x, y+0.78, z, w, 0.13, d, mat, ry);
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function(s){
      var p = localXZ(x,z,ry, s[0]*(w/2-0.35), s[1]*(d/2-0.25));
      boxAt(parent, p[0], y+0.39, p[1], 0.16, 0.78, 0.16, mat, ry);
    });
  }
  function addBench(parent, x,y,z, len, ry, mat){
    boxAt(parent, x, y+0.46, z, len, 0.11, 0.42, mat, ry);
    [-1,1].forEach(function(s){
      var p = localXZ(x,z,ry, s*(len/2-0.3), 0);
      boxAt(parent, p[0], y+0.23, p[1], 0.13, 0.46, 0.38, mat, ry);
    });
  }
  function addStool(parent, x,y,z, mat){
    boxAt(parent, x, y+0.46, z, 0.44, 0.09, 0.44, mat);
    cylAt(parent, x, y+0.23, z, 0.07, 0.09, 0.46, 5, mat);
  }
  function addChair(parent, x,y,z, ry, mat){
    boxAt(parent, x, y+0.46, z, 0.5, 0.1, 0.5, mat, ry);
    var b = localXZ(x,z,ry, 0, -0.22);
    boxAt(parent, b[0], y+0.85, b[1], 0.5, 0.9, 0.09, mat, ry);
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function(s){
      var p = localXZ(x,z,ry, s[0]*0.2, s[1]*0.2);
      boxAt(parent, p[0], y+0.23, p[1], 0.08, 0.46, 0.08, mat, ry);
    });
  }
  function addChest(parent, x,y,z, w,d, ry, mat){
    boxAt(parent, x, y+0.3, z, w, 0.6, d, mat||woodMat, ry);
    boxAt(parent, x, y+0.68, z, w*0.99, 0.16, d*0.99, darkWoodMat, ry);
    boxAt(parent, x, y+0.45, z, w*1.03, 0.07, d*0.25, metalMat, ry);
  }
  function addBarrel(parent, x,y,z, r,h, lying, ry){
    var g = new T.Group();
    var b = mkCyl(r, r*0.94, h, 8, woodMat); g.add(b);
    var h1 = mkCyl(r*1.06, r*1.06, 0.1, 8, metalMat); h1.position.y =  h*0.3; g.add(h1);
    var h2 = mkCyl(r*1.06, r*1.06, 0.1, 8, metalMat); h2.position.y = -h*0.3; g.add(h2);
    if (lying){ g.rotation.z = Math.PI/2; g.rotation.y = ry||0; g.position.set(x, y+r, z); }
    else g.position.set(x, y+h/2, z);
    parent.add(g);
    return g;
  }
  function addSack(parent, x,y,z, s, mat){
    var m = mkSphere(s, mat||strawMat);
    m.scale.set(1, 1.35, 0.85);
    place(m, x, y+s*1.25, z);
    parent.add(m);
  }
  function addCandleStand(parent, x,y,z){
    cylAt(parent, x, y+0.07, z, 0.3, 0.36, 0.14, 8, metalMat);
    cylAt(parent, x, y+0.7, z, 0.05, 0.07, 1.3, 6, metalMat);
    cylAt(parent, x, y+1.45, z, 0.24, 0.16, 0.1, 8, metalMat);
    cylAt(parent, x, y+1.68, z, 0.05, 0.06, 0.36, 6, linenMat);
    cylAt(parent, x, y+1.92, z, 0.02, 0.09, 0.16, 5, emberMat);
  }
  function addTorch(parent, x,y,z, ry){
    var p = localXZ(x,z,ry, 0, 0.22);
    boxAt(parent, p[0], y, p[1], 0.16, 0.5, 0.16, metalMat, ry);
    var q = localXZ(x,z,ry, 0, 0.4);
    cylAt(parent, q[0], y+0.32, q[1], 0.16, 0.08, 0.34, 6, emberMat);
  }
  /* wall fireplace: anchor sits ON the wall's inner face, local +Z points
   * into the room (ry = 0 north wall / PI south / -PI/2 east / PI/2 west) */
  function addFireplace(parent, x,y,z, ry, w){
    function P(lx,lz){ return localXZ(x,z,ry,lx,lz); }
    var bk = P(0,0.08);  boxAt(parent, bk[0], y+1.1, bk[1], w, 2.2, 0.14, sootMat, ry);
    [-1,1].forEach(function(s){
      var j = P(s*(w/2-0.32), 0.36);
      boxAt(parent, j[0], y+0.9, j[1], 0.62, 1.8, 0.72, ribMat, ry);
    });
    var li = P(0,0.36); boxAt(parent, li[0], y+2.0, li[1], w, 0.42, 0.78, ribMat, ry);
    var hd = P(0,0.3);  boxAt(parent, hd[0], y+3.1, hd[1], w*0.86, 1.9, 0.6, ribMat, ry);
    var ht = P(0,0.42); boxAt(parent, ht[0], y+0.1, ht[1], w+0.6, 0.2, 1.1, flagstoneMat, ry);
    var lg = P(0,0.34); boxAt(parent, lg[0], y+0.38, lg[1], w*0.5, 0.24, 0.24, darkWoodMat, ry);
    var em = P(0,0.34); boxAt(parent, em[0], y+0.26, em[1], w*0.56, 0.16, 0.42, emberMat, ry);
  }
  /* four-poster bed with a canopy and side drapes (local +Z = head end) */
  function addCanopyBed(parent, x,y,z, ry, cloth){
    var W = 2.4, L = 3.2, PH = 3.0;
    function P(lx,lz){ return localXZ(x,z,ry,lx,lz); }
    boxAt(parent, x, y+0.42, z, W, 0.34, L, darkWoodMat, ry);          // frame
    boxAt(parent, x, y+0.74, z, W-0.24, 0.3, L-0.3, linenMat, ry);      // mattress
    var pw = P(0, L/2-0.55);
    boxAt(parent, pw[0], y+0.98, pw[1], W*0.7, 0.22, 0.6, linenMat, ry); // pillow
    var bl = P(0, -L/2+0.9);
    boxAt(parent, bl[0], y+0.92, bl[1], W-0.2, 0.14, L*0.5, cloth, ry);  // blanket
    var hb = P(0, L/2+0.02);
    boxAt(parent, hb[0], y+1.3, hb[1], W, 1.5, 0.14, darkWoodMat, ry);   // headboard
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function(s){
      var p = P(s[0]*(W/2-0.06), s[1]*(L/2-0.06));
      boxAt(parent, p[0], y+PH/2, p[1], 0.16, PH, 0.16, darkWoodMat, ry);
    });
    boxAt(parent, x, y+PH+0.08, z, W+0.2, 0.18, L+0.2, cloth, ry);       // tester
    [-1,1].forEach(function(s){
      var d = P(s*(W/2+0.02), 0);
      boxAt(parent, d[0], y+PH*0.62, d[1], 0.1, PH*0.7, L*0.34, cloth, ry);
    });
    var vh = P(0, L/2+0.1);
    boxAt(parent, vh[0], y+PH*0.62, vh[1], W*0.9, PH*0.7, 0.1, cloth, ry);
  }
  function addWallHanging(parent, x,y,z, ry, w,h, cloth){
    boxAt(parent, x, y, z, w, h, 0.09, cloth, ry);
    boxAt(parent, x, y+h/2+0.09, z, w+0.24, 0.14, 0.16, darkWoodMat, ry);
  }
  function addArmsRack(parent, x,y,z, ry, n){
    boxAt(parent, x, y+1.75, z, 2.6, 0.14, 0.3, woodMat, ry);
    boxAt(parent, x, y+0.06, z, 2.6, 0.12, 0.4, woodMat, ry);
    for (var i=0;i<n;i++){
      var p = localXZ(x,z,ry, -1.15 + i*(2.3/Math.max(1,n-1)), 0);
      cylAt(parent, p[0], y+1.15, p[1], 0.045, 0.055, 2.3, 5, woodMat); // spear shaft
      cylAt(parent, p[0], y+2.35, p[1], 0.02, 0.07, 0.34, 4, metalMat); // spear head
    }
  }

  /* -------------------------------------------------------------- *
   * outer enceinte: 175m (E-W, short) x 330m (N-S, long) rectangle,
   * 11m wall, 9 rectangular (not round) towers -- 3 each on the short
   * north/south walls (corner/gate/corner), 3 spaced along the long east
   * wall, none on the west wall (donjon bulge there instead). All at
   * their full 14th-century height (42m), per spec.
   * -------------------------------------------------------------- */
  var OHX = 87.5, OHZ = 165;          // outer wall half-extents (175 x 330m)
  var WT = 2.8, WH = 11, MER = 1.5;   // wall thickness / height / merlon height
  // Roof heights are capped so no tower apex overtops the donjon's 52m
  // turrets: 42 (parapet) + 1.5 (merlon) + roofH must stay <= ~52. The
  // earlier 6.5m looked flat only because the pyramid's base was
  // undersized (see buildTower); with the base fixed, ~8.5m already gives
  // the steep pitch the 1668 bird's-eye shows without stealing the keep's
  // place as the highest point of the castle.
  var TOWER_W = 9, TOWER_D = 7, TOWER_H = 42, TOWER_ROOF_H = 8.2;
  // Tour du Village is drawn markedly bigger than every other tower on the
  // 2021 official plan and projects further out from the curtain -- it is
  // the castle's principal gate. 12x9 barely separated it from the plain
  // 9x7 flanking towers.
  var GATE_W = 15, GATE_D = 11, GATE_ROOF_H = 9.4;    // Tour du Village (main gate), larger
  var GATE2_W = 11, GATE2_D = 9, GATE2_ROOF_H = 8.8;  // Tour du Bois (second gate)

  function addCrenellations(target, mat, cx, cz, length, ry, topY, thickness){
    var merlonW = 1.5, gapW = 1.35, mt = thickness*0.72;
    var period = merlonW + gapW;
    var count = Math.max(1, Math.floor(length/period));
    var start = -(count*period)/2 + merlonW/2;
    var co = Math.cos(ry), si = Math.sin(ry);
    for (var i=0;i<count;i++){
      var lx = start + i*period;
      var wx = cx + lx*co, wz = cz - lx*si;
      var m = mkBox(merlonW, MER, mt, mat);
      place(m, wx, topY + MER/2, wz, ry);
      target.add(m);
    }
  }
  function buildStraightWall(fg, cx, cz, length, ry, windows){
    var wall = mkBox(length, WH, WT, fg.mat);
    place(wall, cx, WH/2, cz, ry);
    fg.group.add(wall);
    addCrenellations(fg.group, fg.mat, cx, cz, length, ry, WH, WT);
    if (windows){
      var co=Math.cos(ry), si=Math.sin(ry);
      windows.forEach(function(w){
        var win = mkBox(w.w, w.h, WT*1.05, windowMat);
        place(win, cx+w.x*co, WH*0.6, cz-w.x*si, ry);
        fg.group.add(win);
      });
    }
  }

  var wallN = makeFadeGroup('wallN', {x:0,z:-1}, false, STONE_WALL);
  var wallS = makeFadeGroup('wallS', {x:0,z:1},  false, STONE_WALL);
  var wallE = makeFadeGroup('wallE', {x:1,z:0},  false, STONE_WALL);
  var wallW1 = makeFadeGroup('wallW1', {x:-1,z:0}, false, STONE_WALL); // west, north of the donjon gap
  var wallW2 = makeFadeGroup('wallW2', {x:-1,z:0}, false, STONE_WALL); // west, south of the donjon gap
  var tParis = makeFadeGroup('towerParis', {x:0,z:-1}, false, STONE_WALL_V);
  var tVillage = makeFadeGroup('gateVillage', {x:0,z:-1}, false, STONE_WALL_V);
  var tReservoir = makeFadeGroup('towerReservoir', {x:0,z:-1}, false, STONE_WALL_V);
  var tDiable = makeFadeGroup('towerDiable', {x:1,z:0}, false, STONE_WALL_V);
  var tSalves = makeFadeGroup('towerSalves', {x:1,z:0}, false, STONE_WALL_V);
  var tSurintendance = makeFadeGroup('towerSurintendance', {x:1,z:0}, false, STONE_WALL_V);
  var tRoi = makeFadeGroup('towerRoi', {x:0,z:1}, false, STONE_WALL_V);
  var tBois = makeFadeGroup('gateBois', {x:0,z:1}, false, STONE_WALL_V);
  var tReine = makeFadeGroup('towerReine', {x:0,z:1}, false, STONE_WALL_V);
  var roofCaps = makeFadeGroup('roofCaps', null, true, ROOF_COL); // outer-tier tower roofs

  // west wall gap (donjon + chemise bulge through here -- see section below).
  // Widened from 10..90 to 3..97 because the donjon's ditch is now the real
  // 18m-wide, 7m-deep fossé sec instead of a 7m ribbon: the complex it
  // encloses is 91.6m across, so the old gap left two curtain stubs standing
  // in mid-air over the new ditch's north and south arms.
  var W_GAP0 = 3, W_GAP1 = 97;
  // north/south walls: split either side of the gate tower's own footprint
  // (GATE_W / GATE2_W) rather than one continuous box -- the gate tower
  // below now carves a real through-opening (see buildTower's opts.gate
  // branch), and a solid wall panel spanning behind it would still block
  // that opening even though the tower in front of it is pierced.
  function splitWallForGate(fg, cz, ry, gateSpanW, winL, winR){
    var half = gateSpanW/2, segLen = OHX - half, segCx = half + segLen/2;
    buildStraightWall(fg, -segCx, cz, segLen, ry, winL);
    buildStraightWall(fg,  segCx, cz, segLen, ry, winR);
  }
  splitWallForGate(wallN, -OHZ, 0, GATE_W, [{x:-20,w:1.6,h:2.6}], [{x:20,w:1.6,h:2.6}]);
  splitWallForGate(wallS, OHZ, Math.PI, GATE2_W, [{x:-20,w:1.6,h:2.6}], [{x:20,w:1.6,h:2.6}]);
  buildStraightWall(wallE, OHX, 0, 2*OHZ, -Math.PI/2, [
    {x:-140,w:1.6,h:2.6},{x:-100,w:1.6,h:2.6},{x:-30,w:1.6,h:2.6},{x:30,w:1.6,h:2.6},
    {x:60,w:1.6,h:2.6},{x:130,w:1.6,h:2.6}
  ]);
  buildStraightWall(wallW1, -OHX, (-OHZ+W_GAP0)/2, W_GAP0-(-OHZ), Math.PI/2, [{x:-40,w:1.6,h:2.6}]);
  buildStraightWall(wallW2, -OHX, (W_GAP1+OHZ)/2, OHZ-W_GAP1, Math.PI/2, []);

  registerPick(pickables, 'structure', 0, WH/2, -OHZ, OHX*0.7, WH, WT*2, '北城壁 North Curtain Wall', '高さ11mの外郭城壁。石造の水堀がこれを囲む。');
  registerPick(pickables, 'structure', 0, WH/2, OHZ, OHX*0.7, WH, WT*2, '南城壁 South Curtain Wall', '高さ11mの外郭城壁。');
  registerPick(pickables, 'structure', OHX, WH/2, 0, WT*2, WH, OHZ*1.5, '東城壁 East Curtain Wall', '高さ11mの外郭城壁。1km超に及ぶ城壁の一部。');
  registerPick(pickables, 'structure', -OHX, WH/2, -OHZ*0.55, WT*2, WH, OHZ*0.75, '西城壁 West Curtain Wall', '高さ11mの外郭城壁。中央でドンジョンのシェミーズに途切れる。');

  /* rectangular towers (both plain and gate) -- all 42m, full medieval
   * height, proud of a continuous curtain wall. The two gate towers
   * (Tour du Village / Tour du Bois) now carve a REAL through-opening
   * (GATE_OPEN_W wide x GATE_OPEN_H tall, spanning the tower's full depth
   * `d`) instead of a door decal on solid stone: the body is split into
   * left/right pillars + a lintel over the gap, exactly the same split
   * technique buildStraightWall's gate-flanking segments use for the wall
   * behind it (see splitWallForGate above), so residents walk an actual
   * tunnel (life.gates path, section 6.5) rather than clipping through. */
  var GATE_OPEN_W = 4.0, GATE_OPEN_H = 5.0;
  function buildTower(fg, cx, cz, ry, opts){
    var w = opts.w, d = opts.d, h = TOWER_H, roofH = opts.roofH || TOWER_ROOF_H;
    var co = Math.cos(ry), si = Math.sin(ry);
    if (opts.gate){
      var openW = Math.min(GATE_OPEN_W, w-2.6), openH = GATE_OPEN_H;
      var pillarW = (w-openW)/2;
      [-1,1].forEach(function(side){
        var lx = side*(openW/2+pillarW/2);
        var pillar = mkBox(pillarW, h, d, fg.mat);
        place(pillar, cx+lx*co, h/2, cz-lx*si, ry);
        fg.group.add(pillar);
      });
      var openLintel = mkBox(openW, h-openH, d, fg.mat);
      place(openLintel, cx, openH+(h-openH)/2, cz, ry);
      fg.group.add(openLintel);
    } else {
      var body = mkBox(w, h, d, fg.mat);
      place(body, cx, h/2, cz, ry);
      fg.group.add(body);
    }
    // machicolated crown: a corbel course stepping out, then the full
    // projecting gallery it carries, then the parapet on top of that.
    // The old single `lip` (w*1.08 wide, 0.7 tall) projected ~0.35m and
    // vanished at viewing distance -- every reference photo of Vincennes
    // shows a heavy shadowed corbel band ringing each tower just under
    // the parapet, so it now steps out ~1.1m in two courses.
    var corbel = mkBox(w+1.1, 0.6, d+1.1, fg.mat);
    place(corbel, cx, h-2.7, cz, ry);
    fg.group.add(corbel);
    var machic = mkBox(w+2.2, 1.5, d+2.2, fg.mat);
    place(machic, cx, h-1.6, cz, ry);
    fg.group.add(machic);
    addCrenellations(fg.group, fg.mat, cx, cz, w+2.0, ry, h, d+2.0);
    // steep 4-sided slate pyramid. A ConeGeometry with 4 segments has a
    // square base of CIRCUMradius r, i.e. half-side r/sqrt(2) -- the old
    // r = max(w,d)*0.62 therefore gave a half-side of only 0.44*max(w,d),
    // a cap far narrower than the tower it sat on. r = max(w,d)*0.80 makes
    // the half-side ~0.57*max(w,d), so it oversails the parapet the way
    // the 17th-c. bird's-eye view (Daumont, "en vue d'oyseau") shows.
    var roof = mkCone(Math.max(w,d)*0.80, roofH, 4, roofCaps.mat);
    roof.rotation.y = Math.PI/4;
    place(roof, cx, h+MER+roofH/2, cz);
    roofCaps.group.add(roof);
    if (!opts.gate){
      // arrow-loop windows -- skipped on gate towers: their front face is
      // now a real opening, a window column there would float in the void
      var storeys = Math.floor(h/5.4);
      for (var s=0;s<storeys;s++){
        var wm = mkBox(0.6,1.8,0.4, windowMat);
        place(wm, cx+fg.dir.x*(d/2-0.02), 3.4+s*5.4, cz+fg.dir.z*(d/2-0.02), ry);
        fg.group.add(wm);
      }
    }
    if (opts.gate){
      var openW2 = Math.min(GATE_OPEN_W, w-2.6), openH2 = GATE_OPEN_H;
      if (opts.isMain){
        // portcullis, RAISED into the housing above the opening (a small
        // peek below the lintel, mostly tucked into the solid stone above
        // so it reads as "raised", not blocking the passage below it)
        var pg = new T.Group();
        var pgMat = metalMat.clone(); // per-tower clone: both gate towers fade independently
        var gridH = 2.6, gridY = openH2 - 0.3 + gridH/2;
        for (var bi=-3;bi<=3;bi++) pg.add(place(mkBox(0.1,gridH,0.1, pgMat), cx+bi*(openW2/7)*co, gridY, cz-bi*(openW2/7)*si));
        for (var bj=0;bj<3;bj++) pg.add(place(mkBox(openW2*0.9,0.1,0.1, pgMat), cx, openH2-0.3+bj*(gridH/2.2), cz));
        fg.group.add(pg);
      }
      // open double doors, swung flat against the new opening's own
      // pillars (the reveals either side of the gap) instead of a single
      // closed leaf blocking it -- decorative, so kept in interiorGroup
      // like Bodiam's equivalent open gate doors (never fades).
      var leafLen = d*0.42, leafH = openH2*0.94;
      [-1,1].forEach(function(side){
        var lx = side*(openW2/2-0.08);
        var lz = d/2 - leafLen/2 - 0.15;
        var leaf = mkBox(0.16, leafH, leafLen, woodMat);
        place(leaf, cx+lx*co+fg.dir.x*lz, leafH/2+0.05, cz-lx*si+fg.dir.z*lz, ry);
        interiorGroup.add(leaf);
      });
    }
    registerPick(pickables, 'structure', cx, h*0.4, cz, w*1.7, h*0.8, d*1.7, opts.label, opts.desc);
  }

  buildTower(tParis, -OHX, -OHZ, 0, { w:TOWER_W, d:TOWER_D,
    label:'パリ塔 Tour de Paris', desc:'北西隅の塔。全高42mの中世当時の姿に復元。パリへ向かう方角にちなむ。' });
  buildTower(tVillage, 0, -OHZ, 0, { w:GATE_W, d:GATE_D, roofH:GATE_ROOF_H, gate:true, isMain:true,
    label:'村門塔 Tour du Village (主門)', desc:'城の正門。北壁中央にそびえる最大の塔で、城下と結ぶ最も重要な出入口。' });
  buildTower(tReservoir, OHX, -OHZ, 0, { w:TOWER_W, d:TOWER_D,
    label:'貯水塔 Tour du Réservoir', desc:'北東隅の塔。全高42mの中世当時の姿に復元。' });
  buildTower(tDiable, OHX, -70, -Math.PI/2, { w:TOWER_W, d:TOWER_D,
    label:'悪魔塔 Tour du Diable', desc:'東の長城壁沿いに立つ側防塔の一つ。' });
  buildTower(tSalves, OHX, 10, -Math.PI/2, { w:TOWER_W, d:TOWER_D,
    label:'砲撃塔 Tour des Salves', desc:'東の長城壁沿いに立つ側防塔。祝砲を放った塔と伝わる。' });
  buildTower(tSurintendance, OHX, 95, -Math.PI/2, { w:TOWER_W, d:TOWER_D,
    label:'財務総監塔 Tour de la Surintendance', desc:'東の長城壁沿いに立つ側防塔。財務総監の執務にちなむ。' });
  buildTower(tRoi, -OHX, OHZ, Math.PI, { w:TOWER_W, d:TOWER_D,
    label:'王塔 Tour du Roi', desc:'南西隅の塔。全高42mの中世当時の姿に復元。' });
  buildTower(tBois, 0, OHZ, Math.PI, { w:GATE2_W, d:GATE2_D, roofH:GATE2_ROOF_H, gate:true, isMain:false,
    label:'木の門塔 Tour du Bois (第二門)', desc:'南壁中央の第二の門。ヴァンセンヌの森側への出入口。' });
  buildTower(tReine, OHX, OHZ, Math.PI, { w:TOWER_W, d:TOWER_D,
    label:'王妃塔 Tour de la Reine', desc:'南東隅の塔。全高42mの中世当時の姿に復元。' });

  /* -------------------------------------------------------------- *
   * donjon (keep): 16.5m square, 52m tall, four full-height corner
   * turrets (7.2m diameter -- thickened for visual presence against the
   * 16.5m body), a north stair tower, projecting machicolation-style
   * cornices near the top (body + turrets) and a flat dark roof cap.
   * Enclosed by a 13m chemise wall (raised from the previous 5m) with a
   * slate-capped wall-walk, corner bartizans, a decorative gate facing
   * the bailey, and its own moat (reusing buildWaterMoatSystem -- square
   * footprint fits the shared helper directly) with two drawbridges. The
   * whole complex bites into and bulges out past the west curtain wall,
   * matching the official plan. Two-tier cutaway: donjon shell fades
   * only once the outer enceinte has already faded away (tier 'inner').
   * -------------------------------------------------------------- */
  var DCX = -95, DCZ = 50;              // donjon complex centre (bulging past the west wall)
  var DHALF = 8.25, DH = 52;            // 16.5m square footprint, 52m to the turret tops
  // Every photo of the keep (Commons "Chateau-de-Vincennes-donjon.jpg",
  // "Château de Vincennes Paris FRA 002.jpg") shows the four corner
  // turrets carrying ON UP past the square body's parapet and finishing
  // with their own machicolated crowns a storey higher. The previous model
  // ran body and turrets to the same 52m and capped both flat, so the body
  // disappeared between four equal cylinders and read as a bundle of
  // pipes. BODY_H is now the body's parapet, DH the turret tops.
  // Measured off the frontal photographs: the turret crowns clear the body
  // parapet by only about 7% of the keep's height (~3.5m), not the 7m a
  // 45m body would have given -- that read as a deep notch between four
  // stubs rather than one mass with four corner shafts.
  var BODY_H = 48.0;
  var TURR_R = 3.3;                     // corner turret radius (6.6m diameter, per plan)
  var STAIR_R = 3.0;                    // north stair-tower radius

  var dWallN = makeFadeGroup('donjonWallN', {x:0,z:-1}, false, STONE_WALL_V, 'inner');
  var dWallS = makeFadeGroup('donjonWallS', {x:0,z:1},  false, STONE_WALL_V, 'inner');
  var dWallE = makeFadeGroup('donjonWallE', {x:1,z:0},  false, STONE_WALL_V, 'inner');
  var dWallW = makeFadeGroup('donjonWallW', {x:-1,z:0}, false, STONE_WALL_V, 'inner');
  // 隅塔は屋根と同じ段でフェードするが素材は石積み(kind を明示)
  var dTurrets = makeFadeGroup('donjonTurrets', null, true, STONE_WALL_V, 'inner', { kind:'stone', nrm:1.0 });
  var dStair = makeFadeGroup('donjonStair', {x:0,z:-1}, false, STONE_WALL_V, 'inner');
  // ドンジョン頂部だけは実物どおり平らな鉛のテラス(スレートではない)
  var dRoof = makeFadeGroup('donjonRoof', null, true, ROOF_COL, 'inner', { kind:'roof', nrm:0.85 });

  function donjonWallFace(fg, cx, cz, ry){
    var w = mkBox(DHALF*2, BODY_H, 0.9, fg.mat);
    place(w, cx, BODY_H/2, cz, ry);
    fg.group.add(w);
    // machicolation: corbel course then the projecting gallery it carries.
    // The old single 1.3m-deep lip on a 0.9m wall projected 0.2m per side
    // and was invisible; the real keep's corbelled gallery stands ~1.2m
    // proud and throws the deep shadow line that reads from the ground.
    var corbel = mkBox(DHALF*2+1.0, 0.55, 1.9, fg.mat);
    place(corbel, cx, BODY_H-3.1, cz, ry);
    fg.group.add(corbel);
    var machic = mkBox(DHALF*2+2.2, 1.6, 3.1, fg.mat);
    place(machic, cx, BODY_H-2.0, cz, ry);
    fg.group.add(machic);
    addCrenellations(fg.group, fg.mat, cx, cz, DHALF*2+1.6, ry, BODY_H, 2.6);
  }
  donjonWallFace(dWallN, DCX, DCZ-DHALF, 0);
  donjonWallFace(dWallS, DCX, DCZ+DHALF, Math.PI);
  donjonWallFace(dWallE, DCX+DHALF, DCZ, -Math.PI/2);
  donjonWallFace(dWallW, DCX-DHALF, DCZ, Math.PI/2);

  // Photographs show two kinds of opening on each face: tall traceried
  // Gothic windows lighting the king's floors, plus a scatter of small
  // square/slit lights. The previous single column of four identical 0.55m
  // slits gave the 16.5m face nothing to read its size against.
  function donjonWindows(fg, cx, cz, ry){
    var co = Math.cos(ry), si = Math.sin(ry);
    function at(lx, y, w, h){
      var win = mkBox(w, h, 0.35, windowMat);
      place(win, cx + lx*co, y, cz - lx*si, ry);
      fg.group.add(win);
    }
    for (var lvl=0; lvl<4; lvl++){
      var y = 5.4 + lvl*10.4;
      if (lvl === 1 || lvl === 2){
        at(0, y+0.9, 1.5, 3.6);            // tall pointed window, floors 2-3
        at(-4.2, y, 0.5, 1.5);
        at( 4.2, y, 0.5, 1.5);
      } else {
        at(-2.6, y, 0.5, 1.6);
        at( 2.6, y, 0.5, 1.6);
      }
    }
    at(0, BODY_H-7.2, 0.5, 1.4);           // upper guard storey slit
  }
  donjonWindows(dWallN, DCX, DCZ-DHALF, 0);
  donjonWindows(dWallS, DCX, DCZ+DHALF, Math.PI);
  donjonWindows(dWallE, DCX+DHALF, DCZ, -Math.PI/2);
  donjonWindows(dWallW, DCX-DHALF, DCZ, Math.PI/2);

  var turretPos = [
    {x:DCX-DHALF, z:DCZ-DHALF}, {x:DCX+DHALF, z:DCZ-DHALF},
    {x:DCX+DHALF, z:DCZ+DHALF}, {x:DCX-DHALF, z:DCZ+DHALF}
  ];
  turretPos.forEach(function(p){
    // shaft runs the full 52m, i.e. a clear 7m past the body's parapet
    var t = mkCyl(TURR_R, TURR_R*1.04, DH-2.6, 16, dTurrets.mat);
    place(t, p.x, (DH-2.6)/2, p.z);
    dTurrets.group.add(t);
    // each turret repeats the body's crown at its own, higher level
    var tcorbel = mkCyl(TURR_R*1.14, TURR_R*1.06, 0.5, 16, dTurrets.mat);
    place(tcorbel, p.x, DH-3.4, p.z);
    dTurrets.group.add(tcorbel);
    var tlip = mkCyl(TURR_R*1.34, TURR_R*1.24, 1.3, 16, dTurrets.mat);
    place(tlip, p.x, DH-2.5, p.z);
    dTurrets.group.add(tlip);
    var parapet = mkCyl(TURR_R*1.3, TURR_R*1.32, 1.9, 16, dTurrets.mat);
    place(parapet, p.x, DH-0.9, p.z);
    dTurrets.group.add(parapet);
    var cap = mkCyl(TURR_R*1.2, TURR_R*1.2, 0.5, 16, dRoof.mat); // flat lead terrace, not conical
    place(cap, p.x, DH-0.15, p.z);
    dRoof.group.add(cap);
  });

  // north stair turret: in the photos it is a slim shaft climbing the back
  // of the keep and finishing just under the body parapet.
  var stairCz = DCZ - DHALF - STAIR_R*0.7;
  var stairShaft = mkCyl(STAIR_R, STAIR_R*1.05, BODY_H-1.5, 14, dStair.mat);
  place(stairShaft, DCX, (BODY_H-1.5)/2, stairCz);
  dStair.group.add(stairShaft);
  var stairLip = mkCyl(STAIR_R*1.2, STAIR_R*1.12, 0.9, 14, dStair.mat);
  place(stairLip, DCX, BODY_H-1.9, stairCz);
  dStair.group.add(stairLip);
  var stairCap = mkCyl(STAIR_R*1.06, STAIR_R*1.06, 0.5, 14, dRoof.mat);
  place(stairCap, DCX, BODY_H-1.2, stairCz);
  dRoof.group.add(stairCap);
  registerPick(pickables, 'structure', DCX, BODY_H*0.4, stairCz, STAIR_R*2.4, BODY_H*0.7, STAIR_R*2.4,
    '螺旋階段塔 Spiral Staircase Tower', 'ドンジョン北面に付属する塔。各階を結ぶ螺旋階段を収める。');

  // flat lead terrace over the body, sunk just inside its parapet
  var donjonRoofMesh = mkBox(DHALF*2-1.2, 0.6, DHALF*2-1.2, dRoof.mat);
  place(donjonRoofMesh, DCX, BODY_H-0.6, DCZ);
  dRoof.group.add(donjonRoofMesh);

  registerPick(pickables, 'structure', DCX, DH*0.4, DCZ, DHALF*2+TURR_R*2, DH*0.75, DHALF*2+TURR_R*2,
    'ドンジョン Donjon (大塔)', '高さ52m、一辺16.5mの主塔。四隅の円形小塔が本体の胸壁を越えて立ち上がり、マシクレーション(石落とし)の張り出しが本体・小塔それぞれの頂部を巡る、当時ヨーロッパ最大級の居住塔。');

  /* ---- five floors: basement + 3 lower floors (decorative central
   * pillar) + upper guard/armoury levels. All furniture sits in
   * interiorGroup, hidden behind the still-opaque donjon shell until the
   * inner-tier cutaway fades it. ---------------------------------- */
  var donjonFloors = [
    { y0:-4, y1:0,     name:'地下貯蔵庫 Basement Storage', pillar:true,
      desc:'石造ヴォールト天井の貯蔵庫。食料や物資を保管した。' },
    { y0:0, y1:10.4,   name:'評議の間 Chamber of Council (1F)', pillar:true,
      desc:'国王が重臣と政務を協議した、玄関階(テラスレベル)の広間。' },
    { y0:10.4, y1:20.8, name:"王の寝室 King's Bedchamber (2F)", pillar:true, fireplace:true,
      desc:'シャルル5世の私室。中央柱と暖炉を備えた、大塔で最も格式高い部屋。' },
    { y0:20.8, y1:31.2, name:'賓客の間 Guest Chamber (3F)', pillar:true,
      desc:'来賓を迎えた部屋。下層4フロア共通の装飾中央柱で天井を支える。' },
    { y0:31.2, y1:BODY_H, name:'兵士詰所・弾薬庫 Guard Room & Armoury (Upper)', pillar:false,
      desc:'上層階は守備兵の詰所と武具・弾薬の保管に充てられた。' }
  ];
  /* Interior clear span: the 16.5m body less its 0.9m wall faces, and the
   * four corner turret shafts (r = TURR_R) bite into the corners -- so
   * furniture stays inside |dx|,|dz| <= ~6.4 and off the diagonals. */
  var IN_HALF = 7.35;   // where the vault ribs die into the wall head

  /* The keep's single most-photographed interior feature: on each of the
   * four lower floors a decorated central pillar carries the vault, and
   * the ribs fan out from its capital to the wall heads and corners. */
  function donjonVault(y0, y1, rich){
    var capOff = Math.min(2.8, (y1-y0)*0.42);
    var capY = y1 - capOff;
    var ceil = y1 - 0.45;
    cylAt(interiorGroup, DCX, y0+0.42, DCZ, 1.05, 1.25, 0.55, 10, ribMat);           // moulded base
    cylAt(interiorGroup, DCX, (y0+0.7+capY)/2, DCZ, 0.62, 0.72, capY-y0-0.7, 10, stubMat); // shaft
    if (rich){
      cylAt(interiorGroup, DCX, y0+(capY-y0)*0.5, DCZ, 0.78, 0.78, 0.3, 10, ribMat); // mid annulet
    }
    cylAt(interiorGroup, DCX, capY+0.25, DCZ, 1.15, 0.7, 0.85, 10, ribMat);          // capital
    cylAt(interiorGroup, DCX, capY+0.78, DCZ, 1.25, 1.25, 0.24, 10, ribMat);         // abacus
    var springY = capY + 0.9;
    var dirs = [[1,0],[0,1],[-1,0],[0,-1],[1,1],[1,-1],[-1,-1],[-1,1]];
    dirs.forEach(function(d){
      beamBetween(interiorGroup, DCX, springY, DCZ,
        DCX + d[0]*IN_HALF, ceil, DCZ + d[1]*IN_HALF, 0.34, 0.42, ribMat);
    });
    // boss where the ribs meet over the pillar
    cylAt(interiorGroup, DCX, ceil-0.1, DCZ, 0.55, 0.55, 0.3, 8, ribMat);
  }

  donjonFloors.forEach(function(f, fi){
    var slabMat = fi===0 ? flagstoneMat : (fi===4 ? timberMat : floorMat);
    var slab = mkBox(DHALF*2-0.6, 0.3, DHALF*2-0.6, slabMat);
    place(slab, DCX, f.y0+0.15, DCZ);
    interiorGroup.add(slab);
    var y = f.y0 + 0.3;                       // walking surface of this floor
    var G = interiorGroup;
    if (f.pillar) donjonVault(f.y0, f.y1, fi===2);

    if (fi === 0){
      /* 地下 = 貯蔵庫: 樽・穀物袋・氷室 */
      addBarrel(G, DCX-4.6, y, DCZ-4.4, 0.62, 1.5);
      addBarrel(G, DCX-4.6, y, DCZ-2.8, 0.62, 1.5);
      addBarrel(G, DCX-3.2, y, DCZ-3.6, 0.62, 1.5);
      addBarrel(G, DCX+4.4, y, DCZ-3.4, 0.6, 1.4, true, 0);
      addBarrel(G, DCX+4.4, y, DCZ-1.9, 0.6, 1.4, true, 0);
      addBarrel(G, DCX+4.4, y+1.2, DCZ-2.65, 0.6, 1.4, true, 0);
      addSack(G, DCX-4.2, y, DCZ+3.6, 0.45);
      addSack(G, DCX-3.1, y, DCZ+4.1, 0.42);
      addSack(G, DCX-2.2, y, DCZ+3.3, 0.4);
      addSack(G, DCX-3.6, y+0.9, DCZ+3.8, 0.4);
      addSack(G, DCX+2.6, y, DCZ+4.3, 0.44);
      // 氷室: 石枠に藁を敷いた氷の桝
      boxAt(G, DCX+4.0, y+0.35, DCZ+3.6, 2.6, 0.7, 2.2, flagstoneMat);
      boxAt(G, DCX+4.0, y+0.78, DCZ+3.6, 2.2, 0.2, 1.8, linenMat);
      // 棚(木枠)
      boxAt(G, DCX+0.2, y+1.55, DCZ-6.6, 5.4, 0.1, 0.8, woodMat);
      boxAt(G, DCX+0.2, y+0.85, DCZ-6.6, 5.4, 0.1, 0.8, woodMat);
      [-2.5, 0.2, 2.9].forEach(function(sx){
        boxAt(G, DCX+sx, y+0.9, DCZ-6.6, 0.14, 1.8, 0.8, woodMat);
      });
      addBarrel(G, DCX-1.3, y+1.7, DCZ-6.6, 0.28, 0.5);
      addBarrel(G, DCX+1.6, y+1.7, DCZ-6.6, 0.28, 0.5);
      boxAt(G, DCX+0.4, y+0.05, DCZ+0.2, 4.0, 0.08, 3.0, strawMat);   // 藁敷き
    } else if (fi === 1){
      /* 1階 = 評議の間 */
      addTable(G, DCX-0.4, y, DCZ+1.2, 5.6, 1.5, 0, woodMat);
      addBench(G, DCX-0.4, y, DCZ+2.5, 5.0, 0, woodMat);
      addBench(G, DCX-0.4, y, DCZ-0.1, 5.0, 0, woodMat);
      // 王の座: 西壁側の壇と背の高い椅子
      boxAt(G, DCX-5.9, y+0.2, DCZ, 2.6, 0.4, 3.4, ribMat);
      addChair(G, DCX-5.9, y+0.4, DCZ, Math.PI/2, darkWoodMat);
      boxAt(G, DCX-6.9, y+2.6, DCZ, 0.12, 2.6, 2.2, clothBlueMat);   // 王旗
      addFireplace(G, DCX+7.7, y, DCZ-2.6, -Math.PI/2, 2.6);
      addWallHanging(G, DCX+0.4, y+3.4, DCZ-7.6, 0, 4.4, 3.0, clothRedMat);
      addCandleStand(G, DCX+3.4, y, DCZ+3.0);
      addCandleStand(G, DCX-4.2, y, DCZ+3.6);
      addChest(G, DCX+4.6, y, DCZ+5.2, 1.7, 0.9, 0, woodMat);
      boxAt(G, DCX+1.4, y+0.02, DCZ+1.2, 6.4, 0.06, 4.4, clothRedMat); // 敷物
      addTorch(G, DCX-7.7, y+2.6, DCZ-4.6, Math.PI/2);
      addTorch(G, DCX-7.7, y+2.6, DCZ+4.6, Math.PI/2);
    } else if (fi === 2){
      /* 2階 = 王の寝室(この城の白眉): 中央柱・天蓋付き寝台・暖炉・浴室 */
      addCanopyBed(G, DCX-4.3, y, DCZ+3.4, Math.PI/2, clothRedMat);
      addFireplace(G, DCX+7.7, y, DCZ+1.2, -Math.PI/2, 3.0);
      // 浴室の記録: 木桶の風呂と衝立
      cylAt(G, DCX+4.2, y+0.45, DCZ-5.2, 1.05, 0.95, 0.9, 10, woodMat);
      cylAt(G, DCX+4.2, y+0.86, DCZ-5.2, 0.95, 0.95, 0.12, 10, bathWaterMat);
      cylAt(G, DCX+4.2, y+0.95, DCZ-5.2, 1.1, 1.1, 0.1, 10, metalMat);
      boxAt(G, DCX+2.6, y+1.0, DCZ-5.2, 0.12, 2.0, 2.6, linenMat);
      // 書見台と椅子
      boxAt(G, DCX+0.2, y+0.55, DCZ-6.2, 0.24, 1.1, 0.24, darkWoodMat);
      var lect = mkBox(0.9, 0.1, 0.7, darkWoodMat);
      place(lect, DCX+0.2, y+1.15, DCZ-6.2); lect.rotation.x = -0.42; G.add(lect);
      boxAt(G, DCX+0.2, y+1.28, DCZ-6.35, 0.6, 0.07, 0.4, linenMat);
      addChair(G, DCX+0.2, y, DCZ-5.1, Math.PI, darkWoodMat);
      addChest(G, DCX-5.6, y, DCZ-4.4, 2.0, 1.0, Math.PI/2, woodMat);
      addWallHanging(G, DCX-2.0, y+4.0, DCZ-7.6, 0, 5.0, 3.4, clothBlueMat);
      addWallHanging(G, DCX+1.6, y+4.0, DCZ+7.6, Math.PI, 4.2, 3.0, clothGoldMat);
      addCandleStand(G, DCX-1.6, y, DCZ+4.4);
      addCandleStand(G, DCX+3.6, y, DCZ+4.4);
      addTorch(G, DCX-7.7, y+2.8, DCZ+0.0, Math.PI/2);
      boxAt(G, DCX-2.6, y+0.02, DCZ+2.0, 6.0, 0.06, 6.0, clothRedMat);
    } else if (fi === 3){
      /* 3階 = 賓客の間 */
      addCanopyBed(G, DCX-4.4, y, DCZ-3.4, 0, clothBlueMat);
      addFireplace(G, DCX+7.7, y, DCZ-1.0, -Math.PI/2, 2.4);
      addTable(G, DCX+1.6, y, DCZ+4.0, 2.6, 1.2, 0, woodMat);
      addStool(G, DCX+0.5, y, DCZ+5.1, woodMat);
      addStool(G, DCX+2.7, y, DCZ+5.1, woodMat);
      // 洗面台と水差し
      boxAt(G, DCX-5.4, y+0.45, DCZ+4.6, 1.0, 0.9, 0.6, woodMat);
      cylAt(G, DCX-5.4, y+1.02, DCZ+4.6, 0.28, 0.24, 0.24, 8, metalMat);
      cylAt(G, DCX-4.7, y+1.05, DCZ+4.6, 0.14, 0.19, 0.3, 6, metalMat);
      // 衣装櫃と衣桁
      addChest(G, DCX+4.6, y, DCZ+6.2, 1.8, 1.0, 0, woodMat);
      boxAt(G, DCX-1.4, y+2.1, DCZ-7.4, 2.4, 0.12, 0.12, woodMat);
      boxAt(G, DCX-1.4, y+1.4, DCZ-7.3, 1.4, 1.4, 0.14, clothGoldMat);
      addWallHanging(G, DCX+2.6, y+3.6, DCZ+7.6, Math.PI, 4.0, 2.8, clothRedMat);
      addCandleStand(G, DCX+4.4, y, DCZ+1.6);
      boxAt(G, DCX-1.0, y+0.02, DCZ+1.0, 5.4, 0.06, 5.0, clothBlueMat);
    } else {
      /* 上層 = 兵士詰所 + 中二階の弾薬・武具庫 */
      var mezY = 39.9;
      boxAt(G, DCX, mezY, DCZ+2.6, DHALF*2-1.2, 0.26, 9.2, timberMat);
      // 中二階を支える梁
      [-4.4, 0.0, 4.4].forEach(function(bx){
        boxAt(G, DCX+bx, mezY-0.35, DCZ+2.6, 0.3, 0.45, 9.2, woodMat);
      });
      // 梯子
      beamBetween(G, DCX-5.2, y, DCZ-1.6, DCX-5.2, mezY, DCZ-3.4, 0.12, 0.12, woodMat);
      beamBetween(G, DCX-4.2, y, DCZ-1.6, DCX-4.2, mezY, DCZ-3.4, 0.12, 0.12, woodMat);
      for (var lr=0; lr<9; lr++){
        var t = (lr+0.5)/9;
        boxAt(G, DCX-4.7, y + t*(mezY-y), DCZ-1.6 - t*1.8, 1.2, 0.09, 0.16, woodMat);
      }
      // 詰所: 藁のパレット・卓・火鉢
      [[-5.8,4.6],[-3.6,5.4],[-1.4,4.6]].forEach(function(p){
        boxAt(G, DCX+p[0], y+0.16, DCZ+p[1], 2.0, 0.32, 1.0, strawMat);
        boxAt(G, DCX+p[0], y+0.4, DCZ+p[1]-0.2, 1.6, 0.16, 0.7, clothBlueMat);
      });
      addTable(G, DCX+3.6, y, DCZ+3.2, 2.4, 1.1, 0, woodMat);
      addBench(G, DCX+3.6, y, DCZ+4.3, 2.2, 0, woodMat);
      cylAt(G, DCX+0.6, y+0.5, DCZ-0.6, 0.75, 0.5, 0.9, 8, metalMat);   // 火鉢
      cylAt(G, DCX+0.6, y+0.98, DCZ-0.6, 0.6, 0.6, 0.18, 8, emberMat);
      addArmsRack(G, DCX+1.0, y, DCZ-7.2, 0, 7);
      addArmsRack(G, DCX-3.4, y, DCZ-7.2, 0, 7);
      // 壁の盾
      [-2.0, 0.6, 3.2].forEach(function(sx, si){
        var sh = mkCyl(0.55, 0.42, 0.14, 6, si===1 ? clothRedMat : clothBlueMat);
        sh.rotation.x = Math.PI/2;
        place(sh, DCX+sx, y+3.4, DCZ+7.5);
        G.add(sh);
      });
      // 中二階の弾薬庫: 火薬樽・木箱・積み上げた石弾
      addBarrel(G, DCX-4.2, mezY+0.13, DCZ+4.4, 0.55, 1.3);
      addBarrel(G, DCX-2.9, mezY+0.13, DCZ+5.2, 0.55, 1.3);
      addBarrel(G, DCX-4.4, mezY+0.13, DCZ+6.0, 0.55, 1.3);
      boxAt(G, DCX+1.4, mezY+0.53, DCZ+4.6, 1.8, 0.8, 1.2, woodMat);
      boxAt(G, DCX+3.6, mezY+0.43, DCZ+5.6, 1.4, 0.6, 1.0, woodMat);
      [[2.6,2.2],[3.5,2.2],[3.05,3.0],[3.05,2.6]].forEach(function(p, pi){
        var ball = mkSphere(0.42, flagstoneMat);
        place(ball, DCX+p[0], mezY+0.55 + (pi===3?0.6:0), DCZ+p[1]);
        G.add(ball);
      });
      addArmsRack(G, DCX-0.6, mezY+0.13, DCZ+7.0, 0, 6);
    }
    registerPick(pickables, 'room', DCX, (f.y0+f.y1)/2, DCZ, DHALF*2-0.8, f.y1-f.y0-0.4, DHALF*2-0.8, f.name, f.desc);
  });

  /* 北の付属塔の螺旋階段: 各階を結ぶ実物の主動線。塔の躯体(dStair)が
   * 内側ティアでフェードすると現れる。 */
  (function(){
    cylAt(interiorGroup, DCX, 23.4, stairCz, 0.42, 0.42, 46.8, 8, ribMat); // 中心柱
    var steps = 58, topY = 46.4, rr = 1.28;
    for (var i=0;i<steps;i++){
      var a = i*0.46, sy = 0.55 + i*(topY/steps);
      var tread = mkBox(1.85, 0.2, 0.85, ribMat);
      place(tread, DCX + Math.cos(a)*rr, sy, stairCz + Math.sin(a)*rr, -a);
      interiorGroup.add(tread);
    }
  })();

  /* 屋根の煙突: 各階の暖炉がひとつの煙道にまとまって鉛のテラスへ抜ける */
  [[2.9, -1.4], [2.9, 3.4]].forEach(function(c){
    var st = mkBox(1.5, 3.2, 1.5, dRoof.mat);
    place(st, DCX+c[0], BODY_H+1.2, DCZ+c[1]);
    dRoof.group.add(st);
    var capm = mkBox(1.9, 0.35, 1.9, dRoof.mat);
    place(capm, DCX+c[0], BODY_H+2.95, DCZ+c[1]);
    dRoof.group.add(capm);
  });

  /* ---- chemise (13m outer skirt wall around the donjon, raised from
   * the previous 5m stub): a slate-capped wall-walk, four corner
   * bartizans with conical slate roofs, a decorative gate on the
   * bailey-facing (east) side, its own moat via the shared square-moat
   * helper, and two drawbridges. ------------------------------------ */
  var CHEM_HALF = 24, CHEM_H = 13;
  function chemiseSide(cx,cz,length,ry, inDir){
    var co = Math.cos(ry), si = Math.sin(ry);
    // inDir = unit vector pointing INWARD (towards the donjon) in world XZ,
    // used to lean the covered wall-walk roof back off the parapet.
    var w = mkBox(length, CHEM_H, 1.4, chemiseMat);
    place(w, cx, CHEM_H/2, cz, ry);
    group.add(w);
    // corbelled machicolation gallery ringing the chemise just under its
    // parapet -- the single most recognisable band in every photograph of
    // the keep enclosure, and previously missing entirely.
    var corbel = mkBox(length, 0.5, 2.0, chemiseMat);
    place(corbel, cx, CHEM_H-1.9, cz, ry);
    group.add(corbel);
    var machic = mkBox(length, 1.4, 2.9, chemiseMat);
    place(machic, cx, CHEM_H-0.7, cz, ry);
    group.add(machic);
    // parapet standing on the gallery, pierced by the row of rectangular
    // openings the photos show at wall-walk level
    var parapet = mkBox(length, 2.4, 1.5, chemiseMat);
    place(parapet, cx - inDir.x*0.6, CHEM_H+1.2, cz - inDir.z*0.6, ry);
    group.add(parapet);
    for (var oi=-1, n=Math.floor(length/6); oi<n; oi++){
      var lx = -length/2 + 3 + (oi+1)*6;
      if (Math.abs(lx) > length/2-2) continue;
      var slot = mkBox(1.5, 1.1, 1.7, windowMat);
      place(slot, cx + lx*co - inDir.x*0.6, CHEM_H+1.5, cz - lx*si - inDir.z*0.6, ry);
      group.add(slot);
    }
    // covered wall-walk: a single-pitch slate shed leaning inward off the
    // parapet, matching the continuous dark roof that runs round the top
    // of the chemise in the reference photos.
    var runW = 4.4, drop = 1.6;
    var slabLen = Math.hypot(runW, drop);
    var shed = mkBox(length+0.6, 0.35, slabLen, slateMat);
    shed.position.set(cx + inDir.x*(runW/2-0.2), CHEM_H+2.4 - drop/2, cz + inDir.z*(runW/2-0.2));
    shed.rotation.y = ry;
    // local +Z always points inward (rotation.y = ry already applied), so a
    // POSITIVE rotateX drops the inner edge -- the pitch falls away from
    // the parapet towards the keep, as the photos show.
    shed.rotateX(Math.atan2(drop, runW));
    shed.castShadow = true; shed.receiveShadow = true;
    group.add(shed);
  }
  var CHEM_GATE_W = 9.5;   // footprint of the chatelet built below
  chemiseSide(DCX, DCZ-CHEM_HALF, CHEM_HALF*2, 0,          {x:0,z:1});
  chemiseSide(DCX, DCZ+CHEM_HALF, CHEM_HALF*2, Math.PI,    {x:0,z:-1});
  // east side is split either side of the chatelet's own footprint so the
  // gate tower's arched passage opens onto real daylight, not a solid
  // panel of chemise wall standing behind it
  (function(){
    var seg = (CHEM_HALF*2 - CHEM_GATE_W)/2, off = CHEM_GATE_W/2 + seg/2;
    chemiseSide(DCX+CHEM_HALF, DCZ-off, seg, -Math.PI/2, {x:-1,z:0});
    chemiseSide(DCX+CHEM_HALF, DCZ+off, seg, -Math.PI/2, {x:-1,z:0});
  })();
  chemiseSide(DCX-CHEM_HALF, DCZ, CHEM_HALF*2, Math.PI/2,  {x:1,z:0});

  var bartPos = [
    {x:DCX-CHEM_HALF, z:DCZ-CHEM_HALF}, {x:DCX+CHEM_HALF, z:DCZ-CHEM_HALF},
    {x:DCX+CHEM_HALF, z:DCZ+CHEM_HALF}, {x:DCX-CHEM_HALF, z:DCZ+CHEM_HALF}
  ];
  bartPos.forEach(function(p){
    // corner bartizans: in the photos these are the tallest thing on the
    // chemise -- a corbelled drum carried from well below the wall-walk and
    // a slate cone about as tall as the drum is wide again. The old 3m drum
    // + 2m cone barely cleared the parapet.
    var bt = mkCyl(2.0, 2.1, 7.0, 14, chemiseMat);
    place(bt, p.x, CHEM_H-1.0, p.z);
    group.add(bt);
    var btLip = mkCyl(2.35, 2.2, 0.7, 14, chemiseMat);
    place(btLip, p.x, CHEM_H+2.1, p.z);
    group.add(btLip);
    var cap = mkCone(2.5, 5.6, 14, slateMat);
    place(cap, p.x, CHEM_H+2.5+5.6/2, p.z);
    group.add(cap);
  });

  /* chatelet: the chemise's own gate tower on the bailey-facing (east)
   * side. This is the single most recognisable element of the keep
   * enclosure in the frontal photographs (Commons "Vincennes - Chateau
   * 02.jpg") -- a square tower standing well above the chemise parapet,
   * flanked by two round turrets running its full height, pierced by an
   * arched passage, and crowned by its own machicolation. It replaces the
   * previous flat "gate decal" on the wall face. */
  (function(){
    var GW = CHEM_GATE_W, GD = 6.0, GH = 23.0, gx = DCX+CHEM_HALF, gz = DCZ;
    var openW = 3.6, openH = 6.4;
    var pillarW = (GW-openW)/2;
    [-1,1].forEach(function(side){
      var pil = mkBox(GD, GH, pillarW, chemiseMat);
      place(pil, gx, GH/2, gz + side*(openW/2+pillarW/2));
      group.add(pil);
    });
    var lintel = mkBox(GD, GH-openH, openW, chemiseMat);
    place(lintel, gx, openH+(GH-openH)/2, gz);
    group.add(lintel);
    var arch = mkCone(openW*0.62, 2.2, 3, windowMat);
    arch.rotation.y = Math.PI/2;
    place(arch, gx+GD/2-0.1, openH+0.5, gz);
    group.add(arch);
    // flanking round turrets, full height, corbelled crown like the keep's
    [-1,1].forEach(function(side){
      // set well forward of the tower's own front face so they read as two
      // free-standing drums flanking the arch, as in the photographs
      var tz = gz + side*(GW/2), tx = gx + GD/2 - 0.9;
      var tur = mkCyl(2.2, 2.3, GH-1.6, 14, chemiseMat);
      place(tur, tx, (GH-1.6)/2, tz);
      group.add(tur);
      var tlip = mkCyl(2.6, 2.35, 1.1, 14, chemiseMat);
      place(tlip, tx, GH-1.7, tz);
      group.add(tlip);
      var tpar = mkCyl(2.55, 2.6, 1.6, 14, chemiseMat);
      place(tpar, tx, GH-0.4, tz);
      group.add(tpar);
      var tcap = mkCyl(2.4, 2.4, 0.4, 14, slateMat);
      place(tcap, tx, GH+0.3, tz);
      group.add(tcap);
    });
    var gCorbel = mkBox(GD+1.0, 0.5, GW+1.0, chemiseMat);
    place(gCorbel, gx, GH-3.0, gz);
    group.add(gCorbel);
    var gMachic = mkBox(GD+2.0, 1.4, GW+2.0, chemiseMat);
    place(gMachic, gx, GH-1.9, gz);
    group.add(gMachic);
    addCrenellations(group, chemiseMat, gx, gz, GW+1.6, -Math.PI/2, GH-1.2, GD+1.6);
    // timber approach deck through the arch, meeting the east drawbridge
    var deck = mkBox(GD+1.2, 0.3, openW, woodMat);
    place(deck, gx, 0.12, gz);
    group.add(deck);
  })();

  registerPick(pickables, 'structure', DCX, CHEM_H*0.5, DCZ-CHEM_HALF, CHEM_HALF*2, CHEM_H, 2,
    'シェミーズ Chemise Wall', '高さ13mでドンジョンを囲む方形の防壁。隅の物見(バルティザン)と専用の堀を伴い、大塔だけの独立した防御線を成す。');

  /* ================================================================== *
   * ドンジョンの堀 -- le fossé sec du donjon
   * ------------------------------------------------------------------
   * REBUILT FROM PHOTOGRAPHS. The previous version called the shared
   * buildWaterMoatSystem() helper, which is the *Bodiam* idiom: an open
   * WATER surface with smoothly graded EARTH banks on both sides. Every
   * reference below shows that Vincennes' keep ditch is the exact
   * opposite kind of object, and at a completely different scale:
   *
   *   [1] commons.wikimedia.org/wiki/File:Donjon_Château_Vincennes_-_
   *       Vincennes_(FR94)_-_2020-10-04_-_2.jpg
   *       The decisive shot. A DRY ditch with a flat GRASS floor, walled
   *       on BOTH sides by vertical ashlar: a counterscarp on the outside
   *       finished with a flat stone coping level with the bailey, and a
   *       scarp on the inside which is simply the chemise wall carried on
   *       down -- the wall does not stand on the ground, it stands on the
   *       ditch FLOOR, roughly a further storey and a half below grade.
   *   [2] commons.wikimedia.org/wiki/File:Château_de_Vincennes_le_21_
   *       avril_2015_-_07.jpg
   *       Shot from inside the ditch looking up: bare stone/earth floor
   *       (no water anywhere), a row of tall narrow archères raking the
   *       ditch floor along the foot of the chemise, and a small arched
   *       postern opening straight onto the ditch bottom.
   *   [3] commons.wikimedia.org/wiki/File:Donjon_du_château_de_Vincennes,
   *       _vu_de_sous_le_pont_du_châtelet.jpg
   *       From under the châtelet bridge -- the bridge is carried across
   *       the ditch on masonry piers standing on the floor, not laid flat
   *       on a bank.
   *   [4] commons.wikimedia.org/wiki/File:Bastiments_v1_(Gregg_1972_p29)_
   *       -_Vincennes_general_plan.jpg  (Du Cerceau's plan)
   *       The ditch is drawn as a WIDE uniform band all four sides of the
   *       chemise -- the whole donjon complex reads about twice the
   *       chemise's own width, i.e. the ditch is of the order of 20m, not
   *       the 7m ribbon modelled before. Crossings are on the E-W axis,
   *       each carried on a pair of piers standing in the ditch.
   *
   * So the four things that were wrong, and what replaces them:
   *   water  -> dry (no water plane, no waterMat, no ducks in it)
   *   earth banks (smoothstep slopes) -> vertical ashlar revetments
   *   7m wide, 3.2m of it open  -> 20m wide, ~18.6m of it open floor
   *   1.3m deep -> 7m deep, and the chemise now stands on the floor
   * ================================================================== */
  var DITCH_W     = 18.0;                 // scarp face to counterscarp face
  var DITCH_D     = 7.0;                  // grade to ditch floor
  var TERR_Y      = 0.04;                 // the terrace the complex stands on
  var DITCH_FLR   = TERR_Y - DITCH_D;     // ditch floor level
  var SCARP_T     = 2.8;                  // scarp thickness (proud of the 1.4m chemise above)
  var DITCH_IN    = CHEM_HALF + SCARP_T/2;      // 25.4 -- scarp outer face
  var DITCH_OUT   = DITCH_IN + DITCH_W;         // 43.4 -- counterscarp inner face
  var CSCARP_T    = 2.4;                  // counterscarp thickness
  var CPLX_HALF   = DITCH_OUT + CSCARP_T;       // 45.8 -- outside face of the counterscarp
  var TERR_HALF   = CPLX_HALF + 6;              // terrace plate half-extent
  /* The whole complex therefore occupies x -140.8..-49.2 / z 4.2..95.8. That
   * square lands squarely on top of the main enceinte moat, whose water sits
   * at y=-2.6 and whose ground collar sits at y=-1.2 -- both well ABOVE a
   * 7m-deep ditch floor, so without intervention the main moat's own planes
   * simply fill the new ditch in (which is exactly what the first attempt
   * rendered: grass right up to the chemise). Du Cerceau's plan shows the
   * main ditch detouring AROUND the keep complex, so the main moat system is
   * given this rectangle as a keepout -- see DONJON_KEEPOUT below. */
  var DONJON_KEEPOUT = { minX: DCX-CPLX_HALF, maxX: DCX+CPLX_HALF,
                         minZ: DCZ-CPLX_HALF, maxZ: DCZ+CPLX_HALF };

  /* Colours are chosen for how they land AFTER lighting: a daylit
   * horizontal up-face picks up about x1.95, so anything that reads as a
   * top surface has to stay near 120/channel or it blows out. The sunken
   * revetments are near-vertical so they keep the chemise's own limestone
   * family, only greyed a little to separate "wall standing in a ditch"
   * from "wall in the sun"; the coping and the ditch floor are up-faces
   * and are picked well down accordingly. */
  var ditchStoneMat = texMat(0xb6ac92, 'stone', { nrm: 1.0 });        // 堀の石積み(垂直面)
  var ditchCopeMat  = texMat(0x6d6659, 'floor', { nrm: 0.8 });        // 逆壁の天端石(上向き面 x1.95 -> 214,199,173)
  var ditchFloorMat = texMat(0x4a6438, 'turf');                       // 堀底の草(上向き面 x1.95 -> 144,195,109)

  (function buildDonjonDryDitch(){
    /* -- 1. terrace plate: the flat apron the whole complex stands on,
     *      with a square hole punched for the ditch. Same material and
     *      level as before, so nothing downstream sees a change; only the
     *      hole is now the full 90.8m ditch square instead of a 62m one. */
    var terrShape = new T.Shape();
    terrShape.moveTo(-TERR_HALF,-TERR_HALF); terrShape.lineTo(TERR_HALF,-TERR_HALF);
    terrShape.lineTo(TERR_HALF,TERR_HALF); terrShape.lineTo(-TERR_HALF,TERR_HALF); terrShape.closePath();
    var terrHole = new T.Path();
    var TH = CPLX_HALF;
    terrHole.moveTo(-TH,-TH); terrHole.lineTo(-TH,TH); terrHole.lineTo(TH,TH); terrHole.lineTo(TH,-TH); terrHole.closePath();
    terrShape.holes.push(terrHole);
    var terrGeo = new T.ShapeGeometry(terrShape);
    terrGeo.rotateX(-Math.PI/2);
    var terr = new T.Mesh(terrGeo, grassMat2);
    terr.position.set(DCX, TERR_Y, DCZ); terr.receiveShadow = true;
    group.add(terr);
    // the terrace stands proud of the field west of the curtain and the main
    // moat is cut away beneath it, so face its rim with a revetment deep
    // enough to reach below the main moat's water line -- otherwise a
    // ground-level camera outside the west wall looks under the single-sided
    // plate and sees straight into the void.
    // Tucked just INSIDE and just BELOW the plate's edge on purpose: a rim
    // sitting proud of it shows its own up-face, and an up-face in this stone
    // takes the x1.95 daylight multiplier straight to ~(222,211,178), which
    // renders as a hard white outline drawn round the whole keep.
    [[0,-1],[0,1],[-1,0],[1,0]].forEach(function(d){
      var horiz = d[0] === 0;
      var rimH = 4.2, rimT = 1.6;
      var rim = mkBox(horiz ? TERR_HALF*2 : rimT, rimH, horiz ? rimT : TERR_HALF*2, ditchStoneMat);
      place(rim, DCX + d[0]*(TERR_HALF-rimT/2), TERR_Y - 0.06 - rimH/2, DCZ + d[1]*(TERR_HALF-rimT/2));
      group.add(rim);
    });

    /* -- 2. ditch floor: flat grass pan across the whole ditch square.
     *      The middle of it is sealed off by the scarp ring below, so it
     *      only ever shows as the 18.6m walk around the chemise. */
    var flrGeo = new T.PlaneGeometry(DITCH_OUT*2, DITCH_OUT*2);
    flrGeo.rotateX(-Math.PI/2);
    var flr = new T.Mesh(flrGeo, ditchFloorMat);
    flr.position.set(DCX, DITCH_FLR, DCZ); flr.receiveShadow = true;
    group.add(flr);

    /* -- 3. counterscarp: vertical ashlar ring at the outer edge, from the
     *      floor up to grade, finished with the flat coping course that
     *      reads as the hard lip of the ditch in [1]. */
    [[0,-1],[0,1],[-1,0],[1,0]].forEach(function(d){
      var horiz = d[0] === 0;
      var len = (DITCH_OUT + CSCARP_T)*2;
      var cx = DCX + d[0]*(DITCH_OUT + CSCARP_T/2);
      var cz = DCZ + d[1]*(DITCH_OUT + CSCARP_T/2);
      var w = mkBox(horiz ? len : CSCARP_T, DITCH_D, horiz ? CSCARP_T : len, ditchStoneMat);
      place(w, cx, DITCH_FLR + DITCH_D/2, cz);
      group.add(w);
      var cope = mkBox(horiz ? len : CSCARP_T+1.0, 0.45, horiz ? CSCARP_T+1.0 : len, ditchCopeMat);
      place(cope, cx, TERR_Y + 0.22, cz);
      group.add(cope);
    });

    /* -- 4. scarp: the chemise carried down to the ditch floor. Slightly
     *      thicker than the 1.4m wall above so it reads as the battered
     *      base course the photographs show, with the raking archères of
     *      [2] near its head and a postern onto the floor under the
     *      châtelet. */
    [[0,-1],[0,1],[-1,0],[1,0]].forEach(function(d){
      var horiz = d[0] === 0;
      var len = CHEM_HALF*2 + SCARP_T;
      var cx = DCX + d[0]*CHEM_HALF, cz = DCZ + d[1]*CHEM_HALF;
      var w = mkBox(horiz ? len : SCARP_T, DITCH_D + 0.1, horiz ? SCARP_T : len, ditchStoneMat);
      place(w, cx, DITCH_FLR + (DITCH_D + 0.1)/2, cz);
      group.add(w);
      // archères raking the ditch floor, set just under the lip
      for (var s=-3; s<=3; s++){
        var ox = horiz ? s*6.4 : 0, oz = horiz ? 0 : s*6.4;
        var sl = mkBox(horiz ? 0.55 : 0.3, 2.1, horiz ? 0.3 : 0.55, windowMat);
        place(sl, cx + ox + d[0]*(SCARP_T/2), DITCH_FLR + DITCH_D - 2.0, cz + oz + d[1]*(SCARP_T/2));
        group.add(sl);
      }
      // postern at floor level on the bailey (east) face only
      if (d[0] === 1){
        var post = mkBox(0.34, 2.4, 1.8, windowMat);
        place(post, cx + SCARP_T/2, DITCH_FLR + 1.2, cz);
        group.add(post);
      }
    });

    /* -- 5. chemise courtyard floor, previously the moat helper's island. */
    var isGeo = new T.PlaneGeometry(CHEM_HALF*2, CHEM_HALF*2);
    isGeo.rotateX(-Math.PI/2);
    var isl = new T.Mesh(isGeo, courtGrassMat);
    isl.position.set(DCX, 0.06, DCZ); isl.receiveShadow = true;
    group.add(isl);
  })();

  registerPick(pickables, 'structure', DCX, DITCH_FLR + 2.0, DCZ - (DITCH_IN+DITCH_OUT)/2,
    CHEM_HALF*2, 4.0, DITCH_W*0.85,
    'ドンジョンの堀 Donjon Moat (fossé sec)',
    '主郭の水堀とは別に、シェミーズ壁を囲んで大塔単独を守る専用の堀。幅約20m・深さ約7mの「乾堀」で、両側とも切石積みの垂直な壁。シェミーズは地面ではなく堀底から立ち上がり、その足元には堀底を薙ぎ払う矢狭間と通用門が開く。');

  /* crossings: a plank deck carried on two masonry piers standing on the
   * ditch floor, per [3]/[4] -- a flat plank laid across a 20m void would
   * read as a bug. */
  function bridgeAcrossMoat(axis, fixedCoord, outerCoord, innerCoord, w){
    var len = Math.abs(outerCoord-innerCoord), mid = (outerCoord+innerCoord)/2;
    var br = axis==='z' ? mkBox(w, 0.35, len, woodMat) : mkBox(len, 0.35, w, woodMat);
    if (axis==='z') place(br, fixedCoord, TERR_Y+0.18, mid); else place(br, mid, TERR_Y+0.18, fixedCoord);
    group.add(br);
    [1/3, 2/3].forEach(function(t){
      var c = outerCoord + (innerCoord-outerCoord)*t;
      var pierH = DITCH_D - 0.1;
      var pier = mkBox(w*0.8, pierH, w*0.8, ditchStoneMat);
      if (axis==='z') place(pier, fixedCoord, DITCH_FLR + pierH/2, c);
      else place(pier, c, DITCH_FLR + pierH/2, fixedCoord);
      group.add(pier);
    });
  }
  bridgeAcrossMoat('z', DCX, DCZ-DITCH_OUT, DCZ-DITCH_IN, 3.0); // north crossing
  bridgeAcrossMoat('x', DCZ, DCX+DITCH_OUT, DCX+DITCH_IN, 3.4); // east crossing, out of the chatelet

  // raised entrance: the real door sits at first-floor "terrace" level,
  // not grade, reached by a short timber stair from the chemise courtyard
  var entranceStair = mkBox(2.6, 0.3, 3.4, woodMat);
  entranceStair.rotation.x = -0.5;
  place(entranceStair, DCX, 1.6, DCZ+DHALF+2.0);
  interiorGroup.add(entranceStair);
  var doorRecess = mkBox(2.4, 3.2, 0.2, windowMat);
  place(doorRecess, DCX, 2.6, DCZ+DHALF-0.1);
  interiorGroup.add(doorRecess);

  /* -------------------------------------------------------------- *
   * Sainte-Chapelle: single-vessel Flamboyant Gothic chapel, east of
   * centre in the bailey. TWO corrections against the reference material:
   *
   *  1. ORIENTATION. The chapel is a church, so it is laid out liturgically
   *     east-west -- west front towards the donjon, polygonal apse at the
   *     east. The official plan (Commons "Plan Château de Vincennes -
   *     2021.svg") shows it lying ACROSS the enceinte's 175m short axis,
   *     not along its 330m long axis. The previous model ran the 40m nave
   *     north-south, i.e. rotated 90 degrees from the real building.
   *  2. VERTICALITY. Photographs (Commons "Sainte-Chapelle de Vincennes
   *     snow 02.jpg", "...angle 3.JPG") show glass filling practically the
   *     whole bay between buttresses from a low sill right up to the eaves
   *     balustrade, every buttress finishing in a tall crocketed pinnacle,
   *     and the west front framed by two turrets that climb past the
   *     gable. The previous 4.2m windows floating at mid-height read as a
   *     stone barn with slits.
   *
   * In 1380 (this viewer's year) it was still under construction in
   * reality -- begun 1379, completed 1552; noted in the tooltip rather
   * than modelled as a building site.
   * -------------------------------------------------------------- */
  /*  3. HOLLOW SHELL. The chapel used to be one solid 40x15x20m box, so
   *     however far the camera zoomed in there was nothing inside it to
   *     see. It is now a real shell -- 0.9m flank walls, a west front, a
   *     seven-sided apse ring -- carried on FIVE fade groups of the same
   *     'inner' tier the donjon uses, so the enceinte fades first, then
   *     the chapel opens up on the high nave, the altar and the choir.
   *     Buttresses, pinnacles, windows, turrets and spires all live in
   *     the same group as the wall they belong to, so a face and its
   *     ornament always dissolve together. */
  var CHX = 25, CHZ = 25;
  var CH_W = 15, CH_LEN = 40, CH_EAVE = 20, CH_RIDGE = 36;
  var CH_WEST = CHX - CH_LEN/2, CH_EAST = CHX + CH_LEN/2;
  var CH_WT = 0.9;                       // wall thickness
  var CH_IN = CH_W/2 - CH_WT;            // inner face half-width (6.6)
  var CH_COL = 0xdbd2bb;
  /* ---- 礼拝堂だけの石 ---------------------------------------------
   * 城壁・大塔が「城の石工が積んだ防御用の切石」なのに対し、サント・
   * シャペルは装飾建築で、石は一段細かく挽かれ、目地はほとんど見えない。
   * 同じ石灰岩なのでテクスチャは共有し、UV 密度だけを 2.4m -> 1.7m に
   * 詰める(= 1段 0.19m・幅 0.45-0.59m の細い切石)。法線も浅くして
   * 「磨いた面」に寄せる。density を上げるほうを選んだのは、別パラメータ
   * でもう1セット焼くとテクスチャのメモリと生成コストが倍になるため。 */
  var CH_STONE = { density: 1/1.7, nrm: 0.62 };
  var chapN = makeFadeGroup('chapelN', {x:0,z:-1}, false, CH_COL, 'inner', CH_STONE);
  var chapS = makeFadeGroup('chapelS', {x:0,z:1},  false, CH_COL, 'inner', CH_STONE);
  var chapW = makeFadeGroup('chapelW', {x:-1,z:0}, false, CH_COL, 'inner', CH_STONE);
  var chapE = makeFadeGroup('chapelE', {x:1,z:0},  false, CH_COL, 'inner', CH_STONE);
  var chapRoof = makeFadeGroup('chapelRoof', null, true, ROOF_COL, 'inner');
  var chapelGableMat = texMat(CH_COL, 'stone',
    { density: CH_STONE.density, nrm: CH_STONE.nrm, side: T.DoubleSide });

  // ---- flank walls, bay windows, buttresses, pinnacles, balustrade ----
  var CH_BAYS = 5;
  [-1, 1].forEach(function(side){
    var fg = side < 0 ? chapN : chapS;
    var wz = CHZ + side*(CH_W/2 - CH_WT/2);
    var wall = mkBox(CH_LEN, CH_EAVE, CH_WT, fg.mat);
    place(wall, CHX, CH_EAVE/2, wz);
    fg.group.add(wall);
    var sill = 4.2, head = CH_EAVE - 2.2;
    for (var b=0; b<CH_BAYS; b++){
      var bx = CH_WEST + (CH_LEN/CH_BAYS)*(b+0.5);
      var win = mkBox(4.4, head-sill, CH_WT*1.15, windowMat);
      place(win, bx, (sill+head)/2, wz);
      fg.group.add(win);
      var arch = mkCone(2.3, 2.6, 3, windowMat);   // pointed head
      arch.rotation.y = Math.PI/2;
      place(arch, bx, head+1.0, wz);
      fg.group.add(arch);
    }
    for (var q=0; q<=CH_BAYS; q++){
      var qx = CH_WEST + (CH_LEN/CH_BAYS)*q;
      var but = mkBox(1.7, CH_EAVE+0.6, 2.6, fg.mat);
      place(but, qx, (CH_EAVE+0.6)/2, CHZ + side*(CH_W/2+0.5));
      fg.group.add(but);
      var pinBase = mkBox(1.5, 3.2, 1.5, fg.mat);
      place(pinBase, qx, CH_EAVE+2.2, CHZ + side*(CH_W/2+0.8));
      fg.group.add(pinBase);
      var pin = mkCone(1.05, 6.0, 4, fg.mat);
      place(pin, qx, CH_EAVE+6.8, CHZ + side*(CH_W/2+0.8));
      fg.group.add(pin);
    }
    var bal = mkBox(CH_LEN, 1.0, 0.5, fg.mat);
    place(bal, CHX, CH_EAVE+0.5, CHZ + side*(CH_W/2+0.4));
    fg.group.add(bal);
  });

  // ---- twin pitched roof slabs + both gables --------------------------
  (function(){
    var run = CH_W/2, rise = CH_RIDGE-CH_EAVE, slant = Math.hypot(run, rise);
    [1,-1].forEach(function(sign){
      var m = new T.Mesh(new T.BoxGeometry(CH_LEN+1.2, 0.4, slant), chapRoof.mat);
      m.castShadow = true; m.receiveShadow = true;
      m.position.set(CHX, CH_EAVE + rise/2, CHZ + sign*run/2);
      // pitch about X now that the ridge runs east-west: +sign tips the
      // +Z slab down towards its own eave (mirror of the -Z slab).
      m.rotation.x = sign * Math.atan2(rise, run);
      chapRoof.group.add(m);
    });
    [[CH_WEST, chapW], [CH_EAST, chapE]].forEach(function(pair){
      var shape = new T.Shape();
      shape.moveTo(-run, 0); shape.lineTo(run, 0); shape.lineTo(0, rise); shape.closePath();
      var gm = new T.Mesh(new T.ShapeGeometry(shape), chapelGableMat);
      gm.castShadow = true; gm.receiveShadow = true;
      gm.rotation.y = Math.PI/2;        // gable plane faces east-west
      gm.position.set(pair[0], CH_EAVE, CHZ);
      pair[1].group.add(gm);
    });
  })();

  // ---- apse: a ring of five stone facets (the two that would close the
  // nave arch are omitted, leaving the chancel opening) + conical roof ---
  (function(){
    var R = CH_W/2, apo = R*Math.cos(Math.PI/7), facetW = 2*R*Math.sin(Math.PI/7);
    for (var a=-2; a<=2; a++){
      var ang = a*(2*Math.PI/7);
      var rx = CH_EAST + Math.cos(ang)*(apo-0.4);
      var rz = CHZ + Math.sin(ang)*(apo-0.4);
      var facet = mkBox(0.8, CH_EAVE, facetW+0.35, chapE.mat);
      place(facet, rx, CH_EAVE/2, rz, -ang);
      chapE.group.add(facet);
      var lan = mkBox(0.9, 11.0, 3.0, windowMat);
      place(lan, rx, 10.5, rz, -ang);
      chapE.group.add(lan);
      var but2 = mkBox(1.4, CH_EAVE+0.4, 1.4, chapE.mat);
      place(but2, CH_EAST + Math.cos(ang+Math.PI/7)*(R+0.3),
                  (CH_EAVE+0.4)/2,
                  CHZ + Math.sin(ang+Math.PI/7)*(R+0.3), -ang);
      chapE.group.add(but2);
    }
    var apseRoofH = (CH_RIDGE-CH_EAVE)*0.7;
    var apseRoof = mkCone(R+0.5, apseRoofH, 7, chapRoof.mat);
    apseRoof.rotation.y = Math.PI/7;
    place(apseRoof, CH_EAST, CH_EAVE+apseRoofH/2, CHZ);
    chapRoof.group.add(apseRoof);
  })();

  // ---- west front: great window, portal, stair turrets, spires --------
  (function(){
    var fx = CH_WEST + CH_WT/2;
    var front = mkBox(CH_WT, CH_EAVE, CH_W, chapW.mat);
    place(front, fx, CH_EAVE/2, CHZ);
    chapW.group.add(front);
    var greatWin = mkBox(CH_WT*1.2, 12.5, 8.6, windowMat);
    place(greatWin, fx, 12.4, CHZ);
    chapW.group.add(greatWin);
    var winHead = mkCone(4.3, 3.4, 3, windowMat);
    winHead.rotation.y = Math.PI/2;
    place(winHead, fx, 20.3, CHZ);
    chapW.group.add(winHead);
    var portal = mkBox(CH_WT*1.3, 5.4, 3.6, windowMat);
    place(portal, fx, 2.7, CHZ);
    chapW.group.add(portal);
    var portalArch = mkCone(2.1, 2.4, 3, chapW.mat);
    portalArch.rotation.y = Math.PI/2;
    place(portalArch, CH_WEST-0.27, 6.5, CHZ);
    chapW.group.add(portalArch);
    [-1,1].forEach(function(side){
      var turr = mkCyl(2.1, 2.2, CH_RIDGE+2.0, 8, chapW.mat);
      place(turr, CH_WEST+0.4, (CH_RIDGE+2.0)/2, CHZ + side*(CH_W/2+0.4));
      chapW.group.add(turr);
      var spire = mkCone(2.4, 10.0, 8, chapW.mat);
      place(spire, CH_WEST+0.4, CH_RIDGE+2.0+5.0, CHZ + side*(CH_W/2+0.4));
      chapW.group.add(spire);
    });
    var apexFinial = mkCone(0.7, 4.2, 4, chapW.mat);
    place(apexFinial, CH_WEST+0.3, CH_RIDGE+2.1, CHZ);
    chapW.group.add(apexFinial);
  })();

  /* ---- chapel interior (interiorGroup -- never fades, simply revealed
   * once the shell above dissolves): tiled floor, engaged shafts carrying
   * transverse pointed arches the full 31m to the ridge (the vertical
   * emphasis the real building is built around), nave benches, a stepped
   * choir and the high altar in the apse. -------------------------- */
  (function(){
    var G = interiorGroup;
    // warm, low-contrast stone checker -- a high-contrast grey/white grid
    // reads as a transparency swatch rather than a tiled chapel floor
    var tileTex = makeCheckerTexture('#c6bca4', '#a89d86', 9);
    /* color を明示するのは露出予算のため。map は material.color に乗算
     * されるので、既定の白 (0xffffff) のままだと市松の明るいほうが
     * 198/255 で入り、昼の水平上向き面に掛かる約 x1.95 で 386 -> 255 に
     * 飽和する。実測で身廊の床の 65% が L>=250 の完全な白飛びだった。
     * 0x9b9384 を掛けておくと明部 121 x 1.95 = 236 に収まり、市松の
     * 明暗差(この床の狙い)がそのまま残る。 */
    var tileMat = new T.MeshLambertMaterial({ map: tileTex, color: 0x9b9384 });
    boxAt(G, (CH_WEST+CH_WT+CH_EAST)/2, 0.15, CHZ, CH_EAST-CH_WEST-CH_WT, 0.3, CH_IN*2, tileMat);
    cylAt(G, CH_EAST, 0.15, CHZ, CH_W/2-0.5, CH_W/2-0.5, 0.3, 7, tileMat, Math.PI/7);
    // chancel steps + raised sanctuary
    boxAt(G, 38.4, 0.42, CHZ, 1.6, 0.26, CH_IN*2, flagstoneMat);
    boxAt(G, 40.0, 0.68, CHZ, 1.6, 0.26, CH_IN*2, flagstoneMat);
    boxAt(G, 45.0, 0.68, CHZ, 8.4, 0.26, CH_IN*2-1.0, flagstoneMat);
    // high altar, cloth, retable and cross
    boxAt(G, 46.4, 1.35, CHZ, 1.5, 1.1, 2.9, flagstoneMat);
    boxAt(G, 46.4, 1.94, CHZ, 1.9, 0.14, 3.3, linenMat);
    boxAt(G, 47.3, 2.9, CHZ, 0.3, 1.8, 2.6, clothGoldMat);
    boxAt(G, 46.4, 2.9, CHZ, 0.16, 1.5, 0.16, clothGoldMat);
    boxAt(G, 46.4, 3.2, CHZ, 0.16, 0.16, 0.9, clothGoldMat);
    [-1.2, 1.2].forEach(function(dz){ addCandleStand(G, 45.4, 2.0, CHZ+dz); });
    [-4.6, 4.6].forEach(function(dz){ addCandleStand(G, 42.0, 0.81, CHZ+dz); });
    // choir stalls facing each other across the chancel
    [-1, 1].forEach(function(s){
      addBench(G, 42.4, 0.81, CHZ + s*3.6, 5.0, Math.PI/2, darkWoodMat);
      boxAt(G, 42.4, 1.9, CHZ + s*4.4, 5.2, 2.2, 0.2, darkWoodMat);
    });
    // engaged shafts + transverse pointed arches on every bay division.
    // Each arm is a three-segment polyline rather than one straight strut,
    // so the arch reads as a curve rising to a point instead of an A-frame.
    var springY = CH_EAVE - 1.6, apexY = springY + 9.6;
    var shaftZ = CH_IN - 0.35;
    [13, 21, 29, 37].forEach(function(bx){
      [-1,1].forEach(function(s){
        cylAt(G, bx, (springY+0.3)/2, CHZ + s*shaftZ, 0.4, 0.46, springY-0.3, 8, ribMat);
        cylAt(G, bx, springY+0.2, CHZ + s*shaftZ, 0.58, 0.44, 0.7, 8, ribMat);
        var pts = [
          [springY+0.5, shaftZ],
          [springY+4.4, shaftZ*0.82],
          [springY+7.6, shaftZ*0.45],
          [apexY,       0]
        ];
        for (var pi=0; pi<pts.length-1; pi++){
          beamBetween(G, bx, pts[pi][0], CHZ + s*pts[pi][1],
                         bx, pts[pi+1][0], CHZ + s*pts[pi+1][1], 0.42, 0.46, ribMat);
        }
      });
    });
    boxAt(G, 25.5, apexY+0.1, CHZ, 34.0, 0.4, 0.44, ribMat);   // ridge rib
    // nave benches, two blocks either side of a central aisle
    [21.0, 29.0].forEach(function(bz){
      [12.0, 15.2, 18.4, 21.6, 24.8, 28.0, 31.2].forEach(function(bx){
        addBench(G, bx, 0.3, bz, 5.0, Math.PI/2, woodMat);
      });
    });
    // lectern at the chancel step
    cylAt(G, 36.4, 0.85, CHZ-2.4, 0.16, 0.4, 1.4, 6, darkWoodMat);
    var desk = mkBox(0.7, 0.1, 0.9, darkWoodMat);
    place(desk, 36.4, 1.6, CHZ-2.4); desk.rotation.z = 0.45; G.add(desk);
    boxAt(G, 36.3, 1.72, CHZ-2.4, 0.5, 0.07, 0.6, linenMat);
    registerPick(pickables, 'room', 22, 9, CHZ, 30, 16, CH_IN*2,
      '身廊 Nave', 'サント・シャペルの身廊。両側の高い尖頭窓と、束ね柱から立ち上がる横断アーチが垂直性を強調する。');
    registerPick(pickables, 'room', 44, 6, CHZ, 12, 10, 12,
      '内陣 Choir & High Altar', '内陣。数段の階段で一段高く、七角形の後陣に主祭壇と聖歌隊席を置く。');
  })();

  registerPick(pickables, 'structure', CHX, CH_EAVE*0.6, CHZ, CH_LEN+2, CH_RIDGE, CH_W+2,
    'サント・シャペル Sainte-Chapelle', 'ドンジョン東側に建つフランボワイヤン・ゴシックの礼拝堂。東西方向に身廊を通し、西正面の大窓と両脇の階段塔、側面を埋める背の高い尖頭窓が特徴。1380年時点ではまだ建設中であった(実際の完成は1552年)。');

  /* -------------------------------------------------------------- *
   * outer moat: 175 x 330m rectangle, so buildWaterMoatSystem's square-
   * only assumption doesn't fit -- reuse its ground/bank/water technique
   * (buildUndulatingGround + buildBankRamp, both already generalised to
   * a 'rect' footprint in section 0.5) via a local rectangle-aware
   * counterpart instead.
   * -------------------------------------------------------------- */
  function buildRectMoatSystem(opts){
    var g = opts.group;
    var groundY = opts.groundY, waterY = opts.waterY;
    var bailHX = opts.bailHalfX, bailHZ = opts.bailHalfZ, islandY = opts.islandY!=null?opts.islandY:0.02;
    var moatOHX = opts.moatOuterHalfX, moatOHZ = opts.moatOuterHalfZ;
    var bankWOut = opts.bankWidthOut!=null?opts.bankWidthOut:5.0;
    var bankWIn = opts.bankWidthIn!=null?opts.bankWidthIn:3.5;
    var waterHX = moatOHX - bankWOut, waterHZ = moatOHZ - bankWOut;
    var waterInHX = bailHX + bankWIn, waterInHZ = bailHZ + bankWIn;

    var groundSize = opts.groundSize||2200, groundSegs = opts.groundSegs||88;
    var cellSize = groundSize/groundSegs;
    var cutHalf = Math.max(moatOHX, moatOHZ) + Math.max(30, cellSize*2.5);
    var ground = buildUndulatingGround(cutHalf, groundSize, groundSegs, opts.groundMat, cutHalf);
    ground.position.y = groundY;
    g.add(ground);

    /* opts.keepout = {minX,maxX,minZ,maxZ}: a rectangle on the WEST side that
     * this moat must not enter, because the donjon complex physically stands
     * there (its ditch floor is 7m down, i.e. below every plane this system
     * would otherwise lay across it). Du Cerceau's plan shows the main ditch
     * detouring around the keep exactly like this. The keepout is assumed to
     * open through the west edge of the bailey island and to sit clear of all
     * four corners, which is what makes the notched polygons below simple.
     *
     * CAREFUL with the sign: every Shape here is authored in XY and then put
     * flat with geometry.rotateX(-PI/2), which maps shape-Y to world MINUS Z.
     * Every existing outline is symmetric in Y so it never mattered, but a
     * one-sided notch written with raw world Z comes out mirrored to the far
     * side of the castle. Hence kz0/kz1 below, in shape-Y, not world Z. */
    var ko = opts.keepout || null;
    var kz0 = ko ? -ko.maxZ : 0, kz1 = ko ? -ko.minZ : 0;   // shape-Y span of the keepout

    var collarShape = new T.Shape();
    collarShape.moveTo(-cutHalf,-cutHalf); collarShape.lineTo(cutHalf,-cutHalf);
    collarShape.lineTo(cutHalf,cutHalf); collarShape.lineTo(-cutHalf,cutHalf); collarShape.closePath();
    var collarHole = new T.Path();
    collarHole.moveTo(-moatOHX,-moatOHZ);
    if (ko){
      // walk the hole's west edge upward in shape-Y, bulging out around the keep
      collarHole.lineTo(-moatOHX, kz0);
      collarHole.lineTo(ko.minX,  kz0);
      collarHole.lineTo(ko.minX,  kz1);
      collarHole.lineTo(-moatOHX, kz1);
    }
    collarHole.lineTo(-moatOHX,moatOHZ);
    collarHole.lineTo(moatOHX,moatOHZ); collarHole.lineTo(moatOHX,-moatOHZ); collarHole.closePath();
    collarShape.holes.push(collarHole);
    var collarGeo = new T.ShapeGeometry(collarShape);
    collarGeo.rotateX(-Math.PI/2);
    var collar = new T.Mesh(collarGeo, opts.groundMat);
    collar.position.y = groundY; collar.receiveShadow = true;
    g.add(collar);

    var islandShape = new T.Shape();
    islandShape.moveTo(-bailHX,-bailHZ); islandShape.lineTo(bailHX,-bailHZ);
    islandShape.lineTo(bailHX,bailHZ); islandShape.lineTo(-bailHX,bailHZ);
    if (ko){
      // same notch bitten out of the bailey lawn's west edge (shape-Y again)
      islandShape.lineTo(-bailHX, kz1);
      islandShape.lineTo(ko.maxX, kz1);
      islandShape.lineTo(ko.maxX, kz0);
      islandShape.lineTo(-bailHX, kz0);
    }
    islandShape.closePath();
    var islandGeo = new T.ShapeGeometry(islandShape);
    islandGeo.rotateX(-Math.PI/2);
    var island = new T.Mesh(islandGeo, opts.islandMat);
    island.position.y = islandY; island.receiveShadow = true;
    g.add(island);

    var colTop = new T.Color(opts.bankColorTop!=null?opts.bankColorTop:0x9c8a5e);
    var colMid = new T.Color(opts.bankColorMid!=null?opts.bankColorMid:0x6e5c3e);
    var colEdge = new T.Color(opts.bankColorEdge!=null?opts.bankColorEdge:0x332818);

    /* The two graded banks are continuous rings, so instead of reshaping them
     * their triangles are simply dropped where they enter the keepout. Any
     * triangle with a vertex inside goes, which over-cuts by at most one ring
     * segment -- hence the segment count is raised from 64 to 256 (≈4.7m a
     * segment) so the over-cut stays comfortably under the donjon terrace
     * plate that covers it. */
    function cutByKeepout(mesh){
      if (!ko) return mesh;
      var geo = mesh.geometry, pos = geo.attributes.position, idx = geo.index.array, keep = [], i, k;
      for (i=0;i<idx.length;i+=3){
        var hit = false;
        for (k=0;k<3 && !hit;k++){
          var v = idx[i+k], x = pos.getX(v), z = pos.getZ(v);
          if (x > ko.minX && x < ko.maxX && z > ko.minZ && z < ko.maxZ) hit = true;
        }
        if (!hit) keep.push(idx[i], idx[i+1], idx[i+2]);
      }
      geo.setIndex(keep);
      return mesh;
    }
    var rampSegs = ko ? 256 : 64;
    var bankOuter = cutByKeepout(buildBankRamp('rect', moatOHX, waterHX, groundY, waterY, colTop, colMid, colEdge, rampSegs, 6, moatOHZ, waterHZ));
    g.add(bankOuter);
    var bankInner = cutByKeepout(buildBankRamp('rect', bailHX, waterInHX, islandY, waterY, colTop, colMid, colEdge, rampSegs, 6, bailHZ, waterInHZ));
    g.add(bankInner);

    /* Open water. Laid as four side slabs rather than one ShapeGeometry
     * annulus (they tile the annulus exactly) so the west slab can simply be
     * split in two around the keepout without asking earcut to resolve two
     * overlapping holes. */
    var waterMat = new T.MeshPhongMaterial({ color: opts.waterColor||0x2e5b66,
      transparent:true, opacity:opts.waterOpacity!=null?opts.waterOpacity:0.82, shininess:90, specular:0x9fd4e0 });
    var moatWater = new T.Group();
    function waterSlab(x0,x1,z0,z1){
      if (x1-x0 < 0.01 || z1-z0 < 0.01) return;
      var wg = new T.PlaneGeometry(x1-x0, z1-z0);
      wg.rotateX(-Math.PI/2);
      var wm = new T.Mesh(wg, waterMat);
      wm.position.set((x0+x1)/2, 0, (z0+z1)/2);
      moatWater.add(wm);
    }
    waterSlab(-waterHX, waterHX, -waterHZ, -waterInHZ);   // north
    waterSlab(-waterHX, waterHX,  waterInHZ, waterHZ);    // south
    waterSlab( waterInHX, waterHX, -waterInHZ, waterInHZ);// east
    if (ko){
      waterSlab(-waterHX, -waterInHX, -waterInHZ, ko.minZ);
      waterSlab(-waterHX, -waterInHX,  ko.maxZ,   waterInHZ);
    } else {
      waterSlab(-waterHX, -waterInHX, -waterInHZ, waterInHZ);
    }
    moatWater.position.y = waterY;
    g.add(moatWater);

    return { ground:ground, island:island, moatWater:moatWater, waterMat:waterMat,
      waterHalfX:waterHX, waterHalfZ:waterHZ, waterInnerHalfX:waterInHX, waterInnerHalfZ:waterInHZ,
      waterY:waterY, groundY:groundY };
  }

  var BAIL_HX = OHX+3, BAIL_HZ = OHZ+3;
  var MOAT_W = 22;
  var MOAT_OHX = BAIL_HX+MOAT_W, MOAT_OHZ = BAIL_HZ+MOAT_W;
  var GROUND_Y = -1.2, WATER_Y = GROUND_Y - 1.4;

  var rectMoat = buildRectMoatSystem({
    group: group, groundY: GROUND_Y, waterY: WATER_Y,
    bailHalfX: BAIL_HX, bailHalfZ: BAIL_HZ, islandY: 0.02,
    moatOuterHalfX: MOAT_OHX, moatOuterHalfZ: MOAT_OHZ,
    bankWidthOut: 5.5, bankWidthIn: 3.5,
    keepout: DONJON_KEEPOUT,
    groundMat: grassMat, islandMat: grassMat2,
    waterColor: WATER_COL,
    bankColorTop: BANK_COL, bankColorMid: BANK_MID_COL, bankColorEdge: BANK_EDGE_COL,
    groundSize: 2400, groundSegs: 96
  });
  var waterMat = rectMoat.waterMat;
  registerPick(pickables, 'structure', 0, WATER_Y+0.1, -MOAT_OHZ+MOAT_W/2, MOAT_OHX*1.6, 1.2, MOAT_W*0.9,
    '水堀 Moat', '石造りの水堀が城壁の全周を囲む。幅約22m。');

  function bridgeOverOuterMoat(axis, fixedCoord, outerCoord, innerCoord, w){
    var len = Math.abs(outerCoord-innerCoord), mid = (outerCoord+innerCoord)/2;
    var br = axis==='z' ? mkBox(w, 0.35, len, woodMat) : mkBox(len, 0.35, w, woodMat);
    if (axis==='z') place(br, fixedCoord, -0.05, mid); else place(br, mid, -0.05, fixedCoord);
    group.add(br);
  }
  bridgeOverOuterMoat('z', 0, -MOAT_OHZ+1.0, -BAIL_HZ-0.5, 5.5);  // north: main approach to Tour du Village
  bridgeOverOuterMoat('z', 0, MOAT_OHZ-1.0, BAIL_HZ+0.5, 4.5);    // south: Tour du Bois approach

  /* -------------------------------------------------------------- *
   * bailey planting. The enceinte encloses ~5.7 hectares -- far more
   * ground than the donjon and the chapel use -- and the royal residence
   * really did farm it: a jardin du roi, a potager, an orchard and a
   * working farm yard. Four planted quarters are laid out in the four
   * corners of the open bailey, deliberately OUTSIDE every life.courtyard
   * rectangle and clear of the guards' patrol lanes at x = +-80 (see the
   * re-cut courtyard list in the life block at the end of this file), so
   * nothing here stands where a resident walks.
   * Everything is scaled to the courtyard, not to the forest outside:
   * these are 3.2-5m fruit trees, not the 12m+ trees the shared nature
   * layer plants beyond the moat.
   * -------------------------------------------------------------- */
  var GQ = {                       // the four planted quarters (x/z bounds)
    king:    { x0:-76, x1:-34, z0:-150, z1:-104 },
    potager: { x0: 34, x1: 76, z0:-150, z1:-104 },
    orchard: { x0: 34, x1: 76, z0: 104, z1: 150 },
    farm:    { x0:-76, x1:-34, z0: 104, z1: 150 }
  };
  function addCourtTree(x, z, h, rr, lm){
    cylAt(group, x, h/2, z, 0.16, 0.3, h, 6, trunkMat);
    var c1 = mkSphere(rr, lm); c1.scale.set(1.05, 0.88, 1.05);
    place(c1, x, h + rr*0.5, z); group.add(c1);
    var c2 = mkSphere(rr*0.6, lm);
    place(c2, x + rr*0.5, h + rr*0.05, z - rr*0.35); group.add(c2);
  }
  function addHedge(x, z, len, ry, hh){
    boxAt(group, x, hh/2, z, len, hh, 0.85, hedgeMat, ry);
  }
  function addVegBed(x, z, len, wid, ry, cm){
    boxAt(group, x, 0.17, z, len, 0.34, wid, soilMat, ry);   // 畝(耕した土)
    boxAt(group, x, 0.5, z, len*0.94, 0.3, wid*0.5, cm, ry); // 作物の列
    for (var i=0;i<5;i++){
      var p = localXZ(x, z, ry, -len/2 + len*(i+0.5)/5, 0);
      var t = mkSphere(0.46, cm); t.scale.set(1, 0.72, 1);
      place(t, p[0], 0.62, p[1]); group.add(t);
    }
  }
  function addWell(x, z){
    cylAt(group, x, 0.55, z, 1.15, 1.25, 1.1, 10, flagstoneMat);
    cylAt(group, x, 1.12, z, 0.82, 0.82, 0.14, 10, sootMat);
    [-1,1].forEach(function(s){ boxAt(group, x+s*1.15, 2.0, z, 0.22, 2.6, 0.22, woodMat); });
    boxAt(group, x, 3.05, z, 3.0, 0.18, 1.7, woodMat);
    boxAt(group, x, 2.75, z, 2.3, 0.16, 0.16, woodMat);        // 巻き上げ軸
    boxAt(group, x, 2.15, z, 0.44, 0.5, 0.44, darkWoodMat);    // 釣瓶
  }
  function addCart(x, z, ry){
    var g = new T.Group();
    var bed = mkBox(3.2, 0.3, 1.9, woodMat); bed.position.y = 1.0; g.add(bed);
    [-0.95, 0.95].forEach(function(s){
      var sb = mkBox(3.2, 0.62, 0.12, woodMat); sb.position.set(0, 1.4, s); g.add(sb);
    });
    [-1, 1].forEach(function(s){
      var w = mkCyl(0.72, 0.72, 0.16, 10, darkWoodMat);
      w.rotation.x = Math.PI/2;
      w.position.set(0.55, 0.74, s*1.08); g.add(w);
    });
    [-0.55, 0.55].forEach(function(s){
      var sh = mkBox(2.4, 0.13, 0.13, woodMat); sh.position.set(-2.5, 0.95, s); g.add(sh);
    });
    var hay = mkBox(2.6, 0.7, 1.6, strawMat); hay.position.y = 1.5; g.add(hay);
    g.position.set(x, 0, z); g.rotation.y = ry || 0;
    group.add(g);
  }
  // axis-aligned outbuilding (ridge runs along X) -- thatched twin pitch
  function addShed(x, z, w, d){
    boxAt(group, x, 1.3, z, w, 2.6, d, woodMat);
    var rise = 1.6, run = d/2, slant = Math.hypot(run, rise);
    [1,-1].forEach(function(sg){
      var m = mkBox(w+0.7, 0.26, slant, strawMat);
      m.position.set(x, 2.6 + rise/2, z + sg*run/2);
      m.rotation.x = sg*Math.atan2(rise, run);
      m.castShadow = true; m.receiveShadow = true;
      group.add(m);
    });
    [1,-1].forEach(function(sg){
      boxAt(group, x + sg*(w/2-0.1), 3.0, z, 0.2, 1.2, d*0.55, woodMat);
    });
    boxAt(group, x, 0.9, z + d/2, 1.1, 1.8, 0.14, darkWoodMat);
  }

  /* -- 王の庭園: 生垣で縁取った4区画の整形花壇と中央の井戸 -- */
  (function(){
    var q = GQ.king, cx = (q.x0+q.x1)/2, cz = (q.z0+q.z1)/2;
    // 各区画は「芝の中央に四辺の花壇を回した」結び花壇(parterre)。
    // 一枚の土の四角にすると泥の板に見えるので、土は縁の帯だけにする。
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function(s){
      var bx = cx + s[0]*10.5, bz = cz + s[1]*10.5, half = 8.0;
      addHedge(bx, bz - half, half*2, 0, 0.75);
      addHedge(bx, bz + half, half*2, 0, 0.75);
      addHedge(bx - half, bz, half*2, Math.PI/2, 0.75);
      addHedge(bx + half, bz, half*2, Math.PI/2, 0.75);
      [[0,-5.2,13,3.0],[0,5.2,13,3.0],[-5.2,0,3.0,13],[5.2,0,3.0,13]].forEach(function(b, bi){
        boxAt(group, bx+b[0], 0.12, bz+b[1], b[2], 0.24, b[3], soilMat);
        for (var f=0; f<3; f++){
          var t = (f+0.5)/3 - 0.5;
          var fx = bx + b[0] + (b[2] > b[3] ? t*b[2]*0.8 : 0);
          var fz = bz + b[1] + (b[3] > b[2] ? t*b[3]*0.8 : 0);
          var bl = mkSphere(0.78, (bi+f) % 2 ? bloomMat : bloom2Mat);
          bl.scale.set(1, 0.72, 1);
          place(bl, fx, 0.42, fz); group.add(bl);
        }
      });
      var herb = mkSphere(1.7, hedgeMat); herb.scale.set(1, 0.8, 1);
      place(herb, bx, 0.9, bz); group.add(herb);         // 中央の刈り込み
    });
    addWell(cx, cz);
    [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function(s){
      addCourtTree(cx + s[0]*19.0, cz + s[1]*20.5, 3.6, 2.0, leafMat2);
    });
    addHedge(cx, q.z0-1.2, q.x1-q.x0, 0, 0.9);
    addHedge(cx, q.z1+1.2, q.x1-q.x0, 0, 0.9);
    registerPick(pickables, 'structure', cx, 1.4, cz, q.x1-q.x0, 3.0, q.z1-q.z0,
      '王の庭園 Jardin du Roi', '外郭の北西隅に営まれた王の庭園。生垣で縁取った整形花壇と果樹、井戸を備える。');
  })();

  /* -- 菜園(ポタジェ): 長い畝と豆の支柱、囲いの垣根 -- */
  (function(){
    var q = GQ.potager, cx = (q.x0+q.x1)/2;
    for (var i=0; i<6; i++){
      var bz = q.z0 + 5.5 + i*7.2;
      addVegBed(cx, bz, 38, 3.0, 0, i % 2 ? cropMat : herbMat);
    }
    // 豆の支柱(3本一組の円錐)
    [[q.x0+5, q.z1-3.5], [q.x0+15, q.z1-3.5], [q.x0+25, q.z1-3.5], [q.x0+35, q.z1-3.5]].forEach(function(p){
      for (var k=0;k<3;k++){
        var a = k*(Math.PI*2/3);
        beamBetween(group, p[0]+Math.cos(a)*0.8, 0.1, p[1]+Math.sin(a)*0.8,
                           p[0], 2.6, p[1], 0.1, 0.1, woodMat);
      }
      var vine = mkSphere(1.0, cropMat); vine.scale.set(1, 1.25, 1);
      place(vine, p[0], 1.2, p[1]); group.add(vine);
    });
    // 編み垣(ウォトル・フェンス)
    [[cx, q.z0-1.0, q.x1-q.x0, 0], [cx, q.z1+1.0, q.x1-q.x0, 0],
     [q.x0-1.0, (q.z0+q.z1)/2, q.z1-q.z0, Math.PI/2], [q.x1+1.0, (q.z0+q.z1)/2, q.z1-q.z0, Math.PI/2]
    ].forEach(function(f){
      boxAt(group, f[0], 0.5, f[1], f[2], 1.0, 0.24, woodMat, f[3]);
    });
    addWell(q.x1-4.0, q.z0+3.0);
    addShed(q.x0+4.5, q.z1-5.0, 6.0, 4.5);
    registerPick(pickables, 'structure', cx, 1.2, (q.z0+q.z1)/2, q.x1-q.x0, 2.6, q.z1-q.z0,
      '菜園 Potager', '城内の台所をまかなう菜園。畝を切って豆や根菜を育て、井戸と納屋を備えた。');
  })();

  /* -- 果樹園: 小ぶりな果樹の格子状の植栽 -- */
  (function(){
    var q = GQ.orchard;
    for (var r=0; r<4; r++){
      for (var c=0; c<4; c++){
        var tx = q.x0 + 6 + c*10.0, tz = q.z0 + 6 + r*11.5;
        addCourtTree(tx, tz, 3.2 + ((r+c) % 3)*0.5, 1.9 + ((r*3+c) % 3)*0.25,
          (r+c) % 2 ? leafMat : leafMat2);
      }
    }
    addHedge((q.x0+q.x1)/2, q.z0-1.2, q.x1-q.x0, 0, 0.85);
    addHedge((q.x0+q.x1)/2, q.z1+1.2, q.x1-q.x0, 0, 0.85);
    addHedge(q.x1+1.2, (q.z0+q.z1)/2, q.z1-q.z0, Math.PI/2, 0.85);
    registerPick(pickables, 'structure', (q.x0+q.x1)/2, 2.0, (q.z0+q.z1)/2,
      q.x1-q.x0, 4.5, q.z1-q.z0,
      '果樹園 Verger', '外郭南東の果樹園。城内で消費する林檎や梨を実らせた。');
  })();

  /* -- 農作業場: ぶどう棚・干し草・薪・荷車・鶏小屋 -- */
  (function(){
    var q = GQ.farm;
    // ぶどう棚(2列)
    [q.z0+6, q.z0+14].forEach(function(rz){
      for (var i=0;i<5;i++){
        var px = q.x0 + 5 + i*8;
        boxAt(group, px, 1.1, rz, 0.2, 2.2, 0.2, woodMat);
      }
      boxAt(group, q.x0+21, 2.25, rz, 34, 0.14, 0.6, woodMat);
      var vine = mkBox(33, 0.55, 1.5, leafMat);
      place(vine, q.x0+21, 2.6, rz); group.add(vine);
    });
    // 干し草の山
    [[q.x0+8, q.z1-12], [q.x0+16, q.z1-6], [q.x0+25, q.z1-13]].forEach(function(p){
      cylAt(group, p[0], 0.8, p[1], 2.2, 2.5, 1.6, 8, strawMat);
      var top = mkCone(2.3, 2.6, 8, strawMat);
      place(top, p[0], 2.9, p[1]); group.add(top);
    });
    // 薪の山
    for (var lr=0; lr<3; lr++){
      for (var lc=0; lc<4; lc++){
        var lg = mkCyl(0.24, 0.24, 3.0, 6, trunkMat);
        lg.rotation.z = Math.PI/2;
        place(lg, q.x1-9, 0.28 + lr*0.5, q.z1-6 + lc*0.55 + (lr%2)*0.27);
        group.add(lg);
      }
    }
    addCart(q.x1-6, q.z0+22, 0.4);
    addCart(q.x0+7, q.z0+27, -1.1);
    addShed(q.x0+6, q.z1-3.5, 7.0, 4.0);
    addWell(q.x1-4, q.z0+2);
    addHedge((q.x0+q.x1)/2, q.z1+1.2, q.x1-q.x0, 0, 0.85);
    addHedge(q.x0-1.2, (q.z0+q.z1)/2, q.z1-q.z0, Math.PI/2, 0.85);
  })();

  /* -- 城壁沿いの並木(巡回路 x=+-80 と中庭矩形の外側 x=+-83.5) -- */
  [-1, 1].forEach(function(sx){
    for (var tz = -132; tz <= 132; tz += 16.5){
      if (sx < 0 && tz > -30 && tz < 100) continue;    // 西はドンジョンの堀を避ける
      addCourtTree(sx*83.5, tz, 3.4, 1.7, (tz|0) % 2 ? leafMat : leafMat2);
    }
  });

  /* -- 礼拝堂の前庭 --------------------------------------------------
   * ここだけは中庭の区画(z<=8 の北広場と z>=44 の礼拝堂南前庭)を結ぶ
   * 住人の横断帯に当たり、直線移動する農民が必ず通り抜ける。したがって
   * 樹木も背の高い生垣も置かず、膝丈(0.45m)の刈り込み縁取りと低い鉢に
   * 留め、さらに中央 x=25 に幅8mの通路を開けてある。 */
  [11.0, 39.0].forEach(function(hz){
    [-1, 1].forEach(function(s){
      addHedge(25 + s*13, hz, 14, 0, 0.45);
    });
    [10, 16, 34, 40].forEach(function(px){
      cylAt(group, px, 0.22, hz + (hz < 25 ? -2.2 : 2.2), 0.4, 0.32, 0.44, 8, soilMat);
      var pot = mkSphere(0.5, herbMat); pot.scale.set(1, 0.72, 1);
      place(pot, px, 0.62, hz + (hz < 25 ? -2.2 : 2.2)); group.add(pot);
    });
  });

  /* -- シェミーズ内の中庭にも小さな果樹を4本 -- */
  [[-16,-16],[16,-16],[16,16],[-16,16]].forEach(function(s){
    addCourtTree(DCX + s[0], DCZ + s[1], 3.0, 1.6, leafMat2);
  });

  /* ================================================================
   * 生き物。庭と作業場だけでは城が無人の模型に見えるので、王城らしい
   * 動物(鷹・猟犬・孔雀・白鳥)と、農作業場を支える家畜(馬・豚・羊・
   * 山羊・鶏・鳩・猫)を置く。
   *
   * 設計上の約束ごと:
   *  1. ローポリ。1頭あたり箱・円柱・球・円錐が 5〜11 個。
   *  2. パーツは素材ごとに ONE BufferGeometry へ統合してから scene に
   *     入れる(flush 参照)。統合しないと約70頭で 600 近いドローコール
   *     が増えてしまうが、統合後は使った素材の数(14)しか増えない。
   *  3. 向き・姿勢のばらつきは Math.random() ではなく座標ハッシュ rnd()
   *     で決める。読み直しても同じ絵になる(決定論的)。
   *  4. 色は「昼の水平上向き面には約1.95倍が乗る」前提で、どのチャンネル
   *     も 0x80(128)を超えないようにしてある。白鳥や芦毛は素の値では
   *     中間グレーだが、乗算後にちょうど白く見える。
   *  5. 位置は life.courtyard の徘徊矩形・patrol の巡回線・既存の植栽と
   *     重ならない座標だけを使う(各ブロックのコメントに根拠を書いた)。
   * ================================================================ */
  (function livestock(){
    /* ---- 形状キャッシュ(同種は必ず同じ geometry を使い回す) ---- */
    var geoC = {};
    function gBox(w,h,d){
      var k = 'B'+w.toFixed(2)+'/'+h.toFixed(2)+'/'+d.toFixed(2);
      return geoC[k] || (geoC[k] = new T.BoxGeometry(w,h,d));
    }
    function gCyl(rt,rb,h,s){
      var k = 'C'+rt.toFixed(2)+'/'+rb.toFixed(2)+'/'+h.toFixed(2)+'/'+s;
      return geoC[k] || (geoC[k] = new T.CylinderGeometry(rt,rb,h,s));
    }
    function gCone(r,h,s){
      var k = 'N'+r.toFixed(2)+'/'+h.toFixed(2)+'/'+s;
      return geoC[k] || (geoC[k] = new T.ConeGeometry(r,h,s));
    }
    function gEll(rx,ry,rz){
      var k = 'E'+rx.toFixed(2)+'/'+ry.toFixed(2)+'/'+rz.toFixed(2);
      if (!geoC[k]){ var g = new T.SphereGeometry(1, 7, 5); g.scale(rx,ry,rz); geoC[k] = g; }
      return geoC[k];
    }

    /* ---- パーツの蓄積と統合 --------------------------------------
     * at()   … 1体ぶんの基準変換(足元 x,y,z と向き yaw。局所 +X が前方)
     * part() … 局所座標でパーツを1つ積む
     * flush()… 溜めたパーツを (親グループ × 素材) ごとに1メッシュへ統合 */
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
    /* 動物以外の小物(止まり木・繋ぎ柵・豚囲い・鳩小屋・巣箱)も同じ
     * バッチに載せる。boxAt/cylAt で個別に置くと約40メッシュ増え、影の
     * 描画と合わせてドローコールが80近く増えてしまう。 */
    function prop(t, mat, geo, x, y, z, ry){
      part(at(t, x, y, z, ry), mat, geo, 0, 0, 0);
    }
    /* 決定論的な擬似乱数。座標(と salt)だけで決まるので毎回同じ */
    function rnd(x,z,s){
      var v = Math.sin(x*12.9898 + z*78.233 + (s||0)*37.719) * 43758.5453;
      return v - Math.floor(v);
    }

    /* ---- 毛色・羽色。素の値でどのチャンネルも 0x80 以下 ---------- */
    var bayMat   = new T.MeshLambertMaterial({ color: 0x5e3f27 }); // 鹿毛の馬・犬・牛
    var darkMat  = new T.MeshLambertMaterial({ color: 0x2f2620 }); // 黒毛・蹄・鬣・角の影
    var greyMat  = new T.MeshLambertMaterial({ color: 0x7c766c }); // 芦毛の馬・鳩・鵞鳥
    var woolMat  = new T.MeshLambertMaterial({ color: 0x7a7264 }); // 羊毛
    var goatMat  = new T.MeshLambertMaterial({ color: 0x6a5a45 });
    var pigMat   = new T.MeshLambertMaterial({ color: 0x7d6153 });
    var fowlMat  = new T.MeshLambertMaterial({ color: 0x6d5e45 }); // 鶏
    var cockMat  = new T.MeshLambertMaterial({ color: 0x6b3520 }); // 雄鶏の羽
    var combMat  = new T.MeshLambertMaterial({ color: 0x7d2117 }); // 鶏冠・肉垂
    var beakMat  = new T.MeshLambertMaterial({ color: 0x7d6626 });
    var swanMat  = new T.MeshLambertMaterial({ color: 0x7f7a72 }); // 白鳥(乗算後に白く見える)
    var peaMat   = new T.MeshLambertMaterial({ color: 0x1d4a63 }); // 孔雀の頸胸
    var peaTailMat = new T.MeshLambertMaterial({ color: 0x255c40 });
    var hawkMat  = new T.MeshLambertMaterial({ color: 0x55422e });
    var catMat   = new T.MeshLambertMaterial({ color: 0x4a4239 });

    /* ---- 四足獣。pose 0=立つ / 1=草を食む / 2=伏せる ------------- */
    function beast(t, x, z, yaw, S, pose, baseY){
      var c = at(t, x, baseY||0, z, yaw);
      var lying = pose===2, graze = pose===1;
      var lh = lying ? S.lh*0.26 : S.lh;
      var by = lh + S.bh*0.5;
      part(c, S.body, gBox(S.bl, S.bh, S.bw), 0, by, 0);
      part(c, S.body, gEll(S.bh*0.42, S.bh*0.50, S.bw*0.50),  S.bl*0.5, by - S.bh*0.03, 0);  // 胸
      part(c, S.body, gEll(S.bh*0.46, S.bh*0.52, S.bw*0.52), -S.bl*0.5, by + S.bh*0.04, 0);  // 尻
      var px = S.bl*0.33, pz = S.bw*0.30;
      [[px,pz],[px,-pz],[-px,pz],[-px,-pz]].forEach(function(p){
        part(c, S.leg, gCyl(S.lr*0.76, S.lr, lh, 5), p[0], lh*0.5, p[1]);
      });
      // 首(局所 +X が前、rz が仰角)
      // 草を食む個体は口先が地面に届くところまで首を落とす(-1.35rad)。
      // 浅い角度だと鼻先が宙に浮いて「掃除機の吸込口」に見えた。
      var a = graze ? -1.35 : (lying ? 0.62 : S.neckA);
      var nx0 = S.bl*0.44, ny0 = by + S.bh*0.26;
      part(c, S.body, gBox(S.nl, S.nw, S.nw*0.9),
        nx0 + Math.cos(a)*S.nl*0.5, ny0 + Math.sin(a)*S.nl*0.5, 0, 0, a);
      if (S.mane) part(c, darkMat, gBox(S.nl*0.96, S.nw*0.26, S.nw*0.42),
        nx0 + Math.cos(a)*S.nl*0.5 - Math.sin(a)*S.nw*0.44,
        ny0 + Math.sin(a)*S.nl*0.5 + Math.cos(a)*S.nw*0.44, 0, 0, a);
      var tx = nx0 + Math.cos(a)*S.nl, ty = ny0 + Math.sin(a)*S.nl;
      var ha = a*0.45 - 0.32;
      part(c, S.body, gBox(S.hl, S.hh, S.hw),
        tx + Math.cos(ha)*S.hl*0.42, ty + Math.sin(ha)*S.hl*0.42, 0, 0, ha);
      if (S.muzzle) part(c, S.muzzle, gBox(S.hl*0.36, S.hh*0.66, S.hw*0.8),
        tx + Math.cos(ha)*S.hl*0.92, ty + Math.sin(ha)*S.hl*0.92, 0, 0, ha);
      if (S.ear) [1,-1].forEach(function(s){
        part(c, S.body, gCone(S.ear, S.ear*2.6, 4),
          tx + Math.cos(ha)*S.hl*0.06, ty + S.hh*0.46, s*S.hw*0.34, 0, 0, -s*0.42);
      });
      if (S.horn) [1,-1].forEach(function(s){
        part(c, S.hornMat || greyMat, gCone(S.horn, S.horn*4.2, 4),
          tx + Math.cos(ha)*S.hl*0.10, ty + S.hh*0.52, s*S.hw*0.30, 0, -0.5, -s*0.75);
      });
      // 尾: 尻から後ろ下へ
      var td = S.tail;
      part(c, S.tailMat || S.leg, gBox(td, S.tw, S.tw),
        -S.bl*0.5 - 0.62*td*0.5, by + S.bh*0.32 - 0.78*td*0.5, 0, 0, -2.24);
    }

    /* ---- 地上の鳥。pose 0=立つ / 1=ついばむ / 2=うずくまる ------- */
    function bird(t, x, z, yaw, S, pose, baseY){
      var c = at(t, x, baseY||0, z, yaw);
      var peck = pose===1, sit = pose===2;
      var legH = sit ? 0.02 : S.legH;
      var pitch = peck ? -0.55 : (sit ? 0.05 : 0.24);
      var by = legH + S.br*0.95;
      part(c, S.body, gEll(S.bl, S.br, S.bw), 0, by, 0, 0, pitch);
      var na = peck ? -1.0 : 0.95;
      var nx0 = S.bl*0.62, ny0 = by + S.br*0.30;
      part(c, S.body, gCyl(S.nr*0.85, S.nr, S.nl, 5),
        nx0 + Math.cos(na)*S.nl*0.5, ny0 + Math.sin(na)*S.nl*0.5, 0, 0, na - Math.PI/2);
      var hx = nx0 + Math.cos(na)*S.nl, hy = ny0 + Math.sin(na)*S.nl;
      part(c, S.body, gEll(S.hr*1.15, S.hr, S.hr), hx, hy, 0);
      part(c, beakMat, gCone(S.hr*0.5, S.hr*1.5, 4),
        hx + S.hr*1.5, hy - S.hr*0.1, 0, 0, peck ? -Math.PI/2-0.6 : -Math.PI/2+0.2);
      part(c, S.tailMat || S.body, gBox(S.bl*1.1, S.br*0.7, S.bw*0.5),
        -S.bl*1.05, by + S.br*0.6, 0, 0, 0.55);
      if (!sit) [1,-1].forEach(function(s){
        part(c, beakMat, gCyl(S.lr, S.lr, legH, 4), -S.bl*0.05, legH*0.5, s*S.bw*0.42);
      });
      if (S.comb){
        part(c, combMat, gBox(S.hr*1.3, S.hr*0.85, S.hr*0.22), hx + S.hr*0.15, hy + S.hr*1.15, 0);
        part(c, combMat, gBox(S.hr*0.5, S.hr*0.9, S.hr*0.2), hx + S.hr*1.1, hy - S.hr*1.0, 0);
      }
      if (S.sickle) [0.35,-0.25].forEach(function(o,i){
        part(c, darkMat, gBox(S.bl*1.6, S.br*0.22, S.bw*0.22),
          -S.bl*1.35, by + S.br*(1.15 + i*0.45), o*S.bw, 0, 0.95 + i*0.25);
      });
    }

    /* ---- 水鳥(浮いている)。脚は水中なので作らない -------------- */
    function swimmer(t, x, y, z, yaw, S){
      var c = at(t, x, y, z, yaw);
      part(c, S.body, gEll(S.bl, S.bh, S.bw), 0, S.bh*0.30, 0, 0, -0.10);
      var bx = S.bl*0.55, byy = S.bh*0.75;
      part(c, S.body, gCyl(S.nr*0.8, S.nr, S.n1, 6),
        bx + Math.cos(S.a1)*S.n1*0.5, byy + Math.sin(S.a1)*S.n1*0.5, 0, 0, S.a1 - Math.PI/2);
      var mx = bx + Math.cos(S.a1)*S.n1, my = byy + Math.sin(S.a1)*S.n1;
      part(c, S.body, gCyl(S.nr*0.8, S.nr*0.8, S.n2, 6),
        mx + Math.cos(S.a2)*S.n2*0.5, my + Math.sin(S.a2)*S.n2*0.5, 0, 0, S.a2 - Math.PI/2);
      var hx = mx + Math.cos(S.a2)*S.n2, hy = my + Math.sin(S.a2)*S.n2;
      part(c, S.body, gEll(S.hr*1.3, S.hr, S.hr), hx, hy, 0);
      part(c, S.beak || beakMat, gCone(S.hr*0.55, S.hr*2.0, 4),
        hx + S.hr*1.7, hy - S.hr*0.25, 0, 0, -Math.PI/2 + 0.35);
      part(c, S.body, gBox(S.bl*0.9, S.bh*0.5, S.bw*0.55), -S.bl*0.95, S.bh*0.55, 0, 0, 0.45);
    }

    /* ---- 止まっている鳥(鷹・鳩)。y は止まり木の高さ ------------ */
    function perched(t, x, y, z, yaw, S){
      var c = at(t, x, y, z, yaw);
      part(c, S.body, gEll(S.bl, S.br, S.bw), 0, S.br*1.05, 0, 0, 0.42);
      part(c, S.body, gEll(S.hr*1.1, S.hr, S.hr), S.bl*0.72, S.br*2.0, 0);
      part(c, S.beak || beakMat, gCone(S.hr*0.5, S.hr*1.3, 4),
        S.bl*0.72 + S.hr*1.25, S.br*2.0 - S.hr*0.2, 0, 0, -Math.PI/2 - 0.5);
      part(c, S.tailMat || S.body, gBox(S.bl*1.5, S.br*0.35, S.bw*0.7), -S.bl*1.1, S.br*0.45, 0, 0, 0.30);
      [1,-1].forEach(function(s){
        part(c, beakMat, gCyl(S.br*0.14, S.br*0.14, S.br*0.55, 4), 0, S.br*0.3, s*S.bw*0.4);
      });
    }

    /* ---- 種ごとの寸法。単位はメートル ---------------------------- */
    var HORSE = { bl:1.95, bh:0.88, bw:0.68, lh:0.76, lr:0.105, nl:0.86, nw:0.38,
                  hl:0.64, hh:0.34, hw:0.28, tail:0.74, tw:0.16, ear:0.06, neckA:0.72,
                  mane:true, body:bayMat, leg:darkMat, muzzle:darkMat, tailMat:darkMat };
    var HORSE_G = { bl:1.95, bh:0.88, bw:0.68, lh:0.76, lr:0.105, nl:0.86, nw:0.38,
                  hl:0.64, hh:0.34, hw:0.28, tail:0.74, tw:0.16, ear:0.06, neckA:0.72,
                  mane:true, body:greyMat, leg:darkMat, muzzle:darkMat, tailMat:greyMat };
    var COW   = { bl:1.80, bh:0.90, bw:0.68, lh:0.60, lr:0.10, nl:0.42, nw:0.34,
                  hl:0.52, hh:0.30, hw:0.28, tail:0.70, tw:0.07, ear:0.07, horn:0.05,
                  neckA:0.30, body:bayMat, leg:darkMat, muzzle:darkMat, tailMat:darkMat };
    var SHEEP = { bl:0.98, bh:0.60, bw:0.48, lh:0.34, lr:0.055, nl:0.24, nw:0.24,
                  hl:0.30, hh:0.20, hw:0.18, tail:0.16, tw:0.09, ear:0.045,
                  neckA:0.35, body:woolMat, leg:darkMat, muzzle:darkMat, tailMat:woolMat };
    var GOAT  = { bl:0.86, bh:0.46, bw:0.38, lh:0.42, lr:0.045, nl:0.24, nw:0.20,
                  hl:0.28, hh:0.16, hw:0.15, tail:0.14, tw:0.06, ear:0.05, horn:0.035,
                  neckA:0.55, body:goatMat, leg:darkMat, muzzle:darkMat, tailMat:goatMat };
    var PIG   = { bl:1.12, bh:0.56, bw:0.46, lh:0.28, lr:0.055, nl:0.16, nw:0.30,
                  hl:0.34, hh:0.24, hw:0.24, tail:0.16, tw:0.05, ear:0.06,
                  neckA:0.10, body:pigMat, leg:pigMat, muzzle:darkMat, tailMat:pigMat };
    var PIGLET= { bl:0.52, bh:0.28, bw:0.24, lh:0.16, lr:0.03, nl:0.08, nw:0.16,
                  hl:0.18, hh:0.13, hw:0.13, tail:0.09, tw:0.03, ear:0.035,
                  neckA:0.10, body:pigMat, leg:pigMat, muzzle:darkMat, tailMat:pigMat };
    var HOUND = { bl:0.74, bh:0.34, bw:0.26, lh:0.36, lr:0.045, nl:0.20, nw:0.17,
                  hl:0.28, hh:0.16, hw:0.15, tail:0.36, tw:0.05, ear:0.055,
                  neckA:0.62, body:bayMat, leg:bayMat, muzzle:darkMat, tailMat:bayMat };
    var CAT   = { bl:0.42, bh:0.20, bw:0.16, lh:0.19, lr:0.026, nl:0.10, nw:0.11,
                  hl:0.15, hh:0.11, hw:0.11, tail:0.30, tw:0.035, ear:0.038,
                  neckA:0.65, body:catMat, leg:catMat, muzzle:darkMat, tailMat:catMat };
    var HEN   = { bl:0.20, br:0.16, bw:0.14, legH:0.13, lr:0.018, nr:0.045, nl:0.10,
                  hr:0.065, body:fowlMat };
    var COCK  = { bl:0.24, br:0.19, bw:0.16, legH:0.17, lr:0.021, nr:0.05, nl:0.14,
                  hr:0.075, body:cockMat, comb:true, sickle:true };
    var PEACOCK = { bl:0.30, br:0.21, bw:0.17, legH:0.22, lr:0.021, nr:0.05, nl:0.30,
                  hr:0.075, body:peaMat, tailMat:peaTailMat };
    var SWAN  = { bl:0.62, bh:0.30, bw:0.32, nr:0.07, n1:0.42, a1:1.30, n2:0.34, a2:0.35,
                  hr:0.10, body:swanMat, beak:combMat };
    var DUCK  = { bl:0.30, bh:0.16, bw:0.17, nr:0.045, n1:0.14, a1:1.15, n2:0.10, a2:0.55,
                  hr:0.065, body:greyMat };
    var HAWK  = { bl:0.17, br:0.13, bw:0.10, hr:0.055, body:hawkMat, beak:beakMat };
    var DOVE  = { bl:0.14, br:0.10, bw:0.085, hr:0.045, body:greyMat, beak:combMat };

    /* ================================================================
     * A. シェミーズ内の中庭 -- 王の動物。ここは life.courtyard のどの矩形
     *    にも入らず(最も近い矩形は x>=-58)、巡回路(x=-60/-80)からも
     *    離れている。ドンジョン本体は x -103..-87、隅の小塔が x=-83.4 まで
     *    張り出すので、東側の生き物は x>=-81 に置く。果樹4本は
     *    (DCX±16, DCZ±16) = (-111/-79, 34/66)。
     * ================================================================ */
    // 鷹匠の止まり木: 柱 + 横木、鷹2羽。狩猟は王権の象徴で、ヴァンセンヌの
    // 森はまさに王の猟場だった。
    (function(){
      var px = -108, pz = 62.5;
      prop(group, woodMat, gCyl(0.10, 0.13, 1.7, 6), px, 0.85, pz);
      prop(group, woodMat, gBox(0.16, 0.14, 1.9), px, 1.75, pz);
      prop(group, soilMat, gBox(0.9, 0.12, 1.4), px, 0.06, pz);  // 砂を敷いた止まり場
      perched(group, px, 1.82, pz - 0.55, 0.4, HAWK);
      perched(group, px, 1.82, pz + 0.50, -0.9, HAWK);
      registerPick(pickables, 'structure', px, 1.2, pz, 2.0, 2.6, 2.6,
        '鷹匠の止まり木 Falconer’s Perch',
        '王の鷹狩り用の止まり木。ヴァンセンヌの森は王家の猟場であり、鷹は王侯の身分そのものを表した。');
    })();
    // 猟犬3頭。ドンジョン東側の空き地(x -81..-73)。
    beast(group, -78.5, 62.0, 2.30, HOUND, 0);
    beast(group, -76.0, 58.5, -1.10, HOUND, 2);
    beast(group, -79.0, 38.5,  0.55, HOUND, 0);
    registerPick(pickables, 'structure', -78, 0.9, 60, 6.0, 2.0, 8.0,
      '猟犬 Hunting Hounds', '王の猟犬。ヴァンセンヌの森での狩りに随伴した。城内では大塔の足元に犬舎が置かれた。');
    // 繋ぎ柵と王の乗馬2頭。東の橋の板張り(x -74.6..-67.4 / z 48.2..51.8)を
    // 避けて z 42..47 に置く。
    (function(){
      [42.0, 47.0].forEach(function(pz){ prop(group, woodMat, gCyl(0.09, 0.11, 1.5, 6), -76.0, 0.75, pz); });
      prop(group, woodMat, gBox(0.12, 0.12, 5.0), -76.0, 1.35, 44.5);
      beast(group, -78.6, 43.4, 0.0, HORSE_G, 0);
      beast(group, -78.6, 46.2, 0.0, HORSE, 0);
    })();

    /* ================================================================
     * B. 農作業場(GQ.farm = x -76..-34 / z 104..150)。住人の徘徊矩形は
     *    z<=100 と z>=100 の中央参道(|x|<=30)だけなので、この区画には
     *    住人は入らない。既存の設備を避けた空き帯を使う:
     *      ぶどう棚 z 109.3-110.8 / 117.3-118.8、干し草 (-68,138)(-60,144)
     *      (-51,137)、荷車 (-40,126)(-69,131)、納屋 (-70,146.5)、
     *      薪 (-43,144.8)、井戸 (-38,106)
     * ================================================================ */
    // 馬繋ぎ場: 空き帯 z 120..128 の西半分。軍馬ではなく農耕・輸送用。
    (function(){
      var rz = 122.4;
      [-74.5, -68.0, -61.5].forEach(function(px){ prop(group, woodMat, gCyl(0.10, 0.12, 1.56, 6), px, 0.78, rz); });
      prop(group, woodMat, gBox(13.0, 0.14, 0.14), -68.0, 1.38, rz);
      prop(group, woodMat, gBox(2.2, 0.55, 0.9), -71.0, 0.30, rz + 2.6);  // 飼葉桶
      prop(group, strawMat, gBox(1.9, 0.12, 0.7), -71.0, 0.58, rz + 2.6);
      beast(group, -73.4, 124.4, 1.55, HORSE, 0);
      beast(group, -68.6, 124.6, 1.55, HORSE_G, 1);
      beast(group, -63.4, 124.3, 1.42, HORSE, 0);
      registerPick(pickables, 'structure', -68.5, 1.2, 124.0, 14.0, 2.6, 5.0,
        '馬繋ぎ場 Horse Lines', '農作業場の馬繋ぎ。荷車を曳く輓馬と乗用馬が飼葉桶の前に繋がれている。');
    })();
    // 豚小屋: 低い編み柵と屋根掛けの寝床。z 120..127 の東半分(荷車は x>=-44)
    (function(){
      var x0=-57.5, x1=-48.5, z0=120.0, z1=127.0;
      var cx=(x0+x1)/2, cz=(z0+z1)/2;
      [[cx,z0,x1-x0,0],[cx,z1,x1-x0,0],[x0,cz,z1-z0,Math.PI/2],[x1,cz,z1-z0,Math.PI/2]].forEach(function(f){
        prop(group, woodMat, gBox(f[2], 0.84, 0.16), f[0], 0.42, f[1], f[3]);
      });
      // 寝床の小屋は囲いの西端に寄せる(中央に置くと豚が全部その陰に入る)
      prop(group, woodMat, gBox(2.6, 1.6, 2.0), x0+1.9, 0.80, z0+1.6);
      prop(group, strawMat, gBox(3.1, 0.22, 2.5), x0+1.9, 1.72, z0+1.6);
      prop(group, woodMat, gBox(1.4, 0.44, 0.8), x1-1.4, 0.22, z0+1.4);    // 餌桶
      beast(group, -52.2, 121.6, -2.10, PIG, 0);
      beast(group, -53.6, 124.6,  0.35, PIG, 1);
      beast(group, -50.4, 124.0,  1.35, PIG, 2);
      beast(group, -52.4, 125.7,  0.90, PIGLET, 0);
      beast(group, -51.1, 125.3, -0.40, PIGLET, 1);
      registerPick(pickables, 'structure', cx, 1.0, cz, x1-x0, 2.2, z1-z0,
        '豚小屋 Pigsty', '城内の残飯で肥らせ、秋に屠って塩漬け・燻製にした。中世の城で最も普通の家畜。');
    })();
    // 鳩小屋(コロンビエ)と鳩。領主だけが鳩を飼う権利を持ち、鳩小屋の
    // 規模は所領の広さを示した。冬の生肉と畑の肥料を兼ねる。
    (function(){
      var dx = -50.0, dz = 144.5;
      // 石積みの塔身は城壁と同じクリーム色の石材で。屋根はバルティザンと
      // 同じスレート。止まり縁(せり出した石の帯)は屋根の裾より必ず外へ
      // 出しておく -- 中に入れると鳩が屋根の円錐に埋まる。
      prop(group, chemiseMat,   gCyl(1.32, 1.48, 4.60, 10), dx, 2.30, dz);
      prop(group, flagstoneMat, gCyl(1.95, 1.85, 0.20, 10), dx, 4.70, dz); // 止まり縁(蛇返し)
      prop(group, slateMat,     gCone(1.55, 1.60, 10),      dx, 5.60, dz);
      for (var h=0; h<6; h++){
        var ah = h*(Math.PI*2/6) + 0.3;
        prop(group, windowMat, gBox(0.30, 0.30, 0.30),
             dx + Math.cos(ah)*1.36, 3.55, dz + Math.sin(ah)*1.36, -ah);
      }
      perched(group, dx - 1.72, 4.82, dz + 0.20, -0.4, DOVE);
      perched(group, dx + 1.66, 4.82, dz - 0.35,  2.8, DOVE);
      perched(group, dx + 0.30, 4.82, dz + 1.70,  1.2, DOVE);
      perched(group, dx + 0.06, 6.40, dz,        -1.5, DOVE);   // 屋根の頂
      perched(group, dx + 2.60, 0.02, dz + 1.60,  1.9, DOVE);   // 地面に降りた1羽
      registerPick(pickables, 'structure', dx, 3.2, dz, 3.6, 6.4, 3.6,
        '鳩小屋 Dovecote', '領主特権の鳩小屋(コロンビエ)。冬季の生肉と畑の肥料を供給し、伝令鳩の巣ともなった。');
    })();
    // 鶏。納屋(-70,146.5)と干し草の周り、干し草の占有域(半径2.5)は避ける
    [[-73.0,141.2,0],[-71.4,142.8,1],[-66.2,142.4,1],[-63.8,140.6,0],
     [-57.5,141.0,1],[-55.0,139.4,0]].forEach(function(p,i){
      bird(group, p[0], p[1], rnd(p[0],p[1],3)*6.28, HEN, p[2]);
    });
    bird(group, -69.6, 143.8, 2.1, COCK, 0);
    // 納屋の鼠捕りの猫と、荷車のそばの番犬
    beast(group, -73.6, 143.4, -0.7, CAT, 2);
    beast(group, -46.5, 131.5,  1.9, HOUND, 0);

    /* ================================================================
     * C. 果樹園(GQ.orchard = x 34..76 / z 104..150)。果樹は x 40/50/60/70、
     *    z 110/121.5/133/144.5 の格子なので、その中間 (45/55/65 x
     *    115.75/127.25/138.75) は必ず空いている。羊と山羊を放つのは
     *    中世の果樹園の実際の使い方(下草を食ませる)。
     * ================================================================ */
    // 半分は果樹の間、半分は西端の空き帯(x 34..38 -- 最初の樹列が x=40)に
    // 置く。樹の間だけに置くと、低い視点では 4.2m の樹冠に全部隠れて
    // しまうのを実際のスクリーンショットで確認したため。
    [[45,115.75,1],[55,127.25,0],[65,138.75,2],[45.9,133.4,1]].forEach(function(p){
      beast(group, p[0], p[1], rnd(p[0],p[1],7)*6.28, SHEEP, p[2]);
    });
    [[36.4,112.0,1],[37.2,118.6,0],[36.0,125.6,1],[37.4,133.2,0],[36.8,141.6,2]].forEach(function(p){
      beast(group, p[0], p[1], rnd(p[0],p[1],9)*6.28, SHEEP, p[2]);
    });
    beast(group, 37.0, 106.6, 0.7, GOAT, 0);
    beast(group, 65.6, 116.4, -2.2, GOAT, 1);
    beast(group, 55.7, 145.2, 1.3, GOAT, 0);
    registerPick(pickables, 'structure', 55, 1.0, 127, 34, 2.2, 34,
      '羊と山羊 Sheep & Goats', '果樹園に放して下草を食ませた羊と山羊。羊毛と乳、そして畑の肥料を供給した。');

    /* ================================================================
     * D. 菜園(GQ.potager = x 34..76 / z -150..-104)。畝は z -144.5 から
     *    7.2m 間隔で6本(各 ±1.5m)なので、畝と畝の間の帯に鶏を置く。
     * ================================================================ */
    [[43,-141.0,1],[47.5,-140.2,0],[52,-133.8,1],[59,-133.2,1],
     [64,-126.6,0],[68,-119.6,1],[45,-119.0,1]].forEach(function(p){
      bird(group, p[0], p[1], rnd(p[0],p[1],11)*6.28, HEN, p[2]);
    });
    bird(group, 57.5, -140.6, 2.6, COCK, 0);
    registerPick(pickables, 'structure', 55, 0.9, -130, 34, 2.0, 34,
      '鶏 Chickens', '菜園に放し飼いにされた鶏。畝の虫をついばみ、卵と肉を城の台所に供給した。');

    /* ================================================================
     * E. 王の庭園(GQ.king = x -76..-34 / z -150..-104)の孔雀。花壇は
     *    中心 (-55,-127) から ±10.5 の4区画(各半幅8)なので、x -57.5..
     *    -52.5 の南北の通路は必ず空いている(井戸だけが (-55,-127))。
     * ================================================================ */
    [[-55.0,-141.5,0],[-54.2,-136.8,1],[-55.4,-114.0,0]].forEach(function(p,i){
      var yaw = rnd(p[0],p[1],13)*6.28;
      bird(group, p[0], p[1], yaw, PEACOCK, p[2]);
      if (i !== 1){
        // 雄の引きずる尾羽(閉じた状態)。扁平な楕円体を2枚重ねて表す
        var tc = at(group, p[0], 0, p[1], yaw);
        part(tc, peaTailMat, gEll(0.62, 0.05, 0.22), -0.72, 0.30, 0, 0, -0.22);
        part(tc, peaTailMat, gEll(0.44, 0.04, 0.15), -1.32, 0.16, 0, 0, -0.12);
      }
    });
    registerPick(pickables, 'structure', -55, 1.0, -128, 5.0, 2.2, 40,
      '孔雀 Peafowl', '王の庭園に放たれた孔雀。中世の宮廷では珍禽として飼われ、祝宴では羽根を飾って供された。');

    /* ================================================================
     * F. 水鳥。外堀の水面は x |94..107| / z |171.5..184.5|(WATER_Y=-2.6)。
     *    帯の中央に浮かべる。ドンジョン専用の堀にも家鴨を2羽。
     * ================================================================ */
    (function(){
      var wy = WATER_Y + 0.02;
      var midX = (rectMoat.waterHalfX + rectMoat.waterInnerHalfX)/2;
      var midZ = (rectMoat.waterHalfZ + rectMoat.waterInnerHalfZ)/2;
      [[ midX, -46, 2.2], [ midX, -18, -0.6], [ midX, 34, 1.3],
       [-midX,  62, 2.9], [-midX, -96, 0.3]].forEach(function(p){
        swimmer(group, p[0], wy, p[1], p[2], SWAN);
      });
      [[-22, -midZ, 1.1], [12, -midZ, -2.0], [-6, midZ, 0.4]].forEach(function(p){
        swimmer(group, p[0], wy, p[1], p[2], SWAN);
      });
      [[ midX, 6, 1.9], [ midX, 12, -1.2], [-midX, -30, 2.4], [-midX, -36, 0.8],
       [40, -midZ, 1.5], [46, -midZ, -0.9]].forEach(function(p){
        swimmer(group, p[0], wy, p[1], p[2], DUCK);
      });
      registerPick(pickables, 'structure', midX, WATER_Y + 0.6, -30, 8.0, 1.6, 60,
        '白鳥 Swans', '堀に浮かぶ白鳥。王家の水鳥として保護され、祝宴の一皿にもなった。堀では家鴨も飼われた。');
      // ドンジョンの堀には水鳥を置かない。実物は水堀ではなく乾堀(fossé
      // sec)で、切石積みの垂直な壁に囲まれた草地の堀底なので、泳ぐ鳥が
      // 浮く水面がそもそも存在しない(上の「ドンジョンの堀」節を参照)。
    })();

    /* ================================================================
     * G. 大塔上層(兵士詰所)の伝令鳩。詰所の藁パレットは DCZ+4.1..5.4、
     *    梯子は DCZ-1.6..-3.4 なので、西壁の DCZ+6.4 は空いている。
     *    interiorGroup に入れるので内側ティアがフェードすると現れる。
     * ================================================================ */
    (function(){
      var y = 31.5, lx = DCX - 6.9, lz = DCZ + 6.3;
      prop(interiorGroup, woodMat, gBox(0.55, 1.60, 2.20), lx, y + 1.75, lz);   // 巣箱の棚
      for (var r=0; r<3; r++){
        for (var cc=0; cc<3; cc++){
          prop(interiorGroup, windowMat, gBox(0.10, 0.34, 0.44),
               lx + 0.30, y + 1.15 + r*0.52, lz - 0.72 + cc*0.72);
        }
      }
      prop(interiorGroup, woodMat, gBox(0.60, 0.08, 2.30), lx + 0.62, y + 0.92, lz);  // 発着板
      perched(interiorGroup, lx + 0.75, y + 0.96, lz - 0.70, -0.3, DOVE);
      perched(interiorGroup, lx + 0.72, y + 0.96, lz + 0.62, 0.5, DOVE);
      perched(interiorGroup, lx + 0.80, y + 2.62, lz + 0.10, 0.1, DOVE);
    })();

    flush();
  })();


  /* ================================================================ *
   * V-0. 内壁の漆喰 -- ドンジョン5層とサント・シャペルの内側
   * ================================================================ *
   * ドンジョンの壁も礼拝堂の壁も 1 枚の BoxGeometry で、部屋から見える
   * 面はその箱の内側の面(法線が室内を向くので front face として実際に
   * 描かれている)。つまり外壁と内壁が **同じジオメトリ** を共有して
   * いるので、マテリアルだけを差し替えて漆喰にすることはできない。
   * そこで内側にごく薄い一枚板を張る。単純に mkBox を並べると 7 面 =
   * 7 ドローコール増えるので、面をまとめて 1 つの BufferGeometry に
   * 焼く(ドンジョン + 礼拝堂で計 2 ドローコール)。
   *
   * 板は片面(内向き)なので外からは一切見えない。壁の内面から数センチ
   * だけ室内側へずらして Z ファイティングを避ける。ずらす量は場所で違う:
   *  - ドンジョン … 窓(深さ 0.35m)は壁厚 0.9m の中に完全に埋まっていて
   *    室内側には出てこないので、内面から 0.06m 離せばよい。
   *  - サント・シャペル … 窓の箱のほうが壁より厚く、内面から 0.0675m
   *    室内側へ出ている。板はその面と壁の内面の **あいだ** に入れないと
   *    窓を隠してしまうので、offset は 0.034m(呼び出し側の注記を参照)。 */
  function innerLining(mat, quads){
    /* quads: [{ cx,cy,cz, w,h, nx,nz }] -- nx/nz は内向き(見える側)の
     * 法線。板は XY 平面の矩形を法線に合わせて置くだけなので、頂点は
     * 直に書き下す。UV は applyWorldUVs が位置と法線から引き直すので
     * ここではプレースホルダでよい(属性が無いと uvWorldize が素通り
     * してしまうため、0 で埋めた uv は必ず付ける)。 */
    var pos = [], nor = [], uvs = [], idx = [], base = 0;
    quads.forEach(function(q){
      // 面内の水平方向 = 法線を Y 軸まわりに 90 度回したもの
      var ux = -q.nz, uz = q.nx;
      var hw = q.w/2, hh = q.h/2;
      for (var s=-1; s<=1; s+=2) for (var t=-1; t<=1; t+=2){
        pos.push(q.cx + ux*hw*s, q.cy + hh*t, q.cz + uz*hw*s);
        nor.push(q.nx, 0, q.nz);
        uvs.push(0, 0);
      }
      var a=base, b=base+1, c=base+2, d=base+3;
      /* 頂点順は (s,t) = (-1,-1) (-1,+1) (+1,-1) (+1,+1)。
       * 面内の基底は u = (-nz, 0, nx)、v = +Y で、Y x u = +法線。
       * three の FrontSide は反時計回りが表なので、(a,b,c) / (b,d,c) と
       * 巻けば表が室内側(= 法線側)を向く。★ 向きを逆にすると、壁が
       * フェードした瞬間に「手前の壁の裏張り」が外から見えて内部を
       * 丸ごと塞ぐ(カットアウェイが死ぬ)。 */
      idx.push(a, b, c, b, d, c);
      base += 4;
    });
    var g = new T.BufferGeometry();
    g.setIndex(idx);
    g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    g.setAttribute('normal',   new T.Float32BufferAttribute(nor, 3));
    g.setAttribute('uv',       new T.Float32BufferAttribute(uvs, 2));
    g.computeBoundingSphere();
    var m = new T.Mesh(g, mat);
    m.castShadow = false; m.receiveShadow = true;
    interiorGroup.add(m);
    return m;
  }
  /* 内壁は外壁より一段暗い骨色。石灰は塗った直後こそ白いが、5 層ぶんの
   * 暖炉と松明の煤で数年もすれば落ち着く。灰色に振ると屋内がコンクリート
   * のパネルに見えたので、外壁と同系の暖色に留める。 */
  var plasterMat = texMat(0xa89a7c, 'plaster', { nrm: 0.6 });
  (function(){
    var t = DHALF - 0.51, y0 = -4.2, y1 = BODY_H - 1.0;
    var cy = (y0+y1)/2, h = y1-y0, w = DHALF*2 - 1.0;
    innerLining(plasterMat, [
      { cx:DCX, cy:cy, cz:DCZ-t, w:w, h:h, nx:0,  nz:1  },
      { cx:DCX, cy:cy, cz:DCZ+t, w:w, h:h, nx:0,  nz:-1 },
      { cx:DCX-t, cy:cy, cz:DCZ, w:w, h:h, nx:1,  nz:0  },
      { cx:DCX+t, cy:cy, cz:DCZ, w:w, h:h, nx:-1, nz:0  }
    ]);
  })();
  (function(){
    /* 礼拝堂の身廊。東端は後陣の石の面が受け持つので張らない。 */
    /* 側廊の裏張りだけは置ける範囲が狭い。壁の内面は |z-CHZ| = CH_IN
     * (6.60)、尖頭窓の箱は壁より 0.135 厚い(CH_WT*1.15)ので内面から
     * 0.0675 だけ室内側へ出ていて、その面が |z-CHZ| = 6.5325。裏張りは
     * この 2 面の **あいだ** に入れないと、窓を隠すか壁と Z ファイティング
     * するかのどちらかになる。中点(6.566 = CH_IN - 0.034)に置くと
     * 両側 34mm ずつ空く -- 内側ティアがフェードし始める 211m の距離でも
     * 深度バッファ 6 段ぶんあるので競合しない(near=0.5 / far=2500)。 */
    var zt = CH_IN - 0.034, cy = CH_EAVE/2, h = CH_EAVE - 0.4;
    var cx = (CH_WEST + CH_WT + CH_EAST)/2, w = CH_EAST - CH_WEST - CH_WT;
    innerLining(plasterMat, [
      { cx:cx, cy:cy, cz:CHZ-zt, w:w, h:h, nx:0, nz:1 },
      { cx:cx, cy:cy, cz:CHZ+zt, w:w, h:h, nx:0, nz:-1 },
      { cx:CH_WEST+CH_WT+0.06, cy:cy, cz:CHZ, w:CH_IN*2, h:h, nx:1, nz:0 }
    ]);
  })();

  /* ================================================================ *
   * V-1. 動くもの(煙 / 旗 / さざ波)の時計
   * ================================================================ *
   * メインループ(js/90-main.js)には手を入れられないので、毎フレームの
   * 更新は mesh.onBeforeRender に載せる(ボディアムと同じ手口)。three は
   * visible=false / 視錐台の外のオブジェクトには onBeforeRender を呼ば
   * ないので、frustumCulled=false の極小メッシュを1つだけ「時計」として
   * 置き、そこから煙・旗・水面をまとめて更新する(追加ドローコールは 1)。
   * 更新はすべて絶対時刻の純関数。ポストFXが1フレームに複数回シーンを
   * 描いても(光芒の遮蔽プリパス等)同じ時刻なら同じ結果になる。
   * ---------------------------------------------------------------- */
  var ANIM = [];
  function nowSec(){
    return (typeof performance !== 'undefined' && performance.now
            ? performance.now() : Date.now()) / 1000;
  }
  function envState(){
    var glow = 0, rain = 0, snow = 0, sunMul = 1;
    if (typeof CUR_TIME !== 'undefined' && CUR_TIME){ glow = CUR_TIME.windowGlow || 0; }
    if (typeof CUR_WEATHER !== 'undefined' && CUR_WEATHER){
      rain = CUR_WEATHER.rain || 0; snow = CUR_WEATHER.snow || 0;
      sunMul = CUR_WEATHER.sunMul != null ? CUR_WEATHER.sunMul : 1;
    }
    return { glow: glow, rain: rain, snow: snow, sunMul: sunMul };
  }
  (function(){
    /* 頂点が3つとも原点に重なった退化三角形。面積0なので1画素も塗らない
     * が renderObject は呼ばれる。transparent にしないのが肝心 -- three は
     * 不透明キューを先に描くので、renderOrder -1000 と合わせて「この
     * フレームで最初に呼ばれる」ことが保証され、旗(不透明メッシュ)も
     * 同じフレーム内で更新後に描かれる。 */
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
   * V-2. 煙突の煙
   * ================================================================ *
   * ドンジョンの鉛テラスに立つ 2 本の煙道(上の「屋根の煙突」節で置いた
   * DCX+2.9 / DCZ-1.4 と DCZ+3.4)から立てる。この 2 本は下の 5 層ぶんの
   * 暖炉 -- 評議の間・王の寝室・賓客の間 -- を集約した煙道なので、昼でも
   * 細く立ち、夜(暖炉が焚かれる)と雨雪(湿って白く重くなる)で増える。
   * 煙突は dRoof(内側ティア)にあるので、フェードで消えるときは煙も消す。
   * スプライト1枚 = 1ドローコールなので煙突あたり 5-6 枚に抑える。 */
  var WIND = { x: 0.80, z: 0.60 };     // 南西からの緩い風
  function smokePlume(fg, x, y0, z, opt){
    opt = opt || {};
    var n     = opt.count != null ? opt.count : 5;
    var rise  = opt.rise  != null ? opt.rise  : 12.0;
    var speed = opt.speed != null ? opt.speed : 0.13;
    var base  = opt.base  != null ? opt.base  : 0.55;
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
      var amt = Math.min(1.0, 0.82 + e.glow*0.18 + e.rain*0.16 + e.snow*0.12);
      var wind = 1 + e.rain*0.9 + e.snow*0.35;
      var op0 = base * amt * (fg ? fg.op : 1);
      // 昼 0x757068(空より暗い) -> 夜 0xb4afa5(淡い)
      var cr = 0.395 + (0.706-0.395)*e.glow;
      var cg = 0.377 + (0.686-0.377)*e.glow;
      var cb = 0.349 + (0.647-0.349)*e.glow;
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
  // 煙道の天端 = BODY_H + 2.95 + 0.35/2。少し上から出す。
  smokePlume(dRoof, DCX+2.9, BODY_H+3.3, DCZ-1.4, { base:0.46, rise:20, speed:0.098, count:6 }); // 王の寝室・評議の間の煙道
  smokePlume(dRoof, DCX+2.9, BODY_H+3.3, DCZ+3.4, { base:0.38, rise:17, speed:0.121, count:5 }); // 賓客の間の煙道

  /* ================================================================ *
   * V-3. 旗のはためき
   * ================================================================ *
   * 王城なので旗を立てる。地はフランス王家の青、竿側に金の帯(工房の
   * flag パラメータで色だけ差し替えてある。紋章の忠実再現は狙わない)。
   * 板を14x7に分割し、竿からの距離の2乗で振幅を増やす進行波(位相の
   * 違う2波の重ね合わせ)。
   *  - 主門(村の塔門)の胸壁に 2 本 … 外側ティア。遠景でまず目に入る
   *  - ドンジョン南東の隅塔の頂 … 内側ティア。城で一番高い旗
   * 布は影を落とさない(シャドウマップの描画では onBeforeRender が
   * 呼ばれず、1フレーム前の頂点で影が焼かれてちらつくため)。 */
  function flagOnTower(fg, x, z, baseY, opt){
    opt = opt || {};
    var poleH = opt.poleH != null ? opt.poleH : 6.4;
    var pole = mkCyl(0.10, 0.12, poleH, 6, metalMat);
    place(pole, x, baseY + poleH/2, z);
    fg.group.add(pole);
    var knob = mkCyl(0.19, 0.19, 0.19, 6, metalMat);
    place(knob, x, baseY + poleH + 0.09, z);
    fg.group.add(knob);

    var W = opt.w != null ? opt.w : 3.6, H = opt.h != null ? opt.h : 2.3;
    var geo = new T.PlaneGeometry(W, H, 14, 7);
    var mat = new T.MeshLambertMaterial({ map: TEX.flag, side: T.DoubleSide });
    var flag = new T.Mesh(geo, mat);
    flag.castShadow = false; flag.receiveShadow = false;
    flag.position.set(x + W/2 + 0.06, baseY + poleH - 0.35 - H/2, z);
    fg.group.add(flag);

    var pos = geo.attributes.position;
    var base = new Float32Array(pos.array);        // 静止形状を保存
    var seed = opt.seed || 0;
    ANIM.push(function(t, e){
      if (!fg.group.visible || !flag.visible) return;
      var gust = 0.78 + 0.34*Math.sin(t*0.31 + seed) + 0.16*Math.sin(t*0.83 + seed*2.1);
      var strength = gust * (1 + e.rain*0.55 + e.snow*0.2);
      var sp = 3.1 * (1 + e.rain*0.4);
      var arr = pos.array;
      for (var i=0;i<pos.count;i++){
        var bx = base[i*3], by = base[i*3+1];
        var u = (bx + W/2) / W;                    // 0 = 竿側、1 = 吹き流し端
        var amp = u*u * 0.52 * strength;
        var ph = u*4.6 - t*sp + by*1.05 + seed;
        var w1 = Math.sin(ph), w2 = Math.sin(ph*0.57 + 1.7);
        arr[i*3+2] = w1*amp + w2*amp*0.42;
        arr[i*3]   = bx - u*amp*0.30;              // 波打つぶん竿側へ縮む
        arr[i*3+1] = by + w2*amp*0.16;
      }
      pos.needsUpdate = true;
      geo.computeVertexNormals();
    });
    return flag;
  }
  /* 立てる場所は「上が平らなところ」に限る。9 基の外郭塔はどれも 4 面の
   * 急なスレート角錐を戴いていて(mkCone の半径 = max(w,d)*0.80、胸壁の
   * 天端から更に 8-9m)、胸壁に竿を立てると必ず屋根を突き抜ける。
   * 平らな天端を持つのは (a) ドンジョンの隅塔の鉛キャップ、(b) シェミーズ
   * の門塔(シャトレ)の胸壁 の 2 つだけなので、そこに立てる。 */
  // 隅塔の天端: parapet(DH-1.85..DH+0.05)の上に cap(..DH+0.10)
  flagOnTower(dTurrets, DCX+DHALF, DCZ-DHALF, DH + 0.10,
    { seed: 0.0, poleH: 7.0, w: 4.2, h: 2.6 });   // 北東の隅塔 -- 城内の最高点
  flagOnTower(dTurrets, DCX+DHALF, DCZ+DHALF, DH + 0.10,
    { seed: 2.3, poleH: 6.2, w: 3.6, h: 2.3 });   // 南東の隅塔
  /* シャトレ(シェミーズの門塔)の胸壁。この塔はフェード群ではなく素の
   * group に属するので、フェード状態を持たないスタンドインを渡す。 */
  flagOnTower({ group: group, op: 1 }, DCX+CHEM_HALF, DCZ, 23.0 - 1.2 + 1.5,
    { seed: 4.7, poleH: 5.4, w: 3.0, h: 1.9 });

  /* ================================================================ *
   * V-4. 外堀 -- 空を映す水面(フレネル反射 + 3スケールのさざ波)
   * ================================================================ *
   * 【方式はボディアム(castles/bodiam.js の moatWater)と同じ】
   *   1. Phong の鏡面ローブを殺す(specularStrength = 0)。太陽のきらめき
   *      は「空に太陽を置いて反射で拾う」。
   *   2. Schlick フレネル F0 = 0.02(水の正しい値)。真上から見ると
   *      ほぼ水中の色、視線が浅いと空を強く映す。この角度依存が水らしさ。
   *   3. 映す空は 11-environment.js と同じ6段グラデーション。しかもこの
   *      空はスカイドームではなく scene.background = 画面空間のグラデー
   *      ションなので、反射ベクトルをカメラに投影して画面 v 座標を出し、
   *      その位置の色を引く(screen-space の空に対する厳密な鏡像)。
   *   4. さざ波は 3 スケール(19 / 6.4 / 2.6m)の法線マップを互いに
   *      非通約な周期・別方向・別速度でスクロールして加算し、そのうえに
   *      方向波 3 本の解析的な傾きと **焦線(コースティクス)** を足す。
   *
   * 【ボディアムからの 2 点の相違と、その理由】
   *  (a) 堀の形が違う。ボディアムは正方形の環なので shore 距離が
   *      max(|x|,|z|) 一発で出たが、ヴァンセンヌは 175x330m の **長方形**
   *      の環で、しかも西側はドンジョン複合体を避けて切り欠いてある。
   *      そこで内外の矩形それぞれへのチェビシェフ距離を取り、その小さい
   *      ほうを「岸からの距離」とする(uWEdge を vec4 に拡張)。
   *  (b) 方向波を **頂点変位ではなくフラグメント側で解析的に評価** する。
   *      ボディアムは水面板を 0.85m 格子に張り替えて実際に上下させて
   *      いるが、ヴァンセンヌの堀は外周 1km 超・水面帯 13m で、同じ格子
   *      にすると約 23,000 四辺形(= 46,000 三角形)増える。シーン全体の
   *      三角形が 113,000 なので 40% 増になり、SwiftShader では割に合わ
   *      ない。しかも、この城の白鳥と家鴨は素材ごとに 1 メッシュへ統合
   *      されていて(livestock の flush)個体ごとに y を動かせないため、
   *      水面だけが上下すると鳥が波の谷で宙に浮く。
   *      → 波の高さ・傾き・ラプラシアン(焦線)は同じ WAVES 表から
   *        フラグメントで直に評価する。**見えとして効くのは傾きと焦線**
   *        で、そこは 1 ピクセルも変わらない。失われるのは水際の
   *        シルエットの上下だけだが、このビューアの最短カメラ距離は
   *        60m、堀を見るのは 85m 以上なので 0.13m の起伏は 1 画素に
   *        満たない(実測して確認した)。
   *
   * 【共有ファイルとの共存】
   * 11-environment.js は毎フレーム waterMat.color と .specular を時間帯色
   * で上書きする。ここが触るのは normalMap / onBeforeCompile の自前
   * ユニフォームと shininess だけなので競合しない。水の地の色(= 水中の
   * 色)は今までどおり CUR_TIME.waterColor が決める。
   *
   * 【ドンジョンの堀には手を触れていない】
   * ドンジョンを囲むのは水堀ではなく乾堀(fossé sec)で、切石積みの
   * 垂直な壁と草の堀底しかない。ここには水面が存在しないので、この節は
   * 外堀(rectMoat)だけを相手にする。
   * ================================================================ */
  (function moatWater(){
    var n1 = TEX.waterN1, n2 = TEX.waterN2, n3 = TEX.waterN3;

    /* ---- 水面板を1枚に張り替える ----------------------------------
     * 元は 4-5 枚の PlaneGeometry(UV が面ごとに 0..1)。シェーダは vUv を
     * **メートル座標** として使うので、頂点を作り直して uv=(x,-z) を直に
     * 入れる。ついでに 5 枚を 1 メッシュへ統合するのでドローコールは減る。
     * 帯の内訳は buildRectMoatSystem の waterSlab と同じ(西側だけ
     * ドンジョンの切り欠きで 2 本に割れる)。 */
    var W_IN_X = rectMoat.waterInnerHalfX, W_IN_Z = rectMoat.waterInnerHalfZ;
    var W_OT_X = rectMoat.waterHalfX,      W_OT_Z = rectMoat.waterHalfZ;
    (function rebuildWaterPlane(){
      var pos = [], uvs = [], nor = [], idx = [];
      function slab(x0,x1,z0,z1){
        if (x1-x0 < 0.01 || z1-z0 < 0.01) return;
        var b = pos.length/3;
        [[x0,z0],[x1,z0],[x0,z1],[x1,z1]].forEach(function(p){
          pos.push(p[0], 0, p[1]); nor.push(0,1,0); uvs.push(p[0], -p[1]);
        });
        idx.push(b, b+2, b+1, b+1, b+2, b+3);      // +Y を向く巻き
      }
      slab(-W_OT_X, W_OT_X, -W_OT_Z, -W_IN_Z);     // 北
      slab(-W_OT_X, W_OT_X,  W_IN_Z,  W_OT_Z);     // 南
      slab( W_IN_X, W_OT_X, -W_IN_Z,  W_IN_Z);     // 東
      slab(-W_OT_X,-W_IN_X, -W_IN_Z,  DONJON_KEEPOUT.minZ);   // 西(堀の北側)
      slab(-W_OT_X,-W_IN_X,  DONJON_KEEPOUT.maxZ,  W_IN_Z);   // 西(堀の南側)
      var g = new T.BufferGeometry();
      g.setIndex(idx);
      g.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
      g.setAttribute('normal',   new T.Float32BufferAttribute(nor, 3));
      g.setAttribute('uv',       new T.Float32BufferAttribute(uvs, 2));
      g.computeBoundingSphere();
      var mw = rectMoat.moatWater;
      for (var i = mw.children.length - 1; i >= 0; i--){
        var c = mw.children[i];
        if (c.geometry && c.geometry.dispose) c.geometry.dispose();
        mw.remove(c);
      }
      var m = new T.Mesh(g, waterMat);
      m.receiveShadow = false; m.castShadow = false;
      mw.add(m);
      /* waterMat には uvDensity を付けないので、末尾の applyWorldUVs は
       * このメッシュを素通りする(= uv はメートル座標のまま残る)。 */
    })();

    /* vUv をメートル座標そのものに固定する。repeat=1 / offset=0 に
     * しておけば uvTransform が単位行列になる。r128 は map が無い場合
     * normalMap の matrix を uvTransform に流すので、ここを動かすと 3 枚
     * とも一緒に動いてしまう -- だから n1.offset は使わない(スクロールは
     * 全部シェーダ側の自前ユニフォームでやる)。 */
    n1.repeat.set(1, 1); n1.offset.set(0, 0);
    waterMat.normalMap = n1;                       // USE_NORMALMAP と vUv を有効にするため
    waterMat.normalScale = new T.Vector2(1, 1);    // 自前で法線を組むので未使用
    waterMat.shininess = 1;                        // 鏡面はシェーダ側で完全に殺す

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
    var uEdge   = { value: new T.Vector4(W_IN_X, W_IN_Z, W_OT_X, W_OT_Z) };
    var uFoam   = { value: 0.30 };
    var uTime   = { value: 0 };
    var uSpark  = { value: 0.20 };
    var uCaus   = { value: 0.72 };

    /* ---- 方向波 ------------------------------------------------------
     * dx,dz は単位ベクトル。lam=波長(m)、amp=振幅(m)、spd=位相速度(m/s)。
     * 波長は互いに非通約(15 / 6.6 / 4.2)。焼いた法線マップは等方的な
     * value noise なので、傾きを上げても「波」ではなく「まだらな染み」が
     * 濃くなるだけ -- 稜線を持つ構造はこの 3 本が受け持つ。 */
    var WAVES = [
      { dx:  0.9406, dz:  0.3395, lam: 15.0, amp: 0.130, spd: 0.60 },
      { dx: -0.4191, dz:  0.9080, lam:  6.6, amp: 0.070, spd: 0.50 },
      { dx:  0.7779, dz: -0.6283, lam:  4.2, amp: 0.036, spd: 0.42 }
    ];
    /* コースティクスの正規化係数。 -Laplacian(h) = Σ A k^2 sin(位相) の最大値。 */
    var W_CAUS_NORM = (function(){
      var t = 0;
      for (var i = 0; i < WAVES.length; i++){
        var k = 2 * Math.PI / WAVES[i].lam;
        t += WAVES[i].amp * k * k;
      }
      return t;
    })();
    var W_FADE = 3.2;                  // 岸から何メートルで波を止めるか

    /* GLSL は JS のテーブルから組み立てる。数値を 2 か所に書くと必ず
     * ずれるので、波の定義はこの WAVES だけが持つ。
     * 傾きは sin の微分そのもの。法線マップと同じ約束
     * ( wS.x -> Nworld.x, -wS.y -> Nworld.z )に合わせて渡すため、
     *   N は ( -dH/dx, 1, -dH/dz ) に比例 -> ( -wG.x, +wG.y ) とする。 */
    function waveGLSL(px, pz){
      var out = [];
      for (var i = 0; i < WAVES.length; i++){
        var w = WAVES[i], k = 2 * Math.PI / w.lam, om = k * w.spd;
        out.push(
          '  { float wp = ' + (w.dx * k).toFixed(6) + ' * ' + px + ' + ' +
                              (w.dz * k).toFixed(6) + ' * ' + pz + ' - ' +
                              om.toFixed(6) + ' * uWTime;',
          /* 帯域制限。ボディアムは波を頂点で作るので、遠景では格子ごと
           * 潰れて自動的に消える。こちらはフラグメントで解析的に評価する
           * ので、そのままだと 1 波長が 1 画素を切ったところでエイリアス
           * になり、遠景の堀がちらちらした縞になる(zoom=0.3 の実測で
           * 確認した)。1 波長あたり 7 画素を割ったら振幅を落として
           * 消し込む -- ミップマップが法線マップに対してやっているのと
           * 同じことを、解析的な波に対して手でやっている。 */
          '    float wl = clamp( ' + w.lam.toFixed(2) + ' / ( 7.0 * wPx ), 0.0, 1.0 );',
          '    float ws = sin( wp ) * wl;',
          '    wWC += ' + (w.amp * k * k).toFixed(6) + ' * ws;',
          '    wWG += ( ' + (w.amp * k).toFixed(6) + ' * cos( wp ) * wl ) * vec2( ' +
                            w.dx.toFixed(4) + ', ' + w.dz.toFixed(4) + ' ); }'
        );
      }
      return out;
    }

    waterMat.onBeforeCompile = function(sh){
      /* 差し替え対象のチャンク名は three のバージョンに依存する。3つとも
       * 見つかったときだけ差し込む。1つでも欠けた状態で残りを入れると
       * 未定義の変数を参照する GLSL になり、水面が真っ黒 + コンソール
       * エラーになる(ボディアム側の注記と同じ罠)。 */
      var SPM = '#include <specularmap_fragment>',
          NFM = '#include <normal_fragment_maps>',
          FOG = '#include <fog_fragment>';
      var fs = sh.fragmentShader;
      if (fs.indexOf(SPM) < 0 || fs.indexOf(NFM) < 0 || fs.indexOf(FOG) < 0) return;

      sh.uniforms.uWN2 = uN2;         sh.uniforms.uWN3 = uN3;
      sh.uniforms.uWOff1 = uOff1;     sh.uniforms.uWOff2 = uOff2;   sh.uniforms.uWOff3 = uOff3;
      sh.uniforms.uWSky = uSky;       sh.uniforms.uWSunCol = uSunCol;
      sh.uniforms.uWSunDirV = uSunDirV;
      sh.uniforms.uWProjY = uProjY;   sh.uniforms.uWAmp = uAmp;
      sh.uniforms.uWSkyGain = uSkyGain; sh.uniforms.uWGlint = uGlint;
      sh.uniforms.uWEdge = uEdge;     sh.uniforms.uWFoam = uFoam;
      sh.uniforms.uWFog = uFog;       sh.uniforms.uWHaze = uHaze;
      sh.uniforms.uWTime = uTime;     sh.uniforms.uWSpark = uSpark;
      sh.uniforms.uWCaus = uCaus;

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
        'uniform float uWSkyGain;',
        'uniform float uWGlint;',
        'uniform vec4 uWEdge;',
        'uniform float uWFoam;',
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
        '}',
        /* 岸からの距離。内側の矩形の外へ出た距離と、外側の矩形の内へ
         * 入った距離の小さいほう(どちらもチェビシェフ距離)。長方形でも
         * 隅でも破綻しない。 */
        'float wShore( vec2 p ){',
        '  vec2 a = abs( p );',
        '  float dIn  = max( a.x - uWEdge.x, a.y - uWEdge.y );',
        '  float dOut = min( uWEdge.z - a.x, uWEdge.w - a.y );',
        '  return min( dIn, dOut );',
        '}'
      ].join('\n') + '\n' + fs;

      // 1) Phong の鏡面ローブを完全に殺す。専用の specular 項は書かない。
      fs = fs.replace(SPM, 'float specularStrength = 0.0;');

      /* 2) 法線: 3スケールの接空間法線 + 方向波 3 本の解析的な傾きを
       * 足して、平面(y up)であることを使って直接ワールド法線を組む。
       * perturbNormal2Arb は画面空間微分から TBN を推定する近似で、3枚を
       * 別スケールで混ぜると精度が落ちるうえ、堀は完全な水平面なので
       * 推定する必要がない。
       *   uv.x = worldX, uv.y = -worldZ なので
       *   T = +X, B = -Z, N = +Y  ->  Nworld = ( s.x, 1, -s.y )
       * タイル周期 19 / 6.4 / 2.6m は互いに非通約(比 2.97 / 2.46)で、
       * 3枚が同時に揃う周期が視界内に来ない。
       * 重みはボディアムと同じ 1.30 / 0.80 / 0.50(焼いた法線マップが
       * 実際に持っている傾きの中央値 0.082/0.079/0.117 から決めた値)。 */
      fs = fs.replace(NFM, [
        '  float wWsh = clamp( wShore( vUv ) / ' + W_FADE.toFixed(2) + ', 0.0, 1.0 );',
        '  wWsh = wWsh * wWsh * ( 3.0 - 2.0 * wWsh );',       // 岸で波を止める
        '  float wWA = wWsh * ( 0.62 + 0.38 * uWAmp );',
        // vUv はメートル座標なので fwidth は「1画素あたり何メートルか」
        '  float wPx = max( max( fwidth( vUv.x ), fwidth( vUv.y ) ), 1e-4 );',
        '  float wWC = 0.0; vec2 wWG = vec2( 0.0 );'
      ].concat(waveGLSL('vUv.x', '-vUv.y')).concat([
        '  vec2 wS  = ( texture2D( normalMap, vUv * 0.05263 + uWOff1 ).xy * 2.0 - 1.0 ) * 1.30;',
        '  wS      += ( texture2D( uWN2,      vUv * 0.15625 + uWOff2 ).xy * 2.0 - 1.0 ) * 0.80;',
        '  wS      += ( texture2D( uWN3,      vUv * 0.38462 + uWOff3 ).xy * 2.0 - 1.0 ) * 0.50;',
        '  wS *= uWAmp;',
        /* ノイズ 3 枚と違って方向波は「稜線」を持つので、真上から見た
         * ときに波が線として読める。 */
        '  wS += vec2( -wWG.x, wWG.y ) * wWA;',
        '  float wCaus = wWC * ' + (1 / W_CAUS_NORM).toFixed(4) + ' * wWA;',
        '  vec3 wNW = normalize( vec3( wS.x, 1.0, -wS.y ) );',
        '  normal = normalize( mat3( viewMatrix ) * wNW );'
      ]).join('\n'));

      /* 3) 合成。fog の直前なので gl_FragColor には拡散光だけが入って
       * いる(= 水中の色。時間帯で変わる CUR_TIME.waterColor 由来)。
       *   ・反射ベクトルをカメラに投影して画面 v を出し、同じ空の
       *     グラデーションを引く(screen-space の空の厳密な鏡像)。
       *   ・太陽は「空側のディスク」として反射経由でだけ入れる。
       *   ・岸辺は薄い泡/濡れ。細かい法線で縁をぎざぎざにする。
       * fog はこの後に掛かるので、遠くの水面は空・山と同じ霧色へ沈む。*/
      fs = fs.replace(FOG, [
        '  vec3  wUp  = normalize( mat3( viewMatrix )[ 1 ] );',   // ワールド +Y のビュー空間での向き
        '  vec3  wV   = normalize( vViewPosition );',
        '  float wNdv = clamp( dot( normal, wV ), 0.0, 1.0 );',
        /* 濁った水の「見かけの深さ」。視線側に傾いた波面は水中を通る距離
         * が短くなるので明るく、逆に傾けば暗く見える。平らな面では差が 0
         * になるよう、同じ視線に対する「傾いていない場合の N・V」との差
         * だけを使う(視点に依らない)。 */
        '  float wFlt = clamp( dot( wUp, wV ), 0.0, 1.0 );',
        '  gl_FragColor.rgb *= 1.0 + clamp( ( wNdv - wFlt ) * 6.0, -0.30, 0.30 );',
        /* 焦線(コースティクス)。上の屈折項は真上から見ると必ず暗くなる
         * 方向にしか動かないので、それだけだと水面は「暗いシミ」ばかりで
         * 波に見えない。水面を通った光は峰の下で収束し谷の下で発散する。
         * その強さは高さのラプラシアンに比例し、正弦波なら
         *   -Laplacian(h) = Σ A k^2 sin(位相) = 峰で正・谷で負。
         * 峰が明るく谷が暗い **対称な** 変化なので、初めて「波の筋」として
         * 読める。 */
        '  gl_FragColor.rgb *= 1.0 + uWCaus * wCaus;',
        '  vec3  wR   = reflect( -wV, normal );',
        '  float wP   = clamp( 0.5 - 0.5 * ( uWProjY * wR.y / max( -wR.z, 1e-3 ) ), 0.0, 1.0 );',
        '  float wF   = 0.02 + 0.98 * pow( 1.0 - wNdv, 5.0 );',
        '  float wSd  = max( dot( wR, uWSunDirV ), 0.0 );',
        /* 反射光路のかすみ。反射ベクトルが水平に近いほど、その光は地平線
         * まで長い大気を通って来たことになるので霧色へ寄る。この空は
         * scene.background = 画面空間グラデーションなので、地平線のすぐ
         * 上に出ているのは sky[0]〜sky[1] で、実際に画面で地平線の帯を
         * 作っているのは fogColor のほう。そこへ寄せて初めて水平線で色が
         * 繋がる。 */
        '  float wRy  = dot( wR, wUp );',
        '  float wHz  = ( 1.0 - clamp( wRy * 4.0, 0.0, 1.0 ) ) * uWHaze;',
        /* 太陽は「空側に置いた円板」で、専用の specular 項ではない。
         * 芯 pow(sd,160) + 裾 pow(sd,16)。芯を 1 より十分明るくしておか
         * ないと、このあと F を掛けた時点でただの薄い染みになる。上限は
         * clamp で押さえて白飛びを防ぐ。 */
        '  vec3  wGl  = min( uWSunCol * uWGlint * ( pow( wSd, 160.0 ) + 0.30 * pow( wSd, 16.0 ) ), vec3( 0.95 ) );',
        '  vec3  wRef = mix( wSkyAt( wP ) * uWSkyGain, uWFog, wHz ) + wGl;',
        '  gl_FragColor.rgb = mix( gl_FragColor.rgb, wRef, wF );',
        /* 真上寄りの視点では wF が 0.02 まで落ちるので、上の mix では
         * きらめきが 1/50 に潰れて一切見えない。太陽を映す向きに立った
         * 波面だけが光る項なので、フレネルの外側にも一定割合を足す。 */
        '  gl_FragColor.rgb += wGl * ( uWSpark * ( 1.0 - wF ) );',
        '  float wEg  = 1.0 - clamp( wShore( vUv ) / 1.5, 0.0, 1.0 );',
        '  float wFn  = texture2D( uWN3, vUv * 0.31 + uWOff3 * 1.7 ).x;',
        '  float wFm  = uWFoam * wEg * wEg * clamp( wFn * 1.9 - 0.62, 0.0, 1.0 );',
        '  gl_FragColor.rgb = mix( gl_FragColor.rgb, wSkyAt( 0.92 ) * 0.80, wFm );',
        '  gl_FragColor.a = clamp( gl_FragColor.a + wF * 0.20 + wFm * 0.5, 0.0, 1.0 );',
        /* 水面だけの白飛び止め。このビューアはトーンマッピングを掛けて
         * いない = gl_FragColor がほぼそのまま 0-255 になるので、水面の
         * 出力だけ 0.96 (245/255) で頭を打たせておけば、きらめきの形を
         * 保ったまま水が 254 に到達しなくなる。fog はこのあと霧色へ寄せる
         * だけなので、この上限を破らない。 */
        '  gl_FragColor.rgb = min( gl_FragColor.rgb, vec3( 0.96 ) );',
        '#include <fog_fragment>'
      ].join('\n'));

      sh.fragmentShader = fs;
    };
    waterMat.customProgramCacheKey = function(){ return 'vincennes-moat-fresnel-v1'; };
    waterMat.needsUpdate = true;

    /* ---- 毎フレームの更新 -------------------------------------------
     * 決定性のため Math.random() は一切使わない。すべて絶対時刻 t の
     * 純関数。 */
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
      /* 雨のときは波立つ: 振幅と流れる速さを上げる */
      var rain = e.rain || 0;
      var sp = 1 + rain * 1.30;
      uAmp.value = 1 + rain * 0.80;
      // 単位はタイル/秒。実速度 = 速度 x タイル実寸 -> 0.10 / 0.17 / 0.26 m/s
      uOff1.value.set(  t * 0.00526 * sp,  t * 0.00311 * sp );
      uOff2.value.set( -t * 0.02031 * sp,  t * 0.01750 * sp );
      uOff3.value.set(  t * 0.04100 * sp, -t * 0.09231 * sp );
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
          for (var i = 0; i < 6; i++){
            _wSkyC.copy(CUR_TIME.sky[i]);
            wDesat(_wSkyC, sat);
            uSky.value[i].set(_wSkyC.r, _wSkyC.g, _wSkyC.b);
          }
        }
        /* 太陽(夜は月)の色と強さ。天候で弱まるので e.sunMul を掛ける。
         * ★向きは 11-environment.js の sunAnchorDir をそのまま使う。
         * このビューアの太陽円板と光芒は「仰角を 0.13rad へクランプした
         * 見かけの方向」に描かれている。水面のきらめきは太陽の鏡像なので、
         * 円板と別の向きで計算すると「水に映った太陽」と「空の太陽」が
         * 縦にずれ、一目で嘘だと分かる。 */
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
   * すべてのメッシュを組み終えた **あと** に1回だけ走らせる。 */
  applyWorldUVs(group);

  /* -------------------------------------------------------------- *
   * info payload + always-on labels (shared helper, see buildLabelGroup
   * in section 0 -- covers both structure and room pickables).
   * -------------------------------------------------------------- */
  var info = { rooms: donjonFloors.map(function(f){ return { name:f.name, desc:f.desc }; }) };
  var labelGroup = buildLabelGroup(group, pickables);

  /* ---- resident life data (section 6.5): 村の塔門(北)と森の塔門(南)の
   * 2門、広大な中庭は複数矩形でシェミーズ内側(ドンジョン専用の堀の内側)
   * とサント・シャペルの躯体を避けて定義。衛兵の周回路は壁沿いの内周を
   * たどりつつ、ドンジョン複合体の周りだけ迂回する(常にy=0の地面上)。 */
  // gate.path: 中庭側の門口(内側、塔の裏面)から塔躯体を貫く新しい開口を
  // 抜けた先(外側、塔の表面)までの中心線。toGate/through がこの線分を
  // 必ず経由してから outside の消失フェードに入る(section 6.5 参照)。
  var life = {
    gates: [
      { path:[ {x:0,z:-OHZ+GATE_D/2}, {x:0,z:-OHZ-GATE_D/2} ], outDir:{x:0,z:-1},
        vanishDist: (MOAT_OHZ - OHZ + 8) - GATE_D/2 },  // 村門塔 Tour du Village(北)
      { path:[ {x:0,z: OHZ-GATE2_D/2}, {x:0,z: OHZ+GATE2_D/2} ], outDir:{x:0,z:1},
        vanishDist: (MOAT_OHZ - OHZ + 8) - GATE2_D/2 }  // 木の門塔 Tour du Bois(南)
    ],
    // 礼拝堂は東西方向(X 方向)に身廊を通すよう向きを正したので、
    // その躯体(x=4..46 / z=17..33、控え壁と西正面塔を含め x=1..49 / z=14..36)を
    // 避けるように中庭の区画も引き直す。
    // 中庭に王の庭園・菜園・果樹園・農作業場(四隅、x=±34..76 / z=∓104..∓150)
    // と城壁沿いの並木(x=±83.5)を入れたので、住人が植栽に埋まらないよう
    // 区画をその外側へ引き直した。南北の門へは中央の参道(|x|<=30)が通る。
    // ドンジョンの堀を実物どおりの幅20m・深さ7mの乾堀に作り直したので、
    // 堀の外縁(逆壁の外面)は x -140..-50 / z 5..95 まで広がった。住人が
    // 7m下の堀底へ落ちないよう、西側に掛かる区画と巡回路をすべてその外へ
    // 引き直す(旧値は x -58 / -60 で、いまや堀の中)。
    courtyard: [
      { minX:-78, maxX:78,  minZ:-100, maxZ:2 },   // 北の主要広場(四隅の庭より内側、堀の北縁 z=5 の手前で止める)
      { minX:-30, maxX:30,  minZ:-158, maxZ:-100 },// 北門(村の塔門)へ続く中央参道
      { minX:-46, maxX:78,  minZ:92,   maxZ:100 }, // 南側の帯(堀の東縁 x=-50 より東だけ)
      { minX:-30, maxX:30,  minZ:100,  maxZ:158 }, // 南門(木の門塔)へ続く中央参道
      { minX:-46, maxX:-6,  minZ:8,    maxZ:92 },  // ドンジョン(シェミーズ)と礼拝堂の間の帯
      { minX:56,  maxX:78,  minZ:8,    maxZ:92 },  // 礼拝堂と東城壁の間の帯
      { minX:-6,  maxX:56,  minZ:44,   maxZ:92 }   // 礼拝堂南側の前庭(生垣の南)
    ],
    patrol: [
      [80,0,-158], [80,0,158], [-80,0,158], [-80,0,100],
      [-46,0,100], [-46,0,0], [-80,0,0], [-80,0,-158]
    ],
    population: { farmers: 24, guards: 6 }
  };

  return { group: group, fadeGroups: fadeGroups, interiorGroup: interiorGroup, info: info,
    pickables: pickables, windowMat: windowMat, waterMats: [waterMat], labelGroup: labelGroup, life: life };
}

registerCastle({
  id: 'vincennes',
  name: 'Château de Vincennes',
  nameJa: 'ヴァンセンヌ城',
  country: 'France',
  countryJa: 'フランス',
  flag: '🇫🇷',
  year: '1380',
  description: 'フランス王シャルル5世が14世紀に築いた、高さ52mを誇る欧州最大級のドンジョンと1km超の城壁を持つ中世要塞。パリ郊外の森に建つ王権の象徴。',
  build: buildVincennes,
  // much larger footprint than Bodiam (330x175m enceinte vs. 33m square)
  // -- pull the camera back, extend fog/shadow/far-clip range, and push
  // the shared background mountain rings out (envScale) so they still
  // clear the zoom clamp. envLift (negative -- see applyCastle) nudges
  // the ring back down so its ridge actually projects inside the camera
  // frustum at Vincennes' scale, not just technically past the far clip.
  view: { targetY: 20, zMin: 60, zMax: 600, initDist: 450,
    fogNear: 300, fogFar: 1200, shadowExtent: 250, shadowFar: 900,
    camFar: 2500, panLimit: 220, envScale: 2.2, envLift: -55 }
});
