#!/usr/bin/env python3
"""One-shot import: TLDR platform → TLDR repo with rebrand. Run from TLDR root."""
from __future__ import annotations

import os
import re
import shutil
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
TLDR = Path("/home/user/tldr")
CAVEMAN = Path("/home/user/caveman")

# Paths to copy from TLDR (relative). TLDR-specific dirs NOT overwritten.
COPY_DIRS = [
    "bin",
    "src",
    "agents",
    "commands",
    "plugins",
    "skills",
    "tests",
    "evals",
    "benchmarks",
    "dist",
    "docs",
    ".claude-plugin",
    ".codex",
    ".agents",
    "gemini-extension.json",
    "GEMINI.md",

    "install.ps1",
    "package.json",
    "skills-lock.json",
    "CLAUDE.md",
    "AGENTS.md",

]

SKIP_NAMES = {".git", "node_modules", "__pycache__"}

# Directory renames after copy (old_suffix paths under ROOT)
DIR_RENAMES = [
    ("skills/tldr", "skills/tldr"),
    ("skills/tldr-commit", "skills/tldr-commit"),
    ("skills/tldr-review", "skills/tldr-review"),
    ("skills/tldr-compress", "skills/tldr-compress"),
    ("skills/tldr-stats", "skills/tldr-stats"),
    ("skills/tldr-help", "skills/tldr-help"),
    ("skills/tldrcrew", "skills/tldrcrew"),
    ("plugins/tldr", "plugins/tldr"),
    ("src/mcp-servers/tldr-shrink", "src/mcp-servers/tldr-shrink"),
    ("src/plugins/tldr-opencode", "src/plugins/tldr-opencode"),
    ("tests/tldr-compress", "tests/tldr-compress"),
    ("dist/tldr.skill", "dist/tldr.skill"),
]

REPLACEMENTS = [
    ("jqbit/TLDR", "jqbit/TLDR"),
    ("github.com/jqbit/TLDR", "github.com/jqbit/TLDR"),
    ("raw.githubusercontent.com/jqbit/TLDR", "raw.githubusercontent.com/jqbit/TLDR"),
    ("tldr-shrink", "tldr-shrink"),
    ("tldrcrew", "tldrcrew"),
    ("tldr-compress", "tldr-compress"),
    ("tldr-commit", "tldr-commit"),
    ("tldr-review", "tldr-review"),
    ("tldr-stats", "tldr-stats"),
    ("tldr-help", "tldr-help"),
    ("tldr-opencode", "tldr-opencode"),
    (".tldr-active", ".tldr-active"),
    ("tldr-activate", "tldr-activate"),
    ("tldr-mode-tracker", "tldr-mode-tracker"),
    ("tldr-init", "tldr-init"),
    ("tldr_mode", "tldr_mode"),
    ("tldr mode", "tldr mode"),
    ("TLDR style", "TLDR style"),
    ("stop tldr", "stop tldr"),
    ("/tldr", "/tldr"),
    ("plugins/tldr", "plugins/tldr"),
    ("skills/tldr", "skills/tldr"),
    ("name: tldr", "name: tldr"),
    ("tldr-installer", "tldr-installer"),
    ("dist/tldr.skill", "dist/tldr.skill"),
    ("# Security Model — TLDR", "# Security Model — TLDR"),
    ("Security Model — TLDR", "Security Model — TLDR"),
    (" — terse output enforcer", " — terse output enforcer"),
    ("TLDR installer", "TLDR installer"),
    ("installs TLDR", "installs TLDR"),
    ("\"blunt\":", "\"tldr\":"),
    ("'tldr':", "'tldr':"),
    (" TLDR ", " TLDR "),
    (" blunt\n", " TLDR\n"),
    (" TLDR.", " TLDR."),
    (" TLDR,", " TLDR,"),
    (" blunt\"", " TLDR\""),
    (" TLDR'", " TLDR'"),
    (" TLDR)", " TLDR)"),
    (" tldr-", " tldr-"),
    ("TLDR ", "TLDR "),
    ("TLDR", "TLDR"),
]

TEXT_EXTENSIONS = {
    ".md", ".js", ".mjs", ".json", ".toml", ".yml", ".yaml", ".py", ".sh", ".ps1",
    ".html", ".css", ".txt", ".skill", ".cff",
}


def should_transform(path: Path) -> bool:
    if path.suffix.lower() in TEXT_EXTENSIONS:
        return True
    if path.name in ("install.sh", "LICENSE", "AGENTS.md", "CLAUDE.md"):
        return True
    return False


def transform_text(content: str, rel: str) -> str:
    # Preserve historical data/ unless explicitly updating
    if rel.startswith("data/"):
        return content
    for old, new in REPLACEMENTS:
        content = content.replace(old, new)
    # Filename-specific: TLDR.toml → already renamed on disk
    return content


