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
  rayDayFloor: 0.12    // 太陽が高い(昼)ときに残す割合
  // ※ 仰角クランプは js/11-environment.js の SUN_ANCHOR_ELEV_MAX に移した。
  //   太陽円板と光芒の中心が必ず一致していないと嘘に見えるため、
  //   両者が同じ sunAnchorDir() を呼ぶ形に一本化してある。
};

/* --------------------------------------------------------------------
 * 17.3 光芒パス(自作)
 *
 * 既存 vendor に god rays が無いので放射ブラー方式で自作する。
 *   (1) 明部抽出: 輝度しきい値 × 太陽スクリーン位置からの距離フォールオフ
 *   (2) 放射ブラー: 太陽方向へ 6 タップ × 3 パス(ステップ長 1/6, 1/36,
 *       1/216 で粗→細)。ping-pong で低解像度バッファ2枚のみ使う
 *   (3) 加算合成: 元画像 + 光芒 × 太陽色 × 強度(ここだけ等倍)
 * (1)(2) は rayScale(既定 0.25)倍の低解像度で回すので、フルスクリーン
 * パス換算では実質 4×0.0625 + 1 ≒ 1.25 パス分の塗りつぶし負荷。
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

      // (1) 明部抽出 + 太陽からの距離フォールオフ
      this.matPrepare = new T.ShaderMaterial({
        uniforms: {
          tDiffuse:  { value: null },
          sunUv:     { value: new T.Vector2(0.5, 0.5) },
          aspect:    { value: 1.0 },
          threshold: { value: 0.5 },
          softness:  { value: 0.1 },
          radius:    { value: PFX_TUNE.rayRadius }
        },
        vertexShader: PFX_RAY_VERT,
        fragmentShader: [
          'uniform sampler2D tDiffuse;',
          'uniform vec2 sunUv;',
          'uniform float aspect;',
          'uniform float threshold;',
          'uniform float softness;',
          'uniform float radius;',
          'varying vec2 vUv;',
          'void main(){',
          '  vec3 c = texture2D(tDiffuse, vUv).rgb;',
          '  float lum = dot(c, vec3(0.2126, 0.7152, 0.0722));',
          '  float bright = smoothstep(threshold, threshold + softness, lum);',
          '  vec2 d = (vUv - sunUv) * vec2(aspect, 1.0);',
          '  float fall = 1.0 - smoothstep(0.0, radius, length(d));',
          '  gl_FragColor = vec4(c * (bright * fall), 1.0);',
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
          '  vec3 acc = vec3(0.0);',
          '  float w = 1.0;',
          '  float wsum = 0.0;',
          '  for (int i = 0; i < 6; i++){',
          // バッファ外は 0 寄与。CLAMP_TO_EDGE の端画素が尾を引いて
          // 画面端から光が伸びる不具合を防ぐ。
          '    float inside = step(0.0, uv.x) * step(uv.x, 1.0) *',
          '                   step(0.0, uv.y) * step(uv.y, 1.0);',
          '    acc += texture2D(tInput, clamp(uv, 0.0, 1.0)).rgb * (w * inside);',
          '    wsum += w;',
          '    w *= 0.86;',
          '    uv += stepv;',
          '  }',
          '  gl_FragColor = vec4(acc / max(wsum, 1e-4), 1.0);',
          '}'
        ].join('\n'),
        depthTest: false, depthWrite: false
      });

      // (3) 加算合成
      this.matComposite = new T.ShaderMaterial({
        uniforms: {
          tDiffuse:  { value: null },
          tRays:     { value: null },
          rayColor:  { value: new T.Color(1, 1, 1) },
          intensity: { value: 0.0 }
        },
        vertexShader: PFX_RAY_VERT,
        fragmentShader: [
          'uniform sampler2D tDiffuse;',
          'uniform sampler2D tRays;',
          'uniform vec3 rayColor;',
          'uniform float intensity;',
          'varying vec2 vUv;',
          'void main(){',
          '  vec3 base = texture2D(tDiffuse, vUv).rgb;',
          '  vec3 rays = texture2D(tRays, vUv).rgb;',
          '  gl_FragColor = vec4(base + rays * rayColor * intensity, 1.0);',
          '}'
        ].join('\n'),
        depthTest: false, depthWrite: false
      });

      this.fsQuad = new T.FullScreenQuad(null);
    }

    setSize(width, height){
      var w = Math.max(4, Math.round(width * this.scale));
      var h = Math.max(4, Math.round(height * this.scale));
      this.rtA.setSize(w, h);
      this.rtB.setSize(w, h);
    }

    dispose(){
      this.rtA.dispose(); this.rtB.dispose();
      this.matPrepare.dispose(); this.matGen.dispose(); this.matComposite.dispose();
      this.fsQuad.dispose();
    }

    render(renderer, writeBuffer, readBuffer){
      // (1)
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
  var rayIntensity = 0, rayTh = 0.5, raySoft = 0.1;
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
        pfxRayPass.matGen.uniforms.sunUv.value.set(sx, sy);
        pfxRayPass.filterLength = PFX_TUNE.rayFilterLen;
        pfxRayPass.matComposite.uniforms.intensity.value = rayIntensity;
        pfxRayPass.matComposite.uniforms.rayColor.value.copy(CUR_TIME.sunColor);
      }
    }
  }
  // 強度が実質ゼロなら Pass ごと切る(低解像度とはいえ 4 パス分浮く)
  pfxRayPass.enabled = rayIntensity > 0.001;
  PFX_STAT.rayIntensity = rayIntensity;
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
var PFX_STAT = { rayIntensity: 0, bloomStrength: 0, focus: 0, composerFrames: 0, plainFrames: 0,
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
