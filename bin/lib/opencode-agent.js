'use strict';

// Strip Claude-Code-style `tools:` frontmatter from subagents before copying
// them into opencode. Claude accepts YAML arrays (`tools: [Read, Grep, Bash]`),
// but opencode expects a map or no field. Omitting the field preserves default
// opencode tools while the agent prompt body still self-restricts behavior.

const TOOLS_FIELD_RE = /^tools[ \t]*:/;
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
    if (TOOLS_FIELD_RE.test(line)) { dropping = true; continue; }
    out.push(line);
  }

  return FRONTMATTER_FENCE + out.join('\n') + rest;
}

module.exports = { stripOpencodeAgentTools };
