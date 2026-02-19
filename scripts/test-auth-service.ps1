# ============================================================================
# Auth Service - Complete Test Suite (PowerShell)
# Tests all endpoints and functionality
# ============================================================================

$BASE_URL = "http://localhost:3001"

Write-Host "🧪 Testing Auth Service" -ForegroundColor Cyan
Write-Host "=======================" -ForegroundColor Cyan
Write-Host ""

# Track results
$PASSED = 0
$FAILED = 0

# Test function
function Test-Endpoint {
    param(
        [string]$Name,
        [string]$Method,
        [string]$Endpoint,
        [string]$Data = "",
        [int]$ExpectedStatus,
        [string]$Token = ""
    )
    
    Write-Host -NoNewline "Testing: $Name... "
    
    try {
        $headers = @{
            "Content-Type" = "application/json"
        }
        
        if ($Token) {
            $headers["Authorization"] = "Bearer $Token"
        }
        
        if ($Data) {
            $response = Invoke-WebRequest -Uri "$BASE_URL$Endpoint" -Method $Method -Headers $headers -Body $Data -UseBasicParsing
        } else {
            $response = Invoke-WebRequest -Uri "$BASE_URL$Endpoint" -Method $Method -Headers $headers -UseBasicParsing
        }
        
        if ($response.StatusCode -eq $ExpectedStatus) {
            Write-Host "✓ PASS" -ForegroundColor Green -NoNewline
            Write-Host " (Status: $($response.StatusCode))"
            return @{ Success = $true; Content = $response.Content }
        } else {
            Write-Host "✗ FAIL" -ForegroundColor Red -NoNewline
            Write-Host " (Expected: $ExpectedStatus, Got: $($response.StatusCode))"
            return @{ Success = $false; Content = $response.Content }
        }
    } catch {
        $statusCode = $_.Exception.Response.StatusCode.value__
        if ($statusCode -eq $ExpectedStatus) {
            Write-Host "✓ PASS" -ForegroundColor Green -NoNewline
            Write-Host " (Status: $statusCode)"
            return @{ Success = $true; Content = "" }
        } else {
            Write-Host "✗ FAIL" -ForegroundColor Red -NoNewline
            Write-Host " (Expected: $ExpectedStatus, Got: $statusCode)"
            Write-Host "   Error: $($_.Exception.Message)"
            return @{ Success = $false; Content = "" }
        }
    }
}

# Health Checks
Write-Host "📋 Health Checks" -ForegroundColor Yellow
Write-Host "----------------"

$result = Test-Endpoint -Name "Liveness Check" -Method "GET" -Endpoint "/health" -ExpectedStatus 200
if ($result.Success) { $PASSED++ } else { $FAILED++ }

$result = Test-Endpoint -Name "Readiness Check" -Method "GET" -Endpoint "/health/ready" -ExpectedStatus 200
if ($result.Success) { $PASSED++ } else { $FAILED++ }

Write-Host ""

# Authentication Tests
Write-Host "🔐 Authentication" -ForegroundColor Yellow
Write-Host "----------------"

# Generate random username
$timestamp = Get-Date -Format "yyyyMMddHHmmss"
$RANDOM_USER = "testuser_$timestamp"
$RANDOM_EMAIL = "${RANDOM_USER}@test.com"

Write-Host "Registering new user: $RANDOM_USER"

$registerData = @{
    username = $RANDOM_USER
    email = $RANDOM_EMAIL
    password = "Test123!@#"
    display_name = "Test User"
} | ConvertTo-Json

try {
    $registerResponse = Invoke-RestMethod -Uri "$BASE_URL/api/v1/auth/register" `
        -Method POST `
        -ContentType "application/json" `
        -Body $registerData

    if ($registerResponse.success) {
        Write-Host "✓ PASS" -ForegroundColor Green -NoNewline
        Write-Host " - User registered"
        $PASSED++
        
        $ACCESS_TOKEN = $registerResponse.data.tokens.access_token
        $tokenPreview = $ACCESS_TOKEN.Substring(0, [Math]::Min(20, $ACCESS_TOKEN.Length))
        Write-Host "   Access Token: ${tokenPreview}..."
    } else {
        Write-Host "✗ FAIL" -ForegroundColor Red -NoNewline
        Write-Host " - Registration failed"
        $FAILED++
    }
} catch {
    Write-Host "✗ FAIL" -ForegroundColor Red -NoNewline
    Write-Host " - Registration error: $($_.Exception.Message)"
    $FAILED++
}

Write-Host ""

# Login
Write-Host "Testing login with created user"

$loginData = @{
    username = $RANDOM_USER
    password = "Test123!@#"
} | ConvertTo-Json

try {
    $loginResponse = Invoke-RestMethod -Uri "$BASE_URL/api/v1/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $loginData

    if ($loginResponse.success) {
        Write-Host "✓ PASS" -ForegroundColor Green -NoNewline
        Write-Host " - Login successful"
        $PASSED++
        
        $ACCESS_TOKEN = $loginResponse.data.tokens.access_token
        $REFRESH_TOKEN = $loginResponse.data.tokens.refresh_token
    } else {
        Write-Host "✗ FAIL" -ForegroundColor Red -NoNewline
        Write-Host " - Login failed"
        $FAILED++
    }
} catch {
    Write-Host "✗ FAIL" -ForegroundColor Red -NoNewline
    Write-Host " - Login error: $($_.Exception.Message)"
    $FAILED++
}

Write-Host ""

# Invalid login
Write-Host "Testing invalid login"

$invalidLoginData = @{
    username = $RANDOM_USER
    password = "WrongPassword"
} | ConvertTo-Json

try {
    $invalidResponse = Invoke-RestMethod -Uri "$BASE_URL/api/v1/auth/login" `
        -Method POST `
        -ContentType "application/json" `
        -Body $invalidLoginData
    
    Write-Host "✗ FAIL" -ForegroundColor Red -NoNewline
    Write-Host " - Invalid login should fail"
    $FAILED++
} catch {
    Write-Host "✓ PASS" -ForegroundColor Green -NoNewline
    Write-Host " - Invalid login rejected correctly"
    $PASSED++
}

