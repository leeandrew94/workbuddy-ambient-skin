[CmdletBinding(PositionalBinding = $false)]
param(
  [string]$WorkBuddyExe,
  [Parameter(ValueFromRemainingArguments = $true)]
  [string[]]$AmbientArguments
)

$ErrorActionPreference = 'Stop'

function Find-CompatibleNode {
  $candidates = @()
  if ($env:WORKBUDDY_NODE) { $candidates += $env:WORKBUDDY_NODE }
  $command = Get-Command node.exe -ErrorAction SilentlyContinue
  if ($command) { $candidates += $command.Source }
  $command = Get-Command node -ErrorAction SilentlyContinue
  if ($command) { $candidates += $command.Source }
  $versionsRoot = Join-Path $env:USERPROFILE '.workbuddy\binaries\node\versions'
  if (Test-Path -LiteralPath $versionsRoot) {
    $candidates += Get-ChildItem -LiteralPath $versionsRoot -Directory |
      Sort-Object { try { [version]$_.Name } catch { [version]'0.0' } } -Descending |
      ForEach-Object { Join-Path $_.FullName 'node.exe' }
  }
  foreach ($candidate in $candidates | Where-Object { $_ } | Select-Object -Unique) {
    if (-not (Test-Path -LiteralPath $candidate -PathType Leaf)) { continue }
    try {
      $major = [int](& $candidate -p 'Number(process.versions.node.split(".")[0])')
      if ($LASTEXITCODE -eq 0 -and $major -ge 22) { return (Resolve-Path -LiteralPath $candidate).Path }
    } catch { continue }
  }
  throw 'Node.js 22 or newer was not found. Install Node.js 22+ or set WORKBUDDY_NODE.'
}

if ($WorkBuddyExe) {
  $resolved = (Resolve-Path -LiteralPath $WorkBuddyExe -ErrorAction Stop).Path
  if ([IO.Path]::GetFileName($resolved) -cne 'WorkBuddy.exe') { throw '-WorkBuddyExe must point to WorkBuddy.exe' }
  $env:WORKBUDDY_EXE = $resolved
}

$entry = Join-Path $PSScriptRoot 'ambient.mjs'
if (-not (Test-Path -LiteralPath $entry -PathType Leaf)) { throw "Missing entry point: $entry" }
$node = Find-CompatibleNode
$sid = [Security.Principal.WindowsIdentity]::GetCurrent().User.Value
$mutex = [Threading.Mutex]::new($false, "Local\WorkBuddyAmbientSkin.$sid.Operation")
$locked = $false
try {
  $locked = $mutex.WaitOne(0)
  if (-not $locked) { throw 'Another WorkBuddy Ambient Skin operation is already running' }
  & $node $entry @AmbientArguments
  exit $LASTEXITCODE
} finally {
  if ($locked) { try { $mutex.ReleaseMutex() } catch {} }
  $mutex.Dispose()
}
