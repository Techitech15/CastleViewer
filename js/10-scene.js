"use strict";

/* ====================================================================
 * 3. scene / renderer setup
 * ==================================================================== */
var canvas = document.getElementById('stage');
var renderer = new T.WebGLRenderer({ canvas:canvas, antialias:true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1, 2));
renderer.shadowMap.enabled = true;
renderer.shadowMap.type = T.PCFSoftShadowMap;

var scene = new T.Scene();
// sky is an 8x512 canvas gradient (6 colour stops), repainted every frame
// from the currently-blended time-of-day state -- see section 3.5. Cheap
// enough to repaint continuously (skill: threejs-landscape / "sky dome").
var skyCanvas = document.createElement('canvas');
skyCanvas.width = 8; skyCanvas.height = 512;
var skyCtx = skyCanvas.getContext('2d');
var skyTex = new T.CanvasTexture(skyCanvas);
scene.background = skyTex;
scene.fog = new T.Fog(0xcdddE3, 90, 320);
// per-castle view scale: multiplies every TIME_STATES fog near/far value
// (see applyEnvironment) and the background mountain rings' radius + Y
// position, so a much larger castle (e.g. Vincennes) can push fog/
// mountains out (and lift them back into frame -- see applyCastle) without
// touching the tuned per-time-of-day numbers. Derived in applyCastle from
// view.fogNear/fogFar (relative to Bodiam's own view: 90/320) and
// view.envScale/envLift; defaults (1/1/1/0) leave everything exactly as
// today for a castle that omits them.
var FOG_NEAR_SCALE = 1, FOG_FAR_SCALE = 1, ENV_SCALE = 1, ENV_LIFT = 0;

var camera = new T.PerspectiveCamera(42, 1, 0.5, 1000);

var hemi = new T.HemisphereLight(0xdfe9f2, 0x4a4530, 0.65);
scene.add(hemi);
var sun = new T.DirectionalLight(0xfff2d8, 1.55);
sun.position.set(60, 85, 40);
sun.castShadow = true;
sun.shadow.mapSize.set(2048, 2048);
sun.shadow.camera.near = 10;
sun.shadow.camera.far = 220;
sun.shadow.camera.left = -60; sun.shadow.camera.right = 60;
sun.shadow.camera.top = 60; sun.shadow.camera.bottom = -60;
sun.shadow.bias = -0.0012;
scene.add(sun); scene.add(sun.target);
var fill = new T.AmbientLight(0xffffff, 0.22);
scene.add(fill);
