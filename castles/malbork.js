"use strict";

/* ====================================================================
 * 1.6 Malbork Castle (Zamek w Malborku) procedural builder
 * ====================================================================
 * Returns the same { group, fadeGroups, interiorGroup, info, pickables,
 * windowMat, waterMats, labelGroup, life } contract as buildBodiam() /
 * buildVincennes(). Largest of the three: a ~350 x 170m double-walled
 * Low Castle ring (dry ditch between an 8m inner wall and a 5m outer
 * wall) encircling the Middle Castle's open wing cluster and the High
 * Castle's closed monastic quadrangle, with the Nogat river running
 * along the west edge. Like Vincennes this is a TWO-TIER cutaway: the
 * Low/Middle Castle shell (outer+inner ring walls, the middle-castle
 * wings -- tier 'outer', the same global WALL_START/END + ROOF_START/
 * END bands every castle shares) fades first; the High Castle's own
 * four-wing cloister shell (tier 'inner', the global DONJON_WALL_START/
 * END + DONJON_ROOF_START/END bands Vincennes' donjon also uses) only
 * fades once the outer shell is already gone, revealing the cloister
 * and its four rooms.
 */
function buildMalbork(){
  var group = new T.Group();
  var interiorGroup = new T.Group();
  group.add(interiorGroup);
  var fadeGroups = [];
  var pickables = [];

  function makeFadeGroup(name, dir, isRoof, colorHex, tier){
    var mat = new T.MeshLambertMaterial({ color: colorHex });
    var g = new T.Group();
    g.name = name;
    group.add(g);
    var desc = { group:g, mat:mat, dir:dir, roof: !!isRoof, op:1, name:name, tier: tier || 'outer' };
    fadeGroups.push(desc);
    return desc;
  }
  function norm(x,z){ var l = Math.hypot(x,z)||1; return {x:x/l, z:z/l}; }

  /* ---- palette: red Gothic brick, terracotta roofs, sparing whitewash
   * trim -- deliberately distinct from Bodiam/Vincennes' sandstone and
   * limestone tones. ------------------------------------------------- */
  var BRICK_WALL   = 0x8a4636; // deep red-brick wall -- kept clearly distinct from ROOF_COL (2-tone read)
  var BRICK_WALL_V = 0x7c3c2c; // slight variance for wings/towers
  var BRICK_DARK   = 0x5e2c1e;
  var ROOF_COL     = 0xc1502f; // bright terracotta-orange tile, deliberately warmer/lighter than the wall brick
  var WHITE_TRIM   = 0xe6dcc6; // white stone edging (gable copings, tower lips)
  var GOLD_COL     = 0xc9a227; // small gilt ridge/roof finials
  var WINDOW_COL   = 0x1c150e;
  var FLOOR_COL    = 0x9c8a74;
  var STUB_COL     = 0x776a58;
  var WOOD_COL     = 0x6b4f34;
  var METAL_COL    = 0x2a2925;
  var WATER_COL    = 0x3d5f62; // Nogat river
  var GRASS_COL    = 0x5c7a48;
  var GRASS_COL2   = 0x6c8a52;
  var DITCH_COL    = 0x59703c; // dry-ditch floor (grass, not water)
  var DITCH_MID    = 0x4a5a30;
  var DITCH_EDGE   = 0x384a24;
  var COBBLE_COL   = 0x8f897a; // cloister cross-path paving
  var TREE_TRUNK_COL = 0x5a4530;
  var TREE_LEAF_COL1 = 0x4f7038; // rounded-canopy species
  var TREE_LEAF_COL2 = 0x3f6b3a; // conical-canopy species

  var windowMat  = new T.MeshLambertMaterial({ color: WINDOW_COL });
  var floorMat   = new T.MeshLambertMaterial({ color: FLOOR_COL });
  var stubMat    = new T.MeshLambertMaterial({ color: STUB_COL, side: T.DoubleSide });
  var woodMat    = new T.MeshLambertMaterial({ color: WOOD_COL });
  var metalMat   = new T.MeshLambertMaterial({ color: METAL_COL });
  var grassMat   = new T.MeshLambertMaterial({ color: GRASS_COL });
  var grassMat2  = new T.MeshLambertMaterial({ color: GRASS_COL2 });
  var cobbleMat  = new T.MeshLambertMaterial({ color: COBBLE_COL });
  var trimMat    = new T.MeshLambertMaterial({ color: WHITE_TRIM });
  var goldMat    = new T.MeshLambertMaterial({ color: GOLD_COL });
  var darkWoodMat= new T.MeshLambertMaterial({ color: 0x2a1c14 });
  var stoneDarkMat = new T.MeshLambertMaterial({ color: BRICK_DARK });
  var riverMat   = new T.MeshPhongMaterial({ color: WATER_COL, transparent:true, opacity:0.85, shininess:85, specular:0x9fd4e0 });
  var treeTrunkMat = new T.MeshLambertMaterial({ color: TREE_TRUNK_COL });
  var treeLeafMat1 = new T.MeshLambertMaterial({ color: TREE_LEAF_COL1 });
  var treeLeafMat2 = new T.MeshLambertMaterial({ color: TREE_LEAF_COL2 });

  /* -------------------------------------------------------------- *
   * shared small helpers (each castle keeps its own local copies --
   * see buildBodiam/buildVincennes for the same pattern)
   * -------------------------------------------------------------- */
  function addCrenellations(target, mat, cx, cz, length, ry, topY, thickness, merlonH){
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
  // symmetric gable roof: two mirrored lean slopes (outer eave -> centre
  // ridge) via the same verified rotation math Bodiam's leanToRoof uses,
  // plus a triangular gable-end infill (DoubleSide, orientation-agnostic)
  // at each end of the ridge so wing corners never show a sky-gap.
  function leanSlope(mat, spanAxis, spanA, spanB, outerCoord, innerCoord, outerY, innerY){
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
  function gableRoof(target, mat, axis, cx, cz, spanA, spanB, halfWidth, eaveY, ridgeRise){
    var ridgeY = eaveY + ridgeRise;
    if (axis === 'x'){
      target.add(leanSlope(mat, 'x', spanA, spanB, cz-halfWidth, cz, eaveY, ridgeY));
      target.add(leanSlope(mat, 'x', spanA, spanB, cz+halfWidth, cz, eaveY, ridgeY));
    } else {
      target.add(leanSlope(mat, 'z', spanA, spanB, cx-halfWidth, cx, eaveY, ridgeY));
      target.add(leanSlope(mat, 'z', spanA, spanB, cx+halfWidth, cx, eaveY, ridgeY));
    }
    var shape = new T.Shape();
    shape.moveTo(-halfWidth,0); shape.lineTo(halfWidth,0); shape.lineTo(0,ridgeRise); shape.closePath();
    var geo = new T.ShapeGeometry(shape);
    var endMat = new T.MeshLambertMaterial({ color: mat.color.getHex(), side: T.DoubleSide });
    [spanA, spanB].forEach(function(s){
      var m = new T.Mesh(geo, endMat);
      m.castShadow = true; m.receiveShadow = true;
      // spanA/spanB are absolute world coordinates (same convention as
      // leanSlope above), so `s` is used directly here -- NOT cx+s/cz+s.
      if (axis === 'x'){ m.position.set(s, eaveY, cz); m.rotation.y = Math.PI/2; }
      else { m.position.set(cx, eaveY, s); }
      target.add(m);
    });
  }
  function smallTower(fg, cx, cz, round, r, h, roofH){
    var body = round ? mkCyl(r, r*1.05, h, 12, fg.mat) : mkBox(r*1.8, h, r*1.8, fg.mat);
    place(body, cx, h/2, cz);
    fg.group.add(body);
    var roof = round ? mkCone(r*1.25, roofH, 12, roofCaps.mat) : mkCone(r*1.3, roofH, 4, roofCaps.mat);
    if (!round) roof.rotation.y = Math.PI/4;
    place(roof, cx, h+roofH/2, cz);
    roofCaps.group.add(roof);
  }

  /* -------------------------------------------------------------- *
   * rectangular moat/ground/bailey terrain builder -- identical to (and
   * copied from, per this file's per-castle local-helper convention)
   * buildVincennes' own buildRectMoatSystem: a rectangle isn't covered by
   * the shared buildWaterMoatSystem (square-only, section 0.5), so both
   * large castles keep their own copy of this rect-aware counterpart,
   * built from the same top-level buildUndulatingGround/buildBankRamp.
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

    var collarShape = new T.Shape();
    collarShape.moveTo(-cutHalf,-cutHalf); collarShape.lineTo(cutHalf,-cutHalf);
    collarShape.lineTo(cutHalf,cutHalf); collarShape.lineTo(-cutHalf,cutHalf); collarShape.closePath();
    var collarHole = new T.Path();
    collarHole.moveTo(-moatOHX,-moatOHZ); collarHole.lineTo(-moatOHX,moatOHZ);
    collarHole.lineTo(moatOHX,moatOHZ); collarHole.lineTo(moatOHX,-moatOHZ); collarHole.closePath();
    collarShape.holes.push(collarHole);
    var collarGeo = new T.ShapeGeometry(collarShape);
    collarGeo.rotateX(-Math.PI/2);
    var collar = new T.Mesh(collarGeo, opts.groundMat);
    collar.position.y = groundY; collar.receiveShadow = true;
    g.add(collar);

    var islandShape = new T.Shape();
    islandShape.moveTo(-bailHX,-bailHZ); islandShape.lineTo(bailHX,-bailHZ);
    islandShape.lineTo(bailHX,bailHZ); islandShape.lineTo(-bailHX,bailHZ); islandShape.closePath();
    var islandGeo = new T.ShapeGeometry(islandShape);
    islandGeo.rotateX(-Math.PI/2);
    var island = new T.Mesh(islandGeo, opts.islandMat);
    island.position.y = islandY; island.receiveShadow = true;
    g.add(island);

    var colTop = new T.Color(opts.bankColorTop!=null?opts.bankColorTop:0x9c8a5e);
    var colMid = new T.Color(opts.bankColorMid!=null?opts.bankColorMid:0x6e5c3e);
    var colEdge = new T.Color(opts.bankColorEdge!=null?opts.bankColorEdge:0x332818);

    var bankOuter = buildBankRamp('rect', moatOHX, waterHX, groundY, waterY, colTop, colMid, colEdge, 64, 6, moatOHZ, waterHZ);
    g.add(bankOuter);
    var bankInner = buildBankRamp('rect', bailHX, waterInHX, islandY, waterY, colTop, colMid, colEdge, 64, 6, bailHZ, waterInHZ);
    g.add(bankInner);

    var moatShape = new T.Shape();
    moatShape.moveTo(-waterHX,-waterHZ); moatShape.lineTo(waterHX,-waterHZ);
    moatShape.lineTo(waterHX,waterHZ); moatShape.lineTo(-waterHX,waterHZ); moatShape.closePath();
    var hole = new T.Path();
    hole.moveTo(-waterInHX,-waterInHZ); hole.lineTo(-waterInHX,waterInHZ);
    hole.lineTo(waterInHX,waterInHZ); hole.lineTo(waterInHX,-waterInHZ); hole.closePath();
    moatShape.holes.push(hole);
    var moatGeo = new T.ShapeGeometry(moatShape);
    moatGeo.rotateX(-Math.PI/2);
    var waterMat = new T.MeshPhongMaterial({ color: opts.waterColor||0x2e5b66,
      transparent:true, opacity:opts.waterOpacity!=null?opts.waterOpacity:0.82, shininess:90, specular:0x9fd4e0 });
    var moatWater = new T.Mesh(moatGeo, waterMat);
    moatWater.position.y = waterY;
    g.add(moatWater);

    return { ground:ground, island:island, moatWater:moatWater, waterMat:waterMat,
      waterHalfX:waterHX, waterHalfZ:waterHZ, waterInnerHalfX:waterInHX, waterInnerHalfZ:waterInHZ,
      waterY:waterY, groundY:groundY };
  }

  /* ================================================================
   * LOW CASTLE: double brick ring wall + dry ditch + bridge gate.
   * The ditch/ground/bailey terrain reuses the buildRectMoatSystem copy
   * above with a shallow, opaque "water" plane standing in for a grass-
   * floored dry ditch -- its material is deliberately left OUT of the
   * returned waterMats list so the day/night water-colour hook never
   * touches it.
   * ================================================================ */
  // footprint pulled in ~0.82x from the original 170x350m (task allows
  // shrinking to roughly a 300x200m-scale complex so the double wall reads
  // as hugging the building clusters instead of enclosing empty field);
  // every other Malbork coordinate below is derived from these same
  // constants (or independently rescaled by the same SCALE factor), so
  // the whole complex shrinks together without any part drifting loose.
  var SCALE = 0.82;
  var OUTER_HX = 70, OUTER_HZ = 144;  // outer wall ring, half-extents (140 x 288m)
  var INNER_HX = 54, INNER_HZ = 127;  // inner wall ring == the High/Middle Castle bailey footprint (moat band ~16-17m)
  var OUTER_WT = 1.2, OUTER_WH = 5;
  var INNER_WT = 1.6, INNER_WH = 8;
  var GROUND_Y = -0.6, DITCH_Y = GROUND_Y - 0.55; // shallow dry ditch (grass floor, not water)

  var lowSys = buildRectMoatSystem({
    group: group, groundY: GROUND_Y, waterY: DITCH_Y,
    bailHalfX: INNER_HX, bailHalfZ: INNER_HZ, islandY: 0.02,
    moatOuterHalfX: OUTER_HX, moatOuterHalfZ: OUTER_HZ,
    bankWidthOut: 3.5, bankWidthIn: 2.5,
    groundMat: grassMat, islandMat: grassMat2,
    waterColor: DITCH_COL, waterOpacity: 1,
    bankColorTop: GRASS_COL, bankColorMid: DITCH_MID, bankColorEdge: DITCH_EDGE,
    groundSize: 2400, groundSegs: 96
  });
  lowSys.waterMat.shininess = 4;
  lowSys.waterMat.specular.setHex(0x223318);
  registerPick(pickables, 'structure', 0, DITCH_Y+0.3, -OUTER_HZ+OUTER_HZ*0.55, OUTER_HX*1.7, 1.0, (OUTER_HZ-INNER_HZ)*0.85,
    '乾堀 Dry Moat', '水を張らない草地の空堀。低城の二重城壁を隔てる防御帯として全周をめぐる。');

  var lowWallN = makeFadeGroup('lowOuterN', {x:0,z:-1}, false, BRICK_WALL);
  var lowWallS = makeFadeGroup('lowOuterS', {x:0,z:1},  false, BRICK_WALL);
  var lowWallE = makeFadeGroup('lowOuterE', {x:1,z:0},  false, BRICK_WALL);
  var lowWallW = makeFadeGroup('lowOuterW', {x:-1,z:0}, false, BRICK_WALL);
  var innWallN = makeFadeGroup('lowInnerN', {x:0,z:-1}, false, BRICK_WALL_V);
  var innWallS = makeFadeGroup('lowInnerS', {x:0,z:1},  false, BRICK_WALL_V);
  var innWallE = makeFadeGroup('lowInnerE', {x:1,z:0},  false, BRICK_WALL_V);
  var innWallW = makeFadeGroup('lowInnerW', {x:-1,z:0}, false, BRICK_WALL_V);
  var gateFg   = makeFadeGroup('bridgeGate', {x:0,z:1}, false, BRICK_WALL_V);
  var roofCaps = makeFadeGroup('lowRoofCaps', null, true, ROOF_COL); // outer-tier small-tower + gate roofs

  function ringSide(fg, cx, cz, length, ry, thickness, height, mh){
    var wall = mkBox(length, height, thickness, fg.mat);
    place(wall, cx, height/2, cz, ry);
    fg.group.add(wall);
    addCrenellations(fg.group, fg.mat, cx, cz, length, ry, height, thickness, mh);
    // terracotta coping/cap along the wall-walk, sitting just above the
    // merlons -- both curtain rings are low (outer 5m / inner 8m) so a
    // bare stone top read as unfinished; this gives every low wall run
    // the same warm terracotta cap the roofs use, tying the 2-tone
    // palette together. Goes into roofCaps (a 'roof' fadeGroup) so it
    // fades with the rest of the low-castle roofline on cutaway.
    var cap = mkBox(length+thickness*0.5, 0.32, thickness*1.4, roofCaps.mat);
    place(cap, cx, height+mh+0.16, cz, ry);
    roofCaps.group.add(cap);
  }
  ringSide(lowWallN, 0, -OUTER_HZ, 2*OUTER_HX, 0, OUTER_WT, OUTER_WH, 0.9);
  ringSide(lowWallE, OUTER_HX, 0, 2*OUTER_HZ, -Math.PI/2, OUTER_WT, OUTER_WH, 0.9);
  ringSide(lowWallW, -OUTER_HX, 0, 2*OUTER_HZ, Math.PI/2, OUTER_WT, OUTER_WH, 0.9);
  ringSide(innWallN, 0, -INNER_HZ, 2*INNER_HX, 0, INNER_WT, INNER_WH, 1.2);
  ringSide(innWallE, INNER_HX, 0, 2*INNER_HZ, -Math.PI/2, INNER_WT, INNER_WH, 1.2);
  ringSide(innWallW, -INNER_HX, 0, 2*INNER_HZ, Math.PI/2, INNER_WT, INNER_WH, 1.2);
  // south outer/inner ring sides: split either side of the bridge gate's
  // GATE_X, leaving a real gap (GATE_OPEN_W wide) instead of one solid
  // box -- the gate tower below carves its own through-opening on the
  // same centreline, and a continuous wall panel behind/beside it would
  // still block that opening otherwise. The inner wall has no tower to
  // supply its own lintel, so it gets one built explicitly here.
  var GATE_X = 34, GATE_OPEN_W = 4.0, GATE_OPEN_H = 5.0;
  function splitRingForGate(fg, cz, ry, half, gateX, gateGapW, height, thickness, mh){
    var gh = gateGapW/2;
    var leftLen = (gateX-gh) - (-half), leftCx = (-half + (gateX-gh))/2;
    var rightLen = half - (gateX+gh), rightCx = ((gateX+gh) + half)/2;
    ringSide(fg, leftCx, cz, leftLen, ry, thickness, height, mh);
    ringSide(fg, rightCx, cz, rightLen, ry, thickness, height, mh);
  }
  splitRingForGate(lowWallS, OUTER_HZ, Math.PI, OUTER_HX, GATE_X, GATE_OPEN_W, OUTER_WH, OUTER_WT, 0.9);
  splitRingForGate(innWallS, INNER_HZ, Math.PI, INNER_HX, GATE_X, GATE_OPEN_W, INNER_WH, INNER_WT, 1.2);
  var innGateLintel = mkBox(GATE_OPEN_W, INNER_WH-GATE_OPEN_H, INNER_WT, innWallS.mat);
  place(innGateLintel, GATE_X, GATE_OPEN_H+(INNER_WH-GATE_OPEN_H)/2, INNER_HZ, 0);
  innWallS.group.add(innGateLintel);
  registerPick(pickables, 'structure', 0, (OUTER_WH+INNER_WH)/4, -OUTER_HZ, OUTER_HX*1.6, INNER_WH, OUTER_WT*3,
    '二重城壁 Double Curtain Wall', '内壁(高さ約8m)と外壁(高さ約5m)からなる低城の二重防壁。間を乾いた堀が隔てる。');

  // small towers along the outer ring: 4 corners (round, conical roof) +
  // west-side (riverside) and east-side mid towers (mixed round/square,
  // per spec's "円錐/角錐のテラコッタ屋根")
  [[-OUTER_HX,-OUTER_HZ,lowWallN],[OUTER_HX,-OUTER_HZ,lowWallN],
   [OUTER_HX,OUTER_HZ,lowWallS],[-OUTER_HX,OUTER_HZ,lowWallS]].forEach(function(p){
    smallTower(p[2], p[0], p[1], true, 4.2, 10, 4.5);
  });
  smallTower(lowWallW, -OUTER_HX, -49, true, 3.6, 9, 4.0);
  smallTower(lowWallW, -OUTER_HX,  49, true, 3.6, 9, 4.0);
  smallTower(lowWallE,  OUTER_HX, -66, true, 3.4, 9, 4.2);
  smallTower(lowWallE,  OUTER_HX,  66, true, 3.4, 9, 4.2);

  // Bridge Gate (主入口): single gate tower straddling the outer wall on
  // its south side, east-leaning per spec ("南東に橋門"); the tower body
  // now carves a REAL through-opening (GATE_OPEN_W x GATE_OPEN_H, full
  // tower depth) instead of a door decal, matching the real gap just cut
  // in both the outer and inner ring walls above -- a timber bridge spans
  // the dry ditch between the two, its centreline on the same GATE_X.
  var GATE_W = 10, GATE_D = 8, GATE_H = 24, GATE_ROOF_H = 7.5;
  var gatePillarW = (GATE_W-GATE_OPEN_W)/2;
  [-1,1].forEach(function(side){
    var lx = side*(GATE_OPEN_W/2+gatePillarW/2);
    var pillar = mkBox(gatePillarW, GATE_H, GATE_D, gateFg.mat);
    place(pillar, GATE_X+lx, GATE_H/2, OUTER_HZ, 0);
    gateFg.group.add(pillar);
  });
  var gateOpenLintel = mkBox(GATE_OPEN_W, GATE_H-GATE_OPEN_H, GATE_D, gateFg.mat);
  place(gateOpenLintel, GATE_X, GATE_OPEN_H+(GATE_H-GATE_OPEN_H)/2, OUTER_HZ, 0);
  gateFg.group.add(gateOpenLintel);
  var gateLip = mkBox(GATE_W*1.1, 0.7, GATE_D*1.1, gateFg.mat);
  place(gateLip, GATE_X, GATE_H-0.6, OUTER_HZ, 0);
  gateFg.group.add(gateLip);
  addCrenellations(gateFg.group, gateFg.mat, GATE_X, OUTER_HZ, GATE_W, 0, GATE_H, GATE_D, 1.1);
  var gateRoof = mkCone(GATE_W*0.62, GATE_ROOF_H, 4, roofCaps.mat);
  gateRoof.rotation.y = Math.PI/4;
  place(gateRoof, GATE_X, GATE_H+1.1+GATE_ROOF_H/2, OUTER_HZ);
  roofCaps.group.add(gateRoof);
  // open double doors, swung flat against the opening's own pillars
  // instead of a single closed leaf blocking it -- decorative, kept in
  // interiorGroup (never fades) like the equivalent open doors at
  // Bodiam's gatehouse and Vincennes' two gate towers.
  (function buildOpenGateDoors(){
    var leafLen = GATE_D*0.42, leafH = GATE_OPEN_H*0.94;
    [-1,1].forEach(function(side){
      var lx = side*(GATE_OPEN_W/2-0.08);
      var leaf = mkBox(0.16, leafH, leafLen, woodMat);
      place(leaf, GATE_X+lx, leafH/2+0.05, OUTER_HZ+GATE_D/2-leafLen/2-0.15, 0);
      interiorGroup.add(leaf);
    });
  })();
  (function buildPortcullis(){
    // RAISED into the housing above the opening (small peek below the
    // ceiling, mostly tucked into the solid lintel stone above) so it no
    // longer blocks the passage residents now walk through.
    var pg = new T.Group();
    var pgMat = metalMat.clone();
    var gridH = 2.6, gridY = GATE_OPEN_H - 0.3 + gridH/2;
    for (var bi=-3;bi<=3;bi++) pg.add(place(mkBox(0.08, gridH, 0.08, pgMat), GATE_X+bi*(GATE_OPEN_W/7), gridY, OUTER_HZ));
    for (var bj=0;bj<3;bj++) pg.add(place(mkBox(GATE_OPEN_W*0.9, 0.08, 0.08, pgMat), GATE_X, GATE_OPEN_H-0.3+bj*(gridH/2.2), OUTER_HZ));
    gateFg.group.add(pg);
  })();
  var bridge = mkBox(3.2, 0.32, (OUTER_HZ-INNER_HZ)+2.5, woodMat);
  place(bridge, GATE_X, -0.05, (OUTER_HZ+INNER_HZ)/2);
  group.add(bridge);
  registerPick(pickables, 'structure', GATE_X, GATE_H*0.4, OUTER_HZ, GATE_W*1.7, GATE_H*0.8, GATE_D*1.7,
    '橋門 Bridge Gate', '低城南東に開く主門。乾堀を渡る木橋が外壁のこの塔と内壁の入口を結ぶ。');

  // Nogat river: a wide flat water band along the west edge. Sits well
  // above the field's noise-undulation ceiling (see buildUndulatingGround,
  // section 0) rather than being recessed into it, so no far shore /
  // bank grading is needed -- spec explicitly doesn't require one.
  // RIVER_X0 is pinned so the water's NEAR edge sits a small fixed gap
  // outside the outer wall face (not a fixed offset from OUTER_HX), so a
  // smaller/larger footprint can never let the river drift in far enough
  // to overlap the field/wall the way a flat offset would.
  var RIVER_W = 50, RIVER_GAP = 2;
  var RIVER_X0 = -(OUTER_HX + RIVER_GAP + RIVER_W/2);
  var river = new T.Mesh(new T.PlaneGeometry(RIVER_W, 2*OUTER_HZ+140), riverMat);
  river.rotation.x = -Math.PI/2;
  place(river, RIVER_X0-RIVER_W/2, GROUND_Y+2.6, 0);
  group.add(river);
  registerPick(pickables, 'structure', RIVER_X0-RIVER_W*0.3, GROUND_Y+2.6, 0, RIVER_W*0.7, 1.0, 2*OUTER_HZ*0.7,
    'ノガト川 Nogat River', '城の西側を流れる川。舟運により建材の煉瓦や食料を運び込む生命線だった。');

  // long timber trestle bridge over the Nogat -- piers + plank deck,
  // running from the castle-side bank well out past the far shore (which
  // is intentionally left unmodelled, per spec, and just fades into fog).
  (function buildRiverBridge(){
    var BR_Z = -OUTER_HZ*0.15;
    var BR_X0 = -OUTER_HX - 1;                    // near (castle-side) bank
    var BR_X1 = RIVER_X0 - RIVER_W - 40;           // far past the river, into the fog
    var BR_LEN = BR_X0 - BR_X1;
    var BR_W = 3.4, BR_Y = GROUND_Y + 2.75;
    var deck = mkBox(BR_LEN, 0.28, BR_W, woodMat);
    place(deck, (BR_X0+BR_X1)/2, BR_Y, BR_Z);
    group.add(deck);
    var railH = 0.7;
    [-1,1].forEach(function(side){
      var rail = mkBox(BR_LEN, railH, 0.14, woodMat);
      place(rail, (BR_X0+BR_X1)/2, BR_Y+railH/2+0.14, BR_Z+side*BR_W*0.47);
      group.add(rail);
    });
    var pierGap = 9, pierCount = Math.max(2, Math.floor(BR_LEN/pierGap));
    for (var i=0;i<=pierCount;i++){
      var px = BR_X0 + (BR_X1-BR_X0)*(i/pierCount);
      [-1,1].forEach(function(side){
        var pile = mkCyl(0.22,0.26, 3.6, 8, darkWoodMat);
        place(pile, px, BR_Y-1.9, BR_Z+side*BR_W*0.38);
        group.add(pile);
      });
    }
    registerPick(pickables, 'structure', (BR_X0+BR_X1)/2, BR_Y, BR_Z, Math.min(BR_LEN,60), 3, BR_W*1.6,
      '木橋 Timber Bridge', 'ノガト川に架かる桟橋状の木橋。城と対岸を結ぶ。');
  })();

  // low-poly trees (trunk cylinder + cone-or-sphere canopy, two species)
  // scattered along the riverbank and the field outside the outer wall --
  // never inside the walls, never on the gate approach or the bridge
  // deck's own footprint, per spec. Purely decorative geometry added
  // straight into `group` (always visible, like the river/bridge above),
  // not a fadeGroup.
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
    // riverbank strip, between the outer wall's west face and the water
    for (var i=0;i<9;i++){
      var z = -OUTER_HZ+22 + i*((OUTER_HZ*1.55)/9);
      addTree(-OUTER_HX-4.5+trand(-1.4,1.4), z+trand(-4,4), trand(0.85,1.2), i%2);
    }
    // north field, outside the outer wall
    for (var j=0;j<6;j++){
      var x2 = -OUTER_HX+14 + j*((2*OUTER_HX-28)/5);
      addTree(x2+trand(-4,4), -OUTER_HZ-12-trand(0,14), trand(0.8,1.15), j%2);
    }
    // east field, outside the outer wall
    for (var k=0;k<7;k++){
      var z3 = -OUTER_HZ+20 + k*((2*OUTER_HZ-60)/6);
      addTree(OUTER_HX+10+trand(0,14), z3+trand(-4,4), trand(0.8,1.15), k%2);
    }
    // south field, outside the outer wall -- skip a band around the
    // bridge-gate approach so the entrance stays clear
    for (var m=0;m<6;m++){
      var x4 = -OUTER_HX+16 + m*((2*OUTER_HX-32)/5);
      if (Math.abs(x4-GATE_X) < 14) continue;
      addTree(x4+trand(-4,4), OUTER_HZ+12+trand(0,14), trand(0.8,1.15), m%2);
    }
  })();

  /* ================================================================
   * MIDDLE CASTLE: an L-shaped wing cluster (west wing + north wing)
   * around a large open courtyard, with the Grand Master's Palace as a
   * taller, more decorated block on the west wing's river-facing north
   * end. Tier 'outer' -- fades with the rest of the low-castle shell.
   * ================================================================ */
  var mcWallFg = makeFadeGroup('midWings', {x:-1,z:0}, false, BRICK_WALL);
  var mcRoofFg = makeFadeGroup('midRoofs', null, true, ROOF_COL);
  var mcPalaceFg = makeFadeGroup('midPalace', {x:-1,z:0}, false, BRICK_WALL_V);

  var MC_WX = -46, MC_WD = 10, MC_WH = 15;   // west wing centreline / depth / eave height
  var MC_WZ0 = -93, MC_WZ1 = 44;              // west wing (regular block) Z extent
  var MC_NZ = -113, MC_ND = 10, MC_NH = 15;   // north wing centreline / depth / eave height
  var MC_NX0 = -41, MC_NX1 = 39;              // north wing X extent (trimmed 43->39 so it abuts the east wing below without overlap)
  var MC_EX = 46, MC_ED = 12, MC_EH = 15;     // east wing centreline / depth / eave height -- closes the courtyard's 3rd side
  var MC_EZ0 = -104, MC_EZ1 = 50;             // east wing Z extent

  function wingBlock(fg, cx, cz, w, d, h, windowsAxis){
    var body = mkBox(w, h, d, fg.mat);
    place(body, cx, h/2, cz);
    fg.group.add(body);
    var storeys = Math.max(1, Math.floor(h/4.2));
    for (var s=0;s<storeys;s++){
      var y = 2.6 + s*4.2;
      if (y > h-1.5) break;
      var win1 = mkBox(windowsAxis==='x'? 0.9:0.35, 1.8, windowsAxis==='x'? 0.35:0.9, windowMat);
      place(win1, cx + (windowsAxis==='x'?0:w/2*0.98), y, cz + (windowsAxis==='x'?d/2*0.98:0));
      fg.group.add(win1);
      var win2 = win1.clone();
      win2.position.set(cx - (windowsAxis==='x'?0:w/2*0.98), y, cz - (windowsAxis==='x'?d/2*0.98:0));
      fg.group.add(win2);
    }
  }
  // west wing, south of the palace block -- runs continuously along the
  // river-side (west) inner wall together with the Grand Master's Palace
  wingBlock(mcWallFg, MC_WX, (MC_WZ0+MC_WZ1)/2, MC_WD, MC_WZ1-MC_WZ0, MC_WH, 'z');
  gableRoof(mcRoofFg.group, mcRoofFg.mat, 'z', MC_WX, (MC_WZ0+MC_WZ1)/2, MC_WZ0, MC_WZ1, MC_WD/2, MC_WH, 5.5);
  // north wing (carries the outer-ring cloister approach)
  wingBlock(mcWallFg, (MC_NX0+MC_NX1)/2, MC_NZ, MC_NX1-MC_NX0, MC_ND, MC_NH, 'x');
  gableRoof(mcRoofFg.group, mcRoofFg.mat, 'x', (MC_NX0+MC_NX1)/2, MC_NZ, MC_NX0, MC_NX1, MC_ND/2, MC_NH, 5.5);
  // east wing -- the courtyard's 3rd enclosing side (backed against the
  // inner east wall), previously missing, which left the courtyard reading
  // as bare wall + open lawn instead of a building-ringed quadrangle.
  wingBlock(mcWallFg, MC_EX, (MC_EZ0+MC_EZ1)/2, MC_ED, MC_EZ1-MC_EZ0, MC_EH, 'z');
  gableRoof(mcRoofFg.group, mcRoofFg.mat, 'z', MC_EX, (MC_EZ0+MC_EZ1)/2, MC_EZ0, MC_EZ1, MC_ED/2, MC_EH, 5.5);
  registerPick(pickables, 'structure', (MC_WX+MC_EX)/2, 8, ((MC_WZ1+MC_NZ)/2 + (MC_EZ0+MC_EZ1)/2)/2, MC_EX-MC_WX+6, 15, MC_EZ1-MC_NZ+6,
    '中城 Middle Castle', '高城の北に広がる区画。修道会の食料庫や工房が並ぶ翼棟が、西・北・東の三方から中庭を囲む。');

  // Middle Castle courtyard paths: a cross path + a perimeter loop across
  // the lawn now framed on 3 sides by the west/north/east wings, per spec
  // ("十字/周回の灰色小道"). Always visible (open-air courtyard, no roof
  // over it), so this goes into interiorGroup like the High Castle's own
  // cross-path garden above -- not a fadeGroup.
  (function mcCourtyardPaths(){
    var x0=-38, x1=38, z0=MC_EZ0, z1=MC_EZ1-2, pathW=2.4;
    var cz=(z0+z1)/2;
    var pathNS = mkBox(pathW, 0.25, z1-z0, cobbleMat);
    place(pathNS, 0, 0.14, cz);
    interiorGroup.add(pathNS);
    var pathEW = mkBox(x1-x0, 0.25, pathW, cobbleMat);
    place(pathEW, 0, 0.14, cz);
    interiorGroup.add(pathEW);
    var fx0=x0+3, fx1=x1-3, fz0=z0+3, fz1=z1-3;
    [ [fx1-fx0, pathW, 0, fz0], [fx1-fx0, pathW, 0, fz1] ].forEach(function(s){
      var strip = mkBox(s[0], 0.25, s[1], cobbleMat);
      place(strip, 0, 0.14, s[3]);
      interiorGroup.add(strip);
    });
    [ [pathW, fz1-fz0, fx0, 0], [pathW, fz1-fz0, fx1, 0] ].forEach(function(s){
      var strip = mkBox(s[0], 0.25, s[1], cobbleMat);
      place(strip, s[2], 0.14, (fz0+fz1)/2);
      interiorGroup.add(strip);
    });
  })();

  // Grand Master's Palace: taller decorated block on the west wing's
  // river-facing north end, per spec ("北西端のノガト川に面して")
  var GMP_Z0 = -115, GMP_Z1 = MC_WZ0, GMP_H = 20;
  var gmpBody = mkBox(MC_WD+2, GMP_H, GMP_Z1-GMP_Z0, mcPalaceFg.mat);
  place(gmpBody, MC_WX-1, GMP_H/2, (GMP_Z0+GMP_Z1)/2);
  mcPalaceFg.group.add(gmpBody);
  // tall decorative window column (facing the river, west face) -- per
  // spec "装飾的な縦長窓列"
  for (var gw=0; gw<5; gw++){
    var wz = GMP_Z0 + 3.5 + gw*((GMP_Z1-GMP_Z0-7)/4);
    var win = mkBox(0.4, GMP_H*0.42, 1.1, windowMat);
    place(win, MC_WX-1-(MC_WD+2)/2*0.99, GMP_H*0.55, wz);
    mcPalaceFg.group.add(win);
    var cap = mkCone(0.75, 1.0, 3, windowMat);
    cap.rotation.y = Math.PI/2;
    place(cap, MC_WX-1-(MC_WD+2)/2*1.01, GMP_H*0.55+GMP_H*0.21+0.5, wz);
    mcPalaceFg.group.add(cap);
  }
  // modest whitewash trim band (per spec "白い漆喰帯を控えめに")
  var trimBand = mkBox(MC_WD+2.4, 0.6, GMP_Z1-GMP_Z0, trimMat);
  place(trimBand, MC_WX-1, GMP_H*0.62, (GMP_Z0+GMP_Z1)/2);
  mcPalaceFg.group.add(trimBand);
  gableRoof(mcRoofFg.group, mcRoofFg.mat, 'z', MC_WX-1, (GMP_Z0+GMP_Z1)/2, GMP_Z0, GMP_Z1, (MC_WD+2)/2, GMP_H, 6.5);
  registerPick(pickables, 'structure', MC_WX-1, GMP_H*0.5, (GMP_Z0+GMP_Z1)/2, MC_WD+4, GMP_H, GMP_Z1-GMP_Z0,
    '大マスター宮殿 Grand Master’s Palace', 'ノガト川に面する中城北西端の宮殿。縦長の装飾窓が並ぶ、団長の政庁兼住居。');

  /* ================================================================
   * HIGH CASTLE: 60x60m closed cloister quadrangle around a 30x30m
   * courtyard, four corner turrets, a 40m south-west main tower, and
   * St Mary's Church apse projecting east. Tier 'inner' -- fades only
   * once the low/middle-castle shell above has already faded away,
   * per the same two-tier convention Vincennes' donjon uses.
   * ================================================================ */
  var HC_CX = -21, HC_CZ = 82, HC_HALF = 25, HC_WD = 12, HC_WH = 25, HC_RIDGE = 12;
  var COURT_HALF = HC_HALF - HC_WD; // 13 -> ~26x26m cloister courtyard/garden

  var hcWallN = makeFadeGroup('hcWallN', {x:0,z:-1}, false, BRICK_WALL_V, 'inner');
  var hcWallS = makeFadeGroup('hcWallS', {x:0,z:1},  false, BRICK_WALL_V, 'inner');
  var hcWallE = makeFadeGroup('hcWallE', {x:1,z:0},  false, BRICK_WALL_V, 'inner');
  var hcWallW = makeFadeGroup('hcWallW', {x:-1,z:0}, false, BRICK_WALL_V, 'inner');
  var hcRoof  = makeFadeGroup('hcRoof', null, true, ROOF_COL, 'inner');
  var hcTurr  = makeFadeGroup('hcTurrets', null, true, BRICK_WALL_V, 'inner');
  var hcTower = makeFadeGroup('hcMainTower', norm(-1,1), false, BRICK_WALL_V, 'inner');
  var hcApse  = makeFadeGroup('hcApse', {x:1,z:0}, false, BRICK_WALL_V, 'inner');

  function hcWingWall(fg, cx, cz, length, ry, gap){
    if (!gap){
      var wall = mkBox(length, HC_WH, 1.3, fg.mat);
      place(wall, cx, HC_WH/2, cz, ry);
      fg.group.add(wall);
    } else {
      var seg = (length-gap)/2;
      var co = Math.cos(ry), si = Math.sin(ry);
      [-1,1].forEach(function(sign){
        var lx = sign*(gap/2+seg/2);
        var w2 = mkBox(seg, HC_WH, 1.3, fg.mat);
        place(w2, cx+lx*co, HC_WH/2, cz-lx*si, ry);
        fg.group.add(w2);
      });
      // lintel closes the wall above the passage -- without it the gap
      // would read as a full-height hole clear through to the sky rather
      // than a gatehouse archway.
      var doorH = 4.6;
      var lintel = mkBox(gap, HC_WH-doorH, 1.3, fg.mat);
      place(lintel, cx, doorH+(HC_WH-doorH)/2, cz, ry);
      fg.group.add(lintel);
      var arch = mkBox(gap*0.82, doorH, 0.5, windowMat);
      place(arch, cx, doorH/2, cz, ry);
      interiorGroup.add(arch);
    }
    addCrenellations(fg.group, fg.mat, cx, cz, length, ry, HC_WH, 1.3, 1.1);
    // white-stone stringcourse just under the crenellation -- the "白石の
    // 縁飾り" trim called for on the High Castle's tall gable-ended wings.
    var trim = mkBox(length, 0.28, 1.42, trimMat);
    place(trim, cx, HC_WH-0.55, cz, ry);
    fg.group.add(trim);
  }
  // 3-4 storeys of narrow windows stacked up each wing, per spec's "窓を
  // 縦に3-4列" -- reads as the taller 4-5 storey wing the raised HC_WH
  // (25m) now implies, instead of the single band the old 20m wing had.
  function hcWindows(fg, cx, cz, ry, count, spread, rows){
    rows = rows || 3;
    var co=Math.cos(ry), si=Math.sin(ry);
    for (var r=0;r<rows;r++){
      var frac = 0.22 + r*(0.60/Math.max(1,rows-1));
      for (var i=0;i<count;i++){
        var t = (i/(count-1) - 0.5) * spread;
        var win = mkBox(0.6, 1.9, 0.35, windowMat);
        place(win, cx+t*co, HC_WH*frac, cz-t*si, ry);
        fg.group.add(win);
      }
    }
  }
  // south wing (main tower side) / north wing (with cloister gate) /
  // east wing (church) / west wing
  hcWingWall(hcWallS, HC_CX, HC_CZ+HC_HALF, 2*HC_HALF, Math.PI);
  hcWindows(hcWallS, HC_CX, HC_CZ+HC_HALF, Math.PI, 5, 38, 4);
  hcWingWall(hcWallN, HC_CX, HC_CZ-HC_HALF, 2*HC_HALF, 0, 4.2);
  hcWindows(hcWallN, HC_CX, HC_CZ-HC_HALF, 0, 4, 34, 3);
  hcWingWall(hcWallE, HC_CX+HC_HALF, HC_CZ, 2*HC_HALF, -Math.PI/2);
  hcWindows(hcWallE, HC_CX+HC_HALF, HC_CZ, -Math.PI/2, 5, 38, 4);
  hcWingWall(hcWallW, HC_CX-HC_HALF, HC_CZ, 2*HC_HALF, Math.PI/2);
  hcWindows(hcWallW, HC_CX-HC_HALF, HC_CZ, Math.PI/2, 5, 38, 4);

  // NOTE: gableRoof's spanA/spanB are ABSOLUTE world coordinates (see
  // leanSlope -- midSpan = (spanA+spanB)/2 is used directly as the
  // roof's world position along the ridge axis), not offsets from cx/cz,
  // so every call below adds HC_CX / HC_CZ explicitly.
  gableRoof(hcRoof.group, hcRoof.mat, 'x', HC_CX, HC_CZ+HC_HALF-HC_WD/2, HC_CX-HC_HALF+1, HC_CX+HC_HALF-1, HC_WD/2, HC_WH, HC_RIDGE);
  gableRoof(hcRoof.group, hcRoof.mat, 'x', HC_CX, HC_CZ-HC_HALF+HC_WD/2, HC_CX-HC_HALF+1, HC_CX+HC_HALF-1, HC_WD/2, HC_WH, HC_RIDGE);
  gableRoof(hcRoof.group, hcRoof.mat, 'z', HC_CX+HC_HALF-HC_WD/2, HC_CZ, HC_CZ-HC_HALF+1, HC_CZ+HC_HALF-1, HC_WD/2, HC_WH, HC_RIDGE);
  gableRoof(hcRoof.group, hcRoof.mat, 'z', HC_CX-HC_HALF+HC_WD/2, HC_CZ, HC_CZ-HC_HALF+1, HC_CZ+HC_HALF-1, HC_WD/2, HC_WH, HC_RIDGE);

  // decorative stepped/pinnacled gable (装飾切妻) rising above the south
  // wing's ridge, facing the main-tower / bridge-gate approach -- the
  // single most photographed silhouette at the real castle's cloister.
  (function steppedGable(){
    var fg = hcWallS, gz = HC_CZ+HC_HALF + 0.95, steps = 4;
    var stepH = ((HC_WH+HC_RIDGE) - (HC_WH-2)) / steps + 0.9;
    var baseW = HC_WD*1.55;
    for (var i=0;i<steps;i++){
      var w = baseW*(1 - i*0.2);
      var y = (HC_WH-2) + stepH*i + stepH/2;
      var box = mkBox(w, stepH*0.92, 1.0, fg.mat);
      place(box, HC_CX, y, gz);
      fg.group.add(box);
      var coping = mkBox(w+0.3, 0.24, 1.16, trimMat);
      place(coping, HC_CX, (HC_WH-2)+stepH*(i+1), gz);
      fg.group.add(coping);
    }
    var spireY = (HC_WH-2) + stepH*steps;
    var spire = mkCone(baseW*0.16, 2.6, 4, fg.mat);
    spire.rotation.y = Math.PI/4;
    place(spire, HC_CX, spireY+1.3, gz);
    fg.group.add(spire);
    var finial = mkCyl(0.1, 0.02, 1.0, 6, goldMat);
    place(finial, HC_CX, spireY+2.6+0.5, gz);
    fg.group.add(finial);
  })();

  // four corner pinnacles (小尖塔), each with a small gilt finial spike
  [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function(s){
    var cx = HC_CX+s[0]*(HC_HALF-1.6), cz = HC_CZ+s[1]*(HC_HALF-1.6);
    var t = mkCyl(1.9, 2.0, 8, 10, hcTurr.mat);
    place(t, cx, HC_WH+4, cz);
    hcTurr.group.add(t);
    var cap = mkCone(2.3, 4.5, 10, hcRoof.mat);
    place(cap, cx, HC_WH+8+2.25, cz);
    hcRoof.group.add(cap);
    var finial = mkCyl(0.08, 0.02, 0.8, 6, goldMat);
    place(finial, cx, HC_WH+8+4.5+0.4, cz);
    hcRoof.group.add(finial);
  });

  // south-west main tower: slim ~45m shaft with a FLAT top -- crenellated
  // parapet + four small corner pinnacles instead of the old pointed
  // roof, per spec (a squat pointed cap read too "gate-tower"-like at
  // this height; the flat/crenellated head is Malbork's actual silhouette).
  var MT_CX = HC_CX-HC_HALF, MT_CZ = HC_CZ+HC_HALF, MT_W = 6.5, MT_H = 45;
  var mtBody = mkBox(MT_W, MT_H, MT_W, hcTower.mat);
  place(mtBody, MT_CX, MT_H/2, MT_CZ);
  hcTower.group.add(mtBody);
  var mtLip = mkBox(MT_W*1.14, 0.7, MT_W*1.14, hcTower.mat);
  place(mtLip, MT_CX, MT_H-0.6, MT_CZ);
  hcTower.group.add(mtLip);
  // paired vertical windows on all four faces, 6 storeys
  var MT_FACES = [ {x:MT_W/2*0.99, z:0, ry:0}, {x:-MT_W/2*0.99, z:0, ry:Math.PI},
                    {x:0, z:MT_W/2*0.99, ry:-Math.PI/2}, {x:0, z:-MT_W/2*0.99, ry:Math.PI/2} ];
  MT_FACES.forEach(function(face){
    for (var ms2=0; ms2<6; ms2++){
      var wy2 = 3.4+ms2*6.6;
      [-0.75,0.75].forEach(function(pair){
        var win = mkBox(0.5, 1.9, 0.3, windowMat);
        // pair offset runs along the face's own tangent, not world X/Z
        var tx = face.z !== 0 ? pair : 0, tz = face.x !== 0 ? pair : 0;
        place(win, MT_CX+face.x+tx, wy2, MT_CZ+face.z+tz, face.ry);
        hcTower.group.add(win);
      });
    }
  });
  // flat-top parapet: crenellation ring (all four edges of the flat top,
  // not a cross through the centre) + 4 small corner pinnacles
  var mtEdge = MT_W/2, mtMer = 1.4;
  addCrenellations(hcTower.group, hcTower.mat, MT_CX, MT_CZ-mtEdge, MT_W, 0, MT_H, 1.0, mtMer);
  addCrenellations(hcTower.group, hcTower.mat, MT_CX, MT_CZ+mtEdge, MT_W, Math.PI, MT_H, 1.0, mtMer);
  addCrenellations(hcTower.group, hcTower.mat, MT_CX+mtEdge, MT_CZ, MT_W, -Math.PI/2, MT_H, 1.0, mtMer);
  addCrenellations(hcTower.group, hcTower.mat, MT_CX-mtEdge, MT_CZ, MT_W, Math.PI/2, MT_H, 1.0, mtMer);
  [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function(s){
    var px = MT_CX+s[0]*MT_W*0.42, pz = MT_CZ+s[1]*MT_W*0.42;
    var pin = mkCyl(0.42, 0.5, 3.2, 8, hcTower.mat);
    place(pin, px, MT_H+1.4+1.6, pz);
    hcTower.group.add(pin);
    var pinCap = mkCone(0.55, 1.3, 8, hcRoof.mat);
    place(pinCap, px, MT_H+1.4+3.2+0.65, pz);
    hcRoof.group.add(pinCap);
  });
  registerPick(pickables, 'structure', MT_CX, MT_H*0.42, MT_CZ, MT_W*2.2, MT_H*0.9, MT_W*2.2,
    '主塔 Main Tower', '高城南西隅にそびえる高さ約45mの細身の方形塔。平頂に胸壁(クレネレーション)と四隅の小尖塔を戴く、城内最高所。');

  // St Mary's Church apse: polygonal projection east of the east wing,
  // taller than the wing roofline with a tall Gothic window band, per spec.
  var APSE_CX = HC_CX+HC_HALF+4.6, APSE_CZ = HC_CZ-5, APSE_R = 5, APSE_H = HC_WH+5;
  var apseBody = mkCyl(APSE_R, APSE_R, APSE_H, 6, hcApse.mat);
  apseBody.rotation.y = Math.PI/6;
  place(apseBody, APSE_CX, APSE_H/2, APSE_CZ);
  hcApse.group.add(apseBody);
  var apseTrim = mkBox(APSE_R*2.3, 0.26, APSE_R*2.3, trimMat);
  apseTrim.rotation.y = Math.PI/6;
  place(apseTrim, APSE_CX, APSE_H-0.6, APSE_CZ);
  hcApse.group.add(apseTrim);
  var apseRoof = mkCone(APSE_R*1.1, 5.2, 6, hcRoof.mat);
  apseRoof.rotation.y = Math.PI/6;
  place(apseRoof, APSE_CX, APSE_H+2.6, APSE_CZ);
  hcRoof.group.add(apseRoof);
  for (var af=0; af<4; af++){
    // centred on angle 0 (+X, due east) -- the apse's outward-facing
    // side, away from the wing it projects from; tall narrow lancet
    // windows per spec's "背の高いゴシック窓列"
    var ang = (af-1.5)*0.5;
    var wx = APSE_CX + Math.cos(ang)*APSE_R*0.97, wz = APSE_CZ + Math.sin(ang)*APSE_R*0.97;
    var awin = mkBox(0.5, APSE_H*0.62, 1.3, windowMat);
    place(awin, wx, APSE_H*0.52, wz, -ang);
    hcApse.group.add(awin);
  }
  registerPick(pickables, 'structure', APSE_CX, APSE_H*0.5, APSE_CZ, APSE_R*2.2, APSE_H, APSE_R*2.2,
    '教会後陣 Church Apse', '聖母マリア教会の東端、翼棟より高くそびえる多角形の後陣。背の高いゴシック窓列が特徴。');
  registerPick(pickables, 'structure', HC_CX, HC_WH*0.5, HC_CZ, HC_HALF*2+6, HC_WH+HC_RIDGE, HC_HALF*2+6,
    '高城 High Castle', '騎士団の心臓部。回廊が中庭を囲む四翼の修道院型建築で、教会・参事会室・食堂・団長居室を収めた。');

  /* ---- cloister courtyard: lawn + a cross-shaped cobble path, small
   * well canopy at the crossing -- keeps the cloister/arcade feel of the
   * surrounding wings while reading as a real garden, per spec, rather
   * than a single flat stone slab. ---------------------------------- */
  var hcGrassMat = new T.MeshLambertMaterial({ color: GRASS_COL2 });
  var courtLawn = mkBox(2*COURT_HALF, 0.28, 2*COURT_HALF, hcGrassMat);
  place(courtLawn, HC_CX, -0.16, HC_CZ);
  interiorGroup.add(courtLawn);
  var courtPathW = 2.2;
  var courtPathNS = mkBox(courtPathW, 0.3, 2*COURT_HALF, cobbleMat);
  place(courtPathNS, HC_CX, -0.14, HC_CZ);
  interiorGroup.add(courtPathNS);
  var courtPathEW = mkBox(2*COURT_HALF, 0.3, courtPathW, cobbleMat);
  place(courtPathEW, HC_CX, -0.14, HC_CZ);
  interiorGroup.add(courtPathEW);
  (function well(){
    var wx=HC_CX-3, wz=HC_CZ+2;
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
  })();

  /* ---- four interior rooms (revealed once the inner-tier cutaway
   * fades hcWallN/S/E/W + hcRoof) --------------------------------- */
  function pickRoom(x0,x1,z0,z1,h,name,desc){
    registerPick(pickables, 'room', (x0+x1)/2, h/2, (z0+z1)/2, Math.abs(x1-x0), h, Math.abs(z1-z0), name, desc);
  }
  // St Mary's Church: occupies the east wing + apse
  var churchX0 = HC_CX+HC_HALF-HC_WD, churchX1 = HC_CX+HC_HALF+APSE_R;
  var altar = mkBox(2.4, 1.3, 1.0, stoneDarkMat);
  place(altar, churchX1-3, 0.65, APSE_CZ);
  interiorGroup.add(altar);
  for (var pw=0; pw<3; pw++){
    var pillar = mkCyl(0.35,0.4, HC_WH-0.6, 8, stubMat);
    place(pillar, HC_CX+HC_HALF-HC_WD/2, (HC_WH-0.6)/2, HC_CZ-10+pw*8);
    interiorGroup.add(pillar);
  }
  pickRoom(churchX0, churchX1, HC_CZ-HC_HALF+1, HC_CZ+2, HC_WH-1, '聖母マリア教会 St Mary’s Church',
    '東翼を占める修道会の主聖堂。後陣に祭壇を置く、騎士団国家の精神的中心。');
  // Chapter House: south wing, near the main tower
  var chX0 = HC_CX-HC_HALF+2, chX1 = HC_CX+4, chZ0 = HC_CZ+HC_HALF-HC_WD, chZ1 = HC_CZ+HC_HALF-1;
  var chTable = mkBox(4.2, 0.7, 2.4, woodMat);
  place(chTable, (chX0+chX1)/2, 0.35, (chZ0+chZ1)/2);
  interiorGroup.add(chTable);
  pickRoom(chX0, chX1, chZ0, chZ1, HC_WH-1, '参事会室 Chapter House',
    '南翼に置かれた評議の間。団長と幹部騎士たちがここで会議を開いた。');
  // Refectory: west wing, rib-vault-style column row
  var rfX0 = HC_CX-HC_HALF+1, rfX1 = HC_CX-HC_HALF+HC_WD-1, rfZ0 = HC_CZ-8, rfZ1 = HC_CZ+8;
  for (var rp=0; rp<3; rp++){
    var rpillar = mkCyl(0.32,0.36, HC_WH-0.6, 8, stubMat);
    place(rpillar, (rfX0+rfX1)/2, (HC_WH-0.6)/2, rfZ0+2+rp*6);
    interiorGroup.add(rpillar);
  }
  var rfTable = mkBox(2.0, 0.65, 10, woodMat);
  place(rfTable, (rfX0+rfX1)/2+1.6, 0.32, (rfZ0+rfZ1)/2);
  interiorGroup.add(rfTable);
  pickRoom(rfX0, rfX1, rfZ0, rfZ1, HC_WH-1, '食堂 Refectory',
    '西翼の食堂。リブヴォールト風の柱列が天井を支え、騎士たちが共同で食事をとった。');
  // Grand Master's Chamber: north wing, near the main tower side
  var gmX0 = HC_CX-HC_HALF+2, gmX1 = HC_CX+2, gmZ0 = HC_CZ-HC_HALF+1, gmZ1 = HC_CZ-HC_HALF+HC_WD-2;
  var gmBed = mkBox(2.2, 0.8, 3.4, darkWoodMat);
  place(gmBed, (gmX0+gmX1)/2, 0.4, (gmZ0+gmZ1)/2);
  interiorGroup.add(gmBed);
  pickRoom(gmX0, gmX1, gmZ0, gmZ1, HC_WH-1, '大マスター居室 Grand Master’s Chamber',
    '北翼に残る、団長のかつての私室。後にノガト川沿いの新宮殿へ機能が移った。');

  /* ================================================================
   * info payload + always-on labels + resident life data
   * ================================================================ */
  var info = { rooms: [
    { name:'聖母マリア教会 (St Mary’s Church)', desc:'東翼+後陣。騎士団国家の精神的中心。' },
    { name:'参事会室 (Chapter House)', desc:'南翼。団長と幹部騎士の評議の間。' },
    { name:'食堂 (Refectory)', desc:'西翼。リブヴォールト風の柱列。' },
    { name:'大マスター居室', desc:'北翼。団長のかつての私室。' }
  ] };
  var labelGroup = buildLabelGroup(group, pickables);

  /* ---- resident life data: bridge gate is the sole in/out point;
   * farmers wander the Middle + Low Castle open ground (never the High
   * Castle cloister -- per spec that courtyard is guards-only); guards
   * patrol a loop that hugs the inside of the inner wall (the space
   * "between" the double wall) and detours through the cloister gate
   * into the High Castle courtyard, all on the y=0 bailey surface so
   * nothing floats once the low/middle-castle shell fades. ---------- */
  // gate.path: 内壁の開口(内側口)→ 乾堀を渡る橋の中心線 → 外壁の橋門塔の
  // 開口(外側口)まで、実際に貫通した4点の折れ線。toGate/through がこの
  // 経路を必ず順に経由してから outside の消失フェードに入る(section 6.5)。
  var life = {
    gates: [ { path: [
        {x:GATE_X, z:INNER_HZ-INNER_WT/2},
        {x:GATE_X, z:INNER_HZ+INNER_WT/2},
        {x:GATE_X, z:OUTER_HZ-GATE_D/2},
        {x:GATE_X, z:OUTER_HZ+GATE_D/2}
      ], outDir:{x:0,z:1}, vanishDist: ((OUTER_HZ-INNER_HZ)+26) - GATE_D/2 } ],
    courtyard: [
      { minX:-38, maxX:38, minZ:-104, maxZ:48 },   // 中城中庭(西・北・東の三翼に囲まれた芝)
      { minX:15,  maxX:48, minZ:60,   maxZ:122 }   // 高城の東〜南に開けた区画
    ],
    // clockwise loop hugging the inside of the (now tighter) inner wall,
    // rerouted along the WEST face of the new east wing (rather than
    // between the wing and the outer inner-wall, too narrow a gap for a
    // walk cycle) with an out-and-back spur through the High Castle's
    // north cloister gate (exactly HC_CX, straight through the 4.2m gap
    // built into hcWallN) into the courtyard centre and back -- the one
    // place farmers never go, guards always do.
    patrol: [
      [37,0,-103], [37,0,52], [45,0,115], [GATE_X,0,121], [GATE_X,0,INNER_HZ-4],
      [29,0,52], [HC_CX,0,52], [HC_CX,0,HC_CZ], [HC_CX,0,52],
      [-38,0,49], [-38,0,-103]
    ],
    population: { farmers: 25, guards: 9 }
  };

  return { group: group, fadeGroups: fadeGroups, interiorGroup: interiorGroup, info: info,
    pickables: pickables, windowMat: windowMat, waterMats: [riverMat], labelGroup: labelGroup, life: life };
}

registerCastle({
  id: 'malbork',
  name: 'Malbork Castle',
  nameJa: 'マルボルク城',
  country: 'Poland',
  countryJa: 'ポーランド',
  flag: '🇵🇱',
  year: '1406',
  description: 'チュートン騎士団が築いた世界最大級のレンガ造城塞。高城・中城・低城の三重構造と1万人を収容した威容を誇る、騎士修道会国家の首都。',
  build: buildMalbork,
  // ~288x140m double-walled outer bailey (tightened from an earlier
  // 350x170m pass so the double wall reads as hugging the building
  // clusters), with a taller High Castle (25m wings, 45m main tower)
  // than before -- view tuning pulled in a little from that earlier
  // pass to match, but still starts from Vincennes' own numbers since
  // Malbork remains the tallest/densest of the three.
  view: { targetY: 20, zMin: 55, zMax: 560, initDist: 420,
    fogNear: 280, fogFar: 1150, shadowExtent: 230, shadowFar: 860,
    camFar: 2400, panLimit: 200, envScale: 2.1, envLift: -55 }
});
