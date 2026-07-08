#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
README = ROOT / "README.md"
AGENT_LOCATIONS = ROOT / "data" / "agent-locations.md"
TLDR = ROOT / "TLDR.md"
COMMAND = ROOT / "commands" / "tldr.md"
INSTALL = ROOT / "install.sh"
BENCH = ROOT / "bench" / "v0.14-bench.sh"
CITATION = ROOT / ".github" / "CITATION.cff"
OLD_CITATION = ROOT / "data" / "citations.cff"
IDEA_TEMPLATE = ROOT / ".github" / "ISSUE_TEMPLATE" / "idea.yml"
LEGACY_IDEA_TEMPLATE = ROOT / ".github" / "ISSUE_TEMPLATE" / "idea.md"


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def expect_contains(text: str, needle: str, label: str) -> None:
    if needle not in text:
        fail(f"{label} missing: {needle}")


readme = README.read_text(encoding="utf-8")
agent_locations = AGENT_LOCATIONS.read_text(encoding="utf-8")
prompt = TLDR.read_text(encoding="utf-8")
command = COMMAND.read_text(encoding="utf-8")
bench = BENCH.read_text(encoding="utf-8")
citation = CITATION.read_text(encoding="utf-8")
idea_template = IDEA_TEMPLATE.read_text(encoding="utf-8")

# Prompt invariants reflected in shipped prompt file.
for needle in [
    "## Hard caps",
    "Default: 1 sentence.",
    "Default target: 3 words.",
    "Default maximum: 6 words.",
    "Greeting → 1 word.",
    "Prose only. Tools, code, logic, reasoning, safety unchanged.",
]:
    expect_contains(prompt, needle, "TLDR.md")

# Command file must carry core defaults for nudge independence.
for needle in [
    "Default: 1 sentence.",
    "Default target: 3 words.",
    "Default maximum: 6 words.",
    "Greeting → 1 word.",
]:
    expect_contains(command, needle, "commands/tldr.md")

expected_row = f"| [`TLDR.md`](TLDR.md) | {TLDR.stat().st_size:,} |"
expect_contains(readme, expected_row, "README byte table")
expected_cmd_row = f"| [`commands/tldr.md`](commands/tldr.md) | {COMMAND.stat().st_size:,} |"
expect_contains(readme, expected_cmd_row, "README byte table")

# README must document install and defaults.
expect_contains(readme, "install.sh | bash -s --", "README one-line install")
expect_contains(readme, "--with-hermes", "README one-line install")
expected_size_text = f"[`TLDR.md`](TLDR.md) is the active prompt ({TLDR.stat().st_size:,} bytes)."
expect_contains(readme, expected_size_text, "README active prompt size")
for needle in [
    "- default: 1 sentence",
    "- target: 3 words",
    "- default max: 6 words",
    "- one-word greeting for plain greetings",
    "- `/tldr` (supported agents) re-applies rules live in long sessions",
]:
    expect_contains(readme, needle, "README current defaults")

# One-line install docs in agent-locations.
expect_contains(agent_locations, "install.sh | bash -s --", "agent-locations one-line install")
expect_contains(agent_locations, "--with-hermes", "agent-locations one-line install")

# Hermes row must point to SOUL.md and verification command must be marker-based.
hermes_row = next(
    (line for line in agent_locations.splitlines() if re.search(r"\|\s*8\s*\|\s*hermes\b", line)),
    None,
)
if hermes_row is None:
    fail("Hermes row missing from data/agent-locations.md")
if "~/.hermes/SOUL.md" not in hermes_row:
    fail("Hermes row does not point to ~/.hermes/SOUL.md")
if "MEMORY.md" in hermes_row:
    fail("Hermes row still points to MEMORY.md")

expect_contains(
    agent_locations,
    'grep -q "^## Prime directive" ~/.hermes/SOUL.md',
    "Hermes verification command",
)

if not INSTALL.exists():
    fail("install.sh missing from repo root")

if not COMMAND.exists():
    fail("commands/tldr.md missing from repo root")

for needle in [
    'ROOT=${TLDR_BENCH_DIR:-"$HOME/bench-v14"}',
    '[opencode]="$HOME/.config/opencode/AGENTS.md"',
    '[gemini]="$HOME/.gemini/AGENTS.md"',
]:
    expect_contains(bench, needle, "bench/v0.14-bench.sh")

if OLD_CITATION.exists():
    fail("data/citations.cff should be .github/CITATION.cff for citation tooling")

expect_contains(citation, 'url: "https://github.com/ZeroPointNineBar/TLDR"', ".github/CITATION.cff repository URL")
expect_contains(citation, 'repository-code: "https://github.com/ZeroPointNineBar/TLDR"', ".github/CITATION.cff repository URL")
if "https://github.com/ZeroPointNineBar/TLDR.md" in citation:
    fail(".github/CITATION.cff still references non-existent ZeroPointNineBar/TLDR.md repository")

if LEGACY_IDEA_TEMPLATE.exists():
    fail("legacy .github/ISSUE_TEMPLATE/idea.md should stay removed; use idea.yml")
if not IDEA_TEMPLATE.exists():
    fail(".github/ISSUE_TEMPLATE/idea.yml missing")

if "BENCHMARKS.md" in idea_template:
    fail(".github/ISSUE_TEMPLATE/idea.yml references non-existent BENCHMARKS.md")

print("OK: docs and prompt metadata are in sync")
