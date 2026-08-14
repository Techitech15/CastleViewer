"use strict";

/* ====================================================================
 * 6.5 住人(村人・衛兵) — 全城共通の汎用システム。
 * 城の build() が返す任意フィールド `life` ({gates, courtyard, patrol,
 * population}) を読んでウェイポイント歩行のNPCを配置する。ジオメトリ/
 * マテリアルは種類ごとに一度だけ生成し(この直下のトップレベル変数)、
 * 城切替やトグルOFFでは個体(THREE.Group)だけを破棄して使い回す --
 * 共有ジオメトリ/マテリアルを毎回 dispose/再生成しないので 1体ごとの
 * コストはゼロに近い。カットアウェイの opacity フェードとは無関係
 * (常に不透明)なので、共有マテリアルへ per-NPC の transparent/opacity
 * を書き込む必要がない。門をまたぐ「歩き去ってフェード消滅」は、その
 * 代わりに一様スケールを 1→0 へ縮めることで表現する(遠ざかりながら
 * 小さくなって消える、という安価な近似)。
 * 衛兵の巡回はすべて y=0(地面)上のウェイポイントで組んである -- 城壁の
 * 上を歩かせると、ズームインで壁がフェードした際に空中に浮いて見える
 * ため、あえて壁沿いの地上ルートにしてある。
 * ==================================================================== */
var NPC_BODY_GEO  = new T.CylinderGeometry(0.16, 0.20, 1.4, 6);
var NPC_HEAD_GEO  = new T.SphereGeometry(0.15, 6, 5);
var NPC_SPEAR_GEO = new T.CylinderGeometry(0.018, 0.028, 1.9, 5);
var FARMER_BODY_MAT = new T.MeshLambertMaterial({ color: 0x8a6a42 }); // 農民: 茶
var FARMER_HEAD_MAT = new T.MeshLambertMaterial({ color: 0xd9ac7c }); // 肌
var GUARD_BODY_MAT  = new T.MeshLambertMaterial({ color: 0x6b7078 }); // 衛兵: 鋼色
var GUARD_HEAD_MAT  = new T.MeshLambertMaterial({ color: 0x555a60 }); // 兜
var SPEAR_MAT       = new T.MeshLambertMaterial({ color: 0x2a2a2a }); // 槍

function makeNpcObject(kind){
  var g = new T.Group();
  var body = new T.Mesh(NPC_BODY_GEO, kind === 'guard' ? GUARD_BODY_MAT : FARMER_BODY_MAT);
  body.position.y = 0.7;
  body.castShadow = true;
  g.add(body);
  var head = new T.Mesh(NPC_HEAD_GEO, kind === 'guard' ? GUARD_HEAD_MAT : FARMER_HEAD_MAT);
  head.position.y = 1.4 + 0.15;
  head.castShadow = true;
  g.add(head);
  if (kind === 'guard'){
    var spear = new T.Mesh(NPC_SPEAR_GEO, SPEAR_MAT);
    spear.position.set(0.24, 1.05, 0.02);
    spear.rotation.z = 0.08;
    spear.castShadow = true;
    g.add(spear);
  }
  return g;
}
function rand(a,b){ return a + Math.random()*(b-a); }
function pickCourtyardPoint(courtyard){
  var rects = (courtyard && courtyard.length) ? courtyard : [{minX:-5,maxX:5,minZ:-5,maxZ:5}];
  var r = rects[Math.floor(Math.random()*rects.length)];
  return { x: rand(r.minX, r.maxX), z: rand(r.minZ, r.maxZ) };
}
// dt駆動の進行方向への向き補間(最短回転方向へ、最大角速度でクランプ)
function faceToward(obj, dx, dz, dt, turnSpeed){
  if (Math.abs(dx) < 1e-5 && Math.abs(dz) < 1e-5) return;
  var targetAngle = Math.atan2(dx, dz);
  var diff = targetAngle - obj.rotation.y;
  while (diff > Math.PI) diff -= Math.PI*2;
  while (diff < -Math.PI) diff += Math.PI*2;
  var maxStep = (turnSpeed || 6) * dt;
  obj.rotation.y += (Math.abs(diff) <= maxStep) ? diff : Math.sign(diff)*maxStep;
}
// waypoint (tx,tz) へ向けて speed*dt だけ進める。到達したら true を返す。
function stepToward(obj, tx, tz, speed, dt){
  var dx = tx - obj.position.x, dz = tz - obj.position.z;
  var dist = Math.hypot(dx, dz);
  if (dist < 0.05) return true;
  var step = Math.min(dist, speed*dt);
  obj.position.x += dx/dist*step;
  obj.position.z += dz/dist*step;
  faceToward(obj, dx, dz, dt, 6);
  return step >= dist - 1e-4;
}
// 門〜消失点区間の進行距離からフェード用スケールを求める(区間後半60%
// だけ 1→0.04 へ縮める。手前側はずっと等身大のまま)。
function gateFadeScale(travelled, vanishDist){
  var fadeStart = vanishDist*0.6;
  if (travelled <= fadeStart) return 1;
  return Math.max(0.04, 1 - (travelled-fadeStart)/(vanishDist-fadeStart));
}

