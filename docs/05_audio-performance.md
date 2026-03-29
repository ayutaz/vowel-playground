# リアルタイムオーディオ性能最適化

## 1. AudioContext 設定

```javascript
const ctx = new AudioContext({
  sampleRate: 48000,          // デバイスネイティブレートでリサンプリング回避
  latencyHint: "interactive"  // 低レイテンシ優先（音楽/リアルタイム合成向け）
});
```

- `baseLatency`: 通常 128 samples / 48kHz ≈ 2.67ms
- `"interactive"` で内部バッファが小さくなりレイテンシ低下（CPU負荷は増加）

## 2. パラメータスムージング

### メソッド使い分け

| 用途 | 推奨メソッド | 理由 |
|------|-------------|------|
| フィルター周波数のリアルタイム変更 | **`setTargetAtTime`** | 連続更新に強い。前回完了を待たず再呼出し可能 |
| ゲイン（音量）のフェード | `linearRampToValueAtTime` | 聴覚的に自然 |
| ピッチ変更 | `exponentialRampToValueAtTime` | 周波数は対数スケールが自然 |

### 推奨パターン: setTargetAtTime

```javascript
// フォルマントフィルタの周波数をマウス座標で更新
filter.frequency.setTargetAtTime(
  targetHz,           // 目標値
  ctx.currentTime,    // 開始時刻
  0.015               // timeConstant（15ms でほぼ到達）
);
```

`setTargetAtTime` は「前回のスケジュール完了前でも新しい目標に滑らかに切り替わる」特性があり、高頻度のマウスイベントに最適。

### マウス入力との連携

```javascript
// draw() 内でパラメータ更新（p5.jsの自然なthrottle = 60fps）
function draw() {
  if (isPlaying && isInsidePlotArea(mouseX, mouseY)) {
    let f1 = pixelToHz(mouseY, F1_MIN, F1_MAX, PLOT_TOP, PLOT_BOTTOM);
    let f2 = pixelToHz(mouseX, F2_MIN, F2_MAX, PLOT_RIGHT, PLOT_LEFT);
    f1Filter.biquad.frequency.setTargetAtTime(f1, getAudioContext().currentTime, 0.015);
    f2Filter.biquad.frequency.setTargetAtTime(f2, getAudioContext().currentTime, 0.015);
  }
  drawVowelChart();
}
```

## 3. オーディオグラフ構成

### 音源

| 音源 | 種類 | 役割 |
|------|------|------|
| `osc` | 鋸歯状波 (sawtooth, 131Hz) | 声帯振動のモデル。倍音豊富な基本波形 |
| `noise` | ピンクノイズ (`p5.Noise("pink")`) | 気息成分のモデル。子音的な質感を付与 |

### 接続トポロジー

```
osc (sawtooth) ──┬── F1F (peaking)
                 ├── F2F (peaking)
                 ├── F3F (peaking)
                 ├── F4F (peaking)
                 ├── BEF (notch)
                 └── LPF (lowpass)

noise (pink)   ──┬── F1F (peaking)
                 ├── F2F (peaking)
                 ├── F3F (peaking)
                 ├── F4F (peaking)
                 ├── BEF (notch)
                 └── LPF (lowpass)
```

- **2音源 × 6フィルタ = 12本の並列接続**
- 各フィルタの出力はすべて最終出力（`p5.soundOut`）へルーティング
- ノイズ音源の追加によりフィルタ処理量は2倍になるが、BiquadFilterNode はブラウザのネイティブ実装（C++/SIMD最適化）であり、12本程度はモダンブラウザで全く問題にならない

### ビブラート処理

```javascript
// draw() 内で毎フレーム計算（60fps）
let vibrato = Math.sin(frameCount * vibratoSpeed) * vibratoDepth;
osc.freq(BASE_FREQ + vibrato);
```

- `Math.sin` による周期的ピッチ変調を `draw()` のフレームループで実行
- `osc.freq()` は内部で `setTargetAtTime` 相当のスムージングを行うため、フレーム単位の呼び出しでもクリックノイズは発生しない
- ビブラートは鋸歯状波オシレータにのみ適用（ノイズ音源にはピッチの概念がないため不要）
- 60fps での `Math.sin` 計算は CPU 負荷として無視できるレベル

## 4. AudioWorklet vs BiquadFilterNode

**BiquadFilterNode で十分。** AudioWorklet は不要。

- 固定数のフォルマント（6本） × 2音源 = 12接続でも BiquadFilterNode の並列構成で実現可能
- peaking, notch, lowpass はすべて BiquadFilterNode がネイティブサポート
- ノイズ音源の追加もネイティブ `p5.Noise` で十分。AudioWorklet でのカスタムノイズ生成は不要
- AudioWorklet が必要になるのは: カスタム声門波形、非標準フィルタ、サンプル単位制御が必要な場合

## 5. ブラウザ間の差異

| 機能 | Chrome | Firefox | Safari | Edge |
|------|--------|---------|--------|------|
| BiquadFilterNode | OK | OK | OK | OK |
| AudioWorklet | OK (66+) | OK (76+) | OK (14.1+) | OK |
| latencyHint | OK | 部分的 | 無視される場合あり | OK |

### Safari の既知制限

- ユーザー操作なしの AudioContext は `suspended` — `resume()` 必須
- `sampleRate` 指定が無視される場合あり
- GC タイミングが異なり、ノード切断後すぐに解放されない場合あり

## 6. Autoplay Policy 対応

```javascript
function setup() {
  userStartAudio(); // p5.sound: 初回ジェスチャーで自動resume
}

function startSound() {
  // iOS Safari 対策: 毎回チェック
  if (getAudioContext().state !== 'running') {
    getAudioContext().resume();
  }
  osc.amp(0.002, 0.1);
}
```

タブがバックグラウンドに行くと `suspended` になりうるため、復帰時の再開処理も考慮:

```javascript
document.addEventListener("visibilitychange", () => {
  if (!document.hidden && getAudioContext().state === "suspended") {
    getAudioContext().resume();
  }
});
```

## 7. メモリ管理のベストプラクティス

| ノード種類 | 生成 | 破棄 | 再利用 |
|-----------|------|------|--------|
| OscillatorNode | 初期化時 | `stop()` + `disconnect()` | **不可** (stop後再利用不可) |
| p5.Noise | 初期化時 | `stop()` + `disconnect()` | **不可** (OscillatorNode と同様) |
| BiquadFilterNode | 初期化時 | `disconnect()` | **可** (パラメータ変更で再利用) |
| GainNode | 初期化時 | `disconnect()` | **可** |

本プロジェクトでは:
- オシレータ・ノイズ音源・フィルタは初期化時に一度だけ生成（計 2音源 + 6フィルタ）
- 発音開始/停止は GainNode の振幅制御で行う（オシレータのstart/stopは使わない方式も可）
- ノイズ音源もオシレータと同じライフサイクルで管理
- アプリ終了時に `ctx.close()` で全リソース解放

## 8. 性能の目安

| 項目 | 値 |
|------|-----|
| BiquadFilterNode 数 | 6 |
| 音源→フィルタ接続数 | 12 (2音源 × 6フィルタ) |
| draw() 内のオーディオ更新 | F1F/F2F 周波数 + ビブラート計算 (毎フレーム) |
| CPU 負荷 (概算) | < 1% (モダンブラウザ、一般的な PC) |

12本のフィルタ接続はWeb Audio APIの処理量としては極めて軽量。ボトルネックになるのはオーディオ処理ではなく、p5.js の Canvas 描画のほうが先にくる可能性が高い。
