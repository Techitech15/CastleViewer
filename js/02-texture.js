"use strict";

/* ====================================================================
 * 0.7 CastleTex -- 共有 手続き的テクスチャ工房
 * ====================================================================
 * もとは castles/bodiam.js の中にあった「BODIAM 試作ブロック A」を、
 * 5城で共有できるように切り出したもの。中身(描画アルゴリズム・シード・
 * 定数)はボディアムのときと**1ピクセルも変えていない**。城ごとの違いは
 * すべてパラメータで与える。
 *
 * ─────────────────────────────────────────────────────────────────
 *  使い方 (4城へ展開する担当者はここだけ読めばよい)
 * ─────────────────────────────────────────────────────────────────
 *
 *   function buildMalbork(){
 *     var KIT = CastleTex.kit({
 *       id: 'malbork',                 // 診断用の名前(任意)
 *       stone: {
 *         metres: 1.2,                 // タイル1枚の実寸(m)= 石の大きさ
 *         nrm: 3.2,                    // 法線マップの深さ
 *         courses: 12,                 // 1タイルあたりの段数(レンガは細かい)
 *         blockW: [26, 10], blockMin: 24,
 *         mortar: '#b9b0a2',           // 目地の色
 *         tint: [1.0, 0.94, 0.88]      // 赤レンガ寄りに振る
 *       },
 *       plaster: { metres: 2.4, nrm: 1.6 }
 *     });
 *     var TEX           = KIT.tex;             // 旧 TEX と同じ形
 *     var texMat        = KIT.texMat;          // 呼び出し方も旧来どおり
 *     var applyWorldUVs = KIT.applyWorldUVs;
 *     ...
 *     var mat = texMat(0xb5563d, 'stone', { nrm: 1.0 });
 *     ...
 *     applyWorldUVs(group);                    // ビルド末尾で1回
 *   }
 *
 *  ■ kit(opts) が返すもの
 *     .tex            テクスチャセット。キー:
 *                     stone / roof / wood / pave / turf / plaster /
 *                     straw / soil / cloth  … { map, normal, metres }
 *                     brick                       … opt-in(下記)
 *                     waterN1 / waterN2 / waterN3 … THREE.Texture(法線)
 *                     smoke / flag                … THREE.Texture
 *
 *  ■ opt-in の kind: brick(レンガ)
 *     kit(opts) に **brick を渡したときにだけ** 焼かれる。渡さない城の
 *     cacheKey は変わらないので、既存4城のテクスチャは一切影響を受け
 *     ない。中身はフランドル積み(長手と小口を交互 + 段ごとに半周期
 *     ずらし + 焼過ぎ小口)で、makeStone のランダム幅・ランダム位相とは
 *     構造そのものが違う。詳細は makeBrick の頭のコメント。
 *       brick: { metres: 1.7, courses: 16, periods: 4, mortar: '#e0dccf', … }
 *
 *  ■ roof の seams(既定 1)
 *     1タイルに引く横の継ぎ手の本数。鉛葺きは板が長いので 1 のまま
 *     (= 切り出し前と同一出力)。**瓦(pantile)は 30cm ごとに段が来る**
 *     ので、タイル実寸を詰めずに段の密度だけ上げたいときに 2 以上を渡す。
 *     .texMat(colorHex, kind, opt)
 *                     テクスチャ付き MeshPhongMaterial を作る唯一の入口。
 *                     opt.nrm     素材どうしの相対的な法線の深さ(既定 1.0、
 *                                 0 で法線マップ無し)
 *                     opt.side    既定 T.FrontSide
 *                     opt.density UV 密度(1m あたり何タイル)。既定は
 *                                 1/tex[kind].metres
 *     .uvWorldize(mesh, density)   単体メッシュの UV をメートル単位に
 *     .applyWorldUVs(root)         ビルド末尾で1回走査して UV を書き直す
 *     .params                      解決済みパラメータ(デバッグ用)
 *
 *  ■ 「色」をどこで変えるか --- 2段構えになっている
 *     (a) material.color … texMat の第1引数。**主たる色はこちら**。
 *         テクスチャの albedo は彩度のないグレーで描き、normaliseMean で
 *         平均輝度を狙い値に合わせてあるので、color を差し替えるだけで
 *         「赤レンガ」「灰色の粗石」「淡黄色の石灰岩」に化ける。
 *         → 城ごとの STONE_WALL / ROOF_COL などの定数を変えるだけで足りる
 *           ケースがほとんど。
 *     (b) 各 kind の tint:[r,g,b] … テクスチャ自身の色かぶり。
 *         「汚れが寒色に寄る」「藁が黄色に寄る」といった *素材の癖* を
 *         変えたいときだけ触る。既定はボディアムの値。
 *     目地の色(mortar / lead / base / gap …)だけは CSS 色文字列で
 *     直接指定する。赤レンガの白い目地のように、面と目地でコントラストの
 *     向きが変わる素材はここで決まる。
 *
 *  ■ 「タイルサイズ」= metres。1タイルが実寸で何メートルかを表す。
 *     小さくすると石が細かくなる(レンガ)。大きくすると粗くなる(粗石)。
 *     px を上げれば解像度も上げられるが、生成コストは px^2 で効く。
 *
 *  ■ 「法線強度」= 2段構え。
 *     nrm (kind ごと)     … 高さマップから法線を焼くときの傾きの強さ。
 *                            素材そのものの凹凸の深さ。
 *     nrmBoost (kit 全体) … 全マテリアル共通の倍率。既定 1.70。
 *                            texMat の opt.nrm と掛け合わされる。
 *
 *  ■ キャッシュ
 *     生成したセットはモジュールスコープの _texCache に載り、**城を切り
 *     替えても生き残る**(このスクリプトは1回しか評価されない)。
 *     キーは「解決済みテクスチャパラメータの JSON」なので、色やタイル
 *     サイズが違えば別のセットが焼かれ、衝突しない。逆に、パラメータが
 *     完全に同じ城どうしは意図的に1セットを共有する(メモリ節約)。
 *     applyCastle が mat.map を dispose しても CanvasTexture は image を
 *     持ったままなので、次の描画で再アップロードされるだけでよい。
 *     CastleTex.clearCache() で明示的に捨てられる(通常は不要)。
 *
 * ─────────────────────────────────────────────────────────────────
 *  設計上の制約と、それに対する対処(切り出し前からの引き継ぎ)
 * ─────────────────────────────────────────────────────────────────
 *
 *  1) r128 の MeshLambertMaterial は normalMap / bumpMap を無視する。
 *     → 法線マップを載せる面だけ MeshPhongMaterial に差し替え、
 *       shininess:0 / specular:0x000000 にしてマット感を Lambert 相当
 *       に保つ(鏡面ハイライトが出ないので白飛び予算に影響しない)。
 *
 *  2) map は material.color に **乗算** される。城の配色は「昼の水平
 *     上向き面には約1.95倍が乗る」という露出予算つきで調整されている
 *     ので、テクスチャで明るくすると即座に白飛びする。
 *     → すべてのテクスチャは彩度のない淡いグレーで描き、最後に
 *       normaliseMean() で平均輝度を狙い値(mean。0.86-0.94)に **実測
 *       して強制的に合わせる**。色は material.color 側に残したまま、
 *       全体としてはわずかに暗くなる方向にしか動かない。
 *       → 新しい城で mean を上げるときは白飛びを実測で確認すること。
 *
 *  3) 目地の大きさがメッシュの寸法に依存してはいけない。BoxGeometry の
 *     UV は面ごとに 0..1 なので、texture.repeat を共有すると 44m の
 *     城壁と 0.9m の煙突で石の大きさが 50 倍違ってしまう。
 *     → repeat は (1,1) のまま、ジオメトリの UV を **メートル単位に
 *       書き直す**(uvWorldize)。城壁も煙突もマーロンも同じ石になる。
 *
 *  4) すべての乱数は kind ごとの決定論的 PRNG(rnd(seed) / octaves の
 *     seed)から引く。共有グローバル RNG は無いので、生成の順番を
 *     変えても結果は変わらない。スクショのピクセル比較が成立するのは
 *     この性質のおかげなので、壊さないこと。
 * ==================================================================== */
