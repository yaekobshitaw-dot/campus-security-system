# docker-logs.ps1
Write-Host "📋 Showing logs for all containers..." -ForegroundColor Cyan
Write-Host "=========================================" -ForegroundColor Cyan

docker-compose logs -f --tail=100
