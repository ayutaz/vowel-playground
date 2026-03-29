# Web Audio API フォルマント合成 徹底調査レポート

本ドキュメントでは、Web Audio API を用いたフォルマント合成（母音合成）の実装方法を網羅的にまとめる。プロジェクト `vowel-playground` の要件（REQUIREMENTS.md）に基づき、音源フィルタ理論の実装に必要な全要素を解説する。

---

## 目次

1. [BiquadFilterNode の全フィルタタイプ](#1-biquadfilternode-の全フィルタタイプ)
2. [ピーキングフィルタの実装](#2-ピーキングフィルタの実装)
3. [OscillatorNode](#3-oscillatornode)
4. [GainNode](#4-gainnode)
5. [フィルタの並列接続](#5-フィルタの並列接続)
6. [AudioContext の初期化](#6-audiocontext-の初期化)
7. [レイテンシの最小化](#7-レイテンシの最小化)
8. [p5.sound でのラッパー](#8-p5sound-でのラッパー)
9. [音声プリセットシステム](#9-音声プリセットシステム)

---

## 1. BiquadFilterNode の全フィルタタイプ

`BiquadFilterNode` は Web Audio API が提供する2次 IIR フィルタノードで、8種類のフィルタタイプをサポートする。すべてのフィルタは `frequency`、`Q`、`gain` の3つの `AudioParam` を持つが、タイプによって使用されるパラメータが異なる。

### 1.1 フィルタタイプ一覧

| タイプ | 名称 | 説明 | frequency | Q | gain |
|--------|------|------|:---------:|:---:|:----:|
| `lowpass` | ローパス | カットオフ以下の周波数を通過、以上を減衰（12dB/oct） | カットオフ周波数 | 共振の鋭さ | -- |
| `highpass` | ハイパス | カットオフ以上の周波数を通過、以下を減衰（12dB/oct） | カットオフ周波数 | 共振の鋭さ | -- |
| `bandpass` | バンドパス | 中心周波数付近の帯域のみ通過、それ以外を減衰 | 中心周波数 | 帯域幅制御 | -- |
| `lowshelf` | ローシェルフ | 指定周波数以下を一様にブースト/カット | 上限周波数 | -- | dB値 |
| `highshelf` | ハイシェルフ | 指定周波数以上を一様にブースト/カット | 下限周波数 | -- | dB値 |
| **`peaking`** | **ピーキング** | **中心周波数付近をブースト/カット** | **中心周波数** | **帯域幅制御** | **dB値** |
| **`notch`** | **ノッチ** | **中心周波数付近を除去（バンドリジェクト）** | **中心周波数** | **帯域幅制御** | -- |
| `allpass` | オールパス | 全周波数を通過、位相のみ変更 | 最大群遅延周波数 | 遷移の鋭さ | -- |

> **本プロジェクトで使用するのは `peaking`、`notch`、`lowpass` の3種類**（太字で強調した項目を含む）。これらのフィルタには鋸歯状波オシレータとピンクノイズ（ブレシネス用）の両方が並列接続される。

### 1.2 各タイプの詳細

#### lowpass（ローパスフィルタ）

高周波成分を除去するフィルタ。声道モデルにおいて、高周波の放射特性をシミュレートする際に使用する。

```javascript
const lpf = audioCtx.createBiquadFilter();
lpf.type = 'lowpass';
lpf.frequency.value = 7250;  // カットオフ周波数 [Hz]
lpf.Q.value = 0.001;         // 非常に緩やかなロールオフ
// gain は lowpass では使用されない
```

**特性**: 12dB/octave（-12dB/oct）のロールオフ。Q が高いほどカットオフ付近にピークが生じる。

#### highpass（ハイパスフィルタ）

低周波成分を除去するフィルタ。フォルマント合成では直接使わないが、低周波ノイズ除去に有用。

```javascript
const hpf = audioCtx.createBiquadFilter();
hpf.type = 'highpass';
hpf.frequency.value = 80;  // 80Hz 以下をカット
hpf.Q.value = 0.7;
```

#### bandpass（バンドパスフィルタ）

指定した中心周波数の帯域のみを通過させる。ピーキングフィルタの代替手段として検討可能だが、ゲイン制御ができないためフォルマント合成では `peaking` の方が適切。

```javascript
const bpf = audioCtx.createBiquadFilter();
bpf.type = 'bandpass';
bpf.frequency.value = 1000;
bpf.Q.value = 5;  // Q が高いほど帯域が狭い
```

#### peaking（ピーキングフィルタ）-- フォルマント合成の核心

中心周波数を中心にベル型のブースト/カットを行う。**フォルマント（共鳴周波数）のモデリングに最適**。

```javascript
const f1 = audioCtx.createBiquadFilter();
f1.type = 'peaking';
f1.frequency.value = 500;   // F1 = 500Hz
f1.Q.value = 0.2;           // 帯域幅（低いQ = 広い帯域）
f1.gain.value = 60;         // 60dB のブースト
```

#### notch（ノッチフィルタ / バンドリジェクト）

特定の周波数帯域を除去する。声道の**反フォルマント**（零点）をモデリングするために使用。

```javascript
const bef = audioCtx.createBiquadFilter();
bef.type = 'notch';
bef.frequency.value = 5000;  // 5kHz 付近を除去
bef.Q.value = 0.2;           // 除去帯域の幅
// gain は notch では使用されない
```

#### lowshelf / highshelf（シェルフフィルタ）

指定周波数の上/下を一様にブースト/カットする。イコライザ的な使い方に向く。フォルマント合成では直接使わないが、全体の音色調整に使える。

#### allpass（オールパスフィルタ）

振幅は変えず位相のみを変化させる。単体では音色変化が分かりにくいが、他のフィルタと組み合わせて位相キャンセレーションを実現する用途がある。

---

## 2. ピーキングフィルタの実装

### 2.1 パラメータの意味

ピーキングフィルタの3つのパラメータは、フォルマント合成において以下の音響学的意味を持つ。

| パラメータ | AudioParam | 意味 | 単位 | 音響学的対応 |
|-----------|-----------|------|------|-------------|
| `frequency` | a-rate | 共鳴の中心周波数 | Hz | フォルマント周波数 (F1, F2, F3, F4) |
| `Q` | a-rate | 共鳴の帯域幅（逆数的） | 無次元 | 声道の減衰特性。低Q=広帯域=開いた声道 |
| `gain` | a-rate | 共鳴のピーク強度 | dB | フォルマントの振幅。高ゲイン=強い共鳴 |

### 2.2 Q値の解釈

Q（Quality Factor）は中心周波数と帯域幅の比率として定義される：

```
Q = f_center / bandwidth
```

- **低い Q (0.1--1.0)**: 広い帯域幅。母音の低次フォルマント（F1, F2）に適する。
- **高い Q (1.0--10.0)**: 狭い帯域幅。高次フォルマント（F3, F4）に適する。

> **注意**: Web Audio API の peaking フィルタにおける Q は、値が大きいほど帯域が**狭く**なる。要件定義書の Q=0.2 は非常に広い帯域を意味し、フォルマントの緩やかな共鳴をモデル化する。

### 2.3 母音合成でのベースライン値

本プロジェクトの要件に基づく6つのフィルタの設定値。**注意**: 現行実装では、これらの Q 値・ゲイン値は音声プリセットごとに動的に変化する（[セクション 9](#9-音声プリセットシステム) 参照）。以下は「通常」プリセット（男声）のベースライン値である。

```javascript
// === F1 フォルマント（第1フォルマント）===
// マウスY座標で 250--1000 Hz を動的制御
// 周波数にはプリセットの scale 係数が乗算される
const F1F = audioCtx.createBiquadFilter();
F1F.type = 'peaking';
F1F.frequency.value = 500;   // 初期値（母音 /a/ 付近）× scale
F1F.Q.value = 0.2;           // 広い帯域幅（プリセットで可変）
F1F.gain.value = 60;         // 60dB ブースト（プリセットで可変）

// === F2 フォルマント（第2フォルマント）===
// マウスX座標で 540--2600 Hz を動的制御
// 周波数にはプリセットの scale 係数が乗算される
const F2F = audioCtx.createBiquadFilter();
F2F.type = 'peaking';
F2F.frequency.value = 1500;  // 初期値 × scale
F2F.Q.value = 0.4;           // F1 よりやや狭い帯域（プリセットで可変）
F2F.gain.value = 60;         // 60dB ブースト（プリセットで可変）

// === F3 フォルマント（第3フォルマント）===
// 基本周波数 2500 Hz × scale
const F3F = audioCtx.createBiquadFilter();
F3F.type = 'peaking';
F3F.frequency.value = 2500;  // 基本値（× scale で動的変化）
F3F.Q.value = 0.8;           // さらに狭い帯域（プリセットで可変）
F3F.gain.value = 50;         // 50dB ブースト（プリセットで可変）

// === F4 フォルマント（第4フォルマント）===
// 基本周波数 3500 Hz × scale
const F4F = audioCtx.createBiquadFilter();
F4F.type = 'peaking';
F4F.frequency.value = 3500;  // 基本値（× scale で動的変化）
F4F.Q.value = 1.0;           // 最も狭い帯域（プリセットで可変）
F4F.gain.value = 40;         // 40dB ブースト（プリセットで可変）

// === 反フォルマント（ノッチ）===
// 基本周波数 5000 Hz × scale
const BEF = audioCtx.createBiquadFilter();
BEF.type = 'notch';
BEF.frequency.value = 5000;  // 基本値（× scale で動的変化）
BEF.Q.value = 0.2;

// === ローパスフィルタ ===
// 基本周波数 7250 Hz × scale
const LPF = audioCtx.createBiquadFilter();
LPF.type = 'lowpass';
LPF.frequency.value = 7250;  // 基本値（× scale で動的変化）
LPF.Q.value = 0.001;
```

### 2.4 主要母音のフォルマント値（参考）

| 母音 (IPA) | F1 [Hz] | F2 [Hz] | 口の形 |
|------------|---------|---------|--------|
| /i/ | 270 | 2300 | 閉・前舌 |
| /e/ | 400 | 2000 | 半閉・前舌 |
| /a/ | 750 | 1200 | 開・中舌 |
| /o/ | 500 | 800 | 半閉・後舌・円唇 |
| /u/ | 300 | 650 | 閉・後舌・円唇 |

### 2.5 ゲイン値の設計思想

60dB という高いゲイン値は、並列接続構成において必要となる。

- **並列接続**ではフィルタ出力が合算される
- 個々のフィルタは中心周波数付近のみを大きくブーストし、他の帯域はほぼ通過させない
- peaking フィルタの「通過帯域」は 0dB（増減なし）であり、ブーストされるのは中心周波数付近のみ
- 60dB のゲインにより、フォルマント共鳴のピークが十分に際立つ
- 最終的な振幅はオシレータの amp（0.002）で制御され、クリッピングを防止する

---

## 3. OscillatorNode

### 3.1 概要

`OscillatorNode` は周期波形を生成するノード。フォルマント合成における**音源**（声帯振動の近似）として使用する。

継承チェーン：`EventTarget` → `AudioNode` → `AudioScheduledSourceNode` → `OscillatorNode`

### 3.2 波形タイプ

| タイプ | 波形 | 倍音構成 | 用途 |
|--------|------|---------|------|
| `sine` | 正弦波 | 基音のみ | 純音、テスト |
| `square` | 矩形波 | 奇数倍音のみ | クラリネット的音色 |
| **`sawtooth`** | **鋸歯状波** | **全倍音（1/n 減衰）** | **グロッタルパルス近似に最適** |
| `triangle` | 三角波 | 奇数倍音（1/n^2 減衰） | フルート的音色 |
| `custom` | カスタム | PeriodicWave で定義 | 任意の波形 |

#### なぜ鋸歯状波か

声帯振動（グロッタルパルス）は非対称な波形で、全倍音を含む。鋸歯状波は全倍音を自然な減衰率（1/n）で含むため、声帯振動の最も簡便な近似となる。

### 3.3 基本周波数の設定

```javascript
const osc = audioCtx.createOscillator();
osc.type = 'sawtooth';

// 基本周波数の設定方法

// 方法 1: value プロパティで直接設定
osc.frequency.value = 131;  // C3 = 131 Hz

// 方法 2: setValueAtTime でスケジューリング
osc.frequency.setValueAtTime(131, audioCtx.currentTime);

// 方法 3: コンストラクタで指定
const osc2 = new OscillatorNode(audioCtx, {
  type: 'sawtooth',
  frequency: 131
});
```

### 3.4 ライフサイクル管理

```javascript
// 開始
osc.start();  // 即座に開始
osc.start(audioCtx.currentTime + 0.5);  // 0.5秒後に開始

// 停止
osc.stop();
osc.stop(audioCtx.currentTime + 2);  // 2秒後に停止
```

> **重要**: `OscillatorNode` は一度 `stop()` した後に再度 `start()` することはできない。再利用する場合は新しいインスタンスを作成するか、`GainNode` で音量を0にして「擬似停止」する方法を取る。本プロジェクトではオシレータは常に発音状態にし、`GainNode` のフェードイン/フェードアウトで発音を制御する。

### 3.5 p5.sound での対応コード

```javascript
// p5.sound (p5.Oscillator) を使用した場合
let osc = new p5.Oscillator('sawtooth');
osc.freq(131);
osc.amp(0);  // 初期音量は0
osc.start();

// 上記は内部的に以下と等価:
// const oscNode = audioCtx.createOscillator();
// oscNode.type = 'sawtooth';
// oscNode.frequency.value = 131;
// oscNode.start();
```

---

## 4. GainNode

### 4.1 概要

`GainNode` は入力信号に対してゲイン（振幅倍率）を適用するノード。フォルマント合成では以下の用途で使用する：

1. **オシレータの振幅制御**: マウス押下/リリースに応じたフェードイン/フェードアウト
2. **フィルタ出力の合算**: 並列フィルタの出力をミキシング

### 4.2 基本的な使い方

```javascript
const gainNode = audioCtx.createGain();

// ゲイン値の設定
gainNode.gain.value = 0.5;  // 50% の音量

// スケジューリングによる設定（推奨）
gainNode.gain.setValueAtTime(0.5, audioCtx.currentTime);
```

### 4.3 linearRampToValueAtTime によるフェードイン/フェードアウト

フォルマント合成において最も重要な GainNode の機能。クリックノイズを防ぎ、滑らかな発音開始/停止を実現する。

#### フェードインの実装

```javascript
function startSound() {
  // 現在値をアンカーポイントとして設定（必須）
  gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
  // 0.1秒かけて目標値に線形ランプ
  gainNode.gain.linearRampToValueAtTime(0.002, audioCtx.currentTime + 0.1);
}
```

#### フェードアウトの実装

```javascript
function stopSound() {
  // 現在値をアンカーポイントとして設定（必須）
  gainNode.gain.setValueAtTime(gainNode.gain.value, audioCtx.currentTime);
  // 0.1秒かけて0に線形ランプ
  gainNode.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
}
```

### 4.4 setValueAtTime がアンカーポイントとして必要な理由

`linearRampToValueAtTime` は「**直前のスケジュールイベントの値から**」ランプを開始する。`setValueAtTime` でアンカーポイントを明示的に設定しないと、ランプの開始点が不定となり、予期しない挙動になる。

```javascript
// NG: アンカーなし -- ランプの開始点が不定
gainNode.gain.linearRampToValueAtTime(0.002, audioCtx.currentTime + 0.1);

// OK: アンカーあり -- 明確に 0 から開始
gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
gainNode.gain.linearRampToValueAtTime(0.002, audioCtx.currentTime + 0.1);
```

### 4.5 振幅値 0.002 の意味

本プロジェクトでは最大振幅を `0.002` に設定している。これは以下の理由による：

- 6つの並列フィルタの出力が合算されるため、個々のゲインは小さくても合計で十分な音量になる
- peaking フィルタの 60dB ゲインにより信号が大幅に増幅されるため、入力側で振幅を抑える必要がある
- クリッピング（波形の頭打ち）による歪みを防止する

### 4.6 AudioParam のスケジューリングメソッド一覧

| メソッド | 動作 | 用途 |
|---------|------|------|
| `setValueAtTime(v, t)` | 時刻 t に値を v に即座設定 | アンカーポイント |
| `linearRampToValueAtTime(v, t)` | 前イベントから時刻 t まで線形補間 | フェードイン/アウト |
| `exponentialRampToValueAtTime(v, t)` | 前イベントから時刻 t まで指数補間 | より自然な音量変化 |
| `setTargetAtTime(v, t, tc)` | 時刻 t から時定数 tc で目標値 v に接近 | 漸近的変化 |
| `setValueCurveAtTime(vals, t, dur)` | 値配列に沿って変化 | 任意のエンベロープ |
| `cancelScheduledValues(t)` | 時刻 t 以降のスケジュールをキャンセル | リセット |
| `cancelAndHoldAtTime(t)` | 時刻 t でキャンセルし現在値を保持 | 中断 |

---

## 5. フィルタの並列接続

### 5.1 直列接続 vs 並列接続

フォルマント合成において、フィルタの接続方式は音質に大きく影響する。

```
■ 直列接続（カスケード接続）:
  osc → F1 → F2 → F3 → F4 → BEF → LPF → destination

  - 各フィルタが前段の出力を受ける
  - フィルタ間の相互作用がある
  - 声道の物理モデルに近い

■ 並列接続（本プロジェクトの方式）:
  osc ──┬──► F1 → destination
  noise ─┤
  osc ──┼──► F2 → destination
  noise ─┤
  osc ──┼──► F3 → destination
  noise ─┤
         ...（F4, BEF, LPF も同様）

  - 各フィルタが独立にオシレータとノイズの両方の出力を受ける
  - フィルタ出力が destination で加算合成される
  - 各フォルマントの独立制御が容易
```

### 5.2 並列接続の実装（素の Web Audio API）

```javascript
const audioCtx = new AudioContext();

// --- 音源 ---
const osc = audioCtx.createOscillator();
osc.type = 'sawtooth';
osc.frequency.value = 131;

// --- マスターゲイン（振幅制御）---
const masterGain = audioCtx.createGain();
masterGain.gain.value = 0;  // 初期値は無音

// --- フィルタ群 ---
const F1F = audioCtx.createBiquadFilter();
F1F.type = 'peaking'; F1F.frequency.value = 500;  F1F.Q.value = 0.2; F1F.gain.value = 60;

const F2F = audioCtx.createBiquadFilter();
F2F.type = 'peaking'; F2F.frequency.value = 1500; F2F.Q.value = 0.4; F2F.gain.value = 60;

const F3F = audioCtx.createBiquadFilter();
F3F.type = 'peaking'; F3F.frequency.value = 2500; F3F.Q.value = 0.8; F3F.gain.value = 50;

const F4F = audioCtx.createBiquadFilter();
F4F.type = 'peaking'; F4F.frequency.value = 3500; F4F.Q.value = 1.0; F4F.gain.value = 40;

const BEF = audioCtx.createBiquadFilter();
BEF.type = 'notch';   BEF.frequency.value = 5000; BEF.Q.value = 0.2;

const LPF = audioCtx.createBiquadFilter();
LPF.type = 'lowpass';  LPF.frequency.value = 7250; LPF.Q.value = 0.001;

// --- 並列接続 ---
// osc → masterGain → 各フィルタ → destination
osc.connect(masterGain);

const filters = [F1F, F2F, F3F, F4F, BEF, LPF];
filters.forEach(filter => {
  masterGain.connect(filter);         // masterGain の出力を各フィルタに分配
  filter.connect(audioCtx.destination); // 各フィルタの出力を destination に合流
});

// 開始
osc.start();
```

### 5.3 接続のポイント

**ファンアウト（1対多接続）**:
`AudioNode.connect()` を複数回呼ぶと、同じ出力を複数の宛先に分配できる。信号はコピーされ、各宛先に同一の信号が届く。

```javascript
// 1つのソースを複数のフィルタに接続
masterGain.connect(F1F);  // masterGain → F1F
masterGain.connect(F2F);  // masterGain → F2F（F1F への接続は維持される）
masterGain.connect(F3F);  // masterGain → F3F
```

**ファンイン（多対1接続）**:
複数のノードを同じ `destination` に接続すると、信号は**加算**（ミキシング）される。

```javascript
// 複数のフィルタ出力を1つの出力先に合流
F1F.connect(audioCtx.destination);  // F1F の出力が destination に加算
F2F.connect(audioCtx.destination);  // F2F の出力も加算
F3F.connect(audioCtx.destination);  // F3F の出力も加算
```

### 5.4 接続構成図

初期実装（鋸歯状波のみ）:

```
                    ┌──► [F1F peaking] ──┐
                    │                     │
                    ├──► [F2F peaking] ──┤
                    │                     │
[Osc sawtooth] ──► [GainNode] ──┼──► [F3F peaking] ──┼──► [destination]
  131 Hz            amp=0.002    │                     │    (スピーカー)
                    │            ├──► [F4F peaking] ──┤
                    │            │                     │
                    │            ├──► [BEF notch]   ──┤
                    │            │                     │
                    │            └──► [LPF lowpass] ──┘
```

現行実装（ピンクノイズ追加後、[セクション 9](#9-音声プリセットシステム) 参照）:

```
                         ┌──► [F1F peaking] ──┐
                         │                     │
                         ├──► [F2F peaking] ──┤
                         │                     │
[Osc sawtooth] ────┬────┼──► [F3F peaking] ──┼──► [destination]
  f0 Hz (可変)      │    │                     │    (スピーカー)
                    │    ├──► [F4F peaking] ──┤
                    │    │                     │
                    │    ├──► [BEF notch]   ──┤
                    │    │                     │
                    │    └──► [LPF lowpass] ──┘
                    │              ↑
[Noise pink] ──────┘──────────────┘
  amp = AMP * breath * 0.5
```

鋸歯状波とピンクノイズは同一のフィルタチェーンに並列接続される。ノイズの振幅はプリセットの `breath` パラメータで制御され、声のかすれ具合（ブレシネス）を表現する。

### 5.5 p5.sound での並列接続

p5.sound では `disconnect()` と `connect()` を使って並列接続を実現する。現行実装では鋸歯状波オシレータとピンクノイズの両方を同一フィルタチェーンに接続する：

```javascript
let osc, noise, F1F, F2F, F3F, F4F, BEF, LPF;

function setup() {
  osc = new p5.Oscillator('sawtooth');
  osc.freq(131);
  osc.amp(0);
  osc.start();
  osc.disconnect();  // デフォルト出力を切断

  // ブレシネス用ピンクノイズ
  noise = new p5.Noise('pink');
  noise.start();
  noise.amp(0);
  noise.disconnect();

  // フィルタ生成
  F1F = new p5.Filter('peaking');
  F2F = new p5.Filter('peaking');
  F3F = new p5.Filter('peaking');
  F4F = new p5.Filter('peaking');
  BEF = new p5.Filter('notch');
  LPF = new p5.Filter('lowpass');

  // 並列接続: osc と noise の両方を各フィルタに接続
  osc.connect(F1F);  osc.connect(F2F);  osc.connect(F3F);
  osc.connect(F4F);  osc.connect(BEF);  osc.connect(LPF);

  noise.connect(F1F); noise.connect(F2F); noise.connect(F3F);
  noise.connect(F4F); noise.connect(BEF); noise.connect(LPF);
}
```

---

## 6. AudioContext の初期化

### 6.1 ユーザージェスチャー要件

モダンブラウザ（Chrome 66+、Safari、Firefox）では、**ユーザージェスチャー（クリック、タップ等）なしに音声を再生することが禁止**されている（Autoplay Policy）。AudioContext を作成しただけでは `state` が `'suspended'` になり、音声が出力されない。

### 6.2 初期化パターン

#### パターン A: ユーザージェスチャー内で作成

```javascript
document.querySelector('button').addEventListener('click', () => {
  const audioCtx = new AudioContext();
  // ここで audioCtx.state === 'running' になる
});
```

#### パターン B: 事前作成 + resume()（推奨）

```javascript
const audioCtx = new AudioContext();

// 初回のユーザーインタラクション時に resume
document.addEventListener('click', async () => {
  if (audioCtx.state === 'suspended') {
    await audioCtx.resume();
  }
}, { once: true });
```

#### パターン C: p5.js での扱い

p5.js では `userStartAudio()` を使用する。これは内部的に `getAudioContext().resume()` を呼ぶ。

```javascript
function setup() {
  createCanvas(500, 400);

  // ユーザーがキャンバスをクリック/タッチした時に音声コンテキストを開始
  userStartAudio();

  // または明示的に
  getAudioContext().resume();
}

function mousePressed() {
  // p5.sound は mousePressed 内で自動的に resume を試みる
  // 明示的に書く場合:
  if (getAudioContext().state !== 'running') {
    getAudioContext().resume();
  }
}
```

### 6.3 state の遷移

```
suspended ──(resume())──► running ──(suspend())──► suspended
    │                         │
    └──(close())──► closed ◄──┘
```

### 6.4 コンストラクタオプション

```javascript
const audioCtx = new AudioContext({
  latencyHint: 'interactive',  // リアルタイム用途に最適化
  sampleRate: 44100            // サンプルレート（省略可）
});
```

| latencyHint | 用途 | レイテンシ | 消費電力 |
|-------------|------|-----------|---------|
| `'interactive'` | リアルタイム音声（ゲーム、楽器） | 最小 | 最大 |
| `'balanced'` | バランス重視 | 中程度 | 中程度 |
| `'playback'` | 音楽再生 | 大きい | 最小 |
| `数値 (秒)` | カスタム指定 | 指定値 | -- |

### 6.5 初期化後の確認

```javascript
console.log(audioCtx.state);        // 'running' or 'suspended'
console.log(audioCtx.sampleRate);   // 44100 (通常)
console.log(audioCtx.baseLatency);  // 基本レイテンシ (秒)
console.log(audioCtx.outputLatency); // 出力レイテンシ (秒)
```

---

## 7. レイテンシの最小化

### 7.1 レイテンシの構成要素

Web Audio API におけるレイテンシは以下の3層で構成される：

```
[JavaScript 処理] → [Audio Processing Thread] → [OS/Hardware Buffer] → [スピーカー]
    (1)                    (2)                        (3)
```

1. **JavaScript スレッドの遅延**: イベントハンドラの実行遅延
2. **Audio Processing の遅延**: AudioContext の内部バッファサイズ
3. **出力バッファの遅延**: OS・デバイスドライバのバッファ

### 7.2 ベストプラクティス

#### (1) AudioContext のレイテンシヒント

```javascript
// リアルタイム制御には 'interactive' を指定
const audioCtx = new AudioContext({ latencyHint: 'interactive' });
```

#### (2) AudioParam のスケジューリングを活用

`AudioParam` のメソッド（`setValueAtTime`、`linearRampToValueAtTime` 等）はオーディオスレッド上でサンプル精度で実行されるため、JavaScript メインスレッドの遅延に影響されない。

```javascript
// NG: JavaScript スレッドに依存（GC やレイアウトで遅延する可能性）
setInterval(() => {
  gainNode.gain.value = computeNewValue();
}, 16);

// OK: オーディオスレッドでサンプル精度の制御
gainNode.gain.setValueAtTime(0, audioCtx.currentTime);
gainNode.gain.linearRampToValueAtTime(0.002, audioCtx.currentTime + 0.1);
```

#### (3) フィルタパラメータの直接設定

フォルマント周波数のリアルタイム更新では、`setValueAtTime` ではなく `.value` プロパティへの直接代入が最もシンプルで低レイテンシ：

```javascript
function mouseDragged() {
  // マウス位置から周波数を計算
  const f1Hz = pixelToHz(mouseY, 250, 1000, plotTop, plotBottom);
  const f2Hz = pixelToHz(mouseX, 540, 2600, plotRight, plotLeft);

  // 直接代入（次のオーディオフレームから反映）
  F1F.frequency.value = f1Hz;
  F2F.frequency.value = f2Hz;
}
```

> `.value` への代入は「即座に」値を変更するため、パラメータのスムージングは行われない。マウスの連続移動では十分に滑らかな更新が得られるが、大きなジャンプ時にはクリックノイズが発生する可能性がある。必要に応じて `setTargetAtTime` で短い時定数のスムージングを加える。

```javascript
// 5ms のスムージングでクリックノイズを軽減
F1F.frequency.setTargetAtTime(f1Hz, audioCtx.currentTime, 0.005);
F2F.frequency.setTargetAtTime(f2Hz, audioCtx.currentTime, 0.005);
```

#### (4) ノード生成の最小化

オーディオノードの生成はメインスレッドで行われるため、リアルタイムループ内で行わない。すべてのノードは初期化時に生成し、パラメータ変更のみをリアルタイムで行う。

```javascript
// NG: 毎フレームでノードを再生成
function draw() {
  let newFilter = audioCtx.createBiquadFilter();  // 重い
  newFilter.connect(audioCtx.destination);
}

// OK: 初期化時に一度だけ生成、パラメータのみ更新
function setup() {
  F1F = audioCtx.createBiquadFilter();  // 一度だけ
}
function draw() {
  F1F.frequency.value = newFreq;  // パラメータ更新のみ
}
```

#### (5) requestAnimationFrame との同期

p5.js の `draw()` は `requestAnimationFrame` ベースで約 60fps で呼ばれる。この中でフィルタパラメータを更新すれば、約 16.7ms 間隔での更新となり、聴覚的にはほぼリアルタイムに感じられる。

### 7.3 レイテンシの測定

```javascript
const audioCtx = new AudioContext({ latencyHint: 'interactive' });

console.log('Base latency:', audioCtx.baseLatency * 1000, 'ms');
console.log('Output latency:', audioCtx.outputLatency * 1000, 'ms');
console.log('Total estimated:', (audioCtx.baseLatency + audioCtx.outputLatency) * 1000, 'ms');
```

典型的な値:
- Chrome (Windows): baseLatency 約 5.8ms, outputLatency 約 10ms
- 合計: 約 15--20ms（要件の < 20ms 目標を達成可能）

---

## 8. p5.sound でのラッパー

### 8.1 対応表

p5.sound ライブラリは Web Audio API のノードを p5.js 風のインターフェースでラップしている。

| p5.sound クラス | Web Audio API ノード | 主な対応関係 |
|----------------|---------------------|-------------|
| `p5.Oscillator` | `OscillatorNode` + `GainNode` | 内部に OscillatorNode と 2つの GainNode を持つ |
| `p5.Filter` | `BiquadFilterNode` | 内部に BiquadFilterNode を持つ |
| `p5.Gain` | `GainNode` | 薄いラッパー |
| `p5.Amplitude` | `AnalyserNode` | 振幅解析用 |
| `p5.FFT` | `AnalyserNode` | スペクトル解析用 |
| **`p5.Noise`** | **`AudioBufferSourceNode`** | **ホワイト/ピンク/ブラウンノイズ（ブレシネス用に使用）** |
| `p5.Env` | `GainNode` + AudioParam スケジューリング | ADSR エンベロープ |

### 8.2 p5.Oscillator の内部構造

`p5.Oscillator` は単なる `OscillatorNode` のラッパーではなく、複数のノードで構成される。

```
内部構造:
[OscillatorNode] → [GainNode (amplitude)] → [GainNode (output)] → [p5.soundOut]

- OscillatorNode: 波形生成
- amplitude GainNode: amp() メソッドで制御される振幅
- output GainNode: connect/disconnect で使用される出力ノード
```

#### 主要メソッドとの対応

```javascript
const osc = new p5.Oscillator('sawtooth');

// --- 波形タイプ ---
osc.setType('sawtooth');
// → 内部: this.oscillator.type = 'sawtooth';

// --- 周波数 ---
osc.freq(131);
// → 内部: this.oscillator.frequency.value = 131;
// または this.oscillator.frequency.setValueAtTime(131, ...);

// --- 振幅 ---
osc.amp(0.002);
// → 内部: this.output.gain.value を設定
// rampTime 引数あり: linearRampToValueAtTime を使用
osc.amp(0.002, 0.1);
// → 内部: this.output.gain.linearRampToValueAtTime(0.002, now + 0.1);

// --- 開始/停止 ---
osc.start();
// → 内部: this.oscillator.start();

osc.stop();
// → 内部: this.oscillator.stop(); 後に新しい OscillatorNode を作成

// --- 接続 ---
osc.disconnect();
// → 内部: this.output.disconnect();

osc.connect(destination);
// → 内部: this.output.connect(destination.input || destination);
```

### 8.3 p5.Filter の内部構造

```
内部構造:
[input (GainNode)] → [BiquadFilterNode] → [output (GainNode)]

- input: connect の受け口
- BiquadFilterNode: 実際のフィルタ処理
- output: 出力ノード
```

#### 主要メソッドとの対応

```javascript
const filter = new p5.Filter('peaking');

// --- フィルタタイプ ---
filter.setType('peaking');
// → 内部: this.biquad.type = 'peaking';

// --- 周波数 ---
filter.freq(500);
// → 内部: this.biquad.frequency.value = 500;

// --- Q値（レゾナンス）---
filter.res(0.2);
// → 内部: this.biquad.Q.value = 0.2;

// --- ゲイン ---
filter.gain(60);
// → 内部: this.biquad.gain.value = 60;

// --- 一括設定 ---
filter.set(500, 0.2, 60);
// → freq, res, gain を一度に設定
```

### 8.4 p5.sound で直接 Web Audio API ノードにアクセスする

p5.sound のオブジェクトから内部の Web Audio API ノードに直接アクセスすることも可能。パフォーマンスクリティカルな場面で有用。

```javascript
// p5.Oscillator の内部ノードにアクセス
const rawOsc = osc.oscillator;           // OscillatorNode
const rawFreq = osc.oscillator.frequency; // AudioParam

// p5.Filter の内部ノードにアクセス
const rawBiquad = filter.biquad;          // BiquadFilterNode
const rawFilterFreq = filter.biquad.frequency; // AudioParam

// AudioContext への直接アクセス
const audioCtx = getAudioContext();
```

### 8.5 p5.sound を使う利点と制約

**利点**:
- p5.js のライフサイクル（setup/draw/mousePressed 等）とシームレスに統合
- `amp(value, rampTime)` でフェード処理が簡潔に書ける
- `userStartAudio()` で AudioContext の resume が簡単
- `connect()` / `disconnect()` が p5 オブジェクト同士で使える

**制約**:
- p5.sound の Filter は peaking タイプの `gain` 設定が `set()` メソッド経由でのみ可能な場合がある（バージョンによる）
- パフォーマンスクリティカルな場面では、内部ノードに直接アクセスする方が確実
- `OscillatorNode` を stop/start する際、p5.Oscillator は内部で新しいノードを再作成する

---

## 9. 音声プリセットシステム

音声プリセットシステムにより、単一のフォルマント合成器で多様な声質（男声、女声、可愛い声、アニメ声）を表現できる。kawaii-voice-changer 研究 (arXiv:2507.06235) の知見に基づく。

### 9.1 プリセットの構造

各プリセットは以下のパラメータを持つ：

```javascript
const PRESETS = [
  { name: "通常",     f0: 131, scale: 1.0,  breath: 0,    vibDepth: 0, vibRate: 5.5,
    q: [0.2, 0.4, 0.8, 1.0], gain: [60, 60, 50, 40] },
  { name: "女声",     f0: 220, scale: 1.15, breath: 0.15, vibDepth: 1.5, vibRate: 5.5,
    q: [0.2, 0.4, 0.85, 1.0], gain: [58, 58, 55, 45] },
  { name: "可愛い声", f0: 280, scale: 1.3,  breath: 0.2,  vibDepth: 3, vibRate: 5.0,
    q: [0.2, 0.4, 0.9, 1.1], gain: [52, 55, 58, 52] },
  { name: "アニメ声", f0: 330, scale: 1.5,  breath: 0.25, vibDepth: 4, vibRate: 5.0,
    q: [0.2, 0.45, 1.0, 1.2], gain: [48, 52, 58, 55] },
];
```

| パラメータ | 型 | 説明 |
|-----------|-----|------|
| `f0` | Hz | 基本周波数（声帯振動の周波数）。高いほど声が高い |
| `scale` | 1.0--1.5 | フォルマント周波数のスケーリング係数 |
| `breath` | 0--1 | ピンクノイズの混合量（ブレシネス）|
| `vibDepth` | Hz | ビブラートの深さ（周波数偏差）|
| `vibRate` | Hz | ビブラートの速度 |
| `q` | [F1, F2, F3, F4] | 各フォルマントフィルタの Q 値 |
| `gain` | [F1, F2, F3, F4] | 各フォルマントフィルタのゲイン (dB) |

### 9.2 ピンクノイズによるブレシネス

ブレシネス（息もれ感）は、ピンクノイズ (`p5.Noise("pink")`) を鋸歯状波オシレータと同一のフィルタチェーンに並列接続することで実現する。

```javascript
// 初期化
noise = new p5.Noise("pink");
noise.start();
noise.amp(0);
noise.disconnect();

// フィルタへの並列接続（osc と同じ6つのフィルタに接続）
noise.connect(F1F);
noise.connect(F2F);
noise.connect(F3F);
noise.connect(F4F);
noise.connect(BEF);
noise.connect(LPF);

// 発音時: プリセットの breath 値に応じてノイズ振幅を設定
noise.amp(AMP * preset.breath * 0.5, FADE_TIME);
```

**ピンクノイズを選択した理由**: ピンクノイズは 1/f 特性（低周波ほどパワーが大きい）を持ち、声の息もれ成分の周波数分布に近い。ホワイトノイズ（全周波数均一）よりも自然なブレシネスが得られる。

**振幅の設計**: ノイズ振幅は `AMP * breath * 0.5` で計算される。`breath` が 0 なら無音、0.25 で最大。0.5 の係数はオシレータとのバランス調整用。

### 9.3 フォルマントスケーリング

プリセットの `scale` パラメータ（1.0--1.5）は、すべてのフォルマント周波数に乗算される。これにより声道長の変化をシミュレートする。

```javascript
function updateFormants(px, py) {
  let p = PRESETS[currentPreset];
  let s = p.scale;

  // F1, F2: マウス座標から算出した周波数 × scale
  F1F.set(yToF1(py) * s, p.q[0]);
  F1F.gain(p.gain[0]);
  F2F.set(xToF2(px) * s, p.q[1]);
  F2F.gain(p.gain[1]);

  // F3, F4, BEF, LPF: 基本固定値 × scale
  F3F.set(2500 * s, p.q[2]);
  F3F.gain(p.gain[2]);
  F4F.set(3500 * s, p.q[3]);
  F4F.gain(p.gain[3]);
  BEF.set(5000 * s, 0.2);
  LPF.set(7250 * s, 0.001);
}
```

**音響学的背景**: 女性の声道は男性より約 15--20% 短い。声道が短いほどフォルマント周波数が高くなる。`scale: 1.15`（女声）は約 15% のフォルマント上昇に対応し、`scale: 1.5`（アニメ声）はさらに誇張された短い声道を模倣する。

| プリセット | scale | F3 実効値 | F4 実効値 | BEF 実効値 | LPF 実効値 |
|-----------|-------|----------|----------|-----------|-----------|
| 通常      | 1.0   | 2500 Hz  | 3500 Hz  | 5000 Hz   | 7250 Hz   |
| 女声      | 1.15  | 2875 Hz  | 4025 Hz  | 5750 Hz   | 8338 Hz   |
| 可愛い声  | 1.3   | 3250 Hz  | 4550 Hz  | 6500 Hz   | 9425 Hz   |
| アニメ声  | 1.5   | 3750 Hz  | 5250 Hz  | 7500 Hz   | 10875 Hz  |

### 9.4 プリセットごとの動的フィルタパラメータ

従来の固定値（Q: [0.2, 0.4, 0.8, 1.0]、ゲイン: [60, 60, 50, 40]）に対し、プリセットごとに Q 値とゲインを変化させることで声質を分化する。

**Q 値の設計指針**:
- F1, F2 の Q は全プリセットで低め (0.2--0.45) を維持し、広い共鳴帯域を確保
- F3, F4 の Q はプリセットが高い声ほど大きくなり (0.8--1.2)、高周波フォルマントの共鳴をシャープにする
- これにより高い声ほど「明瞭で鋭い」音色が得られる

**ゲインの設計指針**:
- 通常（男声）では F1, F2 のゲインが大きく (60dB)、低次フォルマントが支配的
- 高い声のプリセットでは F3, F4 のゲインが相対的に増加し (52--58dB)、高周波成分が強調される
- これは声道長の短縮に伴い高周波共鳴が強くなる現象を反映している

### 9.5 ビブラート

ビブラートは `draw()` ループ内で `Math.sin` による正弦波変調をオシレータの基本周波数に適用して実装する。

```javascript
// draw() ループ内
if (playing && preset.vibDepth > 0) {
  let vibOffset = preset.vibDepth * Math.sin(TWO_PI * preset.vibRate * millis() / 1000);
  osc.freq(preset.f0 + vibOffset);
}
```

**パラメータの解釈**:
- `vibRate` (Hz): ビブラートの速度。5.0--5.5 Hz は歌唱における自然なビブラート速度に近い
- `vibDepth` (Hz): 周波数偏差の最大値。例えば f0=280 Hz, vibDepth=3 なら 277--283 Hz の間で振動する
- 通常プリセット (`vibDepth: 0`) ではビブラートなし
- アニメ声 (`vibDepth: 4`) では最も深いビブラートが適用される

**実装上の注意**: ビブラートは `osc.freq()` を毎フレーム呼び出すことで実現しているため、フレームレート（約 60fps）の分解能に依存する。5 Hz のビブラートは1周期あたり約 12 フレームでサンプリングされ、十分に滑らかな正弦波変調となる。

### 9.6 プリセット切替の実装

プリセット切替時は、基本周波数とノイズ振幅を即座に更新する。フォルマントフィルタのパラメータは次回の `updateFormants()` 呼び出し時（draw ループ内）に自動反映される。

```javascript
function applyPreset(idx) {
  currentPreset = idx;
  let p = PRESETS[idx];
  osc.freq(p.f0);
  if (playing) {
    osc.amp(AMP, FADE_TIME);
    noise.amp(AMP * p.breath * 0.5, FADE_TIME);
  }
}
```

---

## 付録 A: 完全な実装例（素の Web Audio API）

```javascript
// ========================================
// フォルマント母音合成器 - 素の Web Audio API 版
// ========================================

let audioCtx;
let osc, masterGain;
let F1F, F2F, F3F, F4F, BEF, LPF;

function initAudio() {
  audioCtx = new AudioContext({ latencyHint: 'interactive' });

  // --- 音源: 鋸歯状波オシレータ ---
  osc = audioCtx.createOscillator();
  osc.type = 'sawtooth';
  osc.frequency.value = 131;  // C3

  // --- マスターゲイン ---
  masterGain = audioCtx.createGain();
  masterGain.gain.value = 0;  // 初期値: 無音

  // --- フォルマントフィルタ群 ---
  F1F = createPeakingFilter(500, 0.2, 60);
  F2F = createPeakingFilter(1500, 0.4, 60);
  F3F = createPeakingFilter(2500, 0.8, 50);
  F4F = createPeakingFilter(3500, 1.0, 40);

  BEF = audioCtx.createBiquadFilter();
  BEF.type = 'notch';
  BEF.frequency.value = 5000;
  BEF.Q.value = 0.2;

  LPF = audioCtx.createBiquadFilter();
  LPF.type = 'lowpass';
  LPF.frequency.value = 7250;
  LPF.Q.value = 0.001;

  // --- 並列接続 ---
  osc.connect(masterGain);

  [F1F, F2F, F3F, F4F, BEF, LPF].forEach(f => {
    masterGain.connect(f);
    f.connect(audioCtx.destination);
  });

  osc.start();
}

function createPeakingFilter(freq, q, gain) {
  const f = audioCtx.createBiquadFilter();
  f.type = 'peaking';
  f.frequency.value = freq;
  f.Q.value = q;
  f.gain.value = gain;
  return f;
}

function startVoice() {
  if (audioCtx.state === 'suspended') audioCtx.resume();
  masterGain.gain.setValueAtTime(0, audioCtx.currentTime);
  masterGain.gain.linearRampToValueAtTime(0.002, audioCtx.currentTime + 0.1);
}

function stopVoice() {
  masterGain.gain.setValueAtTime(masterGain.gain.value, audioCtx.currentTime);
  masterGain.gain.linearRampToValueAtTime(0, audioCtx.currentTime + 0.1);
}

function updateFormants(f1Hz, f2Hz) {
  F1F.frequency.value = f1Hz;
  F2F.frequency.value = f2Hz;
}

// --- 使用例 ---
// initAudio();           // ページロード時
// startVoice();          // mousePressed
// updateFormants(500, 1500);  // mouseDragged
// stopVoice();           // mouseReleased
```

## 付録 B: 完全な実装例（p5.sound 版）

```javascript
// ========================================
// フォルマント母音合成器 - p5.sound 版
// ========================================

let osc;
let F1F, F2F, F3F, F4F, BEF, LPF;

function setup() {
  createCanvas(500, 400);
  userStartAudio();  // AudioContext の resume をユーザージェスチャーに紐付け

  // --- 音源 ---
  osc = new p5.Oscillator('sawtooth');
  osc.freq(131);
  osc.amp(0);
  osc.start();
  osc.disconnect();  // デフォルト出力を切断

  // --- フォルマントフィルタ ---
  F1F = createPeakingFilter(500, 0.2, 60);
  F2F = createPeakingFilter(1500, 0.4, 60);
  F3F = createPeakingFilter(2500, 0.8, 50);
  F4F = createPeakingFilter(3500, 1.0, 40);

  BEF = new p5.Filter('notch');
  BEF.freq(5000);
  BEF.res(0.2);

  LPF = new p5.Filter('lowpass');
  LPF.freq(7250);
  LPF.res(0.001);

  // --- 並列接続 ---
  [F1F, F2F, F3F, F4F, BEF, LPF].forEach(f => {
    osc.connect(f);
  });
}

function createPeakingFilter(freq, q, gain) {
  const f = new p5.Filter('peaking');
  f.freq(freq);
  f.res(q);
  // p5.Filter で gain を設定（内部の BiquadFilterNode に直接アクセス）
  f.biquad.gain.value = gain;
  return f;
}

function mousePressed() {
  if (mouseInCanvas()) {
    osc.amp(0.002, 0.1);  // 0.1秒フェードイン
  }
}

function mouseReleased() {
  osc.amp(0, 0.1);  // 0.1秒フェードアウト
}

function mouseDragged() {
  if (mouseInCanvas()) {
    const f1Hz = pixelToHz(mouseY, 250, 1000, 50, 350);
    const f2Hz = pixelToHz(mouseX, 540, 2600, 450, 50);
    F1F.freq(f1Hz);
    F2F.freq(f2Hz);
  }
}

function pixelToHz(pixel, minHz, maxHz, minPixel, maxPixel) {
  const t = (pixel - minPixel) / (maxPixel - minPixel);
  return Math.exp(
    Math.log(minHz) + t * (Math.log(maxHz) - Math.log(minHz))
  );
}

function mouseInCanvas() {
  return mouseX >= 0 && mouseX < width && mouseY >= 0 && mouseY < height;
}
```

---

## 付録 C: 参考文献・仕様

| 資料 | URL |
|------|-----|
| Web Audio API 仕様 | https://webaudio.github.io/web-audio-api/ |
| MDN: BiquadFilterNode | https://developer.mozilla.org/en-US/docs/Web/API/BiquadFilterNode |
| MDN: OscillatorNode | https://developer.mozilla.org/en-US/docs/Web/API/OscillatorNode |
| MDN: GainNode | https://developer.mozilla.org/en-US/docs/Web/API/GainNode |
| MDN: AudioParam | https://developer.mozilla.org/en-US/docs/Web/API/AudioParam |
| MDN: AudioNode.connect() | https://developer.mozilla.org/en-US/docs/Web/API/AudioNode/connect |
| MDN: Web Audio Best Practices | https://developer.mozilla.org/en-US/docs/Web/API/Web_Audio_API/Best_practices |
| p5.sound ソースコード | https://github.com/processing/p5.js-sound |
| 参考元スケッチ（mimoi 氏） | https://editor.p5js.org/mimoi/sketches/xBwV_oqCE |
| Gunnar Fant の音源フィルタ理論 | Fant, G. (1960). *Acoustic Theory of Speech Production* |