Write-Host ""

# Protected Routes
Write-Host "🔒 Protected Routes" -ForegroundColor Yellow
Write-Host "-------------------"

if ($ACCESS_TOKEN) {
    try {
        $mfaResponse = Invoke-RestMethod -Uri "$BASE_URL/api/v1/mfa/status" `
            -Method GET `
            -Headers @{ "Authorization" = "Bearer $ACCESS_TOKEN" }
        
        Write-Host "✓ PASS" -ForegroundColor Green -NoNewline
        Write-Host " - MFA status (authenticated)"
        $PASSED++
    } catch {
        Write-Host "✗ FAIL" -ForegroundColor Red -NoNewline
        Write-Host " - MFA status failed"
        $FAILED++
    }
} else {
    Write-Host "⊘ SKIP" -ForegroundColor Yellow -NoNewline
    Write-Host " - No token available"
}

Write-Host ""

# MFA without auth
Write-Host "Testing MFA status without auth"

try {
    $noAuthResponse = Invoke-RestMethod -Uri "$BASE_URL/api/v1/mfa/status" -Method GET
    Write-Host "✗ FAIL" -ForegroundColor Red -NoNewline
    Write-Host " - Should return 401 without auth"
    $FAILED++
} catch {
    if ($_.Exception.Response.StatusCode.value__ -eq 401) {
        Write-Host "✓ PASS" -ForegroundColor Green -NoNewline
        Write-Host " - MFA status without auth (401 as expected)"
        $PASSED++
    } else {
        Write-Host "✗ FAIL" -ForegroundColor Red -NoNewline
        Write-Host " - Wrong status code"
        $FAILED++
    }
}

Write-Host ""

# Token Refresh
Write-Host "🔄 Token Refresh" -ForegroundColor Yellow
Write-Host "----------------"

if ($REFRESH_TOKEN) {
    $refreshData = @{ refresh_token = $REFRESH_TOKEN } | ConvertTo-Json
    
    try {
        $refreshResponse = Invoke-RestMethod -Uri "$BASE_URL/api/v1/auth/refresh" `
            -Method POST `
            -ContentType "application/json" `
            -Body $refreshData
        
        if ($refreshResponse.data.access_token) {
            Write-Host "✓ PASS" -ForegroundColor Green -NoNewline
            Write-Host " - Token refresh successful"
            $PASSED++
        } else {
            Write-Host "✗ FAIL" -ForegroundColor Red -NoNewline
            Write-Host " - Token refresh failed"
            $FAILED++
        }
    } catch {
        Write-Host "✗ FAIL" -ForegroundColor Red -NoNewline
        Write-Host " - Refresh error: $($_.Exception.Message)"
        $FAILED++
    }
} else {
    Write-Host "⊘ SKIP" -ForegroundColor Yellow -NoNewline
    Write-Host " - No refresh token available"
}

Write-Host ""

# Logout
Write-Host "🚪 Logout" -ForegroundColor Yellow
Write-Host "---------"

if ($REFRESH_TOKEN) {
    $logoutData = @{ refresh_token = $REFRESH_TOKEN } | ConvertTo-Json
    
    try {
        $logoutResponse = Invoke-RestMethod -Uri "$BASE_URL/api/v1/auth/logout" `
            -Method POST `
            -ContentType "application/json" `
            -Body $logoutData
        
        if ($logoutResponse.success) {
            Write-Host "✓ PASS" -ForegroundColor Green -NoNewline
            Write-Host " - Logout successful"
            $PASSED++
        } else {
            Write-Host "✗ FAIL" -ForegroundColor Red -NoNewline
            Write-Host " - Logout failed"
            $FAILED++
        }
    } catch {
        Write-Host "✗ FAIL" -ForegroundColor Red -NoNewline
        Write-Host " - Logout error: $($_.Exception.Message)"
        $FAILED++
    }
} else {
    Write-Host "⊘ SKIP" -ForegroundColor Yellow -NoNewline
    Write-Host " - No refresh token available"
}

Write-Host ""

# Summary
Write-Host "===============================" -ForegroundColor Cyan
Write-Host "📊 Test Summary" -ForegroundColor Cyan
Write-Host "===============================" -ForegroundColor Cyan
Write-Host "Passed: " -NoNewline
Write-Host "$PASSED" -ForegroundColor Green
Write-Host "Failed: " -NoNewline
Write-Host "$FAILED" -ForegroundColor Red
Write-Host "Total:  $($PASSED + $FAILED)"
Write-Host ""

if ($FAILED -eq 0) {
    Write-Host "✅ All tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "❌ Some tests failed" -ForegroundColor Red
    exit 1
}
