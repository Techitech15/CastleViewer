# 引継ぎ: ラベル連動イメージ動画の生成

作成日: 2026-08-14 / 作成元: 中世城3Dビューア開発セッション

## 0. あなたに依頼したいこと

中世城3Dビューアの**ラベルにマウスを乗せたときに再生される短いイメージ動画**を生成してほしい。
ビューア側の再生機構は別途実装する。あなたの担当は**動画素材の生成と配置**、および
`media/manifest.json` の記入。

**まず §5 の「必ず先に検証すること」を実施してから制作に入ること。** ここが崩れると
成果物が丸ごと使えなくなる。

---

## 1. 対象プロジェクト

- 場所: `C:\Dev\Claude\HTMLTown\castle-viewer\`
- 中身: Three.js r128(cdnjs から読込)で描く中世城の3Dビューア。**ビルド不要**
- **重要な性質: `index.html` をダブルクリックするだけで動く(`file://` で動作する)**
  - ES モジュールは `file://` で CORS ブロックされるため使っていない
  - `fetch` / `XHR` も `file://` では使えない
  - この「サーバー不要」という性質は**絶対に壊さないこと**
- 収録: 5城(ボディアム城 / ヴァンセンヌ城 / マルボルク城 / ボーマリス城 / カステル・デル・モンテ)
- ラベル総数: **77 件**(うち優先度A = **16 件**)

### 動作確認の方法(URLパラメータで状態を再現できる)

```
& "C:\Program Files\Google\Chrome\Application\chrome.exe" --headless=new --disable-gpu --no-sandbox --use-gl=swiftshader --user-data-dir="<自分専用の一時ディレクトリ>" --window-size=1200,800 --virtual-time-budget=13000 --screenshot="<出力.png>" "file:///C:/Dev/Claude/HTMLTown/castle-viewer/index.html?castle=malbork&labels=1&zoom=0.9"
```

パラメータ: `castle`(bodiam | vincennes | malbork | beaumaris | castel-del-monte) / `time`(morning|day|dusk|night) /
`weather`(clear|cloudy|rain|snow) / `az`,`el`(ラジアン) / `zoom`(**0=遠い 〜 1=近い**) /
`panx`,`panz`(メートル) / `labels=1` / `residents=1`

---

## 2. 何の動画を作るのか

各ラベルは「城のその場所・その部屋」を指している。マウスを乗せると解説が出る。
そこに**その場所の情景を想起させる数秒のループ動画**を添えたい。

- 目的は**史実の記録映像ではなく、雰囲気を伝えるイメージ映像**
- 3Dビューアのローポリ表現とは別物でよい。むしろ質感のある絵で補完したい
- 例: 「大食堂」なら、蝋燭に照らされた石造の広間、柱から扇状に広がるヴォールト、
  長卓に座る修道騎士たち、といった情景

### スタイルの統一(重要)

5城ぶん作ると**バラバラな絵が混ざるのが最大の失敗**になる。以下を全クリップ共通の
制約として守ること。

- 時代: 13〜15世紀のヨーロッパ
- 光: 自然光か火(蝋燭・松明・炉)のみ。**近代的な照明・電気は禁止**
- カメラ: ゆっくりした横移動かごく僅かなズーム。**手持ち風の揺れ・急なカット割りは禁止**
- 人物: 顔がはっきり分かるクローズアップは避ける(生成の破綻が目立つため)
- 文字: 画面内に文字を入れない(多言語対応の妨げになる)
- **実在の人物・現代の商標・現代の建築物を映さない**

---

## 3. 技術仕様(ビューア側の再生機構と合わせること)

| 項目 | 指定 |
|---|---|
| コンテナ / コーデック | MP4 / **H.264 (baseline or main)** + yuv420p |
| 音声 | **なし**(無音トラックも入れない。ミュート自動再生の確実性のため) |
| 解像度 | **640 x 360**(16:9)。ツールチップ内の小窓で再生するため大きくしない |
| 尺 | **5〜8秒** |
| フレームレート | 24 または 30 fps |
| ループ | **始端と終端がつながること**(`loop` 属性で再生するため) |
| 1本あたりの容量 | **400KB 以下**(厳守) |
| ポスター画像 | 同名の `.jpg`(640x360、80KB以下)。動画読込前に表示する |
| 総容量 | 優先度A(16本)で **10MB 以下**に収めること |

