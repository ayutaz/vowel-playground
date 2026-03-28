# 類似プロジェクト調査

## 1. Pink Trombone (Neil Thapen)

**URL**: https://dood.al/pinktrombone/

声道全体を1次元波動方程式で物理シミュレーションする **物理モデル合成**。本プロジェクトの **フォルマント合成** とは根本的に異なるアプローチ。

| 観点 | Pink Trombone | 本プロジェクト |
|------|--------------|---------------|
| 合成方式 | 物理モデル（波動方程式） | 音源フィルタ理論（オシレータ+フィルタ） |
| パラメータ | 声道形状（舌位置、唇、鼻腔） | F1/F2周波数（音響空間） |
| 出力音 | 母音 + 子音 + 鼻音 | 母音のみ |
| コード規模 | 数千行 | ~200行 |

**活かせるアイデア**: 口腔断面図のアニメーション表示（@Ki_fun_thoughts の提案）。

## 2. Delay Lama

XYパッドで母音をモーフィングするVSTプラグイン。X=ピッチ、Y=母音色。僧侶キャラクターの口がパラメータ連動。CSVで複数ユーザーが連想。

**活かせるアイデア**: ピッチ制御軸の追加、キャラクターアニメーション、Web MIDI API対応。

## 3. Golan Levin "vocal-vowel-formant-tonejs"

**URL**: https://editor.p5js.org/golan/sketches/El9vQ13I1

mimoi版の直接の元ネタ。p5.js + Tone.js 構成。

| 観点 | Golan Levin版 | mimoi版 |
|------|-------------|---------|
| 音源 | **ピンクノイズ** | **鋸歯状波** (131Hz) |
| フィルタ | Bandpass 2-3本 | **Peaking 4本 + Notch + LPF** |
| 音質 | ウィスパー的 | 有声的（声帯振動に近い） |

mimoi版は鋸歯状波の採用と6フィルタ並列構成で大幅に音質向上。

## 4. Praat

音声学研究の標準ツール。分析主体でリアルタイム合成不可。

mimoi氏の開発動機:
> "In his vowel space video, he mentioned the Praat app and said that it doesn't give the vowel sound in real time, so I wondered if I could actually make it possible with p5.js"

**ポジショニング**: 「Praatではできないリアルタイム操作をブラウザで実現」。

## 5. Gunnar Fant の OVE 合成器

1950年代のアナログフォルマント合成器。"How are you?" / "I love you" デモは歴史的偉業。mimoi版のプリセットデモはこのオマージュ。

## 6. 活かせるアイデア総合

| 教訓 | 出典 | 応用 |
|------|------|------|
| 視覚フィードバックが体験を劇的に向上 | Pink Trombone, Delay Lama | 口腔断面図追加 |
| シンプルさが普及の鍵 | Golan版 vs Praat | ~200行・ビルド不要を維持 |
| ピッチ制御が表現力を広げる | Delay Lama | F0スライダー追加 |
| ノイズ音源でウィスパー表現 | Golan版 | 有声/無声トグル |
| スペクトログラムが教育効果を高める | @taekie版 | リアルタイムスペクトログラム並列表示 |
| 歴史的文脈が深みを与える | OVE合成器 | デモパス自動再生、Fantへのオマージュ |
