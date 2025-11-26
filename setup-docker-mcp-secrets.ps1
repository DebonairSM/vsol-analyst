# Setup Docker Secrets for MCP Gateway
# This script helps create Docker secrets required by the Docker MCP gateway

Write-Host "Docker MCP Gateway Secret Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Check if Docker is available
try {
    docker --version | Out-Null
    Write-Host "✓ Docker is installed" -ForegroundColor Green
} catch {
    Write-Host "✗ Docker is not installed or not in PATH" -ForegroundColor Red
    exit 1
}

# Check if Docker Swarm is initialized
$swarmInfo = docker info --format "{{.Swarm.LocalNodeState}}" 2>$null
if ($swarmInfo -ne "active") {
    Write-Host ""
    Write-Host "⚠ Docker Swarm is not initialized" -ForegroundColor Yellow
    Write-Host "Docker secrets require Docker Swarm mode." -ForegroundColor Yellow
    $initSwarm = Read-Host "Do you want to initialize Docker Swarm now? (Y/n)"
    if ($initSwarm -ne "n" -and $initSwarm -ne "N") {
        Write-Host "Initializing Docker Swarm..." -ForegroundColor Yellow
        docker swarm init
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Docker Swarm initialized" -ForegroundColor Green
        } else {
            Write-Host "✗ Failed to initialize Docker Swarm" -ForegroundColor Red
            Write-Host "You may need to run this script as administrator" -ForegroundColor Yellow
            exit 1
        }
    } else {
        Write-Host "Skipping Swarm initialization. Secrets cannot be created without Swarm mode." -ForegroundColor Yellow
        exit 0
    }
} else {
    Write-Host "✓ Docker Swarm is active" -ForegroundColor Green
}

Write-Host ""
Write-Host "This script will help you create Docker secrets for:" -ForegroundColor Yellow
Write-Host "  1. github.personal_access_token (for GitHub MCP server)" -ForegroundColor Yellow
Write-Host "  2. render.api_key (for Render MCP server)" -ForegroundColor Yellow
Write-Host ""

# Check if secrets already exist
$githubSecretExists = docker secret ls --format "{{.Name}}" | Select-String -Pattern "^github.personal_access_token$"
$renderSecretExists = docker secret ls --format "{{.Name}}" | Select-String -Pattern "^render.api_key$"

if ($githubSecretExists) {
    Write-Host "⚠ github.personal_access_token secret already exists" -ForegroundColor Yellow
    $updateGithub = Read-Host "Do you want to update it? (y/N)"
    if ($updateGithub -eq "y" -or $updateGithub -eq "Y") {
        Write-Host "Removing existing secret..." -ForegroundColor Yellow
        docker secret rm github.personal_access_token 2>$null
        $githubSecretExists = $false
    }
}

if ($renderSecretExists) {
    Write-Host "⚠ render.api_key secret already exists" -ForegroundColor Yellow
    $updateRender = Read-Host "Do you want to update it? (y/N)"
    if ($updateRender -eq "y" -or $updateRender -eq "Y") {
        Write-Host "Removing existing secret..." -ForegroundColor Yellow
        docker secret rm render.api_key 2>$null
        $renderSecretExists = $false
    }
}

Write-Host ""

# Create GitHub secret
if (-not $githubSecretExists) {
    Write-Host "GitHub Personal Access Token" -ForegroundColor Cyan
    Write-Host "To create a token, visit: https://github.com/settings/tokens" -ForegroundColor Gray
    Write-Host "Required scopes: repo (for private repos) or public_repo (for public repos only)" -ForegroundColor Gray
    Write-Host ""
    $githubToken = Read-Host "Enter your GitHub Personal Access Token (or press Enter to skip)"
    
    if ($githubToken) {
        $githubToken | docker secret create github.personal_access_token -
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Created github.personal_access_token secret" -ForegroundColor Green
        } else {
            Write-Host "✗ Failed to create GitHub secret" -ForegroundColor Red
        }
    } else {
        Write-Host "⚠ Skipped GitHub secret creation" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Create Render secret
if (-not $renderSecretExists) {
    Write-Host "Render API Key" -ForegroundColor Cyan
    Write-Host "To get your API key, visit: https://dashboard.render.com/account/api-keys" -ForegroundColor Gray
    Write-Host ""
    $renderKey = Read-Host "Enter your Render API Key (or press Enter to skip)"
    
    if ($renderKey) {
        $renderKey | docker secret create render.api_key -
        if ($LASTEXITCODE -eq 0) {
            Write-Host "✓ Created render.api_key secret" -ForegroundColor Green
        } else {
            Write-Host "✗ Failed to create Render secret" -ForegroundColor Red
        }
    } else {
        Write-Host "⚠ Skipped Render secret creation" -ForegroundColor Yellow
    }
    Write-Host ""
}

# Summary
Write-Host "Summary" -ForegroundColor Cyan
Write-Host "=======" -ForegroundColor Cyan
Write-Host ""

$secrets = docker secret ls --format "{{.Name}}"
$githubExists = $secrets | Select-String -Pattern "^github.personal_access_token$"
$renderExists = $secrets | Select-String -Pattern "^render.api_key$"

if ($githubExists) {
    Write-Host "✓ github.personal_access_token" -ForegroundColor Green
} else {
    Write-Host "✗ github.personal_access_token (not created)" -ForegroundColor Red
}

if ($renderExists) {
    Write-Host "✓ render.api_key" -ForegroundColor Green
} else {
    Write-Host "✗ render.api_key (not created)" -ForegroundColor Red
}

Write-Host ""
Write-Host "Note: If you skipped any secrets, you can run this script again later." -ForegroundColor Gray
Write-Host "      The MCP servers that require these secrets may not work until they are created." -ForegroundColor Gray