容量が厳しい場合は、尺を詰める→解像度を下げる→ビットレートを下げる、の順で調整する。
**画質より容量を優先**すること(ツールチップ内の小窓なので粗さは目立たない)。

---

## 4. 配置と manifest

```
castle-viewer/
  media/
    manifest.json
    bodiam/
      great-hall.mp4
      great-hall.jpg
      ...
    vincennes/ ...
    malbork/ ...
    beaumaris/ ...
    castel-del-monte/ ...
```

`manifest.json` の形式(キーは `<城id>::<ラベル名>`。**ラベル名はコード内の文字列と
1文字も違わないこと**。§6 の一覧からコピーすること):

```json
{
  "version": 1,
  "clips": {
    "malbork::大食堂 Great Refectory": {
      "src": "media/malbork/great-refectory.mp4",
      "poster": "media/malbork/great-refectory.jpg",
      "seconds": 6
    }
  }
}
```

- **すべてのラベルに動画を作る必要はない。** 優先度A から着手し、余力があれば B へ広げる
- manifest に無いラベルは、従来どおりテキストのツールチップだけが出る(壊れない設計)

---

## 5. 必ず先に検証すること(未確認の前提)

> **2026-08-15: 検証済み。結果と採用した配信方式は §10 に書いた。**
> ビューア側の再生機構を実装するなら §10 だけ読めばよい。

`file://` で開いたページから `<video src="media/...">` が**実際に再生できるか**は
このセッションでは未検証。**ここが最初の関門**なので、制作前に必ず確かめること。

1. ダミーの小さな mp4 を1本用意する
2. `castle-viewer/` 直下に検証用の最小 HTML を置き、`file://` で開いて再生されるか
   ヘッドレス Chrome で確認する(`--dump-dom` で `video.readyState` を出力させる等)
3. **再生できない場合の代替案**(この順で検討):
   - アニメーション WebP / APNG を `<img>` で表示する
   - 動画を base64 の data URI としてJSに埋め込む(容量が跳ね上がるので短く小さく)
   - 数枚の静止画を JS で切り替える簡易アニメーション
4. 採用した方式を manifest の仕様ごとこのファイルに追記して、ビューア側実装へ引き継ぐこと

また **`fetch` は `file://` で使えない**ため、manifest.json は
`<script src="media/manifest.js">` のような**クラシックスクリプトで読み込む形**に
変更が必要になる可能性が高い。その場合は
`window.CASTLE_CLIPS = { ... }` を代入する .js ファイルとして出力すること。

---

## 6. ラベル一覧(生成対象の完全なリスト)

優先度 **A** = その城を代表する空間。まずここから作る。
「ラベル名」は manifest のキーに使う文字列そのもの。**日本語と英語の間の空白も含めて完全一致**させること。

### ボディアム城(イングランド, 1385) — `bodiam` / ラベル 12 件

| 優先 | 種別 | ラベル名(ツールチップのタイトル) | 想定クリップ名 |
|---|---|---|---|
| B | 外観 | 北西塔 Northwest Tower | `bodiam/northwest-tower.mp4` |
| B | 外観 | 北東塔 Northeast Tower | `bodiam/northeast-tower.mp4` |
| B | 外観 | 南東塔 Southeast Tower | `bodiam/southeast-tower.mp4` |
| B | 外観 | 南西塔 Southwest Tower | `bodiam/southwest-tower.mp4` |
| B | 外観 | ポスタン塔 Postern Tower | `bodiam/postern-tower.mp4` |
| B | 外観 | 中間塔 Mid-wall Tower | `bodiam/mid-wall-tower.mp4` |
| **A** | 外観 | ゲートハウス Gatehouse | `bodiam/gatehouse.mp4` |
| **A** | 内観 | 大広間 Great Hall | `bodiam/great-hall.mp4` |
| B | 内観 | 井戸 Well | `bodiam/well.mp4` |
| B | 内観 | 菜園 Kitchen Garden | `bodiam/kitchen-garden.mp4` |
| B | 内観 | 薬草園 Herb Garden | `bodiam/herb-garden.mp4` |
| **A** | 外観 | 八角プラットフォーム The Octagon | `bodiam/the-octagon.mp4` |

### ヴァンセンヌ城(フランス, 1380) — `vincennes` / ラベル 15 件

