<#
.SYNOPSIS
  Start the Cometa backend (:8080) and the Vite dev server (:5173) in the background.

.DESCRIPTION
  Both run detached with output in logs/backend.log and logs/frontend.log, so the
  terminal is free once this script returns. Stop them with scripts/stop-both.ps1.

  The backend runs the already-built jar; it is not rebuilt. Pass -Build to run
  `mvnw -DskipTests clean package` first and verify every MapStruct mapper.

.PARAMETER BackendDir
  Backend repo root. Defaults to $env:COMETA_BACKEND_DIR, then F:\programming\cometa.
#>
param(
  [string]$BackendDir = $(if ($env:COMETA_BACKEND_DIR) { $env:COMETA_BACKEND_DIR } else { "F:\programming\cometa" }),
  [string]$JavaHome = "C:\Program Files\Microsoft\jdk-25.0.4.101-hotspot",
  [switch]$Build,
  [int]$TimeoutSec = 120
)

$ErrorActionPreference = "Stop"
$FrontendDir = Split-Path -Parent $PSScriptRoot
$LogDir = Join-Path $FrontendDir "logs"
$JarDir = Join-Path $BackendDir "cometa-web-module\target"
$EnvFile = Join-Path $BackendDir ".vscode\backend.env"

function Test-Listening([int]$Port) {
  [bool](Get-NetTCPConnection -LocalPort $Port -State Listen -ErrorAction SilentlyContinue)
}

function Wait-ForLog([string]$Path, [string]$Ready, [string]$Failed, [int]$Port) {
  $deadline = (Get-Date).AddSeconds($TimeoutSec)
  while ((Get-Date) -lt $deadline) {
    if (Test-Path $Path) {
      $text = Get-Content -Raw $Path -ErrorAction SilentlyContinue
      if ($text -match $Failed) { return $false }
      if ($text -match $Ready -and (Test-Listening $Port)) { return $true }
    }
    Start-Sleep -Milliseconds 500
  }
  return $false
}

# --- Preflight -------------------------------------------------------------

$viteConfig = Get-Content -Raw (Join-Path $FrontendDir "vite.config.ts")
if ($viteConfig -notmatch '(?m)^\s*target:\s*"http://localhost:8080"') {
  Write-Warning "vite.config.ts /api proxy is not targeting http://localhost:8080 - the local backend will be bypassed."
}
$envLocal = Join-Path $FrontendDir ".env.development.local"
if (-not ((Test-Path $envLocal) -and ((Get-Content -Raw $envLocal) -match 'VITE_MOCK_API=false'))) {
  Write-Warning ".env.development.local does not set VITE_MOCK_API=false - the frontend will use mocks."
}

New-Item -ItemType Directory -Force $LogDir | Out-Null
$env:JAVA_HOME = $JavaHome

# --- Backend ---------------------------------------------------------------

if (Test-Listening 8080) {
  Write-Host "backend : already listening on :8080, skipping"
} else {
  if ($Build) {
    Write-Host "backend : building (mvnw -DskipTests clean package)..."
    & (Join-Path $BackendDir "mvnw.cmd") -f (Join-Path $BackendDir "pom.xml") -q -DskipTests clean package
    if ($LASTEXITCODE -ne 0) { throw "backend build failed" }

    # The build can silently emit *MapperImpl without `implements` (BUILD SUCCESS,
    # then startup fails). TopicDataMapperImpl legitimately has 0 interfaces.
    $classes = Join-Path $BackendDir "cometa-service-module\target\classes"
    $broken = Get-ChildItem (Join-Path $classes "ru\sberbank\cib\gmbus\service\mapper\*MapperImpl.class") |
      Where-Object { $_.BaseName -ne "TopicDataMapperImpl" } |
      Where-Object {
        $info = & "$JavaHome\bin\javap.exe" -v -cp $classes "ru.sberbank.cib.gmbus.service.mapper.$($_.BaseName)" |
          Select-String -Pattern 'interfaces:' | Select-Object -First 1
        "$info" -notmatch 'interfaces: 1'
      }
    if ($broken) { throw "corrupt mappers (no interface): $($broken.BaseName -join ', ') - rebuild" }
  }
  # Resolved after the build so a project version bump doesn't break the script.
  $Jar = Get-ChildItem (Join-Path $JarDir "cometa-web-module-*.jar") -ErrorAction SilentlyContinue |
    Sort-Object LastWriteTime -Descending | Select-Object -First 1 -ExpandProperty FullName
  if (-not $Jar) { throw "backend jar not found in $JarDir (run with -Build)" }

  $line = Get-Content $EnvFile | Where-Object { $_ -match '^DB_PASSWORD=' } | Select-Object -First 1
  if (-not $line) { throw "DB_PASSWORD not found in $EnvFile" }
  $env:DB_PASSWORD = ($line -replace '^DB_PASSWORD=', '').Trim()
  $env:SPRING_PROFILES_ACTIVE = "local"

  $backendLog = Join-Path $LogDir "backend.log"
  Remove-Item $backendLog, "$backendLog.err" -ErrorAction SilentlyContinue
  Start-Process -FilePath "$JavaHome\bin\java.exe" -ArgumentList "-jar", "`"$Jar`"" `
    -WorkingDirectory $BackendDir -WindowStyle Hidden `
    -RedirectStandardOutput $backendLog -RedirectStandardError "$backendLog.err" | Out-Null
  Write-Host "backend : starting (log: $backendLog)"
}

# --- Frontend --------------------------------------------------------------

if (Test-Listening 5173) {
  Write-Host "frontend: already listening on :5173, skipping"
} else {
  $frontendLog = Join-Path $LogDir "frontend.log"
  Remove-Item $frontendLog, "$frontendLog.err" -ErrorAction SilentlyContinue
  Start-Process -FilePath "npm.cmd" -ArgumentList "run", "dev", "--", "--host" `
    -WorkingDirectory $FrontendDir -WindowStyle Hidden `
    -RedirectStandardOutput $frontendLog -RedirectStandardError "$frontendLog.err" | Out-Null
  Write-Host "frontend: starting (log: $frontendLog)"
}

# --- Wait for readiness ----------------------------------------------------

$ok = $true
if ($backendLog) {
  if (Wait-ForLog $backendLog 'Started CometaApplication' 'APPLICATION FAILED TO START|Error starting ApplicationContext' 8080) {
    Write-Host "backend : ready on http://localhost:8080"
  } else {
    $ok = $false
    Write-Warning "backend did not start - see $backendLog"
  }
}
if ($frontendLog) {
  if (Wait-ForLog $frontendLog 'ready in' 'error when starting dev server|EADDRINUSE' 5173) {
    Write-Host "frontend: ready on http://localhost:5173"
  } else {
    $ok = $false
    Write-Warning "frontend did not start - see $frontendLog"
  }
}

if ($ok) {
  try {
    Invoke-WebRequest -UseBasicParsing "http://localhost:5173/api/me" | Out-Null
    Write-Host "proxy   : /api/me answered"
  } catch {
    $code = [int]$_.Exception.Response.StatusCode
    if ($code -eq 403 -or $code -eq 401) {
      Write-Host "proxy   : /api/me -> $code (backend reachable, not logged in)"
    } else {
      Write-Warning "proxy: /api/me -> $code"
    }
  }
} else {
  exit 1
}
