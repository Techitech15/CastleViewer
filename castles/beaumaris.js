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
  var STONE_WALL   = 0x7b7d78;
  var STONE_WALL_V = 0x717370; // slightly darker, towers/gatehouses
  var STONE_DARK   = 0x50524e;
  var ROOF_COL      = 0x484a47; // flat truncated caps / parapets
  var CAP_COL       = 0x53554f; // outer-turret truncated caps (was the worst white offender)
  var RANGE_WALL_COL = 0x74766e; // inner-ward building ranges, rubble masonry
  var RANGE_ROOF_COL = 0x474950; // Welsh slate
  var WINDOW_COL    = 0x1b1b17;
  var FLOOR_COL     = 0x736e62;
  var WOOD_COL      = 0x5c4a34;
  var WATER_COL     = 0x2e5560; // colder, tidal-influenced water tone
  var GRASS_COL     = 0x4e6c45;
  var GRASS_COL2    = 0x527047; // island lawn, only a shade off the surrounding field
  // bank ramp gradient: starts as turf (not sand) so the moat edge reads as
  // the grassed bank the real castle has, instead of a beach-coloured collar
  var BANK_COL      = 0x5c6c46;
  var BANK_MID_COL  = 0x4a4a2e;
  var BANK_EDGE_COL = 0x2a2719;
  var COURT_GRASS_COL = 0x5a7a46;

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
  // inner-ward building ranges. Shell (facades + gable ends) and slate roofs
  // are two groups because a fadeGroup carries exactly one material; both are
  // roof:true so they fade on reveal depth alone (not camera direction) --
  // otherwise the far range would stay solid and block the cutaway view
  // across the ward. Floors/partitions/furniture stay in interiorGroup, so a
  // fully-revealed ward reads as the surviving foundation plan.
  var rangeShell = makeFadeGroup('innerRangeShell', null, true, RANGE_WALL_COL, 'inner');
  var rangeRoofs = makeFadeGroup('innerRangeRoofs', null, true, RANGE_ROOF_COL, 'inner');

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
  function buildWallSeg(fg, cx, cz, length, ry, wh, wt, merlonW, gapW, windows, plinth){
    var wall = mkBox(length, wh, wt, fg.mat);
    place(wall, cx, wh/2, cz, ry);
    fg.group.add(wall);
    if (plinth) addPlinth(fg, cx, cz, length, ry, wt);
    addCrenellations(fg.group, fg.mat, cx, cz, length, ry, wh, wt, merlonW, gapW);
    if (windows && windows.length) addWindows(fg.group, windowMat, cx, cz, length, ry, wh*0.6, wt, windows);
  }
  function splitForGate(fg, cz, ry, halfX, gateGap, wh, wt, merlonW, gapW, winL, winR, plinth){
    var half = gateGap/2, segLen = halfX-half, segCx = half+segLen/2;
    buildWallSeg(fg, -segCx, cz, segLen, ry, wh, wt, merlonW, gapW, winL, plinth);
    buildWallSeg(fg,  segCx, cz, segLen, ry, wh, wt, merlonW, gapW, winR, plinth);
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
  // dark capping disc over each turret's flat top. Without it the cylinder's
  // own up-facing cap renders in the wall tone and blows out to pure white
  // under the noon rig, which is exactly the "bright white tower tops" the
  // review flagged; the disc also matches the truncated inner-ward caps.
  var turretCapMat = new T.MeshLambertMaterial({ color: CAP_COL });
  octVerts.forEach(function(v, vi){
    var shaft = mkCyl(OUTER_TURRET_R, OUTER_TURRET_R*1.08, OUTER_TURRET_H, 12, outerTurretMat);
    place(shaft, v.x, OUTER_TURRET_H/2, v.z);
    group.add(shaft);
    var tcap = new T.Mesh(new T.CircleGeometry(OUTER_TURRET_R*1.06, 12), turretCapMat);
    tcap.rotation.x = -Math.PI/2;
    tcap.position.set(v.x, OUTER_TURRET_H+0.05, v.z);
    tcap.receiveShadow = true;
    group.add(tcap);
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
    return m;
  }
  function rangeProp(x, z, w, h, d, mat, ry){
    var m = mkBox(w, h, d, mat);
    place(m, x, RANGE_FLOOR_Y + h/2, z, ry||0);
    interiorGroup.add(m);
    return m;
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

    var part = mkBox(RANGE_D-0.7, 2.6, 0.5, darkMat);
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

  // ---- west range, north block: stable + harness store
  buildRange(-1, RANGE_Z[0][0], RANGE_Z[0][1]);
  (function(){
    for (var i=0;i<4;i++) rangeProp(WX_OUT+2.6, -19.0+i*2.6, 3.2, 1.5, 0.35, woodMat); // stall divisions
    rangeProp(WX_IN+2.2, -9.6, 2.6, 0.9, 1.1, woodMat);   // feed bins
    rangeProp(WX_IN+2.2, -12.4, 1.2, 1.6, 1.2, woodMat);
    pickRoom(WX_OUT, WX_IN, RANGE_Z[0][0], RANGE_Z[0][1], 2.6, 4.6,
      '厩舎・馬具庫 Stable & Harness Store (West Range)',
      '西棟北ブロック。内郭西壁に背を預ける建物レンジ(基礎のみ現存)。厩舎としたのは推定で、史料に個別の用途記載はない。');
  })();

  // ---- west range, south block: kitchen + bakehouse (the standalone
  // kitchen that used to float in the middle of the lawn now lives here,
  // so there is exactly one kitchen in the model)
  buildRange(-1, RANGE_Z[1][0], RANGE_Z[1][1], [10.5, 17.0]);
  (function(){
    rangeProp(WX_OUT+1.5, 10.5, 2.4, 1.6, 2.6, hearthMat);  // kitchen hearth against the curtain
    rangeProp(WX_OUT+1.5, 17.0, 2.4, 1.5, 2.4, hearthMat);  // bakehouse oven
    rangeProp(WX_IN+2.6, 9.0, 1.1, 0.85, 3.4, woodMat);     // dressing tables
    rangeProp(WX_IN+2.6, 18.4, 1.1, 0.85, 3.4, woodMat);
    rangeProp(WX_IN+3.0, 13.0, 1.0, 1.0, 1.0, woodMat);     // barrels / tubs
    pickRoom(WX_OUT, WX_IN, RANGE_Z[1][0], 13.5, 2.6, 4.6, '厨房 Kitchen (West Range)',
      '西棟南ブロック北半。内郭西壁沿いの調理場(位置・規模ともに推定、個別の実測記録なし)。');
    pickRoom(WX_OUT, WX_IN, 13.5, RANGE_Z[1][1], 2.6, 4.6, 'パン焼き所 Bakehouse (West Range)',
      '西棟南ブロック南半。パン窯を備えた区画(推定)。');
  })();

  // ---- east range, north block: lodgings / retainers' chambers
  buildRange(1, RANGE_Z[0][0], RANGE_Z[0][1], [-17.5]);
  (function(){
    rangeProp(EX_OUT-1.5, -17.5, 2.2, 1.4, 2.2, hearthMat);
    rangeProp(EX_OUT-2.6, -12.0, 2.2, 0.55, 1.5, woodMat, 0.15);
    rangeProp(EX_OUT-2.6, -9.5, 2.2, 0.55, 1.5, woodMat, -0.1);
    rangeProp(EX_IN+2.4, -14.0, 1.0, 0.8, 2.6, woodMat);
    pickRoom(EX_IN, EX_OUT, RANGE_Z[0][0], RANGE_Z[0][1], 2.6, 4.6,
      '居室・従者宿舎 Lodgings (East Range)',
      '東棟北ブロック。内郭東壁沿いの居住棟(基礎のみ現存、内部の間取りは推定)。');
  })();

  // ---- east range, south block: granary / stores
  buildRange(1, RANGE_Z[1][0], RANGE_Z[1][1]);
  (function(){
    for (var i=0;i<3;i++) rangeProp(EX_OUT-2.0, 8.6+i*3.2, 1.5, 1.5, 1.5, woodMat);
    rangeProp(EX_IN+2.2, 12.0, 1.2, 1.1, 5.0, woodMat);
    pickRoom(EX_IN, EX_OUT, RANGE_Z[1][0], RANGE_Z[1][1], 2.6, 4.6,
      '倉庫・穀物庫 Storehouse & Granary (East Range)',
      '東棟南ブロック。糧食・武具の保管棟(推定)。同心円式の内郭は籠城を前提とした構造で、貯蔵空間が重視された。');
  })();

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

  // (The kitchen used to be a free-standing slab in the middle of the lawn.
  //  It is now a room inside the west range -- see buildRange above -- so the
  //  model has exactly one kitchen and nothing floats in the open courtyard.)

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
  // moat render width widened from the sourced ~5.5m (18ft, single source)
  // for on-screen legibility -- see the header provenance note. MOAT_W is the
  // whole ditch; the graded banks eat bankWidthOut+bankWidthIn of it, so the
  // visible WATER strip is MOAT_W-4.8. At the original MOAT_W=9 that left a
  // 3m ribbon of water inside a 9m sand-coloured ditch, which read as a dry
  // track rather than the wide tidal moat the real castle sits in.
  var MOAT_W = 15;
  var MOAT_OHX = BAIL_HX+MOAT_W, MOAT_OHZ = BAIL_HZ+MOAT_W;
  var GROUND_Y = -0.6, WATER_Y = GROUND_Y-1.1;

  var rectMoat = buildRectMoatSystem({
    group: group, groundY: GROUND_Y, waterY: WATER_Y,
    bailHalfX: BAIL_HX, bailHalfZ: BAIL_HZ, islandY: 0.02,
    moatOuterHalfX: MOAT_OHX, moatOuterHalfZ: MOAT_OHZ,
    bankWidthOut: 2.6, bankWidthIn: 2.2,
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
  (function(){
    var BASIN_W = 20, CHAN_W = 10;
    // the basin is held clear of the south causeway's landfall (the bridge
    // ends at MOAT_OHZ-1); the sill starts at the moat's own water edge so
    // the two bodies of water visibly connect under it.
    var zSill = MOAT_OHZ - 2.6;
    var zBasin0 = MOAT_OHZ + 3.5, zBasin1 = MOAT_OHZ + 25;
    var zChan1 = zBasin1 + 46;                     // runs off toward the strait
    var bedY = GROUND_Y + 0.04, surfY = GROUND_Y + 0.11;
    var bedMat  = new T.MeshLambertMaterial({ color: 0x2c3a33 });
    var quayMat = new T.MeshLambertMaterial({ color: STONE_DARK });

    function waterRun(w, za, zb){
      var bed = mkBox(w+1.6, 0.08, zb-za, bedMat);
      place(bed, 0, bedY, (za+zb)/2);
      bed.castShadow = false;
      group.add(bed);
      var surf = mkBox(w, 0.06, zb-za, waterMat);
      place(surf, 0, surfY, (za+zb)/2);
      surf.castShadow = false; surf.receiveShadow = false;
      group.add(surf);
    }
    waterRun(BASIN_W, zBasin0, zBasin1);
    waterRun(CHAN_W, zBasin1, zChan1);

    // sloped sill down the outer moat bank, so the channel visibly feeds the moat
    var sillRun = zBasin0 - zSill, sillRise = surfY - (WATER_Y + 0.05);
    var sill = mkBox(BASIN_W*0.75, 0.06, Math.hypot(sillRun, sillRise), waterMat);
    place(sill, 0, (surfY + WATER_Y + 0.05)/2, (zSill + zBasin0)/2);
    sill.rotation.x = -Math.atan2(sillRise, sillRun);
    sill.castShadow = false; sill.receiveShadow = false;
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
    var sail = mkBox(0.08, 3.6, 5.0, new T.MeshLambertMaterial({ color: 0xb9b2a0 }));
    place(sail, boatX+0.6, boatY+5.8, boatZ);
    group.add(sail);

    registerPick(pickables, 'structure', 0, GROUND_Y+1.6, (zBasin0+zBasin1)/2, BASIN_W+6, 3.2, (zBasin1-zBasin0),
      '潮汐ドック Tidal Dock ("Gate next the Sea")',
      '南の水路を通じ、満潮時には最大40トン級の船が城門の直下まで乗り入れられたと伝わる(実測)。ドック自体の正確な寸法・桟橋・船は史料未確認のため、規模と細部は推定。');
    registerPick(pickables, 'structure', 0, GROUND_Y+0.6, (zBasin1+zChan1)/2, CHAN_W+3, 1.6, (zChan1-zBasin1)*0.8,
      '海への水路 Channel to the Sea',
      'メナイ海峡へ通じる潮汐水路。ボーマリスが海に開いた補給拠点として機能したことを示す(経路の詳細は推定)。');
  })();

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
      // 内郭中庭。東西のレンジ(courtyard-facing face at |x| = RANGE_IN_X)の
      // 内側だけを歩かせ、建物の中に住人がめり込まないようにする。
      { minX:-(RANGE_IN_X-1.5), maxX:RANGE_IN_X-1.5, minZ:-(INNER_IN_HZ-3), maxZ:INNER_IN_HZ-3 },
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
  // initDist raised 130 -> 145 because widening the moat pushed the outer
  // half-extent from ~55m to ~61m: at 130 the moat corners clipped the frame
  // and the opening reveal (0.364) already sat past WALL_START, so the walls
  // began fading before the user had touched anything. 145 gives reveal 0.27.
  view: { targetY: 8, zMin: 25, zMax: 190, initDist: 145,
    fogNear: 120, fogFar: 400, shadowExtent: 75, shadowFar: 260,
    camFar: 1100, panLimit: 55, envScale: 1.3 }
});
