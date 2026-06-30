"""DSPy optimization v2 — expanded probe corpus + bigger search.

Run from repo root:
    python3 bench/dspy/expanded_corpus.py
    python3 bench/dspy/dspy_optimize_v2.py {tldr|blunt}
"""

from __future__ import annotations

import json
import os
import sys
from pathlib import Path

from dspy_optimize import optimize, score_blunt_probe, score_tldr_probe

ROOT = Path(__file__).resolve().parents[2]
DSPY_DIR = Path(os.environ.get("TLDR_DSPY_DIR", "/tmp/tldr-test/dspy"))
SPLITS_PATH = DSPY_DIR / "probe_splits_10x.json"


def main(variant: str) -> None:
    if variant not in {"tldr", "blunt"}:
        raise SystemExit("Usage: python3 bench/dspy/dspy_optimize_v2.py {tldr|blunt}")

    if not SPLITS_PATH.exists():
        raise SystemExit(f"Missing {SPLITS_PATH}. Run bench/dspy/expanded_corpus.py first.")

    splits = json.loads(SPLITS_PATH.read_text())
    train = splits[variant]["train"]

    if variant == "tldr":
        seed = (ROOT / "TLDR.md").read_text()
        scorer = score_tldr_probe
    else:
        # Backward-compatible alias: use the merged TLDR prompt for legacy TLDR flow.
        seed = (ROOT / "TLDR.md").read_text()
        scorer = score_blunt_probe

    optimize(seed, train, scorer, variant, breadth=6, depth=4, out_dir=str(DSPY_DIR / "v2"))


if __name__ == "__main__":
    if len(sys.argv) < 2:
        raise SystemExit("Usage: python3 bench/dspy/dspy_optimize_v2.py {tldr|blunt}")
    main(sys.argv[1])
