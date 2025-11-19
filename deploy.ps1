# deploy.ps1 - Deployment Script for Pure Pleasure Interior Design Project
# Usage: .\deploy.ps1 [dev|prod]

param(
    [string]$Environment = "dev",
    [string]$FrontendPath = ".",
    [string]$BackendPath = ".",
    [switch]$Help
)

# Display help information
function Show-Help {
    Write-Host @"
Pure Pleasure Interior Design - Deployment Script

USAGE:
    .\deploy.ps1 [dev|prod] [OPTIONS]

OPTIONS:
    -Environment [dev|prod]    Deployment environment (default: dev)
    -FrontendPath <path>       Path to frontend files (default: current directory)
    -BackendPath <path>        Path to backend files (default: current directory)
    -Help                      Show this help message

EXAMPLES:
    .\deploy.ps1 dev                    # Deploy to development environment
    .\deploy.ps1 prod                   # Deploy to production environment
    .\deploy.ps1 -Help                  # Show help

ENVIRONMENT SETUP:
    Development: Laragon MySQL + Local Node.js
    Production:  Railway (DB) + Render (Backend) + Vercel (Frontend)
"@ -ForegroundColor Cyan
}

# Check if help was requested
if ($Help) {
    Show-Help
    exit 0
}

# Colors for output
$Green = "Green"
$Yellow = "Yellow"
$Red = "Red"
$Cyan = "Cyan"

# Function to write colored output
function Write-ColorOutput {
    param(
        [string]$Message,
        [string]$Color = "White"
    )
    Write-Host $Message -ForegroundColor $Color
}

# Function to check if command exists
function Test-Command {
    param($command)
    $exists = $null -ne (Get-Command $command -ErrorAction SilentlyContinue)
    return $exists
}

# Function to check Node.js installation
function Test-NodeJS {
    if (Test-Command "node") {
        $nodeVersion = node --version
        Write-ColorOutput "✓ Node.js installed: $nodeVersion" $Green
        return $true
    } else {
        Write-ColorOutput "✗ Node.js is not installed" $Red
        return $false
    }
}

# Function to check npm installation
function Test-NPM {
    if (Test-Command "npm") {
        $npmVersion = npm --version
        Write-ColorOutput "✓ npm installed: $npmVersion" $Green
        return $true
    } else {
        Write-ColorOutput "✗ npm is not installed" $Red
        return $false
    }
}

# Function to check Git installation
function Test-Git {
    if (Test-Command "git") {
        $gitVersion = git --version
        Write-ColorOutput "✓ Git installed: $gitVersion" $Green
        return $true
    } else {
        Write-ColorOutput "✗ Git is not installed" $Red
        return $false
    }
}

# Function to install dependencies
function Install-Dependencies {
    param($path)
    
    Write-ColorOutput "`nInstalling dependencies in $path..." $Yellow
    
    if (Test-Path "$path\package.json") {
        Set-Location $path
        npm install
        if ($LASTEXITCODE -eq 0) {
            Write-ColorOutput "✓ Dependencies installed successfully" $Green
        } else {
            Write-ColorOutput "✗ Failed to install dependencies" $Red
            exit 1
        }
    } else {
        Write-ColorOutput "✗ package.json not found in $path" $Red
        exit 1
    }
}

# Function to setup development environment
function Setup-Development {
    Write-ColorOutput "`nSetting up Development Environment..." $Cyan
    
    # Check if Laragon is running (assuming default installation)
    $laragonProcess = Get-Process -Name "laragon*" -ErrorAction SilentlyContinue
    if ($laragonProcess) {
        Write-ColorOutput "✓ Laragon is running" $Green
    } else {
        Write-ColorOutput "! Laragon is not running. Please start Laragon for MySQL database." $Yellow
    }
    
    # Create development environment file
    $envContent = @"
NODE_ENV=development
JWT_SECRET=your-development-jwt-secret-key-here
DB_HOST=localhost
DB_USER=root
DB_PASSWORD=
DB_NAME=pure_pleasure_db
DB_PORT=3306
"@
    
    Set-Content -Path ".\.env" -Value $envContent
    Write-ColorOutput "✓ Created .env file for development" $Green
    
    # Install backend dependencies
    Install-Dependencies -path $BackendPath
    
    Write-ColorOutput "`nDevelopment Setup Complete!" $Green
    Write-ColorOutput "Next steps:" $Yellow
    Write-ColorOutput "1. Start Laragon MySQL" $Yellow
    Write-ColorOutput "2. Create database 'pure_pleasure_db' in phpMyAdmin" $Yellow
    Write-ColorOutput "3. Run: npm run dev" $Yellow
}

