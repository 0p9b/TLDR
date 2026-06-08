#!/usr/bin/env node
// analyze.js — read fullbench/{baseline,tldr}/*.log, compute per-cell + per-harness metrics.
const fs = require('fs');
const path = require('path');
const os = require('os');
const { clean, tok } = require('./tokenize');

const REPO_ROOT = path.resolve(__dirname, '..');
const ROOT = path.resolve(process.argv[2] || process.env.TLDR_BENCH_ROOT || path.join(os.homedir(), 'bench-v14/fullbench'));
const OUT = path.resolve(process.argv[3] || process.env.TLDR_BENCH_RESULTS || path.join(os.homedir(), 'bench-v14/results'));
const N_TRIALS = Number(process.env.N_TRIALS || 2);
const HARNESSES = ['claude','codex','copilot','droid','hermes','opencode','openclaw','pi','cline','agent','gemini'];
const QS = ['Q01','Q02','Q03','Q04','Q05','Q06','Q07','Q08','Q09','Q10','Q11','Q12','Q13','Q14','Q15'];
const CAPS = { Q01:40, Q02:250, Q03:150, Q04:200, Q05:70, Q06:50, Q07:350, Q08:100, Q09:600, Q10:80, Q11:50, Q12:300, Q13:40, Q14:50, Q15:400 };

function readCell(cond, h, q, trial) {
  const fp = path.join(ROOT, cond, `${h}__${q}__${trial}.log`);
  try {
    const raw = fs.readFileSync(fp, 'utf8');
    const c = clean(raw);
    return { tokens: tok(c), bytes: raw.length, cleaned_chars: c.length };
  } catch (e) {
    return null;
  }
}

const cells = []; // {cond, h, q, trial, tokens, bytes}
for (const h of HARNESSES) {
  for (const q of QS) {
    for (let t = 1; t <= N_TRIALS; t++) {
      for (const cond of ['baseline', 'tldr']) {
        const r = readCell(cond, h, q, t);
        if (r) cells.push({ cond, h, q, trial: t, ...r });
      }
    }
  }
}

// Per-harness aggregate
const summary = {};
for (const h of HARNESSES) {
  const baseCells = cells.filter(c => c.h === h && c.cond === 'baseline' && c.tokens > 0);
  const tldrCells = cells.filter(c => c.h === h && c.cond === 'tldr' && c.tokens > 0);
  const baseSum = baseCells.reduce((s,c) => s + c.tokens, 0);
  const tldrSum = tldrCells.reduce((s,c) => s + c.tokens, 0);
  const reduction = baseSum > 0 ? (baseSum - tldrSum) / baseSum * 100 : 0;
  // compliance: cells under cap
  let pass = 0, totalT = 0;
  for (const q of QS) {
    const trials = cells.filter(c => c.h === h && c.q === q && c.cond === 'tldr' && c.tokens > 0);
    if (!trials.length) continue;
    const meanTok = trials.reduce((s,c) => s + c.tokens, 0) / trials.length;
    totalT++;
    if (meanTok <= CAPS[q]) pass++;
  }
  summary[h] = {
    baseline_tok: baseSum,
    tldr_tok: tldrSum,
    reduction_pct: reduction,
    compliance_n: pass,
    compliance_total: totalT,
    compliance_pct: totalT > 0 ? pass / totalT * 100 : 0,
    base_cells: baseCells.length,
    tldr_cells: tldrCells.length,
  };
}

// Per-cell compliance matrix
const matrix = {};
for (const h of HARNESSES) {
  matrix[h] = {};
  for (const q of QS) {
    const trials = cells.filter(c => c.h === h && c.q === q && c.cond === 'tldr' && c.tokens > 0);
    if (!trials.length) { matrix[h][q] = null; continue; }
    const meanTok = trials.reduce((s,c) => s + c.tokens, 0) / trials.length;
    matrix[h][q] = { mean_tok: meanTok, cap: CAPS[q], pass: meanTok <= CAPS[q] };
  }
}

// Print table
console.log('# Phase 2 results — per-harness reduction + compliance\n');
console.log('| harness | base tok | tldr tok | reduction | compliance | base/tldr cells |');
console.log('|---|---:|---:|---:|---:|---:|');
for (const h of HARNESSES) {
  const s = summary[h];
  console.log(`| ${h.padEnd(8)} | ${s.baseline_tok} | ${s.tldr_tok} | ${s.reduction_pct.toFixed(1)}% | ${s.compliance_n}/${s.compliance_total} (${s.compliance_pct.toFixed(0)}%) | ${s.base_cells}/${s.tldr_cells} |`);
}

// Find failing cells for A/B targeting
const failing = [];
for (const h of HARNESSES) {
  for (const q of QS) {
    const m = matrix[h][q];
    if (m && !m.pass) failing.push({ h, q, mean: m.mean_tok, cap: m.cap });
  }
}
console.log(`\n# Failing cells: ${failing.length}\n`);
failing.forEach(f => console.log(`  ${f.h}/${f.q}: ${f.mean.toFixed(0)} > ${f.cap}`));

// Write JSON outputs
fs.mkdirSync(OUT, { recursive: true });
fs.writeFileSync(path.join(OUT, 'summary.json'), JSON.stringify(summary, null, 2));
fs.writeFileSync(path.join(OUT, 'matrix.json'), JSON.stringify(matrix, null, 2));
fs.writeFileSync(path.join(OUT, 'failing.json'), JSON.stringify(failing, null, 2));

// charts.json (for make-charts.js)
const reduction_per_harness = HARNESSES.map(h => ({
  harness: h, baseline_tok: summary[h].baseline_tok, tldr_tok: summary[h].tldr_tok, reduction_pct: summary[h].reduction_pct
}));
const compliance_matrix = {
  qs: QS,
  rows: HARNESSES.map(h => ({
    harness: h,
    cells: Object.fromEntries(QS.map(q => [q, matrix[h][q]?.pass ?? null]))
  }))
};
const progression = [
  { version: 'v0.10', mean_reduction_pct: 65, char_count: 9377 },
  { version: 'v0.11', mean_reduction_pct: 70, char_count: 7800 },
  { version: 'v0.12', mean_reduction_pct: 76, char_count: 4200 },
  { version: 'v0.13.1', mean_reduction_pct: 82.1, char_count: 1521 },
  { version: 'v0.14',   mean_reduction_pct: HARNESSES.reduce((s,h)=>s+summary[h].reduction_pct,0)/HARNESSES.length, char_count: Array.from(fs.readFileSync(path.join(REPO_ROOT, 'TLDR.md'), 'utf8')).length }
];
fs.writeFileSync(path.join(OUT, 'charts.json'), JSON.stringify({
  reduction_per_harness, compliance_matrix, progression
}, null, 2));

console.error(`wrote ${OUT}/summary.json, matrix.json, failing.json, charts.json`);
