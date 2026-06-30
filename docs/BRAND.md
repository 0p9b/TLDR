# TLDR brand (shareable repo)

## Mascot: **folded summary page** (`docs/assets/tldr-mark.svg`)

- **Reads in 0.5s:** long page → dog-eared corner → one bold line (verdict).
- **Professional, not parody:** line-art document vs caveman's rock / ponytail's face.
- **Screenshot unit:** center mark + tagline + badge row (per [[viral-repo-playbook]]).

## Tagline

**Primary:** *Verdict first. Filler never.*

**Alt (more viral / caveman-adjacent):** *Why read many word when few word say same?*

## Layout (reference repos)

| Pattern | caveman | ponytail | TLDR |
|---------|---------|----------|------|
| Hero image | 🪨 rock emoji / dancing-rock | `assets/logo.png` full width | `tldr-mark.svg` centered |
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