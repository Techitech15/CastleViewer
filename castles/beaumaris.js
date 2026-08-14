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

  /* ---- palette: cool grey-buff Anglesey limestone/sandstone, a colder
     tone than Bodiam's warm Sussex sandstone or Vincennes' pale Paris
     limestone, per the brief's "冷たい灰色寄り" instruction ----------- */
  var STONE_WALL   = 0x9a998c;
  var STONE_WALL_V = 0x8d8c80; // slightly darker, towers/gatehouses
  var STONE_DARK   = 0x6d6c60;
  var ROOF_COL      = 0x54524a; // flat truncated caps / parapets
  var WINDOW_COL    = 0x1b1b17;
  var FLOOR_COL     = 0x8d887a;
  var WOOD_COL      = 0x5c4a34;
  var WATER_COL     = 0x2e5560; // colder, tidal-influenced water tone
  var GRASS_COL     = 0x5c7a48;
  var GRASS_COL2    = 0x6c8a52;
  var BANK_COL      = 0x8a8570;
  var BANK_MID_COL  = 0x625c3e;
  var BANK_EDGE_COL = 0x2f2c1e;
  var COURT_GRASS_COL = 0x6a8d4f;

  var windowMat = new T.MeshLambertMaterial({ color: WINDOW_COL });
  var floorMat  = new T.MeshLambertMaterial({ color: FLOOR_COL });
  var woodMat   = new T.MeshLambertMaterial({ color: WOOD_COL });
  var darkMat   = new T.MeshLambertMaterial({ color: STONE_DARK });
  var hearthMat = new T.MeshLambertMaterial({ color: 0x2a1c14 });
  var courtGrassMat = new T.MeshLambertMaterial({ color: COURT_GRASS_COL });
  var wellMat   = new T.MeshBasicMaterial({ color: 0x2e6a7a });

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

  var OHX = INNER_HX + OUTER_GAP + OUTER_WT; // outer wall outer-face half-extent, X (~49.2m)
  var OHZ = INNER_HZ + OUTER_GAP + OUTER_WT; // outer wall outer-face half-extent, Z (~46.7m)
  var CHAMFER = 12;                     // estimated: octagon corner cut -- exact vertex geometry for the
                                         // real eight-sided curtain was not published, this stylises it
  var NS_HALF = OHX - CHAMFER;          // half-length of the flat north/south outer wall run
  var EW_HALF = OHZ - CHAMFER;          // half-length of the flat east/west outer wall run

  var NORTH_CORNER_R = 4, SOUTH_CORNER_R = 2.5;   // measured: 8m / ~5m diameter inner corner towers
  var NORTH_CORNER_H = 15, SOUTH_CORNER_H = 13;   // estimated built heights ("roughly half of planned")
  var MID_R = 4.2, MID_H = 14;                    // estimated: D-shaped mid-wall towers, no source found

  var GATE_W = 21, GATE_D = 7.6, GATE_H = 13;     // measured hall 21x7.6m; H estimated ("first floor only")
  var GATE2_W = 16, GATE2_D = 6, GATE2_H = 9;      // south gatehouse: estimated, described as unfinished
  var GATE_OPEN_W = 4.4, GATE_OPEN_H = 4.8;        // estimated passage clear opening (both gatehouses)

  var OUTER_GATE_GAP = 6;               // estimated breach width, outer ward (Llanfaes gate / Gate next the Sea)
  var OUTER_GATE_STUB_H = 3;            // estimated: never rose above footing height (per the "unfinished" account)
  var OUTER_TURRET_R = 2.2, OUTER_TURRET_H = OUTER_WH + 1.3; // estimated: "small towers", no diameter published

  /* -------------------------------------------------------------- *
   * fade group registry -- 'outer' tier is the octagonal outer ward,
   * 'inner' tier is the inner ward (fades second, per the two-tier
   * cutaway convention Vincennes' donjon established)
   * -------------------------------------------------------------- */
  var owN = makeFadeGroup('outerWallN', {x:0,z:-1}, false, STONE_WALL);
  var owS = makeFadeGroup('outerWallS', {x:0,z:1},  false, STONE_WALL);
  var owE = makeFadeGroup('outerWallE', {x:1,z:0},  false, STONE_WALL);
  var owW = makeFadeGroup('outerWallW', {x:-1,z:0}, false, STONE_WALL);
  var owNE = makeFadeGroup('outerWallNE', norm(1,-1),  false, STONE_WALL);
  var owSE = makeFadeGroup('outerWallSE', norm(1,1),   false, STONE_WALL);
  var owSW = makeFadeGroup('outerWallSW', norm(-1,1),  false, STONE_WALL);
  var owNW = makeFadeGroup('outerWallNW', norm(-1,-1), false, STONE_WALL);

  var iwN = makeFadeGroup('innerWallN', {x:0,z:-1}, false, STONE_WALL, 'inner');
  var iwS = makeFadeGroup('innerWallS', {x:0,z:1},  false, STONE_WALL, 'inner');
  var iwE = makeFadeGroup('innerWallE', {x:1,z:0},  false, STONE_WALL, 'inner');
  var iwW = makeFadeGroup('innerWallW', {x:-1,z:0}, false, STONE_WALL, 'inner');
  var icNW = makeFadeGroup('innerCornerNW', norm(-1,-1), false, STONE_WALL_V, 'inner');
  var icNE = makeFadeGroup('innerCornerNE', norm(1,-1),  false, STONE_WALL_V, 'inner');
  var icSW = makeFadeGroup('innerCornerSW', norm(-1,1),  false, STONE_WALL_V, 'inner');
  var icSE = makeFadeGroup('innerCornerSE', norm(1,1),   false, STONE_WALL_V, 'inner');
  var imE = makeFadeGroup('innerMidE', {x:1,z:0},  false, STONE_WALL_V, 'inner');
  var imW = makeFadeGroup('innerMidW', {x:-1,z:0}, false, STONE_WALL_V, 'inner');
  var igN = makeFadeGroup('innerGateN', {x:0,z:-1}, false, STONE_WALL_V, 'inner');
  var igS = makeFadeGroup('innerGateS', {x:0,z:1},  false, STONE_WALL_V, 'inner');
  // flat truncated caps for every inner-ward tower/gatehouse -- a single
  // shared roof:true group (tier 'inner') so the whole silhouette's caps
  // disappear together once the inner cutaway is deep enough, matching
  // the roofCaps convention Bodiam/Vincennes use for their pitched roofs.
  var innerRoofCaps = makeFadeGroup('innerRoofCaps', null, true, ROOF_COL, 'inner');

  /* -------------------------------------------------------------- *
   * wall-building helpers (local to this file, same pattern as
   * bodiam.js / vincennes.js's own local copies)
   * -------------------------------------------------------------- */
  function addCrenellations(target, mat, cx, cz, length, ry, topY, thickness, merlonW, gapW){
    merlonW = merlonW || 1.15; gapW = gapW || 1.05;
    var mt = thickness*0.72;
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
      place(win, cx+w.x*co, midY+(w.dy||0), cz-w.x*si, ry);
      target.add(win);
    });
  }
  function buildWallSeg(fg, cx, cz, length, ry, wh, wt, merlonW, gapW, windows){
    var wall = mkBox(length, wh, wt, fg.mat);
    place(wall, cx, wh/2, cz, ry);
    fg.group.add(wall);
    addCrenellations(fg.group, fg.mat, cx, cz, length, ry, wh, wt, merlonW, gapW);
    if (windows && windows.length) addWindows(fg.group, windowMat, cx, cz, length, ry, wh*0.6, wt, windows);
  }
  function splitForGate(fg, cz, ry, halfX, gateGap, wh, wt, merlonW, gapW, winL, winR){
    var half = gateGap/2, segLen = halfX-half, segCx = half+segLen/2;
    buildWallSeg(fg, -segCx, cz, segLen, ry, wh, wt, merlonW, gapW, winL);
    buildWallSeg(fg,  segCx, cz, segLen, ry, wh, wt, merlonW, gapW, winR);
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
  splitForGate(owN, -OHZ, 0, NS_HALF, OUTER_GATE_GAP, OUTER_WH, OUTER_WT, 0.9, 0.85, [], []);
  splitForGate(owS, OHZ, Math.PI, NS_HALF, OUTER_GATE_GAP, OUTER_WH, OUTER_WT, 0.9, 0.85, [], []);
  buildWallSeg(owE, OHX, 0, 2*EW_HALF, -Math.PI/2, OUTER_WH, OUTER_WT, 0.9, 0.85, []);
  buildWallSeg(owW, -OHX, 0, 2*EW_HALF, Math.PI/2, OUTER_WH, OUTER_WT, 0.9, 0.85, []);

  var chamferLen = CHAMFER*Math.SQRT2;
  buildWallSeg(owNE, (NS_HALF+OHX)/2, -(OHZ+EW_HALF)/2, chamferLen, -Math.PI/4,  OUTER_WH, OUTER_WT, 0.9, 0.85, []);
  buildWallSeg(owSE, (NS_HALF+OHX)/2,  (OHZ+EW_HALF)/2, chamferLen, -3*Math.PI/4, OUTER_WH, OUTER_WT, 0.9, 0.85, []);
  buildWallSeg(owSW, -(NS_HALF+OHX)/2, (OHZ+EW_HALF)/2, chamferLen,  3*Math.PI/4, OUTER_WH, OUTER_WT, 0.9, 0.85, []);
  buildWallSeg(owNW, -(NS_HALF+OHX)/2, -(OHZ+EW_HALF)/2, chamferLen,  Math.PI/4,  OUTER_WH, OUTER_WT, 0.9, 0.85, []);

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

  // outer turrets: small, purely decorative, never part of the cutaway
  // (same convention Vincennes uses for its chemise bartizans) -- placed
  // at the 8 octagon vertices. Wikipedia records 12 turrets in total;
  // this simplifies to one per vertex (a stylisation, not a 1:1 count).
  var octVerts = [
    {x:-NS_HALF,z:-OHZ}, {x:NS_HALF,z:-OHZ}, {x:OHX,z:-EW_HALF}, {x:OHX,z:EW_HALF},
    {x:NS_HALF,z:OHZ}, {x:-NS_HALF,z:OHZ}, {x:-OHX,z:EW_HALF}, {x:-OHX,z:-EW_HALF}
  ];
  var outerTurretMat = new T.MeshLambertMaterial({ color: STONE_WALL });
  octVerts.forEach(function(v, vi){
    var shaft = mkCyl(OUTER_TURRET_R, OUTER_TURRET_R*1.08, OUTER_TURRET_H, 12, outerTurretMat);
    place(shaft, v.x, OUTER_TURRET_H/2, v.z);
    group.add(shaft);
    if (vi === 1){ // one representative tooltip, not all eight
      registerPick(pickables, 'structure', v.x, OUTER_TURRET_H*0.4, v.z, OUTER_TURRET_R*2.6, OUTER_TURRET_H*0.8, OUTER_TURRET_R*2.6,
        '外郭小塔 Outer Ward Turret', '八角形の外郭に点在する小塔。記録では全12基、約300の射撃陣地と164の矢狭間を備えたとされる。');
    }
  });

  /* -------------------------------------------------------------- *
   * INNER WARD: 59 x 54m rectangle, 4.9m/11m walls, twin-towered
   * gatehouses north (main, larger, completed to first floor) and
   * south (secondary, left more clearly unfinished), 4 round corner
   * towers (north pair larger than south pair, per the measured
   * diameters), D-shaped mid-wall towers on the east/west walls.
   * -------------------------------------------------------------- */
  splitForGate(iwN, -INNER_HZ, 0, INNER_HX, GATE_W, INNER_WH, INNER_WT, 1.15, 1.05,
    [{x:-(INNER_HX-GATE_W/2)*0.5,w:1.4,h:2.2,dy:1.0}], [{x:(INNER_HX-GATE_W/2)*0.5,w:1.4,h:2.2,dy:1.0}]);
  splitForGate(iwS, INNER_HZ, Math.PI, INNER_HX, GATE2_W, INNER_WH, INNER_WT, 1.15, 1.05,
    [{x:-(INNER_HX-GATE2_W/2)*0.5,w:1.4,h:2.2,dy:1.0}], [{x:(INNER_HX-GATE2_W/2)*0.5,w:1.4,h:2.2,dy:1.0}]);
  buildWallSeg(iwE, INNER_HX, 0, 2*INNER_HZ, -Math.PI/2, INNER_WH, INNER_WT, 1.15, 1.05,
    [{x:-9,w:1.5,h:2.4,dy:1.0},{x:9,w:1.5,h:2.4,dy:1.0}]);
  buildWallSeg(iwW, -INNER_HX, 0, 2*INNER_HZ, Math.PI/2, INNER_WH, INNER_WT, 1.15, 1.05,
    [{x:-9,w:1.5,h:2.4,dy:1.0},{x:9,w:1.5,h:2.4,dy:1.0}]);

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
    var cap = new T.Mesh(new T.CircleGeometry(r*1.04, 16, thetaStart, Math.PI), innerRoofCaps.mat);
    cap.rotation.x = -Math.PI/2;
    cap.position.set(cx, h+0.05, cz);
    cap.receiveShadow = true;
    innerRoofCaps.group.add(cap);
    registerPick(pickables, 'structure', cx, h*0.4, cz, r*2.2, h*0.8, r*2.2, label, desc);
  }
  var midEmbedE = INNER_HX - INNER_WT/2, midEmbedW = -(INNER_HX - INNER_WT/2);
  buildMidDTower(imE, midEmbedE, 0, MID_R, MID_H, 'e', '中間塔(礼拝堂塔) East Mid Tower / Chapel Tower', 'D字型の中間塔。東壁中央に張り出す。史実の礼拝堂塔に相当する位置(推定)。');
  buildMidDTower(imW, midEmbedW, 0, MID_R, MID_H, 'w', '中間塔 West Mid Tower', 'D字型の中間塔。西壁中央に張り出す。');

  function buildGateBlock(fg, cz, ry, w, d, h, openW, openH, finished, label, desc){
    var pillarW = (w-openW)/2;
    [-1,1].forEach(function(side){
      var lx = side*(openW/2+pillarW/2);
      var pillar = mkBox(pillarW, h, d, fg.mat);
      place(pillar, lx, h/2, cz, ry);
      fg.group.add(pillar);
    });
    var lintelH = Math.max(0.8, h-openH);
    var lintel = mkBox(openW, lintelH, d, fg.mat);
    place(lintel, 0, openH+lintelH/2, cz, ry);
    fg.group.add(lintel);
    if (finished) addCrenellations(fg.group, fg.mat, 0, cz, w, ry, h, d, 1.1, 1.0);
    var cap = mkBox(w*1.05, 0.5, d*1.05, innerRoofCaps.mat);
    place(cap, 0, h + (finished?MER:0) + 0.25, cz, ry);
    innerRoofCaps.group.add(cap);
    registerPick(pickables, 'structure', 0, h*0.42, cz, w*1.1, h*0.8, d*1.6, label, desc);
  }
  buildGateBlock(igN, -INNER_HZ, 0, GATE_W, GATE_D, GATE_H, GATE_OPEN_W, GATE_OPEN_H, true,
    '北門楼 North Gatehouse', '双塔式の主門。1階に幅約21×奥行7.6mの大広間を持つ(実測)。本来2階建てで倍の高さになる計画だったが、1階までで工事が止まった。');
  buildGateBlock(igS, INNER_HZ, Math.PI, GATE2_W, GATE2_D, GATE2_H, GATE_OPEN_W, GATE_OPEN_H, false,
    '南門楼(未完成) South Gatehouse (unfinished)', '副門。北門楼よりさらに未完成な状態で放棄され、はるかに低いまま残る。');

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

  // Great Hall, first floor of the north gatehouse (the only floor it
  // ever got -- see buildGateBlock's north tooltip).
  (function(){
    var hallY = 4.6;
    var hallFloor = mkBox(GATE_W-2, 0.3, GATE_D-1, floorMat);
    place(hallFloor, 0, hallY, -INNER_HZ);
    interiorGroup.add(hallFloor);
    var table = mkBox(GATE_W-8, 0.7, 1.5, woodMat);
    place(table, 0, hallY+0.5, -INNER_HZ);
    interiorGroup.add(table);
    var hearth = mkBox(1.8, 1.0, 0.5, hearthMat);
    place(hearth, GATE_W/2-2.5, hallY+0.5, -INNER_HZ-GATE_D/2+0.4);
    interiorGroup.add(hearth);
    pickRoom(-(GATE_W/2-1), GATE_W/2-1, -INNER_HZ-GATE_D/2+0.5, -INNER_HZ+GATE_D/2-0.5, hallY+0.9, 4.4,
      '大広間 Great Hall (Gatehouse)', '北門楼1階の広間、約21×7.6m(実測)。本来は2階分の計画だったが1階のみで工事が止まった。');
  })();

  // Chapel, inside the east D-shaped mid tower.
  (function(){
    var chapelTex = makeCheckerTexture('#75705f', '#c7c1ab', 5);
    var chapelFloorMat = new T.MeshLambertMaterial({ map: chapelTex });
    var chapelFloor = new T.Mesh(new T.CircleGeometry(MID_R-0.2, 20, 0, Math.PI), chapelFloorMat);
    chapelFloor.rotation.x = -Math.PI/2;
    place(chapelFloor, midEmbedE, 0.06, 0);
    interiorGroup.add(chapelFloor);
    var altar = mkBox(1.5, 1.0, 0.6, new T.MeshLambertMaterial({color:0xd6cdb2}));
    place(altar, midEmbedE-1.7, 0.5, 0);
    interiorGroup.add(altar);
    pickRoom(midEmbedE-MID_R*1.6, midEmbedE+0.6, -MID_R, MID_R, 1.2, 2.6,
      '礼拝堂 Chapel (East Mid Tower)', '東の中間塔に置かれた礼拝堂(位置は推定)。宗教施設は優先的に整備されたと伝わる。');
  })();

  // Kitchen, against the south inner wall, west of the south gatehouse.
  (function(){
    var kx = -(INNER_HX*0.55), kz = INNER_HZ-INNER_WT-1.6;
    var kFloor = mkBox(8, 0.25, 5, floorMat);
    place(kFloor, kx, 0.12, kz);
    interiorGroup.add(kFloor);
    var h1 = mkBox(2.0, 1.1, 0.5, hearthMat);
    place(h1, kx-2.6, 0.55, kz+2.1);
    interiorGroup.add(h1);
    var bench = mkBox(3.0, 0.7, 0.9, woodMat);
    place(bench, kx+1.6, 0.35, kz-1.6);
    interiorGroup.add(bench);
    pickRoom(kx-4, kx+4, kz-2.5, kz+2.5, 1.2, 3.0, '厨房 Kitchen', '南棟に置かれた調理場(位置・規模は推定、個別の実測記録なし)。');
  })();

  // Constable's Chamber, inside the NW corner tower.
  (function(){
    var nx = -INNER_HX, nz = -INNER_HZ;
    var cFloor = new T.Mesh(new T.CircleGeometry(NORTH_CORNER_R-0.4, 16), floorMat);
    cFloor.rotation.x = -Math.PI/2;
    place(cFloor, nx, 0.1, nz);
    interiorGroup.add(cFloor);
    var bed = mkBox(1.5, 0.55, 2.1, woodMat);
    place(bed, nx+1.0, 0.35, nz-0.6, 0.4);
    interiorGroup.add(bed);
    pickRoom(nx-NORTH_CORNER_R, nx+NORTH_CORNER_R, nz-NORTH_CORNER_R, nz+NORTH_CORNER_R, 1.2, 2.6,
      "城代の間 Constable's Chamber (NW Tower)", '北西塔に想定される居室(位置は推定、史料に個別の記載なし)。');
  })();

  // Well, central in the inner ward courtyard.
  (function(){
    var wx = 7, wz = 5;
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
    pickRoom(wx-2.2, wx+2.2, wz-2.2, wz+2.2, 1.0, 2.0, '井戸 Well', '中庭に設けられた井戸(位置は推定)。');
  })();

  /* -------------------------------------------------------------- *
   * moat + tidal dock. The outer ward footprint is close to (but not
   * exactly) square, so a local rectangle-aware moat builder is used
   * instead of the shared square-only buildWaterMoatSystem -- same
   * technique Vincennes' local buildRectMoatSystem uses (copied/adapted
   * here rather than shared, since 01-moat.js is out of scope to edit).
   * -------------------------------------------------------------- */
  function buildRectMoatSystem(opts){
    var g = opts.group;
    var groundY = opts.groundY, waterY = opts.waterY;
    var bailHX = opts.bailHalfX, bailHZ = opts.bailHalfZ, islandY = opts.islandY!=null?opts.islandY:0.02;
    var moatOHX = opts.moatOuterHalfX, moatOHZ = opts.moatOuterHalfZ;
    var bankWOut = opts.bankWidthOut!=null?opts.bankWidthOut:4.0;
    var bankWIn = opts.bankWidthIn!=null?opts.bankWidthIn:3.0;
    var waterHX = moatOHX-bankWOut, waterHZ = moatOHZ-bankWOut;
    var waterInHX = bailHX+bankWIn, waterInHZ = bailHZ+bankWIn;

    var groundSize = opts.groundSize||1800, groundSegs = opts.groundSegs||80;
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

    var colTop = new T.Color(opts.bankColorTop), colMid = new T.Color(opts.bankColorMid), colEdge = new T.Color(opts.bankColorEdge);
    g.add(buildBankRamp('rect', moatOHX, waterHX, groundY, waterY, colTop, colMid, colEdge, 64, 6, moatOHZ, waterHZ));
    g.add(buildBankRamp('rect', bailHX, waterInHX, islandY, waterY, colTop, colMid, colEdge, 64, 6, bailHZ, waterInHZ));

    var moatShape = new T.Shape();
    moatShape.moveTo(-waterHX,-waterHZ); moatShape.lineTo(waterHX,-waterHZ);
    moatShape.lineTo(waterHX,waterHZ); moatShape.lineTo(-waterHX,waterHZ); moatShape.closePath();
    var hole = new T.Path();
    hole.moveTo(-waterInHX,-waterInHZ); hole.lineTo(-waterInHX,waterInHZ);
    hole.lineTo(waterInHX,waterInHZ); hole.lineTo(waterInHX,-waterInHZ); hole.closePath();
    moatShape.holes.push(hole);
    var moatGeo = new T.ShapeGeometry(moatShape);
    moatGeo.rotateX(-Math.PI/2);
    var waterMat = new T.MeshPhongMaterial({ color: opts.waterColor, transparent:true, opacity:0.82, shininess:90, specular:0x9fd4e0 });
    var moatWater = new T.Mesh(moatGeo, waterMat);
    moatWater.position.y = waterY;
    g.add(moatWater);
    return { waterMat:waterMat };
  }

  var BAIL_HX = OHX+3, BAIL_HZ = OHZ+3;
  // moat render width widened from the sourced ~5.5m (18ft, single
  // source) for on-screen legibility -- see the header provenance note.
  var MOAT_W = 9;
  var MOAT_OHX = BAIL_HX+MOAT_W, MOAT_OHZ = BAIL_HZ+MOAT_W;
  var GROUND_Y = -0.6, WATER_Y = GROUND_Y-1.1;

  var rectMoat = buildRectMoatSystem({
    group: group, groundY: GROUND_Y, waterY: WATER_Y,
    bailHalfX: BAIL_HX, bailHalfZ: BAIL_HZ, islandY: 0.02,
    moatOuterHalfX: MOAT_OHX, moatOuterHalfZ: MOAT_OHZ,
    bankWidthOut: 3.4, bankWidthIn: 2.6,
    groundMat: new T.MeshLambertMaterial({color:GRASS_COL}), islandMat: new T.MeshLambertMaterial({color:GRASS_COL2}),
    waterColor: WATER_COL,
    bankColorTop: BANK_COL, bankColorMid: BANK_MID_COL, bankColorEdge: BANK_EDGE_COL,
    groundSize: 1800, groundSegs: 80
  });
  var waterMat = rectMoat.waterMat;
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

  // tidal dock ("Gate next the Sea"): dimensions are an estimate, sized
  // for visual plausibility from the sourced "ships up to 40 tons" fact
  // -- no dock measurements were found in the sources checked.
  (function(){
    var DOCK_LEN = 16, DOCK_W = 8;
    var z0 = MOAT_OHZ, z1 = MOAT_OHZ+DOCK_LEN;
    var dockWater = mkBox(DOCK_W, 0.05, DOCK_LEN, waterMat);
    place(dockWater, 0, WATER_Y, (z0+z1)/2);
    group.add(dockWater);
    [-1,1].forEach(function(side){
      var qw = mkBox(1.2, 2.0, DOCK_LEN+2, darkMat);
      place(qw, side*(DOCK_W/2+0.6), 0.4, (z0+z1)/2);
      group.add(qw);
    });
    var quay = mkBox(DOCK_W+3, 0.3, 3, darkMat);
    place(quay, 0, 0.1, z1+1.2);
    group.add(quay);
    registerPick(pickables, 'structure', 0, 1.0, (z0+z1)/2, DOCK_W+3, 3, DOCK_LEN+4,
      '潮汐ドック Tidal Dock ("Gate next the Sea")',
      '南の水路を通じ、満潮時には最大40トン級の船が城門の直下まで乗り入れられたと伝わる(実測)。ドック自体の正確な寸法は史料未確認のため、規模は推定。');
  })();

  /* -------------------------------------------------------------- *
   * info payload + always-on labels
   * -------------------------------------------------------------- */
  var info = {
    rooms: [
      { name:'大広間 (Great Hall, Gatehouse)', desc:'北門楼1階、約21×7.6m。本来2階建て予定だったが1階のみで完成。' },
      { name:'礼拝堂 (Chapel)', desc:'東の中間塔に置かれたと想定される礼拝堂(位置推定)。' },
      { name:'厨房 (Kitchen)', desc:'南棟の調理場(位置・規模は推定)。' },
      { name:"城代の間 (Constable's Chamber)", desc:'北西塔の居室(位置推定)。' },
      { name:'井戸 (Well)', desc:'内郭中庭の井戸(位置推定)。' }
    ]
  };
  var labelGroup = buildLabelGroup(group, pickables);

  /* ---- resident life data (住人システム、section 6.5 が読む任意フィールド)
   * 同心円式の特徴を生かし、gate.path は内郭側の門口→外郭中庭→外郭の破口
   * を順に貫通する3点(2区間)。衛兵の巡回は内郭と外郭の間の狭い「キル
   * ゾーン」を周回させ、同心円防御の見た目を強調する。 -------------------- */
  var northGateHalfD = GATE_D/2, southGateHalfD = GATE2_D/2;
  var nInnerMouthZ = -(INNER_HZ-northGateHalfD)-0.2, nOuterMouthZ = -(INNER_HZ+northGateHalfD)-0.2;
  var sInnerMouthZ =  (INNER_HZ-southGateHalfD)+0.2, sOuterMouthZ =  (INNER_HZ+southGateHalfD)+0.2;
  var nBreachZ = -OHZ-0.3, sBreachZ = OHZ+0.3;
  var nVanish = (MOAT_OHZ - OHZ + 6) - 0.3;
  var sVanish = (MOAT_OHZ - OHZ + 6) - 0.3;

  var life = {
    gates: [
      { path:[ {x:0,z:nInnerMouthZ}, {x:0,z:nOuterMouthZ}, {x:0,z:nBreachZ} ], outDir:{x:0,z:-1}, vanishDist: nVanish },
      { path:[ {x:0,z:sInnerMouthZ}, {x:0,z:sOuterMouthZ}, {x:0,z:sBreachZ} ], outDir:{x:0,z:1},  vanishDist: sVanish }
    ],
    courtyard: [
      { minX:-(INNER_IN_HX-5), maxX:INNER_IN_HX-5, minZ:-(INNER_IN_HZ-5), maxZ:INNER_IN_HZ-5 }, // 内郭中庭
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
    pickables: pickables, windowMat: windowMat, waterMats: [waterMat], labelGroup: labelGroup, life: life };
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
  view: { targetY: 8, zMin: 25, zMax: 190, initDist: 130,
    fogNear: 120, fogFar: 400, shadowExtent: 75, shadowFar: 260,
    camFar: 1100, panLimit: 55, envScale: 1.3 }
});
