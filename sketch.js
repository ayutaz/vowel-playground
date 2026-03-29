// ===== インタラクティブ母音フォルマント合成器 =====
// 原作: 御水（みもい）@mimoi_sound
// 理論: Gunnar Fant の音源フィルタ理論
// 母音配置: Dr. Geoff Lindsey の母音空間

// --- 定数 ---
const CANVAS_W = 500;
const CANVAS_H = 430;
const MARGIN = 50;
const PLOT_LEFT = MARGIN;
const PLOT_RIGHT = CANVAS_W - MARGIN;
const PLOT_TOP = MARGIN;
const PLOT_BOTTOM = 350;

const F1_MIN = 250;
const F1_MAX = 1000;
const F2_MIN = 540;
const F2_MAX = 2600;

const F0 = 131;
const AMP = 0.002;
const FADE_TIME = 0.1;

// --- 状態変数 ---
let osc;
let F1F, F2F, F3F, F4F, BEF, LPF;
let playing = false;
let fontReady = false;

// --- 音声プリセット (kawaii-voice-changer 研究 arXiv:2507.06235 に基づく) ---
const PRESETS = [
  { name: "通常",     f0: 131, scale: 1.0,  breath: 0,    vibDepth: 0, vibRate: 5.5,
    q: [0.2, 0.4, 0.8, 1.0], gain: [60, 60, 50, 40] },
  { name: "女声",     f0: 220, scale: 1.15, breath: 0.1,  vibDepth: 2, vibRate: 5.5,
    q: [0.25, 0.5, 0.85, 1.1], gain: [58, 60, 52, 42] },
  { name: "可愛い声", f0: 280, scale: 1.3,  breath: 0.25, vibDepth: 4, vibRate: 5.0,
    q: [0.4, 0.7, 1.0, 1.3], gain: [55, 60, 56, 48] },
  { name: "アニメ声", f0: 330, scale: 1.5,  breath: 0.35, vibDepth: 5, vibRate: 5.0,
    q: [0.5, 0.8, 1.2, 1.5], gain: [52, 58, 58, 52] },
];
let currentPreset = 0;
let noise;

// --- ボタンUI定数 ---
const BTN_W = 95;
const BTN_H = 30;
const BTN_GAP = 10;
const BTN_Y = PLOT_BOTTOM + 25;

// --- IPA母音データ [symbol, F1(Hz), F2(Hz)] ---
// 原作の Geoff Lindsey 母音空間配置に準拠
const IPA_VOWELS = [
  // 基本母音
  ["i",      275, 2400],
  ["e",      412, 2150],
  ["\u025B", 620, 1800],  // ɛ
  ["a",      900, 1350],
  ["\u0251", 710, 1050],  // ɑ
  ["\u0254", 530,  830],  // ɔ
  ["o",      380,  690],
  ["u",      275,  600],
  // 二次母音
  ["y",      275, 1860],
  ["\u00F8", 400, 1730],  // ø
  ["\u0153", 590, 1550],  // œ
  ["\u028C", 560, 1140],  // ʌ
  ["\u0264", 390, 1170],  // ɤ
  ["\u026F", 275, 1200],  // ɯ
  // シュワー
  ["\u0259", 490, 1350],  // ə
  // 近閉/近開母音
  ["\u0275", 340, 1400],  // ɵ
  ["\u0250", 700, 1300],  // ɐ
  ["\u026A", 340, 2020],  // ɪ
  ["\u028A", 330,  850],  // ʊ
  ["(\u00E6)", 760, 1600],  // (æ)
  ["(\u0252)", 620,  930],  // (ɒ)
];

// --- 母音間接続 [index1, index2] ---
const VOWEL_CONNECTIONS = [
  // 前舌非円唇
  [0, 1], [1, 2], [2, 3],
  // 後舌円唇
  [4, 5], [5, 6], [6, 7],
  // 前舌円唇
  [8, 9], [9, 10],
  // 後舌非円唇
  [11, 12], [12, 13],
  // 円唇/非円唇ペア
  [0, 8], [1, 9], [2, 10],
  [11, 5], [12, 6], [13, 7],
];

