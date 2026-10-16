<#
.SYNOPSIS
  Stop the Cometa backend (:8080) and the Vite dev server (:5173).

.DESCRIPTION
  Kills whatever listens on each port, with its process tree, plus any
  cometa-web-module java process that has not bound :8080 yet.
#>
$ErrorActionPreference = "Stop"

function Stop-Tree([int]$ProcessId, [string]$Label) {
  & taskkill.exe /PID $ProcessId /T /F 2>$null | Out-Null
  Write-Host "$Label stopped (pid $ProcessId)"
}

$pids = @{}
foreach ($port in 8080, 5173) {
  Get-NetTCPConnection -LocalPort $port -State Listen -ErrorAction SilentlyContinue |
    ForEach-Object { $pids[[int]$_.OwningProcess] = ":$port" }
}
Get-CimInstance Win32_Process -Filter "Name='java.exe'" |
  Where-Object { $_.CommandLine -like "*cometa-web-module*" } |
  ForEach-Object { if (-not $pids.ContainsKey([int]$_.ProcessId)) { $pids[[int]$_.ProcessId] = "backend" } }

if ($pids.Count -eq 0) {
  Write-Host "nothing running on :8080 or :5173"
  exit 0
}
foreach ($entry in $pids.GetEnumerator()) { Stop-Tree $entry.Key $entry.Value }

Start-Sleep -Milliseconds 500
$left = Get-NetTCPConnection -LocalPort 8080, 5173 -State Listen -ErrorAction SilentlyContinue
if ($left) {
  Write-Warning "still listening: $(($left.LocalPort | Sort-Object -Unique) -join ', ')"
  exit 1
}
Write-Host "ports 8080 and 5173 free"
