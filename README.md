# 黒井流オブリーク・ストラテジーズ

生成し続ける問いの展示空間（Generative Text Art）。

- 静的サイト: `public/index.html`（文字のみ、ボタン2つ）
- アーカイブ: `public/questions.json`（配列）
- 本日: `public/today.json`（{"q":"..."}）
- 日次生成: GitHub Actions で1日1問生成し、アーカイブに追記してコミット

## データ統合の結果

- TSV由来: 2272
- 既存JSON由来: 2272
- DB由来（正規化後）: 2272
- 統合後ユニーク合計: 3723

## DB解析メモ

抽出できたテーブル:
- cards: cols=['question', 'answer'], extracted_cells=8500
- data_for_fact: cols=['value'], extracted_cells=6000

（問そのものは停止語やタグ行（インスピレーション/Oblique）を除去して正規化しています。）
