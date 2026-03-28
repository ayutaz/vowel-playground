# デプロイメント・配信方法調査

## 推奨構成

| 観点 | 推奨 | 理由 |
|------|------|------|
| **デプロイ先（メイン）** | **GitHub Pages** | 無料、ビルド不要、git pushで自動デプロイ |
| **デプロイ先（サブ）** | p5.js Web Editor | コミュニティリーチ、フォーク促進 |
| **SNS配信** | OGP + og:image | 設定コスト最小 |
| **PWA** | 初期段階では不要 | 需要が明確になってから |
| **SEO** | 最低限のメタタグ | lang, description, OGP |

## 1. GitHub Pages (推奨)

- Settings > Pages で `main` ブランチを指定するだけ
- 公開URL: `https://<user>.github.io/<repo>/`
- 制限: 1GB サイト、月100GB帯域、サーバーサイド処理不可
- HTTPS 自動発行 (Let's Encrypt)

## 2. Vercel / Netlify

どちらも利用可能だが、本プロジェクトの規模では過剰。将来的にビルドステップが必要になった場合に検討。

## 3. p5.js Web Editor

元作品と同じプラットフォーム。コミュニティとの親和性が高い。ただしカスタムドメイン不可、OGP制御不可。

## 4. OGP / Twitterカード設定

```html
<meta property="og:title" content="インタラクティブ母音フォルマント合成器" />
<meta property="og:description" content="2D母音空間上でドラッグすると母音がリアルタイム合成されるWebアプリ" />
<meta property="og:type" content="website" />
<meta property="og:image" content="https://yourdomain.com/ogp-image.png" />
<meta property="og:image:width" content="1200" />
<meta property="og:image:height" content="630" />
<meta name="twitter:card" content="summary_large_image" />
```

- og:image は 1200x630 px の母音空間チャートスクリーンショットが理想的
- 既存の .mp4 を GIF に変換して og:image にする手もある

## 5. HTML メタデータ

```html
<html lang="ja">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <meta name="description" content="Gunnar Fantの音源フィルタ理論に基づくインタラクティブ母音フォルマント合成器" />
  <title>インタラクティブ母音フォルマント合成器</title>
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    "name": "インタラクティブ母音フォルマント合成器",
    "applicationCategory": "EducationalApplication"
  }
  </script>
</head>
```

## 6. アクセシビリティ

- `<canvas>` に `role="img"` + `aria-label` 付与
- p5.js の `describe()` で canvas 説明テキスト設定
- CSS `.sr-only` で visually-hidden な操作説明を配置
- 将来: キーボードナビゲーション（矢印キーでカーソル移動）

## 7. 推奨デプロイフロー

1. GitHub リポジトリ作成、ソースファイル + OGP画像をプッシュ
2. GitHub Pages 有効化 (Settings > Pages > main)
3. `index.html` に OGP メタタグ + SEO メタデータ追加
4. p5.js Web Editor にもスケッチアップロード（コミュニティ向け）
5. SNS シェアは GitHub Pages URL を使用