| 優先 | 種別 | ラベル名(ツールチップのタイトル) | 想定クリップ名 |
|---|---|---|---|
| B | 外観 | 北城壁 North Curtain Wall | `vincennes/north-curtain-wall.mp4` |
| B | 外観 | 南城壁 South Curtain Wall | `vincennes/south-curtain-wall.mp4` |
| B | 外観 | 東城壁 East Curtain Wall | `vincennes/east-curtain-wall.mp4` |
| B | 外観 | 西城壁 West Curtain Wall | `vincennes/west-curtain-wall.mp4` |
| B | 外観 | 螺旋階段塔 Spiral Staircase Tower | `vincennes/spiral-staircase-tower.mp4` |
| B | 外観 | ドンジョン Donjon (大塔) | `vincennes/donjon.mp4` |
| B | 内観 | シェミーズ Chemise Wall | `vincennes/chemise-wall.mp4` |
| B | 外観 | ドンジョンの堀 Donjon Moat | `vincennes/donjon-moat.mp4` |
| **A** | 内観 | 身廊 Nave | `vincennes/nave.mp4` |
| B | 内観 | 内陣 Choir & High Altar | `vincennes/choir-high-altar.mp4` |
| **A** | 外観 | サント・シャペル Sainte-Chapelle | `vincennes/sainte-chapelle.mp4` |
| B | 外観 | 水堀 Moat | `vincennes/moat.mp4` |
| B | 外観 | 王の庭園 Jardin du Roi | `vincennes/jardin-du-roi.mp4` |
| B | 外観 | 菜園 Potager | `vincennes/potager.mp4` |
| B | 外観 | 果樹園 Verger | `vincennes/verger.mp4` |

### マルボルク城(ポーランド, 1406) — `malbork` / ラベル 26 件

| 優先 | 種別 | ラベル名(ツールチップのタイトル) | 想定クリップ名 |
|---|---|---|---|
| B | 内観 | outer | `malbork/outer.mp4` |
| B | 外観 | 高城 High Castle | `malbork/high-castle.mp4` |
| B | 外観 | 主塔 Main Tower | `malbork/main-tower.mp4` |
| **A** | 外観 | 教会後陣+聖母像 Church Apse & Virgin Mary | `malbork/church-apse-virgin-mary.mp4` |
| **A** | 外観 | グダニスコ(便所塔) Gdanisko / Dansker | `malbork/gdanisko-dansker.mp4` |
| B | 外観 | 尖頭アーチ橋 Pointed-Arch Bridge | `malbork/pointed-arch-bridge.mp4` |
| **A** | 外観 | 中庭回廊 Cloister Arcade | `malbork/cloister-arcade.mp4` |
| **A** | 外観 | 中庭の井戸 Courtyard Well | `malbork/courtyard-well.mp4` |
| B | 外観 | 高城⇔中城の乾堀 Dry Ditch | `malbork/dry-ditch.mp4` |
| B | 外観 | 中城 Middle Castle | `malbork/middle-castle.mp4` |
| B | 外観 | 大団長宮殿 Grand Master’s Palace | `malbork/grand-master-s-palace.mp4` |
| **A** | 外観 | 大食堂 Great Refectory | `malbork/great-refectory.mp4` |
| B | 外観 | 施療院 Infirmary | `malbork/infirmary.mp4` |
| B | 外観 | 中城門 Middle Castle Gate | `malbork/middle-castle-gate.mp4` |
| B | 外観 | 東翼(賓客居室) East Wing | `malbork/east-wing.mp4` |
| B | 外観 | 中城外周の堀 Middle Castle Outer Moat | `malbork/middle-castle-outer-moat.mp4` |
| B | 外観 | 低城 Low Castle | `malbork/low-castle.mp4` |
| B | 外観 | 東門 East Gate | `malbork/east-gate.mp4` |
| B | 外観 | マシュランコヴァ塔 Maszynkowa Tower | `malbork/maszynkowa-tower.mp4` |
| B | 外観 | カルワン Karwan | `malbork/karwan.mp4` |
| B | 外観 | 聖ラウレンティウス礼拝堂 St Lawrence Chapel | `malbork/st-lawrence-chapel.mp4` |
| B | 外観 | ノガト川 Nogat River | `malbork/nogat-river.mp4` |
| **A** | 内観 | 中庭の菜園 Courtyard Herb Garden | `malbork/courtyard-herb-garden.mp4` |
| B | 内観 | 中城の菜園 Kitchen Garden | `malbork/kitchen-garden.mp4` |
| B | 外観 | 低城の井戸 Vorburg Well | `malbork/vorburg-well.mp4` |
| B | 内観 | 低城の菜園 Vorburg Garden | `malbork/vorburg-garden.mp4` |