# Function to setup production environment
function Setup-Production {
    Write-ColorOutput "`nSetting up Production Environment..." $Cyan
    
    # Check required tools for production deployment
    $hasVercel = Test-Command "vercel"
    $hasRailway = Test-Command "railway"
    
    if (-not $hasVercel) {
        Write-ColorOutput "! Vercel CLI not installed. Install with: npm i -g vercel" $Yellow
    }
    
    if (-not $hasRailway) {
        Write-ColorOutput "! Railway CLI not installed. Install with: npm i -g @railway/cli" $Yellow
    }
    
    # Create production environment file template
    $prodEnvContent = @"
NODE_ENV=production
JWT_SECRET=your-production-jwt-secret-key-change-this
DB_HOST=your-railway-db-host
DB_USER=your-railway-db-user
DB_PASSWORD=your-railway-db-password
DB_NAME=your-railway-db-name
DB_PORT=your-railway-db-port
"@
    
    Set-Content -Path ".\.env.production" -Value $prodEnvContent
    Write-ColorOutput "✓ Created .env.production template" $Green
    
    # Create Railway configuration
    $railwayConfig = @"
{
    "project": "pure-pleasure-db",
    "services": {
        "database": {
            "type": "mysql",
            "name": "Pure Pleasure DB"
        }
    }
}
"@
    
    Set-Content -Path ".\railway.json" -Value $railwayConfig
    Write-ColorOutput "✓ Created railway.json configuration" $Green
    
    # Create Render configuration
    $renderConfig = @"
services:
  - type: web
    name: pure-pleasure-backend
    env: node
    plan: free
    buildCommand: npm install
    startCommand: npm start
    envVars:
      - key: NODE_ENV
        value: production
      - key: JWT_SECRET
        generateValue: true
"@
    
    Set-Content -Path ".\render.yaml" -Value $renderConfig
    Write-ColorOutput "✓ Created render.yaml configuration" $Green
    
    # Create Vercel configuration for frontend
    $vercelConfig = @"
{
    "version": 2,
    "name": "pure-pleasure-frontend",
    "builds": [
        {
            "src": "*.html",
            "use": "@vercel/static"
        },
        {
            "src": "**/*.js",
            "use": "@vercel/static"
        },
        {
            "src": "**/*.css",
            "use": "@vercel/static"
        }
    ],
    "routes": [
        {
            "src": "/(.*)",
            "dest": "/index.html"
        }
    ]
}
"@
    
    Set-Content -Path ".\vercel.json" -Value $vercelConfig
    Write-ColorOutput "✓ Created vercel.json configuration" $Green
    
    Write-ColorOutput "`nProduction Setup Complete!" $Green
    Write-ColorOutput "Next steps for deployment:" $Yellow
    Write-ColorOutput "1. Database: railway link && railway deploy" $Yellow
    Write-ColorOutput "2. Backend: Connect GitHub repo to Render" $Yellow
    Write-ColorOutput "3. Frontend: vercel --prod" $Yellow
}

# Function to deploy to production
function Deploy-Production {
    Write-ColorOutput "`nStarting Production Deployment..." $Cyan
    
    # Build the project
    Write-ColorOutput "Building project..." $Yellow
    npm run build 2>&1 | Out-Null
    
    if ($LASTEXITCODE -eq 0) {
        Write-ColorOutput "✓ Project built successfully" $Green
    } else {
        Write-ColorOutput "✗ Build failed" $Red
        exit 1
    }
    
    # Deploy to Railway (Database)
    Write-ColorOutput "Deploying to Railway (Database)..." $Yellow
    if (Test-Command "railway") {
        railway deploy 2>&1 | Out-Null
        Write-ColorOutput "✓ Database deployed to Railway" $Green
    } else {
        Write-ColorOutput "! Railway CLI not available. Deploy manually." $Yellow
    }
    
    # Deploy to Vercel (Frontend)
    Write-ColorOutput "Deploying to Vercel (Frontend)..." $Yellow
    if (Test-Command "vercel") {
        vercel --prod 2>&1 | Out-Null
        Write-ColorOutput "✓ Frontend deployed to Vercel" $Green
    } else {
        Write-ColorOutput "! Vercel CLI not available. Deploy manually." $Yellow
    }
    
    Write-ColorOutput "`n🎉 Production Deployment Complete!" $Green
    Write-ColorOutput "Your application is now live!" $Cyan
}

