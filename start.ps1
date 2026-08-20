Write-Host "🚀 Starting Campus Security System (Manual)..." -ForegroundColor Cyan
Write-Host "
📦 Starting Backend..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command 'cd backend; npm install; npm run dev'"
Start-Sleep -Seconds 3
Write-Host "🌐 Starting Web Dashboard..." -ForegroundColor Yellow
Start-Process powershell -ArgumentList "-NoExit -Command 'cd web-dashboard; npm install; npm run dev'"
Start-Sleep -Seconds 5
Start-Process "http://localhost:5173"
Write-Host "
✅ System started!" -ForegroundColor Green
Write-Host "🌐 Dashboard: http://localhost:5173" -ForegroundColor Cyan
Write-Host "🔐 Use credentials configured for your environment." -ForegroundColor Cyan
