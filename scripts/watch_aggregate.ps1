# Periodically aggregate while main run is active.
while ($true) {
  Set-Location D:\SubspaceAD
  $env:PYTHONIOENCODING = "utf-8"
  uv run python scripts/aggregate.py | Out-Host
  uv run python scripts/runctl.py status main | Out-Host
  $st = Get-Content runs\main\state.json -Raw | ConvertFrom-Json
  if ($st.status -in @("completed", "failed")) { break }
  Start-Sleep -Seconds 1800
}
