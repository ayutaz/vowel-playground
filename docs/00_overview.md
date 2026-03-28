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
