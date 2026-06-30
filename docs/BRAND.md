# TLDR brand (shareable repo)

## Mascot: **owl + scroll + scissors + sticky** (`docs/assets/tldr-mascot.png`)

Canonical hero art (transparent PNG, README width 120px like caveman/ponytail): skeptical owl in the text scroll, scissors ready, sticky **TL;DR / Verdict first.**

- **Raster:** `tldr-mascot.png` (transparent); `tldr-mascot.jpg` (archival full bleed).

- **Cast:** owl = wise brevity; scroll = agent wall-of-text; scissors = cut filler; note = output.
- **Screenshot unit:** mascot + tagline + badges (viral-repo-playbook).
- **Legacy:** `tldr-mark.svg` (minimal icon); `dancing-rock.svg` (lineage / attribution era only).

## Tagline

**Primary:** *Verdict first. Filler never.*

**Alt (more viral / caveman-adjacent):** *Why read many word when few word say same?*

## Layout (reference repos)

| Pattern | caveman | ponytail | TLDR |
|---------|---------|----------|------|
| Hero image | 🪨 rock emoji / dancing-rock | `assets/logo.png` full width | `docs/assets/tldr-mascot.png` @ 120px, transparent |
| Title | `caveman` | `Ponytail` | `TLDR` |
| Tagline | under title, centered | italic one-liner | centered strong |
| Proof | ASCII meter + benchmarks/ | % table + reproduce | bench script + `data/benchmarks.md` |
| Install | one-line curl | marketplace + npx | `install.sh` + `npx github:jqbit/TLDR` |

## Optional upgrades

- Animated GIF: terminal before/after (`/tldr` toggle) in README.
- **GitHub social preview:** upload `docs/assets/social-preview.png` (1280×640) under repo **Settings → General → Social preview**.
- **Favicons:** `favicon-32.png`, `apple-touch-icon.png`, `android-chrome-192.png` (cropped from mascot owl).
- **Vector:** `tldr-mascot.svg` for crisp scaling; **README uses** `tldr-mascot.png` (transparent).

## Asset map

| File | Use |
|------|-----|
| `tldr-mascot.png` | README hero (transparent, display at 120px) |
| `tldr-mascot.jpg` | Archival raster (opaque bg) |
| `tldr-mascot.svg` | Scalable brand / favicon fallback |
| `social-preview.png` | GitHub OG / X link card |
| `favicon-32.png` | Browser tab / docs site |
| `apple-touch-icon.png` | iOS bookmark |
| `tldr-mark.svg` | Legacy minimal mark |

## Do not

- Reuse caveman rock as primary mark (different product; attribution only).
- Copy ponytail mascot (different pain: LOC bloat vs prose tokens).