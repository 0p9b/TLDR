"""Held-out evaluation: compare optimized prompts vs current shipped on test set.

Runs each prompt against the held-out probes, produces a comparison report
with per-category breakdown and pass/fail vs shipped baseline.
"""
import json
import math
import os
import sys
from concurrent.futures import ThreadPoolExecutor, as_completed
from pathlib import Path

from dspy_optimize import (
    run_claude, score_tldr_probe, score_blunt_probe, evaluate_prompt
)

ROOT = Path(__file__).resolve().parents[2]
OUTDIR = os.environ.get("TLDR_DSPY_DIR", "/tmp/tldr-test/dspy")


def main():
    splits_path = Path(f"{OUTDIR}/probe_splits.json")
    if not splits_path.exists():
        splits_path = Path(f"{OUTDIR}/probe_splits_10x.json")
    if not splits_path.exists():
        raise SystemExit(f"Missing {splits_path}. Run bench/dspy/expanded_corpus.py first.")
    splits = json.loads(splits_path.read_text())

    # Read all 4 prompts: TLDR shipped, TLDR optimized, BLUNT shipped, BLUNT optimized
    tldr_shipped = (ROOT / "TLDR.md").read_text()
    blunt_shipped = (ROOT / "TLDR.blunt.md").read_text()

    tldr_opt_path = Path(f"{OUTDIR}/tldr_best.md")
    blunt_opt_path = Path(f"{OUTDIR}/blunt_best.md")

    if not tldr_opt_path.exists():
        print(f"ERROR: {tldr_opt_path} not found. Run tldr optimization first.")
        return
    if not blunt_opt_path.exists():
        print(f"ERROR: {blunt_opt_path} not found. Run blunt optimization first.")
        return

    tldr_opt = tldr_opt_path.read_text()
    blunt_opt = blunt_opt_path.read_text()

    print("=" * 80)
    print("HELD-OUT EVALUATION (probes the optimizer never saw)")
    print("=" * 80)

    print(f"\nTLDR test probes: {len(splits['tldr']['test'])}")
    print(f"BLUNT test probes: {len(splits['blunt']['test'])}")
    print()

    # TLDR comparison
    print("=" * 80)
    print("TLDR: shipped (v0.16.0) vs DSPy-optimized")
    print("=" * 80)
    print(f"shipped: {len(tldr_shipped)} chars  |  optimized: {len(tldr_opt)} chars")
    print()
    print("Evaluating shipped on held-out...")
    tldr_shipped_res = evaluate_prompt(tldr_shipped, splits["tldr"]["test"], score_tldr_probe)
    print(f"  shipped: mean={tldr_shipped_res['mean']:.3f}, final={tldr_shipped_res['final']:.3f}")

    print("Evaluating optimized on held-out...")
    tldr_opt_res = evaluate_prompt(tldr_opt, splits["tldr"]["test"], score_tldr_probe)
    print(f"  optimized: mean={tldr_opt_res['mean']:.3f}, final={tldr_opt_res['final']:.3f}")

    # Per-probe diff
    print("\nPER-PROBE BREAKDOWN (TLDR held-out)")
    print(f"  {'prompt':<55} {'shipped':>10} {'optimized':>11} {'Δ':>8}")
    sh_by = {r["probe"]["prompt"]: r for r in tldr_shipped_res["details"]}
    op_by = {r["probe"]["prompt"]: r for r in tldr_opt_res["details"]}
    for p in splits["tldr"]["test"]:
        sh = sh_by.get(p["prompt"], {}).get("score", float("nan"))
        op = op_by.get(p["prompt"], {}).get("score", float("nan"))
        diff = op - sh if not (math.isnan(sh) or math.isnan(op)) else float("nan")
        print(f"  {p['prompt'][:55]:<55} {sh:>10.3f} {op:>11.3f} {diff:>+8.3f}")

    # Paired t-test
    pairs = [(sh_by[p["prompt"]]["score"], op_by[p["prompt"]]["score"])
             for p in splits["tldr"]["test"]
             if p["prompt"] in sh_by and p["prompt"] in op_by]
    diffs = [op - sh for sh, op in pairs]
    n = len(diffs)
    md = sum(diffs) / n if n else 0
    var = sum((d - md) ** 2 for d in diffs) / max(n - 1, 1)
    sd = var ** 0.5
    se = sd / math.sqrt(n) if n else float("inf")
    t = md / se if se else float("inf")
    p_val = math.erfc(abs(t) / 2 ** 0.5) if t != float("inf") else 0.0
    sig = "***" if p_val < 0.001 else "**" if p_val < 0.01 else "*" if p_val < 0.05 else "ns"
    print(f"\n  TLDR paired t-test: mean diff={md:+.3f}, t={t:+.2f}, p={p_val:.4f} {sig}")

    # BLUNT comparison
    print("\n" + "=" * 80)
    print("BLUNT: shipped (v0.15.0) vs DSPy-optimized")
    print("=" * 80)
    print(f"shipped: {len(blunt_shipped)} chars  |  optimized: {len(blunt_opt)} chars")
    print()
    print("Evaluating shipped on held-out...")
    blunt_shipped_res = evaluate_prompt(blunt_shipped, splits["blunt"]["test"], score_blunt_probe)
    print(f"  shipped: mean={blunt_shipped_res['mean']:.3f}, final={blunt_shipped_res['final']:.3f}")

    print("Evaluating optimized on held-out...")
    blunt_opt_res = evaluate_prompt(blunt_opt, splits["blunt"]["test"], score_blunt_probe)
    print(f"  optimized: mean={blunt_opt_res['mean']:.3f}, final={blunt_opt_res['final']:.3f}")

    print("\nPER-PROBE BREAKDOWN (BLUNT held-out)")
    print(f"  {'prompt':<55} {'cat':<14} {'shipped':>10} {'optimized':>11} {'Δ':>8}")
    sh_by = {r["probe"]["prompt"]: r for r in blunt_shipped_res["details"]}
    op_by = {r["probe"]["prompt"]: r for r in blunt_opt_res["details"]}
    for p in splits["blunt"]["test"]:
        sh = sh_by.get(p["prompt"], {}).get("score", float("nan"))
        op = op_by.get(p["prompt"], {}).get("score", float("nan"))
        diff = op - sh if not (math.isnan(sh) or math.isnan(op)) else float("nan")
        print(f"  {p['prompt'][:55]:<55} {p['category']:<14} {sh:>10.3f} {op:>11.3f} {diff:>+8.3f}")

    pairs = [(sh_by[p["prompt"]]["score"], op_by[p["prompt"]]["score"])
             for p in splits["blunt"]["test"]
             if p["prompt"] in sh_by and p["prompt"] in op_by]
    diffs = [op - sh for sh, op in pairs]
    n = len(diffs)
    md = sum(diffs) / n if n else 0
    var = sum((d - md) ** 2 for d in diffs) / max(n - 1, 1)
    sd = var ** 0.5
    se = sd / math.sqrt(n) if n else float("inf")
    t = md / se if se else float("inf")
    p_val = math.erfc(abs(t) / 2 ** 0.5) if t != float("inf") else 0.0
    sig = "***" if p_val < 0.001 else "**" if p_val < 0.01 else "*" if p_val < 0.05 else "ns"
    print(f"\n  BLUNT paired t-test: mean diff={md:+.3f}, t={t:+.2f}, p={p_val:.4f} {sig}")

    # Final verdict
    print("\n" + "=" * 80)
    print("VERDICT")
    print("=" * 80)
    tldr_better = tldr_opt_res["final"] > tldr_shipped_res["final"]
    blunt_better = blunt_opt_res["final"] > blunt_shipped_res["final"]
    print(f"\nTLDR optimized > shipped on held-out: {'YES' if tldr_better else 'NO'}")
    print(f"BLUNT optimized > shipped on held-out: {'YES' if blunt_better else 'NO'}")

    # Save full results
    output = {
        "tldr_shipped": {"chars": len(tldr_shipped), "mean": tldr_shipped_res["mean"], "final": tldr_shipped_res["final"]},
        "tldr_optimized": {"chars": len(tldr_opt), "mean": tldr_opt_res["mean"], "final": tldr_opt_res["final"]},
        "blunt_shipped": {"chars": len(blunt_shipped), "mean": blunt_shipped_res["mean"], "final": blunt_shipped_res["final"]},
        "blunt_optimized": {"chars": len(blunt_opt), "mean": blunt_opt_res["mean"], "final": blunt_opt_res["final"]},
        "tldr_winner": "optimized" if tldr_better else "shipped",
        "blunt_winner": "optimized" if blunt_better else "shipped",
    }
    with open(f"{OUTDIR}/holdout_results.json", "w") as f:
        json.dump(output, f, indent=2)
    print(f"\nFull results saved to {OUTDIR}/holdout_results.json")


if __name__ == "__main__":
    main()
