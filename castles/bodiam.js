"use strict";

/* ====================================================================
 * 1. Bodiam Castle procedural builder
 * ====================================================================
 * Returns { group, fadeGroups, interiorGroup, info }.
 * fadeGroups is a flat array of descriptors so the reveal/cutaway loop
 * (section 4) can stay generic across any castle added to the registry:
 *   { group: THREE.Group, mat: THREE.Material, dir: {x,z}|null, roof: bool, op: number }
 * `dir` is the outward-facing unit vector used for camera-facing tests;
 * `roof` marks groups that also fade out completely (independent of
 * camera azimuth) once the viewer is close enough to see the room plan.
 */
function buildBodiam(){
  var group = new T.Group();
  var interiorGroup = new T.Group();
  group.add(interiorGroup);
  var fadeGroups = [];
  var pickables = [];   // hover/tap tooltip targets: rooms + major structures

  function makeFadeGroup(name, dir, isRoof, colorHex, roughness){
    var mat = new T.MeshLambertMaterial({ color: colorHex });
    var g = new T.Group();
    g.name = name;
    group.add(g);
    var desc = { group:g, mat:mat, dir:dir, roof: !!isRoof, op:1, name:name };
    fadeGroups.push(desc);
    return desc;
  }

  /* ---- palette : Sussex "honey" sandstone -------------------------
   * Photo-matched against the classic north-front reference (see the
   * build notes at the foot of this file): Bodiam's ashlar reads as a
   * pale golden buff, noticeably lighter and warmer than the previous
   * mid-tan, with the weathered lower courses a touch greyer. The moat
   * is a murky grey-green (it is a still, silty pond, not open sea) and
   * the banks are turf right down to the waterline -- the old sandy
   * bank colours produced a "beach" ring that Bodiam does not have. */
  var STONE_WALL   = 0xd8c093;
  var STONE_WALL_V = 0xd0b78a; // slight variance for towers
  var STONE_DARK   = 0x9c8564;
  var STONE_BASE   = 0xb6a079; // weathered plinth courses at the waterline (only a shade darker)
  var ROOF_COL     = 0x5f574c;
  var TIMBER_COL   = 0x5b4530;
  var WINDOW_COL   = 0x1c150e;
  var FLOOR_COL    = 0xa89a80;
  var STUB_COL     = 0x7c6c50;
  var WOOD_COL     = 0x6b4f34;
  var METAL_COL    = 0x2a2925;
  var WATER_COL    = 0x3d6257;
  var GRASS_COL    = 0x5c7a48;
  var GRASS_COL2   = 0x6c8a52;
  var BANK_COL     = 0x6d8449; // bank ramp, dry turf at the top
  var BANK_MID_COL = 0x4d5c33; // bank ramp, mid-slope
  var BANK_EDGE_COL= 0x2b2c1c; // bank ramp, wet silt right at the waterline
  var TILE_COL     = 0x7a5240;
  // central lawn. Pulled down from 0x6a8d4f: at day/clear the green
  // channel is multiplied by ~1.94, so 0x8d (141) clipped to 255 and the
  // whole courtyard rendered as one flat, shadeless poster green -- which
  // the new courtyard planting sits on top of. 0x74 (116) x 1.94 = 225,
  // so the lawn keeps its shading gradient.
  var COURT_GRASS_COL = 0x5a7442;

  var windowMat = new T.MeshLambertMaterial({ color: WINDOW_COL });
  var floorMat  = new T.MeshLambertMaterial({ color: FLOOR_COL }); // stone slab under each wing (grey-sand, one step above the lawn)
  var stubMat   = new T.MeshLambertMaterial({ color: STUB_COL, side: T.DoubleSide });
  var partitionMat = new T.MeshLambertMaterial({ color: 0x8a7a5e, side: T.DoubleSide }); // room-dividing stub walls
  var woodMat   = new T.MeshLambertMaterial({ color: WOOD_COL });
  var metalMat  = new T.MeshLambertMaterial({ color: METAL_COL });
  var tileMat   = new T.MeshLambertMaterial({ color: TILE_COL });
  var grassMat  = new T.MeshLambertMaterial({ color: GRASS_COL });
  var grassMat2 = new T.MeshLambertMaterial({ color: GRASS_COL2 });
  var courtGrassMat = new T.MeshLambertMaterial({ color: COURT_GRASS_COL });
  var wellMat   = new T.MeshBasicMaterial({ color: 0x2e6a7a });

  /* ---- interior fittings / planting palette ------------------------
   * EXPOSURE BUDGET. A horizontal, upward-facing Lambert surface at
   * time=day / weather=clear receives roughly
   *   R x1.98,  G x1.94,  B x1.84
   * (sun 1.55 @ colour 0xfff2d8 with the day sun vector 66% overhead,
   * plus hemi 0.65 @ sky 0xdfe9f2, plus fill 0.22 @ 0xffffff -- see
   * TIME_PRESETS.day in js/11-environment.js). Any base channel above
   * ~120 therefore clips to 255 on a flat top face and the material
   * turns into a flat, over-saturated poster colour. Every base colour
   * below is kept at or under 0x77 per channel so that base x 1.98
   * lands under 235 and the shading gradient survives. */
  var oakMat     = new T.MeshLambertMaterial({ color: 0x5a4128 }); // 家具の樫材(既存 woodMat より濃い)
  var oakLtMat   = new T.MeshLambertMaterial({ color: 0x6f5334 }); // 板材・棚・柵
  var ashlarMat  = new T.MeshLambertMaterial({ color: 0x6f6858 }); // 屋内の切石(柱・ヴォールト)
  var ashlarDkMat= new T.MeshLambertMaterial({ color: 0x554f42 }); // 柱頭・礎盤
  var strawMat   = new T.MeshLambertMaterial({ color: 0x6e6234 }); // 藁・干し草・床の藺草
  var soilMat    = new T.MeshLambertMaterial({ color: 0x463527 }); // 菜園の畝の土
  var cropMat    = new T.MeshLambertMaterial({ color: 0x4e6b38 }); // 野菜の葉
  var herbMat    = new T.MeshLambertMaterial({ color: 0x5a6b46 }); // 薬草(灰緑)
  var leafDkMat  = new T.MeshLambertMaterial({ color: 0x3d5a2e }); // 樹冠(下層)
  var leafMdMat  = new T.MeshLambertMaterial({ color: 0x4c6b38 }); // 樹冠(上層)
  var barkMat    = new T.MeshLambertMaterial({ color: 0x4a3a2a }); // 幹・薪
  var clothRedMat= new T.MeshLambertMaterial({ color: 0x6a2b26 }); // タペストリー(赤)
  var clothBluMat= new T.MeshLambertMaterial({ color: 0x2f3f60 }); // タペストリー(青)
  var clothCrmMat= new T.MeshLambertMaterial({ color: 0x6f6a4c }); // 麻布・穀物袋
  var potMat     = new T.MeshLambertMaterial({ color: 0x6a4331 }); // 素焼きの甕・鉢
  var hearthMat  = new T.MeshLambertMaterial({ color: 0x2a1c14 }); // 炉の火床(既存の炉と同色)
  var emberMat   = new T.MeshBasicMaterial({ color: 0xb4471a });   // 熾火(ライティング非依存)
  var flameMat   = new T.MeshBasicMaterial({ color: 0xffb95e });   // 蝋燭の炎
  var glassPurMat= new T.MeshBasicMaterial({ color: 0x7a5f9c });   // ステンドグラス
  var glassRedMat= new T.MeshBasicMaterial({ color: 0xa84a3c });
  var glassBluMat= new T.MeshBasicMaterial({ color: 0x3f6ea8 });

  /* ---- footprint constants (metres) --------------------------------
   * Measured off the published ground plan (scale bar) and the classic
   * north-front photograph, both listed in the build notes at the foot
   * of this file. Key real-world proportions the numbers below target:
   *   curtain square           ~45 m per side  (was modelled at 33 m)
   *   round corner tower dia.  ~8.2 m  = 0.18 x side (was 0.28 x side)
   *   gatehouse block width    ~13.7 m = 0.30 x side (was 0.52 x side)
   *   corner tower parapet     ~1.7 x the curtain parapet height
   *   gatehouse parapet        TALLER than the corner towers -- Bodiam's
   *                            twin gate towers are its highest point,
   *                            which the old numbers had backwards. */
  var OW = 22.0;       // outer curtain wall half-extent (44m side)
  var WT = 2.0;        // wall thickness
  var WH = 10.8;       // wall height to the wall-walk
  var MER = 1.6;       // merlon height (photo: merlons are tall slabs, ~1.9m)

  var CORNER_R = 4.3, CORNER_H = 18.0, CORNER_ROOF_H = 1.5;
  var MID_W = 5.6, MID_PROJ = 4.6, MID_H = 14.6, MID_ROOF_H = 1.4;
  var GATE_W = 5.3, GATE_PROJ = 5.6, GATE_H = 20.4, GATE_ROOF_H = 2.0, GATE_GAP = 3.6;

  var BATTER_BOT = -1.9; // plinths/batters run below the waterline, as on site
  var INNER = OW - WT; // inner wall face
  // Range depth / courtyard size are declared up here (rather than down in
  // the courtyard block where they used to live) because the gate passage
  // vault, built with the gatehouse above, has to reach the courtyard edge.
  var ROOM_DEPTH = 8.6;                  // plan: the ranges are 7-12m deep
  var COURT_HALF = INNER - ROOM_DEPTH;   // half-extent of the central lawn

  /* ---- fade group registry ------------------------------------------ */
  var wallN = makeFadeGroup('wallN', {x:0,z:-1}, false, STONE_WALL);
  var wallS = makeFadeGroup('wallS', {x:0,z:1},  false, STONE_WALL);
  var wallE = makeFadeGroup('wallE', {x:1,z:0},  false, STONE_WALL);
  var wallW = makeFadeGroup('wallW', {x:-1,z:0}, false, STONE_WALL);

  var tNE = makeFadeGroup('towerNE', norm(1,-1),  false, STONE_WALL_V);
  var tNW = makeFadeGroup('towerNW', norm(-1,-1), false, STONE_WALL_V);
  var tSE = makeFadeGroup('towerSE', norm(1,1),   false, STONE_WALL_V);
  var tSW = makeFadeGroup('towerSW', norm(-1,1),  false, STONE_WALL_V);

  var tS  = makeFadeGroup('towerS_postern', {x:0,z:1},  false, STONE_WALL_V);
  var tE  = makeFadeGroup('towerE_mid',     {x:1,z:0},  false, STONE_WALL_V);
  var tW  = makeFadeGroup('towerW_mid',     {x:-1,z:0}, false, STONE_WALL_V);
  var tG1 = makeFadeGroup('gateTowerW', norm(-0.32,-1), false, STONE_WALL_V);
  var tG2 = makeFadeGroup('gateTowerE', norm(0.32,-1),  false, STONE_WALL_V);

  var roofS = makeFadeGroup('roofS', {x:0,z:1},  true, ROOF_COL);
  var roofE = makeFadeGroup('roofE', {x:1,z:0},  true, ROOF_COL);
  var roofW = makeFadeGroup('roofW', {x:-1,z:0}, true, ROOF_COL);
  var roofN = makeFadeGroup('roofN', {x:0,z:-1}, true, ROOF_COL);
  // Tower caps are lead, not tile: kept distinctly lighter than the wing
  // roofs so that seen from above they read as a low roof tucked inside
  // the parapet rather than as a hole punched in the tower.
  var roofCaps = makeFadeGroup('roofCaps', null, true, 0x6d6a60); // tower roofs (no direction test)

  function norm(x,z){ var l = Math.hypot(x,z)||1; return {x:x/l, z:z/l}; }

  /* -------------------------------------------------------------- *
   * curtain walls with crenellations
   * -------------------------------------------------------------- */
  function addCrenellations(target, mat, cx, cz, length, ry, topY, thickness){
    // photo: merlons are wide slabs separated by NARROW embrasures --
    // the old 1.15/1.05 split read as a chess-board, real Bodiam is
    // closer to 3:2 merlon:gap.
    var merlonW = 1.3, gapW = 0.85, mt = thickness*0.72;
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
  /* Crenellate the RIM of a rectangular tower top rather than laying one
   * row of merlons as deep as the tower itself. The old build passed the
   * tower's full projection as `thickness`, so addCrenellations produced
   * 3-4m deep slabs -- from above the gatehouse and the mid-wall towers
   * read as solid white caps instead of a parapet with a walk behind it,
   * which is nothing like the photographs. */
  function crenellateRect(target, mat, cx, cz, w, d, ry, topY, opt){
    opt = opt || {};
    var t = 0.6, mt = t/0.72;   // addCrenellations scales thickness by 0.72
    var co = Math.cos(ry), si = Math.sin(ry);
    function wpt(lx, lz){ return { x: cx + lx*co + lz*si, z: cz - lx*si + lz*co }; }
    var f = wpt(0, -(d/2 - t/2));
    addCrenellations(target, mat, f.x, f.z, w, ry, topY, mt);
    if (opt.back !== false){
      var b = wpt(0, (d/2 - t/2));
      addCrenellations(target, mat, b.x, b.z, w, ry, topY, mt);
    }
    if (opt.ends !== false){
      var dl = Math.max(0.8, d - 2*t);
      var l = wpt(-(w/2 - t/2), 0), r = wpt((w/2 - t/2), 0);
      addCrenellations(target, mat, l.x, l.z, dl, ry + Math.PI/2, topY, mt);
      addCrenellations(target, mat, r.x, r.z, dl, ry + Math.PI/2, topY, mt);
    }
  }
  function addWindows(target, mat, cx, cz, length, ry, midY, thickness, windows){
    var co = Math.cos(ry), si = Math.sin(ry);
    (windows||[]).forEach(function(w){
      var win = mkBox(w.w, w.h, thickness*1.05, mat);
      var wx = cx + w.x*co, wz = cz - w.x*si;
      place(win, wx, midY + (w.dy||0), wz, ry);
      target.add(win);
    });
  }
  // Every wall/tower on site stands on a splayed plinth that carries on
  // down below the waterline -- in the reference photograph the masonry
  // meets the moat with a dark, wet, slightly wider base course rather
  // than a clean butt joint against the grass. `batterBox` / the tower
  // equivalents below add that course everywhere.
  var batterMat = new T.MeshLambertMaterial({ color: STONE_BASE });
  function batterBox(target, cx, cz, length, ry, thickness, topY){
    topY = topY != null ? topY : 1.1;
    var b = mkBox(length + 0.35, topY - BATTER_BOT, thickness + 0.5, batterMat);
    place(b, cx, (topY + BATTER_BOT)/2, cz, ry);
    target.add(b);
    return b;
  }
  function buildStraightWall(fg, cx, cz, length, ry, windows){
    var wall = mkBox(length, WH, WT, fg.mat);
    place(wall, cx, WH/2, cz, ry);
    fg.group.add(wall);
    batterBox(fg.group, cx, cz, length, ry, WT);
    addCrenellations(fg.group, fg.mat, cx, cz, length, ry, WH, WT);
    if (windows) addWindows(fg.group, windowMat, cx, cz, length, ry, WH*0.62, WT, windows);
  }

  // North wall: split either side of the gatehouse gap
  var halfGate = GATE_GAP/2 + GATE_W; // where the solid wall resumes past the twin towers
  var nSegLen = OW - halfGate;
  buildStraightWall(wallN, -(halfGate + nSegLen/2), -OW, nSegLen, 0, [{x:-nSegLen*0.25,w:1.5,h:2.6,dy:1.0},{x:nSegLen*0.15,w:1.3,h:2.2,dy:1.0}]);
  buildStraightWall(wallN,  (halfGate + nSegLen/2), -OW, nSegLen, 0, [{x:nSegLen*0.25,w:1.5,h:2.6,dy:1.0},{x:-nSegLen*0.15,w:1.3,h:2.2,dy:1.0}]);

  // South wall: continuous, postern tower sits proud of it, plus door slot
  // (great-hall windows sit high in the south wall, above the dais end)
  buildStraightWall(wallS, 0, OW, 2*OW, Math.PI, [
    {x:-13.0,w:1.5,h:2.6,dy:1.4},{x:4.5,w:1.9,h:3.4,dy:1.4},
    {x:9.0,w:1.9,h:3.4,dy:1.4},{x:13.5,w:1.9,h:3.4,dy:1.4}
  ]);

  // East wall: has the chapel bulge (built in courtyard section) + windows
  buildStraightWall(wallE, OW, 0, 2*OW, -Math.PI/2, [
    {x:-11.0,w:1.4,h:3.0,dy:1.2},{x:-4.5,w:1.4,h:3.0,dy:1.2},
    {x:4.0,w:1.5,h:3.2,dy:1.2},{x:11.0,w:1.6,h:3.4,dy:1.0}
  ]);
  // chapel bulge: curtain wall projects toward the moat here
  (function(){
    var bulgeCz = -OW*0.32, bulgeSpan = 8.0, bulgeProj = 2.4;
    var bx = OW + bulgeProj/2;
    var b = mkBox(bulgeProj + WT, WH, bulgeSpan, wallE.mat);
    place(b, bx - WT/2, WH/2, bulgeCz, 0);
    wallE.group.add(b);
    addCrenellations(wallE.group, wallE.mat, OW+bulgeProj, bulgeCz, bulgeSpan, -Math.PI/2, WH, WT);
    addCrenellations(wallE.group, wallE.mat, bx-WT/2, bulgeCz-bulgeSpan/2-0.05, bulgeProj, 0, WH, WT*0.7);
    addCrenellations(wallE.group, wallE.mat, bx-WT/2, bulgeCz+bulgeSpan/2+0.05, bulgeProj, Math.PI, WH, WT*0.7);
    var win = mkBox(1.6,3.0,0.3, windowMat);
    place(win, OW+bulgeProj-0.05, WH*0.6, bulgeCz, -Math.PI/2);
    wallE.group.add(win);
  })();

  // West wall: continuous, no windows (Bodiam's blind west face)
  buildStraightWall(wallW, -OW, 0, 2*OW, Math.PI/2, []);

  /* -------------------------------------------------------------- *
   * round corner towers
   * -------------------------------------------------------------- */
  function buildCornerTower(fg, cx, cz){
    var shaft = mkCyl(CORNER_R, CORNER_R*1.05, CORNER_H, 20, fg.mat);
    place(shaft, cx, CORNER_H/2, cz);
    fg.group.add(shaft);
    // splayed batter running down past the waterline (photo: the towers
    // visibly widen for the last ~2m before they enter the moat)
    var plinth = mkCyl(CORNER_R*1.02, CORNER_R*1.13, 1.7 - BATTER_BOT, 20, batterMat);
    place(plinth, cx, (1.7 + BATTER_BOT)/2, cz);
    fg.group.add(plinth);
    // corbelled string course carrying the parapet, as on site
    var corbel = mkCyl(CORNER_R*1.10, CORNER_R*1.02, 0.55, 20, fg.mat);
    place(corbel, cx, CORNER_H - 0.2, cz);
    fg.group.add(corbel);
    // 18 stations round the rim -> 9 merlons: matches the photographed
    // count far better than the old 7 chunky blocks.
    var n = 18, rMer = CORNER_R*1.08;
    for (var i=0;i<n;i+=2){
      var a = (i/n)*Math.PI*2;
      var m = mkBox(rMer*0.42, MER, CORNER_R*0.30, fg.mat);
      place(m, cx+Math.cos(a)*rMer, CORNER_H+MER/2, cz+Math.sin(a)*rMer, -a);
      fg.group.add(m);
    }
    // arrow-loop windows: narrow slits, 3 storeys (real loops are ~0.25m
    // wide -- the old 0.4x1.6 boxes read as small windows, not loops)
    for (var s=0;s<3;s++){
      for (var k=0;k<4;k++){
        var ang = k*Math.PI/2 + Math.PI/4;
        var wm = mkBox(0.28, 1.5, 0.5, windowMat);
        place(wm, cx+Math.cos(ang)*CORNER_R*0.98, 3.6+s*4.9, cz+Math.sin(ang)*CORNER_R*0.98, -ang);
        fg.group.add(wm);
      }
    }
    // Low lead-covered cap sitting INSIDE the parapet ring, apex barely
    // clearing the merlons. The previous build perched a tall cone on
    // TOP of the crenellations ("witch hat"), which no picture of Bodiam
    // supports -- its towers read as flat-topped crenellated drums.
    var roof = mkCone(CORNER_R*0.94, CORNER_ROOF_H, 20, roofCaps.mat);
    place(roof, cx, CORNER_H + CORNER_ROOF_H/2 - 0.15, cz);
    roofCaps.group.add(roof);
  }
  buildCornerTower(tNE, OW, -OW);
  buildCornerTower(tNW, -OW, -OW);
  buildCornerTower(tSE, OW, OW);
  buildCornerTower(tSW, -OW, OW);
  // exterior structure tooltips (always pickable, not gated by reveal)
  var TOWER_PICK = CORNER_R*2.5;
  registerPick(pickables, 'structure', -OW, CORNER_H/2, -OW, TOWER_PICK, CORNER_H, TOWER_PICK,
    '北西塔 Northwest Tower', '各階に暖炉と厠(ガーダローブ)を備えた三層の円塔。伝承では牢獄塔とも呼ばれる。');
  registerPick(pickables, 'structure', OW, CORNER_H/2, -OW, TOWER_PICK, CORNER_H, TOWER_PICK,
    '北東塔 Northeast Tower', '三層の円塔。礼拝堂を収めるため東の城壁がここで堀側へ張り出す。');
  registerPick(pickables, 'structure', OW, CORNER_H/2, OW, TOWER_PICK, CORNER_H, TOWER_PICK,
    '南東塔 Southeast Tower', '三層の円塔。各階に矢狭間(アロー・ループ)を持つ。');
  registerPick(pickables, 'structure', -OW, CORNER_H/2, OW, TOWER_PICK, CORNER_H, TOWER_PICK,
    '南西塔 Southwest Tower', '地下に井戸を持ち、館全体に水を供給した円塔。');

  /* -------------------------------------------------------------- *
   * rectangular mid-wall towers (E / W / S-postern)
   * -------------------------------------------------------------- */
  function buildMidTower(fg, cx, cz, ry, opts){
    opts = opts || {};
    var h = opts.h || MID_H, roofH = opts.roofH || MID_ROOF_H, w = opts.w || MID_W, proj = opts.proj || MID_PROJ;
    var body = mkBox(w, h, proj, fg.mat);
    place(body, cx, h/2, cz, ry);
    fg.group.add(body);
    batterBox(fg.group, cx, cz, w, ry, proj, 1.4);
    crenellateRect(fg.group, fg.mat, cx, cz, w, proj, ry, h, {back:false});
    // same correction as the round towers: the cap sits inside the
    // parapet, not stacked on top of the merlons
    var roof = mkCone(Math.min(w,proj)*0.62, roofH, 4, roofCaps.mat);
    roof.rotation.y = Math.PI/4 + ry;
    place(roof, cx, h+roofH/2-0.15, cz);
    roofCaps.group.add(roof);
    if (opts.window){
      var win = mkBox(1.6, 2.8, 0.35, windowMat);
      var dz = opts.window.outward ? proj/2 : 0;
      var co=Math.cos(ry), si=Math.sin(ry);
      place(win, cx+dz*si, h*0.5, cz+dz*co, ry);
      fg.group.add(win);
    }
  }
  // South postern tower: this is a second, smaller gatehouse -- on site it
  // is a tall square tower with its own drawbridge, appreciably bigger
  // and taller than the two plain mid-wall towers, so it gets its own
  // dimensions rather than sharing MID_*.
  var POST_W = 7.0, POST_PROJ = 5.4, POST_H = 17.2;
  var posternCz = OW + POST_PROJ/2 - 0.6;
  buildMidTower(tS, 0, posternCz, Math.PI, {window:{outward:true}, w:POST_W, proj:POST_PROJ, h:POST_H, roofH:2.1});
  var posternLip = mkBox(POST_W*1.06, 0.7, POST_PROJ*1.06, tS.mat);
  place(posternLip, 0, POST_H-0.55, posternCz, Math.PI);
  tS.group.add(posternLip);
  (function posternArch(){
    // open postern doorway at the foot of the tower, matching the north gate
    var op = mkBox(2.4, 3.6, 0.5, windowMat);
    place(op, 0, 1.8, posternCz + POST_PROJ/2 - 0.2, 0);
    tS.group.add(op);
  })();
  registerPick(pickables, 'structure', 0, POST_H/2, posternCz, POST_W*1.4, POST_H, POST_PROJ*1.8,
    'ポスタン塔 Postern Tower', '南壁中央の裏門。跳ね橋と木橋で堀の南岸と結ばれる。');
  // east & west mid towers
  buildMidTower(tE, OW+MID_PROJ/2-0.4, 0, -Math.PI/2, {window:{outward:true}});
  buildMidTower(tW, -(OW+MID_PROJ/2-0.4), 0, Math.PI/2, {});
  registerPick(pickables, 'structure', OW+MID_PROJ/2-0.4, MID_H/2, 0, 7, MID_H, 7,
    '中間塔 Mid-wall Tower', '城壁の中間に張り出す方形塔。側面からの攻撃に対する防御を強化する。');
  registerPick(pickables, 'structure', -(OW+MID_PROJ/2-0.4), MID_H/2, 0, 7, MID_H, 7,
    '中間塔 Mid-wall Tower', '城壁の中間に張り出す方形塔。側面からの攻撃に対する防御を強化する。');

  /* -------------------------------------------------------------- *
   * twin gatehouse towers (north)
   * -------------------------------------------------------------- */
  function buildGateTower(fg, cx, cz){
    var body = mkBox(GATE_W, GATE_H, GATE_PROJ, fg.mat);
    place(body, cx, GATE_H/2, cz, 0);
    fg.group.add(body);
    batterBox(fg.group, cx, cz, GATE_W, 0, GATE_PROJ, 1.6);
    // corbelled machicolation course carried right round the head of the
    // tower -- clearly visible in the north-front photograph as a row of
    // projecting boxes just under the parapet.
    var lip = mkBox(GATE_W*1.10, 0.7, GATE_PROJ*1.10, fg.mat);
    place(lip, cx, GATE_H-0.55, cz, 0);
    fg.group.add(lip);
    for (var mi=-1;mi<=1;mi++){
      var cb = mkBox(GATE_W*0.20, 1.0, 0.5, fg.mat);
      place(cb, cx + mi*GATE_W*0.30, GATE_H-1.5, cz-GATE_PROJ*0.55, 0);
      fg.group.add(cb);
    }
    crenellateRect(fg.group, fg.mat, cx, cz, GATE_W, GATE_PROJ, 0, GATE_H, {});
    var roof = mkCone(GATE_W*0.46, GATE_ROOF_H*0.75, 4, roofCaps.mat);
    roof.rotation.y = Math.PI/4;
    place(roof, cx, GATE_H+GATE_ROOF_H*0.375-0.15, cz);
    roofCaps.group.add(roof);
    // four storeys of openings up the (much taller) front face: two tall
    // narrow lights over a pair of loops, as photographed
    for (var s=0;s<4;s++){
      var wm = mkBox(0.5, s>=2 ? 2.0 : 1.5, 0.4, windowMat);
      place(wm, cx, 3.8+s*4.3, cz-GATE_PROJ/2+0.02, 0);
      fg.group.add(wm);
    }
  }
  var gateCx = GATE_GAP/2 + GATE_W/2;
  var gateCz = -(OW + GATE_PROJ/2 - 1.0);
  buildGateTower(tG1, -gateCx, gateCz);
  buildGateTower(tG2,  gateCx, gateCz);
  registerPick(pickables, 'structure', 0, GATE_H/2, gateCz, 2*gateCx+GATE_W+1, GATE_H, GATE_PROJ*1.7,
    'ゲートハウス Gatehouse', '双塔式の主門。通路天井には殺人孔があり、かつて3基の木製ポートカリスが備わっていた。');
  // gate arch lintel spanning the passage, with a portcullis grid RAISED
  // up into the housing above the passage (was hanging low enough to
  // visually block the walk-through gap between the twin towers -- see
  // life.gates / section 6.5, residents now actually walk this passage).
  // Bodiam's gatehouse is ONE block, not two free-standing towers: above
  // the entrance arch a solid curtain runs between the twin towers right
  // up to a shared, machicolated parapet. The previous build left the
  // whole GATE_GAP open from ground to sky, which is why the gatehouse
  // read as two thin slabs instead of the castle's dominant mass. The
  // passage itself (below ARCH_TOP) stays fully open, so residents still
  // walk through it exactly as before.
  var ARCH_TOP = 5.8;
  var SPAN_D = GATE_PROJ*0.40;               // the central bay is SHALLOWER ...
  var spanCz = gateCz + (GATE_PROJ - SPAN_D)/2;  // ... and set BACK, so the two
  // towers read as projecting drums with a recessed, shadowed entrance bay
  // between them -- exactly the massing in the north-front photograph. The
  // first attempt made the whole front one flush plane, which lost the
  // gatehouse's depth entirely.
  (function buildGateFront(){
    var spanW = GATE_GAP + 1.2;
    var upper = mkBox(spanW, GATE_H - ARCH_TOP, SPAN_D, tG1.mat);
    place(upper, 0, (GATE_H + ARCH_TOP)/2, spanCz, 0);
    tG1.group.add(upper);
    // machicolated gallery bridging the two towers over the gate: this one
    // DOES come forward to the tower face, carried on corbels
    var mach = mkBox(spanW, 1.0, GATE_PROJ*1.02, tG1.mat);
    place(mach, 0, GATE_H-0.7, gateCz, 0);
    tG1.group.add(mach);
    for (var mi=-1;mi<=1;mi++){
      var cb = mkBox(0.5, 1.2, 0.5, tG1.mat);
      place(cb, mi*spanW*0.30, GATE_H-1.9, gateCz-GATE_PROJ*0.50, 0);
      tG1.group.add(cb);
    }
    crenellateRect(tG1.group, tG1.mat, 0, gateCz, spanW, GATE_PROJ*1.02, 0, GATE_H, {ends:false});
    // two lights over the arch (the chamber above the gate passage)
    [-1,1].forEach(function(s){
      var w = mkBox(0.7, 1.9, 0.4, windowMat);
      place(w, s*1.15, ARCH_TOP+3.2, spanCz-SPAN_D/2+0.02, 0);
      tG1.group.add(w);
    });
    // shallow relieving arch under the upper block
    var arch = mkBox(GATE_GAP+1.6, 0.55, SPAN_D, tG1.mat);
    place(arch, 0, ARCH_TOP-0.28, spanCz, 0);
    tG1.group.add(arch);
  })();
  // Passage vault + jambs: without these the arch read as a bright green
  // hole punched in the facade (you saw the sunlit courtyard straight
  // through it). A dark soffit and dark reveals turn it back into a
  // tunnel, while leaving the walk-through itself completely clear.
  (function buildGatePassage(){
    var passDark = new T.MeshLambertMaterial({ color: 0x6b5c45 });
    // run the vault the whole way through the north range to the
    // courtyard, so the view through the arch is a dark tunnel with light
    // at the far end rather than a bright green rectangle
    var passZ0 = gateCz - GATE_PROJ/2, passZ1 = -(COURT_HALF - 0.2);
    var passLen = Math.abs(passZ1 - passZ0), passMid = (passZ0 + passZ1)/2;
    var vault = mkBox(GATE_GAP+0.3, 0.5, passLen, passDark);
    place(vault, 0, ARCH_TOP-0.75, passMid, 0);
    tG1.group.add(vault);
    [-1,1].forEach(function(s){
      var jamb = mkBox(0.3, ARCH_TOP-1.0, passLen, passDark);
      place(jamb, s*(GATE_GAP/2-0.15), (ARCH_TOP-1.0)/2, passMid, 0);
      tG1.group.add(jamb);
    });
    var floorSlab = mkBox(GATE_GAP-0.2, 0.2, passLen, new T.MeshLambertMaterial({color:0x8b7c60}));
    place(floorSlab, 0, 0.06, passMid, 0);
    tG1.group.add(floorSlab);
  })();
  (function buildPortcullis(){
    var pg = new T.Group();
    var barW = 0.12, gh = 4.4, gw = GATE_GAP*0.80;
    var RAISE = ARCH_TOP + 0.4; // retracted up into its housing above the arch
    for (var i=-3;i<=3;i++){
      pg.add(place(mkBox(barW, gh, barW, metalMat), i*(gw/6), gh/2+RAISE, gateCz+GATE_PROJ*0.32));
    }
    for (var j=0;j<4;j++){
      pg.add(place(mkBox(gw, barW, barW, metalMat), 0, 0.3+j*(gh/3.4)+RAISE, gateCz+GATE_PROJ*0.32));
    }
    tG1.group.add(pg);
  })();
  // gate doors, modelled OPEN: two leaves swung flat against each tower's
  // inner reveal (instead of one closed panel spanning the whole gap) so
  // the passage between the twin towers reads as a real walk-through
  // opening, matching the already-open GATE_GAP in wallN (section 1).
  (function buildOpenGateDoors(){
    var leafH = ARCH_TOP - 0.7, leafLen = GATE_GAP*0.46, leafY = leafH/2;
    var leafZ = gateCz + GATE_PROJ*0.44;
    [-1,1].forEach(function(side){
      var leaf = mkBox(0.14, leafH, leafLen, woodMat);
      place(leaf, side*(GATE_GAP/2-0.37), leafY, leafZ - leafLen/2, 0);
      interiorGroup.add(leaf);
    });
  })();

  /* -------------------------------------------------------------- *
   * courtyard lawn (centre only) + wing stone floors (one step up) +
   * wing roofs
   * -------------------------------------------------------------- *
   * Bodiam's four ranges each occupy a ROOM_DEPTH-deep strip against the
   * inside of the curtain wall; only the residual central rectangle is
   * open lawn. The wing floors sit WING_FLOOR_Y above the lawn so the
   * "building footprint" reads clearly even before any walls are drawn. */
  // (ROOM_DEPTH / COURT_HALF are declared with the footprint constants)
  var WING_FLOOR_Y = 0.16;               // top surface of the wing stone floors
  // Ranges (and therefore their roofs) run right up to the end-cap wall
  // by each corner tower. At INNER-1.0 the roofs stopped short and the
  // pale end-cap partitions stuck up over the curtain as bright slabs.
  var WING_HALF = INNER - 0.3;           // how far a range runs toward each corner tower

  var courtyard = mkBox(2*COURT_HALF, 0.32, 2*COURT_HALF, courtGrassMat);
  place(courtyard, 0, -0.16, 0);
  interiorGroup.add(courtyard);

  function wingFloor(x0,x1,z0,z1){
    var f = mkBox(x1-x0, 0.32, z1-z0, floorMat);
    place(f, (x0+x1)/2, WING_FLOOR_Y-0.16, (z0+z1)/2);
    interiorGroup.add(f);
  }
  wingFloor(-INNER, INNER, COURT_HALF, INNER);              // south wing floor
  wingFloor(-INNER, INNER, -INNER, -COURT_HALF);             // north wing floor
  wingFloor(COURT_HALF, INNER, -COURT_HALF, COURT_HALF);     // east wing floor
  wingFloor(-INNER, -COURT_HALF, -COURT_HALF, COURT_HALF);   // west wing floor

  function leanToRoof(mat, spanAxis, spanA, spanB, outerCoord, innerCoord, outerY, innerY){
    var run = outerCoord - innerCoord;
    var rise = outerY - innerY;
    var slant = Math.hypot(run, rise);
    var angle = Math.atan2(rise, Math.abs(run));
    var spanLen = Math.abs(spanB - spanA) + 1.4;
    var th = 0.45;
    var geo = spanAxis === 'x'
      ? new T.BoxGeometry(spanLen, th, slant)
      : new T.BoxGeometry(slant, th, spanLen);
    var mesh = new T.Mesh(geo, mat);
    var midOI = (outerCoord+innerCoord)/2, midY = (outerY+innerY)/2, midSpan = (spanA+spanB)/2;
    if (spanAxis === 'x'){
      mesh.position.set(midSpan, midY, midOI);
      mesh.rotation.x = (run > 0 ? -angle : angle);
    } else {
      mesh.position.set(midOI, midY, midSpan);
      mesh.rotation.z = (run > 0 ? angle : -angle);
    }
    mesh.castShadow = true; mesh.receiveShadow = true;
    return mesh;
  }

  // Steeper pitch: at the old WH-3.1 the ranges read as almost flat grey
  // decks from above once the footprint grew to its true 44m. A ~28
  // degree mono-pitch, high against the curtain and falling toward the
  // courtyard, matches the roof creasing still visible on the inner face
  // of the real curtain wall.
  var eaveH = WH - 0.35, ridgeInH = WH - 5.0;
  var INNER_N = -INNER, RIDGE_N = -(INNER-ROOM_DEPTH); // north-side coords are negative Z
  var INNER_W = -INNER, RIDGE_W = -(INNER-ROOM_DEPTH); // west-side coords are negative X
  // South wing roof (Great Hall / service rooms / kitchen) -- outer edge at +Z (wall), inner at smaller +Z
  roofS.group.add(leanToRoof(roofS.mat, 'x', -WING_HALF, WING_HALF, INNER, INNER-ROOM_DEPTH, eaveH, ridgeInH));
  // East wing roof (chapel / lord's apartments) -- outer edge at +X (wall), inner at smaller +X
  roofE.group.add(leanToRoof(roofE.mat, 'z', -WING_HALF, WING_HALF, INNER, INNER-ROOM_DEPTH, eaveH, ridgeInH));
  // West wing roof (retainers' hall) -- outer edge at -X (wall), inner toward courtyard
  roofW.group.add(leanToRoof(roofW.mat, 'z', -WING_HALF, WING_HALF, INNER_W, RIDGE_W, eaveH, ridgeInH));
  // North wing roof (stores / stable, either side of the gate passage) -- outer edge at -Z
  roofN.group.add(leanToRoof(roofN.mat, 'x', -WING_HALF, -halfGate+0.4, INNER_N, RIDGE_N, eaveH, ridgeInH));
  roofN.group.add(leanToRoof(roofN.mat, 'x', halfGate-0.4, WING_HALF, INNER_N, RIDGE_N, eaveH, ridgeInH));

  /* -------------------------------------------------------------- *
   * chimneys (Great Hall, kitchen, lord's chambers, NW tower)
   * -------------------------------------------------------------- */
  function chimney(x,z,h,parentGroup,mat){
    var c = mkBox(0.9,h,0.9, mat||tileMat);
    place(c, x, h/2, z);
    (parentGroup||interiorGroup).add(c);
    var cap = mkBox(1.2,0.3,1.2, mat||tileMat);
    place(cap, x, h+0.15, z);
    (parentGroup||interiorGroup).add(cap);
  }
  chimney(9.5, INNER-1.8, WH+2.6, roofS.group, roofS.mat);   // great hall
  chimney(-12.5, INNER-1.5, WH+2.4, roofS.group, roofS.mat); // kitchen
  chimney(-15.5, INNER-1.5, WH+2.2, roofS.group, roofS.mat); // kitchen, second hearth
  chimney(INNER-1.8, 10.5, WH+2.4, roofE.group, roofE.mat);  // lord's apartments
  chimney(INNER-1.8, 2.0, WH+2.2, roofE.group, roofE.mat);   // solar
  chimney(-OW+3.0, -OW+3.0, CORNER_H+2.4, tNW.group, tNW.mat); // NW tower

  /* -------------------------------------------------------------- *
   * interior partition walls (ruin-height stubs marking room-to-room
   * boundaries), low facade stubs along the courtyard-facing side of
   * each wing, end-cap walls near the corner towers, + furniture
   * (boxes / cylinders) + labels. All sit on top of the wing stone
   * floor (WING_FLOOR_Y above the lawn).
   * -------------------------------------------------------------- */
  var PARTITION_H = 3.0;  // room-to-room dividers
  var FACADE_H    = 1.15; // low corridor-facing wall along the courtyard edge
  function partitionWall(x,z,len,ry,h){
    h = h || PARTITION_H;
    var m = mkBox(len, h, 0.45, partitionMat);
    place(m, x, WING_FLOOR_Y + h/2, z, ry);
    interiorGroup.add(m);
    return m;
  }
  function facadeStub(cx,cz,len,ry){
    var m = mkBox(len, FACADE_H, 0.4, stubMat);
    place(m, cx, WING_FLOOR_Y + FACADE_H/2, cz, ry);
    interiorGroup.add(m);
    return m;
  }
  // kept for readability at call sites below (alias of partitionWall)
  function stub(x,z,len,ry){ return partitionWall(x,z,len,ry); }
  function furnitureBox(x,y,z,w,h,d,mat,ry){
    var m = mkBox(w,h,d,mat);
    place(m, x, WING_FLOOR_Y + y + h/2, z, ry||0);
    interiorGroup.add(m);
    return m;
  }
  // room hover/tap tooltip volumes -- an invisible box spanning the room's
  // floor footprint + a generous height, registered into `pickables` (see
  // registerPick in section 0). Replaces the old always-on sprite label.
  function pickRoom(x0,x1,z0,z1,h,name,desc){
    registerPick(pickables, 'room', (x0+x1)/2, WING_FLOOR_Y+h/2, (z0+z1)/2, Math.abs(x1-x0), h, Math.abs(z1-z0), name, desc);
  }

  /* Room divisions are laid out against the published ground plan (see
   * build notes): with the curtain now at its true ~44m side the ranges
   * are long enough to carry the plan's real room count, so the south
   * range gains the buttery/pantry pair and the SE stair block, and the
   * east range separates the solar from the lord's apartments -- all of
   * which the old 33m footprint had no room for. */
  var WEND = INNER - 0.3;   // where a range butts against the corner tower

  // ---- South wing: kitchen (W) - buttery/pantry - screens - Great Hall (E)
  var wingZ0=INNER-ROOM_DEPTH, wingZ1=INNER;
  var sZmid = (wingZ0+wingZ1)/2;
  facadeStub(0, COURT_HALF, 2*INNER, 0);                        // courtyard-facing corridor line
  partitionWall(-WEND, sZmid, ROOM_DEPTH, Math.PI/2);  // west end-cap (near SW tower)
  partitionWall( WEND, sZmid, ROOM_DEPTH, Math.PI/2);  // east end-cap (near SE tower)
  stub(-8.0, sZmid, ROOM_DEPTH, Math.PI/2);  // kitchen / buttery
  stub(-5.2, sZmid, ROOM_DEPTH, Math.PI/2);  // buttery / pantry
  stub(-2.5, sZmid, ROOM_DEPTH, Math.PI/2);  // pantry / screens passage
  stub( 1.0, sZmid, ROOM_DEPTH, Math.PI/2);  // screens passage / hall
  stub(14.0, sZmid, ROOM_DEPTH, Math.PI/2);  // hall / SE stair block
  var dais = furnitureBox(12.4, 0, sZmid, 2.6, 0.4, 6.4, woodMat);
  furnitureBox(5.0, 0, sZmid-1.1, 6.4, 0.7, 1.0, woodMat);
  furnitureBox(5.0, 0, sZmid+1.1, 6.4, 0.7, 1.0, woodMat);
  furnitureBox(9.6, 0, sZmid-1.1, 4.6, 0.7, 1.0, woodMat);
  furnitureBox(9.6, 0, sZmid+1.1, 4.6, 0.7, 1.0, woodMat);
  var hearthHall = furnitureBox(7.5, 0, wingZ1-0.35, 2.6, 1.2, 0.5, new T.MeshLambertMaterial({color:0x2a1c14}));
  var hearthGlow = new T.PointLight(0xff7a33, 1.1, 7, 2);
  hearthGlow.position.set(7.5, WING_FLOOR_Y+1.0, wingZ1-0.8);
  interiorGroup.add(hearthGlow);
  pickRoom(1.0, 14.0, wingZ0, wingZ1, 6.0, '大広間 Great Hall',
    '領主一家が食事した、幅約8m・長さ約13mの2階分吹き抜けの広間。東端に領主の台座(ディス)があった。');
  pickRoom(14.0, WEND, wingZ0, wingZ1, 4.0, '階段室・地下貯蔵 Stair & Undercroft',
    '南東隅、大広間から領主居室と城壁歩廊へ上がる螺旋階段。下は貯蔵室。');
  pickRoom(-2.5, 1.0, wingZ0, wingZ1, 4.0, 'スクリーンズパッセージ Screens Passage',
    '大広間と厨房を仕切る配膳通路。ここから中庭とポスタン門の双方へ抜けられる。');
  furnitureBox(-3.9, 0, sZmid, 2.2, 0.8, 1.2, woodMat);
  furnitureBox(-6.6, 0, sZmid, 2.2, 0.8, 1.2, woodMat);
  pickRoom(-8.0, -2.5, wingZ0, wingZ1, 3.5, 'パントリー・バトリー Pantry & Buttery',
    'スクリーンズパッセージ奥の配膳室。パンと酒をそれぞれ管理した一対の小部屋。');
  furnitureBox(-14.0, 0, wingZ0+0.9, 3.0, 1.2, 0.5, new T.MeshLambertMaterial({color:0x2a1c14}));
  furnitureBox(-14.0, 0, wingZ1-0.9, 3.0, 1.2, 0.5, new T.MeshLambertMaterial({color:0x2a1c14}));
  furnitureBox(-11.5, 0, sZmid, 3.6, 0.8, 1.4, woodMat);
  furnitureBox(-17.0, 0, sZmid, 3.0, 0.8, 1.4, woodMat);
  pickRoom(-WEND, -8.0, wingZ0, wingZ1, 4.0, '厨房 Kitchen',
    '南棟西端。南北両壁に大きな炉を備えた調理場。');

  // ---- East wing: chapel (N), lord's apartments, solar / lady's bower (S)
  var eWingX0=INNER-ROOM_DEPTH, eWingX1=INNER;
  var eXmid = (eWingX0+eWingX1)/2;
  facadeStub(COURT_HALF, 0, 2*INNER, Math.PI/2);                        // courtyard-facing corridor line
  partitionWall(eXmid, -WEND, ROOM_DEPTH, 0);         // north end-cap (near NE tower)
  partitionWall(eXmid,  WEND, ROOM_DEPTH, 0);         // south end-cap (near SE tower)
  stub(eXmid, -8.5, ROOM_DEPTH, 0);                   // chapel / lord's apartments
  stub(eXmid,  4.0, ROOM_DEPTH, 0);                   // apartments / solar
  // chapel floor: two-colour Flemish-tile checker (canvas texture, repeat-tiled)
  var chapelCheckerTex = makeCheckerTexture('#8f5a3c', '#ddd0a8', 6);
  var chapelFloorMat = new T.MeshLambertMaterial({ map: chapelCheckerTex });
  var chapelFloor = mkBox(ROOM_DEPTH-0.6, 0.08, 10.4, chapelFloorMat);
  place(chapelFloor, eXmid, WING_FLOOR_Y+0.04, -14.0);
  interiorGroup.add(chapelFloor);
  furnitureBox(eWingX1-0.9, 0, -18.2, 1.0, 1.1, 1.8, new T.MeshLambertMaterial({color:0xd8d0b8})); // altar, east end
  for (var pw=0;pw<4;pw++){
    furnitureBox(eXmid-1.4, 0, -16.2+pw*2.2, 2.6, 0.6, 0.7, woodMat);   // pews
  }
  pickRoom(eWingX0, eWingX1, -WEND, -8.5, 4.5, '礼拝堂 Chapel',
    '東棟北寄り。フランドル風タイルの床。堀側の東壁はここで張り出している。');
  furnitureBox(eXmid-0.6, 0, -3.0, 2.6, 0.7, 4.0, woodMat);             // lord's bed
  furnitureBox(eWingX1-0.8, 0, -6.4, 2.2, 1.2, 0.5, new T.MeshLambertMaterial({color:0x2a1c14}));
  furnitureBox(eWingX0+1.0, 0, 1.6, 1.2, 0.9, 0.7, new T.MeshLambertMaterial({color:0x3a2a1a}));
  pickRoom(eWingX0, eWingX1, -8.5, 4.0, 4.5, "領主居室 Lord's Apartments",
    '東棟中央。東向きの窓と各階の暖炉を備えた領主一家の私室。');
  furnitureBox(eXmid-0.6, 0, 9.0, 2.4, 0.7, 3.4, woodMat);
  furnitureBox(eWingX1-0.8, 0, 14.5, 2.0, 1.2, 0.5, new T.MeshLambertMaterial({color:0x2a1c14}));
  furnitureBox(eWingX0+1.0, 0, 16.5, 1.6, 0.8, 1.6, woodMat);
  pickRoom(eWingX0, eWingX1, 4.0, WEND, 4.5, "私室 Lady's Bower",
    '東棟南寄り。大広間の上手に接する奥方の私室(ソーラー)。');

  // ---- West wing: retainers' hall (blind outer wall, no hearth)
  var wWingX0=-INNER, wWingX1=-(INNER-ROOM_DEPTH);
  var wXmid = (wWingX0+wWingX1)/2;
  facadeStub(-COURT_HALF, 0, 2*INNER, Math.PI/2);                       // courtyard-facing corridor line
  partitionWall(wXmid, -WEND, ROOM_DEPTH, 0);        // north end-cap (near NW tower)
  partitionWall(wXmid,  WEND, ROOM_DEPTH, 0);        // south end-cap (near SW tower)
  partitionWall(wXmid, 8.0, ROOM_DEPTH, 0);          // divides hall / servants' kitchen
  for (var wt=0;wt<5;wt++){
    furnitureBox(wXmid, 0, -15.0+wt*5.6, 5.6, 0.7, 1.0, woodMat);
  }
  pickRoom(wWingX0, wWingX1, -WEND, 8.0, 4.0, "従者ホール Retainers' Hall",
    '西棟。外壁側には窓も暖炉もない、使用人たちの広間。');
  furnitureBox(wWingX1-1.2, 0, 12.0, 1.8, 0.9, 1.8, woodMat); // small servants' kitchen corner
  furnitureBox(wWingX0+1.2, 0, 15.5, 1.4, 1.0, 1.4, woodMat);
  pickRoom(wWingX0, wWingX1, 8.0, WEND, 3.5, "従者厨房 Servants' Kitchen",
    '従者ホール南端の小さな調理場。');

  // ---- North wing: stores (east of gate) & stable (west of gate)
  var nWingZ0=-INNER, nWingZ1=-(INNER-ROOM_DEPTH);
  var nZmid = (nWingZ0+nWingZ1)/2;
  // the gate passage runs straight through this range: leave a corridor
  // the width of the gatehouse arch, walled on both sides (residents in
  // section 6.5 walk exactly this line, so it must stay clear)
  var PASS_HALF = GATE_GAP/2 + 0.5;
  var nFacadeLen = INNER - PASS_HALF;
  facadeStub(-(PASS_HALF + nFacadeLen/2), -COURT_HALF, nFacadeLen, 0);   // courtyard-facing corridor line, W of the gate
  facadeStub( (PASS_HALF + nFacadeLen/2), -COURT_HALF, nFacadeLen, 0);   // ... and E of the gate
  partitionWall(-WEND, nZmid, ROOM_DEPTH, Math.PI/2); // west end-cap (near NW tower)
  partitionWall( WEND, nZmid, ROOM_DEPTH, Math.PI/2); // east end-cap (near NE tower)
  partitionWall(-PASS_HALF, nZmid, ROOM_DEPTH, Math.PI/2); // stable side of the gate passage
  partitionWall( PASS_HALF, nZmid, ROOM_DEPTH, Math.PI/2); // stores side of the gate passage
  for (var b=0;b<6;b++){
    furnitureBox(5.6+b*2.4, 0, nZmid, 1.1, 1.3, 1.1, woodMat);
  }
  pickRoom(PASS_HALF, WEND, nWingZ0, nWingZ1, 3.5, '倉庫・宿舎 Stores',
    '北棟東側、ゲートハウスの東隣に位置する倉庫兼宿舎。');
  furnitureBox(-8.0, 0, nZmid, 4.0, 0.5, 1.0, new T.MeshLambertMaterial({color:0x4a3a1e}));
  furnitureBox(-14.0, 0, nZmid, 4.0, 0.5, 1.0, new T.MeshLambertMaterial({color:0x4a3a1e}));
  furnitureBox(-5.2, 0, nZmid, 0.7, 1.0, 0.7, new T.MeshLambertMaterial({color:0xc8b878}));
  pickRoom(-WEND, -PASS_HALF, nWingZ0, nWingZ1, 3.5, '厩舎 Stable',
    '北棟西側、ゲートハウスの西隣に位置する厩舎。');

  // ---- Well, at the foot of the SW tower (on the south-wing stone floor
  // so it reads clearly, uncovered, in the top-down view). A flat paved
  // curb (dark stone) + a round water disc (blue) + a torus kerb ring
  // around the rim -- the torus leaves the water visible through its
  // centre, unlike a solid cylinder which would just hide it.
  var WELL_X = -(INNER-2.3), WELL_Z = (INNER-1.9);
  var wellMatDark = new T.MeshLambertMaterial({color:STONE_DARK});
  var wellPad = mkCyl(1.75,1.75,0.1,24, wellMatDark);
  place(wellPad, WELL_X, WING_FLOOR_Y+0.05, WELL_Z);
  interiorGroup.add(wellPad);
  var well = new T.Mesh(new T.CircleGeometry(1.15, 28), wellMat);
  well.rotation.x = -Math.PI/2;
  well.castShadow = false; well.receiveShadow = false;
  place(well, WELL_X, WING_FLOOR_Y+0.13, WELL_Z);
  interiorGroup.add(well);
  var wellKerb = new T.Mesh(new T.TorusGeometry(1.18, 0.16, 10, 28), wellMatDark);
  wellKerb.rotation.x = Math.PI/2;
  place(wellKerb, WELL_X, WING_FLOOR_Y+0.28, WELL_Z);
  interiorGroup.add(wellKerb);
  registerPick(pickables, 'room', WELL_X, WING_FLOOR_Y+1.0, WELL_Z, 3.4, 2.0, 3.4, '井戸 Well',
    '南西塔の地下に実在した井戸。館全体の生活用水をここから汲み上げた。');

  /* ================================================================ *
   * FITTING-OUT PASS: furniture, fixtures and the courtyard garden
   * ================================================================ *
   * Bodiam survives as an empty shell -- only the curtain, the towers
   * and the footings of the four ranges are standing. What is modelled
   * below is the castle AS BUILT in the 1380s, following the published
   * ground plan's room names (already used by the pickRoom volumes
   * above) and the standard fit-out of a late-14th-century English
   * courtyard house: rush-strewn hall with a high table on a dais,
   * kitchen with wall hearths and a bread oven, buttery and pantry
   * flanking the screens passage, a vaulted undercroft, a tiled chapel
   * with a great window over the altar, canopied lord's bed, a loom in
   * the lady's bower, straw pallets in the retainers' hall, stalls and
   * mangers in the stable, and barrel/sack stores.
   *
   * Everything here goes into `interiorGroup` -- it never fades, so it
   * stays readable the instant the cutaway opens a range up, and it can
   * never affect the reveal tiers. Nothing here moves a wall, a floor,
   * a partition, a pick volume or a measured dimension; it only adds
   * meshes inside the room footprints those already define.
   * Colours obey the exposure budget documented in the palette block. */

  // ---- local geometry helpers (closure-scoped: no top-level names) ----
  function fCyl(x,y,z,rt,rb,h,seg,mat,ry){
    var m = mkCyl(rt,rb,h,seg,mat);
    place(m, x, WING_FLOOR_Y + y + h/2, z, ry);
    interiorGroup.add(m);
    return m;
  }
  function fCone(x,y,z,r,h,seg,mat,ry){
    var m = mkCone(r,h,seg,mat);
    place(m, x, WING_FLOOR_Y + y + h/2, z, ry);
    interiorGroup.add(m);
    return m;
  }
  // offset along a rotated box's own long (local X) axis -- `place` maps
  // local +X to (cos ry, -sin ry), so this matches every furnitureBox ry
  function offX(x,z,d,ry){ ry = ry||0; return { x: x + d*Math.cos(ry), z: z - d*Math.sin(ry) }; }
  function offZ(x,z,d,ry){ ry = ry||0; return { x: x + d*Math.sin(ry), z: z + d*Math.cos(ry) }; }

  function barrel(x,z,s){
    s = s || 1;
    fCyl(x,0,z, 0.30*s, 0.25*s, 0.82*s, 10, oakMat);
    fCyl(x,0.16*s,z, 0.32*s, 0.32*s, 0.06*s, 10, metalMat);
    fCyl(x,0.60*s,z, 0.32*s, 0.32*s, 0.06*s, 10, metalMat);
  }
  function barrelLying(x,y0,z,s,alongZ){
    s = s || 1;
    var m = mkCyl(0.30*s, 0.30*s, 0.86*s, 10, oakMat);
    if (alongZ) m.rotation.x = Math.PI/2; else m.rotation.z = Math.PI/2;
    m.position.set(x, WING_FLOOR_Y + y0 + 0.30*s, z);
    interiorGroup.add(m);
  }
  function sack(x,z,s){ s = s||1; fCyl(x,0,z, 0.15*s, 0.28*s, 0.58*s, 7, clothCrmMat); }
  function crate(x,y,z,s,ry){ s = s||1; furnitureBox(x,y,z, 0.78*s, 0.66*s, 0.68*s, oakLtMat, ry); }
  function chest(x,z,w,ry){
    w = w || 1.3;
    furnitureBox(x,0,z, w, 0.50, 0.62, oakMat, ry);
    furnitureBox(x,0.50,z, w*1.04, 0.13, 0.66, oakLtMat, ry);
    furnitureBox(x,0,z, w*0.10, 0.63, 0.67, metalMat, ry);
  }
  function bench(x,z,len,ry){
    ry = ry||0;
    furnitureBox(x,0.34,z, len, 0.09, 0.34, oakLtMat, ry);
    [-1,1].forEach(function(s){
      var p = offX(x,z, s*(len/2-0.30), ry);
      furnitureBox(p.x,0,p.z, 0.13, 0.34, 0.30, oakMat, ry);
    });
  }
  function stool(x,z){ fCyl(x,0,z, 0.19, 0.21, 0.44, 8, oakMat); }
  // stone pier with a moulded base and capital (hall / undercroft arcades)
  function pier(x,z,h,r){
    r = r || 0.30;
    fCyl(x,0.14,z, r, r*1.08, h-0.28, 8, ashlarMat);
    furnitureBox(x,0,z, r*2.5, 0.16, r*2.5, ashlarDkMat);
    furnitureBox(x,h-0.20, z, r*2.8, 0.22, r*2.8, ashlarDkMat);
  }
  // stepped low-poly arch spanning two piers (crown + two haunch blocks)
  function archSpan(xa, xb, z, h, d){
    var span = Math.abs(xb-xa), mid = (xa+xb)/2;
    d = d || 0.5;
    furnitureBox(mid, h+0.16, z, span*0.46, 0.30, d, ashlarMat);
    [-1,1].forEach(function(s){
      furnitureBox(mid + s*span*0.30, h-0.05, z, span*0.30, 0.30, d, ashlarMat);
    });
  }
  function hayPile(x,z,w,d,h){
    furnitureBox(x,0,z, w, h, d, strawMat);
    furnitureBox(x,h,z, w*0.62, h*0.5, d*0.62, strawMat);
  }
  // stacked firewood: `rows` courses tapering upward, logs lying flat
  function logPile(x,y0,z,rows,perRow,alongZ){
    for (var r=0;r<rows;r++){
      var n = Math.max(1, perRow - r);
      for (var c=0;c<n;c++){
        var m = mkCyl(0.10,0.11,1.10,6, barkMat);
        if (alongZ) m.rotation.x = Math.PI/2; else m.rotation.z = Math.PI/2;
        var off = (c-(n-1)/2)*0.23;
        m.position.set(alongZ ? x+off : x, WING_FLOOR_Y + y0 + 0.11 + r*0.20, alongZ ? z : z+off);
        interiorGroup.add(m);
      }
    }
  }
  // iron cauldron on a trammel over a hearth, with embers under it
  function cauldron(x,z,s,alongZ){
    s = s || 1;
    fCyl(x,0.26,z, 0.44*s, 0.28*s, 0.46*s, 12, metalMat);
    fCyl(x,0.72*s,z, 0.44*s, 0.44*s, 0.05*s, 12, metalMat);
    [-1,1].forEach(function(sg){
      var p = alongZ ? {x:x, z:z+sg*0.62*s} : {x:x+sg*0.62*s, z:z};
      fCyl(p.x,0,p.z, 0.05,0.05, 1.55*s, 6, metalMat);
    });
    var bar = mkBox(alongZ?0.06:1.30*s, 0.06, alongZ?1.30*s:0.06, metalMat);
    place(bar, x, WING_FLOOR_Y + 1.52*s, z);
    interiorGroup.add(bar);
    var e = mkBox(0.9*s, 0.05, 0.9*s, emberMat);
    place(e, x, WING_FLOOR_Y + 0.03, z);
    interiorGroup.add(e);
  }
  function embers(x,z,w,d){
    var e = mkBox(w, 0.05, d, emberMat);
    place(e, x, WING_FLOOR_Y + 0.04, z);
    interiorGroup.add(e);
  }
  function candle(x,y,z){
    fCyl(x,y,z, 0.035,0.045, 0.30, 6, clothCrmMat);
    var f = mkBox(0.07,0.13,0.07, flameMat);
    place(f, x, WING_FLOOR_Y + y + 0.36, z);
    interiorGroup.add(f);
  }
  // wall hanging. Always hung from a rod at HANG_HEAD, which is just under
  // PARTITION_H -- every tapestry below hangs on an interiorGroup partition
  // (never on a curtain wall), so it can neither poke over the top of its
  // wall nor be left floating in mid-air when the cutaway fades a wall.
  var HANG_HEAD = PARTITION_H - 0.24;
  function tapestry(x,z,w,h,ry,mat){
    h = Math.min(h, HANG_HEAD - 0.35);
    furnitureBox(x, HANG_HEAD - h, z, w, h, 0.07, mat, ry);
    furnitureBox(x, HANG_HEAD, z, w*1.05, 0.10, 0.13, oakMat, ry);
  }
  function shelf(x,y,z,len,ry){
    furnitureBox(x,y,z, len, 0.07, 0.42, oakLtMat, ry);
    [-1,1].forEach(function(s){
      var p = offX(x,z, s*(len/2-0.12), ry);
      furnitureBox(p.x,y-0.28,p.z, 0.08, 0.28, 0.40, oakLtMat, ry);
    });
  }
  function crock(x,y,z,s){ s=s||1; fCyl(x,y,z, 0.13*s,0.16*s, 0.28*s, 8, potMat); }
  function ladder(x,z,h,ry){
    ry = ry||0;
    [-1,1].forEach(function(s){
      var p = offZ(x,z, s*0.21, ry);
      furnitureBox(p.x,0,p.z, 0.07, h, 0.07, oakLtMat, ry);
    });
    var rungs = Math.max(2, Math.floor(h/0.36));
    for (var i=1;i<rungs;i++) furnitureBox(x, i*0.36, z, 0.07, 0.05, 0.46, oakLtMat, ry);
  }
  // two-wheeled hand cart. Restricted to axis-aligned orientations so the
  // wheel axle only ever needs a single-axis Euler rotation.
  function handcart(x,z,alongZ){
    var ry = alongZ ? Math.PI/2 : 0;
    furnitureBox(x,0.50,z, 1.85, 0.14, 0.95, oakLtMat, ry);
    [-1,1].forEach(function(s){
      var p = offZ(x,z, s*0.50, ry);
      furnitureBox(p.x,0.62,p.z, 1.85, 0.30, 0.07, oakLtMat, ry);
    });
    [-1,1].forEach(function(s){
      var p = offZ(x,z, s*0.58, ry);
      var w = mkCyl(0.44,0.44,0.10,10, oakMat);
      if (alongZ) w.rotation.z = Math.PI/2; else w.rotation.x = Math.PI/2;
      w.position.set(p.x, WING_FLOOR_Y + 0.44, p.z);
      interiorGroup.add(w);
    });
    [-1,1].forEach(function(s){
      var p = offZ(x,z, s*0.34, ry), q = offX(p.x,p.z, 1.30, ry);
      furnitureBox(q.x,0.52,q.z, 1.00, 0.09, 0.09, oakLtMat, ry);
    });
  }
  function spiralStair(x,z,r,steps,rise,startA){
    for (var i=0;i<steps;i++){
      var a = (startA||0) + i*0.44;
      var st = mkBox(r, 0.15, 0.52, ashlarMat);
      place(st, x + Math.cos(a)*r*0.52, WING_FLOOR_Y + 0.08 + i*rise, z + Math.sin(a)*r*0.52, -a);
      interiorGroup.add(st);
    }
    fCyl(x,0,z, 0.17,0.17, steps*rise + 0.25, 8, ashlarDkMat);
  }
  function straightSteps(x,z,n,ry,w){
    ry = ry||0; w = w||1.4;
    for (var i=0;i<n;i++){
      var p = offX(x,z, i*0.34, ry);
      furnitureBox(p.x, i*0.20, p.z, 0.34, 0.20, w, ashlarMat, ry);
    }
  }
  // roof truss over a range: tie beam + king post + two sloping rafters
  function truss(cx, cz, spanZ, y, ry){
    ry = ry||0;
    furnitureBox(cx, y, cz, 0.26, 0.26, spanZ, oakMat, ry);
    furnitureBox(cx, y+0.26, cz, 0.22, 1.10, 0.22, oakMat, ry);
    [-1,1].forEach(function(s){
      var p = offZ(cx, cz, s*spanZ*0.26, ry);
      furnitureBox(p.x, y+0.26, p.z, 0.18, 0.75, 0.18, oakMat, ry);
    });
  }

  /* ---- SOUTH RANGE ------------------------------------------------ */
  // Great Hall: rushes on the floor, high table on the dais, benches to
  // the trestles, roof trusses, hangings, a livery cupboard.
  furnitureBox(7.6, 0, sZmid, 12.6, 0.04, 8.0, strawMat);              // 藺草(rushes)
  furnitureBox(12.3, 0.40, sZmid, 1.05, 0.78, 4.6, oakMat);            // high table on the dais
  furnitureBox(13.25, 0.40, sZmid, 0.50, 1.35, 0.75, oakMat);          // lord's chair
  furnitureBox(13.25, 0.40, sZmid-1.5, 0.45, 1.00, 0.65, oakMat);
  furnitureBox(13.25, 0.40, sZmid+1.5, 0.45, 1.00, 0.65, oakMat);
  bench(5.0, sZmid-2.05, 6.0, 0); bench(5.0, sZmid+2.05, 6.0, 0);
  bench(9.6, sZmid-2.05, 4.2, 0); bench(9.6, sZmid+2.05, 4.2, 0);
  bench(7.3, sZmid, 8.4, 0);                                           // shared bench between the trestles
  // tie-beam trusses. The south range roof is a mono-pitch running from
  // ridgeInH (5.8) at the courtyard edge up to eaveH (10.45) at the
  // curtain, so the tie beam has to clear 5.8 at its lowest point: at
  // y = 4.6 above WING_FLOOR_Y its top sits at 5.02, safely under the
  // roof plane even where the roof is at its lowest.
  [3.4, 8.0, 12.2].forEach(function(tx){ truss(tx, sZmid, 8.2, 4.6, 0); });
  tapestry(1.35, sZmid+0.4, 3.6, 2.6, Math.PI/2, clothRedMat);
  tapestry(1.35, sZmid-3.2, 2.4, 2.2, Math.PI/2, clothBluMat);
  furnitureBox(2.6, 0, wingZ0+0.8, 1.7, 1.55, 0.62, oakMat);           // livery cupboard
  crock(2.4, 1.55, wingZ0+0.8, 1.1); crock(2.9, 1.55, wingZ0+0.8, 0.9);
  embers(7.5, wingZ1-0.85, 2.2, 0.7);
  logPile(9.6, 0, wingZ1-0.75, 3, 4, false);
  candle(12.3, 0.40+0.78, sZmid-1.2); candle(12.3, 0.40+0.78, sZmid+1.2);

  // Screens passage: the service door line between hall and kitchen
  furnitureBox(-0.75, 0, wingZ0+0.55, 1.5, 0.9, 0.5, oakLtMat);
  fCyl(-1.9, 0, wingZ1-1.0, 0.30,0.34, 0.95, 10, potMat);              // water butt
  candle(-1.9, 0.95, wingZ1-1.0);

  // Pantry & buttery: ale casks one side, bread and crocks the other
  barrel(-7.2, wingZ0+1.0); barrel(-7.2, wingZ0+2.0); barrel(-6.3, wingZ0+1.0);
  barrelLying(-6.6, 0.30, wingZ0+2.1, 1, false);
  shelf(-5.4, 1.15, wingZ1-0.5, 4.2, 0);
  crock(-6.6, 1.22, wingZ1-0.5); crock(-5.8, 1.22, wingZ1-0.5, 0.85);
  crock(-4.8, 1.22, wingZ1-0.5, 1.1); crock(-4.0, 1.22, wingZ1-0.5, 0.9);
  sack(-3.4, wingZ0+0.9); sack(-3.9, wingZ0+1.5, 0.9);

  // Kitchen: a cauldron on each wall hearth, bread oven, block, stores
  cauldron(-14.0, wingZ0+1.55, 1.0, false);
  embers(-14.0, wingZ1-0.85, 2.2, 0.7);
  fCyl(-14.0, 0, wingZ1-1.6, 0.40,0.34, 0.70, 10, metalMat);           // skillet stand
  (function breadOven(){
    fCyl(-18.5, 0, wingZ1-1.5, 1.05, 1.25, 0.95, 10, ashlarMat);
    fCone(-18.5, 0.95, wingZ1-1.5, 1.10, 0.85, 10, ashlarMat);
    furnitureBox(-17.6, 0.15, wingZ1-1.5, 0.35, 0.62, 0.75, hearthMat);
    embers(-17.75, wingZ1-1.5, 0.35, 0.7);
  })();
  fCyl(-12.2, 0, wingZ1-1.4, 0.40,0.44, 0.78, 10, oakMat);             // chopping block
  shelf(-19.3, 1.30, 15.6, 3.2, Math.PI/2);
  crock(-19.3, 1.37, 14.5); crock(-19.3, 1.37, 15.4, 0.85); crock(-19.3, 1.37, 16.4, 1.1);
  sack(-19.0, wingZ0+0.9); sack(-18.4, wingZ0+1.4, 0.9); sack(-19.2, wingZ0+1.7, 0.8);
  barrel(-9.3, wingZ0+0.95, 0.9); barrel(-9.4, wingZ0+2.0, 0.85);
  logPile(-16.6, 0, wingZ0+0.75, 3, 4, false);
  (function potRack(){
    var bar = mkBox(2.4, 0.06, 0.06, metalMat);
    place(bar, -15.6, WING_FLOOR_Y + 2.05, wingZ0+0.55);
    interiorGroup.add(bar);
    [-0.8, 0, 0.8].forEach(function(dx){
      fCyl(-15.6+dx, 1.55, wingZ0+0.55, 0.20,0.16, 0.34, 8, metalMat);
    });
  })();

  // SE stair block: newel stair up to the wall-walk, vaulted undercroft
  spiralStair(15.8, wingZ0+1.7, 1.55, 11, 0.42, 0.4);
  pier(17.6, 15.2, 2.55); pier(17.6, 18.6, 2.55);
  archSpan(17.6, 19.6, 15.2, 2.55, 0.5);
  archSpan(17.6, 19.6, 18.6, 2.55, 0.5);
  barrelLying(19.0, 0.10, 14.0, 1.05, true); barrelLying(19.0, 0.10, 15.4, 1.05, true);
  barrelLying(19.0, 0.72, 14.7, 1.05, true);
  barrelLying(19.0, 0.10, 17.6, 1.05, true); barrelLying(19.0, 0.10, 19.0, 1.05, true);
  crate(15.6, 0, 19.0, 1.0); crate(16.5, 0, 19.0, 0.9); crate(16.0, 0.66, 19.0, 0.85);
  sack(14.9, 12.6); sack(15.5, 13.1, 0.9);

  /* ---- EAST RANGE ------------------------------------------------- */
  // Chapel: raised chancel step, altar with a great window over it, rood
  // screen, pews (already placed), a lectern and side piers.
  (function chapel(){
    // taller gable at the ritual-east end, carrying a three-light window
    furnitureBox(eXmid, 0, -19.55, 7.9, 5.0, 0.42, partitionMat);
    var glass = [glassRedMat, glassPurMat, glassBluMat];
    [-1.35, 0, 1.35].forEach(function(dx, i){
      furnitureBox(eXmid+dx, 1.35, -19.30, 0.72, 2.85, 0.14, glass[i]);
      furnitureBox(eXmid+dx-0.50, 1.35, -19.28, 0.16, 2.95, 0.18, ashlarMat);
      furnitureBox(eXmid+dx+0.50, 1.35, -19.28, 0.16, 2.95, 0.18, ashlarMat);
    });
    furnitureBox(eXmid, 4.35, -19.28, 3.4, 0.24, 0.20, ashlarMat);
    furnitureBox(eXmid, 0, -18.55, 7.0, 0.16, 1.5, ashlarMat);          // chancel step
    // reredos + cross behind the altar (the altar box itself is above)
    furnitureBox(eWingX1-0.32, 0.16, -18.2, 0.22, 2.0, 2.1, ashlarDkMat);
    candle(eWingX1-0.95, 1.10, -17.5); candle(eWingX1-0.95, 1.10, -18.9);
    // lectern
    fCyl(16.6, 0, -16.3, 0.17,0.24, 1.02, 8, oakMat);
    furnitureBox(16.6, 1.02, -16.3, 0.52, 0.10, 0.66, oakLtMat);
    // rood screen across the nave, with a central opening
    [-1,1].forEach(function(s){
      furnitureBox(eXmid + s*2.35, 0, -10.6, 2.6, 1.65, 0.20, oakMat);
    });
    furnitureBox(eXmid, 1.65, -10.6, 7.4, 0.26, 0.26, oakMat);
    pier(12.3, -16.0, 3.3); pier(12.3, -12.6, 3.3);
    // hung on the chapel/apartments partition (z = -8.5), facing back up
    // the nave -- the courtyard-side facade here is only FACADE_H tall,
    // so a hanging on that line would have nothing behind it
    tapestry(eXmid, -8.78, 2.8, 2.0, 0, clothBluMat);
  })();

  // Lord's apartments: canopied bed, table and stools, chest, hangings
  (function lordsRooms(){
    [-1,1].forEach(function(sx){
      [-1,1].forEach(function(sz){
        furnitureBox(15.1 + sx*1.25, 0, -3.0 + sz*1.9, 0.16, 2.35, 0.16, oakMat);
      });
    });
    furnitureBox(15.1, 2.35, -3.0, 2.9, 0.14, 4.3, clothRedMat);
    furnitureBox(15.1, 0.70, -4.95, 2.6, 1.6, 0.10, clothRedMat);       // head curtain
    furnitureBox(13.1, 0, -6.6, 1.0, 0.74, 1.9, oakMat);                // table
    stool(12.5, -5.9); stool(12.5, -7.3);
    candle(13.1, 0.74, -6.6);
    tapestry(eXmid+0.5, -8.15, 3.8, 2.5, 0, clothBluMat);
    furnitureBox(12.3, 0, -1.2, 0.60, 1.85, 1.5, oakMat);               // cupboard
    crock(12.3, 1.85, -1.2, 1.0);
    embers(eWingX1-0.85, -6.4, 1.6, 0.45);
  })();

  // Lady's bower: upright loom, spinning, cradle, small table
  (function bower(){
    [-1,1].forEach(function(s){
      furnitureBox(13.0, 0, 6.4 + s*0.85, 0.14, 2.30, 0.14, oakMat);
    });
    furnitureBox(13.0, 2.20, 6.4, 0.16, 0.16, 1.9, oakMat);
    furnitureBox(13.0, 0.55, 6.4, 0.10, 1.55, 1.72, clothCrmMat);       // warp on the loom
    furnitureBox(13.0, 0.30, 6.4, 0.16, 0.16, 1.9, oakMat);
    fCyl(12.6, 0, 8.0, 0.30,0.34, 0.42, 9, oakLtMat);                   // wool basket
    furnitureBox(12.6, 0, 11.4, 0.9, 0.72, 1.4, oakMat);                // table
    stool(13.4, 11.4);
    candle(12.6, 0.72, 11.4);
    furnitureBox(17.6, 0, 6.6, 1.0, 0.55, 1.5, oakLtMat);               // cradle
    furnitureBox(17.6, 0.55, 6.6, 0.9, 0.14, 1.35, clothCrmMat);
    tapestry(eXmid+0.4, 19.35, 3.4, 2.4, Math.PI, clothRedMat);
    embers(eWingX1-0.85, 14.5, 1.4, 0.45);
    furnitureBox(15.1, 0.70, 9.0, 2.5, 0.16, 3.4, clothBluMat);         // coverlet on the bed
  })();

  /* ---- WEST RANGE ------------------------------------------------- */
  // Retainers' hall: benches to every trestle, straw pallets along the
  // blind outer wall, a timber arcade, stores in the corner.
  [-15.0, -9.4, -3.8, 1.8].forEach(function(tz){
    bench(wXmid, tz-0.95, 5.2, 0); bench(wXmid, tz+0.95, 5.2, 0);
  });
  bench(wXmid, 6.3, 5.2, 0);
  for (var pz=0; pz<6; pz++){
    var zz = -18.2 + pz*4.6;
    furnitureBox(-18.85, 0, zz, 0.95, 0.24, 1.95, strawMat);
    furnitureBox(-18.85, 0.24, zz, 0.85, 0.10, 1.75, clothCrmMat);
  }
  [-16.4, -10.8, -5.2, 0.4].forEach(function(az){
    furnitureBox(-12.5, 0, az, 0.26, 4.60, 0.26, oakMat);
    furnitureBox(-12.5, 4.30, az, 0.24, 0.30, 1.30, oakMat);            // bracket
  });
  barrel(-19.1, -19.0, 0.95); barrel(-19.1, -17.9, 0.95); barrel(-18.2, -19.0, 0.9);
  crate(-12.6, 0, -18.9, 1.0); crate(-12.6, 0.66, -18.9, 0.9);
  [-13.4, -12.6, -11.8].forEach(function(cz){
    furnitureBox(-12.2, 1.55, cz, 0.30, 1.05, 0.55, clothCrmMat);       // cloaks on pegs
  });
  ladder(-19.2, 3.0, 3.2, Math.PI/2);

  // Servants' kitchen: hearth, cauldron, quern, wood and stores
  furnitureBox(-19.45, 0, 17.8, 0.5, 1.25, 2.4, hearthMat);
  cauldron(-18.5, 17.8, 0.9, true);
  fCyl(-15.4, 0, 10.4, 0.50,0.52, 0.28, 12, ashlarDkMat);              // quern stones
  fCyl(-15.4, 0.28, 10.4, 0.44,0.46, 0.20, 12, ashlarMat);
  furnitureBox(-15.0, 0.28, 10.4, 0.55, 0.09, 0.09, oakLtMat);
  logPile(-13.2, 0, 18.8, 3, 4, true);
  barrel(-13.0, 15.2, 0.95); sack(-13.6, 16.2); sack(-14.2, 16.6, 0.9);
  shelf(-19.3, 1.20, 13.4, 2.6, Math.PI/2);
  crock(-19.3, 1.27, 12.6); crock(-19.3, 1.27, 13.5, 0.9); crock(-19.3, 1.27, 14.3, 1.05);

  /* ---- NORTH RANGE ------------------------------------------------ */
  // Stores: a second row of casks, crates, sacks, a loading ladder and
  // a hand cart standing on the courtyard side.
  for (var b2=0;b2<4;b2++) barrel(6.4 + b2*2.6, nWingZ0+1.15, 0.95);
  barrelLying(16.9, 0.10, nWingZ0+1.2, 0.95, true);
  crate(3.6, 0, -18.7, 1.0); crate(4.5, 0, -18.7, 0.9); crate(4.0, 0.66, -18.7, 0.85);
  [3.4, 4.1, 4.9, 5.6].forEach(function(sx2){ sack(sx2, -13.0, 0.95); });
  sack(3.8, -13.7, 0.85); sack(4.6, -13.8, 0.9);
  ladder(19.2, -17.0, 3.2, Math.PI/2);
  shelf(19.3, 1.25, -13.6, 2.6, Math.PI/2);
  crock(19.3, 1.32, -14.4); crock(19.3, 1.32, -13.5, 0.9);
  handcart(11.6, -12.6, false);

  // Stable: stalls behind the mangers, hay in the mangers and a pile in
  // the corner, a water trough and harness pegs.
  [-5.4, -9.2, -12.6, -16.4].forEach(function(sx3){
    furnitureBox(sx3, 0, -18.2, 0.14, 1.35, 3.0, oakLtMat);
    furnitureBox(sx3, 1.35, -18.2, 0.16, 0.12, 3.0, oakMat);
  });
  furnitureBox(-8.0, 0.50, nZmid, 3.7, 0.20, 0.85, strawMat);           // hay in the mangers
  furnitureBox(-14.0, 0.50, nZmid, 3.7, 0.20, 0.85, strawMat);
  hayPile(-18.4, -12.8, 2.0, 2.0, 0.95);
  furnitureBox(-3.9, 0, -12.9, 0.85, 0.52, 1.7, oakMat);                // water trough
  var troughWater = mkBox(0.70, 0.04, 1.55, wellMat);
  place(troughWater, -3.9, WING_FLOOR_Y + 0.50, -12.9);
  interiorGroup.add(troughWater);
  [-16.0, -15.2, -14.4].forEach(function(hx){
    furnitureBox(hx, 1.45, -19.55, 0.26, 0.75, 0.28, oakMat);           // harness on pegs
  });
  handcart(-11.4, -12.6, false);

  /* ---- COURTYARD: kitchen garden, herb plots, orchard trees --------
   * Bodiam's courtyard is small (22.8m square), so the planting is kept
   * to a 2.8m border strip against the range facades, and `life.courtyard`
   * / `life.patrol` below are pulled in to match so residents wander and
   * patrol INSIDE the beds rather than through them. Note the farmers
   * also walk a straight line from wherever they are standing to the gate
   * at (0, -OW): with the wander rect capped at +/-COURT_INNER, that line
   * can only ever cross the north strip inside roughly |x| < 6.3, which is
   * why the north strip carries nothing but two tubs out at |x| = 8.0.
   * Trees are deliberately small (about 3.6m) -- these are courtyard
   * fruit trees, not the field oaks outside the moat. */
  var COURT_INNER = 7.5;               // resident wander half-extent
  var PLANT_IN = COURT_HALF - 2.55;    // inner edge of the planted border (8.85)
  function cBox(x,y,z,w,h,d,mat,ry){
    var m = mkBox(w,h,d,mat);
    place(m, x, y + h/2, z, ry||0);
    interiorGroup.add(m);
    return m;
  }
  function cCyl(x,y,z,rt,rb,h,seg,mat){
    var m = mkCyl(rt,rb,h,seg,mat);
    place(m, x, y + h/2, z);
    interiorGroup.add(m);
    return m;
  }
  // raised bed: boarded edge, soil, and `rows` ridges of leaf
  function gardenBed(cx, cz, w, d, rows, alongZ, mat){
    cBox(cx, 0, cz, w, 0.26, d, soilMat);
    cBox(cx, 0.26, cz, w*0.99, 0.05, d*0.99, soilMat);
    [-1,1].forEach(function(s){
      if (alongZ) cBox(cx + s*w/2, 0, cz, 0.10, 0.34, d, oakLtMat);
      else        cBox(cx, 0, cz + s*d/2, w, 0.34, 0.10, oakLtMat);
    });
    for (var r=0;r<rows;r++){
      var t = (r+0.5)/rows - 0.5;
      if (alongZ) cBox(cx, 0.31, cz + t*d*0.92, w*0.80, 0.26, d*0.92/rows*0.55, mat||cropMat);
      else        cBox(cx + t*w*0.92, 0.31, cz, w*0.92/rows*0.55, 0.26, d*0.80, mat||cropMat);
    }
  }
  // small courtyard fruit tree: a rounded, broadleaf crown built from two
  // low-poly spheres (cones read as conifers, which is wrong for a walled
  // orchard). Deliberately ~3.5m -- a fraction of the field oaks outside.
  function leafBlob(x,y,z,r,mat){
    var m = new T.Mesh(new T.SphereGeometry(r, 7, 5), mat);
    m.castShadow = true; m.receiveShadow = true;
    m.position.set(x,y,z);
    m.scale.y = 0.82;
    interiorGroup.add(m);
    return m;
  }
  function courtTree(x, z, h){
    cCyl(x, 0, z, 0.15, 0.23, h*0.50, 7, barkMat);
    leafBlob(x, h*0.66, z, h*0.30, leafDkMat);
    leafBlob(x - h*0.13, h*0.55, z + h*0.10, h*0.20, leafDkMat);
    leafBlob(x + h*0.11, h*0.82, z - h*0.07, h*0.21, leafMdMat);
  }
  function tub(x, z, s){
    s = s || 1;
    cCyl(x, 0, z, 0.32*s, 0.26*s, 0.52*s, 9, oakLtMat);
    cCyl(x, 0.46*s, z, 0.30*s, 0.30*s, 0.06*s, 9, soilMat);
    leafBlob(x, 0.78*s, z, 0.30*s, leafMdMat);
  }
  // WEST strip: four kitchen beds (beans, cabbage, roots, onions)
  [-6.6, -2.2, 2.2, 6.6].forEach(function(bz){
    gardenBed(-PLANT_IN - 1.15, bz, 2.10, 3.60, 3, true, cropMat);
  });
  cBox(-PLANT_IN - 1.15, 0, 9.4, 2.10, 0.12, 1.60, soilMat);          // turned-over end plot
  // EAST strip: the herb / physic garden -- four small square plots
  [-6.2, -2.1, 2.1, 6.2].forEach(function(hz){
    gardenBed(PLANT_IN + 1.15, hz, 2.10, 3.10, 4, true, herbMat);
  });
  // SOUTH strip: two long beds either side of the screens-passage door,
  // plus the household woodpile
  gardenBed(-6.6, PLANT_IN + 1.15, 4.60, 2.10, 3, false, cropMat);
  gardenBed(6.6, PLANT_IN + 1.15, 4.60, 2.10, 3, false, cropMat);
  (function courtWood(){
    for (var r=0;r<3;r++){
      var n = 5 - r;
      for (var c=0;c<n;c++){
        var m = mkCyl(0.10,0.11,1.20,6, barkMat);
        m.rotation.z = Math.PI/2;
        m.position.set(0.9, 0.11 + r*0.20, PLANT_IN + 0.55 + (c-(n-1)/2)*0.23);
        interiorGroup.add(m);
      }
    }
  })();
  // corner trees + tubs (kept off the gate line, see the note above)
  courtTree(-PLANT_IN - 1.3, -PLANT_IN - 1.1, 3.7);
  courtTree( PLANT_IN + 1.3, -PLANT_IN - 1.1, 3.5);
  courtTree( PLANT_IN + 1.3,  PLANT_IN + 1.2, 3.4);
  courtTree(-PLANT_IN - 1.3,  PLANT_IN + 1.2, 3.2);
  tub(-8.0, -PLANT_IN - 1.6, 1.0);
  tub( 8.0, -PLANT_IN - 1.6, 1.0);
  tub(-PLANT_IN - 1.2, -0.1, 0.9);
  // low wattle edging along the courtyard side of the west beds
  for (var wf=0; wf<9; wf++){
    cBox(-PLANT_IN + 0.1, 0, -8.4 + wf*2.1, 0.09, 0.50, 1.85, oakLtMat);
  }
  registerPick(pickables, 'room', -PLANT_IN - 1.15, 1.1, 0, 3.0, 2.2, 17.5,
    '菜園 Kitchen Garden', '中庭西側の菜園。豆・キャベツ・根菜の畝を柵で囲う。中世の城館は日々の青物を城内で賄った。');
  registerPick(pickables, 'room', PLANT_IN + 1.15, 1.1, 0, 3.0, 2.2, 16.0,
    '薬草園 Herb Garden', '中庭東側の薬草園。厨房と病人の手当てに使うハーブを小区画に分けて育てた。');

  /* -------------------------------------------------------------- *
   * moat, graded bank, island, approaches
   * -------------------------------------------------------------- *
   * The moat/bank/island/ground assembly itself is castle-agnostic (see
   * buildWaterMoatSystem, section 0.5) -- only the numbers below are
   * Bodiam-specific. GROUND_Y is the outer field height; WATER_Y sits
   * ~1m below it (spec: 0.8-1.2m) so the graded banks read as a real
   * slope down into the moat rather than a flat plane dropped on top of
   * the grass. Bridge/octagon height relationships are untouched -- the
   * bridges still run from the *top* of the outer bank (still at
   * MOAT_OUTER, GROUND_Y) to the island, just as before; only the water
   * itself, and the ground it's cut into, moved. */
  // Bodiam's moat is huge -- in the aerial reference the open water on
  // each side is very nearly as wide as the castle itself, and the walls
  // rise almost straight out of it (there is no apron of dry land round
  // the island, which the old ISLAND_HALF = OW+3.2 produced as a very
  // visible sandy ledge). Hence: much wider water, much tighter island.
  var ISLAND_HALF = OW + 0.8;
  var MOAT_WIDTH = 38;
  var MOAT_OUTER = ISLAND_HALF + MOAT_WIDTH;
  var GROUND_Y = -0.55;
  var WATER_Y = GROUND_Y - 1.0; // 1.0m below the field -- within the 0.8-1.2m spec

  var moatSys = buildWaterMoatSystem({
    group: group,
    groundY: GROUND_Y, waterY: WATER_Y,
    islandHalf: ISLAND_HALF, islandY: 0.02,
    moatOuterHalf: MOAT_OUTER,
    bankWidthOut: 4.5, bankWidthIn: 1.4,
    groundMat: grassMat, islandMat: grassMat2,
    waterColor: WATER_COL,
    bankColorTop: BANK_COL, bankColorMid: BANK_MID_COL, bankColorEdge: BANK_EDGE_COL
  });
  var waterMat = moatSys.waterMat;

  /* ---- north approach: bank -> timber bridge -> THE OCTAGON -> bridge
   * -> gatehouse.
   *
   * THE OCTAGON is not a grassy islet. Historic England's scheduling
   * entry for Bodiam (list entry 1013554) describes the causeway
   * projecting into the northern arm of the moat as "ending in an
   * octagonal plinth which originally carried further defences", and the
   * reference photograph downloaded for this pass (Wikimedia Commons,
   * "Bridge to Bodiam Castle" / geograph 6702449, CC BY-SA) shows what
   * that plinth actually looks like today: an octagonal STONE platform,
   * revetted all round with a battered ashlar face, standing roughly a
   * metre clear of the water, with a low coping on its rim, a gravel
   * path running straight across it from the timber footbridge, and only
   * thin patches of turf inside the revetment.
   *
   * The previous build drew it as a bare CircleGeometry(4.0, 8) in
   * BANK_COL (0x6d8449). On a flat, upward-facing surface the day
   * lighting multiplies green by ~1.94, so 0x84 = 132 -> 256: the green
   * channel CLIPPED and the platform rendered as a solid, vividly
   * saturated green lozenge floating in the moat -- the "weird island"
   * in the middle of the bridge. Everything below is stone, and every
   * base colour is inside the exposure budget noted in the palette. */
  var octR = 5.0;                      // circum-radius (~10m across, ~9.2m flat-to-flat)
  var octZ = -(ISLAND_HALF + MOAT_WIDTH*0.46);
  var OCT_ROT = Math.PI/8;             // rotate 22.5deg so a FLAT face meets each bridge
  var OCT_APO = octR*Math.cos(Math.PI/8);   // apothem: edge-midpoint radius
  var OCT_EDGE = 2*octR*Math.sin(Math.PI/8);// length of one octagon edge
  var OCT_DECK_Y = 0.10;               // gravel deck, just under the bridge deck tops
  var OCT_FOOT_Y = WATER_Y - 1.2;      // revetment foot, buried below the waterline

  var octStoneMat  = new T.MeshLambertMaterial({ color: 0x635d4e }); // revetment ashlar (darker: reads as a wall face)
  var octCopeMat   = new T.MeshLambertMaterial({ color: 0x76705f }); // coping / kerb
  var octGravelMat = new T.MeshLambertMaterial({ color: 0x6a6350 }); // path surface across the plinth
  var octTurfMat   = new T.MeshLambertMaterial({ color: 0x4a5b3a }); // the thin turf inside the kerb
  var octBaseMat   = new T.MeshLambertMaterial({ color: 0x4d4838 }); // wet, weed-stained lower courses

  // revetment drum: an 8-sided battered wall from below the waterline up
  // to deck level. Built as a cylinder with 8 radial segments, spun by
  // OCT_ROT so the faces (not the corners) look north and south.
  var octDrum = mkCyl(octR, octR*1.09, OCT_DECK_Y - OCT_FOOT_Y, 8, octStoneMat);
  octDrum.rotation.y = OCT_ROT;
  place(octDrum, 0, (OCT_DECK_Y + OCT_FOOT_Y)/2, octZ);
  group.add(octDrum);
  // darker, weed-stained band right at the waterline
  var octBand = mkCyl(octR*1.045, octR*1.075, 0.85, 8, octBaseMat);
  octBand.rotation.y = OCT_ROT;
  place(octBand, 0, WATER_Y - 0.15, octZ);
  group.add(octBand);

  // deck: an octagonal gravel surface, inset just inside the revetment
  (function octDeck(){
    var deckGeo = new T.CircleGeometry(octR - 0.16, 8);
    deckGeo.rotateX(-Math.PI/2);
    var deck = new T.Mesh(deckGeo, octGravelMat);
    deck.rotation.y = OCT_ROT;
    deck.receiveShadow = true;
    place(deck, 0, OCT_DECK_Y, octZ);
    group.add(deck);
    // two narrow turf strips tucked against the kerb either side of the
    // through path. Deliberately small: the photo shows the plinth as a
    // stone platform with a little grass on it, NOT a grass island, and
    // an over-large turf patch is exactly what made the old build read
    // as a green blob.
    [-1, 1].forEach(function(s){
      var turf = mkBox(1.9, 0.05, 3.9, octTurfMat);
      place(turf, s*2.85, OCT_DECK_Y + 0.025, octZ);
      group.add(turf);
    });
  })();

  // low stone coping round the rim, broken at the north and south faces
  // where the bridge deck / causeway path runs through
  (function octKerb(){
    for (var m=0;m<8;m++){
      if (m === 2 || m === 6) continue;          // +Z (south) and -Z (north) openings
      var psi = m*Math.PI/4;
      var rr = OCT_APO - 0.22;
      var kerb = mkBox(OCT_EDGE + 0.30, 0.52, 0.44, octCopeMat);
      place(kerb, Math.cos(psi)*rr, OCT_DECK_Y + 0.26, octZ + Math.sin(psi)*rr, -(psi + Math.PI/2));
      group.add(kerb);
    }
    // stubs of the vanished defences the plinth once carried: two ruined
    // jamb blocks flanking the south (castle-facing) opening
    [-1, 1].forEach(function(s){
      var j = mkBox(0.9, 1.25, 1.0, octStoneMat);
      place(j, s*2.15, OCT_DECK_Y + 0.62, octZ + OCT_APO - 0.35);
      group.add(j);
    });
  })();

  // rubble apron at the foot of the revetment, graded into the moat bed
  // so the drum does not end in a hard cylinder-meets-plane line
  var octSkirt = buildCircularSkirt(0, octZ, octR*1.09, octR*1.09 + 1.5, OCT_FOOT_Y + 0.05, WATER_Y - 1.85,
    new T.Color(0x44412f), new T.Color(0x36351f), new T.Color(0x24251a));
  group.add(octSkirt);

  registerPick(pickables, 'structure', 0, 1.4, octZ, octR*2, 3.2, octR*2,
    '八角プラットフォーム The Octagon',
    '北の橋の中程に残る八角形の石造プラットフォーム。城側に伸びる石の土手道の先端にあたり、かつてバービカン(外堡)への跳ね橋を受けていた。');

  /* buildBankRamp (section 0.5) builds its material with
   *   vertexColors: T.VertexColors
   * -- a constant that three.js removed in r125, and index.html loads
   * r128, so it evaluates to `undefined` and vertex colouring silently
   * stays OFF. The graded turf->silt banks therefore rendered as a flat
   * near-white ring round the whole moat, which is the single most
   * obviously wrong thing in a wide shot of Bodiam. Re-enable it here on
   * the meshes the helper handed back -- these material instances are
   * created per call, so this is local to this castle and touches no
   * shared file. (The shared helper should be fixed to pass `true`.) */
  [moatSys.bankOuter, moatSys.bankInner, octSkirt].forEach(function(m){
    if (m && m.material && m.material.vertexColors !== true){
      m.material.vertexColors = true;
      m.material.needsUpdate = true;
    }
  });

  // The two north spans land ON the octagon's flat north and south faces
  // (octZ -/+ the apothem, plus 0.3m of overlap). Running them to the
  // circum-radius instead, as the first build did, left a ~0.4m slot of
  // open water between each bridge end and the plinth's flat face.
  var b1z0 = -MOAT_OUTER+1.0, b1z1 = octZ - OCT_APO + 0.3;
  var bridge1 = mkBox(2.6, 0.35, Math.abs(b1z1-b1z0), woodMat);
  place(bridge1, 0, -0.05, (b1z0+b1z1)/2);
  group.add(bridge1);
  var b2z0 = octZ + OCT_APO - 0.3, b2z1 = -(OW+GATE_PROJ-0.6);
  var bridge2 = mkBox(3.4, 0.3, Math.abs(b2z1-b2z0), woodMat);
  place(bridge2, 0, -0.02, (b2z0+b2z1)/2);
  group.add(bridge2);

  // south approach: straight bridge from bank to postern tower
  var s0 = MOAT_OUTER-1.0, s1 = OW+POST_PROJ-0.8;
  var bridgeS = mkBox(3.0, 0.3, Math.abs(s0-s1), woodMat);
  place(bridgeS, 0, -0.02, (s0+s1)/2);
  group.add(bridgeS);

  // bridge piers: the water is now well below deck height (~1.5m), so
  // give the two long open-water spans a couple of timber support posts
  // reaching down to just below the waterline -- purely cosmetic, no
  // collision/height logic depends on them.
  function bridgePier(x, z, deckY){
    var pier = mkCyl(0.22, 0.26, (deckY - (WATER_Y - 0.4)), 8, woodMat);
    place(pier, x, (deckY + (WATER_Y - 0.4))/2, z);
    group.add(pier);
  }
  [0.35, 0.65].forEach(function(f){
    var z = b1z0 + (b1z1-b1z0)*f;
    bridgePier(-0.85, z, -0.05); bridgePier(0.85, z, -0.05);
  });
  (function(){
    var z = s0 + (s1-s0)*0.5;
    bridgePier(-0.9, z, -0.02); bridgePier(0.9, z, -0.02);
  })();

  /* ================================================================ *
   * LIVESTOCK: 厩舎の馬、中庭の家禽、鳩小屋、堀の水鳥、犬と猫
   * ================================================================ *
   * 中世の城は防御施設であると同時に自給的な「屋敷農場」でもあった。
   * 北棟の厩舎には領主と従者の乗馬が繋がれ、中庭の隅では鶏が飼われ、
   * 鳩小屋(dovecote)は冬場の生肉・卵と、畑の肥料になる糞を供給した
   * (鳩の飼育権は領主の特権)。犬は猟犬兼番犬、猫は穀倉の鼠捕りとして
   * 家政記録に現れる。堀の白鳥は身分の標識でもある -- 中世イングランド
   * では白鳥は「国王の鳥」で、飼育には特許が必要だった。
   *
   * 実装方針:
   *  - 種ごとにジオメトリとマテリアルを共有する。鶏1羽は7メッシュだが
   *    そのバッファは全羽で1組しかない(下の GEO / MATS プール)。
   *    mkBox/mkCyl はメッシュごとに新しい BufferGeometry を作るので、
   *    量産する動物にはあえて使わず、共有ジオメトリ + new T.Mesh にする。
   *  - 姿勢・向きのばらつきは決定論的に置く(Math.random は使わない)。
   *    リロードごとに配置が変わると比較スクリーンショットが撮れない。
   *  - 屋内の動物は interiorGroup(フェードしない)に入れる。カット
   *    アウェイで厩舎の壁が消えたとき、中の馬がそのまま見えるため。
   *    堀の水鳥は城外なので group 直下に置き、常時表示する。
   *  - 色はパレット冒頭の露出予算に従う(どのチャンネルも 0x77 以下)。
   *    白鳥・葦毛馬の「白」も 0x76 止まりで、乗算後に約230になる。
   *  - 住人の歩行線(中庭 ±COURT_INNER の徘徊矩形、衛兵の巡回ループ、
   *    farmers が門 (0,-OW) へ向かう直線)と、菜園・薬草園・果樹の
   *    外側にだけ置く。動物は静止でよく、毎フレームの更新はしない。
   * ================================================================ */
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
    // one animal = one Group at (x,y,z); every part is positioned in the
    // animal's own local frame with local -X = "forward / head end"
    function spawn(host, x, y, z, ry, scl){
      var g = new T.Group();
      g.position.set(x, y, z);
      if (ry) g.rotation.y = ry;
      if (scl && scl !== 1) g.scale.setScalar(scl);
      host.add(g);
      return g;
    }
    // deterministic 0..1 from a coordinate pair -- the flock loops below use
    // it for per-head jitter so the yard never looks like a grid, while a
    // reload reproduces exactly the same animals in the same attitudes
    function h01(x, z, s){
      var v = Math.sin(x*127.1 + z*311.7 + (s||0)*74.7) * 43758.5453;
      return v - Math.floor(v);
    }

    var WFY = WING_FLOOR_Y;   // wing stone floor top (stable, hall, chambers)

    /* ---- horse ------------------------------------------------------
     * 11 meshes: barrel, shoulder, haunch, neck, mane, head, 4 legs, tail.
     * Neck + head hang off a nested Group, so ONE rotation switches the
     * whole animal between head-up, nose-in-the-manger and grazing without
     * any per-pose coordinate maths (and the mane/head stay attached).
     * pose: 0 alert, 1 head at the manger, 2 grazing, 3 lying down. */
    var HIDE = [aMat(0x5b4029), aMat(0x66645b), aMat(0x6b4b2d), aMat(0x322b22)]; // 鹿毛/葦毛/栗毛/青毛
    var MANE = [aMat(0x33261a), aMat(0x53514a), aMat(0x4a3320), aMat(0x24201a)];
    function horse(host, x, y, z, ry, idx, pose, scl){
      var g = spawn(host, x, y, z, ry, scl);
      var mat = HIDE[idx], mane = MANE[idx], lying = pose === 3;
      var bY = lying ? 0.52 : 1.18;
      pt(g, gBox(2.00, lying ? 0.84 : 0.96, 0.88), mat, 0, bY, 0);
      pt(g, gBox(0.62, 0.34, 0.76), mat, -0.84, bY + 0.10, 0);
      pt(g, gBox(0.56, 0.30, 0.72), mat,  0.82, bY + 0.05, 0);
      var neck = new T.Group();
      neck.position.set(-0.92, bY + (lying ? 0.16 : 0.28), 0);
      // +z rotation tips the neck's top toward -X (forward): 0.30 = head up
      // at ~2.2m, 1.55 = muzzle level with a manger, 2.28 = nose on the floor
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

    /* ---- domestic fowl (hen / cockerel) -----------------------------
     * 7 meshes. `peck` drops the head to the ground; `cock` makes it a
     * bigger bird with a sickle tail and a full comb.
     * The base bird is drawn at ~0.35m (life size) and then scaled 1.35:
     * at the courtyard's default framing a true-to-scale hen is about six
     * pixels of mud-brown and simply disappears, so the flock is drawn a
     * third over size -- the same latitude the courtyard fruit trees and
     * the moat's render width already take for legibility. */
    var FOWL = [aMat(0x6a5334), aMat(0x6c6a5e), aMat(0x4b4038)];  // 赤鶏 / 白鶏 / 黒鶏
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
     * 5 meshes. Sits with the group origin ON the water plane, so the
     * flattened body sphere is half submerged exactly like a real bird. */
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

    /* ---- hen house: a boarded coop on staddle legs, with a pop-hole
     * and a ramp. Kept small (1.7m) -- it is a courtyard fitting, not a
     * building, and Bodiam's ward is only 22.8m across. */
    var COOP = aMat(0x6b5236), COOP_DK = aMat(0x4a3a26), HOLE = aMat(0x1d1811);
    function henHouse(host, x, y, z, ry){
      var g = spawn(host, x, y, z, ry);
      pt(g, gBox(1.70, 0.85, 1.20), COOP, 0, 0.62, 0);
      pt(g, gBox(1.86, 0.14, 1.36), COOP_DK, 0, 1.11, 0);
      pt(g, gBox(1.10, 0.10, 1.44), COOP_DK, -0.42, 1.36, 0,  0.62);
      pt(g, gBox(1.10, 0.10, 1.44), COOP_DK,  0.42, 1.36, 0, -0.62);
      [-0.62, 0.62].forEach(function(lx){ [-0.44, 0.44].forEach(function(lz){
        pt(g, gBox(0.12, 0.42, 0.12), COOP_DK, lx, 0.21, lz);
      });});
      pt(g, gBox(0.10, 0.34, 0.30), HOLE, -0.86, 0.60, 0.26);
      pt(g, gBox(1.15, 0.07, 0.42), COOP_DK, -1.40, 0.26, 0.26, 0.42);
      return g;
    }

    /* ---- dovecote: a post-mounted timber cote with a landing board,
     * six nest holes and a pyramid cap. A free-standing stone columbarium
     * would swallow this courtyard, so the smaller post type is used.
     * Ground footprint is one 0.16m post, which is why it can stand in
     * the south planting strip without touching a bed or a walking line. */
    var COTE = aMat(0x6d6553), COTE_DK = aMat(0x494335);
    function dovecote(host, x, y, z){
      var g = spawn(host, x, y, z, 0);
      pt(g, gCyl(0.13, 0.16, 2.30, 8), COOP_DK, 0, 1.15, 0);
      [-1, 1].forEach(function(s){ pt(g, gBox(0.72, 0.11, 0.11), COOP_DK, s*0.28, 2.02, 0, s*0.72); });
      pt(g, gBox(1.60, 0.10, 1.40), COTE_DK, 0, 2.32, 0);
      pt(g, gBox(1.20, 1.00, 1.06), COTE, 0, 2.87, 0);
      [-1, 1].forEach(function(s){
        [-0.34, 0, 0.34].forEach(function(oz){
          pt(g, gBox(0.10, 0.20, 0.16), HOLE, s*0.62, 3.02, oz);
        });
      });
      pt(g, gBox(1.44, 0.10, 1.30), COTE_DK, 0, 3.42, 0);
      var cap = pt(g, gCone(0.98, 0.62, 4), COTE_DK, 0, 3.78, 0);
      cap.rotation.y = Math.PI/4;
      pt(g, gCyl(0.05, 0.05, 0.26, 6), COTE_DK, 0, 4.20, 0);
      return g;
    }

    /* ================= NORTH RANGE: the stable ======================= *
     * Four loose boxes were already boarded out between the stall posts
     * at x = -5.4 / -9.2 / -12.6 / -16.4 (z -19.7..-16.7), with mangers
     * on the courtyard side at z = -15.7. Each horse therefore stands
     * ALONG Z (ry = pi/2 puts its head end at +Z, i.e. facing the manger)
     * and sits between two posts, never on one. */
    var STALL = [
      [ -7.60, -18.10,  0.00, 0, 1 ],  // 鹿毛、飼葉桶に首を伸ばす
      [-10.90, -18.20, -0.07, 1, 0 ],  // 葦毛、頭を上げて立つ
      [-14.30, -18.10,  0.05, 2, 2 ],  // 栗毛、藁をついばむ
      [-18.00, -18.20,  0.00, 3, 3 ]   // 青毛、伏せて休む
    ];
    STALL.forEach(function(s){ horse(interiorGroup, s[0], WFY, s[1], Math.PI/2 + s[2], s[3], s[4]); });
    // the stable cat, asleep on top of the corner hay pile (top = WFY+1.425)
    cat(interiorGroup, -18.40, WFY + 1.43, -12.80, 0.85, 0);
    // the yard dog, standing by the water trough at the stable door
    dog(interiorGroup, -5.55, WFY, -13.45, 2.25, 0, false);

    /* ================= COURTYARD: the poultry yard =================== *
     * Everything here is in the SOUTH planting strip (z 8.85..11.4),
     * which no resident ever enters: the wander rect is capped at
     * |z| <= COURT_INNER (7.5) and the farmers' line to the gate runs
     * NORTH. The strip's own occupants are the two long beds at x = +/-6.6
     * and the woodpile at x 0.3..1.5, so the coop, the cote and the birds
     * all sit in the two gaps between them. */
    henHouse(interiorGroup, 3.00, 0, 10.20, -0.12);
    dovecote(interiorGroup, -2.60, 0, 10.25);
    // hens and one cockerel, scratching round the coop. `peck` alternates
    // off the coordinate hash so no two neighbours share an attitude.
    [[ 1.90, 9.55, 0], [ 4.25, 9.45, 1], [ 2.10, 11.00, 0],
     [-1.15, 9.60, 1], [-3.70, 10.85, 2], [ 5.20, 10.10, 1]].forEach(function(p){
      var r = h01(p[0], p[1], 3);
      fowl(interiorGroup, p[0], 0, p[1], r*6.283, p[2], r > 0.42, false);
    });
    fowl(interiorGroup, 4.60, 0, 10.80, -2.05, 0, false, true);
    // the cote's own flock: three on the landing board / eaves, two down
    // on the grass under it
    pigeon(interiorGroup, -3.20, 2.37, 10.55,  1.05, 0);
    pigeon(interiorGroup, -2.05, 2.37,  9.75, -1.80, 1);
    pigeon(interiorGroup, -2.00, 3.47, 10.60,  0.40, 0);
    pigeon(interiorGroup, -1.85, 0.00,  9.30,  0.40, 2);
    pigeon(interiorGroup, -3.45, 0.00,  9.90, -1.10, 0);

    /* ================= INDOORS ======================================= */
    // a hound asleep at the Great Hall hearth (the hall floor is rushes,
    // and the hearth is at z = wingZ1-0.35, so this is clear of both the
    // trestles at z = sZmid+/-1.1 and the fire itself)
    dog(interiorGroup, 5.00, WFY, 18.50, 1.90, 0, true);
    // ...and the lord's cat, curled by the chamber hearth in the east range.
    // NOT on the bed: the canopy tester over it (y 2.35) is opaque, and this
    // viewer is looked at from above more often than not, so a cat up there
    // would simply never be seen.
    cat(interiorGroup, 18.55, WFY, -5.55, -0.70, 1);

    /* ================= THE MOAT ====================================== *
     * Open water runs from ISLAND_HALF+bankWidthIn (24.2) out to
     * MOAT_OUTER-bankWidthOut (56.3) on every side. The birds keep to the
     * inner half of that band so they read at the default zoom, and clear
     * the two north bridge spans (|x| < 1.7), the octagon (r 5 at z =
     * octZ) and the south bridge. They go in `group`, not interiorGroup:
     * they are outside the castle, so no cutaway tier should touch them. */
    [[-10.50, -28.50,  0.50], [-13.20, -30.20, 2.30], [-8.20, -31.00, -1.10]]
      .forEach(function(p){ waterBird(group, p[0], WATER_Y, p[1], p[2], 2); });   // 白鳥
    [[  8.50, -27.50,  1.60, 0], [ 10.40, -29.00, -0.40, 1], [ 12.20, -26.60, 2.60, 0],
     [-27.50,   7.00,  1.20, 1], [ 28.00,  -6.50, -2.00, 0], [  6.00,  28.00, 0.90, 1],
     [ -5.50,  29.40, -1.50, 0]]
      .forEach(function(p){ waterBird(group, p[0], WATER_Y, p[1], p[2], p[3]); }); // 鴨
    // a pair of geese on the west arm. (They are on the WATER, not on the
    // island: ISLAND_HALF is only OW+0.8, i.e. the curtain rises almost
    // straight out of the moat and there is no dry apron to stand on.)
    waterBird(group, -26.40, WATER_Y, -14.20,  0.80, 3);
    waterBird(group, -27.30, WATER_Y, -12.60, -0.60, 3);

    /* ---- tooltips (see registerPick, section 0). Animal volumes are
     * smaller than the room volumes they sit inside, and the raycast takes
     * the NEAREST hit, so hovering a horse gives the horse and hovering
     * the boards either side still gives 厩舎. */
    registerPick(pickables, 'room', -11.00, WFY + 1.30, -18.10, 12.6, 2.6, 2.6,
      '馬 Horses', '厩舎の馬房につながれた乗馬。馬は城で最も高価な資産のひとつで、軍馬(デストリア)・旅用の乗馬(パルフリー)・荷馬が別々に飼われた。');
    registerPick(pickables, 'room', 3.00, 0.95, 10.20, 2.4, 1.9, 2.0,
      '鶏小屋 Hen House', '中庭南辺の鶏小屋。卵と鶏肉は城の日常食で、家禽の世話は下働きの女性たちの仕事だった。');
    registerPick(pickables, 'room', -2.60, 3.00, 10.25, 1.9, 1.9, 1.8,
      '鳩小屋 Dovecote', '柱上の鳩小屋。中世の鳩小屋は冬場の生肉と卵、そして畑の肥料になる糞を生んだ。飼育は領主の特権で、荘園の格を示す設備でもあった。');
    registerPick(pickables, 'room', 18.55, WFY + 0.55, -5.55, 1.6, 1.4, 1.6,
      '猫 Cat', '領主居室の猫。城では穀物を食い荒らす鼠を捕るため、厩舎・穀倉・厨房に猫が飼われた。');
    registerPick(pickables, 'room', 5.00, WFY + 0.60, 18.50, 1.7, 1.6, 1.7,
      '猟犬 Hound', '大広間の炉端で眠る猟犬。狩猟は領主の身分の証で、猟犬は屋内で人と同じ広間に寝起きした。');
    registerPick(pickables, 'structure', -10.60, WATER_Y + 0.80, -29.80, 8.0, 2.0, 6.0,
      '白鳥 Swans', '堀に浮かぶ白鳥。中世イングランドでは白鳥は国王の鳥とされ、飼育には特許が必要な身分の標識だった。');
  })();

  /* -------------------------------------------------------------- *
   * info payload (room list metadata; not rendered as a standalone
   * legend panel -- room names now surface via the always-on label
   * toggle and the hover tooltip, both driven off `pickables` below)
   * -------------------------------------------------------------- */
  var info = {
    rooms: [
      { name:'大広間 (Great Hall)', desc:'南棟東側。2階分の吹き抜け、東端に領主の台座。' },
      { name:'スクリーンズパッセージ', desc:'大広間と厨房を隔てる配膳通路。' },
      { name:'パントリー・バトリー', desc:'配膳通路奥の一対の小部屋。パンと酒を管理。' },
      { name:'厨房 (Kitchen)', desc:'南棟西端。南北両壁に大きな炉。' },
      { name:'階段室・地下貯蔵', desc:'南東隅。大広間から歩廊へ上がる螺旋階段。' },
      { name:'礼拝堂 (Chapel)', desc:'東棟北寄り。フランドルタイルの床、2階に領主用オラトリー。' },
      { name:"領主居室 (Lord's Apartments)", desc:'東棟中央。東向きの窓、各階に暖炉。' },
      { name:"私室 (Lady's Bower)", desc:'東棟南寄り。大広間の上手に接する奥方の私室。' },
      { name:"従者ホール (Retainers' Hall)", desc:'西棟。外壁側は窓なし、暖炉なし。' },
      { name:'倉庫・宿舎', desc:'北棟東側、ゲートハウスの東隣。' },
      { name:'厩舎 (Stable)', desc:'北棟西側、ゲートハウスの西隣。' },
      { name:'井戸 (Well)', desc:'南西円塔のたもと、南棟の石床上。' },
      { name:'菜園 (Kitchen Garden)', desc:'中庭西側。豆・キャベツ・根菜の畝を柵で囲う。' },
      { name:'薬草園 (Herb Garden)', desc:'中庭東側。厨房と手当てに使うハーブの小区画。' }
    ]
  };

  // always-on labels (section 6 toggle): shared helper, see buildLabelGroup
  // (section 0) -- covers both structure and room pickables.
  var labelGroup = buildLabelGroup(group, pickables);

  /* ---- resident life data (section 6.5 住人システムが読む任意フィールド)
   * 門1つ(北の主門)+ 北の橋、狭い中庭は courtyard 矩形1枚、衛兵は中庭の縁
   * を地面レベルで周回(壁がフェードしても浮かないよう常にy=0)。
   * gate.path: 中庭側の門口(内側)から双塔間の通路を抜けた先(外側、橋2の
   * 起点あたり)までの中心線。toGate/through が必ずこの線分を経由してから
   * outside の消失フェードに入る(section 6.5 参照)。 -------------------- */
  var gateOuterZ = gateCz - GATE_PROJ/2 - 0.3; // 双塔ゲートハウスの北端 = 橋2の起点付近
  var gatePathLen = -OW - gateOuterZ; // 通路(内側口→外側口)の長さ
  var life = {
    gates: [ { path: [ {x:0, z:-OW}, {x:0, z:gateOuterZ} ], outDir:{x:0,z:-1},
      vanishDist: (MOAT_OUTER - OW + 6) - gatePathLen } ],
    // The wander rect and the patrol loop are pulled in from COURT_HALF to
    // COURT_INNER (7.5) so that neither farmers nor guards ever stand in
    // the new kitchen-garden / herb-garden border, whose inner edge is at
    // PLANT_IN - 0.05 = 8.8. Farmers additionally walk a straight line
    // from their wander point to the gate at (0,-OW); from a rect capped
    // at +/-7.5 that line stays inside |x| < 6.3 where it crosses the
    // north strip, which is why the north strip is left bare except for
    // the two tubs out at |x| = 8.0.
    courtyard: [ { minX:-COURT_INNER, maxX:COURT_INNER, minZ:-COURT_INNER, maxZ:COURT_INNER } ],
    patrol: [
      [ COURT_INNER, 0, -COURT_INNER], [ COURT_INNER, 0,  COURT_INNER],
      [-COURT_INNER, 0,  COURT_INNER], [-COURT_INNER, 0, -COURT_INNER]
    ],
    population: { farmers: 8, guards: 2 }
  };

  return { group: group, fadeGroups: fadeGroups, interiorGroup: interiorGroup, info: info,
    pickables: pickables, windowMat: windowMat, waterMats: [waterMat], labelGroup: labelGroup, life: life };
}

