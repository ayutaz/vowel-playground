# タッチデバイス対応とポインターイベント処理 調査レポート

本ドキュメントは、インタラクティブ母音フォルマント合成器（p5.js + p5.sound）において、
マウスとタッチの両方に対応するための技術調査をまとめたものである。

---

## 1. Pointer Events API

### 1.1 概要

Pointer Events API は、マウス・タッチ・ペン入力を **単一のイベントモデル** で統一的に扱う W3C 標準仕様である。

| Pointer Event    | 対応する Mouse Event | 対応する Touch Event |
|------------------|---------------------|---------------------|
| `pointerdown`    | `mousedown`         | `touchstart`        |
| `pointermove`    | `mousemove`         | `touchmove`         |
| `pointerup`      | `mouseup`           | `touchend`          |
| `pointercancel`  | —                   | `touchcancel`       |
| `pointerenter`   | `mouseenter`        | —                   |
| `pointerleave`   | `mouseleave`        | —                   |

### 1.2 主要プロパティ

```javascript
canvas.addEventListener('pointerdown', (e) => {
  e.pointerId;    // ポインター固有ID（マルチタッチ識別用）
  e.pointerType;  // "mouse" | "touch" | "pen"
  e.clientX;      // ビューポート上のX座標
  e.clientY;      // ビューポート上のY座標
  e.pressure;     // 筆圧 (0.0 ~ 1.0)
  e.isPrimary;    // プライマリポインターかどうか
});
```

### 1.3 ブラウザサポート

全モダンブラウザ（Chrome, Firefox, Safari 13+, Edge）で対応済み。
iOS Safari は 13 以降で完全サポート。

### 1.4 p5.js での対応状況

**p5.js (v1.x) は Pointer Events API をネイティブには使用していない。**
内部的には以下のイベントリスナーを個別に登録している:

- マウス系: `mousedown`, `mousemove`, `mouseup`, `click`
- タッチ系: `touchstart`, `touchmove`, `touchend`

p5.js のタッチイベントハンドラは、タッチイベント発火後にマウスイベントも発火する
ブラウザの互換動作を考慮し、`touchStarted()` が定義されている場合は
対応するマウスイベントのハンドラを呼ばないよう制御している。

**直接 Pointer Events を使う場合は、p5.js の仕組みを迂回して canvas に直接登録する必要がある。**

---

## 2. p5.js のイベントモデル

### 2.1 マウスイベント関数

```javascript
// マウスボタン押下時に1回呼ばれる
function mousePressed() {
  // タッチデバイスでも touchStarted() が未定義なら呼ばれる
}

// マウスボタン解放時に1回呼ばれる
function mouseReleased() {
  // タッチデバイスでも touchEnded() が未定義なら呼ばれる
}

// マウスボタンを押しながら移動した時に毎フレーム呼ばれる
function mouseDragged() {
  // タッチデバイスでも touchMoved() が未定義なら呼ばれる
}

// マウスが移動するたびに呼ばれる（ボタン不問）
function mouseMoved() {}
```

### 2.2 タッチイベント関数

```javascript
// タッチ開始時に1回呼ばれる
function touchStarted() {
  // return false; でブラウザのデフォルト動作を抑制
  return false;
}

// タッチ移動時に呼ばれる
function touchMoved() {
  // return false; でスクロールを抑制
  return false;
}

// タッチ終了時に呼ばれる
function touchEnded() {
  return false;
}
```

### 2.3 重要な変数

```javascript
mouseX       // 現在のマウス/タッチのX座標（キャンバス相対）
mouseY       // 現在のマウス/タッチのY座標（キャンバス相対）
pmouseX      // 前フレームのX座標
pmouseY      // 前フレームのY座標
mouseIsPressed  // マウスボタンが押されているか (boolean)
mouseButton  // 押されているボタン (LEFT, RIGHT, CENTER)

touches      // タッチポイントの配列 [{x, y, id}, ...]
             // マルチタッチ時は複数要素を持つ
```

### 2.4 タッチとマウスの二重発火問題

タッチデバイスではブラウザの互換レイヤーにより、タッチイベントの後に
マウスイベントも発火する（約300msの遅延付き）。p5.js はこの問題に対して
以下のルールで処理している:

- `touchStarted()` が定義されていれば → `mousePressed()` は呼ばれない
- `touchMoved()` が定義されていれば → `mouseDragged()` は呼ばれない
- `touchEnded()` が定義されていれば → `mouseReleased()` は呼ばれない
- **タッチ関数が未定義なら、マウス関数がフォールバックとして呼ばれる**

### 2.5 本プロジェクトでの推奨パターン

