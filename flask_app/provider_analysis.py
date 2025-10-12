# provider_analysis.py
import os, shutil
from typing import Any, Dict, List, Optional, Tuple
import openpyxl

from challange_2 import challange_2  # update to your actual module

_EXPECTED_BASENAMES = [
    "schedule_1_minimize_providers.xlsx",
    "schedule_2_balanced_providers.xlsx",
    "schedule_3_phase1_conservative.xlsx",
]

def _find_schedule_files(output_dir: str) -> List[str]:
    paths: List[str] = []
    # Prefer specific expected filenames first if present
    for name in _EXPECTED_BASENAMES:
        p = os.path.join(output_dir, name)
        if os.path.exists(p):
            paths.append(p)
    # Include any other schedule_*.xlsx
    if os.path.isdir(output_dir):
        for fname in os.listdir(output_dir):
            if fname.lower().endswith(".xlsx") and fname.startswith("schedule_"):
                full = os.path.join(output_dir, fname)
                if full not in paths:
                    paths.append(full)
    return paths

def _read_b1_score(path: str) -> Optional[float]:
    try:
        wb = openpyxl.load_workbook(path, data_only=True)
        ws = wb.active
        val = ws["B1"].value
        return float(val) if val is not None else None
    except Exception:
        return None

def _rank(paths: List[str]) -> List[str]:
    # Rank: expected-name priority first; within that, higher B1 score first; then filename
    def key(p: str) -> Tuple[int, float, str]:
        fname = os.path.basename(p)
        try:
            pos = _EXPECTED_BASENAMES.index(fname)
        except ValueError:
            pos = len(_EXPECTED_BASENAMES) + 1
        score = _read_b1_score(p)
        return (pos, -(score if score is not None else -1e9), fname)
    return sorted(paths, key=key)

def run_provider_analysis(
    *,
    availability_path: str,
    contract_path: str,
    credentialing_path: str,
    facility_volume_path: str,
    coverage_path: str,
    output_dir: str = "output",
) -> Dict[str, Any]:
    os.makedirs(output_dir, exist_ok=True)

    # Run your generator (writes into output_dir)
    generated_path = challange_2(
        provider_contracts_path=contract_path,
        provider_credentials_path=credentialing_path,
        facility_coverage_path=coverage_path,
        facility_volume_path=facility_volume_path,
        provider_availability_path=availability_path,
        output_dir=output_dir,
    )

    # Discover produced schedules
    candidates = _find_schedule_files(output_dir)

    # If none match schedule_*.xlsx, include the single generated file
    if not candidates and os.path.exists(generated_path):
        candidates = [generated_path]

    ranked = _rank(candidates) if candidates else []

    # If you want rank2 to fallback to rank1 when only one file exists, keep as below.
    # If you prefer "None" when only one file exists, change the expression accordingly.
    rank2 = ranked[1] if len(ranked) >= 2 else (ranked[0] if ranked else None)

    return {
        "status": "ok",
        "output_dir": os.path.abspath(output_dir),
        "generated_path": os.path.abspath(generated_path) if generated_path else None,
        "ranked": [os.path.abspath(p) for p in ranked],
        "rank2_path": os.path.abspath(rank2) if rank2 else None,
    }
