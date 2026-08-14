"use strict";

/* ====================================================================
 * 16. 国別BGM (background music per country)
 *
 * 素材は castle-viewer/audio/ に配置済みの5曲(各42秒のシームレスループ)。
 * ファイル名は **レジストリの country と id から機械的に導出** する:
 *
 *     audio/<country.toLowerCase()>-<id>.mp3
 *       England  + bodiam           -> audio/england-bodiam.mp3
 *       France   + vincennes        -> audio/france-vincennes.mp3
 *       Poland   + malbork          -> audio/poland-malbork.mp3
 *       Wales    + beaumaris        -> audio/wales-beaumaris.mp3
 *       Italy    + castel-del-monte -> audio/italy-castel-del-monte.mp3
 *
 * 城ファイル(castles/*.js)には音声設定を一切書き足さない。城を追加する
 * ときも、上記命名で mp3 を置くだけで自動的に鳴る。mp3 が存在しない城は
 * 単に無音になる(error を握りつぶすだけで、他機能には影響しない)。
 *
 * 再生は `<audio>` 要素を2つだけ作って **使い回す**(city切替のたびに
 * 生成/破棄しない)。片方が鳴っている間にもう片方へ次の曲を載せ、gain を
 * 交差させてクロスフェードし、フェードが終わった側を pause する。
 * WebAudio(AudioContext + decodeAudioData)を使わないのは、decode に
 * fetch/XHR が要り file:// では CORS で弾かれるため。`<audio>` 要素の
 * src 直読みは file:// でも通ることを実測確認済み。
 * ==================================================================== */

var AUD_FADE_XFADE = 1.2;   // 城切替のクロスフェード秒数
var AUD_FADE_TOGGLE = 0.35; // トグルON/OFFのフェード秒数
var AUD_LS_ON = 'castleViewer.bgm.on';
var AUD_LS_VOL = 'castleViewer.bgm.volume';

/* localStorage はプライベートモード等で例外を投げうるので必ず包む。
 * 失敗しても BGM 機能そのものは既定値で動き続ける。 */
function audLoadPref(key, fallback){
  try {
    var v = window.localStorage.getItem(key);
    return v === null ? fallback : v;
  } catch (e){ return fallback; }
}
function audSavePref(key, value){
  try { window.localStorage.setItem(key, String(value)); } catch (e){}
}

// 既定は OFF(ページを開いた瞬間に音を鳴らさない)、既定音量 0.5。
var audioOn = audLoadPref(AUD_LS_ON, '0') === '1';
var audioVolume = (function(){
  var v = parseFloat(audLoadPref(AUD_LS_VOL, '0.5'));
  return (isFinite(v) && v >= 0 && v <= 1) ? v : 0.5;
})();

/* 使い回す2枚のデッキ。DOM には挿さない(再生には不要)。 */
function audMakeDeck(){
  var el = new Audio();
  el.loop = true;      // 素材は継ぎ目処理済みなので loop 属性で十分
  el.preload = 'auto';
  el.volume = 0;
  // 読み込み失敗(mp3 が無い等)は握りつぶす。未処理エラーを出さない。
  el.addEventListener('error', function(){ AUD_lastError = 'media'; });
  return el;
}
var AUD_decks = [audMakeDeck(), audMakeDeck()];
var AUD_gains = [0, 0];     // 実効フェード係数 0..1
var AUD_targets = [0, 0];   // フェード目標
var AUD_rate = 1 / AUD_FADE_XFADE;
var AUD_cur = 0;            // いま「主」であるデッキの index
var AUD_curUrl = null;      // 主デッキに載っているべき URL
var AUD_curDef = null;      // 直近に指定された城のレジストリ entry
var AUD_lastError = null;   // 診断用(play 拒否 / メディアエラー)
var AUD_pendingGesture = false;

/* レジストリ entry から音源 URL を導出する。country が無い場合は id だけを
 * 使ったファイル名にフォールバックする。 */
function audioUrlFor(def){
  if (!def || !def.id) return null;
  var country = def.country ? String(def.country).toLowerCase().replace(/\s+/g, '-') : '';
  var base = country ? (country + '-' + def.id) : def.id;
  return 'audio/' + encodeURIComponent(base) + '.mp3';
}

