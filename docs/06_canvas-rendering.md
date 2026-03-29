# キャンバス描画技術調査

## 1. IPA記号のフォント戦略

### 推奨: Google Fonts Noto Sans

Noto Sans は全Unicode文字カバーを目標としたフォントで、IPA Extensions ブロック全体を含む。

```html
<!-- index.html -->
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link href="https://fonts.googleapis.com/css2?family=Noto+Sans:wght@400;700&display=swap"
      rel="stylesheet">
```

```javascript
// sketch.js
textFont('"Noto Sans", "Lucida Grande", "Lucida Sans Unicode", "DejaVu Sans", sans-serif');
```

### フォントフォールバック

| 優先度 | フォント | 対象OS |
|--------|---------|-------|
| 1 | Noto Sans (Webフォント) | 全環境 |
| 2 | Lucida Grande | macOS |
| 3 | Lucida Sans Unicode | Windows（部分的IPA対応） |
| 4 | DejaVu Sans | Linux |
| 5 | sans-serif | 最終フォールバック |

### フォントロード完了の検知

```javascript
let fontReady = false;

function setup() {
  createCanvas(500, 430);   // 下部30pxはプリセットボタン領域
  document.fonts.ready.then(() => { fontReady = true; });
}

function draw() {
  if (!fontReady) {
    background(230);
    text('Loading...', width / 2, height / 2);
    return;
  }
  drawVowelChart();
}
```

## 2. 描画レイヤー順序

```javascript
function draw() {
  background(230);             // 1. 全体背景 (薄グレー)
  fill(255); noStroke();
  rect(PLOT_LEFT, PLOT_TOP,    // 2. プロットエリア白背景
       PLOT_RIGHT - PLOT_LEFT,
       PLOT_BOTTOM - PLOT_TOP);
  drawGrid();                  // 3. グリッド線
  drawImpossibleRegion();      // 4. 不可能領域マスク
  drawConnections();           // 5. 母音間接続線
  drawVowelSymbols();          // 6. IPA母音記号
  drawCursor();                // 7. カーソル追従円
  drawAxisLabels();            // 8. 軸タイトル
  drawButtonBackground();      // 9. ボタン領域背景（不可能領域のはみ出しを隠す）
  drawPresetButtons();         // 10. プリセットボタン (4個)
}
```

## 3. レイアウト定数

```
CANVAS_W = 500
CANVAS_H = 430          // 従来の400 + ボタン領域30px
MARGIN   = 50
PLOT_TOP    = MARGIN     // 50
PLOT_BOTTOM = 350        // 固定値（CANVAS_H - MARGIN ではない）
PLOT_LEFT   = MARGIN     // 50
PLOT_RIGHT  = CANVAS_W - MARGIN  // 450

BTN_Y   = PLOT_BOTTOM + 25      // 375
BTN_W   = 95
BTN_H   = 30
BTN_GAP = 10
```

チャート描画領域 (50–450 x 50–350) とボタン領域 (y=375) の間に 25px のマージンがある。ボタン4個は `(BTN_W * 4 + BTN_GAP * 3) = 410px` で、キャンバス幅500pxに対して水平中央揃え。

## 4. 不可能領域の描画

F1 > F2 の領域を対数スケール上で正しく描画:

```javascript
function drawImpossibleRegion() {
  fill(220, 220, 220, 180);
  noStroke();
  beginShape();
  // F1=F2 の線を対数スケールでプロット
  for (let f = F1_MIN; f <= F1_MAX; f += 10) {
    if (f >= F2_MIN && f <= F2_MAX) {
      vertex(f2ToX(f), f1ToY(f));
    }
  }
  vertex(PLOT_RIGHT, PLOT_BOTTOM);
  vertex(PLOT_RIGHT, f1ToY(F2_MIN));
  endShape(CLOSE);
}
```

## 5. グリッド線