### ボーマリス城(ウェールズ, 1295) — `beaumaris` / ラベル 18 件

| 優先 | 種別 | ラベル名(ツールチップのタイトル) | 想定クリップ名 |
|---|---|---|---|
| B | 外観 | 外郭壁 Outer Curtain Wall | `beaumaris/outer-curtain-wall.mp4` |
| B | 外観 | 外郭門(未完成) Llanfaes Gate (unfinished) | `beaumaris/llanfaes-gate-unfinished.mp4` |
| B | 外観 | 外郭小塔 Outer Ward Turret | `beaumaris/outer-ward-turret.mp4` |
| B | 外観 | 内郭北壁 Inner Ward North Wall | `beaumaris/inner-ward-north-wall.mp4` |
| B | 外観 | 内郭南壁 Inner Ward South Wall | `beaumaris/inner-ward-south-wall.mp4` |
| B | 外観 | 内郭東壁 Inner Ward East Wall | `beaumaris/inner-ward-east-wall.mp4` |
| B | 外観 | 内郭西壁 Inner Ward West Wall | `beaumaris/inner-ward-west-wall.mp4` |
| B | 外観 | 北西塔 Northwest Tower | `beaumaris/northwest-tower.mp4` |
| **A** | 外観 | 中間塔(礼拝堂塔) East Mid Tower / Chapel Tower | `beaumaris/east-mid-tower-chapel-tower.mp4` |
| B | 外観 | 北門楼 North Gatehouse | `beaumaris/north-gatehouse.mp4` |
| B | 内観 | 厩舎・馬具庫 Stable & Harness Store (West Range) | `beaumaris/stable-harness-store-west-range.mp4` |
| **A** | 内観 | 北門楼 門道と落とし格子 North Gate Passage & Portcullis | `beaumaris/north-gate-passage-portcullis.mp4` |
| B | 外観 | 南門楼 未完成の床梁 South Gatehouse, Unfinished Floor | `beaumaris/south-gatehouse-unfinished-floor.mp4` |
| B | 内観 | 菜園 Kitchen Garden | `beaumaris/kitchen-garden.mp4` |
| B | 内観 | 薬草園 Herb Garden | `beaumaris/herb-garden.mp4` |
| B | 外観 | 水堀 Moat | `beaumaris/moat.mp4` |
| **A** | 外観 | 潮汐ドック Tidal Dock ("Gate next the Sea") | `beaumaris/tidal-dock-gate-next-the-sea.mp4` |
| B | 外観 | 海への水路 Channel to the Sea | `beaumaris/channel-to-the-sea.mp4` |

### カステル・デル・モンテ(イタリア, 1240) — `castel-del-monte` / ラベル 6 件

| 優先 | 種別 | ラベル名(ツールチップのタイトル) | 想定クリップ名 |
|---|---|---|---|
| **A** | 外観 | 主玄関ポータル Main Portal | `castel-del-monte/main-portal.mp4` |
| **A** | 外観 | 中庭 Courtyard | `castel-del-monte/courtyard.mp4` |
| B | 内観 | 水盤 Basin | `castel-del-monte/basin.mp4` |
| B | 外観 | 貯水槽の口 Cistern Mouth | `castel-del-monte/cistern-mouth.mp4` |
| B | 外観 | 薬草の畝 Herb Beds | `castel-del-monte/herb-beds.mp4` |
| B | 外観 | 孤立丘 Hilltop | `castel-del-monte/hilltop.mp4` |


---

## 7. 内容を考えるときの参照元

各ラベルには既にビューア内に**日本語の解説文**が入っている。動画の内容はそれと矛盾させないこと。
解説文は `castles/<城id>.js` の `registerPick(...)` の第4引数として書かれている。

解説文には史実と推定が明示的に書き分けてある(例:「〜は推定」「史料未確認」)。
**推定と書かれている部分は、断定的な映像にしないこと**(例: 用途が推定の部屋を、
特定の用途だと決めつけた映像にしない)。

