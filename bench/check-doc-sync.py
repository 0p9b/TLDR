#!/usr/bin/env python3
from pathlib import Path
import re
import sys

ROOT = Path(__file__).resolve().parents[1]
README = ROOT / "README.md"
AGENT_LOCATIONS = ROOT / "data" / "agent-locations.md"
TLDR = ROOT / "TLDR.md"
BLUNT = ROOT / "TLDR.blunt.md"
INSTALL = ROOT / "install.sh"


def fail(msg: str) -> None:
    print(f"FAIL: {msg}")
    sys.exit(1)


def expect_contains(text: str, needle: str, label: str) -> None:
    if needle not in text:
        fail(f"{label} missing: {needle}")


readme = README.read_text(encoding="utf-8")
agent_locations = AGENT_LOCATIONS.read_text(encoding="utf-8")
tldr = TLDR.read_text(encoding="utf-8")
blunt = BLUNT.read_text(encoding="utf-8")

# Prompt invariants reflected in shipped prompt files.
for name, text in [("TLDR.md", tldr), ("TLDR.blunt.md", blunt)]:
    expect_contains(text, "target 3 words", f"{name}")
    expect_contains(text, "maximum: 6 words", f"{name}")
    expect_contains(text, "Greet → 1 word", f"{name}")

# README byte-count table must match current prompt files.
expected_tldr = f"| [`TLDR.md`](TLDR.md) | {TLDR.stat().st_size:,} |"
expected_blunt = f"| [`TLDR.blunt.md`](TLDR.blunt.md) | {BLUNT.stat().st_size:,} |"
expect_contains(readme, expected_tldr, "README byte table")
expect_contains(readme, expected_blunt, "README byte table")

# README must document the current default behavior.
for needle in [
    "- default: 1 sentence",
    "- target: 3 words",
    "- 1 word when sufficient",
    "- default max: 6 words",
    "- longer only if asked",
    "- greet: 1 word",
]:
    expect_contains(readme, needle, "README current defaults")

# One-line install docs must point at the shipped installer.
if not INSTALL.exists():
    fail("install.sh missing from repo root")
for text, label in [
    (readme, "README one-line install"),
    (agent_locations, "agent-locations one-line install"),
]:
    expect_contains(text, "install.sh | bash -s -- regular", label)
    expect_contains(text, "install.sh | bash -s -- blunt", label)
    expect_contains(text, "--with-hermes", label)

# Hermes docs must point to SOUL.md and use a merge-safe verification marker.
hermes_row = next(
    (
        line
        for line in agent_locations.splitlines()
        if re.search(r"^\|\s*\d+\s*\|\s*hermes\b", line)
    ),
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
    'grep -q "target 3 words" ~/.hermes/SOUL.md',
    "Hermes verification command",
)

print("OK: docs and prompt metadata are in sync")
