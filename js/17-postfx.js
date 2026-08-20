"use strict";

/* ====================================================================
 * 17. ポストプロセス: 被写界深度(DOF) / ブルーム / 光芒(God rays)
 *     + 最終段 FXAA
 *
 * 設計方針
 * --------
 * ・描画呼び出しを renderFrame() 1点に集約する。既存の
 *   `renderer.render(scene, camera)` は全て renderFrame() に置き換え済み
 *   (js/90-main.js × 9、js/15-nature.js × 1)。
 * ・3効果が全てOFFのときは EffectComposer を一切生成せず・通さず、
 *   `renderer.render(scene, camera)` をそのまま呼ぶ(= 従来と同一経路。
 *   drawCall もフレームあたりのGPUパス数も導入前と完全に一致する)。
 *   コンポーザは「最初にどれかがONになった瞬間」に遅延生成される。
 * ・EffectComposer を通すと WebGLRenderer の antialias:true (MSAA) は
 *   効かなくなる(コンポーザのRTはMSAA無し)。そのため FXAA を必ず
 *   最終段に置き、resolution uniform をリサイズ時に更新する。
 * ・ラベル(SpriteMaterial / depthTest:false / renderOrder 9000)は
 *   可読性が最優先なので、ポストプロセスの一切を通さない。
 *   labelGroup 配下をレイヤ1へ退避 → コンポーザ(カメラは既定のレイヤ0
 *   のみを見る)からは完全に外れる → 合成後にレイヤ1だけを
 *   autoClear=false で1回上描きする。ラベルOFF時はこの上描き自体を
 *   行わないので、既定状態では追加コストゼロ。
 *
 * 読み込み順(index.html)
 * ----------------------
 *   three.min.js
 *   → vendor/CopyShader.js
 *   → vendor/EffectComposer.js      ← THREE.Pass / FullScreenQuad をここで定義
 *   → vendor/ShaderPass.js / MaskPass.js / RenderPass.js
 *   → vendor/BokehShader.js → BokehPass.js
 *   → vendor/LuminosityHighPassShader.js → UnrealBloomPass.js
 *   → vendor/FXAAShader.js
 * ★ EffectComposer.js は「THREE.Pass を定義する側」で、ShaderPass /
 *   MaskPass / RenderPass / BokehPass / UnrealBloomPass はいずれも
 *   `class X extends THREE.Pass` をスクリプト評価時に解決する。よって
 *   EffectComposer.js を各 Pass より後ろに置くと
 *   "Class extends value undefined" で即死する。CopyShader / ShaderPass
 *   への依存は EffectComposer の *コンストラクタ実行時* にしか見ないので、
 *   CopyShader だけ先、ShaderPass は後ろで問題ない。
 * ==================================================================== */

/* --------------------------------------------------------------------
 * 17.1 設定の保存 / 復元(js/16-audio.js の audLoadPref と同じ作り。
 *      localStorage はプライベートモード等で例外を投げうるので必ず包む)
 * ------------------------------------------------------------------ */
var PFX_LS_DOF   = 'castleViewer.fx.dof';
var PFX_LS_BLOOM = 'castleViewer.fx.bloom';
var PFX_LS_RAYS  = 'castleViewer.fx.rays';