registerCastle({
  id: 'bodiam',
  name: 'Bodiam Castle',
  nameJa: 'ボディアム城',
  country: 'England',
  countryJa: 'イングランド(イギリス)',
  flag: '🏴󠁧󠁢󠁥󠁮󠁧󠁿',
  year: '1385',
  description: '1385年、エドワード・ダリングリッジ卿が築いた水堀に浮かぶ城。四隅に円塔、北に双子塔のゲートハウスを持つ、対称性の高い後期中世城郭建築の代表例。',
  build: buildBodiam,
  // camera / fog / shadow tuning for this castle's scale (section 5 /
  // section 3 read these via applyCastle). These are exactly the values
  // that were previously hardcoded, so Bodiam's behaviour is unchanged.
  // Scaled with the corrected 44m footprint + 38m moat (island+moat is
  // now ~123m across, was ~93m). The zMin/zMax/initDist triple keeps the
  // SAME initial reveal value as before -- (zMax-initDist)/(zMax-zMin)
  // = 0.345 either way -- so the castle still opens in the 外観 state and
  // the cutaway crosses its thresholds at the same relative zoom.
  view: { targetY: 6.5, zMin: 26, zMax: 200, initDist: 140,
    fogNear: 120, fogFar: 430, shadowExtent: 80, shadowFar: 290,
    camFar: 1300, panLimit: 55 }
});
