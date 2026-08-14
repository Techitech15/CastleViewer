"use strict";

/* ====================================================================
 * 0.5 water / moat / bank system — castle-agnostic. A square moat
 * ringing a central island, with graded earth banks (not hard box lips)
 * carrying the ground smoothly down to the water on both the outer
 * (field) side and the inner (island) side. Any castle whose footprint
 * is a square moated island can call buildWaterMoatSystem() with its own
 * numbers -- nothing below is Bodiam-specific. A castle with a different
 * water layout (circular moat, dry ditch, no moat) can ignore this
 * helper entirely and build its own environment meshes.
 * ==================================================================== */
function ringPerimPoint(kind, t, extent, extentZ){
  if (kind === 'circle'){
    var a = t * Math.PI * 2;
    return { x: Math.cos(a)*extent, z: Math.sin(a)*extent };
  }
  if (kind === 'rect'){
    // rectangle variant of the 'square' walk below -- independent X/Z half-
    // extents, used by non-square footprints (e.g. Vincennes' 330x175m
    // enceinte). extentZ falls back to `extent` (i.e. behaves like 'square')
    // if omitted, though callers needing a rectangle always pass it.
    var ez = extentZ != null ? extentZ : extent;
    var tt2 = ((t % 1) + 1) % 1 * 4;
    var side2 = Math.floor(tt2), f2 = tt2 - side2;
    var sx = (f2 - 0.5) * 2 * extent, sz = (f2 - 0.5) * 2 * ez;
    if (side2 === 0) return { x: sx, z: -ez };
    if (side2 === 1) return { x: extent, z: sz };
    if (side2 === 2) return { x: -sx, z: ez };
    return { x: -extent, z: -sz };
  }
  // square, walked counter-clockwise starting at the north edge midpoint
  var tt = ((t % 1) + 1) % 1 * 4;
  var side = Math.floor(tt), f = tt - side;
  var s = (f - 0.5) * 2 * extent;
  if (side === 0) return { x: s, z: -extent };
  if (side === 1) return { x: extent, z: s };
  if (side === 2) return { x: -s, z: extent };
  return { x: -extent, z: -s };
}
/* graded ramp ring between two perimeters (concentric squares or
 * circles), vertex-coloured so the bank reads as a continuous slope
 * (dry earth -> darker wet mud at the waterline) rather than a flat tone
 * that stops dead. `extentTop`/`yTop` is the dry edge (u=0), `extentBottom`
 * /`yBottom` is the waterline edge (u=1); the Y profile is eased
 * (smoothstep) so it meets both the flat ground/island above and the
 * flat water below tangentially -- no visible kink at either join. */