// --- 座標変換（対数スケール） ---

function hzToPixel(hz, minHz, maxHz, minPx, maxPx) {
  let t = (Math.log(hz) - Math.log(minHz)) / (Math.log(maxHz) - Math.log(minHz));
  return minPx + t * (maxPx - minPx);
}

function pixelToHz(px, minHz, maxHz, minPx, maxPx) {
  let t = (px - minPx) / (maxPx - minPx);
  return Math.exp(Math.log(minHz) + t * (Math.log(maxHz) - Math.log(minHz)));
}

function f1ToY(f1Hz) {
  return hzToPixel(f1Hz, F1_MIN, F1_MAX, PLOT_TOP, PLOT_BOTTOM);
}

function f2ToX(f2Hz) {
  return hzToPixel(f2Hz, F2_MIN, F2_MAX, PLOT_RIGHT, PLOT_LEFT);
}

function yToF1(y) {
  return pixelToHz(y, F1_MIN, F1_MAX, PLOT_TOP, PLOT_BOTTOM);
}

function xToF2(x) {
  return pixelToHz(x, F2_MIN, F2_MAX, PLOT_RIGHT, PLOT_LEFT);
}

function isInsidePlotArea(px, py) {
  return px >= PLOT_LEFT && px <= PLOT_RIGHT && py >= PLOT_TOP && py <= PLOT_BOTTOM;
}

// --- 音声初期化 ---

function initAudio() {
  osc = new p5.Oscillator("sawtooth");
  osc.freq(F0);
  osc.amp(0);
  osc.start();
  osc.disconnect();

  // ブレシネス用ピンクノイズ
  noise = new p5.Noise("pink");
  noise.start();
  noise.amp(0);
  noise.disconnect();

  F1F = new p5.Filter();
  F1F.setType("peaking");
  F2F = new p5.Filter();
  F2F.setType("peaking");
  F3F = new p5.Filter();
  F3F.setType("peaking");
  F4F = new p5.Filter();
  F4F.setType("peaking");
  BEF = new p5.Filter();
  BEF.setType("notch");
  LPF = new p5.LowPass();

  osc.connect(F1F);
  osc.connect(F2F);
  osc.connect(F3F);
  osc.connect(F4F);
  osc.connect(BEF);
  osc.connect(LPF);

  noise.connect(F1F);
  noise.connect(F2F);
  noise.connect(F3F);
  noise.connect(F4F);
  noise.connect(BEF);
  noise.connect(LPF);
}

// --- 音声制御 ---

function startSound() {
  if (getAudioContext().state !== "running") {
    getAudioContext().resume();
  }
  let p = PRESETS[currentPreset];
  osc.freq(p.f0);
  osc.amp(AMP * (1 - p.breath), FADE_TIME);
  noise.amp(AMP * p.breath * 6, FADE_TIME);
  playing = true;
}

function stopSound() {
  osc.amp(0, FADE_TIME);
  noise.amp(0, FADE_TIME);
  playing = false;
}

function updateFormants(px, py) {
  let p = PRESETS[currentPreset];
  let s = p.scale;
  F1F.set(yToF1(py) * s, p.q[0]);
  F1F.gain(p.gain[0]);
  F2F.set(xToF2(px) * s, p.q[1]);
  F2F.gain(p.gain[1]);
  F3F.set(2500 * s, p.q[2]);
  F3F.gain(p.gain[2]);
  F4F.set(3500 * s, p.q[3]);
  F4F.gain(p.gain[3]);
  BEF.set(5000 * s, 0.2);
  LPF.set(7250 * s, 0.001);
}

// --- p5.js ライフサイクル ---