**方針A: マウス関数のみ使用（シンプル）**

タッチ専用関数を定義しなければ、p5.js が自動的にタッチをマウスイベントに
フォールバックさせる。`mouseX`/`mouseY` もタッチ位置で更新される。

```javascript
// sketch.js — マウス関数のみの実装
let isPlaying = false;

function mousePressed() {
  if (isInsidePlotArea(mouseX, mouseY)) {
    userStartAudio(); // Web Audio のジェスチャー要件を満たす
    startSound();
    isPlaying = true;
  }
  // return false しない → タッチデバイスでデフォルト動作が発生しうる
}

function mouseReleased() {
  stopSound();
  isPlaying = false;
}

function draw() {
  // ... 描画 ...
  if (mouseIsPressed && isInsidePlotArea(mouseX, mouseY)) {
    updateFormants(mouseX, mouseY);
  }
}
```

この方式の問題点:
- タッチ時にスクロール/ズームが発生する
- `return false` で抑制できるが、mousePressed で return false すると
  マウスの右クリックメニューも抑制される

**方針B: タッチ関数とマウス関数の両方を定義（推奨）**

```javascript
// sketch.js — タッチ + マウスの両対応
let isPlaying = false;

// --- マウス用 ---
function mousePressed() {
  if (isInsidePlotArea(mouseX, mouseY)) {
    userStartAudio();
    startSound();
    isPlaying = true;
  }
}

function mouseReleased() {
  stopSound();
  isPlaying = false;
}

// --- タッチ用 ---
function touchStarted() {
  if (touches.length > 0) {
    let t = touches[0]; // 最初のタッチポイントのみ使用
    if (isInsidePlotArea(t.x, t.y)) {
      userStartAudio();
      startSound();
      isPlaying = true;
    }
  }
  return false; // スクロール・ズームを抑制
}

function touchMoved() {
  if (isPlaying && touches.length > 0) {
    let t = touches[0];
    if (isInsidePlotArea(t.x, t.y)) {
      updateFormants(t.x, t.y);
    }
  }
  return false; // スクロールを抑制
}

function touchEnded() {
  stopSound();
  isPlaying = false;
  return false;
}

// --- draw ---
function draw() {
  // ... 描画 ...
  // マウスドラッグ時のフォルマント更新
  if (mouseIsPressed && isInsidePlotArea(mouseX, mouseY)) {
    updateFormants(mouseX, mouseY);
  }
}
```

**方針C: Pointer Events を直接使用（最も堅牢）**

```javascript
// sketch.js — Pointer Events による統一処理

let isPlaying = false;
let lastPointerX = 0;
let lastPointerY = 0;

function setup() {
  let cnv = createCanvas(500, 400);

  // touch-action: none で意図しないブラウザジェスチャーを完全抑制
  cnv.elt.style.touchAction = 'none';

  cnv.elt.addEventListener('pointerdown', handlePointerDown);
  cnv.elt.addEventListener('pointermove', handlePointerMove);
  cnv.elt.addEventListener('pointerup', handlePointerUp);
  cnv.elt.addEventListener('pointercancel', handlePointerUp);

  // ... 音声初期化 ...
}

function handlePointerDown(e) {
  e.preventDefault();
  // キャンバス相対座標に変換
  let rect = e.target.getBoundingClientRect();
  let px = e.clientX - rect.left;
  let py = e.clientY - rect.top;

  if (isInsidePlotArea(px, py)) {
    // AudioContext の resume（ジェスチャー要件）
    if (getAudioContext().state !== 'running') {
      getAudioContext().resume();
    }
    startSound();
    isPlaying = true;
    lastPointerX = px;
    lastPointerY = py;
    updateFormants(px, py);
  }
}

function handlePointerMove(e) {
  e.preventDefault();
  if (!isPlaying) return;

  let rect = e.target.getBoundingClientRect();
  let px = e.clientX - rect.left;
  let py = e.clientY - rect.top;
  lastPointerX = px;
  lastPointerY = py;

  if (isInsidePlotArea(px, py)) {
    updateFormants(px, py);
  }
}

function handlePointerUp(e) {
  e.preventDefault();
  stopSound();
  isPlaying = false;
}
```

---

## 3. Web Audio のユーザージェスチャー要件

### 3.1 背景

ブラウザの自動再生ポリシーにより、ユーザーの明示的なジェスチャー
（クリック、タッチ、キー押下）なしに AudioContext を開始できない。
AudioContext は初期状態で `"suspended"` となり、ジェスチャー内で
`resume()` を呼ぶ必要がある。

### 3.2 p5.sound の userStartAudio()

