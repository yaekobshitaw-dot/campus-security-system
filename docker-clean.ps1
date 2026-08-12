# docker-clean.ps1
Write-Host "🧹 Cleaning Docker containers, images, and volumes..." -ForegroundColor Cyan
Write-Host "======================================================" -ForegroundColor Cyan

# Stop and remove containers
Write-Host "
⏹ Stopping and removing containers..." -ForegroundColor Yellow
docker-compose down -v

# Remove images
Write-Host "
🗑️ Removing Docker images..." -ForegroundColor Yellow
docker rmi campus-security-system_backend campus-security-system_web-dashboard campus-security-system_mobile-app campus-security-system_ml-service 2>

Write-Host "✅ Cleanup complete!" -ForegroundColor Green
