# 最終技術選定

全10チームの調査結果を統合し、インタラクティブ母音フォルマント合成器の実装に使用する技術を確定する。

---

## 採用技術スタック

```
index.html       ← p5.js (CDN), p5.sound (CDN), Noto Sans (Google Fonts CDN)
sketch.js        ← 全ロジック (~200行)
style.css        ← フルブリードキャンバス + touch-action: none
```

| レイヤー | 技術 | バージョン | 読み込み方法 |
|---------|------|-----------|-------------|
| 描画 | **p5.js** | 1.9.0+ | CDN |
| 音声合成 | **p5.sound** | p5.js同梱版 | CDN |
| フォント | **Noto Sans** | 最新 | Google Fonts CDN |
| デプロイ | **GitHub Pages** | — | git push |

**ビルドツール: 不要** (npm, webpack, vite 等は使わない)

---

## 主要設計判断と根拠

### 1. p5.js + p5.sound (原作準拠)

**判断**: 原作と同じ構成を採用。

**根拠**:
- 原作の再現が主目的であり、同じスタックが最も忠実な再現を保証
- p5.js の描画API (ellipse, line, text 等) と draw() ループが母音チャート描画に最適
- p5.sound の peaking フィルタ未対応は `filter.biquad.type = 'peaking'` で回避可能
- ~200行規模ではフレームワークの差が出にくい

**リスク**: p5.sound のメンテナンス停滞。将来スペクトログラム追加時に Tone.js への部分移行を検討。

### 2. 鋸歯状波オシレータ (131 Hz)

**判断**: 原作と同じ設定を採用。

**根拠**:
- Web Audio API ネイティブ対応 (`type: 'sawtooth'`)
- -6 dB/oct のスペクトル傾斜 + LPF で実効 -18 dB/oct → 十分に自然
- 131 Hz (C3) は成人男性の話声位中心で倍音密度も十分
- ホーミー的な倍音可聴性は教育デモとして魅力的（修正不要）

### 3. 6フィルタ並列構成

**判断**: F1F, F2F, F3F, F4F, BEF, LPF を原作通り並列接続。

**根拠**:
- F1F/F2F: 母音弁別の核心。動的制御
- F3F/F4F: 声の存在感・自然さに寄与。固定値で十分な効果
- BEF: 高周波域の反フォルマント。広帯域ノッチでスペクトル整形
- LPF: 声道の高周波減衰模倣

### 4. 対数スケール軸

**判断**: Math.log / Math.exp による対数マッピングを採用。

**根拠**:
- 聴覚知覚が対数的であり、知覚的に等間隔な母音配置になる
- 音声学の標準的な表示方法
- F1=F2 の不可能領域境界が対数スケール上でも直線（描画が容易）

### 5. Noto Sans フォント

**判断**: Google Fonts CDN から Noto Sans を読み込み。

**根拠**:
- 21個のIPA記号 (ɛ, ɑ, ɔ, ə, ɵ, ɐ 等) を全OS/ブラウザで確実に表示
- 原作の "Lucida Grande" は macOS 専用で Windows では表示不可
- `document.fonts.ready` でロード完了を待機しフォールバック表示

### 6. タッチ対応: 方針B (マウス + タッチ関数併用)

**判断**: p5.js のマウス関数とタッチ関数の両方を定義。

**根拠**:
- p5.js が二重発火を自動抑制
- `return false` でスクロール防止が簡潔
- CSS `touch-action: none` と併用で全ブラウザジェスチャーを制御
- Pointer Events 直接使用よりボイラープレートが少ない

### 7. パラメータスムージング: setTargetAtTime

**判断**: `BiquadFilterNode.frequency.setTargetAtTime(hz, time, 0.015)` を使用。

**根拠**:
- 前回のスケジュール完了前でも滑らかに新目標に切り替わる
- 15ms の timeConstant でほぼ即応しつつジッパーノイズを防止
- throttle/debounce 不要（BiquadFilterNode の更新は極めて軽量）

### 8. GitHub Pages デプロイ

**判断**: GitHub Pages をメイン、p5.js Web Editor をサブ。

**根拠**:
- 追加アカウント不要、git push で自動デプロイ
- OGP メタタグのカスタマイズが可能
- p5.js Web Editor はコミュニティ向けフォーク促進用

---

## 実装の全体構成

```javascript
// sketch.js の全体構造 (~200行)

// ===== 定数 =====
const CANVAS_W = 500, CANVAS_H = 400, MARGIN = 50;
const F1_MIN = 250, F1_MAX = 1000;
const F2_MIN = 540, F2_MAX = 2600;
const F0 = 131;                       // 基本周波数 (C3)
const AMP = 0.002;                    // 最大振幅
const FADE_TIME = 0.1;               // フェードイン/アウト (秒)

// ===== IPA母音データ (21個) =====
const IPA_VOWELS = [ /* ... 04_ipa-vowel-data.md 参照 ... */ ];
const VOWEL_CONNECTIONS = [ /* ... */ ];

// ===== 音声ノード =====
let osc, f1Filter, f2Filter, f3Filter, f4Filter, befFilter, lpFilter;
let isPlaying = false;

// ===== 座標変換関数 =====
function hzToPixel(hz, minHz, maxHz, minPx, maxPx) { /* 対数マッピング */ }
function pixelToHz(px, minHz, maxHz, minPx, maxPx) { /* 逆変換 */ }
function f1ToY(f1) { return hzToPixel(f1, F1_MIN, F1_MAX, MARGIN, CANVAS_H-MARGIN); }
function f2ToX(f2) { return hzToPixel(f2, F2_MIN, F2_MAX, CANVAS_W-MARGIN, MARGIN); }

// ===== p5.js ライフサイクル =====
function setup() { /* キャンバス作成、音声ノード初期化、フィルタ接続 */ }
function draw()  { /* チャート描画 + フォルマント更新 */ }

// ===== イベントハンドラ =====
function mousePressed()  { /* 発音開始 */ }
function mouseReleased() { /* 発音停止 */ }
function touchStarted()  { /* タッチ発音開始 + return false */ }
function touchMoved()    { /* return false (スクロール防止) */ }
function touchEnded()    { /* タッチ発音停止 + return false */ }

// ===== 描画関数 =====
function drawGrid() { /* 100Hz間隔グリッド線 */ }
function drawImpossibleRegion() { /* F1>F2 領域マスク */ }
function drawConnections() { /* 母音間接続線 */ }
function drawVowelSymbols() { /* 21個のIPA記号 */ }
function drawCursor() { /* マウス位置の追従円 */ }

// ===== 音声制御 =====
function startSound() { /* AudioContext resume + amp フェードイン */ }
function stopSound()  { /* amp フェードアウト */ }
function updateFormants(px, py) { /* ピクセル→Hz変換→フィルタ周波数更新 */ }
```

---

## 次のステップ

1. `index.html` を作成（p5.js, p5.sound, Noto Sans のCDN読み込み）
2. `style.css` を作成（フルブリード + touch-action: none）
3. `sketch.js` を実装（上記構成に従い ~200行）
4. ローカルサーバーで動作確認 (`npx http-server . -p 8080`)
5. GitHub リポジトリ初期化、GitHub Pages 有効化
6. OGP メタタグ + og:image 追加