p5.sound は `userStartAudio()` というヘルパー関数を提供している。

```javascript
function mousePressed() {
  // p5.sound 提供のヘルパー。AudioContext を resume する。
  // 内部で getAudioContext().resume() を呼ぶ。
  // すでに running なら何もしない（冪等）。
  userStartAudio();
}
```

あるいは p5.sound を使わず直接制御する場合:

```javascript
function mousePressed() {
  let ctx = getAudioContext();
  if (ctx.state === 'suspended') {
    ctx.resume().then(() => {
      console.log('AudioContext resumed');
    });
  }
}
```

### 3.3 iOS Safari の特殊な制限

iOS Safari は他のブラウザより厳格な制限がある:

1. **AudioContext の作成タイミング**: ジェスチャーイベントハンドラの
   **同期的な呼び出しスタック内** で `resume()` を呼ぶ必要がある。
   非同期コールバック内では無効。

2. **サイレントモード**: iOS のサイレントスイッチ（ミュート）がONだと
   Web Audio の出力も無音になる。ユーザーへの通知が望ましい。

3. **resume() は Promise を返す**: ただし iOS Safari では resolve が
   遅延することがある。音声開始を resume の完了後にするのが安全。

```javascript
// iOS Safari 対策を含むパターン
let audioResumed = false;

function touchStarted() {
  if (!audioResumed) {
    let ctx = getAudioContext();
    ctx.resume().then(() => {
      audioResumed = true;
      startSoundIfNeeded();
    });
  } else {
    startSoundIfNeeded();
  }
  return false;
}
```

4. **初回タッチで無音バッファを再生するテクニック**:
   一部の古い iOS バージョンでは、初回ジェスチャーで空の音声を再生
   することで AudioContext をアンロックする必要があった。
   p5.sound の `userStartAudio()` は内部でこの処理を行っている。

### 3.4 推奨実装

```javascript
// setup() 内で初回ジェスチャーの待受を設定
function setup() {
  let cnv = createCanvas(500, 400);

  // p5.sound 推奨の方法: クリック/タッチで AudioContext を自動 resume
  userStartAudio();
  // 注: この呼び出し自体はリスナーを登録するだけで、
  // 実際の resume はユーザーの最初のジェスチャー時に行われる

  // ... 残りの初期化 ...
}
```

---

## 4. マルチタッチ

### 4.1 単一ポイントのみ使用する場合

本プロジェクトでは単一の合成ポイントのみ必要なため、
最初のタッチポイントだけを使用する。

```javascript
function touchMoved() {
  if (touches.length > 0) {
    // 最初のタッチポイントのみ使用
    let t = touches[0];
    updateFormants(t.x, t.y);
  }
  return false;
}
```

Pointer Events を使う場合は `isPrimary` プロパティで判別:

```javascript
canvas.addEventListener('pointermove', (e) => {
  if (!e.isPrimary) return; // セカンダリタッチは無視
  // プライマリポインターのみ処理
});
```

### 4.2 意図しないスクロール/ズームの防止

タッチデバイスでキャンバス上の操作がスクロールやピンチズームとして
解釈されるのを防ぐ必要がある。3つのアプローチを組み合わせる:

#### (a) CSS `touch-action` プロパティ（最も確実）

```css
/* style.css */
canvas {
  touch-action: none; /* すべてのブラウザジェスチャーを無効化 */
}
```

`touch-action` の値:

| 値 | 効果 |
|----|------|
| `auto` | デフォルト。ブラウザが自由にジェスチャーを処理 |
| `none` | すべてのジェスチャー（パン、ズーム）を無効化 |
| `pan-x` | 水平スクロールのみ許可 |
| `pan-y` | 垂直スクロールのみ許可 |
| `manipulation` | パン・ズームは許可、ダブルタップズーム等は無効 |

**本プロジェクトでは `touch-action: none` を推奨。** キャンバス上の全タッチ操作を
アプリケーションが制御する。

#### (b) p5.js イベントハンドラで `return false`

```javascript
function touchStarted() {
  // ... 処理 ...
  return false; // preventDefault() と同等
}

function touchMoved() {
  // ... 処理 ...
  return false; // スクロール抑制に特に重要
}

function touchEnded() {
  // ... 処理 ...
  return false;
}
```

#### (c) JavaScript で直接 preventDefault

```javascript
// setup() 内
let cnv = createCanvas(500, 400);

// passive: false を明示しないと preventDefault が効かない
// （ブラウザのデフォルトが passive: true のため）
cnv.elt.addEventListener('touchstart', (e) => e.preventDefault(),
  { passive: false });
cnv.elt.addEventListener('touchmove', (e) => e.preventDefault(),
  { passive: false });
```

