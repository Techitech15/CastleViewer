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
  /* `root` holds every piece of the castle itself. The dimension sheet
   * pins the coordinate origin to the HIGH CASTLE courtyard centre, but
   * the High Castle is the complex's SOUTHERN END -- so with everything
   * authored in sheet coordinates the built model runs from z=-104
   * (Gdanisko) to z=+460 (Low Castle north wall), i.e. its centre of mass
   * sits ~178m north of the origin. The viewer's camera always orbits and
   * looks at the world origin (see 12-camera.js placeCamera / applyCastle
   * resetting orbTgt to 0,0), so authoring in raw sheet coordinates put
   * the castle almost entirely off-frame with the camera staring at empty
   * field. Everything castle-side therefore goes into `root`, which is
   * rigidly shifted by ZOFF (= -model centre) at the end of the build, so
   * the model is centred on the camera target while the code above still
   * reads in the sheet's own documented coordinates. The ground plane and
   * the shared background mountain rings stay centred on the world origin
   * (they are radially symmetric about it), so they are added to `group`
   * directly, NOT to `root`. Pickables (which live outside the group in
   * world space) and the `life` waypoints (residentGroup is parented to
   * the scene, not to the castle) get the same shift applied explicitly.
   * ---------------------------------------------------------------- */
  var root = new T.Group();
  group.add(root);
  var interiorGroup = new T.Group();
  root.add(interiorGroup);
  var fadeGroups = [];
  var pickables = [];

  function mpMakeFadeGroup(name, dir, isRoof, colorHex, tier){
    var mat = new T.MeshLambertMaterial({ color: colorHex });
    var g = new T.Group();
    g.name = name;
    root.add(g);
    var desc = { group:g, mat:mat, dir:dir, roof: !!isRoof, op:1, name:name, tier: tier || 'outer' };
    fadeGroups.push(desc);
    return desc;
  }
  function mpNorm(x,z){ var l = Math.hypot(x,z)||1; return {x:x/l, z:z/l}; }

  /* ---- palette: identical two-tone red-brick / terracotta scheme to
   * castles/malbork.js (deep red-brick walls, bright terracotta roofs) --
   * per task brief, the two builds must read as the same castle, only at
   * the corrected scale. ------------------------------------------- */
  /* Colours re-sampled off the reference photographs (Commons aerial +
   * the view north from the main tower). The previous scheme read as one
   * flat orange mass: walls 0x8a4636 and roofs 0xc1502f are the same hue,
   * with the roof simply more saturated, so at any distance the whole
   * complex melted into a single colour. In the photos the brickwork is a
   * muted warm red-BROWN and the pantile roofs are a lighter, slightly
   * pinker terracotta, with plenty of weathered/darker roof planes mixed
   * in -- so the walls are lifted+desaturated, the roof is pulled back
   * from orange, a SECOND darker roof tone is added for variety, and two
   * new tones are introduced purely for the gable decoration (light stone
   * step copings, near-black recessed blind niches) that gives Malbork's
   * skyline its actual texture. */
  /* Values are ~0.8x what a naive read of the photograph suggests. Sampling
   * the reference river shot gives sunlit brick around RGB(165,95,75) and
   * sunlit pantile around (175,85,65); feeding those in as base colours
   * came back off the renderer at roughly (235,150,120) once the scene's
   * key light and ambient fill were applied, i.e. a pastel salmon castle.
   * The base tones are therefore pre-divided so the LIT result lands on
   * the photographed colour instead of overshooting it. */
  var BRICK_WALL   = 0x6c402f; // sunlit brick range wall
  var BRICK_WALL_V = 0x5a3325; // deeper tone for towers / vertical accents
  var BRICK_DARK   = 0x402016;
  var TOWER_BRICK  = 0x8b5c3d; // main tower: a visibly paler, yellower brick,
                               // exactly as it reads in the courtyard photo
  var ROOF_COL     = 0x7d3f2c; // terracotta pantile
  var ROOF_COL2    = 0x633326; // weathered / older tile, mixed in for variety
  var NICHE_COL    = 0x31180f; // recessed blind-arcade niches (read as shadow)
  var WHITE_TRIM   = 0xa08f74; // light stone copings / string courses. NOT a
                               // true white: at 0xd9cdb2 the step copings and
                               // pinnacles read as icing on every gable and
                               // the skyline turned into white sawteeth
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
  var COBBLE_COL   = 0x7a7264; // darkened from 0x8f897a -- the Middle Castle's
                               // cobbled apron was reading as a sheet of pale
                               // concrete from above
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
  /* Water: shininess/specular pulled WAY down (was 85 / 0x9fd4e0). With
   * the old values the single directional light -- especially the low,
   * cold moon at time=night -- laid one enormous unbroken specular streak
   * along the 900m-long Nogat plane, so the river read as a lit runway
   * rather than water. A low-gloss, dark-blue specular keeps a hint of
   * sheen in daylight without the night-time blow-out. */
  var riverMat   = new T.MeshPhongMaterial({ color: WATER_COL, transparent:true, opacity:0.9, shininess:24, specular:0x33454b });
  var moatWaterMat = new T.MeshPhongMaterial({ color: WATER_COL, transparent:true, opacity:0.9, shininess:26, specular:0x36484e });
  var treeTrunkMat = new T.MeshLambertMaterial({ color: TREE_TRUNK_COL });
  var treeLeafMat1 = new T.MeshLambertMaterial({ color: TREE_LEAF_COL1 });
  var treeLeafMat2 = new T.MeshLambertMaterial({ color: TREE_LEAF_COL2 });
  var cobbleMat  = new T.MeshLambertMaterial({ color: COBBLE_COL });
  /* Plain (non-fadeGroup) decoration materials. Wall-attached ornament --
   * plinth courses, blind-arcade pilasters, string courses -- deliberately
   * uses these rather than a fadeGroup material: a fadeGroup's material
   * opacity is driven by THAT group's own fade curve, so borrowing e.g. a
   * roof-tier material for a wall-mounted pilaster would make the
   * pilasters dissolve off a wall that is still standing. Same convention
   * mpWingWall already uses for its trim band. */
  var nicheMat   = new T.MeshLambertMaterial({ color: NICHE_COL });

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
  /* Gabled roof. `ends` (default true) draws the flat triangular gable
   * infill at each end -- pass false when a STEPPED GABLE (mpSteppedGable
   * below) is going to close that end instead, so the two don't z-fight.
   * `ends` may also be the string 'a' / 'b' to close only one end. */
  function mpGableRoof(target, mat, axis, cx, cz, spanA, spanB, halfWidth, eaveY, ridgeRise, ends){
    var ridgeY = eaveY + ridgeRise;
    if (ends === undefined) ends = true;
    if (axis === 'x'){
      target.add(mpLeanSlope(mat, 'x', spanA, spanB, cz-halfWidth, cz, eaveY, ridgeY));
      target.add(mpLeanSlope(mat, 'x', spanA, spanB, cz+halfWidth, cz, eaveY, ridgeY));
    } else {
      target.add(mpLeanSlope(mat, 'z', spanA, spanB, cx-halfWidth, cx, eaveY, ridgeY));
      target.add(mpLeanSlope(mat, 'z', spanA, spanB, cx+halfWidth, cx, eaveY, ridgeY));
    }
    if (ends === false) return;
    var shape = new T.Shape();
    shape.moveTo(-halfWidth,0); shape.lineTo(halfWidth,0); shape.lineTo(0,ridgeRise); shape.closePath();
    var geo = new T.ShapeGeometry(shape);
    var endMat = new T.MeshLambertMaterial({ color: mat.color.getHex(), side: T.DoubleSide });
    var list = ends === 'a' ? [spanA] : (ends === 'b' ? [spanB] : [spanA, spanB]);
    list.forEach(function(s){
      var m = new T.Mesh(geo, endMat);
      m.castShadow = true; m.receiveShadow = true;
      if (axis === 'x'){ m.position.set(s, eaveY, cz); m.rotation.y = Math.PI/2; }
      else { m.position.set(cx, eaveY, s); }
      target.add(m);
    });
  }
  /* True hipped roof (all four sides slope to a short central ridge) --
   * built as an exact 4-face BufferGeometry rather than by stacking lean
   * slopes, so no faces overlap. Used to break up the Low Castle's rows:
   * with every single range gabled the outer bailey read as a stamped
   * grid of identical prisms, which is the single biggest reason the
   * previous build looked like a barracks camp instead of Malbork's
   * Vorburg. `axis` = the direction the ridge runs. */
  function mpHipRoof(target, mat, cx, cz, w, d, eaveY, rise, axis){
    var hx = w/2, hz = d/2, ridgeY = eaveY + rise;
    var x0 = cx-hx, x1 = cx+hx, z0 = cz-hz, z1 = cz+hz;
    var rA, rB;
    if (axis === 'z'){ var ins = Math.min(hx, hz*0.6); rA = [cx, ridgeY, z0+ins]; rB = [cx, ridgeY, z1-ins]; }
    else { var ins2 = Math.min(hz, hx*0.6); rA = [x0+ins2, ridgeY, cz]; rB = [x1-ins2, ridgeY, cz]; }
    var c = [[x0,eaveY,z0],[x1,eaveY,z0],[x1,eaveY,z1],[x0,eaveY,z1]];
    var tris;
    if (axis === 'z'){
      tris = [ [c[0],c[1],rA], [c[3],rB,c[2]],                      // the two hipped ends
               [c[0],rA,rB],[c[0],rB,c[3]],                          // west slope
               [c[1],c[2],rB],[c[1],rB,rA] ];                        // east slope
    } else {
      tris = [ [c[0],rA,c[3]], [c[1],c[2],rB],
               [c[0],c[1],rA],[c[1],rB,rA],
               [c[3],rB,c[2]],[c[3],rA,rB] ];
    }
    /* Winding correction. Hand-ordering 6 triangles across two ridge
     * orientations got several of them backwards, and computeVertexNormals
     * takes its direction straight from the winding -- so those faces came
     * back with downward normals and rendered as near-black roofs sitting
     * among correctly lit ones (clearly visible on the Grand Master's
     * Palace and the hipped Low Castle ranges before this was added).
     * Every face of a roof must point upward, so any triangle whose normal
     * has y < 0 simply gets two of its vertices swapped. */
    var pos = [];
    tris.forEach(function(t){
      var ax=t[1][0]-t[0][0], ay=t[1][1]-t[0][1], az=t[1][2]-t[0][2];
      var bx=t[2][0]-t[0][0], by=t[2][1]-t[0][1], bz=t[2][2]-t[0][2];
      var ny = az*bx - ax*bz;                    // y component of a x b
      var o = ny < 0 ? [t[0],t[2],t[1]] : t;
      o.forEach(function(p){ pos.push(p[0],p[1],p[2]); });
    });
    var geo = new T.BufferGeometry();
    geo.setAttribute('position', new T.Float32BufferAttribute(pos,3));
    geo.computeVertexNormals();
    var m = new T.Mesh(geo, mat);
    m.castShadow = true; m.receiveShadow = true;
    target.add(m);
  }
  /* Lancet (pointed-arch) window -- a tall narrow light with a small
   * pyramidal cap standing in for the pointed head. The previous build
   * used plain 0.6x1.8 boxes, so from any distance the walls read as
   * blank brick; Malbork's facades are covered in regularly-spaced tall
   * Gothic lights and that rhythm is a large part of its look. */
  function mpLancet(target, mat, x, y, z, ry, w, h, depth){
    var body = mkBox(w, h, depth, mat);
    place(body, x, y + h/2, z, ry);
    target.add(body);
    var head = mkCone(w*0.72, w*1.15, 4, mat);
    head.rotation.y = Math.PI/4;
    place(head, x, y + h + w*0.5, z, ry);
    target.add(head);
  }
  /* Row of lancets along one facade. `nrm` is the outward face normal
   * (one of 'x+','x-','z+','z-'); `along` positions run along the other
   * horizontal axis, centred on (cx,cz). */
  function mpLancetRow(target, mat, nrm, cx, cz, faceOff, count, spread, y, h, w){
    w = w || 0.62; h = h || 2.2;
    var ry = (nrm==='x+') ? 0 : (nrm==='x-') ? Math.PI : (nrm==='z+') ? -Math.PI/2 : Math.PI/2;
    for (var i=0;i<count;i++){
      var t = count<=1 ? 0 : (i/(count-1) - 0.5) * spread;
      var x = cx, z = cz;
      if (nrm==='x+'){ x = cx + faceOff; z = cz + t; }
      else if (nrm==='x-'){ x = cx - faceOff; z = cz + t; }
      else if (nrm==='z+'){ z = cz + faceOff; x = cx + t; }
      else { z = cz - faceOff; x = cx + t; }
      mpLancet(target, mat, x, y, z, ry, w, h, 0.34);
    }
  }
  /* Blind arcade / pilaster strips: shallow vertical recessed panels
   * marching along a long brick facade. Together with the stepped gables
   * these are THE signature of Malbork's Backsteingotik -- every large
   * wall plane in the photographs is articulated this way, and modelling
   * them costs one thin box each. */
  function mpBlindArcade(target, mat, nrm, cx, cz, faceOff, count, spread, y0, h, w){
    w = w || 0.75;
    for (var i=0;i<count;i++){
      var t = count<=1 ? 0 : (i/(count-1) - 0.5) * spread;
      var x = cx, z = cz, sw = w, sd = 0.22;
      if (nrm==='x+' || nrm==='x-'){ x = cx + (nrm==='x+'? faceOff : -faceOff); z = cz + t; sw = 0.22; sd = w; }
      else { z = cz + (nrm==='z+'? faceOff : -faceOff); x = cx + t; }
      var p = mkBox(sw, h, sd, mat);
      place(p, x, y0 + h/2, z);
      target.add(p);
      var cap = mkCone(w*0.62, w*0.95, 4, mat);
      cap.rotation.y = Math.PI/4;
      place(cap, x, y0 + h + w*0.42, z);
      target.add(cap);
    }
  }
  /* --------------------------------------------------------------
   * STEPPED / CRENELLATED GABLE (schodkowy szczyt) -- the single most
   * characteristic element of Malbork's silhouette and the thing whose
   * absence made the previous build read as generic. Every large range in
   * the photographs terminates in a staircase-profiled gable whose face
   * is quilted with tall slim blind niches and topped with light stone
   * copings and little pinnacles.
   *
   * Built as `steps` nested boxes rising from `eaveY` (a staircase
   * silhouette), a light coping bar on each tread, dark recessed lancet
   * niches on both faces, and a pinnacle on each outer step corner. All
   * of it goes into ROOF-tier fade groups (see the gbl* groups below) --
   * a gable is a roof-line feature, so it should vanish with the roof
   * during the cutaway rather than linger over an open-topped box.
   * `faceAxis` 'z' = gable plane is perpendicular to Z (range runs N-S).
   * -------------------------------------------------------------- */
  function mpSteppedGable(brickFg, trimFg, nicheFg, faceAxis, cx, cz, halfW, eaveY, rise, steps, thick, outSide){
    steps = steps || 4; thick = thick || 1.0;
    // outSide: +1 / -1 quilts only the exposed face (the other one looks
    // into the roof void and is never seen); omit for a free-standing
    // gable that is visible from both sides. Halves the niche mesh count
    // across ~30 gables, which is the single biggest geometry saving here.
    var nSides = outSide ? [outSide] : [-1, 1];
    var stepH = rise/steps;
    var tops = [];
    for (var i=0;i<steps;i++){
      var hw = halfW * (steps-i)/steps;
      var topY = eaveY + stepH*(i+1);
      tops.push({hw:hw, y:topY});
      var bw = 2*hw, bh = topY - eaveY;
      var box = faceAxis==='z' ? mkBox(bw, bh, thick, brickFg.mat) : mkBox(thick, bh, bw, brickFg.mat);
      place(box, cx, eaveY + bh/2, cz);
      brickFg.group.add(box);
      // light stone coping on the tread
      var cw = bw + 0.36;
      var cop = faceAxis==='z' ? mkBox(cw, 0.2, thick+0.3, trimFg.mat) : mkBox(thick+0.3, 0.2, cw, trimFg.mat);
      place(cop, cx, topY + 0.1, cz);
      trimFg.group.add(cop);
      // Pinnacles only on the TOP two treads. One on every corner of every
      // tread turned each gable into a bristling white crown that swamped
      // the staircase silhouette it was supposed to accent.
      if (i >= steps-2){
        [-1,1].forEach(function(sg){
          var pin = mkCone(0.3, 1.15, 4, trimFg.mat);
          pin.rotation.y = Math.PI/4;
          var px = faceAxis==='z' ? cx + sg*(hw-0.24) : cx;
          var pz = faceAxis==='z' ? cz : cz + sg*(hw-0.24);
          place(pin, px, topY + 0.2 + 0.58, pz);
          trimFg.group.add(pin);
        });
      }
    }
    // dark blind niches quilting the gable face: one per ~1.6m of width,
    // each rising to just under whichever tread sits above it.
    var nCount = Math.max(3, Math.round(halfW*2/1.7));
    if (nCount % 2 === 0) nCount++;               // keep one centred on the apex
    var pitch = (halfW*2 - 1.0)/nCount;
    for (var n=0;n<nCount;n++){
      var lx = -halfW + 0.5 + pitch*(n+0.5);
      var lim = eaveY + stepH; // fall back to the lowest tread
      for (var s2=0;s2<steps;s2++){ if (Math.abs(lx) < tops[s2].hw - 0.45) lim = tops[s2].y; }
      var nh = lim - eaveY - 1.15;
      if (nh < 1.0) continue;
      nSides.forEach(function(side){
        var off = (thick/2 + 0.07)*side;
        var nx = faceAxis==='z' ? cx + lx : cx + off;
        var nz = faceAxis==='z' ? cz + off : cz + lx;
        var nb = faceAxis==='z' ? mkBox(pitch*0.62, nh, 0.16, nicheFg.mat) : mkBox(0.16, nh, pitch*0.62, nicheFg.mat);
        place(nb, nx, eaveY + 0.45 + nh/2, nz);
        nicheFg.group.add(nb);
        var nc = mkCone(pitch*0.36, pitch*0.55, 4, nicheFg.mat);
        nc.rotation.y = Math.PI/4;
        place(nc, nx, eaveY + 0.45 + nh + pitch*0.25, nz);
        nicheFg.group.add(nc);
      });
    }
  }
  /* Small gabled roof dormer -- the pantile slopes in every photograph
   * are punctuated by these, and they stop a long roof plane from reading
   * as one dead facet. */
  function mpDormer(roofFg, brickFg, axis, x, y, z, w, h){
    var body = axis==='z' ? mkBox(0.5, h, w, brickFg.mat) : mkBox(w, h, 0.5, brickFg.mat);
    place(body, x, y + h/2, z);
    brickFg.group.add(body);
    var cap = mkCone(w*0.62, h*0.85, 4, roofFg.mat);
    cap.rotation.y = Math.PI/4;
    place(cap, x, y + h + h*0.4, z);
    roofFg.group.add(cap);
  }
  /* Cloister arcade: a run of pointed arches on square piers. Used for
   * the High Castle courtyard (two superimposed storeys, exactly as in
   * the reference courtyard photograph) -- the previous build left that
   * courtyard as bare grass, which is the one interior view every visitor
   * to Malbork actually remembers. */
  function mpArcade(target, pierMat, darkMat, axis, cx, cz, spanA, spanB, y0, hPier, depth){
    var len = Math.abs(spanB-spanA);
    var bays = Math.max(2, Math.round(len/3.4));
    var pitch = len/bays;
    var start = Math.min(spanA, spanB);
    for (var i=0;i<=bays;i++){
      var t = start + i*pitch;
      var pier = axis==='x' ? mkBox(0.55, hPier, depth, pierMat) : mkBox(depth, hPier, 0.55, pierMat);
      place(pier, axis==='x'? t : cx, y0 + hPier/2, axis==='x'? cz : t);
      target.add(pier);
    }
    for (var b=0;b<bays;b++){
      var m = start + (b+0.5)*pitch;
      // dark recess behind the arch = the shaded walk beyond
      var rec = axis==='x' ? mkBox(pitch*0.86, hPier*0.86, depth*0.5, darkMat) : mkBox(depth*0.5, hPier*0.86, pitch*0.86, darkMat);
      place(rec, axis==='x'? m : cx, y0 + hPier*0.43, axis==='x'? cz : m);
      target.add(rec);
      // pointed head over the opening
      var head = mkCone(pitch*0.45, pitch*0.5, 4, pierMat);
      head.rotation.y = Math.PI/4;
      place(head, axis==='x'? m : cx, y0 + hPier + pitch*0.16, axis==='x'? cz : m);
      target.add(head);
    }
    var band = axis==='x' ? mkBox(len+0.6, 0.42, depth*1.12, pierMat) : mkBox(depth*1.12, 0.42, len+0.6, pierMat);
    place(band, axis==='x'? (spanA+spanB)/2 : cx, y0 + hPier + pitch*0.42, axis==='x'? cz : (spanA+spanB)/2);
    target.add(band);
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
  /* Regular grid of LANCET windows on a rotated wall face. Was a grid of
   * plain 0.6x1.8 boxes; the reference photos show the High Castle wings
   * covered in tall pointed lights in a strict rhythm, so this now emits
   * proper pointed heads and (optionally) the pilaster strips between
   * them. */
  function mpWindowsRow(fg, cx, cz, ry, count, spread, wallH, rows, nicheMat){
    rows = rows || 3;
    var co=Math.cos(ry), si=Math.sin(ry);
    if (nicheMat){
      for (var i2=0;i2<=count;i2++){
        var t2 = (i2/count - 0.5) * (spread + spread/Math.max(1,count-1));
        var pil = mkBox(0.7, wallH-3.0, 0.24, nicheMat);
        place(pil, cx+t2*co, 1.3+(wallH-3.0)/2, cz-t2*si, ry);
        fg.group.add(pil);
      }
    }
    for (var r=0;r<rows;r++){
      var frac = 0.18 + r*(0.60/Math.max(1,rows-1));
      for (var i=0;i<count;i++){
        var t = count<=1 ? 0 : (i/(count-1) - 0.5) * spread;
        mpLancet(fg.group, windowMat, cx+t*co, wallH*frac, cz-t*si, ry, 0.66, 2.1, 0.36);
      }
    }
  }
  /* --------------------------------------------------------------
   * mpRange -- one masonry range (a Low/Middle Castle building block).
   * Replaces the old bare mpWingBlock (box + shallow roof + 2 lonely
   * window squares), which is what made the outer bailey read as rows of
   * identical sheds. A range now carries, all optional per-call:
   *   - a battered plinth course + a light stone string course
   *   - lancet windows on BOTH long facades, in as many storeys as fit
   *   - blind-arcade pilasters between the window bays
   *   - a STEEP roof (opts.pitch, default 0.72 x half-span ~= 55 deg,
   *     measured off the reference photos where the roof mass is fully as
   *     tall as the wall below it -- the old ridge values gave ~22 deg,
   *     which alone flattened the whole silhouette)
   *   - gabled OR hipped roof (opts.hip)
   *   - stepped gables at one/both ends (opts.gable: 'both'|'a'|'b'|none)
   *   - roof dormers (opts.dormers)
   * `axis` = the direction the range (and its ridge) runs.
   * -------------------------------------------------------------- */
  function mpRange(fg, roofFg, gbl, cx, cz, w, d, h, axis, opts){
    opts = opts || {};
    var body = mkBox(w, h, d, fg.mat);
    place(body, cx, h/2, cz);
    fg.group.add(body);
    // battered plinth: a slightly wider, darker base course
    if (opts.plinth !== false){
      var plH = Math.min(1.6, h*0.16);
      var pl = mkBox(w+0.7, plH, d+0.7, nicheMat);
      place(pl, cx, plH/2, cz);
      fg.group.add(pl);
    }
    var span = (axis==='z') ? w : d;          // across the ridge
    var run  = (axis==='z') ? d : w;          // along the ridge
    var rise = opts.rise != null ? opts.rise : span*0.5*(opts.pitch != null ? opts.pitch : 1.42);
    // facade articulation on the two long sides
    var nrmA = axis==='z' ? 'x-' : 'z-', nrmB = axis==='z' ? 'x+' : 'z+';
    var faceOff = (axis==='z' ? w/2 : d/2) + 0.02;
    // one bay per ~6m of frontage. 4.6m gave a denser, prettier facade but
    // ~40% more meshes across 25-odd ranges; at the distances this castle
    // is actually viewed from, 6m reads identically.
    var bays = Math.max(2, Math.round(run/6.0));
    var spread = run - 3.2;
    var storeys = Math.max(1, Math.floor((h-1.8)/4.2));
    [nrmA, nrmB].forEach(function(nrm){
      if (opts.pilasters !== false){
        mpBlindArcade(fg.group, nicheMat, nrm, cx, cz, faceOff, bays+1, run-1.6, 1.2, h-2.6, 0.8);
      }
      for (var s=0;s<storeys;s++){
        var wy = 2.0 + s*4.2;
        if (wy + 2.6 > h) break;
        mpLancetRow(fg.group, windowMat, nrm, cx, cz, faceOff+0.08, bays, spread, wy, 2.0, 0.6);
      }
    });
    // light stone string course just under the eaves
    var sc = mkBox(w+0.5, 0.3, d+0.5, trimMat);
    place(sc, cx, h-0.45, cz);
    fg.group.add(sc);
    // roof
    if (opts.hip){
      mpHipRoof(roofFg.group, roofFg.mat, cx, cz, w+0.6, d+0.6, h, rise, axis);
    } else {
      var g = opts.gable || 'none';
      var ends = g==='both' ? false : (g==='a' ? 'b' : (g==='b' ? 'a' : true));
      if (axis==='z') mpGableRoof(roofFg.group, roofFg.mat, 'z', cx, cz, cz-d/2, cz+d/2, w/2+0.3, h, rise, ends);
      else            mpGableRoof(roofFg.group, roofFg.mat, 'x', cx, cz, cx-w/2, cx+w/2, d/2+0.3, h, rise, ends);
      var hw = span/2;
      var gEnds = g==='both' ? [-1,1] : (g==='a' ? [-1] : (g==='b' ? [1] : []));
      gEnds.forEach(function(sg){
        var gx = axis==='z' ? cx : cx + sg*w/2;
        var gz = axis==='z' ? cz + sg*d/2 : cz;
        mpSteppedGable(gbl.brick, gbl.trim, gbl.niche, axis==='z' ? 'z' : 'x',
          gx, gz, hw, h, rise, opts.steps || 4, 1.0, sg);
      });
    }
    // dormers on the two roof slopes
    if (opts.dormers){
      var dn = opts.dormers;
      for (var di=0; di<dn; di++){
        var t = run*( (di+0.5)/dn - 0.5 );
        [-1,1].forEach(function(sg2){
          var off = span*0.27*sg2;
          var dx = axis==='z' ? cx + off : cx + t;
          var dz = axis==='z' ? cz + t : cz + off;
          mpDormer(roofFg, gbl.brick, axis, dx, h + rise*0.42, dz, 1.7, 1.5);
        });
      }
    }
    return rise;
  }
  function mpPickRoom(x0,x1,z0,z1,h,name,desc){
    registerPick(pickables, 'room', (x0+x1)/2, h/2, (z0+z1)/2, Math.abs(x1-x0), h, Math.abs(z1-z0), name, desc);
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
   * GABLE-DECORATION FADE BUNDLES
   * Stepped gables, their stone copings/pinnacles and their dark blind
   * niches all need their own materials (three colours) but must fade
   * together with the roof they crown -- a gable left standing over a
   * roofless box during the cutaway looks broken. So each bundle is three
   * fadeGroups declared with roof:true and no `dir`, i.e. they ride the
   * shared ROOF_START/END band (or DONJON_ROOF_* for the inner tier)
   * exactly like the tile surfaces do. One bundle per cutaway tier, since
   * tier is the only thing that has to differ.
   * ================================================================ */
  function mpGableBundle(prefix, tier){
    return {
      brick: mpMakeFadeGroup(prefix+'Gable',      null, true, BRICK_WALL_V, tier),
      trim:  mpMakeFadeGroup(prefix+'GableTrim',  null, true, WHITE_TRIM,   tier),
      niche: mpMakeFadeGroup(prefix+'GableNiche', null, true, NICHE_COL,    tier)
    };
  }
  var gblOuter = mpGableBundle('outer', 'outer');
  var gblInner = mpGableBundle('inner', 'inner');

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
  var hcTower = mpMakeFadeGroup('hcMainTower', mpNorm(1,0), false, TOWER_BRICK, 'inner');
  var hcApse  = mpMakeFadeGroup('hcApse', mpNorm(1,1), false, BRICK_WALL_V, 'inner');
  var hcGd    = mpMakeFadeGroup('hcGdanisko', mpNorm(-1,-1), false, BRICK_WALL_V, 'inner');
  hcGd.mat.side = T.DoubleSide; // the bridge's arch-infill triangles (below) are single-sided planes
  var hcGdRoof= mpMakeFadeGroup('hcGdaniskoRoof', null, true, ROOF_COL, 'inner');

  /* Each wing: brick wall + a blind-arcade/lancet facade + a steep roof.
   * The E and W wings terminate at the four corners in STEPPED GABLES
   * (gblInner), which is what the corner masses actually look like in
   * every photograph of the High Castle from the south or the river --
   * previously they were plain flat triangles and the whole block read as
   * a shed. Dormers punctuate the long N/S roof planes. */
  mpWingWall(hcWallS, 0, -HC_HZ, 2*HC_HX, Math.PI, HC_WALL_H, 1.5, 0);
  mpWindowsRow(hcWallS, 0, -HC_HZ, Math.PI, 7, 42, HC_WALL_H, 4, nicheMat);
  mpGableRoof(hcRoof.group, hcRoof.mat, 'x', 0, -HC_HZ, -HC_HX+2, HC_HX-2, HC_WD_NS/2, HC_WALL_H, HC_RIDGE);

  var HC_GATE_W = 4.6; // dry-ditch bridge landing, centred X=0
  mpWingWall(hcWallN, 0, HC_HZ, 2*HC_HX, 0, HC_WALL_H, 1.5, HC_GATE_W);
  mpWindowsRow(hcWallN, 0, HC_HZ, 0, 6, 38, HC_WALL_H, 3, nicheMat);
  mpGableRoof(hcRoof.group, hcRoof.mat, 'x', 0, HC_HZ, -HC_HX+2, HC_HX-2, HC_WD_NS/2, HC_WALL_H, HC_RIDGE);

  mpWingWall(hcWallE, HC_HX, 0, 2*HC_HZ, -Math.PI/2, HC_WALL_H, 1.5, 0);
  mpWindowsRow(hcWallE, HC_HX, 0, -Math.PI/2, 8, 48, HC_WALL_H, 4, nicheMat);
  mpGableRoof(hcRoof.group, hcRoof.mat, 'z', HC_HX, 0, -HC_HZ+2, HC_HZ-2, HC_WD_EW/2, HC_WALL_H, HC_RIDGE, false);

  mpWingWall(hcWallW, -HC_HX, 0, 2*HC_HZ, Math.PI/2, HC_WALL_H, 1.5, 0);
  mpWindowsRow(hcWallW, -HC_HX, 0, Math.PI/2, 8, 48, HC_WALL_H, 4, nicheMat);
  mpGableRoof(hcRoof.group, hcRoof.mat, 'z', -HC_HX, 0, -HC_HZ+2, HC_HZ-2, HC_WD_EW/2, HC_WALL_H, HC_RIDGE, false);

  // four corner stepped gables closing the E/W wing roofs
  [-1,1].forEach(function(sx){
    [-1,1].forEach(function(sz){
      mpSteppedGable(gblInner.brick, gblInner.trim, gblInner.niche, 'z',
        sx*HC_HX, sz*(HC_HZ-2), HC_WD_EW/2, HC_WALL_H, HC_RIDGE, 4, 1.2);
    });
  });
  // dormers on the long north / south roof slopes
  [-1,1].forEach(function(sz2){
    for (var hd=0; hd<4; hd++){
      var hdx = -15 + hd*10;
      mpDormer(hcRoof, gblInner.brick, 'x', hdx, HC_WALL_H + HC_RIDGE*0.40,
        sz2*(HC_HZ - HC_WD_NS*0.30), 1.9, 1.7);
    }
  });

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
  /* Apse: tall traceried lancets between stepped buttresses, which is
   * what actually gives the chancel its Gothic read -- the previous four
   * flat rectangles on a hexagon looked like slots cut in a drum. */
  for (var af=0; af<5; af++){
    var ang = (af-2)*0.52;
    var wx = APSE_CX + Math.cos(ang)*APSE_R*0.97, wz = APSE_CZ + Math.sin(ang)*APSE_R*0.97;
    mpLancet(hcApse.group, windowMat, wx, APSE_H*0.22, wz, -ang + Math.PI/2, 1.5, APSE_H*0.55, 0.5);
  }
  for (var ab=0; ab<4; ab++){
    var bang = (ab-1.5)*0.62;
    var bx = APSE_CX + Math.cos(bang)*APSE_R*1.06, bz = APSE_CZ + Math.sin(bang)*APSE_R*1.06;
    var bt = mkBox(1.1, APSE_H*0.92, 1.9, hcApse.mat);
    place(bt, bx, APSE_H*0.46, bz, -bang);
    hcApse.group.add(bt);
    var btc = mkCone(0.85, 2.0, 4, trimMat);
    btc.rotation.y = Math.PI/4;
    place(btc, bx, APSE_H*0.92 + 1.0, bz);
    hcApse.group.add(btc);
  }
  // buttresses + blind arcading down the church's exposed north flank
  for (var cbz2=0; cbz2<7; cbz2++){
    var czz = CH_X0 + 4 + cbz2*5.2;
    if (czz > CH_X1 - 3) break;
    var cbut = mkBox(1.3, CH_H+4.5, 1.6, hcWallN.mat);
    place(cbut, czz, (CH_H+4.5)/2, HC_HZ + 0.4);
    hcWallN.group.add(cbut);
    var cbcap = mkCone(0.95, 2.2, 4, trimMat);
    cbcap.rotation.y = Math.PI/4;
    place(cbcap, czz, CH_H+4.5+1.1, HC_HZ + 0.4);
    hcWallN.group.add(cbcap);
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
    root.add(moatPlane);

    var supports = [BR_Z0, BR_Z0-12, BR_Z0-24, BR_Z0-36, BR_Z0-48, BR_Z1]; // 6 points -> 5 arches
    var DECK_Y = 8, BASE_Y = 1.6, PEAK_Y = DECK_Y - 0.6;
    var corridorHalf = GD_W*0.55/2;
    // 4 interior piers (stone, matching the deep-brick tone)
    for (var pi=1; pi<supports.length-1; pi++){
      var pz = supports[pi];
      var inWater = pz > moatZ1-0.01 ? false : (pz < moatZ0+0.01 ? false : true); // between moatZ0/moatZ1
      var pier = mkCyl(0.85, 0.95, BASE_Y-GROUND_Y+0.4, 10, inWater ? stoneDarkMat : hcGd.mat);
      place(pier, BR_X, GROUND_Y+(BASE_Y-GROUND_Y+0.4)/2, pz);
      root.add(pier);
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
        root.add(plank);
        [-1,1].forEach(function(side){
          var chain = mkCyl(0.06,0.06, 5.0, 5, metalMat);
          place(chain, BR_X+side*corridorHalf*0.8, DECK_Y-1.0, z0+0.6);
          chain.rotation.x = 0.9;
          root.add(chain);
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

  /* ---- TWO-STOREY CLOISTER ARCADE round the High Castle courtyard.
   * The single most recognisable interior at Malbork (see the reference
   * courtyard photograph: a continuous run of pointed arches on square
   * brick piers, doubled one above the other, wrapping all four sides).
   * The previous build left this courtyard as bare lawn + a cross path,
   * so the one view visitors know best had nothing in it at all. Goes in
   * interiorGroup -- it is open-air and enclosed by the wings, so it is
   * always visible, exactly like the lawn and the well already were. */
  (function hcCloister(){
    var arcMat  = new T.MeshLambertMaterial({ color: BRICK_WALL });
    var darkMat = new T.MeshLambertMaterial({ color: NICHE_COL });
    var ax0 = -HC_COURT_HX + 0.6, ax1 = HC_COURT_HX - 0.6;
    var az0 = -HC_COURT_HZ + 0.6, az1 = HC_COURT_HZ - 0.6;
    var DEP = 2.2;
    [0, 1].forEach(function(lvl){
      var y0 = lvl * 5.6, hP = 4.3;
      mpArcade(interiorGroup, arcMat, darkMat, 'x', 0, az0 + DEP/2, ax0, ax1, y0, hP, DEP);
      mpArcade(interiorGroup, arcMat, darkMat, 'x', 0, az1 - DEP/2, ax0, ax1, y0, hP, DEP);
      mpArcade(interiorGroup, arcMat, darkMat, 'z', ax0 + DEP/2, 0, az0 + DEP + 0.4, az1 - DEP - 0.4, y0, hP, DEP);
      mpArcade(interiorGroup, arcMat, darkMat, 'z', ax1 - DEP/2, 0, az0 + DEP + 0.4, az1 - DEP - 0.4, y0, hP, DEP);
    });
    // lean-to pantile roof over the upper gallery, tying it to the wings
    [[az0 + DEP/2, -1], [az1 - DEP/2, 1]].forEach(function(p){
      var sl = mpLeanSlope(hcRoof.mat, 'x', ax0, ax1, p[0] - p[1]*DEP/2, p[0] + p[1]*DEP/2, 11.2, 12.6);
      hcRoof.group.add(sl);
    });
    [[ax0 + DEP/2, -1], [ax1 - DEP/2, 1]].forEach(function(p){
      var sl2 = mpLeanSlope(hcRoof.mat, 'z', az0 + DEP, az1 - DEP, p[0] - p[1]*DEP/2, p[0] + p[1]*DEP/2, 11.2, 12.6);
      hcRoof.group.add(sl2);
    });
    registerPick(pickables, 'structure', 0, 5.6, az1 - DEP/2, 2*HC_COURT_HX, 11.2, DEP*2,
      '中庭回廊 Cloister Arcade', '高城の中庭を四周する二層の回廊。尖頭アーチが連なるレンガゴシックの代表的な内観。');
  })();
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
  // NOTE: the ditch band was previously placed at GROUND_Y-0.6 / -0.1,
  // i.e. entirely *underneath* the flat ground plane at GROUND_Y -- the
  // whole feature was invisible. Raised above the plane so it reads.
  var ditchFloor = mkBox(2*HC_HX+30, 0.3, DITCH_W, ditchMat);
  place(ditchFloor, 0, GROUND_Y+0.2, (DITCH_Z0+DITCH_Z1)/2);
  root.add(ditchFloor);
  [DITCH_Z0, DITCH_Z1].forEach(function(z){
    var retain = mkBox(2*HC_HX+30, 1.2, 0.8, stoneDarkMat);
    place(retain, 0, GROUND_Y+0.6, z);
    root.add(retain);
  });
  registerPick(pickables, 'structure', 0, GROUND_Y+0.4, (DITCH_Z0+DITCH_Z1)/2, 2*HC_HX+20, 1.0, DITCH_W*0.9,
    '高城⇔中城の乾堀 Dry Ditch', '幅20m・深さ15m [BW]。水を張らない空堀で高城と中城を隔てる。');
  var hcMcBridge = mkBox(4.6, 0.3, DITCH_W+3, woodMat);
  place(hcMcBridge, 0, GROUND_Y+0.95, (DITCH_Z0+DITCH_Z1)/2);
  root.add(hcMcBridge);

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
  // MC_WD (wing depth) is unmeasured △. 13m (was 10m) leaves a 54x87m
  // courtyard inside the 80x100m block, which lines up with the sheet's
  // "courtyard ~75m long" figure once the open south side is accounted
  // for, and reads with the building mass the aerial photo shows rather
  // than as a thin picture-frame outline.
  var MC_WD = 13, MC_WALL_H = 17; // △ 推定 (both unmeasured; height kept lower than the High Castle's 22m per photos)

  /* FADE GROUPS -- one PER WING, not one for all three.
   * Bug this fixes: all three wings used to share a single 'mcWings'
   * group whose `dir` was {0,0,1}. updateFade tests that one direction
   * against the camera, so at any azimuth looking roughly north the WHOLE
   * Middle Castle -- west, north and east wings together -- dissolved at
   * once and the middle third of the complex simply vanished mid-zoom,
   * while at other azimuths none of it ever opened up. Each wing now
   * carries its own outward-facing normal, so only the wing the camera is
   * actually looking through fades and the other two stay standing, which
   * is what the two-tier cutaway is supposed to look like. */
  var mcWingW = mpMakeFadeGroup('mcWingWest',  {x:-1,z:0}, false, BRICK_WALL);
  var mcWingN = mpMakeFadeGroup('mcWingNorth', {x:0,z:1},  false, BRICK_WALL);
  var mcWingE = mpMakeFadeGroup('mcWingEast',  {x:1,z:0},  false, BRICK_WALL);
  var mcRoofFg = mpMakeFadeGroup('mcRoofs', null, true, ROOF_COL);
  var mcRoofFg2 = mpMakeFadeGroup('mcRoofsAlt', null, true, ROOF_COL2);
  var mcPalaceFg = mpMakeFadeGroup('mcPalace', {x:-1,z:0}, false, BRICK_WALL_V);

  var MC_WX = -MC_HX + MC_WD/2, MC_EX = MC_HX - MC_WD/2;
  /* Wings are no longer three identical extruded bars. In the reference
   * photograph taken north from the main tower, the west wing (Great
   * Refectory + Grand Master's Palace) is visibly the tallest and deepest
   * mass, the north wing steps down and is broken by the Infirmary's
   * stepped gable, and the east wing is lower again with the gatehouse
   * cutting through it. Each wing is therefore split into segments of
   * differing height, and every segment terminates in a stepped gable. */
  // WEST wing: two segments, the southern (refectory) one taller
  mpRange(mcWingW, mcRoofFg, gblOuter, MC_WX, MC_Z0 + 30, MC_WD, 60, MC_WALL_H + 2, 'z',
    { gable:'a', dormers:3 });
  mpRange(mcWingW, mcRoofFg2, gblOuter, MC_WX, MC_Z0 + 71, MC_WD - 1, 26, MC_WALL_H - 1.5, 'z',
    { gable:'none', dormers:2 });
  // NORTH wing: lower, and split into two segments of different height so
  // its ridge line steps rather than running dead level for 80m
  mpRange(mcWingN, mcRoofFg, gblOuter, -20, MC_Z1 - MC_WD/2, 40, MC_WD, MC_WALL_H - 1, 'x',
    { gable:'a', dormers:2 });
  mpRange(mcWingN, mcRoofFg2, gblOuter, 20, MC_Z1 - MC_WD/2, 40, MC_WD, MC_WALL_H - 2.5, 'x',
    { gable:'b', dormers:2 });
  // EAST wing: guest ranges either side of the Middle Castle gate
  mpRange(mcWingE, mcRoofFg2, gblOuter, MC_EX, MC_Z0 + 26, MC_WD - 1, 52, MC_WALL_H - 2, 'z',
    { gable:'a', dormers:2 });
  mpRange(mcWingE, mcRoofFg, gblOuter, MC_EX, MC_Z0 + 74, MC_WD - 1, 22, MC_WALL_H - 0.5, 'z',
    { gable:'none', dormers:1 });
  registerPick(pickables, 'structure', 0, MC_WALL_H*0.5, (MC_Z0+MC_Z1)/2, 2*MC_HX+6, MC_WALL_H, MC_Z1-MC_Z0+6,
    '中城 Middle Castle', '高城の北、約80x100m [MH](実測は台形、ここでは矩形近似)。西・北・東の三翼が中庭を囲む。南側は乾堀を挟んで高城に面する。');

  /* Middle Castle courtyard: cobbled apron round the edges with a big
   * lawn in the middle, matching the reference photograph taken north
   * from the main tower (cobbles against the ranges, mown grass in the
   * centre). Previously just two thin cross paths on bare ground. */
  (function mcCourtyard(){
    var x0=-MC_HX+MC_WD, x1=MC_HX-MC_WD, z0=MC_Z0+2, z1=MC_Z1-MC_WD;
    var apron = mkBox(x1-x0, 0.24, z1-z0, cobbleMat);
    place(apron, (x0+x1)/2, 0.12, (z0+z1)/2);
    interiorGroup.add(apron);
    var mcLawnMat = new T.MeshLambertMaterial({ color: GRASS_COL2 });
    var lawn = mkBox((x1-x0)*0.56, 0.26, (z1-z0)*0.52, mcLawnMat);
    place(lawn, (x0+x1)/2 - 2, 0.14, (z0+z1)/2 + 4);
    interiorGroup.add(lawn);
  })();

  /* ---- Grand Master's Palace: WEST side, projecting from the west wing
   * [MH]◎, faces the Nogat river. Plan dims unmeasured -> 22x22m
   * assumed △. Height raised 20 -> 24m △: the sheet records the river
   * (west) elevation as 4 storeys + a mezzanine over a basement against
   * only 2 storeys on the courtyard side, and in the river photograph the
   * palace is unmistakably the tallest thing on the west front after the
   * main tower -- at 20m with a 6.5m ridge it sat lower than its own west
   * wing. It is now a proper tower-house: tall shaft, corbelled/stepped
   * upper storey, four octagonal corner turrets, a very steep hipped roof
   * and the big traceried hall windows that face the Nogat. */
  var GMP_W = 22, GMP_D = 22, GMP_H = 24;
  var GMP_CX = -MC_HX - GMP_W/2 + 3, GMP_CZ = MC_Z1 - 16;
  var gmpBody = mkBox(GMP_W, GMP_H, GMP_D, mcPalaceFg.mat);
  place(gmpBody, GMP_CX, GMP_H/2, GMP_CZ);
  mcPalaceFg.group.add(gmpBody);
  // battered base + corbel course marking the jettied upper storey
  var gmpBase = mkBox(GMP_W+1.6, 4.0, GMP_D+1.6, nicheMat);
  place(gmpBase, GMP_CX, 2.0, GMP_CZ);
  mcPalaceFg.group.add(gmpBase);
  var gmpCorb = mkBox(GMP_W+1.2, 0.55, GMP_D+1.2, trimMat);
  place(gmpCorb, GMP_CX, GMP_H*0.46, GMP_CZ);
  mcPalaceFg.group.add(gmpCorb);
  var trimBand = mkBox(GMP_W+0.9, 0.34, GMP_D+0.9, trimMat);
  place(trimBand, GMP_CX, GMP_H-0.6, GMP_CZ);
  mcPalaceFg.group.add(trimBand);
  // tall traceried hall windows to the river (west) and to north/south
  ['x-','z-','z+'].forEach(function(nrm){
    var off = (nrm==='x-') ? GMP_W/2+0.05 : GMP_D/2+0.05;
    mpLancetRow(mcPalaceFg.group, windowMat, nrm, GMP_CX, GMP_CZ, off, 4, 14, GMP_H*0.55, 5.2, 1.05);
    mpLancetRow(mcPalaceFg.group, windowMat, nrm, GMP_CX, GMP_CZ, off, 4, 14, GMP_H*0.20, 3.0, 0.8);
    mpBlindArcade(mcPalaceFg.group, nicheMat, nrm, GMP_CX, GMP_CZ, off-0.03, 5, 17, 5.0, GMP_H*0.34, 0.8);
  });
  // four slender corner turrets with conical caps
  [[-1,-1],[1,-1],[1,1],[-1,1]].forEach(function(s){
    var tx = GMP_CX + s[0]*(GMP_W/2-0.4), tz = GMP_CZ + s[1]*(GMP_D/2-0.4);
    var tw = mkCyl(1.5, 1.7, GMP_H+3.5, 8, mcPalaceFg.mat);
    place(tw, tx, (GMP_H+3.5)/2, tz);
    mcPalaceFg.group.add(tw);
    var tcap = mkCone(2.0, 5.0, 8, mcRoofFg.mat);
    place(tcap, tx, GMP_H+3.5+2.5, tz);
    mcRoofFg.group.add(tcap);
  });
  mpHipRoof(mcRoofFg.group, mcRoofFg.mat, GMP_CX, GMP_CZ, GMP_W+1.0, GMP_D+1.0, GMP_H, 13.5, 'z');
  registerPick(pickables, 'structure', GMP_CX, GMP_H*0.5, GMP_CZ, GMP_W+4, GMP_H, GMP_D,
    '大団長宮殿 Grand Master’s Palace', 'ノガト川に面する中城西側、西翼から張り出す団長の政庁兼住居 [MH]。西面は4階+中2階の塔状住宅。平面寸法は非公開のため22x22mと推定。');

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
  /* The 14 documented pointed-arch windows, now as full-height lancets
   * on the river face -- the Great Refectory's west wall is a near-
   * continuous screen of glass in the photographs, not a band of small
   * punched holes. */
  for (var rw=0; rw<14; rw++){
    var rwz = RF_CZ - RF_D/2 + 1.2 + rw*((RF_D-2.4)/13);
    mpLancet(mcWingW.group, windowMat, MC_WX-MC_WD/2*0.99, RF_H*0.26, rwz, Math.PI, 0.9, 4.6, 0.5);
  }

  /* ---- Infirmary Firmaria: north wing, west-leaning [MH][BW]○, whose
   * stepped gable is its signature silhouette. Now a projecting block
   * with a real stepped gable on its north face (the old call put four
   * bare terracotta-coped boxes on top of a wall and nothing else).
   * Dims unmeasured -> 推定. */
  var IF_CX = -22, IF_CZ = MC_Z1 - MC_WD/2, IF_W = 18, IF_H = MC_WALL_H + 2.5;
  var ifRise = mpRange(mcWingN, mcRoofFg, gblOuter, IF_CX, IF_CZ + 1.5, IF_W, MC_WD + 3, IF_H, 'z',
    { gable:'b', steps:5, dormers:0 });
  registerPick(pickables, 'structure', IF_CX, IF_H*0.5, IF_CZ, IF_W, IF_H + ifRise, MC_WD,
    '施療院 Infirmary', '北翼西寄り [MH][BW]。階段状の破風が目立つ。寸法は非公開のため近似。');

  /* ---- Middle Castle gatehouse: the complex's own main entrance is on
   * the EAST side of the Middle Castle (marked "Eingang" on the Commons
   * ground plan of the Ordensburg), between the two east-wing ranges.
   * Previously nothing marked it and the east wing ran unbroken. */
  (function mcGate(){
    var gz = MC_Z0 + 57, gw = 11, gd = MC_WD + 4, gh = MC_WALL_H + 7;
    var body = mkBox(gd, gh, gw, mcWingE.mat);
    place(body, MC_EX + 1, gh/2, gz);
    mcWingE.group.add(body);
    var arch = mkBox(gd*1.02, 6.2, 4.6, windowMat);
    place(arch, MC_EX + 1, 3.1, gz);
    interiorGroup.add(arch);
    mpBlindArcade(mcWingE.group, nicheMat, 'x+', MC_EX + 1 + gd/2, gz, 0.06, 3, 7.5, 8.0, gh-11, 0.9);
    mpAddCrenellations(mcWingE.group, mcWingE.mat, MC_EX + 1, gz, gw, Math.PI/2, gh, gd, 1.2);
    mpSteppedGable(gblOuter.brick, gblOuter.trim, gblOuter.niche, 'x',
      MC_EX + 1 + gd/2, gz, gw/2, gh, 7.0, 4, 1.1);
    var cap = mkCone(gw*0.62, 8.0, 4, mcRoofFg.mat);
    cap.rotation.y = Math.PI/4;
    place(cap, MC_EX + 1, gh + 1.2 + 4.0, gz);
    mcRoofFg.group.add(cap);
    registerPick(pickables, 'structure', MC_EX + 1, gh*0.45, gz, gd, gh, gw*1.4,
      '中城門 Middle Castle Gate', '中城東側の主入口 [平面図]。ここから城内の中枢へ入る。');
  })();

  /* ---- East wing: guest chambers + St Bartholomew's chapel (dims
   * unmeasured -> 推定; footprint/position only). */
  registerPick(pickables, 'structure', MC_EX, MC_WALL_H*0.5, MC_Z0 + 26, MC_WD, MC_WALL_H, 52,
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
  root.add(outMoatPlane);
  registerPick(pickables, 'structure', 0, GROUND_Y+0.35, (OUTMOAT_Z0+OUTMOAT_Z1)/2, 2*MC_HX+40, 1.0, OUTMOAT_W*0.85,
    '中城外周の堀 Middle Castle Outer Moat', '幅20m・深さ10m [BW]。中城と低城を隔てる水堀。');
  var mcLcBridge = mkBox(6.0, 0.3, OUTMOAT_W+3, woodMat);
  place(mcLcBridge, 0, GROUND_Y+0.5, (OUTMOAT_Z0+OUTMOAT_Z1)/2);
  root.add(mcLcBridge);

  /* ================================================================
   * LOW CASTLE Zamek Niski / Przedzamcze -- 140x270m rectangle [MH][ZO]
   * ◎, northernmost and largest block. Buildings arranged in 4
   * north-south rows [MH]○, incl. the Karwan (armoury/coach house,
   * 20x45m) and the round Maszynkowa Tower (dia 8.7m, wall 2.6m thick,
   * height <29m). Single castellated perimeter wall (height/thickness
   * unmeasured -> 推定). Tier 'outer'.
   * ================================================================ */
  var LC_HX = 70, LC_Z0 = OUTMOAT_Z1, LC_Z1 = LC_Z0 + 270; // [MH][ZO]◎ 140x270m
  // wall height/thickness are both unmeasured △. 6m/1.3m (the previous
  // values) read as a garden fence next to a 140m-wide ward and made the
  // whole outer bailey look like an empty paddock; 8.5m/1.8m matches the
  // proportion the aerial photograph shows against the ranges inside.
  var LC_WALL_H = 8.5, LC_WALL_T = 1.8; // △ 推定
  var LC_GATE_Z = (LC_Z0+LC_Z1)/2, LC_GATE_W = 4.6, LC_GATE_H = 5.2;

  var lcWallN = mpMakeFadeGroup('lcWallN', {x:0,z:1}, false, BRICK_WALL);
  var lcWallS = mpMakeFadeGroup('lcWallS', {x:0,z:-1}, false, BRICK_WALL);
  var lcWallE = mpMakeFadeGroup('lcWallE', {x:1,z:0}, false, BRICK_WALL);
  var lcWallW = mpMakeFadeGroup('lcWallW', {x:-1,z:0}, false, BRICK_WALL);
  var lcRoofFg = mpMakeFadeGroup('lcRoofs', null, true, ROOF_COL);
  var lcRoofFg2 = mpMakeFadeGroup('lcRoofsAlt', null, true, ROOF_COL2);
  /* Ranges are split into a WEST and an EAST fade group rather than one
   * 'lcBuildings' bucket facing {0,0,1}: with a single north-facing
   * normal every building in the 140x270m outer bailey faded in unison
   * the moment the camera swung north, and never faded from any other
   * side. Split east/west, only the row block the camera is actually
   * looking through opens up -- the same fix applied to the Middle
   * Castle's wings above. */
  // the two halves also carry slightly different brick tones, which stops
  // 20-odd ranges in one ward from reading as a single flat colour field
  var lcBuildW = mpMakeFadeGroup('lcBuildingsWest', {x:-1,z:0}, false, BRICK_WALL);
  var lcBuildE = mpMakeFadeGroup('lcBuildingsEast', {x:1,z:0}, false, BRICK_WALL_V);
  var lcBuildFg = lcBuildW; // kept for the few shared pieces below
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

  // intermediate wall towers along the two 270m-long flanks and the
  // 140m north wall -- the corner towers alone left ~130m of unbroken
  // wall reading as a bare fence line. Heights/positions △ 推定 (no
  // survey table for the outer-ward towers), spacing chosen so no run of
  // curtain exceeds ~70m, matching the aerial photograph's rhythm.
  [ {x:-LC_HX, z:LC_Z0+105}, {x:-LC_HX, z:LC_Z0+170}, {x:-LC_HX, z:LC_Z0+230},
    {x: LC_HX, z:LC_Z0+58},  {x: LC_HX, z:LC_Z0+215} ].forEach(function(p){
    mpSmallTower(p.x < 0 ? lcWallW : lcWallE, p.x, p.z, false, 3.4, LC_WALL_H+5.5, 5.0, lcRoofFg);
  });
  [-36, 36].forEach(function(tx){
    mpSmallTower(lcWallN, tx, LC_Z1, false, 3.4, LC_WALL_H+5.5, 5.0, lcRoofFg);
    mpSmallTower(lcWallS, tx, LC_Z0, false, 3.4, LC_WALL_H+4.0, 4.6, lcRoofFg);
  });

  /* ---- LOW CASTLE / VORBURG BUILDING FABRIC ---------------------------
   * THE headline problem with the previous build. It emitted 16 segments
   * from a 4-row table where every segment in a row shared one width, one
   * eave height and one shallow ridge, all gabled the same way along Z --
   * so the outer bailey rendered as a stamped grid of identical prisms
   * and read as a barracks camp or a warehouse district, not as Malbork.
   * The reference aerial and the view north from the main tower show
   * something quite different: ranges of visibly different heights and
   * depths, some running ACROSS the ward instead of along it, stepped
   * gables terminating almost every one of them, hipped roofs mixed in
   * among the gabled ones, dormers along the long slopes, and real open
   * yards and small squares left between the blocks.
   *
   * So the four documented north-south rows [MH]○ survive as the
   * organising grid -- the surveyed fact -- but each entry now specifies
   * its own width, height, roof form (gabled / hipped), which ends get a
   * stepped gable, and how many dormers, and a set of CROSS RANGES on the
   * X axis is threaded between them to break the stripes. Widths and
   * heights are all △ 推定 (no survey table exists for the outer-ward
   * ranges); only the Karwan's 20x45m footprint is measured.
   * `z` values are offsets from LC_Z0; `x` is the row centreline.
   *
   * The 140m width is divided into fixed BANDS so that the ranges, the
   * service lanes the residents walk, and the wall-side parcham the guard
   * patrol follows can never overlap:
   *   parcham W  -70..-62 | row 1 -62..-40 | lane A -40..-32
   *   row 2      -32..-10 | lane B -10..+2 | row 3   +2..+24
   *   lane C     +24..+36 | row 4 +36..+58 | parcham E +58..+70
   * Every segment below keeps |x| +/- w/2 inside its band, so no farmer
   * wander-box and no patrol waypoint ever falls inside a building.
   * ------------------------------------------------------------------ */
  function lcFg(x){ return x < 0 ? lcBuildW : lcBuildE; }
  function lcRoof(i){ return (i % 2) ? lcRoofFg2 : lcRoofFg; }
  var lcSegs = [
    // --- row 1 (west band, centre -51): tall storehouses behind the river wall
    { x:-51, w:22, z0:12,  z1:62,  h:12.5, gable:'both', dormers:3 },
    { x:-52, w:18, z0:70,  z1:104, h:8.5,  hip:true },
    { x:-50, w:20, z0:112, z1:158, h:11.0, gable:'a',   dormers:2 },
    { x:-53, w:15, z0:166, z1:196, h:7.5,  gable:'both', steps:3 },
    { x:-51, w:22, z0:206, z1:258, h:13.5, gable:'both', dormers:3, steps:5 },
    // --- row 2 (centre -21): Karwan at the south end (built separately),
    //     then low service sheds around a yard
    { x:-20, w:15, z0:74,  z1:100, h:7.0,  hip:true },
    { x:-21, w:20, z0:108, z1:150, h:10.5, gable:'both', dormers:2 },
    { x:-19, w:14, z0:158, z1:180, h:6.5,  hip:true },
    { x:-22, w:18, z0:196, z1:240, h:9.5,  gable:'b',   dormers:2 },
    // --- row 3 (centre 13): mixed workshops; chapel slots in at z 178-198
    { x: 13, w:18, z0:12,  z1:52,  h:9.0,  gable:'both', dormers:2 },
    { x: 15, w:14, z0:60,  z1:88,  h:6.5,  hip:true },
    { x: 13, w:21, z0:96,  z1:140, h:12.0, gable:'both', dormers:2, steps:5 },
    { x: 14, w:16, z0:206, z1:236, h:8.0,  gable:'a' },
    { x: 13, w:19, z0:244, z1:262, h:10.0, gable:'both', steps:3 },
    // --- row 4 (east band, centre 47): the long gabled range along the
    //     east wall that dominates the aerial photograph
    { x: 47, w:22, z0:12,  z1:60,  h:11.5, gable:'both', dormers:3 },
    { x: 48, w:18, z0:68,  z1:118, h:9.0,  gable:'b',   dormers:3 },
    { x: 47, w:22, z0:150, z1:206, h:13.0, gable:'both', dormers:3, steps:5 },
    { x: 49, w:17, z0:214, z1:258, h:8.5,  hip:true }
  ];
  lcSegs.forEach(function(s, i){
    var z0 = LC_Z0 + s.z0, z1 = LC_Z0 + s.z1;
    mpRange(lcFg(s.x), lcRoof(i), gblOuter, s.x, (z0+z1)/2, s.w, z1-z0, s.h, 'z',
      { gable: s.gable, hip: s.hip, dormers: s.dormers, steps: s.steps });
  });
  /* CROSS RANGES -- short blocks running EAST-WEST across the lanes.
   * Without these the ward still reads as four parallel stripes however
   * much the individual segments vary; in the aerial the Vorburg's
   * buildings clearly turn corners and enclose small yards. */
  [ { z:66,  x:-36, w:30, d:15, h:8.0,  gable:'both' },
    { z:146, x: -4, w:26, d:14, h:9.5,  hip:true },
    { z:200, x:-36, w:28, d:13, h:7.5,  gable:'both', steps:3 },
    { z:246, x: 30, w:24, d:16, h:10.5, gable:'both' }
  ].forEach(function(c, i){
    mpRange(lcFg(c.x), lcRoof(i+1), gblOuter, c.x, LC_Z0 + c.z, c.w, c.d, c.h, 'x',
      { gable: c.gable, hip: c.hip, steps: c.steps });
  });

  // Karwan (armoury/coach house), 20x45m [spec measured value]○ -- the
  // south end of row 2. Tall, with big cart doors and stepped gables.
  var KARWAN_CZ = LC_Z0 + 12 + 45/2;
  mpRange(lcBuildW, lcRoofFg, gblOuter, -20, KARWAN_CZ, 20, 45, 13.0, 'z',
    { gable:'both', dormers:3, steps:5 });
  [-1,1].forEach(function(sg){
    var door = mkBox(0.5, 5.4, 3.4, windowMat);
    place(door, -20 + sg*10.1, 2.7, KARWAN_CZ - 8);
    interiorGroup.add(door);
    var door2 = mkBox(0.5, 5.4, 3.4, windowMat);
    place(door2, -20 + sg*10.1, 2.7, KARWAN_CZ + 8);
    interiorGroup.add(door2);
  });
  registerPick(pickables, 'structure', -20, 6.5, KARWAN_CZ, 20, 13.0, 45,
    'カルワン Karwan', '武器庫兼車庫、20x45m。低城内の軍需・輸送を支えた実務施設。');

  // St Lawrence chapel -- taller, buttressed, with a stepped west gable
  // and a slim flèche, so it reads as a church rather than a shed
  var CHAPEL_CZ = LC_Z0 + 188;
  var CHAPEL_H = 12.5;
  var chapelBody = mkBox(12, CHAPEL_H, 20, lcBuildE.mat);
  place(chapelBody, 13, CHAPEL_H/2, CHAPEL_CZ);
  lcBuildE.group.add(chapelBody);
  for (var cb=0; cb<4; cb++){
    var cbz = CHAPEL_CZ - 7.5 + cb*5;
    [-1,1].forEach(function(sg3){
      var but = mkBox(1.9, CHAPEL_H-1.5, 1.1, lcBuildE.mat);
      place(but, 13 + sg3*6.6, (CHAPEL_H-1.5)/2, cbz);
      lcBuildE.group.add(but);
      var bc = mkBox(2.2, 0.28, 1.4, trimMat);
      place(bc, 13 + sg3*6.6, CHAPEL_H-1.5, cbz);
      lcBuildE.group.add(bc);
    });
  }
  ['x-','x+'].forEach(function(nrm){
    mpLancetRow(lcBuildE.group, windowMat, nrm, 13, CHAPEL_CZ, 6.1, 4, 14, 4.2, 5.0, 0.95);
  });
  mpGableRoof(lcRoofFg.group, lcRoofFg.mat, 'z', 13, CHAPEL_CZ, CHAPEL_CZ-10, CHAPEL_CZ+10, 6.3, CHAPEL_H, 9.0, false);
  [-1,1].forEach(function(sg4){
    mpSteppedGable(gblOuter.brick, gblOuter.trim, gblOuter.niche, 'z',
      13, CHAPEL_CZ + sg4*10, 6.0, CHAPEL_H, 9.0, 5, 1.0);
  });
  var spire = mkCone(1.2, 6.5, 8, lcRoofFg.mat);
  place(spire, 13, CHAPEL_H + 9.0 + 3.0, CHAPEL_CZ);
  lcRoofFg.group.add(spire);
  var cross = mkBox(0.16, 1.6, 0.16, goldMat);
  place(cross, 13, CHAPEL_H + 9.0 + 6.3 + 0.8, CHAPEL_CZ);
  lcRoofFg.group.add(cross);
  registerPick(pickables, 'structure', 13, CHAPEL_H*0.5, CHAPEL_CZ, 12, CHAPEL_H, 20,
    '聖ラウレンティウス礼拝堂 St Lawrence Chapel', '低城内の小礼拝堂。位置・外形は概略復元。');

  // cobble service lanes between the 4 rows + the east-gate cross lane +
  // two open squares, always-visible ground detail
  [-36, -4, 30].forEach(function(lx){   // lane band centres A / B / C
    var lane = mkBox(5.0, 0.22, LC_Z1-LC_Z0-18, cobbleMat);
    place(lane, lx, 0.13, (LC_Z0+LC_Z1)/2);
    interiorGroup.add(lane);
  });
  [ {x:-36, z:178, w:26, d:22}, {x:30, z:126, w:30, d:26} ].forEach(function(sq){
    var s = mkBox(sq.w, 0.2, sq.d, cobbleMat);
    place(s, sq.x, 0.12, LC_Z0 + sq.z);
    interiorGroup.add(s);
  });
  (function gateLane(){
    var lane = mkBox(LC_HX+44, 0.22, 6.0, cobbleMat);
    place(lane, LC_HX - (LC_HX+44)/2, 0.13, LC_GATE_Z);
    interiorGroup.add(lane);
  })();

  /* ================================================================
   * Nogat river -- west side of the ENTIRE complex, spanning from south
   * of the High Castle to north of the Low Castle. Distance from the
   * wall / terrace grading is not modelled (river sits flat above the
   * ground noise ceiling, same simplification castles/malbork.js uses);
   * the sheet's "川面から10-15m高い段丘上" fact is noted here but not
   * separately terraced.
   * ================================================================ */
  // RIVER_CX is already the band's CENTRE (it folds in RIVER_W/2), so it
  // is used directly in place() -- the previous code subtracted RIVER_W/2
  // a second time and pushed the Nogat 35m further west than the
  // RIVER_GAP it was supposedly derived from.
  var RIVER_W = 60, RIVER_GAP = 14;
  var RIVER_CX = -(LC_HX + RIVER_GAP + RIVER_W/2); // pinned off the widest (Low Castle) footprint
  var RIVER_Z_SPAN = (LC_Z1 - (GD_CZ-20)) ; // covers south of Gdanisko up to north of the Low Castle
  var riverCZ = (LC_Z1 + (GD_CZ-20))/2;
  var river = new T.Mesh(new T.PlaneGeometry(RIVER_W, RIVER_Z_SPAN+140), riverMat);
  river.rotation.x = -Math.PI/2;
  place(river, RIVER_CX, GROUND_Y+2.6, riverCZ);
  root.add(river);
  registerPick(pickables, 'structure', RIVER_CX, GROUND_Y+2.6, riverCZ, RIVER_W*0.7, 1.0, RIVER_Z_SPAN*0.7,
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
      root.add(g);
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
  /* ================================================================
   * RE-CENTRE the finished model on the camera target (see the `root`
   * comment at the top of this function). MODEL_CZ is the midpoint of
   * the built Z extent: the Gdanisko's south face at the far south end,
   * the Low Castle's north wall at the far north end. Shifting `root` by
   * -MODEL_CZ leaves the sheet coordinates used everywhere above intact
   * while putting the complex's centre of mass on the world origin the
   * camera orbits. Pickables live outside `group` in world space and the
   * `life` waypoints drive residentGroup (parented to the scene), so both
   * need the identical shift applied by hand -- done here, BEFORE
   * buildLabelGroup() reads pickable positions to place its sprites.
   * ================================================================ */
  var MODEL_CZ = (LC_Z1 + (GD_CZ - GD_D/2)) / 2;
  var ZOFF = -MODEL_CZ;
  root.position.z = ZOFF;
  pickables.forEach(function(p){ p.position.z += ZOFF; p.updateMatrixWorld(true); });

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
    /* Wander boxes. These must agree with the Low Castle band layout
     * documented above the lcSegs table (lanes A -40..-32, B -10..+2,
     * C +24..+36) AND dodge the four east-west CROSS RANGES, which sit at
     * z offsets 58-74 / 139-153 / 193-207 / 238-254 and would otherwise
     * have farmers strolling through solid brick. Each lane is therefore
     * cut into the three clear z bands between those cross ranges. */
    courtyard: (function(){
      var boxes = [ { minX:-MC_HX+MC_WD+3, maxX:MC_HX-MC_WD-3, minZ:MC_Z0+4, maxZ:MC_Z1-MC_WD-3 } ]; // 中城中庭
      var lanes = [ [-39,-33], [-9,1], [25,35] ];       // 低城 3本の通路
      var bands = [ [16,56], [78,136], [156,190], [210,235] ]; // 交差棟を避けた z 帯
      lanes.forEach(function(l){
        bands.forEach(function(b){
          boxes.push({ minX:l[0], maxX:l[1], minZ:LC_Z0+b[0], maxZ:LC_Z0+b[1] });
        });
      });
      boxes.push({ minX:60, maxX:68, minZ:LC_GATE_Z-14, maxZ:LC_GATE_Z+14 }); // 東門前の広場(parcham)
      return boxes;
    })(),
    /* Patrol runs the parcham -- the clear strip between the curtain wall
     * and the outermost range (west -70..-62, east +58..+70) -- then down
     * lane B and through the Middle Castle courtyard to the dry-ditch
     * bridge. x=+/-64 lands inside the parcham by construction. */
    patrol: [
      [-64,0,LC_Z0+6], [-64,0,LC_Z1-6], [64,0,LC_Z1-6],
      [64,0,LC_GATE_Z+10], [64,0,LC_GATE_Z-10], [64,0,LC_Z0+6],
      [-4,0,LC_Z0+6], [-4,0,OUTMOAT_Z0+OUTMOAT_W/2], [0,0,MC_Z1-MC_WD-4],
      [0,0,MC_Z0+8], [0,0,DITCH_Z0+DITCH_W/2], [0,0,MC_Z0+8], [-4,0,LC_Z0+6]
    ],
    population: { farmers: 26, guards: 9 }
  };
  // apply the same rigid Z shift `root` got, so residents (parented to
  // the scene, not to this castle's group) walk the re-centred model.
  life.gates.forEach(function(g){ g.path.forEach(function(p){ p.z += ZOFF; }); });
  life.courtyard.forEach(function(c){ c.minZ += ZOFF; c.maxZ += ZOFF; });
  life.patrol.forEach(function(p){ p[2] += ZOFF; });

  return { group: group, fadeGroups: fadeGroups, interiorGroup: interiorGroup, info: info,
    pickables: pickables, windowMat: windowMat, waterMats: [riverMat, moatWaterMat], labelGroup: labelGroup, life: life };
}

registerCastle({
  id: 'malbork',
  name: 'Malbork Castle',
  nameJa: 'マルボルク城',
  country: 'Poland',
  countryJa: 'ポーランド',
  flag: '🇵🇱',
  year: '1406',
  description: 'チュートン騎士団が築いた世界最大級のレンガ造城塞。高城51x61m・中城80x100m・低城140x270mが南北約470mに連なり、南西隅には60m突き出す便所塔グダニスコが尖頭アーチ5連の架橋で結ばれる。公開実測寸法に基づく再現。',
  build: buildMalborkPlan,
  // The build re-centres itself on the world origin (see MODEL_CZ /
  // ZOFF), so the model the camera actually orbits spans roughly
  // x -160..+75 (Nogat river to Low Castle east gate) and z -282..+282,
  // i.e. a half-extent of ~282m along the long axis. These numbers were
  // derived from that box for the viewer's fixed opening azimuth
  // (-0.22pi) / elevation (0.42 rad) and fov 42, then checked against
  // actual screenshots rather than trusted from the trigonometry alone:
  //   initDist 580  -- measured off screenshots: the whole High->Middle
  //                    ->Low chain sits inside the frame with a margin on
  //                    every edge; 660+ leaves it small and lost, 520 and
  //                    below clips the Low Castle's near corner
  //   zMax 820      -- keeps the opening reveal at (820-580)/(820-70)
  //                    = 0.32, i.e. below WALL_START 0.35, so the castle
  //                    opens as a solid exterior (same feel as
  //                    malbork.js's own 0.28)
  //   fogNear 760   -- 520 put the far (High Castle) end of a 564m-long
  //                    complex inside the fog ramp and washed it out
  //   envScale 2.6  -- puts the innermost mountain ring at 340*2.6=884m,
  //                    clear of both the 282m model and the 580m orbit
  //   envLift -80   -- drops that ring's ridgeline back inside the
  //                    frustum at this camera height (26 + 580*sin 0.42
  //                    = ~262m), same trick Vincennes/malbork.js use
  view: { targetY: 26, zMin: 70, zMax: 820, initDist: 580,
    fogNear: 760, fogFar: 2600, shadowExtent: 340, shadowFar: 1400,
    camFar: 4200, panLimit: 300, envScale: 2.6, envLift: -80 }
});