var CastleTex = (function(){

  /* ================================================================ *
   * 既定パラメータ = ボディアムの値。ここを書き換えると全城の見た目が
   * 変わる。城ごとの調整は kit(opts) の引数で上書きすること。
   * ================================================================ */
  var DEF = {
    /* mkTex の異方性フィルタ段数。実測(SwiftShader / headless)で 8 は
     * 1 に比べてフレームあたり約 8ms 重かった。three 側で GPU の最大値に
     * クランプされる。 */
    aniso: 4,
    /* 全マテリアル共通の法線の深さ(1.0 = 法線ブースト無し)。 */
    nrmBoost: 1.70,

    /* -- 1. 石積み: 蜂蜜色の砂岩、布積み(running bond)の切石 --------
     * 既定 256px = 2.4m。1段 0.30m x 8段、ブロック幅 0.60-1.05m。 */
    stone: {
      px: 256, metres: 2.4, courses: 8, seed: 0x50D1A3,
      mortar: '#8f8a80', mortarH: 0.30,           // 目地の色 / 目地の高さ
      blockMin: 60, blockW: [62, 46],             // ブロック幅 px [下限, 振れ幅]
      faceLum: [232, 22], faceRGB: [0, -1, -4],   // 面の明度 [基準, 振れ幅] と RGB オフセット
      joint: 1.5,                                 // 目地の半幅(px)
      edgeHi: 'rgba(255,255,255,0.30)',           // 上端の面取り
      edgeLo: 'rgba(60,50,36,0.30)',              // 下端の影
      bevel: 5.0,                                 // 面取り幅(px)
      faceH: [0.72, 0.26],                        // 石の高さ [基準, 振れ幅]
      toolSeed: 0x71EE, toolSpec: [[18,1.0],[40,0.6],[86,0.32]],   // のみ跡
      stainSeed: 0x5AA1, stainSpec: [[4,1.0],[9,0.6],[20,0.35],[48,0.18]], // 風化の斑
      stainMul: [0.84, 0.30],                     // 風化の明度倍率 [基準, 振れ幅]
      stainH: 0.16, toolH: 0.11,                  // 高さへの寄与
      tint: [1.0, 0.995, 0.985],                  // 素材の色かぶり(既定=汚れが寒色に寄る)
      mean: 0.90, nrm: 4.4
    },

    /* -- 2. 屋根: 鉛葺きの立ちはぜ + 板の継ぎ目 ----------------------
     * 既定 128px = 1.8m。0.45m ごとに縦のロール、1.8m ごとに横の継ぎ手。 */
    roof: {
      px: 128, metres: 1.8, seed: 0x77C3,
      lead: '#cfcbc4',                            // 鉛板の地色
      rolls: 4,                                   // 1タイルあたりの立ちはぜ本数
      rollLo: 'rgba(30,26,20,0.34)', rollHi: 'rgba(255,255,255,0.42)',
      seam: 'rgba(40,36,30,0.26)',                // 横の継ぎ手
      warpSpec: [[3,1.0],[8,0.55],[22,0.3]], warpMul: [0.88, 0.26],
      tint: [1.0, 1.0, 1.01],
      mean: 0.93, nrm: 3.3
    },

    /* -- 3. 木材: 板目。橋・扉・家具・小屋組で共用 --------------------
     * 既定 128px = 1.6m。板幅 0.4m、継ぎ目は U 軸に走る。 */
    wood: {
      px: 128, metres: 1.6, seed: 0x9E4D,
      base: '#d8d2c8', plankH: 0.72, planks: 4,
      plankLum: [210, 44], gap: 'rgba(28,20,12,0.55)',
      grainSeed: 0x3B71, grainSpec: [[2,1.0],[6,0.7],[64,0.45]],
      grainMul: [0.80, 0.36],
      tint: [1.0, 0.99, 0.97],
      mean: 0.92, nrm: 2.5
    },

    /* -- 4. 敷石: 不定形フラグストーン -------------------------------
     * 既定 128px = 2.0m。4x4 の格子を乱して 0.4-0.6m の板石にする。 */
    pave: {
      px: 128, metres: 2.0, seed: 0xC0BB1E,
      mortar: '#8c887e', mortarH: 0.28, grid: 4,
      faceLum: [224, 28], faceRGB: [0, -1, -3],
      edgeHi: 'rgba(255,255,255,0.22)', edgeLo: 'rgba(50,44,34,0.26)',
      faceH: [0.66, 0.3], bevel: 3.2,
      wearSeed: 0x4411, wearSpec: [[3,1.0],[10,0.6],[30,0.3]],
      wearMul: [0.85, 0.28],
      tint: [1.0, 1.0, 0.99],
      mean: 0.91, nrm: 3.7
    },

    /* -- 5. 芝: 刈り跡と踏み跡のむら(法線は入れない) ---------------- */
    turf: {
      px: 128, metres: 3.0,
      loSeed: 0x7A55, loSpec: [[3,1.0],[7,0.5]],
      hiSeed: 0x1D66, hiSpec: [[24,1.0],[56,0.7]],
      mowMul: [0.86, 0.22, 0.10],
      tint: [0.98, 1.0, 0.95],
      mean: 0.94
    },

    /* -- 6. 漆喰(ライムウォッシュ): 内壁 ----------------------------
     * 既定 256px = 3.2m。石(2.4m)と非通約にして、隣り合う壁で模様の
     * 周期が揃って見えるのを避けている -- metres を変えるときも石と
     * 非通約に保つこと。
     * ★ 法線: 漆喰は元々なだらかなので高さマップのほぼ全画素が傾いて
     * いる。上げすぎると発泡スチロールに見えるので nrm は石の半分以下。 */
    plaster: {
      px: 256, metres: 3.2, seed: 0x9CE10F,
      trowelSeed: 0x2B41, trowelSpec: [[3,1.0],[6,0.62],[13,0.30],[27,0.13]],
      stainSeed: 0x77C2,  stainSpec:  [[2,1.0],[5,0.70],[11,0.34],[26,0.15]],
      gritSeed: 0x1F5A,   gritSpec:   [[52,1.0],[110,0.55]],
      rubSeed: 0x66B3,    rubSpec:    [[30,1.0],[64,0.6]],
      spalls: 14, spallR: [9, 20],                // 剥落の数 / 半径 [基準, 振れ幅]
      cracks: 5,                                  // ヘアクラックの本数
      limeMul: [0.90, 0.13, 0.24, 0.05],
      warmth: [0.10, 0.02, 0.14],                 // 剥落部が下地の土色に寄る量 [R+,G+,B-]
      tint: [1.0, 1.0, 1.0],
      mean: 0.86, nrm: 1.9
    },

    /* -- 7. 藁 / 藺草: 干し草・敷き藺草・飼い葉 ---------------------- */
    straw: {
      px: 128, metres: 1.1, seed: 0x57A1B0,
      stalks: 620, stalkLum: [176, 79], gapLum: 104,
      clumpSeed: 0x3D92, clumpSpec: [[3,1.0],[8,0.55],[17,0.25]],
      clumpMul: [0.80, 0.40],
      tint: [1.0, 0.995, 0.93],
      mean: 0.92, nrm: 2.6
    },

    /* -- 8. 土: 菜園の畝。耕された粗い粒 ----------------------------- */
    soil: {
      px: 128, metres: 0.85, seed: 0x2E7744,
      lumpSeed: 0x8811, lumpSpec: [[7,1.0],[15,0.70],[33,0.42]],
      fineSeed: 0x44C9, fineSpec: [[46,1.0],[96,0.62]],
      dampSeed: 0x1AB6, dampSpec: [[3,1.0],[6,0.5]],
      clods: 90,
      clodMul: [0.72, 0.85, 0.30, 0.22], dampMul: [0.88, 0.24],
      tint: [1.0, 0.975, 0.94],
      mean: 0.90, nrm: 3.0
    },

    /* -- 9. 布: タペストリー・麻袋の平織り --------------------------- */
    cloth: {
      px: 128, metres: 0.62, pitch: 4,
      slubSeed: 0x6B22, slubSpec: [[16,1.0],[38,0.6]],
      foldSeed: 0x0E57, foldSpec: [[2,1.0],[4,0.72],[8,0.34]],
      tint: [1.0, 0.995, 0.985],
      mean: 0.93, nrm: 2.2
    },

    /* -- 10. 水面のさざ波: 3 スケール --------------------------------
     * poseidon のアブレーションで「カスケード 3->1」が最も効果が大きかった
     * (細かいさざ波と鋭い峰が同時に消える)ので 3 枚重ねる。タイル実寸は
     * 19 / 6.4 / 2.6 m(B-3 節)で互いに非通約。周波数構成も「うねり寄り」
     * 「中間」「細かい波紋寄り」と変えてある。
     * albedo は作らない -- 水の色は 11-environment.js が時間帯ごとに
     * .color へ書くので、こちらは法線だけを足す。
     * 出力は tex.waterN1 / waterN2 / waterN3。 */
    water: [
      { seed: 0x11AA, nrm: 5.5, spec: [[2,1.0],[4,0.55],[8,0.20]],   px: 128 },
      { seed: 0x9E31, nrm: 4.0, spec: [[3,1.0],[6,0.45],[11,0.16]],  px: 128 },
      { seed: 0x4C07, nrm: 3.2, spec: [[5,1.0],[10,0.60],[19,0.30]], px: 128 }
    ],

    /* -- 11. 煙のスプライト: 中心が濃い柔らかい円板 ------------------- */
    smoke: {
      px: 64, seed: 0x5A0E, puffSpec: [[4,1.0],[9,0.6],[18,0.35]],
      dens: [0.55, 0.85],                         // 濃度 [基準, 振れ幅]
      rgb: [255, 255, 255]                        // 煙の色(色味は使う側の material.color でも付けられる)
    },

    /* -- 12. 旗: 竿側に帯を置いた単純な陣旗(紋章の忠実再現は狙わない) - */
    flag: {
      w: 96, h: 64,
      field: '#9d2f26',                           // 地色
      band:  '#c9b47e',                           // 竿側の帯 / 横棒
      edge:  '#7a2019',                           // 帯の縁取り
      bars: 3                                     // 横棒の本数
    }
  };

  /* -- 現在ビルド中のセットの異方性フィルタ段数(mkTex が読む) ------ */
  var ANISO = DEF.aniso;


  /* -- 決定論的 PRNG。毎回同じ石積みが出る(スクショ比較のため) -- */
  function rnd(seed){
    var s = (seed>>>0) || 1;
    return function(){ s = (s*1664525 + 1013904223)>>>0; return s/4294967296; };
  }
  function cvs(n){ var c = document.createElement('canvas'); c.width = c.height = n; return c; }

  /* -- 継ぎ目なく繰り返せる value noise。格子を巻き込み参照するので
   *    どの周波数でもタイル境界で不連続にならない。 ------------------ */
  function noiseField(N, lat, seed){
    var r = rnd(seed), g = new Float32Array(lat*lat), i;
    for (i=0;i<g.length;i++) g[i] = r();
    var out = new Float32Array(N*N), sc = lat/N;
    for (var y=0;y<N;y++){
      var fy = y*sc, yi = Math.floor(fy), ty = fy-yi, y0 = yi%lat, y1 = (yi+1)%lat;
      var wy = ty*ty*(3-2*ty);
      for (var x=0;x<N;x++){
        var fx = x*sc, xi = Math.floor(fx), tx = fx-xi, x0 = xi%lat, x1 = (xi+1)%lat;
        var wx = tx*tx*(3-2*tx);
        var top = g[y0*lat+x0] + (g[y0*lat+x1]-g[y0*lat+x0])*wx;
        var bot = g[y1*lat+x0] + (g[y1*lat+x1]-g[y1*lat+x0])*wx;
        out[y*N+x] = top + (bot-top)*wy;
      }
    }
    return out;
  }
  function octaves(N, seed, specs){
    var out = new Float32Array(N*N), tot = 0, i, j;
    for (i=0;i<specs.length;i++){
      var f = noiseField(N, specs[i][0], seed + i*7919), a = specs[i][1];
      for (j=0;j<out.length;j++) out[j] += f[j]*a;
      tot += a;
    }
    for (j=0;j<out.length;j++) out[j] /= tot;
    return out;
  }

  /* -- 巻き込み描画: タイル境界をまたぐ矩形は反対側にも描く -------- */
  function fillWrap(ctx, N, x, y, w, h){
    ctx.fillRect(x, y, w, h);
    if (x + w > N) ctx.fillRect(x - N, y, w, h);
    if (x < 0)     ctx.fillRect(x + N, y, w, h);
  }

  /* -- 平均輝度を狙い値に強制的に合わせる(白飛び対策の要) --------
   * map は color に乗算されるので、平均が 1.0 を超えると既存の配色が
   * そのまま明るくなって飽和する。ここで実測して線形に押し下げる。 */
  function normaliseMean(c, target){
    var ctx = c.getContext('2d'), N = c.width;
    var im = ctx.getImageData(0,0,N,N), d = im.data, i, sum = 0;
    for (i=0;i<d.length;i+=4) sum += (d[i]*0.299 + d[i+1]*0.587 + d[i+2]*0.114);
    var mean = sum / (d.length/4) / 255;
    var k = target / (mean || 1);
    for (i=0;i<d.length;i+=4){
      d[i]   = Math.min(255, Math.round(d[i]  *k));
      d[i+1] = Math.min(255, Math.round(d[i+1]*k));
      d[i+2] = Math.min(255, Math.round(d[i+2]*k));
    }
    ctx.putImageData(im,0,0);
    return c;
  }

  /* -- 高さマップ(グレースケール)から接空間法線マップを焼く。
   * r128 は USE_TANGENT なしでも画面空間微分で TBN を作る
   * (perturbNormal2Arb)ので tangent 属性は不要。端は巻き込み参照。 */
  function bakeNormal(hc, strength){
    var N = hc.width;
    var src = hc.getContext('2d').getImageData(0,0,N,N).data;
    var out = cvs(N), octx = out.getContext('2d');
    var img = octx.createImageData(N,N), o = img.data;
    function H(x,y){ return src[((((y%N)+N)%N)*N + (((x%N)+N)%N))*4] / 255; }
    for (var y=0;y<N;y++) for (var x=0;x<N;x++){
      var dx = (H(x+1,y) - H(x-1,y)) * strength;
      var dy = (H(x,y+1) - H(x,y-1)) * strength;
      var nx = -dx, ny = dy, nz = 1;           // ny の符号は OpenGL 系(緑=上)
      var l = Math.sqrt(nx*nx + ny*ny + nz*nz);
      var i = (y*N+x)*4;
      o[i]   = Math.round((nx/l*0.5+0.5)*255);
      o[i+1] = Math.round((ny/l*0.5+0.5)*255);
      o[i+2] = Math.round((nz/l*0.5+0.5)*255);
      o[i+3] = 255;
    }
    octx.putImageData(img,0,0);
    return out;
  }
  function mkTex(c){
    var t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.RepeatWrapping;
    /* 異方性フィルタ。実測(SwiftShader / headless)で 8 は 1 に比べて
     * フレームあたり約 8ms 重かった -- 城壁は斜めから見るので効果は
     * 大きいが、4 に落として効果とコストの折り合いを取る。
     * three 側で GPU の最大値にクランプされる。 */
    t.anisotropy = ANISO;
    return t;
  }
  /* 高さマップ配列をキャンバスに書き出す小道具 */
  function heightCanvas(N, arr){
    var c = cvs(N), ctx = c.getContext('2d');
    var im = ctx.createImageData(N,N), d = im.data;
    for (var i=0;i<N*N;i++){
      var v = Math.max(0, Math.min(255, Math.round(arr[i]*255)));
      d[i*4] = d[i*4+1] = d[i*4+2] = v; d[i*4+3] = 255;
    }
    ctx.putImageData(im,0,0);
    return c;
  }

  /* ============================================================ *
   * 1. 石積み -- 蜂蜜色の砂岩、布積み(running bond)の切石
   * ============================================================ *
   * 256px = 2.4m。1段 0.30m x 8段、ブロック幅 0.60-1.05m。実物写真の
   * ボディアムは目地が細く(1-2cm)、面は風化でまだらに汚れている。
   * 石の「大きさ」は uvWorldize の density 側で決めるので、ここでは
   * 「タイル1枚 = 2.4m 角」という約束だけ守ればよい。 */
  function makeStone(P){
    var N = P.px, COURSES = P.courses, ch = N/COURSES;
    var a = cvs(N), A = a.getContext('2d');
    var hgt = new Float32Array(N*N);
    var r = rnd(P.seed);

    A.fillStyle = P.mortar; A.fillRect(0,0,N,N);            // 目地(モルタル)
    for (var i=0;i<hgt.length;i++) hgt[i] = P.mortarH;      // 目地は凹み

    // 段ごとに: 幅の合計がちょうど N になるブロック列を作り、
    // ランダムな位相でずらして芋目地を避ける(横方向は完全にタイル可)
    var blocks = [];
    for (var c=0;c<COURSES;c++){
      var ws = [], sum = 0;
      while (sum < N - P.blockMin){ var w = P.blockW[0] + Math.floor(r()*P.blockW[1]); ws.push(w); sum += w; }
      ws.push(N - sum);                                     // 端数を最後の石へ
      var off = Math.floor(r()*N), x = off;
      for (var k=0;k<ws.length;k++){
        blocks.push({ x: x % N, y: c*ch, w: ws[k], h: ch });
        x += ws[k];
      }
    }
    // 面: 明度ばらつき + 上端の受光エッジ + 下端の影
    var J = P.joint;                                        // 目地の半幅(px)
    blocks.forEach(function(b){
      var v = P.faceLum[0] + Math.floor(r()*P.faceLum[1]);
      A.fillStyle = 'rgb('+(v+P.faceRGB[0])+','+(v+P.faceRGB[1])+','+(v+P.faceRGB[2])+')';
      fillWrap(A, N, b.x+J, b.y+J, b.w-2*J, b.h-2*J);
      A.fillStyle = P.edgeHi;                               // 上端の面取り
      fillWrap(A, N, b.x+J, b.y+J, b.w-2*J, 1.6);
      A.fillStyle = P.edgeLo;                               // 下端の影(目地の落ち)
      fillWrap(A, N, b.x+J, b.y+b.h-J-2.0, b.w-2*J, 2.0);
    });
    /* 高さ: ブロックごとに少し飛び出す量を変える(斜光で段が波打つ)。
     * ★ 面を平らにしない ------------------------------------------
     * 変更前の高さマップは「目地 0.30 / 面 0.72-0.98」の階段で、
     * 傾いている画素は目地際の 1px だけだった。そこは bakeNormal の
     * strength 2.6 の時点ですでに 52 度あり、strength を上げても
     * atan が寝るだけで見た目はほとんど変わらない(実測: 2.6 -> 4.4
     * で朝の斜光の壁面 high-pass sd は +1% しか動かなかった)。
     * 法線を「深く」するには、傾きを強くするのではなく **傾いた画素を
     * 増やす** しかない。実物の切石も縁は面取りと風化で丸い。
     * そこで縁から BEV px かけて目地の高さへ落とす。 */
    var BEV = P.bevel;                                      // 面取り幅(px) 既定 5.0px = 約4.7cm
    blocks.forEach(function(b){
      var hv = P.faceH[0] + r()*P.faceH[1];
      var bx0 = b.x+J, bx1 = b.x+b.w-J, by0 = b.y+J, by1 = b.y+b.h-J;
      for (var yy=Math.ceil(by0); yy<by1; yy++){
        for (var xx=Math.ceil(bx0); xx<bx1; xx++){
          var e = Math.min(1, Math.min(Math.min(xx-bx0, bx1-xx),
                                       Math.min(yy-by0, by1-yy)) / BEV);
          e = e*e*(3-2*e);
          hgt[((yy%N)*N) + (((xx%N)+N)%N)] = P.mortarH + (hv - P.mortarH) * (0.52 + 0.48*e);
        }
      }
    });
    /* 面そのものにも、のみ跡くらいの中周波の凹凸を足す。 */
    var tool = octaves(N, P.toolSeed, P.toolSpec);

    // 風化: 低周波の斑を albedo と高さの両方へ
    var stain = octaves(N, P.stainSeed, P.stainSpec);
    var im = A.getImageData(0,0,N,N), d = im.data;
    for (var p=0;p<N*N;p++){
      var s = stain[p];
      var mul = P.stainMul[0] + s*P.stainMul[1];            // 既定 0.84 - 1.14
      d[p*4]   = Math.min(255, d[p*4]  *(mul*P.tint[0]));
      d[p*4+1] = Math.min(255, d[p*4+1]*(mul*P.tint[1]));
      d[p*4+2] = Math.min(255, d[p*4+2]*(mul*P.tint[2]));    // 既定は「汚れが寒色に寄る」
      hgt[p] = Math.max(0, Math.min(1, hgt[p] + (s-0.5)*P.stainH + (tool[p]-0.5)*P.toolH));
    }
    A.putImageData(im,0,0);
    normaliseMean(a, P.mean);
    return { map: mkTex(a), normal: mkTex(bakeNormal(heightCanvas(N,hgt), P.nrm)), metres: P.metres };
  }

  /* ============================================================ *
   * 1b. レンガ -- ゴシックのフランドル積み(opt-in の追加 kind)
   * ============================================================ *
   * 【なぜ makeStone のパラメータでは足りなかったか】
   * makeStone は「段ごとに幅の合計が N になるまでランダム幅の切石を
   * 並べ、段の位相もランダムにずらす」。blockW を細かくすれば石は小さく
   * なるが、**幅がばらばらで位相もばらばら**という構造は変わらない。
   * それは切石積み(ashlar)の定義そのもので、レンガとは逆である。
   * レンガの読みを決めているのは大きさではなく
   *   (1) 単位が完全に均一(長手 ≒ 小口x2 + 目地)
   *   (2) 段ごとに「ちょうど半単位」ずれる = 目地が縦一直線に並ぶ
   *   (3) 目地が面より **明るい**(石灰目地 対 赤レンガ。石積みは逆)
   *   (4) 焼過ぎで黒光りする小口(zendrówka)がまだらに混じる
   *       -- マルボルクの壁面の斑はこれが正体で、風化の染みではない
   * の4点で、(1)(2)(4) は makeStone の乱数構造とは相容れない。だから
   * kind を分けた。
   *
   * 【既存 kind への影響をゼロにするために】
   * BRICK_DEF は DEF の *外* に置いてある。resolve() は opts.brick が
   * 与えられたときだけ P.brick を生やすので、レンガを使わない城では
   *   - resolve() の戻り値のキーが増えない
   *   - したがって cacheKey(JSON)も1文字も変わらない
   *   - bake() も makeBrick を呼ばない
   * ボディアム/ヴァンセンヌ/ボーマリス/カステル・デル・モンテは、この
   * 追加を入れる前とまったく同じテクスチャを同じキーで共有し続ける。
   *
   * 【実寸】既定 256px = 1.70m。1段 10.6cm(実物のクロスターフォーマート
   * は厚さ 9cm + 目地 1.5cm)、周期 42.5cm = 長手 28.3cm + 小口 14.2cm。
   * 実測写真のマルボルクとほぼ同じ密度になる。 */
  var BRICK_DEF = {
    px: 256, metres: 1.70, courses: 16, periods: 4, ratio: 2.0, seed: 0x8B12C7,
    /* 目地は面より明るい。ここが石積みと決定的に違う所なので、
     * normaliseMean の頭打ちに当てないよう mean 側で余裕を見ておく
     * (下の makeBrick の注記を参照)。 */
    mortar: '#f0ece0', mortarH: 0.24,
    joint: 1.15,                                // 目地の半幅(px)= 実寸 1.5cm
    faceLum: [150, 78], faceRGB: [0, -3, -9],   // 面の明度 [基準, 振れ幅] と RGB オフセット
    /* 焼過ぎ小口: 窯の火に近かった小口が黒く硝子化したもの。マルボルク
     * では意図的に模様(ダイアパー)として見せている。小口だけに出す。 */
    darkP: 0.20, darkMul: [0.48, 0.30],
    edgeHi: 'rgba(255,255,255,0.20)', edgeLo: 'rgba(38,26,18,0.40)',
    bevel: 1.6, faceH: [0.76, 0.14],
    gritSeed: 0x2C71, gritSpec: [[40,1.0],[92,0.5]], gritH: 0.09,
    stainSeed: 0x64B9, stainSpec: [[3,1.0],[7,0.55],[16,0.28]],
    stainMul: [0.90, 0.20], stainH: 0.06,
    tint: [1.0, 0.99, 0.975],
    mean: 0.76, nrm: 3.4
  };

  /* レンガごとの乱数は「並べた順に LCG を引く」のではなく、(段, 位置) の
   * 整数ハッシュから引く。理由: 1段あたりの引く回数が固定(= 一定ストライド)
   * だと、LCG は x_{n+s} が x_n のアフィン関数になるので **段をまたいで
   * 相関が残り、焼過ぎ小口が縦一列に並んでしまう**(実際に最初の焼き上げで
   * そうなった)。ハッシュならストライド相関が出ない。 */
  function bhash(a, b, s){
    var x = (Math.imul(a|0, 374761393) + Math.imul(b|0, 668265263) + (s|0)) | 0;
    x = (x ^ (x >>> 13)) | 0;
    x = Math.imul(x, 1274126177);
    return ((x ^ (x >>> 16)) >>> 0) / 4294967296;
  }

  function makeBrick(P){
    var N = P.px, C = P.courses;
    var a = cvs(N), A = a.getContext('2d');
    var hgt = new Float32Array(N*N);

    A.fillStyle = P.mortar; A.fillRect(0,0,N,N);
    for (var i=0;i<hgt.length;i++) hgt[i] = P.mortarH;

    /* 1周期 = 長手1本 + 小口1本。periods 本ちょうどで N を割り切るので
     * 横方向は必ず継ぎ目なくタイルできる。段は交互に半周期ずらす
     * -- これで小口の中心が下の段の長手の中心に載る(フランドル積みの
     * 定義)。makeStone のランダム位相と違い、ずれは常にちょうど半周期
     * なので、目地が縦方向に規則正しく並ぶ。 */
    var PER = N/P.periods;
    var HW  = PER/(1 + P.ratio);              // 小口 header
    var SW  = PER - HW;                       // 長手 stretcher
    var J   = P.joint;
    var C2  = (C % 2) ? C+1 : C;              // 段数は偶数でないと上下端で位相が衝突する
    var ch2 = N/C2;

    var units = [];
    for (var c=0;c<C2;c++){
      var phase = (c & 1) ? PER*0.5 : 0;
      for (var k=0;k<P.periods;k++){
        var x0 = phase + k*PER;
        units.push({ x:((x0%N)+N)%N,      y:c*ch2, w:SW, h:ch2, hdr:false, c:c, k:2*k   });
        units.push({ x:(((x0+SW)%N)+N)%N, y:c*ch2, w:HW, h:ch2, hdr:true,  c:c, k:2*k+1 });
      }
    }

    units.forEach(function(b){
      var v = P.faceLum[0] + Math.floor(bhash(b.c, b.k, P.seed)*P.faceLum[1]);
      /* 焼過ぎ小口。dk は 0..1 の一様値。dk < darkP の小口だけが黒くなり、
       * 暗さは dk を darkP で割り戻した値で散らす(全部同じ黒だと
       * 「塗った」ように見える)。 */
      var dk = bhash(b.c, b.k, P.seed ^ 0x5AC31);
      var mul = (b.hdr && dk < P.darkP)
              ? (P.darkMul[0] + (dk/P.darkP)*P.darkMul[1]) : 1.0;
      var vr = Math.round((v+P.faceRGB[0])*mul),
          vg = Math.round((v+P.faceRGB[1])*mul),
          vb = Math.round((v+P.faceRGB[2])*mul);
      A.fillStyle = 'rgb('+vr+','+vg+','+vb+')';
      fillWrap(A, N, b.x+J, b.y+J, b.w-2*J, b.h-2*J);
      A.fillStyle = P.edgeHi;                                 // 上端の受光
      fillWrap(A, N, b.x+J, b.y+J, b.w-2*J, 1.1);
      A.fillStyle = P.edgeLo;                                 // 下端の落ち影
      fillWrap(A, N, b.x+J, b.y+b.h-J-1.4, b.w-2*J, 1.4);
    });

    /* 高さ: レンガは切石ほど角が丸くないので面取りは 2px 程度。面の
     * 出入りも小さい(型で抜いているので厚みが揃っている)。 */
    var BEV = P.bevel;
    units.forEach(function(b){
      var hv = P.faceH[0] + bhash(b.c, b.k, P.seed ^ 0x1D77B)*P.faceH[1];
      var bx0 = b.x+J, bx1 = b.x+b.w-J, by0 = b.y+J, by1 = b.y+b.h-J;
      for (var yy=Math.ceil(by0); yy<by1; yy++){
        for (var xx=Math.ceil(bx0); xx<bx1; xx++){
          var e = Math.min(1, Math.min(Math.min(xx-bx0, bx1-xx),
                                       Math.min(yy-by0, by1-yy)) / BEV);
          e = e*e*(3-2*e);
          hgt[((((yy%N)+N)%N)*N) + (((xx%N)+N)%N)] = P.mortarH + (hv - P.mortarH) * (0.55 + 0.45*e);
        }
      }
    });

    var grit  = octaves(N, P.gritSeed,  P.gritSpec);          // 焼き肌のざらつき
    var stain = octaves(N, P.stainSeed, P.stainSpec);         // 雨だれ・苔の低周波
    var im = A.getImageData(0,0,N,N), d = im.data;
    for (var p=0;p<N*N;p++){
      var s = stain[p];
      var m2 = P.stainMul[0] + s*P.stainMul[1];
      d[p*4]   = Math.min(255, d[p*4]  *(m2*P.tint[0]));
      d[p*4+1] = Math.min(255, d[p*4+1]*(m2*P.tint[1]));
      d[p*4+2] = Math.min(255, d[p*4+2]*(m2*P.tint[2]));
      hgt[p] = Math.max(0, Math.min(1,
        hgt[p] + (s-0.5)*P.stainH + (grit[p]-0.5)*P.gritH));
    }
    A.putImageData(im,0,0);
    /* ★白飛び予算: 目地が面より明るい素材なので、normaliseMean が平均を
     * 押し上げると **一番明るい目地から先に 255 で頭を打つ**。頭打ちする
     * と目地/面のコントラストが失われて、せっかくの「明るい目地」が
     * ただの白い格子になる。条件は おおよそ
     *     mortar * mean <= 目地面積比*mortar + 残り*面の平均
     * になる。既定値(mortar 236 / 面の平均 ≒ 189 / 目地の面積 12%)では
     * mean 0.76 で焼いた画像の飽和画素が 3.7%(= 目地の峰だけ)。0.86 まで
     * 上げると 16% になり、目地が「白い格子」に潰れる。mean を上げるときは
     * 必ず焼いた画像を目視すること -- 数字だけでは潰れに気付けない。 */
    normaliseMean(a, P.mean);
    return { map: mkTex(a), normal: mkTex(bakeNormal(heightCanvas(N,hgt), P.nrm)), metres: P.metres };
  }

  /* ============================================================ *
   * 2. 屋根 -- 鉛葺きの立ちはぜ(standing seam)+ 板の継ぎ目
   * ============================================================ *
   * ROOF_COL / roofCaps はどちらもグレー = 鉛葺きの読み。128px = 1.8m。
   * 0.45m ごとに縦のロール、1.8m ごとに横の継ぎ手。 */
  function makeRoof(P){
    var N = P.px, a = cvs(N), A = a.getContext('2d');
    var hgt = new Float32Array(N*N);
    A.fillStyle = P.lead; A.fillRect(0,0,N,N);
    for (var i=0;i<hgt.length;i++) hgt[i] = 0.5;
    var rolls = P.rolls, rw = N/rolls;                      // 既定 0.45m ごと
    for (var k=0;k<rolls;k++){
      var x = k*rw;
      A.fillStyle = P.rollLo;                               // ロールの陰
      A.fillRect(x, 0, 2.5, N);
      A.fillStyle = P.rollHi;                               // ロールの峰
      A.fillRect(x+2.5, 0, 2.5, N);
      /* ロール(立ちはぜ)は角柱ではなく丸い。8px かけて山を作る。 */
      for (var yy=0;yy<N;yy++){
        for (var dx=-1;dx<7;dx++){
          var xx = (((Math.floor(x+dx)) % N) + N) % N;
          hgt[yy*N+xx] = 0.50 + 0.45 * Math.sin(Math.PI * (dx+1)/8);
        }
      }
    }
    /* 鉛板はロールとロールの間でわずかに垂れる。まだ 0.50 のままの
     * 画素(= ロールでも継ぎ手でもない平場)だけを cos 一つぶん
     * 沈ませると、面全体に緩い傾きができて斜光で丸みが出る。 */
    for (var sy=0; sy<N; sy++) for (var sx=0; sx<N; sx++){
      if (hgt[sy*N+sx] === 0.50)
        hgt[sy*N+sx] = 0.50 - 0.15 * Math.sin(Math.PI * ((sx % rw) / rw));
    }
    /* 横の継ぎ手(板の重ね)。既定 seams=1 = タイル下端に1本 = 切り出し
     * 前とまったく同じ。seams>1 を渡すと 1タイルに複数本引く -- 鉛葺きは
     * 板が長いので 1本でよいが、**瓦(pantile)は 30cm ごとに段が来る**
     * ので、瓦としてタイル寸を詰めずに段の密度だけ上げられるようにした。
     * seams=1 のとき y0 = N-3 になるので既存の城の出力は 1px も動かない。*/
    var SEAMS = P.seams || 1;
    for (var sm=0; sm<SEAMS; sm++){
      var sy0 = Math.round((sm+1)*N/SEAMS) - 3;
      A.fillStyle = P.seam;
      A.fillRect(0, sy0, N, 3);
      for (var yy2=sy0; yy2<sy0+3; yy2++) for (var xx2=0; xx2<N; xx2++) hgt[yy2*N+xx2] = 0.24;
    }
    // 鉛の緩い波打ちと汚れ
    var w = octaves(N, P.seed, P.warpSpec);
    var im = A.getImageData(0,0,N,N), d = im.data;
    for (var p=0;p<N*N;p++){
      var mul = P.warpMul[0] + w[p]*P.warpMul[1];
      d[p*4] = Math.min(255,d[p*4]*mul*P.tint[0]); d[p*4+1] = Math.min(255,d[p*4+1]*mul*P.tint[1]); d[p*4+2] = Math.min(255,d[p*4+2]*mul*P.tint[2]);
      hgt[p] = Math.max(0, Math.min(1, hgt[p] + (w[p]-0.5)*0.22));
    }
    A.putImageData(im,0,0);
    normaliseMean(a, P.mean);
    return { map: mkTex(a), normal: mkTex(bakeNormal(heightCanvas(N,hgt), P.nrm)), metres: P.metres };
  }

  /* ============================================================ *
   * 3. 木材 -- 板目。橋・扉・家具・小屋組で共用
   * ============================================================ *
   * 128px = 1.6m。板幅 0.4m、板の継ぎ目は U 軸に走らせる(BoxGeometry
   * の上面は uv=(x,z) なので、南北に伸びる橋の板が長手方向に並ぶ)。 */
  function makeWood(P){
    var N = P.px, a = cvs(N), A = a.getContext('2d');
    var hgt = new Float32Array(N*N);
    var r = rnd(P.seed);
    A.fillStyle = P.base; A.fillRect(0,0,N,N);
    for (var i=0;i<hgt.length;i++) hgt[i] = P.plankH;
    var planks = P.planks, pw = N/planks;                   // 既定 0.4m 幅の板
    for (var k=0;k<planks;k++){
      var x = k*pw;
      var v = P.plankLum[0] + Math.floor(r()*P.plankLum[1]);
      A.fillStyle = 'rgb('+v+','+v+','+v+')';
      A.fillRect(x+1.5, 0, pw-3, N);
      A.fillStyle = P.gap;                                  // 板の隙間
      A.fillRect(x, 0, 1.5, N);
      for (var yy=0;yy<N;yy++){ hgt[yy*N+(x|0)] = 0.12; hgt[yy*N+((x+1)|0)] = 0.2; }
    }
    // 木目: 板ごとに縦に流れる筋(x は細かく、y は粗く読んで引き伸ばす)
    var grain = octaves(N, P.grainSeed, P.grainSpec);
    var im = A.getImageData(0,0,N,N), d = im.data;
    for (var p=0;p<N*N;p++){
      var px = p % N, py = (p/N)|0;
      var g = grain[(((py*3)%N)*N) + px];
      var mul = P.grainMul[0] + g*P.grainMul[1];
      d[p*4] = Math.min(255,d[p*4]*mul*P.tint[0]); d[p*4+1] = Math.min(255,d[p*4+1]*mul*P.tint[1]); d[p*4+2] = Math.min(255,d[p*4+2]*mul*P.tint[2]);
      /* 乾いた板は樋状に反る(cupping)。板幅方向に cos 一つぶん
       * 凹ませると、板ごとの丸みが斜光で出る。木目だけでは高さが
       * ほぼ平らで、法線マップが継ぎ目の 1px にしか効いていなかった。 */
      if (hgt[p] > 0.3) hgt[p] = Math.max(0, Math.min(1,
        P.plankH + (g-0.5)*0.4 - 0.17 * Math.sin(Math.PI * ((px % pw) / pw))));
    }
    A.putImageData(im,0,0);
    normaliseMean(a, P.mean);
    return { map: mkTex(a), normal: mkTex(bakeNormal(heightCanvas(N,hgt), P.nrm)), metres: P.metres };
  }

  /* ============================================================ *
   * 4. 敷石 -- 各棟の石床 / 通路の不定形フラグストーン
   * ============================================================ *
   * 128px = 2.0m。格子を乱して 0.4-0.6m の不定形な板石にする。 */
  function makePave(P){
    var N = P.px, a = cvs(N), A = a.getContext('2d');
    var hgt = new Float32Array(N*N);
    var r = rnd(P.seed);
    A.fillStyle = P.mortar; A.fillRect(0,0,N,N);            // 目地の砂
    for (var i=0;i<hgt.length;i++) hgt[i] = P.mortarH;
    var g = P.grid, cell = N/g;                             // 既定 4x4 = 0.5m 角
    for (var gy=0; gy<g; gy++) for (var gx=0; gx<g; gx++){
      var jx = (r()-0.5)*cell*0.30, jy = (r()-0.5)*cell*0.30;
      var w = cell*(0.72 + r()*0.16), h = cell*(0.72 + r()*0.16);
      var x = gx*cell + (cell-w)/2 + jx, y = gy*cell + (cell-h)/2 + jy;
      var v = P.faceLum[0] + Math.floor(r()*P.faceLum[1]);
      A.fillStyle = 'rgb('+(v+P.faceRGB[0])+','+(v+P.faceRGB[1])+','+(v+P.faceRGB[2])+')';
      fillWrap(A, N, x, y, w, h);
      A.fillStyle = P.edgeHi;
      fillWrap(A, N, x, y, w, 1.4);
      A.fillStyle = P.edgeLo;
      fillWrap(A, N, x, y+h-1.6, w, 1.6);
      /* 石と同じ理由で、板石も縁を落として丸みを付ける(踏まれて
       * 角が取れた敷石)。BEVP は N=128・セル 32px に対する面取り幅。 */
      var hv = P.faceH[0] + r()*P.faceH[1], BEVP = P.bevel;
      for (var yy=Math.ceil(y); yy<y+h; yy++) for (var xx=Math.ceil(x); xx<x+w; xx++){
        var ep = Math.min(1, Math.min(Math.min(xx-x, x+w-xx),
                                      Math.min(yy-y, y+h-yy)) / BEVP);
        ep = ep*ep*(3-2*ep);
        hgt[((((yy%N)+N)%N)*N) + (((xx%N)+N)%N)] = P.mortarH + (hv - P.mortarH) * (0.50 + 0.50*ep);
      }
    }
    var wear = octaves(N, P.wearSeed, P.wearSpec);
    var im = A.getImageData(0,0,N,N), d = im.data;
    for (var p=0;p<N*N;p++){
      var mul = P.wearMul[0] + wear[p]*P.wearMul[1];
      d[p*4] = Math.min(255,d[p*4]*mul*P.tint[0]); d[p*4+1] = Math.min(255,d[p*4+1]*mul*P.tint[1]); d[p*4+2] = Math.min(255,d[p*4+2]*mul*P.tint[2]);
      hgt[p] = Math.max(0, Math.min(1, hgt[p] + (wear[p]-0.5)*0.2));
    }
    A.putImageData(im,0,0);
    normaliseMean(a, P.mean);
    return { map: mkTex(a), normal: mkTex(bakeNormal(heightCanvas(N,hgt), P.nrm)), metres: P.metres };
  }

  /* ============================================================ *
   * 5. 芝 -- 中庭の芝生。刈り跡と踏み跡のむら(法線は入れない)
   * ============================================================ */
  function makeTurf(P){
    var N = P.px, a = cvs(N), A = a.getContext('2d');
    A.fillStyle = '#ffffff'; A.fillRect(0,0,N,N);
    var lo = octaves(N, P.loSeed, P.loSpec);
    var hi = octaves(N, P.hiSeed, P.hiSpec);
    var im = A.getImageData(0,0,N,N), d = im.data;
    for (var p=0;p<N*N;p++){
      var mul = P.mowMul[0] + lo[p]*P.mowMul[1] + hi[p]*P.mowMul[2];
      d[p*4] = 255*mul*P.tint[0]; d[p*4+1] = 255*mul*P.tint[1]; d[p*4+2] = 255*mul*P.tint[2];
    }
    A.putImageData(im,0,0);
    normaliseMean(a, P.mean);
    return { map: mkTex(a), normal: null, metres: P.metres };
  }

  /* ============================================================ *
   * 6. 水面のさざ波 -- 2枚を別速度で流すための法線マップ
   * ============================================================ *
   * 高さは低周波のうねり + やや高周波のさざ波。albedo は作らない
   * (水の色は 11-environment.js が時間帯ごとに .color へ書くので、
   *  こちらは法線だけを足して .color には一切触らない)。 */
  function makeWaterNormal(seed, strength, spec, px){
    var N = px || 128;
    var h = octaves(N, seed, spec || [[2,1.0],[5,0.55],[9,0.22]]);
    return mkTex(bakeNormal(heightCanvas(N,h), strength));
  }

  /* ============================================================ *
   * 7. 煙のスプライト -- 中心が濃い柔らかい円板
   * ============================================================ */
  function makeSmoke(P){
    var N = P.px, c = cvs(N), ctx = c.getContext('2d');
    var img = ctx.createImageData(N,N), d = img.data;
    var puff = octaves(N, P.seed, P.puffSpec);
    for (var y=0;y<N;y++) for (var x=0;x<N;x++){
      var dx = (x-N/2)/(N/2), dy = (y-N/2)/(N/2);
      var r2 = Math.sqrt(dx*dx+dy*dy);
      var fall = Math.max(0, 1 - r2);
      var av = fall*fall * (P.dens[0] + puff[y*N+x]*P.dens[1]);
      var i = (y*N+x)*4;
      d[i] = P.rgb[0]; d[i+1] = P.rgb[1]; d[i+2] = P.rgb[2];
      d[i+3] = Math.max(0, Math.min(255, Math.round(av*255)));
    }
    ctx.putImageData(img,0,0);
    var t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.ClampToEdgeWrapping;
    return t;
  }

  /* ============================================================ *
   * 8. 旗 -- 竿側に金の帯を置いた単純な陣旗(紋章の忠実再現は狙わない)
   * ============================================================ */
  function makeFlag(P){
    var W = P.w, H = P.h, c = document.createElement('canvas');
    c.width = W; c.height = H;
    var ctx = c.getContext('2d');
    ctx.fillStyle = P.field; ctx.fillRect(0,0,W,H);            // 地色
    ctx.fillStyle = P.band;  ctx.fillRect(0,0,W*0.30,H);       // 竿側の帯
    ctx.fillStyle = P.edge;  ctx.fillRect(W*0.30, 0, 2.5, H);
    ctx.fillStyle = P.band;
    for (var i=0;i<P.bars;i++) ctx.fillRect(W*0.40, H*(0.17+i*0.27), W*0.48, H*0.10);
    var t = new T.CanvasTexture(c);
    t.wrapS = t.wrapT = T.ClampToEdgeWrapping;
    return t;
  }

  /* ============================================================ *
   * 9. 漆喰(ライムウォッシュ)-- 内壁
   * ============================================================ *
   * 考証: 中世の城で切石(ashlar)を使うのは外壁と要所だけで、部屋を
   * 仕切る内壁は瓦礫積み(rubble)の上に石灰を塗って仕上げるのが普通
   * だった。したがって内壁に外壁と同じ目地の格子を出してはいけない。
   * ここで描くのは
   *   - 鏝(こて)でならした低周波のうねり
   *   - 石灰のムラ・雨染みの斑(格子にならない有機的な形)
   *   - 剥がれて下地の瓦礫が透けた箇所(まばら、輪郭はぼかす)
   *   - 乾燥収縮のヘアクラック(数本だけ)
   * 256px = 3.2m。石(2.4m)と非通約にして、隣り合う壁で模様の周期が
   * 揃って見えるのを避ける。
   *
   * ★ 法線について: 漆喰は元々なだらかなので、高さマップのほぼ全画素
   * が傾いている。石積みのように「目地際の 1px だけが立っている」状態
   * とは逆で、strength を上げなくても面全体が起きる。逆に上げすぎると
   * 発泡スチロールに見えるので strength は石の半分以下に抑える。 */
  function makePlaster(P){
    var N = P.px, a = cvs(N), A = a.getContext('2d');
    var hgt = new Float32Array(N*N);
    var r = rnd(P.seed);

    A.fillStyle = '#ffffff'; A.fillRect(0,0,N,N);

    /* -- 鏝むら: 低周波のうねり。これが高さの主成分になる ---------- */
    var trowel = octaves(N, P.trowelSeed, P.trowelSpec);
    /* -- 石灰の塗りムラ・雨染み。albedo 側だけに効く別シード -------- */
    var stain  = octaves(N, P.stainSeed, P.stainSpec);
    /* -- 骨材のざらつき(ごく細かい) ------------------------------- */
    var grit   = octaves(N, P.gritSeed, P.gritSpec);
    /* -- 透けた瓦礫そのものの粒(丸みのある小石) ------------------- */
    var rub    = octaves(N, P.rubSeed, P.rubSpec);

    /* -- 剥落: 下地の瓦礫が透ける箇所。格子を作らないよう、ばらまいた
     *    種点までの巻き込み距離で不定形の斑を作る。半径はまちまち、
     *    輪郭は smoothstep でぼかす(縁が立つと「穴」に見える)。 */
    var SPALL = P.spalls, sx = [], sy = [], sr = [], si;
    for (si=0; si<SPALL; si++){ sx.push(r()*N); sy.push(r()*N); sr.push(P.spallR[0] + r()*P.spallR[1]); }

    /* -- ヘアクラック: 別キャンバスに巻き込みで描いてマスクにする --- */
    var cm = cvs(N), CM = cm.getContext('2d');
    CM.fillStyle = '#000'; CM.fillRect(0,0,N,N);
    CM.strokeStyle = '#fff'; CM.lineCap = 'round';
    for (var ci=0; ci<P.cracks; ci++){
      var px = r()*N, py = r()*N, ang = r()*Math.PI*2, segs = 3 + Math.floor(r()*4);
      var pts = [[px,py]];
      for (var sgi=0; sgi<segs; sgi++){
        ang += (r()-0.5)*1.5;
        var L = 8 + r()*22;
        px += Math.cos(ang)*L; py += Math.sin(ang)*L;
        pts.push([px,py]);
      }
      CM.lineWidth = 0.55 + r()*0.45;
      /* 3x3 のオフセットで描けばタイル境界をまたぐ亀裂も継ぎ目なし */
      for (var ox=-1; ox<=1; ox++) for (var oy=-1; oy<=1; oy++){
        CM.beginPath();
        CM.moveTo(pts[0][0]+ox*N, pts[0][1]+oy*N);
        for (var k=1;k<pts.length;k++) CM.lineTo(pts[k][0]+ox*N, pts[k][1]+oy*N);
        CM.stroke();
      }
    }
    var crack = CM.getImageData(0,0,N,N).data;

    var im = A.getImageData(0,0,N,N), d = im.data;
    for (var y=0;y<N;y++) for (var x=0;x<N;x++){
      var p = y*N+x;
      /* 剥落の強さ(0=健全, 1=下地が完全に露出) */
      var sp = 0;
      for (si=0; si<SPALL; si++){
        var dx = Math.abs(x-sx[si]); if (dx > N/2) dx = N-dx;
        var dy = Math.abs(y-sy[si]); if (dy > N/2) dy = N-dy;
        /* 半径を中周波ノイズで揺らす。素の円だと水玉模様に見えて
         * 「壁のカビ」にしか読めなかった。剥落は縁がぎざぎざになる。 */
        var rr = sr[si] * (0.55 + rub[p]*0.95);
        var t = 1 - Math.sqrt(dx*dx+dy*dy)/rr;
        if (t > sp) sp = t;
      }
      sp = Math.max(0, Math.min(1, sp));
      sp = sp*sp*(3-2*sp) * 0.50;           // 上限を抑える(剥がれすぎない)
      sp = Math.min(1, sp * (0.45 + stain[p]*1.1)); // 濃淡も染みでばらつかせる

      var ck = crack[p*4]/255;

      /* --- albedo ---------------------------------------------- */
      var mul = P.limeMul[0] + trowel[p]*P.limeMul[1] + (stain[p]-0.5)*P.limeMul[2] + (grit[p]-0.5)*P.limeMul[3];
      mul *= (1 - sp*0.26);                 // 露出した瓦礫は少し暗い
      mul *= (1 - ck*0.11);                 // 亀裂の影(ごく薄く。濃いと落書きに見える)
      var R = 255*mul*P.tint[0], G = 255*mul*P.tint[1], B = 255*mul*P.tint[2];
      /* 石灰は青白く、染みと露出部は下地の土色に寄る */
      var warm = sp*0.40 + (1-stain[p])*0.10;
      R *= 1.0 + warm*P.warmth[0];
      G *= 1.0 + warm*P.warmth[1];
      B *= 1.0 - warm*P.warmth[2];
      d[p*4]   = Math.max(0, Math.min(255, R));
      d[p*4+1] = Math.max(0, Math.min(255, G));
      d[p*4+2] = Math.max(0, Math.min(255, B));

      /* --- height ---------------------------------------------- *
       * 主成分は鏝むら(なだらか)。剥落部は一段落ち込み、そのなかに
       * 瓦礫の粒が戻ってくる。亀裂は溝。 */
      var h = 0.62 + (trowel[p]-0.5)*0.30 + (grit[p]-0.5)*0.05;
      h -= sp*0.16;
      h += sp*(rub[p]-0.5)*0.40;            // 露出した瓦礫の丸み
      h -= ck*0.09;
      hgt[p] = Math.max(0, Math.min(1, h));
    }
    A.putImageData(im,0,0);
    /* 白飛び対策: 内壁は面積が大きく、しかも明るい色を載せるので
     * 石(0.90)よりさらに低い平均に落とす。 */
    normaliseMean(a, P.mean);
    return { map: mkTex(a), normal: mkTex(bakeNormal(heightCanvas(N,hgt), P.nrm)), metres: P.metres };
  }

  /* ============================================================ *
   * 10. 藁 / 藺草 -- 干し草・敷き藺草・飼い葉
   * ============================================================ *
   * 繊維が一方向(U 軸)に流れる。128px = 1.1m。茎の太さ 1-2px は
   * 実寸 1cm 前後で、藺草(rush)としてはおおむね妥当。
   * 茎は「後から描いたものが上に載る」ので、Canvas の 2D API では
   * なく自前のバッファに深度付きで書き込む(高さと albedo を同時に
   * 確定させたいため)。 */
  function makeStraw(P){
    var N = P.px, a = cvs(N), A = a.getContext('2d');
    var hgt = new Float32Array(N*N);
    var lum = new Float32Array(N*N);        // 0 = まだ茎が載っていない
    var top = new Float32Array(N*N);        // その画素で一番上にある茎の高さ
    var r = rnd(P.seed);

    var STALKS = P.stalks;
    for (var s=0;s<STALKS;s++){
      var x0 = r()*N, y0 = r()*N;
      var len = 26 + r()*74;
      var drift = (r()-0.5)*6;                            // 端までの上下ずれ
      var th = 1.0 + r()*1.5;                             // 半幅(px)
      var v = P.stalkLum[0] + r()*P.stalkLum[1];          // 茎の明度
      var hv = 0.50 + r()*0.46;                           // 茎の高さ
      for (var t=0;t<len;t+=0.5){
        var xx = Math.floor(x0 + t) % N; if (xx<0) xx += N;
        var yc = y0 + drift*(t/len);
        for (var q=-th; q<=th; q+=0.5){
          var yq = Math.floor(yc+q); yq = ((yq%N)+N)%N;
          var p = yq*N+xx;
          var e = 1 - Math.abs(q)/(th+0.5);               // 断面の丸み
          if (e <= 0) continue;
          e = e*e*(3-2*e);
          var hh = 0.22 + (hv-0.22)*(0.45 + 0.55*e);
          if (hh > top[p]){                               // 上に載った茎が勝つ
            top[p] = hh;
            hgt[p] = hh;
            lum[p] = v*(0.72 + 0.28*e);
          }
        }
      }
    }
    /* 束のまとまり(低周波の明暗)。平らな干し草に見えないように */
    var clump = octaves(N, P.clumpSeed, P.clumpSpec);
    var im = A.getImageData(0,0,N,N), d = im.data;
    for (var p2=0;p2<N*N;p2++){
      var L = lum[p2] > 0 ? lum[p2] : P.gapLum;           // 茎の隙間 = 影
      if (top[p2] === 0) hgt[p2] = 0.18;
      var m2 = P.clumpMul[0] + clump[p2]*P.clumpMul[1];
      d[p2*4]   = Math.min(255, L*m2*P.tint[0]);
      d[p2*4+1] = Math.min(255, L*m2*P.tint[1]);
      d[p2*4+2] = Math.min(255, L*m2*P.tint[2]);          // 既定は「藁が黄色に寄る」
      d[p2*4+3] = 255;
      hgt[p2] = Math.max(0, Math.min(1, hgt[p2] + (clump[p2]-0.5)*0.22));
    }
    A.putImageData(im,0,0);
    normaliseMean(a, P.mean);
    return { map: mkTex(a), normal: mkTex(bakeNormal(heightCanvas(N,hgt), P.nrm)), metres: P.metres };
  }

  /* ============================================================ *
   * 11. 土 -- 菜園の畝。耕された粗い粒
   * ============================================================ *
   * 128px = 0.85m。鋤で起こした塊(clod)と細かい粒。方向は持たせない
   * (畝の向きは配置側でまちまちなので、等方にしておくのが無難)。 */
  function makeSoil(P){
    var N = P.px, a = cvs(N), A = a.getContext('2d');
    var hgt = new Float32Array(N*N);
    var r = rnd(P.seed);
    A.fillStyle = '#ffffff'; A.fillRect(0,0,N,N);
    var lump = octaves(N, P.lumpSeed, P.lumpSpec);                  // 塊
    var fine = octaves(N, P.fineSeed, P.fineSpec);                  // 粒
    var damp = octaves(N, P.dampSeed, P.dampSpec);                  // 湿りの斑

    /* 鋤で起こした塊を丸い山として重ねる。ノイズだけだと「もやもや」で
     * 耕された感じにならない。粒が見えることが土らしさの本体。 */
    var CLODS = P.clods, cxs = [], cys = [], crs = [], chs = [], ci;
    for (ci=0; ci<CLODS; ci++){
      cxs.push(r()*N); cys.push(r()*N); crs.push(3.5 + r()*7.5); chs.push(0.18 + r()*0.30);
    }
    var im = A.getImageData(0,0,N,N), d = im.data;
    for (var y=0;y<N;y++) for (var x=0;x<N;x++){
      var p = y*N+x;
      var cl = 0;
      for (ci=0; ci<CLODS; ci++){
        var dx = Math.abs(x-cxs[ci]); if (dx>N/2) dx = N-dx;
        var dy = Math.abs(y-cys[ci]); if (dy>N/2) dy = N-dy;
        var t = 1 - (dx*dx+dy*dy)/(crs[ci]*crs[ci]);
        if (t > 0){ var v = Math.sqrt(t)*chs[ci]; if (v > cl) cl = v; }
      }
      hgt[p] = Math.max(0, Math.min(1,
        0.34 + cl + (lump[p]-0.5)*0.26 + (fine[p]-0.5)*0.14));
      /* albedo: 塊の天端は乾いて明るく、間は湿って暗い */
      var mul = P.clodMul[0] + cl*P.clodMul[1] + (lump[p]-0.5)*P.clodMul[2] + (fine[p]-0.5)*P.clodMul[3];
      mul *= P.dampMul[0] + damp[p]*P.dampMul[1];
      mul = Math.max(0.30, Math.min(1.45, mul));
      d[p*4]   = Math.min(255, 255*mul*P.tint[0]);
      d[p*4+1] = Math.min(255, 255*mul*P.tint[1]);
      d[p*4+2] = Math.min(255, 255*mul*P.tint[2]);
    }
    A.putImageData(im,0,0);
    normaliseMean(a, P.mean);
    return { map: mkTex(a), normal: mkTex(bakeNormal(heightCanvas(N,hgt), P.nrm)), metres: P.metres };
  }

  /* ============================================================ *
   * 12. 布 -- タペストリー・麻袋の平織り
   * ============================================================ *
   * 128px = 0.62m。縦糸/横糸が 4px(約 2cm)ごとに上下する平織り。
   * 紋様は入れない -- 織り目だけでも「布」には読めるし、柄を入れると
   * タペストリーと麻袋で同じ絵が出てしまう(色は material.color 側で
   * 赤/青/生成りに分かれる)。 */
  function makeCloth(P){
    var N = P.px, a = cvs(N), A = a.getContext('2d');
    var hgt = new Float32Array(N*N);
    A.fillStyle = '#ffffff'; A.fillRect(0,0,N,N);
    var PT = P.pitch;                                     // 糸ピッチ(px)
    var slub = octaves(N, P.slubSeed, P.slubSpec);        // 糸の太さむら
    var fold = octaves(N, P.foldSeed, P.foldSpec);        // 布のたるみ
    var im = A.getImageData(0,0,N,N), d = im.data;
    for (var y=0;y<N;y++) for (var x=0;x<N;x++){
      var p = y*N+x;
      /* 平織り: (u+v) の偶奇で縦糸が上か横糸が上かが入れ替わる */
      var u = Math.floor(x/PT), v = Math.floor(y/PT);
      var warpUp = ((u+v) & 1) === 0;
      var fx = (x % PT)/PT, fy = (y % PT)/PT;
      /* 上に来ている糸の断面(sin の山)、下の糸は浅い山 */
      var tp = warpUp ? Math.sin(Math.PI*fx) : Math.sin(Math.PI*fy);
      var bt = warpUp ? Math.sin(Math.PI*fy) : Math.sin(Math.PI*fx);
      hgt[p] = Math.max(0, Math.min(1,
        0.30 + tp*0.46 + bt*0.10 + (slub[p]-0.5)*0.16 + (fold[p]-0.5)*0.46));
      /* 陰影: 上の糸は明るく、糸の谷は暗い。織り目がうっすら出れば十分 */
      var mul = 0.74 + tp*0.30 + bt*0.06 + (slub[p]-0.5)*0.14 + (fold[p]-0.5)*0.34;
      mul = Math.max(0.35, Math.min(1.30, mul));
      d[p*4]   = Math.min(255, 255*mul*P.tint[0]);
      d[p*4+1] = Math.min(255, 255*mul*P.tint[1]);
      d[p*4+2] = Math.min(255, 255*mul*P.tint[2]);
    }
    A.putImageData(im,0,0);
    normaliseMean(a, P.mean);
    return { map: mkTex(a), normal: mkTex(bakeNormal(heightCanvas(N,hgt), P.nrm)), metres: P.metres };
  }

  /* ================================================================ *
   * パラメータの解決 / キャッシュ / 公開 API
   * ================================================================ */

  /* 浅いマージ。DEF の kind オブジェクトに opts の同名キーを上書きする。
   * ネストした配列(tint / spec / faceLum …)は「まるごと差し替え」で、
   * 要素単位のマージはしない -- 中途半端に混ざるより分かりやすい。 */
  function shallow(base, over){
    var o = {}, k;
    for (k in base) if (Object.prototype.hasOwnProperty.call(base,k)) o[k] = base[k];
    if (over) for (k in over) if (Object.prototype.hasOwnProperty.call(over,k)) o[k] = over[k];
    return o;
  }
  function isArr(v){ return Object.prototype.toString.call(v) === '[object Array]'; }

  function resolve(opts){
    opts = opts || {};
    var P = {}, k;
    for (k in DEF){
      if (!Object.prototype.hasOwnProperty.call(DEF,k)) continue;
      var base = DEF[k];
      if (isArr(base)){                       // water: 要素ごとに浅くマージ
        var src = opts[k] || [];
        P[k] = base.map(function(b,i){ return shallow(b, src[i]); });
      } else if (base && typeof base === 'object'){
        P[k] = shallow(base, opts[k]);
      } else {
        P[k] = (opts[k] != null ? opts[k] : base);
      }
    }
    /* opt-in の kind。**opts に無ければキーごと生やさない** ので、
     * レンガを使わない城の cacheKey は 1 文字も変わらない(= 既存4城の
     * テクスチャは同じキーで同じセットを共有し続ける)。 */
    if (opts.brick) P.brick = shallow(BRICK_DEF, opts.brick);
    return P;
  }

  /* ---- テクスチャセットの生成 ------------------------------------- */
  function bake(P){
    ANISO = P.aniso;
    var out = {
      stone: makeStone(P.stone), roof: makeRoof(P.roof), wood: makeWood(P.wood),
      pave: makePave(P.pave), turf: makeTurf(P.turf),
      /* 内装用。外壁の石積みをそのまま流用すると内壁が外壁のコピーに
       * 見えてしまうので、内壁は目地を持たない漆喰として別に焼く。 */
      plaster: makePlaster(P.plaster), straw: makeStraw(P.straw),
      soil: makeSoil(P.soil), cloth: makeCloth(P.cloth),
      waterN1: makeWaterNormal(P.water[0].seed, P.water[0].nrm, P.water[0].spec, P.water[0].px),
      waterN2: makeWaterNormal(P.water[1].seed, P.water[1].nrm, P.water[1].spec, P.water[1].px),
      waterN3: makeWaterNormal(P.water[2].seed, P.water[2].nrm, P.water[2].spec, P.water[2].px),
      smoke: makeSmoke(P.smoke), flag: makeFlag(P.flag)
    };
    /* opt-in。P.brick は kit(opts) に brick が渡されたときにしか生えない。*/
    if (P.brick) out.brick = makeBrick(P.brick);
    return out;
  }

  /* ---- キャッシュ --------------------------------------------------
   * モジュールスコープなので、城を切り替えても(このスクリプトが再評価
   * されない限り)生き残る。キーは「解決済みテクスチャパラメータの JSON」
   * なので、色やタイルサイズが違う城は別のセットになる。逆にパラメータが
   * 完全に同じ城どうしは意図的に1セットを共有する。
   * nrmBoost はマテリアル側の係数でテクスチャの画素には影響しないため、
   * キーから外してある(同じテクスチャを別の深さで使い回せる)。 */
  var _texCache = {};

  function cacheKey(P){
    var k, o = {};
    for (k in P){
      if (!Object.prototype.hasOwnProperty.call(P,k)) continue;
      if (k === 'nrmBoost') continue;
      o[k] = P[k];
    }
    return JSON.stringify(o);
  }

  function textures(opts){
    var P = resolve(opts), key = cacheKey(P);
    if (!_texCache[key]) _texCache[key] = bake(P);
    return _texCache[key];
  }

  /* ---- UV をメートル単位に書き直す ---------------------------------
   * mkBox / mkCyl はメッシュごとに新しい BufferGeometry を作る(共有は
   * していない)ので、ビルド末尾で1回走査して UV を差し替えてよい。
   *  - 円柱/円錐は円周方向の巻きを壊さないよう既存の UV を整数倍する
   *  - それ以外(箱・板・押し出し)は面法線の主軸でローカル平面投影する
   * density は「1m あたり何タイル」= 1/タイルの実寸(m)。 */
  function uvWorldize(mesh, density){
    var geo = mesh.geometry;
    if (!geo || geo.userData.__uvW) return;
    var pos = geo.attributes && geo.attributes.position;
    var uv  = geo.attributes && geo.attributes.uv;
    var nor = geo.attributes && geo.attributes.normal;
    if (!pos || !uv) return;
    var i, p = geo.parameters, ty = geo.type;
    if (p && (ty === 'CylinderGeometry' || ty === 'ConeGeometry')){
      var rad = ty === 'ConeGeometry' ? (p.radius||0)
              : Math.max(p.radiusTop||0, p.radiusBottom||0);
      var su = Math.max(1, Math.round(2*Math.PI*rad*density));   // 整数 = 継ぎ目なし
      var sv = Math.max(1, Math.round((p.height||1)*density));
      for (i=0;i<uv.count;i++) uv.setXY(i, uv.getX(i)*su, uv.getY(i)*sv);
    } else {
      for (i=0;i<uv.count;i++){
        var nx = nor ? Math.abs(nor.getX(i)) : 0;
        var ny = nor ? Math.abs(nor.getY(i)) : 1;
        var nz = nor ? Math.abs(nor.getZ(i)) : 0;
        var x = pos.getX(i), y = pos.getY(i), z = pos.getZ(i);
        if (ny >= nx && ny >= nz)      uv.setXY(i, x*density,  z*density);
        else if (nx >= nz)             uv.setXY(i, z*density,  y*density);
        else                           uv.setXY(i, x*density,  y*density);
      }
    }
    uv.needsUpdate = true;
    geo.userData.__uvW = 1;
  }

  function applyWorldUVs(root){
    root.traverse(function(o){
      if (!o.isMesh || !o.material) return;
      var d = o.material.userData && o.material.userData.uvDensity;
      if (d) uvWorldize(o, d);
    });
  }

  /* ================================================================ *
   * kit(opts) -- 城ファイルが呼ぶ唯一の入口
   * ================================================================ */
  function kit(opts){
    var P   = resolve(opts);
    var TEX = textures(opts);
    var NRM_BOOST = P.nrmBoost;
    /* id は診断用のラベル。resolve() は DEF に無いキーを落とすので、
     * ここで戻り値の params にだけ載せる -- キャッシュキー(textures()
     * の中で作られる)には入らないので、id を変えただけでテクスチャが
     * 焼き直されることはない。 */
    P.id = (opts && opts.id) || null;

    /* テクスチャ付きマテリアルを作る唯一の入口。density を userData に
     * 覚えさせておき、ビルド末尾の走査(applyWorldUVs)がそれを読む。 */
    function texMat(colorHex, kind, opt){
      opt = opt || {};
      var t = TEX[kind];
      var m = new T.MeshPhongMaterial({
        color: colorHex,
        map: t.map,
        shininess: 0, specular: 0x000000,     // マット: Lambert 相当の見え方
        side: opt.side || T.FrontSide
      });
      if (t.normal && opt.nrm !== 0){
        /* NRM_BOOST: 全マテリアル共通の法線の深さ。呼び出し側の nrm は
         * 「素材どうしの相対的な深さ」を決めるための重みなので、全体を
         * 深くしたいときは個々を書き換えるのではなく kit(opts) の
         * nrmBoost を動かす。
         * 高さマップ側(面取り・板の反り)で傾いた画素を増やしたうえで
         * これを掛けると、目地の 1px だけでなく面全体が起きてくる。 */
        var ns = (opt.nrm != null ? opt.nrm : 1.0) * NRM_BOOST;
        m.normalMap = t.normal;
        m.normalScale = new T.Vector2(ns, ns);
      }
      m.userData.uvDensity = (opt.density != null ? opt.density : 1/t.metres);
      return m;
    }

    return {
      tex: TEX,
      texMat: texMat,
      uvWorldize: uvWorldize,
      applyWorldUVs: applyWorldUVs,
      params: P
    };
  }

  return {
    kit: kit,
    textures: textures,      // マテリアルが要らず生テクスチャだけ欲しいとき
    defaults: DEF,           // 参照用(書き換えると全城に効くので注意)
    uvWorldize: uvWorldize,
    applyWorldUVs: applyWorldUVs,
    _texCache: _texCache,    // 診断用
    clearCache: function(){ for (var k in _texCache) delete _texCache[k]; }
  };
})();