function pfxLoadPref(key, fallback){
  try {
    var v = window.localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch (e){ return fallback; }
}
function pfxSavePref(key, value){
  try { window.localStorage.setItem(key, String(value)); } catch (e){}
}

// 既定: 被写界深度 OFF(常時ボケていると城の細部が読めなくなる) /
//       ブルーム ON / 光芒 ON。
var dofOn   = pfxLoadPref(PFX_LS_DOF,   '0') === '1';
var bloomOn = pfxLoadPref(PFX_LS_BLOOM, '1') === '1';
var raysOn  = pfxLoadPref(PFX_LS_RAYS,  '1') === '1';

/* ヘッドレス撮影用の URL 上書き(?dof=1&bloom=0&rays=0)。js/90-main.js の
 * BOOT と同じ思想 -- 効果ON/OFFの比較画像を「URLだけ」で再現できるように
 * するためのもの。90-main.js より前に読まれるので独自に解析する。値が
 * '0'/'1' 以外、キーが無い場合は localStorage 由来の既定のまま。
 * 上書きは localStorage には書き戻さない(撮影が利用者の設定を汚さない)。 */
(function pfxBootParams(){
  var q = {};
  (location.search || '').replace(/^\?/, '').split('&').forEach(function(kv){
    if (!kv) return;
    var i = kv.indexOf('=');
    if (i < 0) return;
    q[decodeURIComponent(kv.slice(0, i))] = decodeURIComponent(kv.slice(i + 1));
  });
  if (q.dof === '0' || q.dof === '1') dofOn = q.dof === '1';
  if (q.bloom === '0' || q.bloom === '1') bloomOn = q.bloom === '1';
  if (q.rays === '0' || q.rays === '1') raysOn = q.rays === '1';
})();

/* vendor 一式が読めなかった場合(ファイル欠落・読み込み順ミス)でも
 * ビューアは従来経路で動き続ける。UI は無効化して黙って諦める。 */
var PFX_AVAILABLE = (typeof T !== 'undefined') && !!(
  T.EffectComposer && T.Pass && T.FullScreenQuad && T.RenderPass &&
  T.ShaderPass && T.BokehPass && T.BokehShader && T.UnrealBloomPass &&
  T.LuminosityHighPassShader && T.CopyShader && T.FXAAShader);

/* --------------------------------------------------------------------
 * 17.2 調整パラメータ(window.__fxTuning から実測しつつ触れる)
 * ------------------------------------------------------------------ */
var PFX_TUNE = {
  // --- 被写界深度 ---
  // BokehShader は factor = focus + viewZ(viewZは負) すなわち
  // 「焦点からの距離(m)」に aperture を掛けて UV 半径にする。aperture 自体は
  // pfxUpdate が maxblur / (focus * dofBlurSpan) で毎フレーム作る(城ごとに
  // 焦点距離が 53m〜590m と一桁違うため。理由はそちらのコメント参照)。
  dofBlurSpan: 0.60,    // 焦点距離の何倍ずれたら maxblur に達するか
  dofMaxBlur:  0.0100,  // ボケ半径の上限(UV)。効かせすぎ防止のクランプ
  dofStrength: 1.0,     // maxblur に掛かる総合の強さ(aperture も追従する)

  // --- ブルーム ---
  // 夜の窓明かり/蝋燭/暖炉/ステンドグラスの emissive を拾わせたいので、
  // CUR_TIME.windowGlow(夜1.0 / 夕0.4 / 朝昼0.0)で強度としきい値を補間。
  // 昼は「しきい値高め・強度低め」で空が白飛びしないようにする。
  //
  // ★夜側のしきい値 0.70 は **意図と逆に働いていた**(fx_night_off.png の
  //   画素実測、UnrealBloomPass と同じ luma 係数 0.299/0.587/0.114):
  //     月光の水面鏡面 … 0.84(該当画素 約6万。画面下半分ほぼ全部)
  //     窓明かり       … 中央値 0.51 / 最大 0.66
  //     ステンドグラス … 最大 0.40
  //   つまり 0.70 は「窓には届かず水面だけを通す」値で、光らせたいものが
  //   一つも拾われず、光らせたくないものだけが飽和していた。
  //   水面側の輝度を下げない限り輝度しきい値では分離できないため、
  //   js/11-environment.js の night.waterSpecular で鏡面を 0.84 -> 0.24 前後
  //   まで落とし、こちらのしきい値は逆に 0.36 まで **下げて** 窓と
  //   ステンドグラスが通るようにした。強度と半径も、水面が主役だった頃の
  //   0.55/0.55 から 0.30/0.40 へ下げてある(窓は小さいので、強く広く
  //   滲ませる必要がそもそも無い)。
  bloomStrengthDay:   0.16,
  bloomStrengthNight: 0.30,
  bloomThresholdDay:   0.88,
  bloomThresholdNight: 0.36,
  bloomRadius: 0.40,
  bloomScale: 0.5,   // UnrealBloomPass に渡す解像度倍率(内部で更に1/2)

  // --- 光芒 ---
  rayScale: 0.25,      // 放射ブラー用バッファの解像度倍率(縦横とも)
  /* 明部抽出のしきい値。狙いはただ一つ、「**太陽円板の芯だけ** を種に
   * すること」。空そのものを種にしてはいけない。
   * TIME_STATES[].sky の6ストップの最大輝度は 朝 0.91 / 昼 0.88 /
   * 夕 0.74 / 夜 0.15 と 6 倍の開きがあるので基準は空のピークに取るが、
   * 係数は 1.15 と **1 より大きく** して「空より明るいもの」だけを通す。
   * ・0.92 だった頃(前任者): 夕のしきい値 0.68 に対し地平線付近の空が
   *   0.73〜0.80 あり、空が丸ごと種になって画面全体が均一に暖色へ持ち
   *   上がっていた(実測: 夕の平均輝度 0.232 -> 0.455)。光条ではなく
   *   ただのカラーフィルタに見えていた原因はこれ。
   * ・1.15 にすると 夕 0.846 / 朝は上限 0.97 に張り付き、空はどこも
   *   届かない。円板の芯は加算合成で 1.0 に飽和するのでこれだけが残る。
   * rayThresholdMax は朝(空ピーク 0.91)で 1.045 になって「何も種に
   * ならない」状態を防ぐための上限クランプ。
   * rayThresholdMin 0.75 は夜の受け皿: 夜は太陽円板を出さないので、
   * 窓明かり(最大 0.66)が光条の種になって月と無関係に尾を引くのを
   * 防ぐ。夜のしきい値は 0.75 に張り付き、何も届かない。 */
  rayThresholdK: 1.15, // しきい値 = 空のピーク輝度 × これ
  rayThresholdMin: 0.75,
  rayThresholdMax: 0.97,
  raySoftnessK: 0.04,  // 全寄与に達するまでの幅 = 空のピーク輝度 × これ
  rayRadius: 0.55,     // 太陽からの寄与半径(アスペクト補正済みUV距離)
  rayFilterLen: 0.55,  // 放射ブラーの総長(UV)
  // 種が「空全体」から「太陽の芯」に変わって面積が2桁減ったので、
  // 総合強度は上げ直す必要がある。
  rayIntensity: 2.60,
  rayDayFloor: 0.12,   // 太陽が高い(昼)ときに残す割合

  /* --- 雲を透過する光芒(天使の梯子 / crepuscular rays) ---
   * 上の「画面から明部を抽出」方式では原理的に出せない(理由は 17.3a)。
   * 太陽だけを明るく・雲だけを黒く描いた専用の遮蔽バッファを別に作り、
   * 同じ放射ブラー鎖へ足し込む。 */
  /* 天使の梯子の強さ(レンズフレア側の強度 rayIntensity に対する比)。
   * 0.95 -> 1.90。太陽まわりの円周に沿って「光芒ON / OFF の輝度比」を実測
   * しながら振った(ヴァンセンヌ 夕 zoom0.25 / 朝 az1.82):
   *   0.95 … 比 1.2〜2.7。筋は出るが素の空との差が小さく、朝は特に弱い
   *   1.90 … 比 1.1〜3.5。雲の切れ間ごとに筋が分かれて読める
   *   2.40 … 太陽が雲に隠れていない向きでは、差し引きの残り(1-rayOccBias)
   *          ぶんの一様な明るさが勝ち、空全体が白茶ける(不可)
   * 上げられるようになったのは js/15-nature.js 側で「太陽の高度帯に、
   * グローより小さい雲を隙間を空けて並べる」ようにしたため。遮り切った
   * 暗い楔と抜けた明るい隙間が交互に出るので、強くしても霞にならない。
   * 下の rayOccShadowMax(暗い側の頭打ち)も同じ比率で 0.34 -> 0.55 に
   * 上げてある。据え置くと明るい側だけが伸びて明暗の釣り合いが崩れる。 */
  rayOccGain: 1.90,
  rayOccGlowAngle: 0.86,  // 遮蔽バッファに描く「太陽まわりの明るい空」の見かけ直径(rad)
  rayOccCoreScale: 1.00,  // 雲の後に加算する芯の大きさ(SUN_DISK_ANGLE 倍)
  rayOccCut: 0.50,
  rayOccBias: 0.80,       // 基準値の差し引き率。1 に近いほど「暗い縞」主体になる
  rayOccShadowMax: 0.55,  // 雲影による減光の上限(素の絵に対する割合)
                              // 雲の透過率がこれ以下の向きは光条を完全に断つ(しきい値)
  rayOccGroundFade: 0.14, // 地平線の下、これだけの UV 幅で光条を減衰させる
  rayOccGroundFloor: 0.22,// 地平線より下に残す割合(遠景の空気遠近ぶん)
  rayOccScreenMask: 1.00, // 画面由来の種に (1-雲アルファ) を掛ける割合(1=雲を種から完全排除)

  /* 調整用の覗き窓。__fxTuning.debugView に入れて renderFrame() を呼ぶと
   * 合成結果の代わりに中間バッファを表示する。0=通常 / 1=光芒の寄与だけ
   * (白=足す光・緑=引く影)/ 2=遮蔽バッファRGB / 3=同アルファ(雲の透過率)。
   * 「筋が出ない」ときに、種が悪いのか強度が弱いのかを一目で切り分けられる。 */
  debugView: 0
  // ※ 仰角クランプは js/11-environment.js の SUN_ANCHOR_ELEV_MAX に移した。
  //   太陽円板と光芒の中心が必ず一致していないと嘘に見えるため、
  //   両者が同じ sunAnchorDir() を呼ぶ形に一本化してある。
};

/* --------------------------------------------------------------------
 * 17.3 光芒パス(自作)
 *
 * 既存 vendor に god rays が無いので放射ブラー方式で自作する。
 *   (0) 遮蔽バッファ: 太陽=明るい / 雲=黒 の絵を専用シーンで1枚(17.3a)
 *   (1) 種づくり: 画面の明部(レンズフレア)と (0) の光を 1 枚の RGBA へ
 *       詰める。R=フレア / G=雲に刻まれた光 / B=その基準値
 *   (2) 放射ブラー: 太陽方向へ 6 タップ × 3 パス(ステップ長 1/6, 1/36,
 *       1/216 で粗→細)。ping-pong で低解像度バッファ2枚を使い回す
 *   (3) 合成: 元画像 + (フレア + max(0, G-B×bias)) × 太陽色。
 *       G が B を下回った向き ―― 雲に遮られた向き ―― は逆に元画像を
 *       暗くする。足すだけだと太陽まわりが一様に明るくなるだけで
 *       「光条」に見えないため(17.3a 末尾の実測メモを参照)。
 * (0)(1)(2) は rayScale(既定 0.25)倍の低解像度で回すので、フルスクリーン
 * パス換算では実質 5×0.0625 + 1 ≒ 1.3 パス分の塗りつぶし負荷。
 *
 * THREE.Pass は ES6 class なので ES5 の擬似継承では派生できない。
 * ただし vendor 未読込時に `class extends undefined` で即死しないよう、
 * クラス定義自体を関数内の class 式に閉じ込めて遅延評価する。
 * ------------------------------------------------------------------ */
var PFX_RAY_VERT = [
  'varying vec2 vUv;',
  'void main(){',
  '  vUv = uv;',
  '  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);',
  '}'
].join('\n');

/* --------------------------------------------------------------------
 * 17.3a 遮蔽バッファ(天使の梯子の本体)
 *
 * なぜ別バッファが要るのか
 * ------------------------
 * 17.3 の (1) は「合成後の画面」から輝度しきい値で明部を抜く。ところが雲は
 * 白っぽく明るいので、**雲自身が光源として抽出されてしまう**。しかも雲は
 * SpriteMaterial(depthWrite:false / renderOrder -5)で、太陽円板(加算合成)は
 * その後に描かれるため、画面上では **太陽は必ず雲の手前に出る**。つまり
 * 「雲が太陽を欠けさせた形」は画面にそもそも存在しない。結果として種は
 * 角度方向に均一なまま = 等方な星形にしかならない。
 * 天使の梯子は「明るい光源を遮蔽物が **部分的に** 隠す」ことでしか生まれない
 * ので、雲を光源ではなく **遮蔽物(黒)** として扱う専用の絵が要る。
 *
 * 採った方式: 専用シーン + ミラースプライト(本体シーンは走査しない)
 * ------------------------------------------------------------------
 * ・scene.overrideMaterial は Sprite に効かない(SpriteMaterial 以外を
 *   渡すとスプライト用シェーダを通らない)ので使えない。
 * ・本体 scene をレイヤ指定で描き直す案も採らなかった: three.js の
 *   projectObject はレイヤで弾く前にシーングラフを **全走査** するため、
 *   城のメッシュ数(数百〜数千)ぶんの CPU コストが毎フレーム乗る。
 * ・代わりに postfx 専用の小さな T.Scene を持ち、雲スプライトの
 *   position / scale / map / opacity だけを写した「影武者」を並べる。
 *   走査対象は 1 + 雲の枚数(最大 34)だけ。js/15-nature.js の状態は
 *   一切書き換えない(色を一時的に黒くして戻す、といった副作用が無い)。
 *
 * バッファの中身
 * --------------
 *   RGB … 太陽まわりの明るい空 × 雲の透過率     (放射ブラーの種)
 *   A   … 雲の透過率 Π(1 - 雲アルファ)          (画面由来の種のマスク)
 * 手順:
 *   1. (0,0,0,1) でクリア(= どこも透過率 1)
 *   2. グロースプライトを通常合成で描く(RGB に明るい空が入る)
 *   3. 影武者の雲を CustomBlending(src=ZERO / dst=ONE_MINUS_SRC_ALPHA)で
 *      重ねる。RGB もアルファも (1-雲アルファ) 倍される = 乗算で暗くなり、
 *      同時にアルファに透過率が積まれる。スプライトのアルファ(柔らかい
 *      輪郭)がそのまま残るので、光条の縁も硬くならない。
 * 深度バッファは持たない。雲(半径 600〜2100m)より太陽(far×0.72)の方が
 * 必ず遠いので、描画順(renderOrder)だけで前後関係は決まる。
 * ------------------------------------------------------------------ */
var PFX_OCC = { scene: null, glow: null, core: null, clouds: [], glowTex: null, coreTex: null };

/* 遮蔽される側 =「太陽まわりの明るい空」。裾を広く・緩く取る。
 * 芯だけを小さく描くと放射ブラーが引き伸ばせる範囲が狭すぎて筋が伸びない
 * (実測: 芯だけだと雲に欠けても太陽のすぐ脇に短い切れ込みが出るだけ)。 */
function pfxMakeOccGlowTexture(){
  var c = document.createElement('canvas');
  c.width = c.height = 128;
  var ctx = c.getContext('2d');
  var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0.00, 'rgba(255,255,255,1.00)');
  g.addColorStop(0.12, 'rgba(255,255,255,0.86)');
  g.addColorStop(0.26, 'rgba(255,255,255,0.58)');
  g.addColorStop(0.44, 'rgba(255,255,255,0.32)');
  g.addColorStop(0.64, 'rgba(255,255,255,0.14)');
  g.addColorStop(0.84, 'rgba(255,255,255,0.04)');
  g.addColorStop(1.00, 'rgba(255,255,255,0.00)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new T.CanvasTexture(c);
}

/* 遮蔽されない側 = 太陽円板そのものの芯。SUN_DISK と同じ大きさ・同じ位置。 */
function pfxMakeOccCoreTexture(){
  var c = document.createElement('canvas');
  c.width = c.height = 128;
  var ctx = c.getContext('2d');
  var g = ctx.createRadialGradient(64, 64, 0, 64, 64, 64);
  g.addColorStop(0.00, 'rgba(255,255,255,1.00)');
  g.addColorStop(0.26, 'rgba(255,255,255,0.90)');
  g.addColorStop(0.46, 'rgba(255,255,255,0.42)');
  g.addColorStop(0.70, 'rgba(255,255,255,0.12)');
  g.addColorStop(1.00, 'rgba(255,255,255,0.00)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new T.CanvasTexture(c);
}

function pfxOccEnsure(){
  if (PFX_OCC.scene) return PFX_OCC;
  PFX_OCC.scene = new T.Scene();
  PFX_OCC.glowTex = pfxMakeOccGlowTexture();
  PFX_OCC.coreTex = pfxMakeOccCoreTexture();

  /* R チャンネル: 雲より **先** に描く = 雲に刻まれる側 */
  PFX_OCC.glow = new T.Sprite(new T.SpriteMaterial({
    map: PFX_OCC.glowTex, color: 0xff0000, transparent: true,
    depthTest: false, depthWrite: false, fog: false, opacity: 1
  }));
  PFX_OCC.glow.renderOrder = -1;
  PFX_OCC.glow.frustumCulled = false;
  PFX_OCC.scene.add(PFX_OCC.glow);

  /* ★G チャンネル: まったく同じグローを雲より **後** に加算で描く。
   * これは「雲が一枚も無かったら空はどれだけ明るいか」の基準値。
   * 遮蔽ぶんだけを足す(R をそのまま加算する)方式では、晴れた向きにも
   * 一様な明るさ = 直流成分が必ず残る。実測でも朝の青空が一面白茶けて
   * 「光条」ではなく「霞」にしか見えなかった。R - G を取れば直流が
   * 打ち消え、**雲に遮られた向きだけが暗くなる** ―― 実際の天使の梯子と
   * 同じ「明暗の縞」として読めるようになる。
   * アルファは触らない(A は雲の透過率専用)ので blendDstAlpha=ONE。 */
  PFX_OCC.glowRef = new T.Sprite(new T.SpriteMaterial({
    map: PFX_OCC.glowTex, color: 0x00ff00, transparent: true,
    blending: T.CustomBlending,
    blendEquation: T.AddEquation,
    blendSrc: T.SrcAlphaFactor, blendDst: T.OneFactor,
    blendEquationAlpha: T.AddEquation,
    blendSrcAlpha: T.ZeroFactor, blendDstAlpha: T.OneFactor,
    depthTest: false, depthWrite: false, fog: false, opacity: 1
  }));
  PFX_OCC.glowRef.renderOrder = 1;
  PFX_OCC.glowRef.frustumCulled = false;
  PFX_OCC.scene.add(PFX_OCC.glowRef);

  /* ★芯は雲の **後** に加算で描く。
   * 本描画では太陽円板(加算合成・depthWrite:false)が雲(renderOrder -5)より
   * 後に描かれるので、画面上の太陽は **必ず雲の手前** に見えている。遮蔽
   * バッファだけで太陽を雲の裏に回すと、
   *   ・画面には煌々と太陽が写っているのに光芒だけが消える(嘘に見える)
   *   ・種の中心が真っ黒になり、放射ブラーが「中心の暗い靄」を作る
   *   ・occ.a が芯でも 0 になり、既存のレンズフレアの芯まで殺してしまう
   * の3つが同時に起きる(実測済み)。芯を雲の後に加算すれば、RGB もアルファも
   * 芯だけ復活し、「明るい太陽 + そのまわりの空を雲が刻む」という
   * 天使の梯子の成立条件そのものになる。 */
  PFX_OCC.core = new T.Sprite(new T.SpriteMaterial({
    map: PFX_OCC.coreTex, color: 0xffff00, transparent: true,  // R と G の両方へ
    blending: T.CustomBlending,
    blendEquation: T.AddEquation,
    blendSrc: T.SrcAlphaFactor, blendDst: T.OneFactor,
    // 芯だけはアルファも 1 へ戻す(= 画面由来のレンズフレアを殺さない)
    blendEquationAlpha: T.AddEquation,
    blendSrcAlpha: T.OneFactor, blendDstAlpha: T.OneFactor,
    depthTest: false, depthWrite: false, fog: false, opacity: 1
  }));
  PFX_OCC.core.renderOrder = 2;    // 雲より後
  PFX_OCC.core.frustumCulled = false;
  PFX_OCC.scene.add(PFX_OCC.core);
  return PFX_OCC;
}

/* 影武者の雲を本物へ追従させる。natClouds が無い / 自然物OFF なら全部隠す。 */
function pfxOccSyncClouds(){
  var have = (typeof natClouds !== 'undefined') && natClouds;
  var n = have ? natClouds.length : 0;
  var natVis = (typeof natureGroup === 'undefined') || natureGroup.visible;
  var i;
  // 不足ぶんを作る。map は生成時に確定させる(null -> texture の差し替えは
  // プログラムのキャッシュキーが変わるため material.needsUpdate が要る)。
  while (PFX_OCC.clouds.length < n){
    i = PFX_OCC.clouds.length;
    var mat = new T.SpriteMaterial({
      map: natClouds[i].mat.map, color: 0x000000, transparent: true,
      depthTest: false, depthWrite: false, fog: false, opacity: 1,
      blending: T.CustomBlending,
      blendEquation: T.AddEquation,
      blendSrc: T.ZeroFactor, blendDst: T.OneMinusSrcAlphaFactor,
      blendEquationAlpha: T.AddEquation,
      blendSrcAlpha: T.ZeroFactor, blendDstAlpha: T.OneMinusSrcAlphaFactor
    });
    var spr = new T.Sprite(mat);
    spr.renderOrder = 0;
    PFX_OCC.scene.add(spr);
    PFX_OCC.clouds.push(spr);
  }
  for (i = 0; i < PFX_OCC.clouds.length; i++){
    var mir = PFX_OCC.clouds[i];
    var src = (i < n) ? natClouds[i] : null;
    if (!src || !src.spr.visible || !natVis || src.mat.opacity <= 0.01){
      mir.visible = false;
      continue;
    }
    mir.visible = true;
    // natureGroup は無変換だが、将来オフセットが入っても壊れないよう
    // ワールド行列から取る(matrixWorld は直前の本描画で更新済み)。
    mir.position.setFromMatrixPosition(src.spr.matrixWorld);
    mir.scale.copy(src.spr.scale);
    mir.material.opacity = src.mat.opacity;
    if (mir.material.map !== src.mat.map){
      mir.material.map = src.mat.map;
      mir.material.needsUpdate = true;
    }
  }
}

var _pfxOccDir = new T.Vector3();
var _pfxOccClear = new T.Color();

/* 太陽円板の可視度。js/11-environment.js の updateSunDisk とまったく同じ式。
 * 「円板が出ていない状況では天使の梯子も出さない」を一点で保証する:
 *   夜 (sunDisk=0) / 昼 (sunDisk=0) / 曇・雨・雪 (sunMul<=0.58) -> 0
 *   朝・夕の晴 (sunDisk=1, sunMul=1)                            -> 1 */
function pfxSunDiskVis(){
  if (typeof CUR_TIME === 'undefined' || typeof CUR_WEATHER === 'undefined') return 0;
  return CUR_TIME.sunDisk * smoothstep01(0.62, 0.95, CUR_WEATHER.sunMul);
}

/* 地平線の画面上の高さ(UV。0=下端)。
 * このビューアのカメラはロールしないので、真の地平線は必ず画面と平行な
 * 直線になる。視線を水平面に落とした向きの無限遠点を投影すれば求まる。
 * far の外の点でも NDC の y は正しく出る(w で割った値しか使わない)。 */
var _pfxHorizFwd = new T.Vector3();
var _pfxHorizPt = new T.Vector3();
function pfxHorizonUv(){
  camera.getWorldDirection(_pfxHorizFwd);
  _pfxHorizFwd.y = 0;
  if (_pfxHorizFwd.lengthSq() < 1e-8) return 0.5;   // 真下を向いている等
  _pfxHorizFwd.normalize();
  _pfxHorizPt.copy(camera.position).addScaledVector(_pfxHorizFwd, 1e6);
  _pfxHorizPt.project(camera);
  return Math.max(-1, Math.min(2, _pfxHorizPt.y * 0.5 + 0.5));
}

/* 遮蔽バッファを 1 枚描く。呼び出し側(光芒パス)が enabled のときだけ走る。 */
function pfxRenderOcclusion(rendererRef, rt){
  pfxOccEnsure();
  pfxOccSyncClouds();

  /* 太陽円板とまったく同じ向き・同じ距離(js/11-environment.js updateSunDisk)。
   * 円板・レンズフレアの芯・天使の梯子の中心が三者ともずれてはいけない。 */
  var dist = camera.far * 0.72;
  sunAnchorDir(_pfxOccDir);
  var vis = pfxSunDiskVis();
  PFX_OCC.glow.visible = vis > 0.01;
  PFX_OCC.glowRef.visible = PFX_OCC.glow.visible;
  PFX_OCC.core.visible = PFX_OCC.glow.visible;
  if (PFX_OCC.glow.visible){
    var size = dist * PFX_TUNE.rayOccGlowAngle;
    PFX_OCC.glow.position.copy(camera.position).addScaledVector(_pfxOccDir, dist);
    PFX_OCC.glow.scale.set(size, size, 1);
    PFX_OCC.glow.material.opacity = vis;
    PFX_OCC.glowRef.position.copy(PFX_OCC.glow.position);
    PFX_OCC.glowRef.scale.copy(PFX_OCC.glow.scale);
    PFX_OCC.glowRef.material.opacity = vis;
    var csize = dist * SUN_DISK_ANGLE * PFX_TUNE.rayOccCoreScale;
    PFX_OCC.core.position.copy(PFX_OCC.glow.position);
    PFX_OCC.core.scale.set(csize, csize, 1);
    PFX_OCC.core.material.opacity = vis;
  }

  var oldAutoClear = rendererRef.autoClear;
  var oldAlpha = rendererRef.getClearAlpha();
  rendererRef.getClearColor(_pfxOccClear);

  rendererRef.autoClear = true;
  rendererRef.setClearColor(0x000000, 1);   // A=1 = どこも透過率 1
  rendererRef.setRenderTarget(rt);
  rendererRef.render(PFX_OCC.scene, camera);

  rendererRef.setClearColor(_pfxOccClear, oldAlpha);
  rendererRef.autoClear = oldAutoClear;
}

var PfxGodRayPass = null;
function pfxDefineGodRayPass(){
  if (PfxGodRayPass) return PfxGodRayPass;
  PfxGodRayPass = class PfxGodRayPassImpl extends T.Pass {
    constructor(width, height, scale){
      super();
      this.scale = scale || 0.25;
      this.needsSwap = true;
      this.filterLength = PFX_TUNE.rayFilterLen;

      var pars = {
        minFilter: T.LinearFilter, magFilter: T.LinearFilter,
        format: T.RGBAFormat, depthBuffer: false, stencilBuffer: false
      };
      var w = Math.max(4, Math.round(width * this.scale));
      var h = Math.max(4, Math.round(height * this.scale));
      this.rtA = new T.WebGLRenderTarget(w, h, pars);
      this.rtB = new T.WebGLRenderTarget(w, h, pars);
      this.rtA.texture.name = 'PfxGodRay.a'; this.rtA.texture.generateMipmaps = false;
      this.rtB.texture.name = 'PfxGodRay.b'; this.rtB.texture.generateMipmaps = false;
      // 遮蔽バッファ(17.3a)。ブラー鎖と同じ低解像度でよい。
      this.rtOcc = new T.WebGLRenderTarget(w, h, pars);
      this.rtOcc.texture.name = 'PfxGodRay.occ'; this.rtOcc.texture.generateMipmaps = false;

      // (1) 明部抽出 + 遮蔽バッファの合流 + 太陽からの距離フォールオフ
      this.matPrepare = new T.ShaderMaterial({
        uniforms: {
          tDiffuse:  { value: null },
          tOcc:      { value: null },
          sunUv:     { value: new T.Vector2(0.5, 0.5) },
          aspect:    { value: 1.0 },
          threshold: { value: 0.5 },
          softness:  { value: 0.1 },
          radius:    { value: PFX_TUNE.rayRadius },
          occMask:   { value: 0.0 },
          occCut:    { value: 0.0 }
        },
        vertexShader: PFX_RAY_VERT,
        /* ★4 チャンネルを 3 つのスカラとして使い、放射ブラー鎖 1 本に
         *   3 系統を相乗りさせる(鎖を増やすとパスが 3 つ増えるため)。
         *     R = 従来のレンズフレア(画面の明部)
         *     G = 天使の梯子(雲に刻まれた光)
         *     B = 同じ光の「雲が無かったときの基準値」
         *   合成時に G - B×bias を取ることで直流成分を打ち消す。
         * フレアが色付きでなくなるが、合成側で結局 rayColor を掛けており、
         * 種になるのは太陽円板の芯(ほぼ白)だけなので見た目は変わらない。 */
        fragmentShader: [
          'uniform sampler2D tDiffuse;',
          'uniform sampler2D tOcc;',
          'uniform vec2 sunUv;',
          'uniform float aspect;',
          'uniform float threshold;',
          'uniform float softness;',
          'uniform float radius;',
          'uniform float occMask;',
          'uniform float occCut;',
          'varying vec2 vUv;',
          'void main(){',
          '  vec3 c = texture2D(tDiffuse, vUv).rgb;',
          '  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));',
          '  float bright = smoothstep(threshold, threshold + softness, lum);',
          '  vec2 d = (vUv - sunUv) * vec2(aspect, 1.0);',
          '  float fall = 1.0 - smoothstep(0.0, radius, length(d));',
          // occ.r = 明るい空 × 雲の透過率 T / occ.g = 雲が無いときの同じ空 /
          // occ.a = T そのもの。
          // (1) 画面由来の種に T を掛ける = 雲自身が光源になるのを止める。
          // (2) occ.r を T で割り戻し、代わりに smoothstep(occCut, 1, T) を
          //     掛ける。T をそのまま使うと縁がだらだら伸びて光条が分離
          //     しないので、しきい値付きの曲線で二値に寄せる。T が小さい
          //     所では smoothstep が先に 0 になるため 0/0 にはならない。
          '  vec4 occ = texture2D(tOcc, vUv);',
          '  float trans = mix(1.0, occ.a, occMask);',
          '  float occLit = smoothstep(occCut, 1.0, occ.a) / max(occ.a, 0.02);',
          '  gl_FragColor = vec4(lum * bright * fall * trans,',
          '                      occ.r * occLit * fall,',
          '                      occ.g * fall,',
          '                      0.0);',
          '}'
        ].join('\n'),
        depthTest: false, depthWrite: false
      });

      // (2) 太陽方向への放射ブラー(6タップ)
      this.matGen = new T.ShaderMaterial({
        uniforms: {
          tInput:   { value: null },
          sunUv:    { value: new T.Vector2(0.5, 0.5) },
          stepSize: { value: 0.05 }
        },
        vertexShader: PFX_RAY_VERT,
        fragmentShader: [
          'uniform sampler2D tInput;',
          'uniform vec2 sunUv;',
          'uniform float stepSize;',
          'varying vec2 vUv;',
          'void main(){',
          '  vec2 delta = sunUv - vUv;',
          '  float dist = length(delta);',
          '  vec2 stepv = delta * (stepSize / max(dist, 1e-5));',
          '  vec2 uv = vUv;',
          '  vec4 acc = vec4(0.0);',   // rgb = レンズフレア / a = 天使の梯子
          '  float w = 1.0;',
          '  float wsum = 0.0;',
          '  for (int i = 0; i < 6; i++){',
          // バッファ外は 0 寄与。CLAMP_TO_EDGE の端画素が尾を引いて
          // 画面端から光が伸びる不具合を防ぐ。
          '    float inside = step(0.0, uv.x) * step(uv.x, 1.0) *',
          '                   step(0.0, uv.y) * step(uv.y, 1.0);',
          '    acc += texture2D(tInput, clamp(uv, 0.0, 1.0)) * (w * inside);',
          '    wsum += w;',
          '    w *= 0.86;',
          '    uv += stepv;',
          '  }',
          '  gl_FragColor = acc / max(wsum, 1e-4);',
          '}'
        ].join('\n'),
        depthTest: false, depthWrite: false
      });

      // (3) 加算合成
      this.matComposite = new T.ShaderMaterial({
        uniforms: {
          tDiffuse:  { value: null },
          tRays:     { value: null },
          tOcc:      { value: null },
          rayColor:  { value: new T.Color(1, 1, 1) },
          intensity: { value: 0.0 },
          occIntensity: { value: 0.0 },
          occBias:    { value: 0.8 },
          occShadowMax:{ value: 0.35 },
          horizonUv:  { value: 0.5 },
          groundFade: { value: 0.13 },
          groundFloor:{ value: 0.2 },
          debugView: { value: 0.0 }
        },
        vertexShader: PFX_RAY_VERT,
        fragmentShader: [
          'uniform sampler2D tDiffuse;',
          'uniform sampler2D tRays;',
          'uniform sampler2D tOcc;',
          'uniform vec3 rayColor;',
          'uniform float intensity;',
          'uniform float occIntensity;',
          'uniform float occBias;',
          'uniform float occShadowMax;',
          'uniform float horizonUv;',
          'uniform float groundFade;',
          'uniform float groundFloor;',
          'uniform float debugView;',
          'varying vec2 vUv;',
          'void main(){',
          '  vec3 base = texture2D(tDiffuse, vUv).rgb;',
          '  vec4 rays = texture2D(tRays, vUv);',
          /* 天使の梯子は「空気に散乱した光」なので、地平線より下 = 手前の
           * 地面や城の面に同じ量を乗せると、光条ではなく画面全体の霞に
           * なる(実測: 朝の草地・城壁がまるごと白茶けた)。地平線を境に
           * groundFloor まで落とす。遠景の山や霞にはわずかに残るので
           * 空気遠近としては自然に見える。地平線の画面位置は
           * pfxUpdate が毎フレーム投影して渡す。 */
          '  float sky = mix(groundFloor, 1.0,',
          '                  smoothstep(horizonUv - groundFade, horizonUv, vUv.y));',
          '  float flare = rays.r * intensity;',
          // 基準値(雲が無いときの明るさ)の occBias 倍を差し引く。
          // 上回った向き = 雲の切れ間 -> 光を足す。
          // 下回った向き = 雲に遮られた向き -> 素の絵を暗くする。
          // 引き算にすることで「太陽まわりが一様に明るいだけ」の成分が
          // 消え、明暗の縞として光条が読めるようになる。
          '  float ref   = rays.b * occBias;',
          '  float lit   = max(0.0, rays.g - ref) * occIntensity * sky;',
          '  float shade = min(occShadowMax, max(0.0, ref - rays.g) * occIntensity * sky);',
          '  if (debugView > 2.5){ gl_FragColor = vec4(vec3(texture2D(tOcc, vUv).a), 1.0); return; }',
          '  if (debugView > 1.5){ gl_FragColor = vec4(texture2D(tOcc, vUv).rgb, 1.0); return; }',
          '  if (debugView > 0.5){ gl_FragColor = vec4(vec3(lit) + vec3(0.0, shade, 0.0) + rayColor * flare, 1.0); return; }',
          '  gl_FragColor = vec4(base * (1.0 - shade) + rayColor * (flare + lit), 1.0);',
          '}'
        ].join('\n'),
        depthTest: false, depthWrite: false
      });

      this.occActive = false;
      this.fsQuad = new T.FullScreenQuad(null);
    }

    setSize(width, height){
      var w = Math.max(4, Math.round(width * this.scale));
      var h = Math.max(4, Math.round(height * this.scale));
      this.rtA.setSize(w, h);
      this.rtB.setSize(w, h);
      this.rtOcc.setSize(w, h);
    }

    dispose(){
      this.rtA.dispose(); this.rtB.dispose(); this.rtOcc.dispose();
      this.matPrepare.dispose(); this.matGen.dispose(); this.matComposite.dispose();
      this.fsQuad.dispose();
    }

    render(renderer, writeBuffer, readBuffer){
      /* (0) 遮蔽バッファ(太陽=明るい / 雲=黒)。
       * 太陽円板が出ていないフレーム(夜・昼・曇/雨/雪)では occMask も
       * occIntensity も 0 になり、rtOcc の中身が結果に一切効かないので
       * 描画ごと省く。= 追加の scene 描画は「朝夕の晴で太陽が画面内」の
       * ときだけ走る。 */
      if (this.occActive) pfxRenderOcclusion(renderer, this.rtOcc);

      // (1)
      this.matPrepare.uniforms.tOcc.value = this.rtOcc.texture;
      this.matPrepare.uniforms.tDiffuse.value = readBuffer.texture;
      this.fsQuad.material = this.matPrepare;
      renderer.setRenderTarget(this.rtA);
      this.fsQuad.render(renderer);

      // (2) 粗 -> 細。three.js の GodRays 例と同じ stepSize = len * 6^-pass。
      var src = this.rtA, dst = this.rtB, tmp;
      this.fsQuad.material = this.matGen;
      for (var p = 1; p <= 3; p++){
        this.matGen.uniforms.tInput.value = src.texture;
        this.matGen.uniforms.stepSize.value = this.filterLength * Math.pow(6, -p);
        renderer.setRenderTarget(dst);
        this.fsQuad.render(renderer);
        tmp = src; src = dst; dst = tmp;
      }

      // (3)
      this.matComposite.uniforms.tDiffuse.value = readBuffer.texture;
      this.matComposite.uniforms.tRays.value = src.texture;
      this.matComposite.uniforms.tOcc.value = this.rtOcc.texture;
      this.matComposite.uniforms.debugView.value = PFX_TUNE.debugView || 0;
      this.fsQuad.material = this.matComposite;
      renderer.setRenderTarget(this.renderToScreen ? null : writeBuffer);
      this.fsQuad.render(renderer);
    }
  };
  return PfxGodRayPass;
}

/* --------------------------------------------------------------------
 * 17.4 コンポーザの遅延生成
 * ------------------------------------------------------------------ */
var pfxComposer = null;
var pfxRenderPass = null, pfxBokehPass = null, pfxRayPass = null,
    pfxBloomPass = null, pfxFxaaPass = null;
var _pfxSunDir = new T.Vector3();
var _pfxSunWorld = new T.Vector3();
var _pfxCamFwd = new T.Vector3();
var _pfxFocusPt = new T.Vector3();
var _pfxSize = new T.Vector2();

function pfxSmoothstep(a, b, x){
  if (b <= a) return x < a ? 0 : 1;
  var t = Math.max(0, Math.min(1, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
}

function pfxEnsure(){
  if (pfxComposer || !PFX_AVAILABLE) return pfxComposer;
  renderer.getSize(_pfxSize);
  var pr = renderer.getPixelRatio();
  var ew = Math.max(1, Math.round(_pfxSize.x * pr));
  var eh = Math.max(1, Math.round(_pfxSize.y * pr));

  pfxComposer = new T.EffectComposer(renderer);
  pfxComposer.setPixelRatio(pr);
  pfxComposer.setSize(_pfxSize.x, _pfxSize.y);

  pfxRenderPass = new T.RenderPass(scene, camera);
  pfxComposer.addPass(pfxRenderPass);

  // --- 被写界深度 ---------------------------------------------------
  pfxBokehPass = new T.BokehPass(scene, camera, {
    focus: 100, aperture: 0.0002, maxblur: PFX_TUNE.dofMaxBlur, // 実値は pfxUpdate が毎フレーム上書き
    width: ew, height: eh
  });
  // THREE.Pass の既定 setSize は何もしないので、深度RTのリサイズを自前で。
  pfxBokehPass.setSize = function(w, h){ this.renderTargetDepth.setSize(w, h); };
  // BokehPass は深度を取るためにシーンをもう一度 overrideMaterial 付きで
  // 描く。そのとき scene.background(CanvasTexture の空)まで深度マテリアルで
  // 描かれて中央に妙な深度が入るので、深度描画の間だけ背景を外す。
  // 太陽円板(Sprite)も同じ理由で深度描画から外す。overrideMaterial は
  // Sprite にも適用され、そのときビルボード化を行うスプライト用シェーダを
  // 通らないので、遠方に「向きの狂った板」の深度が焼き付いてしまう。
  var _bokehRender = T.BokehPass.prototype.render;
  pfxBokehPass.render = function(renderer_, writeBuffer, readBuffer, dt, mask){
    var bg = scene.background;
    var sunVis = (typeof SUN_DISK !== 'undefined') && SUN_DISK.visible;
    scene.background = null;
    if (sunVis) SUN_DISK.visible = false;
    _bokehRender.call(this, renderer_, writeBuffer, readBuffer, dt, mask);
    if (sunVis) SUN_DISK.visible = true;
    scene.background = bg;
  };
  /* ★r128 の BokehPass は needsSwap=false のまま出荷されている。公式の例では
   * 最終段(renderToScreen=true)にしか置かないので露見しないが、後段に
   * FXAA を置く本構成では「writeBuffer にボケを書いた上でスワップしない」
   * ため、次のパスが元のボケていない readBuffer を読んでしまい、DOF が
   * まるごと捨てられる。実測でも aperture を 10 倍にしても画が一切変わらず、
   * ここを true にして初めてボケが出た。 */
  pfxBokehPass.needsSwap = true;
  pfxBokehPass.enabled = false;
  pfxComposer.addPass(pfxBokehPass);

  // --- 光芒 ---------------------------------------------------------
  var RayPass = pfxDefineGodRayPass();
  pfxRayPass = new RayPass(ew, eh, PFX_TUNE.rayScale);
  pfxRayPass.enabled = false;
  pfxComposer.addPass(pfxRayPass);

  // --- ブルーム -----------------------------------------------------
  // UnrealBloomPass は与えられた解像度を内部で更に 1/2 して mip 連鎖を
  // 作る。addPass / composer.setSize が実解像度で setSize を呼んでくる
  // ので、bloomScale を掛け直すラッパで低解像度に固定する
  // (既定 0.5 → 明部抽出バッファは縦横 1/4 = 面積 1/16)。
  pfxBloomPass = new T.UnrealBloomPass(
    new T.Vector2(Math.max(4, ew * PFX_TUNE.bloomScale), Math.max(4, eh * PFX_TUNE.bloomScale)),
    PFX_TUNE.bloomStrengthDay, PFX_TUNE.bloomRadius, PFX_TUNE.bloomThresholdDay);
  var _bloomSetSize = T.UnrealBloomPass.prototype.setSize;
  pfxBloomPass.setSize = function(w, h){
    _bloomSetSize.call(this,
      Math.max(4, Math.round(w * PFX_TUNE.bloomScale)),
      Math.max(4, Math.round(h * PFX_TUNE.bloomScale)));
  };
  pfxBloomPass.enabled = false;
  pfxComposer.addPass(pfxBloomPass);

  // --- FXAA(常に最終段) ---------------------------------------------
  pfxFxaaPass = new T.ShaderPass(T.FXAAShader);
  pfxFxaaPass.material.depthTest = false;
  pfxFxaaPass.material.depthWrite = false;
  pfxComposer.addPass(pfxFxaaPass);

  pfxResize();
  return pfxComposer;
}

/* リサイズ: js/12-camera.js の layout() は renderer.setSize しか触らない
 * (あちらは編集対象外)。resize リスナは登録順に呼ばれ layout が先なので、
 * ここでは既に更新済みの renderer サイズを読んでコンポーザ側を合わせる。 */
function pfxResize(){
  if (!pfxComposer) return;
  renderer.getSize(_pfxSize);
  var pr = renderer.getPixelRatio();
  pfxComposer.setPixelRatio(pr);
  pfxComposer.setSize(_pfxSize.x, _pfxSize.y); // 各 Pass の setSize もここから伝播
  var ew = Math.max(1, _pfxSize.x * pr), eh = Math.max(1, _pfxSize.y * pr);
  if (pfxFxaaPass){
    pfxFxaaPass.material.uniforms.resolution.value.set(1 / ew, 1 / eh);
  }
  if (pfxBokehPass){
    pfxBokehPass.uniforms.aspect.value = camera.aspect;
  }
}
window.addEventListener('resize', pfxResize);

/* --------------------------------------------------------------------
 * 17.5 毎フレームの追従
 * ------------------------------------------------------------------ */
function pfxUpdate(){
  var glow = (typeof CUR_TIME !== 'undefined') ? CUR_TIME.windowGlow : 0;
  var sunMul = (typeof CUR_WEATHER !== 'undefined') ? CUR_WEATHER.sunMul : 1;

  /* --- 被写界深度: 焦点はカメラ→注視点の実距離に毎フレーム追従 -------
   * 軌道カメラなので curDist だけでは足りない(注視点は
   * (curTgtX, TARGET_Y*0.55, curTgtZ)、カメラ高さは TARGET_Y + curDist*sinEl)。
   * 実距離を取るのが一番素直で、ズーム・パン・仰角のどれが動いても
   * 城そのものは常にピント面に乗る。 */
  pfxBokehPass.enabled = dofOn;
  if (dofOn){
    _pfxFocusPt.set(curTgtX, TARGET_Y * 0.55, curTgtZ);
    var focus = camera.position.distanceTo(_pfxFocusPt);
    /* ★aperture は焦点距離に反比例させる(絶対メートルで固定しない)。
     * 5城のスケールは 3 桁違う: ボディアムは近景ズームで焦点 53m、
     * マルボルクは同じ zoom でも焦点 590m ある。aperture を固定
     * (2.2e-4 = 焦点±45m で maxblur)にすると、マルボルクでは城の
     * 全長 470m がまるごと錯乱円上限に張り付き、実測で画面全体が
     * ボケて建物の形すら読めなくなった(タスクが警告している
     * 「効かせすぎて実用性を損なう」状態そのもの)。
     * 代わりに「焦点距離の dofBlurSpan 倍だけ外れたら maxblur」と
     * 相対で決めると、どの城でも「注視している建物は解像し、その
     * 前後の風景がボケる」という同じ絵になる。 */
    var span = Math.max(4, focus * PFX_TUNE.dofBlurSpan);
    var maxblur = PFX_TUNE.dofMaxBlur * PFX_TUNE.dofStrength;
    pfxBokehPass.uniforms.focus.value = focus;
    pfxBokehPass.uniforms.aperture.value = maxblur / span;
    pfxBokehPass.uniforms.maxblur.value = maxblur;
    pfxBokehPass.uniforms.aspect.value = camera.aspect;
  }

  /* --- ブルーム: windowGlow(夜1.0 / 夕0.4 / 朝昼0.0)で時間帯追従 ---- */
  var bloomStrength = PFX_TUNE.bloomStrengthDay +
    (PFX_TUNE.bloomStrengthNight - PFX_TUNE.bloomStrengthDay) * glow;
  var bloomThreshold = PFX_TUNE.bloomThresholdDay +
    (PFX_TUNE.bloomThresholdNight - PFX_TUNE.bloomThresholdDay) * glow;
  pfxBloomPass.enabled = bloomOn;
  pfxBloomPass.strength = bloomStrength;
  pfxBloomPass.threshold = bloomThreshold;
  pfxBloomPass.radius = PFX_TUNE.bloomRadius;

  /* --- 光芒 --------------------------------------------------------
   * 光芒の中心は js/11-environment.js の sunAnchorDir() が返す向き
   * ―― 太陽円板(SUN_DISK)を置いているのとまったく同じ向き ―― を
   * カメラから十分遠くへ延ばして投影して得る。円板と光条の中心が
   * ずれないことがこの効果の生命線なので、計算は必ず一本化する。
   * 仰角クランプ(SUN_ANCHOR_ELEV_MAX)を残している理由と、厳密投影に
   * 戻せない理由の実測は 11-environment.js 側のコメントにまとめてある。
   * 強度の時間帯連動にはクランプ前の真の仰角を使う。
   *
   * 無効化条件は 2 つ:
   *   (a) カメラ後方 … 前方ベクトルとの内積が小さいところで 0 に落とす
   *   (b) 画面外    … 太陽が枠に触れた時点で厳密に 0。放射ブラー側も
   *                    範囲外タップを 0 寄与にしてあるので、画面端から
   *                    光が尾を引くことは二重に起きない
   * 強度は太陽高度が低いほど強い(朝・夕が最大、昼は rayDayFloor まで)。
   * 天候は CUR_WEATHER.sunMul(晴1.0/曇0.5/雨0.38/雪0.58)をそのまま掛ける。 */
  var rayIntensity = 0, rayTh = 0.5, raySoft = 0.1, occGain = 0;
  PFX_STAT.sunUvX = -1; PFX_STAT.sunUvY = -1; PFX_STAT.sunFacing = 0;
  if (raysOn && typeof CUR_TIME !== 'undefined'){
    // その時間帯の空の最大輝度(6ストップ)。しきい値の基準にする。
    var skyPeak = 0;
    for (var si = 0; si < CUR_TIME.sky.length; si++){
      var sc = CUR_TIME.sky[si];
      var sl = 0.2126 * sc.r + 0.7152 * sc.g + 0.0722 * sc.b;
      if (sl > skyPeak) skyPeak = sl;
    }
    rayTh = Math.min(PFX_TUNE.rayThresholdMax,
      Math.max(PFX_TUNE.rayThresholdMin, skyPeak * PFX_TUNE.rayThresholdK));
    raySoft = Math.max(0.02, skyPeak * PFX_TUNE.raySoftnessK);
    PFX_STAT.rayThreshold = rayTh;
    // クランプ前の真の仰角(強度の時間帯連動に使う)
    var elev = Math.max(-1, Math.min(1,
      CUR_TIME.sunPos.y / Math.max(1e-6, CUR_TIME.sunPos.length())));
    // 太陽円板とまったく同じ向き(方位そのまま・仰角のみ頭打ち)
    sunAnchorDir(_pfxSunDir);
    /* 円板はワールド座標に置かれるが、光芒の中心はここでの投影で決まる。
     * camera.matrixWorld は renderer.render が更新するので、これを呼ばないと
     * 1フレーム前の姿勢で投影してしまい、カメラを回している間だけ光条が
     * 円板から遅れてずれる。1オブジェクト分の行列更新なので安い。 */
    camera.updateMatrixWorld();
    camera.getWorldDirection(_pfxCamFwd);
    var facing = _pfxSunDir.dot(_pfxCamFwd);
    PFX_STAT.sunFacing = facing;
    var facingFade = pfxSmoothstep(0.05, 0.30, facing);
    if (facingFade > 0){
      _pfxSunWorld.copy(camera.position).addScaledVector(_pfxSunDir, 5000);
      _pfxSunWorld.project(camera);
      var sx = _pfxSunWorld.x * 0.5 + 0.5;
      var sy = _pfxSunWorld.y * 0.5 + 0.5;
      PFX_STAT.sunUvX = sx; PFX_STAT.sunUvY = sy;
      var edge = Math.min(Math.min(sx, 1 - sx), Math.min(sy, 1 - sy));
      var edgeFade = pfxSmoothstep(0.0, 0.05, edge);
      /* 仰角ランプ。sunPos の正規化Yの実測は 朝 0.307 / 昼 0.766 /
       * 夕 0.209 / 夜 0.600。0.10〜0.45 のランプで
       *   夕 0.76 → 朝 0.36 → 昼 0 → 夜 0
       * となり、「夕が最も強く、朝がそれに次ぎ、昼夜は floor まで落ちる」
       * という狙いどおりの序列になる(朝は実測で全面が霞んだので、夕より
       * はっきり弱めるのが正解だった)。 */
      var lowSun = 1 - pfxSmoothstep(0.10, 0.45, elev);
      var timeMul = PFX_TUNE.rayDayFloor + (1 - PFX_TUNE.rayDayFloor) * lowSun;
      rayIntensity = PFX_TUNE.rayIntensity * facingFade * edgeFade * timeMul * sunMul;
      if (rayIntensity > 0.001){
        pfxRayPass.matPrepare.uniforms.sunUv.value.set(sx, sy);
        pfxRayPass.matPrepare.uniforms.aspect.value = camera.aspect;
        pfxRayPass.matPrepare.uniforms.threshold.value = rayTh;
        pfxRayPass.matPrepare.uniforms.softness.value = raySoft;
        pfxRayPass.matPrepare.uniforms.radius.value = PFX_TUNE.rayRadius;
        /* 遮蔽由来の種(天使の梯子)のゲート。
         * 太陽円板(js/11-environment.js updateSunDisk)の可視度と **同じ式** を
         * 使う。円板が出ていない状況で「太陽まわりの明るい空」だけを足すと、
         * 存在しない光源から光が出ることになるため:
         *   夜 (sunDisk=0)          -> 0  … 月とは無関係なので出さない
         *   昼 (sunDisk=0)          -> 0  … 地平線の太陽を出していない
         *   曇/雨/雪 (sunMul<=0.58) -> 0  … 円板ごと消えるのに合わせる
         *   朝・夕の晴 (sunDisk=1)  -> 1  … ここだけで出る
         * 画面由来の種に掛ける雲マスクの方は常時ON(雲が光源になるのは
         * どの時間帯でも間違いなので)。 */
        var diskVis = pfxSunDiskVis();
        occGain = PFX_TUNE.rayOccGain * diskVis;
        pfxRayPass.occActive = occGain > 0.001;
        pfxRayPass.matPrepare.uniforms.occMask.value =
          pfxRayPass.occActive ? PFX_TUNE.rayOccScreenMask : 0.0;
        pfxRayPass.matPrepare.uniforms.occCut.value = PFX_TUNE.rayOccCut;
        pfxRayPass.matGen.uniforms.sunUv.value.set(sx, sy);
        pfxRayPass.filterLength = PFX_TUNE.rayFilterLen;
        pfxRayPass.matComposite.uniforms.intensity.value = rayIntensity;
        pfxRayPass.matComposite.uniforms.occIntensity.value = rayIntensity * occGain;
        pfxRayPass.matComposite.uniforms.horizonUv.value = pfxHorizonUv();
        pfxRayPass.matComposite.uniforms.occBias.value = PFX_TUNE.rayOccBias;
        pfxRayPass.matComposite.uniforms.occShadowMax.value = PFX_TUNE.rayOccShadowMax;
        pfxRayPass.matComposite.uniforms.groundFade.value = PFX_TUNE.rayOccGroundFade;
        pfxRayPass.matComposite.uniforms.groundFloor.value = PFX_TUNE.rayOccGroundFloor;
        pfxRayPass.matComposite.uniforms.rayColor.value.copy(CUR_TIME.sunColor);
      }
    }
  }
  // 強度が実質ゼロなら Pass ごと切る(低解像度とはいえ 4 パス分浮く)
  pfxRayPass.enabled = rayIntensity > 0.001;
  PFX_STAT.rayIntensity = rayIntensity;
  PFX_STAT.occGain = occGain;
  PFX_STAT.bloomStrength = bloomOn ? bloomStrength : 0;
  PFX_STAT.focus = dofOn ? pfxBokehPass.uniforms.focus.value : 0;
}

/* --------------------------------------------------------------------
 * 17.6 ラベルのレイヤ退避
 *
 * ラベルは可読性最優先なので、ボケも光りもさせない。labelGroup 配下だけ
 * レイヤ1に移すと、カメラの既定レイヤマスク(レイヤ0のみ)から外れるので
 * RenderPass も BokehPass の深度描画も自動的にラベルを無視する。
 * 効果が全てOFFのときは必ずレイヤ0へ戻す(戻し忘れるとラベルが消える)。
 * ------------------------------------------------------------------ */
var PFX_LABEL_LAYER = 1;
var _pfxLblGroup = null, _pfxLblLifted = false;

function pfxSetLayer(group, layer){
  if (!group) return;
  group.layers.set(layer);
  var kids = group.children;
  for (var i = 0; i < kids.length; i++) kids[i].layers.set(layer);
}
function pfxSyncLabelLayer(active){
  var g = (typeof current !== 'undefined' && current) ? (current.labelGroup || null) : null;
  if (g === _pfxLblGroup && active === _pfxLblLifted) return;
  // 城切替や効果OFFで、前のグループを必ずレイヤ0へ戻してから移す
  if (_pfxLblGroup && (_pfxLblGroup !== g || !active)) pfxSetLayer(_pfxLblGroup, 0);
  if (g && active) pfxSetLayer(g, PFX_LABEL_LAYER);
  _pfxLblGroup = g;
  _pfxLblLifted = active;
}

/* --------------------------------------------------------------------
 * 17.7 唯一の描画エントリポイント
 * ------------------------------------------------------------------ */
var PFX_STAT = { rayIntensity: 0, occGain: 0, bloomStrength: 0, focus: 0, composerFrames: 0, plainFrames: 0,
                 sunUvX: -1, sunUvY: -1, sunFacing: 0, rayThreshold: 0 };

function pfxActive(){
  return PFX_AVAILABLE && (dofOn || bloomOn || raysOn);
}

function renderFrame(){
  var active = pfxActive();
  pfxSyncLabelLayer(active);

  if (!active){
    // 導入前と完全に同じ経路。コンポーザは生成すらされない。
    PFX_STAT.plainFrames++;
    PFX_STAT.rayIntensity = 0; PFX_STAT.bloomStrength = 0; PFX_STAT.focus = 0;
    renderer.render(scene, camera);
    return;
  }

  pfxEnsure();
  pfxUpdate();
  PFX_STAT.composerFrames++;
  pfxComposer.render();

  // ラベルだけを合成後の画面へ素で上描きする。ラベルOFF時は丸ごと省略
  // (= 既定状態ではシーングラフの二重走査コストは発生しない)。
  if (typeof labelsOn !== 'undefined' && labelsOn &&
      typeof current !== 'undefined' && current &&
      current.labelGroup && current.labelGroup.visible){
    // scene.background を外さないと WebGLBackground が全画面クアッドを
    // 描いて合成結果を丸ごと塗り潰す。autoClear も切る(消去しない)。
    var bg = scene.background, ac = renderer.autoClear;
    scene.background = null;
    renderer.autoClear = false;
    camera.layers.set(PFX_LABEL_LAYER);
    renderer.render(scene, camera);
    camera.layers.set(0);
    renderer.autoClear = ac;
    scene.background = bg;
  }
}

/* --------------------------------------------------------------------
 * 17.8 UI 結線(#envPanel の .switch × 3。既存トグルと同じ作り)
 * ------------------------------------------------------------------ */
(function wirePostFxUI(){
  function wire(id, get, set, lsKey){
    var el = document.getElementById(id);
    if (!el) return;
    if (!PFX_AVAILABLE){
      el.checked = false;
      el.disabled = true;
      return;
    }
    el.checked = get();                       // localStorage から復元
    el.addEventListener('change', function(){
      set(this.checked);
      pfxSavePref(lsKey, this.checked ? '1' : '0');
    });
  }
  wire('dofToggle',   function(){ return dofOn; },   function(v){ dofOn = v; },   PFX_LS_DOF);
  wire('bloomToggle', function(){ return bloomOn; }, function(v){ bloomOn = v; }, PFX_LS_BLOOM);
  wire('raysToggle',  function(){ return raysOn; },  function(v){ raysOn = v; },  PFX_LS_RAYS);
  if (!PFX_AVAILABLE){
    console.warn('postfx: vendor の EffectComposer 一式が読めていないため、' +
                 'ポストプロセスは無効化されました(描画は従来経路のまま)。');
  }
})();

/* ====================================================================
 * debug hooks (do not affect production UI)
 * ==================================================================== */
window.__setPostFX = function(o){
  // 例: __setPostFX({dof:true, bloom:false, rays:false})
  o = o || {};
  if (o.dof !== undefined){ dofOn = !!o.dof; var d = document.getElementById('dofToggle'); if (d) d.checked = dofOn; }
  if (o.bloom !== undefined){ bloomOn = !!o.bloom; var b = document.getElementById('bloomToggle'); if (b) b.checked = bloomOn; }
  if (o.rays !== undefined){ raysOn = !!o.rays; var r = document.getElementById('raysToggle'); if (r) r.checked = raysOn; }
  if (o.save){
    pfxSavePref(PFX_LS_DOF, dofOn ? '1' : '0');
    pfxSavePref(PFX_LS_BLOOM, bloomOn ? '1' : '0');
    pfxSavePref(PFX_LS_RAYS, raysOn ? '1' : '0');
  }
  renderFrame();
};
window.__postfxState = function(){
  return {
    available: PFX_AVAILABLE,
    dof: dofOn, bloom: bloomOn, rays: raysOn,
    active: pfxActive(),
    composerBuilt: !!pfxComposer,
    labelsLifted: _pfxLblLifted,
    rayIntensity: Math.round(PFX_STAT.rayIntensity * 1000) / 1000,
    occGain: Math.round(PFX_STAT.occGain * 1000) / 1000,
    occClouds: PFX_OCC.clouds.length,
    sunUv: [Math.round(PFX_STAT.sunUvX * 1000) / 1000, Math.round(PFX_STAT.sunUvY * 1000) / 1000],
    sunFacing: Math.round(PFX_STAT.sunFacing * 1000) / 1000,
    rayThreshold: Math.round(PFX_STAT.rayThreshold * 1000) / 1000,
    bloomStrength: Math.round(PFX_STAT.bloomStrength * 1000) / 1000,
    focus: Math.round(PFX_STAT.focus * 10) / 10,
    composerFrames: PFX_STAT.composerFrames,
    plainFrames: PFX_STAT.plainFrames,
    stored: {
      dof: pfxLoadPref(PFX_LS_DOF, null),
      bloom: pfxLoadPref(PFX_LS_BLOOM, null),
      rays: pfxLoadPref(PFX_LS_RAYS, null)
    }
  };
};
window.__fxTuning = PFX_TUNE;