/* gain(フェード係数) * ユーザー音量 を実際の element.volume へ落とす。 */
function audApplyVolumes(){
  for (var i = 0; i < 2; i++){
    var v = AUD_gains[i] * audioVolume;
    AUD_decks[i].volume = v < 0 ? 0 : (v > 1 ? 1 : v);
  }
}

/* play() は autoplay policy で拒否されうる。必ず catch して未処理の
 * Promise 拒否をコンソールへ出さない(要件4)。 */
function audSafePlay(el){
  var p;
  try { p = el.play(); } catch (e){ AUD_lastError = 'play-throw:' + e.name; return; }
  if (p && typeof p.catch === 'function'){
    p.then(function(){
      AUD_lastError = null;
    }, function(e){
      AUD_lastError = 'play-rejected:' + (e && e.name ? e.name : 'unknown');
      // ユーザー操作前で弾かれた場合に備え、次の操作で一度だけ再試行する。
      audArmGestureRetry();
    });
  }
}

/* autoplay 拒否時のリカバリ: 次のユーザー操作で一度だけ再生し直す。
 * (localStorage から ON を復元したときのように、ページ読み込み直後は
 *  ジェスチャが無く play() が必ず弾かれるケースを救う) */
function audArmGestureRetry(){
  if (AUD_pendingGesture) return;
  AUD_pendingGesture = true;
  var retry = function(){
    window.removeEventListener('pointerdown', retry, true);
    window.removeEventListener('keydown', retry, true);
    AUD_pendingGesture = false;
    if (audioOn && AUD_curUrl){
      var el = AUD_decks[AUD_cur];
      if (el.paused) audSafePlay(el);
    }
  };
  window.addEventListener('pointerdown', retry, true);
  window.addEventListener('keydown', retry, true);
}

/* デッキへ url を載せる。src が変わらないときは読み直さない(要件6: 城切替の
 * たびに音声リソースを作り直さない)。
 *   restart=true  … 城切替。曲が変わるので頭から鳴らす。
 *   restart=false … トグルON。同じ曲なら再生位置を維持して「再開」する
 *                   (0 に戻すと OFF→ON でブツッと頭出しされてしまう)。 */
function audLoadInto(el, url, restart){
  // el.src は絶対 URL に解決されて返るので、比較も絶対 URL で行う。
  var want = new URL(url, location.href).href;
  var changed = (el.src !== want);
  if (changed) el.src = want;
  if (changed || restart){
    try { el.currentTime = 0; } catch (e){}
  }
}

/* --------------------------------------------------------------------
 * 城切替のエントリポイント。90-main.js の applyCastle から呼ぶ。
 * 同じ城なら何もしない。BGM が OFF のときは URL を覚えるだけで鳴らさない。
 * ------------------------------------------------------------------ */
function setCastleAudio(def){
  AUD_curDef = def;
  var url = audioUrlFor(def);
  if (url === AUD_curUrl && !AUD_decks[AUD_cur].paused) return;
  AUD_curUrl = url;
  if (!url){ stopAudio(); return; }

  if (!audioOn){
    // OFF のあいだは読み込みすらしない(次に ON された時点で載せる)。
    return;
  }

  var other = 1 - AUD_cur;
  var oldPlaying = !AUD_decks[AUD_cur].paused && AUD_gains[AUD_cur] > 0;

  audLoadInto(AUD_decks[other], url, true);
  AUD_gains[other] = 0;
  audApplyVolumes();
  audSafePlay(AUD_decks[other]);

  AUD_targets[other] = 1;
  AUD_targets[AUD_cur] = 0;
  // 初回(前の曲が鳴っていない)は短いフェードイン、切替時はクロスフェード。
  AUD_rate = 1 / (oldPlaying ? AUD_FADE_XFADE : AUD_FADE_TOGGLE);
  AUD_cur = other;
}

/* BGM を鳴らし始める(トグル ON)。 */
function startAudio(){
  if (!AUD_curUrl && AUD_curDef) AUD_curUrl = audioUrlFor(AUD_curDef);
  if (!AUD_curUrl) return;
  var el = AUD_decks[AUD_cur];
  audLoadInto(el, AUD_curUrl, false);
  audApplyVolumes();
  audSafePlay(el);
  AUD_targets[AUD_cur] = 1;
  AUD_targets[1 - AUD_cur] = 0;
  AUD_rate = 1 / AUD_FADE_TOGGLE;
}

