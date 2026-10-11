# Starts the Ollama bridge and a temporary public HTTPS address for it (Windows).
# Requires: Ollama running with the chosen model pulled, Node 18+, and cloudflared on PATH.
$ErrorActionPreference = 'Stop'
Set-Location -LiteralPath $PSScriptRoot
foreach ($cmd in 'node','cloudflared','ollama') { if (-not (Get-Command $cmd -ErrorAction SilentlyContinue)) { throw "$cmd is not installed or not on PATH" } }
$bridge = Start-Process node -ArgumentList 'ollama-bridge.mjs' -PassThru -NoNewWindow
Start-Sleep -Seconds 2
$log = Join-Path $env:TEMP ("bridge-tunnel-" + [DateTime]::Now.ToString('yyyyMMddHHmmss') + ".log")
$tunnel = Start-Process cloudflared -ArgumentList 'tunnel --url http://127.0.0.1:11500' -PassThru -WindowStyle Hidden -RedirectStandardError $log
$url = $null
for ($i = 0; $i -lt 45 -and -not $url; $i++) { Start-Sleep 1; if (Test-Path $log) { $m = [regex]::Match((Get-Content $log -Raw), 'https://[a-z0-9-]+\.trycloudflare\.com'); if ($m.Success) { $url = $m.Value } } }
if (-not $url) { Stop-Process -Id $bridge.Id, $tunnel.Id -ErrorAction SilentlyContinue; throw "Could not open the tunnel. See $log" }
Write-Host ""
Write-Host "Bridge address: $url"
Write-Host "Bridge token:   $(Get-Content (Join-Path $PSScriptRoot 'bridge-token.txt'))"
Write-Host "Paste both into the system: Model connection > Team Ollama. Keep this window open. Ctrl+C to stop."
try { Wait-Process -Id $bridge.Id } finally { Stop-Process -Id $tunnel.Id -ErrorAction SilentlyContinue }
