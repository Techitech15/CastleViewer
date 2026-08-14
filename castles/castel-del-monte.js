"use strict";

/* ====================================================================
 * Castel del Monte (カステル・デル・モンテ) procedural builder
 * ====================================================================
 * Returns { group, fadeGroups, interiorGroup, info, pickables, windowMat,
 * waterMats, labelGroup, life } -- same contract as buildBodiam (see
 * castles/bodiam.js). No moat/water here, so waterMats is [].
 *
 * ---- 寸法の検証(実装前の裏取り)------------------------------------
 * タスク仕様で示された「説A: 外接直径56m・一辺16.5m」と「説B: 全体直径
 * 40m・塔直径7.90m・中庭直径17.86m」は数値が食い違っていたため、伊語版
 * 一次資料で裏取りした。
 *   - cultura.gov.it (伊文化省)の "storia-e-struttura-di-castel-del-monte"
 *     ページは八角形プラン・8塔・8角形中庭を定性的に説明するのみで、
 *     数値の実測値は掲載していなかった(確認済み)。
 *   - it.wikipedia.org/wiki/Castel_del_Monte の「Descrizione」節に実測値
 *     が明記されている: 「中庭の直径は17.86m」「城全体の直径は40m」
 *     「塔の直径は7.90m」「塔の高さは23m、中庭側の壁の高さ(20.50m)を
 *     わずかに上回る」「標高539m」。中庭の各辺は6.89〜7.83mとばらつく
 *     (=中庭は厳密な正八角形ではない、という点も実在する特徴)。
 *   - この「城全体の直径40m」を、正八角形の一辺aと外接(平行2辺間)直径
 *     Dの関係 D=a(1+√2)≒2.414a で逆算すると a=40/2.414≒16.6m となり、
 *     タスク仕様の「説A: 一辺16.5m」と高い精度で一致する(検算成功)。
 *     したがって主郭の一辺は16.5mを採用し、そこから導いた直径39.8m を
 *     Wikipediaの「40m」と同一視する。
 *   - 一方、同じページに現れる「外側の辺: 10.30m」という記述は、抽出時
 *     の要約が曖昧で一次資料の原文とのマッチが取れなかった(隅の塔と塔
 *     の間に見える平坦な壁面の長さ、または塔を挟んだ台形区画の呼称の
 *     いずれかと解釈できるが確定できなかった)。a=16.5mを採用したとき
 *     の中庭〜外壁間の室内奥行きは約7.9mとなり、写真や見取図で知られる
 *     台形室の規模(奥行き数m〜8m程度)と整合する。逆に「10.30m」を主郭
 *     一辺として採用すると室内奥行きが1m未満になり非現実的なため採用
 *     しなかった。
 *   - 中庭直径17.86mは、中庭の平均辺(6.89+7.83)/2=7.36m から同じ
 *     D=a(1+√2)で逆算すると17.77mとなり、Wikipedia記載の17.86mと誤差
 *     0.5%で一致 -- 「直径=平行2辺間の距離」という定義がこの資料内で
 *     一貫して使われている追加の裏付けとなった。
 *   - 塔を含めた対角(塔の外周同士、対になる隅の塔の外端から外端)を
 *     幾何学的に見積もると約55m前後になり、これは説Aの「56m」と近い。
 *     つまり56mは「塔を含む全幅」、40mは「主郭本体(塔を除く)の直径」
 *     という、測り方の違いによる別の値だった可能性が高い、という仕様
 *     コメントの推測を裏付ける結果になった。
 *   - 採用値まとめ: 一辺16.5m(実測値40mから逆算=確定)/ 塔直径7.90m
 *     (実測値、複数ソースで一致)/ 中庭直径17.86m(実測値)/ 中庭側主壁
 *     高20.50m・塔高23m(実測値)/ 標高539m(実測値)/ 壁厚2.2m・中庭壁厚
 *     0.8m・門幅4.2m(いずれも未記載のため推定値)。
 *
 * ---- 塔の取り付け位置について(見た目優先の判断)--------------------
 * 上記の「56m=塔を含む全幅」を採ると、塔の中心を八角形の頂点より約2m
 * 外へ出すことになる。しかしそれだと塔の張り出しが塔幅(7.9m)と同じに
 * なり、レンダリングでは「壁の外側に8本の独立した円柱が立っている」
 * 状態にしか見えなかった(実際そうなっていた)。実物の写真が示すのは
 * 「壁と一体化した隅の膨らみ」であり、塔の中心を頂点(OCT_R_VERT)に
 * 置くと張り出しが塔の半幅(3.95m)になってその印象に一致する。この
 * とき全幅は約51.7mで、40m(塔を除く対辺間)と56m(諸説)の間に収まる。
 * 数値の一致より外観の一致を優先した箇所であることを明記しておく。
 * ==================================================================== */