def copy_item(src: Path, dest: Path) -> None:
    if src.is_dir():
        if dest.exists():
            shutil.rmtree(dest)
        shutil.copytree(src, dest, ignore=shutil.ignore_patterns(*SKIP_NAMES))
    else:
        dest.parent.mkdir(parents=True, exist_ok=True)
        shutil.copy2(src, dest)


def rename_paths() -> None:
    for old, new in DIR_RENAMES:
        o, n = ROOT / old, ROOT / new
        if o.exists():
            n.parent.mkdir(parents=True, exist_ok=True)
            if n.exists():
                shutil.rmtree(n) if n.is_dir() else n.unlink()
            o.rename(n)


def rename_files() -> None:
    renames = [
        ("commands/tldr.toml", "commands/tldr-full.toml"),
        ("commands/tldr-commit.toml", "commands/tldr-commit.toml"),
        ("commands/tldr-review.toml", "commands/tldr-review.toml"),
        ("commands/tldr-init.toml", "commands/tldr-init.toml"),
        ("agents/tldrcrew-investigator.md", "agents/tldrcrew-investigator.md"),
        ("agents/tldrcrew-builder.md", "agents/tldrcrew-builder.md"),
        ("agents/tldrcrew-reviewer.md", "agents/tldrcrew-reviewer.md"),
        ("tests/test_blunt_init.js", "tests/test_tldr_init.js"),
        ("tests/test_blunt_stats.js", "tests/test_tldr_stats.js"),
    ]
    for old, new in renames:
        o, n = ROOT / old, ROOT / new
        if o.exists() and not n.exists():
            n.parent.mkdir(parents=True, exist_ok=True)
            o.rename(n)


def walk_transform() -> None:
    for path in list(ROOT.rglob("*")):
        if not path.is_file() or ".git" in path.parts:
            continue
        rel = str(path.relative_to(ROOT))
        if not should_transform(path):
            continue
        try:
            text = path.read_text(encoding="utf-8")
        except UnicodeDecodeError:
            continue
        new = transform_text(text, rel)
        if new != text:
            path.write_text(new, encoding="utf-8")


def cherry_pick_caveman() -> None:
    picks = [
        ("tests/test_repo_local_config.js", "tests/test_repo_local_config.js"),
    ]
    for rel_src, rel_dest in picks:
        src = CAVEMAN / rel_src
        dest = ROOT / rel_dest
        if not src.exists():
            continue
        if dest.exists():
            continue
        dest.parent.mkdir(parents=True, exist_ok=True)
        text = src.read_text(encoding="utf-8")
        for old, new in REPLACEMENTS:
            text = text.replace(old, new)
        text = text.replace("caveman", "tldr").replace("Caveman", "TLDR")
        dest.write_text(text, encoding="utf-8")
        print(f"cherry-pick: {rel_dest}")


def write_attribution() -> None:
    path = ROOT / "docs" / "legal" / "ATTRIBUTION.md"
    path.parent.mkdir(parents=True, exist_ok=True)
    if path.exists():
        return
    path.write_text(
        """# Attribution

**TLDR** is an independent product maintained by [jqbit](https://github.com/jqbit).

## Third-party lineage (MIT)

Portions of the multi-agent installer, skills layout, hooks, and evaluation harness derive from:

- **[caveman](https://github.com/JuliusBrussee/caveman)** by Julius Brussee — MIT License.
- **blunt** (jqbit private fork) — MIT License; rebranded and merged into this repository.

This project is **not** affiliated with, endorsed by, or maintained by Julius Brussee or the caveman project. No caveman trademarks or persona are used in the shipped product.

See `LICENSE` for the license governing this repository.
""",
        encoding="utf-8",
    )


def main() -> None:
    assert TLDR.is_dir(), f"missing {TLDR}"
    for item in COPY_DIRS:
        src = TLDR / item
        if not src.exists():
            print(f"skip missing: {item}")
            continue
        dest = ROOT / item
        print(f"copy: {item}")
        copy_item(src, dest)

    # TLDR install.sh overwrites TLDR install.sh — restore Hermes logic by keeping TLDR's
    # User: merge install paths — copy TLDR install.sh to install-full.sh
    blunt_install = TLDR / "install.sh"
    if blunt_install.exists():
        shutil.copy2(blunt_install, ROOT / "install-full.sh")
        # Re-apply transforms on install-full.sh only; keep original install.sh from TLDR

    rename_paths()
    rename_files()
    walk_transform()
    cherry_pick_caveman()
    write_attribution()

    # Transform install-full.sh
    p = ROOT / "install-full.sh"
    if p.exists():
        t = transform_text(p.read_text(encoding="utf-8"), "install-full.sh")
        p.write_text(t, encoding="utf-8")

    print("merge_import.py done.")


if __name__ == "__main__":
    main()