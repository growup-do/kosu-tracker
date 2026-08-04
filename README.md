# 工数管理システム（管理用 / クライアント共有用）

プランC（実働時間契約）の稼働管理ツール。データは **Firebase Firestore** に保存され、
全端末でリアルタイムに同期されます（ログイン不要・アクセス制限は上流の管理システム側で実施）。

- 公開URL: **https://growup-do.github.io/kosu-tracker/**
- リポジトリ: https://github.com/growup-do/kosu-tracker（`main` に push すると自動デプロイ）
- Firebase プロジェクト: `kosu-tracker`（Firestore `(default)` / Sparkプラン）

## URL構成

| 画面 | URL | 用途 |
|---|---|---|
| プロジェクト一覧 | `/` | 管理者用トップ。作成・削除・URL発行 |
| 管理ビュー | `/?project=ID&view=admin` | 計測・単価・予定の入力（自分＋外注） |
| 共有ビュー | `/?project=ID&view=client` | クライアント配布用。閲覧専用 |

## 主な仕様

- 計測：作業ごとに開始／終了（担当者入力なし。作業種＝担当が自明のため）。押し忘れはアーカイブで手動修正・手動追加。
- 作業種：追加・削除可（計測済みは削除不可）。単価はコーディングのみ・**一度確定すると変更不可**（外注原価管理用）。
- クライアント費用：時給 **6,250円**（`src/util.ts` の `CLIENT_RATE`）。
- 月次：月ナビで切替。終了した月のサマリーは「確定」表示。アーカイブは曜日つき。
- 作業予定：月ごとに登録・完了チェック。

## 開発

```bash
npm install
npm run dev      # http://localhost:5190
npm run build    # 型チェック + 本番ビルド
```

## データ整合性（重要）

すべての書き込みは **Firestore トランザクション**で行っています（`src/store.ts` の `mutate`）。
サーバー上の最新データを読んでから変更を適用するため、複数人が同時に操作しても
「後の書き込みが先の書き込みを上書きして記録が消える」ことはありません。
通信断などで保存に失敗した場合は、黙って消えるのではなく**画面上部に赤いエラーバナー**が表示されます。

## Firestore セキュリティルール（公開済み）

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /projects/{projectId} {
      allow read, write: if true;
    }
  }
}
```

URLを知っていれば誰でも読み書き（削除含む）できます。アクセス制限は上流側で行う設計です。

## 運用上の注意

- **プロジェクト削除は取り消せません**（確認ダイアログのみ）。誤削除に注意。
- Firestore 無料枠（Spark）：書き込み2万/日・読み取り5万/日。数名運用では十分な余裕。
- 月集計は「開始時刻の月」基準。日をまたぐ計測は、終了→翌日再開の運用が無難。
