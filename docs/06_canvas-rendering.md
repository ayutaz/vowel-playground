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
  createCanvas(500, 400);
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
}
```

## 3. 不可能領域の描画

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

## 4. グリッド線

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

## 5. 高DPI対応

p5.js はデフォルトで `window.devicePixelRatio` を検出し自動スケーリング。追加コード不要。

- Retina (2x) では内部的に 1000x800 バッファ、CSS上は 500x400
- テキスト・図形・線すべて自動高解像度描画
- パフォーマンスが問題なら `pixelDensity(1)` で明示的に1xに

## 6. CSS

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