/* BGM を止める(トグル OFF)。フェードアウトしきった時点で pause する。 */
function stopAudio(){
  AUD_targets[0] = 0; AUD_targets[1] = 0;
  AUD_rate = 1 / AUD_FADE_TOGGLE;
}

/* --------------------------------------------------------------------
 * フレームループから毎フレーム呼ぶ。gain を目標へ寄せ、0 に達して目標も
 * 0 のデッキは pause する(鳴らないまま再生し続けない)。
 * ------------------------------------------------------------------ */
function updateAudio(dt){
  var changed = false;
  for (var i = 0; i < 2; i++){
    var g = AUD_gains[i], t = AUD_targets[i];
    if (g !== t){
      var step = AUD_rate * dt;
      if (g < t) g = Math.min(t, g + step);
      else g = Math.max(t, g - step);
      AUD_gains[i] = g;
      changed = true;
    }
    if (AUD_gains[i] <= 0 && AUD_targets[i] <= 0 && !AUD_decks[i].paused){
      AUD_decks[i].pause();
    }
  }
  if (changed) audApplyVolumes();
}

/* --------------------------------------------------------------------
 * UI 結線(#bgmToggle / #bgmVolume)。他のトグル(ラベル/住人)と同じ形。
 * ------------------------------------------------------------------ */
(function wireAudioUI(){
  var toggle = document.getElementById('bgmToggle');
  var slider = document.getElementById('bgmVolume');
  if (toggle){
    toggle.checked = audioOn;                 // localStorage から復元
    toggle.addEventListener('change', function(){
      audioOn = this.checked;
      audSavePref(AUD_LS_ON, audioOn ? '1' : '0');
      if (audioOn) startAudio(); else stopAudio();
    });
  }
  if (slider){
    slider.value = String(audioVolume);       // localStorage から復元
    slider.addEventListener('input', function(){
      var v = parseFloat(this.value);
      if (!isFinite(v)) return;
      audioVolume = Math.max(0, Math.min(1, v));
      audSavePref(AUD_LS_VOL, audioVolume);
      audApplyVolumes();
    });
  }
})();

/* ====================================================================
 * debug hooks (do not affect production UI)
 * ==================================================================== */
window.__audioState = function(){
  return {
    audioOn: audioOn,
    volume: audioVolume,
    curDeck: AUD_cur,
    curUrl: AUD_curUrl,
    gains: [AUD_gains[0], AUD_gains[1]],
    targets: [AUD_targets[0], AUD_targets[1]],
    lastError: AUD_lastError,
    decks: AUD_decks.map(function(el){
      return {
        paused: el.paused, volume: el.volume, currentTime: el.currentTime,
        duration: el.duration, readyState: el.readyState,
        currentSrc: el.currentSrc,
        file: el.currentSrc ? el.currentSrc.split('/').pop() : null,
        error: el.error ? el.error.code : null
      };
    }),
    ui: {
      toggleChecked: document.getElementById('bgmToggle') ?
        document.getElementById('bgmToggle').checked : null,
      sliderValue: document.getElementById('bgmVolume') ?
        document.getElementById('bgmVolume').value : null
    }
  };
};
window.__setAudio = function(on){
  // testing helper: トグルを実クリックせずに BGM を ON/OFF し、UI も同期する。
  audioOn = !!on;
  var t = document.getElementById('bgmToggle');
  if (t) t.checked = audioOn;
  audSavePref(AUD_LS_ON, audioOn ? '1' : '0');
  if (audioOn) startAudio(); else stopAudio();
};
window.__setAudioVolume = function(v){
  // testing helper: スライダーを動かさずに音量を設定し、UI も同期する。
  audioVolume = Math.max(0, Math.min(1, parseFloat(v)));
  var s = document.getElementById('bgmVolume');
  if (s) s.value = String(audioVolume);
  audSavePref(AUD_LS_VOL, audioVolume);
  audApplyVolumes();
};
window.__audioUrlFor = audioUrlFor;
