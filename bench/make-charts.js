#!/usr/bin/env node
// make-charts.js — emit SVG bar/heatmap charts from charts.json
const fs = require('fs');
const path = require('path');

const REPO_ROOT = path.resolve(__dirname, '..');
const OUT = path.resolve(process.argv[2] || process.env.TLDR_CHART_OUT || path.join(REPO_ROOT, 'data/visualizations'));
const SRC = path.resolve(process.argv[3] || process.env.TLDR_CHART_SRC || path.join(OUT, 'charts.json'));
fs.mkdirSync(OUT, { recursive: true });
const data = JSON.parse(fs.readFileSync(SRC, 'utf8'));

const esc = s => String(s).replace(/[<>&"']/g, c => ({ '<':'&lt;','>':'&gt;','&':'&amp;','"':'&quot;',"'":'&apos;' }[c]));
const pct = v => `${v.toFixed(0)}%`;

function head(w, h, title) {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${w} ${h}" font-family="ui-sans-serif,system-ui,sans-serif" font-size="13">
<style>
.title{font-size:18px;font-weight:600}
.gridline{stroke:#e5e7eb;stroke-width:1}
.bar-base{fill:#ef4444}
.bar-tldr{fill:#22c55e}
.label{fill:#1f2937}
.label-sm{fill:#6b7280;font-size:11px}
.pass{fill:#22c55e}
.fail{fill:#ef4444}
.warn{fill:#f59e0b}
.gone{fill:#9ca3af}
</style>
<text x="${w/2}" y="24" text-anchor="middle" class="title">${esc(title)}</text>
`;
}
const tail = '</svg>';

function reductionPerHarness() {
  const rows = data.reduction_per_harness;
  const W = 980, H = 80 + rows.length * 44 + 60;
  const LEFT = 130, RIGHT = W - 60;
  const maxTok = Math.max(1, ...rows.flatMap(r => [r.baseline_tok, r.tldr_tok]));
  const scale = (RIGHT - LEFT) / (maxTok * 1.05);
  let s = head(W, H, 'TLDR.md v0.14 — prose tokens per harness (baseline vs TLDR.md)');
  rows.forEach((r, i) => {
    const y = 60 + i * 44;
    const bw = r.baseline_tok * scale;
    const tw = r.tldr_tok * scale;
    s += `<text x="${LEFT - 8}" y="${y + 14}" text-anchor="end" class="label">${esc(r.harness)}</text>\n`;
    s += `<rect x="${LEFT}" y="${y}" width="${bw}" height="14" class="bar-base"/>\n`;
    s += `<rect x="${LEFT}" y="${y + 18}" width="${tw}" height="14" class="bar-tldr"/>\n`;
    s += `<text x="${LEFT + bw + 4}" y="${y + 12}" class="label-sm">${r.baseline_tok}</text>\n`;
    s += `<text x="${LEFT + tw + 4}" y="${y + 30}" class="label-sm">${r.tldr_tok} (${pct(r.reduction_pct)})</text>\n`;
  });
  s += `<g transform="translate(${LEFT}, ${H - 36})">
  <rect x="0" y="0" width="14" height="14" class="bar-base"/><text x="20" y="12" class="label-sm">baseline</text>
  <rect x="100" y="0" width="14" height="14" class="bar-tldr"/><text x="120" y="12" class="label-sm">TLDR.md</text>
  </g>`;
  fs.writeFileSync(path.join(OUT, 'reduction-per-harness.svg'), s + tail);
}

function complianceHeatmap() {
  const rows = data.compliance_matrix.rows;
  const qs = data.compliance_matrix.qs;
  const CELL = 44, LEFT = 130, TOP = 80;
  const W = LEFT + CELL * qs.length + 30;
  const H = TOP + CELL * rows.length + 40;
  let s = head(W, H, 'TLDR.md v0.14 — compliance heatmap (cell-level)');
  qs.forEach((q, j) => {
    s += `<text x="${LEFT + CELL * j + CELL/2}" y="${TOP - 12}" text-anchor="middle" class="label-sm">${esc(q)}</text>\n`;
  });
  rows.forEach((r, i) => {
    s += `<text x="${LEFT - 8}" y="${TOP + CELL * i + CELL/2 + 4}" text-anchor="end" class="label">${esc(r.harness)}</text>\n`;
    qs.forEach((q, j) => {
      const cell = r.cells[q];
      const cls = cell === true ? 'pass' : cell === false ? 'fail' : 'gone';
      const lab = cell === true ? '✓' : cell === false ? '✗' : '—';
      s += `<rect x="${LEFT + CELL * j + 1}" y="${TOP + CELL * i + 1}" width="${CELL - 4}" height="${CELL - 4}" class="${cls}"/>\n`;
      s += `<text x="${LEFT + CELL * j + CELL/2}" y="${TOP + CELL * i + CELL/2 + 5}" text-anchor="middle" fill="white" font-weight="700">${lab}</text>\n`;
    });
  });
  fs.writeFileSync(path.join(OUT, 'compliance-heatmap.svg'), s + tail);
}

function progression() {
  const pts = data.progression || [];
  if (!pts.length) return;
  const W = 900, H = 380;
  const LEFT = 70, RIGHT = W - 40, TOP = 60, BOTTOM = H - 60;
  const xs = i => LEFT + (RIGHT - LEFT) * i / Math.max(1, pts.length - 1);
  const yRed = v => BOTTOM - (BOTTOM - TOP) * v / 100;
  let s = head(W, H, 'TLDR.md progression — mean reduction % per version');
  for (let v = 0; v <= 100; v += 20) {
    s += `<line x1="${LEFT}" x2="${RIGHT}" y1="${yRed(v)}" y2="${yRed(v)}" class="gridline"/>\n`;
    s += `<text x="${LEFT - 8}" y="${yRed(v) + 4}" text-anchor="end" class="label-sm">${v}%</text>\n`;
  }
  pts.forEach((p, i) => {
    s += `<text x="${xs(i)}" y="${BOTTOM + 18}" text-anchor="middle" class="label-sm">${esc(p.version)}</text>\n`;
  });
  s += `<polyline points="${pts.map((p, i) => `${xs(i)},${yRed(p.mean_reduction_pct)}`).join(' ')}" fill="none" stroke="#22c55e" stroke-width="3"/>\n`;
  pts.forEach((p, i) => {
    s += `<circle cx="${xs(i)}" cy="${yRed(p.mean_reduction_pct)}" r="5" fill="#22c55e"/>\n`;
    s += `<text x="${xs(i)}" y="${yRed(p.mean_reduction_pct) - 10}" text-anchor="middle" class="label-sm">${p.mean_reduction_pct.toFixed(1)}%</text>\n`;
  });
  fs.writeFileSync(path.join(OUT, 'progression.svg'), s + tail);
}

function charCount() {
  const pts = data.progression || [];
  if (!pts.length) return;
  const W = 900, H = 360;
  const LEFT = 80, RIGHT = W - 40, TOP = 60, BOTTOM = H - 60;
  const maxC = Math.max(1, ...pts.map(p => p.char_count)) * 1.1;
  const step = (RIGHT - LEFT) / pts.length;
  const BW = step * 0.7;
  const y = v => BOTTOM - (BOTTOM - TOP) * v / maxC;
  let s = head(W, H, 'TLDR.md char-count per version');
  for (let v = 0; v <= maxC; v += 2000) {
    s += `<line x1="${LEFT}" x2="${RIGHT}" y1="${y(v)}" y2="${y(v)}" class="gridline"/>\n`;
    s += `<text x="${LEFT - 8}" y="${y(v) + 4}" text-anchor="end" class="label-sm">${v}</text>\n`;
  }
  pts.forEach((p, i) => {
    const cx = LEFT + step * i + step / 2;
    s += `<rect x="${cx - BW/2}" y="${y(p.char_count)}" width="${BW}" height="${BOTTOM - y(p.char_count)}" fill="#3b82f6"/>\n`;
    s += `<text x="${cx}" y="${BOTTOM + 18}" text-anchor="middle" class="label-sm">${esc(p.version)}</text>\n`;
    s += `<text x="${cx}" y="${y(p.char_count) - 4}" text-anchor="middle" class="label-sm">${p.char_count}</text>\n`;
  });
  fs.writeFileSync(path.join(OUT, 'char-count-delta.svg'), s + tail);
}

if (data.reduction_per_harness) reductionPerHarness();
if (data.compliance_matrix) complianceHeatmap();
if (data.progression) { progression(); charCount(); }
console.log(`charts written to ${OUT}`);
