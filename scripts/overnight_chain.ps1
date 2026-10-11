# Overnight chain: wait for run main to finish, then ablations + aggregate + figures.
# Usage: powershell -File scripts/overnight_chain.ps1

$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot\..
$env:PYTHONIOENCODING = "utf-8"

function Get-RunStatus($runId) {
    $state = "runs\$runId\state.json"
    if (-not (Test-Path $state)) { return $null }
    $j = Get-Content $state -Raw | ConvertFrom-Json
    return $j.status
}

function Wait-RunCompleted($runId) {
    Write-Host "Waiting for run $runId to complete..."
    while ($true) {
        $status = Get-RunStatus $runId
        if ($status -eq "completed" -or $status -eq "failed") {
            Write-Host "Run $runId status=$status"
            return $status
        }
        if ($status -eq "paused") {
            Write-Host "Run paused - resuming..."
            $pauseFile = "runs\$runId\PAUSE"
            if (Test-Path $pauseFile) { Remove-Item $pauseFile -Force }
            Start-Process -FilePath "uv" -ArgumentList @("run", "python", "scripts/run_benchmark.py", "--run-id", $runId) -WindowStyle Hidden
            Start-Sleep -Seconds 60
            continue
        }
        Start-Sleep -Seconds 120
    }
}

if (-not (Test-Path "runs\main\state.json")) {
    Write-Host "No runs/main/state.json - start the benchmark first."
    exit 1
}

Wait-RunCompleted "main"

Write-Host "Aggregating main results..."
uv run python scripts/aggregate.py

Write-Host "=== Ablation: layers ==="
uv run python scripts/run_ablations.py --run-id ablations-layers --ablation layers --force

Write-Host "=== Ablation: tau ==="
uv run python scripts/run_ablations.py --run-id ablations-tau --ablation tau --force

Write-Host "=== Ablation: resolution ==="
uv run python scripts/run_ablations.py --run-id ablations-res --ablation resolution --force

Write-Host "=== Ablation: batched0 ==="
uv run python scripts/run_ablations.py --run-id ablations-b0 --ablation batched0 --force

Write-Host "=== Ablation: backbone ==="
uv run python scripts/run_ablations.py --run-id ablations-bb --ablation backbone --force

uv run python scripts/aggregate.py
uv run python scripts/make_figures.py --datasets mvtec visa --per-category 2

Write-Host "Overnight chain finished."