function buildCastelDelMonte(){
  var group = new T.Group();
  var interiorGroup = new T.Group();
  group.add(interiorGroup);
  var fadeGroups = [];
  var pickables = [];

  function makeFadeGroup(name, dir, isRoof, colorHex){
    var mat = new T.MeshLambertMaterial({ color: colorHex });
    var g = new T.Group();
    g.name = name;
    group.add(g);
    var desc = { group:g, mat:mat, dir:dir, roof: !!isRoof, op:1, name:name };
    fadeGroups.push(desc);
    return desc;
  }

  /* ---- palette: 淡い黄褐色の石灰岩(プーリアの現地産石材)。屋根は
   * 切妻を持たない平屋根で、壁と近い石調にして「屋根らしい屋根がない」
   * 特徴を色でも表現する。既存3城(ボディアム=サセックス砂岩の暖赤褐色、
   * 他)とはっきり違う、より淡く乾いた色調でまとめる。 ------------- */
  var STONE_MAIN   = 0xd9c493; // 主郭の壁
  var STONE_MAIN_V = 0xd5bf8b; // 塔。実物は壁も塔も同一の石灰岩で、色差を
                               // つけすぎると塔が「別の建物」に見えるため
                               // 主壁とほぼ同色にとどめる
  var STONE_DARK   = 0xab9564; // 基壇・幅木
  var MARBLE_COL   = 0xece4cf; // 主玄関ポータルの大理石装飾
  var ROOF_COL     = 0xc9b78e; // 平屋根(石畳のテラス屋根、切妻なし)
  var WINDOW_COL   = 0x231b10;
  var FLOOR_COL    = 0xc2ae82; // 各室の石床
  var COURT_COL    = 0xb59f6c; // 中庭の石畳
  var PARTITION_COL= 0x93815a;
  var WOOD_COL     = 0x6b4f34;
  var CISTERN_COL  = 0x2f6a78;
  var HILL_TOP     = 0xc7bb78; // 丘の頂上(乾いた牧草)
  var HILL_MID     = 0x98995a;
  var HILL_EDGE    = 0x565c33;
  var FIELD_COL    = 0x81915a; // 遠景の草地(プーリアらしい乾いた緑)

  var windowMat  = new T.MeshLambertMaterial({ color: WINDOW_COL });
  var floorMat   = new T.MeshLambertMaterial({ color: FLOOR_COL, side: T.DoubleSide });
  var courtMat   = new T.MeshLambertMaterial({ color: COURT_COL, side: T.DoubleSide });
  var roofMat0   = new T.MeshLambertMaterial({ color: ROOF_COL, side: T.DoubleSide }); // 未使用(roofCapsのmatを使う), 予備
  var partitionMat = new T.MeshLambertMaterial({ color: PARTITION_COL, side: T.DoubleSide });
  var woodMat    = new T.MeshLambertMaterial({ color: WOOD_COL });
  var marbleMat  = new T.MeshLambertMaterial({ color: MARBLE_COL });
  var darkMat    = new T.MeshLambertMaterial({ color: STONE_DARK });
  var cisternMat = new T.MeshBasicMaterial({ color: CISTERN_COL });
  var hillFieldMat = new T.MeshLambertMaterial({ color: FIELD_COL });
  var hillTopMat   = new T.MeshLambertMaterial({ color: HILL_TOP });

  /* -------------------------------------------------------------- *
   * 幾何定数(コメント冒頭の検証結果に基づく)
   * -------------------------------------------------------------- */
  var OCT_SIDE = 16.5;                                    // 主郭一辺 a (検算により確定)
  var WT = 2.2;                                            // 壁厚(推定値)
  var OCT_APOTH_OUT = OCT_SIDE/2*(1+Math.SQRT2);            // 対辺間(フラット・トゥ・フラット)半径 ≒19.92m -> 直径≒39.8m
  var OCT_APOTH_CENTER = OCT_APOTH_OUT - WT/2;
  var OCT_APOTH_IN = OCT_APOTH_OUT - WT;
  var OCT_R_VERT = OCT_APOTH_OUT / Math.cos(Math.PI/8);     // 中心から隅(頂点)までの距離 ≒21.56m

  var TOWER_DIA = 7.90;                                     // 実測値(伊語Wikipedia)
  var TOWER_R = TOWER_DIA/2;                                 // = 対辺間半径(アポテム)
  // CylinderGeometry の radius は外接円半径なので、対辺間 7.90m を出すに
  // は TOWER_R/cos(22.5°) を渡す必要がある。以前は TOWER_R をそのまま
  // 渡していたため塔が実測より細い(対辺間7.3m)状態だった。
  var TOWER_CIRC_R = TOWER_R / Math.cos(Math.PI/8);          // ≒4.28m
  // 塔の中心は八角形の頂点(OCT_R_VERT)の真上に置く。こうすると塔の外面は
  // 主壁面から TOWER_R(=3.95m)だけ張り出し、内側は隅の壁体に完全に食い
  // 込む -- つまり「壁と一体化した隅の膨らみ」に見える。以前は
  // OCT_R_VERT + TOWER_R*0.5 に置いており、張り出しが塔の全幅(7.9m)分
  // にもなって、8本の独立した円柱が壁の外に立っているように見えていた。
  var TOWER_CENTER_R = OCT_R_VERT;                           // 全幅 ≒ 2*(21.56+4.28) ≒ 51.7m
  var TOWER_H = 23.0;                                        // 実測値(主壁20.5mをわずか2.5m上回るだけ)
  var TOWER_ROOF_T = 0.4;

  var COURT_DIA = 17.86;                                     // 実測値
  var COURT_APOTH = COURT_DIA/2;                             // 中庭の対辺間半径(開放空間)
  var CWT = 0.8;                                              // 中庭を囲む低い縁壁の厚み(推定値)
  var COURT_APOTH_OUT = COURT_APOTH + CWT;
  var COURT_R_VERT = COURT_APOTH / Math.cos(Math.PI/8);

  var WALL_H = 20.5;                                          // 中庭側主壁高(実測値)
  var GF_FLOOR_Y = 3.0;                                       // 1階床面(前庭から3m、実測値)
  var FF_FLOOR_Y = 9.5;                                       // 2階床面(前庭から9.5m、実測値)
  var GF_ROOM_H = 6.0;
  var FF_ROOM_H = 8.0;

  var DOOR_GAP = 4.2;                                         // 主玄関ポータルの開口幅(推定値)

  function dirAt(theta){ return { x: Math.sin(theta), z: -Math.cos(theta) }; }
  // 接線ベクトル。dirAt との内積が 0 になる必要がある。
  //   dirAt(θ)·(cosθ, -sinθ) = sinθcosθ + cosθsinθ = sin2θ  -> 0 にならない
  //   dirAt(θ)·(cosθ,  sinθ) = sinθcosθ - cosθsinθ = 0        -> 正しい
  // 旧実装は z の符号が逆で、θ=45/135/225/315°(斜めの4面)では接線が
  // 法線と真逆を向いていた。その結果:
  //   - 斜め4面の窓が壁の左右ではなく半径方向(壁の内外)へずれる
  //   - mkTrapFloor の台形室が風車状にねじれ、中庭から見て星形に突き出す
  //   - furnitureBox も同様にずれる
  // 「中央から棒状のものが突き出て見える」現象の実体はこのねじれた床・
  // 仕切り壁だった。
  function tanAt(theta){ return { x: Math.cos(theta), z: Math.sin(theta) }; }
  // 壁面に沿わせて箱を置くときの Y 回転。three.js の rotation.y = r は
  // ローカル +X 軸を (cos r, 0, -sin r) に写すので、接線 (cosθ, sinθ) に
  // 合わせるには r = -θ が必要。旧実装は +θ を渡していたため、
  // θ=45/135/225/315°(斜めの4面)で箱がちょうど90°ずれ、長辺16.5mの
  // 壁が接線方向ではなく半径方向を向いていた。すなわち4枚の主壁が
  // 「中庭に突き刺さり外へ突き出す板」になっており、これが
  //   - 中央から棒状の物体が突き出て見える
  //   - 主壁が八角形の環に見えず、柱の集合に見える
  // という2つの症状の直接の原因だった。θ=0/90/180/270°では
  // +θ でも箱が180°ずれるだけで見た目が変わらないため、北面だけを
  // 見て検証していると気付けない類のバグ。
  function wallRy(theta){ return -theta; }
  function radialRy(theta){ return Math.PI/2 - theta; }
  function wTheta(k){ return k*Math.PI/4; }        // 壁 k の中心角(k=0..7, 0=北)
  function vPhi(v){ return v*Math.PI/4 + Math.PI/8; } // 隅(塔) v の中心角(壁v・壁v+1の間)

  /* -------------------------------------------------------------- *
   * fade group registry -- 壁8面・塔8基・主屋根(+塔の平屋根)
   * -------------------------------------------------------------- */
  var wallFG = [], towerFG = [];
  for (var k=0;k<8;k++){
    wallFG.push(makeFadeGroup('wall'+k, dirAt(wTheta(k)), false, STONE_MAIN));
  }
  for (var v=0;v<8;v++){
    towerFG.push(makeFadeGroup('tower'+v, dirAt(vPhi(v)), false, STONE_MAIN_V));
  }
  var roofMain = makeFadeGroup('roofMain', null, true, ROOF_COL);   // 主郭の平屋根(方位に依らずフェード)
  var roofCaps = makeFadeGroup('roofCaps', null, true, ROOF_COL);   // 各塔の平屋根
  // 塔は円柱ではなく八角柱。CylinderGeometry(seg=8) は円周方向に法線を
  // 平滑化してしまい丸く見えるため、flatShading で稜線を立てる。これが
  // ないと「8本の円柱」に見え、実物の角張った印象と乖離する。
  towerFG.forEach(function(f){ f.mat.flatShading = true; });
  roofCaps.mat.flatShading = true;
  // 主屋根はテラス状の平屋根。中庭側から見上げる場面があるので両面描画。
  roofMain.mat.side = T.DoubleSide;

  /* -------------------------------------------------------------- *
   * 主郭 8壁(南側=k4のみ主玄関の開口を挟んで2分割)
   * -------------------------------------------------------------- */
  function wallWindow(fg, theta, tangentOff, y, w, h){
    var d = dirAt(theta), tg = tanAt(theta);
    var wx = d.x*OCT_APOTH_CENTER + tg.x*tangentOff;
    var wz = d.z*OCT_APOTH_CENTER + tg.z*tangentOff;
    var win = mkBox(w, h, WT*1.05, windowMat);
    place(win, wx, y, wz, wallRy(theta));
    fg.group.add(win);
  }
  for (k=0;k<8;k++){
    var theta = wTheta(k);
    var d = dirAt(theta);
    var fg = wallFG[k];
    if (k === 4){
      // 主玄関(南面): 開口幅DOOR_GAPを挟んで2つの壁セグメントに分割
      var segLen = (OCT_SIDE - DOOR_GAP)/2;
      var offset = DOOR_GAP/2 + segLen/2;
      var tg = tanAt(theta);
      [-1,1].forEach(function(sign){
        var cx = d.x*OCT_APOTH_CENTER + tg.x*offset*sign;
        var cz = d.z*OCT_APOTH_CENTER + tg.z*offset*sign;
        var seg = mkBox(segLen, WALL_H, WT, fg.mat);
        place(seg, cx, WALL_H/2, cz, wallRy(theta));
        fg.group.add(seg);
      });
      // 開口の上は壁で塞ぐ。以前は開口が壁の天端まで貫通しており、正面
      // から見ると門の上に高さ20mのスリットが開いて内部が丸見えだった。
      var lintelY = 10.8;
      var above = mkBox(DOOR_GAP, WALL_H - lintelY, WT, fg.mat);
      place(above, d.x*OCT_APOTH_CENTER, lintelY + (WALL_H-lintelY)/2, d.z*OCT_APOTH_CENTER, wallRy(theta));
      fg.group.add(above);
      wallWindow(fg, theta, DOOR_GAP/2+segLen*0.55, WALL_H*0.72, 0.85, 3.1);
      wallWindow(fg, theta, -(DOOR_GAP/2+segLen*0.55), WALL_H*0.72, 0.85, 3.1);
    } else {
      var wall = mkBox(OCT_SIDE, WALL_H, WT, fg.mat);
      place(wall, d.x*OCT_APOTH_CENTER, WALL_H/2, d.z*OCT_APOTH_CENTER, wallRy(theta));
      fg.group.add(wall);
      // 1階: 小さな単窓、2階: やや大きな双子窓(ビフォラ風) -- 実際の
      // カステル・デル・モンテは中庭側に多くの開口を持つが外壁側は
      // 控えめ、という記録に合わせ数を絞る
      wallWindow(fg, theta, 0, GF_FLOOR_Y+2.4, 0.75, 2.2);
      wallWindow(fg, theta, -1.0, FF_FLOOR_Y+3.2, 0.85, 3.1);
      wallWindow(fg, theta,  1.0, FF_FLOOR_Y+3.2, 0.85, 3.1);
    }
    // 幅木(基壇): 各壁の足元に低い張り出し
    var plinth = mkBox(OCT_SIDE+0.6, 1.0, WT+0.5, darkMat);
    place(plinth, d.x*OCT_APOTH_CENTER, 0.5, d.z*OCT_APOTH_CENTER, wallRy(theta));
    fg.group.add(plinth);
  }
  /* -------------------------------------------------------------- *
   * 水平コーニス(軒蛇腹)-- 実物で最も目を引く意匠。1階と2階を分ける
   * 主コーニスと、壁頂のコーニスの2本が八角形をぐるりと巡り、建物が
   * 「上下2層に分かれた1個の塊」に見える最大の要因になっている。
   * -------------------------------------------------------------- */
  var CORNICE_Y1 = 10.4;              // 1階/2階の境(2階床レベルのすぐ上)
  var CORNICE_Y2 = WALL_H - 0.85;     // 壁頂(平屋根の直下)
  var CORNICE_BANDS = [ {y:CORNICE_Y1, h:0.55, out:0.45}, {y:CORNICE_Y2, h:0.75, out:0.6} ];
  for (k=0;k<8;k++){
    (function(kk){
      var ct = wTheta(kk), cd = dirAt(ct), cfg = wallFG[kk];
      CORNICE_BANDS.forEach(function(c){
        var band = mkBox(OCT_SIDE+0.55, c.h, WT + c.out*2, cfg.mat);
        place(band, cd.x*OCT_APOTH_CENTER, c.y, cd.z*OCT_APOTH_CENTER, wallRy(ct));
        cfg.group.add(band);
      });
    })(k);
  }
  // 主郭本体には胸壁(クレネレーション)を設けない -- 実際のカステル・
  // デル・モンテは典型的な城郭とは異なり、はっきりした狭間胸壁を持たず
  // 平屋根の水平ラインで納まる(軍事施設らしい意匠を欠く、という本城
  // 最大の特徴のひとつ)。

  /* -------------------------------------------------------------- *
   * 主玄関ポータル(古典的な凱旋門風。大理石調)
   * -------------------------------------------------------------- */
  // 実物のポータルは1階分をまるごと占める記念碑的な大きさで、遠景でも
  // 「南面だけ表情が違う」とわかる。以前は高さ5m程度しかなく、20.5mの
  // 壁面に対して小さすぎて存在感が消えていた。
  (function buildPortal(){
    var theta = wTheta(4), d = dirAt(theta);
    var cz = d.z*(OCT_APOTH_OUT+0.05);
    var fg = wallFG[4];
    var COL_H = 7.4;
    var lintel = mkBox(DOOR_GAP+1.6, 0.9, 0.6, marbleMat);
    place(lintel, 0, COL_H+0.75, cz, wallRy(theta));
    fg.group.add(lintel);
    [-1,1].forEach(function(side){
      var col = mkCyl(0.46, 0.54, COL_H, 12, marbleMat);
      place(col, side*(DOOR_GAP/2+0.62), COL_H/2, cz);
      fg.group.add(col);
      var cap = mkBox(1.25, 0.42, 0.95, marbleMat);
      place(cap, side*(DOOR_GAP/2+0.62), COL_H+0.21, cz);
      fg.group.add(cap);
    });
    var cornice = mkBox(DOOR_GAP+3.0, 0.42, 0.75, marbleMat);
    place(cornice, 0, COL_H+1.42, cz, wallRy(theta));
    fg.group.add(cornice);
    var pediment = mkCone((DOOR_GAP+3.0)*0.42, 2.1, 3, marbleMat);
    pediment.rotation.y = Math.PI/2;
    place(pediment, 0, COL_H+1.63+1.05, cz);
    fg.group.add(pediment);
    var doorSlab = mkBox(DOOR_GAP-0.5, COL_H-0.4, 0.15, windowMat);
    place(doorSlab, 0, (COL_H-0.4)/2, cz-0.1, wallRy(theta));
    interiorGroup.add(doorSlab);
    var steps = mkBox(DOOR_GAP+2.2, 0.5, 1.8, darkMat);
    place(steps, 0, 0.25, cz+1.2, wallRy(theta));
    group.add(steps);
    registerPick(pickables, 'structure', 0, 5.2, cz, DOOR_GAP+3, 10.5, 4,
      '主玄関ポータル Main Portal',
      '古典的な凱旋門を思わせる大理石装飾のポータル。堀も跳ね橋もないこの城で、唯一"威容"を演出する要素。フリードリヒ2世が愛したギリシア・ローマ古典への傾倒がうかがえる。');
  })();

  /* -------------------------------------------------------------- *
   * 8基の八角塔(隅塔)-- 2基は階段塔、1基は貯水塔、残り5基は厠塔
   * -------------------------------------------------------------- */
  var TOWER_ROLE = ['latrine','stair','latrine','cistern','latrine','stair','latrine','latrine'];
  var TOWER_INFO = {
    stair:   { name:'階段塔 Stair Tower', desc:'内部にらせん階段を収め、1階と2階を結ぶ。8基中2基がこの役割を担う。' },
    latrine: { name:'厠塔 Latrine Tower', desc:'各階の厠(ガーダローブ)を収める塔。排水は塔の外壁を伝って地表へ流れる仕組み。' },
    cistern: { name:'貯水塔 Cistern Tower', desc:'平屋根に降った雨水を集水し、地下の水槽へ導く塔。井戸も堀もないこの城の生活用水を支えた、当時としては高度な集排水システムの一部。' }
  };
  for (v=0;v<8;v++){
    var phi = vPhi(v), dv = dirAt(phi);
    var tfg = towerFG[v];
    var tcx = dv.x*TOWER_CENTER_R, tcz = dv.z*TOWER_CENTER_R;
    // rotation.y = π/8 で八角柱の面(法線)を主郭八角形の8方位に揃える
    // -> 塔の2面が隣接する主壁と平行になり、壁と塔が同じ稜線で噛み合う
    var shaft = mkCyl(TOWER_CIRC_R, TOWER_CIRC_R*1.03, TOWER_H, 8, tfg.mat);
    shaft.rotation.y = Math.PI/8;
    place(shaft, tcx, TOWER_H/2, tcz);
    tfg.group.add(shaft);
    var tPlinth = mkCyl(TOWER_CIRC_R*1.06, TOWER_CIRC_R*1.16, 1.1, 8, tfg.mat);
    tPlinth.rotation.y = Math.PI/8;
    place(tPlinth, tcx, 0.55, tcz);
    tfg.group.add(tPlinth);
    // 塔を巡る水平コーニス(主壁のコーニスと同じ高さで連続させ、建物
    // 全体が一本の水平線で締まって見えるようにする)
    CORNICE_BANDS.forEach(function(c){
      var ring = mkCyl(TOWER_CIRC_R*1.055, TOWER_CIRC_R*1.055, c.h, 8, tfg.mat);
      ring.rotation.y = Math.PI/8;
      place(ring, tcx, c.y, tcz);
      tfg.group.add(ring);
    });
    // 開口は控えめ。実物の塔はほぼ無開口で、外側正面に細いスリットが
    // 各階に1つ見える程度。以前は塔の内外に6つも窓を並べていたため、
    // 塔が「窓の並んだ独立した建物」に見えていた。
    for (var s=0;s<2;s++){
      var wm = mkBox(0.5, 1.6, 0.6, windowMat);
      place(wm, tcx + dv.x*TOWER_R*0.95, GF_FLOOR_Y+2.8 + s*6.4, tcz + dv.z*TOWER_R*0.95, wallRy(phi));
      tfg.group.add(wm);
    }
    // 平屋根キャップ(尖塔・切妻を一切持たない、平らな頂部)
    var cap = mkCyl(TOWER_CIRC_R*1.035, TOWER_CIRC_R*1.035, TOWER_ROOF_T, 8, roofCaps.mat);
    cap.rotation.y = Math.PI/8;
    place(cap, tcx, TOWER_H+TOWER_ROOF_T/2, tcz);
    roofCaps.group.add(cap);

    var role = TOWER_ROLE[v], info = TOWER_INFO[role];
    registerPick(pickables, 'structure', tcx, TOWER_H/2, tcz, TOWER_DIA*1.4, TOWER_H, TOWER_DIA*1.4,
      info.name, info.desc);

    // 塔内部のごく簡単な表現(カットアウェイで塔の中を覗けるように)
    if (role === 'stair'){
      var newel = mkCyl(0.16,0.16,TOWER_H-1.0,8,darkMat);
      place(newel, tcx, (TOWER_H-1.0)/2+0.3, tcz);
      interiorGroup.add(newel);
    } else if (role === 'cistern'){
      var basin = mkCyl(TOWER_R*0.7, TOWER_R*0.7, 0.5, 12, darkMat);
      place(basin, tcx, 0.25, tcz);
      interiorGroup.add(basin);
      var waterTop = new T.Mesh(new T.CircleGeometry(TOWER_R*0.62, 16), cisternMat);
      waterTop.rotation.x = -Math.PI/2;
      place(waterTop, tcx, 0.51, tcz);
      interiorGroup.add(waterTop);
    }
  }

  /* -------------------------------------------------------------- *
   * 主郭の平屋根(中庭部分に開口を持つ、切妻を持たないテラス状屋根)
   * -------------------------------------------------------------- */
  // NOTE: an earlier version of this built the roof as a single
  // THREE.ShapeGeometry octagon-with-an-octagonal-hole (à la moatShape in
  // 01-moat.js). That relies on earcut triangulating a contour+hole pair,
  // and it produced a broken/self-crossing triangulation here (visually:
  // a "pinwheel" of sky showing through the roof) even after matching
  // 01-moat.js's opposite-winding convention for the hole. Rather than
  // fight earcut, the roof ring and the courtyard disc are both built by
  // hand from the octagon's own 8 vertices (vPhi), which is trivially
  // correct and needs no triangulation library: the roof is 8 explicit
  // quads (one per corner-to-corner wedge, outer edge to the courtyard
  // opening's edge), the courtyard is an 8-triangle fan from the centre.
  function ringQuad(angA, angB, rOuter, rInner, y, mat){
    var a = dirAt(angA), b = dirAt(angB);
    function P(dv,r){ return new T.Vector3(dv.x*r, y, dv.z*r); }
    var oa=P(a,rOuter), ob=P(b,rOuter), ia=P(a,rInner), ib=P(b,rInner);
    var geo = new T.BufferGeometry();
    var arr = new Float32Array(18);
    // 巻き方向に注意: dirAt(θ)=(sinθ,-cosθ) はθ増加でXZ平面上を「上から見て
    // 時計回り」に進むため、[oa,ob,ib] の順だと computeVertexNormals が
    // 法線を -Y(下向き)にしてしまう。単面マテリアルの屋根が上から完全に
    // 消え、中庭どころか各室の床・仕切り壁まで丸見えになる原因だった。
    // 順序を反転して法線を +Y に向ける。
    [oa,ib,ob, oa,ia,ib].forEach(function(pnt,i){ arr[i*3]=pnt.x; arr[i*3+1]=pnt.y; arr[i*3+2]=pnt.z; });
    geo.setAttribute('position', new T.Float32BufferAttribute(arr,3));
    geo.computeVertexNormals();
    var mesh = new T.Mesh(geo, mat);
    mesh.receiveShadow = true; mesh.castShadow = true;
    return mesh;
  }
  function octagonFan(rVert, y, mat){
    var g = new T.Group();
    var center = new T.Vector3(0,y,0);
    for (var i=0;i<8;i++){
      var a = dirAt(vPhi(i)), b = dirAt(vPhi(i+1));
      var p1 = new T.Vector3(a.x*rVert,y,a.z*rVert), p2 = new T.Vector3(b.x*rVert,y,b.z*rVert);
      var geo = new T.BufferGeometry();
      var arr = new Float32Array(9);
      [center,p1,p2].forEach(function(pnt,j){ arr[j*3]=pnt.x; arr[j*3+1]=pnt.y; arr[j*3+2]=pnt.z; });
      geo.setAttribute('position', new T.Float32BufferAttribute(arr,3));
      geo.computeVertexNormals();
      var mesh = new T.Mesh(geo, mat);
      mesh.receiveShadow = true;
      g.add(mesh);
    }
    return g;
  }
  for (k=0;k<8;k++){
    roofMain.group.add(ringQuad(vPhi(k), vPhi(k+1), OCT_R_VERT+0.15, COURT_R_VERT+0.2, WALL_H+0.2, roofMain.mat));
  }
  // 屋根の縁を少し立ち上げたパラペット(胸壁ではない、低い縁石)
  for (k=0;k<8;k++){
    // 屋根が正しく描画されるようになったので8面すべてに回す。1面だけ
    // 欠けていると、水平に一周する縁石のラインが途切れて「王冠」の
    // シルエットが崩れる(高さ0.5mなので視界は妨げない)。
    var pTheta = wTheta(k), pd = dirAt(pTheta);
    var lip = mkBox(OCT_SIDE*0.94, 0.5, 0.3, roofMain.mat);
    place(lip, pd.x*(OCT_APOTH_OUT-0.05), WALL_H+0.65, pd.z*(OCT_APOTH_OUT-0.05), wallRy(pTheta));
    roofMain.group.add(lip);
  }

  /* -------------------------------------------------------------- *
   * 中庭(正八角形、開放空間)-- 石畳の床 + 低い縁壁(ロッジア状)
   * -------------------------------------------------------------- */
  var courtyard = octagonFan(COURT_R_VERT, 0.02, courtMat);
  interiorGroup.add(courtyard);
  for (k=0;k<8;k++){
    var cTheta = wTheta(k), cd = dirAt(cTheta);
    var courtWall = mkBox(OCT_SIDE*COURT_APOTH/OCT_APOTH_OUT + 0.3, 1.3, CWT, partitionMat);
    place(courtWall, cd.x*(COURT_APOTH+CWT/2), 0.65, cd.z*(COURT_APOTH+CWT/2), wallRy(cTheta));
    interiorGroup.add(courtWall);
  }
  registerPick(pickables, 'room', 0, 1.2, 0, COURT_DIA*0.92, 2.4, COURT_DIA*0.92,
    '中庭 Courtyard',
    '正八角形の中庭。主郭・8つの部屋・8基の塔すべてがこの中庭を中心に幾何学的な対称性を保つ -- フリードリヒ2世の数学・天文学への傾倒を映す設計とされる。');

  /* -------------------------------------------------------------- *
   * 各階8室(courtyard〜外壁の台形プラン)。南(k=4)は玄関側なので
   * 玄関ホールを、北(k=0)は"伝・玉座の間/大広間"を割り当てる。
   * -------------------------------------------------------------- */
  function mkTrapFloor(theta, rInner, rOuter, halfInner, halfOuter, y, mat){
    var d0 = dirAt(theta), t0 = tanAt(theta);
    function pt(r,h){ return new T.Vector3(d0.x*r + t0.x*h, y, d0.z*r + t0.z*h); }
    var p0 = pt(rInner,-halfInner), p1 = pt(rInner,halfInner), p2 = pt(rOuter,halfOuter), p3 = pt(rOuter,-halfOuter);
    var geo = new T.BufferGeometry();
    var arr = new Float32Array(18);
    [p0,p1,p2,p0,p2,p3].forEach(function(v,i){ arr[i*3]=v.x; arr[i*3+1]=v.y; arr[i*3+2]=v.z; });
    geo.setAttribute('position', new T.Float32BufferAttribute(arr,3));
    geo.computeVertexNormals();
    var mesh = new T.Mesh(geo, mat);
    mesh.receiveShadow = true;
    return mesh;
  }
  function radialWall(theta, rInner, rOuter, y, h, mat){
    var d0 = dirAt(theta);
    var cr = (rInner+rOuter)/2;
    var m = mkBox(rOuter-rInner, h, 0.4, mat);
    place(m, d0.x*cr, y+h/2, d0.z*cr, radialRy(theta));
    interiorGroup.add(m);
    return m;
  }
  function pickRoom(theta, rInner, rOuter, halfW, y, h, name, desc){
    var d0 = dirAt(theta);
    var midR = (rInner+rOuter)/2;
    registerPick(pickables, 'room', d0.x*midR, y+h/2, d0.z*midR, halfW*2, h, rOuter-rInner, name, desc);
  }
  function furnitureBox(theta, r, tangentOff, y, w, h, dd, mat){
    var d0=dirAt(theta), t0=tanAt(theta);
    var m = mkBox(w,h,dd,mat);
    place(m, d0.x*r+t0.x*tangentOff, y+h/2, d0.z*r+t0.z*tangentOff, wallRy(theta));
    interiorGroup.add(m);
    return m;
  }

  var ROOM_NAME_GF = {
    0: { name:'玉座の間(伝) Presumed Throne Room', desc:'玄関の対面(北)に位置する1階の部屋。伝統的に謁見・玉座の間と推定されてきたが、確証はなく用途不明の一室に過ぎない、という説も根強い。' },
    4: { name:'玄関の間 Entrance Hall', desc:'主玄関ポータルの内側にあたる1階の間。城内で唯一、外部と直接つながる部屋。' }
  };
  var ROOM_NAME_FF = {
    0: { name:'大広間(伝) Sala Maggiore / Great Hall', desc:'玄関の対面(北)に位置する2階の部屋。最も格の高い広間だったと推定されるが、暖炉の跡以外に用途を示す確証は乏しい。' },
    4: { name:'貴賓の間(伝) Guest Chamber', desc:'玄関の真上にあたる2階の間。中庭側と外側の双方に開口を持つ。' }
  };

  var innerFloorR = COURT_APOTH_OUT, outerFloorR = OCT_APOTH_IN;
  // 正八角形の「側辺半長 = 対辺間半径(アポテム) x tan(22.5°)」の関係を
  // inner/outerそれぞれの半径にそのまま適用する -- こうすると各室の
  // 斜め辺が正確に頂点角(vPhi)を通る径方向の直線になり、隣接する8室が
  // 継ぎ目なく(隙間もオーバーラップもなく)タイル状に並ぶ。以前は外側
  // だけ別の式(OCT_SIDE/2 - 0.4)を使っておりズレが生じていた。
  var halfInnerW = innerFloorR * Math.tan(Math.PI/8);
  var halfOuterW = outerFloorR * Math.tan(Math.PI/8);
  for (k=0;k<8;k++){
    var rt = wTheta(k);
    // 1階
    var gfFloor = mkTrapFloor(rt, innerFloorR, outerFloorR, halfInnerW, halfOuterW, GF_FLOOR_Y, floorMat);
    interiorGroup.add(gfFloor);
    // 2階
    var ffFloor = mkTrapFloor(rt, innerFloorR, outerFloorR, halfInnerW, halfOuterW, FF_FLOOR_Y, floorMat);
    interiorGroup.add(ffFloor);
    var gfInfo = ROOM_NAME_GF[k] || { name:'居室 Chamber G'+(k+1), desc:'1階、対称に配置された8室のひとつ。用途は諸説あり判然としない。' };
    var ffInfo = ROOM_NAME_FF[k] || { name:'居室 Chamber F'+(k+1), desc:'2階、対称に配置された8室のひとつ。中庭側と外側の両方に開口を持つ。' };
    pickRoom(rt, innerFloorR, outerFloorR, halfOuterW, GF_FLOOR_Y, GF_ROOM_H, gfInfo.name, gfInfo.desc);
    pickRoom(rt, innerFloorR, outerFloorR, halfOuterW, FF_FLOOR_Y, FF_ROOM_H, ffInfo.name, ffInfo.desc);
  }
  // 隅の仕切り壁(1階・2階それぞれ、頂点角φで中庭〜外壁まで径方向に)
  for (v=0;v<8;v++){
    radialWall(vPhi(v), innerFloorR, outerFloorR, GF_FLOOR_Y, 3.0, partitionMat);
    radialWall(vPhi(v), innerFloorR, outerFloorR, FF_FLOOR_Y, 3.0, partitionMat);
  }
  // 代表室の家具(簡易)
  furnitureBox(wTheta(0), (innerFloorR+outerFloorR)/2, 0, GF_FLOOR_Y, 2.6, 1.1, 1.4, woodMat);
  furnitureBox(wTheta(0), outerFloorR-0.8, 0, FF_FLOOR_Y, 3.0, 0.6, 1.2, woodMat);
  furnitureBox(wTheta(4), (innerFloorR+outerFloorR)/2, 1.6, GF_FLOOR_Y, 1.0, 0.9, 1.0, woodMat);
  furnitureBox(wTheta(4), (innerFloorR+outerFloorR)/2, -1.6, FF_FLOOR_Y, 1.0, 0.9, 1.0, woodMat);

  /* -------------------------------------------------------------- *
   * 丘の頂上(標高約540m相当)-- 周囲になだらかな盛り上がりを作る。
   * buildUndulatingGround はフラットな円+ノイズの起伏止まりで、なだら
   * かな「丘」の裾を表現できないため(平坦→起伏はあっても隆起はしない)、
   * 既存の buildBankRamp/buildCircularSkirt(01-moat.js、堀の土手と同じ
   * 仕組み)を土手ではなく"逆方向の丘"として流用する: 建物の基準面
   * y=0 を丘の頂上(プラトー)とし、そこから外側へ向かって周囲の野原
   * (y=-HILL_DROP)まで下る一枚の傾斜面を作る。堀がないぶん、そこに
   * 水面は張らない。
   * -------------------------------------------------------------- */
  var R_PLATEAU = 31, R_HILLBASE = 112, HILL_DROP = 17;
  var plateau = new T.Mesh(new T.CircleGeometry(R_PLATEAU, 32), hillTopMat);
  plateau.rotation.x = -Math.PI/2;
  plateau.position.y = 0.0;
  plateau.receiveShadow = true;
  group.add(plateau);
  // 単一の直線スロープ(旧: 34m -> 88m を一様に -12m)では、城が平らな
  // 円盤に載っているようにしか見えなかった。頂上付近はゆるく、中腹で
  // 最も急に、裾でまた緩く -- という凸型の断面を3段のスカートで作る
  // ことで、丘そのもののシルエットが出るようにする。
  var HILL_TIERS = [
    { r0:R_PLATEAU, r1:50,          y0:0.0,   y1:-4.2,       cTop:HILL_TOP, cEdge:HILL_TOP },
    { r0:50,        r1:80,          y0:-4.2,  y1:-11.6,      cTop:HILL_TOP, cEdge:HILL_MID },
    { r0:80,        r1:R_HILLBASE,  y0:-11.6, y1:-HILL_DROP, cTop:HILL_MID, cEdge:HILL_EDGE }
  ];
  HILL_TIERS.forEach(function(t){
    group.add(buildCircularSkirt(0, 0, t.r0, t.r1, t.y0, t.y1,
      new T.Color(t.cTop), new T.Color(t.cTop), new T.Color(t.cEdge)));
  });
  var field = buildUndulatingGround(R_HILLBASE, 1200, 64, hillFieldMat, null);
  field.position.y = -HILL_DROP;
  group.add(field);
  registerPick(pickables, 'structure', 0, -1, R_PLATEAU+18, R_HILLBASE, 2, R_HILLBASE,
    '孤立丘 Hilltop', '標高約539mの丘の頂上に単独で建つ。周囲に城壁も外郭建物もなく、堀・跳ね橋・厩舎の類も一切存在しない -- 軍事拠点としては極めて不自然な、丸裸の立地。');

  /* -------------------------------------------------------------- *
   * info payload
   * -------------------------------------------------------------- */
  var info = {
    rooms: [
      { name:'玉座の間(伝)', desc:'1階北側。伝承上の呼称で、確証はない。' },
      { name:'大広間(伝)', desc:'2階北側。最も格式が高いとされる部屋。' },
      { name:'玄関の間', desc:'1階南側。主玄関ポータルの内側。' },
      { name:'中庭', desc:'正八角形、開放空間。全体の対称性の中心。' },
      { name:'階段塔 x2 / 厠塔 x5 / 貯水塔 x1', desc:'8基の隅塔はそれぞれ異なる機能を持つ。' }
    ]
  };
  var labelGroup = buildLabelGroup(group, pickables);

  /* -------------------------------------------------------------- *
   * 住人(life) -- 堀も外郭もない単独の丘上建築のため、経路は極めて
   * 単純: 主玄関(南)を通って中庭側と丘の外へ抜けるだけ。衛兵はゼロ
   * (この城には駐屯機能がない、という史実上の性格をそのまま反映)。
   * -------------------------------------------------------------- */
  var gateOuterZ = OCT_APOTH_OUT + 1.5;
  var life = {
    gates: [ { path: [ {x:0, z:COURT_APOTH_OUT-0.5}, {x:0, z:OCT_APOTH_CENTER}, {x:0, z:gateOuterZ} ],
      outDir:{x:0,z:1}, vanishDist: R_PLATEAU - gateOuterZ - 2 } ],
    courtyard: [ { minX:-COURT_APOTH*0.8, maxX:COURT_APOTH*0.8, minZ:-COURT_APOTH*0.8, maxZ:COURT_APOTH*0.8 } ],
    population: { farmers: 8, guards: 0 }
  };

  return { group: group, fadeGroups: fadeGroups, interiorGroup: interiorGroup, info: info,
    pickables: pickables, windowMat: windowMat, waterMats: [], labelGroup: labelGroup, life: life };
}

registerCastle({
  id: 'castel-del-monte',
  name: 'Castel del Monte',
  nameJa: 'カステル・デル・モンテ',
  country: 'Italy',
  countryJa: 'イタリア',
  flag: '🇮🇹',
  year: '1240',
  description: '1240年代、神聖ローマ皇帝フリードリヒ2世がプーリアの丘の上に築いた正八角形の城。堀も跳ね橋も厩舎も持たず、軍事拠点としての実用性を欠くにもかかわらず精緻な幾何学と大理石装飾を凝らした、用途不明の"謎の城"として知られる。',
  build: buildCastelDelMonte,
  view: { targetY: 5.5, zMin: 16, zMax: 130, initDist: 85,
    fogNear: 75, fogFar: 280, shadowExtent: 48, shadowFar: 180,
    camFar: 700, panLimit: 32 }
});
