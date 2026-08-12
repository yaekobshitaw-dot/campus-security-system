# docker-rebuild.ps1
Write-Host "🔄 Rebuilding Docker containers..." -ForegroundColor Cyan
Write-Host "=====================================" -ForegroundColor Cyan

# Stop containers
Write-Host "
⏹ Stopping containers..." -ForegroundColor Yellow
docker-compose down

# Remove old images
Write-Host "
🗑️ Removing old images..." -ForegroundColor Yellow
docker rmi campus-security-system_backend campus-security-system_web-dashboard campus-security-system_mobile-app campus-security-system_ml-service 2>

# Build and start
Write-Host "
📦 Rebuilding and starting..." -ForegroundColor Yellow
docker-compose up -d --build

Write-Host "✅ Rebuild complete!" -ForegroundColor Green
