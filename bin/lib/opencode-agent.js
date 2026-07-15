'use strict';

// Strip Claude-Code-only frontmatter from subagents before copying them into
// opencode. Two Claude-isms break opencode, so both are dropped:
//   • `tools: [Read, Grep, Bash]` — Claude accepts the YAML array, but opencode
//     wants a map or no field and rejects the array (one bad file invalidates
//     the whole opencode config, so nothing loads).
//   • `model: haiku` — an Anthropic alias. When opencode has no Anthropic
//     provider authed, spawning the subagent fails with "Model not found:
//     haiku/." (confirmed at runtime). Dropping it lets the subagent inherit
//     opencode's default model and spawn.
// Omitting both preserves opencode's defaults while the agent prompt body still
// self-restricts behavior.

const DROP_FIELD_RE = /^(tools|model)[ \t]*:/;
const CONTINUATION_RE = /^[ \t]/;
const FRONTMATTER_FENCE = '---\n';

function stripOpencodeAgentTools(content) {
  if (typeof content !== 'string' || !content.startsWith(FRONTMATTER_FENCE)) return content;
  const fmEnd = content.indexOf('\n---', FRONTMATTER_FENCE.length);
  if (fmEnd < 0) return content;

  const fm = content.slice(FRONTMATTER_FENCE.length, fmEnd);
  const rest = content.slice(fmEnd);

  const out = [];
  let dropping = false;
  for (const line of fm.split('\n')) {
    if (dropping) {
      if (CONTINUATION_RE.test(line)) continue;
      dropping = false;
    }
    if (DROP_FIELD_RE.test(line)) { dropping = true; continue; }
    out.push(line);
  }

  return FRONTMATTER_FENCE + out.join('\n') + rest;
}

module.exports = { stripOpencodeAgentTools };
