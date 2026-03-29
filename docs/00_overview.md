# 技術選定・調査ドキュメント 総合概要

インタラクティブ母音フォルマント合成器を再現・実装するための技術調査結果。
10チームのエージェントによる並列調査の成果をまとめたもの。

---

## ドキュメント一覧

| # | ファイル | 調査領域 | 要約 |
|---|---------|---------|------|
| 01 | [01_web-audio-api.md](01_web-audio-api.md) | Web Audio API フォルマント合成 | BiquadFilterNode全8タイプ、ピーキングフィルタ実装、並列接続、p5.soundラッパー |
| 02 | [02_framework-comparison.md](02_framework-comparison.md) | フレームワーク比較 | p5.js vs Tone.js vs Vanilla vs React vs Svelte の5択比較 |
| 03 | [03_log-frequency-mapping.md](03_log-frequency-mapping.md) | 対数周波数マッピング | ピクセル⇔Hz変換数式、軸反転、グリッド描画、不可能領域 |
| 04 | [04_ipa-vowel-data.md](04_ipa-vowel-data.md) | IPA母音F1/F2データ | 21母音の正準値、接続構造、日本語/英語母音、JSオブジェクト |
| 05 | [05_audio-performance.md](05_audio-performance.md) | リアルタイムオーディオ性能 | レイテンシ最適化、パラメータスムージング、ブラウザ差異 |
| 06 | [06_canvas-rendering.md](06_canvas-rendering.md) | キャンバス描画技術 | IPA記号フォント戦略、高DPI対応、描画レイヤー順序 |
| 07 | [07_touch-support.md](07_touch-support.md) | タッチ/ポインターイベント | p5.jsイベントモデル、iOS Safari制限、スクロール防止 |
| 08 | [08_similar-projects.md](08_similar-projects.md) | 類似プロジェクト調査 | Pink Trombone, Delay Lama, Golan Levin版, Praat, OVE合成器 |
| 09 | [09_formant-theory.md](09_formant-theory.md) | 音源フィルタ理論 | 音質改善、F0選択、倍音構造、二重母音合成 |
| 10 | [10_deployment.md](10_deployment.md) | デプロイメント・配信 | GitHub Pages, Vercel, OGP設定, PWA, アクセシビリティ |
| 11 | [11_tech-decision.md](11_tech-decision.md) | **最終技術選定** | 全調査を踏まえた技術選定の結論 |

---

## 声質プリセットシステム

arXiv:2507.06235 "Super Kawaii Vocalics" (CHI 2025) の研究に基づき、4種類の声質プリセットを実装。声道長スケーリング・ブレシネス・ビブラート・スペクトル傾斜の各パラメータにより、同一フォルマント合成エンジン上で多様な声質を再現する。

### プリセット一覧

| プリセット | F0 (Hz) | スケール係数 | ブレシネス | ビブラート深度 | ビブラート速度 |
|-----------|---------|-------------|-----------|--------------|--------------|
| **通常** | 131 | 1.0 | 0 | 0 | 5.5 Hz |
| **女声** | 220 | 1.15 | 0.15 | 1.5 | 5.5 Hz |
| **可愛い声** | 280 | 1.3 | 0.2 | 3.0 | 5.0 Hz |
| **アニメ声** | 330 | 1.5 | 0.25 | 4.0 | 5.0 Hz |

### 音声合成の追加要素

1. **フォルマントスケーリング** — 全フィルタ周波数にスケール係数を乗算し、声道長の違いをシミュレート。値が大きいほど短い声道（高い声）を再現
2. **ピンクノイズによるブレシネス** — `p5.Noise("pink")` を鋸歯状波と同じフィルタチェーンに並列接続。プリセットごとにノイズ混合量を制御し、息混じりの質感を付与
3. **ビブラート** — F0 への正弦波変調 (5.0-5.5 Hz)。draw() ループ内で `millis()` ベースのサイン波を加算し、自然な声の揺らぎを再現
4. **プリセット別Q値・ゲインプロファイル** — 各フォルマントフィルタ (F1F-F4F) のQ値とゲインをプリセットごとに個別設定。高い声ほど高域フォルマントのゲインを強調し、スペクトル傾斜を制御

### UI

母音空間チャートの下部に4つのプリセットボタンを配置。アクティブなプリセットは青色 (`rgb(60, 130, 200)`) でハイライト表示。マウスクリック・タッチの両方に対応。

---

## 最終技術選定サマリー

### 採用技術スタック

| レイヤー | 技術 | 理由 |
|---------|------|------|
| **描画** | p5.js (v1.9+) | 描画API充実、draw()ループ/マウスイベント組み込み、高DPI自動対応 |
| **音声合成** | p5.sound (Web Audio APIラッパー) | p5.jsとの統合、BiquadFilterNode直接アクセス可能 |
| **フォント** | Google Fonts Noto Sans | IPA記号全対応、クロスプラットフォーム |
| **デプロイ** | GitHub Pages | 無料、ビルド不要、git pushで自動デプロイ |
| **ファイル構成** | index.html + sketch.js + style.css | ビルドツール不要の3ファイル構成 |

### 主要な設計判断

1. **p5.js + p5.sound を採用** (原作と同じ構成)
   - ピーキングフィルタは `filter.biquad.type = 'peaking'` で内部BiquadFilterNodeに直接アクセス
   - Tone.js は代替候補だが、描画も必要なため p5.js が結局必要になり二重依存に

2. **対数スケール軸** — Math.log/Math.exp による変換。聴覚知覚と一致

3. **フォント: Noto Sans** — Google Fonts CDN 経由。全IPA記号対応。`document.fonts.ready` で読み込み待機

4. **タッチ対応: 方針B** — p5.js のマウス関数 + タッチ関数の両方を定義。CSS `touch-action: none` でスクロール防止

5. **パラメータスムージング** — `setTargetAtTime(value, time, 0.015)` でジッパーノイズ防止。throttle不要

6. **AudioContext初期化** — `userStartAudio()` + `getAudioContext().resume()` の二段構え（iOS Safari対応）

7. **声質プリセットシステム** — arXiv:2507.06235 の知見を応用。F0・声道長スケール・ブレシネス・ビブラート・スペクトル傾斜の5軸で声質を制御。ピンクノイズ音源を鋸歯状波と並列にフィルタチェーンへ接続する構成
