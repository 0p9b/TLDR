# TLDR merge handoff

See `scripts/run_merge_pipeline.sh` for Codex ↔ Claude pipeline.

## Reasoning

| Tool | Setting |
|------|---------|
| **Codex** | `-c model_reasoning_effort="xhigh"` on every `codex exec` / `codex exec review` |
| **Claude Code** | `--settings '{"ultracode":true}'` on every `claude -p` (ultracode = xhigh + auto workflows; **not** `--effort ultracode`) |

## Run

```bash
cd /home/user/TLDR
./scripts/run_merge_pipeline.sh all   # or codex1 | claude2 | codex3 | claude4
```

Target: unified **TLDR** on branch `merge/unified-product` → `main` @ jqbit/TLDR.

Work dirs: `/home/user/TLDR` (write), `/home/user/blunt`, `/home/user/caveman` (read).