function setup() {
  let cnv = createCanvas(CANVAS_W, CANVAS_H);
  cnv.elt.style.touchAction = "none";
  textAlign(CENTER, CENTER);
  userStartAudio();
  initAudio();
  textFont('"Noto Sans", "Lucida Grande", "Lucida Sans Unicode", "DejaVu Sans", sans-serif');
  document.fonts.ready.then(function () {
    fontReady = true;
  });
}

function draw() {
  if (!fontReady) {
    background(230);
    fill(100);
    noStroke();
    textSize(16);
    textAlign(CENTER, CENTER);
    text("Loading...", CANVAS_W / 2, CANVAS_H / 2);
    return;
  }

  noCursor();
  background(220);

  // 白いプロットエリア
  noStroke();
  fill(255);
  rect(PLOT_LEFT, PLOT_TOP, PLOT_RIGHT - PLOT_LEFT, PLOT_BOTTOM - PLOT_TOP);

  drawGrid();
  drawImpossibleRegion();
  drawConnections();
  drawVowelSymbols();
  drawAxes();
  drawCursor();

  // ボタン領域の背景（不可能領域のはみ出しを隠す）
  noStroke();
  fill(220);
  rect(0, PLOT_BOTTOM + 15, CANVAS_W, CANVAS_H - PLOT_BOTTOM - 15);
  drawPresetButtons();

  // フォルマント更新
  if (playing) {
    let px = mouseX, py = mouseY;
    if (touches.length > 0) {
      px = touches[0].x;
      py = touches[0].y;
    }
    // ビブラート
    let p = PRESETS[currentPreset];
    if (p.vibDepth > 0) {
      let vibOffset = p.vibDepth * Math.sin(TWO_PI * p.vibRate * millis() / 1000);
      osc.freq(p.f0 + vibOffset);
    }
    updateFormants(px, py);
  }
}

// --- 描画関数 ---

function drawGrid() {
  noFill();
  stroke(200);
  strokeWeight(0.5);
  // F2 垂直グリッド
  let f2 = Math.ceil(xToF2(CANVAS_W) / 100) * 100;
  while (f2ToX(f2) > 0) {
    line(f2ToX(f2), 0, f2ToX(f2), CANVAS_H);
    f2 += 100;
  }
  // F1 水平グリッド
  let f1 = Math.ceil(yToF1(0) / 100) * 100;
  while (f1ToY(f1) <= CANVAS_H) {
    line(0, f1ToY(f1), CANVAS_W, f1ToY(f1));
    f1 += 100;
  }
}

function drawImpossibleRegion() {
  noStroke();
  fill(160);
  triangle(
    CANVAS_W,
    f1ToY(xToF2(CANVAS_W)),
    f2ToX(yToF1(CANVAS_H)),
    CANVAS_H,
    CANVAS_W,
    CANVAS_H
  );
}

function drawConnections() {
  stroke(220);
  strokeWeight(2);
  for (let [i, j] of VOWEL_CONNECTIONS) {
    let v1 = IPA_VOWELS[i];
    let v2 = IPA_VOWELS[j];
    line(f2ToX(v1[2]), f1ToY(v1[1]), f2ToX(v2[2]), f1ToY(v2[1]));
  }
}

function drawVowelSymbols() {
  fill(0);
  noStroke();
  textSize(30);
  textAlign(CENTER, CENTER);
  for (let v of IPA_VOWELS) {
    text(v[0], f2ToX(v[2]), f1ToY(v[1]));
  }
}

