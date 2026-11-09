// PostToolUse (Edit|Write): jalankan ESLint pada file .ts/.tsx/.js/.jsx yang baru diubah.
//
// Memakai ESLint lokal proyek (node_modules/.bin/eslint). Jika belum terpasang (proyek belum di-scaffold)
// atau hook error: diam (gagal-terbuka). Temuan dikembalikan ke Claude agar diperbaiki sekarang.
// Tidak memakai npx (mencegah mengunduh paket tak dikenal).
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = process.env.CLAUDE_PROJECT_DIR || process.cwd();

let raw = '';
process.stdin.on('data', (c) => (raw += c));
process.stdin.on('end', () => {
  try {
    const input = JSON.parse(raw);
    const file = path.resolve(root, (input.tool_input || {}).file_path || '');
    const relPath = path.relative(root, file);
    if (relPath.startsWith('..') || !/\.(tsx?|jsx?|mjs|cjs)$/i.test(file) || !fs.existsSync(file)) process.exit(0);
    if (/(^|[\\/])(node_modules|\.next|\.claude)[\\/]/.test(relPath)) process.exit(0);

    const bin = path.join(root, 'node_modules', '.bin', process.platform === 'win32' ? 'eslint.cmd' : 'eslint');
    if (!fs.existsSync(bin)) process.exit(0);

    const r = spawnSync(bin, ['--no-warn-ignored', '--format', 'unix', file], { cwd: root, encoding: 'utf8', timeout: 20000, shell: process.platform === 'win32' });
    if (r.status === 1 && r.stdout) {
      process.stdout.write(JSON.stringify({
        decision: 'block',
        reason: `ESLint menemukan masalah pada ${relPath}:\n${r.stdout.trim().slice(0, 1500)}\nPerbaiki sekarang (jangan menonaktifkan aturan keamanan dengan eslint-disable).`,
      }));
    }
  } catch (e) { /* gagal-terbuka */ }
  process.exit(0);
});
