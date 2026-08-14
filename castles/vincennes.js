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

  function makeFadeGroup(name, dir, isRoof, colorHex, tier){
    var mat = new T.MeshLambertMaterial({ color: colorHex });
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

  var windowMat = new T.MeshLambertMaterial({ color: WINDOW_COL });
  var floorMat  = new T.MeshLambertMaterial({ color: FLOOR_COL });
  var stubMat   = new T.MeshLambertMaterial({ color: STUB_COL, side: T.DoubleSide });
  var woodMat   = new T.MeshLambertMaterial({ color: WOOD_COL });
  var metalMat  = new T.MeshLambertMaterial({ color: METAL_COL });
  var grassMat  = new T.MeshLambertMaterial({ color: GRASS_COL });
  var grassMat2 = new T.MeshLambertMaterial({ color: GRASS_COL2 });
  var courtGrassMat = new T.MeshLambertMaterial({ color: COURT_GRASS_COL });
  var darkWoodMat = new T.MeshLambertMaterial({ color: 0x2a1c14 });
  var chemiseMat = new T.MeshLambertMaterial({ color: STONE_DARK });
  var slateMat = new T.MeshLambertMaterial({ color: ROOF_COL });

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

  // west wall gap (donjon + chemise bulge through here -- see section below)
  var W_GAP0 = 10, W_GAP1 = 90;
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
  var dTurrets = makeFadeGroup('donjonTurrets', null, true, STONE_WALL_V, 'inner');
  var dStair = makeFadeGroup('donjonStair', {x:0,z:-1}, false, STONE_WALL_V, 'inner');
  var dRoof = makeFadeGroup('donjonRoof', null, true, ROOF_COL, 'inner');

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
  donjonFloors.forEach(function(f){
    var slab = mkBox(DHALF*2-0.6, 0.3, DHALF*2-0.6, floorMat);
    place(slab, DCX, f.y0+0.15, DCZ);
    interiorGroup.add(slab);
    if (f.pillar){
      var pillar = mkCyl(0.6, 0.7, f.y1-f.y0-0.3, 10, stubMat);
      place(pillar, DCX, (f.y0+f.y1)/2, DCZ);
      interiorGroup.add(pillar);
    }
    if (f.fireplace){
      var hearth = mkBox(2.4, 1.3, 0.6, darkWoodMat);
      place(hearth, DCX+DHALF-1.5, f.y0+0.9, DCZ);
      interiorGroup.add(hearth);
    }
    var fbox = mkBox(1.6, 0.8, 1.0, woodMat);
    place(fbox, DCX-2.4, f.y0+0.55, DCZ+2.4);
    interiorGroup.add(fbox);
    registerPick(pickables, 'room', DCX, (f.y0+f.y1)/2, DCZ, DHALF*2-0.8, f.y1-f.y0-0.4, DHALF*2-0.8, f.name, f.desc);
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

  // buildWaterMoatSystem builds its ShapeGeometry pieces centred on local
  // (0,0) and only ever sets their Y position -- so it needs its own
  // child group, positioned at the donjon's centre, rather than being
  // added straight into `group` (which would leave it sitting at world
  // origin instead of around the donjon).
  var donjonMoatGroup = new T.Group();
  donjonMoatGroup.position.set(DCX, 0, DCZ);
  group.add(donjonMoatGroup);
  var donjonMoat = buildWaterMoatSystem({
    group: donjonMoatGroup,
    groundY: 0.04, waterY: 0.04 - 1.3,
    islandHalf: CHEM_HALF, islandY: 0.06,
    moatOuterHalf: CHEM_HALF + 7,
    bankWidthOut: 2.2, bankWidthIn: 1.6,
    // buildWaterMoatSystem's collar is forced out to moatOuterHalf+30m, so
    // this system paints a 122m square of ground around the keep. Painting
    // it in the bailey's own grass makes that square disappear inside the
    // walls instead of reading as a bright rectangle on the lawn; only the
    // part outside the west curtain still shows, where it correctly reads
    // as the raised terrace the donjon complex stands on.
    groundMat: grassMat2, islandMat: courtGrassMat,
    waterColor: WATER_COL,
    bankColorTop: BANK_COL, bankColorMid: BANK_MID_COL, bankColorEdge: BANK_EDGE_COL,
    groundSize: 96, groundSegs: 24
  });
  registerPick(pickables, 'structure', DCX, 0.0, DCZ-CHEM_HALF-4, 6, 1.5, CHEM_HALF*2+8,
    'ドンジョンの堀 Donjon Moat', '主郭の堀とは別に、シェミーズ壁を囲んで大塔単独を守る専用の堀。西壁の外側へ張り出す。');

  function bridgeAcrossMoat(axis, fixedCoord, outerCoord, innerCoord, w){
    var len = Math.abs(outerCoord-innerCoord), mid = (outerCoord+innerCoord)/2;
    var br = axis==='z' ? mkBox(w, 0.3, len, woodMat) : mkBox(len, 0.3, w, woodMat);
    if (axis==='z') place(br, fixedCoord, 0.05, mid); else place(br, mid, 0.05, fixedCoord);
    group.add(br);
  }
  bridgeAcrossMoat('z', DCX, DCZ-(CHEM_HALF+7)+1.0, DCZ-CHEM_HALF-0.5, 3.0); // north drawbridge (main approach)
  bridgeAcrossMoat('x', DCZ, DCX+(CHEM_HALF+7)-1.0, DCX+CHEM_HALF+0.5, 2.6); // east drawbridge (secondary)

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
  var chapelMat = new T.MeshLambertMaterial({ color: 0xdbd2bb });
  var CHX = 25, CHZ = 25;
  var CH_W = 15, CH_LEN = 40, CH_EAVE = 20, CH_RIDGE = 36;
  var CH_WEST = CHX - CH_LEN/2, CH_EAST = CHX + CH_LEN/2;
  var nave = mkBox(CH_LEN, CH_EAVE, CH_W, chapelMat);   // long axis = X (east-west)
  place(nave, CHX, CH_EAVE/2, CHZ);
  group.add(nave);
  (function(){
    // twin roof slabs pitched about the east-west ridge line
    var run = CH_W/2, rise = CH_RIDGE-CH_EAVE, slant = Math.hypot(run, rise);
    [1,-1].forEach(function(sign){
      var geo = new T.BoxGeometry(CH_LEN+1.2, 0.4, slant);
      var m = new T.Mesh(geo, slateMat);
      m.castShadow = true; m.receiveShadow = true;
      m.position.set(CHX, CH_EAVE + rise/2, CHZ + sign*run/2);
      // pitch about X now that the ridge runs east-west: +sign tips the
      // +Z slab down towards its own eave (mirror of the -Z slab).
      m.rotation.x = sign * Math.atan2(rise, run);
      group.add(m);
    });
  })();
  // gable infill at both ends of the ridge (west front + apse end)
  [CH_WEST, CH_EAST].forEach(function(x){
    var run = CH_W/2, rise = CH_RIDGE-CH_EAVE;
    var shape = new T.Shape();
    shape.moveTo(-run, 0);
    shape.lineTo(run, 0);
    shape.lineTo(0, rise);
    shape.closePath();
    var gm = new T.Mesh(new T.ShapeGeometry(shape), new T.MeshLambertMaterial({ color:0xdbd2bb, side:T.DoubleSide }));
    gm.castShadow = true; gm.receiveShadow = true;
    gm.rotation.y = Math.PI/2;          // gable plane now faces east-west
    gm.position.set(x, CH_EAVE, CHZ);
    group.add(gm);
  });
  // tall bay windows + buttresses + pinnacles down both flanks
  var CH_BAYS = 5;
  (function(){
    var sill = 4.2, head = CH_EAVE - 2.2;
    for (var side=-1; side<=1; side+=2){
      var wz = CHZ + side*CH_W/2;
      for (var b=0; b<CH_BAYS; b++){
        var bx = CH_WEST + (CH_LEN/CH_BAYS)*(b+0.5);
        var win = mkBox(4.4, head-sill, 0.3, windowMat);
        place(win, bx, (sill+head)/2, wz + side*0.06);
        group.add(win);
        var arch = mkCone(2.3, 2.6, 3, windowMat);   // pointed head
        arch.rotation.y = Math.PI/2;
        place(arch, bx, head+1.0, wz + side*0.06);
        group.add(arch);
      }
      // buttress + pinnacle on every bay division, ends included
      for (var q=0; q<=CH_BAYS; q++){
        var qx = CH_WEST + (CH_LEN/CH_BAYS)*q;
        var but = mkBox(1.7, CH_EAVE+0.6, 2.6, chapelMat);
        place(but, qx, (CH_EAVE+0.6)/2, wz + side*1.0);
        group.add(but);
        var pinBase = mkBox(1.5, 3.2, 1.5, chapelMat);
        place(pinBase, qx, CH_EAVE+2.2, wz + side*1.3);
        group.add(pinBase);
        var pin = mkCone(1.05, 6.0, 4, chapelMat);
        place(pin, qx, CH_EAVE+3.8+3.0, wz + side*1.3);
        group.add(pin);
      }
      // eaves balustrade running between the pinnacles
      var bal = mkBox(CH_LEN, 1.0, 0.5, chapelMat);
      place(bal, CHX, CH_EAVE+0.5, wz + side*0.9);
      group.add(bal);
    }
  })();
  // polygonal apse closing the east end (with its own conical slate roof)
  (function(){
    var apse = mkCyl(CH_W/2, CH_W/2, CH_EAVE, 7, chapelMat);
    apse.rotation.y = Math.PI/7;
    place(apse, CH_EAST, CH_EAVE/2, CHZ);
    group.add(apse);
    // conical apse roof, kept BELOW the nave ridge so it reads as the end
    // of the same roof rather than a witch's-hat tower cap
    var apseRoofH = (CH_RIDGE-CH_EAVE)*0.7;
    var apseRoof = mkCone(CH_W/2+0.5, apseRoofH, 7, slateMat);
    apseRoof.rotation.y = Math.PI/7;
    place(apseRoof, CH_EAST, CH_EAVE+apseRoofH/2, CHZ);
    group.add(apseRoof);
    // radiating lancets on the apse facets, set on the 7-gon's own radius
    for (var a=-2; a<=2; a++){
      var ang = a*(2*Math.PI/7);
      var ex = CH_EAST + Math.cos(ang)*(CH_W/2*0.97);
      var ez = CHZ + Math.sin(ang)*(CH_W/2*0.97);
      var lan = mkBox(0.3, 11.0, 3.0, windowMat);
      place(lan, ex, 10.5, ez, -ang);
      group.add(lan);
    }
  })();
  // west front: giant traceried window under a steep gable, framed by two
  // stair turrets that climb past the roofline and finish in spires.
  (function(){
    var fx = CH_WEST - 0.12;
    var greatWin = mkBox(0.3, 12.5, 8.6, windowMat);
    place(greatWin, fx, 12.4, CHZ);
    group.add(greatWin);
    var winHead = mkCone(4.3, 3.4, 3, windowMat);
    winHead.rotation.y = Math.PI/2;
    place(winHead, fx, 20.3, CHZ);
    group.add(winHead);
    var portal = mkBox(0.4, 5.4, 3.6, windowMat);
    place(portal, fx, 2.7, CHZ);
    group.add(portal);
    var portalArch = mkCone(2.1, 2.4, 3, chapelMat);
    portalArch.rotation.y = Math.PI/2;
    place(portalArch, fx-0.15, 6.5, CHZ);
    group.add(portalArch);
    [-1,1].forEach(function(side){
      var turr = mkCyl(2.1, 2.2, CH_RIDGE+2.0, 8, chapelMat);
      place(turr, CH_WEST+0.4, (CH_RIDGE+2.0)/2, CHZ + side*(CH_W/2+0.4));
      group.add(turr);
      var spire = mkCone(2.4, 10.0, 8, chapelMat);
      place(spire, CH_WEST+0.4, CH_RIDGE+2.0+5.0, CHZ + side*(CH_W/2+0.4));
      group.add(spire);
    });
    var apexFinial = mkCone(0.7, 4.2, 4, chapelMat);
    place(apexFinial, CH_WEST+0.3, CH_RIDGE+2.1, CHZ);
    group.add(apexFinial);
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

  var BAIL_HX = OHX+3, BAIL_HZ = OHZ+3;
  var MOAT_W = 22;
  var MOAT_OHX = BAIL_HX+MOAT_W, MOAT_OHZ = BAIL_HZ+MOAT_W;
  var GROUND_Y = -1.2, WATER_Y = GROUND_Y - 1.4;

  var rectMoat = buildRectMoatSystem({
    group: group, groundY: GROUND_Y, waterY: WATER_Y,
    bailHalfX: BAIL_HX, bailHalfZ: BAIL_HZ, islandY: 0.02,
    moatOuterHalfX: MOAT_OHX, moatOuterHalfZ: MOAT_OHZ,
    bankWidthOut: 5.5, bankWidthIn: 3.5,
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
    courtyard: [
      { minX:-84, maxX:84,  minZ:-160, maxZ:8 },   // 北側の広い区画(シェミーズ・礼拝堂より北)
      { minX:-84, maxX:84,  minZ:92,   maxZ:160 }, // 南側の広い区画
      { minX:-58, maxX:-6,  minZ:8,    maxZ:92 },  // ドンジョン(シェミーズ)と礼拝堂の間の帯
      { minX:56,  maxX:84,  minZ:8,    maxZ:92 },  // 礼拝堂と東城壁の間の帯
      { minX:-6,  maxX:56,  minZ:42,   maxZ:92 }   // 礼拝堂南側の前庭
    ],
    patrol: [
      [80,0,-158], [80,0,158], [-80,0,158], [-80,0,90],
      [-60,0,90], [-60,0,10], [-80,0,10], [-80,0,-158]
    ],
    population: { farmers: 24, guards: 6 }
  };

  return { group: group, fadeGroups: fadeGroups, interiorGroup: interiorGroup, info: info,
    pickables: pickables, windowMat: windowMat, waterMats: [waterMat, donjonMoat.waterMat], labelGroup: labelGroup, life: life };
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