# Function to run development server
function Start-Development {
    Write-ColorOutput "`nStarting Development Server..." $Cyan
    
    if (Test-Path "$BackendPath\server.js") {
        Set-Location $BackendPath
        Write-ColorOutput "Starting backend server on http://localhost:3000" $Yellow
        Write-ColorOutput "Press Ctrl+C to stop the server" $Yellow
        
        # Start the development server
        npm run dev
    } else {
        Write-ColorOutput "✗ server.js not found in $BackendPath" $Red
        exit 1
    }
}

# Main deployment function
function Start-Deployment {
    Write-ColorOutput "`n🚀 Pure Pleasure Interior Design - Deployment Script" $Cyan
    Write-ColorOutput "==============================================" $Cyan
    
    # Validate environment
    if ($Environment -notin @("dev", "prod")) {
        Write-ColorOutput "✗ Invalid environment: $Environment. Use 'dev' or 'prod'." $Red
        exit 1
    }
    
    Write-ColorOutput "Environment: $Environment" $Yellow
    Write-ColorOutput "Frontend Path: $FrontendPath" $Yellow
    Write-ColorOutput "Backend Path: $BackendPath" $Yellow
    
    # Check prerequisites
    Write-ColorOutput "`nChecking prerequisites..." $Cyan
    
    $nodeOK = Test-NodeJS
    $npmOK = Test-NPM
    $gitOK = Test-Git
    
    if (-not ($nodeOK -and $npmOK)) {
        Write-ColorOutput "✗ Please install Node.js and npm to continue." $Red
        exit 1
    }
    
    # Execute based on environment
    switch ($Environment) {
        "dev" {
            Setup-Development
            $startServer = Read-Host "`nDo you want to start the development server now? (y/n)"
            if ($startServer -eq 'y' -or $startServer -eq 'Y') {
                Start-Development
            }
        }
        "prod" {
            $confirm = Read-Host "`nThis will deploy to production. Are you sure? (y/n)"
            if ($confirm -eq 'y' -or $confirm -eq 'Y') {
                Setup-Production
                $deployNow = Read-Host "`nDo you want to deploy now? (y/n)"
                if ($deployNow -eq 'y' -or $deployNow -eq 'Y') {
                    Deploy-Production
                }
            } else {
                Write-ColorOutput "Deployment cancelled." $Yellow
            }
        }
    }
    
    Write-ColorOutput "`n✨ Deployment process completed!" $Green
}

# Check if script is being run directly
if ($MyInvocation.InvocationName -ne '.') {
    # Display banner
    Write-Host @"
    
██████╗ ██╗   ██╗██████╗ ███████╗    ██████╗ ██╗     ███████╗ █████╗ ███████╗██╗   ██╗███████╗███████╗
██╔══██╗██║   ██║██╔══██╗██╔════╝    ██╔══██╗██║     ██╔════╝██╔══██╗██╔════╝██║   ██║██╔════╝██╔════╝
██████╔╝██║   ██║██████╔╝█████╗      ██████╔╝██║     █████╗  ███████║███████╗██║   ██║█████╗  ███████╗
██╔═══╝ ██║   ██║██╔══██╗██╔══╝      ██╔══██╗██║     ██╔══╝  ██╔══██║╚════██║██║   ██║██╔══╝  ╚════██║
██║     ╚██████╔╝██║  ██║███████╗    ██████╔╝███████╗███████╗██║  ██║███████║╚██████╔╝███████╗███████║
╚═╝      ╚═════╝ ╚═╝  ╚═╝╚══════╝    ╚═════╝ ╚══════╝╚══════╝╚═╝  ╚═╝╚══════╝ ╚═════╝ ╚══════╝╚══════╝
                                                                                                      
                    Building & Interior Concept LTD - Deployment Script v1.0
"@ -ForegroundColor Magenta
    
    # Start the deployment process
    Start-Deployment
}