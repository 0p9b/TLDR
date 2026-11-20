# Graph Report - TLDR  (2026-11-19)

## Corpus Check
- 147 files · ~108,943 words
- Verdict: corpus is large enough that graph structure adds value.
- Unclassified: 15 file(s) not represented in the graph (top: (none) 8, .toml 2, .woff2 2)

## Summary
- 1032 nodes · 1783 edges · 91 communities (69 shown, 22 thin omitted)
- Extraction: 91% EXTRACTED · 9% INFERRED · 0% AMBIGUOUS · INFERRED: 153 edges (avg confidence: 0.83)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- Landing Page UI
- Token Cost & Inspirations
- Installer CLI Core
- OpenCode & Hook Install
- Self-Update Flow
- JSONC Patch Engine
- CI Workflow
- Test Harness Core
- Eval Scoring Harness
- Prompt Version History
- Package Manifest
- Install Manifests & Tests
- Repo Verification Checks
- Extension & Fenced Count
- OpenClaw Installer
- End-to-End Install Tests
- Mode Tracker Tests
- Cross-Model Holdout Runner
- Evaluation Methodology Lessons
- Hook Script Tests
- Config File Handling
- Mode Flag Tracker
- Fresh Install Tests
- Eval Design Decisions
- Claude & Gemini Install
- Install IO Abstractions
- Bug Report Template
- Idea Issue Template
- Shell Installer
- Installer Acid Tests
- Skill & Command Docs
- Activation Script Tests
- Cross-Model Analysis
- Mode Switch Tests
- OpenCode Install Tests
- Agent Hook Providers
- Fenced Block Ruleset
- Hermes Installer
- Native Agent Install
- Benchmark Visualizations
- Agent Hook Tests
- Doc Sync & Link Checks
- Native Install Tests
- DSPy Claude LM Shim
- Rules File Tests
- Stdin Hook Tests
- JSONC Native Tests
- Installer Architecture
- Dependabot Config
- OpenCode Plugin Runtime
- Hermes Install Tests
- OpenCode JSONC Tests
- Claude Plugin Manifest
- Core Prompt Rules
- Token Measurement Script
- Pi Extension Package
- Safe Filesystem Guards
- Prompt Evolution Notes
- Brand Marks SVG
- Skill Instructions Loader
- Codex Directory Manifest
- Symlink Flag Tests
- OpenCode Package
- Update Flow Tests
- Repo Config Tests
- Installer Module Docs
- LLM Eval Runner
- Harness Ceiling Findings
- Levels & OpenCode Docs
- Checksum Download Verify
- Brand Raster Assets
- Brevity Research Citations
- Bench Suite Design
- Favicon Icon Set
- Landing A11y & Motion
- Bluntness Variant Rules
- Checksummed Install Script
- Eval Metric Tradeoffs
- CoT Citations
- Dep: install-full.sh
- Dep: hooks/install.sh
- Dep: hooks/package.json
- Dep: tldr-statusline.sh
- Dep: uninstall.sh
- Dep: dancing-rock-32.png
- Expansion On Request

## God Nodes (most connected - your core abstractions)
1. `main()` - 26 edges
2. `uninstall()` - 21 edges
3. `ModeTrackerTests` - 17 edges
4. `runUpdate()` - 14 edges
5. `gitOk()` - 13 edges
6. `installHooks()` - 12 edges
7. `TLDR Skill Definition (SKILL.md)` - 12 edges
8. `patchJsonc()` - 11 edges
9. `realIO()` - 10 edges
10. `stripJsonComments()` - 10 edges

## Surprising Connections (you probably didn't know these)
- `opencode /tldr Command Template` --semantically_similar_to--> `/tldr Slash Command`  [INFERRED] [semantically similar]
  src/plugins/tldr-opencode/commands/tldr.md → commands/tldr.md
- `Be Direct, Respectful, Useful` --semantically_similar_to--> `Bluntness Rule`  [INFERRED] [semantically similar]
  .github/CODE_OF_CONDUCT.md → TLDR.md
- `Output-style instruction only` --semantically_similar_to--> `Output-side compression thesis`  [INFERRED] [semantically similar]
  docs/HONEST-NUMBERS.md → data/philosophy.md
- `caveman MIT lineage` --semantically_similar_to--> `caveman (Brussee) inspiration`  [INFERRED] [semantically similar]
  docs/legal/ATTRIBUTION.md → data/philosophy.md
