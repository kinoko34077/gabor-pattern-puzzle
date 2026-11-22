# ガボールパターンパズル

ガボール模様を3つ以上そろえて消すブラウザゲーム。TypeScriptとCanvas 2Dで動作し、PWAとしてインストールした後はオフラインでも遊べます。

## 遊び方

- 模様を上下左右の隣のマスへドラッグして交換します。3つ以上そろえると消去できます。
- 模様を消すと制限時間が加算されます。得点はプレイ時間に応じて増えます。
- 右側の操作欄から、表示モード・配色・盤面サイズ・ヒントを変更できます。
- キーボード：矢印キーで移動、Shift＋矢印キーで交換、Hでヒント表示。

## ローカル起動

Node.jsとPython 3が必要です。

```sh
npm ci
npm run check
python3 -m http.server 8000
```

ブラウザで `http://localhost:8000/` を開きます。Service WorkerはHTTPSまたはlocalhost環境で利用できます。

## 構成

- `src/game.ts`：ゲーム状態、消去・落下・連鎖、時間管理、保存。
- `src/gabor.ts`：ガボール模様を数学的に生成。
- `src/render.ts`：Canvas 2Dによる描画と操作表示。
- `src/main.ts`：ブラウザのライフサイクルとマウス・タッチ・キーボード入力。
- `manifest.webmanifest`、`service-worker.js`、`icons/`：PWAのインストール・オフライン対応。
- `.github/workflows/pages.yml`：ビルド・テストとGitHub Pagesへの公開。

## データと注意事項

アカウント登録、外部ゲームAPI、アクセス解析やトラッキングは不要です。設定はブラウザ内に保存されます。

このゲームは医療行為ではなく、視力の改善を保証するものではありません。
