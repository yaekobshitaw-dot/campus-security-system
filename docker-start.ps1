Write-Host "🐳 Starting Campus Security System with Docker..." -ForegroundColor Cyan
docker-compose up -d --build
Start-Sleep -Seconds 10
docker-compose ps
Write-Host "
🌐 Access your services:" -ForegroundColor Cyan
Write-Host "  Web Dashboard: http://localhost:5173" -ForegroundColor Green
Write-Host "  Backend API: http://localhost:5000" -ForegroundColor Green
Write-Host "
👤 Login: test@test.com" -ForegroundColor Cyan
Write-Host "🔑 Password: Password123" -ForegroundColor Cyan
