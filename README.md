# 中世城 3Dビューア / Medieval Castle 3D Viewer

ヨーロッパ中世城郭5城を、公開されている実測寸法と実物写真をもとに再現したブラウザ3Dビューアです。
**ビルド不要・サーバー不要。`index.html` をブラウザで開くだけで動きます。**

## 収録している城

| 城 | 国 | 年 | 特徴 |
|---|---|---|---|
| ボディアム城 | イングランド | 1385 | 広い水堀に浮かぶ方形城郭。双塔のゲートハウス |
| ヴァンセンヌ城 | フランス | 1380 | 高さ52mのドンジョンと乾堀、サント・シャペル |
| マルボルク城 | ポーランド | 1406 | 世界最大級のレンガ造城塞。高城・中城・低城の三郭とノガト川 |
| ボーマリス城 | ウェールズ | 1295 | 教科書的な同心円式プラン。資金枯渇で未完成のまま残る |
| カステル・デル・モンテ | イタリア | 1240 | 正八角形の本体に八角形の塔8基。堀も跳ね橋も持たない謎の城 |

## 主な機能

- **カットアウェイ** — ズームインすると手前の壁と屋根がフェードし、内観が見えます。
  マルボルクとヴァンセンヌは二段階(外郭 → 主塔)
- **内装** — 大広間、厨房、礼拝堂、寝室、厩舎などに家具・調度を配置。夜は暖炉と蝋燭が灯ります
- **住人** — 農民が門を通って出入りし中庭を歩き、衛兵が巡回します(トグルで表示)
- **家畜** — 厩舎の馬、鶏小屋、鳩小屋、豚と羊、堀の白鳥など
- **時間帯 × 天候** — 朝/昼/夕/夜 × 晴/曇/雨/雪
- **国別の風景** — イングランドは生垣の牧草地と羊、フランスは短冊状の開放耕地と葡萄畑、
  ポーランドは排水路の走る穀倉地帯、ウェールズは乾式石垣とヒース、イタリアはオリーブ畑
- **ラベルとツールチップ** — 各所に日英の名称と解説。**再生マーク(▶)付きのラベルは
  ホバーするとイメージ動画が再生されます**
- **BGM** — 城の国に合わせた5曲。オン/オフと音量を調整できます

## 使い方

- **ドラッグ** = 回転 / **右ドラッグ・Shift+ドラッグ・2本指ドラッグ** = 移動 / **ホイール・ピンチ** = ズーム
- ラベルや建物にマウスを乗せると解説が出ます

### URLパラメータ

開いた瞬間の状態を URL で指定できます。

```
index.html?castle=malbork&time=dusk&weather=rain&labels=1&residents=1&zoom=0.3
```

| キー | 値 |
|---|---|
| `castle` | `bodiam` / `vincennes` / `malbork` / `beaumaris` / `castel-del-monte` |
| `time` | `morning` / `day` / `dusk` / `night` |
| `weather` | `clear` / `cloudy` / `rain` / `snow` |
| `az`, `el` | カメラの方位角・仰角(ラジアン) |
| `zoom` | 0(遠い)〜 1(近い) |
| `panx`, `panz` | 注視点の移動(メートル) |
| `labels`, `residents` | `1` で有効 |

## 技術構成

- Three.js r128(cdnjs から読込)。**ビルドツール・パッケージマネージャは不要**
- ES モジュールは使っていません。`file://` で開いたときに CORS でブロックされるためです
- ジオメトリはすべてコードで手続き的に生成しています(3Dモデルファイルは使いません)

```
index.html          UI と読み込み順
js/00-core.js       共有プリミティブ、ラベル生成
js/01-moat.js       堀・水面・土手
js/10-scene.js      レンダラ・カメラ・光・山並み
js/11-environment.js 時間帯・天候
js/12-camera.js     軌道・パン・ズーム・カットアウェイ
js/13-pick.js       ツールチップ・ラベル・動画再生
js/14-residents.js  住人
js/15-nature.js     雲・鳥・樹木・湖・国別の中景
js/16-audio.js      BGM
js/20-registry.js   城レジストリ
castles/*.js        城ごとの構築コード(1城1ファイル)
js/90-main.js       起動とメインループ
audio/              BGM
media/              ラベル連動のイメージ動画とポスター
```

**城を追加するには** `castles/<id>.js` を作って末尾で `registerCastle({...})` を呼び、
`index.html` に `<script>` を1行足すだけです。他のファイルに手を入れる必要はありません。

## 出典と考証について

寸法は各国の文化財機関や専門資料、Wikipedia の公開値に基づいています。主な参照元:

- [medievalheritage.eu](https://medievalheritage.eu/)(ヴァンセンヌ / マルボルク / ボーマリス)
- [Malbork Castle – Wikipedia](https://en.wikipedia.org/wiki/Malbork_Castle) / [Zamek w Malborku](https://pl.wikipedia.org/wiki/Zamek_w_Malborku)
- [Château de Vincennes – Wikipedia](https://fr.wikipedia.org/wiki/Ch%C3%A2teau_de_Vincennes)
- [Castel del Monte – Wikipedia](https://it.wikipedia.org/wiki/Castel_del_Monte)

**実測値と推定を区別しています。** 史料に寸法が残っていない部分(内装の家具配置、
用途が不明な部屋の割り当て、外郭の細部など)は推定であり、その旨をコード内のコメントと
ツールチップの解説文に明記しています。現存しない創建当時の姿を復元している箇所も同様です。

## 生成アセットについて

- **BGM**: [Stable Audio 3 Medium](https://huggingface.co/stabilityai/stable-audio-3-medium) を
  ローカル実行して生成。ループ化と音量統一は [FFmpeg](https://ffmpeg.org/) で処理
- **イメージ動画**: SDXL(RealVisXL)でキーフレームを生成し、Wan 2.2 I2V で動画化。
  後処理は FFmpeg / PyAV
- いずれも外部の有料APIやクラウドサービスは使わず、ローカルで生成しています
- 各モデルのライセンス条件は配布・商用利用の前に原文を確認してください
