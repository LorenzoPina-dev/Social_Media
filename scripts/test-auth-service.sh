#!/bin/bash
# ============================================================================
# Auth Service - Complete Test Suite
# Tests all endpoints and functionality
# ============================================================================

set -e

BASE_URL="http://localhost:3001"
GREEN='\033[0;32m'
RED='\033[0;31m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo "🧪 Testing Auth Service"
echo "======================="
echo ""

# Track results
PASSED=0
FAILED=0

# Test function
test_endpoint() {
    local name=$1
    local method=$2
    local endpoint=$3
    local data=$4
    local expected_status=$5
    
    echo -n "Testing: $name... "
    
    if [ -z "$data" ]; then
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint")
    else
        response=$(curl -s -w "\n%{http_code}" -X $method "$BASE_URL$endpoint" \
            -H "Content-Type: application/json" \
            -d "$data")
    fi
    
    status_code=$(echo "$response" | tail -n1)
    body=$(echo "$response" | head -n-1)
    
    if [ "$status_code" = "$expected_status" ]; then
        echo -e "${GREEN}✓ PASS${NC} (Status: $status_code)"
        PASSED=$((PASSED + 1))
        return 0
    else
        echo -e "${RED}✗ FAIL${NC} (Expected: $expected_status, Got: $status_code)"
        echo "   Response: $body"
        FAILED=$((FAILED + 1))
        return 1
    fi
}

# Health Checks
echo "📋 Health Checks"
echo "----------------"
test_endpoint "Liveness Check" "GET" "/health" "" "200"
test_endpoint "Readiness Check" "GET" "/health/ready" "" "200"
echo ""

# Authentication Tests
echo "🔐 Authentication"
echo "----------------"

# Generate random username for testing
RANDOM_USER="testuser_$(date +%s)"
RANDOM_EMAIL="${RANDOM_USER}@test.com"

# Register
echo "Registering new user: $RANDOM_USER"
register_response=$(curl -s -X POST "$BASE_URL/api/v1/auth/register" \
    -H "Content-Type: application/json" \
    -d "{
        \"username\":\"$RANDOM_USER\",
        \"email\":\"$RANDOM_EMAIL\",
        \"password\":\"Test123!@#\",
        \"display_name\":\"Test User\"
    }")

if echo "$register_response" | grep -q "success.*true"; then
    echo -e "${GREEN}✓ PASS${NC} - User registered"
    PASSED=$((PASSED + 1))
    
    # Extract token
    ACCESS_TOKEN=$(echo "$register_response" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
    echo "   Access Token: ${ACCESS_TOKEN:0:20}..."
else
    echo -e "${RED}✗ FAIL${NC} - Registration failed"
    echo "   Response: $register_response"
    FAILED=$((FAILED + 1))
fi
echo ""

# Login
echo "Testing login with created user"
login_response=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"username\":\"$RANDOM_USER\",
        \"password\":\"Test123!@#\"
    }")

if echo "$login_response" | grep -q "success.*true"; then
    echo -e "${GREEN}✓ PASS${NC} - Login successful"
    PASSED=$((PASSED + 1))
    
    # Extract new token
    ACCESS_TOKEN=$(echo "$login_response" | grep -o '"access_token":"[^"]*"' | cut -d'"' -f4)
    REFRESH_TOKEN=$(echo "$login_response" | grep -o '"refresh_token":"[^"]*"' | cut -d'"' -f4)
else
    echo -e "${RED}✗ FAIL${NC} - Login failed"
    echo "   Response: $login_response"
    FAILED=$((FAILED + 1))
fi
echo ""

# Test invalid login
echo "Testing invalid login"
invalid_login=$(curl -s -X POST "$BASE_URL/api/v1/auth/login" \
    -H "Content-Type: application/json" \
    -d "{
        \"username\":\"$RANDOM_USER\",
        \"password\":\"WrongPassword\"
    }")

if echo "$invalid_login" | grep -q "success.*false"; then
    echo -e "${GREEN}✓ PASS${NC} - Invalid login rejected correctly"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC} - Invalid login should fail"
    FAILED=$((FAILED + 1))
fi
echo ""

# Protected Routes Tests
echo "🔒 Protected Routes"
echo "-------------------"

# Test MFA status (requires auth)
if [ ! -z "$ACCESS_TOKEN" ]; then
    mfa_status=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/v1/mfa/status" \
        -H "Authorization: Bearer $ACCESS_TOKEN")
    
    status_code=$(echo "$mfa_status" | tail -n1)
    
    if [ "$status_code" = "200" ]; then
        echo -e "${GREEN}✓ PASS${NC} - MFA status (authenticated)"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC} - MFA status failed"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "${YELLOW}⊘ SKIP${NC} - No token available"
fi
echo ""

# Test MFA status without auth (should fail)
mfa_no_auth=$(curl -s -w "\n%{http_code}" -X GET "$BASE_URL/api/v1/mfa/status")
status_code=$(echo "$mfa_no_auth" | tail -n1)

if [ "$status_code" = "401" ]; then
    echo -e "${GREEN}✓ PASS${NC} - MFA status without auth (401 as expected)"
    PASSED=$((PASSED + 1))
else
    echo -e "${RED}✗ FAIL${NC} - Should return 401 without auth"
    FAILED=$((FAILED + 1))
fi
echo ""

# Token Refresh
echo "🔄 Token Refresh"
echo "----------------"

if [ ! -z "$REFRESH_TOKEN" ]; then
    refresh_response=$(curl -s -X POST "$BASE_URL/api/v1/auth/refresh" \
        -H "Content-Type: application/json" \
        -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}")
    
    if echo "$refresh_response" | grep -q "access_token"; then
        echo -e "${GREEN}✓ PASS${NC} - Token refresh successful"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC} - Token refresh failed"
        echo "   Response: $refresh_response"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "${YELLOW}⊘ SKIP${NC} - No refresh token available"
fi
echo ""

# Logout
echo "🚪 Logout"
echo "---------"

if [ ! -z "$REFRESH_TOKEN" ]; then
    logout_response=$(curl -s -X POST "$BASE_URL/api/v1/auth/logout" \
        -H "Content-Type: application/json" \
        -d "{\"refresh_token\":\"$REFRESH_TOKEN\"}")
    
    if echo "$logout_response" | grep -q "success.*true"; then
        echo -e "${GREEN}✓ PASS${NC} - Logout successful"
        PASSED=$((PASSED + 1))
    else
        echo -e "${RED}✗ FAIL${NC} - Logout failed"
        FAILED=$((FAILED + 1))
    fi
else
    echo -e "${YELLOW}⊘ SKIP${NC} - No refresh token available"
fi
echo ""

# Summary
echo "==============================="
echo "📊 Test Summary"
echo "==============================="
echo -e "Passed: ${GREEN}$PASSED${NC}"
echo -e "Failed: ${RED}$FAILED${NC}"
echo "Total:  $((PASSED + FAILED))"
echo ""

if [ $FAILED -eq 0 ]; then
    echo -e "${GREEN}✅ All tests passed!${NC}"
    exit 0
else
    echo -e "${RED}❌ Some tests failed${NC}"
    exit 1
fi