- `Unified Node installer` --semantically_similar_to--> `Agent deployment file paths`  [INFERRED] [semantically similar]
  docs/INSTALL.md → data/agent-locations.md

## Import Cycles
- None detected.

## Hyperedges (group relationships)
- **TLDR Footer Spec Repeated Across Distribution Artifacts** — tldr_footer, commands_tldr_slash_command, src_rules_tldr_activate_always_on_ruleset, src_rules_tldr_openclaw_bootstrap_bootstrap_block [EXTRACTED 1.00]
- **Mode Flag File Bridge Across Hooks and Plugins** — src_hooks_readme_session_start_hook, src_hooks_readme_mode_tracker_hook, src_hooks_readme_statusline_badge, src_plugins_tldr_opencode_readme_native_plugin [EXTRACTED 1.00]
- **Measurement-Honesty Discipline Across Bench and Evals** — evals_readme_no_snapshot_provenance_policy, evals_readme_measurement_limits, bench_dspy_readme_manual_copro_rationale, readme_before_after_benchmark [INFERRED 0.75]
- **Variance-shrinkage mechanism bundle** — data_changelog_hard_response_templates, data_changelog_per_prompt_shape_token_budget, data_changelog_anti_helpfulness_rule, data_changelog_variance_shrinkage, data_progression_variance_shrinkage [INFERRED 0.85]
- **Prose-token measurement pipeline** — data_progression_frozen_bench_suite, data_methodology_prose_only_count, data_philosophy_prose_tokens_outside_code_blocks, data_progression_strict_all_trials_pass, data_methodology_trial_structure [INFERRED 0.85]
- **Cross-harness deployment surface stack** — data_agent_locations_deployment_paths, docs_install_unified_node_installer, docs_install_always_on_rules, docs_install_claude_hooks_statusline, docs_install_windows_marketplace_manual [INFERRED 0.75]
- **TLDR Prompt Compression Rule Set** — docs_index_hard_caps, docs_index_answer_shapes, docs_index_auto_clarity_exemption, docs_index_code_never_compressed, docs_index_style_not_language [EXTRACTED 1.00]
- **Install Path Matrix (four routes)** — docs_index_install_section, docs_index_full_installer_path, docs_index_prompt_only_install, docs_index_claude_plugin_install, docs_index_windows_install [EXTRACTED 1.00]
- **Honest Benchmark Framing (measure, caveat, win/lose)** — docs_index_numbers_section, docs_index_historical_benchmark_caveat, docs_index_prose_reduction_bars, docs_index_where_tldr_wins, docs_index_where_tldr_loses [INFERRED 0.75]
- **v0.14 harness comparison views (compliance matrix + baseline/TLDR token pairs)** — data_visualizations_compliance_heatmap_harness_matrix, data_visualizations_compliance_heatmap_cell_status_legend, data_visualizations_reduction_per_harness_baseline_vs_tldr_series, data_visualizations_reduction_per_harness_negative_reduction_harnesses [INFERRED 0.85]
- **TLDR brand-mark family (folded page, owl mascot, legacy pixel rock, circular badge)** — docs_assets_tldr_mark_folded_page_mark, docs_assets_tldr_mascot_owl_mascot, docs_assets_dancing_rock_legacy_pixel_rock, skills_tldr_assets_tldr_small_tl_circle_badge, skills_tldr_assets_tldr_owl_mascot [INFERRED 0.85]
- **Per-version metric series tracking TLDR.md shrinkage (char count vs mean reduction)** — data_visualizations_char_count_delta_char_count_series, data_visualizations_progression_mean_reduction_series, data_visualizations_progression_v014_outlier [INFERRED 0.75]
- **TLDR Owl Mascot Brand Identity System** — docs_assets_tldr_mascot_owl_cutting_scroll, docs_assets_tldr_mascot_square_hero, docs_assets_social_preview_og_banner [INFERRED 0.85]
- **TL;DR Browser/Home-Screen Icon Set** — docs_assets_favicon_32_app_icon, docs_assets_apple_touch_icon_app_icon, docs_assets_android_chrome_192_app_icon [INFERRED 0.85]

## Communities (91 total, 22 thin omitted)

### Community 0 - "Landing Page UI"
Cohesion: 0.05
Nodes (44): Supported Agents Marquee, 40+ Agent CLIs Support Claim, Answer Shape Dispatch (confirm/greeting/error/code), Card Spotlight Pointer Effect (--mx/--my), Claude Code Plugin Install (/plugin marketplace add), Claude -80% Prose Reduction (119/599), Code Never Compressed Rule, Interactive Compression Demo (+36 more)