var residentsOn = false;
var residentGroup = new T.Group();
scene.add(residentGroup);
var residents = []; // { obj, kind, state, ... } のフラット配列

// gate.path は「中庭側の内側口 -> (壁/塔/橋を貫く中間waypoint...) -> 場外
// 側の外側口」の中心線を並べた配列(最低2点)。内側口=path[0]、外側口=
// path末尾。'through'/'throughIn' がこの中間区間を等身大のまま順に歩き、
// 開口・橋の通路を実際に通り抜けて見えるようにする(壁や扉をすり抜けな
// い)。'outside' のフェード(場外への消失)は外側口を起点に計測する。
function gateOuterPoint(gate){ return gate.path[gate.path.length-1]; }
function gateInnerPoint(gate){ return gate.path[0]; }
function newFarmer(life){
  var obj = makeNpcObject('farmer');
  var npc = { obj:obj, kind:'farmer', speed: rand(1.0,1.5), idle:0 };
  var startAtGate = life.gates && life.gates.length && Math.random() < 0.3;
  if (startAtGate){
    var gate = life.gates[Math.floor(Math.random()*life.gates.length)];
    var outer = gateOuterPoint(gate);
    var vd = gate.vanishDist || 40;
    var t = rand(0.08, 0.92);
    var travelled = vd*t;
    npc.gate = gate;
    npc.state = Math.random() < 0.5 ? 'outside' : 'returning'; // 橋の途中から半々で出入りを再現
    var dirSign = npc.state === 'outside' ? 1 : -1;
    obj.position.set(outer.x + gate.outDir.x*travelled, 0, outer.z + gate.outDir.z*travelled);
    obj.rotation.y = Math.atan2(gate.outDir.x*dirSign, gate.outDir.z*dirSign);
    obj.scale.setScalar(gateFadeScale(travelled, vd));
  } else {
    var pt = pickCourtyardPoint(life.courtyard);
    obj.position.set(pt.x, 0, pt.z);
    npc.state = 'wander';
    npc.wx = pt.x; npc.wz = pt.z;
    npc.idle = rand(0, 2);
  }
  return npc;
}
function updateFarmer(npc, life, dt){
  var obj = npc.obj;
  if (npc.state === 'wander'){
    if (npc.idle > 0){ npc.idle -= dt; return; }
    if (stepToward(obj, npc.wx, npc.wz, npc.speed, dt)){
      if (life.gates && life.gates.length && Math.random() < 0.12){
        npc.gate = life.gates[Math.floor(Math.random()*life.gates.length)];
        npc.state = 'toGate';
      } else {
        var pt = pickCourtyardPoint(life.courtyard);
        npc.wx = pt.x; npc.wz = pt.z;
        npc.idle = rand(0.6, 3.2); // たまに立ち止まる
      }
    }
  } else if (npc.state === 'toGate'){
    var inner = gateInnerPoint(npc.gate);
    if (stepToward(obj, inner.x, inner.z, npc.speed, dt)){
      npc.pathIdx = 1;
      npc.state = npc.pathIdx < npc.gate.path.length ? 'through' : 'outside';
    }
  } else if (npc.state === 'through'){
    // 開口・橋を実寸のまま歩いて通り抜ける区間(壁や扉をすり抜けない)
    var wp = npc.gate.path[npc.pathIdx];
    if (stepToward(obj, wp.x, wp.z, npc.speed, dt)){
      npc.pathIdx++;
      if (npc.pathIdx >= npc.gate.path.length) npc.state = 'outside';
    }
  } else if (npc.state === 'outside'){
    var g = npc.gate, vd = g.vanishDist || 40, outer = gateOuterPoint(g);
    var tx = outer.x + g.outDir.x*vd, tz = outer.z + g.outDir.z*vd;
    var arrived = stepToward(obj, tx, tz, npc.speed, dt);
    var travelled = Math.hypot(obj.position.x-outer.x, obj.position.z-outer.z);
    obj.scale.setScalar(gateFadeScale(travelled, vd));
    if (arrived){
      obj.visible = false;
      npc.state = 'hidden';
      npc.hiddenT = rand(3, 9);
    }
  } else if (npc.state === 'hidden'){
    npc.hiddenT -= dt;
    if (npc.hiddenT <= 0){
      obj.visible = true;
      obj.scale.setScalar(0.04);
      npc.state = 'returning';
    }
  } else if (npc.state === 'returning'){
    var g2 = npc.gate, vd2 = g2.vanishDist || 40, outer2 = gateOuterPoint(g2);
    var arrived2 = stepToward(obj, outer2.x, outer2.z, npc.speed, dt);
    var travelled2 = Math.hypot(obj.position.x-outer2.x, obj.position.z-outer2.z);
    obj.scale.setScalar(gateFadeScale(travelled2, vd2));
    if (arrived2){
      obj.scale.setScalar(1);
      npc.pathIdx = npc.gate.path.length - 2;
      if (npc.pathIdx >= 0){
        npc.state = 'throughIn';
      } else {
        var pt2b = pickCourtyardPoint(life.courtyard);
        npc.wx = pt2b.x; npc.wz = pt2b.z;
        npc.state = 'wander';
        npc.idle = rand(0.3, 1.5);
      }
    }
  } else if (npc.state === 'throughIn'){
    // 場外から戻り、開口・橋を逆順に実寸のまま歩いて中庭側の内側口へ
    var wp2 = npc.gate.path[npc.pathIdx];
    if (stepToward(obj, wp2.x, wp2.z, npc.speed, dt)){
      npc.pathIdx--;
      if (npc.pathIdx < 0){
        var pt2 = pickCourtyardPoint(life.courtyard);
        npc.wx = pt2.x; npc.wz = pt2.z;
        npc.state = 'wander';
        npc.idle = rand(0.3, 1.5);
      }
    }
  }
}
function newGuard(life, i, count){
  var obj = makeNpcObject('guard');
  var patrol = (life.patrol && life.patrol.length >= 2) ? life.patrol : [[0,0,-3],[0,0,3]];
  var idx = Math.floor((i/count) * patrol.length) % patrol.length;
  var wp = patrol[idx];
  obj.position.set(wp[0], 0, wp[2]);
  return { obj:obj, kind:'guard', speed: rand(0.8,1.1), patrol:patrol, idx:idx };
}
function updateGuard(npc, dt){
  var target = npc.patrol[npc.idx];
  if (stepToward(npc.obj, target[0], target[2], npc.speed, dt)){
    npc.idx = (npc.idx + 1) % npc.patrol.length;
  }
}
function disposeResidents(){
  // 共有ジオメトリ/マテリアルは dispose しない(城を跨いで使い回す) --
  // 個体の THREE.Group を residentGroup から外すだけで十分。
  residents.forEach(function(npc){ residentGroup.remove(npc.obj); });
  residents.length = 0;
}
function regenerateResidents(){
  disposeResidents();
  if (!residentsOn || !current || !current.life) return;
  var life = current.life;
  var pop = life.population || { farmers:8, guards:2 };
  var isNight = timeTrans.key === 'night';
  var farmerCount = isNight ? Math.max(1, Math.round(pop.farmers/3)) : (pop.farmers||0);
  var guardCount = pop.guards || 0;
  var i;
  for (i=0;i<farmerCount;i++) residents.push(newFarmer(life));
  for (i=0;i<guardCount;i++) residents.push(newGuard(life, i, guardCount));
  residents.forEach(function(npc){ residentGroup.add(npc.obj); });
}
function updateResidents(dt){
  if (!residentsOn || !residents.length || !current || !current.life) return;
  var life = current.life;
  residents.forEach(function(npc){
    if (npc.kind === 'guard') updateGuard(npc, dt);
    else updateFarmer(npc, life, dt);
  });
}
document.getElementById('residentToggle').addEventListener('change', function(){
  residentsOn = this.checked;
  regenerateResidents();
});
