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
  var outerTurretMat = new T.MeshLambertMaterial({ color: STONE_WALL });
  // dark capping disc over each turret's flat top. Without it the cylinder's
  // own up-facing cap renders in the wall tone and blows out to pure white
  // under the noon rig, which is exactly the "bright white tower tops" the
  // review flagged; the disc also matches the truncated inner-ward caps.
  var turretCapMat = new T.MeshLambertMaterial({ color: CAP_COL });
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
    var waterMat = new T.MeshPhongMaterial({ color: opts.waterColor, transparent:true, opacity:0.42, shininess:34, specular:0x4e6a62 });
    var moatWater = new T.Mesh(moatGeo, waterMat);
    moatWater.position.y = waterY;
    g.add(moatWater);
    return { waterMat:waterMat };
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

    registerPick(pickables, 'structure', DOCK_X, GROUND_Y+1.6, (zBasin0+zBasin1)/2, BASIN_W+6, 3.2, (zBasin1-zBasin0),
      '潮汐ドック Tidal Dock ("Gate next the Sea")',
      '南の水路を通じ、満潮時には最大40トン級の船が城門の直下まで乗り入れられたと伝わる(実測)。城の南北軸よりやや西に寄る配置はCadwの遺構平面図に拠る。ドック自体の正確な寸法・桟橋・船は史料未確認のため、規模と細部は推定。');
    registerPick(pickables, 'structure', DOCK_X, GROUND_Y+0.6, (zBasin1+zChan1)/2, CHAN_W+3, 1.6, (zChan1-zBasin1)*0.8,
      '海への水路 Channel to the Sea',
      'メナイ海峡へ通じる潮汐水路。ボーマリスが海に開いた補給拠点として機能したことを示す(経路の詳細は推定)。');
  })(dockG);

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
      { minX:-(RANGE_IN_X-1.5), maxX:RANGE_IN_X-1.5, minZ:NGATE_FACE_Z+2.0, maxZ:SGATE_FACE_Z-2.0 },
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