function drawAxes() {
  // 軸線
  noFill();
  stroke(0);
  strokeWeight(2);
  line(PLOT_LEFT - 10, PLOT_TOP, PLOT_RIGHT, PLOT_TOP);
  line(PLOT_RIGHT, PLOT_TOP, PLOT_RIGHT, PLOT_BOTTOM + 10);

  // 矢印
  noStroke();
  fill(0);
  triangle(PLOT_LEFT - 15, PLOT_TOP, PLOT_LEFT - 5, PLOT_TOP - 5, PLOT_LEFT - 5, PLOT_TOP + 5);
  triangle(PLOT_RIGHT, PLOT_BOTTOM + 15, PLOT_RIGHT + 5, PLOT_BOTTOM + 5, PLOT_RIGHT - 5, PLOT_BOTTOM + 5);

  // ラベル
  textSize(14);
  textFont("sans-serif");
  textAlign(CENTER, CENTER);
  text(F2_MAX, PLOT_LEFT, PLOT_TOP - 15);
  text(F2_MIN, PLOT_RIGHT, PLOT_TOP - 15);
  text(F1_MIN, PLOT_RIGHT + 25, PLOT_TOP + 5);
  text(F1_MAX, PLOT_RIGHT + 25, PLOT_BOTTOM + 5);
  text("F2 (Hz)", CANVAS_W / 2, PLOT_TOP - 15);
  text("F1\n(Hz)", PLOT_RIGHT + 25, (PLOT_TOP + PLOT_BOTTOM) / 2);

  // IPA記号用フォントに戻す
  textFont('"Noto Sans", "Lucida Grande", "Lucida Sans Unicode", "DejaVu Sans", sans-serif');
}

function drawCursor() {
  let px = mouseX, py = mouseY;
  if (touches.length > 0) {
    px = touches[0].x;
    py = touches[0].y;
  }
  noFill();
  stroke(0);
  strokeWeight(2);
  if (playing) {
    circle(px, py, 8);
  } else {
    circle(px, py, 10);
  }
}

// --- プリセットボタンUI ---

function drawPresetButtons() {
  let totalW = PRESETS.length * BTN_W + (PRESETS.length - 1) * BTN_GAP;
  let startX = (CANVAS_W - totalW) / 2;
  for (let i = 0; i < PRESETS.length; i++) {
    let x = startX + i * (BTN_W + BTN_GAP);
    let isActive = (i === currentPreset);
    noStroke();
    fill(isActive ? color(60, 130, 200) : 180);
    rect(x, BTN_Y, BTN_W, BTN_H, 5);
    fill(isActive ? 255 : 50);
    textSize(13);
    textAlign(CENTER, CENTER);
    text(PRESETS[i].name, x + BTN_W / 2, BTN_Y + BTN_H / 2);
  }
}

function getClickedButton(mx, my) {
  if (my < BTN_Y || my > BTN_Y + BTN_H) return -1;
  let totalW = PRESETS.length * BTN_W + (PRESETS.length - 1) * BTN_GAP;
  let startX = (CANVAS_W - totalW) / 2;
  for (let i = 0; i < PRESETS.length; i++) {
    let x = startX + i * (BTN_W + BTN_GAP);
    if (mx >= x && mx <= x + BTN_W) return i;
  }
  return -1;
}

function applyPreset(idx) {
  currentPreset = idx;
  let p = PRESETS[idx];
  osc.freq(p.f0);
  if (playing) {
    osc.amp(AMP * (1 - p.breath), FADE_TIME);
    noise.amp(AMP * p.breath * 6, FADE_TIME);
  }
}

// --- イベントハンドラ ---

function mousePressed() {
  let btn = getClickedButton(mouseX, mouseY);
  if (btn >= 0) {
    applyPreset(btn);
    return;
  }
  if (isInsidePlotArea(mouseX, mouseY)) {
    startSound();
  }
}

function mouseReleased() {
  if (playing) {
    stopSound();
  }
}

function touchStarted() {
  if (touches.length > 0) {
    let btn = getClickedButton(touches[0].x, touches[0].y);
    if (btn >= 0) {
      applyPreset(btn);
      return false;
    }
    if (isInsidePlotArea(touches[0].x, touches[0].y)) {
      startSound();
    }
  }
  return false;
}

function touchMoved() {
  return false;
}

function touchEnded() {
  if (playing) {
    stopSound();
  }
  return false;
}
