# TLDR Launch Plan

Ethical growth only: no spam, fake stars, astroturfing, botting, scraping, or unsolicited mass DMs.

## Positioning

**TLDR — Verdict first. Filler never.**

One-line pitch:

> TLDR makes Claude Code, Codex, Gemini, Cursor, opencode, and 30+ AI coding agents answer with less filler while preserving tools, code, safety, and correctness.

Why people care:

- Faster agent loops.
- Lower token spend.
- Less review fatigue.
- Works across agent CLIs/editors, not one vendor.
- Tiny prompt core: `TLDR.md` is easy to inspect.

## Launch channels

Prioritize places where developer-tool users already ask for agent workflow improvements.

1. GitHub Release — canonical changelog + install command.
2. Hacker News “Show HN” — technical, benchmark-first.
3. X / Twitter — short before/after clip + repo link.
4. Reddit — only relevant subreddits, with benchmark details; no cross-post spam.
5. LinkedIn — productivity/token-cost framing.
6. Discord/Slack communities — only where self-promotion is explicitly allowed.
7. Dev.to / personal blog — methodology and benchmark writeup.

## Launch assets

### Short post

> Built TLDR: a tiny prompt + installer that makes AI coding agents answer verdict-first instead of filler-first. Works with Claude Code, Codex, Gemini, Cursor, opencode, and 30+ agents. Prompt is 1.3KB. Benchmarks show ~60–75% fewer prose tokens. Verdict first. Filler never. https://github.com/jqbit/TLDR

### Technical post

> TLDR is a repo-local/system prompt and multi-agent installer for terse AI-agent output. It does not change tools, code, reasoning, or safety behavior — only prose shape. The prompt is 1,336 bytes; `/tldr` re-applies rules mid-session; the full installer wires Claude hooks, opencode plugin support, Gemini/Codex/Cursor/etc. Benchmarks and methodology are in-repo. https://github.com/jqbit/TLDR

### Show HN title

> Show HN: TLDR – make AI coding agents answer with less filler

### Show HN body

> I built TLDR, a compact prompt and installer that makes AI coding agents answer verdict-first and cut filler without changing tool use/code/safety behavior.
>
> It works as a prompt-only install or a full multi-agent installer for Claude Code, Codex, Gemini, Cursor, opencode, and other agent CLIs/editors. The core prompt is 1,336 bytes and easy to audit.
>
> Repo includes benchmarks, methodology, Claude hooks/statusline, opencode plugin support, and optional MCP description shrink.
>
> Curious whether others prefer terse default agents or explicit verbosity controls per task.

## Demo script

Record a 20–30s terminal clip:

```bash
# baseline: verbose answer
claude "Explain why this React component rerenders"

# after TLDR install / activation
npx -y github:jqbit/TLDR -- --all
claude "/tldr ultra"
claude "Explain why this React component rerenders"
```

Overlay text:

1. “Same fix.”
2. “Less filler.”
3. “Works across 30+ agents.”
4. “Verdict first. Filler never.”

## GitHub metadata

Recommended repo description:

> Verdict-first output for AI coding agents. Tiny prompt + installer for Claude Code, Codex, Gemini, Cursor, opencode, and 30+ agents.

Recommended topics:

- `ai-agents`
- `llm`
- `prompt-engineering`
- `claude-code`
- `codex`
- `gemini`
- `cursor`
- `opencode`
- `developer-tools`
- `token-optimization`
- `agent-tools`
- `system-prompt`

## Release checklist

1. Verify main is green.
2. Create release notes with install commands and screenshots/social preview.
3. Update GitHub description/topics/homepage.
4. Pin the release.
5. Post once per channel, adapted to context.
6. Reply to comments with details, not sales copy.
7. Open issues for real feedback; label `good first issue` where possible.

## Anti-spam rules

- No automated posting.
- No unsolicited DMs.
- No fake accounts/stars/comments.
- No reposting identical copy across communities.
- No benchmarks beyond measured data.
- Always disclose maintainer affiliation.

## Success metrics

Track weekly:

- Stars / forks / watchers.
- Clone traffic.
- Referrers.
- Issues opened by real users.
- Installer failures by platform.
- PRs/contributors.
- Benchmark reproduction reports.

Use `gh repo view`, GitHub Insights, and release/download stats. Double down on channels producing real issues/PRs, not vanity traffic.
