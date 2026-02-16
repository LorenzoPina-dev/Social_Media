# ============================================================================
# Kafka Topics Initialization Script (Windows PowerShell)
# Creates all necessary topics for Social Media Platform
# ============================================================================

Write-Host "🚀 Initializing Kafka Topics..." -ForegroundColor Cyan
Write-Host ""

$KAFKA_CONTAINER = "social-media-kafka"
$KAFKA_SERVER = "localhost:9092"

# Check if Kafka is running
$kafkaRunning = docker ps | Select-String $KAFKA_CONTAINER
if (-not $kafkaRunning) {
    Write-Host "❌ Kafka container is not running" -ForegroundColor Red
    Write-Host "   Start with: docker-compose up -d kafka"
    exit 1
}

Write-Host "✅ Kafka container is running" -ForegroundColor Green
Write-Host ""

# Function to create topic
function Create-Topic {
    param(
        [string]$TopicName,
        [int]$Partitions = 3,
        [int]$Replication = 1
    )
    
    Write-Host "📝 Creating topic: $TopicName (partitions: $Partitions, replication: $Replication)"
    
    $result = docker exec $KAFKA_CONTAINER kafka-topics `
        --bootstrap-server $KAFKA_SERVER `
        --create `
        --topic $TopicName `
        --partitions $Partitions `
        --replication-factor $Replication `
        --if-not-exists 2>$null
    
    if ($LASTEXITCODE -eq 0) {
        Write-Host "   ✅ Topic created: $TopicName" -ForegroundColor Green
    } else {
        Write-Host "   ℹ️  Topic already exists: $TopicName" -ForegroundColor Yellow
    }
}

# Create all topics
Write-Host "Creating topics..." -ForegroundColor Yellow
Write-Host ""

# Auth Service Topics
Create-Topic "auth_events" 3 1
Create-Topic "user_registered" 3 1
Create-Topic "user_authenticated" 3 1
Create-Topic "password_changed" 3 1
Create-Topic "mfa_enabled" 3 1

# User Service Topics
Create-Topic "user_events" 3 1
Create-Topic "user_created" 3 1
Create-Topic "user_updated" 3 1
Create-Topic "user_deleted" 3 1
Create-Topic "follow_created" 3 1
Create-Topic "follow_deleted" 3 1

# Other Service Topics
Create-Topic "password_reset_requested" 3 1
Create-Topic "email_verification_requested" 3 1

Write-Host ""
Write-Host "==========================================" -ForegroundColor Green
Write-Host "✅ All topics created successfully!" -ForegroundColor Green
Write-Host "==========================================" -ForegroundColor Green
Write-Host ""
Write-Host "📋 List all topics:" -ForegroundColor Cyan
Write-Host "   docker exec $KAFKA_CONTAINER kafka-topics --bootstrap-server $KAFKA_SERVER --list"
Write-Host ""
Write-Host "📊 Describe a topic:" -ForegroundColor Cyan
Write-Host "   docker exec $KAFKA_CONTAINER kafka-topics --bootstrap-server $KAFKA_SERVER --describe --topic auth_events"
Write-Host ""
Write-Host "🔍 View Kafka UI:" -ForegroundColor Cyan
Write-Host "   http://localhost:8080"
Write-Host ""