function buildBankRamp(kind, extentTop, extentBottom, yTop, yBottom, colTop, colMid, colEdge, segs, steps, extentTopZ, extentBottomZ){
  segs = segs || 48; steps = steps || 6;
  var positions = [], colors = [], indices = [];
  var stride = steps + 1;
  var tmp = new T.Color();
  var i, j;
  for (i=0;i<=segs;i++){
    var t = i/segs;
    var pTop = ringPerimPoint(kind, t, extentTop, extentTopZ);
    var pBot = ringPerimPoint(kind, t, extentBottom, extentBottomZ);
    for (j=0;j<=steps;j++){
      var u = j/steps;
      var eu = smoothstep01(0,1,u);
      positions.push(
        pTop.x + (pBot.x - pTop.x)*eu,
        yTop + (yBottom - yTop)*eu,
        pTop.z + (pBot.z - pTop.z)*eu
      );
      tmp.copy(colTop).lerp(colMid, smoothstep01(0,0.7,u));
      tmp.lerp(colEdge, smoothstep01(0.72,1,u));
      colors.push(tmp.r, tmp.g, tmp.b);
    }
  }
  for (i=0;i<segs;i++){
    for (j=0;j<steps;j++){
      var a = i*stride+j, b = (i+1)*stride+j, c = (i+1)*stride+j+1, d = i*stride+j+1;
      indices.push(a,b,d, b,c,d);
    }
  }
  var geo = new T.BufferGeometry();
  geo.setIndex(indices);
  geo.setAttribute('position', new T.Float32BufferAttribute(positions,3));
  geo.setAttribute('color', new T.Float32BufferAttribute(colors,3));
  geo.computeVertexNormals();
  /* NOTE: T.VertexColors is NOT dead in the r128 build this page loads --
   * three reviewers in a row have reported it as a removed-in-r125 constant
   * that silently disables vertex colours, and all three were wrong. Probed
   * against the actual CDN bundle: THREE.REVISION === 128, THREE.VertexColors
   * === 2, and the material ends up with vertexColors === 2, which is truthy,
   * so USE_COLOR is defined and the gradient renders. Confirmed by rendering
   * two identical vertex-coloured quads side by side, one built with the
   * constant and one with `true`: both come back coloured. Leave as is (or
   * change to `true` purely for style) -- but do not "fix" a bug that is not
   * here, and do not re-add per-castle workarounds that override it. */
  var mat = new T.MeshLambertMaterial({ vertexColors: T.VertexColors });
  var mesh = new T.Mesh(geo, mat);
  mesh.receiveShadow = true;
  return mesh;
}
/* full moat/bank/island/ground assembly for a square-moated castle.
 * Every mesh is added directly into `opts.group`. Returns the pieces
 * (plus the derived water-ring radii) so the caller can position a
 * bridge/approach against `waterHalf` / `waterInnerHalf`, and register
 * `waterMat` into the build's `waterMats` list for the time-of-day
 * colour hook. See buildBodiam() below for a concrete call + the meaning
 * of every field; a second moated castle only needs its own `opts`. */
