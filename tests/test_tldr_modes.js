#!/usr/bin/env node
// Table-driven tests for parseModeChange (tldr-config.js): the one place that
// turns a user prompt into a mode change for the Claude hook, the opencode
// plugin and the Pi extension.
//
// Run: node tests/test_tldr_modes.js

const assert = require('assert');
const { parseModeChange } = require('../src/hooks/tldr-config');

const SET = (mode) => ({ action: 'set', mode });
const CLEAR = { action: 'clear' };

// TLDR_DEFAULT_MODE pins the "configured default" so rows are deterministic.
process.env.TLDR_DEFAULT_MODE = 'full';

const rows = [
  // ordinary prompts that merely mention tldr must not flip the mode
  ['let us start the tldr docs review',               undefined, null],
  ['can you start a tldr-style summary of the logs',  undefined, null],
  ['please activate tldr mode',                       undefined, SET('full')],
  ['start tldr',                                      undefined, SET('full')],
  // slash command
  ['/tldr',                    undefined,            SET('full')],
  ['/tldr ultra',              undefined,            SET('ultra')],
  ['/tldr lite',               undefined,            SET('lite')],
  ['/tldr wenyan-full',        undefined,            SET('wenyan')],
  ['/tldr wenyan',             undefined,            SET('wenyan')],
  ['/tldr off',                undefined,            CLEAR],
  ['/tldr stop',               undefined,            CLEAR],
  ['/tldr disable',            undefined,            CLEAR],
  ['/tldr bogus',              undefined,            null],
  ['/tldr commit',             undefined,            null],  // independent modes are not /tldr args
  ['/tldr tldr',               undefined,            null],  // only the opencode template maps this
  ['/tldr:tldr ultra',         undefined,            SET('ultra')],
  ['/TLDR ULTRA',              undefined,            SET('ultra')],
  // natural language
  ['activate tldr',            undefined,            SET('full')],
  ['talk like TLDR please',    undefined,            SET('full')],
  ['turn on tldr mode',        undefined,            SET('full')],
  ['stop tldr',                undefined,            CLEAR],
  ['please deactivate tldr',   undefined,            CLEAR],
  ['normal mode',              undefined,            CLEAR],
  ['what is normal mode in vim?', undefined,         null],
  ['stop talking like tldr',   undefined,            CLEAR],   // deactivation beats activation
  ['hello there',              undefined,            null],
  ['',                         undefined,            null],
  [undefined,                  undefined,            null],
  // opencode: wrapped quotes (non-interactive `run`)
  ['"/tldr ultra"',            { unwrapQuotes: true }, SET('ultra')],
  ['"/tldr ultra"',            undefined,            null],
  // opencode: expanded command template
  ['Activate TLDR mode: ultra\nstop tldr normal mode', { commandTemplate: true }, SET('ultra')],
  ['Activate TLDR mode: off',  { commandTemplate: true }, CLEAR],
  ['Activate TLDR mode: tldr', { commandTemplate: true }, SET('full')],
  ['Activate TLDR mode: wenyan-full', { commandTemplate: true }, SET('wenyan')],
  ['Activate TLDR mode:',      { commandTemplate: true }, SET('full')],
  ['Activate TLDR mode: nope', { commandTemplate: true }, SET('full')],
];

let passed = 0;
let failed = 0;
for (const [prompt, opts, want] of rows) {
  const label = `${JSON.stringify(prompt)} ${opts ? JSON.stringify(opts) : ''}`.trim();
  try {
    assert.deepStrictEqual(parseModeChange(prompt, opts), want);
    passed++;
    console.log(`  ✓ ${label}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ ${label}\n    ${e.message.split('\n').slice(0, 6).join('\n    ')}`);
  }
}

// default-off config: bare /tldr and NL activation must not set a flag.
process.env.TLDR_DEFAULT_MODE = 'off';
for (const [prompt, want] of [['/tldr', CLEAR], ['activate tldr', null]]) {
  try {
    assert.deepStrictEqual(parseModeChange(prompt), want);
    passed++;
    console.log(`  ✓ default=off ${JSON.stringify(prompt)}`);
  } catch (e) {
    failed++;
    console.error(`  ✗ default=off ${JSON.stringify(prompt)}\n    ${e.message}`);
  }
}

// removed mode as default: bare /tldr and NL activation fall back to full.
process.env.TLDR_DEFAULT_MODE = 'review';
for (const prompt of ['/tldr', 'activate tldr']) {
  try {
    assert.deepStrictEqual(parseModeChange(prompt), SET('full'));
    passed++;
    console.log(`  ✓ default=review ${JSON.stringify(prompt)} -> full`);
  } catch (e) {
    failed++;
    console.error(`  ✗ default=review ${JSON.stringify(prompt)}\n    ${e.message}`);
  }
}

console.log(`\n${passed} passed, ${failed} failed`);
process.exit(failed ? 1 : 0);