### Community 1 - "Token Cost & Inspirations"
Cohesion: 0.06
Nodes (27): Agent deployment file paths, Hermes SOUL.md target, install.sh one-line install, /tldr command deployment, Prose-only token count, caveman (Brussee) inspiration, Caveman personification problem, Bai et al., Constitutional AI (2022) (+19 more)

### Community 2 - "Installer CLI Core"
Cohesion: 0.10
Nodes (33): ALLOWED_DOWNLOAD_HOSTS, captureSpawn(), checkNodeVersion(), checkWslWindowsNode(), child_process, crypto, detectMatch(), detectRepoRoot() (+25 more)

### Community 3 - "OpenCode & Hook Install"
Cohesion: 0.15
Nodes (25): hasCmd(), installHooks(), keepJsoncComments(), rewriteUninstalled(), sha256Hex(), shellEscape(), uninstall(), installOpencode() (+17 more)

### Community 4 - "Self-Update Flow"
Cohesion: 0.17
Nodes (27): applyUpdate(), CACHE_DIR, child_process, currentDescribe(), defaultRunInstall(), ensureClone(), fetchAll(), findLatestReleaseTag() (+19 more)

### Community 5 - "JSONC Patch Engine"
Cohesion: 0.17
Nodes (24): diffArray(), diffMembers(), fmt(), hasOwn(), indentBlock(), insertEdits(), { isDeepStrictEqual }, isPlainObject() (+16 more)

### Community 6 - "CI Workflow"
Cohesion: 0.09
Nodes (25): runs-on, steps, jobs, gates, node-tests, node-version, name, runs-on (+17 more)

### Community 7 - "Test Harness Core"
Cohesion: 0.10
Nodes (14): HOOKS_SRC, ROOT, flagDir, root, code, HERE, PS1, REPO_ROOT (+6 more)

### Community 8 - "Eval Scoring Harness"
Cohesion: 0.15
Nodes (13): evaluate_prompt(), task(), has_validation_phrase(), judge_informative(), judge_pushback(), main(), optimize(), propose_candidates() (+5 more)

### Community 9 - "Prompt Version History"
Cohesion: 0.09
Nodes (17): v0.13.1 five-agent reference numbers, v0.18.0 cross-model result tables, TLDR.blunt.md v0.15.0 (anti-sycophancy variant), TLDR.blunt.md v0.18.0 (DSPy round-2 winner), TLDR.chat.md merged into TLDR.md, 5-agent cross-model held-out evaluation, DSPy-style instruction evolution, Codex independent judge (+9 more)

### Community 10 - "Package Manifest"
Cohesion: 0.09
Nodes (20): author, bin, tldr, bugs, url, description, engines, node (+12 more)

### Community 11 - "Install Manifests & Tests"
Cohesion: 0.12
Nodes (13): fs, os, path, AGENT_HOOK_SCRIPTS, CLAUDE_HOOK_MARKERS, HOOK_FILES, OPENCODE_COMMAND_FILES, SKILL_DIRS (+5 more)

### Community 12 - "Repo Verification Checks"
Cohesion: 0.20
Nodes (14): CheckFailure, ensure(), _frontmatter_description(), main(), read_json(), run(), section(), shell_path() (+6 more)

### Community 13 - "Extension & Fenced Count"
Cohesion: 0.12
Nodes (11): config, here, instructions, loadShared(), require, tldrExtension(), { findFencedBlocks, stripFencedBlocks, upsertFencedBlock }, HERE (+3 more)

### Community 14 - "OpenClaw Installer"
Cohesion: 0.22
Nodes (15): appendBootstrapToSoul(), frontmatterHasKey(), fs, installOpenclaw(), loadBootstrapSnippet(), loadSkillBody(), mergeOpenclawFrontmatter(), os (+7 more)

### Community 15 - "End-to-End Install Tests"
Cohesion: 0.13
Nodes (10): HERE, INSTALLER, SANDBOX_HOME, HERE, hooksState(), INSTALLER, run(), jsOnly (+2 more)

### Community 17 - "Cross-Model Holdout Runner"
Cohesion: 0.23
Nodes (11): has_validation(), main(), _prepend(), read_optional(), run_claude(), run_codex(), run_cursor_agent(), run_gemini() (+3 more)

