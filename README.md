# Interactive Vowel Formant Synthesizer

2D母音空間チャート上でマウスをドラッグすると、対応する母音がリアルタイムで合成されるWebアプリケーション。

Gunnar Fant の**音源フィルタ理論**に基づき、Dr. Geoff Lindsey の母音空間配置を採用しています。

## Demo

チャート上でクリック＆ドラッグすると、マウス位置に対応する母音が合成されます。

- **X軸 (F2)**: 舌の前後位置 / 唇の丸め（540–2600 Hz）
- **Y軸 (F1)**: 舌の高さ / 口の開き（250–1000 Hz）

## How It Works

鋸歯状波オシレータ（131 Hz）を音源として、6つのフィルタを並列接続:

| フィルタ | 種類 | 周波数 | 役割 |
|---------|------|--------|------|
| F1F | peaking | マウスY制御 | 第1フォルマント（舌の高さ） |
| F2F | peaking | マウスX制御 | 第2フォルマント（舌の前後） |
| F3F | peaking | 2500 Hz 固定 | 高次フォルマント |
| F4F | peaking | 3500 Hz 固定 | 高次フォルマント |
| BEF | notch | 5000 Hz 固定 | 反フォルマント |
| LPF | lowpass | 7250 Hz 固定 | 高周波減衰 |

## Getting Started

```bash
# ローカルサーバーで起動（p5.sound は file:// では動作しません）
npx http-server . -p 8080

# ブラウザで開く
# http://localhost:8080
```

## Tech Stack

- **p5.js** v1.9.0 + **p5.sound**
- **Google Fonts Noto Sans** (IPA記号のクロスプラットフォーム表示)
- ビルドツール不要（HTML/JS/CSS のみ）

## Credits

- 原作: [御水（みもい）@mimoi_sound](https://x.com/mimoi_sound) — [Original Demo](https://editor.p5js.org/mimoi/full/xBwV_oqCE)
- 母音配置: Dr. Geoff Lindsey の提唱する母音空間
- Vowel クラスの原型: [Golan Levin](https://editor.p5js.org/golan/sketches/El9vQ13I1)
- 理論: Gunnar Fant — *Acoustic Theory of Speech Production* (1960)

## License

MIT
