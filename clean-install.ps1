# PowerShell用クリーンインストールスクリプト

Write-Host "🧹 node_modules と .next を削除中..." -ForegroundColor Yellow
Set-Location frontend
Remove-Item -Recurse -Force node_modules -ErrorAction SilentlyContinue
Remove-Item -Recurse -Force .next -ErrorAction SilentlyContinue
Remove-Item -Force package-lock.json -ErrorAction SilentlyContinue

Write-Host "📦 依存関係を再インストール中..." -ForegroundColor Cyan
npm install

Write-Host "✅ クリーンインストール完了！" -ForegroundColor Green
Write-Host ""
Write-Host "次のコマンドでビルドを試してください:" -ForegroundColor White
Write-Host "  cd frontend; npm run build" -ForegroundColor Gray

