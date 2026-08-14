# 中世城3Dビューア 引継ぎメモ(2026-08-14 更新)

## プロジェクト概要
- 成果物: `C:\Dev\Claude\HTMLTown\castle-viewer\` — **ビルド不要・ローカルサーバ不要**(`index.html` をダブルクリックで動作)。Three.js r128 UMD を cdnjs から読込
- 内容: 中世城の3Dビューア。カットアウェイ(ズームで壁フェード→内観)、時間帯×天候、遠景山並み、日英ツールチップ、ラベル常時表示、カメラパン、住人シミュレーション
- Git 管理: このフォルダがリポジトリ。親フォルダの既存 HTML とは無関係

## ファイル構成(2026-08-14 に単一HTMLから分割)
```
index.html            HTML/CSS/UI と <script> 読み込み順のみ
js/00-core.js         共有プリミティブ(mkBox/place/registerPick/buildLabelGroup 等)
js/01-moat.js         堀・水面・土手(buildWaterMoatSystem/ringPerimPoint 'square'|'circle'|'rect')
js/10-scene.js        renderer/scene/camera/lights/山並みリング
js/11-environment.js  時間帯・天候・空・パーティクル
js/12-camera.js       orbit/pan/zoom/reveal/updateFade/リビールUI
js/13-pick.js         レイキャスト・ツールチップ・ラベル表示
js/14-residents.js    住人システム
js/20-registry.js     var CASTLES = []; registerCastle(def)
castles/*.js          城ごとに1ファイル。末尾で自己登録  ← 並行編集の単位
js/90-main.js         applyCastle/UI配線/メインループ/デバッグヘルパー(最後に読む)
```

### 重要な制約
- **ES モジュール禁止**。`type="module"` は file:// で CORS ブロックされる(ヘッドレスChromeで実測確認済み)。クラシックスクリプトのみ
- 全ファイルが**同一グローバルスコープを共有**する(IIFEで包まない)。トップレベルの関数・変数名は他ファイルと重複させないこと
- **城を追加する手順**: `castles/<id>.js` を新規作成し、`index.html` の `<script>` 行を1行追加するだけ。他ファイルの編集は不要

## 収録城(6件)
| id | 名称 | 国 | 年 | 備考 |
|---|---|---|---|---|
| bodiam | ボディアム城 | イングランド | 1385 | 水堀の方形城・双塔ゲートハウス |
| vincennes | ヴァンセンヌ城 | フランス | 1380 | 実物準拠改修済み。角塔9基・52mドンジョン・シェミーズ |
| malbork | マルボルク城 | ポーランド | 1406 | **写真ベース版**。三郭を140x288mに圧縮 |
| malbork-plan | マルボルク城(実測版) | ポーランド | 1406 | **実測ベース版**。南北508m。グダニスコ+5連アーチ架橋あり |
| beaumaris | ボーマリス城 | ウェールズ | 1295 | 完全同心円式・未完成の切り詰められた塔 |
| castel-del-monte | カステル・デル・モンテ | イタリア | 1240 | 正八角形+八角形塔8基。堀なし |

※ malbork と malbork-plan は**意図的に両方残している**(写真ベース vs 実測ベースの比較用)

## 主要システム
- `CASTLES[].view` = {targetY, zMin, zMax, initDist, fogNear, fogFar, shadowExtent, shadowFar, camFar, panLimit, envScale, envLift}
- カメラパン: 右ドラッグ/Shift+左ドラッグ/2本指。上下方向はユーザー要望により**反転済み**
- ラベル: 外観=トグルONで常時、内観=リビール>0.28。**カメラ距離比例で画面上約24px一定に再スケール**
- 住人: build() 戻り値 `life` = { gates(通路中心線ウェイポイント), courtyard(矩形配列), patrol, population }。門の実開口を通って出入り。夜は農民1/3
- デバッグヘルパー: `__applyCastle/__setPan/__panBy/__setZoom(0..1)/__setOrbit/__setEnv/__setLabels/__setResidents/__stepResidents/__pickAt/__findPickScreen/__debugState/__scene/__camera/__MOUNTAIN_RINGS`

## 検証手法(確立済み)
- **file:// 実測**: `& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --no-sandbox --user-data-dir=<tmp> --virtual-time-budget=10000 --dump-dom "file:///.../index.html"` で `<option>` 数とローディング解除を確認
- ブラウザペインが非表示でスクリーンショットが撮れない場合: `javascript_exec` で `canvas.toDataURL('image/jpeg',0.7)` を取得しファイル化して Read
- 全城回帰: 6城 x 時間帯4 x 天候4 x 住人ON/OFF x ズーム3段 + `window.onerror` 収集

## 寸法資料の所在
- マルボルク実測仕様書: scratchpad の `malbork_spec.md`(座標系・実測値・確信度・出典略号つき)
- 有用な情報源: **medievalheritage.eu**(マルボルク・ボーマリスとも高精度)、各国文化財機関、伊/波語版Wikipedia
- **UNESCO推薦書類は期待薄**: 多くの物件はICOMOS評価書のみで推薦書PDF自体が存在しない。whc.unesco.org は自動取得を403拒否、PDFもダウンロード強制

## 検討事項(未実施・提案のみ)
- **テクスチャ表現**(手続き的レンガ/瓦、窓トレサリー) — 「正確な箱の模型」の次の段階。実施すると全城の作り直し級
- `img2threejs` スキルによる参照画像との反復ループ — トークン消費が大きいため保留中
- 姫路城 — 差別化度は最高だが曲線屋根が箱モデルと不相性。テクスチャ段階での第一候補
- クロンボー城 — UNESCO推薦書PDF(29MB)が実在する数少ない例。緑青の銅屋根で差別化可

## 出典
- https://medievalheritage.eu/ (Vincennes / Malbork / Beaumaris)
- https://en.wikipedia.org/wiki/Malbork_Castle / https://pl.wikipedia.org/wiki/Zamek_w_Malborku
- https://it.wikipedia.org/wiki/Castel_del_Monte
