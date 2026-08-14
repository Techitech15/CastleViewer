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
  var interiorGroup = new T.Group();
  group.add(interiorGroup);
  var fadeGroups = [];
  var pickables = [];

  function mpMakeFadeGroup(name, dir, isRoof, colorHex, tier){
    var mat = new T.MeshLambertMaterial({ color: colorHex });
    var g = new T.Group();
    g.name = name;
    group.add(g);
    var desc = { group:g, mat:mat, dir:dir, roof: !!isRoof, op:1, name:name, tier: tier || 'outer' };
    fadeGroups.push(desc);
    return desc;
  }
  function mpNorm(x,z){ var l = Math.hypot(x,z)||1; return {x:x/l, z:z/l}; }

  /* ---- palette: identical two-tone red-brick / terracotta scheme to
   * castles/malbork.js (deep red-brick walls, bright terracotta roofs) --
   * per task brief, the two builds must read as the same castle, only at
   * the corrected scale. ------------------------------------------- */
  var BRICK_WALL   = 0x8a4636;
  var BRICK_WALL_V = 0x7c3c2c;
  var BRICK_DARK   = 0x5e2c1e;
  var ROOF_COL     = 0xc1502f;
  var WHITE_TRIM   = 0xe6dcc6;
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
  var COBBLE_COL   = 0x8f897a;
  var TREE_TRUNK_COL = 0x5a4530;
  var TREE_LEAF_COL1 = 0x4f7038;
  var TREE_LEAF_COL2 = 0x3f6b3a;

  var windowMat  = new T.MeshLambertMaterial({ color: WINDOW_COL });
  var floorMat   = new T.MeshLambertMaterial({ color: FLOOR_COL });
  var stubMat    = new T.MeshLambertMaterial({ color: STUB_COL, side: T.DoubleSide });
  var woodMat    = new T.MeshLambertMaterial({ color: WOOD_COL });
  var metalMat   = new T.MeshLambertMaterial({ color: METAL_COL });
  var grassMat   = new T.MeshLambertMaterial({ color: GRASS_COL });
  var trimMat    = new T.MeshLambertMaterial({ color: WHITE_TRIM });
  var goldMat    = new T.MeshLambertMaterial({ color: GOLD_COL });
  var darkWoodMat= new T.MeshLambertMaterial({ color: 0x2a1c14 });
  var stoneDarkMat = new T.MeshLambertMaterial({ color: BRICK_DARK });
  var ditchMat   = new T.MeshLambertMaterial({ color: DITCH_COL });
  var riverMat   = new T.MeshPhongMaterial({ color: WATER_COL, transparent:true, opacity:0.85, shininess:85, specular:0x9fd4e0 });
  var moatWaterMat = new T.MeshPhongMaterial({ color: WATER_COL, transparent:true, opacity:0.85, shininess:80, specular:0x9fd4e0 });
  var treeTrunkMat = new T.MeshLambertMaterial({ color: TREE_TRUNK_COL });
  var treeLeafMat1 = new T.MeshLambertMaterial({ color: TREE_LEAF_COL1 });
  var treeLeafMat2 = new T.MeshLambertMaterial({ color: TREE_LEAF_COL2 });
  var cobbleMat  = new T.MeshLambertMaterial({ color: COBBLE_COL });

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
  function mpGableRoof(target, mat, axis, cx, cz, spanA, spanB, halfWidth, eaveY, ridgeRise){
    var ridgeY = eaveY + ridgeRise;
    if (axis === 'x'){
      target.add(mpLeanSlope(mat, 'x', spanA, spanB, cz-halfWidth, cz, eaveY, ridgeY));
      target.add(mpLeanSlope(mat, 'x', spanA, spanB, cz+halfWidth, cz, eaveY, ridgeY));
    } else {
      target.add(mpLeanSlope(mat, 'z', spanA, spanB, cx-halfWidth, cx, eaveY, ridgeY));
      target.add(mpLeanSlope(mat, 'z', spanA, spanB, cx+halfWidth, cx, eaveY, ridgeY));
    }
    var shape = new T.Shape();
    shape.moveTo(-halfWidth,0); shape.lineTo(halfWidth,0); shape.lineTo(0,ridgeRise); shape.closePath();
    var geo = new T.ShapeGeometry(shape);
    var endMat = new T.MeshLambertMaterial({ color: mat.color.getHex(), side: T.DoubleSide });
    [spanA, spanB].forEach(function(s){
      var m = new T.Mesh(geo, endMat);
      m.castShadow = true; m.receiveShadow = true;
      if (axis === 'x'){ m.position.set(s, eaveY, cz); m.rotation.y = Math.PI/2; }
      else { m.position.set(cx, eaveY, s); }
      target.add(m);
    });
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
  function mpWindowsRow(fg, cx, cz, ry, count, spread, wallH, rows){
    rows = rows || 3;
    var co=Math.cos(ry), si=Math.sin(ry);
    for (var r=0;r<rows;r++){
      var frac = 0.20 + r*(0.62/Math.max(1,rows-1));
      for (var i=0;i<count;i++){
        var t = count<=1 ? 0 : (i/(count-1) - 0.5) * spread;
        var win = mkBox(0.6, 1.8, 0.35, windowMat);
        place(win, cx+t*co, wallH*frac, cz-t*si, ry);
        fg.group.add(win);
      }
    }
  }
  // volumetric wing block (Low/Middle Castle ranges -- real building
  // volume, not the thin representational High-Castle wall above) with a
  // gabled roof, reused from malbork.js's own wingBlock/gableRoof pair.
  function mpWingBlock(fg, roofFg, cx, cz, w, d, h, ridge, windowsAxis){
    var body = mkBox(w, h, d, fg.mat);
    place(body, cx, h/2, cz);
    fg.group.add(body);
    var storeys = Math.max(1, Math.floor(h/4.0));
    for (var s=0;s<storeys;s++){
      var y = 2.4 + s*4.0;
      if (y > h-1.3) break;
      var win1 = mkBox(windowsAxis==='x'? 0.85:0.35, 1.7, windowsAxis==='x'? 0.35:0.85, windowMat);
      place(win1, cx + (windowsAxis==='x'?0:w/2*0.98), y, cz + (windowsAxis==='x'?d/2*0.98:0));
      fg.group.add(win1);
      var win2 = win1.clone();
      win2.position.set(cx - (windowsAxis==='x'?0:w/2*0.98), y, cz - (windowsAxis==='x'?d/2*0.98:0));
      fg.group.add(win2);
    }
    if (windowsAxis==='x') mpGableRoof(roofFg.group, roofFg.mat, 'x', cx, cz, cx-w/2, cx+w/2, d/2, h, ridge);
    else mpGableRoof(roofFg.group, roofFg.mat, 'z', cx, cz, cz-d/2, cz+d/2, w/2, h, ridge);
  }
  function mpPickRoom(x0,x1,z0,z1,h,name,desc){
    registerPick(pickables, 'room', (x0+x1)/2, h/2, (z0+z1)/2, Math.abs(x1-x0), h, Math.abs(z1-z0), name, desc);
  }
  function mpSteppedGable(fg, trimFg, cx, gz, baseTopY, steps, baseW){
    var stepH = 2.6/steps + 0.7;
    for (var i=0;i<steps;i++){
      var w = baseW*(1 - i*0.2);
      var y = baseTopY + stepH*i + stepH/2;
      var box = mkBox(w, stepH*0.92, 1.0, fg.mat);
      place(box, cx, y, gz);
      fg.group.add(box);
      var coping = mkBox(w+0.3, 0.22, 1.16, trimFg.mat);
      place(coping, cx, baseTopY+stepH*(i+1), gz);
      trimFg.group.add(coping);
    }
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
  var ground = buildUndulatingGround(520, 2100, 92, grassMat, null);
  ground.position.y = GROUND_Y;
  group.add(ground);

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
  var hcTower = mpMakeFadeGroup('hcMainTower', mpNorm(1,0), false, BRICK_WALL_V, 'inner');
  var hcApse  = mpMakeFadeGroup('hcApse', mpNorm(1,1), false, BRICK_WALL_V, 'inner');
  var hcGd    = mpMakeFadeGroup('hcGdanisko', mpNorm(-1,-1), false, BRICK_WALL_V, 'inner');
  hcGd.mat.side = T.DoubleSide; // the bridge's arch-infill triangles (below) are single-sided planes
  var hcGdRoof= mpMakeFadeGroup('hcGdaniskoRoof', null, true, ROOF_COL, 'inner');

  mpWingWall(hcWallS, 0, -HC_HZ, 2*HC_HX, Math.PI, HC_WALL_H, 1.5, 0);
  mpWindowsRow(hcWallS, 0, -HC_HZ, Math.PI, 5, 40, HC_WALL_H, 4);
  mpGableRoof(hcRoof.group, hcRoof.mat, 'x', 0, -HC_HZ, -HC_HX+2, HC_HX-2, HC_WD_NS/2, HC_WALL_H, HC_RIDGE);

  var HC_GATE_W = 4.6; // dry-ditch bridge landing, centred X=0
  mpWingWall(hcWallN, 0, HC_HZ, 2*HC_HX, 0, HC_WALL_H, 1.5, HC_GATE_W);
  mpWindowsRow(hcWallN, 0, HC_HZ, 0, 4, 36, HC_WALL_H, 3);
  mpGableRoof(hcRoof.group, hcRoof.mat, 'x', 0, HC_HZ, -HC_HX+2, HC_HX-2, HC_WD_NS/2, HC_WALL_H, HC_RIDGE);

  mpWingWall(hcWallE, HC_HX, 0, 2*HC_HZ, -Math.PI/2, HC_WALL_H, 1.5, 0);
  mpWindowsRow(hcWallE, HC_HX, 0, -Math.PI/2, 5, 40, HC_WALL_H, 4);
  mpGableRoof(hcRoof.group, hcRoof.mat, 'z', HC_HX, 0, -HC_HZ+2, HC_HZ-2, HC_WD_EW/2, HC_WALL_H, HC_RIDGE);

  mpWingWall(hcWallW, -HC_HX, 0, 2*HC_HZ, Math.PI/2, HC_WALL_H, 1.5, 0);
  mpWindowsRow(hcWallW, -HC_HX, 0, Math.PI/2, 5, 40, HC_WALL_H, 4);
  mpGableRoof(hcRoof.group, hcRoof.mat, 'z', -HC_HX, 0, -HC_HZ+2, HC_HZ-2, HC_WD_EW/2, HC_WALL_H, HC_RIDGE);

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
  for (var af=0; af<4; af++){
    var ang = (af-1.5)*0.5;
    var wx = APSE_CX + Math.cos(ang)*APSE_R*0.97, wz = APSE_CZ + Math.sin(ang)*APSE_R*0.97;
    var awin = mkBox(0.5, APSE_H*0.6, 1.3, windowMat);
    place(awin, wx, APSE_H*0.5, wz, -ang);
    hcApse.group.add(awin);
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
    group.add(moatPlane);

    var supports = [BR_Z0, BR_Z0-12, BR_Z0-24, BR_Z0-36, BR_Z0-48, BR_Z1]; // 6 points -> 5 arches
    var DECK_Y = 8, BASE_Y = 1.6, PEAK_Y = DECK_Y - 0.6;
    var corridorHalf = GD_W*0.55/2;
    // 4 interior piers (stone, matching the deep-brick tone)
    for (var pi=1; pi<supports.length-1; pi++){
      var pz = supports[pi];
      var inWater = pz > moatZ1-0.01 ? false : (pz < moatZ0+0.01 ? false : true); // between moatZ0/moatZ1
      var pier = mkCyl(0.85, 0.95, BASE_Y-GROUND_Y+0.4, 10, inWater ? stoneDarkMat : hcGd.mat);
      place(pier, BR_X, GROUND_Y+(BASE_Y-GROUND_Y+0.4)/2, pz);
      group.add(pier);
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
        group.add(plank);
        [-1,1].forEach(function(side){
          var chain = mkCyl(0.06,0.06, 5.0, 5, metalMat);
          place(chain, BR_X+side*corridorHalf*0.8, DECK_Y-1.0, z0+0.6);
          chain.rotation.x = 0.9;
          group.add(chain);
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
  var hcGrassMat = new T.MeshLambertMaterial({ color: GRASS_COL2 });
  var courtLawn = mkBox(2*HC_COURT_HX, 0.28, 2*HC_COURT_HZ, hcGrassMat);
  place(courtLawn, 0, -0.16, 0);
  interiorGroup.add(courtLawn);
  var courtPathNS = mkBox(2.2, 0.3, 2*HC_COURT_HZ, cobbleMat);
  place(courtPathNS, 0, -0.14, 0);
  interiorGroup.add(courtPathNS);
  var courtPathEW = mkBox(2*HC_COURT_HX, 0.3, 2.2, cobbleMat);
  place(courtPathEW, 0, -0.14, 0);
  interiorGroup.add(courtPathEW);
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
  for (var pw=0; pw<3; pw++){
    var pillar = mkCyl(0.35,0.4, CH_H-0.6, 8, stubMat);
    place(pillar, (CH_X0+CH_X1)/2, (CH_H-0.6)/2, CH_Z-3+pw*3);
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
  for (var rp=0; rp<3; rp++){
    var rpillar = mkCyl(0.32,0.36, HC_WALL_H-0.6, 8, stubMat);
    place(rpillar, (rfX0+rfX1)/2, (HC_WALL_H-0.6)/2, rfZ0+2+rp*6);
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
  var ditchFloor = mkBox(2*HC_HX+30, 0.3, DITCH_W, ditchMat);
  place(ditchFloor, 0, GROUND_Y-0.6, (DITCH_Z0+DITCH_Z1)/2);
  group.add(ditchFloor);
  [DITCH_Z0, DITCH_Z1].forEach(function(z){
    var retain = mkBox(2*HC_HX+30, 1.0, 0.6, stoneDarkMat);
    place(retain, 0, GROUND_Y-0.1, z);
    group.add(retain);
  });
  registerPick(pickables, 'structure', 0, GROUND_Y-0.4, (DITCH_Z0+DITCH_Z1)/2, 2*HC_HX+20, 1.0, DITCH_W*0.9,
    '高城⇔中城の乾堀 Dry Ditch', '幅20m・深さ15m [BW]。水を張らない空堀で高城と中城を隔てる。');
  var hcMcBridge = mkBox(4.6, 0.3, DITCH_W+3, woodMat);
  place(hcMcBridge, 0, GROUND_Y+0.05, (DITCH_Z0+DITCH_Z1)/2);
  group.add(hcMcBridge);

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
  var MC_WD = 10, MC_WALL_H = 17; // △ 推定 (both unmeasured; height kept lower than the High Castle's 22m per photos)

  var mcWallFg = mpMakeFadeGroup('mcWings', {x:0,z:1}, false, BRICK_WALL);
  var mcRoofFg = mpMakeFadeGroup('mcRoofs', null, true, ROOF_COL);
  var mcPalaceFg = mpMakeFadeGroup('mcPalace', {x:-1,z:0}, false, BRICK_WALL_V);

  var MC_WX = -MC_HX + MC_WD/2, MC_EX = MC_HX - MC_WD/2;
  mpWingBlock(mcWallFg, mcRoofFg, MC_WX, (MC_Z0+MC_Z1)/2, MC_WD, MC_Z1-MC_Z0, MC_WALL_H, 5.5, 'z');
  mpWingBlock(mcWallFg, mcRoofFg, MC_EX, (MC_Z0+MC_Z1)/2, MC_WD, MC_Z1-MC_Z0, MC_WALL_H, 5.5, 'z');
  mpWingBlock(mcWallFg, mcRoofFg, 0, MC_Z1-MC_WD/2, 2*MC_HX, MC_WD, MC_WALL_H, 5.5, 'x');
  registerPick(pickables, 'structure', 0, MC_WALL_H*0.5, (MC_Z0+MC_Z1)/2, 2*MC_HX+6, MC_WALL_H, MC_Z1-MC_Z0+6,
    '中城 Middle Castle', '高城の北、約80x100m [MH](実測は台形、ここでは矩形近似)。西・北・東の三翼が中庭を囲む。南側は乾堀を挟んで高城に面する。');

  (function mcCourtyardPaths(){
    var x0=-MC_HX+MC_WD+3, x1=MC_HX-MC_WD-3, z0=MC_Z0+4, z1=MC_Z1-MC_WD-3, pathW=2.4;
    var cz=(z0+z1)/2;
    var pathNS = mkBox(pathW, 0.25, z1-z0, cobbleMat);
    place(pathNS, 0, 0.14, cz);
    interiorGroup.add(pathNS);
    var pathEW = mkBox(x1-x0, 0.25, pathW, cobbleMat);
    place(pathEW, 0, 0.14, cz);
    interiorGroup.add(pathEW);
  })();

  /* ---- Grand Master's Palace: WEST side, projecting from the west wing
   * [MH]◎, faces the Nogat river. Plan dims unmeasured -> 22x22m
   * assumed △, height 20m △ (position is ◎, footprint/height are 推定). */
  var GMP_W = 22, GMP_D = 22, GMP_H = 20;
  var GMP_CX = -MC_HX - GMP_W/2 + 3, GMP_CZ = MC_Z1 - 14;
  var gmpBody = mkBox(GMP_W, GMP_H, GMP_D, mcPalaceFg.mat);
  place(gmpBody, GMP_CX, GMP_H/2, GMP_CZ);
  mcPalaceFg.group.add(gmpBody);
  for (var gw=0; gw<5; gw++){
    var wz = GMP_CZ - GMP_D/2 + 3.5 + gw*((GMP_D-7)/4);
    var win = mkBox(0.4, GMP_H*0.42, 1.1, windowMat);
    place(win, GMP_CX-GMP_W/2*0.99, GMP_H*0.55, wz);
    mcPalaceFg.group.add(win);
  }
  var trimBand = mkBox(GMP_W+0.4, 0.6, GMP_D, trimMat);
  place(trimBand, GMP_CX, GMP_H*0.62, GMP_CZ);
  mcPalaceFg.group.add(trimBand);
  mpGableRoof(mcRoofFg.group, mcRoofFg.mat, 'z', GMP_CX, GMP_CZ, GMP_CZ-GMP_D/2, GMP_CZ+GMP_D/2, GMP_W/2, GMP_H, 6.5);
  registerPick(pickables, 'structure', GMP_CX, GMP_H*0.5, GMP_CZ, GMP_W+4, GMP_H, GMP_D,
    '大団長宮殿 Grand Master’s Palace', 'ノガト川に面する中城西側、西翼から張り出す団長の政庁兼住居 [MH]。平面寸法は非公開のため22x22mと推定。');

  /* ---- Great Refectory Wielki Refektarz: west wing, 30x15m [MH]◎,
   * ceiling ~9.5m, 3 granite octagonal columns (3.3m tall) [MH]◎, 14
   * pointed-arch windows [MH]◎. Embedded in the west wing, south of the
   * palace so the two don't overlap. */
  var RF_W = 15, RF_D = 30, RF_H = 9.5;
  var RF_CZ = MC_Z0 + 24;
  registerPick(pickables, 'structure', MC_WX, RF_H*0.5, RF_CZ, RF_W, RF_H, RF_D,
    '大食堂 Great Refectory', '西翼、30x15m [MH]。天井高9〜9.7m、花崗岩の八角柱3本(柱高3.3m)、尖頭アーチ窓14枚、収容400人。');
  for (var rc=0; rc<3; rc++){
    var col = mkCyl(0.55, 0.55, 3.3, 8, stubMat);
    place(col, MC_WX, 1.65, RF_CZ-9+rc*9);
    interiorGroup.add(col);
  }
  for (var rw=0; rw<14; rw++){
    var rwz = RF_CZ - RF_D/2 + 1.2 + rw*((RF_D-2.4)/13);
    var rwin = mkBox(0.35, 1.9, 0.6, windowMat);
    place(rwin, MC_WX-MC_WD/2*0.99, RF_H*0.6, rwz);
    mcWallFg.group.add(rwin);
    var rcap = mkCone(0.42, 0.7, 3, windowMat);
    rcap.rotation.y = Math.PI/2;
    place(rcap, MC_WX-MC_WD/2*1.01, RF_H*0.6+0.95+0.35, rwz);
    mcWallFg.group.add(rcap);
  }

  /* ---- Infirmary Firmaria: north wing, west-leaning [MH][BW]○, stepped
   * gable a signature silhouette. Dims unmeasured -> 推定. */
  var IF_CX = -20, IF_CZ = MC_Z1 - MC_WD/2;
  mpSteppedGable(mcWallFg, mcRoofFg, IF_CX, IF_CZ+MC_WD/2+0.9, MC_WALL_H-2, 4, MC_WD*1.5); // copings reuse the roof-tier terracotta colour
  registerPick(pickables, 'structure', IF_CX, MC_WALL_H*0.5, IF_CZ, 18, MC_WALL_H+6, MC_WD,
    '施療院 Infirmary', '北翼西寄り [MH][BW]。階段状の破風が目立つ。寸法は非公開のため近似。');

  /* ---- East wing: guest chambers + St Bartholomew's chapel (dims
   * unmeasured -> 推定; footprint/position only). */
  registerPick(pickables, 'structure', MC_EX, MC_WALL_H*0.5, (MC_Z0+MC_Z1)/2, MC_WD, MC_WALL_H, MC_Z1-MC_Z0,
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
  group.add(outMoatPlane);
  registerPick(pickables, 'structure', 0, GROUND_Y+0.35, (OUTMOAT_Z0+OUTMOAT_Z1)/2, 2*MC_HX+40, 1.0, OUTMOAT_W*0.85,
    '中城外周の堀 Middle Castle Outer Moat', '幅20m・深さ10m [BW]。中城と低城を隔てる水堀。');
  var mcLcBridge = mkBox(6.0, 0.3, OUTMOAT_W+3, woodMat);
  place(mcLcBridge, 0, GROUND_Y+0.5, (OUTMOAT_Z0+OUTMOAT_Z1)/2);
  group.add(mcLcBridge);

  /* ================================================================
   * LOW CASTLE Zamek Niski / Przedzamcze -- 140x270m rectangle [MH][ZO]
   * ◎, northernmost and largest block. Buildings arranged in 4
   * north-south rows [MH]○, incl. the Karwan (armoury/coach house,
   * 20x45m) and the round Maszynkowa Tower (dia 8.7m, wall 2.6m thick,
   * height <29m). Single castellated perimeter wall (height/thickness
   * unmeasured -> 推定). Tier 'outer'.
   * ================================================================ */
  var LC_HX = 70, LC_Z0 = OUTMOAT_Z1, LC_Z1 = LC_Z0 + 270; // [MH][ZO]◎ 140x270m
  var LC_WALL_H = 6, LC_WALL_T = 1.3; // △ 推定
  var LC_GATE_Z = (LC_Z0+LC_Z1)/2, LC_GATE_W = 4.6, LC_GATE_H = 5.2;

  var lcWallN = mpMakeFadeGroup('lcWallN', {x:0,z:1}, false, BRICK_WALL);
  var lcWallS = mpMakeFadeGroup('lcWallS', {x:0,z:-1}, false, BRICK_WALL);
  var lcWallE = mpMakeFadeGroup('lcWallE', {x:1,z:0}, false, BRICK_WALL);
  var lcWallW = mpMakeFadeGroup('lcWallW', {x:-1,z:0}, false, BRICK_WALL);
  var lcRoofFg = mpMakeFadeGroup('lcRoofs', null, true, ROOF_COL);
  var lcBuildFg = mpMakeFadeGroup('lcBuildings', {x:0,z:1}, false, BRICK_WALL_V);
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

  // 4 north-south building rows
  var lcRowX = [-50, -17, 17, 50];
  lcRowX.forEach(function(rx, ri){
    var segCount = 3, segLen = 44, gap = 10;
    var totalLen = segCount*segLen + (segCount-1)*gap;
    var z0 = LC_Z0 + 26;
    for (var si=0; si<segCount; si++){
      var scz = z0 + si*(segLen+gap) + segLen/2;
      if (scz + segLen/2 > LC_Z1-14) break;
      mpWingBlock(lcBuildFg, lcRoofFg, rx, scz, 18, segLen, 8.5, 3.6, 'z');
    }
  });
  // Karwan (armoury/coach house), 20x45m [spec measured value]○ -- one
  // distinctly-sized building replacing the south segment of row 2
  var KARWAN_CZ = LC_Z0 + 26 + 45/2;
  mpWingBlock(lcBuildFg, lcRoofFg, -17, KARWAN_CZ, 20, 45, 9.5, 4.0, 'z');
  registerPick(pickables, 'structure', -17, 4.75, KARWAN_CZ, 20, 9.5, 45,
    'カルワン Karwan', '武器庫兼車庫、20x45m。低城内の軍需・輸送を支えた実務施設。');
  // St Lawrence chapel -- small distinct building, north end of row 3
  var CHAPEL_CZ = LC_Z1 - 30;
  var chapelBody = mkBox(10, 7, 14, lcBuildFg.mat);
  place(chapelBody, 17, 3.5, CHAPEL_CZ);
  lcBuildFg.group.add(chapelBody);
  mpGableRoof(lcRoofFg.group, lcRoofFg.mat, 'z', 17, CHAPEL_CZ, CHAPEL_CZ-7, CHAPEL_CZ+7, 5, 7, 3.2);
  var spire = mkCone(1.0, 2.6, 4, lcRoofFg.mat);
  spire.rotation.y = Math.PI/4;
  place(spire, 17, 7+3.2+1.3, CHAPEL_CZ);
  lcRoofFg.group.add(spire);
  var cross = mkBox(0.12, 1.0, 0.12, goldMat);
  place(cross, 17, 7+3.2+2.6+0.5, CHAPEL_CZ);
  lcRoofFg.group.add(cross);
  registerPick(pickables, 'structure', 17, 3.5, CHAPEL_CZ, 10, 7, 14,
    '聖ラウレンティウス礼拝堂 St Lawrence Chapel', '低城内の小礼拝堂。位置・外形は概略復元。');

  // cobble lanes between the 4 rows, always-visible ground detail
  [-33.5, -1, 34].forEach(function(lx){
    var lane = mkBox(3.0, 0.22, LC_Z1-LC_Z0-20, cobbleMat);
    place(lane, lx, 0.13, (LC_Z0+LC_Z1)/2);
    interiorGroup.add(lane);
  });

  /* ================================================================
   * Nogat river -- west side of the ENTIRE complex, spanning from south
   * of the High Castle to north of the Low Castle. Distance from the
   * wall / terrace grading is not modelled (river sits flat above the
   * ground noise ceiling, same simplification castles/malbork.js uses);
   * the sheet's "川面から10-15m高い段丘上" fact is noted here but not
   * separately terraced.
   * ================================================================ */
  var RIVER_W = 55, RIVER_GAP = 8;
  var RIVER_X0 = -(LC_HX + RIVER_GAP + RIVER_W/2); // pinned off the widest (Low Castle) footprint
  var RIVER_Z_SPAN = (LC_Z1 - (GD_CZ-20)) ; // covers south of Gdanisko up to north of the Low Castle
  var riverCZ = (LC_Z1 + (GD_CZ-20))/2;
  var river = new T.Mesh(new T.PlaneGeometry(RIVER_W, RIVER_Z_SPAN+140), riverMat);
  river.rotation.x = -Math.PI/2;
  place(river, RIVER_X0-RIVER_W/2, GROUND_Y+2.6, riverCZ);
  group.add(river);
  registerPick(pickables, 'structure', RIVER_X0-RIVER_W*0.3, GROUND_Y+2.6, riverCZ, RIVER_W*0.7, 1.0, RIVER_Z_SPAN*0.7,
    'ノガト川 Nogat River', '城の西側を流れる川。城は川面から10〜15m高い段丘上に立つ [MH]。舟運により建材や食料を運んだ生命線。');

  /* ---- low-poly trees along the riverbank + fields, scaled up in count
   * (but kept modest) for the much longer complex. ------------------ */
  (function scatterTrees(){
    function trand(a,b){ return a + Math.random()*(b-a); }
    function addTree(x,z,scale,species){
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
      g.position.set(x, GROUND_Y, z);
      group.add(g);
    }
    var zStart = GD_CZ-15, zEnd = LC_Z1+10, zLen = zEnd-zStart;
    var riverbankCount = 22;
    for (var i=0;i<riverbankCount;i++){
      var z = zStart + i*(zLen/riverbankCount);
      addTree(-LC_HX-6+trand(-2,2), z+trand(-5,5), trand(0.85,1.25), i%2);
    }
    var eastCount = 16;
    for (var j=0;j<eastCount;j++){
      var z2 = zStart + j*(zLen/eastCount);
      if (Math.abs(z2-LC_GATE_Z) < 16) continue;
      addTree(LC_HX+12+trand(0,16), z2+trand(-5,5), trand(0.8,1.15), j%2);
    }
    for (var k=0;k<6;k++){
      addTree(trand(-30,30), GD_CZ-24-trand(0,16), trand(0.8,1.1), k%2);
    }
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
    courtyard: [
      { minX:-MC_HX+MC_WD+3, maxX:MC_HX-MC_WD-3, minZ:MC_Z0+4, maxZ:MC_Z1-MC_WD-3 }, // 中城中庭
      { minX:-60, maxX:-25, minZ:LC_Z0+15, maxZ:LC_Z1-15 },  // 低城 西側通路(第1-2列間)
      { minX:-9,  maxX:9,   minZ:LC_Z0+15, maxZ:LC_Z1-15 },  // 低城 中央通路(第2-3列間)
      { minX:25,  maxX:60,  minZ:LC_Z0+15, maxZ:LC_Z1-15 }   // 低城 東側通路(第3-4列間、東門寄り)
    ],
    patrol: [
      [-LC_HX+6,0,LC_Z0+6], [-LC_HX+6,0,LC_Z1-6], [LC_HX-6,0,LC_Z1-6],
      [LC_HX-6,0,LC_GATE_Z+10], [LC_HX-6,0,LC_GATE_Z-10], [LC_HX-6,0,LC_Z0+6],
      [0,0,LC_Z0+6], [0,0,OUTMOAT_Z0+OUTMOAT_W/2], [0,0,MC_Z1-MC_WD-4],
      [0,0,MC_Z0+8], [0,0,DITCH_Z0+DITCH_W/2], [0,0,MC_Z0+8], [0,0,LC_Z0+6]
    ],
    population: { farmers: 26, guards: 9 }
  };

  return { group: group, fadeGroups: fadeGroups, interiorGroup: interiorGroup, info: info,
    pickables: pickables, windowMat: windowMat, waterMats: [riverMat, moatWaterMat], labelGroup: labelGroup, life: life };
}

registerCastle({
  id: 'malbork-plan',
  name: 'Malbork Castle (survey-based)',
  nameJa: 'マルボルク城(実測版)',
  country: 'Poland',
  countryJa: 'ポーランド',
  flag: '🇵🇱',
  year: '1406',
  description: '公開されている実測寸法(medievalheritage.eu等)だけを根拠に組み直した版。高城51x61m・中城80x100m・低城140x270mが南北約470mに連なる実際のスケールを反映し、写真ベース版に欠けていた南西隅の便所塔グダニスコと尖頭アーチ5連の架橋を新たに再現した。',
  build: buildMalborkPlan,
  // footprint is ~2x castles/malbork.js's own scale (Z span roughly
  // -100..+440 from the High Castle origin, ~540m incl. margins) --
  // every distance-based view number below is scaled up from that
  // file's own tuned values (initDist 420->700, zMax 560->980, etc.)
  // rather than picked independently, so the two builds feel like the
  // same camera system at a different zoom level.
  view: { targetY: 26, zMin: 65, zMax: 980, initDist: 700,
    fogNear: 460, fogFar: 2000, shadowExtent: 460, shadowFar: 1500,
    camFar: 4200, panLimit: 360, envScale: 3.4, envLift: -95 }
});
