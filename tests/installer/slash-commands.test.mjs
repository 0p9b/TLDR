// Slash-command registration contract for commands/*.
//
// Claude Code resolves a slash command by scanning commands/*.md (YAML
// frontmatter) BEFORE the UserPromptSubmit hook ever sees the prompt — it
// ignores commands/*.toml entirely (TOML is the Gemini extension format).
// TLDR ships exactly one command, /tldr (level switch via /tldr <arg>), so it
// MUST ship BOTH formats:
//   commands/tldr.md    — Claude Code plugin command
//   commands/tldr.toml  — Gemini CLI extension command

import { test } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(HERE, '..', '..');
const COMMANDS_DIR = path.join(REPO_ROOT, 'commands');

test('commands/ ships exactly tldr.md and tldr.toml', () => {
  assert.deepEqual(fs.readdirSync(COMMANDS_DIR).sort(), ['tldr.md', 'tldr.toml']);
});

test('commands/tldr.md has YAML frontmatter with a non-empty description', () => {
  const body = fs.readFileSync(path.join(COMMANDS_DIR, 'tldr.md'), 'utf8');
  assert.ok(body.startsWith('---\n'), 'tldr.md must start with YAML frontmatter (---)');
  const fm = body.match(/^---\n([\s\S]*?)\n---/);
  assert.ok(fm, 'tldr.md frontmatter must be closed with ---');
  const desc = fm[1].match(/^description:\s*(.+)$/m);
  assert.ok(desc && desc[1].trim().length > 0, 'tldr.md must declare a non-empty description');
});

test('commands/tldr.toml declares a description and prompt for Gemini', () => {
  const body = fs.readFileSync(path.join(COMMANDS_DIR, 'tldr.toml'), 'utf8');
  assert.match(body, /^\s*description\s*=\s*"[^"\n]+"/m);
  assert.match(body, /^\s*prompt\s*=\s*"[^"\n]+"/m);
});

test('command .md body uses $ARGUMENTS, never the TOML {{args}} placeholder', () => {
  const body = fs.readFileSync(path.join(COMMANDS_DIR, 'tldr.md'), 'utf8');
  assert.ok(!body.includes('{{args}}'), 'commands/tldr.md contains {{args}}; Claude Code substitutes $ARGUMENTS.');
});
