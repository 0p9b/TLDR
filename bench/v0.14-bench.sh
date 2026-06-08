#!/usr/bin/env bash
# Phase 2: 11 harnesses (parallel) x 15 prompts x N=2 trials x {baseline, tldr}.
# Within harness: trials parallel, prompts sequential.
set -u
ROOT=${TLDR_BENCH_DIR:-"$HOME/bench-v14"}
OUT=$ROOT/fullbench
mkdir -p "$OUT"/{baseline,tldr}

declare -A PROMPTS=(
  [Q01]="What's the git command to undo the last commit but keep changes staged?"
  [Q02]="Explain the difference between cookies, sessionStorage, and localStorage."
  [Q03]="Should I use Redux for a small todo app?"
  [Q04]="My React useEffect is firing twice on mount in React 18 — why?"
  [Q05]="What's the difference between callbacks, promises, and async/await?"
  [Q06]="EADDRINUSE error — what is it?"
  [Q07]="How do I add rate limiting to an Express API?"
  [Q08]="Write a Python function that groups a list of dicts by a given key. Save it to /tmp/groupby.py and run a quick smoke test."
  [Q09]="I've been stuck on a CORS error for two hours — No Access-Control-Allow-Origin header even though I have cors() middleware on my Express app. What am I missing?"
  [Q10]="Summarize what you changed in /tmp/groupby.py."
  [Q11]="Fix this bug."
  [Q12]="What are some best practices to avoid getting rate-limited when calling external APIs?"
  [Q13]="Write a regex that matches a valid IPv4 address. Output the regex only, no explanation."
  [Q14]="Hello how are you?"
  [Q15]="What are the tradeoffs of microservices vs a monolith for an early-stage startup?"
)
Q_IDS=(Q01 Q02 Q03 Q04 Q05 Q06 Q07 Q08 Q09 Q10 Q11 Q12 Q13 Q14 Q15)
N_TRIALS=${N_TRIALS:-2}

declare -A SLOTS=(
  [claude]="$HOME/.claude/CLAUDE.md"
  [codex]="$HOME/.codex/AGENTS.md"
  [copilot]="$HOME/.copilot/copilot-instructions.md"
  [droid]="$HOME/.factory/AGENTS.md"
  [hermes]="$HOME/.hermes/SOUL.md"
  [opencode]="$HOME/.config/opencode/AGENTS.md"
  [openclaw]="$HOME/.openclaw/AGENTS.md"
  [pi]="$HOME/.pi/agent/AGENTS.md"
  [agent]="$HOME/AGENTS.md"
  [gemini]="$HOME/.gemini/AGENTS.md"
)

invoke() {
  local h=$1 m=$2 prompt=$3
  case "$h" in
    claude)   timeout 90 ollama launch claude   --model "$m" -y -- -p "$prompt" </dev/null ;;
    codex)    timeout 90 ollama launch codex    --model "$m" -y -- exec --skip-git-repo-check "$prompt" </dev/null ;;
    copilot)  timeout 90 ollama launch copilot  --model "$m" -y -- -p "$prompt" --allow-all-tools </dev/null ;;
    droid)    timeout 90 ollama launch droid    --model "$m" -y -- exec --auto medium "$prompt" </dev/null ;;
    hermes)   timeout 90 ollama launch hermes   --model "$m" -y -- chat -q "$prompt" </dev/null ;;
    opencode) timeout 90 ollama launch opencode --model "$m" -y -- run "$prompt" </dev/null ;;
    pi)       timeout 90 ollama launch pi       --model "$m" -y -- -p "$prompt" </dev/null ;;
    cline)    timeout 90 ollama launch cline    --model "$m" -y -- -y "$prompt" </dev/null ;;
    openclaw) printf "/new\n%s\n" "$prompt" | timeout 180 script -qc "ollama launch openclaw --model $m -y -- tui" /dev/null ;;
    agent)    timeout 90 agent --yolo --model gpt-5.3-codex -p "$prompt" </dev/null ;;
    gemini)   timeout 90 gemini --yolo -p "$prompt" </dev/null ;;
  esac
}

run_one() {
  local cond=$1 h=$2 m=$3 q=$4 trial=$5
  local prompt="${PROMPTS[$q]}"
  local out=$OUT/$cond/${h}__${q}__${trial}.log
  local wdir=$OUT/$cond/cwd-${h}-${q}-${trial}
  mkdir -p "$wdir"
  local s=$(date +%s)
  (cd "$wdir" && invoke "$h" "$m" "$prompt") > "$out" 2>&1
  echo "rc=$? t=$(( $(date +%s) - s ))s $cond/$h/$q/$trial" >> "$OUT/_stream-${cond}-${h}.log"
}

harness_stream() {
  local cond=$1 h=$2 m=$3
  : > "$OUT/_stream-${cond}-${h}.log"
  for q in "${Q_IDS[@]}"; do
    # Run N trials in parallel within harness (config write idempotent for same model)
    for trial in $(seq 1 $N_TRIALS); do
      run_one "$cond" "$h" "$m" "$q" "$trial" &
    done
    wait   # wait all trials of this prompt before next prompt
  done
  echo "DONE $cond $h" >> "$OUT/_stream-${cond}-${h}.log"
}

restore_all() {
  for h in "${!SLOTS[@]}"; do
    s="${SLOTS[$h]}"
    [[ -f "$s.fullbench-bak" ]] && mv "$s.fullbench-bak" "$s"
  done
}

[[ ! -f $ROOT/winners.json ]] && { echo "winners.json missing"; exit 1; }

: > "$OUT/progress.log"
START=$(date +%s)

# ============ baseline ============
echo "=== baseline phase ===" >> "$OUT/progress.log"
for h in "${!SLOTS[@]}"; do
  s="${SLOTS[$h]}"
  [[ -f "$s" ]] && mv "$s" "$s.fullbench-bak"
done
trap restore_all EXIT INT TERM

while IFS= read -r line; do
  h="${line%%|*}"; m="${line##*|}"
  harness_stream baseline "$h" "$m" &
done < <(node -e "const w=require('$ROOT/winners.json'); for(const [h,m] of Object.entries(w)) console.log(h+'|'+m);")
wait
BTIME=$(( $(date +%s) - START ))
echo "baseline done ${BTIME}s" >> "$OUT/progress.log"

restore_all
trap - EXIT INT TERM

# ============ tldr ============
echo "=== tldr phase ===" >> "$OUT/progress.log"
T0=$(date +%s)
while IFS= read -r line; do
  h="${line%%|*}"; m="${line##*|}"
  harness_stream tldr "$h" "$m" &
done < <(node -e "const w=require('$ROOT/winners.json'); for(const [h,m] of Object.entries(w)) console.log(h+'|'+m);")
wait
TTIME=$(( $(date +%s) - T0 ))
echo "tldr done ${TTIME}s" >> "$OUT/progress.log"
echo "fullbench total $(( $(date +%s) - START ))s" >> "$OUT/progress.log"
