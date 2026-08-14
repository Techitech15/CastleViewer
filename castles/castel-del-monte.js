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
 *   - 採用値まとめ: 一辺16.5m(実測値40mから逆算=確定)/ 塔直径7.90m
 *     (実測値、複数ソースで一致)/ 中庭直径17.86m(実測値)/ 標高539m。
 *
 * ---- 実物写真による検証(2周目の見直し)-----------------------------
 * 上記の机上検算のあと、Wikimedia Commons から実物画像を取得して直接
 * 目視した(空撮1枚・地上2枚・1セント硬貨1枚)。その結果、机上で保留
 * にしていた矛盾がすべて解けたので、寸法の採用方針を改めた。
 *
 * (1) 「外側の辺 10.30m」の正体 = 塔と塔の間に残る"素の壁面"の幅
 *   地上写真でほぼ正対して写っている壁面と、その隣の塔の見かけ幅を
 *   比べると 283px : 215px。塔の対辺間が7.90mなので、素の壁面は
 *   7.90 x 283/215 = 10.4m。英語版Wikipediaの「each side measures
 *   9.8 m between the towers」とも一致する。つまり10.30mは主郭の一辺
 *   (16.5m)ではなく、一辺から塔に食われた分を引いた残りだった。
 *
 * (2) それを使うと「56m」が導出できる = 説Aの56mは正しい
 *   塔中心を頂点角φ・半径Rtに置くと、壁面に残る素の幅は
 *     clear = 2 * (Rt*sin(22.5deg) - 3.95)
 *   clear=10.30 を解くと Rt = 23.78m。塔は頂点方向に稜線が来る向き
 *   なので半径方向の張り出しは外接半径4.28m、よって
 *     全幅 = 2*(23.78 + 4.28) = 56.1m  <- 説Aの「56m」と一致
 *   つまり {全幅56m, 塔径7.90m, 素の壁面10.30m} は互いに完全整合する
 *   一つの組であり、40mは「塔を除いた主郭の対辺間」という別の測り方。
 *   資料間の矛盾ではなく、単に測る対象が違っただけだった。
 *
 * (3) 空撮写真による裏取り
 *   ほぼ真上から撮られた空撮(ref: Castel del monte la corona di
 *   Puglia.jpg)で、中庭の対辺間(17.86m)を物差しにして塔中心半径を
 *   測ると 22.7〜24.9m(計測法による幅)。Rt=23.78m はこのレンジの
 *   ほぼ中央。さらにこの写真では、8基の塔が主郭の角に「食い込んで」
 *   おらず、明らかに外へ張り出して塔と主郭の間に V 字の入隅(ノッチ)
 *   が出来ているのが見える。前回「塔を頂点に置く」に後退させた判断
 *   (=張り出しが半幅3.95mだけ)は実物より控えめすぎた。
 *   前回それが「8本の独立した円柱」に見えた真因は塔位置ではなく、
 *   同時に存在していた壁の回転符号バグで主郭が八角形の環に見えて
 *   いなかったことだと考えられる。壁バグを直した今は、塔を正しい
 *   位置(Rt=23.78)へ出しても八角形の塊として読める。
 *
 * (4) 高さの読み替え: 「主壁20.50m」は"中庭側"の壁高
 *   地上写真で、素の壁面幅10.30mを物差しに測ると
 *     外側から見た壁の高さ(基壇の足元〜屋根パラペット天端) ≒ 19.2m
 *     塔の高さ ≒ 22.7m  (資料の23mと一致)
 *   比は 1.18。20.50m を外壁高として使うと比が1.12にしかならず、
 *   写真の「塔がはっきり頭を出す」印象が出ない。イタリア語版の
 *   20.50m は明記どおり *中庭側* の壁高なので、外観用には使わない。
 *   -> WALL_H(外観の壁高)=19.8m、TOWER_H=23.6m を採用する。
 *
 * (5) 壁厚は3.0m(en.wikipedia「the outer wall is 3 m thick at the
 *   base」)。従来の推定2.2mを差し替え。
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
  // 実物写真(晴天・順光)でサンプルすると、日の当たる壁面は淡いクリーム
  // 〜蜂蜜色 #d9c9a5 前後、日陰面で #b9a689 前後。従来値 0xd9c493 は黄色に
  // 寄りすぎ・彩度が高すぎて「黄土色の土壁」に見えていたので、明るく淡い
  // 石灰岩寄りへ振り直す。
  // ただしこのビューアの昼の直射は強く、写真のsRGB値をそのまま入れると
  // 白飛びする。1周まわして撮り比べた結果、写真値から1割ほど落とした
  // あたりが画面上で写真の印象に一番近かった。
  var STONE_MAIN   = 0xd0bc93; // 主郭の壁
  var STONE_MAIN_V = 0xccb78d; // 塔。実物は壁も塔も同一の石灰岩なので同色に近づける
  var STONE_DARK   = 0xab9564; // 内部の暗色石(基壇には使わない。下記参照)
  // ポータルは白大理石ではない。写真では明らかに壁より赤みの強い石
  // (ブレッチャ系の淡いピンク〜赤褐色)で、これが南面だけ表情を変えて
  // いる最大の要因。従来の 0xece4cf(ほぼ白)では壁に埋もれていた。
  var MARBLE_COL   = 0xcaa392; // 主玄関ポータルの装飾石
  var TRIM_COL     = 0xe2d7bd; // 窓の縁取り(こちらは白っぽい大理石)
  // 屋根は上を向いているぶん直射をまともに受けて白飛びしやすい。空撮
  // 写真の屋根は壁よりはっきり沈んだ灰褐色なので、思い切って暗くする。
  // 実測: このシーンの昼の水平面は入射光がおよそ1.73倍かかるため、
  // 0x9d937c でもR/Gが255に張り付いて真っ白に飛んでいた。上向き面だけは
  // さらに落として、空撮写真どおり「壁より沈んだ灰褐色の石畳」にする。
  var ROOF_COL     = 0x8d8570; // 平屋根(石畳のテラス屋根、切妻なし)
  var WINDOW_COL   = 0x231b10;
  var FLOOR_COL    = 0xc2ae82; // 各室の石床
  var COURT_COL    = 0xb59f6c; // 中庭の石畳
  var PARTITION_COL= 0x93815a;
  var WOOD_COL     = 0x6b4f34;
  var CISTERN_COL  = 0x2f6a78;
  /* 上向きの水平面には sun 1.55 + hemi 0.65 + ambient 0.22 でおよそ 1.9 倍が
   * 乗る。0x9e9459 = (158,148,89) は乗算後に (300,281,169) となって赤と緑が
   * クリップし、周囲の草地から浮いた鮮やかな黄色になっていた。どのチャンネルも
   * 乗算後に 235 を超えないよう、色相を保ったまま最大チャンネルを 120 前後へ
   * 引き下げてある(クリップが起きなければ彩度は素の値どおりに出る)。 */
  var HILL_TOP     = 0x5f5936; // 丘の頂上(乾いた牧草)
  var HILL_MID     = 0x5e5f38;
  var HILL_EDGE    = 0x474c2b;
  var FIELD_COL    = 0x555f3b; // 遠景の草地(プーリアらしい乾いた緑)

  var windowMat  = new T.MeshLambertMaterial({ color: WINDOW_COL });
  var floorMat   = new T.MeshLambertMaterial({ color: FLOOR_COL, side: T.DoubleSide });
  var courtMat   = new T.MeshLambertMaterial({ color: COURT_COL, side: T.DoubleSide });
  var roofMat0   = new T.MeshLambertMaterial({ color: ROOF_COL, side: T.DoubleSide }); // 未使用(roofCapsのmatを使う), 予備
  var partitionMat = new T.MeshLambertMaterial({ color: PARTITION_COL, side: T.DoubleSide });
  var woodMat    = new T.MeshLambertMaterial({ color: WOOD_COL });
  var marbleMat  = new T.MeshLambertMaterial({ color: MARBLE_COL });
  var trimMat    = new T.MeshLambertMaterial({ color: TRIM_COL });
  var darkMat    = new T.MeshLambertMaterial({ color: STONE_DARK });
  var cisternMat = new T.MeshBasicMaterial({ color: CISTERN_COL });
  var hillFieldMat = new T.MeshLambertMaterial({ color: FIELD_COL });
  var hillTopMat   = new T.MeshLambertMaterial({ color: HILL_TOP });

  /* -------------------------------------------------------------- *
   * 幾何定数(コメント冒頭の検証結果に基づく)
   * -------------------------------------------------------------- */
  var OCT_SIDE = 16.5;                                    // 主郭一辺 a (検算により確定)
  var WT = 3.0;                                            // 壁厚(en.wikipedia: 基部で3m)
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
  // 塔の位置は「塔と塔の間に残る素の壁面 = 10.30m」という実測から逆算する
  // (冒頭コメント(1)(2)を参照)。塔は頂点方向φに稜線が来る向きなので、
  // 壁の接線方向への食い込みは塔の対辺間の半分=TOWER_R。よって
  //   clear = 2*(TOWER_CENTER_R*sin(22.5deg) - TOWER_R) = 10.30
  // これは同時に全幅 2*(Rt+4.28)=56.1m を導き、資料の「56m」と一致する。
  var CLEAR_WALL = 10.30;                                    // 塔間に残る素の壁面(実測/写真計測)
  var TOWER_CENTER_R = (TOWER_R + CLEAR_WALL/2) / Math.sin(Math.PI/8); // ≒23.78m
  // 塔中心は八角形の頂点(21.56m)より約2.2m外側。実物の空撮ではこの位置
  // 関係のとおり、塔と主郭の間に V 字の入隅(ノッチ)がはっきり出る。
  var TOWER_H = 23.6;                                        // 実測23m + 基壇分。冒頭(4)参照
  var TOWER_ROOF_T = 0.35;

  var COURT_DIA = 17.86;                                     // 実測値
  var COURT_APOTH = COURT_DIA/2;                             // 中庭の対辺間半径(開放空間)
  var CWT = 0.8;                                              // 中庭を囲む低い縁壁の厚み(推定値)
  var COURT_APOTH_OUT = COURT_APOTH + CWT;
  var COURT_R_VERT = COURT_APOTH / Math.cos(Math.PI/8);

  // 外から見える壁の高さ。資料の20.50mは"中庭側"の壁高なので外観には
  // 使わない(冒頭(4))。写真計測では基壇足元〜屋根天端で約19.2m。
  var WALL_H = 19.8;
  var GF_FLOOR_Y = 3.0;                                       // 1階床面(前庭から3m、実測値)
  var FF_FLOOR_Y = 9.5;                                       // 2階床面(前庭から9.5m、実測値)
  var GF_ROOM_H = 6.0;
  var FF_ROOM_H = 8.0;

  // 実物のポータルの扉口は意外に細い。写真計測で開口幅 約2.4m
  // (壁の一辺16.5mに対して1/7)。従来の4.2mは広すぎて、遠景で南面が
  // 「壁に大穴が開いている」ように見えていた。
  var DOOR_GAP = 2.6;

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
  // 塔は円柱ではなく八角柱。CylinderGeometry(seg=8) は側面の法線を半径
  // 方向(=隣り合う面で共有)に作るため、そのままだと陰影が連続して
  // 丸い円柱に見える。実物写真では8本の稜線がくっきり出るのが塔の最大
  // の識別点なので、ここは必ず面ごとに陰影を切りたい。
  //
  // 旧実装は mat.flatShading = true に頼っていたが **これは効かない**。
  // このプロジェクトは three.js r128 を使っており、r128 の
  // MeshLambertMaterial は頂点単位ライティング(Gouraud)で、flatShading
  // の define を持たない(js/15-nature.js にも同じ趣旨のコメントがある)。
  // そのため塔はずっと丸い円柱のままだった。
  //
  // 代わりにジオメトリ側で解決する: toNonIndexed() で頂点の共有を解いて
  // から computeVertexNormals() すると、各面の4頂点が同じ面法線を持つ。
  // 頂点単位ライティングでも面内で法線が一定になるので、結果としてフラット
  // シェーディングと同じ見え方になる(r128 の Lambert でも確実に効く)。
  function flatFacets(mesh){
    var g = mesh.geometry.toNonIndexed();
    g.computeVertexNormals();
    mesh.geometry.dispose();
    mesh.geometry = g;
    return mesh;
  }
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
  // 上階のビフォラ(2連窓)。実物写真では各壁面の上階に "1組だけ"、
  // 面の中央に置かれる。細い中柱で仕切られた2つの尖頭窓を、明るい
  // 大理石の縁取りが囲む。従来は 0.85m 幅の単窓を ±1.0m に2つ並べて
  // いただけで、離れて見ると「窓が2つある壁」にしか見えなかった。
  // 縁取りは「板」ではなく上枠・下枠(窓台)・左右の方立の4本で作る。
  // 最初は1枚の板で作ったが、板は開口より必ず外側に来るので暗い窓が
  // 完全に隠れ、遠景では「壁に貼った明るい四角」にしか見えなかった。
  function bifora(fg, theta, tangentOff, cy, frameW, frameH){
    var d = dirAt(theta), tg = tanAt(theta);
    function at(off, r){ return { x: d.x*r + tg.x*off, z: d.z*r + tg.z*off }; }
    var TR = OCT_APOTH_OUT - 0.16, TD = 0.55;         // 縁取りの位置と厚み
    var bt = 0.30;                                     // 枠の見付け幅
    [[0, frameH/2 + bt/2, frameW + bt*2, bt],          // 上枠
     [0, -frameH/2 - bt/2, frameW + bt*2, bt*1.25],    // 下枠(窓台)
     [-(frameW/2 + bt/2), 0, bt, frameH],              // 左の方立
     [ (frameW/2 + bt/2), 0, bt, frameH]               // 右の方立
    ].forEach(function(b){
      var p = at(tangentOff + b[0], TR);
      var bar = mkBox(b[2], b[3], TD, trimMat);
      place(bar, p.x, cy + b[1], p.z, wallRy(theta));
      fg.group.add(bar);
    });
    var lw = (frameW - 0.26)/2;                        // 中柱を残した各ランセットの幅
    [-1, 1].forEach(function(s){
      var p = at(tangentOff + s*(lw/2 + 0.13), OCT_APOTH_CENTER);
      var lancet = mkBox(lw, frameH, WT*1.02, windowMat);
      place(lancet, p.x, cy, p.z, wallRy(theta));
      fg.group.add(lancet);
    });
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
      var lintelY = 5.4;                                     // 扉の尖頭アーチ(頭部5.2m)のすぐ上
      var above = mkBox(DOOR_GAP, WALL_H - lintelY, WT, fg.mat);
      place(above, d.x*OCT_APOTH_CENTER, lintelY + (WALL_H-lintelY)/2, d.z*OCT_APOTH_CENTER, wallRy(theta));
      fg.group.add(above);
      // 南面はビフォラを持たない。実物ではポータルの真上(コーニスの
      // 上)に尖頭アーチのニッチ窓が1つだけ開く。
      bifora(fg, theta, 0, 12.4, 1.35, 3.0);
    } else {
      var wall = mkBox(OCT_SIDE, WALL_H, WT, fg.mat);
      place(wall, d.x*OCT_APOTH_CENTER, WALL_H/2, d.z*OCT_APOTH_CENTER, wallRy(theta));
      fg.group.add(wall);
      // 実物写真で数えると、外壁の一面あたりの開口は上下 1 つずつしか
      // ない -- 上階に面の中央のビフォラ、下階に同じく中央の細い矢狭間
      // 状の窓。従来の「下1 + 上2」は多すぎ、壁が賑やかに見えていた。
      // 写真計測(壁高19.2mを基準): ビフォラ中心 13.0m / 幅約2.3m、
      // 下階窓 中心 5.7m / 幅0.7m・高さ2.5m。
      wallWindow(fg, theta, 0, GF_FLOOR_Y+2.6, 0.62, 2.4);
      bifora(fg, theta, 0, FF_FLOOR_Y+3.4, 2.15, 3.3);
    }
    // 基壇(ソクル): 実物は壁と同じ石灰岩の、なめらかな一段の張り出し。
    // 従来は暗色(STONE_DARK)を使っており、遠景で「城の足元に黒い帯が
    // 巻いてある」ように見えて実物と印象が違っていた。
    var plinth = mkBox(OCT_SIDE+0.5, 1.25, WT+0.5, fg.mat);
    place(plinth, d.x*OCT_APOTH_CENTER, 0.62, d.z*OCT_APOTH_CENTER, wallRy(theta));
    fg.group.add(plinth);
  }
  /* -------------------------------------------------------------- *
   * 水平コーニス(軒蛇腹)-- 実物で最も目を引く意匠。1階と2階を分ける
   * 主コーニスと、壁頂のコーニスの2本が八角形をぐるりと巡り、建物が
   * 「上下2層に分かれた1個の塊」に見える最大の要因になっている。
   * -------------------------------------------------------------- */
  // 写真で確認したこと:
  //  - 中間のコーニスは "薄い水平の胴蛇腹(string course)" であって、
  //    大きく張り出す軒ではない。上階の窓のちょうど下端を通る。
  //    位置は壁高の 55% 前後(写真計測で約10.6m)。
  //  - 壁頂のコーニスも控えめで、ごく浅い庇があるだけ。
  //    従来は out=0.45 / 0.6 と張り出しが大きすぎ、遠景で建物が
  //    「3段重ねのケーキ」に見える原因になっていた。
  //  - 中間コーニスは塔にも連続する(塔側でもはっきり見える)が、
  //    壁頂のコーニスは塔には無い(塔はそこからさらに上へ伸びる)。
  var CORNICE_Y1 = 10.6;              // 1階/2階の境(上階窓の下端を通る)
  var CORNICE_Y2 = WALL_H - 0.6;      // 壁頂(平屋根の直下)
  // out(張り出し)は 0.18 まで絞ったら今度は遠景で完全に消えてしまった
  // ので、影の線が出る最小限まで戻す。写真では逆光気味でも水平線が読める。
  var STRING_BAND = {y:CORNICE_Y1, h:0.42, out:0.30};
  var CORNICE_BANDS = [ STRING_BAND, {y:CORNICE_Y2, h:0.45, out:0.30} ];
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
  /* 実物写真(接写)で読み取った構成を、下から順にそのまま積み上げる。
   *   1) 尖頭アーチの扉口。意外に細く、幅は約2.3m しかない
   *   2) その左右に、壁から半分埋まった円柱(付柱)。柱頭は約5.2m
   *   3) 柱頭の上に、古典的なエンタブラチュア(歯飾りつきの水平材)
   *   4) その上に三角ペディメント。急勾配(約50度)で、頂点は約8.8m
   *   5) さらに上、胴蛇腹(10.6m)を挟んで、尖頭アーチのニッチ窓
   * 従来の実装は柱高7.4m・エンタブラチュア幅7.2m と全体が一回り大きく、
   * 逆に扉口が4.2m幅もあって「壁に大穴+その上に飾り」になっていた。
   * また装飾石を白(0xece4cf)にしていたため、写真の赤みのある石という
   * 最大の識別点が失われていた。 -- 幅・高さ・色をすべて写真に合わせる。
   * 座標について: k=4 は南面(θ=π)なので dirAt(π)=(0,+1)、面法線は +Z。
   * したがって x が接線方向にそのまま対応し、回転は不要。
   */
  (function buildPortal(){
    var theta = wTheta(4), d = dirAt(theta);
    var cz = d.z*(OCT_APOTH_OUT+0.05);
    var PZ = OCT_APOTH_OUT + 0.32;          // 基壇の張り出し(0.25)より前に出す
    var fg = wallFG[4];

    // --- 扉口(尖頭アーチ)------------------------------------------
    // 1周目に組んだ寸法を写真と重ねると、扉口が低く・ポータル全体が
    // 横に広くて「ずんぐりした社」に見えていた。実物は逆に、細長い
    // 尖頭アーチの上に幅の詰まったペディメントが載る縦長の構成。
    // 素の壁面10.30mに対しポータル幅は4.1m(=40%)、頂点は壁高の
    // ちょうど半分あたり、が写真から読める比率。
    var doorW = DOOR_GAP - 0.4;             // ≒2.2m
    var doorRectH = 3.6, doorHeadH = 1.6;   // 開口の頭部は 5.2m
    var surround = mkBox(doorW + 1.25, doorRectH + doorHeadH + 0.55, 0.5, marbleMat);
    place(surround, 0, (doorRectH + doorHeadH + 0.55)/2, PZ - 0.26, wallRy(theta));
    fg.group.add(surround);
    var doorSlab = mkBox(doorW, doorRectH, 0.35, windowMat);
    place(doorSlab, 0, doorRectH/2, PZ - 0.06, wallRy(theta));
    interiorGroup.add(doorSlab);
    // 尖頭部。3角錐を厚み方向に潰して「三角形の板」として使う。
    // ConeGeometry の底面頂点は (0,r),(0.866r,-0.5r),(-0.866r,-0.5r) で、
    // rotation.y=PI にすると z=-0.5r の辺が +Z(=南)を向く平面になる。
    // z は doorSlab と同じにする。最初は "0.5*headR*0.3" ぶん奥へ引いて
    // いたが、そうすると縁取り(surround, 前面 PZ-0.01)より奥に入って
    // しまい、尖頭部が完全に隠れて扉が長方形に見えていた。
    var headR = doorW/Math.sqrt(3);
    var doorHead = flatFacets(mkCone(headR, doorHeadH, 3, windowMat));
    doorHead.rotation.y = Math.PI; doorHead.scale.z = 0.3;
    place(doorHead, 0, doorRectH + doorHeadH/2, PZ - 0.06);
    interiorGroup.add(doorHead);

    // --- 付柱 ------------------------------------------------------
    var COL_H = 4.85, COL_X = doorW/2 + 0.92;
    [-1,1].forEach(function(side){
      var base = mkBox(0.85, 0.5, 0.8, marbleMat);
      place(base, side*COL_X, 0.85, PZ - 0.3);
      fg.group.add(base);
      var col = mkCyl(0.3, 0.34, COL_H, 12, marbleMat);
      place(col, side*COL_X, 1.1 + COL_H/2, PZ - 0.3);
      fg.group.add(col);
      var cap = mkBox(0.85, 0.4, 0.85, marbleMat);
      place(cap, side*COL_X, 1.1 + COL_H + 0.2, PZ - 0.3);
      fg.group.add(cap);
    });

    // --- エンタブラチュア(水平材)+ 歯飾り -------------------------
    var ENT_Y = 6.15, ENT_W = doorW + 1.9;    // ≒4.1m
    var arch = mkBox(ENT_W, 0.32, 0.6, marbleMat);
    place(arch, 0, ENT_Y + 0.16, PZ - 0.2, wallRy(theta));
    fg.group.add(arch);
    for (var dt=-3; dt<=3; dt++){             // dentil(歯飾り)
      var den = mkBox(0.24, 0.28, 0.7, marbleMat);
      place(den, dt*0.54, ENT_Y + 0.48, PZ - 0.16);
      fg.group.add(den);
    }
    var entab = mkBox(ENT_W + 0.3, 0.36, 0.76, marbleMat);
    place(entab, 0, ENT_Y + 0.8, PZ - 0.16, wallRy(theta));
    fg.group.add(entab);

    // --- 三角ペディメント -------------------------------------------
    var PED_W = doorW + 1.7, PED_H = 2.9;     // 幅≒3.9m / 高さ2.9m -> 勾配約56度
    var pedR = PED_W/Math.sqrt(3);
    // ConeGeometry は側面の法線を平滑化するので、そのままだと三角形の
    // ペディメントが「丸い山」に見える。塔と同じく面法線に直す。
    var pediment = flatFacets(mkCone(pedR, PED_H, 3, marbleMat));
    pediment.rotation.y = Math.PI; pediment.scale.z = 0.22;
    place(pediment, 0, ENT_Y + 0.98 + PED_H/2, PZ - 0.16 - 0.5*pedR*0.22);
    fg.group.add(pediment);                   // 頂点 ≒ 10.0m = 壁高の約半分

    var steps = mkBox(doorW + 2.6, 0.42, 1.9, fg.mat);
    place(steps, 0, 0.21, cz + 1.25, wallRy(theta));
    group.add(steps);
    registerPick(pickables, 'structure', 0, 4.6, cz, ENT_W + 1.0, 9.2, 3.5,
      '主玄関ポータル Main Portal',
      '古典的な凱旋門を思わせる装飾ポータル。尖頭アーチの扉口の上に、付柱・歯飾りのエンタブラチュア・三角ペディメントを重ねる。堀も跳ね橋もないこの城で、唯一"威容"を演出する要素。フリードリヒ2世が愛したギリシア・ローマ古典への傾倒がうかがえる。');
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
    var shaft = flatFacets(mkCyl(TOWER_CIRC_R, TOWER_CIRC_R*1.03, TOWER_H, 8, tfg.mat));
    shaft.rotation.y = Math.PI/8;
    place(shaft, tcx, TOWER_H/2, tcz);
    tfg.group.add(shaft);
    var tPlinth = flatFacets(mkCyl(TOWER_CIRC_R*1.04, TOWER_CIRC_R*1.075, 1.25, 8, tfg.mat));
    tPlinth.rotation.y = Math.PI/8;
    place(tPlinth, tcx, 0.62, tcz);
    tfg.group.add(tPlinth);
    // 塔を巡る水平コーニスは "中間の胴蛇腹1本だけ"。実物写真では塔の
    // ほぼ中央にこの1本が見えるきりで、壁頂(CORNICE_Y2)の高さには
    // 塔側に対応する帯が無い(塔はそこを素通りしてさらに上へ伸びる)。
    // 従来は2本とも塔に回していたため、塔が「輪切りの樽」に見えていた。
    (function(){
      var ring = flatFacets(mkCyl(TOWER_CIRC_R*1.06, TOWER_CIRC_R*1.06, STRING_BAND.h, 8, tfg.mat));
      ring.rotation.y = Math.PI/8;
      place(ring, tcx, STRING_BAND.y, tcz);
      tfg.group.add(ring);
    })();
    // 塔頂のごく浅い笠石。実物には手すり状の縁(パラペット)は無く、
    // 平らな頂部が薄い笠石で納まっているだけ。
    var tCope = flatFacets(mkCyl(TOWER_CIRC_R*1.05, TOWER_CIRC_R*1.05, 0.42, 8, tfg.mat));
    tCope.rotation.y = Math.PI/8;
    place(tCope, tcx, TOWER_H - 0.28, tcz);
    tfg.group.add(tCope);
    // 開口は控えめ。実物の塔はほぼ無開口で、外側正面に細いスリットが
    // 各階に1つ見える程度。
    for (var s=0;s<2;s++){
      var wm = mkBox(0.34, 1.5, 0.6, windowMat);
      place(wm, tcx + dv.x*TOWER_R*0.95, GF_FLOOR_Y+2.9 + s*6.6, tcz + dv.z*TOWER_R*0.95, wallRy(phi));
      tfg.group.add(wm);
    }
    // 平屋根キャップ(尖塔・切妻を一切持たない、平らな頂部)
    var cap = flatFacets(mkCyl(TOWER_CIRC_R*1.04, TOWER_CIRC_R*1.04, TOWER_ROOF_T, 8, roofCaps.mat));
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
    // 屋根面は壁天端のすぐ上に載せる。以前は +0.2 で、壁天端との間に
    // 20cm の隙間が空いており、低い視点で"すき間"が見えていた。
    roofMain.group.add(ringQuad(vPhi(k), vPhi(k+1), OCT_R_VERT+0.15, COURT_R_VERT+0.2, WALL_H+0.02, roofMain.mat));
  }
  // 屋根の縁を少し立ち上げたパラペット(胸壁ではない、低い縁石)。
  // 空撮写真でも、屋根の外周を細い笠石が一周しているのが確認できる。
  for (k=0;k<8;k++){
    var pTheta = wTheta(k), pd = dirAt(pTheta);
    var lip = mkBox(OCT_SIDE*0.96, 0.6, 0.34, roofMain.mat);
    place(lip, pd.x*(OCT_APOTH_OUT-0.06), WALL_H+0.30, pd.z*(OCT_APOTH_OUT-0.06), wallRy(pTheta));
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
  // 塔を正しい位置(半径23.78m + 外接4.28m = 28.1m)へ出したので、
  // 頂上の平坦部は 31m では塔の足元ぎりぎりになる。空撮写真でも城の
  // 周囲には十分な広さの平坦な敷地が広がっているので 36m に広げる。
  var R_PLATEAU = 36, R_HILLBASE = 118, HILL_DROP = 17;
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
    { r0:R_PLATEAU, r1:56,          y0:0.0,   y1:-4.2,       cTop:HILL_TOP, cEdge:HILL_TOP },
    { r0:56,        r1:86,          y0:-4.2,  y1:-11.6,      cTop:HILL_TOP, cEdge:HILL_MID },
    { r0:86,        r1:R_HILLBASE,  y0:-11.6, y1:-HILL_DROP, cTop:HILL_MID, cEdge:HILL_EDGE }
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
  // 塔を実物どおりの位置(全幅約56m)へ出したぶん、初期距離と影の範囲を
  // 少しだけ広げる。狭いままだと塔が画面端で切れる。
  view: { targetY: 5.5, zMin: 16, zMax: 140, initDist: 92,
    fogNear: 80, fogFar: 290, shadowExtent: 54, shadowFar: 190,
    camFar: 700, panLimit: 34 }
});
