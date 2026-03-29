# Interactive Vowel Formant Synthesizer

2D母音空間チャート上でマウスをドラッグすると、対応する母音がリアルタイムで合成されるWebアプリケーション。

Gunnar Fant の**音源フィルタ理論**に基づき、Dr. Geoff Lindsey の母音空間配置を採用しています。

**Live Demo**: https://ayutaz.github.io/vowel-playground/

## Demo

チャート上でクリック＆ドラッグすると、マウス位置に対応する母音が合成されます。

- **X軸 (F2)**: 舌の前後位置 / 唇の丸め（540–2600 Hz）
- **Y軸 (F1)**: 舌の高さ / 口の開き（250–1000 Hz）

## Voice Presets

4つの音声プリセットで声質を切り替えられます（[arXiv:2507.06235](https://arxiv.org/abs/2507.06235) の研究に基づく）:

| プリセット | F0 | フォルマントスケール | ブレシネス | ビブラート | 特徴 |
|-----------|-----|-------------------|-----------|-----------|------|
| **通常** | 131 Hz | x1.0 | なし | なし | 成人男性の声 |
| **女声** | 220 Hz | x1.15 | 微量 | ±1.5 Hz | 成人女性の声 |
| **可愛い声** | 280 Hz | x1.3 | 軽め | ±3 Hz | 少女的な明るい声 |
| **アニメ声** | 330 Hz | x1.5 | やや強め | ±4 Hz | アニメキャラクター風 |

フォルマントスケールは声道長のシミュレーション: 大きいほど短い声道（＝小さい体）を模擬します。

## How It Works

鋸歯状波オシレータ＋ピンクノイズ（ブレシネス用）を音源として、6つのフィルタを並列接続:

| フィルタ | 種類 | 周波数 | 役割 |
|---------|------|--------|------|
| F1F | peaking | マウスY × スケール | 第1フォルマント（舌の高さ） |
| F2F | peaking | マウスX × スケール | 第2フォルマント（舌の前後） |
| F3F | peaking | 2500 Hz × スケール | 高次フォルマント |
| F4F | peaking | 3500 Hz × スケール | 高次フォルマント |
| BEF | notch | 5000 Hz × スケール | 反フォルマント |
| LPF | lowpass | 7250 Hz × スケール | 高周波減衰 |

可愛い声プリセットでは F3/F4 のゲインを F1/F2 より強く設定し、スペクトル傾斜をフラットにすることで明るい音色を実現しています。

## Getting Started

```bash
# ローカルサーバーで起動（p5.sound は file:// では動作しません）
npx http-server . -p 8080

# ブラウザで開く
# http://localhost:8080
```

## Tech Stack

- **p5.js** v1.9.0 + **p5.sound**（Web Audio API）
- **Google Fonts Noto Sans**（IPA記号のクロスプラットフォーム表示）
- ビルドツール不要（HTML/JS/CSS のみ）

## Credits

- 原作: [御水（みもい）@mimoi_sound](https://x.com/mimoi_sound) — [Original Demo](https://editor.p5js.org/mimoi/full/xBwV_oqCE)
- 母音配置: Dr. Geoff Lindsey の提唱する母音空間
- Vowel クラスの原型: [Golan Levin](https://editor.p5js.org/golan/sketches/El9vQ13I1)
- 理論: Gunnar Fant — *Acoustic Theory of Speech Production* (1960)
- 可愛い声研究: [Super Kawaii Vocalics](https://arxiv.org/abs/2507.06235) (arXiv:2507.06235, CHI 2025)

## License

MIT
