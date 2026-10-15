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
Get-ChildItem -LiteralPath $desktopRoot, $mobileRoot -File -ErrorAction SilentlyContinue |
  Where-Object { $_.Name -like 'frame-*.webp' -or $_.Name -like 'sheet-*.webp' } |
  Remove-Item -Force

ffmpeg -y -hide_banner -loglevel error -i $SourceVideo `
  -vf 'minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1:mb_size=16,scale=1152:648:flags=lanczos,unsharp=5:5:0.32:3:3:0.12' `
  -c:v libwebp -q:v 62 -compression_level 5 -preset picture `
  (Join-Path $desktopRoot 'frame-%04d.webp')

ffmpeg -y -hide_banner -loglevel error -i $SourceVideo `
  -vf 'crop=405:720:(iw-405)/2:0,minterpolate=fps=60:mi_mode=mci:mc_mode=aobmc:me_mode=bidir:vsbmc=1:mb_size=16,scale=360:640:flags=lanczos,unsharp=5:5:0.28:3:3:0.1' `
  -c:v libwebp -q:v 60 -compression_level 5 -preset picture `
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

Complete-Sequence -Root $desktopRoot -TargetCount 600
Complete-Sequence -Root $mobileRoot -TargetCount 600

ffmpeg -y -hide_banner -loglevel error -framerate 60 -i (Join-Path $desktopRoot 'frame-%04d.webp') `
  -vf 'tile=2x2' -frames:v 150 `
  -c:v libwebp -q:v 62 -compression_level 5 -preset picture `
  (Join-Path $desktopRoot 'sheet-%03d.webp')

ffmpeg -y -hide_banner -loglevel error -framerate 60 -i (Join-Path $mobileRoot 'frame-%04d.webp') `
  -vf 'tile=2x2' -frames:v 150 `
  -c:v libwebp -q:v 60 -compression_level 5 -preset picture `
  (Join-Path $mobileRoot 'sheet-%03d.webp')

Copy-Item -LiteralPath (Join-Path $desktopRoot 'frame-0001.webp') -Destination (Join-Path $hostingRoot 'poster-start.webp') -Force
Copy-Item -LiteralPath (Join-Path $desktopRoot 'frame-0600.webp') -Destination (Join-Path $hostingRoot 'poster-final.webp') -Force
Copy-Item -LiteralPath (Join-Path $mobileRoot 'frame-0001.webp') -Destination (Join-Path $hostingRoot 'poster-start-mobile.webp') -Force
Copy-Item -LiteralPath (Join-Path $mobileRoot 'frame-0600.webp') -Destination (Join-Path $hostingRoot 'poster-final-mobile.webp') -Force

Get-ChildItem -LiteralPath $desktopRoot, $mobileRoot -Filter 'frame-*.webp' | Remove-Item -Force

New-Item -ItemType Directory -Force -Path $offlineRoot | Out-Null
Get-ChildItem -LiteralPath (Join-Path $offlineRoot 'desktop'), (Join-Path $offlineRoot 'mobile') -Filter 'frame-*.webp' -ErrorAction SilentlyContinue | Remove-Item -Force
& robocopy $hostingRoot $offlineRoot /E /COPY:DAT /DCOPY:DAT /R:10 /W:2 /NFL /NDL /NJH /NJS /NP | Out-Null
if ($LASTEXITCODE -gt 7) { throw "Unable to mirror cinematic assets (robocopy exit code $LASTEXITCODE)" }

$desktopSheets = Get-ChildItem -LiteralPath $desktopRoot -Filter 'sheet-*.webp'
$mobileSheets = Get-ChildItem -LiteralPath $mobileRoot -Filter 'sheet-*.webp'

[pscustomobject]@{
  DesktopFrames = 600
  DesktopSheets = $desktopSheets.Count
  DesktopMegabytes = [math]::Round(($desktopSheets | Measure-Object Length -Sum).Sum / 1MB, 2)
  MobileFrames = 600
  MobileSheets = $mobileSheets.Count
  MobileMegabytes = [math]::Round(($mobileSheets | Measure-Object Length -Sum).Sum / 1MB, 2)
}
