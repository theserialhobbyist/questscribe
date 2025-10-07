# PowerShell script to set up the project structure
# Run this in PowerShell: .\setup.ps1

Write-Host "Setting up LitRPG Writer project structure..." -ForegroundColor Green

# Create main directories
New-Item -ItemType Directory -Force -Path "src/components" | Out-Null
New-Item -ItemType Directory -Force -Path "src-tauri/src" | Out-Null
New-Item -ItemType Directory -Force -Path "src-tauri/icons" | Out-Null

Write-Host "✓ Created directory structure" -ForegroundColor Green

# Create placeholder icon files (you'll need to replace these with actual icons later)
Write-Host "Note: You'll need to add icon files to src-tauri/icons/" -ForegroundColor Yellow
Write-Host "  Required: 32x32.png, 128x128.png, 128x128@2x.png, icon.icns, icon.ico" -ForegroundColor Yellow

Write-Host "`nProject structure created!" -ForegroundColor Green
Write-Host "`nNext steps:" -ForegroundColor Cyan
Write-Host "1. Copy all the code files from the artifacts into their respective locations"
Write-Host "2. Run: npm install"
Write-Host "3. Run: npm run dev"
Write-Host "`nSee README.md for detailed instructions!" -ForegroundColor Cyan