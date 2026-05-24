---
name: Agent compatibility report
about: Report whether TLDR.md works on a specific AI app/agent
title: "[agent] <agent-name> — <works|partial|broken>"
labels: agent-compatibility
assignees: ''
---

## Agent

- **Name + version**: e.g. `claude` 2.1.110 / `cursor-agent` 2026.04.15
- **Provider/model**: e.g. Anthropic Opus 4.6 / OpenAI gpt-5.4
- **Global instruction file path**: e.g. `~/.claude/CLAUDE.md`
- **Prompt deployed**: `TLDR.md`, version/commit:

## Result

- [ ] Works as expected (responses are noticeably terser, no preamble bloat)
- [ ] Partial — see notes
- [ ] Broken — see notes

## Smoke test output

Paste the response to:

```
What's the git command to undo the last commit but keep changes staged?
```

Expected: a single line, just the command.

```
<paste your agent's response here>
```

## Notes

- Anything weird? CLI emits extra metadata? Agent ignores certain rules?
- If proposing rule additions, list them here.
