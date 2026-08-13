# 中世城3Dビューア 引継ぎメモ(2026-08-14 更新)

## プロジェクト概要
- 成果物: `C:\Dev\Claude\HTMLTown\castle-viewer\index.html`(単一HTML・ビルド不要・Three.js r128 UMDをcdnjsから読込)
- 内容: 中世城の3Dビューア。カットアウェイ(ズームで壁フェード→内観)、時間帯×天候、遠景山並み、日英ツールチップ、ラベル常時表示、カメラパン、住人シミュレーション、城レジストリ `CASTLES` による複数城対応
- 運用体制: Fable=指示・判断・検証、実作業はSonnetサブエージェント(同一ファイルのため直列実行)
- Git 管理: このフォルダ(`castle-viewer/`)がリポジトリ。親フォルダの既存 HTML は別物・不干渉

## 収録城(3城)
1. **ボディアム城**(イングランド, 1385)— 水堀の方形城・双塔ゲートハウス
2. **ヴァンセンヌ城**(フランス, 1380)— 実物準拠改修済み: 330×175m外郭・角塔9基(実名・実配置、西辺は塔なし)、西長辺中央のドンジョン(52m・マシクレーション冠)+シェミーズ(13m・歩廊・バルティザン)、40m級サント・シャペル。出典: Wikipedia/Wikimedia写真・公式平面図
3. **マルボルク城**(ポーランド, 1406)— 赤レンガ+テラコッタ。高城(回廊四翼+主塔+教会後陣、tier:'inner'カットアウェイ+内観4室)・中城(大マスター宮殿)・低城(二重壁+乾堀+橋門)、ノガト川

## 主要システム
- `CASTLES[].view` = {targetY, zMin, zMax, initDist, fogNear, fogFar, shadowExtent, shadowFar, camFar, panLimit, envScale, envLift}(applyCastle が切替時適用)
- カメラパン: 右ドラッグ/Shift+左ドラッグ/2本指。`panLimit` でクランプ、切替リセット
- ラベル: `buildLabelGroup`(pickables から自動生成)。外観=トグルONで常時、内観=リビール>0.28。**カメラ距離比例で毎フレーム再スケール(画面上約24px一定)**
- 住人(section 6.5): 「住人」トグル。build() 戻り値 `life` = { gates(通路中心線ウェイポイント配列), courtyard(矩形配列), patrol, population }。農民=門を通って出入り(through/throughIn 状態)+中庭徘徊、衛兵=巡回。夜は農民1/3。ジオメトリ/マテリアル共有、切替で確実に破棄
- 門: 3城とも実開口(貫通)。ポートカリスは巻き上げ位置、扉は開状態
- デバッグヘルパー: `__applyCastle/__setPan/__panBy/__setZoom(0..1)/__setOrbit/__setEnv/__setLabels/__setResidents/__stepResidents/__residentStates/__pickAt/__findPickScreen/__debugState`(ペイン非表示時は canvas.toDataURL でキャプチャ可)

## 検証状況(2026-08-14 時点、全ゲート合格)
- node --check、スタブ実行(3城カウント: ボディアム18/18、ヴァンセンヌ22/24、マルボルク21/13)
- 実表示: 3城切替往復・住人ON/OFF・カットアウェイ・ラベル・時間帯/天候でコンソールエラー0件
- 目視: 3城の門開口貫通、農民の門通過・橋渡り、ラベル判読性、山並み、実物準拠形状

## 検討事項(未実施・提案のみ)
- マルボルクの色調が単調(壁と屋根が同系オレンジ)。差別化するなら屋根をより暗い赤褐色に
- アーティファクト公開には Three.js のインライン化が必要(CSP対応、ユーザー判断待ち)
- 国旗絵文字は Windows Chrome では文字表示(OS制限)

## 出典
- https://en.wikipedia.org/wiki/Ch%C3%A2teau_de_Vincennes / https://fr.wikipedia.org/wiki/Ch%C3%A2teau_de_Vincennes
- https://en.wikipedia.org/wiki/Malbork_Castle
