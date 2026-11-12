'use strict';
// Filesystem / process seam for the installer. Install code performs every
// mutation through an `io` object and never branches on --dry-run itself:
//   realIO  performs the operation
//   dryIO   records "would …" and performs nothing
// Reads (existsSync, readFileSync) stay on `fs` — a dry run should plan against
// the real on-disk state.

const fs = require('fs');
const { atomicWrite, createSecureTempDir } = require('./safe-fs');

// `run(cmd, args)`, `out(line)` and `download(url)` are injected so this module
// owns no process or network state. run → { status }; download → Promise<Buffer>.
// `download` is a thunk because the real fetcher lives in install.js.
function realIO({ run, out = (s) => process.stdout.write(s + '\n'), download }) {
  return {
    dryRun: false,
    mkdirp: (p) => { fs.mkdirSync(p, { recursive: true }); },
    copyFile: (src, dest) => { fs.copyFileSync(src, dest); },
    copyDir: (src, dest) => { fs.cpSync(src, dest, { recursive: true }); },
    // COPYFILE_EXCL refuses any pre-existing destination, including a planted
    // symlink, so a backup never follows or clobbers a link target.
    copyFileExcl: (src, dest) => { try { fs.copyFileSync(src, dest, fs.constants.COPYFILE_EXCL); } catch (_) { /* keep the first backup */ } },
    writeFile: (p, text) => { fs.writeFileSync(p, text); },
    atomicWrite: (p, text, mode) => { atomicWrite(p, text, mode); },
    unlink: (p) => { try { fs.unlinkSync(p); } catch (_) { /* already gone */ } },
    rm: (p) => { try { fs.rmSync(p, { recursive: true, force: true }); } catch (_) { /* already gone */ } },
    run,
    // fetch resolves to the body; tempDir creates a private 0700 dir.
    fetch: (url) => download(url),
    tempDir: (prefix) => createSecureTempDir(prefix),
    report: (msg) => out(msg),
  };
}

function dryIO({ note, run }) {
  const plan = [];
  const would = (op, target) => { plan.push({ op, target }); note(`  would ${op} ${target}`); };
  return {
    dryRun: true,
    plan,
    mkdirp: (p) => would('mkdir', p),
    copyFile: (_src, dest) => would('write', dest),
    copyDir: (_src, dest) => would('copy', dest + '/'),
    copyFileExcl: (_src, dest) => would('write', dest),
    writeFile: (p) => would('write', p),
    atomicWrite: (p) => would('write', p),
    unlink: (p) => would('remove', p),
    rm: (p) => would('remove', p),
    // A dry run never touches the network or creates dirs: fetch resolves to
    // null (no body, so no integrity check) and tempDir returns a placeholder.
    fetch: async (url) => { would('download', url); return null; },
    tempDir: (prefix) => require('path').join(require('os').tmpdir(), prefix + 'DRYRUN'),
    run,                    // runSpawn(..., dry=true) prints "would run: …" and returns {status:0}
    report: () => {},       // "installed: …" lines are not true in a dry run
  };
}

module.exports = { realIO, dryIO };
