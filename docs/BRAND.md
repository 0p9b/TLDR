# TLDR brand (shareable repo)

## Mascot: **owl + scroll + scissors + sticky** (`docs/assets/tldr-mascot.jpg`)

Canonical hero art: skeptical owl in the text scroll, scissors ready, sticky **TL;DR / Verdict first.**

- **Cast:** owl = wise brevity; scroll = agent wall-of-text; scissors = cut filler; note = output.
- **Screenshot unit:** mascot + tagline + badges (viral-repo-playbook).
- **Legacy:** `tldr-mark.svg` (minimal icon); `dancing-rock.svg` (lineage / attribution era only).

## Tagline

**Primary:** *Verdict first. Filler never.*

**Alt (more viral / caveman-adjacent):** *Why read many word when few word say same?*

## Layout (reference repos)

| Pattern | caveman | ponytail | TLDR |
|---------|---------|----------|------|
| Hero image | 🪨 rock emoji / dancing-rock | `assets/logo.png` full width | `docs/assets/tldr-mascot.jpg` |
| Title | `caveman` | `Ponytail` | `TLDR` |
| Tagline | under title, centered | italic one-liner | centered strong |
| Proof | ASCII meter + benchmarks/ | % table + reproduce | bench script + `data/benchmarks.md` |
| Install | one-line curl | marketplace + npx | `install.sh` + `npx github:jqbit/TLDR` |

## Optional upgrades

- Animated GIF: terminal before/after (`/tldr` toggle) in README.
- `social-preview.png` (1280×640): mark + tagline for Open Graph (GitHub settings).
- Favicon: export 32px PNG from `tldr-mark.svg` for `docs/` or GitHub Pages.

## Do not

- Reuse caveman rock as primary mark (different product; attribution only).
- Copy ponytail mascot (different pain: LOC bloat vs prose tokens).