### Community 18 - "Evaluation Methodology Lessons"
Cohesion: 0.13
Nodes (6): Lexicographic selection metric, Q08/Q13 sanity gates, N=2/N=3 trial structure, v0.14 multi-harness sweep (11 CLIs), Per-harness reliability matrix, tier3 promoted as v0.14

### Community 20 - "Config File Handling"
Cohesion: 0.22
Nodes (13): argToChange(), CLEAR, crypto, findRepoConfigPath(), fs, getConfigDir(), getConfigPath(), getDefaultMode() (+5 more)

### Community 21 - "Mode Flag Tracker"
Cohesion: 0.22
Nodes (12): run(), clearFlag(), flagPath(), readFlag(), resolveFlagDir(), safeWriteFlag(), run(), assert (+4 more)

### Community 22 - "Fresh Install Tests"
Cohesion: 0.14
Nodes (9): HERE, INSTALLER, REPO_ROOT, requireCjs, runInstaller(), SANDBOX_HOME, sandboxEnv(), SETTINGS (+1 more)

### Community 23 - "Eval Design Decisions"
Cohesion: 0.15
Nodes (9): Codex-as-Judge Analysis, COPRO-Style Instruction Evolution, Cross-Model Held-Out Generation, DSPy Optimization Scripts, Dev Question Prompt Corpus, Three-Arm Eval Harness, Before/After Token Compression Claim, blunt Upstream Project (+1 more)

### Community 24 - "Claude & Gemini Install"
Cohesion: 0.19
Nodes (7): installClaude(), installGemini(), installViaSkills(), dryIO(), ctxFor(), repoRoot, require

### Community 25 - "Install IO Abstractions"
Cohesion: 0.18
Nodes (7): fs, realIO(), createSecureTempDir(), realio(), repoRoot, require, mk()

### Community 26 - "Bug Report Template"
Cohesion: 0.14
Nodes (13): label, options, render, body, attributes, id, type, validations (+5 more)

### Community 27 - "Idea Issue Template"
Cohesion: 0.14
Nodes (13): label, options, body, attributes, id, type, validations, description (+5 more)

### Community 28 - "Shell Installer"
Cohesion: 0.27
Nodes (12): download_file(), install_commands(), install_hermes(), install_standard_locations(), resolve_command(), resolve_prompt(), install.sh script, usage() (+4 more)

### Community 29 - "Installer Acid Tests"
Cohesion: 0.16
Nodes (7): HERE, INSTALLER, noAgentBins(), pathWithout(), REPO_ROOT, run(), sandboxEnv()

### Community 30 - "Skill & Command Docs"
Cohesion: 0.26
Nodes (12): AGENTS.md Skill Import, /tldr Slash Command, GEMINI.md Skill Import, Sources-of-Truth Edit Table, Agent Compatibility Report Template, TLDR Skill Definition (SKILL.md), Always-On Rules Body (rules-file), OpenClaw Bootstrap Block (+4 more)

### Community 31 - "Activation Script Tests"
Cohesion: 0.17
Nodes (6): fs, path, assert, fs, os, path

### Community 32 - "Cross-Model Analysis"
Cohesion: 0.27
Nodes (6): has_validation(), main(), judge_one(), words(), judge_informative_codex(), judge_pushback_codex()

### Community 33 - "Mode Switch Tests"
Cohesion: 0.17
Nodes (7): assert, fs, os, path, assert, CLEAR, rows

### Community 34 - "OpenCode Install Tests"
Cohesion: 0.18
Nodes (8): HERE, INSTALLER, ocEnv(), pathWithout(), REPO_ROOT, requireCjs, SANDBOX_HOME, SETTINGS

### Community 35 - "Agent Hook Providers"
Cohesion: 0.29
Nodes (8): buildClaudeStyle(), buildCursorStyle(), buildZcodeStyle(), isObj(), isOurs(), pruneFlat(), pruneGrouped(), STYLES

### Community 36 - "Fenced Block Ruleset"
Cohesion: 0.38
Nodes (9): collapseSeams(), findFencedBlocks(), stripFencedBlocks(), upsertFencedBlock(), fs, path, stripFencedFile(), stripFencedRuleset() (+1 more)

### Community 37 - "Hermes Installer"
Cohesion: 0.31
Nodes (10): fs, hermesConfigDir(), hermesSkillsRoot(), hermesSoulPath(), installHermes(), loadHermesRuleset(), mergeHermesSoul(), os (+2 more)

