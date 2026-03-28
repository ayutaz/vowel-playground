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

## 3. AudioWorklet vs BiquadFilterNode

**BiquadFilterNode で十分。** AudioWorklet は不要。

- 固定数のフォルマント（6本）は BiquadFilterNode の並列接続で実現可能
- peaking, notch, lowpass はすべて BiquadFilterNode がネイティブサポート
- AudioWorklet が必要になるのは: カスタム声門波形、非標準フィルタ、サンプル単位制御が必要な場合

## 4. ブラウザ間の差異

| 機能 | Chrome | Firefox | Safari | Edge |
|------|--------|---------|--------|------|
| BiquadFilterNode | OK | OK | OK | OK |
| AudioWorklet | OK (66+) | OK (76+) | OK (14.1+) | OK |
| latencyHint | OK | 部分的 | 無視される場合あり | OK |

### Safari の既知制限

- ユーザー操作なしの AudioContext は `suspended` — `resume()` 必須
- `sampleRate` 指定が無視される場合あり
- GC タイミングが異なり、ノード切断後すぐに解放されない場合あり

## 5. Autoplay Policy 対応

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

## 6. メモリ管理のベストプラクティス

| ノード種類 | 生成 | 破棄 | 再利用 |
|-----------|------|------|--------|
| OscillatorNode | 初期化時 | `stop()` + `disconnect()` | **不可** (stop後再利用不可) |
| BiquadFilterNode | 初期化時 | `disconnect()` | **可** (パラメータ変更で再利用) |
| GainNode | 初期化時 | `disconnect()` | **可** |

本プロジェクトでは:
- オシレータとフィルタは初期化時に一度だけ生成
- 発音開始/停止は GainNode の振幅制御で行う（オシレータのstart/stopは使わない方式も可）
- アプリ終了時に `ctx.close()` で全リソース解放
