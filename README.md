# 黒井流オブリーク・ストラテジーズ

生成し続ける問いの展示空間（Generative Text Art）。

- 静的サイト: `docs/index.html`（文字のみ、ボタン2つ）
- アーカイブ: `docs/questions.json`（配列）
- 本日: `docs/today.json`（`{"q":"..."}`）
- 日次生成: GitHub Actions で1日1問生成し、アーカイブに追記してコミット

## GitHub セットアップ

1. このフォルダ内容を GitHub リポジトリにアップロード
2. Settings → Pages → Source を `main` / `docs` に設定
3. Settings → Secrets and variables → Actions で `GEMINI_API_KEY` を登録
4. Actions の `daily-question` を一度手動実行して動作確認
