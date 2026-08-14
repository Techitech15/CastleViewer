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

  /* ---- palette : Sussex sandstone, warm ochre to grey ------------- */
  var STONE_WALL   = 0xc7a97c;
  var STONE_WALL_V = 0xbfa176; // slight variance for towers
  var STONE_DARK   = 0x9c8564;
  var ROOF_COL     = 0x5b544a;
  var TIMBER_COL   = 0x5b4530;
  var WINDOW_COL   = 0x1c150e;
  var FLOOR_COL    = 0xa89a80;
  var STUB_COL     = 0x7c6c50;
  var WOOD_COL     = 0x6b4f34;
  var METAL_COL    = 0x2a2925;
  var WATER_COL    = 0x2e5b66;
  var GRASS_COL    = 0x5c7a48;
  var GRASS_COL2   = 0x6c8a52;
  var BANK_COL     = 0x8a7a58;
  var BANK_MID_COL = 0x62543a; // bank ramp, mid-slope
  var BANK_EDGE_COL= 0x2f2617; // bank ramp, wet mud right at the waterline
  var TILE_COL     = 0x7a5240;
  var COURT_GRASS_COL = 0x6a8d4f; // central lawn, kept distinct from the wing stone floors

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
  var bankMat   = new T.MeshLambertMaterial({ color: BANK_COL });
  var wellMat   = new T.MeshBasicMaterial({ color: 0x2e6a7a });

  /* ---- footprint constants (metres) -------------------------------- */
  var OW = 16.5;      // outer curtain wall half-extent (33m side)
  var WT = 1.6;        // wall thickness
  var WH = 10.6;       // wall height to the wall-walk
  var MER = 1.3;        // merlon height

  var CORNER_R = 4.6, CORNER_H = 17.6, CORNER_ROOF_H = 2.7;
  var MID_W = 7.2, MID_PROJ = 4.2, MID_H = 13.6, MID_ROOF_H = 2.3;
  var GATE_W = 6.3, GATE_PROJ = 4.8, GATE_H = 15.4, GATE_ROOF_H = 2.5, GATE_GAP = 4.6;

  var INNER = OW - WT; // inner wall face

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
  var roofCaps = makeFadeGroup('roofCaps', null, true, ROOF_COL); // conical tower roofs (no direction test)

  function norm(x,z){ var l = Math.hypot(x,z)||1; return {x:x/l, z:z/l}; }

  /* -------------------------------------------------------------- *
   * curtain walls with crenellations
   * -------------------------------------------------------------- */
  function addCrenellations(target, mat, cx, cz, length, ry, topY, thickness){
    var merlonW = 1.15, gapW = 1.05, mt = thickness*0.72;
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
  function addWindows(target, mat, cx, cz, length, ry, midY, thickness, windows){
    var co = Math.cos(ry), si = Math.sin(ry);
    (windows||[]).forEach(function(w){
      var win = mkBox(w.w, w.h, thickness*1.05, mat);
      var wx = cx + w.x*co, wz = cz - w.x*si;
      place(win, wx, midY + (w.dy||0), wz, ry);
      target.add(win);
    });
  }
  function buildStraightWall(fg, cx, cz, length, ry, windows){
    var wall = mkBox(length, WH, WT, fg.mat);
    place(wall, cx, WH/2, cz, ry);
    fg.group.add(wall);
    addCrenellations(fg.group, fg.mat, cx, cz, length, ry, WH, WT);
    if (windows) addWindows(fg.group, windowMat, cx, cz, length, ry, WH*0.62, WT, windows);
  }

  // North wall: split either side of the gatehouse gap
  var halfGate = GATE_GAP/2 + GATE_W; // where the solid wall resumes past the twin towers
  var nSegLen = OW - halfGate;
  buildStraightWall(wallN, -(halfGate + nSegLen/2), -OW, nSegLen, 0, [{x:-nSegLen*0.25,w:1.5,h:2.6,dy:1.0},{x:nSegLen*0.15,w:1.3,h:2.2,dy:1.0}]);
  buildStraightWall(wallN,  (halfGate + nSegLen/2), -OW, nSegLen, 0, [{x:nSegLen*0.25,w:1.5,h:2.6,dy:1.0},{x:-nSegLen*0.15,w:1.3,h:2.2,dy:1.0}]);

  // South wall: continuous, postern tower sits proud of it, plus door slot
  buildStraightWall(wallS, 0, OW, 2*OW, Math.PI, [{x:-9.5,w:2.2,h:3.4,dy:1.4},{x:9.5,w:2.2,h:3.4,dy:1.4}]);

  // East wall: has the chapel bulge (built in courtyard section) + windows
  buildStraightWall(wallE, OW, 0, 2*OW, -Math.PI/2, [
    {x:-8.0,w:1.6,h:3.2,dy:1.2},{x:-3.0,w:1.6,h:3.2,dy:1.2},
    {x:3.0,w:1.6,h:3.4,dy:1.2},{x:8.0,w:1.8,h:3.6,dy:1.0}
  ]);
  // chapel bulge: curtain wall projects 2.7m toward the moat here
  (function(){
    var bulgeCz = -OW*0.32, bulgeSpan = 6.4, bulgeProj = 2.7;
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
    var shaft = mkCyl(CORNER_R, CORNER_R*1.06, CORNER_H, 16, fg.mat);
    place(shaft, cx, CORNER_H/2, cz);
    fg.group.add(shaft);
    var plinth = mkCyl(CORNER_R*1.1, CORNER_R*1.22, 1.2, 16, fg.mat);
    place(plinth, cx, 0.6, cz);
    fg.group.add(plinth);
    var n = 14;
    for (var i=0;i<n;i+=2){
      var a = (i/n)*Math.PI*2;
      var m = mkBox(CORNER_R*0.32, MER, CORNER_R*0.32, fg.mat);
      place(m, cx+Math.cos(a)*CORNER_R, CORNER_H+MER/2, cz+Math.sin(a)*CORNER_R, -a);
      fg.group.add(m);
    }
    // arrow-loop windows, 3 storeys
    for (var s=0;s<3;s++){
      for (var k=0;k<4;k++){
        var ang = k*Math.PI/2 + Math.PI/4;
        var wm = mkBox(0.4, 1.6, 0.5, windowMat);
        place(wm, cx+Math.cos(ang)*CORNER_R*0.98, 3.2+s*4.6, cz+Math.sin(ang)*CORNER_R*0.98, -ang);
        fg.group.add(wm);
      }
    }
    var roof = mkCone(CORNER_R*1.18, CORNER_ROOF_H, 16, roofCaps.mat);
    place(roof, cx, CORNER_H+MER+CORNER_ROOF_H/2, cz);
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
    addCrenellations(fg.group, fg.mat, cx, cz, w, ry, h, proj);
    var roof = mkCone(Math.max(w,proj)*0.72, roofH, 4, roofCaps.mat);
    roof.rotation.y = Math.PI/4 + ry;
    place(roof, cx, h+MER+roofH/2, cz);
    roofCaps.group.add(roof);
    if (opts.window){
      var win = mkBox(1.6, 2.8, 0.35, windowMat);
      var dz = opts.window.outward ? proj/2 : 0;
      var co=Math.cos(ry), si=Math.sin(ry);
      place(win, cx+dz*si, h*0.5, cz+dz*co, ry);
      fg.group.add(win);
    }
  }
  // south postern tower: proud of south wall, drawbridge + machicolation implied by a lip
  buildMidTower(tS, 0, OW+MID_PROJ/2-0.4, Math.PI, {window:{outward:true}});
  var posternLip = mkBox(MID_W*0.9, 0.5, 0.9, tS.mat);
  place(posternLip, 0, MID_H+0.2, OW+MID_PROJ-0.3, Math.PI);
  tS.group.add(posternLip);
  registerPick(pickables, 'structure', 0, MID_H/2, OW+MID_PROJ/2-0.4, MID_W*1.5, MID_H, MID_PROJ*2.2,
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
    // machicolated lip near top (jutting course over the gate)
    var lip = mkBox(GATE_W*1.08, 0.6, GATE_PROJ*1.1, fg.mat);
    place(lip, cx, GATE_H-0.5, cz, 0);
    fg.group.add(lip);
    addCrenellations(fg.group, fg.mat, cx, cz, GATE_W, 0, GATE_H, GATE_PROJ);
    var roof = mkCone(GATE_W*0.62, GATE_ROOF_H, 4, roofCaps.mat);
    roof.rotation.y = Math.PI/4;
    place(roof, cx, GATE_H+MER+GATE_ROOF_H/2, cz);
    roofCaps.group.add(roof);
    for (var s=0;s<3;s++){
      var wm = mkBox(0.5,1.6,0.4, windowMat);
      place(wm, cx, 3.4+s*4.2, cz-GATE_PROJ/2+0.02, 0);
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
  var lintel = mkBox(GATE_GAP+1.2, 1.4, GATE_PROJ*0.9, tG1.mat);
  place(lintel, 0, GATE_H*0.62, gateCz, 0);
  tG1.group.add(lintel);
  (function buildPortcullis(){
    var pg = new T.Group();
    var barW = 0.12, gh = GATE_H*0.5, gw = GATE_GAP*0.72;
    var RAISE = GATE_H - gh - 1.2; // tucks the grid up near the lintel/roof, clear of the passage below
    for (var i=-3;i<=3;i++){
      pg.add(place(mkBox(barW, gh, barW, metalMat), i*(gw/6), gh/2+0.3+RAISE, gateCz+GATE_PROJ*0.32));
    }
    for (var j=0;j<4;j++){
      pg.add(place(mkBox(gw, barW, barW, metalMat), 0, 0.6+j*(gh/3.2)+RAISE, gateCz+GATE_PROJ*0.32));
    }
    tG1.group.add(pg);
  })();
  // gate doors, modelled OPEN: two leaves swung flat against each tower's
  // inner reveal (instead of one closed panel spanning the whole gap) so
  // the passage between the twin towers reads as a real walk-through
  // opening, matching the already-open GATE_GAP in wallN (section 1).
  (function buildOpenGateDoors(){
    var leafH = GATE_H*0.42, leafLen = GATE_GAP*0.46, leafY = GATE_H*0.21;
    var leafZ = gateCz + GATE_PROJ*0.44;
    [-1,1].forEach(function(side){
      var leaf = mkBox(0.14, leafH, leafLen, woodMat);
      place(leaf, side*(GATE_GAP/2-0.07), leafY, leafZ - leafLen/2, 0);
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
  var ROOM_DEPTH = 7.0;
  var COURT_HALF = INNER - ROOM_DEPTH;   // half-extent of the central lawn
  var WING_FLOOR_Y = 0.16;               // top surface of the wing stone floors

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

  var eaveH = WH - 0.35, ridgeInH = WH - 3.1;
  var INNER_N = -INNER, RIDGE_N = -(INNER-ROOM_DEPTH); // north-side coords are negative Z
  var INNER_W = -INNER, RIDGE_W = -(INNER-ROOM_DEPTH); // west-side coords are negative X
  // South wing roof (Great Hall / pantry / kitchen) -- outer edge at +Z (wall), inner at smaller +Z
  roofS.group.add(leanToRoof(roofS.mat, 'x', -10.6, 10.6, INNER, INNER-ROOM_DEPTH, eaveH, ridgeInH));
  // East wing roof (chapel / lord's apartments) -- outer edge at +X (wall), inner at smaller +X
  roofE.group.add(leanToRoof(roofE.mat, 'z', -10.6, 10.6, INNER, INNER-ROOM_DEPTH, eaveH, ridgeInH));
  // West wing roof (retainers' hall) -- outer edge at -X (wall), inner toward courtyard
  roofW.group.add(leanToRoof(roofW.mat, 'z', -10.6, 10.6, INNER_W, RIDGE_W, eaveH, ridgeInH));
  // North wing roof (stores / stable, either side of the gate passage) -- outer edge at -Z
  roofN.group.add(leanToRoof(roofN.mat, 'x', -10.6, -halfGate+0.4, INNER_N, RIDGE_N, eaveH, ridgeInH));
  roofN.group.add(leanToRoof(roofN.mat, 'x', halfGate-0.4, 10.6, INNER_N, RIDGE_N, eaveH, ridgeInH));

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
  chimney(6.4, INNER-1.5, WH+2.6, roofS.group, roofS.mat);   // great hall
  chimney(-9.0, INNER-1.2, WH+2.4, roofS.group, roofS.mat);  // kitchen
  chimney(INNER-1.4, 8.0, WH+2.4, roofE.group, roofE.mat);   // lord's apartments
  chimney(-OW+2.6, -OW+2.6, CORNER_H+2.6, tNW.group, tNW.mat); // NW tower

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

  // ---- South wing: Great Hall (east), screens passage, kitchen (west)
  var hallX0=-0.4, hallX1=10.4, wingZ0=INNER-ROOM_DEPTH, wingZ1=INNER;
  facadeStub(0, COURT_HALF, 2*INNER, 0);                        // courtyard-facing corridor line
  partitionWall(-INNER+0.3, (wingZ0+wingZ1)/2, ROOM_DEPTH, Math.PI/2); // west end-cap (near SW tower)
  partitionWall( INNER-0.3, (wingZ0+wingZ1)/2, ROOM_DEPTH, Math.PI/2); // east end-cap (near SE tower)
  stub(-2.0, (wingZ0+wingZ1)/2, ROOM_DEPTH, Math.PI/2); // divides hall / passage
  stub(-3.6, (wingZ0+wingZ1)/2, ROOM_DEPTH, Math.PI/2); // divides passage / kitchen
  var dais = furnitureBox(8.6, 0, (wingZ0+wingZ1)/2, 3.0, 0.4, 5.4, woodMat);
  furnitureBox(3.4, 0, (wingZ0+wingZ1)/2-0.6, 4.4, 0.7, 1.0, woodMat);
  furnitureBox(0.6, 0, (wingZ0+wingZ1)/2+0.6, 3.4, 0.7, 0.9, woodMat);
  var hearthHall = furnitureBox(8.2, 0, wingZ1-0.35, 2.2, 1.1, 0.5, new T.MeshLambertMaterial({color:0x2a1c14}));
  var hearthGlow = new T.PointLight(0xff7a33, 1.1, 6, 2);
  hearthGlow.position.set(8.2, WING_FLOOR_Y+1.0, wingZ1-0.7);
  interiorGroup.add(hearthGlow);
  pickRoom(-2.0, INNER-0.3, wingZ0, wingZ1, 6.0, '大広間 Great Hall',
    '領主一家が食事した、幅7m・奥行12mの2階分吹き抜けの広間。東端に領主の台座(ディス)があった。');
  pickRoom(-3.6, -2.0, wingZ0, wingZ1, 4.0, 'スクリーンズパッセージ Screens Passage',
    '大広間と厨房を仕切る配膳通路。奥にパントリーとバトリーが続く。');
  furnitureBox(-7.4, 0, wingZ0+0.9, 2.6, 1.1, 0.5, new T.MeshLambertMaterial({color:0x2a1c14}));
  furnitureBox(-7.4, 0, wingZ1-0.9, 2.6, 1.1, 0.5, new T.MeshLambertMaterial({color:0x2a1c14}));
  furnitureBox(-8.0, 0, (wingZ0+wingZ1)/2, 3.2, 0.75, 1.2, woodMat);
  pickRoom(-INNER+0.3, -3.6, wingZ0, wingZ1, 4.0, '厨房 Kitchen',
    '南棟西端。南北両壁に大きな炉を備えた調理場。');

  // ---- East wing: chapel (north), lord's/lady's apartments (south)
  var eWingX0=INNER-ROOM_DEPTH, eWingX1=INNER, eZ0=-10.4, eZ1=10.4;
  facadeStub(COURT_HALF, 0, 2*INNER, Math.PI/2);                        // courtyard-facing corridor line
  partitionWall((eWingX0+eWingX1)/2, -INNER+0.3, ROOM_DEPTH, 0);         // north end-cap (near NE tower)
  partitionWall((eWingX0+eWingX1)/2,  INNER-0.3, ROOM_DEPTH, 0);         // south end-cap (near SE tower)
  stub((eWingX0+eWingX1)/2, -0.6, ROOM_DEPTH, 0);
  // chapel floor: two-colour Flemish-tile checker (canvas texture, repeat-tiled)
  var chapelCheckerTex = makeCheckerTexture('#8f5a3c', '#ddd0a8', 6);
  var chapelFloorMat = new T.MeshLambertMaterial({ map: chapelCheckerTex });
  var chapelFloor = mkBox(ROOM_DEPTH-0.6, 0.08, 9.0, chapelFloorMat);
  place(chapelFloor, (eWingX0+eWingX1)/2, WING_FLOOR_Y+0.04, -5.0);
  interiorGroup.add(chapelFloor);
  furnitureBox(eWingX1-0.8, 0, -8.6, 0.9, 1.1, 1.6, new T.MeshLambertMaterial({color:0xd8d0b8}));
  furnitureBox(eWingX0+1.3, 0, -6.0, 2.2, 0.6, 0.7, woodMat);
  furnitureBox(eWingX0+1.3, 0, -4.0, 2.2, 0.6, 0.7, woodMat);
  furnitureBox(eWingX0+1.3, 0, -2.0, 2.2, 0.6, 0.7, woodMat);
  pickRoom(eWingX0, eWingX1, -INNER+0.3, -0.6, 4.5, '礼拝堂 Chapel',
    '東棟北寄り。フランドル風タイルの床。堀側の東壁はここで張り出している。');
  furnitureBox(eWingX0+1.8, 0, 4.0, 2.6, 0.7, 3.6, woodMat);
  furnitureBox(eWingX1-0.7, 0, 8.6, 2.0, 1.1, 0.5, new T.MeshLambertMaterial({color:0x2a1c14}));
  furnitureBox(eWingX0+0.9, 0, 8.4, 1.0, 0.8, 0.6, new T.MeshLambertMaterial({color:0x3a2a1a}));
  pickRoom(eWingX0, eWingX1, -0.6, INNER-0.3, 4.5, "領主居室 Lord's / Lady's Apartments",
    '東棟南寄り。東向きの窓と各階の暖炉を備えた領主一家の私室。');

  // ---- West wing: retainers' hall (blind outer wall, no hearth)
  var wWingX0=-INNER, wWingX1=-(INNER-ROOM_DEPTH), wZ0=-10.4, wZ1=10.4;
  facadeStub(-COURT_HALF, 0, 2*INNER, Math.PI/2);                       // courtyard-facing corridor line
  partitionWall((wWingX0+wWingX1)/2, -INNER+0.3, ROOM_DEPTH, 0);        // north end-cap (near NW tower)
  partitionWall((wWingX0+wWingX1)/2,  INNER-0.3, ROOM_DEPTH, 0);        // south end-cap (near SW tower)
  partitionWall((wWingX0+wWingX1)/2, 6.3, ROOM_DEPTH, 0);               // divides hall / servants' kitchen
  furnitureBox((wWingX0+wWingX1)/2, 0, -5.0, 5.0, 0.7, 1.0, woodMat);
  furnitureBox((wWingX0+wWingX1)/2, 0, 0.0, 5.0, 0.7, 1.0, woodMat);
  furnitureBox((wWingX0+wWingX1)/2, 0, 5.0, 5.0, 0.7, 1.0, woodMat);
  pickRoom(wWingX0, wWingX1, -INNER+0.3, 6.3, 4.0, "従者ホール Retainers' Hall",
    '西棟。外壁側には窓も暖炉もない、使用人たちの広間。');
  furnitureBox(wWingX1-1.0, 0, 8.0, 1.6, 0.9, 1.6, woodMat); // small servants' kitchen corner
  pickRoom(wWingX0, wWingX1, 6.3, INNER-0.3, 3.5, "従者厨房 Servants' Kitchen",
    '従者ホール南端の小さな調理場。');

  // ---- North wing: stores (east of gate) & stable (west of gate)
  var nWingZ0=-INNER, nWingZ1=-(INNER-ROOM_DEPTH);
  facadeStub(0, -COURT_HALF, 2*INNER, 0);                               // courtyard-facing corridor line
  partitionWall(-INNER+0.3, (nWingZ0+nWingZ1)/2, ROOM_DEPTH, Math.PI/2); // west end-cap (near NW tower)
  partitionWall( INNER-0.3, (nWingZ0+nWingZ1)/2, ROOM_DEPTH, Math.PI/2); // east end-cap (near NE tower)
  partitionWall(0, (nWingZ0+nWingZ1)/2, ROOM_DEPTH, Math.PI/2);          // divides stores / stable, centred on the gate passage
  for (var b=0;b<3;b++){
    furnitureBox(3.0+b*2.0, 0, (nWingZ0+nWingZ1)/2, 1.0, 1.2, 1.0, woodMat);
  }
  pickRoom(0, INNER-0.3, nWingZ0, nWingZ1, 3.5, '倉庫・宿舎 Stores',
    '北棟東側、ゲートハウスの東隣に位置する倉庫兼宿舎。');
  furnitureBox(-6.5, 0, (nWingZ0+nWingZ1)/2, 3.4, 0.5, 1.0, new T.MeshLambertMaterial({color:0x4a3a1e}));
  furnitureBox(-4.0, 0, (nWingZ0+nWingZ1)/2, 0.6, 0.9, 0.6, new T.MeshLambertMaterial({color:0xc8b878}));
  pickRoom(-INNER+0.3, 0, nWingZ0, nWingZ1, 3.5, '厩舎 Stable',
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
  var ISLAND_HALF = OW + 3.2;
  var MOAT_WIDTH = 27;
  var MOAT_OUTER = ISLAND_HALF + MOAT_WIDTH;
  var GROUND_Y = -0.55;
  var WATER_Y = GROUND_Y - 1.0; // 1.0m below the field -- within the 0.8-1.2m spec

  var moatSys = buildWaterMoatSystem({
    group: group,
    groundY: GROUND_Y, waterY: WATER_Y,
    islandHalf: ISLAND_HALF, islandY: 0.02,
    moatOuterHalf: MOAT_OUTER,
    bankWidthOut: 4.2, bankWidthIn: 3.0,
    groundMat: grassMat, islandMat: grassMat2,
    waterColor: WATER_COL,
    bankColorTop: BANK_COL, bankColorMid: BANK_MID_COL, bankColorEdge: BANK_EDGE_COL
  });
  var waterMat = moatSys.waterMat;

  // north approach: bank -> timber bridge -> octagon island -> drawbridge -> gatehouse
  var octR = 3.3, octZ = -(ISLAND_HALF + MOAT_WIDTH*0.42);
  var oct = new T.Mesh(new T.CircleGeometry(octR, 8), bankMat);
  oct.rotation.x = -Math.PI/2; oct.rotation.y = Math.PI/8;
  place(oct, 0, 0.02, octZ);
  group.add(oct);
  // the octagon platform also meets the water on a slope, not a hard disc
  // edge, using the same vertex-coloured ramp technique as the main banks
  var octSkirt = buildCircularSkirt(0, octZ, octR, octR+1.8, 0.02, WATER_Y,
    new T.Color(BANK_COL), new T.Color(BANK_MID_COL), new T.Color(BANK_EDGE_COL));
  group.add(octSkirt);

  var b1z0 = -MOAT_OUTER+1.0, b1z1 = octZ-octR;
  var bridge1 = mkBox(2.6, 0.35, Math.abs(b1z1-b1z0), woodMat);
  place(bridge1, 0, -0.05, (b1z0+b1z1)/2);
  group.add(bridge1);
  var b2z0 = octZ+octR, b2z1 = -(OW+GATE_PROJ-0.6);
  var bridge2 = mkBox(3.4, 0.3, Math.abs(b2z1-b2z0), woodMat);
  place(bridge2, 0, -0.02, (b2z0+b2z1)/2);
  group.add(bridge2);

  // south approach: straight bridge from bank to postern tower
  var s0 = MOAT_OUTER-1.0, s1 = OW+MID_PROJ-0.4;
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

  /* -------------------------------------------------------------- *
   * info payload (room list metadata; not rendered as a standalone
   * legend panel -- room names now surface via the always-on label
   * toggle and the hover tooltip, both driven off `pickables` below)
   * -------------------------------------------------------------- */
  var info = {
    rooms: [
      { name:'大広間 (Great Hall)', desc:'南棟東側。2階分の吹き抜け、東端に領主の台座。' },
      { name:'スクリーンズパッセージ', desc:'大広間と厨房を隔てる通路、配膳室を兼ねる。' },
      { name:'厨房 (Kitchen)', desc:'南棟西端。南北両壁に大きな炉。' },
      { name:'礼拝堂 (Chapel)', desc:'東棟北寄り。フランドルタイルの床、2階に領主用オラトリー。' },
      { name:"領主居室 (Lord's/Lady's Apartments)", desc:'東棟南寄り。東向きの窓、各階に暖炉。' },
      { name:"従者ホール (Retainers' Hall)", desc:'西棟。外壁側は窓なし、暖炉なし。' },
      { name:'倉庫・宿舎', desc:'北棟東側、ゲートハウスの東隣。' },
      { name:'厩舎 (Stable)', desc:'北棟西側、ゲートハウスの西隣。' },
      { name:'井戸 (Well)', desc:'南西円塔のたもと、南棟の石床上。' }
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
    courtyard: [ { minX:-COURT_HALF, maxX:COURT_HALF, minZ:-COURT_HALF, maxZ:COURT_HALF } ],
    patrol: [
      [ COURT_HALF-0.8, 0, -(COURT_HALF-0.8)], [ COURT_HALF-0.8, 0,  COURT_HALF-0.8],
      [-(COURT_HALF-0.8), 0,  COURT_HALF-0.8], [-(COURT_HALF-0.8), 0, -(COURT_HALF-0.8)]
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
  view: { targetY: 6.0, zMin: 20, zMax: 150, initDist: 105,
    fogNear: 90, fogFar: 320, shadowExtent: 60, shadowFar: 220,
    camFar: 1000, panLimit: 40 }
});