### Community 38 - "Native Agent Install"
Cohesion: 0.25
Nodes (9): changedKeys(), copyHookScripts(), fs, installAgentHooks(), installNative(), installPiExtension(), { isDeepStrictEqual }, os (+1 more)

### Community 39 - "Benchmark Visualizations"
Cohesion: 0.22
Nodes (11): TLDR.md Char-Count per Version (bar chart), Char counts 9377 to 1521 across v0.10-v0.14, plateau at 1521, Cell status legend: pass (green check), fail (red cross), not-applicable (grey dash), TLDR.md v0.14 Compliance Heatmap (cell-level), Harness by compliance-question matrix (11 harnesses x Q01-Q15), Mean reduction series v0.10-v0.14: 65.0%, 70.0%, 76.0%, 82.1%, -1107.0%, TLDR.md Progression - Mean Reduction % per Version (line chart), v0.14 negative-reduction outlier plotted far off-canvas (-1107%) (+3 more)

### Community 40 - "Agent Hook Tests"
Cohesion: 0.18
Nodes (5): H, require, root, METHODS, require

### Community 41 - "Doc Sync & Link Checks"
Cohesion: 0.25
Nodes (5): expect_contains(), fail(), iter_markdown_lines(), main(), normalize_target()

### Community 42 - "Native Install Tests"
Cohesion: 0.22
Nodes (7): dirFor(), HERE, INSTALLER, NATIVE, REPO_ROOT, rulesFor(), skillFor()

### Community 45 - "Stdin Hook Tests"
Cohesion: 0.20
Nodes (6): assert, fs, HOOK_PATH, os, path, { spawnSync }

### Community 46 - "JSONC Native Tests"
Cohesion: 0.20
Nodes (5): HERE, INSTALLER, REPO_ROOT, require, { stripJsonComments }

### Community 47 - "Installer Architecture"
Cohesion: 0.22
Nodes (4): Claude Hook/Statusline Stack, One Repo, Two Install Paths, UserPromptSubmit Mode Tracker, Statusline Badge

### Community 48 - "Dependabot Config"
Cohesion: 0.22
Nodes (8): prefix, interval, updates, commit-message, directory, package-ecosystem, schedule, version

### Community 49 - "OpenCode Plugin Runtime"
Cohesion: 0.31
Nodes (7): applyModeChange(), config, flagPath, handleSessionCreated(), here, parseModeChange(), TldrPlugin()

### Community 50 - "Hermes Install Tests"
Cohesion: 0.22
Nodes (4): HERE, HERMES_SKILLS, INSTALLER, REPO_ROOT

### Community 51 - "OpenCode JSONC Tests"
Cohesion: 0.22
Nodes (6): HERE, INSTALLER, { OPENCODE_PLUGIN_REL }, REPO_ROOT, requireCjs, SETTINGS

### Community 52 - "Claude Plugin Manifest"
Cohesion: 0.25
Nodes (7): description, name, owner, name, url, plugins, $schema

### Community 53 - "Core Prompt Rules"
Cohesion: 0.25
Nodes (4): Verification Gates, PR Verification Checklist, Canonical TLDR Prompt (TLDR.md), Auto-Clarity

### Community 54 - "Token Measurement Script"
Cohesion: 0.39
Nodes (4): count(), fmt_pct(), main(), stats()

### Community 55 - "Pi Extension Package"
Cohesion: 0.25
Nodes (7): description, name, pi, extensions, private, type, version

### Community 56 - "Safe Filesystem Guards"
Cohesion: 0.29
Nodes (3): fs, os, path

### Community 57 - "Prompt Evolution Notes"
Cohesion: 0.29
Nodes (5): Hard response templates (v0.5), Per-prompt-shape token budget table (v0.4), Cross-agent variance shrinkage, Sharma et al., Towards Understanding Sycophancy in Language Models (2023), Variance shrinkage as the real result

### Community 58 - "Brand Marks SVG"
Cohesion: 0.38
Nodes (7): TLDR Legacy Pixel Rock Mark (480x480, crispEdges pixel grid), Fold symbolism: dog-eared page plus tapering rule lengths = 'too long to short', TLDR Mark - Folded Summary Page (120x120), Mascot anatomy: spectacled owl (review), scroll spiral (long prose), scissors (cut), sticky 'TL;DR / Verdict first.', TLDR Mascot - Owl with Scroll, Scissors and Sticky Note (512x512), TLDR Owl Mascot shipped with the skill (512x512, duplicate of docs mascot), TLDR 'TL' Circular Badge (64x64, cream on dark brown)

