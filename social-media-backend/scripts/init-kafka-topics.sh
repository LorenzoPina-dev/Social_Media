#!/bin/bash
# ============================================================================
# Kafka Topics Initialization Script
# Creates all necessary topics for Social Media Platform
# ============================================================================

set -e

echo "🚀 Initializing Kafka Topics..."
echo ""

KAFKA_CONTAINER="social-media-kafka"
KAFKA_SERVER="localhost:9092"

# Check if Kafka is running
if ! docker ps | grep -q $KAFKA_CONTAINER; then
    echo "❌ Kafka container is not running"
    echo "   Start with: docker-compose up -d kafka"
    exit 1
fi

echo "✅ Kafka container is running"
echo ""

# Function to create topic
create_topic() {
    local topic_name=$1
    local partitions=${2:-3}
    local replication=${3:-1}
    
    echo "📝 Creating topic: $topic_name (partitions: $partitions, replication: $replication)"
    
    docker exec -it $KAFKA_CONTAINER kafka-topics \
        --bootstrap-server $KAFKA_SERVER \
        --create \
        --topic $topic_name \
        --partitions $partitions \
        --replication-factor $replication \
        --if-not-exists \
        2>/dev/null && echo "   ✅ Topic created: $topic_name" || echo "   ℹ️  Topic already exists: $topic_name"
}

# Create all topics
echo "Creating topics..."
echo ""

# Auth Service Topics
create_topic "auth_events" 3 1
create_topic "user_registered" 3 1
create_topic "user_authenticated" 3 1
create_topic "password_changed" 3 1
create_topic "mfa_enabled" 3 1

# User Service Topics
create_topic "user_events" 3 1
create_topic "user_created" 3 1
create_topic "user_updated" 3 1
create_topic "user_deleted" 3 1
create_topic "follow_created" 3 1
create_topic "follow_deleted" 3 1

# Other Service Topics
create_topic "password_reset_requested" 3 1
create_topic "email_verification_requested" 3 1

echo ""
echo "=========================================="
echo "✅ All topics created successfully!"
echo "=========================================="
echo ""
echo "📋 List all topics:"
echo "   docker exec -it $KAFKA_CONTAINER kafka-topics --bootstrap-server $KAFKA_SERVER --list"
echo ""
echo "📊 Describe a topic:"
echo "   docker exec -it $KAFKA_CONTAINER kafka-topics --bootstrap-server $KAFKA_SERVER --describe --topic auth_events"
echo ""
echo "🔍 View Kafka UI:"
echo "   http://localhost:8080"
echo ""
