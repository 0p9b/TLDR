#!/usr/bin/env python3
from __future__ import annotations

from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
README = ROOT / "README.md"
AGENT_LOCATIONS = ROOT / "data" / "agent-locations.md"
TLDR = ROOT / "TLDR.md"
INSTALL = ROOT / "install.sh"


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def expect_contains(text: str, needle: str, label: str) -> None:
    if needle not in text:
        fail(f"{label} missing: {needle}")


readme = README.read_text(encoding="utf-8")
agent_locations = AGENT_LOCATIONS.read_text(encoding="utf-8")
prompt = TLDR.read_text(encoding="utf-8")

# Prompt invariants reflected in shipped prompt file.
for needle in [
    "## Hard caps",
    "Default: 1 sentence.",
    "Default target: 3 words.",
    "Default maximum: 6 words.",
    "Prose only. Tools, code, logic, reasoning, safety unchanged.",
]:
    expect_contains(prompt, needle, "TLDR.md")

expected_row = f"| [`TLDR.md`](TLDR.md) | {TLDR.stat().st_size:,} |"
expect_contains(readme, expected_row, "README byte table")

# README must document install and defaults.
expect_contains(readme, "install.sh | bash -s --", "README one-line install")
expect_contains(readme, "--with-hermes", "README one-line install")
for needle in [
    "- default: 1 sentence",
    "- target: 3 words",
    "- default max: 6 words",
    "- one-word greeting for plain greetings",
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

print("OK: docs and prompt metadata are in sync")