### Community 59 - "Skill Instructions Loader"
Cohesion: 0.33
Nodes (5): fs, getInstructions(), path, readSkill(), SKILL_CANDIDATES

### Community 60 - "Codex Directory Manifest"
Cohesion: 0.29
Nodes (6): interface, default_prompt, display_name, icon_large, icon_small, short_description

### Community 61 - "Symlink Flag Tests"
Cohesion: 0.29
Nodes (5): VALID_MODES, assert, fs, os, path

### Community 62 - "OpenCode Package"
Cohesion: 0.29
Nodes (6): description, main, name, private, type, version

### Community 63 - "Update Flow Tests"
Cohesion: 0.29
Nodes (4): HERE, INSTALLER, require, UPDATE

### Community 64 - "Repo Config Tests"
Cohesion: 0.29
Nodes (5): assert, fs, os, path, tmpHome

### Community 65 - "Installer Module Docs"
Cohesion: 0.33
Nodes (5): Installer Modules (bin/lib), Native-Agent Hooks, Adding a New Agent, 30+ Agent Install Matrix, SessionStart Hook

### Community 66 - "LLM Eval Runner"
Cohesion: 0.47
Nodes (3): claude_version(), main(), run_claude()

### Community 67 - "Harness Ceiling Findings"
Cohesion: 0.40
Nodes (3): Hermes structural ceiling (87%), Hermes harness-bounded ceiling, Hermes structural ceiling

### Community 68 - "Levels & OpenCode Docs"
Cohesion: 0.40
Nodes (4): Intensity Levels, Persistence Rule, opencode /tldr Command Template, opencode Native Plugin

### Community 69 - "Checksum Download Verify"
Cohesion: 0.83
Nodes (4): assertDownloadUrl(), downloadBuffer(), fetchCapped(), loadRemoteChecksums()

### Community 70 - "Brand Raster Assets"
Cohesion: 0.67
Nodes (4): TLDR Open Graph Social Preview Banner, Verdict First Filler Never Tagline Lockup, TLDR Owl Mascot Cutting a Long Scroll, TLDR Owl Mascot Square Hero Illustration

### Community 73 - "Favicon Icon Set"
Cohesion: 1.00
Nodes (3): TL;DR Android Chrome 192px App Icon, TL;DR Apple Touch 180px Icon, TL;DR 32px Favicon

### Community 74 - "Landing A11y & Motion"
Cohesion: 0.67
Nodes (3): Accessibility Affordances (skip link, ARIA roles, focus-visible), prefers-reduced-motion Support, Reveal-on-Scroll Animation (IntersectionObserver + fallback)

## Knowledge Gaps
- **70 isolated node(s):** `Claude Hook/Statusline Stack`, `30+ Agent Install Matrix`, `Before/After Token Compression Claim`, `Override Clause`, `Expansion On Request` (+65 more)
  These have ≤1 connection - possible missing edges or undocumented components. (Counts symbols only; 478 node(s) total have ≤1 connection when file, concept and rationale nodes are included.)
- **22 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `ModeTrackerTests` connect `Mode Tracker Tests` to `Hook Script Tests`?**
  _High betweenness centrality (0.005) - this node is a cross-community bridge._
- **Are the 2 inferred relationships involving `main()` (e.g. with `captureSpawn()` and `installHooks()`) actually correct?**
  _`main()` has 2 INFERRED edges - model-reasoned connections that need verification._
- **What connects `Claude Hook/Statusline Stack`, `30+ Agent Install Matrix`, `Before/After Token Compression Claim` to the rest of the system?**
  _70 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Landing Page UI` be split into smaller, more focused modules?**
  _Cohesion score 0.05272895467160037 - nodes in this community are weakly interconnected._
- **Why does `main()` connect `Installer CLI Core` to `OpenCode & Hook Install`, `Self-Update Flow`, `Hermes Installer`, `Checksum Download Verify`, `Native Agent Install`, `Claude & Gemini Install`, `Install IO Abstractions`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._
- **Should `Token Cost & Inspirations` be split into smaller, more focused modules?**
  _Cohesion score 0.05855855855855856 - nodes in this community are weakly interconnected._
- **Why does `dryIO()` connect `Claude & Gemini Install` to `Agent Hook Tests`, `Install IO Abstractions`, `Installer CLI Core`, `Rules File Tests`?**
  _High betweenness centrality (0.003) - this node is a cross-community bridge._