```javascript
function drawGrid() {
  // F1 水平グリッド: 300, 400, ... 1000 Hz
  for (let f1 = 300; f1 <= F1_MAX; f1 += 100) {
    let y = f1ToY(f1);
    stroke(f1 % 500 === 0 ? 200 : 230);
    strokeWeight(f1 % 500 === 0 ? 0.5 : 0.3);
    line(PLOT_LEFT, y, PLOT_RIGHT, y);
  }
  // F2 垂直グリッド: 600, 700, ... 2600 Hz
  for (let f2 = 600; f2 <= F2_MAX; f2 += 100) {
    let x = f2ToX(f2);
    stroke(f2 % 500 === 0 ? 200 : 230);
    strokeWeight(f2 % 500 === 0 ? 0.5 : 0.3);
    line(x, PLOT_TOP, x, PLOT_BOTTOM);
  }
}
```

## 6. プリセットボタン

チャート下部に4つのプリセットボタンを描画する。

```javascript
const BTN_Y = PLOT_BOTTOM + 25;  // 375
const BTN_W = 95;
const BTN_H = 30;
const BTN_GAP = 10;

function drawButtonBackground() {
  // 不可能領域がチャート下端を超えてはみ出す場合に備え、
  // ボタン領域の背景を全体背景色で塗りつぶして隠す
  fill(230); noStroke();
  rect(0, PLOT_BOTTOM, CANVAS_W, CANVAS_H - PLOT_BOTTOM);
}

function drawPresetButtons() {
  const totalW = BTN_W * 4 + BTN_GAP * 3;  // 410
  const startX = (CANVAS_W - totalW) / 2;   // 水平中央揃え

  for (let i = 0; i < presets.length; i++) {
    const x = startX + i * (BTN_W + BTN_GAP);
    if (i === activePreset) {
      fill(60, 130, 200);   // アクティブ: 青
    } else {
      fill(180);             // 非アクティブ: グレー
    }
    rect(x, BTN_Y, BTN_W, BTN_H, 5);
    fill(255);
    text(presets[i].label, x + BTN_W / 2, BTN_Y + BTN_H / 2);
  }
}
```

### ボタンレイアウト詳細

| 項目 | 値 |
|------|----|
| ボタンY座標 | 375 (PLOT_BOTTOM + 25) |
| ボタンサイズ | 95 x 30 px |
| ボタン間隔 | 10px |
| アクティブ色 | rgb(60, 130, 200) — 青 |
| 非アクティブ色 | rgb(180, 180, 180) — グレー |
| 背景矩形 | y=350〜430、全体背景色(230)で塗り |

背景矩形は不可能領域の `beginShape()` がプロット下端を超えてボタン領域に描画されるケースへの対策。

## 7. 軸ラベル

F1 軸ラベルのY座標は `(PLOT_TOP + PLOT_BOTTOM) / 2` で計算する（従来の `CANVAS_H / 2` から変更）。これにより、PLOT_BOTTOM が固定値350になってもラベルがチャート描画領域の垂直中央に正しく配置される。

```javascript
// F1軸ラベル（左側、縦書き）
push();
translate(15, (PLOT_TOP + PLOT_BOTTOM) / 2);  // (15, 200)
rotate(-HALF_PI);
text("F1 (Hz)", 0, 0);
pop();
```

## 8. 高DPI対応

p5.js はデフォルトで `window.devicePixelRatio` を検出し自動スケーリング。追加コード不要。

- Retina (2x) では内部的に 1000x860 バッファ、CSS上は 500x430
- テキスト・図形・線すべて自動高解像度描画
- パフォーマンスが問題なら `pixelDensity(1)` で明示的に1xに

## 9. CSS

```css
html, body {
  margin: 0;
  padding: 0;
  overflow: hidden;
  display: flex;
  justify-content: center;
  align-items: center;
  height: 100vh;
  background: #f0f0f0;
}

canvas {
  display: block;
  touch-action: none;
}
```
