param(
  [Parameter(Mandatory = $true)]
  [string]$SourceVideo
)

$ErrorActionPreference = 'Stop'
$projectRoot = Split-Path -Parent $PSScriptRoot
$hostingRoot = Join-Path $projectRoot 'hosting-source\assets\cinematic'
$offlineRoot = Join-Path $projectRoot 'offline-mockup\assets\cinematic'
$desktopRoot = Join-Path $hostingRoot 'desktop'
$mobileRoot = Join-Path $hostingRoot 'mobile'

if (-not (Test-Path -LiteralPath $SourceVideo)) {
  throw "Source video not found: $SourceVideo"
}

New-Item -ItemType Directory -Force -Path $desktopRoot, $mobileRoot | Out-Null
Get-ChildItem -LiteralPath $desktopRoot, $mobileRoot -Filter 'frame-*.webp' -ErrorAction SilentlyContinue | Remove-Item -Force

ffmpeg -y -hide_banner -loglevel error -i $SourceVideo `
  -vf 'fps=20,scale=1280:720:flags=lanczos' `
  -c:v libwebp -q:v 68 -compression_level 5 -preset picture `
  (Join-Path $desktopRoot 'frame-%04d.webp')

ffmpeg -y -hide_banner -loglevel error -i $SourceVideo `
  -vf 'fps=12,crop=405:720:(iw-405)/2:0,scale=405:720:flags=lanczos' `
  -c:v libwebp -q:v 66 -compression_level 5 -preset picture `
  (Join-Path $mobileRoot 'frame-%04d.webp')

Copy-Item -LiteralPath (Join-Path $desktopRoot 'frame-0001.webp') -Destination (Join-Path $hostingRoot 'poster-start.webp') -Force
Copy-Item -LiteralPath (Join-Path $desktopRoot 'frame-0200.webp') -Destination (Join-Path $hostingRoot 'poster-final.webp') -Force
Copy-Item -LiteralPath (Join-Path $mobileRoot 'frame-0001.webp') -Destination (Join-Path $hostingRoot 'poster-start-mobile.webp') -Force
Copy-Item -LiteralPath (Join-Path $mobileRoot 'frame-0120.webp') -Destination (Join-Path $hostingRoot 'poster-final-mobile.webp') -Force

New-Item -ItemType Directory -Force -Path $offlineRoot | Out-Null
Copy-Item -Path (Join-Path $hostingRoot '*') -Destination $offlineRoot -Recurse -Force

$desktopFrames = Get-ChildItem -LiteralPath $desktopRoot -Filter '*.webp'
$mobileFrames = Get-ChildItem -LiteralPath $mobileRoot -Filter '*.webp'

[pscustomobject]@{
  DesktopFrames = $desktopFrames.Count
  DesktopMegabytes = [math]::Round(($desktopFrames | Measure-Object Length -Sum).Sum / 1MB, 2)
  MobileFrames = $mobileFrames.Count
  MobileMegabytes = [math]::Round(($mobileFrames | Measure-Object Length -Sum).Sum / 1MB, 2)
}
