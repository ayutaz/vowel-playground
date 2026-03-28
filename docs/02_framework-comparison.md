# フレームワーク比較調査

## 比較対象

1. **p5.js + p5.sound** (原作の構成)
2. **Tone.js + Canvas API**
3. **Vanilla Web Audio API + Canvas API**
4. **React + Tone.js**
5. **Svelte + Web Audio API**

## 比較表

| 観点 | p5.js + p5.sound | Tone.js + Canvas | Vanilla | React + Tone.js | Svelte + Web Audio |
|---|---|---|---|---|---|
| **学習コスト** | **低** | 中 | 中~高 | 高 | 中 |
| **バンドルサイズ** | 大 (~1.2MB min) | 小 (~150KB) | **最小 (0KB)** | 中 (~350KB) | 最小級 (~15KB gzip) |
| **オーディオ機能** | 中 (peaking未直接対応) | **最高** (全フィルタ型対応) | 高 | 最高 | 高 |
| **リアルタイム性能** | 良 | 優秀 | **最高** | 良 | 優秀 |
| **タッチ/マウス処理** | **最も簡単** | 手動 | 手動 | 簡単 | 簡単 |
| **キャンバス描画** | **最も簡単** | 手動 | 手動 | やや不自然 | やや手動 |
| **デプロイ容易性** | **最も簡単** (CDN) | 簡単 | 最も簡単 | 要ビルド | 要ビルド |
| **将来拡張性** | 低~中 | **高** | 高 | 高 | 高 |

## 総合評価

| 選択肢 | 即時開発効率 | 技術的適合度 | 将来拡張性 | 総合 |
|---|---|---|---|---|
| **p5.js + p5.sound** | ★★★★★ | ★★★ | ★★ | ★★★★ |
| Tone.js + Canvas | ★★★★ | ★★★★★ | ★★★★★ | ★★★★★ |
| Vanilla | ★★★ | ★★★★ | ★★★★ | ★★★★ |
| React + Tone.js | ★★ | ★★★★ | ★★★★ | ★★★ |
| Svelte + Web Audio | ★★★ | ★★★★ | ★★★★ | ★★★★ |

## 推奨と最終判断

### 調査チームの推奨: Tone.js + Vanilla Canvas API

**理由:**
- peaking フィルタを `new Tone.Filter({type: "peaking"})` で一行で利用可能
- p5.sound のメンテナンス停滞リスクを回避
- Tone.FFT / Tone.Waveform でスペクトログラム拡張が容易
- バンドルサイズ ~150KB（p5.js+p5.sound の ~1.2MB に対して大幅削減）

### 最終判断: p5.js + p5.sound (原作準拠)

調査チームの推奨はTone.jsだが、以下の理由で**原作と同じ p5.js + p5.sound を採用**:

1. **原作の再現が主目的** — 原作と同じスタックで忠実に再現することが要件
2. **描画との統合** — Tone.jsを選んでも描画のためにp5.jsか素のCanvasが必要。描画もp5.jsが最も簡潔
3. **peakingフィルタは回避策あり** — `filter.biquad.type = 'peaking'` でBiquadFilterNodeに直接アクセス可能
4. **~200行規模** — この規模ではフレームワークの差が出にくい
5. **ビルドツール不要** — CDNから読み込むだけで完結

### p5.sound の peaking フィルタ回避策

```javascript
// p5.Filter は lowpass/highpass/bandpass のみ公式サポート
// 内部の BiquadFilterNode に直接アクセスして peaking に変更
let f1Filter = new p5.Filter('bandpass');  // 仮の型で作成
f1Filter.biquad.type = 'peaking';          // 内部ノードを直接変更
f1Filter.biquad.Q.value = 0.2;
f1Filter.biquad.gain.value = 60;
```

### 将来 Tone.js に移行する場合

p5.sound の制約が問題になった場合（スペクトログラム追加時等）、音声部分のみ Tone.js に置き換え、描画は p5.js を継続する構成への移行が可能。
