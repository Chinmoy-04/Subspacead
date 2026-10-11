Set-Location D:\SubspaceAD
$env:PYTHONIOENCODING = "utf-8"
Add-Content runs_ablations_chain.log "$(Get-Date -Format o) RESUME backbone only"
uv run python scripts/run_ablations.py --run-id ablations-bb --ablation backbone *>> runs_ablations_chain.log
Add-Content runs_ablations_chain.log "$(Get-Date -Format o) END backbone-retry exit=$LASTEXITCODE"
uv run python scripts/aggregate.py *>> runs_ablations_chain.log