### 4.3 全体のページスクロールとの共存

キャンバス外ではスクロール可能にしたい場合、イベントハンドラ内で
座標を判定する:

```javascript
function touchMoved() {
  if (touches.length > 0) {
    let t = touches[0];
    if (isInsidePlotArea(t.x, t.y)) {
      updateFormants(t.x, t.y);
      return false; // キャンバス内 → スクロール抑制
    }
  }
  // キャンバス外 → return しない → スクロール許可
}
```

---

## 5. パフォーマンス考慮

### 5.1 touchmove / pointermove の発火頻度

- **マウスの mousemove**: 通常 60Hz 程度（ディスプレイのリフレッシュレート依存）
- **タッチの touchmove**: デバイスにより **120~240Hz** で発火することがある
  （iPad Pro は 120Hz、一部 Android は 240Hz）
- **pointermove**: タッチデバイスでは touchmove と同程度の頻度

### 5.2 本プロジェクトでの判断: throttle/debounce は不要

本プロジェクトのフォルマント更新処理は以下の理由で軽量:

1. **BiquadFilterNode.frequency の更新**: Web Audio API のパラメータ設定は
   極めて軽量（AudioParam の値を書き換えるだけ）
2. **linearRampToValueAtTime 等も不要**: 即時反映で十分
3. **draw() は requestAnimationFrame ベース**: 描画は最大60fpsに制限済み

したがって、**pointermove / touchmove のたびにフィルタ周波数を更新しても
パフォーマンス上の問題はない。** throttle/debounce を入れると
かえってレイテンシ感が増し、操作の滑らかさが失われる。

ただし、もし将来的に move イベント内で重い処理（例: FFT 計算やキャンバス再描画）を
行う場合は、以下のパターンで throttle する:

```javascript
// draw() 内で処理する方式 — p5.js の自然な throttle
// pointermove は座標を記録するだけ、実際の更新は draw() で行う
let currentPointerX = 0;
let currentPointerY = 0;

function handlePointerMove(e) {
  let rect = e.target.getBoundingClientRect();
  currentPointerX = e.clientX - rect.left;
  currentPointerY = e.clientY - rect.top;
  // フィルタ更新は draw() に任せる
}

function draw() {
  // 描画 ...
  if (isPlaying) {
    // フィルタ更新 — draw() のフレームレート（60fps）で自然に throttle
    updateFormants(currentPointerX, currentPointerY);
  }
}
```

### 5.3 Passive Event Listeners

#### 背景

Chrome 56 以降、`touchstart` と `touchmove` のイベントリスナーは
デフォルトで **passive: true** として扱われる。passive リスナーでは
`preventDefault()` を呼べない（呼んでも無視される + コンソール警告）。

これはスクロールパフォーマンスを向上させるためのブラウザの最適化だが、
キャンバス上でスクロールを抑制したい場合は明示的に `passive: false` を
指定する必要がある。

#### p5.js の処理

p5.js は内部でタッチイベントを `{ passive: false }` で登録しているため、
`touchStarted()` や `touchMoved()` 内で `return false` すれば
`preventDefault()` が正しく呼ばれる。**p5.js の関数を使う限り、開発者が
passive オプションを気にする必要はない。**

#### 直接イベントリスナーを登録する場合

```javascript
// 正しい: passive: false を明示
canvas.addEventListener('touchmove', handler, { passive: false });

// 誤り: passive リスナーでは preventDefault が効かない
canvas.addEventListener('touchmove', handler, { passive: true });
canvas.addEventListener('touchmove', handler); // Chrome ではデフォルト passive
```

Pointer Events の場合は passive のデフォルトが異なる:

```javascript
// pointerdown/pointermove はデフォルトで passive: false
// そのため preventDefault() がそのまま使える
canvas.addEventListener('pointerdown', handler); // OK
canvas.addEventListener('pointermove', handler);  // OK
```

### 5.4 getCoalescedEvents() によるスムーズな軌跡

高頻度タッチデバイスで軌跡を描画する場合、ブラウザが間引いた
イベントの中間点を `getCoalescedEvents()` で取得できる。
**本プロジェクトではフォルマント更新のみなので不要だが、参考情報として記載。**

```javascript
canvas.addEventListener('pointermove', (e) => {
  // ブラウザが間引いたイベントも含めた全ポイントを取得
  let events = e.getCoalescedEvents();
  for (let ce of events) {
    drawLine(ce.clientX, ce.clientY);
  }
});
```

---

## 6. 推奨実装まとめ

本プロジェクト（母音フォルマント合成器）での推奨構成:

### 6.1 方式選択

**方針B（p5.js のタッチ関数 + マウス関数の両方を定義）を推奨。**

理由:
- p5.js の `mouseX`/`mouseY`、`touches[]` をそのまま活用できる
- p5.js が二重発火を自動的に抑制してくれる
- `return false` でスクロール抑制が簡潔に書ける
- Pointer Events を直接使う方式（方針C）ほどのボイラープレートが不要

### 6.2 完全なイベント処理コード例

```javascript
// ===== sketch.js — イベント処理部分 =====

let isPlaying = false;
let osc, f1Filter, f2Filter; // 音声関連変数（省略）

// --- 定数 ---
const MARGIN = 50;
const CANVAS_W = 500;
const CANVAS_H = 400;

function setup() {
  let cnv = createCanvas(CANVAS_W, CANVAS_H);

  // CSS touch-action を JavaScript から設定
  cnv.elt.style.touchAction = 'none';

  // p5.sound の AudioContext をユーザージェスチャーで resume する準備
  userStartAudio();

  // ... 音声初期化 ...
}

// --- ユーティリティ ---
function isInsidePlotArea(px, py) {
  return px >= MARGIN && px <= CANVAS_W - MARGIN &&
         py >= MARGIN && py <= CANVAS_H - MARGIN;
}

// --- マウスイベント（PCブラウザ） ---
function mousePressed() {
  if (isInsidePlotArea(mouseX, mouseY)) {
    startSound();
    isPlaying = true;
  }
}

function mouseReleased() {
  if (isPlaying) {
    stopSound();
    isPlaying = false;
  }
}

// --- タッチイベント（モバイル） ---
function touchStarted() {
  if (touches.length > 0) {
    let t = touches[0];
    if (isInsidePlotArea(t.x, t.y)) {
      startSound();
      isPlaying = true;
    }
  }
  return false; // ブラウザのデフォルト動作（スクロール等）を抑制
}

function touchMoved() {
  // フォルマント更新は draw() 内で行うため、ここでは抑制のみ
  return false;
}

function touchEnded() {
  if (isPlaying) {
    stopSound();
    isPlaying = false;
  }
  return false;
}

// --- 描画ループ ---
function draw() {
  // ... チャート描画 ...

  // フォルマント更新（マウス/タッチ共通）
  // p5.js は touches[] がある時 mouseX/mouseY をタッチ座標で更新する
  if (isPlaying) {
    let px, py;
    if (touches.length > 0) {
      px = touches[0].x;
      py = touches[0].y;
    } else {
      px = mouseX;
      py = mouseY;
    }
    if (isInsidePlotArea(px, py)) {
      updateFormants(px, py);
    }
  }
}

// --- 音声制御 ---
function startSound() {
  // AudioContext が suspended なら resume（iOS Safari 対策）
  if (getAudioContext().state !== 'running') {
    getAudioContext().resume();
  }
  // オシレータの振幅をフェードイン
  osc.amp(0.002, 0.1);
}

function stopSound() {
  // オシレータの振幅をフェードアウト
  osc.amp(0, 0.1);
}

function updateFormants(px, py) {
  let f1Hz = pixelToHz(py, 250, 1000, MARGIN, CANVAS_H - MARGIN);
  let f2Hz = pixelToHz(px, 2600, 540, MARGIN, CANVAS_W - MARGIN);
  // F2 は右→左で増加するため minHz と maxHz が逆
  f1Filter.freq(f1Hz);
  f2Filter.freq(f2Hz);
}
```

### 6.3 CSS

```css
/* style.css */
html, body {
  margin: 0;
  padding: 0;
  overflow: hidden; /* 全画面使用の場合 */
}

canvas {
  display: block;
  touch-action: none; /* キャンバス上の全ブラウザジェスチャーを無効化 */
}
```

### 6.4 チェックリスト

| 項目 | 対応 |
|------|------|
| マウスクリック/ドラッグ | mousePressed / mouseReleased / draw() 内 mouseIsPressed |
| タッチ開始/移動/終了 | touchStarted / touchMoved / touchEnded |
| 二重発火防止 | p5.js がタッチ関数定義時に自動抑制 |
| スクロール/ズーム抑制 | CSS `touch-action: none` + `return false` |
| AudioContext resume | `userStartAudio()` + `getAudioContext().resume()` |
| iOS Safari 初回ジェスチャー | startSound 内で resume() を呼ぶ |
| マルチタッチ | `touches[0]` のみ使用 |
| passive listener | p5.js が `{ passive: false }` で登録済み |
| パフォーマンス | フォルマント更新は軽量なので throttle 不要 |
