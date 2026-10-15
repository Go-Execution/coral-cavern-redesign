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
  -vf 'minterpolate=fps=48:mi_mode=blend,scale=1152:648:flags=lanczos' `
  -c:v libwebp -q:v 58 -compression_level 5 -preset picture `
  (Join-Path $desktopRoot 'frame-%04d.webp')

ffmpeg -y -hide_banner -loglevel error -i $SourceVideo `
  -vf 'crop=405:720:(iw-405)/2:0,minterpolate=fps=48:mi_mode=blend,scale=360:640:flags=lanczos' `
  -c:v libwebp -q:v 56 -compression_level 5 -preset picture `
  (Join-Path $mobileRoot 'frame-%04d.webp')

function Complete-Sequence {
  param(
    [string]$Root,
    [int]$TargetCount
  )

  $frames = Get-ChildItem -LiteralPath $Root -Filter 'frame-*.webp' | Sort-Object Name
  if (-not $frames.Count) { throw "No frames were generated in $Root" }
  $lastFrame = $frames[-1].FullName
  for ($index = $frames.Count + 1; $index -le $TargetCount; $index += 1) {
    Copy-Item -LiteralPath $lastFrame -Destination (Join-Path $Root ('frame-{0:D4}.webp' -f $index)) -Force
  }
}

Complete-Sequence -Root $desktopRoot -TargetCount 480
Complete-Sequence -Root $mobileRoot -TargetCount 480

Copy-Item -LiteralPath (Join-Path $desktopRoot 'frame-0001.webp') -Destination (Join-Path $hostingRoot 'poster-start.webp') -Force
Copy-Item -LiteralPath (Join-Path $desktopRoot 'frame-0480.webp') -Destination (Join-Path $hostingRoot 'poster-final.webp') -Force
Copy-Item -LiteralPath (Join-Path $mobileRoot 'frame-0001.webp') -Destination (Join-Path $hostingRoot 'poster-start-mobile.webp') -Force
Copy-Item -LiteralPath (Join-Path $mobileRoot 'frame-0480.webp') -Destination (Join-Path $hostingRoot 'poster-final-mobile.webp') -Force

New-Item -ItemType Directory -Force -Path $offlineRoot | Out-Null
& robocopy $hostingRoot $offlineRoot /E /COPY:DAT /DCOPY:DAT /R:10 /W:2 /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -gt 7) { throw "Unable to mirror cinematic assets (robocopy exit code $LASTEXITCODE)" }

$desktopFrames = Get-ChildItem -LiteralPath $desktopRoot -Filter '*.webp'
$mobileFrames = Get-ChildItem -LiteralPath $mobileRoot -Filter '*.webp'

[pscustomobject]@{
  DesktopFrames = $desktopFrames.Count
  DesktopMegabytes = [math]::Round(($desktopFrames | Measure-Object Length -Sum).Sum / 1MB, 2)
  MobileFrames = $mobileFrames.Count
  MobileMegabytes = [math]::Round(($mobileFrames | Measure-Object Length -Sum).Sum / 1MB, 2)
}
