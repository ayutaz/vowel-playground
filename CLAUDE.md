# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

インタラクティブ母音フォルマント合成器 — 2D母音空間チャート (F1 x F2) 上でマウスをドラッグすると、対応する母音がリアルタイムで合成されるWebアプリ。Gunnar Fant の音源フィルタ理論に基づく。

## Tech Stack

- **p5.js** (v1.9.0) + **p5.sound** アドオン（CDN読み込み）
- **Google Fonts Noto Sans** — IPA記号のクロスプラットフォーム表示
- 純粋な HTML/JS/CSS（ビルドツール不要）
- Web Audio API によるリアルタイム音声合成

## Development

ローカルサーバーで起動（p5.sound は file:// プロトコルでは動作しない）:

```bash
npx http-server . -p 8080
# or
python -m http.server 8080
```

ブラウザで `http://localhost:8080` を開く。

## Architecture

全ロジックは `sketch.js` 1ファイルに収まる（約240行）。主要な構成:

1. **音声合成部**: 鋸歯状波オシレータ (131Hz) → 6つの並列フィルタ (F1F, F2F, F3F, F4F, BEF, LPF)
2. **描画部**: 対数スケールの母音空間チャート、21個のIPA母音シンボル、母音間接続線、不可能領域マスク
3. **インタラクション部**: mousePressed/mouseReleased でオシレータ制御、ドラッグでF1F/F2Fフィルタ周波数をリアルタイム更新

座標系は音声学の慣例に従い F2 は右→左、F1 は上→下で、両軸とも対数マッピング。

## Key Domain Concepts

- **F1 (第1フォルマント)**: 舌の高さ / 口の開き。250–1000 Hz
- **F2 (第2フォルマント)**: 舌の前後位置 / 唇の丸め。540–2600 Hz
- フィルタの Q値・ゲインは音質に直結するため、変更時は実際に聴いて確認すること
- 母音のF1/F2座標値は Dr. Geoff Lindsey の母音空間配置に準拠

## p5.sound Filter API

peaking フィルタの正しい使い方（原作と同じパターン）:

```javascript
let filter = new p5.Filter();
filter.setType("peaking");     // setType でピーキングに変更
filter.set(freq, q);           // 周波数とQ値を設定
filter.gain(60);               // ゲイン設定 (dB)
```

内部 BiquadFilterNode への直接アクセスも可能: `filter.biquad.frequency.setTargetAtTime(hz, time, 0.015)`

## File Structure

```
index.html    — CDN読み込み (p5.js, p5.sound, Noto Sans)
sketch.js     — 全合成・描画・イベントロジック
style.css     — フルブリード + touch-action: none
docs/         — 技術選定・調査ドキュメント (11ファイル)
```

## Conventions

- 応答・コメントは日本語で記述
- 要求定義は `REQUIREMENTS.md` を参照
- 技術調査は `docs/` フォルダを参照（`docs/00_overview.md` が索引）
