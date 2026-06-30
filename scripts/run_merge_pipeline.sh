#!/usr/bin/env bash
# Codex ↔ Claude merge verification pipeline. Run from TLDR repo root.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
HANDOFF="$ROOT/docs/MERGE_HANDOFF.md"
LOG_DIR="$ROOT/.merge-pipeline-logs"
mkdir -p "$LOG_DIR"
export PATH="/home/linuxbrew/.linuxbrew/bin:$PATH"

# Reasoning (user request): Codex xhigh, Claude Code ultracode (xhigh + auto workflows)
CODEX_REASONING=( -c 'model_reasoning_effort="xhigh"' )
CLAUDE_REASONING=( --settings '{"ultracode":true}' )

PHASE="${1:-all}"

run_verify() {
  echo "=== verify ===" | tee -a "$LOG_DIR/verify.log"
  set +e
  python3 tests/verify_repo.py 2>&1 | tee -a "$LOG_DIR/verify.log"
  node --test tests/installer/*.test.mjs 2>&1 | tee -a "$LOG_DIR/verify.log"
  python3 bench/check-doc-sync.py 2>&1 | tee -a "$LOG_DIR/verify.log"
  python3 bench/check-md-links.py 2>&1 | tee -a "$LOG_DIR/verify.log"
  node bin/install.js --list 2>&1 | head -20 | tee -a "$LOG_DIR/verify.log"
  set -e
}

codex_phase1() {
  echo "=== Codex phase 1 ===" | tee "$LOG_DIR/codex-phase1.log"
  codex exec "${CODEX_REASONING[@]}" -c 'sandbox_permissions=["disk-full-read-access"]' \
    "You are merging jqbit/TLDR unified product. Read $HANDOFF fully. Work ONLY in $ROOT. Fix all rebrand gaps (blunt/caveman paths, hook names, plugins/tldr/skills). Sync skills/tldr/SKILL.md with TLDR.md rules. Update tests/verify_repo.py for tldr naming. Cherry-pick caveman deltas from /home/user/caveman per handoff. Run verification gates and fix until green or document blockers in docs/MERGE_STATUS.md." \
    2>&1 | tee -a "$LOG_DIR/codex-phase1.log"
}

claude_phase2() {
  echo "=== Claude phase 2 ===" | tee "$LOG_DIR/claude-phase2.log"
  claude -p "${CLAUDE_REASONING[@]}" --add-dir "$ROOT" --add-dir /home/user/caveman \
    --allowedTools "Bash,Read,Edit,Write,Glob,Grep" \
    "Read $HANDOFF and docs/MERGE_STATUS.md if present. Review Codex phase 1 work in $ROOT. Rewrite README.md + INSTALL.md for unified TLDR (prompt + 30-agent installer). Update SECURITY.md URLs to jqbit/TLDR. Ensure install.sh delegates to bin/install.js where appropriate while keeping --with-hermes. Do NOT remove data/ or bench/ history. Commit-ready quality." \
    2>&1 | tee -a "$LOG_DIR/claude-phase2.log"
}

codex_phase3() {
  echo "=== Codex phase 3 review ===" | tee "$LOG_DIR/codex-phase3.log"
  codex exec review "${CODEX_REASONING[@]}" 2>&1 | tee -a "$LOG_DIR/codex-phase3.log" || true
  codex exec "${CODEX_REASONING[@]}" -c 'sandbox_permissions=["disk-full-read-access"]' \
    "Fix any issues from codex review and claude phase 2 in $ROOT. Re-run verify gates. Update docs/MERGE_STATUS.md with final checklist." \
    2>&1 | tee -a "$LOG_DIR/codex-phase3.log"
}

claude_phase4() {
  echo "=== Claude phase 4 ===" | tee "$LOG_DIR/claude-phase4.log"
  claude -p "${CLAUDE_REASONING[@]}" --add-dir "$ROOT" \
    --allowedTools "Bash,Read,Edit,Write,Glob,Grep" \
    "Final integration pass on $ROOT per $HANDOFF. Fix remaining rg hits for caveman|jqbit/blunt in shipped code (exclude data/, ATTRIBUTION). Produce git commit message in docs/COMMIT_MSG.txt." \
    2>&1 | tee -a "$LOG_DIR/claude-phase4.log"
}

case "$PHASE" in
  verify) run_verify ;;
  codex1) codex_phase1 ;;
  claude2) claude_phase2 ;;
  codex3) codex_phase3 ;;
  claude4) claude_phase4 ;;
  all)
    codex_phase1
    run_verify
    claude_phase2
    codex_phase3
    run_verify
    claude_phase4
    ;;
  *) echo "usage: $0 [verify|codex1|claude2|codex3|claude4|all]" >&2; exit 1 ;;
esac