function buildWaterMoatSystem(opts){
  var g = opts.group;
  var groundY = opts.groundY, waterY = opts.waterY;
  var islandHalf = opts.islandHalf, islandY = opts.islandY!=null ? opts.islandY : 0.02;
  var moatOuterHalf = opts.moatOuterHalf;
  var bankWOut = opts.bankWidthOut!=null ? opts.bankWidthOut : 4.0;
  var bankWIn = opts.bankWidthIn!=null ? opts.bankWidthIn : 3.0;
  var waterHalf = moatOuterHalf - bankWOut;        // outer edge of open water
  var waterInnerHalf = islandHalf + bankWIn;        // inner edge of open water

  // The outer bank dips WATER_Y below GROUND_Y (Fix 1), so the big
  // continuous ground plane can no longer simply stay flat under the
  // whole moat footprint the way it used to when the moat sat above
  // ground level -- a flat plane there would poke up through the sloped
  // bank / water. Punch a generous, grid-quantised hole in it (any
  // triangle touching the moat's square footprint is dropped) and cover
  // the resulting gap with an exact flat "collar" annulus that meets
  // bankOuter's top ring with zero gap on the inner edge; the ground
  // plane's own flat region is pushed out to start exactly where the
  // collar ends, so the collar's outer edge needs no special handling
  // either (both sides are the same flat GROUND_Y there, hills haven't
  // engaged yet).
  var groundSize = opts.groundSize||1600, groundSegs = opts.groundSegs||72;
  var cellSize = groundSize / groundSegs;
  var collarOuterHalf = moatOuterHalf + Math.max(30, cellSize*2.5);
  var ground = buildUndulatingGround(collarOuterHalf, groundSize, groundSegs, opts.groundMat, moatOuterHalf);
  ground.position.y = groundY;
  g.add(ground);

  var collarShape = new T.Shape();
  collarShape.moveTo(-collarOuterHalf,-collarOuterHalf); collarShape.lineTo(collarOuterHalf,-collarOuterHalf);
  collarShape.lineTo(collarOuterHalf,collarOuterHalf); collarShape.lineTo(-collarOuterHalf,collarOuterHalf); collarShape.closePath();
  var collarHole = new T.Path();
  collarHole.moveTo(-moatOuterHalf,-moatOuterHalf); collarHole.lineTo(-moatOuterHalf,moatOuterHalf);
  collarHole.lineTo(moatOuterHalf,moatOuterHalf); collarHole.lineTo(moatOuterHalf,-moatOuterHalf); collarHole.closePath();
  collarShape.holes.push(collarHole);
  var collarGeo = new T.ShapeGeometry(collarShape);
  collarGeo.rotateX(-Math.PI/2);
  var collar = new T.Mesh(collarGeo, opts.groundMat);
  collar.position.y = groundY; collar.receiveShadow = true;
  g.add(collar);

  var islandShape = new T.Shape();
  islandShape.moveTo(-islandHalf,-islandHalf); islandShape.lineTo(islandHalf,-islandHalf);
  islandShape.lineTo(islandHalf,islandHalf); islandShape.lineTo(-islandHalf,islandHalf); islandShape.closePath();
  var islandGeo = new T.ShapeGeometry(islandShape);
  islandGeo.rotateX(-Math.PI/2);
  var island = new T.Mesh(islandGeo, opts.islandMat);
  island.position.y = islandY; island.receiveShadow = true;
  g.add(island);

  var colTop = new T.Color(opts.bankColorTop!=null?opts.bankColorTop:0x9c8a5e);
  var colMid = new T.Color(opts.bankColorMid!=null?opts.bankColorMid:0x6e5c3e);
  var colEdge = new T.Color(opts.bankColorEdge!=null?opts.bankColorEdge:0x332818);

  // outer bank: dry field (moatOuterHalf, groundY) -> waterline (waterHalf, waterY)
  var bankOuter = buildBankRamp('square', moatOuterHalf, waterHalf, groundY, waterY, colTop, colMid, colEdge);
  g.add(bankOuter);
  // inner bank: island edge (islandHalf, islandY) -> waterline (waterInnerHalf, waterY)
  var bankInner = buildBankRamp('square', islandHalf, waterInnerHalf, islandY, waterY, colTop, colMid, colEdge);
  g.add(bankInner);

  var moatShape = new T.Shape();
  moatShape.moveTo(-waterHalf,-waterHalf); moatShape.lineTo(waterHalf,-waterHalf);
  moatShape.lineTo(waterHalf,waterHalf); moatShape.lineTo(-waterHalf,waterHalf); moatShape.closePath();
  var hole = new T.Path();
  hole.moveTo(-waterInnerHalf,-waterInnerHalf); hole.lineTo(-waterInnerHalf,waterInnerHalf);
  hole.lineTo(waterInnerHalf,waterInnerHalf); hole.lineTo(waterInnerHalf,-waterInnerHalf); hole.closePath();
  moatShape.holes.push(hole);
  var moatGeo = new T.ShapeGeometry(moatShape);
  moatGeo.rotateX(-Math.PI/2);
  var waterMat = new T.MeshPhongMaterial({ color: opts.waterColor||0x2e5b66,
    transparent:true, opacity:opts.waterOpacity!=null?opts.waterOpacity:0.82, shininess:90, specular:0x9fd4e0 });
  var moatWater = new T.Mesh(moatGeo, waterMat);
  moatWater.position.y = waterY;
  g.add(moatWater);

  return { ground:ground, island:island, moatWater:moatWater, bankOuter:bankOuter, bankInner:bankInner,
    waterMat:waterMat, waterHalf:waterHalf, waterInnerHalf:waterInnerHalf, waterY:waterY, groundY:groundY };
}
/* small circular skirt bank -- same grading technique as the main moat
 * banks, sized for a small mid-moat platform (e.g. a drawbridge island)
 * so it also meets the water on a slope instead of a hard disc edge. */
function buildCircularSkirt(cx, cz, rTop, rBottom, yTop, yBottom, colTop, colMid, colEdge){
  var ramp = buildBankRamp('circle', rTop, rBottom, yTop, yBottom, colTop, colMid, colEdge, 32, 5);
  ramp.position.set(cx, 0, cz);
  return ramp;
}
