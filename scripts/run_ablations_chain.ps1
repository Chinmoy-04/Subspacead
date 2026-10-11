# Resume ablations safely (detached). Keeps mean@672 cache; no --force.
$ErrorActionPreference = "Continue"
Set-Location $PSScriptRoot\..
$env:PYTHONIOENCODING = "utf-8"
$log = "runs_ablations_chain.log"

function Reset-Failed($runId) {
    uv run python -c @"
import json
from pathlib import Path
from subspacead.io_utils import atomic_write_json
p = Path('runs') / '$runId' / 'state.json'
if not p.exists():
    raise SystemExit(0)
st = json.loads(p.read_text(encoding='utf-8'))
n = 0
for u in st.get('units', []):
    if u.get('status') == 'failed':
        u['status'] = 'pending'
        u['error'] = None
        u['started_at'] = None
        u['finished_at'] = None
        n += 1
if st.get('status') in ('failed', 'completed', 'paused'):
    # allow resume of remaining work
    if any(u.get('status') == 'pending' for u in st.get('units', [])):
        st['status'] = 'paused'
pause = Path('runs') / '$runId' / 'PAUSE'
if pause.exists():
    pause.unlink()
atomic_write_json(p, st)
print(f'reset {n} failed units in $runId')
"@
}

function Run-Ablation($runId, $name) {
    Add-Content $log "$(Get-Date -Format o) START $name ($runId)"
    if (Test-Path "runs\$runId\PAUSE") { Remove-Item "runs\$runId\PAUSE" -Force }
    uv run python scripts/run_ablations.py --run-id $runId --ablation $name *>> $log
    Add-Content $log "$(Get-Date -Format o) END $name exit=$LASTEXITCODE"
}

Add-Content $log "$(Get-Date -Format o) Ablation resume chain started (disk-safe)"

# Finish layers (retry failed last/concat/final7 without wiping done work)
Reset-Failed "ablations-layers"
Run-Ablation "ablations-layers" "layers"

# Continue tau from where it paused
if (Test-Path "runs\ablations-tau\PAUSE") { Remove-Item "runs\ablations-tau\PAUSE" -Force }
Add-Content $log "$(Get-Date -Format o) START tau resume (ablations-tau)"
uv run python scripts/run_ablations.py --run-id ablations-tau --ablation tau *>> $log
Add-Content $log "$(Get-Date -Format o) END tau exit=$LASTEXITCODE"

Run-Ablation "ablations-res" "resolution"
Run-Ablation "ablations-b0" "batched0"
Run-Ablation "ablations-bb" "backbone"

uv run python scripts/aggregate.py *>> $log
Add-Content $log "$(Get-Date -Format o) Ablation resume chain finished"