---

## 8. 完了条件

1. 優先度A の 16 本(またはユーザーが指定した範囲)の mp4 とポスター jpg が `media/` 配下にある
2. すべてが仕様(§3)を満たす。**特に 1本400KB以下・音声なし・ループ可**
3. manifest(または §5 で採用した代替形式)が完成し、キーがコード内のラベル名と完全一致する
4. `file://` で実際に再生できることを確認済み
5. スタイルが5城で統一されている(§2)
6. 総容量が 10MB 以下

## 9. このファイルの更新

§5 の検証結果と、採用した配信方式を**必ずこのファイルに追記**すること。
ビューア側の再生機構を実装する担当が、このファイルだけを見て実装できる状態にする。

---

## 10. 検証結果と採用方式(2026-08-15 追記)

### 10.1 §5 の検証結果(実測)

ヘッドレス Chrome で `file:///C:/Dev/Claude/HTMLTown/castle-viewer/_video_probe.html` を
`--dump-dom` して確認した。フラグは既定のまま(自動再生ポリシーを緩める指定は**していない**)。

| 確認したこと | 結果 |
|---|---|
| `file://` から `<video src="media/...mp4">` | **再生できる**。`readyState=4` / `currentTime` が末尾まで進む / `error` 無し |
| ミュート自動再生 | **通る**。`play()` の Promise が resolve。`muted playsinline` 属性で十分 |
| `loop` 属性 | 動作する(末尾から先頭へ戻る) |
| `fetch('media/....json')` | **失敗**。`TypeError: Failed to fetch` |
| `XMLHttpRequest` | **失敗**。`status = 0` |
| `<script src="media/....js">` → `window.CASTLE_CLIPS` | **読める** |

**結論: mp4 を `<video>` で直に再生してよい。** WebP / data URI / 静止画切替の代替案は不要。
ただし **manifest は fetch できない**ので、下記のクラシックスクリプト方式にした。

### 10.2 採用した配信方式(ビューア側はここだけ見ればよい)

`index.html` に1行足す。**`js/` の他のスクリプトより前**でよい。

```html
<script src="media/manifest.js"></script>
```

これで `window.CASTLE_CLIPS` が入る。形は `manifest.json` と同一:

```js
window.CASTLE_CLIPS = {
  "version": 1,
  "clips": {
    "malbork::大食堂 Great Refectory": {
      "src": "media/malbork/great-refectory.mp4",
      "poster": "media/malbork/great-refectory.jpg",
      "seconds": 5.04,
      "bytes": 312345
    }
  }
};
```

- キーは `<城id>::<ラベル名>`。ラベル名は `castles/<城id>.js` の中の文字列リテラルと
  1文字も違わない(16件すべてを機械照合済み)
- **キーが無いラベルは従来どおりテキストのツールチップだけ**にすること。`CASTLE_CLIPS`
  そのものが未定義でも壊れないよう `window.CASTLE_CLIPS?.clips?.[key]` で引く
- `media/manifest.json` も同じ内容で置いてあるが、これは人が読む用。**ビューアからは読めない**
- 再生要素はこの形が実測で通っている:

```html
<video src="..." poster="..." muted loop playsinline autoplay></video>
```

`autoplay` を付けず hover 時に `video.play()` を呼ぶ形でもよい(ユーザー操作起点なので確実)。

### 10.3 §3 との差分(意図的に外したところ)

| 項目 | §3 の指定 | 実際 | 理由 |
|---|---|---|---|
| ループの継ぎ目 | 始端と終端がつながること | **つながらない**(ジャンプカット) | 依頼者の判断で不問とした。ピンポン化・クロスフェードは未適用 |
| 尺 | 5〜8秒 | **5.04秒**(全クリップ共通) | Wan 2.2 の 16fps × 81 フレームが下限側にちょうど収まる |
| フレームレート | 24 または 30 | **24fps** | 生成は 16fps。フレーム複製で 24fps に整えた(尺は不変、容量への影響はほぼ無し) |

継ぎ目をつなげたくなった場合は、後処理スクリプト側でピンポン(順再生+逆再生)にすれば
確実に一致する。尺は倍になるので、生成フレーム数を 41 前後に落として調整すること。

