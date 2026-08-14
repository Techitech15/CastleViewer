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
  /* ---- 床の色について(内装の作り込みで実測して直した点)-------------
   * 上を向いた水平面には sun(1.55 x 天頂成分0.762 x 光色) + hemi(0.65 x
   * 空色) + ambient(0.22) が乗り、Rでおよそ 1.97 倍・Gで1.94倍・Bで1.84倍
   * になる。つまり水平面のマテリアル色は各チャンネル 130 を超えると
   * 乗算後に飽和して真っ白に飛ぶ。
   * 従来の FLOOR_COL 0xc2ae82 =(194,174,130)は乗算後(382,337,239)、
   * COURT_COL 0xb59f6c =(181,159,108)は(357,308,199)で、どちらも完全に
   * クリップしていた -- 室内の床も中庭の石畳も一様に白く飛び、部屋ごとに
   * 床を描き分けても画面上では区別がつかない状態だった。
   * 全チャンネルを 130 以下に抑えた値へ置き換える。日の当たる外壁
   * (0xd0bc93 x 約1.15 =(240,217,170))と見かけの明るさが揃うように、
   * 石床は (240,219,160)/1.95 相当を基準にした。 -------------------- */
  var FLOOR_COL    = 0x7b7157; // 各室の石床(標準)
  var FLOOR_WOOD   = 0x655036; // 板床(工房・書斎)
  var FLOOR_STRAW  = 0x776b48; // 藁敷き(従者・衛兵の間)
  var FLOOR_MARBLE = 0x7c7668; // 大理石(上階の格式高い室)
  var FLOOR_TILE   = 0x6b6650; // 石タイル(厨房・浴室)
  var CELLAR_COL   = 0x6d6550; // 地階(アンダークロフト)の粗い石敷き
  var COURT_COL    = 0x786d54; // 中庭の石畳
  var PARTITION_COL= 0x847451; // 天端(上向き面)が飽和しない上限に合わせた
  var WOOD_COL     = 0x6b4f34;
  var CISTERN_COL  = 0x2f6a78;
  /* 内装用の追加色。垂直面が主なので水平面ほど厳しくないが、天板・座面
   * など上を向く面を持つものは 130 のしきい値を意識して選んである。 */
  var RIB_COL      = 0x9e9478; // ヴォールトのリブ(壁より明るい切石)
  var WOOD_DK_COL  = 0x4a3624; // 濃い木部(梁・箱の縁)
  var CLOTH_R_COL  = 0x7d3730; // 緋の織物(タペストリー・寝具)
  var CLOTH_B_COL  = 0x36456a; // 藍の織物
  var STRAW_COL    = 0x7e6d36; // 藁・干し草
  var SOIL_COL     = 0x3d3120; // 菜園の土
  var LEAF_COL     = 0x3f6b34; // 葉(濃)
  var LEAF_HI_COL  = 0x4d7d3a; // 葉(明)
  var FRUIT_COL    = 0x8a5a12; // 柑橘の実
  var TERRA_COL    = 0x8c4f34; // テラコッタの鉢
  var METAL_COL    = 0x4a4a48; // 鉄物
  var GOLD_COL     = 0x8f7130; // 金物・燭台
  var LINEN_COL    = 0x776f5e; // 麻布・紙
  /* 上向きの水平面には sun 1.55 + hemi 0.65 + ambient 0.22 でおよそ 1.9 倍が
   * 乗る。0x9e9459 = (158,148,89) は乗算後に (300,281,169) となって赤と緑が
   * クリップし、周囲の草地から浮いた鮮やかな黄色になっていた。どのチャンネルも
   * 乗算後に 235 を超えないよう、色相を保ったまま最大チャンネルを 120 前後へ
   * 引き下げてある(クリップが起きなければ彩度は素の値どおりに出る)。 */
  var HILL_TOP     = 0x5f5936; // 丘の頂上(乾いた牧草)
  var HILL_MID     = 0x5e5f38;
  var HILL_EDGE    = 0x474c2b;
  var FIELD_COL    = 0x555f3b; // 遠景の草地(プーリアらしい乾いた緑)
  /* 丘のディテール用に足した色。上の HILL_* と同じ基準(乗算後にどの
   * チャンネルも 235 を超えない = 素の値で 118 以下)で選んである。実測の
   * 検算は下の buildIsolatedHill のコメント参照。 */
  /* 岩は「上を向いた平らな面」を持つので、地面と同じ 118 上限に置くと
   * 太陽へ傾いた面が実測 241 まで上がり、草地の上に白い紙を撒いたように
   * 見えた(3周目のスクリーンショットで実測)。地面より一段低い水準に
   * 落として、それでも草地より確実に明るい = 石灰岩に見える値にする。 */
  // 太陽に正対した面には水平面(x1.93)ではなく最大 x2.29 が乗る(実測:
  // 0x6a6452 の岩で 243 まで上がった)。その最悪面でも 235 を超えないよう
  // 逆算した値が 102 -> 0x666050。水平面では(197,185,154)で、乾いた牧草
  // (183,168,97)より確実に明るく、石灰岩として読める。
  var HILL_ROCK    = 0x666050; // 石灰岩の露頭(明)
  var HILL_ROCK_D  = 0x565343; // 石灰岩の露頭(暗)。個体差で色を散らす
  var HILL_ROAD    = 0x6f6549; // 頂上へ登る土の坂道(乾いた石灰岩の砂利道)
  var HILL_GULLY   = 0x4a4028; // 襞(浅い谷)の底に出る土
  var HILL_SCRUB   = 0x3e4b27; // 風衝低木(明)。中景の木より沈んだオリーブ系の緑
  var HILL_SCRUB_D = 0x333e1f; // 風衝低木(暗)

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
  /* 内装用マテリアル。床系は「下から見上げると天井面」になるので必ず
   * DoubleSide -- 1階の部屋の天井は2階の床メッシュそのものだから。 */
  function floorMatOf(hex){ return new T.MeshLambertMaterial({ color: hex, side: T.DoubleSide }); }
  var floorWoodMat   = floorMatOf(FLOOR_WOOD);
  var floorStrawMat  = floorMatOf(FLOOR_STRAW);
  var floorMarbleMat = floorMatOf(FLOOR_MARBLE);
  var floorTileMat   = floorMatOf(FLOOR_TILE);
  var cellarMat      = floorMatOf(CELLAR_COL);
  var ribMat     = new T.MeshLambertMaterial({ color: RIB_COL });
  var woodDkMat  = new T.MeshLambertMaterial({ color: WOOD_DK_COL });
  var clothRMat  = new T.MeshLambertMaterial({ color: CLOTH_R_COL });
  var clothBMat  = new T.MeshLambertMaterial({ color: CLOTH_B_COL });
  var strawMat   = new T.MeshLambertMaterial({ color: STRAW_COL });
  var soilMat    = new T.MeshLambertMaterial({ color: SOIL_COL });
  var leafMat    = new T.MeshLambertMaterial({ color: LEAF_COL });
  var leafHiMat  = new T.MeshLambertMaterial({ color: LEAF_HI_COL });
  var fruitMat   = new T.MeshLambertMaterial({ color: FRUIT_COL });
  var terraMat   = new T.MeshLambertMaterial({ color: TERRA_COL });
  var metalMat   = new T.MeshLambertMaterial({ color: METAL_COL });
  var goldMat    = new T.MeshLambertMaterial({ color: GOLD_COL });
  var linenMat   = new T.MeshLambertMaterial({ color: LINEN_COL });
  // 炉の火だけは Basic -- 夜も光って見えてほしいので陰影を受けない。
  var fireMat    = new T.MeshBasicMaterial({ color: 0xff7d24 });

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
  //   - 家具の配置(現 fBox / rp)も同様にずれる
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

  /* ================================================================ *
   * 内装ヘルパー(部屋ローカル座標系)
   * ---------------------------------------------------------------- *
   * 部屋は台形なので、位置は常に (theta=面の中心角, r=中心からの半径,
   * off=接線方向のずれ) の3つで指定する。箱の向きは既定で wallRy(theta)
   * = 「幅wが接線方向、奥行きddが半径方向」。
   * 追加する内装メッシュは数が多いので castShadow を切ってある -- 影
   * マップの描画コストを増やさずに済み、室内は元々ほぼ影の中なので
   * 見た目の損失がほとんどない(receiveShadow は残している)。
   * ================================================================ */
  function det(m){ m.castShadow = false; interiorGroup.add(m); return m; }
  function rp(theta, r, off){
    var d0 = dirAt(theta), t0 = tanAt(theta);
    return { x: d0.x*r + t0.x*off, z: d0.z*r + t0.z*off };
  }
  // y は「下端」。上端ではなく下端で指定するほうが床から積むのに楽。
  function fBox(theta, r, off, y, w, h, dd, mat, yaw){
    var p = rp(theta, r, off);
    var m = mkBox(w, h, dd, mat);
    place(m, p.x, y + h/2, p.z, wallRy(theta) + (yaw||0));
    return det(m);
  }
  function fCyl(theta, r, off, y, rt, rb, h, seg, mat, yaw){
    var p = rp(theta, r, off);
    var m = mkCyl(rt, rb, h, seg, mat);
    place(m, p.x, y + h/2, p.z, wallRy(theta) + (yaw||0));
    return det(m);
  }
  function fCone(theta, r, off, y, rad, h, seg, mat){
    var p = rp(theta, r, off);
    var m = mkCone(rad, h, seg, mat);
    place(m, p.x, y + h/2, p.z);
    return det(m);
  }
  // ローポリの塊(葉むら・実)。IcosahedronGeometry(r,0) は20面しかない。
  function fBall(theta, r, off, y, rad, mat){
    var p = rp(theta, r, off);
    var m = new T.Mesh(new T.IcosahedronGeometry(rad, 0), mat);
    m.receiveShadow = true;
    m.position.set(p.x, y + rad, p.z);
    return det(m);
  }
  /* 2点を結ぶ角材。ヴォールトのリブ・梁・斜材はどれも「任意方向の棒」
   * なので、rotation.y だけでは向けられない。断面は正方形にしてあるので
   * setFromUnitVectors が残す長さ軸まわりのねじれは見た目に出ない。 */
  function strut(p0, p1, thick, mat){
    var dx = p1.x-p0.x, dy = p1.y-p0.y, dz = p1.z-p0.z;
    var len = Math.hypot(dx, dy, dz);
    if (len < 1e-4) return null;
    var m = mkBox(thick, len + thick*0.5, thick, mat);
    m.position.set((p0.x+p1.x)/2, (p0.y+p1.y)/2, (p0.z+p1.z)/2);
    m.quaternion.setFromUnitVectors(new T.Vector3(0,1,0), new T.Vector3(dx/len, dy/len, dz/len));
    return det(m);
  }
  /* 尖頭アーチの骨組み。この城の開口(部屋どうしの扉口・中庭側の開口・
   * ヴォールトの横断アーチ)はすべて尖頭アーチなので、1つのヘルパーで
   * まかなう。等辺尖頭アーチ = 半径がスパンに等しい2本の円弧が反対側の
   * 起拱点を中心に描かれ、頂点で交わる形。高さだけ rise で調整する。
   * mapper(u, h) は「起拱点間の中央からの横ずれ u、起拱点からの高さ h」を
   * ワールド座標へ写す関数。開口が接線方向を向くか半径方向を向くかで
   * 写像が変わるので、呼び出し側から渡す。 */
  function archStruts(mapper, half, rise, thick, mat, seg){
    seg = seg || 3;
    var S = half*2, i, base = [], poly = [];
    for (i=0;i<=seg;i++){
      var a = (Math.PI/3) * (i/seg);
      base.push([ -half + S*Math.cos(a), S*Math.sin(a) * (rise/(S*Math.sin(Math.PI/3))) ]);
    }
    for (i=0;i<=seg;i++) poly.push([ -base[i][0], base[i][1] ]);  // 左の起拱点 -> 頂点
    for (i=seg-1;i>=0;i--) poly.push(base[i]);                    // 頂点 -> 右の起拱点
    for (i=0;i<poly.length-1;i++){
      strut(mapper(poly[i][0], poly[i][1]), mapper(poly[i+1][0], poly[i+1][1]), thick, mat);
    }
  }
  // 接線方向にスパンする尖頭アーチ(壁面の開口・中庭側の開口)
  function tanArch(theta, r, off, springY, half, rise, thick, mat, seg){
    archStruts(function(u,h){
      var q = rp(theta, r, off + u);
      return { x:q.x, y: springY + h, z:q.z };
    }, half, rise, thick, mat, seg);
  }
  // 半径方向にスパンする尖頭アーチ(隅の仕切り壁に開く扉口)
  function radArch(phi, rCenter, springY, half, rise, thick, mat, seg){
    var dd = dirAt(phi);
    archStruts(function(u,h){
      return { x: dd.x*(rCenter+u), y: springY + h, z: dd.z*(rCenter+u) };
    }, half, rise, thick, mat, seg);
  }

  /* -------------------------------------------------------------- *
   * 中庭(正八角形、開放空間)-- 石畳の床 + 中庭を囲む基壇の壁
   * -------------------------------------------------------------- */
  /* 1階の床は y=3.0 にあり、中庭の石畳(y=0)との間には高さ3mの段差が
   * ある。従来はここに高さ1.3mの腰壁しか無く、中庭から見ると腰壁の上に
   * 1.7mの隙間が空いて地階(アンダークロフト)が丸見えだった。実物の
   * 中庭も、1階の床面までは連続した石積みの立ち上がりになっている。
   * -> 縁壁を1階床レベル(3.0m)まで立ち上げ、天端に笠石を回す。
   * 南面(k=4)だけは主玄関から中庭へ抜ける通路なので開口を残す
   * (住人の gate.path がここを通る)。 */
  var courtyard = octagonFan(COURT_R_VERT, 0.02, courtMat);
  interiorGroup.add(courtyard);
  var COURT_WALL_H = GF_FLOOR_Y;           // 中庭の縁壁 = 1階床の高さ
  var COURT_SIDE = OCT_SIDE*COURT_APOTH/OCT_APOTH_OUT + 0.3; // 中庭八角形の一辺(+のりしろ)
  for (k=0;k<8;k++){
    (function(kk){
      var cTheta = wTheta(kk), cd = dirAt(cTheta), ct2 = tanAt(cTheta);
      var cwR = COURT_APOTH + CWT/2;
      var spans = [[-COURT_SIDE/2, COURT_SIDE/2]];
      if (kk === 4){                        // 玄関〜中庭の通路ぶんだけ開ける
        var gapH = 1.7;
        spans = [[-COURT_SIDE/2, -gapH], [gapH, COURT_SIDE/2]];
      }
      spans.forEach(function(sp){
        var len = sp[1]-sp[0], mid = (sp[0]+sp[1])/2;
        var cw = mkBox(len, COURT_WALL_H, CWT, partitionMat);
        place(cw, cd.x*cwR + ct2.x*mid, COURT_WALL_H/2, cd.z*cwR + ct2.z*mid, wallRy(cTheta));
        det(cw);
      });
      // 天端の笠石(1階床の縁を見せる帯)
      var cope = mkBox(COURT_SIDE + 0.2, 0.26, CWT + 0.34, ribMat);
      place(cope, cd.x*cwR, COURT_WALL_H - 0.13, cd.z*cwR, wallRy(cTheta));
      det(cope);
    })(k);
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
  function pickRoom(theta, rInner, rOuter, halfW, y, h, name, desc){
    var d0 = dirAt(theta);
    var midR = (rInner+rOuter)/2;
    registerPick(pickables, 'room', d0.x*midR, y+h/2, d0.z*midR, halfW*2, h, rOuter-rInner, name, desc);
  }

  /* 16室それぞれに用途を割り当てる。実物は家具が一切残っていない空の
   * 空間で、各室の用途を示す確証も無い(「用途不明の城」と呼ばれる所以)
   * -- が、他の4城と同じ密度で「当時の生活」を想像した内装にする、という
   * 方針なので、フリードリヒ2世の狩猟・滞在の館として無理のない配置を
   * 割り当てた。名称に(想定)を付けて、史実の断定と区別している。 */
  var ROOM_NAME_GF = {
    0: { name:'玉座の間(伝) Presumed Throne Room', desc:'玄関の対面(北)に位置する1階の部屋。伝統的に謁見・玉座の間と推定されてきたが、確証はなく用途不明の一室に過ぎない、という説も根強い。' },
    1: { name:'厨房(想定) Kitchen', desc:'外壁側に炉を構えた1階の部屋。実物には厨房と断定できる痕跡は無いが、集水・排水設備が整うこの城で調理が行われたとすれば、煙を外へ抜ける外壁沿いのこの位置が自然。' },
    2: { name:'食料貯蔵室(想定) Pantry', desc:'樽と穀物袋を収めた1階の部屋。皇帝の滞在は短期間だったとされ、常設の大規模な貯蔵は不要だった。' },
    3: { name:'従士の間(想定) Retainers Hall', desc:'架台式の卓と長椅子を置いた1階の部屋。武具掛けがあるが、この城には駐屯機能がなく、随行の従士が短期滞在するだけの設え。' },
    4: { name:'玄関の間 Entrance Hall', desc:'主玄関ポータルの内側にあたる1階の間。城内で唯一、外部と直接つながる部屋。' },
    5: { name:'従者の間(想定) Servants Chamber', desc:'藁敷きの床に寝床を並べた1階の部屋。随行の使用人が寝起きした想定。' },
    6: { name:'織物の間(想定) Weaving Room', desc:'竪機(たてはた)を据えた1階の部屋。城の日常を支える手仕事の場。' },
    7: { name:'工房(想定) Workshop', desc:'作業台と材木を置いた1階の部屋。石造の館を維持するための修繕の場。' }
  };
  var ROOM_NAME_FF = {
    0: { name:'大広間(伝) Sala Maggiore / Great Hall', desc:'玄関の対面(北)に位置する2階の部屋。最も格の高い広間だったと推定されるが、暖炉の跡以外に用途を示す確証は乏しい。' },
    1: { name:'皇帝の寝室(想定) Emperor Chamber', desc:'天蓋付きの寝台を据えた2階の部屋。上階は下階より格式が高く、大きな窓・装飾的な暖炉・大理石の腰壁を備える。' },
    2: { name:'天文の間(想定) Study of the Stars', desc:'書見台と渾天儀を置いた2階の部屋。数学と天文学に傾倒したフリードリヒ2世の関心を映す。八角形という平面自体がその現れとされる。' },
    3: { name:'鷹の間(想定) Falconry Chamber', desc:'鷹の止まり木を据えた2階の部屋。フリードリヒ2世は鷹狩の理論書『鳥類による狩猟の術』を自ら著しており、この城も狩猟の館だったとする説が有力。' },
    4: { name:'貴賓の間(伝) Guest Chamber', desc:'玄関の真上にあたる2階の間。中庭側と外側の双方に開口を持つ。' },
    5: { name:'控えの間(想定) Antechamber', desc:'壁沿いに長椅子を並べた2階の部屋。大広間へ通される前の待合。' },
    6: { name:'浴室(想定) Bath Chamber', desc:'大理石の浴槽と水盤を置いた2階の部屋。実物のこの城には水洗式の設備があったとされ、当時としては例外的に高度な衛生設備を備えていた。' },
    7: { name:'礼拝の間(想定) Private Oratory', desc:'簡素な石の祭壇を据えた2階の部屋。皇帝個人の祈りの場という想定。' }
  };
  // 部屋ごとの床の質感(1階/2階)。石・板・藁・大理石・石タイルを使い分ける。
  var GF_FLOOR_MAT = [floorMat, floorTileMat, floorMat, floorStrawMat,
                      floorMat, floorStrawMat, floorWoodMat, floorWoodMat];
  var FF_FLOOR_MAT = [floorMarbleMat, floorWoodMat, floorWoodMat, floorStrawMat,
                      floorMarbleMat, floorMat, floorTileMat, floorMarbleMat];

  var innerFloorR = COURT_APOTH_OUT, outerFloorR = OCT_APOTH_IN;
  // 正八角形の「側辺半長 = 対辺間半径(アポテム) x tan(22.5°)」の関係を
  // inner/outerそれぞれの半径にそのまま適用する -- こうすると各室の
  // 斜め辺が正確に頂点角(vPhi)を通る径方向の直線になり、隣接する8室が
  // 継ぎ目なく(隙間もオーバーラップもなく)タイル状に並ぶ。以前は外側
  // だけ別の式(OCT_SIDE/2 - 0.4)を使っておりズレが生じていた。
  var halfInnerW = innerFloorR * Math.tan(Math.PI/8);
  var halfOuterW = outerFloorR * Math.tan(Math.PI/8);
  var MID_R = (innerFloorR + outerFloorR)/2;                 // 室の中央の半径 ≒13.3m
  var halfMidW = MID_R * Math.tan(Math.PI/8);                 // 室の中央での半幅 ≒5.5m
  // 階ごとのレベル。柱頭(capY)から上がリブ、crownY がヴォールトの要。
  var GF_ROOM_TOP = FF_FLOOR_Y - GF_FLOOR_Y;                  // 1階の階高 6.5m
  var FF_ROOM_TOP = WALL_H - FF_FLOOR_Y;                      // 2階の階高 10.3m
  var GF_CAP_Y = GF_FLOOR_Y + 3.2, GF_CROWN_Y = FF_FLOOR_Y - 0.28;
  var FF_CAP_Y = FF_FLOOR_Y + 5.6, FF_CROWN_Y = WALL_H - 0.35;

  /* ---- リブ・ヴォールト -------------------------------------------
   * 実物写真(Wikimedia Commons: "Castel del monte, interno, volta 01.jpg"
   * / "... stanze 01.jpg")で確認した構成をローポリに落とす:
   *   - 台形室の4隅に角礫岩(玄関ポータルと同じ、白い石灰岩の中で唯一
   *     赤みを持つ石)の付柱が立ち、その上に明色の柱頭が載る
   *   - 柱頭から4本の対角リブが立ち上がり、中央のボス(rosoncino)で交差
   *   - リブは天井のウェブ面より一段下がった明るい切石
   * ウェブ(天井面そのもの)は張らない -- 上階の床メッシュ(DoubleSide)が
   * そのまま天井として見えるので、リブ+付柱+ボスだけで「ヴォールトの
   * 部屋」として十分読める。 */
  function ribVault(theta, floorY, capY, crownY){
    var cp = rp(theta, MID_R, 0);
    var boss = { x: cp.x, y: crownY, z: cp.z };
    var corners = [
      [innerFloorR + 0.55, -(halfInnerW - 0.6)], [innerFloorR + 0.55, halfInnerW - 0.6],
      [outerFloorR - 0.55,   halfOuterW - 0.8 ], [outerFloorR - 0.55, -(halfOuterW - 0.8)]
    ];
    corners.forEach(function(c){
      fCyl(theta, c[0], c[1], floorY, 0.26, 0.30, capY - floorY, 8, marbleMat);
      fBox(theta, c[0], c[1], capY, 0.76, 0.30, 0.76, ribMat);
      var q = rp(theta, c[0], c[1]);
      var a = { x:q.x, y: capY + 0.34, z:q.z };
      // 尖頭アーチらしい反りを出すため、対角リブは2分割して中間点を
      // 直線より上へ持ち上げる(直線1本だとただの斜材に見える)。
      var mid = { x:(a.x+boss.x)/2, y: a.y + (crownY - a.y)*0.76, z:(a.z+boss.z)/2 };
      strut(a, mid, 0.18, ribMat);
      strut(mid, boss, 0.18, ribMat);
    });
    fCyl(theta, MID_R, 0, crownY - 0.14, 0.42, 0.42, 0.24, 8, ribMat);
  }

  /* ---- 隅の仕切り壁 + 扉口 ----------------------------------------
   * 従来は高さ3.0mの腰壁で、階高6.5m/10.3mの中では「低い衝立」にしか
   * 見えなかった。実物は天井まで達する石壁で、中ほどに尖頭アーチの扉口
   * が開いて隣室へ連続する -- この城の部屋は廊下を持たず、8室が扉で
   * 数珠つなぎに巡る、というのが平面の最大の特徴。 */
  function partitionWithDoor(phi, floorY, roomH, doorH, arched){
    var dd = dirAt(phi);
    var dR0 = MID_R - 0.85, dR1 = MID_R + 0.85;
    [[innerFloorR, dR0], [dR1, outerFloorR]].forEach(function(sp){
      var m = mkBox(sp[1]-sp[0], roomH, 0.44, partitionMat);
      place(m, dd.x*(sp[0]+sp[1])/2, floorY + roomH/2, dd.z*(sp[0]+sp[1])/2, radialRy(phi));
      det(m);
    });
    var above = mkBox(dR1-dR0, roomH - doorH, 0.44, partitionMat);
    place(above, dd.x*MID_R, floorY + doorH + (roomH-doorH)/2, dd.z*MID_R, radialRy(phi));
    det(above);
    // 扉枠(角礫岩)。実物では部屋どうしの扉口だけが赤みの石で縁取られる。
    [dR0, dR1].forEach(function(rr){
      var j = mkBox(0.34, doorH, 0.66, marbleMat);
      place(j, dd.x*rr, floorY + doorH/2, dd.z*rr, radialRy(phi));
      det(j);
    });
    if (arched) radArch(phi, MID_R, floorY + doorH - 0.95, 0.85, 0.95, 0.24, marbleMat, 2);
    else {
      var lint = mkBox(dR1-dR0+0.5, 0.3, 0.66, marbleMat);
      place(lint, dd.x*MID_R, floorY + doorH + 0.15, dd.z*MID_R, radialRy(phi));
      det(lint);
    }
  }

  /* ---- 中庭側の立面 ------------------------------------------------
   * 最初は「開放アーケード(細い方立+アーチの輪郭だけ)」で組んだが、
   * 8面 x 2階 = 16組の細い部材だけが中庭をぐるりと囲む形になり、建築では
   * なく白い足場のように見えた。実物の中庭側の立面もロッジアではなく、
   * 扉と窓を穿った石壁(2階の装飾ポータルが有名)なので、素直に壁を
   * 立てて中央に尖頭アーチの扉口を開ける。まぐさの上にアーチの見え掛かり
   * (浮き彫り)を重ねると、開口が四角くてもこの城らしく読める。 */
  function courtWallFace(theta, floorY, roomH, doorH, withWindows){
    var r0 = innerFloorR + 0.26, tk = 0.52;
    var edge = r0 * Math.tan(Math.PI/8);       // 室の内側端の半幅 ≒4.14
    var half = 1.75;                            // 扉口の半幅(開口幅3.5m)
    [-1,1].forEach(function(s){
      var w = edge - half;
      fBox(theta, r0, s*(half + w/2), floorY, w, roomH, tk, partitionMat);
    });
    fBox(theta, r0, 0, floorY + doorH, half*2, roomH - doorH, tk, partitionMat);
    [-1,1].forEach(function(s){                 // 扉口の縁(角礫岩)
      fBox(theta, r0 - 0.08, s*half, floorY, 0.34, doorH, tk, marbleMat);
    });
    fBox(theta, r0 - 0.08, 0, floorY + doorH, half*2 + 0.72, 0.34, tk, marbleMat);
    tanArch(theta, r0 - tk*0.55, 0, floorY + doorH + 0.34, half + 0.18, 1.5, 0.24, ribMat, 3);
    if (withWindows){                           // 上階は扉口の左右に窓
      [-1,1].forEach(function(s){
        fBox(theta, r0 - 0.16, s*2.95, floorY + 2.3, 0.85, 1.95, 0.30, windowMat);
        fBox(theta, r0 - 0.24, s*2.95, floorY + 4.25, 1.15, 0.24, 0.30, trimMat);
      });
    }
  }

  /* ---- 家具の部品 -------------------------------------------------- */
  function fTable(theta, r, off, y, w, dd, mat){
    fBox(theta, r, off, y+0.70, w, 0.12, dd, mat);
    fBox(theta, r, off - w/2 + 0.30, y, 0.20, 0.70, dd*0.72, mat);
    fBox(theta, r, off + w/2 - 0.30, y, 0.20, 0.70, dd*0.72, mat);
  }
  function fBench(theta, r, off, y, w, dd, yaw){
    fBox(theta, r, off, y+0.40, w, 0.10, dd, woodMat, yaw);
    fBox(theta, r, off - w/2 + 0.22, y, 0.14, 0.40, dd*0.7, woodDkMat, yaw);
    fBox(theta, r, off + w/2 - 0.22, y, 0.14, 0.40, dd*0.7, woodDkMat, yaw);
  }
  function fChest(theta, r, off, y, w){
    fBox(theta, r, off, y, w, 0.52, 0.62, woodMat);
    fBox(theta, r, off, y+0.52, w*1.05, 0.12, 0.68, woodDkMat);
  }
  function fBarrel(theta, r, off, y, rad, h){
    fCyl(theta, r, off, y, rad*0.88, rad*0.88, h, 10, woodMat);
    fCyl(theta, r, off, y + h*0.38, rad, rad, 0.10, 10, woodDkMat);
  }
  function fBrazier(theta, r, off, y){
    fCyl(theta, r, off, y, 0.06, 0.06, 0.62, 6, metalMat);
    fCyl(theta, r, off, y+0.62, 0.34, 0.20, 0.22, 8, metalMat);
    fCone(theta, r, off, y+0.80, 0.20, 0.36, 6, fireMat);
  }
  function fCandle(theta, r, off, y, h){
    fCyl(theta, r, off, y, 0.05, 0.14, h, 6, goldMat);
    fCyl(theta, r, off, y+h, 0.26, 0.10, 0.07, 6, goldMat);
    fCone(theta, r, off, y+h+0.07, 0.07, 0.20, 5, fireMat);
  }
  function fSack(theta, r, off, y, s){
    fCone(theta, r, off, y, s, s*2.1, 6, linenMat);
  }
  function fTapestry(theta, r, off, y, w, h, mat){
    fBox(theta, r, off, y, w, h, 0.09, mat);
    fBox(theta, r - 0.06, off, y + h, w + 0.2, 0.12, 0.16, woodDkMat);
  }
  /* 暖炉。実物の上階には装飾的な暖炉(camino)がある。フードは
   * CylinderGeometry(seg=4) の四角錐台を1メッシュで済ませる。
   * 注意: 「rotation.y に +π/4 を足して面を正対させ、そのうえで
   * scale.x で横に広げる」とやると破綻する -- scale はローカル座標系に
   * 効くので、π/4 回した後の軸方向に伸びてしまい、菱形にひしゃげた
   * 「白い帆」のような物体になる(実際そう見えていた)。回転はジオメトリ
   * 側で済ませ、mesh の rotation.y は壁向きだけにする。 */
  function fFireplace(theta, floorY){
    var rw = outerFloorR - 0.28;
    fBox(theta, rw - 0.34, 0, floorY, 3.0, 0.16, 1.05, darkMat);       // 炉床
    [-1,1].forEach(function(s){
      fBox(theta, rw, s*1.25, floorY, 0.45, 1.95, 0.72, marbleMat);     // 袖石
    });
    fBox(theta, rw, 0, floorY + 1.95, 3.2, 0.34, 0.78, marbleMat);      // まぐさ
    var hoodGeo = new T.CylinderGeometry(0.34, 1.12, 1.7, 4);
    hoodGeo.rotateY(Math.PI/4);
    hoodGeo.scale(1.45, 1, 0.58);
    var hood = new T.Mesh(hoodGeo, partitionMat);
    hood.receiveShadow = true;
    var hp = rp(theta, rw - 0.05, 0);
    place(hood, hp.x, floorY + 3.14, hp.z, wallRy(theta));
    flatFacets(hood); det(hood);
    fCone(theta, rw - 0.34, 0, floorY + 0.16, 0.46, 0.62, 6, fireMat);  // 炎
    fBox(theta, rw - 0.34, -0.5, floorY + 0.16, 0.9, 0.18, 0.2, woodDkMat, 0.3);
    fBox(theta, rw - 0.34,  0.5, floorY + 0.16, 0.9, 0.18, 0.2, woodDkMat, -0.3);
  }

  /* ---- 各室の基準半径 ----------------------------------------------
   * 台形室は内側(中庭側)9.73m 〜 外側(外壁の室内面)16.92m。家具は
   * この範囲を出ないように、4つの基準半径からの相対で置く。
   * (最初に組んだときは「外壁沿い」を outerFloorR-0.8 とし、そこから
   *  さらに +1.0 したりしていたため、玉座の背もたれやタペストリーが
   *  外壁の中に完全に埋まって見えなくなっていた。) */
  var R_WALL = outerFloorR - 0.12;    // 外壁の室内側の面 ≒16.80(壁掛け用)
  var R_OUT  = outerFloorR - 1.35;    // 外壁沿いに置く家具の中心 ≒15.57
  var R_IN   = innerFloorR + 1.35;    // 中庭側に置く家具の中心 ≒11.08

  /* ---- 1階8室の設え ------------------------------------------------ */
  function furnishGF(kk, th){
    var y = GF_FLOOR_Y;
    if (kk === 0){                       // 玉座の間
      fBox(th, R_OUT, 0, y, 5.4, 0.22, 2.4, darkMat);                  // 壇(1段目)
      fBox(th, R_OUT + 0.33, 0, y + 0.22, 4.4, 0.22, 1.8, darkMat);    // 壇(2段目)
      fBox(th, R_OUT + 0.53, 0, y + 0.44, 1.05, 0.48, 0.9, woodDkMat); // 玉座の座
      fBox(th, R_OUT + 1.03, 0, y + 0.44, 1.15, 2.1, 0.24, woodDkMat); // 背もたれ
      fBox(th, R_OUT + 0.58, 0, y + 1.05, 1.35, 0.14, 1.0, goldMat);   // 肘掛け
      fTapestry(th, R_WALL, -2.9, y + 2.4, 2.0, 3.2, clothRMat);
      fTapestry(th, R_WALL,  2.9, y + 2.4, 2.0, 3.2, clothBMat);
      fBrazier(th, MID_R, -2.4, y); fBrazier(th, MID_R, 2.4, y);
      fBench(th, R_IN, -3.2, y, 2.4, 0.5, Math.PI/2);
      fBench(th, R_IN,  3.2, y, 2.4, 0.5, Math.PI/2);
    } else if (kk === 1){                // 厨房
      fFireplace(th, y);
      fCyl(th, outerFloorR - 0.62, 0, y + 0.55, 0.55, 0.42, 0.6, 10, metalMat); // 釜
      fCyl(th, outerFloorR - 0.62, 0, y + 1.15, 0.05, 0.05, 0.9, 6, metalMat);  // 吊り鎖
      fTable(th, MID_R, -1.6, y, 2.6, 1.1, woodMat);
      fBarrel(th, R_IN + 0.6, 2.9, y, 0.48, 1.05);
      fBarrel(th, R_IN + 1.7, 3.2, y, 0.48, 1.05);
      fBox(th, MID_R + 1.2, 3.0, y, 1.6, 1.0, 0.9, woodDkMat);         // 薪の山
      fBox(th, MID_R + 1.2, 3.0, y + 1.0, 1.3, 0.5, 0.7, woodDkMat);
      fBox(th, R_WALL - 0.28, -3.6, y + 1.5, 2.0, 0.12, 0.52, woodMat);// 吊り棚
      fCyl(th, R_WALL - 0.35, -4.0, y + 1.62, 0.16, 0.16, 0.3, 8, metalMat);
      fCyl(th, R_WALL - 0.35, -3.2, y + 1.62, 0.2, 0.2, 0.26, 8, terraMat);
    } else if (kk === 2){                // 食料貯蔵室
      [-3.4,-2.2,-1.0].forEach(function(o){ fBarrel(th, R_OUT, o, y, 0.52, 1.15); });
      [-2.8,-1.6].forEach(function(o){ fBarrel(th, R_OUT - 1.3, o, y, 0.52, 1.15); });
      fSack(th, MID_R, 1.6, y, 0.45); fSack(th, MID_R + 0.9, 2.5, y, 0.45);
      fSack(th, MID_R - 0.7, 2.7, y, 0.40);
      fBox(th, R_IN + 0.5, 3.2, y, 1.1, 0.8, 0.9, woodMat);            // 木箱
      fBox(th, R_IN + 0.5, 3.2, y + 0.8, 0.9, 0.7, 0.75, woodMat);
      fBox(th, R_WALL - 0.30, 2.6, y + 1.6, 3.2, 0.12, 0.55, woodMat); // 棚板
      fBox(th, R_WALL - 0.30, 2.6, y + 2.3, 3.2, 0.12, 0.55, woodMat);
      [1.6, 2.4, 3.2].forEach(function(o){
        fCyl(th, R_WALL - 0.35, o, y + 1.72, 0.16, 0.13, 0.34, 8, terraMat);
      });
    } else if (kk === 3){                // 従士の間
      fTable(th, MID_R, 0, y, 3.6, 1.2, woodMat);
      fBench(th, MID_R, -1.05, y, 3.2, 0.42);
      fBench(th, MID_R,  1.05, y, 3.2, 0.42);
      fChest(th, R_OUT, -3.0, y, 1.3);
      fBox(th, R_WALL - 0.16, 2.8, y + 2.0, 2.4, 0.16, 0.3, woodDkMat);// 武具掛け
      [-0.7, 0, 0.7].forEach(function(o){
        fCyl(th, R_WALL - 0.30, 2.8 + o, y, 0.05, 0.05, 2.4, 5, woodDkMat);
        fCone(th, R_WALL - 0.30, 2.8 + o, y + 2.4, 0.09, 0.32, 5, metalMat);
      });
      fBox(th, R_IN + 0.4, -3.2, y, 2.0, 0.24, 1.1, strawMat);         // 藁の寝床
      fBrazier(th, R_IN + 0.4, 2.6, y);
    } else if (kk === 4){                // 玄関の間
      fBench(th, R_IN + 0.4, -3.4, y, 3.0, 0.5, Math.PI/2);
      fBench(th, R_IN + 0.4,  3.4, y, 3.0, 0.5, Math.PI/2);
      fChest(th, R_OUT, -3.2, y, 1.4);
      fChest(th, R_OUT,  3.2, y, 1.4);
      [-2.2, 2.2].forEach(function(o){                                 // 松明の受け
        fBox(th, R_WALL - 0.20, o, y + 2.4, 0.22, 0.5, 0.3, metalMat);
        fCone(th, R_WALL - 0.36, o, y + 2.8, 0.16, 0.4, 5, fireMat);
      });
      fBox(th, MID_R + 0.6, 0, y + 0.02, 3.0, 0.06, 3.4, darkMat);     // 敷石の通路
    } else if (kk === 5){                // 従者の間
      [-3.2, -1.4, 0.4].forEach(function(o){
        fBox(th, R_OUT - 0.1, o, y, 1.0, 0.22, 2.0, strawMat);
        fBox(th, R_OUT - 0.1, o, y + 0.22, 0.9, 0.14, 1.9, linenMat);
      });
      fChest(th, R_IN + 0.6, 2.6, y, 1.2);
      fTable(th, MID_R + 0.6, 3.0, y, 1.6, 0.9, woodMat);
      fCyl(th, MID_R + 0.6, 3.0, y + 0.82, 0.26, 0.22, 0.16, 8, terraMat);
      fCandle(th, MID_R + 0.6, 2.2, y, 0.9);
      fBox(th, R_WALL - 0.16, -3.0, y + 1.9, 2.0, 0.12, 0.24, woodDkMat); // 衣掛け
      fBox(th, R_WALL - 0.30, -3.0, y + 1.0, 0.9, 0.9, 0.14, clothBMat);
    } else if (kk === 6){                // 織物の間
      // 竪機(たてはた): 2本の柱 + 上の巻取り棒 + 織りかけの布
      [-1.3, 1.3].forEach(function(o){ fBox(th, MID_R, o, y, 0.16, 2.6, 0.9, woodDkMat); });
      fBox(th, MID_R, 0, y + 2.5, 2.9, 0.18, 0.9, woodDkMat);
      fBox(th, MID_R, 0, y + 0.6, 2.5, 1.5, 0.12, linenMat);
      fBench(th, MID_R - 1.3, 0, y, 1.0, 0.4);
      fCyl(th, R_IN + 0.6, 2.8, y, 0.42, 0.5, 0.4, 8, strawMat);       // 糸かご
      fBox(th, R_OUT, -2.8, y, 1.4, 0.9, 0.9, clothBMat);              // 反物
      fBox(th, R_OUT, -2.8, y + 0.9, 1.2, 0.5, 0.8, clothRMat);
      fTable(th, R_OUT, 2.4, y, 2.0, 1.0, woodMat);
      fBox(th, R_OUT, 2.4, y + 0.82, 1.2, 0.2, 0.7, linenMat);
    } else {                             // 工房(kk === 7)
      fTable(th, MID_R, -0.8, y, 3.0, 1.3, woodDkMat);
      fBox(th, MID_R, -0.8, y + 0.82, 0.6, 0.14, 0.5, metalMat);       // 金床
      fBox(th, R_WALL - 0.16, 2.4, y + 1.9, 2.4, 0.14, 0.28, woodDkMat);// 道具掛け
      [-0.6, 0, 0.6].forEach(function(o){
        fBox(th, R_WALL - 0.30, 2.4 + o, y + 1.35, 0.14, 0.55, 0.12, metalMat);
      });
      [0, 0.34, 0.68].forEach(function(dy){                            // 材木の山
        fBox(th, R_IN + 0.9, 3.0, y + dy, 3.0, 0.30, 0.32, woodMat, Math.PI/2);
      });
      fBarrel(th, R_OUT, -3.0, y, 0.45, 0.95);
      fBox(th, MID_R + 0.4, 2.6, y, 1.4, 0.8, 0.5, woodMat, 0.4);      // 木挽き台
      fSack(th, R_IN + 0.4, -2.6, y, 0.40);
    }
  }

  /* ---- 2階8室の設え(上階のほうが格式が高い)----------------------
   * 実物でも上階は大きな窓・装飾的な暖炉・大理石の腰壁を備え、下階より
   * はっきり格が上。ここでも腰壁を全室に回し、家具の密度を上げる。 */
  function furnishFF(kk, th){
    var y = FF_FLOOR_Y;
    fBox(th, outerFloorR - 0.16, 0, y, halfOuterW*1.7, 0.95, 0.3, marbleMat); // 大理石の腰壁
    if (kk === 0){                       // 大広間
      fFireplace(th, y);
      fTable(th, MID_R, 0, y, 5.0, 1.4, woodMat);
      fBench(th, MID_R, -1.15, y, 4.4, 0.45);
      fBench(th, MID_R,  1.15, y, 4.4, 0.45);
      fBox(th, R_OUT - 0.2, -3.6, y, 1.0, 0.5, 0.9, woodDkMat);        // 上座
      fBox(th, R_OUT + 0.25, -3.6, y + 0.5, 1.1, 1.6, 0.16, clothRMat);
      fTapestry(th, R_WALL, 3.4, y + 3.0, 2.4, 3.6, clothRMat);
      fCandle(th, MID_R, -2.0, y + 0.82, 0.5);
      fCandle(th, MID_R,  2.0, y + 0.82, 0.5);
      fBox(th, R_IN + 0.3, 3.2, y, 2.2, 1.0, 0.7, woodMat);            // 食器棚
      fBox(th, R_IN + 0.3, 3.2, y + 1.0, 2.0, 0.1, 0.6, woodDkMat);
      [-0.6, 0, 0.6].forEach(function(o){
        fCyl(th, R_IN + 0.3, 3.2 + o, y + 1.1, 0.13, 0.10, 0.24, 8, goldMat);
      });
    } else if (kk === 1){                // 皇帝の寝室
      fFireplace(th, y);
      var br = MID_R + 0.4, bo = -2.2;
      fBox(th, br, bo, y, 2.2, 0.42, 2.6, woodDkMat);                  // 寝台
      fBox(th, br, bo, y + 0.42, 2.05, 0.28, 2.45, linenMat);
      fBox(th, br, bo, y + 0.70, 2.05, 0.14, 1.2, clothRMat);
      fBox(th, br - 1.1, bo, y + 0.70, 1.6, 0.20, 0.5, linenMat);      // 枕
      [[-1,-1],[-1,1],[1,-1],[1,1]].forEach(function(s){               // 天蓋の4柱
        fCyl(th, br + s[0]*1.2, bo + s[1]*1.0, y, 0.09, 0.09, 3.0, 6, woodDkMat);
      });
      fBox(th, br, bo, y + 3.0, 2.5, 0.18, 2.9, woodDkMat);            // 天蓋
      fBox(th, br + 1.2, bo, y + 1.2, 0.14, 1.8, 2.6, clothBMat);      // 帳
      fChest(th, R_IN + 0.5, 2.6, y, 1.5);
      fBench(th, MID_R, 3.2, y, 1.0, 0.5);
      fBox(th, R_OUT - 0.3, 3.0, y + 0.01, 3.2, 0.05, 2.4, clothBMat); // 敷物
      fCandle(th, R_IN + 0.5, 3.6, y + 0.52, 0.5);
    } else if (kk === 2){                // 天文の間
      fBox(th, MID_R, -1.0, y, 0.5, 1.2, 0.5, woodDkMat);              // 書見台
      fCyl(th, MID_R, -1.0, y + 1.2, 0.55, 0.55, 0.1, 8, woodDkMat);
      fBox(th, MID_R, -1.0, y + 1.30, 0.9, 0.08, 0.7, woodMat);
      fBox(th, MID_R, -1.0, y + 1.38, 0.7, 0.06, 0.5, linenMat);
      fTable(th, MID_R + 0.9, 1.9, y, 2.4, 1.1, woodMat);
      // 渾天儀(アーミラリー天球儀)-- 3枚の輪を直交させる
      (function(){
        var p = rp(th, MID_R + 0.9, 1.9);
        [[0,0,0],[Math.PI/2,0,0],[0,0,Math.PI/2]].forEach(function(rot){
          var ring = new T.Mesh(new T.TorusGeometry(0.34, 0.035, 4, 14), goldMat);
          ring.position.set(p.x, y + 1.22, p.z);
          ring.rotation.set(rot[0], rot[1], rot[2]);
          det(ring);
        });
        var core = new T.Mesh(new T.IcosahedronGeometry(0.09, 0), metalMat);
        core.position.set(p.x, y + 1.22, p.z);
        det(core);
      })();
      fBox(th, R_WALL - 0.30, -3.0, y + 0.9, 2.8, 0.12, 0.5, woodMat); // 巻子の棚
      fBox(th, R_WALL - 0.30, -3.0, y + 1.7, 2.8, 0.12, 0.5, woodMat);
      [-3.8,-3.3,-2.8,-2.3].forEach(function(o){
        fCyl(th, R_WALL - 0.30, o, y + 1.02, 0.09, 0.09, 0.5, 6, linenMat);
        fCyl(th, R_WALL - 0.30, o, y + 1.82, 0.09, 0.09, 0.5, 6, linenMat);
      });
      fBench(th, MID_R - 1.1, 1.9, y, 0.8, 0.5);
      fCandle(th, MID_R + 0.9, 2.9, y + 0.82, 0.45);
      fTapestry(th, R_WALL, 3.4, y + 2.8, 2.0, 3.0, clothBMat);
    } else if (kk === 3){                // 鷹の間
      [-1.2, 1.2].forEach(function(o){
        fCyl(th, MID_R + 0.4, o, y, 0.10, 0.10, 1.5, 6, woodDkMat);
      });
      fBox(th, MID_R + 0.4, 0, y + 1.5, 3.0, 0.14, 0.14, woodDkMat);   // 止まり木
      [-0.9, 0.1, 0.9].forEach(function(o){                            // 鷹
        fBall(th, MID_R + 0.4, o, y + 1.64, 0.20, woodMat);
        fBall(th, MID_R + 0.26, o, y + 1.96, 0.11, linenMat);
      });
      fBox(th, MID_R + 0.4, 0, y + 0.01, 3.2, 0.06, 1.0, strawMat);    // 受けの藁
      fChest(th, R_OUT, -3.0, y, 1.4);
      fTable(th, R_IN + 0.8, 2.8, y, 1.8, 1.0, woodMat);
      fBox(th, R_IN + 0.8, 2.8, y + 0.82, 0.5, 0.16, 0.4, woodDkMat);  // 鷹の頭巾箱
      fTapestry(th, R_WALL, 3.2, y + 2.6, 2.0, 3.0, clothBMat);
      fBrazier(th, MID_R - 1.4, -3.0, y);
    } else if (kk === 4){                // 貴賓の間
      var b2 = MID_R + 0.4;
      fBox(th, b2, -2.4, y, 2.0, 0.40, 2.4, woodDkMat);
      fBox(th, b2, -2.4, y + 0.40, 1.85, 0.26, 2.25, linenMat);
      fBox(th, b2, -2.4, y + 0.66, 1.85, 0.12, 1.1, clothBMat);
      fBox(th, b2 - 1.0, -2.4, y + 0.66, 1.5, 0.18, 0.45, linenMat);
      fChest(th, R_IN + 0.6, 1.4, y, 1.3);
      fBrazier(th, MID_R + 0.4, 2.6, y);
      fTable(th, R_OUT, 3.0, y, 1.6, 0.9, woodMat);
      fCyl(th, R_OUT, 3.0, y + 0.82, 0.30, 0.24, 0.2, 8, terraMat);    // 水差し
      fTapestry(th, R_WALL, -3.4, y + 2.6, 2.0, 3.0, clothRMat);
      fBench(th, R_IN + 0.6, -1.4, y, 1.4, 0.5);
    } else if (kk === 5){                // 控えの間
      fBench(th, R_IN + 0.4, -3.4, y, 3.4, 0.55, Math.PI/2);
      fBench(th, R_IN + 0.4,  3.4, y, 3.4, 0.55, Math.PI/2);
      fBench(th, R_OUT, 0, y, 4.0, 0.55);
      fTable(th, MID_R, 0, y, 2.2, 1.0, woodMat);
      fCandle(th, MID_R, 0, y + 0.82, 0.55);
      fTapestry(th, R_WALL, -3.2, y + 2.6, 2.2, 3.2, clothBMat);
      fTapestry(th, R_WALL,  3.2, y + 2.6, 2.2, 3.2, clothRMat);
      fBrazier(th, MID_R - 1.6, 2.6, y);
    } else if (kk === 6){                // 浴室
      fBox(th, MID_R + 0.4, -1.6, y, 2.6, 0.72, 1.8, marbleMat);       // 浴槽
      fBox(th, MID_R + 0.4, -1.6, y + 0.66, 2.2, 0.14, 1.4, cisternMat);
      fCyl(th, R_OUT, 2.4, y, 0.36, 0.30, 0.95, 8, marbleMat);         // 水盤の脚
      fCyl(th, R_OUT, 2.4, y + 0.95, 0.62, 0.5, 0.28, 8, marbleMat);
      fCyl(th, R_OUT, 2.4, y + 1.20, 0.52, 0.52, 0.06, 8, cisternMat);
      fBench(th, MID_R - 1.4, 2.2, y, 1.8, 0.55);
      fBox(th, MID_R - 1.4, 2.2, y + 0.5, 1.2, 0.1, 0.45, linenMat);   // 布
      fBrazier(th, R_IN + 0.8, -3.0, y);
      fCyl(th, R_OUT, -2.6, y, 0.46, 0.40, 0.9, 10, terraMat);         // 水瓶
      fBox(th, R_WALL - 0.20, -1.6, y + 1.0, 0.35, 0.35, 0.3, marbleMat); // 吐水口
    } else {                             // 礼拝の間(kk === 7)
      fBox(th, R_OUT + 0.2, 0, y, 2.6, 0.24, 1.5, marbleMat);          // 壇
      fBox(th, R_OUT + 0.35, 0, y + 0.24, 1.9, 0.95, 0.85, marbleMat); // 祭壇
      fBox(th, R_OUT + 0.35, 0, y + 1.19, 2.1, 0.12, 1.0, trimMat);
      fBox(th, R_OUT + 0.35, 0, y + 1.31, 1.6, 0.06, 0.75, linenMat);
      fBox(th, R_OUT + 0.55, 0, y + 1.37, 0.14, 0.85, 0.1, goldMat);   // 十字
      fBox(th, R_OUT + 0.55, 0, y + 1.90, 0.55, 0.14, 0.1, goldMat);
      fCandle(th, R_OUT + 0.35, -0.85, y + 1.31, 0.42);
      fCandle(th, R_OUT + 0.35,  0.85, y + 1.31, 0.42);
      fBox(th, MID_R, 0, y, 1.5, 0.30, 0.5, woodDkMat);                // 跪き台
      fBox(th, MID_R - 0.3, 0, y + 0.30, 1.5, 0.7, 0.14, woodDkMat);
      fBench(th, MID_R - 1.4, 0, y, 2.4, 0.5);
      fTapestry(th, R_WALL, -3.0, y + 2.4, 1.8, 2.8, clothBMat);
    }
  }

  for (k=0;k<8;k++){
    (function(kk){
      var rt = wTheta(kk);
      var gfFloor = mkTrapFloor(rt, innerFloorR, outerFloorR, halfInnerW, halfOuterW, GF_FLOOR_Y, GF_FLOOR_MAT[kk]);
      gfFloor.castShadow = false;
      interiorGroup.add(gfFloor);
      var ffFloor = mkTrapFloor(rt, innerFloorR, outerFloorR, halfInnerW, halfOuterW, FF_FLOOR_Y, FF_FLOOR_MAT[kk]);
      ffFloor.castShadow = false;
      interiorGroup.add(ffFloor);
      var gfInfo = ROOM_NAME_GF[kk], ffInfo = ROOM_NAME_FF[kk];
      pickRoom(rt, innerFloorR, outerFloorR, halfOuterW, GF_FLOOR_Y, GF_ROOM_H, gfInfo.name, gfInfo.desc);
      pickRoom(rt, innerFloorR, outerFloorR, halfOuterW, FF_FLOOR_Y, FF_ROOM_H, ffInfo.name, ffInfo.desc);
      // 中庭側の立面(扉口を穿った石壁)
      courtWallFace(rt, GF_FLOOR_Y, GF_ROOM_TOP, 4.0, false);
      courtWallFace(rt, FF_FLOOR_Y, FF_ROOM_TOP, 4.6, true);
      // ヴォールト
      ribVault(rt, GF_FLOOR_Y, GF_CAP_Y, GF_CROWN_Y);
      ribVault(rt, FF_FLOOR_Y, FF_CAP_Y, FF_CROWN_Y);
      // 柱頭の高さを巡る胴蛇腹(インポスト)-- 実物の室内で最も目を引く水平線
      fBox(rt, outerFloorR - 0.12, 0, GF_CAP_Y - 0.16, halfOuterW*1.75, 0.14, 0.26, ribMat);
      fBox(rt, outerFloorR - 0.12, 0, FF_CAP_Y - 0.16, halfOuterW*1.75, 0.14, 0.26, ribMat);
      furnishGF(kk, rt);
      furnishFF(kk, rt);
    })(k);
  }
  // 隅の仕切り壁(1階・2階それぞれ、頂点角φで中庭〜外壁まで径方向に)
  for (v=0;v<8;v++){
    partitionWithDoor(vPhi(v), GF_FLOOR_Y, GF_ROOM_TOP, 3.2, false);
    partitionWithDoor(vPhi(v), FF_FLOOR_Y, FF_ROOM_TOP, 3.9, true);
  }

  /* ================================================================ *
   * 地階(アンダークロフト)-- 中庭の石畳(y=0)と1階床(y=3.0)の間に
   * できる高さ3mの環状空間。主玄関の扉口(高さ3.6m)はこの高さに開いて
   * いるので、外から入った人はまずここを通って中庭へ抜ける(住人の
   * life.gates の経路もこの高さを歩く)。従来はここが床も無い素通しの
   * 隙間で、外壁がフェードすると丘の草地がそのまま室内に見えていた。
   * ================================================================ */
  (function buildUndercroft(){
    var rvOut = OCT_APOTH_IN / Math.cos(Math.PI/8);
    var rvIn  = COURT_APOTH_OUT / Math.cos(Math.PI/8);
    var i;
    for (i=0;i<8;i++){
      var f = ringQuad(vPhi(i), vPhi(i+1), rvOut, rvIn, 0.05, cellarMat);
      f.castShadow = false;
      interiorGroup.add(f);
    }
    // 地階を8区画に分ける柱(1階の床を支える方杖付きの角柱)
    for (i=0;i<8;i++){
      var pd = dirAt(vPhi(i));
      var col = mkBox(0.7, GF_FLOOR_Y, 0.7, partitionMat);
      place(col, pd.x*MID_R, GF_FLOOR_Y/2, pd.z*MID_R, radialRy(vPhi(i)));
      det(col);
    }
    // 玄関の通路(南、k=4): 敷石と壁付きのベンチ、松明
    var th4 = wTheta(4);
    fBox(th4, MID_R + 1.0, 0, 0.06, 3.0, 0.08, 7.0, darkMat);
    [-1,1].forEach(function(s){
      fBox(th4, MID_R + 1.0, s*2.1, 0.0, 0.6, 0.5, 5.0, partitionMat);
      fCone(th4, outerFloorR - 1.2, s*2.4, 2.15, 0.16, 0.4, 5, fireMat);
      fBox(th4, outerFloorR - 1.0, s*2.4, 1.9, 0.22, 0.45, 0.28, metalMat);
    });
    // 樽・薪・干し草・荷車 -- 地階は貯蔵と作業の場という設え
    var stores = [1, 2, 3, 5, 6, 7];
    stores.forEach(function(kk, idx){
      var th = wTheta(kk), rr = MID_R + (idx%2 ? 0.9 : -0.9);
      if (idx % 3 === 0){
        [-2.2, -1.1, 0.0].forEach(function(o){ fBarrel(th, rr, o, 0, 0.5, 1.1); });
        fBarrel(th, rr - 1.1, -1.6, 0, 0.5, 1.1);
      } else if (idx % 3 === 1){
        [0, 0.36, 0.72].forEach(function(dy){                 // 薪の山
          fBox(th, rr, 1.8, dy, 3.2, 0.32, 0.34, woodDkMat, Math.PI/2);
        });
        fBox(th, rr - 1.4, 1.8, 0, 2.0, 0.9, 1.6, strawMat);  // 干し草
      } else {
        fBox(th, rr, -1.4, 0.5, 2.2, 0.6, 1.3, woodMat);      // 荷車の荷台
        [-1,1].forEach(function(s){
          var wcp = rp(th, rr, -1.4 + s*0.9);
          var wheel = mkCyl(0.5, 0.5, 0.16, 10, woodDkMat);
          wheel.rotation.z = Math.PI/2; wheel.rotation.y = wallRy(th);
          place(wheel, wcp.x, 0.5, wcp.z);
          det(wheel);
        });
        fBox(th, rr + 1.5, -1.4, 0.85, 0.12, 0.12, 1.8, woodDkMat);  // 梶棒
        fSack(th, rr - 1.6, -2.4, 0, 0.42);
      }
    });
  })();

  /* ================================================================ *
   * 中庭の設え -- 大階段 / 水盤 / 貯水槽の口 / 鉢植えの柑橘 / 菜園
   * ---------------------------------------------------------------- *
   * 実物の中庭は石敷きで植栽は無い(丘の上の乾いた台地に建つ、装飾を
   * 削ぎ落とした空間)。ただし本ビューアの方針として中庭に緑を置くので、
   * 地中海の館らしく「鉢植えの柑橘」と「石で囲った薬草の畝」という、
   * 石敷きの上に後から置ける控えめな形にとどめる。
   * 配置は住人(life.courtyard の矩形 = 中央の広場)と主玄関〜中庭の
   * 通り道(南の1区画)を避け、半径7m以上の外周リングだけに置く。
   * ================================================================ */
  (function buildCourtGarden(){
    var GARDEN_R = 7.6;          // 植栽・設備を置く外周リングの基準半径
    // --- 大階段(北): 中庭から1階の玉座の間へ上がる ------------------
    (function(){
      var th = wTheta(0), steps = 8, rise = GF_FLOOR_Y/steps, tread = 0.60;
      var r0 = innerFloorR - steps*tread;   // ≒4.9m から上り始める
      var i;
      for (i=0;i<steps;i++){
        // 各段を「床から段の天端まで」の箱にすると、段裏に隙間ができない
        fBox(th, r0 + i*tread + tread/2, 0, 0, 3.0, rise*(i+1), tread, courtMat);
      }
      [-1,1].forEach(function(s){          // 両脇の袖壁(勾配なりの斜材)
        var a = rp(th, r0, s*1.65), b = rp(th, innerFloorR, s*1.65);
        strut({x:a.x, y:0.45, z:a.z}, {x:b.x, y:GF_FLOOR_Y+0.45, z:b.z}, 0.38, courtMat);
      });
    })();
    // --- 八角形の水盤(西)-- 実物の中庭にも水盤/浴槽があったとされる
    (function(){
      var th = wTheta(6);
      var basin = fCyl(th, GARDEN_R, 0, 0.02, 1.35, 1.45, 0.62, 8, marbleMat, Math.PI/8);
      flatFacets(basin);
      fCyl(th, GARDEN_R, 0, 0.60, 1.16, 1.16, 0.07, 8, cisternMat, Math.PI/8);
      fCyl(th, GARDEN_R, 0, 0.50, 0.22, 0.30, 0.85, 8, marbleMat);   // 中央の柱
      fCyl(th, GARDEN_R, 0, 1.35, 0.42, 0.24, 0.16, 8, marbleMat);
      var bp = rp(th, GARDEN_R, 0);
      registerPick(pickables, 'structure', bp.x, 0.9, bp.z, 3.4, 2.2, 3.4,
        '水盤 Basin',
        '中庭に据えられた八角形の大理石の水盤。実物のこの城には水洗式の設備と集水システムがあり、中庭にも浴槽ないし水盤が置かれていたと考えられている。');
    })();
    // --- 貯水槽への開口 + 轆轤(東)---------------------------------
    (function(){
      var th = wTheta(2);
      var curb = fCyl(th, GARDEN_R, 0, 0.02, 1.05, 1.10, 0.85, 8, partitionMat, Math.PI/8);
      flatFacets(curb);
      fCyl(th, GARDEN_R, 0, 0.84, 0.85, 0.85, 0.05, 8, cisternMat, Math.PI/8);
      [-1,1].forEach(function(s){ fBox(th, GARDEN_R, s*1.05, 0.85, 0.20, 1.9, 0.20, woodDkMat); });
      fBox(th, GARDEN_R, 0, 2.75, 2.5, 0.18, 0.18, woodDkMat);
      fCyl(th, GARDEN_R, 0, 2.42, 0.16, 0.16, 1.5, 8, woodMat, Math.PI/2);  // 巻胴
      fBox(th, GARDEN_R, 0.55, 2.10, 0.06, 0.28, 0.06, metalMat);           // 綱
      fCyl(th, GARDEN_R, 0.55, 1.75, 0.24, 0.20, 0.35, 8, woodMat);         // 釣瓶
      var cp = rp(th, GARDEN_R, 0);
      registerPick(pickables, 'structure', cp.x, 1.6, cp.z, 2.8, 3.4, 2.8,
        '貯水槽の口 Cistern Mouth',
        '中庭の石畳に開く貯水槽への開口。井戸も堀も持たないこの城は、平屋根に降った雨水を塔の樋で集めて地下の水槽へ導いていた。');
    })();
    // --- 石で囲った薬草・野菜の畝(4区画)---------------------------
    [1, 3, 5, 7].forEach(function(kk, gi){
      var th = wTheta(kk);
      fBox(th, GARDEN_R + 0.25, 0, 0.02, 3.4, 0.34, 1.25, partitionMat);  // 石の縁
      fBox(th, GARDEN_R + 0.25, 0, 0.30, 3.0, 0.10, 0.95, soilMat);       // 土
      [-1.05, -0.35, 0.35, 1.05].forEach(function(o, i){
        var m = (i + gi) % 2 ? leafMat : leafHiMat;
        fCone(th, GARDEN_R + 0.25, o, 0.36, 0.24, 0.55, 5, m);
        fCone(th, GARDEN_R + 0.55, o, 0.36, 0.18, 0.40, 5, m);
      });
    });
    // --- 鉢植えの柑橘(隅の6か所。南の2隅は玄関〜中庭の通り道なので空ける)
    [0, 1, 2, 5, 6, 7].forEach(function(vv){
      var ph = vPhi(vv), rr = 8.35;
      fCyl(ph, rr, 0, 0.02, 0.46, 0.34, 0.62, 8, terraMat);      // 鉢
      fCyl(ph, rr, 0, 0.58, 0.42, 0.42, 0.08, 8, soilMat);
      fCyl(ph, rr, 0, 0.62, 0.09, 0.11, 0.75, 6, woodDkMat);     // 幹
      fBall(ph, rr, 0, 1.30, 0.62, leafMat);                     // 葉むら
      fBall(ph, rr - 0.28, 0.24, 1.95, 0.42, leafHiMat);
      fBall(ph, rr + 0.26, -0.22, 1.90, 0.38, leafHiMat);
      // 実は葉むら(半径0.62)の表面すれすれに置く -- 中に埋めると見えない
      fBall(ph, rr - 0.50, -0.32, 1.80, 0.10, fruitMat);
      fBall(ph, rr + 0.48, 0.34, 1.72, 0.10, fruitMat);
    });
    // --- 石のベンチ(北東・北西の壁沿い)-----------------------------
    [1, 7].forEach(function(kk){
      var th = wTheta(kk);
      fBox(th, GARDEN_R + 0.9, 2.6, 0, 2.2, 0.20, 0.55, partitionMat);
      fBox(th, GARDEN_R + 1.05, 2.6, 0.20, 2.2, 0.28, 0.5, trimMat);
    });
    var gp = rp(wTheta(3), GARDEN_R + 0.25, 0);
    registerPick(pickables, 'structure', gp.x, 0.6, gp.z, 4.0, 1.6, 2.4,
      '薬草の畝 Herb Beds',
      '中庭の外周に置かれた薬草と野菜の畝、そして鉢植えの柑橘。実物の中庭は石敷きのみだが、丘の上のこの館でも、地中海の庭らしい鉢植えの緑が石の幾何学を和らげていたと想像したい。');
  })();

  /* ================================================================ *
   * 8基の塔の内部 -- 螺旋階段 / 厠 / 貯水
   * ---------------------------------------------------------------- *
   * 塔の外殻(towerFG)はカメラを向いた面がフェードするので、その中身が
   * 見える。実物どおり、2基は螺旋階段、5基は各階の厠(ガーダローブ)、
   * 1基は集水した雨水を落とす貯水塔。
   * ================================================================ */
  (function buildTowerInteriors(){
    for (var vv=0; vv<8; vv++){
      var phi = vPhi(vv), dv = dirAt(phi);
      var tcx = dv.x*TOWER_CENTER_R, tcz = dv.z*TOWER_CENTER_R;
      var role = TOWER_ROLE[vv];
      if (role === 'stair'){
        // 螺旋階段: 中心柱(既存の newel)のまわりに踏み板を巻き上げる。
        // 1階床(3.0m)から屋上テラス(19.8m)まで通す -- 平屋根に出られる
        // 構成なので、階段は屋根の高さまで届いていないと辻褄が合わない。
        var nStep = 22, y0 = GF_FLOOR_Y - 1.4, dy = (WALL_H - y0)/nStep;
        for (var i=0;i<nStep;i++){
          var a = i*Math.PI/6;
          var ux = Math.cos(a), uz = Math.sin(a);
          var st = mkBox(2.9, 0.18, 0.92, partitionMat);
          place(st, tcx + ux*1.55, y0 + dy*(i+1), tcz + uz*1.55, -a);
          det(st);
        }
      } else if (role === 'cistern'){
        // 屋根から落ちてくる樋 + 汲み上げの釣瓶
        fCyl(phi, TOWER_CENTER_R + TOWER_R*0.5, 0, 1.1, 0.20, 0.20, 2.6, 6, darkMat);
        var bkt = mkCyl(0.3, 0.25, 0.42, 8, woodMat);
        place(bkt, tcx - dv.x*1.4, 1.0, tcz - dv.z*1.4);
        det(bkt);
      } else {
        // 厠(ガーダローブ): 1階・2階にひとつずつ、外側の壁につく
        [GF_FLOOR_Y, FF_FLOOR_Y].forEach(function(fy){
          var seat = mkBox(1.35, 0.5, 0.85, partitionMat);
          place(seat, tcx + dv.x*1.15, fy + 0.25, tcz + dv.z*1.15, wallRy(phi));
          det(seat);
          var back = mkBox(1.55, 1.5, 0.2, partitionMat);
          place(back, tcx + dv.x*1.62, fy + 0.75, tcz + dv.z*1.62, wallRy(phi));
          det(back);
          var slot = mkBox(0.55, 0.16, 0.5, darkMat);
          place(slot, tcx + dv.x*1.15, fy + 0.5, tcz + dv.z*1.15, wallRy(phi));
          det(slot);
        });
      }
      // どの塔にも各階の床を張る(中が空洞の筒に見えないように)
      [GF_FLOOR_Y, FF_FLOOR_Y].forEach(function(fy){
        var fl = mkCyl(TOWER_R*0.95, TOWER_R*0.95, 0.16, 8, cellarMat);
        fl.rotation.y = Math.PI/8;
        fl.castShadow = false;
        place(fl, tcx, fy, tcz);
        interiorGroup.add(fl);
      });
    }
  })();

  /* ================================================================ *
   * 屋上テラスの設え -- 集水溝と煙突
   * ---------------------------------------------------------------- *
   * 平屋根は雨水を集めて塔の樋から地下水槽へ落とす仕組み。屋根面に
   * 浅い集水溝を刻み、貯水塔(v=3)へ向かって集める。煙突は実物の
   * シルエットを崩さないよう低く2本だけ。屋根と一緒にフェードさせたい
   * ので roofMain.mat を使う(fadeExtras に拾われず素直に消える)。
   * ================================================================ */
  (function buildRoofTerrace(){
    var i;
    for (i=0;i<8;i++){
      var ct = wTheta(i), cd2 = dirAt(ct);
      var gutter = mkBox(0.5, 0.14, OCT_APOTH_OUT - COURT_APOTH - 1.6, roofMain.mat);
      place(gutter, cd2.x*((OCT_APOTH_OUT + COURT_APOTH)/2), WALL_H + 0.09,
        cd2.z*((OCT_APOTH_OUT + COURT_APOTH)/2), wallRy(ct));
      roofMain.group.add(gutter);
    }
    [1, 5].forEach(function(kk){          // 厨房(1階k=1)と大広間/寝室(2階)の煙突
      var ct = wTheta(kk), cd2 = dirAt(ct), rr = OCT_APOTH_OUT - 2.2;
      var stack = mkBox(1.05, 1.9, 0.95, roofMain.mat);
      place(stack, cd2.x*rr, WALL_H + 0.97, cd2.z*rr, wallRy(ct));
      roofMain.group.add(stack);
      var cap = mkBox(1.35, 0.24, 1.25, roofMain.mat);
      place(cap, cd2.x*rr, WALL_H + 2.03, cd2.z*rr, wallRy(ct));
      roofMain.group.add(cap);
      // 煙出しの口。roofMain.mat 以外なので fadeExtras に拾われ、屋根が
      // 半分消えた時点で一緒に消える(屋根と同時に消えるので違和感はない)。
      var flue = mkBox(0.55, 0.16, 0.5, darkMat);
      place(flue, cd2.x*rr, WALL_H + 2.16, cd2.z*rr, wallRy(ct));
      roofMain.group.add(flue);
    });
  })();

  /* ================================================================ *
   * 孤立丘(モンテ)-- 標高約540m、ムルジェ台地から独立して盛り上がる
   * 石灰岩(カルスト)の丘。
   * ---------------------------------------------------------------- *
   * 旧実装は buildCircularSkirt(01-moat.js の堀の土手)を3段重ねた
   * 回転体だった。断面こそ凸型になったが、方位に対して完全に一様な
   * ため、低い視点で見ると「のっぺりした円錐台の上に城が載っている」
   * ようにしか見えなかった(修正前スクリーンショットで確認済み)。
   * 実物の写真(Wikimedia Commons: 02_Castel_del_Monte_(Andria),
   * gos_dalt_del_camí.jpg / 03_..._vist_des_del_sud-est.jpg を取得して
   * 目視)で確認できる特徴は次の4点で、いずれも回転体では出せない:
   *   (1) 斜面は一様な円錐ではなく、浅い尾根と谷(襞)が方位ごとに走る
   *   (2) 草地のあちこちに白っぽい石灰岩が露出し、板状の露頭も出る
   *   (3) 風で傾いた低木がまばらに点在し、丘の稜線を不揃いにする
   *   (4) 頂上の平坦部と斜面の境界は明確な角ではなく丸い肩になっている
   * そこで回転体をやめ、**方位 x 半径のハイトフィールド**を1枚の
   * 頂点カラー付きメッシュとして自前で張る。
   *
   * ---- 城の外形との独立性 ------------------------------------------
   * この節は y<=0 の地形しか触らない。城本体(正八角形・塔中心半径
   * Rt=23.78m・全幅56.1m・外壁19.8m/塔23.6m)と内装のコードは1行も
   * 変更していない。32方位の水平レイキャストによる外形計測が修正前後で
   * 完全に一致することを別途確認済み(完了報告参照)。
   *
   * ---- 周囲のシステムとの境界(触ってはいけないものを壊さない)----
   *  a) 中景(オリーブ畑など)は 15-nature.js の担当。あちらは「城の
   *     代表寸法の2.6倍を超える平たいメッシュ」だけを地面(TERRAIN)と
   *     見なし、それ以外は自然物を置かない除外ボックスへ加算する。
   *     丘メッシュの外接は 2*R_HILLBASE=236m で閾値(約367m)に届かない
   *     ので、旧スカートと同じく除外側に落ちる = 丘の上に畑が生えない。
   *     裾の最大半径を旧実装と同じ 118m に固定してあるのはこのため
   *     (広げると除外ボックスが動き、中景の開始位置が変わってしまう)。
   *  b) 裾の頂点カラーは最後に FIELD_COL そのものへ寄せてあるので、
   *     丘の縁と中景の草地の間に色の段差が出ない。加えて裾は野原面より
   *     RIM_LIFT だけ高く終わらせ、同一平面での Z ファイトを避ける。
   *  c) 住人(life)は +Z(主玄関側)を半径34mまで歩いて消える。頂上
   *     平坦部の縁 crestR() は最小でも 34.5m あるので、住人が歩く範囲は
   *     旧実装と同じ完全な平面(y=0)のまま。坂道・岩・低木もすべて
   *     crestR() より外にしか置かない。
   *
   * ---- 色 ----------------------------------------------------------
   * 昼の水平上向き面には実測で R x1.93 / G x1.89 / B x1.80 が乗る
   * (修正前の画面で HILL_TOP 0x5f5936 =(95,89,54) が (183,168,97) に
   * なることをピクセル実測して確認)。新しく足した岩・道・低木の色は
   * すべて最大チャンネル 118 以下に収めてあり、乗算後も 235 を超えない。
   * ================================================================ */
  // 塔を正しい位置(半径23.78m + 外接4.28m = 28.1m)へ出したので、
  // 頂上の平坦部は 31m では塔の足元ぎりぎりになる。空撮写真でも城の
  // 周囲には十分な広さの平坦な敷地が広がっているので 36m を基準にする
  // (実際の縁 crestR() はこの前後で方位ごとに揺らぐ)。
  var R_PLATEAU = 36, R_HILLBASE = 118, HILL_DROP = 17;
  (function buildIsolatedHill(){
    var A_SEG = 144;                 // 方位分割。襞の最高次(21周期)に約7点/波
    var SLOPE_RINGS = 34;            // 斜面の半径方向分割
    var FLAT_F = [0.30, 0.62, 1.0];  // 頂上平坦部のリング(crestR に対する比)
    var RIM_LIFT = 0.06;             // 裾を野原面より6cm上げる(同一平面回避)

    /* 方位ゆらぎ。**整数次の正弦だけ**で作るのが要点で、こうしないと
     * θ=0 と θ=2π で値が食い違い、丘に縦の継ぎ目が1本入る。00-core.js の
     * ridgeNoise1D は 7.3 / 12.7 / 21.1 次を含む非周期関数なので(山並みの
     * ような開いた稜線には使えても)閉じたリングには使えない。 */
    function azWave(a, s){           // 低周波: 丘全体の非対称(輪郭の歪み)
      return 0.62*Math.sin(a + s) + 0.26*Math.sin(2*a + s*1.7 + 0.9)
           + 0.12*Math.sin(3*a - s*2.3 + 2.1);
    }
    function azRidge(a, s){          // 中〜高周波: 斜面を走る尾根と谷(襞)
      return 0.44*Math.sin(5*a + s) + 0.30*Math.sin(8*a - s*1.3 + 1.2)
           + 0.16*Math.sin(13*a + s*0.7 + 2.6) + 0.10*Math.sin(21*a - s*2.1 + 0.4);
    }
    // 頂上平坦部の縁(34.5〜40.7m)。住人が歩く 34m は必ず内側に入る。
    function crestR(a){ return 37.6 + 3.1*azWave(a, 0.7); }
    // 裾(96〜118m)。最大値は旧実装の R_HILLBASE と同じ 118m に一致させる。
    function baseR(a){ return 107 + 11*azWave(a, 2.9); }

    /* 断面。u=0(平坦部の縁)から u=1(裾)への落差の割合。両端で傾きが
     * 0 になるので、頂上との境界は角ではなく丸い肩になり、裾も野原へ
     * 接線方向に収束する。指数 0.86 は旧3段スカートの制御点
     * (u=0.244 で -0.247 / u=0.61 で -0.682)を再現する値を逆算したもの
     * -- 「上ほど急、裾ほど緩い」という調整済みの全体印象は保つ。 */
    // 指数を方位でも振ることで、方位によって傾斜そのものが変わる
    // (0.70=上が急で腹が張った斜面 / 1.02=上が緩く裾で切れ落ちる斜面)。
    function profile(u, a){ return smoothstep01(0, 1, Math.pow(u, 0.86 + 0.16*azWave(a, 5.3))); }

    /* 頂上へ登る坂道。主玄関(+Z = θ=π/2)の真下から蛇行しながら下る。
     * 住人が門の外へ歩いて消える先がちょうどこの道の起点になる。 */
    function roadAz(u){ return Math.PI/2 + 0.52*Math.sin(u*3.1) + 0.30*u; }
    function roadMask(a, u, r){
      var d = a - roadAz(u);
      d = Math.atan2(Math.sin(d), Math.cos(d));       // -π..π へ正規化
      var half = 3.4 / Math.max(r, 8);                // 幅約6.8m(半径によらず一定)
      return 1 - smoothstep01(half*0.5, half, Math.abs(d));
    }
    /* 斜面のディテール。sin(πu) の包絡を掛けてあるので u=0 と u=1 で
     * 必ず 0 になる = 頂上の平坦さと裾の高さは断面どおりに保たれる。 */
    function detail(a, u, x, z, env){
      var flute = azRidge(a + 0.30*u, 1.3) * (1.10 + 1.70*u);  // 襞。裾ほど幅広に
      var bench = 0.58 * Math.sin((u*3.35 + 0.11*azWave(a, 4.2)) * Math.PI*2); // 岩盤の段差
      var lump  = hashNoise2(x*1.9, z*1.9) * 0.60;             // 全体のごつごつ
      return (flute + bench + lump) * env;
    }
    function hillY(a, u, x, z, r){
      if (u <= 0) return 0;
      if (u >= 1) return -HILL_DROP + RIM_LIFT;
      var sn = Math.sin(Math.PI*u);
      var rm = roadMask(a, u, r);
      return -(HILL_DROP - RIM_LIFT)*profile(u, a)
           + detail(a, u, x, z, Math.pow(sn, 0.62)) * (1 - 0.88*rm)
           - 0.38 * rm * Math.pow(sn, 0.35);          // 道の切り土(浅い溝)
    }
    // 岩・低木を斜面へ正確に接地させるためのワールド座標版
    function surfaceY(x, z){
      var r = Math.hypot(x, z), a = Math.atan2(z, x);
      var rc = crestR(a), rb = baseR(a);
      if (r <= rc) return 0;
      if (r >= rb) return -HILL_DROP + RIM_LIFT;
      return hillY(a, (r - rc)/(rb - rc), x, z, r);
    }
    /* 斜面の法線。岩を「斜面に寝かせる」のに使う。平らな板を水平のまま
     * 置くと、傾いた地面から角が浮いて板が宙に浮いて見える(1周目の
     * スクリーンショットで実際にそうなった)ので、必ずこれで寝かせる。 */
    var _hillUp = new T.Vector3(0, 1, 0), _hillN = new T.Vector3();
    function surfaceNormal(x, z){
      var d = 1.2;
      var gx = (surfaceY(x+d, z) - surfaceY(x-d, z)) / (2*d);
      var gz = (surfaceY(x, z+d) - surfaceY(x, z-d)) / (2*d);
      return _hillN.set(-gx, 1, -gz).normalize();
    }

    /* ---- 丘のメッシュ(頂点カラー) ------------------------------ */
    var cTop = new T.Color(HILL_TOP), cMid = new T.Color(HILL_MID);
    var cEdge = new T.Color(HILL_EDGE), cFld = new T.Color(FIELD_COL);
    var cRock = new T.Color(HILL_ROCK), cRoad = new T.Color(HILL_ROAD);
    var cGully = new T.Color(HILL_GULLY);
    var tmp = new T.Color();
    var RINGS = FLAT_F.length + SLOPE_RINGS;
    var pos = [0, 0, 0], col = [cTop.r, cTop.g, cTop.b], idx = [];
    var i, j, k;
    for (j=0;j<RINGS;j++){
      for (i=0;i<A_SEG;i++){
        var a = i/A_SEG * Math.PI*2, ca = Math.cos(a), sa = Math.sin(a);
        var rc = crestR(a), rb = baseR(a), r, u;
        if (j < FLAT_F.length){ u = 0; r = rc * FLAT_F[j]; }
        else { u = (j - FLAT_F.length + 1) / SLOPE_RINGS; r = rc + (rb - rc)*u; }
        var x = ca*r, z = sa*r;
        pos.push(x, hillY(a, u, x, z, r), z);
        // 高度による基本色: 頂上=乾いた牧草 -> 中腹=土と岩 -> 裾=中景の草地
        if (u < 0.34) tmp.copy(cTop).lerp(cMid, smoothstep01(0, 0.34, u));
        else tmp.copy(cMid).lerp(cEdge, smoothstep01(0.34, 0.82, u));
        tmp.lerp(cFld, smoothstep01(0.82, 1.0, u));   // 裾は中景と同色 = 境界が消える
        // 頂上の平坦部まで含めて、乾いた草地の斑を薄く入れる(一様な
        // 単色だと平坦部がそのまま「円盤」に見えてしまうため)
        tmp.lerp(cGully, 0.16 * smoothstep01(-0.2, 1.4, hashNoise2(x*1.3 + 12, z*1.3 - 7)));
        if (u > 0){
          var sn = Math.sin(Math.PI*u);
          // 石灰岩の露出。斜面の中腹にまだらに出る(頂上と裾では出さない)
          tmp.lerp(cRock, smoothstep01(0.55, 1.20, hashNoise2(x*3.1 + 40, z*3.1 - 25))
                          * Math.pow(sn, 0.5) * 0.34);
          // 襞の谷筋は草が薄く土が出る
          tmp.lerp(cGully, Math.max(0, -azRidge(a + 0.30*u, 1.3))
                           * smoothstep01(0.06, 0.35, u) * (1 - smoothstep01(0.80, 1, u)) * 0.35);
          tmp.lerp(cRoad, roadMask(a, u, r) * 0.86);
        }
        col.push(tmp.r, tmp.g, tmp.b);
      }
    }
    // 中心のファン(頂上は完全な平面なので三角形の向きだけ合わせればよい)
    for (i=0;i<A_SEG;i++) idx.push(0, 1 + (i+1)%A_SEG, 1 + i);
    for (j=0;j<RINGS-1;j++){
      for (i=0;i<A_SEG;i++){
        var i2 = (i+1)%A_SEG, o0 = 1 + j*A_SEG, o1 = 1 + (j+1)*A_SEG;
        idx.push(o0+i, o0+i2, o1+i,  o0+i2, o1+i2, o1+i);   // 法線が +Y になる巻き順
      }
    }
    var hillGeo = new T.BufferGeometry();
    hillGeo.setIndex(idx);
    hillGeo.setAttribute('position', new T.Float32BufferAttribute(pos, 3));
    hillGeo.setAttribute('color', new T.Float32BufferAttribute(col, 3));
    hillGeo.computeVertexNormals();
    var hill = new T.Mesh(hillGeo, new T.MeshLambertMaterial({ vertexColors: true }));
    hill.receiveShadow = true;      // castShadow は付けない(丘自身は影を落とす相手がいない)
    group.add(hill);

    /* ---- 石灰岩の露頭 ---------------------------------------------- *
     * 実物の写真では、草地から白っぽい石が顔を出しているのと、層理に
     * 沿って板状に割れた岩が斜面に転がっているのが両方見える。前者を
     * 十二面体、後者を薄い箱で作り分ける。 */
    var seed = 8123457;
    function rnd(){ seed = (seed*1664525 + 1013904223) >>> 0; return seed / 4294967296; }
    /* 斜面に寝かせる姿勢: 「Y 軸まわりにランダムに回す」->「地面の法線へ
     * 合わせる」->「わずかに乱す」の合成。Euler では順序を間違えると
     * 傾きの向きまで回ってしまうのでクォータニオンで組む。 */
    var _qAlign = new T.Quaternion(), _qSpin = new T.Quaternion(), _qJit = new T.Quaternion();
    var _eJit = new T.Euler();
    function bedOnSlope(mesh, x, z, jitter){
      _qAlign.setFromUnitVectors(_hillUp, surfaceNormal(x, z));
      _qSpin.setFromAxisAngle(_hillUp, rnd()*Math.PI*2);
      _eJit.set((rnd()-0.5)*jitter, 0, (rnd()-0.5)*jitter);
      _qJit.setFromEuler(_eJit);
      mesh.quaternion.copy(_qAlign).multiply(_qJit).multiply(_qSpin);
    }
    var rockMat  = new T.MeshLambertMaterial({ color: HILL_ROCK });
    var rockMatD = new T.MeshLambertMaterial({ color: HILL_ROCK_D });
    for (k=0;k<52;k++){
      // u<=0.90 に抑えるのは、岩の外接が裾(最大118m)を越えて 15-nature.js の
      // 除外ボックスを広げてしまわないようにするため(中景の畑の位置が動く)。
      var ra = rnd()*Math.PI*2, ru = 0.05 + 0.85*rnd();
      var rrc = crestR(ra), rrb = baseR(ra);
      var rr = rrc + (rrb - rrc)*ru;
      var rx = Math.cos(ra)*rr, rz = Math.sin(ra)*rr;
      var slab = rnd() < 0.32;
      var s = 0.40 + 1.85*Math.pow(rnd(), 2.1);   // 大半は 1m 未満、稀に 2m 級
      // 板状の岩は上面が水平に近く直射をまともに受けるので、明色ばかりだと
      // 草地の上に白い紙が散らばったように見える(2周目のスクリーンショットで
      // 実際にそうなった)。厚みを増やし、暗色の個体を多めに選ぶ。
      var useDark = rnd() < (slab ? 0.65 : 0.45);
      if (roadMask(ra, ru, rr) > 0.20) continue;   // 道の上には置かない
      var rock = new T.Mesh(
        slab ? new T.BoxGeometry(s*1.7, s*0.60, s*1.2) : new T.DodecahedronGeometry(s, 0),
        useDark ? rockMatD : rockMat);
      rock.position.set(rx, surfaceY(rx, rz) - s*(slab ? 0.26 : 0.42), rz);
      bedOnSlope(rock, rx, rz, slab ? 0.2 : 0.5);
      rock.castShadow = true; rock.receiveShadow = true;
      group.add(rock);
    }
    /* 大きめの露頭。実物では、斜面のところどころで岩盤そのものが地表に
     * 顔を出し、割れた塊が数個ずつ固まって残る。小石を撒くだけでは
     * 斜面に「引っかかり」が出ないので、これを6か所だけ置く。 */
    for (k=0;k<6;k++){
      var oa = rnd()*Math.PI*2, ou = 0.24 + 0.50*rnd();
      var orc = crestR(oa), orb = baseR(oa);
      var or_ = orc + (orb - orc)*ou;
      var ox = Math.cos(oa)*or_, oz = Math.sin(oa)*or_;
      var lumps = 3 + Math.floor(rnd()*3);
      if (roadMask(oa, ou, or_) > 0.25) continue;
      for (var q=0;q<lumps;q++){
        var jx = ox + (rnd()-0.5)*5.2, jz = oz + (rnd()-0.5)*5.2;
        var os = 1.15 + 1.5*rnd();
        var chunk = new T.Mesh(new T.DodecahedronGeometry(os, 0), rnd() < 0.5 ? rockMatD : rockMat);
        chunk.scale.set(0.9 + rnd()*0.4, 0.55 + rnd()*0.3, 0.85 + rnd()*0.4); // 平べったい岩盤の割れ目
        chunk.position.set(jx, surfaceY(jx, jz) - os*0.16, jz);
        bedOnSlope(chunk, jx, jz, 0.36);
        chunk.castShadow = true; chunk.receiveShadow = true;
        group.add(chunk);
      }
    }

    /* ---- 風衝低木 --------------------------------------------------- *
     * まばらに、風下へ傾けて置く。稜線を不揃いにして丘のスケールを
     * 読ませるのが目的なので、数は増やしすぎない。写真で見えるのは
     * オリーブ/乳香樹系の濃く沈んだ緑なので、中景の木より暗くする。 */
    var scrubMat  = new T.MeshLambertMaterial({ color: HILL_SCRUB });
    var scrubMatD = new T.MeshLambertMaterial({ color: HILL_SCRUB_D });
    for (k=0;k<28;k++){
      var ba = rnd()*Math.PI*2, bu = 0.02 + 0.86*rnd();
      var brc = crestR(ba), brb = baseR(ba);
      var br = brc + (brb - brc)*bu;
      var bx = Math.cos(ba)*br, bz = Math.sin(ba)*br;
      var bh = 0.75 + 1.35*rnd();
      var bDark = rnd() < 0.5;
      if (roadMask(ba, bu, br) > 0.25) continue;
      var bush = new T.Mesh(new T.IcosahedronGeometry(bh*0.60, 1), bDark ? scrubMatD : scrubMat);
      bush.scale.set(1.30, 0.66, 1.05);
      bush.position.set(bx, surfaceY(bx, bz) + bh*0.24, bz);
      bedOnSlope(bush, bx, bz, 0.42);              // 風で傾いた姿勢
      bush.castShadow = true; bush.receiveShadow = true;
      group.add(bush);
    }
  })();
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
  /* 中庭に大階段・水盤・貯水槽の口・薬草の畝・鉢植えを置いたので、住人が
   * うろつく矩形をそのぶん狭める。植栽・設備はすべて半径7.0m 以上の外周
   * リングに置いてあるので、矩形の対角(半径 3.5*√2 = 4.95m)までに抑えれば
   * 干渉しない。加えて、南(k=4)の一区画だけは主玄関〜中庭の通り道として
   * 何も置いていない -- 住人が矩形から門の内側口 (0, 9.23) へ直線で歩く
   * 経路が、この区画を通るため。 */
  var life = {
    gates: [ { path: [ {x:0, z:COURT_APOTH_OUT-0.5}, {x:0, z:OCT_APOTH_CENTER}, {x:0, z:gateOuterZ} ],
      outDir:{x:0,z:1}, vanishDist: R_PLATEAU - gateOuterZ - 2 } ],
    courtyard: [ { minX:-3.5, maxX:3.5, minZ:-3.5, maxZ:3.5 } ],
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
