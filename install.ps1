$ErrorActionPreference = "Stop"
$Repo = "Divish1032/junk-cleaner"
$ApiUrl = "https://api.github.com/repos/$Repo/releases/latest"

Write-Host "🧹 Installing Junk Cleaner for Windows..." -ForegroundColor Cyan

# Fetch latest release data
Write-Host "🔍 Finding latest release on GitHub..."
try {
    $Release = Invoke-RestMethod -Uri $ApiUrl
} catch {
    Write-Host "❌ Failed to reach GitHub API. Make sure you have internet access." -ForegroundColor Red
    exit 1
}

# Find the .exe installer in the release assets
$ExeAsset = $Release.assets | Where-Object { $_.name -match "x64-setup\.exe$" -or $_.name -match "\.exe$" } | Select-Object -First 1

if ($null -eq $ExeAsset) {
    Write-Host "❌ Could not find a suitable Windows .exe release on GitHub." -ForegroundColor Red
    exit 1
}

$DownloadUrl = $ExeAsset.browser_download_url
$InstallerPath = Join-Path $env:TEMP "JunkCleaner_installer.exe"

Write-Host "⬇️ Downloading from $($DownloadUrl)..."
Invoke-WebRequest -Uri $DownloadUrl -OutFile $InstallerPath

Write-Host "📦 Launching setup..."
# Run the installer. By default it might require admin privileges depending on how it was built.
Start-Process -FilePath $InstallerPath -Wait -NoNewWindow

Write-Host ""
Write-Host "✅ Success! Junk Cleaner has been installed." -ForegroundColor Green
Write-Host "🚀 You can now find it in your Start Menu."
