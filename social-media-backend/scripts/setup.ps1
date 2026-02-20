# ============================================================================
# Social Media Platform - Local Setup Script (Windows PowerShell)
# ============================================================================

Write-Host '🚀 Social Media Platform - Local Setup' -ForegroundColor Cyan
Write-Host '========================================' -ForegroundColor Cyan
Write-Host ''

# Check prerequisites
Write-Host '📋 Checking prerequisites...' -ForegroundColor Yellow

$hasDocker = Get-Command docker -ErrorAction SilentlyContinue
$hasDockerCompose = Get-Command docker-compose -ErrorAction SilentlyContinue
$hasNode = Get-Command node -ErrorAction SilentlyContinue

if (-not $hasDocker) {
    Write-Host ' Docker is not installed' -ForegroundColor Red
    exit 1
}

if (-not $hasDockerCompose) {
    Write-Host ' Docker Compose is not installed' -ForegroundColor Red
    exit 1
}

if (-not $hasNode) {
    Write-Host ' Node.js is not installed' -ForegroundColor Red
    exit 1
}

Write-Host ' All prerequisites found' -ForegroundColor Green
Write-Host ''

# Stop existing containers
Write-Host ' Stopping existing containers...' -ForegroundColor Yellow
docker-compose down 2>$null
Write-Host ''

# Clean up old volumes (optional)
$response = Read-Host 'Do you want to clean up old data? (y/N)'
if ($response -eq 'y' -or $response -eq 'Y') {
    Write-Host '  Cleaning up old volumes...' -ForegroundColor Yellow
    docker-compose down -v
    Write-Host ' Volumes cleaned' -ForegroundColor Green
}
Write-Host ''

# Start infrastructure services
Write-Host ' Starting infrastructure services...' -ForegroundColor Yellow
docker-compose up -d postgres redis zookeeper kafka elasticsearch
Write-Host ''

# Wait for services to be healthy
Write-Host ' Waiting for services to be ready...' -ForegroundColor Yellow
Write-Host '   This may take 1-2 minutes...'

$maxAttempts = 60
$attempt = 0

while ($attempt -lt $maxAttempts) {
    $postgresHealth = docker-compose ps postgres 2>$null | Select-String 'healthy'
    $redisHealth = docker-compose ps redis 2>$null | Select-String 'healthy'
    $kafkaHealth = docker-compose ps kafka 2>$null | Select-String 'healthy'
    
    if ($postgresHealth -and $redisHealth -and $kafkaHealth) {
        Write-Host ' All core services are ready' -ForegroundColor Green
        break
    }
    
    $attempt++
    Write-Host '.' -NoNewline
    Start-Sleep -Seconds 2
}
Write-Host ''

if ($attempt -eq $maxAttempts) {
    Write-Host '  Timeout waiting for services. Continuing anyway...' -ForegroundColor Yellow
}
Write-Host ''

# Start monitoring and admin UIs
Write-Host ' Starting monitoring and admin services...' -ForegroundColor Yellow
docker-compose up -d prometheus grafana kafka-ui redis-commander pgadmin
Write-Host ''

# Install dependencies for auth-service
Write-Host ' Installing auth-service dependencies...' -ForegroundColor Yellow
Set-Location auth-service
npm install
Write-Host ' Auth service dependencies installed' -ForegroundColor Green
Write-Host ''

# Run migrations for auth-service
Write-Host '  Running auth-service migrations...' -ForegroundColor Yellow
try {
    npm run migrate
} catch {
    Write-Host '  Migrations may have already been run' -ForegroundColor Yellow
}
Write-Host ''

Set-Location ..

# Install dependencies for user-service
Write-Host ' Installing user-service dependencies...' -ForegroundColor Yellow
Set-Location user-service
npm install
Write-Host ' User service dependencies installed' -ForegroundColor Green
Write-Host ''

# Run migrations for user-service (if exists)
$packageJson = Get-Content package.json -Raw | ConvertFrom-Json
if ($packageJson.scripts.migrate) {
    Write-Host '  Running user-service migrations...' -ForegroundColor Yellow
    try {
        npm run migrate
    } catch {
        Write-Host '  Migrations may have already been run' -ForegroundColor Yellow
    }
    Write-Host ''
}

Set-Location ..

# Display service URLs
Write-Host ''
Write-Host '==========================================' -ForegroundColor Green
Write-Host ' Setup Complete!' -ForegroundColor Green
Write-Host '==========================================' -ForegroundColor Green
Write-Host ''
Write-Host ' Services Available:' -ForegroundColor Cyan
Write-Host '   • PostgreSQL:        localhost:5432'
Write-Host '   • Redis:             localhost:6379'
Write-Host '   • Kafka:             localhost:9092'
Write-Host '   • Elasticsearch:     localhost:9200'
Write-Host '   • Prometheus:        http://localhost:9090'
Write-Host '   • Grafana:           http://localhost:3100 (admin/admin)'
Write-Host '   • Kafka UI:          http://localhost:8080'
Write-Host '   • Redis Commander:   http://localhost:8081'
Write-Host '   • pgAdmin:           http://localhost:5050 (admin@admin.com/admin)'
Write-Host ''
Write-Host ' To start the services:' -ForegroundColor Cyan
Write-Host '   1. Auth Service:     cd auth-service; npm run dev'
Write-Host '   2. User Service:     cd user-service; npm run dev'
Write-Host ''
Write-Host ' To run tests:' -ForegroundColor Cyan
Write-Host '   • Auth Service:      cd auth-service; npm test'
Write-Host '   • User Service:      cd user-service; npm test'
Write-Host ''
Write-Host ' To stop all containers:' -ForegroundColor Cyan
Write-Host '   docker-compose down'
Write-Host ''
Write-Host ' Check the logs:' -ForegroundColor Cyan
Write-Host '   docker-compose logs -f [service-name]'
Write-Host ''
