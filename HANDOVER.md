# 中世城3Dビューア 引継ぎメモ(2026-08-13 時点)

## プロジェクト概要
- 成果物: `/home/claude/castle-viewer/index.html`(単一HTML・ビルド不要・Three.js r128 UMDをcdnjsから読込)
- 内容: ボディアム城(イングランド, 1385)の3D再現。ズームで手前の壁・屋根がフェードし内観表示(カットアウェイ)。時間帯(朝/昼/夕/夜)×天候(晴/曇/雨/雪)切替、遠景の山並み、部屋・構造物のマウスオーバーツールチップ(日英+解説)、ラベル常時表示トグル、城レジストリ`CASTLES`による複数城対応構造。
- 運用体制: Fable=指示・判断のみ、実作業はSonnetサブエージェント。資料判断はWikipedia参照(参照のみ)。
- スキル参照元: `/home/claude/Skills`(MengTo/Skillsのクローン)。主に `web-design/threejs`, `threejs-towers`(城生成・切替パターン), `threejs-landscape`(時間帯・空・山), `threejs-weather`(雨雪), `game-development/build-game-camera-controls`, `optimize-threejs-games`, `codex/iterate-until-verified`(品質ゲート方式)。

## 完了済み(最新の index.html に反映済み・検証ゲート合格)
1. v1: ボディアム城 外観+内観+カットアウェイ+レジストリ+日本語UI
2. v2: ホバーツールチップ / 時間帯・天候 / 山並み背景
3. v3(今回、Fableの最終画像判定は未実施だがSonnet検証は合格):
   - 水堀の境界自然化: 水面を1m沈め、内外周に頂点カラーの傾斜バンク+汀線、地面に穴あけ、橋脚追加、オクタゴン島スカート
   - サイド凡例パネル削除、「ラベル常時表示」トグル追加(時間帯/天候パネル内)
   - 屋根フェード帯 0.70–0.86 → 0.40–0.62(壁 0.35–0.58 とほぼ同時に消える)
   - 国表示: レジストリに country/countryJa/flag を追加、情報パネル・セレクタに国旗+国名を自動描画
   - 検証画像: `shots3/`(water_edge / labels_on / fade_mid / ui_country)
4. 第二の城(ヴァンセンヌ城, フランス)のWikipedia調査完了。スペックは下記。

## 未完了(次セッションでやること)
1. **ヴァンセンヌ城の実装**(調査済みスペックを使用):
   - CASTLES配列に2件目を追加(country:"France", countryJa:"フランス", flag:"🇫🇷")
   - 外郭: 330×175mの長方形城壁(高さ11m)、塔9基(大半は城壁高さに切詰め・北のTour du Villageのみ42m級で現存 ※中世姿なら全塔42mでも可、方針判断はFableに確認)、門3、石造水堀
   - ドンジョン: 高さ52m(諸説50m)、一辺16.5mの正方形+四隅の円形小塔(径6.6m)+北付属塔、シェミーズ壁+専用堀+跳ね橋2、1階テラス入口
   - ドンジョン内観(階別): 地下=貯蔵 / 1階=評議の間 / 2階=王の寝室(中央柱・暖炉・浴室記録) / 3階=賓客 / 上層=兵士・弾薬。下層4階に装飾中央柱、螺旋階段は北付属塔
   - サント・シャペル: 外郭内、フランボワイヤン・ゴシック、14世紀時点では「建設中」なので簡略ゴシック礼拝堂として配置
   - スケールがボディアム(33m角)の10倍なので、レジストリに城ごとのカメラ設定(初期距離・Zmin/Zmax・カットアウェイreveal距離換算)を持たせる改修が必要
   - 実装時は `buildBodiam` と section 0.5 の共通ヘルパー `buildWaterMoatSystem` 等を参照(引数仕様はコード内コメント)
2. 品質ゲート再実行: `vendor/three.r128.min.js` にsrc一時差替→ `python3 -m http.server` + Playwright(chromium: /opt/pw-browsers/chromium、`test.js`/`test2.js`/`test3.js` 流用)→ コンソールエラー0件、両城の切替2往復、スクリーンショット取得 → 検証後srcをCDN r128へ復元
3. Fableによる画像判定(v3の4枚 `shots3/` も未判定なので合わせて)
4. 納品: SendUserFileでindex.html送付+アーティファクト `bodiam-castle-3d-viewer` を update_artifact で更新(名称は2城対応なら「medieval-castles-3d-viewer」相当への説明変更を検討)

## ヴァンセンヌ城 出典
- https://en.wikipedia.org/wiki/Ch%C3%A2teau_de_Vincennes
- https://fr.wikipedia.org/wiki/Ch%C3%A2teau_de_Vincennes
- UI用説明文(調査済み): 「フランス王シャルル5世が14世紀に築いた、高さ52mを誇る欧州最大級のドンジョンと1km超の城壁を持つ中世要塞。パリ郊外の森に建つ王権の象徴。」

## ファイル一覧
- `index.html` — 本体(v3、動作版)
- `vendor/three.r128.min.js` — 検証用ローカルr128(納品不要)
- `test.js` / `test2.js` / `test3.js` — Playwright検証スクリプト
- `shots/` `shots2/` `shots3/` — 各段階の検証スクリーンショット
- `/home/claude/Skills/` — スキルリポジトリ(クローン)

## ユーザー要望の残タスク備忘
- 「第二の城を追加」(=ヴァンセンヌ城、上記1)のみ未完。その他の要望(水際・トグル・凡例削除・屋根フェード・国表示・進捗の小まめな報告)は対応済み。
