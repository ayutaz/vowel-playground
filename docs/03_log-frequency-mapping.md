# 母音空間チャートにおける対数周波数マッピングの数学的実装

## 目次

1. [対数スケール変換の数式](#1-対数スケール変換の数式)
2. [軸の反転](#2-軸の反転)
3. [グリッド線の描画](#3-グリッド線の描画)
4. [不可能領域（F1 > F2）の描画](#4-不可能領域f1--f2の描画)
5. [リニアスケールとの比較](#5-リニアスケールとの比較)
6. [フォルマントスケーリング（声道長シミュレーション）](#6-フォルマントスケーリング声道長シミュレーション)

---

## 1. 対数スケール変換の数式

### 1.1 基本原理

人間の聴覚は周波数に対して**対数的**に応答する。
つまり 250 Hz → 500 Hz の知覚的変化量と、500 Hz → 1000 Hz の知覚的変化量はほぼ等しい（どちらも1オクターブ）。
この性質を反映するため、ピクセル空間と周波数空間の対応に自然対数（`Math.log` / `Math.exp`）を使う。

### 1.2 数学的定義

#### 前提パラメータ（REQUIREMENTS.md 準拠）

```
キャンバス: 500 x 400 px
マージン:   50 px（上下左右）
プロットエリア: (50, 50) から (450, 350) まで

F1 範囲: 250 Hz ~ 1000 Hz （Y軸）
F2 範囲: 540 Hz ~ 2600 Hz （X軸）
```

```javascript
// 定数定義
const MARGIN   = 50;
const WIDTH    = 500;
const HEIGHT   = 400;

const PLOT_LEFT   = MARGIN;           // 50
const PLOT_RIGHT  = WIDTH - MARGIN;   // 450
const PLOT_TOP    = MARGIN;           // 50
const PLOT_BOTTOM = HEIGHT - MARGIN;  // 350

const F1_MIN = 250;   // Hz
const F1_MAX = 1000;  // Hz
const F2_MIN = 540;   // Hz
const F2_MAX = 2600;  // Hz
```

---

#### 1.2.1 ピクセル → 周波数 (Hz) 変換: `pixelToHz`

**数式（軸反転なし・基本形）:**

ピクセル座標 `p` を `[minPixel, maxPixel]` から周波数 `f` を `[minHz, maxHz]` に写像する。

```
         p - minPixel
t  =  ─────────────────        （0 ~ 1 に正規化）
       maxPixel - minPixel

f  =  minHz × exp( t × ln(maxHz / minHz) )
```

展開すると:

```
f = minHz × (maxHz / minHz) ^ t

  = minHz ^ (1 - t) × maxHz ^ t
```

**JavaScript 実装:**

```javascript
/**
 * ピクセル座標を周波数 (Hz) に変換する（対数スケール）
 *
 * @param {number} pixel    - ピクセル座標値
 * @param {number} minHz    - 周波数範囲の下限 (Hz)
 * @param {number} maxHz    - 周波数範囲の上限 (Hz)
 * @param {number} minPixel - ピクセル範囲の下限
 * @param {number} maxPixel - ピクセル範囲の上限
 * @returns {number} 対応する周波数 (Hz)
 */
function pixelToHz(pixel, minHz, maxHz, minPixel, maxPixel) {
  // ステップ1: ピクセル座標を 0~1 に正規化
  const t = (pixel - minPixel) / (maxPixel - minPixel);

  // ステップ2: 対数空間で線形補間し、指数関数で周波数に戻す
  return minHz * Math.exp(t * Math.log(maxHz / minHz));
}
```

**計算の流れの図解:**

```
ピクセル空間 (線形)          対数空間 (線形)           周波数空間 (非線形)
  minPixel ─────────────>  ln(minHz) ──────────────>  minHz
      |     正規化 t          |     線形補間            |
      |     ∈ [0, 1]         |                         |
  maxPixel ─────────────>  ln(maxHz) ──────────────>  maxHz
```

**数値例（F1軸、反転なし想定）:**

```
pixel=50  → t=0.0 → 250 × exp(0.0 × ln(4)) = 250 Hz
pixel=200 → t=0.5 → 250 × exp(0.5 × ln(4)) = 250 × 2 = 500 Hz   ← 幾何平均
pixel=350 → t=1.0 → 250 × exp(1.0 × ln(4)) = 250 × 4 = 1000 Hz
```

注目: ピクセル中央 (t=0.5) が算術平均 (250+1000)/2 = 625 Hz ではなく、
**幾何平均** √(250×1000) = 500 Hz に対応する。これが対数スケールの核心。

---

#### 1.2.2 周波数 (Hz) → ピクセル座標変換: `hzToPixel`

**数式（軸反転なし・基本形）:**

```
         ln(f) - ln(minHz)       ln(f / minHz)
t  =  ───────────────────── = ─────────────────────
       ln(maxHz) - ln(minHz)   ln(maxHz / minHz)

pixel = minPixel + t × (maxPixel - minPixel)
```

**JavaScript 実装:**

```javascript
/**
 * 周波数 (Hz) をピクセル座標に変換する（対数スケール）
 *
 * @param {number} hz       - 周波数 (Hz)
 * @param {number} minHz    - 周波数範囲の下限 (Hz)
 * @param {number} maxHz    - 周波数範囲の上限 (Hz)
 * @param {number} minPixel - ピクセル範囲の下限
 * @param {number} maxPixel - ピクセル範囲の上限
 * @returns {number} 対応するピクセル座標
 */
function hzToPixel(hz, minHz, maxHz, minPixel, maxPixel) {
  // ステップ1: 対数空間で 0~1 に正規化
  const t = Math.log(hz / minHz) / Math.log(maxHz / minHz);

  // ステップ2: ピクセル空間に線形マッピング
  return minPixel + t * (maxPixel - minPixel);
}
```

#### 1.2.3 逆関数の証明

`hzToPixel` と `pixelToHz` が互いに逆関数であることの確認:

```
pixelToHz(hzToPixel(f)) を計算:

  pixel = minPixel + [ln(f/minHz) / ln(maxHz/minHz)] × (maxPixel - minPixel)

  t = (pixel - minPixel) / (maxPixel - minPixel)
    = ln(f/minHz) / ln(maxHz/minHz)

  result = minHz × exp(t × ln(maxHz/minHz))
         = minHz × exp(ln(f/minHz))
         = minHz × (f/minHz)
         = f  ✓
```

#### 1.2.4 F1 と F2 それぞれの変換における数値

**F1 (250-1000 Hz) の対数レンジ:**

```javascript
Math.log(F1_MAX / F1_MIN) = Math.log(1000 / 250) = Math.log(4) ≈ 1.3863
// → 約2オクターブ (log2(4) = 2)
```

**F2 (540-2600 Hz) の対数レンジ:**

```javascript
Math.log(F2_MAX / F2_MIN) = Math.log(2600 / 540) ≈ Math.log(4.8148) ≈ 1.5713
// → 約2.27オクターブ (log2(4.8148) ≈ 2.27)
```

F2 のほうが対数レンジがやや広い。同じピクセル距離あたりの周波数変化率が F2 のほうが大きい。

---

## 2. 軸の反転

### 2.1 音声学の慣例

音声学の母音チャートでは、以下の慣例に従う:

```
          ← F2 高い (前舌)          F2 低い (後舌) →
    ┌──────────────────────────────────────────────┐
    │  i                                        u  │ ↑ F1 低い (閉母音)
    │                                              │
    │  e                                        o  │
    │                                              │
    │  ɛ                                        ɔ  │
    │                                              │
    │  a                                        ɑ  │ ↓ F1 高い (開母音)
    └──────────────────────────────────────────────┘
```

- **F2（X軸）**: 値が**右から左へ増加**する（左端 = 2600 Hz、右端 = 540 Hz）
- **F1（Y軸）**: 値が**上から下へ増加**する（上端 = 250 Hz、下端 = 1000 Hz）

### 2.2 反転を組み込んだ変換関数

#### 方法: minPixel / maxPixel の入れ替え

反転を実現する最もエレガントな方法は、関数のシグネチャはそのままに、
**呼び出し時にピクセル範囲の引数を逆転させる**ことである。

```javascript
// ===== F2 (X軸): 右→左へ増加 =====
// 低いHz(540) が右端(450)、高いHz(2600) が左端(50)
// → minPixel と maxPixel を「逆順」で渡す

// F2: ピクセルX → Hz
const f2 = pixelToHz(mouseX, F2_MIN, F2_MAX, PLOT_RIGHT, PLOT_LEFT);
//                                             ^^^^^^^^^^  ^^^^^^^^^
//                                             450         50
//                                             (反転: right が min 側)

// F2: Hz → ピクセルX
const px = hzToPixel(f2Hz, F2_MIN, F2_MAX, PLOT_RIGHT, PLOT_LEFT);


// ===== F1 (Y軸): 上→下へ増加 =====
// 低いHz(250) が上端(50)、高いHz(1000) が下端(350)
// → これは通常のスクリーン座標と同じ向き（上がmin、下がmax）
// → そのまま渡せばよい

// F1: ピクセルY → Hz
const f1 = pixelToHz(mouseY, F1_MIN, F1_MAX, PLOT_TOP, PLOT_BOTTOM);
//                                             ^^^^^^^^  ^^^^^^^^^^^
//                                             50         350
//                                             (通常順: 上が min 側)

// F1: Hz → ピクセルY
const py = hzToPixel(f1Hz, F1_MIN, F1_MAX, PLOT_TOP, PLOT_BOTTOM);
```

#### 反転時の内部動作の詳細 (F2軸)

```javascript
// 例: マウスが左端 (pixel = 50) にあるとき → F2 = 2600 Hz であるべき
pixelToHz(50, 540, 2600, 450, 50)

// 内部計算:
// t = (50 - 450) / (50 - 450) = (-400) / (-400) = 1.0
// f = 540 * exp(1.0 * ln(2600/540)) = 540 * (2600/540) = 2600 Hz  ✓

// 例: マウスが右端 (pixel = 450) にあるとき → F2 = 540 Hz であるべき
pixelToHz(450, 540, 2600, 450, 50)

// 内部計算:
// t = (450 - 450) / (50 - 450) = 0 / (-400) = 0.0
// f = 540 * exp(0.0 * ln(2600/540)) = 540 * 1 = 540 Hz  ✓
```

この方法の利点は、`pixelToHz` / `hzToPixel` 関数の内部ロジックを一切変更せずに
反転を実現できることである。数学的には `maxPixel - minPixel` が負になるだけで、
全ての計算が自然に成立する。

### 2.3 完全な利便関数ラッパー

実用的には、軸ごとのラッパー関数を定義しておくと便利:

```javascript
// F1 (Y軸): 上→下へ増加（スクリーン座標と同じ向き）
function f1ToY(f1Hz) {
  return hzToPixel(f1Hz, F1_MIN, F1_MAX, PLOT_TOP, PLOT_BOTTOM);
}
function yToF1(y) {
  return pixelToHz(y, F1_MIN, F1_MAX, PLOT_TOP, PLOT_BOTTOM);
}

// F2 (X軸): 右→左へ増加（スクリーン座標と逆向き）
function f2ToX(f2Hz) {
  return hzToPixel(f2Hz, F2_MIN, F2_MAX, PLOT_RIGHT, PLOT_LEFT);
}
function xToF2(x) {
  return pixelToHz(x, F2_MIN, F2_MAX, PLOT_RIGHT, PLOT_LEFT);
}
```

---

## 3. グリッド線の描画

### 3.1 100 Hz 間隔のグリッド線

REQUIREMENTS.md では「100 Hz 間隔でグリッド線を描画」と指定されている。
対数スケール上では、等間隔のHz値がピクセル上で**不等間隔**になるのがポイント。

低周波側（250~400 Hz 付近）では100 Hzの差が大きなピクセル間隔を占め、
高周波側（2000~2600 Hz 付近）では100 Hzの差が小さなピクセル間隔に圧縮される。

```javascript
function drawGrid() {
  stroke(220);        // 薄いグレー
  strokeWeight(0.5);

  // --- F1 (Y軸) のグリッド線: 水平線 ---
  // 300, 400, 500, 600, 700, 800, 900, 1000 Hz
  for (let f1 = 300; f1 <= F1_MAX; f1 += 100) {
    const y = f1ToY(f1);
    line(PLOT_LEFT, y, PLOT_RIGHT, y);
  }

  // --- F2 (X軸) のグリッド線: 垂直線 ---
  // 600, 700, 800, ..., 2500, 2600 Hz
  for (let f2 = 600; f2 <= F2_MAX; f2 += 100) {
    const x = f2ToX(f2);
    line(x, PLOT_TOP, x, PLOT_BOTTOM);
  }
}
```

### 3.2 グリッド線間隔の具体的な数値

対数スケールでの100Hzステップが、ピクセル上でどう配置されるか:

```javascript
// F1 (Y軸) のグリッド線ピクセル位置（上→下 = 低Hz→高Hz）
// PLOT_TOP=50, PLOT_BOTTOM=350, 利用可能幅=300px
//
//  250 Hz → y =  50.0 px  (上端)
//  300 Hz → y =  83.3 px  (Δ= 33.3 px)  ← 間隔が広い
//  400 Hz → y = 138.6 px  (Δ= 55.3 px)
//  500 Hz → y = 183.3 px  (Δ= 44.7 px)
//  600 Hz → y = 221.0 px  (Δ= 37.7 px)
//  700 Hz → y = 253.4 px  (Δ= 32.4 px)
//  800 Hz → y = 281.9 px  (Δ= 28.5 px)
//  900 Hz → y = 307.2 px  (Δ= 25.3 px)
// 1000 Hz → y = 350.0 px  (Δ= 22.8 px)  ← 間隔が狭い（下端）
//
// 300→400: 55.3px  vs  900→1000: 22.8px
// 低周波側は高周波側の約2.4倍のピクセル幅を持つ
```

### 3.3 軸ラベルの配置

```javascript
function drawAxisLabels() {
  fill(80);
  noStroke();
  textSize(10);
  textAlign(CENTER, CENTER);

  // --- F1 (Y軸) ラベル ---
  // プロットエリアの左外側に配置
  for (let f1 = 300; f1 <= F1_MAX; f1 += 100) {
    const y = f1ToY(f1);
    textAlign(RIGHT, CENTER);
    text(f1, PLOT_LEFT - 8, y);
  }
  // 250Hz のラベルも追加（範囲の下限）
  text(F1_MIN, PLOT_LEFT - 8, f1ToY(F1_MIN));

  // --- F2 (X軸) ラベル ---
  // プロットエリアの下側に配置
  // 注: F2 軸は反転しているので、左に行くほど高い周波数
  for (let f2 = 600; f2 <= F2_MAX; f2 += 200) {
    // 200Hz間隔で間引き（全て出すと重なる）
    const x = f2ToX(f2);
    textAlign(CENTER, TOP);
    text(f2, x, PLOT_BOTTOM + 8);
  }

  // --- 軸タイトル ---
  textSize(12);
  textAlign(CENTER, CENTER);

  // F2 タイトル（X軸下部）
  text("F2 (Hz) →", WIDTH / 2, HEIGHT - 10);

  // F1 タイトル（Y軸左側、90度回転）
  push();
  translate(12, HEIGHT / 2);
  rotate(-HALF_PI);
  text("F1 (Hz) →", 0, 0);
  pop();
}
```

---

## 4. 不可能領域（F1 > F2）の描画

### 4.1 物理的背景

母音の F1 が F2 を超えることは物理的にあり得ない。
F1 は声道全長の共鳴（約500 Hz 前後が典型的）であり、
F2 はより短い声道区間の共鳴（約1500 Hz 前後が典型的）であるため、
常に F2 > F1 が成り立つ。

チャート上では**右下の三角形領域**が F1 > F2 にあたる。

### 4.2 対数スケール上での F1 = F2 境界線

リニアスケールでは F1 = F2 は直線だが、
**対数スケール上でも F1 = F2 は直線として描画される**。

証明:

```
F1 = F2 = f とすると、

x = hzToPixel(f, F2_MIN, F2_MAX, PLOT_RIGHT, PLOT_LEFT)
  = PLOT_RIGHT + [ln(f/F2_MIN) / ln(F2_MAX/F2_MIN)] × (PLOT_LEFT - PLOT_RIGHT)

y = hzToPixel(f, F1_MIN, F1_MAX, PLOT_TOP, PLOT_BOTTOM)
  = PLOT_TOP + [ln(f/F1_MIN) / ln(F1_MAX/F1_MIN)] × (PLOT_BOTTOM - PLOT_TOP)

tx = ln(f/F2_MIN) / ln(F2_MAX/F2_MIN)
ty = ln(f/F1_MIN) / ln(F1_MAX/F1_MIN)

ここで tx と ty はどちらも ln(f) の一次関数であるため、
tx = A × ty + B の形で表せる → x と y は線形関係 → 直線
```

ただし、F1 と F2 の範囲が異なるため、**45度の直線にはならない**。

### 4.3 頂点座標の計算

不可能領域の三角形の頂点は以下の3点:

```javascript
function drawImpossibleRegion() {
  // F1 = F2 境界線がプロットエリアと交差する点を計算

  // 交差点1: F1 = F2 = F2_MIN (540 Hz) の場合
  // F1=540 は F1範囲(250-1000)内 → 有効
  // F2=540 は F2範囲(540-2600)の下限 → 右端
  const x1 = f2ToX(F2_MIN);   // = PLOT_RIGHT = 450
  const y1 = f1ToY(F2_MIN);   // = f1ToY(540)

  // 交差点2: F1 = F2 = F1_MAX (1000 Hz) の場合
  // F1=1000 は F1範囲の上限 → 下端
  // F2=1000 は F2範囲(540-2600)内 → 有効
  const x2 = f2ToX(F1_MAX);   // = f2ToX(1000)
  const y2 = f1ToY(F1_MAX);   // = PLOT_BOTTOM = 350

  // 三角形の第3頂点: プロットエリアの右下角
  const x3 = PLOT_RIGHT;      // 450
  const y3 = PLOT_BOTTOM;     // 350

  // 不可能領域を描画
  fill(200, 200, 200, 128);   // 半透明グレー
  noStroke();
  triangle(x1, y1, x2, y2, x3, y3);
}
```

### 4.4 具体的な座標値の計算

```javascript
// 交差点1: F1 = F2 = 540 Hz
// x1 = f2ToX(540) = PLOT_RIGHT = 450  (F2の最小値=右端)
// y1 = f1ToY(540)
//    = PLOT_TOP + [ln(540/250) / ln(1000/250)] × (PLOT_BOTTOM - PLOT_TOP)
//    = 50 + [ln(2.16) / ln(4)] × 300
//    = 50 + [0.7701 / 1.3863] × 300
//    = 50 + 0.5555 × 300
//    = 50 + 166.6
//    ≈ 216.6

// 交差点2: F1 = F2 = 1000 Hz
// x2 = f2ToX(1000)
//    = PLOT_RIGHT + [ln(1000/540) / ln(2600/540)] × (PLOT_LEFT - PLOT_RIGHT)
//    = 450 + [ln(1.8519) / ln(4.8148)] × (50 - 450)
//    = 450 + [0.6162 / 1.5713] × (-400)
//    = 450 + 0.3922 × (-400)
//    = 450 - 156.9
//    ≈ 293.1

// 第3頂点: (450, 350) = 右下角

// まとめ:
// 頂点1: (450.0, 216.6)   ← 右端・中ほど
// 頂点2: (293.1, 350.0)   ← 中ほど・下端
// 頂点3: (450.0, 350.0)   ← 右下角
```

### 4.5 境界線上の中間点（検証用）

境界線が直線であることは上で証明したが、中間点で確認:

```javascript
// F1 = F2 = 735 Hz (540 と 1000 の幾何平均: √(540×1000) ≈ 735)
// x = f2ToX(735)
//   = 450 + [ln(735/540) / 1.5713] × (-400)
//   = 450 + [0.3081 / 1.5713] × (-400)
//   = 450 + 0.1961 × (-400)
//   = 450 - 78.4
//   ≈ 371.6

// y = f1ToY(735)
//   = 50 + [ln(735/250) / 1.3863] × 300
//   = 50 + [1.0784 / 1.3863] × 300
//   = 50 + 0.7778 × 300
//   = 50 + 233.3
//   ≈ 283.3

// 中間点 (371.6, 283.3) が 頂点1(450, 216.6) と 頂点2(293.1, 350) を
// 結ぶ線分上にあるか確認:
//
// 傾き = (350 - 216.6) / (293.1 - 450) = 133.4 / (-156.9) = -0.8503
// 頂点1からの予測: y = 216.6 + (-0.8503) × (371.6 - 450)
//                     = 216.6 + (-0.8503) × (-78.4)
//                     = 216.6 + 66.7
//                     = 283.3  ✓ （一致）
```

---

## 5. リニアスケールとの比較

### 5.1 なぜ対数スケールが母音空間に適しているのか

#### 理由 1: 聴覚の知覚特性との一致

人間の聴覚系は、周波数を**対数的**に知覚する（Weber-Fechner の法則）。

```
リニアスケール:  |100Hz---200Hz---300Hz---400Hz---500Hz|
                     ↑これだけで1オクターブ

対数スケール:    |100Hz----------200Hz----------400Hz--|
                       1オクターブ        1オクターブ
```

対数スケールでは「知覚的に等しい変化」が「等しいピクセル距離」に対応する。
母音の弁別は知覚的な距離に基づくため、対数スケールが自然。

#### 理由 2: 母音の分布が均等になる

```
リニアスケールでの F1 配置:
250                                               1000
 |--i(280)--u(310)----e(370)------ɛ(530)----------a(810)--------|
   ↑ 閉母音が左端に密集              ↑ 開母音が右端に散在

対数スケールでの F1 配置:
250                                               1000
 |---i(280)------u(310)------e(370)------ɛ(530)------a(810)-----|
   ↑ 閉母音も開母音も均等に分布
```

対数スケールでは:
- 低い周波数（閉母音: i, u など）の領域が引き伸ばされ
- 高い周波数（開母音: a, ɑ など）の領域が圧縮される

結果として、**全ての母音が視覚的に均等に分布**する。

#### 理由 3: 音楽・音響学との整合性

音楽の音階（半音）は周波数の対数上で等間隔。
フォルマント周波数の分析でも、メル尺度 (Mel scale) や バーク尺度 (Bark scale) など、
対数に近い尺度が標準的に使用される。

#### 理由 4: 高い/低い周波数での解像度バランス

```javascript
// リニアスケール: 1ピクセルあたりの Hz 変化量が一定
// F1: (1000 - 250) / 300px = 2.5 Hz/px（全域で一定）

// 対数スケール: 1ピクセルあたりの Hz 変化量が周波数に比例
// F1 = 250 Hz 付近: 約 1.15 Hz/px  → 低周波で高解像度
// F1 = 500 Hz 付近: 約 2.31 Hz/px
// F1 = 1000 Hz 付近: 約 4.62 Hz/px → 高周波で低解像度
//
// これは聴覚の弁別能力と一致する:
//   250→260Hz の 10Hz差は知覚的に大きい（引き伸ばすべき）
//   1000→1010Hz の 10Hz差は知覚的に小さい（圧縮してよい）
```

### 5.2 リニア vs 対数: コードの比較

```javascript
// ===== リニアスケール版 =====
function pixelToHzLinear(pixel, minHz, maxHz, minPixel, maxPixel) {
  const t = (pixel - minPixel) / (maxPixel - minPixel);
  return minHz + t * (maxHz - minHz);   // 算術的補間
}

function hzToPixelLinear(hz, minHz, maxHz, minPixel, maxPixel) {
  const t = (hz - minHz) / (maxHz - minHz);
  return minPixel + t * (maxPixel - minPixel);
}


// ===== 対数スケール版 =====
function pixelToHz(pixel, minHz, maxHz, minPixel, maxPixel) {
  const t = (pixel - minPixel) / (maxPixel - minPixel);
  return minHz * Math.exp(t * Math.log(maxHz / minHz));   // 幾何的補間
}

function hzToPixel(hz, minHz, maxHz, minPixel, maxPixel) {
  const t = Math.log(hz / minHz) / Math.log(maxHz / minHz);
  return minPixel + t * (maxPixel - minPixel);
}
```

核心的な違い:
- **リニア**: `minHz + t * (maxHz - minHz)` → **加算と乗算**
- **対数**: `minHz * exp(t * log(maxHz / minHz))` → **乗算と累乗**

リニアは「算術平均的な補間」、対数は「幾何平均的な補間」。

### 5.3 母音「あ」(a) の位置比較

```javascript
// 母音 "a": F1 ≈ 810 Hz, F2 ≈ 1200 Hz

// --- リニアスケールでの位置 ---
// F1: t = (810 - 250) / (1000 - 250) = 560/750 = 0.747
// → y = 50 + 0.747 × 300 = 274.0 px  (下から 76px / 300px → 下寄り)

// F2: t = (1200 - 540) / (2600 - 540) = 660/2060 = 0.320
// → x = 450 + 0.320 × (50-450) = 450 - 128.2 = 321.8 px
//   (右端から 128px / 400px → やや右寄り)

// --- 対数スケールでの位置 ---
// F1: t = ln(810/250) / ln(1000/250) = 1.175/1.386 = 0.848
// → y = 50 + 0.848 × 300 = 304.3 px  (下から 46px → さらに下寄り)

// F2: t = ln(1200/540) / ln(2600/540) = 0.799/1.571 = 0.509
// → x = 450 + 0.509 × (50-450) = 450 - 203.4 = 246.6 px
//   (右端から 203px → ほぼ中央)

// 対数スケールのほうが「あ」が中央付近に来る → より自然な母音配置
```

---

## 6. フォルマントスケーリング（声道長シミュレーション）

### 6.1 背景: 声道長とフォルマント周波数の関係

フォルマント周波数は声道の物理的な長さに反比例する。
声道を一端閉・一端開の管として近似すると、共鳴周波数は以下の式で与えられる:

```
Fn = (2n - 1) × c / (4L)

  Fn: 第n フォルマント周波数
  c:  音速（約 34,400 cm/s）
  L:  声道長 (cm)
  n:  1, 2, 3, ...
```

この式から、声道長が短くなると全てのフォルマント周波数が**同じ比率で**上昇することがわかる。
例えば声道長が半分になれば、全フォルマント周波数は2倍になる。

### 6.2 スケール係数と声道長の対応

本アプリでは、フォルマントスケール係数 `scale` を導入し、
座標変換で得られた周波数に乗算してから合成フィルタに送る。
この係数は声道長の逆数に比例する:

```
scale = L_ref / L_target

  L_ref:    基準声道長（成人男性: 17.6 cm）
  L_target: 目標声道長
```

| プリセット | scale | 想定声道長 | 説明 |
|-----------|-------|-----------|------|
| 通常      | 1.0   | 17.6 cm   | 成人男性の平均的な声道長 |
| 女声      | 1.15  | 15.3 cm   | 成人女性の平均的な声道長 |
| 可愛い声  | 1.3   | ~13.5 cm  | 小柄な話者・子ども |
| アニメ声  | 1.5   | ~12 cm    | 極端に短い声道（誇張表現） |

### 6.3 チャート座標と合成周波数の分離

重要な設計上のポイントとして、**チャートの座標系はスケーリングの影響を受けない**。

```
チャート座標系（不変）:
  F1: 250 ~ 1000 Hz
  F2: 540 ~ 2600 Hz

合成周波数（スケーリング後）:
  F1_synth = F1_chart × scale
  F2_synth = F2_chart × scale
```

つまりユーザーがチャート上で同じ位置をクリックしても、
選択されたプリセットによって実際に合成される周波数は異なる。

```
例: チャート上で [a]（F1=810 Hz, F2=1200 Hz）の位置をクリックした場合

  通常      (scale=1.0):  F1= 810 Hz, F2=1200 Hz
  女声      (scale=1.15): F1= 932 Hz, F2=1380 Hz
  可愛い声  (scale=1.3):  F1=1053 Hz, F2=1560 Hz
  アニメ声  (scale=1.5):  F1=1215 Hz, F2=1800 Hz
```

これにより、チャート上の母音シンボル配置（音声学的な標準配置）を
維持したまま、声質だけを変化させることができる。

### 6.4 固定フォルマントへの適用

スケール係数は F1/F2 だけでなく、固定周波数のフィルタ（F3, F4, BEF, LPF）にも
同じ比率で適用される。これは声道長の変化が全ての共鳴に影響するという
物理的原理に基づく。

```javascript
function updateFormants(px, py) {
  let p = PRESETS[currentPreset];
  let s = p.scale;

  // 可変フォルマント（チャート座標から変換後にスケーリング）
  F1F.set(yToF1(py) * s, p.q[0]);
  F2F.set(xToF2(px) * s, p.q[1]);

  // 固定フォルマント（基準周波数にスケーリング）
  F3F.set(2500 * s, p.q[2]);    // 通常: 2500 Hz → アニメ声: 3750 Hz
  F4F.set(3500 * s, p.q[3]);    // 通常: 3500 Hz → アニメ声: 5250 Hz

  // スペクトル整形フィルタ
  BEF.set(5000 * s, 0.2);       // 通常: 5000 Hz → アニメ声: 7500 Hz
  LPF.set(7250 * s, 0.001);     // 通常: 7250 Hz → アニメ声: 10875 Hz
}
```

各フィルタのスケーリング後の周波数一覧:

| フィルタ | 基準 (Hz) | scale=1.0 | scale=1.15 | scale=1.3 | scale=1.5 |
|---------|----------|-----------|------------|-----------|-----------|
| F3F     | 2500     | 2500      | 2875       | 3250      | 3750      |
| F4F     | 3500     | 3500      | 4025       | 4550      | 5250      |
| BEF     | 5000     | 5000      | 5750       | 6500      | 7500      |
| LPF     | 7250     | 7250      | 8338       | 9425      | 10875     |

### 6.5 数学的な処理フロー

座標変換からフィルタ設定までの完全なフローは以下の通り:

```
マウス座標 (px, py)
    │
    ├──→ pixelToHz (対数逆変換)  ←── チャート座標系の範囲 (F1: 250-1000, F2: 540-2600)
    │        │
    │        ├──→ F1_chart (Hz)   ── × scale ──→ F1_synth ──→ F1F フィルタ
    │        └──→ F2_chart (Hz)   ── × scale ──→ F2_synth ──→ F2F フィルタ
    │
    └──→ 固定周波数 × scale ──→ F3F, F4F, BEF, LPF フィルタ
```

ここで `pixelToHz` の変換（セクション1, 2 で定義）は一切変更されない。
スケーリングはあくまで変換結果に対する**後処理**として適用される。

---

## 付録: 完全な実装コード

以下は全ての数学的要素を統合した描画関数の完全な例:

```javascript
// =======================================
// 定数
// =======================================
const MARGIN = 50;
const WIDTH  = 500;
const HEIGHT = 400;

const PLOT_LEFT   = MARGIN;
const PLOT_RIGHT  = WIDTH - MARGIN;
const PLOT_TOP    = MARGIN;
const PLOT_BOTTOM = HEIGHT - MARGIN;

const F1_MIN = 250;
const F1_MAX = 1000;
const F2_MIN = 540;
const F2_MAX = 2600;

// =======================================
// 対数マッピング関数（汎用）
// =======================================
function pixelToHz(pixel, minHz, maxHz, minPixel, maxPixel) {
  const t = (pixel - minPixel) / (maxPixel - minPixel);
  return minHz * Math.exp(t * Math.log(maxHz / minHz));
}

function hzToPixel(hz, minHz, maxHz, minPixel, maxPixel) {
  const t = Math.log(hz / minHz) / Math.log(maxHz / minHz);
  return minPixel + t * (maxPixel - minPixel);
}

// =======================================
// 軸固有ラッパー（反転込み）
// =======================================
function f1ToY(hz) {
  return hzToPixel(hz, F1_MIN, F1_MAX, PLOT_TOP, PLOT_BOTTOM);
}
function yToF1(y) {
  return pixelToHz(y, F1_MIN, F1_MAX, PLOT_TOP, PLOT_BOTTOM);
}
function f2ToX(hz) {
  return hzToPixel(hz, F2_MIN, F2_MAX, PLOT_RIGHT, PLOT_LEFT);
}
function xToF2(x) {
  return pixelToHz(x, F2_MIN, F2_MAX, PLOT_RIGHT, PLOT_LEFT);
}

// =======================================
// グリッド線の描画
// =======================================
function drawGrid() {
  stroke(220);
  strokeWeight(0.5);

  // F1 水平グリッド線
  for (let f1 = 300; f1 <= F1_MAX; f1 += 100) {
    const y = f1ToY(f1);
    line(PLOT_LEFT, y, PLOT_RIGHT, y);
  }

  // F2 垂直グリッド線
  for (let f2 = 600; f2 <= F2_MAX; f2 += 100) {
    const x = f2ToX(f2);
    line(x, PLOT_TOP, x, PLOT_BOTTOM);
  }
}

// =======================================
// 不可能領域の描画
// =======================================
function drawImpossibleRegion() {
  const x1 = f2ToX(F2_MIN);   // 540 Hz → 右端
  const y1 = f1ToY(F2_MIN);   // 540 Hz の F1 位置
  const x2 = f2ToX(F1_MAX);   // 1000 Hz の F2 位置
  const y2 = f1ToY(F1_MAX);   // 1000 Hz → 下端
  const x3 = PLOT_RIGHT;      // 右下角
  const y3 = PLOT_BOTTOM;

  fill(200, 200, 200, 128);
  noStroke();
  triangle(x1, y1, x2, y2, x3, y3);
}
```
