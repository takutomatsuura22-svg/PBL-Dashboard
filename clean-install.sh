#!/bin/bash
# クリーンインストールスクリプト

echo "🧹 node_modules と .next を削除中..."
cd frontend
rm -rf node_modules
rm -rf .next
rm -f package-lock.json

echo "📦 依存関係を再インストール中..."
npm install

echo "✅ クリーンインストール完了！"
echo ""
echo "次のコマンドでビルドを試してください:"
echo "  cd frontend && npm run build"