### 10.4 制作パイプライン(再生成したくなったとき用)

すべてローカル。外部サービスは使っていない。

1. **キーフレーム**: ComfyUI + SDXL(`RealVisXL_V5.0_fp16`)、1216×704 / 30 steps。
   全クリップで共通のスタイル固定文とネガティブを末尾に足してスタイルを揃えている
2. **動画化**: ComfyUI + Wan 2.2 I2V(14B, lightx2v 4step LoRA)、832×480 / 81 フレーム / 16fps
3. **後処理**: PyAV(ComfyUI の venv に同梱)で 16:9 中央クロップ → 640×360 → 24fps 化 →
   H.264(yuv420p, 音声トラック無し) → 400KB を超えたら CRF を上げて焼き直し → ポスター jpg

制作用スクリプト一式(`vlgen.mjs` / `postprocess.py` / `deploy.mjs` / `check-labels.mjs`)は
このリポジトリには置いていない。生成環境(Video Library + ComfyUI)側の作業ディレクトリにある。

**注意: 画像生成と動画生成を交互に回さないこと。** Wan の unet は 13.3GB × 2 あり、間に
SDXL を挟むと OS のファイルキャッシュから追い出されて 1本あたり 12分 × 2 のロード待ちが
発生する。実測で 1本 24分 → 2.6分 の差が出た。画像を全部作る → ComfyUI に
`POST /free {"unload_models":true,"free_memory":true}` → 動画を全部作る、の順で回すこと。

### 10.5 納品物(2026-08-15 時点)

**優先度A の 16 本すべてを納品済み。** 優先度B の 61 本は未着手。

| 城 | 本数 | クリップ |
|---|---:|---|
| bodiam | 3 | gatehouse / great-hall / the-octagon |
| vincennes | 2 | nave / sainte-chapelle |
| malbork | 6 | great-refectory / church-apse-virgin-mary / gdanisko-dansker / cloister-arcade / courtyard-well / courtyard-herb-garden |
| beaumaris | 3 | east-mid-tower-chapel-tower / north-gate-passage-portcullis / tidal-dock-gate-next-the-sea |
| castel-del-monte | 2 | main-portal / courtyard |

全 16 本が共通で: **640×360 / H.264(main) + yuv420p / 24fps / 5.04秒 / 音声トラック無し**。
1本あたり最大 **379,781 バイト**、ポスター最大 **77,962 バイト**、**mp4 合計 4.74MB**
(ポスター込みで約 5.7MB)。§8 の完了条件はすべて満たしている。

容量の上限は **10 進(400,000 / 80,000 バイト)で判定**している。KiB 換算にすると
400,591 バイトのようなぎりぎり超過が通ってしまうため、厳しい側に寄せた。

`file://` での最終確認は `_video_probe.html` を素の設定のヘッドレス Chrome で開いて実施し、
**16/16 が動画・ポスターとも読み込み成功**することを確認済み。このページは検証用の
使い捨てなので、ビューア側の実装が済んだら消してよい。

### 10.6 作り直すときの注意(実作業で踏んだもの)

- **Wan は画面に人物を勝手に足す。** 静止画に誰もいなくても、動画化の途中で人が歩いて
  入ってくることがある。主玄関ポータルでは**現代の服装(Tシャツ・短パン)の人物**が出た。
  動画側のネガティブに `人物，行人，游客，现代服装` を入れ、プロンプトにも
  「誰も入ってこない」と明記して回避した。**納品前に必ず終端フレームを目視すること**
- **SDXL は「城の写真」に引っ張られて近代の設備を混ぜる。** 大広間の初回生成では
  窓の下に**鋳鉄製のラジエーター**が写り込んだ。ネガティブに `radiator, heater, pipes,
  wiring, museum barrier` を追加した上で、最終的にはその部分をクロップで落として使った
- **固有の形が指示どおり出ないラベルがある。** 「D字型の中間塔」「正八角形の中庭」
  「5連アーチの橋」など、形そのものが要点のラベルは 2〜3 回撮り直している。
  プロンプトの**先頭に形状を置く**と当たりやすい(語順の効果が大きい)
- 撮り直しても良くならない場合は、無理に3回目を回すより**初回版に戻す**方が早い。
  ここでは 8 枚を撮り直し、そのうち 4 枚は初回版へ差し戻した
