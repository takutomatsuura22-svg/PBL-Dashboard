# Vercelデプロイガイド

このガイドでは、GitHub経由でVercelにデプロイする手順を説明します。

## 📋 前提条件

- GitHubアカウント
- Vercelアカウント（[vercel.com](https://vercel.com)で無料登録可能）
- このプロジェクトがGitHubリポジトリにプッシュされていること

## 🚀 デプロイ手順

### ステップ1: GitHubリポジトリにプッシュ

まだGitHubにプッシュしていない場合：

```bash
# リポジトリを初期化（まだの場合）
git init

# ファイルを追加
git add .

# コミット
git commit -m "Initial commit"

# GitHubでリポジトリを作成後、リモートを追加
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git

# プッシュ
git push -u origin main
```

### ステップ2: Vercelでプロジェクトをインポート

1. [Vercel Dashboard](https://vercel.com/dashboard)にログイン
2. 「Add New...」→「Project」をクリック
3. 「Import Git Repository」からGitHubリポジトリを選択
4. リポジトリを選択して「Import」をクリック

### ステップ3: プロジェクト設定

Vercelが自動的にNext.jsプロジェクトを検出します。`vercel.json`ファイルがプロジェクトルートに配置されているため、以下の設定が自動的に適用されます：

- **Framework Preset**: Next.js（自動検出）
- **Root Directory**: `frontend`（**手動で設定が必要** - 下記参照）
- **Build Command**: `cd frontend && npm install && npm run build`（`vercel.json`で設定）
- **Output Directory**: `.next`（Next.jsのデフォルト）
- **Install Command**: `npm install`（`vercel.json`で設定）

**重要**: プロジェクトはworkspace構成のため、**Root Directoryを`frontend`に手動で設定する必要があります**。

#### Root Directoryの設定方法

**方法1: インポート時に設定（推奨）**
1. リポジトリをインポートする際の「Configure Project」画面で
2. 「Root Directory」を`frontend`に設定
3. 「Deploy」をクリック

**方法2: プロジェクト設定で後から設定**
1. プロジェクト設定画面で「Settings」タブを開く
2. 「General」セクションを開く
3. 「Root Directory」の「Edit」をクリック
4. `frontend`と入力して「Save」をクリック
5. 新しいデプロイを実行（設定変更後は再デプロイが必要）

**注意**: Root Directoryを`frontend`に設定した場合、`vercel.json`のビルドコマンドは自動的に`frontend`ディレクトリ内で実行されるため、`cd frontend`は不要になります。ただし、現在の設定でも動作します。

### ステップ4: 環境変数の設定

Vercelのプロジェクト設定で、以下の環境変数を追加：

1. プロジェクト設定画面で「Environment Variables」を開く
2. 以下の環境変数を追加：

```
AIRTABLE_API_KEY=your_airtable_api_key_here
AIRTABLE_BASE_ID=your_airtable_base_id_here
```

オプション（テーブル名をカスタマイズする場合）：

```
AIRTABLE_STUDENTS_TABLE=Students
AIRTABLE_TASKS_TABLE=Tasks
AIRTABLE_TEAMS_TABLE=Teams
```

**重要**: 
- 環境変数は**本番環境（Production）**、**プレビュー環境（Preview）**、**開発環境（Development）**すべてに設定することを推奨
- または、必要に応じて環境ごとに異なる値を設定可能

### ステップ5: デプロイ

1. 「Deploy」ボタンをクリック
2. ビルドが完了するまで待機（通常1-3分）
3. デプロイが完了すると、URLが表示されます（例: `https://your-project.vercel.app`）

## 🔄 自動デプロイ

Vercelは以下の場合に自動的にデプロイします：

- **mainブランチへのプッシュ**: 本番環境にデプロイ
- **その他のブランチへのプッシュ**: プレビュー環境にデプロイ
- **プルリクエスト**: プレビュー環境にデプロイ

## 📝 環境変数の更新

環境変数を更新する場合：

1. Vercel Dashboard → プロジェクト → Settings → Environment Variables
2. 変数を編集または追加
3. 「Save」をクリック
4. 新しいデプロイをトリガー（または既存のデプロイを再デプロイ）

## 🛠️ トラブルシューティング

### ビルドエラーが発生する場合

1. **ログを確認**: Vercel Dashboard → Deployments → 失敗したデプロイ → 「View Function Logs」
2. **ローカルでビルドテスト**:
   ```bash
   npm run build
   ```
3. **依存関係の問題**: `package.json`と`package-lock.json`が最新であることを確認

### 環境変数が読み込まれない場合

1. 環境変数が正しく設定されているか確認
2. 変数名にタイポがないか確認
3. デプロイを再実行（環境変数の変更後は再デプロイが必要）

### Airtable接続エラー

1. APIキーとBase IDが正しいか確認
2. AirtableのAPIキーに適切な権限があるか確認
3. Base IDが正しいか確認

## 🔒 セキュリティ

- **環境変数はGitHubにコミットしない**: `.env.local`は`.gitignore`に含まれています
- **APIキーはVercelの環境変数で管理**: ダッシュボードで安全に管理できます
- **本番環境と開発環境で異なるAPIキーを使用することを推奨**

## 📚 参考リンク

- [Vercel Documentation](https://vercel.com/docs)
- [Next.js on Vercel](https://vercel.com/docs/frameworks/nextjs)
- [Environment Variables in Vercel](https://vercel.com/docs/concepts/projects/environment-variables)

